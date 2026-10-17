# Every plateau of the map tiled at its best under the learnt neighbour rules: an exact optimiser
# (CP-SAT). Every neighbouring pair must be an allowed one; the cost is the shape changed (rock lost
# costs more than rock gained) plus a little for each end / step piece, so they appear only where
# the shape needs them.
import sys, json, os, time
from collections import deque
from ortools.sat.python import cp_model
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from plato_rules import user_grid
import profil
S = sys.argv[1]
W, Hh = int(sys.argv[2]), int(sys.argv[3])
MAP = sys.argv[4] if len(sys.argv) > 4 else profil.MAP
R = json.load(open(S + "/plato_rules.json"))
H = {tuple(p) for p in R["H"]}; V = {tuple(p) for p in R["V"]}
TILES = sorted({t for p in H | V for t in p})
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
ALLOW = [dict() for _ in range(4)]   # ALLOW[d][a] = tiles b allowed at c+d when c is a
for t in TILES:
    for d in range(4): ALLOW[d][t] = set()
for a, b in H: ALLOW[0][a].add(b); ALLOW[1][b].add(a)
for a, b in V: ALLOW[2][a].add(b); ALLOW[3][b].add(a)
LOSE, GAIN = int(os.environ.get("LOSE", "100")), int(os.environ.get("GAIN", "100"))   # rock wanted but grass laid / grass wanted but rock laid
def canonical_cost(t):
    if t == "G": return 0
    a, b = map(int, t.split(","))
    if t in ("2,4", "2,3"): return 0      # the clean top (the user's): plain, no marks
    if 1 <= a <= 4 and 1 <= b <= 4: return 2   # other top pieces carry marks: only where needed
    return 1 if a in (0, 5) else 0     # only to break ties: ends where the shape has them
# Another map's sheet token costs what the cheapest canonical piece it stands for costs.
piece_cost = canonical_cost if profil.NAME == "world" else (lambda t: 0 if t == "G" else min(canonical_cost(c) for c in profil.preimages(t)))

grid = user_grid(MAP, (0, 0, W - 1, Hh - 1))
forbid = {tuple(c) for c in json.load(open(S + "/plato_forbid.json"))}
comps = [[tuple(c) for c in comp] for comp in json.load(open(S + "/plato_comps.json"))]
keep = {tuple(c) for c in json.load(open(S + "/plato_keep.json"))}
areas = json.load(open(S + "/plato_areas.json")) if os.path.exists(S + "/plato_areas.json") else []
pending = {c for comp in comps for c in comp}
ALLMASK = set(pending)
OVERLAP = int(os.environ.get("OVERLAP", "8"))
TIME_LIMIT = int(os.environ.get("TIME_LIMIT", "240"))

