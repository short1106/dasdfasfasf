# Nachbau von OpenFreeMap für die Maps-Tests: echte Vektorkacheln (MVT) im OpenMapTiles-Schema, prozedural erzeugt.
# Inhalt: Fluss (water), Straßenraster (transportation: motorway/primary/secondary/minor), Straßennamen,
# 3D-Gebäude mit Höhen (building) ab Zoom 13, Park, Orte (place). Schriften gibt es nicht (Beschriftungen fehlen im Test).
# Braucht: pip install mapbox-vector-tile shapely      Aufruf: python3 tileserver.py  (Port 8796)
import json, math, random
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import mapbox_vector_tile
from shapely.geometry import LineString, Polygon, Point, box

R = 6378137.0
def merc(lon, lat):
    return lon * math.pi / 180 * R, math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) * R
def tile_bounds(z, x, y):
    n = 2 ** z; size = 2 * math.pi * R / n; ox = -math.pi * R
    minx = ox + x * size; maxy = math.pi * R - y * size
    return minx, maxy - size, minx + size, maxy

CX, CY = merc(6.7623, 51.4344)          # Duisburg
PLACES = [('Duisburg', 'city', 6.7623, 51.4344), ('Neudorf', 'suburb', 6.785, 51.425), ('Ruhrort', 'suburb', 6.733, 51.452)]

def features(z, b):
    minx, miny, maxx, maxy = b
    tb = box(*b)
    layers = {}
    def add(layer, geom, props):
        g = geom.intersection(tb.buffer((maxx - minx) * 0.05))
        if not g.is_empty: layers.setdefault(layer, []).append({'geometry': g.wkt, 'properties': props})
    # Fluss: Sinusband nahe Duisburg (nur in der Region)
    if maxx > CX - 60000 and minx < CX + 60000 and maxy > CY - 60000 and miny < CY + 60000:
        xs = [minx + (maxx - minx) * i / 40 for i in range(41)]
        top = [(x, CY + 900 + 700 * math.sin((x - CX) / 2500)) for x in xs]
        bot = [(x, y - 380) for x, y in reversed(top)]
        add('water', Polygon(top + bot), {'class': 'river'})
        add('park', Polygon([(CX - 2600, CY - 1800), (CX - 1200, CY - 1800), (CX - 1200, CY - 600), (CX - 2600, CY - 600)]), {'class': 'park'})
        # Straßenraster
        steps = [(4000, 'primary'), (1000, 'secondary'), (250, 'minor')]
        for step, cls in steps:
            if (cls == 'minor' and z < 13) or (cls == 'secondary' and z < 10): continue
            k0 = math.floor((minx - CX) / step); k1 = math.ceil((maxx - CX) / step)
            for k in range(k0, k1 + 1):
                x = CX + k * step
                add('transportation', LineString([(x, miny), (x, maxy)]), {'class': cls})
                if cls != 'minor': add('transportation_name', LineString([(x, miny), (x, maxy)]), {'class': cls, 'name': 'Königstraße' if k % 2 else 'Mülheimer Str.'})
            k0 = math.floor((miny - CY) / step); k1 = math.ceil((maxy - CY) / step)
            for k in range(k0, k1 + 1):
                y = CY + k * step
                add('transportation', LineString([(minx, y), (maxx, y)]), {'class': cls})
        add('transportation', LineString([(CX - 60000, CY - 30000), (CX + 60000, CY + 30000)]), {'class': 'motorway'})
        # Gebäude ab Zoom 13: zwischen den kleinen Straßen
        if z >= 13:
            step = 250
            for i in range(math.floor((minx - CX) / step), math.ceil((maxx - CX) / step)):
                for j in range(math.floor((miny - CY) / step), math.ceil((maxy - CY) / step)):
                    rnd = random.Random(i * 7919 + j * 104729)
                    x0, y0 = CX + i * step, CY + j * step
                    if abs(y0 - CY - 900) < 800: continue   # kein Haus im Fluss
                    for _ in range(3):
                        w, hgt = rnd.uniform(40, 90), rnd.uniform(40, 90)
                        bx, by = x0 + rnd.uniform(20, step - w - 20), y0 + rnd.uniform(20, step - hgt - 20)
                        height = rnd.choice([8, 12, 18, 25, 40, 70, 120]) if math.hypot(x0 - CX, y0 - CY) < 1500 else rnd.choice([6, 9, 12])
                        add('building', box(bx, by, bx + w, by + hgt), {'render_height': height, 'render_min_height': 0})
    for name, cls, lon, lat in PLACES:
        px, py = merc(lon, lat)
        if minx <= px <= maxx and miny <= py <= maxy: add('place', Point(px, py), {'class': cls, 'name': name, 'name:de': name})
    return [{'name': k, 'features': v} for k, v in layers.items()]

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype):
        self.send_response(code); self.send_header('content-type', ctype); self.send_header('access-control-allow-origin', '*'); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        p = self.path.split('?')[0]
        if p == '/planet':
            tj = {'tilejson': '3.0.0', 'tiles': ['http://127.0.0.1:8796/tiles/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14,
                  'vector_layers': [{'id': l, 'fields': {}} for l in ['water', 'park', 'transportation', 'transportation_name', 'building', 'place',
                                                                    'landcover', 'landuse', 'waterway', 'boundary', 'aeroway', 'water_name', 'poi']]}
            return self.send(200, json.dumps(tj).encode(), 'application/json')
        if p.startswith('/tiles/'):
            z, x, y = map(int, p[len('/tiles/'):].replace('.pbf', '').split('/'))
            b = tile_bounds(z, x, y)
            data = mapbox_vector_tile.encode(features(z, b), default_options={'quantize_bounds': b, 'extents': 4096})
            return self.send(200, data, 'application/x-protobuf')
        self.send(404, b'', 'text/plain')

if __name__ == '__main__':
    print('Kachel-Nachbau auf 8796')
    ThreadingHTTPServer(('127.0.0.1', 8796), H).serve_forever()
