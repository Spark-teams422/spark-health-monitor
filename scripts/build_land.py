"""Natural Earth 110 m land (world-atlas 2.0.2 TopoJSON, public domain) -> one SVG path in an equirectangular
360 x 180 frame (x = lon + 180, y = 90 - lat). Usage: python3 -I scripts/build_land.py <land-110m.json> <out.json>"""
import json, sys

topo = json.load(open(sys.argv[1]))
sx, sy = topo["transform"]["scale"]
tx, ty = topo["transform"]["translate"]
arcs = []
for arc in topo["arcs"]:  # delta-encoded, quantised
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def ring(ids):
    out = []
    for i in ids:
        pts = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(pts if not out else pts[1:])
    return out

d = []
for g in topo["objects"]["land"]["geometries"]:
    polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
    for poly in polys:
        for r in poly:
            pts = ring(r)
            d.append("M" + "L".join(f"{lon + 180:.1f},{90 - lat:.1f}" for lon, lat in pts) + "Z")
json.dump({"source": "Natural Earth 1:110m land via world-atlas 2.0.2 (public domain)", "frame": "x = lon + 180, y = 90 - lat", "d": "".join(d)}, open(sys.argv[2], "w"))
print(len(d), "rings")
