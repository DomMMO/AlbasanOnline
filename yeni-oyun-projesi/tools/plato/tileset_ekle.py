# The plateau tiles the map (PLATO_MAP / PLATO_PATH) now uses but its tileset source lacks: added with
# that source's own definitions (rock: collision + sight-blocking alternatives, copied from one of its
# rock tiles; feet: the plain tile of one of its feet).
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tmdec import layers
import profil

TS = "tilesets/zemin.tres"
s = open(TS, encoding="utf-8").read()
sub = {int(m.group(1)): m.group(2) for m in re.finditer(r'sources/(\d+) = SubResource\("([^"]+)"\)', s)}[profil.SRC]
i = s.index(f'[sub_resource type="TileSetAtlasSource" id="{sub}"]')
j = s.find("\n[", i + 5)
body = s[i:j]
defs = {}
for line in body.split("\n")[2:]:
    m = re.match(r"(\d+):(\d+)/(.*)", line)
    if m: defs.setdefault((int(m.group(1)), int(m.group(2))), []).append(m.group(3))
feet = lambda c: c[1] == profil.FEET_ROW
rock_t = next(v for c, v in defs.items() if not feet(c) and any(l.startswith("107 ") for l in v))
feet_t = next((v for c, v in defs.items() if feet(c)), ["0 = 0"])
cells = {(v[1], v[2], v[3]) for v in layers(profil.MAP)["Plato"].values() if v[0] == profil.SRC}
used = {(x, y) for x, y, _ in cells}
missing = sorted(used - set(defs))
add = "".join(f"\n{x}:{y}/{l}" for x, y in missing for l in (feet_t if feet((x, y)) else rock_t))
# A tile the source has, used with an alternative it lacks (canyon's sand tile as rock, 107): that
# alternative's lines from a rock tile.
has_alt = lambda lines, alt: any(l.startswith(f"{alt} ") or l.startswith(f"{alt}/") for l in lines)
for x, y, alt in sorted(cells):
    if (x, y) in defs and not has_alt(defs[(x, y)], alt):
        add += "".join(f"\n{x}:{y}/{l}" for l in rock_t if l.startswith(f"{alt} ") or l.startswith(f"{alt}/"))
        missing.append((x, y, alt))
head = s[:j].rstrip("\n")
s = head + add + "\n" + s[j:] if add else s
open(TS, "w", encoding="utf-8", newline="\n").write(s)
print(profil.NAME, "source", profil.SRC, "added", missing)
