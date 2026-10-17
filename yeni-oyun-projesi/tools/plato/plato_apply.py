# Writes a solved plateau (plato_solution.json) into the map (PLATO_MAP, profil.py): the rock on the
# Plato layer, the ground under it on Zemin.
import re, base64, struct, random, sys, json, os
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import profil
P = profil.MAP
s = open(P, encoding="utf-8").read()
rng = random.Random(7)
sol = {tuple(map(int, k.split(","))): t for k, t in json.load(open(sys.argv[1] + "/plato_solution.json")).items()}

def get(name):
    i = s.index(f'[node name="{name}" type="TileMapLayer"')
    m = re.compile(r'tile_map_data = PackedByteArray\("([^"]*)"\)').search(s, i)
    raw = base64.b64decode(m.group(1))
    cells = {}; order = []
    for j in range(2, len(raw) - 11, 12):
        x, y, src, ax, ay, alt = struct.unpack_from("<hhHHHH", raw, j)
        cells[(x, y)] = (src, ax, ay, alt); order.append((x, y))
    return m, raw[:2], cells, order
def put(name, cells, order):
    global s
    m, head, _, _ = get(name)
    seen = set(order)
    keys = [k for k in order if k in cells] + [k for k in cells if k not in seen]
    out = bytearray(head)
    for k in keys: out += struct.pack("<hhHHHH", k[0], k[1], *cells[k])
    s = s[:m.start(1)] + base64.b64encode(bytes(out)).decode() + s[m.end(1):]

_, _, Z, zo = get("Zemin"); _, _, PL, po = get("Plato")
if profil.NAME == "world":
    FLOOR = 28; FLOORS = [(FLOOR, 2, 10, 100), (FLOOR, 1, 10, 100), (FLOOR, 3, 10, 100)]
    plain = lambda v: v[0] in (FLOOR, 3)
else:
    # The map's commonest ground; lava and the like stay where they are.
    FLOORS = [v for v, _ in Counter(Z.values()).most_common(3)]
    plain = lambda v: True
for c, t in sol.items():
    if t == "G":
        PL.pop(c, None)
    else:
        x, y = map(int, t.split(","))
        PL[c] = (profil.SRC, x, y, profil.alt_of(t))
    if c not in Z or not plain(Z[c]): Z[c] = rng.choice(FLOORS)
put("Zemin", Z, zo); put("Plato", PL, po)

moves = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
for name, (x, y) in moves.items():
    i = s.index(f'[node name="{name}" ')
    m = re.compile(r'position = Vector2\([-\d.]+, [-\d.]+\)').search(s, i)
    s = s[:m.start()] + f"position = Vector2({x * 16:g}, {y * 16:g})" + s[m.end():]
open(P, "w", encoding="utf-8", newline="\n").write(s)
print("written", sum(t != "G" for t in sol.values()), "plateau cells")
