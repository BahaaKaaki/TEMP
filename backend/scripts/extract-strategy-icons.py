#!/usr/bin/env python3
"""Extract Strategy& branded line-art icons from the VCS icon-compilation PPTX.

Usage:
  python3 backend/scripts/extract-strategy-icons.py \
    --input '/Users/bkaaki001/Downloads/20210712_Strategy_New_Icons_Keywords_V1.1.pptx' \
    --output backend/assets/icons/strategy

Output structure:
  <output>/<category>/<slug>.svg    -- one SVG per icon, viewBox=0 0 W H,
                                       stroke=currentColor, fill=none
  <output>/manifest.json            -- catalog the LLM and frontend consume

Design notes:
  * Source slides have 24 keyword captions arranged in a 3x8 grid below
    24 icon shapes. We anchor on the keyword text positions (recoverable as
    proper <a:t> runs) and collect every drawing shape sitting directly above
    in the same X column. That bypasses the "is this AUTO_SHAPE part of the
    icon or part of the chrome" ambiguity.
  * Icon shapes are converted to SVG paths in two ways:
      - <a:custGeom> with <a:pathLst>  -> walked command-by-command
      - <a:prstGeom prst="...">        -> emitted as <circle>/<rect>/<ellipse>
        (only the handful of presets we actually see in this deck)
  * Colors are normalised to currentColor at write time so consumers can
    theme via the existing var(--accent) token in slides.css.
  * Print summary stats only -- no per-icon spam, no PII concerns but follows
    the same no-noise pattern as build-allowlist.py.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

from lxml import etree
from pptx import Presentation
from pptx.util import Emu

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}

EMU_PER_INCH = 914400

# Bands of the slide where we look for icons / keyword captions, in inches.
ICON_REGION_TOP = 1.30
ICON_REGION_BOTTOM = 6.40
CAPTION_REGION_TOP = 2.40
CAPTION_REGION_BOTTOM = 6.60
HEADER_BOTTOM = 1.20  # slide title lives above this
FOOTER_TOP = 6.80

# Caption columns are roughly 1.4 inches wide; tolerate ±0.4in column drift.
COLUMN_X_TOLERANCE = 0.45

# Maximum vertical gap between an icon and the keyword text below it.
MAX_ICON_TO_CAPTION_GAP = 0.35

# Heuristic floor on icon dimensions; eliminates dust shapes.
MIN_ICON_DIM_INCHES = 0.20

# SVG viewBox we normalise every icon to (square, generous).
VIEWBOX_SIZE = 64.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract Strategy& icon library")
    parser.add_argument("--input", required=True, type=Path,
                        help="Path to the icon-compilation PPTX")
    parser.add_argument("--output", default=Path("backend/assets/icons/strategy"),
                        type=Path, help="Output directory")
    parser.add_argument("--keep-existing", action="store_true",
                        help="Do not delete existing SVGs in --output before extraction")
    parser.add_argument("--limit-slides", type=int, default=0,
                        help="Stop after N slides (debug)")
    return parser.parse_args()


# ---- Coordinate helpers --------------------------------------------------

def emu_to_inches(emu: Optional[int]) -> float:
    if emu is None:
        return 0.0
    return emu / EMU_PER_INCH


def shape_bbox_inches(shape) -> tuple[float, float, float, float]:
    """Return (left, top, width, height) in inches; zeros if any field is None."""
    left = emu_to_inches(shape.left)
    top = emu_to_inches(shape.top)
    width = emu_to_inches(shape.width)
    height = emu_to_inches(shape.height)
    return left, top, width, height


# ---- Path conversion -----------------------------------------------------

def custgeom_paths(spPr: etree._Element) -> tuple[list[str], int, int]:
    """Walk <a:custGeom>/<a:pathLst> and return (svg_d_list, path_w, path_h)."""
    custGeom = spPr.find("a:custGeom", NS)
    if custGeom is None:
        return [], 0, 0
    pathLst = custGeom.find("a:pathLst", NS)
    if pathLst is None:
        return [], 0, 0
    d_strings: list[str] = []
    path_w = 0
    path_h = 0
    for path_el in pathLst.findall("a:path", NS):
        path_w = max(path_w, int(path_el.get("w", 0)))
        path_h = max(path_h, int(path_el.get("h", 0)))
        parts: list[str] = []
        for cmd in path_el:
            tag = etree.QName(cmd).localname
            pts = cmd.findall("a:pt", NS)
            try:
                coords = [(int(p.get("x")), int(p.get("y"))) for p in pts]
            except (TypeError, ValueError):
                continue
            if tag == "moveTo" and coords:
                x, y = coords[0]
                parts.append(f"M{x} {y}")
            elif tag == "lnTo" and coords:
                x, y = coords[0]
                parts.append(f"L{x} {y}")
            elif tag == "cubicBezTo" and len(coords) == 3:
                (x1, y1), (x2, y2), (x3, y3) = coords
                parts.append(f"C{x1} {y1} {x2} {y2} {x3} {y3}")
            elif tag == "quadBezTo" and len(coords) == 2:
                (x1, y1), (x2, y2) = coords
                parts.append(f"Q{x1} {y1} {x2} {y2}")
            elif tag == "close":
                parts.append("Z")
            elif tag == "arcTo":
                # Approximate arc as line segment; rare in line icons.
                if coords:
                    x, y = coords[-1]
                    parts.append(f"L{x} {y}")
        if parts:
            d_strings.append(" ".join(parts))
    return d_strings, path_w, path_h


def prstgeom_svg(spPr: etree._Element, w_emu: int, h_emu: int) -> Optional[str]:
    """Convert simple <a:prstGeom prst="..."> to an SVG primitive snippet
    using the shape's own EMU width/height as the local coordinate space."""
    prstGeom = spPr.find("a:prstGeom", NS)
    if prstGeom is None:
        return None
    prst = prstGeom.get("prst")
    if not prst or not w_emu or not h_emu:
        return None
    if prst in {"ellipse", "oval"}:
        return f'<ellipse cx="{w_emu / 2:.0f}" cy="{h_emu / 2:.0f}" '\
               f'rx="{w_emu / 2:.0f}" ry="{h_emu / 2:.0f}"/>'
    if prst in {"rect", "roundRect"}:
        rx = w_emu * 0.05 if prst == "roundRect" else 0
        return f'<rect x="0" y="0" width="{w_emu}" height="{h_emu}" rx="{rx:.0f}"/>'
    if prst == "line":
        return f'<line x1="0" y1="0" x2="{w_emu}" y2="{h_emu}"/>'
    return None


