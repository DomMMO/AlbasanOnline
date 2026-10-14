"""
Builds the decor art (props, ruins, trees...) from the CraftPix tileset and object packs.

    python tools/build_decor.py "C:/Users/<you>/Downloads"

Needs Pillow. The packs are looked for in that folder and in its "yeniasssets" subfolder;
art whose pack is missing is skipped (the game then draws the code-drawn fallback that
shared/src/data/decorArt.ts gives each key, or nothing for loose scatter like bones).

The pixel-art packs are made for 16 px tiles like the game, so they are cut out at their
own size. The desert and tropical packs are painted (vector) art: scaled down to a height
in game pixels with hard alpha edges, as the mob sheets are.

Output: client/src/assets/licensed/decor/<key>.png (git-ignored, never committed).
CraftPix licence (https://craftpix.net/file-licenses/): free to use in games, also
commercially; the source files must not be redistributed or resold as they are.
"""

import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "client", "src", "assets", "licensed", "decor")

UNDEAD = "craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately"
DUNGEON = "craftpix-net-218281-free-pixel-art-dungeon-objects-asset-pack/PNG/full.png"
LAB = "craftpix-net-665895-free-pixel-dungeon-props-and-objects-asset-pack/PNG/Objects.png"
DESERT = "craftpix-891121-free-2d-rpg-desert-tileset/PNG"
TROPICAL = "craftpix-988114-free-tropical-medieval-city-2d-tileset/PNG"

# key -> (file, crop box or None, target height in px or None for 1:1)
ART: dict[str, tuple[str, tuple[int, int, int, int] | None, int | None]] = {}


def undead(key: str, name: str):
    ART[key] = (f"{UNDEAD}/{name}.png", None, None)


for key, name in [
    ("u_lich", "Lich_shadow1"),
    ("u_skull_door", "Scull_door_shadow1"),
    ("u_skull_pile", "Pile_sculls_shadow1"),
    *[(f"u_ruin_{i}", f"Ruin_shadow1_{i}") for i in range(1, 6)],
    *[(f"u_dead_tree_{i}", f"Dead_tree_shadow1_{i}") for i in range(1, 4)],
    *[(f"u_tree_{i}", f"Tree_shadow1_{i}") for i in range(1, 4)],
    ("u_stump_1", "Broken_tree_shadow1_3"),
    ("u_stump_2", "Broken_tree_shadow1_4"),
    ("u_log", "Broken_tree_shadow1_1"),
    *[(f"u_rock_{i}", f"Rock_shadow1_{i}") for i in range(1, 6)],
    *[(f"u_grave_{i}", f"Grave_shadow1_{n}") for i, n in enumerate([1, 3, 4, 5, 9, 11], 1)],
    *[(f"u_bones_{i}", f"Bones_shadow1_{n}") for i, n in enumerate([1, 2, 3, 4, 5, 8, 11, 13, 14, 15, 16, 17], 1)],
    ("u_bones_big", "Bones_shadow1_6"),
    ("u_ribs_1", "Bones_shadow1_9"),
    ("u_ribs_2", "Bones_shadow1_10"),
    ("u_skull_beast", "Bones_shadow1_12"),
    *[(f"u_arm_{i}", f"Dead_arm_shadow1_{i}") for i in range(1, 5)],
    *[(f"u_thorn_{i}", f"Thorn_plant_shadow1_{i}") for i in range(1, 6)],
    *[(f"u_bush_{i}", f"Plant_shadow1_{i}") for i in range(1, 4)],
    *[(f"u_fern_{i}", f"Crystal_shadow1_{i}") for i in range(1, 4)],
]:
    undead(key, name)

for key, box in {
    "d_barrel_1": (2, 247, 31, 288),
    "d_barrel_2": (34, 247, 63, 288),
    "d_armor_1": (70, 251, 91, 278),
    "d_armor_2": (102, 251, 121, 278),
    "d_armor_3": (133, 252, 154, 278),
    "d_banner_red": (164, 256, 187, 286),
    "d_banner_blue": (196, 256, 219, 286),
    "d_dragon_skull_1": (870, 293, 912, 336),
    "d_dragon_skull_2": (983, 293, 1017, 336),
    "d_skull_1": (951, 297, 970, 325),
    "d_skull_2": (916, 300, 940, 325),
    "d_rack_1": (64, 296, 96, 329),
    "d_rack_2": (98, 296, 128, 331),
    "d_rack_3": (130, 296, 155, 329),
    "d_rack_4": (160, 296, 192, 333),
    "d_supplies_1": (497, 290, 524, 327),
    "d_supplies_2": (532, 295, 560, 331),
    "d_supplies_3": (596, 298, 624, 334),
    "d_supplies_4": (563, 300, 591, 334),
    "d_supplies_5": (423, 340, 456, 380),
    "d_shelf_1": (98, 346, 143, 391),
    "d_shelf_2": (354, 346, 383, 391),
    "d_shelf_3": (50, 347, 95, 391),
    "d_shelf_4": (386, 347, 415, 391),
    "d_shelf_5": (146, 348, 175, 391),
    "d_shelf_6": (258, 348, 303, 391),
}.items():
    ART[key] = (DUNGEON, box, None)

