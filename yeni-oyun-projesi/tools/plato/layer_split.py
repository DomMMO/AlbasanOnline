# The world map's ground and plateaus on separate layers: Zemin all grass, Plato the rock (and its feet).
import re, base64, struct, random, sys
P = "maps/world.tscn"
s = open(P, encoding="utf-8").read()
rng = random.Random(5)
FLOORS = [(2, 10), (1, 10), (3, 10)]
def block(name):
    i = s.index(f'[node name="{name}" type="TileMapLayer"')
    j = s.find("\n[node ", i + 10)
    return i, (j if j >= 0 else len(s))
def cells(name):
    i, j = block(name)
    m = re.compile(r'tile_map_data = PackedByteArray\("([^"]*)"\)').search(s, i, j)
    if not m: return {}, []
    raw = base64.b64decode(m.group(1)); out = {}; order = []
    for k in range(2, len(raw) - 11, 12):
        x, y, src, ax, ay, alt = struct.unpack_from("<hhHHHH", raw, k)
        out[(x, y)] = (src, ax, ay, alt); order.append((x, y))
    return out, order
def encode(c, order):
    seen = set(order); keys = [k for k in order if k in c] + [k for k in c if k not in seen]
    b = bytearray(b"\x00\x00")
    for k in keys: b += struct.pack("<hhHHHH", k[0], k[1], *c[k])
    return base64.b64encode(bytes(b)).decode()
Z, zo = cells("Zemin"); A, _ = cells("Alt"); SU, so = cells("Sus")
plato = {}
for c, v in list(Z.items()):
    if v[0] in (6, 27):
        plato[c] = v
        Z[c] = A.get(c) or (28,) + rng.choice(FLOORS) + (100,)
for c, v in list(SU.items()):
    if v[0] in (6, 27):
        plato[c] = v; del SU[c]
# Zemin: grass only.
i, j = block("Zemin")
m = re.compile(r'tile_map_data = PackedByteArray\("([^"]*)"\)').search(s, i, j)
s = s[:m.start(1)] + encode(Z, zo) + s[m.end(1):]
# Sus: what is left of it (the feet moved to Plato).
i, j = block("Sus")
m = re.compile(r'tile_map_data = PackedByteArray\("([^"]*)"\)').search(s, i, j)
if m:
    if SU: s = s[:m.start(1)] + encode(SU, so) + s[m.end(1):]
    else: s = s[:m.start()] + s[m.end() + 1:]
# Alt goes (Zemin is grass everywhere now).
i, j = block("Alt")
s = s[:i] + s[j + 1:]
# Plato: right after Zemin, above the grass.
ts = re.search(r'\[node name="Zemin" type="TileMapLayer"[^\]]*\]\n(?:[^\[\n].*\n)*?tile_set = (ExtResource\("[^"]+"\))', s).group(1)
i, j = block("Zemin")
node = f'\n[node name="Plato" type="TileMapLayer" parent="."]\nz_index = -9\ntile_map_data = PackedByteArray("{encode(plato, [])}")\ntile_set = {ts}\n'
s = s[:j] + node + s[j:]
open(P, "w", encoding="utf-8", newline="\n").write(s)
print("grass", len(Z), "plateau", len(plato), "sus left", len(SU))
