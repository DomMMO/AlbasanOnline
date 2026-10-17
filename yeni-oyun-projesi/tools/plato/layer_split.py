# A map's ground and plateaus on separate layers: Zemin only ground, Plato the rock (and its feet).
# The map comes from PLATO_MAP (profil.py). Run once per map.
import re, base64, struct, random, sys, os
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import profil
P = profil.MAP
s = open(P, encoding="utf-8").read()
rng = random.Random(5)
def block(name):
    i = s.index(f'[node name="{name}" type="TileMapLayer"')
    j = s.find("\n[node ", i + 10)
    return i, (j if j >= 0 else len(s))
def cells(name):
    if f'[node name="{name}" type="TileMapLayer"' not in s: return {}, []
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
def put(name, c, order):
    global s
    i, j = block(name)
    m = re.compile(r'tile_map_data = PackedByteArray\("([^"]*)"\)').search(s, i, j)
    s = s[:m.start(1)] + encode(c, order) + s[m.end(1):]
assert "[node name=\"Plato\"" not in s, "already split"
Z, zo = cells("Zemin"); A, _ = cells("Alt"); SU, so = cells("Sus")
# Under the rock: what the Alt layer has there, else the map's commonest ground.
ground = [v for v, _ in Counter(v for v in Z.values() if not profil.is_rock(v)).most_common(3)]
plato = {}
for c, v in list(Z.items()):
    if profil.is_rock(v):
        plato[c] = v
        Z[c] = A.get(c) or rng.choice(ground)
for c, v in list(SU.items()):
    if profil.is_rock(v):
        plato[c] = v; del SU[c]
put("Zemin", Z, zo)
# Sus: what is left of it (the rock moved to Plato).
if SU or so:
    i, j = block("Sus")
    m = re.compile(r'tile_map_data = PackedByteArray\("([^"]*)"\)').search(s, i, j)
    if m:
        if SU: s = s[:m.start(1)] + encode(SU, so) + s[m.end(1):]
        else: s = s[:m.start()] + s[m.end() + 1:]
# Alt goes (Zemin has the ground everywhere now).
if '[node name="Alt" type="TileMapLayer"' in s:
    i, j = block("Alt")
    s = s[:i] + s[j + 1:]
# Plato: right after Zemin, above the ground.
ts = re.search(r'\[node name="Zemin" type="TileMapLayer"[^\]]*\]\n(?:[^\[\n].*\n)*?tile_set = (ExtResource\("[^"]+"\))', s).group(1)
i, j = block("Zemin")
# The rock keeps the tint it had on Zemin (volcano's ash light).
tint = re.compile(r'\nmodulate = Color\([^)]*\)').search(s, i, j)
node = f'\n[node name="Plato" type="TileMapLayer" parent="."]{tint.group(0) if tint else ""}\nz_index = -9\ntile_map_data = PackedByteArray("{encode(plato, [])}")\ntile_set = {ts}\n'
s = s[:j] + node + s[j:]
open(P, "w", encoding="utf-8", newline="\n").write(s)
print(profil.NAME, "ground", len(Z), "plateau", len(plato), "sus left", len(SU), "fill", ground)
