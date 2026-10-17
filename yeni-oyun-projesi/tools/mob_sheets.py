# Mob sheets from the Pixel Crawler pack's enemies. The pack exports its bodies without hands; the
# artist's hands and what they hold are a layer of their own in each Run.aseprite (the top one).
# This puts each kind's Idle / Run / Death into one sheet of equal frames (feet at the bottom
# middle) and the held layer, split into the back hand's group and the front hand's group, into
# two more sheets on the same frames, with each group's pivot (the hand) per frame, so the game
# draws them exactly where the artist did and can swing the weapon round the hand.
#   python tools/mob_sheets.py            -> assets/moblar/<key>.png, <key>_arka.png, <key>_on.png, <key>.json
# Needs the original pack (with its .aseprite files) at ORIG.
from PIL import Image
import json, os, struct, zlib

PACK = "assetpack/ANOKOLISA/"
ORIG = "C:/Users/buson/Desktop/RuneBreaker/assetpack/ANOKOLISA/"
OUT = "assets/moblar"
FRAME = 64
## Idle plays at this share of the artist's speed (calmer when standing).
IDLE_SLOWER = 0.7
ORC = "Pixel Crawler - Town/Entities/Mobs/Orc Crew/"
HANDS = PACK + "Pixel Crawler - Town/Weapons/Hands/Hands.png"
WOOD = PACK + "Pixel Crawler - Town/Weapons/Wood/Wood.png"

## Archers: the Wood sheet's bow in its three states (slack, half drawn, full drawn; 16 x 32
## cells, the bow's back at the cell's right), the arrow carried point up and the arrow pointing
## right that is nocked when the bow is drawn.
BOW_CELLS = [(48, 48), (64, 48), (80, 48)]
BOW_BACK = [13, 15, 15]          # the bow's back (its right edge) in each cell
BOW_STRING = [None, 3, 0]        # where the drawn string is in each cell
ARROW_UP = (20, 0, 7, 16)
ARROW_RIGHT = (32, 4, 16, 7)
## Kinds that shoot: drawn this way (with the family's hands as the artist placed them).
ARCHERS = {"ork_yagmaci", "ork_binici", "elf_avci", "haydut_okcu", "haydut_binici"}

## The elves: the pack's Run.aseprite files have no hands; the artist's hands and weapons are the
## top layer of Social/Elfs.aseprite, the same run (frame for frame, pixel for pixel) of the four
## elves side by side, 64 px apart: Base (sickle), Ranger (bow and arrow), Hunter (shield and
## hammer), Druid (book and staff). Their skin's pinks mark the hands.
FF = "Pixel Crawler - Fairy Forest 1.7/"
ELFS = ORIG + FF + "Social/Elfs.aseprite"
ELF_SKIN = {(220, 135, 186, 255), (163, 102, 139, 255)}

## The elf bow half and fully drawn, from the pack's weapon showcase (Social/Weapon.png, which
## shows them tilted in perspective): read block by block and written here pixel for pixel.
## Each is symmetric top to bottom, like the slack bow; the lower half from the middle down.
## # outline, s string, p/P purple, b/B/d blue, w white, l pale blue.
ELF_BOW_COLOURS = {"#": (20, 20, 18), "s": (223, 205, 191), "p": (133, 76, 205), "P": (71, 33, 120),
                   "b": (70, 164, 255), "B": (65, 113, 198), "d": (30, 58, 108), "w": (215, 248, 255),
                   "l": (161, 184, 225)}
ELF_BOWS = [
    {"half": [
        ".s#.....#bb#",
        ".s#.....#BB#",
        ".ss#....#ww#",
        "..s#....#wl#",
        "..ss#..#pwl#",
        "...s#..#pwl#",
        "...ss##ppp#.",
        "....s#ppp#..",
        "....sspp#...",
        "...#PsP#....",
        "..#bbsB#....",
        ".#bbbBBB#...",
        ".#bbddBB#...",
        ".#b##d#B#...",
        ".##.##.##...",
    ], "grip": (9, 13)},
    {"half": [
        "s#........#bb#",
        "s#........#BB#",
        "ss#......#ll#.",
        ".ss#....#wll#.",
        "..ss#..#pww#..",
        "...ss##ppp#...",
        "....ssppp#....",
        "...#PsP##.....",
        "..#bbsB#......",
        ".#bbbBBB#.....",
        ".#bbddBB#.....",
        ".#b##d#B#.....",
        ".##.##.##.....",
    ], "grip": (11, 11)},
]
## Where the slack bow's grip (the top of its blue middle) is from the bow's top left.
ELF_SLACK_GRIP = (8, 14)
## The ranger's arrow, point up, as the artist drew it in the back hand (the shaft under the
## hand filled in). o/q dark blue and purple, W white.
ELF_ARROW_COLOURS = dict(ELF_BOW_COLOURS, o=(47, 52, 63), q=(40, 19, 65), W=(255, 255, 255))
ELF_ARROW = [
    "...o...",
    "..oW#..",
    "..oW#..",
    ".owWl#.",
    ".owWl#.",
    ".qqP##.",
    "..#p#..",
    "..#p#..",
    "..#p#..",
    "..#p#..",
    "..#p#..",
    "..#p#..",
    "#bbpBB#",
    "#bbpBB#",
    "#b###B#",
    "##...##",
]

