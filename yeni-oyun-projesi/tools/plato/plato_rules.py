# Allowed neighbours for the plateau tiles, learnt from Wall_Tiles.png's own plateau block and from
# the plateau the user built by hand on the world map. "G" = grass (nothing of the plateau there).
import sys, json, os
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tmdec import layers
import profil

def sheet_grid():
    empty = {(0,0),(5,0),(0,9),(5,9)}
    g = {}
    for y in range(-1, 11):
        for x in range(-1, 7):
            inside = 0 <= x <= 5 and 0 <= y <= 9 and (x,y) not in empty
            g[(x,y)] = f"{x},{y}" if inside else "G"
    return g

def user_grid(path, box):
    L = layers(path)
    # Rock on its own layer (Plato) when the map has one; else mixed into Zemin / Sus (older maps).
    Z = L.get("Plato") or L["Zemin"]
    SU = {} if "Plato" in L else L.get("Sus", {})
    x0,y0,x1,y1 = box
    g = {}
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            z = Z.get((x,y)); s = SU.get((x,y))
            if profil.is_rock(z): g[(x,y)] = f"{z[1]},{z[2]}"
            elif profil.is_rock(s): g[(x,y)] = f"{s[1]},{s[2]}"
            else: g[(x,y)] = "G"
    return g

def pairs(g):
    h, v = set(), set()
    for (x,y),t in g.items():
        if (x+1,y) in g: h.add((t, g[(x+1,y)]))
        if (x,y+1) in g: v.add((t, g[(x,y+1)]))
    return h, v

def carried_over(out_dir):
    """Another map: the world's rules (canonical, tools/plato/plato_rules.json) through its profile.
    Where the sheet folds two canonical rows into one, a vertical pair between them would stack that
    row on itself: dropped, unless the canonical rules stack it themselves (a straight edge, plain top)."""
    R = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "plato_rules.json")))
    row = lambda t: None if t == "G" else int(t.split(",")[1])
    H = {(profil.to_sheet(a), profil.to_sheet(b)) for a, b in R["H"]}
    V = set()
    for a, b in R["V"]:
        sa, sb = profil.to_sheet(a), profil.to_sheet(b)
        folded = a != "G" and b != "G" and row(a) != row(b) and row(sa) == row(sb)
        if not folded: V.add((sa, sb))
    if profil.P.get("front_apart"):
        # This sheet's front row starts straight with the roots / rock heads, with no top surface on it
        # (the world's front row carries the top's edge): beside a plain top piece it is cut off.
        front = profil.ROWS[5]
        def part(t):
            if t == "G": return None
            a, b = map(int, t.split(","))
            return None if not 1 <= a - profil.COL <= 4 else ("front" if b == front else "top" if b < front else None)
        H = {(a, b) for a, b in H if {part(a), part(b)} != {"front", "top"}}
        # Nor does a step piece (rows 0-1) stand straight on the face: there the world's face side still
        # carries the edge's line, this sheet's does not.
        row = lambda t: None if t == "G" else int(t.split(",")[1])
        V = {(a, b) for a, b in V if not (row(a) is not None and row(b) is not None and row(a) <= profil.ROWS[1] and row(b) >= front)}
    tiles = sorted({t for p in H | V for t in p})
    print(profil.NAME, "tiles", len(tiles), "horizontal", len(H), "vertical", len(V))
    json.dump({"H": sorted(H), "V": sorted(V)}, open(out_dir + "/plato_rules.json", "w"))

if __name__ == "__main__" and profil.NAME != "world":
    carried_over(sys.argv[1])
