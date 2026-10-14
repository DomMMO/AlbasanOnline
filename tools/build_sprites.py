"""
Builds game sprite sheets and item icons from the CraftPix "tiny style" and "chibi" packs.

    python tools/build_sprites.py "C:/Users/<you>/Downloads"

Each pack is looked for in that folder and in its "yeniasssets" subfolder; mobs whose pack
is missing are skipped (the game draws a look-alike for them).

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

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Third-party art: written to the git-ignored licensed/ folder, never committed.
MOB_OUT = os.path.join(ROOT, "client", "src", "assets", "licensed", "mobs")
ITEM_OUT = os.path.join(ROOT, "client", "src", "assets", "licensed", "items")

# Pack folder and its layout: "tiny" = PNG/<Name>_0<n>/PNG Sequences/<anim>/,
# "chibi" = <Sub>/PNG/PNG Sequences/<anim>/ (Sub is the variant folder, e.g. Skeleton_Warrior_2),
# "knight" = _PNG/<n>_KNIGHT/Knight_0<n>__<ANIM>_<frame>.png.
PACKS = {
    "Golem": ("craftpix-891178-free-golem-tiny-style-2d-character-sprites", "tiny"),
    "Satyr": ("craftpix-891179-free-satyr-tiny-style-2d-sprites", "tiny"),
    "Minotaur": ("craftpix-net-484869-free-minotaur-tiny-style-2d-sprites", "tiny"),
    "Wraith": ("craftpix-net-563568-free-wraith-tiny-style-2d-sprites", "tiny"),
    "Goblin": ("craftpix-064112-free-orc-ogre-and-goblin-chibi-2d-game-sprites", "chibi"),
    "Orc": ("craftpix-064112-free-orc-ogre-and-goblin-chibi-2d-game-sprites", "chibi"),
    "Ogre": ("craftpix-064112-free-orc-ogre-and-goblin-chibi-2d-game-sprites", "chibi"),
    "Skeleton_Warrior": ("craftpix-net-140672-free-chibi-skeleton-warrior-character-sprites", "chibi"),
    "Zombie_Villager": ("craftpix-net-905641-free-zombie-villager-chibi-character-sprites", "chibi"),
    "Dark_Oracle": ("craftpix-net-919731-free-chibi-dark-oracle-character-sprites", "chibi"),
    "Knight": ("craftpix-062999-2d-fantasy-knight-free-sprite-sheets", "knight"),
}
# Packs with a single character (no numbered variants).
SINGLE = {"Goblin", "Orc", "Ogre"}

# Sheet key, pack, variant, character height in game pixels (players are 16).
MOBS = [
    ("wraith_teal", "Wraith", 1, 26),
    ("wraith_hood", "Wraith", 2, 26),
    ("wraith_purple", "Wraith", 3, 26),
    ("wraith_purple_big", "Wraith", 3, 52),
    ("golem_stone", "Golem", 1, 34),
    ("golem_stone_big", "Golem", 1, 56),
    ("golem_moss_big", "Golem", 2, 56),
    ("golem_earth", "Golem", 3, 34),
    ("golem_earth_big", "Golem", 3, 64),
    ("satyr_horned", "Satyr", 1, 28),
    ("satyr_spear", "Satyr", 2, 28),
    ("satyr_chief", "Satyr", 3, 34),
    ("satyr_chief_big", "Satyr", 3, 48),
    ("minotaur_brown", "Minotaur", 1, 34),
    ("minotaur_blue", "Minotaur", 2, 34),
    ("minotaur_blue_big", "Minotaur", 2, 56),
    ("minotaur_dark_big", "Minotaur", 3, 60),
    ("goblin", "Goblin", 1, 20),
    ("goblin_big", "Goblin", 1, 36),
    ("orc", "Orc", 1, 26),
    ("orc_big", "Orc", 1, 48),
    ("ogre", "Ogre", 1, 32),
    ("ogre_big", "Ogre", 1, 56),
    ("skeleton_1", "Skeleton_Warrior", 1, 24),
    ("skeleton_2", "Skeleton_Warrior", 2, 24),
    ("skeleton_3", "Skeleton_Warrior", 3, 24),
    ("skeleton_3_big", "Skeleton_Warrior", 3, 48),
    ("zombie_1", "Zombie_Villager", 1, 22),
    ("zombie_2", "Zombie_Villager", 2, 22),
    ("zombie_3", "Zombie_Villager", 3, 22),
    ("oracle_1", "Dark_Oracle", 1, 24),
    ("oracle_2", "Dark_Oracle", 2, 24),
    ("oracle_3", "Dark_Oracle", 3, 24),
    ("oracle_3_big", "Dark_Oracle", 3, 46),
    ("knight_1", "Knight", 1, 24),
    ("knight_2", "Knight", 2, 24),
    ("knight_3", "Knight", 3, 24),
    ("knight_3_big", "Knight", 3, 50),
]

# Game animation name -> (folder or file tag per layout, take every Nth frame).
ANIMS = {
    "tiny": {"idle": ("Idle", 2), "walk": ("Walking", 2), "attack": ("Attacking", 1), "hurt": ("Hurt", 2), "dead": ("Dying", 1)},
    "chibi": {"idle": ("Idle", 2), "walk": ("Walking", 2), "attack": ("Slashing", 1), "hurt": ("Hurt", 2), "dead": ("Dying", 1)},
    "knight": {"idle": ("IDLE", 1), "walk": ("WALK", 1), "attack": ("ATTACK", 1), "hurt": ("HURT", 1), "dead": ("DIE", 1)},
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


OUTLINE = (20, 16, 24, 255)


def without_trails(img: Image.Image) -> Image.Image:
    """Drops the see-through white swoosh the chibi packs draw behind a swing (a white blob once small)."""
    r, g, b, a = img.split()
    light = ImageChops.darker(ImageChops.darker(r, g), b).point(lambda v: 255 if v >= 120 else 0)
    faint = a.point(lambda v: 255 if v < 245 else 0)
    trail = ImageChops.multiply(light, faint)
    return Image.merge("RGBA", (r, g, b, ImageChops.subtract(a, trail)))


def pixelize(img: Image.Image, w: int, h: int) -> Image.Image:
    """
    Big painted frames to small pixel art: area-averaged (no ringing halos), hard alpha, a little
    more contrast and colour to make up for the averaging, and a 1 px dark outline round the
    silhouette, as hand-made pixel sprites have, so the figure still reads small and at night.
    The result is w+2 x h+2 (the outline needs the room).
    """
    small = img.convert("RGBa").resize((w, h), Image.BOX).convert("RGBA")
    r, g, b, a = small.split()
    a = a.point(lambda v: 255 if v >= 110 else 0)
    rgb = ImageEnhance.Color(ImageEnhance.Contrast(Image.merge("RGB", (r, g, b))).enhance(1.2)).enhance(1.15)
    body = rgb.convert("RGBA")
    body.putalpha(a)
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    mask = Image.new("L", out.size, 0)
    mask.paste(a, (1, 1))
    ring = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(3)), mask)
    out.paste(Image.new("RGBA", out.size, OUTLINE), (0, 0), ring)
    out.alpha_composite(body, (1, 1))
    return out


def pack_dir(downloads: str, pack: str) -> str | None:
    folder = PACKS[pack][0]
    for parent in (downloads, os.path.join(downloads, "yeniasssets")):
        if os.path.isdir(os.path.join(parent, folder)):
            return os.path.join(parent, folder)
    return None


def anim_files(downloads: str, pack: str, variant: int, tag: str) -> list[str]:
    """Frame files of one animation, in order."""
    base = pack_dir(downloads, pack)
    layout = PACKS[pack][1]
    if layout == "tiny":
        pattern = os.path.join(base, "PNG", f"{pack}_0{variant}", "PNG Sequences", tag, "*.png")
    elif layout == "chibi":
        sub = pack if pack in SINGLE else f"{pack}_{variant}"
        pattern = os.path.join(base, sub, "PNG", "PNG Sequences", tag, "*.png")
    else:
        pattern = os.path.join(base, "_PNG", f"{variant}_KNIGHT", f"Knight_0{variant}__{tag}_*.png")
    return sorted(glob.glob(pattern))


def frames_of(downloads: str, pack: str, variant: int, tag: str, step: int) -> list[Image.Image]:
    return [Image.open(f).convert("RGBA") for f in anim_files(downloads, pack, variant, tag)[::step]]


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
    if not pack_dir(downloads, pack):
        print(f"mob {key}: pack {pack} not found, skipped")
        return
    anims = {name: [without_trails(im) for im in frames_of(downloads, pack, variant, tag, step)] for name, (tag, step) in ANIMS[PACKS[pack][1]].items()}
    every = [im for frames in anims.values() for im in frames]
    idle = anims["idle"][0]
    idle_box = idle.getbbox()
    scale = height / (idle_box[3] - idle_box[1])
    box = union_box(every)
    # One pixel of room all round for the outline, which pixelize() draws.
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
            cut = pixelize(im.crop(box), fw - pad * 2, fh - pad * 2)
            sheet.paste(cut, ((index % cols) * fw, (index // cols) * fh))
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
    src = Image.open(os.path.join(pack_dir(downloads, pack), "PNG", f"{pack}_0{variant}", "Vector Parts", "Weapon.png")).convert("RGBA")
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