def shape_geometry(shape) -> tuple[list[str], int, int, list[str]]:
    """Return (custGeom_d_strings, path_w_emu, path_h_emu, primitive_svg_snippets).

    custGeom paths use their own w/h coordinate space; primitives use the
    shape's own EMU dimensions."""
    spPr = None
    for el in shape._element.iter():
        if etree.QName(el).localname == "spPr":
            spPr = el
            break
    if spPr is None:
        return [], 0, 0, []
    d_strings, pw, ph = custgeom_paths(spPr)
    primitive = prstgeom_svg(spPr, shape.width or 0, shape.height or 0)
    primitives = [primitive] if primitive else []
    return d_strings, pw, ph, primitives


# ---- Slide metadata ------------------------------------------------------

KNOWN_CATEGORIES = {
    "generic icons that are not specific to a practice": "generic",
    "consumer markets": "consumer-markets",
    "health": "health",
    "multisector investments": "multisector-investments",
    "technology": "technology",
    "mergers and restructuring": "mergers-and-restructuring",
    "energy, chemicals and utilities": "energy-chemicals-and-utilities",
    "energy, chemicals & utilities": "energy-chemicals-and-utilities",
    "industrial manufacturing and automotive": "industrial-manufacturing-and-automotive",
    "public sector": "public-sector",
    "telecommunications": "telecommunications",
    "operations": "operations",
    "financial services": "financial-services",
    "media and entertainment": "media-and-entertainment",
    "real estate": "real-estate",
    "digital": "digital",
    "organization and strategy": "organization-and-strategy",
}


def slugify(text: str, max_len: int = 48) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text[:max_len].rstrip("-") or "icon"


def slide_title_text(slide) -> str:
    """Return the slide title (top-most text), used for category detection."""
    candidates: list[tuple[float, str]] = []
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        _, top, _, _ = shape_bbox_inches(shape)
        text = (shape.text_frame.text or "").strip()
        if not text:
            continue
        if top > HEADER_BOTTOM:
            continue
        candidates.append((top, text))
    candidates.sort()
    return candidates[0][1] if candidates else ""


def detect_category(title: str) -> tuple[str, str]:
    """Return (category_slug, variant_slug). Variant captures Large/Small."""
    raw = title.lower()
    raw = raw.replace("\x0b", " ").replace("\n", " ")
    category = "uncategorized"
    for needle, slug in KNOWN_CATEGORIES.items():
        if needle in raw:
            category = slug
            break
    variant = "small" if "small icons" in raw else "large" if "large icons" in raw else "default"
    return category, variant


# ---- Icon-cell construction ---------------------------------------------

