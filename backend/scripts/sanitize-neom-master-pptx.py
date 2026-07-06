#!/usr/bin/env python3
"""Strip NAFB5 section tree and footer/header chrome from bundled NEOM master."""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

EMU_PER_INCH = 914400
ROOT = Path(__file__).resolve().parents[2]
MASTER_PATH = ROOT / "backend/assets/client-templates/neom/default-master.pptx"


def strip_sections(pres_xml: str) -> str:
    xml = pres_xml
    xml = re.sub(r"<p14:sectionLst[\s\S]*?</p14:sectionLst>", "", xml)
    xml = re.sub(
        r'<p:ext uri="\{521415D9-36F7-43E2-AB2F-B90AF26B5E84\}">[\s\S]*?</p:ext>',
        "",
        xml,
    )
    xml = re.sub(r'\s+p14:sectionId="[^"]*"', "", xml)
    return xml


def strip_activation_shapes(xml: str) -> str:
    def repl_sp(match: re.Match[str]) -> str:
        sp = match.group(0)
        if not re.search(r"NEOM\s+AUTHORITY|AUTHORITY\s+ACTIVATION", sp, re.I):
            return sp
        return ""

    return re.sub(r"<p:sp>[\s\S]*?</p:sp>", repl_sp, xml)


def strip_top_pics(xml: str) -> str:
    def repl_pic(match: re.Match[str]) -> str:
        pic = match.group(0)
        off = re.search(r'<a:off x="(\d+)" y="(\d+)"', pic)
        ext = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', pic)
        if not off or not ext:
            return pic
        x = int(off.group(1)) / EMU_PER_INCH
        y = int(off.group(2)) / EMU_PER_INCH
        w = int(ext.group(1)) / EMU_PER_INCH
        h = int(ext.group(2)) / EMU_PER_INCH
        if y < 1.35 and x < 2.0 and h < 1.2 and w < 2.5:
            return ""
        return pic

    return re.sub(r"<p:pic>[\s\S]*?</p:pic>", repl_pic, xml)


def sanitize_part(name: str, data: bytes) -> bytes:
    text = data.decode("utf-8")
    if name == "ppt/presentation.xml":
        text = strip_sections(text)
    if "slideMaster" in name or "slideLayout" in name:
        text = strip_activation_shapes(text)
        text = strip_top_pics(text)
    return text.encode("utf-8")


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else MASTER_PATH
    if not path.is_file():
        print("Master not found:", path, file=sys.stderr)
        return 1
    backup = path.with_suffix(".pptx.bak")
    shutil.copy2(path, backup)
    tmp = path.with_suffix(".pptx.tmp")
    with zipfile.ZipFile(path, "r") as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            payload = zin.read(item.filename)
            if item.filename.endswith(".xml"):
                payload = sanitize_part(item.filename, payload)
            zout.writestr(item, payload)
    tmp.replace(path)
    print("Sanitized NEOM master:", path)
    print("Backup:", backup)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
