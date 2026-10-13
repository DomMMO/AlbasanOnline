"""
Builds game sprite sheets and item icons from the CraftPix "tiny style" packs.

    python tools/build_sprites.py "C:/Users/<you>/Downloads"

Needs Pillow (pip install pillow). Reads the packs' PNG sequences (520-720 px frames),
crops every animation of a variant to one shared box, scales it to the in-game height
and packs the frames into a grid sheet with a meta JSON (the format of
client/src/gfx/imageSprites.ts: frame size, feet origin, frame list per animation).
Weapons come from each variant's "Vector Parts/Weapon.png": turned to point up-right
like the code-drawn weapon icons, as an inventory icon and a small in-hand sprite.

CraftPix licence (https://craftpix.net/file-licenses/): free to use in games, also
commercially; the source files must not be redistributed or resold as they are.
"""

import glob
import json
import math
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Third-party art: written to the git-ignored licensed/ folder, never committed.
MOB_OUT = os.path.join(ROOT, "client", "src", "assets", "licensed", "mobs")
ITEM_OUT = os.path.join(ROOT, "client", "src", "assets", "licensed", "items")

PACKS = {
    "Golem": "craftpix-891178-free-golem-tiny-style-2d-character-sprites",
    "Satyr": "craftpix-891179-free-satyr-tiny-style-2d-sprites",
    "Minotaur": "craftpix-net-484869-free-minotaur-tiny-style-2d-sprites",
    "Wraith": "craftpix-net-563568-free-wraith-tiny-style-2d-sprites",
}

# Sheet key, pack, variant, character height in game pixels (players are 16).
MOBS = [
    ("wraith_teal", "Wraith", 1, 26),
    ("wraith_hood", "Wraith", 2, 26),
    ("wraith_purple", "Wraith", 3, 26),
    ("wraith_purple_big", "Wraith", 3, 52),
    ("golem_stone_big", "Golem", 1, 56),
    ("golem_moss_big", "Golem", 2, 56),
    ("golem_earth", "Golem", 3, 34),
    ("golem_earth_big", "Golem", 3, 64),
    ("satyr_horned", "Satyr", 1, 28),
    ("satyr_spear", "Satyr", 2, 28),
    ("satyr_chief", "Satyr", 3, 34),
    ("minotaur_brown", "Minotaur", 1, 34),
    ("minotaur_blue_big", "Minotaur", 2, 56),
    ("minotaur_dark_big", "Minotaur", 3, 60),
]

# Game animation name -> (pack folder, take every Nth frame).
ANIMS = {
    "idle": ("Idle", 2),
    "walk": ("Walking", 2),
    "attack": ("Attacking", 1),
    "hurt": ("Hurt", 2),
    "dead": ("Dying", 1),
}

# Item icon key, pack, variant.
WEAPONS = [
    ("stone_blade", "Golem", 1),
    ("golem_axe", "Golem", 2),
    ("log_club", "Golem", 3),
    ("satyr_club", "Satyr", 1),
    ("satyr_spear", "Satyr", 2),
    ("satyr_axe", "Satyr", 3),
    ("minotaur_club", "Minotaur", 1),
    ("minotaur_mace", "Minotaur", 2),
    ("minotaur_hammer", "Minotaur", 3),
]
ICON_SIZE = 36
HELD_SIZE = 14
MAX_SHEET_WIDTH = 2048


def crisp(img: Image.Image, cut: int = 96) -> Image.Image:
    """Hard alpha edges so the downscaled art sits with the pixel art."""
    r, g, b, a = img.split()
    a = a.point(lambda v: 255 if v >= cut else 0)
    return Image.merge("RGBA", (r, g, b, a))


def frames_of(base: str, folder: str, step: int) -> list[Image.Image]:
    files = sorted(glob.glob(os.path.join(base, "PNG Sequences", folder, "*.png")))
    return [Image.open(f).convert("RGBA") for f in files[::step]]