def collect_icon_shapes(slide) -> list:
    """All drawing shapes in the icon region, sorted top-to-bottom, left-to-right."""
    out = []
    for shape in slide.shapes:
        type_name = str(shape.shape_type)
        if "FREEFORM" not in type_name and "AUTO_SHAPE" not in type_name:
            continue
        left, top, w, h = shape_bbox_inches(shape)
        if w < MIN_ICON_DIM_INCHES or h < MIN_ICON_DIM_INCHES:
            continue
        if top < ICON_REGION_TOP or top > ICON_REGION_BOTTOM:
            continue
        out.append(shape)
    out.sort(key=lambda s: (round(emu_to_inches(s.top), 1), emu_to_inches(s.left)))
    return out


def collect_caption_texts(slide) -> list[tuple[float, float, float, float, str]]:
    """Return [(left, top, width, height, text)] for keyword captions."""
    captions = []
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        text = (shape.text_frame.text or "").strip()
        if len(text) < 8:
            continue
        left, top, w, h = shape_bbox_inches(shape)
        if top < CAPTION_REGION_TOP or top > CAPTION_REGION_BOTTOM:
            continue
        if "icons compilation" in text.lower():
            continue
        if "if you don" in text.lower():
            continue
        if w < 0.4:
            continue
        captions.append((left, top, w, h, text))
    return captions


def cluster_shapes_for_caption(
    caption_left: float, caption_top: float, caption_width: float,
    icon_shapes: list,
) -> list:
    """Pick all icon shapes whose bottom is above the caption top and whose
    horizontal centre lies within the caption's column."""
    cluster = []
    cap_centre = caption_left + caption_width / 2
    for shape in icon_shapes:
        s_left, s_top, s_w, s_h = shape_bbox_inches(shape)
        s_bottom = s_top + s_h
        if s_bottom > caption_top + 0.05:
            continue
        if (caption_top - s_bottom) > 1.4:  # too far above
            continue
        s_centre = s_left + s_w / 2
        if abs(s_centre - cap_centre) > caption_width / 2 + COLUMN_X_TOLERANCE:
            continue
        cluster.append(shape)
    return cluster


# ---- SVG assembly --------------------------------------------------------

def build_icon_svg(cluster: list) -> Optional[tuple[str, float, float]]:
    """Return (svg_string, width_in, height_in) for a cluster of shapes, or
    None if nothing usable. Coordinates are normalised to a square 64-unit
    viewBox preserving aspect ratio of the cluster's bounding box."""
    if not cluster:
        return None
    # Cluster bounding box in inches (used for viewBox aspect)
    lefts = [emu_to_inches(s.left) for s in cluster]
    tops = [emu_to_inches(s.top) for s in cluster]
    rights = [emu_to_inches(s.left) + emu_to_inches(s.width) for s in cluster]
    bottoms = [emu_to_inches(s.top) + emu_to_inches(s.height) for s in cluster]
    cluster_left = min(lefts)
    cluster_top = min(tops)
    cluster_w = max(rights) - cluster_left
    cluster_h = max(bottoms) - cluster_top
    if cluster_w <= 0 or cluster_h <= 0:
        return None
    aspect = cluster_w / cluster_h
    if aspect >= 1:
        vb_w = VIEWBOX_SIZE
        vb_h = VIEWBOX_SIZE / aspect
    else:
        vb_w = VIEWBOX_SIZE * aspect
        vb_h = VIEWBOX_SIZE
    # Build per-shape <g transform="translate(...) scale(...)"> wrappers so
    # custGeom paths in their local coordinate space land in the right spot
    # within the cluster.
    body_parts: list[str] = []
    for shape in cluster:
        s_left, s_top, s_w, s_h = shape_bbox_inches(shape)
        if s_w <= 0 or s_h <= 0:
            continue
        d_strings, pw, ph, primitives = shape_geometry(shape)
        if not d_strings and not primitives:
            continue
        # Translate so cluster top-left aligns with viewBox origin, then
        # scale shape's own coordinate system to its bbox in the viewBox.
        tx = (s_left - cluster_left) / cluster_w * vb_w
        ty = (s_top - cluster_top) / cluster_h * vb_h
        sw_vb = s_w / cluster_w * vb_w
        sh_vb = s_h / cluster_h * vb_h
        if d_strings and pw and ph:
            sx = sw_vb / pw
            sy = sh_vb / ph
            paths_xml = "".join(f'<path d="{d}"/>' for d in d_strings)
            body_parts.append(
                f'<g transform="translate({tx:.3f},{ty:.3f}) scale({sx:.6f},{sy:.6f})">{paths_xml}</g>'
            )
        if primitives:
            sx = sw_vb / (shape.width or 1)
            sy = sh_vb / (shape.height or 1)
            prims_xml = "".join(primitives)
            body_parts.append(
                f'<g transform="translate({tx:.3f},{ty:.3f}) scale({sx:.6f},{sy:.6f})">{prims_xml}</g>'
            )
    if not body_parts:
        return None
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {vb_w:.3f} {vb_h:.3f}" '
        f'fill="none" stroke="currentColor" stroke-width="0.6" '
        f'stroke-linecap="round" stroke-linejoin="round">'
        + "".join(body_parts)
        + '</svg>'
    )
    return svg, cluster_w, cluster_h


