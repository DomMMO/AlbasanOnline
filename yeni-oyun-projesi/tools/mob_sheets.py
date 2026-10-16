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
ORC = "Pixel Crawler - Town/Entities/Mobs/Orc Crew/"
HANDS = PACK + "Pixel Crawler - Town/Weapons/Hands/Hands.png"

## Body families: their folder, the hand row of Hands.png (its colours mark the hands).
FAMILIES = {
    "orc": {"dir": ORC + "Orc/", "hand": 4},
    "orc_rogue": {"dir": ORC + "Orc - Rogue/", "hand": 4},
    "orc_warrior": {"dir": ORC + "Orc - Warrior/", "hand": 4},
    "orc_shaman": {"dir": ORC + "Orc - Shaman/", "hand": 4},
}

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
built = {}
for fam, spec in FAMILIES.items():
    anims = {}
    for name, key in (("Idle", "idle"), ("Run", "walk"), ("Hit", "hurt"), ("Death", "dead")):
        im = sheet(spec["dir"], name)
        if im is not None:
            anims[key] = frames_of(im)
    # The artist's held layer (the top layer of Run), split into the two hands' groups.
    layers, run = read_aseprite(ORIG + spec["dir"] + "Run/Run.aseprite")
    top = len(layers) - 1
    cols = hand_colours(spec["hand"])
    held = {"walk": [groups(cels[top], FRAME / 2, cols) for cels in run]}
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
        if os.path.exists(path):
            durs = durations(path)
            fps[key] = round(1000.0 / (sum(durs) / len(durs)), 2)
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
    i = 0
    for a in order:
        meta_anims[a] = []
        for k, f in enumerate(anims[a]):
            body.alpha_composite(f.resize((s, s), Image.NEAREST), (i * s, 0))
            if a in held:
                for side, (img, pv) in zip(("back", "front"), held[a][k]):
                    parts[side].alpha_composite(img.resize((s, s), Image.NEAREST), (i * s, 0))
                    pivots[side][i] = [pv[0] * scale, pv[1] * scale]
            meta_anims[a].append(i)
            i += 1
    body.save(f"{OUT}/{key}.png")
    parts["back"].save(f"{OUT}/{key}_arka.png")
    parts["front"].save(f"{OUT}/{key}_on.png")
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
    with open(f"{OUT}/{key}.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print(key, body.size, {a: len(v) for a, v in meta_anims.items()}, "pivots f0", pivots["back"][0], pivots["front"][0])
