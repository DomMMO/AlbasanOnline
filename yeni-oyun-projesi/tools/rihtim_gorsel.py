# The dock's deck picture, built from the Town pack's plank deck (Furniture.png): its plank rows
# stretched to the dock's shape (an L: a walkway down from the shore, a platform across its end),
# its outline, the seam lines and the dark front beam kept as the artist drew them.
#   python tools/rihtim_gorsel.py
from PIL import Image

SRC = "assetpack/ANOKOLISA/Pixel Crawler - Town/Environment/Props/Static/Furniture.png"
OUT = "assets/rihtim/rihtim.png"
WALK_W, WALK_H = 3, 12      # walkway, tiles (from the land end down)
PLAT_W, PLAT_H = 11, 4      # platform, tiles (the walkway at its left end)
T = 16

im = Image.open(SRC).convert("RGBA")
px = im.load()
X0, X1 = 10, 69             # the deck body's columns on the sheet
row = lambda y: [px[x, y] for x in range(X0, X1)]
# Plank bands (rows down to and including their seam), the top line, the front beam.
BANDS = [list(range(561, 566)), list(range(566, 571)), list(range(571, 577)), list(range(577, 582)),
         list(range(582, 587)), list(range(587, 593)), list(range(593, 598)), list(range(598, 603))]
TOP = 560
FRONT = list(range(603, 608))
CLEAR = (0, 0, 0, 0)


def stretch(cells, width):
    """A source row (outline, edge, planks, edge, outline) stretched to `width` pixels."""
    # Edges: up to the first plank pixel past the outline (rows are ragged by a pixel or two).
    left, right = cells[:12], cells[-12:]
    mid = cells[12:-12]
    out = list(left)
    k = 0
    while len(out) < width - len(right):
        out.append(mid[k % len(mid)])
        k += 1
    return out + list(right)


def place(img, y, x, cells):
    p = img.load()
    for i, c in enumerate(cells):
        if c[3] > 0:
            p[x + i, y] = c


def bands_into(img, x, y0, y1, width):
    """Plank bands filling rows y0..y1-1 at x, each band's height fitted so the last ends at y1."""
    y = y0
    k = 0
    while y < y1:
        band = BANDS[k % len(BANDS)]
        k += 1
        left = y1 - y
        rows = list(band)
        if left < len(rows):
            rows = rows[: max(0, left - 1)] + [rows[-1]] if left > 1 else [rows[-1]]
        elif left - len(rows) in (1, 2, 3):
            # Stretch this band rather than leave a sliver for the next.
            rows = rows[:-1] + [rows[1]] * (left - len(rows)) + [rows[-1]]
        for r in rows:
            place(img, y, x, stretch(row(r), width))
            y += 1


W, H = PLAT_W * T, (WALK_H + PLAT_H) * T
img = Image.new("RGBA", (W, H), CLEAR)
ww = WALK_W * T
split = WALK_H * T
# Walkway: its top line, then planks down to the platform.
place(img, 0, 0, stretch(row(TOP), ww))
bands_into(img, 0, 1, split, ww)
# Platform: its top line (seam colour where the walkway runs into it), planks, the front beam.
top = stretch(row(TOP), W)
seam = row(BANDS[0][-1])
for i in range(W):
    top[i] = seam[min(i, len(seam) - 1)] if 0 < i < ww - 1 else (0, 0, 0, 255)
place(img, split, 0, top)
bands_into(img, 0, split + 1, H - len(FRONT), W)
for i, r in enumerate(FRONT):
    place(img, H - len(FRONT) + i, 0, stretch(row(r), W))
img.save(OUT)
print(OUT, img.size)