for key, box in {
    "o_roots_1": (81, 1, 151, 80),
    "o_roots_2": (173, 6, 216, 70),
    "o_roots_3": (19, 87, 55, 138),
    "o_roots_4": (130, 106, 163, 136),
    "o_cocoon_1": (7, 9, 73, 77),
    "o_cocoon_2": (73, 87, 122, 135),
    "o_jar_1": (231, 9, 266, 59),
    "o_jar_2": (231, 89, 266, 139),
    "o_jar_3": (305, 23, 336, 59),
    "o_jar_4": (276, 32, 301, 59),
    "o_jar_5": (342, 32, 363, 59),
    "o_alchemy_1": (104, 253, 125, 296),
    "o_alchemy_2": (67, 254, 93, 296),
    "o_alchemy_3": (179, 254, 205, 296),
    "o_alchemy_4": (21, 256, 58, 296),
    "o_alchemy_5": (133, 256, 170, 296),
    "o_desk_1": (321, 271, 368, 302),
    "o_desk_2": (225, 311, 272, 344),
    "o_desk_3": (64, 312, 96, 344),
    "o_desk_4": (113, 314, 160, 344),
}.items():
    ART[key] = (LAB, box, None)

for key, name, height in [
    ("s_cactus_1", "greenery_1", 44),
    ("s_cactus_2", "greenery_3", 28),
    ("s_cactus_3", "greenery_5", 20),
    ("s_cactus_4", "greenery_4", 18),
    ("s_shrub_1", "greenery_9", 20),
    ("s_shrub_2", "greenery_7", 12),
    ("s_tent", "decor_2", 38),
    ("s_wagon", "decor_8", 26),
    ("s_skull", "decor_6", 11),
    ("s_crates", "decor_3", 16),
    ("s_tower", "building_3", 70),
    ("s_house", "building_5", 64),
    ("s_mesa_1", "stones_10", 72),
    ("s_mesa_2", "stones_12", 64),
    ("s_rocks_1", "stones_4", 22),
    ("s_rocks_2", "stones_6", 22),
    ("s_rock_1", "stones_5", 16),
    ("s_palm_1", "tree_1", 54),
    ("s_palm_2", "tree_2", 58),
    ("s_palm_3", "tree_3", 50),
    ("s_palm_4", "tree_6", 52),
    ("s_palm_5", "tree_9", 56),
    ("s_acacia", "tree_10", 40),
    ("s_baobab", "tree_8", 62),
    ("s_dragon_tree", "tree_7", 50),
    ("s_dead_tree_1", "tree_11", 50),
    ("s_dead_tree_2", "tree_12", 48),
]:
    ART[key] = (f"{DESERT}/{name}.png", None, height)

for key, path, height in [
    ("t_palm_1", "decor/tree_1", 72),
    ("t_palm_2", "decor/tree_2", 64),
    ("t_statue", "decor/decor_7", 40),
    ("t_fern_1", "decor/greenery_2", 16),
    ("t_fern_2", "decor/greenery_3", 16),
    ("t_stones_1", "decor/stones_3", 14),
    ("t_stones_2", "decor/stones_4", 12),
]:
    ART[key] = (f"{TROPICAL}/{path}.png", None, height)


def crisp(img: Image.Image, cut: int = 96) -> Image.Image:
    r, g, b, a = img.split()
    return Image.merge("RGBA", (r, g, b, a.point(lambda v: 255 if v >= cut else 0)))


def find(downloads: str, rel: str) -> str | None:
    for parent in (downloads, os.path.join(downloads, "yeniasssets")):
        path = os.path.join(parent, rel)
        if os.path.exists(path):
            return path
    return None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    downloads = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    made = skipped = 0
    for key, (rel, box, height) in ART.items():
        path = find(downloads, rel)
        if not path:
            skipped += 1
            continue
        img = Image.open(path).convert("RGBA")
        if box:
            img = img.crop(box)
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        if height:
            scale = height / img.height
            img = crisp(img.resize((max(1, round(img.width * scale)), height), Image.LANCZOS))
        img.save(os.path.join(OUT, f"{key}.png"), optimize=True)
        made += 1
    print(f"decor art: {made} made, {skipped} skipped (pack missing)")


if __name__ == "__main__":
    main()
