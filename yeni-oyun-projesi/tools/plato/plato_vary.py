# Long straight plateau edges made uneven: bumps out and notches in, a few cells deep, where the
# tiles can carry them. Writes a target shape and windows to solve it in.
import sys, json, random
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from plato_rules import user_grid
import profil
S = sys.argv[1]
W, Hh = profil.size()
rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 3)
g = user_grid(profil.MAP, (0, 0, W - 1, Hh - 1))
rock = {c for c, t in g.items() if t != "G"}
# The feet stand on the ground: the body is the rest.
body = {c for c in rock if not g[c].endswith(f",{profil.FEET_ROW}")}
keep = {tuple(c) for c in json.load(open(S + "/plato_keep.json"))}
forbid = {tuple(c) for c in json.load(open(S + "/plato_forbid.json"))}
inside = lambda c: 0 <= c[0] < W and 0 <= c[1] < Hh
target = set(body)
def runs(cells_ok, axis):
    """Straight runs of edge cells: axis 0 = along x, 1 = along y."""
    out = []
    pts = sorted(cells_ok, key=lambda c: (c[1], c[0]) if axis == 0 else (c[0], c[1]))
    cur = []
    for c in pts:
        if cur and ((axis == 0 and c[1] == cur[-1][1] and c[0] == cur[-1][0] + 1) or (axis == 1 and c[0] == cur[-1][0] and c[1] == cur[-1][1] + 1)):
            cur.append(c)
        else:
            if len(cur) >= 10: out.append(cur)
            cur = [c]
    if len(cur) >= 10: out.append(cur)
    return out
def free_of(cells):
    return all(inside(c) and c not in keep and c not in forbid for c in cells)
changes = 0
sides = {
    "top": ([c for c in body if (c[0], c[1] - 1) not in body], 0, (0, -1)),
    "foot": ([c for c in body if (c[0], c[1] + 1) not in body and (c[0], c[1] + 2) not in body], 0, (0, 1)),
    "left": ([c for c in body if (c[0] - 1, c[1]) not in body], 1, (-1, 0)),
    "right": ([c for c in body if (c[0] + 1, c[1]) not in body], 1, (1, 0)),
}
for name, (edge, axis, (ox, oy)) in sides.items():
    for run in runs(edge, axis):
        i = 3
        while i + 4 < len(run) - 3:
            if rng.random() < 0.55:
                length = rng.randint(4, 6)
                seg = run[i:i + length]
                depth = 2
                if rng.random() < 0.5:   # bump out
                    add = [(x + ox * d, y + oy * d) for (x, y) in seg for d in range(1, depth + 1)]
                    if name == "foot": add += [(x, y + depth + k) for (x, y) in seg for k in (1, 2)]   # room for the face
                    if free_of(add) and not any(a in rock for a in add): target |= set(add); changes += 1
                else:                    # notch in
                    rem = [(x - ox * d, y - oy * d) for (x, y) in seg for d in range(0, depth)]
                    if free_of(rem): target -= set(rem); changes += 1
                i += length + rng.randint(4, 8)
            else:
                i += rng.randint(3, 6)
print("edits", changes, "rock before", len(body), "target", len(target))
# Windows over every bit of rock (32 x 32), solved in turn.
areas = {}
for c in target | body:
    areas.setdefault((c[0] // 32, c[1] // 32), set())
wins = []
for (bx, by) in sorted(areas):
    area = [(x, y) for y in range(by * 32, min(Hh, by * 32 + 32)) for x in range(bx * 32, min(W, bx * 32 + 32))]
    ring = {(x + dx, y + dy) for (x, y) in area for dy in range(-2, 3) for dx in range(-2, 3) if inside((x + dx, y + dy))}
    wins.append((area, sorted(c for c in ring if c in target)))
json.dump([w[1] for w in wins], open(S + "/plato_comps.json", "w"))
json.dump([w[0] for w in wins], open(S + "/plato_areas.json", "w"))
json.dump(sorted(target), open(S + "/plato_target.json", "w"))
print("windows", len(wins))