elif __name__ == "__main__":
    h1, v1 = pairs(sheet_grid())
    # The user's lessons: tools/plato/ornekler.json (kept apart from any map), else world.tscn.
    import os
    LESSONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ornekler.json")
    lessons = json.load(open(LESSONS, encoding="utf-8")) if os.path.exists(LESSONS) else None
    as_grid = lambda d: {tuple(map(int, k.split(","))): t for k, t in d.items()}
    if lessons:
        h2, v2 = pairs(as_grid(lessons["ders1_plato (world.tscn 31-44 x 30-46)"]))
    else:
        h2, v2 = pairs(user_grid("maps/world.tscn", (31, 30, 44, 46)))
    # The sheet is left-right symmetric (columns 0-5, 1-4, 2-3 mirror each other): the user's plateau
    # mirrored teaches the same steps and diagonal faces on the other side.
    def mirror(t):
        if t == "G": return t
        a, b = map(int, t.split(","))
        return f"{5 - a},{b}"
    h2 |= {(mirror(b), mirror(a)) for a, b in h2}
    v2 |= {(mirror(a), mirror(b)) for a, b in v2}
    # Pairs the user approved on sight (a straight left edge ends (0,2) -> (0,4) -> face (0,5)).
    APPROVED_V = {("0,2", "0,4")}
    # Concave corners (the user's rule): where a face meets the side of rock that goes on (the plateau
    # continues that way), the face's last column is the continuing one (1 on its left end, 4 on its
    # right), not the end column (0 / 5); it stands against the other arm's straight edge (5,3 / 0,2),
    # which runs up to the top it belongs to.
    FILL = ["2,2", "3,2", "2,3", "3,3", "2,4", "3,4"]
    APPROVED_H = {("5,3", f"1,{k}") for k in range(5, 10)} | {(f"4,{k}", "0,2") for k in range(5, 10)}
    # A long run repeats its middle columns 2, 3, 2, 3 (the user's top does; faces and feet too).
    APPROVED_H |= {(f"3,{k}", f"2,{k}") for k in range(0, 10)}
    APPROVED_V |= {(t, "5,3") for t in FILL + ["4,3"]} | {(t, "0,2") for t in FILL + ["1,2"]}
    # At that corner the top goes on over the face's continuing column: plain top above it, and the
    # top's own continuing pieces (1,4) / (4,4) meet plain top beside them.
    APPROVED_V |= {(t, "1,5") for t in FILL} | {(t, "4,5") for t in FILL}
    APPROVED_H |= {(t, "1,4") for t in FILL} | {("4,4", t) for t in FILL}
    # ... and the column just inside the other arm's straight edge starts under plain top as well.
    APPROVED_V |= {(t, "4,3") for t in FILL} | {(t, "1,2") for t in FILL}
    # The step pieces stacked on themselves: a two-high step in the user's plateau, but along a long
    # edge they make a comb (the sheet never stacks them). Not allowed.
    # (1,1) / (4,1) may stack: the user's step ends that way.
    BANNED_V = {("0,1", "0,1"), ("5,1", "5,1")}
    # Straight edges repeat the user's pieces: (0,2) on the left, (5,3) on the right (not their mirrors).
    BANNED_V |= {("5,2", "5,2"), ("0,3", "0,3")}
    # A straight right edge (5,3) steps out the way the straight left one (0,2) does: (4,1) under it.
    APPROVED_V |= {("5,3", "4,1")}
    # An inner top corner (the user's example): a top edge running into a part that rises higher ends
    # in that part's edge start, (0,1) on the left / (5,1) on the right, so the outline turns up its
    # side; under it the top goes on. A top edge straight against the inner piece is a cut: not allowed.
    TOP_MID = ["2,0", "3,0"]
    APPROVED_H |= {(t, "0,1") for t in TOP_MID} | {("5,1", t) for t in TOP_MID}
    APPROVED_V |= {("0,1", t) for t in FILL} | {("5,1", t) for t in FILL}
    BANNED_H = {(t, "1,1") for t in TOP_MID} | {("4,1", t) for t in TOP_MID}
    # The user's second lesson (their fixes on the world map, saved as user_taught_2.tscn): the diagonal
    # face in one-column steps of (1,5..9) with a clean (2,3) / (2,4) top behind it, and the arm's
    # corners. Every pair they laid there is theirs to allow.
    if lessons:
        h3, v3 = pairs(as_grid(lessons["ders2_capraz_ve_kose (world.tscn 8-33 x 0-18)"]))
        APPROVED_H |= h3; APPROVED_V |= v3
    H, V = (h1 | h2 | APPROVED_H) - (BANNED_H - h1), (v1 | v2 | APPROVED_V) - BANNED_V
    tiles = sorted({t for p in H | V for t in p})
    print("tiles", len(tiles), tiles)
    print("horizontal pairs", len(H), "(sheet", len(h1), "user", len(h2), "new from user", len(h2 - h1), ")")
    print("vertical pairs", len(V), "(sheet", len(v1), "user", len(v2), "new from user", len(v2 - v1), ")")
    print("user-only vertical:", sorted(v2 - v1))
    print("user-only horizontal:", sorted(h2 - h1))
    json.dump({"H": sorted(H), "V": sorted(V)}, open(sys.argv[1] + "/plato_rules.json", "w"))