## Body families: their folder, the hand row of Hands.png (its colours mark the hands); the elves
## their slot in Elfs.aseprite and their skin.
FAMILIES = {
    "orc": {"dir": ORC + "Orc/", "hand": 4},
    "orc_rogue": {"dir": ORC + "Orc - Rogue/", "hand": 4},
    "orc_warrior": {"dir": ORC + "Orc - Warrior/", "hand": 4},
    "orc_shaman": {"dir": ORC + "Orc - Shaman/", "hand": 4},
    "elf": {"dir": FF + "Enemies/Elf - Base/", "slot": 0},
    "elf_ranger": {"dir": FF + "Enemies/Elf - Ranger/", "slot": 1},
    "elf_hunter": {"dir": FF + "Enemies/Elf - Hunter/", "slot": 2},
    "elf_druid": {"dir": FF + "Enemies/Elf - Druid/", "slot": 3},
}
## Armed families: like the orcs, the top layer of Run.aseprite is the artist's hands and what they
## hold; their hands come from the family's weapon sheet (the pack's), which marks the pivots.
TOWN_MOBS = "Pixel Crawler - Town/Entities/Mobs/"
DESERT_GOLD = PACK + "Pixel Crawler - Desert/Weapons/Desert - gold/Desert-Gold.png"
FIRE = PACK + "Pixel Crawler - Forge/Weapons/Fire Weapons/Fire Weapons.png"
BONE_HANDS = (HANDS, [(0, 2), (1, 2), (0, 3), (1, 3)])
MUMMY_HANDS = (DESERT_GOLD, [(9, 0), (10, 0), (9, 1), (10, 1)])
STONE_HANDS = (FIRE, [(8, 0), (9, 0), (8, 1), (9, 1)])
FAMILIES.update({
    "skeleton": {"dir": TOWN_MOBS + "Skeleton Crew/Skeleton - Base/", "cells": BONE_HANDS},
    "skeleton_warrior": {"dir": TOWN_MOBS + "Skeleton Crew/Skeleton - Warrior/", "cells": BONE_HANDS},
    "skeleton_mage": {"dir": TOWN_MOBS + "Skeleton Crew/Skeleton - Mage/", "cells": BONE_HANDS},
    "mummy": {"dir": "Pixel Crawler - Desert/Enemy/Mummy - Base/", "cells": MUMMY_HANDS},
    "mummy_warrior": {"dir": "Pixel Crawler - Desert/Enemy/Mummy - Warrior/", "cells": MUMMY_HANDS},
    "mummy_mage": {"dir": "Pixel Crawler - Desert/Enemy/Mummy - Mage/", "cells": MUMMY_HANDS},
    "stone": {"dir": "Pixel Crawler - Forge/Enemy/Stone - Base/", "cells": STONE_HANDS},
    "stone_golem": {"dir": "Pixel Crawler - Forge/Enemy/Stone - Golem/", "cells": STONE_HANDS},
    "stone_lava": {"dir": "Pixel Crawler - Forge/Enemy/Stone - Lava/", "cells": STONE_HANDS},
})

## Families drawn with no hands to hold anything (zombies, bandits, the Royal Crew, the garden's
## statues, rats, mushrooms): the same rig built the orcs' way. Their hands are the pair the pack
## gives them in their own weapon sheet, on the hand tracks the artist drew for Skeleton - Base's
## run; the front hand holds a weapon of that sheet (placed as the artist places the skeleton's
## dagger), the back hand may hold a shield (or, for mushrooms, the small rock of their sheet).
## Hand cells: back (c, r), front (c + 1, r + 1).
SYNTH_BACK = [(9, 47), (10, 46), (11, 47), (13, 47), (12, 46), (11, 47)]
SYNTH_FRONT = [(41, 45), (40, 44), (39, 45), (37, 45), (38, 44), (39, 45)]
CEMETERY = "Pixel Crawler - Cemetery/Entities/Mobs/"
HIDEOUT = "Pixel Crawler - Hideout/Enemies/Baldits/"
ROYAL = "Pixel Crawler - Castle Environment 0.3/Enemies/Royal Crew/"
GARDEN = "Pixel Crawler - Garden Environment/Enemies/"
SEWER = "Pixel Crawler - Sewer/Enemy/"
CAVE = "Pixel Crawler - Cave/Enemies/"
SHEETS = {
    "cursed": PACK + "Pixel Crawler - Cemetery/Weapons/Cursed Weapons.png",
    "rustic": PACK + "Pixel Crawler - Hideout/Weapons/Rustic.png",
    "castle": PACK + "Pixel Crawler - Castle Environment 0.3/Weapons/Weapons.png",
    "garden": PACK + "Pixel Crawler - Garden Environment/Weapons/Weapons.png",
    "poison": PACK + "Pixel Crawler - Sewer/Weapons/Poison Weapons/Poison Weapons.png",
    "spore": PACK + "Pixel Crawler - Cave/Weapons/Spore_Roots/Spore_Roots.png",
}
## The weapons used, as boxes on their sheet (x0, y0, x1, y1).
WEAPONS = {
    "cursed": {"buyuk_kilic": (1, 0, 15, 48), "kilic": (36, 16, 46, 48), "balta": (48, 16, 64, 48), "topuz": (0, 50, 16, 80), "asa": (66, 0, 79, 48)},
    "rustic": {"kilic": (20, 16, 30, 64), "kisa_kilic": (37, 32, 45, 64), "hancer": (53, 38, 60, 64), "balta": (99, 25, 112, 64), "kucuk_balta": (117, 32, 128, 64), "asa": (147, 16, 157, 64), "kucuk_asa": (164, 32, 171, 64)},
    "castle": {"kisa_kilic": (34, 32, 46, 64), "topuz": (34, 87, 46, 128), "degnek": (132, 69, 139, 96), "kalkan": (194, 128, 206, 144)},
    "garden": {"kisa_kilic": (35, 32, 45, 64), "balta": (98, 27, 112, 64), "asa": (161, 33, 175, 64)},
    "poison": {"kilic": (2, 2, 14, 48), "kisa_kilic": (35, 16, 45, 46), "balta": (16, 17, 32, 48), "asa": (82, 1, 94, 48)},
    "spore": {"topuz": (35, 32, 46, 64), "buyuk_topuz": (18, 16, 30, 64), "asa": (129, 64, 141, 96), "tas": (36, 5, 43, 12)},
}
SYNTH_HANDS = {"cursed_teal": ("cursed", (4, 5)), "cursed_red": ("cursed", (0, 5)), "cursed_grey": ("cursed", (2, 5)),
               "rustic": ("rustic", (12, 0)), "castle_steel": ("castle", (13, 2)), "castle_skin": ("castle", (13, 0)),
               "castle_leather": ("castle", (13, 4)), "garden": ("garden", (11, 17)), "poison": ("poison", (7, 3)),
               "spore": ("spore", (2, 0))}


