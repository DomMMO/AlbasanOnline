# Writes a solved plateau (plato_solution.json) into the world map.
import re, base64, struct, random, sys, json
P = "maps/world.tscn"
s = open(P, encoding="utf-8").read()
WALL, FLOOR = 27, 28
FLOORS = [(2,10),(1,10),(3,10)]
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
# Zemin stays grass; the rock and its feet go on the Plato layer.
for c, t in sol.items():
    if t == "G":
        PL.pop(c, None)
    else:
        x, y = map(int, t.split(","))
        PL[c] = (WALL, x, y, 0 if y == 9 else 107)    # feet have only alternative 0; 107: the valley's rock
    if Z.get(c, (0,))[0] not in (FLOOR, 3): Z[c] = (FLOOR,) + rng.choice(FLOORS) + (100,)
put("Zemin", Z, zo); put("Plato", PL, po)

moves = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
for name, (x, y) in moves.items():
    i = s.index(f'[node name="{name}" ')
    m = re.compile(r'position = Vector2\([-\d.]+, [-\d.]+\)').search(s, i)
    s = s[:m.start()] + f"position = Vector2({x * 16:g}, {y * 16:g})" + s[m.end():]
open(P, "w", encoding="utf-8", newline="\n").write(s)
print("written", sum(t != "G" for t in sol.values()), "plateau cells")
