# The player's weapons from the Pixel Crawler pack: every weapon item's held picture and inventory
# icon cut from the pack's material sheets, the material following the item's level in the order
# Wood -> Bone -> Rustic -> Castle -> Garden -> Elf -> Poison -> Spore -> Library -> Cursed ->
# Desert gold -> Fire. Two tiers falling on one material take its two different pieces (variant A,
# then B), so the 17 tiers of each line all look different.
#   python tools/weapon_art.py [--preview out.png]
#     -> art/held_paket/<id>.png   held: the weapon upright, half the pack's size (our character is
#                                  half the pack's characters' height), frame 0 and frame 1 mirrored
#     -> art/held_paket/grips.json where the hand holds each (share of the frame, as WEAPON_GRIPS)
#     -> art/items_paket/<id>.png  icon: the weapon at the pack's own size, centred on 48 x 48
# The game prefers these over the baked ones (Art.held / Art.item_icon, weapon_view.gd).
import json, os, sys
from PIL import Image

PACK = "assetpack/ANOKOLISA/"
SHEETS = {
    "wood": "Pixel Crawler - Town/Weapons/Wood/Wood.png",
    "bone": "Pixel Crawler - Town/Weapons/Bone/Bone.png",
    "rustic": "Pixel Crawler - Hideout/Weapons/Rustic.png",
    "castle": "Pixel Crawler - Castle Environment 0.3/Weapons/Weapons.png",
    "garden": "Pixel Crawler - Garden Environment/Weapons/Weapons.png",
    "elf": "Pixel Crawler - Fairy Forest 1.7/Weapon/Elf_Weapon.png",
    "poison": "Pixel Crawler - Sewer/Weapons/Poison Weapons/Poison Weapons.png",
    "spore": "Pixel Crawler - Cave/Weapons/Spore_Roots/Spore_Roots.png",
    "library": "Pixel Crawler - Library/Weapons/Weapons.png",
    "cursed": "Pixel Crawler - Cemetery/Weapons/Cursed Weapons.png",
    "gold": "Pixel Crawler - Desert/Weapons/Desert - gold/Desert-Gold.png",
    "fire": "Pixel Crawler - Forge/Weapons/Fire Weapons/Fire Weapons.png",
}
ORDER = ["wood", "bone", "rustic", "castle", "garden", "elf", "poison", "spore", "library", "cursed", "gold", "fire"]
## The level each material starts at (the item's level picks the last one it has reached).
STARTS = [1, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
## Each material's pieces: shape -> [variant A, variant B] as boxes (x, y, w, h) on its sheet.
PICKS = {
    "wood": {"sword": [(35, 17, 10, 28), (3, 6, 10, 41)], "axe": [(16, 0, 16, 47), (16, 0, 16, 47)], "mace": [(48, 18, 16, 28), (48, 18, 16, 28)],
             "staff": [(99, 21, 11, 40), (99, 21, 11, 40)], "bow": [(52, 48, 10, 32), (52, 48, 10, 32)]},
    "bone": {"sword": [(37, 17, 6, 27), (67, 2, 10, 46)], "axe": [(48, 17, 16, 30), (48, 17, 16, 30)], "mace": [(17, 17, 14, 31), (17, 17, 14, 31)],
             "staff": [(99, 22, 10, 39), (114, 20, 12, 41)], "bow": [(50, 48, 12, 32), (50, 48, 12, 32)]},
    "rustic": {"sword": [(37, 32, 8, 32), (20, 16, 10, 48)], "axe": [(117, 32, 11, 32), (99, 25, 13, 39)], "mace": [(81, 16, 15, 48), (18, 83, 12, 45)],
               "staff": [(164, 32, 7, 32), (147, 16, 10, 48)], "bow": [(116, 133, 12, 27), (116, 133, 12, 27)]},
    "castle": {"sword": [(34, 32, 12, 32), (18, 18, 12, 46)], "axe": [(117, 38, 11, 42), (96, 27, 16, 45)], "mace": [(51, 100, 10, 28), (34, 87, 12, 41)],
               "staff": [(132, 69, 7, 27), (128, 0, 16, 64)], "bow": [(116, 133, 12, 27), (100, 128, 8, 32)]},
    "garden": {"sword": [(35, 32, 10, 32), (19, 16, 10, 48)], "axe": [(98, 27, 14, 37), (84, 17, 12, 47)], "mace": [(1, 129, 14, 31), (32, 90, 16, 36)],
               "staff": [(178, 44, 12, 20), (161, 33, 14, 31)], "bow": [(135, 96, 9, 48), (156, 97, 20, 46)]},
    "elf": {"sword": [(34, 18, 11, 29), (0, 4, 16, 43)], "axe": [(49, 16, 14, 31), (16, 0, 16, 47)], "mace": [(0, 49, 16, 29), (19, 48, 10, 30)],
            "staff": [(82, 4, 12, 27), (97, 1, 13, 46)], "bow": [(53, 48, 11, 32), (53, 48, 11, 32)]},
    "poison": {"sword": [(35, 16, 10, 30), (2, 2, 12, 46)], "axe": [(16, 17, 16, 31), (66, 1, 12, 47)], "mace": [(48, 16, 16, 32), (0, 49, 16, 31)],
               "staff": [(82, 1, 12, 47), (96, 1, 16, 47)], "bow": [(66, 49, 15, 30), (81, 49, 15, 30)]},
    "spore": {"sword": [(35, 32, 11, 32), (18, 16, 12, 48)], "axe": [(115, 33, 13, 31), (97, 26, 15, 38)], "mace": [(52, 36, 10, 28), (80, 16, 16, 48)],
              "staff": [(129, 64, 12, 32), (144, 16, 16, 48)], "bow": [(183, 112, 9, 48), (161, 19, 31, 42)]},
    "library": {"sword": [(18, 16, 12, 32), (1, 0, 14, 48)], "axe": [(101, 26, 11, 22), (81, 16, 14, 32)], "mace": [(34, 88, 12, 24), (18, 80, 12, 32)],
                "staff": [(145, 16, 14, 32), (130, 4, 12, 44)], "bow": [(130, 112, 14, 48), (130, 112, 14, 48)]},
    "cursed": {"sword": [(36, 16, 10, 32), (1, 0, 14, 48)], "axe": [(48, 16, 16, 32), (81, 3, 14, 29)], "mace": [(0, 50, 16, 30), (33, 51, 15, 29)],
               "staff": [(66, 0, 13, 48), (97, 1, 14, 47)], "bow": [(53, 48, 11, 32), (81, 49, 15, 30)]},
    "gold": {"sword": [(36, 16, 8, 29), (3, 1, 13, 47)], "axe": [(49, 11, 14, 40), (16, 0, 16, 40)], "mace": [(0, 51, 16, 27), (32, 51, 16, 29)],
             "staff": [(99, 1, 12, 30), (67, 1, 10, 47)], "bow": [(65, 50, 14, 28), (80, 51, 16, 26)]},
    "fire": {"sword": [(35, 16, 10, 30), (0, 1, 16, 47)], "axe": [(48, 16, 16, 32), (100, 1, 9, 31)], "mace": [(0, 49, 16, 30), (32, 50, 16, 29)],
             "staff": [(67, 0, 10, 48), (82, 1, 12, 47)], "bow": [(66, 49, 15, 30), (66, 49, 15, 30)]},
}
ICON = 48
## The hand holds the weapon this many pack pixels above its end (as the pack's characters do).
GRIP_ABOVE = 6


def material_of(level):
    k = 0
    for i, start in enumerate(STARTS):
        if level >= start:
            k = i
    return ORDER[k]


def assign(weapons):
    """item id -> (material, shape, variant): within a material and shape, the lower levels take A."""
    out, groups = {}, {}
    for w in weapons:
        shape = "sword" if w["shape"] in ("sword", "scythe") else w["shape"]
        groups.setdefault((material_of(w["level"]), shape), []).append(w)
    for (mat, shape), ws in groups.items():
        ws.sort(key=lambda w: (w["level"], w["id"]))
        for i, w in enumerate(ws):
            out[w["id"]] = (mat, shape, 0 if i < (len(ws) + 1) // 2 else 1)
    return out


def piece(mat, shape, variant, cache={}):
    if mat not in cache:
        cache[mat] = Image.open(PACK + SHEETS[mat]).convert("RGBA")
    x, y, w, h = PICKS[mat][shape][variant]
    im = cache[mat].crop((x, y, x + w, y + h))
    return im.crop(im.getbbox()) if im.getbbox() else im


def main():
    weapons = json.load(open(sys.argv[sys.argv.index("--items") + 1], encoding="utf8"))
    plan = assign(weapons)
    os.makedirs("art/held_paket", exist_ok=True)
    os.makedirs("art/items_paket", exist_ok=True)
    grips = {}
    for wid, (mat, shape, variant) in sorted(plan.items()):
        im = piece(mat, shape, variant)
        held = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.NEAREST)
        sheet = Image.new("RGBA", (held.width * 2, held.height))
        sheet.alpha_composite(held, (0, 0))
        sheet.alpha_composite(held.transpose(Image.FLIP_LEFT_RIGHT), (held.width, 0))
        sheet.save(f"art/held_paket/{wid}.png")
        grips[wid] = {"x": 0.5, "y": round(max(0.0, (held.height - GRIP_ABOVE / 2) / held.height), 4)}
        icon = Image.new("RGBA", (ICON, ICON))
        fit = im if im.height <= ICON else im.resize((max(1, im.width * ICON // im.height), ICON), Image.NEAREST)
        icon.alpha_composite(fit, ((ICON - fit.width) // 2, (ICON - fit.height) // 2))
        icon.save(f"art/items_paket/{wid}.png")
    json.dump(grips, open("art/held_paket/grips.json", "w"), indent=1)
    print(len(plan), "weapons")
    if "--preview" in sys.argv:
        from PIL import ImageDraw
        s = 2
        out = Image.new("RGBA", (len(ORDER) * (ICON * s + 6) + 80, 10 * (ICON * s + 4) + 20), (60, 64, 74, 255))
        d = ImageDraw.Draw(out)
        for c, mat in enumerate(ORDER):
            d.text((80 + c * (ICON * s + 6), 2), mat, fill="yellow")
            for r, (shape, variant) in enumerate([(sh, v) for sh in ("sword", "axe", "mace", "staff", "bow") for v in (0, 1)]):
                im = piece(mat, shape, variant)
                icon = Image.new("RGBA", (ICON, ICON))
                fit = im if im.height <= ICON else im.resize((max(1, im.width * ICON // im.height), ICON), Image.NEAREST)
                icon.alpha_composite(fit, ((ICON - fit.width) // 2, (ICON - fit.height) // 2))
                out.alpha_composite(icon.resize((ICON * s, ICON * s), Image.NEAREST), (80 + c * (ICON * s + 6), 16 + r * (ICON * s + 4)))
                if c == 0:
                    d.text((2, 16 + r * (ICON * s + 4) + 40), f"{shape} {'AB'[variant]}", fill="white")
        out.save(sys.argv[sys.argv.index("--preview") + 1])


if __name__ == "__main__":
    main()