# ---- Main pipeline -------------------------------------------------------

def main() -> int:
    args = parse_args()
    if not args.input.is_file():
        raise SystemExit(f"Input file not found: {args.input}")

    output_root = args.output
    output_root.mkdir(parents=True, exist_ok=True)

    if not args.keep_existing:
        for child in output_root.iterdir():
            if child.is_dir():
                for svg in child.rglob("*.svg"):
                    svg.unlink()
                # remove empty directories
                try:
                    child.rmdir()
                except OSError:
                    pass

    prs = Presentation(args.input)
    slides = list(prs.slides)
    if args.limit_slides:
        slides = slides[: args.limit_slides]

    icons: list[dict] = []
    used_slugs: defaultdict[str, int] = defaultdict(int)
    skipped_no_caption = 0
    skipped_no_geometry = 0
    category_counter: Counter[str] = Counter()

    for idx, slide in enumerate(slides, start=1):
        title = slide_title_text(slide)
        category, variant = detect_category(title)
        if category == "uncategorized":
            # Title slide / divider -- skip
            continue

        icon_shapes = collect_icon_shapes(slide)
        captions = collect_caption_texts(slide)
        if not captions:
            continue

        # Ensure deterministic caption order: top-to-bottom then left-to-right.
        captions.sort(key=lambda c: (round(c[1], 1), c[0]))

        for cap_left, cap_top, cap_w, cap_h, cap_text in captions:
            cluster = cluster_shapes_for_caption(cap_left, cap_top, cap_w, icon_shapes)
            if not cluster:
                skipped_no_caption += 1
                continue
            svg_result = build_icon_svg(cluster)
            if svg_result is None:
                skipped_no_geometry += 1
                continue
            svg_text, _, _ = svg_result

            # Parse keyword string: comma-separated, first token is the canonical name.
            keywords = [k.strip() for k in re.split(r"[,•;]", cap_text) if k.strip()]
            if not keywords:
                continue
            primary = keywords[0]
            slug_root = slugify(primary)
            disambig_key = f"{category}/{variant}/{slug_root}"
            used_slugs[disambig_key] += 1
            slug = slug_root
            if used_slugs[disambig_key] > 1:
                slug = f"{slug_root}-{used_slugs[disambig_key]}"

            # Write SVG
            category_dir = output_root / f"{category}-{variant}"
            category_dir.mkdir(parents=True, exist_ok=True)
            svg_path = category_dir / f"{slug}.svg"
            svg_path.write_text(svg_text, encoding="utf-8")

            icons.append({
                "slug": slug,
                "category": f"{category}-{variant}",
                "displayName": primary[:1].upper() + primary[1:],
                "keywords": keywords,
                "file": f"{category}-{variant}/{slug}.svg",
                "sourceSlide": idx,
            })
            category_counter[f"{category}-{variant}"] += 1

    # Manifest
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest_payload = {
        "version": "v1.1",
        "generatedAt": timestamp,
        "source": args.input.name,
        "iconCount": len(icons),
        "categories": dict(sorted(category_counter.items())),
        "icons": sorted(icons, key=lambda i: (i["category"], i["slug"])),
    }
    manifest_text = json.dumps(manifest_payload, indent=2, ensure_ascii=False)
    digest = hashlib.sha256(manifest_text.encode("utf-8")).hexdigest()[:12]
    manifest_payload["sha256_12"] = digest
    manifest_text = json.dumps(manifest_payload, indent=2, ensure_ascii=False) + "\n"
    (output_root / "manifest.json").write_text(manifest_text, encoding="utf-8")

    # Summary
    print("Strategy& icon library extracted.")
    print(f"  source              : {args.input}")
    print(f"  destination         : {output_root}")
    print(f"  slides scanned      : {len(slides)}")
    print(f"  icons written       : {len(icons)}")
    print(f"  skipped no cluster  : {skipped_no_caption}")
    print(f"  skipped no geometry : {skipped_no_geometry}")
    print(f"  manifest sha256_12  : {digest}")
    print()
    print("Icons per category:")
    for cat, n in sorted(category_counter.items()):
        print(f"  {n:4d}  {cat}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
