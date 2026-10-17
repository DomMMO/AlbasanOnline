import sys, json
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from PIL import Image, ImageDraw
from plato_rules import user_grid
S = sys.argv[1]
T = "assetpack/ANOKOLISA/Pixel Crawler - Town/Environment/Tilesets/"
wall = Image.open(T + "Wall_Tiles.png").convert("RGBA")
grass = Image.open(T + "Floors_Tiles.png").convert("RGBA").crop((32, 160, 48, 176))
g = user_grid("maps/world.tscn", (0, 0, 127, 95))
sol = {tuple(map(int, k.split(","))): t for k, t in json.load(open(S + "/plato_solution.json")).items()}
def draw(tokens, path, scale):
    im = Image.new("RGBA", (128 * 16, 96 * 16))
    for y in range(96):
        for x in range(128):
            im.alpha_composite(grass, (x * 16, y * 16))
            t = tokens.get((x, y), "G")
            if t != "G":
                a, b = map(int, t.split(","))
                im.alpha_composite(wall.crop((a * 16, b * 16, a * 16 + 16, b * 16 + 16)), (x * 16, y * 16))
    im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS).save(path)
before = dict(g); after = dict(g); after.update(sol)
draw(before, S + "/v_before.png", 0.5); draw(after, S + "/v_after.png", 0.5)
