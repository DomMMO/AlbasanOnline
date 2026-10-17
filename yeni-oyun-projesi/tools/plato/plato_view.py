# A picture of the map's tile layers (any map, PLATO_MAP), drawn from the tileset's own sheets.
#   python plato_view.py <out.png> [x0 y0 x1 y1] [scale]
# With plato_solution.json in $PLATO_DIR, its tiles are drawn over the Plato layer (before writing).
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from tmdec import layers
import profil

TS = open("tilesets/zemin.tres", encoding="utf-8").read()
ext = {m.group(2): m.group(1) for m in re.finditer(r'\[ext_resource[^\]]*path="([^"]+)"[^\]]*id="([^"]+)"', TS)}
sub = {m.group(1): ext[m.group(2)] for m in re.finditer(r'\[sub_resource type="TileSetAtlasSource" id="([^"]+)"\]\ntexture = ExtResource\("([^"]+)"\)', TS)}
SRC = {int(m.group(1)): sub[m.group(2)] for m in re.finditer(r'sources/(\d+) = SubResource\("([^"]+)"\)', TS)}
sheets = {}
def tile(src, ax, ay):
    if src not in sheets: sheets[src] = Image.open(SRC[src].replace("res://", "")).convert("RGBA")
    return sheets[src].crop((ax * 16, ay * 16, ax * 16 + 16, ay * 16 + 16))

def tints():
    s = open(profil.MAP, encoding="utf-8").read(); out = {}
    for chunk in s.split("\n[node ")[1:]:
        head = chunk.split("\n", 1)[0]
        if 'type="TileMapLayer"' not in head: continue
        m = re.search(r'\nmodulate = Color\(([^)]*)\)', chunk.split("\n[", 1)[0])
        out[re.search(r'name="([^"]+)"', head).group(1)] = tuple(map(float, m.group(1).split(", "))) if m else None
    return out

def render(out, box=None, scale=1.0, solution=None):
    L = layers(profil.MAP); T = tints()
    W, H = profil.size()
    x0, y0, x1, y1 = box or (0, 0, W - 1, H - 1)
    im = Image.new("RGBA", ((x1 - x0 + 1) * 16, (y1 - y0 + 1) * 16), (0, 0, 0, 255))
    order = ["Alt", "Zemin", "Plato", "SusLav", "Sus"]
    for name in order:
        cells = dict(L.get(name, {}))
        if name == "Plato" and solution:
            for c, t in solution.items():
                if t == "G": cells.pop(c, None)
                else:
                    a, b = map(int, t.split(",")); cells[c] = (profil.SRC, a, b, 0)
        if not cells: continue
        layer = Image.new("RGBA", im.size)
        for (x, y), v in cells.items():
            if x0 <= x <= x1 and y0 <= y <= y1:
                layer.alpha_composite(tile(v[0], v[1], v[2]), ((x - x0) * 16, (y - y0) * 16))
        t = T.get(name)
        if t:
            r, g, b, a = layer.split()
            r = r.point(lambda p: int(p * t[0])); g = g.point(lambda p: int(p * t[1])); b = b.point(lambda p: int(p * t[2]))
            layer = Image.merge("RGBA", (r, g, b, a))
        im.alpha_composite(layer)
    if scale != 1: im = im.resize((int(im.width * scale), int(im.height * scale)), Image.NEAREST if scale > 1 else Image.LANCZOS)
    im.save(out)

if __name__ == "__main__":
    a = sys.argv[1:]
    box = tuple(map(int, a[1:5])) if len(a) >= 5 else None
    scale = float(a[5]) if len(a) >= 6 else 1.0
    d = os.environ.get("PLATO_DIR")
    sol = None
    if d and os.path.exists(d + "/plato_solution.json"):
        sol = {tuple(map(int, k.split(","))): t for k, t in json.load(open(d + "/plato_solution.json")).items()}
    render(a[0], box, scale, sol)
