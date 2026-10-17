import sys, json; sys.path.insert(0,sys.argv[1]); sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from plato_rules import user_grid
import profil
S=sys.argv[1]
W,Hh=profil.size()
R=json.load(open(S+"/plato_rules.json")); H={tuple(p) for p in R["H"]}; V={tuple(p) for p in R["V"]}
g=user_grid(profil.MAP,(0,0,W-1,Hh-1))
bad=[(k,c,t,n) for (x,y),t in g.items() for k,c,n in (("H",(x,y),g.get((x+1,y))),("V",(x,y),g.get((x,y+1)))) if n is not None and ((t,n) not in (H if k=="H" else V))]
bad=[b for b in bad if not (profil.NAME=="world" and b[1]==(36,33))]
print(len(bad),"rule breaks")
keep={tuple(c) for c in json.load(open(S+"/plato_keep.json"))}
cl=[]
for b in [b[1] for b in bad]:
    for c in cl:
        if any(abs(b[0]-o[0])<=6 and abs(b[1]-o[1])<=6 for o in c): c.append(b); break
    else: cl.append([b])
comps=[]; areas=[]
for c in cl:
    x0,y0,x1,y1=min(x for x,y in c)-5,min(y for x,y in c)-5,max(x for x,y in c)+5,max(y for x,y in c)+5
    area=[(x,y) for y in range(max(0,y0),min(Hh,y1+1)) for x in range(max(0,x0),min(W,x1+1))]
    ring={(x+dx,y+dy) for (x,y) in area for dy in range(-2,3) for dx in range(-2,3) if 0<=x+dx<W and 0<=y+dy<Hh and (x+dx,y+dy) not in keep}
    comps.append(sorted(r for r in ring if g[r]!="G")); areas.append(area)
json.dump(comps,open(S+"/plato_comps.json","w")); json.dump(areas,open(S+"/plato_areas.json","w"))
print("repair windows", [len(a) for a in areas])
