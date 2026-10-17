# From the map as it is: the user's rock to source 27 (sight), the plateaus to solve, kept cells, forbidden cells.
import sys, json, re, base64, struct, os
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
S = sys.argv[1]
P = "maps/world.tscn"; s = open(P, encoding="utf-8").read()
i = s.index('[node name="Plato" type="TileMapLayer"') if '[node name="Plato"' in s else s.index('[node name="Zemin" type="TileMapLayer"')
m = re.compile(r'tile_map_data = PackedByteArray\("([^"]*)"\)').search(s, i)
raw = bytearray(base64.b64decode(m.group(1)))
for j in range(2, len(raw) - 11, 12):
    x, y, src, ax, ay, alt = struct.unpack_from("<hhHHHH", raw, j)
    if src == 6: struct.pack_into("<hhHHHH", raw, j, x, y, 27, ax, ay, 0 if ay == 9 else 107)   # feet have only alternative 0
s = s[:m.start(1)] + base64.b64encode(bytes(raw)).decode() + s[m.end(1):]
open(P, "w", encoding="utf-8", newline="\n").write(s)
from plato_rules import user_grid
# The wanted shapes: from MASK_MAP when given (the old, uneven ones), else the map itself.
g = user_grid(os.environ.get("MASK_MAP", P), (0, 0, 127, 95))
rock = {c for c, t in g.items() if t != "G"}
seen = set(); comps = []
for c in sorted(rock):
    if c in seen: continue
    st = [c]; seen.add(c); comp = []
    while st:
        x, y = st.pop(); comp.append((x, y))
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + d[0], y + d[1])
            if n in rock and n not in seen: seen.add(n); st.append(n)
    comps.append(comp)
done = [(33, 31, 43, 45), (85, 29, 94, 40)]
inbox = lambda comp, b: all(b[0] <= x <= b[2] and b[1] <= y <= b[3] for x, y in comp)
keep = set()
for comp in comps:
    if any(inbox(comp, b) for b in done):
        for (x, y) in comp:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1): keep.add((x + dx, y + dy))
todo = sorted([c for c in comps if not any(inbox(c, b) for b in done)], key=len)
forbid = set()
for chunk in s.split("\n[node ")[1:]:
    k = re.search(r'\nkind = "([^"]+)"', chunk); p = re.search(r'\nposition = Vector2\(([-\d.]+), ([-\d.]+)\)', chunk)
    if not (k and p): continue
    x, y = int(float(p.group(1)) // 16), int(float(p.group(2)) // 16)
    r = {"portal": 3, "arrival": 2, "npc": 2, "spawn_zone": 1}.get(k.group(1), 1)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1): forbid.add((x + dx, y + dy))
json.dump(todo, open(S + "/plato_comps.json", "w")); json.dump(sorted(keep), open(S + "/plato_keep.json", "w")); json.dump(sorted(forbid), open(S + "/plato_forbid.json", "w"))
print("to solve", [len(c) for c in todo])