def synth(body, hands, weapon, back=None, offset=(0, 0)):
    return {"dir": body, "synth": {"hands": hands, "weapon": weapon, "back": back, "offset": offset}}


FAMILIES.update({
    # Cemetery: the zombies (and the banshee) with cursed weapons.
    "zombi": synth(CEMETERY + "Zombie - Base/", "cursed_teal", ("cursed", "kilic")),
    "zombi_kasli": synth(CEMETERY + "Zombie - Muscle/", "cursed_red", ("cursed", "balta")),
    "zombi_kasli_buyuk": synth(CEMETERY + "Zombie - Muscle/", "cursed_red", ("cursed", "buyuk_kilic")),
    "zombi_sisman": synth(CEMETERY + "Zombie - Overweight/", "cursed_grey", ("cursed", "topuz")),
    "banshee": synth(CEMETERY + "Zombie - Banshee/", "cursed_teal", ("cursed", "asa")),
    # The Hideout's bandits with rustic weapons.
    "haydut_savasci": synth(HIDEOUT + "Fighter/", "rustic", ("rustic", "kisa_kilic")),
    "haydut_iri": synth(HIDEOUT + "Tracker/", "rustic", ("rustic", "kucuk_balta")),
    "haydut_suikastci": synth(HIDEOUT + "Scout/", "rustic", ("rustic", "hancer")),
    "haydut_okcu": synth(HIDEOUT + "Scout/", "rustic", None),
    "haydut_buyucu": synth(HIDEOUT + "Sorcerer/", "rustic", ("rustic", "kucuk_asa")),
    "haydut_reis": synth(HIDEOUT + "Fighter/", "rustic", ("rustic", "kilic")),
    "haydut_bekci": synth(HIDEOUT + "Tracker/", "rustic", ("rustic", "balta")),
    "haydut_buyucu_buyuk": synth(HIDEOUT + "Sorcerer/", "rustic", ("rustic", "asa")),
    # The Castle's Royal Crew.
    "asker": synth(ROYAL + "Soldier/", "castle_steel", ("castle", "topuz")),
    "sovalye": synth(ROYAL + "Knight/", "castle_steel", ("castle", "kisa_kilic"), ("castle", "kalkan")),
    "rahip": synth(ROYAL + "Priest/", "castle_skin", ("castle", "degnek")),
    # The Garden's statues and Medusa.
    "bahce_eri": synth(GARDEN + "Masculine/", "garden", ("garden", "kisa_kilic")),
    "bahce_kadin": synth(GARDEN + "Feminine/", "garden", ("garden", "balta")),
    "bahce_yasli": synth(GARDEN + "Old/", "garden", ("garden", "asa")),
    "medusa": synth(GARDEN + "Medusa/", "garden", ("garden", "asa")),
    # The Sewer's rats.
    "sican": synth(SEWER + "Rat - Base/", "poison", ("poison", "kisa_kilic")),
    "sican_savasci": synth(SEWER + "Rat - Warrior/", "poison", ("poison", "balta")),
    # The Cave's mushrooms, a small rock in the back hand as the pack shows them.
    "mantar_genc": synth(CAVE + "Immature Fungus/", "spore", ("spore", "topuz"), ("spore", "tas")),
    "mantar_iri": synth(CAVE + "Heavy Fungus/", "spore", ("spore", "buyuk_topuz"), ("spore", "tas")),
    "mantar_uzun": synth(CAVE + "Long Fungus/", "spore", ("spore", "topuz"), ("spore", "tas")),
    "mantar_yasli": synth(CAVE + "Old Fungus/", "spore", ("spore", "asa"), ("spore", "tas")),
})
## Families whose kinds can be archers.
BOW_FAMILIES = {"orc_rogue", "elf_ranger", "haydut_okcu"}

