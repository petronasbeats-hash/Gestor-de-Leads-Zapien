#!/usr/bin/env python3
"""Generate Synapse PWA PNG icons from the committed SVG sources.

Requirements: pip install cairosvg
Run at repository root: python3 scripts/build-pwa-icons.py
Generated files: icons/synapse-192.png, icons/synapse-512.png
"""
from pathlib import Path
import struct
import cairosvg

root = Path(__file__).resolve().parent.parent
for size in (192, 512):
    source = root / "icons" / f"synapse-{size}.svg"
    output = root / "icons" / f"synapse-{size}.png"
    cairosvg.svg2png(url=str(source), write_to=str(output), output_width=size, output_height=size)
    with output.open("rb") as png:
        header = png.read(24)
    assert header[:8] == b"\\x89PNG\\r\\n\\x1a\\n", "Invalid PNG signature"
    width, height = struct.unpack(">II", header[16:24])
    assert (width, height) == (size, size), f"Unexpected icon dimensions: {width}x{height}"
    print(f"Validated {output.relative_to(root)} ({width}x{height})")