def union_box(images: list[Image.Image]):
    boxes = [im.getbbox() for im in images if im.getbbox()]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def feet_x(idle: Image.Image) -> float:
    """Horizontal centre of the lowest tenth of the character (its feet)."""
    box = idle.getbbox()
    bottom = box[3]
    band = idle.crop((0, bottom - max(4, (box[3] - box[1]) // 10), idle.width, bottom)).getbbox()
    return (band[0] + band[2]) / 2 if band else (box[0] + box[2]) / 2


def build_mob(downloads: str, key: str, pack: str, variant: int, height: int):
    base = os.path.join(downloads, PACKS[pack], "PNG", f"{pack}_0{variant}")
    anims = {name: frames_of(base, folder, step) for name, (folder, step) in ANIMS.items()}
    every = [im for frames in anims.values() for im in frames]
    idle = anims["idle"][0]
    idle_box = idle.getbbox()
    scale = height / (idle_box[3] - idle_box[1])
    box = union_box(every)
    pad = 1
    fw = math.ceil((box[2] - box[0]) * scale) + pad * 2
    fh = math.ceil((box[3] - box[1]) * scale) + pad * 2
    cols = max(1, min(len(every), MAX_SHEET_WIDTH // fw))
    rows = math.ceil(len(every) / cols)
    sheet = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
    meta_anims: dict[str, list[int]] = {}
    index = 0
    for name, frames in anims.items():
        meta_anims[name] = []
        for im in frames:
            cut = im.crop(box).resize((fw - pad * 2, fh - pad * 2), Image.LANCZOS)
            sheet.paste(crisp(cut), ((index % cols) * fw + pad, (index // cols) * fh + pad))
            meta_anims[name].append(index)
            index += 1
    meta = {
        "frameWidth": fw,
        "frameHeight": fh,
        "originX": round((pad + (feet_x(idle) - box[0]) * scale) / fw, 4),
        "originY": round((pad + (idle_box[3] - box[1]) * scale) / fh, 4),
        "anims": meta_anims,
    }
    sheet.save(os.path.join(MOB_OUT, f"{key}.png"), optimize=True)
    with open(os.path.join(MOB_OUT, f"{key}.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"mob {key}: {fw}x{fh} x{index} frames, sheet {sheet.width}x{sheet.height}")


def build_weapon(downloads: str, key: str, pack: str, variant: int) -> dict:
    src = Image.open(os.path.join(downloads, PACKS[pack], "PNG", f"{pack}_0{variant}", "Vector Parts", "Weapon.png")).convert("RGBA")
    src = src.crop(src.getbbox())
    # The handle is the left end; the grip sits a little way in from it.
    grip_src = (src.width * 0.08, src.height / 2)
    angle = 40
    rotated = src.rotate(angle, resample=Image.BICUBIC, expand=True)
    # Where the grip point went (rotate() turns counter-clockwise about the centre).
    cx, cy = src.width / 2, src.height / 2
    rad = math.radians(angle)
    dx, dy = grip_src[0] - cx, grip_src[1] - cy
    gx = rotated.width / 2 + dx * math.cos(rad) + dy * math.sin(rad)
    gy = rotated.height / 2 - dx * math.sin(rad) + dy * math.cos(rad)
    box = rotated.getbbox()
    rotated = rotated.crop(box)
    gx, gy = gx - box[0], gy - box[1]
    side = max(rotated.width, rotated.height)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox, oy = (side - rotated.width) // 2, (side - rotated.height) // 2
    square.paste(rotated, (ox, oy))
    gx, gy = gx + ox, gy + oy
    for size, suffix in ((ICON_SIZE, ""), (HELD_SIZE, "_held")):
        crisp(square.resize((size, size), Image.LANCZOS), 80).save(os.path.join(ITEM_OUT, f"{key}{suffix}.png"), optimize=True)
    print(f"weapon {key}")
    return {"grip": [round(gx / side, 3), round(gy / side, 3)]}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    downloads = sys.argv[1]
    os.makedirs(MOB_OUT, exist_ok=True)
    os.makedirs(ITEM_OUT, exist_ok=True)
    for key, pack, variant, height in MOBS:
        build_mob(downloads, key, pack, variant, height)
    weapons = {key: build_weapon(downloads, key, pack, variant) for key, pack, variant in WEAPONS}
    with open(os.path.join(ITEM_OUT, "items.json"), "w", encoding="utf-8") as f:
        json.dump(weapons, f, indent=2)


if __name__ == "__main__":
    main()