## The game's mob looks: family, which hand's group swings in an attack (the weapon's), how far,
## scale (bosses twice the size). Each holds what the artist gave it: the goblin a dagger, the
## rogue a bow (and a knife), the warrior a sword and a shield, the shaman a staff and a book.
KINDS = {
    "ork_goblin": ("orc", "front", 75, 1),
    "ork_yagmaci": ("orc_rogue", "back", 75, 1),
    "ork_savasci": ("orc_warrior", "back", 75, 1),
    "ork_saman": ("orc_shaman", "front", 60, 1),
    "ork_goblin_sef": ("orc_warrior", "back", 75, 2),
    "ork_bekci": ("orc_warrior", "back", 75, 2),
    "ork_saman_buyuk": ("orc_shaman", "front", 60, 2),
    "ork_lord": ("orc_warrior", "back", 75, 2),
    "ork_binici": ("orc_rogue", "back", 75, 2),
    # The elves: the sickle, the bow, the hammer (and shield), the staff (and book).
    "elf_izci": ("elf", "front", 75, 1),
    "elf_avci": ("elf_ranger", "back", 75, 1),
    "elf_koruyucu": ("elf_hunter", "front", 75, 1),
    "elf_druid": ("elf_druid", "front", 60, 1),
    # The other packs' families (mob -> kind in shared/src/data/mobs.ts and the others).
    "iskelet": ("skeleton", "front", 75, 1),
    "iskelet_savasci": ("skeleton_warrior", "back", 75, 1),
    "iskelet_savasci_buyuk": ("skeleton_warrior", "back", 75, 2),
    "iskelet_buyucu": ("skeleton_mage", "front", 60, 1),
    "iskelet_buyucu_buyuk": ("skeleton_mage", "front", 60, 2),
    "mumya": ("mummy", "front", 75, 1),
    "mumya_savasci": ("mummy_warrior", "front", 75, 1),
    "mumya_savasci_buyuk": ("mummy_warrior", "front", 75, 2),
    "mumya_buyucu": ("mummy_mage", "front", 60, 1),
    "mumya_buyucu_buyuk": ("mummy_mage", "front", 60, 2),
    "tas": ("stone", "front", 75, 1),
    "tas_golem": ("stone_golem", "front", 75, 1),
    "tas_golem_buyuk": ("stone_golem", "front", 75, 2),
    "tas_lav": ("stone_lava", "front", 60, 1),
    "tas_lav_buyuk": ("stone_lava", "front", 60, 2),
    "zombi": ("zombi", "front", 75, 1),
    "zombi_kasli": ("zombi_kasli", "front", 75, 1),
    "zombi_kasli_buyuk": ("zombi_kasli_buyuk", "front", 75, 2),
    "zombi_sisman": ("zombi_sisman", "front", 75, 1),
    "banshee": ("banshee", "front", 60, 1),
    "banshee_buyuk": ("banshee", "front", 60, 2),
    "haydut_savasci": ("haydut_savasci", "front", 75, 1),
    "haydut_iri": ("haydut_iri", "front", 75, 1),
    "haydut_suikastci": ("haydut_suikastci", "front", 75, 1),
    "haydut_okcu": ("haydut_okcu", "back", 75, 1),
    "haydut_buyucu": ("haydut_buyucu", "front", 60, 1),
    "haydut_reis": ("haydut_reis", "front", 75, 2),
    "haydut_bekci": ("haydut_bekci", "front", 75, 2),
    "haydut_binici": ("haydut_okcu", "back", 75, 2),
    "haydut_buyucu_buyuk": ("haydut_buyucu_buyuk", "front", 60, 2),
    "asker": ("asker", "front", 75, 1),
    "sovalye": ("sovalye", "front", 75, 1),
    "sovalye_buyuk": ("sovalye", "front", 75, 2),
    "rahip": ("rahip", "front", 60, 1),
    "rahip_buyuk": ("rahip", "front", 60, 2),
    "bahce_eri": ("bahce_eri", "front", 75, 1),
    "bahce_eri_buyuk": ("bahce_eri", "front", 75, 2),
    "bahce_kadin": ("bahce_kadin", "front", 75, 1),
    "bahce_yasli": ("bahce_yasli", "front", 60, 1),
    "medusa": ("medusa", "front", 60, 1),
    "sican": ("sican", "front", 75, 1),
    "sican_savasci": ("sican_savasci", "front", 75, 1),
    "mantar_genc": ("mantar_genc", "front", 75, 1),
    "mantar_iri": ("mantar_iri", "front", 75, 1),
    "mantar_iri_buyuk": ("mantar_iri", "front", 75, 2),
    "mantar_uzun": ("mantar_uzun", "front", 75, 1),
    "mantar_yasli": ("mantar_yasli", "front", 60, 1),
    "mantar_yasli_buyuk": ("mantar_yasli", "front", 60, 2),
}


def durations(path):
    """Each frame's duration (ms) in an .aseprite file."""
    d = open(path, "rb").read()
    off, out = 128, []
    for _ in range(struct.unpack_from("<H", d, 6)[0]):
        fsize, _, _, dur = struct.unpack_from("<IHHH", d, off)
        out.append(dur)
        off += fsize
    return out


