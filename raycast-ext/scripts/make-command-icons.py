#!/usr/bin/env python3
"""
Generate per-command Raycast icons by tinting the master gravity-hub icon.

Reads:  assets/_archive/icon.png.bak  (the original 1024x1024 master)
Writes: assets/commands/<name>.png  (512x512 PNG with color tint overlay)

Each variant puts a translucent radial gradient + the command's first letter
over the master, giving a distinct visual identity in the Raycast root search.
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "_archive", "icon.png.bak")
OUT_DIR = os.path.join(ROOT, "assets", "commands")
SIZE = 512

# (filename, label, accent RGBA, description)
COMMANDS = [
    ("smartthings", "S", (255, 100, 60, 110),   "SmartThings - warm orange"),
    ("control",     "C", (90, 200, 255, 110),   "Control - cyan"),
    ("logs",        "L", (180, 180, 200, 110),  "Logs - silver"),
    ("archive",     "A", (160, 90, 240, 110),   "Archive - violet"),
    ("stats",       "T", (80, 220, 160, 110),   "Stats - emerald"),
    ("notes",       "N", (255, 220, 90, 110),   "Notes - amber"),
    ("aura_toggle", "A", (255, 90, 170, 110),   "Aura - hot pink"),
    ("ac",          "AC",(110, 180, 255, 120),  "AC detail - sky blue"),
    ("bulb",        "B", (255, 180, 80, 120),   "Bulb detail - warm gold"),
    ("quick_scene", "Q", (170, 90, 255, 120),   "Quick scene - purple"),
    ("hub_pulse",   "H", (90, 220, 200, 120),   "Hub pulse - teal"),
]


def find_font(size: int):
    """Find a usable system font."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def tinted_variant(base: Image.Image, accent, label: str) -> Image.Image:
    img = base.convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)

    # 1. Vignette tint - radial gradient overlay
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    center = (SIZE // 2, SIZE // 2)
    max_r = int((SIZE // 2) * 1.1)
    steps = 60
    for i in range(steps, 0, -1):
        r = int(max_r * (i / steps))
        a = int(accent[3] * (1 - i / steps) * 0.6)
        if a < 1:
            continue
        draw.ellipse(
            (center[0] - r, center[1] - r, center[0] + r, center[1] + r),
            fill=(accent[0], accent[1], accent[2], a),
        )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=8))
    img = Image.alpha_composite(img, overlay)

    # 2. Label corner badge
    badge = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(badge)
    badge_size = 180
    badge_box = (SIZE - badge_size - 24, SIZE - badge_size - 24,
                 SIZE - 24, SIZE - 24)
    bdraw.ellipse(badge_box, fill=(15, 20, 35, 235),
                  outline=(accent[0], accent[1], accent[2], 255), width=6)

    # 3. Label text
    font = find_font(96 if len(label) == 1 else 64)
    try:
        bbox = bdraw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    except Exception:
        tw, th = font.getsize(label)
    cx, cy = badge_box[0] + (badge_size - tw) / 2, badge_box[1] + (badge_size - th) / 2 - 8
    bdraw.text((cx, cy), label, font=font,
               fill=(accent[0], accent[1], accent[2], 255))

    return Image.alpha_composite(img, badge)


def main():
    if not os.path.exists(SRC):
        print(f"Missing source: {SRC}", file=sys.stderr)
        sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)
    base = Image.open(SRC).convert("RGBA")
    for name, label, accent, desc in COMMANDS:
        out = os.path.join(OUT_DIR, f"{name}.png")
        tinted_variant(base, accent, label).save(out, "PNG", optimize=True)
        print(f"  {desc:<28} -> {os.path.relpath(out, ROOT)}")
    print(f"\nGenerated {len(COMMANDS)} command icons in {os.path.relpath(OUT_DIR, ROOT)}")


if __name__ == "__main__":
    main()
