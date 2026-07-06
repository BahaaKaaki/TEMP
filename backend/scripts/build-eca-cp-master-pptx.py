#!/usr/bin/env python3
"""Build a clean ECA CP bundled default-master.pptx (13.333 x 7.5 in).

Strips think-cell OLE/tags, fixes [Content_Types].xml and relationship targets,
and keeps slideMaster1 + slideLayout2 (white content) + slideLayout3 (cover).
"""

from __future__ import annotations

import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(
    "/Users/bkaaki001/Downloads/20260614_ECA CP_template 2_for Edwin AI.pptx",
)
OUT_DIR = ROOT / "backend/assets/client-templates/eca"
OUT_PPTX = OUT_DIR / "default-master.pptx"
LOGO_OUT = OUT_DIR / "logo.png"

TARGET_CX = 12192000
TARGET_CY = 6858000

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def scale_attr(value: str, factor: float) -> str:
    return str(round(int(value) * factor))


def scale_xml_text(text: str, sx: float, sy: float) -> str:
    def repl_x(match: re.Match[str]) -> str:
        return f'{match.group(1)}="{scale_attr(match.group(2), sx)}"'

    def repl_y(match: re.Match[str]) -> str:
        return f'{match.group(1)}="{scale_attr(match.group(2), sy)}"'

    for attr in ("x", "cx", "w"):
        text = re.sub(rf'({attr})="(\d+)"', repl_x, text)
    for attr in ("y", "cy", "h"):
        text = re.sub(rf'({attr})="(\d+)"', repl_y, text)
    return text


def strip_thinkcell_shapes(xml: str) -> str:
    xml = re.sub(
        r"<p:pic>[\s\S]*?think-cell[\s\S]*?</p:pic>",
        "",
        xml,
        flags=re.IGNORECASE,
    )
    xml = re.sub(
        r"<p:sp>[\s\S]*?think-cell[\s\S]*?</p:sp>",
        "",
        xml,
        flags=re.IGNORECASE,
    )
    xml = re.sub(
        r"<p:pic>[\s\S]*?<p:cNvPr[^>]*name=\"Object 6\"[\s\S]*?</p:pic>",
        "",
        xml,
    )
    xml = re.sub(
        r"<p:graphicFrame>[\s\S]*?(?:oleObj|think-cell|progId)[\s\S]*?</p:graphicFrame>",
        "",
        xml,
        flags=re.IGNORECASE,
    )
    return xml


def strip_tag_metadata(xml: str) -> str:
    """Remove dangling p:tags / custDataLst refs that break PowerPoint after rel cleanup."""
    xml = re.sub(r"<p:custDataLst>[\s\S]*?</p:custDataLst>", "", xml)
    xml = re.sub(r"<p:tags\b[^>]*/>", "", xml)
    xml = re.sub(
        r"<p:extLst>[\s\S]*?think-cell[\s\S]*?</p:extLst>",
        "",
        xml,
        flags=re.IGNORECASE,
    )
    return xml


def clean_slide_part_xml(text: str) -> str:
    return strip_tag_metadata(strip_thinkcell_shapes(text))


def clean_layout2_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" '
        'Target="../slideMasters/slideMaster1.xml"/>'
        "</Relationships>"
    )


def clean_master_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" '
        'Target="../slideLayouts/slideLayout2.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" '
        'Target="../slideLayouts/slideLayout3.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" '
        'Target="../theme/theme1.xml"/>'
        "</Relationships>"
    )


def clean_layout3_rels() -> str:
    return clean_layout2_rels()


def clean_root_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="ppt/presentation.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
        'Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
        'Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def clean_presentation_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" '
        'Target="slideMasters/slideMaster1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" '
        'Target="presProps.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" '
        'Target="viewProps.xml"/>'
        '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" '
        'Target="theme/theme1.xml"/>'
        '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" '
        'Target="tableStyles.xml"/>'
        "</Relationships>"
    )


def clean_presentation_xml(text: str) -> str:
    text = re.sub(r"<p:notesMasterIdLst>[\s\S]*?</p:notesMasterIdLst>", "", text)
    text = re.sub(r"<p:custDataLst>[\s\S]*?</p:custDataLst>", "", text)
    text = re.sub(
        r"<p:sldMasterIdLst>[\s\S]*?</p:sldMasterIdLst>",
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>',
        text,
        count=1,
    )
    text = re.sub(r"<p:sldIdLst>[\s\S]*?</p:sldIdLst>", "<p:sldIdLst/>", text, count=1)
    text = re.sub(r'\s+p14:sectionId="[^"]*"', "", text)
    text = re.sub(
        r"<p:sldSz[^/]*/>",
        f'<p:sldSz cx="{TARGET_CX}" cy="{TARGET_CY}"/>',
        text,
        count=1,
    )
    text = re.sub(
        r'<p:sldSz cx="\d+" cy="\d+"[^/]*/>',
        f'<p:sldSz cx="{TARGET_CX}" cy="{TARGET_CY}"/>',
        text,
        count=1,
    )
    text = re.sub(
        r'<p:sldSz cx="\d+" cy="\d+"\s*/>',
        f'<p:sldSz cx="{TARGET_CX}" cy="{TARGET_CY}"/>',
        text,
        count=1,
    )
    return text


def prune_master_layout_list(text: str) -> str:
    return re.sub(
        r"<p:sldLayoutIdLst>[\s\S]*?</p:sldLayoutIdLst>",
        "<p:sldLayoutIdLst>"
        '<p:sldLayoutId id="2147483649" r:id="rId1"/>'
        '<p:sldLayoutId id="2147483650" r:id="rId2"/>'
        "</p:sldLayoutIdLst>",
        text,
        count=1,
    )


