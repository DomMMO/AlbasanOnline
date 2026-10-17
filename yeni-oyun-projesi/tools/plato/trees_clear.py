# Trees (and stumps) kept clear of the plateaus: their whole picture (opaque box + a margin) off every
# rock cell, their trunk apart from other trees', off portal and spot areas.
import sys, json, re; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from PIL import Image
from plato_rules import user_grid
S = sys.argv[1]
P = "maps/world.tscn"; s = open(P, encoding="utf-8").read()
g = user_grid(P, (0, 0, 127, 95)); rock = {c for c, t in g.items() if t != "G"}
forbid = {tuple(c) for c in json.load(open(S + "/plato_forbid.json"))}
ext = {m.group(2): m.group(1) for m in re.finditer(r'\[ext_resource type="PackedScene"[^\]]*path="([^"]+)" id="([^"]+)"\]', s)}
TREE = re.compile(r"/(mese|cam|uzun_cam|kutuk)[^/]*\.tscn$")
MARGIN = 4; cache = {}
def shape(path):
    if path in cache: return cache[path]
    t = open(path.replace("res://", ""), encoding="utf-8").read()
    tex = re.search(r'\[ext_resource type="Texture2D"[^\]]*path="([^"]+)"', t).group(1).replace("res://", "")
    pos = re.search(r'\[node name="Gorsel"[^\]]*\]\n(?:.*\n)*?position = Vector2\(([-\d.]+), ([-\d.]+)\)', t)
    rr = re.search(r'region_rect = Rect2\(([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+)\)', t)
    px, py = float(pos.group(1)), float(pos.group(2)); rx, ry, rw, rh = map(float, rr.groups())
    bb = Image.open(tex).convert("RGBA").crop((int(rx), int(ry), int(rx + rw), int(ry + rh))).getbbox() or (0, 0, int(rw), int(rh))
    cache[path] = (px + bb[0], py + bb[1], px + bb[2], py + bb[3]); return cache[path]
def box_at(sh, x, y, flip):
    x0, y0, x1, y1 = sh
    if flip: x0, x1 = -x1, -x0
    return (x + x0 - MARGIN, y + y0 - MARGIN, x + x1 + MARGIN, y + y1 + MARGIN)
def clear(b):
    if b[0] < 0 or b[2] > 128 * 16 or b[3] > 96 * 16: return False
    for cy in range(int(b[1] // 16), int((b[3] - 1) // 16) + 1):
        for cx in range(int(b[0] // 16), int((b[2] - 1) // 16) + 1):
            if (cx, cy) in rock: return False
    return True
trees = []
for chunk in s.split("\n[node ")[1:]:
    head = chunk.split("\n", 1)[0]
    if 'parent="Esyalar"' not in head: continue
    inst = re.search(r'instance=ExtResource\("([^"]+)"\)', head); p = re.search(r'\nposition = Vector2\(([-\d.]+), ([-\d.]+)\)', chunk)
    if not inst or not p or not TREE.search(ext.get(inst.group(1), "")): continue
    trees.append([re.search(r'name="([^"]+)"', head).group(1), float(p.group(1)), float(p.group(2)), ext[inst.group(1)], bool(re.search(r'\nscale = Vector2\(-1', chunk))])
cell = lambda x, y: (int(x // 16), int(y // 16))
stay = [t for t in trees if clear(box_at(shape(t[3]), t[1], t[2], t[4])) and cell(t[1], t[2]) not in forbid]
go = [t for t in trees if t not in stay]
trunks = [(t[1], t[2]) for t in stay]
roomy = lambda x, y: all(abs(x - a) >= 18 or abs(y - b) >= 10 for a, b in trunks)
moves = {}; nowhere = []
import random, math
rng = random.Random(11)
rng.shuffle(go)
# Spread out, not lined up along the rock: each tree goes to the free spot near where it was that is
# farthest from the other trunks (with a little chance in it), not simply the nearest one.
def nearest_trunk(x, y):
    return min((math.hypot(x - a, (y - b) * 1.6) for a, b in trunks), default=999)
for name, x, y, path, flip in go:
    sh = shape(path); best = None
    for r in range(0, 40):                      # rings of tiles round the old place
        if best and r >= 14: break              # far rings only when nothing nearer is free
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r: continue
                nx, ny = x + dx * 16 + rng.uniform(-6, 6), y + dy * 16 + rng.uniform(-4, 4)
                if cell(nx, ny) in rock or cell(nx, ny) in forbid or not roomy(nx, ny): continue
                if not clear(box_at(sh, nx, ny, flip)): continue
                score = min(nearest_trunk(nx, ny), 64) - r * 1.5 + rng.uniform(0, 10)
                if best is None or score > best[0]: best = (score, nx, ny)
    if not best: nowhere.append(name); continue
    moves[name] = (round(best[1], 1), round(best[2], 1)); trunks.append((best[1], best[2]))
for name, (x, y) in moves.items():
    i = s.index(f'[node name="{name}" ')
    m = re.compile(r'position = Vector2\([-\d.]+, [-\d.]+\)').search(s, i)
    s = s[:m.start()] + f"position = Vector2({x:g}, {y:g})" + s[m.end():]
open(P, "w", encoding="utf-8", newline="\n").write(s)
print("moved", len(moves), "| no room:", nowhere)