def read_aseprite(path):
    """Frames of an .aseprite file as {layer index: RGBA image}, and the layer names."""
    d = open(path, "rb").read()
    _, magic, frames, w, h, depth = struct.unpack_from("<IHHHHH", d, 0)
    assert magic == 0xA5E0 and depth == 32, path
    off = 128
    layers, out = [], []
    for _ in range(frames):
        fsize, _, oldchunks, _ = struct.unpack_from("<IHHH", d, off)
        n = struct.unpack_from("<I", d, off + 12)[0] or oldchunks
        p = off + 16
        cels = {}
        for _ in range(n):
            csize, ctype = struct.unpack_from("<IH", d, p)
            body = p + 6
            if ctype == 0x2004:
                nl = struct.unpack_from("<H", d, body + 16)[0]
                layers.append(d[body + 18:body + 18 + nl].decode("utf8", "replace"))
            elif ctype == 0x2005:
                li, x, y, _, ct = struct.unpack_from("<HhhBH", d, body)
                cb = body + 16
                if ct in (0, 2):
                    cw, ch = struct.unpack_from("<HH", d, cb)
                    raw = d[cb + 4:p + csize]
                    if ct == 2:
                        raw = zlib.decompress(raw)
                    img = Image.new("RGBA", (w, h))
                    cel = Image.frombytes("RGBA", (cw, ch), raw)
                    img.alpha_composite(cel.crop((max(0, -x), max(0, -y), cw, ch)), (max(x, 0), max(y, 0)))
                    cels[li] = img
                elif ct == 1:
                    cels[li] = out[struct.unpack_from("<H", d, cb)[0]].get(li)
            p += csize
        out.append(cels)
        off += fsize
    return layers, out


def sheet(fam_dir, name):
    for p in (f"{PACK}{fam_dir}{name}/{name}-Sheet.png", f"{PACK}{fam_dir}{name}-Sheet.png"):
        if os.path.exists(p):
            return Image.open(p).convert("RGBA")
    return None


