# Which map the plateau tools work on, and how its rock sheet lines up with the world's.
#
# The rules were learnt on the world map's sheet (Town Wall_Tiles.png, brown block, columns 0-5,
# rows 0-9: the "canonical" block). Every other open map's rock is the same kind of block on its own
# sheet, only with fewer rows where the pack draws a shorter top or face. A profile maps each
# canonical row to the sheet's row that plays the same part (top edge, top, front edge, face, face on
# the ground, feet); the rules are carried over through that map (plato_rules.py).
#
# The map is chosen with the PLATO_MAP environment variable (default: world).
import os

IDENT = {r: r for r in range(10)}
PROFILES = {
    # Town Wall_Tiles.png, brown block: the canonical one.
    "world": dict(src=27, col=0, rows=IDENT,
                  trees=r"/(mese|cam|uzun_cam|kutuk)[^/]*\.tscn$", patches=None),
    # The same sheet's grey block; snowy feet (rows 10-11) in place of grassy ones (8-9).
    "frost": dict(src=24, col=6, rows={**{r: r for r in range(8)}, 8: 10, 9: 11},
                  trees=r"/(cam|mese_buz|kutuk)[^/]*\.tscn$", patches=r"/(buz_golu)[^/]*\.tscn$"),
    # Grey block with bare feet (rows 12-13) on the ash.
    "volcano": dict(src=33, col=6, rows={**{r: r for r in range(8)}, 8: 12, 9: 13},
                    trees=r"/(kuru_agac|kuru_mese|kutuk)[^/]*\.tscn$", patches=r"/(cakil_yama|kul_yama)[^/]*\.tscn$"),
    # Cemetery Tiles.png: one face row fewer.
    "kurgan": dict(src=29, col=0, rows={0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 6, 8: 7, 9: 8},
                   trees=r"/(koknar|kuru_mese|kutuk)[^/]*\.tscn$", patches=r"/(camur_yama|toprak)[^/]*\.tscn$",
                   front_apart=True),
    # Fairy Forest Tiles.png, the green-topped block with roots: a shorter top and face.
    "forest": dict(src=26, col=0, rows={0: 0, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 5, 7: 5, 8: 6, 9: 7},
                   trees=r"/(agac|cali_agac|kutuk)[^/]*\.tscn$", patches=r"/(toprak_yama|koyu_cim_yama|cakil)[^/]*\.tscn$",
                   front_apart=True),
    # Desert Ground.png, the sand-topped mesa: the shortest top and face.
    "canyon": dict(src=31, col=0, rows={0: 0, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 5, 7: 5, 8: 5, 9: 6},
                   trees=r"/(kaktus|kuru_agac|kuru_mese)[^/]*\.tscn$", patches=r"/(kum_yama|toprak_yama)[^/]*\.tscn$",
                   # The sand floor is the block's own sand tile on alternative 118; the mesa is 107.
                   rock_alts={107}, front_apart=True),
}

NAME = os.environ.get("PLATO_MAP", "world")
P = PROFILES[NAME]
SRC = P["src"]
COL = P["col"]
ROWS = P["rows"]
SHEET_ROWS = sorted(set(ROWS.values()))
FEET_ROW = ROWS[9]
# PLATO_PATH: work on a copy (trials) instead of the map itself.
MAP = os.environ.get("PLATO_PATH", f"maps/{NAME}.tscn")


def to_sheet(tok):
    """A canonical token "a,b" as this sheet's token."""
    if tok == "G":
        return tok
    a, b = map(int, tok.split(","))
    return f"{a + COL},{ROWS[b]}"


def preimages(tok):
    """The canonical tokens that land on this sheet token."""
    a, b = map(int, tok.split(","))
    return [f"{a - COL},{r}" for r, s in ROWS.items() if s == b]


def is_rock(v):
    """A layer cell (src, ax, ay, alt) that is part of this map's plateau block."""
    if v is None:
        return False
    src, ax, ay = v[0], v[1], v[2]
    if NAME == "world" and src == 6:   # the world's older copy of the sheet
        return 0 <= ax <= 5 and 0 <= ay <= 9
    if "rock_alts" in P and v[3] not in P["rock_alts"]:
        return False
    return src == SRC and COL <= ax <= COL + 5 and ay in SHEET_ROWS


def alt_of(tok):
    """Rock blocks sight (alternative 107); the feet do not (0)."""
    if "rock_alts" in P:
        return min(P["rock_alts"])
    return 0 if int(tok.split(",")[1]) == FEET_ROW else 107


def size():
    """The map's width and height in cells (from its ground layer)."""
    from tmdec import layers
    z = layers(MAP)["Zemin"]
    return max(x for x, y in z) + 1, max(y for x, y in z) + 1
