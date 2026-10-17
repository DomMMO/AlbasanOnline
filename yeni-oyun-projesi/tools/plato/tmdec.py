import re, base64, struct, sys
def layers(path):
    s=open(path,encoding="utf-8").read()
    out={}
    for chunk in s.split("\n[node ")[1:]:
        head=chunk.split("\n",1)[0]
        if 'type="TileMapLayer"' not in head: continue
        name=re.search(r'name="([^"]+)"',head).group(1)
        d=re.search(r'tile_map_data = PackedByteArray\("([^"]*)"\)', chunk)
        cells={}
        if d:
            raw=base64.b64decode(d.group(1))
            for i in range(2,len(raw)-11,12):
                x,y,src,ax,ay,alt=struct.unpack_from("<hhHHHH",raw,i)
                cells[(x,y)]=(src,ax,ay,alt)
        out[name]=cells
    return out
if __name__=="__main__":
    L=layers(sys.argv[1])
    from collections import Counter
    for n,c in L.items():
        print(n,len(c),Counter(v[0] for v in c.values()).most_common(5))