def solve(comp, area, reopen=frozenset()):
    comp = set(comp)
    free = set(reopen)          # solved cells round a stuck window, laid again with it
    for (x, y) in (area or comp):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                c = (x + dx, y + dy)
                if 0 <= c[0] < W and 0 <= c[1] < Hh and (c not in keep or c in reopen) and (c not in pending or c in comp or (area and c in area)):
                    free.add(c)
    core = set(free)
    # Overlap: the unsolved rock round the window (and its grass) is solved along with it, so what the
    # window leaves at its border can be carried on; only the window itself is kept.
    for (x, y) in comp:
        for dy in range(-OVERLAP, OVERLAP + 1):
            for dx in range(-OVERLAP, OVERLAP + 1):
                c = (x + dx, y + dy)
                if 0 <= c[0] < W and 0 <= c[1] < Hh and c not in keep and c not in core: free.add(c)
    dom = {c: ({"G"} if c in forbid else set(TILES)) for c in free}
    # Deep inside the rock (nothing but rock within 3 cells sideways and up, 6 down where a face may
    # hang; the map's edge counting as rock): plain top.
    FILLS = {"2,2", "3,2", "2,3", "3,3", "2,4", "3,4"}
    for c in free:
        if c not in comp: continue
        deep = all(((c[0] + dx, c[1] + dy) in comp and (c[0] + dx, c[1] + dy) not in forbid) or not (0 <= c[0] + dx < W and 0 <= c[1] + dy < Hh)
                   for dy in range(-3, 7) for dx in range(-3, 4))
        if deep and os.environ.get("DEEP"): dom[c] &= FILLS     # (off: it over-constrains near portals)
    fixed = lambda c: grid[c] if c in grid and c not in pending else None
    # Fixed neighbours prune, then arc consistency.
    for c in free:
        for d, (dx, dy) in enumerate(DIRS):
            n = (c[0] - dx, c[1] - dy)
            if n in dom: continue
            f = fixed(n)
            if f is not None: dom[c] &= ALLOW[d][f]
    if os.environ.get("DOMAIN_ONLY") or os.environ.get("SHOW_FIXED"):
        from collections import Counter
        seen = Counter()
        for c in free:
            for d, (dx, dy) in enumerate(DIRS):
                n = (c[0] - dx, c[1] - dy)
                if n in dom: continue
                f = fixed(n)
                if f is not None and f != "G": seen[(f, n in pending, n in keep)] += 1
        print("   fixed rock neighbours:", seen.most_common(8), "| G pruned?", sum("G" not in v for v in dom.values()), flush=True)
    q = deque(free)
    while q:
        c = q.popleft()
        for d, (dx, dy) in enumerate(DIRS):
            n = (c[0] + dx, c[1] + dy)
            if n not in dom: continue
            sup = set().union(*(ALLOW[d][t] for t in dom[c])) if dom[c] else set()
            new = dom[n] & sup
            if new != dom[n]:
                dom[n] = new; q.append(n)
    empty = [c for c, v in dom.items() if not v]
    if empty:
        c = empty[0]
        why = [((c[0] + dx, c[1] + dy), "free" if (c[0] + dx, c[1] + dy) in dom else fixed((c[0] + dx, c[1] + dy))) for dx, dy in DIRS]
        return None, f"empty domain at {empty[:5]}; first one's neighbours {why}; in comp {c in comp}, forbidden {c in forbid}"
    if os.environ.get("DOMAIN_ONLY"): return None, f"domains ok ({len(free)} cells, {sum(len(v) for v in dom.values())} choices)"
    m = cp_model.CpModel()
    x = {c: {t: m.NewBoolVar("") for t in dom[c]} for c in free}
    for c in free: m.AddExactlyOne(x[c].values())
    for c in globals().get("FORCE_ROCK", ()):
        if c in x and "G" in x[c]: m.Add(x[c]["G"] == 0)
    for c in free:
        for d in (0, 2):
            dx, dy = DIRS[d]; n = (c[0] + dx, c[1] + dy)
            if n not in free: continue
            for a, va in x[c].items():
                ok = [x[n][b] for b in ALLOW[d][a] if b in x[n]]
                m.AddBoolOr([va.Not()] + ok)
    cost = []
    for c in free:
        want = c in comp or (c not in core and c in ALLMASK) or (c in reopen and grid.get(c, "G") != "G")
        for t, v in x[c].items():
            k = (LOSE if want and t == "G" else GAIN if (not want and t != "G") else 0) + piece_cost(t)
            if k: cost.append(k * v)
    m.Minimize(sum(cost))
    sv = cp_model.CpSolver(); sv.parameters.max_time_in_seconds = TIME_LIMIT; sv.parameters.num_workers = 8
    st = sv.Solve(m)
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE): return None, sv.StatusName(st)
    sol = {c: next(t for t, v in x[c].items() if sv.Value(v)) for c in core}
    return sol, f"{sv.StatusName(st)} cost {int(sv.ObjectiveValue())}"

import pickle
out = {}
start = 0
CK = S + "/plato_checkpoint.pkl"
if os.environ.get("RESUME") and os.path.exists(CK):
    grid, keep, pending, out, start = pickle.load(open(CK, "rb"))
    print("resumed at", start)
for ci, comp in enumerate(comps):
    if ci < start: continue
    # ONLY=i: a trial on one plateau; the others stay unsolved (no constraint on it).
    if os.environ.get("ONLY") and ci != int(os.environ["ONLY"]): continue
    pending.difference_update(comp)
    area = set(map(tuple, areas[ci])) if ci < len(areas) and areas[ci] else None
    if area: pending.difference_update(area)
    t0 = time.time()
    sol, info = solve(comp, area)
    for r in (6, 12):
        if sol: break
        # Stuck at its border: open up the solved cells near it and lay them again together.
        near = {c for c in keep if any(abs(c[0] - x) <= r and abs(c[1] - y) <= r for (x, y) in comp)} - set(comp)
        sol, info = solve(comp, area, frozenset(near))
        info += f" (reopened {len(near)} solved cells)"
    if not sol:
        pending.update(comp)     # still unsolved: no constraint on the others
        print(f"plateau {ci} ({len(comp)} cells): {info}", flush=True)
        pickle.dump((grid, keep, pending, out, ci + 1), open(CK, "wb"))
        continue
    if os.environ.get("STOP_AT") and ci >= int(os.environ["STOP_AT"]):
        print(f"plateau {ci}: {info}"); break
    changes = sum((t != "G") != (c in set(comp)) for c, t in sol.items())
    for c, t in sol.items(): grid[c] = t
    keep |= set(sol)
    out.update({f"{c[0]},{c[1]}": t for c, t in sol.items()})
    print(f"plateau {ci}: {len(comp)} cells, shape changes {changes}, {info}, {time.time() - t0:.1f}s", flush=True)
    pickle.dump((grid, keep, pending, out, ci + 1), open(CK, "wb"))
json.dump(out, open(S + "/plato_solution.json", "w"))