def frames_of(im):
    """Frames of a pack sheet in 64 x 64 cells, feet at the bottom middle."""
    h = im.height
    w = h
    if im.width % h:
        px = im.load()
        clear = lambda x: all(px[x, y][3] == 0 for y in range(h))
        for cand in sorted((c for c in range(h - 24, h + 40) if c > 0 and im.width % c == 0), key=lambda c: abs(c - h)):
            if all(clear(k * cand) and clear(k * cand - 1) for k in range(1, im.width // cand)):
                w = cand
                break
    out = []
    for k in range(im.width // w):
        f = im.crop((k * w, 0, k * w + w, h))
        cell = Image.new("RGBA", (max(FRAME, w), max(FRAME, h)), (0, 0, 0, 0))
        cell.alpha_composite(f, ((cell.width - w) // 2, cell.height - h))
        if cell.size != (FRAME, FRAME):
            cx = cell.width // 2
            cell = cell.crop((cx - FRAME // 2, cell.height - FRAME, cx + FRAME // 2, cell.height))
        out.append(cell)
    return out


def hand_colours(row):
    im = Image.open(HANDS).convert("RGBA").crop((0, row * 16, 32, row * 16 + 32))
    # The skin's greens (not the outline, not the highlight a weapon may share).
    return {c for c in im.getdata() if c[3] > 0 and c[1] > c[0] + 20 and c[1] > c[2] + 20}


def groups(layer, body_mid, hand_cols):
    """The held layer split at the body's middle: (back image, back pivot), (front image, front pivot).
    A pivot is the middle of the hand's pixels (the group's lower middle if no hand shows)."""
    out = []
    px = layer.load()
    for side in ("back", "front"):
        img = Image.new("RGBA", layer.size)
        ip = img.load()
        hand = []
        for y in range(layer.height):
            for x in range(layer.width):
                c = px[x, y]
                if c[3] == 0 or (x < body_mid) != (side == "back"):
                    continue
                ip[x, y] = c
                if c in hand_cols:
                    hand.append((x, y))
        bb = img.getbbox()
        if hand:
            pivot = (sum(p[0] for p in hand) / len(hand), sum(p[1] for p in hand) / len(hand))
        elif bb:
            pivot = ((bb[0] + bb[2]) / 2, bb[3] - 4)
        else:
            pivot = (FRAME / 2, FRAME - 10)
        out.append((img, [round(pivot[0], 1), round(pivot[1], 1)]))
    return out


def cell_colours(path, cells):
    """The colours of a sheet's hand cells, without the outline (the darkest)."""
    im = Image.open(path).convert("RGBA")
    out = set()
    for c, r in cells:
        for col in im.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)).getdata():
            if col[3] > 0 and sum(col[:3]) > 120:
                out.add(col)
    return out


_sheet_cache = {}


def sheet_image(name):
    if name not in _sheet_cache:
        _sheet_cache[name] = Image.open(SHEETS[name]).convert("RGBA")
    return _sheet_cache[name]


def synth_parts(spec):
    """A synthetic family's hand images (back, front) and its weapon and back item images."""
    sname, (c, r) = SYNTH_HANDS[spec["hands"]]
    sh = sheet_image(sname)
    cell = lambda cc, rr: sh.crop((cc * 16, rr * 16, cc * 16 + 16, rr * 16 + 16))
    item = lambda w: sheet_image(w[0]).crop(WEAPONS[w[0]][w[1]]) if w else None
    return cell(c, r), cell(c + 1, r + 1), item(spec["weapon"]), item(spec["back"])


def synth_held(spec, k, dy=0):
    """One frame of a synthetic family's held layer: hands on the skeleton's tracks, the weapon in
    the front hand as the artist holds the skeleton's dagger (its middle 7.5 px into the hand cell,
    its end 14 px below the cell's top), the back item likewise in the back hand."""
    back_hand, front_hand, weapon, back_item = synth_parts(spec)
    ox, oy = spec["offset"]
    bx, by = SYNTH_BACK[k][0] + ox, SYNTH_BACK[k][1] + oy + dy
    fx, fy = SYNTH_FRONT[k][0] + ox, SYNTH_FRONT[k][1] + oy + dy
    img = Image.new("RGBA", (FRAME, FRAME))
    if back_item is not None:
        img.alpha_composite(back_item, (round(bx + 7.5 - back_item.width / 2), by + 10 - back_item.height // 2))
    img.alpha_composite(back_hand, (bx, by))
    if weapon is not None:
        img.alpha_composite(weapon, (round(fx + 7.5 - weapon.width / 2), fy + 14 - weapon.height))
    img.alpha_composite(front_hand, (fx, fy))
    return img


def find_hands(layer):
    """The pack's hands in a held layer: [(cell position, Hands.png cell)] matched pixel for pixel."""
    hands_im = Image.open(HANDS).convert("RGBA")
    px = layer.load()
    found = []
    for r in range(6):
        for c in range(2):
            cell = hands_im.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16))
            pix = [((u, v), cell.getpixel((u, v))) for v in range(16) for u in range(16) if cell.getpixel((u, v))[3]]
            for y in range(-8, layer.height - 4):
                for x in range(-8, layer.width - 4):
                    if all(0 <= x + u < layer.width and 0 <= y + v < layer.height and px[x + u, y + v] == col for (u, v), col in pix):
                        found.append(((x, y), (c * 16, r * 16), {(x + u, y + v) for (u, v), _ in pix}))
    return found


def archer_frames(layer, hands_im, wood):
    """One frame of an archer from the artist's held layer: the hands where the artist put them,
    the Wood bow in the front hand in its three states (the drawn ones with an arrow on the string
    and the back hand at the string), the arrow carried point up in the back hand."""
    found = find_hands(layer)
    found.sort(key=lambda h: h[0][0])
    (bx, by), bcell, bpix = found[0]
    (fx, fy), fcell, _ = found[-1]
    # Where the artist put the carried arrow, from the back hand.
    px = layer.load()
    item = [(x, y) for y in range(layer.height) for x in range(int(FRAME / 2)) if px[x, y][3] and (x, y) not in bpix]
    ax = min(p[0] for p in item) - bx if item else 2
    ay = min(p[1] for p in item) - by if item else -10
    hand = lambda cell: hands_im.crop((cell[0], cell[1], cell[0] + 16, cell[1] + 16))
    return archer_at((bx, by), hand(bcell), (fx, fy), hand(fcell), wood, (ax, ay))


def archer_at(back_pos, back_hand, front_pos, front_hand, wood, carried=(2, -10)):
    """An archer's frame with its hands at back_pos / front_pos (16 px cells): the Wood bow in the
    front hand in its three states, the arrow carried point up in the back hand."""
    (bx, by), (fx, fy), (ax, ay) = back_pos, front_pos, carried
    crop = lambda r: wood.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
    bow = lambda k: wood.crop((BOW_CELLS[k][0], BOW_CELLS[k][1], BOW_CELLS[k][0] + 16, BOW_CELLS[k][1] + 32))
    top = fy - 11
    fronts, nocks = [], []
    for k in range(3):
        img = Image.new("RGBA", (FRAME, FRAME))
        x = fx + 10 - BOW_BACK[k]
        img.alpha_composite(bow(k), (x, top))
        if k > 0:
            sx = x + BOW_STRING[k]
            mid = top + 16
            img.alpha_composite(crop(ARROW_RIGHT), (sx - 1, mid - 3))
            img.alpha_composite(front_hand, (fx, fy))
            img.alpha_composite(back_hand, (sx - 8, mid - 8))
            nocks.append([sx + 7, mid])
        else:
            img.alpha_composite(front_hand, (fx, fy))
        fronts.append(img)
    back = Image.new("RGBA", (FRAME, FRAME))
    back.alpha_composite(crop(ARROW_UP), (bx + ax, by + ay))
    back.alpha_composite(back_hand, (bx, by))
    return {"fronts": fronts, "back": back, "front_pivot": [fx + 8, fy + 8], "back_pivot": [bx + 8, by + 8], "nock": nocks[-1]}


def grid_image(rows, colours):
    img = Image.new("RGBA", (max(len(r) for r in rows), len(rows)))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".":
                img.putpixel((x, y), colours[ch] + (255,))
    return img


def elf_arrow_right():
    """The elves' arrow pointing right (the one nocked and the one that flies)."""
    return grid_image(ELF_ARROW, ELF_ARROW_COLOURS).rotate(-90, expand=True)


def elf_free_hand(layer):
    """The elves' open hand: the Base elf's empty back hand, Hands.png's first hand in their skin."""
    cell = Image.open(HANDS).convert("RGBA").crop((0, 0, 16, 16))
    mask = [(u, v, cell.getpixel((u, v))) for v in range(16) for u in range(16) if cell.getpixel((u, v))[3]]
    px = layer.load()
    for y in range(-8, layer.height - 4):
        for x in range(-8, layer.width - 4):
            ok = True
            for u, v, c in mask:
                p = px[x + u, y + v] if 0 <= x + u < layer.width and 0 <= y + v < layer.height else (0, 0, 0, 0)
                if (c[0] < 60 and c[1] < 60 and not (p[3] and p[0] < 60)) or (c[0] >= 60 and p not in ELF_SKIN):
                    ok = False
                    break
            if ok:
                hand = Image.new("RGBA", (16, 16))
                for u, v, _ in mask:
                    hand.putpixel((u, v), px[x + u, y + v])
                return hand
    raise SystemExit("no free elf hand found")


def elf_archer_frames(layer, free_hand):
    """One frame of the elf ranger: slack as the artist drew it (bow in the front hand, the arrow
    in the back hand), and the half and fully drawn bows from ELF_BOWS put round the same grip
    hand, the arrow on the string with the back hand pinching it."""
    (back, bpv), (front, fpv) = groups(layer, FRAME / 2, ELF_SKIN)
    bx, by = front.getbbox()[:2]
    gx0, gy0 = bx + ELF_SLACK_GRIP[0], by + ELF_SLACK_GRIP[1]
    hand = front.crop((gx0 - 3, gy0, gx0 + 4, gy0 + 6))
    arrow = elf_arrow_right()
    string = ELF_BOW_COLOURS["s"] + (255,)
    fronts, nocks = [front], []
    for spec in ELF_BOWS:
        bow = grid_image(list(reversed(spec["half"])) + spec["half"], ELF_BOW_COLOURS)
        ox, oy = gx0 - spec["grip"][0], gy0 - spec["grip"][1]
        sx = ox + min(x for y in range(bow.height) for x in range(bow.width) if bow.getpixel((x, y)) == string)
        mid = oy + bow.height // 2 - 1
        img = Image.new("RGBA", (FRAME, FRAME))
        img.alpha_composite(bow, (ox, oy))
        img.alpha_composite(arrow, (sx - 1, mid - arrow.height // 2))
        img.alpha_composite(hand, (gx0 - 3, gy0))
        img.alpha_composite(free_hand, (sx - 8, mid - 8))
        fronts.append(img)
        nocks.append([sx + 7, mid])
    return {"fronts": fronts, "back": back, "front_pivot": fpv, "back_pivot": bpv, "nock": nocks[-1]}


def top_of(f):
    bb = f.getbbox()
    return bb[1] if bb else 0


def shifted(img, dy):
    out = Image.new("RGBA", img.size)
    if dy >= 0:
        out.alpha_composite(img.crop((0, 0, img.width, img.height - dy)), (0, dy))
    else:
        out.alpha_composite(img.crop((0, -dy, img.width, img.height)), (0, 0))
    return out


os.makedirs(OUT, exist_ok=True)
elf_layers, elf_frames = read_aseprite(ELFS)
elf_held = lambda slot: [cels[len(elf_layers) - 1].crop((slot * FRAME, 0, slot * FRAME + FRAME, FRAME)) for cels in elf_frames]
built = {}
for fam, spec in FAMILIES.items():
    anims = {}
    for name, key in (("Idle", "idle"), ("Run", "walk"), ("Hit", "hurt"), ("Death", "dead")):
        im = sheet(spec["dir"], name)
        if im is not None:
            anims[key] = frames_of(im)
    # The artist's held layer (the top layer of Run; the elves' from Elfs.aseprite), split into
    # the two hands' groups.
    if "slot" in spec:
        held_layers = elf_held(spec["slot"])
        cols = ELF_SKIN
    elif "synth" in spec:
        held_layers = [synth_held(spec["synth"], k % len(SYNTH_FRONT)) for k in range(len(anims["walk"]))]
        back_hand, front_hand, _, _ = synth_parts(spec["synth"])
        cols = {c for im in (back_hand, front_hand) for c in im.getdata() if c[3] > 0 and sum(c[:3]) > 120}
    elif "cells" in spec:
        layers, run = read_aseprite(ORIG + spec["dir"] + "Run/Run.aseprite")
        held_layers = [cels[len(layers) - 1] for cels in run]
        cols = cell_colours(*spec["cells"])
    else:
        layers, run = read_aseprite(ORIG + spec["dir"] + "Run/Run.aseprite")
        held_layers = [cels[len(layers) - 1] for cels in run]
        cols = hand_colours(spec["hand"])
    held = {"walk": [groups(layer, FRAME / 2, cols) for layer in held_layers]}
    if "synth" in spec:
        # The hands are where they were put (their colours may be the weapon's too): pivot on them.
        ox, oy = spec["synth"]["offset"]
        for k, ((bimg, _), (fimg, _)) in enumerate(held["walk"]):
            b, f = SYNTH_BACK[k % 6], SYNTH_FRONT[k % 6]
            held["walk"][k] = [(bimg, [b[0] + ox + 8, b[1] + oy + 8]), (fimg, [f[0] + ox + 8, f[1] + oy + 8])]
    # Idle has no held layer: the run's first frame's, moved with the idle body.
    run_top = top_of(anims["walk"][0])
    held["idle"] = []
    for f in anims["idle"]:
        dy = top_of(f) - run_top
        held["idle"].append([(shifted(img, dy), [pv[0], pv[1] + dy]) for img, pv in held["walk"][0]])
    # Frame rates as the artist set them (every frame's duration).
    fps = {}
    for name, key in (("Idle", "idle"), ("Run", "walk"), ("Hit", "hurt"), ("Death", "dead")):
        path = ORIG + spec["dir"] + f"{name}/{name}.aseprite"
        if not os.path.exists(path):
            path = ORIG + spec["dir"] + f"{name}.aseprite"
        if os.path.exists(path):
            durs = durations(path)
            fps[key] = round(1000.0 / (sum(durs) / len(durs)), 2)
    # Standing still breathes a little slower than the artist's 10 a second.
    if "idle" in fps:
        fps["idle"] = round(fps["idle"] * IDLE_SLOWER, 2)
    # Archers: built from the hands the artist placed, with the Wood bow and arrows.
    if fam in BOW_FAMILIES:
        if "slot" in spec:
            free_hand = elf_free_hand(elf_held(0)[0])
            bows = {"walk": [elf_archer_frames(layer, free_hand) for layer in held_layers]}
        elif "synth" in spec:
            back_hand, front_hand, _, _ = synth_parts(spec["synth"])
            wood = Image.open(WOOD).convert("RGBA")
            ox, oy = spec["synth"]["offset"]
            bows = {"walk": [archer_at((SYNTH_BACK[k % 6][0] + ox, SYNTH_BACK[k % 6][1] + oy), back_hand,
                                       (SYNTH_FRONT[k % 6][0] + ox, SYNTH_FRONT[k % 6][1] + oy), front_hand, wood)
                             for k in range(len(anims["walk"]))]}
        else:
            hands_im = Image.open(HANDS).convert("RGBA")
            wood = Image.open(WOOD).convert("RGBA")
            bows = {"walk": [archer_frames(layer, hands_im, wood) for layer in held_layers]}
        bows["idle"] = []
        for f in anims["idle"]:
            dy = top_of(f) - run_top
            b = bows["walk"][0]
            bows["idle"].append({
                "fronts": [shifted(img, dy) for img in b["fronts"]], "back": shifted(b["back"], dy),
                "front_pivot": [b["front_pivot"][0], b["front_pivot"][1] + dy], "back_pivot": [b["back_pivot"][0], b["back_pivot"][1] + dy],
                "nock": [b["nock"][0], b["nock"][1] + dy],
            })
        spec["bows"] = bows
    built[fam] = (anims, held, fps)

for key, (fam, swing, swing_to, scale) in KINDS.items():
    anims, held, fps = built[fam]
    order = [a for a in ("idle", "walk", "hurt", "dead") if a in anims]
    count = sum(len(anims[a]) for a in order)
    s = FRAME * scale
    body = Image.new("RGBA", (s * count, s))
    parts = {"back": Image.new("RGBA", (s * count, s)), "front": Image.new("RGBA", (s * count, s))}
    pivots = {"back": [None] * count, "front": [None] * count}
    meta_anims = {}
    archer = key in ARCHERS
    bows = FAMILIES[fam].get("bows") if archer else None
    drawn = [Image.new("RGBA", (s * count, s)), Image.new("RGBA", (s * count, s))]
    nocks = [None] * count
    i = 0
    for a in order:
        meta_anims[a] = []
        for k, f in enumerate(anims[a]):
            body.alpha_composite(f.resize((s, s), Image.NEAREST), (i * s, 0))
            if archer and a in bows:
                b = bows[a][k]
                big = lambda im: im.resize((s, s), Image.NEAREST)
                parts["front"].alpha_composite(big(b["fronts"][0]), (i * s, 0))
                drawn[0].alpha_composite(big(b["fronts"][1]), (i * s, 0))
                drawn[1].alpha_composite(big(b["fronts"][2]), (i * s, 0))
                parts["back"].alpha_composite(big(b["back"]), (i * s, 0))
                pivots["front"][i] = [v * scale for v in b["front_pivot"]]
                pivots["back"][i] = [v * scale for v in b["back_pivot"]]
                nocks[i] = [v * scale for v in b["nock"]]
            elif a in held:
                for side, (img, pv) in zip(("back", "front"), held[a][k]):
                    parts[side].alpha_composite(img.resize((s, s), Image.NEAREST), (i * s, 0))
                    pivots[side][i] = [pv[0] * scale, pv[1] * scale]
            meta_anims[a].append(i)
            i += 1
    body.save(f"{OUT}/{key}.png")
    parts["back"].save(f"{OUT}/{key}_arka.png")
    parts["front"].save(f"{OUT}/{key}_on.png")
    if archer:
        drawn[0].save(f"{OUT}/{key}_on_1.png")
        drawn[1].save(f"{OUT}/{key}_on_2.png")
    meta = {
        "frameWidth": s, "frameHeight": s, "originX": 0.5, "originY": 1.0,
        "anims": meta_anims,
        "fps": fps,
        "rig": {
            "back": {"sheet": f"res://{OUT}/{key}_arka.png", "pivots": pivots["back"]},
            "front": {"sheet": f"res://{OUT}/{key}_on.png", "pivots": pivots["front"]},
            "swing": swing, "swing_to": swing_to,
        },
    }
    if archer:
        # The bow half and fully drawn (front sheets on the same frames), where the nocked
        # arrow leaves from.
        meta["rig"]["draw"] = {"front": [f"res://{OUT}/{key}_on_1.png", f"res://{OUT}/{key}_on_2.png"], "nock": nocks}
        if "slot" in FAMILIES[fam]:
            # The elves shoot their own arrow (the others the Wood sheet's).
            elf_arrow_right().save(f"{OUT}/elf_ok.png")
            meta["rig"]["draw"]["arrow"] = f"res://{OUT}/elf_ok.png"
    with open(f"{OUT}/{key}.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print(key, body.size, {a: len(v) for a, v in meta_anims.items()}, "pivots f0", pivots["back"][0], pivots["front"][0])