def build_content_types(files: list[str]) -> str:
    defaults = {
        "rels": "application/vnd.openxmlformats-package.relationships+xml",
        "xml": "application/xml",
        "emf": "image/x-emf",
        "png": "image/png",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
    }
    overrides = {
        "/ppt/presentation.xml": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
        "/ppt/slideMasters/slideMaster1.xml": "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
        "/ppt/slideLayouts/slideLayout2.xml": "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
        "/ppt/slideLayouts/slideLayout3.xml": "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
        "/ppt/presProps.xml": "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml",
        "/ppt/viewProps.xml": "application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml",
        "/ppt/theme/theme1.xml": "application/vnd.openxmlformats-officedocument.theme+xml",
        "/ppt/tableStyles.xml": "application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml",
        "/docProps/core.xml": "application/vnd.openxmlformats-package.core-properties+xml",
        "/docProps/app.xml": "application/vnd.openxmlformats-officedocument.extended-properties+xml",
    }
    used_defaults = set()
    for name in files:
        ext = Path(name).suffix.lstrip(".").lower()
        if ext in defaults:
            used_defaults.add(ext)
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    ]
    for ext in sorted(used_defaults):
        parts.append(
            f'<Default Extension="{ext}" ContentType="{defaults[ext]}"/>'
        )
    for part_name, content_type in sorted(overrides.items()):
        if part_name.lstrip("/") in files:
            parts.append(
                f'<Override PartName="{part_name}" ContentType="{content_type}"/>'
            )
    parts.append("</Types>")
    return "".join(parts)


def validate_package(path: Path) -> None:
    with zipfile.ZipFile(path) as zf:
        bad = zf.testzip()
        if bad:
            raise RuntimeError("Corrupt zip entry: %s" % bad)
        files = set(zf.namelist())
        ct = zf.read("[Content_Types].xml").decode()
        missing = []
        for part in re.findall(r'PartName="([^"]+)"', ct):
            if part.lstrip("/") not in files:
                missing.append(part)
        if missing:
            raise RuntimeError("Content_Types references missing parts: %s" % missing[:5])
        for name in files:
            if not name.endswith(".xml"):
                continue
            xml = zf.read(name).decode("utf-8", errors="replace")
            if "<p:tags" in xml or "<p:custDataLst>" in xml:
                raise RuntimeError("Dangling tag metadata remains in %s" % name)


def main() -> int:
    if not SRC.is_file():
        print("Source template not found:", SRC)
        return 1

    with zipfile.ZipFile(SRC) as src:
        pres = src.read("ppt/presentation.xml").decode()
        native_cx = int(re.search(r'cx="(\d+)"', pres).group(1))
        native_cy = int(re.search(r'cy="(\d+)"', pres).group(1))
        sx = TARGET_CX / native_cx
        sy = TARGET_CY / native_cy

        master = scale_xml_text(
            clean_slide_part_xml(
                prune_master_layout_list(
                    src.read("ppt/slideMasters/slideMaster1.xml").decode(),
                ),
            ),
            sx,
            sy,
        )
        layout2 = scale_xml_text(
            clean_slide_part_xml(src.read("ppt/slideLayouts/slideLayout2.xml").decode()),
            sx,
            sy,
        )
        layout3 = scale_xml_text(
            clean_slide_part_xml(src.read("ppt/slideLayouts/slideLayout3.xml").decode()),
            sx,
            sy,
        )
        presentation = clean_presentation_xml(scale_xml_text(pres, sx, sy))

        files: dict[str, bytes] = {
            "_rels/.rels": clean_root_rels().encode(),
            "docProps/app.xml": src.read("docProps/app.xml"),
            "docProps/core.xml": src.read("docProps/core.xml"),
            "ppt/presentation.xml": presentation.encode(),
            "ppt/_rels/presentation.xml.rels": clean_presentation_rels().encode(),
            "ppt/presProps.xml": src.read("ppt/presProps.xml"),
            "ppt/viewProps.xml": src.read("ppt/viewProps.xml"),
            "ppt/tableStyles.xml": src.read("ppt/tableStyles.xml"),
            "ppt/theme/theme1.xml": src.read("ppt/theme/theme1.xml"),
            "ppt/slideMasters/slideMaster1.xml": master.encode(),
            "ppt/slideMasters/_rels/slideMaster1.xml.rels": clean_master_rels().encode(),
            "ppt/slideLayouts/slideLayout2.xml": layout2.encode(),
            "ppt/slideLayouts/slideLayout3.xml": layout3.encode(),
            "ppt/slideLayouts/_rels/slideLayout2.xml.rels": clean_layout2_rels().encode(),
            "ppt/slideLayouts/_rels/slideLayout3.xml.rels": clean_layout3_rels().encode(),
        }
        files["[Content_Types].xml"] = build_content_types(list(files)).encode()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    backup = OUT_PPTX.with_suffix(".pptx.bak")
    if OUT_PPTX.exists():
        shutil.copy2(OUT_PPTX, backup)

    tmp = OUT_PPTX.with_suffix(".pptx.tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in sorted(files):
            zout.writestr(name, files[name])

    validate_package(tmp)
    tmp.replace(OUT_PPTX)

    with zipfile.ZipFile(SRC) as src:
        LOGO_OUT.write_bytes(src.read("ppt/media/image4.png"))

    print("Built", OUT_PPTX, OUT_PPTX.stat().st_size, "bytes")
    print("Logo", LOGO_OUT)
    validate_package(OUT_PPTX)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
