# Phase 11 concept boards: illustrated trail map
import json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from topo_layout import TILES, PATHS, HIKERS, REVEALED, VISITED, STANDING
from tpl10b import FONT

SP = os.path.join(os.path.dirname(__file__), '..')
PROJ = os.path.join(SP, 'hike-ui', 'project')
B11 = json.load(open(os.path.join(SP, 'topo', 'blobs11.json')))
BL = lambda k: '/_blob/' + B11[k]
BLOBS = json.load(open(os.path.join(SP, 'up10b', 'blobs.json')))
POR = {k: '/_blob/' + BLOBS['por'][k] for k in ('finn', 'ellie', 'cody', 'gdog')}
FACE = {'finn': .569, 'ellie': .678, 'cody': .518, 'gdog': .836}
NODE = {'F': '/_blob/62add56add8cdc44bdd2947049f865be', 'R': '/_blob/bd13e8d019c14338c7427650a25506ec',
        'W': '/_blob/61a42a071acb764f0eefe05f3d20b707', 'M': '/_blob/4b0866cf116a003081b38798aa257cef'}
BACK = {'F': '/_blob/1dabee26f99aa7169811eff5f5534d7a', 'R': '/_blob/157ed668f88e55549a13728350a43024',
        'W': '/_blob/7cf48ac0e9a5aa9aba44303c7910ef94', 'M': '/_blob/0079fe313d58cd5f5e827cee5b101a3a',
        'mix': '/_blob/f686034d1fe6f6758de9ed2df14bed81'}
WATER = json.load(open(os.path.join(SP, 'topo', 'water.json')))
TILT = json.load(open(os.path.join(SP, 'topo', 'tilt-geo.json')))

ICON = {
 'zap': '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
 'utensils': '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
 'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
 'star': '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
 'sign': '<path d="M12 3v3"/><path d="M12 13v8"/><path d="M18 6H5l-2 3.5L5 13h13z"/>',
 'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
 'help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
 'tent': '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
 'alert': '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
 'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 'pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
 'road': '<path d="M4 19 8 5"/><path d="m16 5 4 14"/><path d="M12 6v2"/><path d="M12 11v2"/><path d="M12 16v2"/>',
}
SPEC = {'TRAILHEAD': ('pin', '#2F4A42'), 'TRAIL SIGN': ('sign', '#8A6A3E'), 'CHALLENGE': ('alert', '#C8553D'),
        'OVERLOOK': ('eye', '#3E79A3'), 'OPPORTUNITY': ('star', '#4F8A63'), 'CAMPSITE': ('tent', '#C98A3A'),
        'MYSTERY': ('help', '#7A5AA6'), 'NARROW PATH': (None, '#1D2220'), 'CHECKPOINT': ('home', '#D9434B')}
LINE = {'steep': ('zap', '#E9B44C', '#1D2220', '−1', 'Steep: −1 Energy'),
        'muddy': ('utensils', '#9A7650', '#F7F1E4', '−1', 'Muddy: −1 Appetite'),
        'rough': ('heart', '#CDA6EE', '#1D2220', '−1', 'Rough: −1 Morale'),
        'paved': ('road', '#ECE5D6', '#1D2220', 'FREE', 'Paved: no Appetite')}
GRAY = '#77736A'

def icon(name, x, y, size, color, sw=2.2):
    k = size / 24
    return f'<g transform="translate({x - size / 2:.1f},{y - size / 2:.1f}) scale({k:.3f})" fill="none" stroke="{color}" stroke-width="{sw / k * k:.2f}" stroke-linecap="round" stroke-linejoin="round">{ICON[name]}</g>'

def d_of(pts):
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)

def hexpts(cx, cy, R, flat=1.0):
    return [(cx + R * math.cos(math.pi / 6 + i * math.pi / 3 - math.pi / 2 + math.pi / 6 * 0), cy + R * math.sin(math.pi / 6 + i * math.pi / 3) * flat) for i in range(6)]

def hex_pointy(cx, cy, R):
    return [(cx + R * math.cos(math.radians(-90 + 60 * i)), cy + R * math.sin(math.radians(-90 + 60 * i))) for i in range(6)]

def poly(pts):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)

# ------------------------------------------------------------------ paths
def seg_cross(p1, p2, q1, q2):
    def ccw(a, b, c): return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
    return ccw(p1, q1, q2) != ccw(p2, q1, q2) and ccw(p1, p2, q1) != ccw(p1, p2, q2)

def bridges(pts):
    out = []
    for i in range(len(pts) - 1):
        for wl in (WATER['riv'], WATER['crk']):
            for j in range(0, len(wl) - 1):
                if seg_cross(pts[i], pts[i + 1], wl[j], wl[j + 1]):
                    a = math.degrees(math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]))
                    mx, my = (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2
                    if any(math.hypot(mx - t['x'], my - t['y']) < 60 * t['s'] for t in TILES.values()): continue
                    if any(math.hypot(mx - x, my - y) < 20 for x, y, _ in out): continue
                    out.append(((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2, a))
    return out

def path_svg(p, pts, k=1.0, gray_only=False, routes_only=False):
    ty = p['type']; who = None if gray_only else p['who']
    col = HIKERS[who] if who else GRAY
    d = d_of(pts)
    o = []
    if ty == 'paved':
        o.append(f'<path d="{d}" fill="none" stroke="#F4EDDA" stroke-opacity="0.8" stroke-width="{10 * k:.1f}" stroke-linecap="round"/>')
        if who: o.append(f'<path d="{d}" fill="none" stroke="#1D2220" stroke-opacity="0.45" stroke-width="{6.5 * k:.1f}" stroke-linecap="round"/>')
        o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{4.2 * k:.1f}" stroke-linecap="round"/>')
    else:
        dot = ty in ('steep', 'muddy', 'rough')
        dash = f'0.1 {8.5 * k:.1f}' if dot else ('none' if who else f'{10 * k:.1f} {7 * k:.1f}')
        w = (5.6 if dot else 3.6) * k * (1.15 if who else 1)
        cap = 'round' if (dot or who) else 'butt'
        o.append(f'<path d="{d}" fill="none" stroke="#F4EDDA" stroke-opacity="{0.42 if not routes_only else 0.25}" stroke-width="{8 * k:.1f}" stroke-linecap="round"/>')
        if who: o.append(f'<path d="{d}" fill="none" stroke="#1D2220" stroke-opacity="0.5" stroke-width="{w + 2.6 * k:.1f}" stroke-dasharray="{dash}" stroke-linecap="{cap}"/>')
        o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w:.1f}" stroke-dasharray="{dash}" stroke-linecap="{cap}"/>')
    return ''.join(o)

def bridge_svg(x, y, a, k=1.0):
    return (f'<g transform="translate({x:.1f},{y:.1f}) rotate({a:.1f}) scale({k * .8:.2f})">'
            f'<rect x="-13" y="-7.5" width="26" height="15" rx="2" fill="#8A5A3C" stroke="#4A3A2E" stroke-width="1.4"/>'
            + ''.join(f'<line x1="{-10 + i * 4}" y1="-6.5" x2="{-10 + i * 4}" y2="6.5" stroke="#A8714A" stroke-width="2"/>' for i in range(6)) +
            '<line x1="-13" y1="-8.5" x2="13" y2="-8.5" stroke="#4A3A2E" stroke-width="1.6"/><line x1="-13" y1="8.5" x2="13" y2="8.5" stroke="#4A3A2E" stroke-width="1.6"/></g>')

def badge_svg(p, pts, k=1.0):
    if p['type'] == 'normal': return ''
    ic, bg, fg, txt, tip = LINE[p['type']]
    x, y = pts[len(pts) // 2]
    if txt == 'FREE':
        return (f'<g transform="translate({x:.1f},{y:.1f}) scale({k:.2f})"><rect x="-21" y="-10" width="42" height="20" rx="10" fill="{bg}" stroke="#1D2220" stroke-width="1.5"/>'
                f'<text x="0" y="4" text-anchor="middle" font-family="EditUndo" font-size="11" fill="{fg}">FREE</text></g>')
    return (f'<g transform="translate({x:.1f},{y:.1f}) scale({k:.2f})"><rect x="-19" y="-10.5" width="38" height="21" rx="10.5" fill="{bg}" stroke="#1D2220" stroke-width="1.5"/>'
            + icon(ic, -7, 0, 12, fg, 2.4) + f'<text x="7" y="4.5" text-anchor="middle" font-family="EditUndo" font-size="12" fill="{fg}">{txt}</text></g>')

# ------------------------------------------------------------------ tiles
def chips(t, cx, cy, R, k=1.0, pencil=False):
    n = len(t['nodes'])
    if not n: return ''
    w = 19 * k; gap = 3 * k
    x0 = cx - (n * w + (n - 1) * gap) / 2; y = cy + R * 0.42
    o = []
    for i, nd in enumerate(t['nodes']):
        x = x0 + i * (w + gap)
        if pencil:
            pts = hex_pointy(x + w / 2, y + w * .55, w * .55)
            o.append(f'<polygon points="{poly(pts)}" fill="#EEE5CB" fill-opacity="0.7" stroke="#5E5648" stroke-width="1.2"/>'
                     f'<text x="{x + w / 2:.1f}" y="{y + w * .55 + 4 * k:.1f}" text-anchor="middle" font-family="EditUndo" font-size="{10 * k:.1f}" fill="#5E5648">?</text>')
        else:
            o.append(f'<image href="{NODE[nd]}" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{w * 1.1:.1f}"/>')
    return ''.join(o)

def special_svg(t, cx, cy, R, k=1.0, corner=False, pencil=False):
    sp = t['special']
    if not sp: return ''
    ic, col = SPEC[sp]
    if corner:
        cx, cy, r = cx + R * .55, cy - R * .62, 11 * k
    else:
        r = 15 * k; cy = cy - R * .12
    if pencil:
        col_f, col_s, fg = '#EEE5CB', '#5E5648', '#5E5648'
    else:
        col_f, col_s, fg = col, '#F7F1E4', '#F7F1E4'
    o = f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{col_f}" stroke="{col_s}" stroke-width="{2 * k:.1f}"/>'
    if ic: o += icon(ic, cx, cy, r * 1.15, fg, 2.4)
    else: o += f'<text x="{cx:.1f}" y="{cy + r * .38:.1f}" text-anchor="middle" font-family="EditUndo" font-size="{r * 1.15:.1f}" fill="{fg}">2</text>'
    return o

def tokens(t, cx, cy, R, k=1.0, uid='', standing=False):
    hs = STANDING.get(t['k'], [])
    o = []
    n = len(hs)
    for i, h in enumerate(hs):
        x = cx + (i - (n - 1) / 2) * 30 * k; y = cy - R * 0.06
        r = 15 * k
        cid = f'c{uid}{t["k"]}{i}'
        if standing:
            o.append(f'<ellipse cx="{x:.1f}" cy="{y + 2:.1f}" rx="{9 * k:.1f}" ry="{3.5 * k:.1f}" fill="#10201C" fill-opacity="0.45"/>'
                     f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{y - 20 * k:.1f}" stroke="#1D2220" stroke-width="{2.2 * k:.1f}"/>')
            y = y - 20 * k - r
        ih = 2 * r * 3 / 1.21 ; iw = 2 * r * 3
        o.append(f'<clipPath id="{cid}"><circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/></clipPath>'
                 f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r + 2.6 * k:.1f}" fill="{HIKERS[h]}" stroke="#1D2220" stroke-width="{1.4 * k:.1f}"/>'
                 f'<image href="{POR[h]}" clip-path="url(#{cid})" x="{x - iw / 2:.1f}" y="{y - FACE[h] * ih:.1f}" width="{iw:.1f}" height="{ih:.1f}"/>')
    return ''.join(o)

def tile_svg(t, style, uid='', geo=None, k=1.0):
    """style: glass | vignette | pin | clearing"""
    cx, cy = (geo['x'], geo['y']) if geo else (t['x'], t['y'])
    R = 54 * t['s'] * k
    hp = geo['hex'] if geo else hex_pointy(cx, cy, R)
    if geo:  # tilted: rotate hex to pointy-top by projecting a pointy hex instead
        hp = geo['hex']
    rev = t['k'] in REVEALED; vis = t['k'] in VISITED
    pencil = not rev
    o = []
    if style in ('glass', 'clearing') or pencil:
        if style == 'clearing' and not pencil:
            o.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{R * 1.05:.1f}" ry="{R * .95 * (geo and .75 or 1):.1f}" fill="#F7F1E4" fill-opacity="0.42" filter="url(#soft{uid})"/>'
                     f'<polygon points="{poly(hp)}" fill="none" stroke="#F7F1E4" stroke-opacity="0.55" stroke-width="{1.6 * k:.1f}" stroke-dasharray="{5 * k:.1f} {4 * k:.1f}"/>')
        elif pencil:
            o.append(f'<polygon points="{poly(hp)}" fill="#EEE5CB" fill-opacity="0.45" stroke="#5E5648" stroke-width="{1.7 * k:.1f}" stroke-dasharray="{6 * k:.1f} {4 * k:.1f}"/>')
        else:
            o.append(f'<polygon points="{poly(hp)}" fill="#0F1A16" fill-opacity="{0.36 if vis else 0.5}" stroke="#F7F1E4" stroke-opacity="0.92" stroke-width="{2.2 * k:.1f}"/>'
                     f'<polygon points="{poly([(cx + (x - cx) * .9, cy + (y - cy) * .9) for x, y in hp])}" fill="none" stroke="#F7F1E4" stroke-opacity="0.22" stroke-width="{1 * k:.1f}"/>')
    elif style == 'vignette':
        nodes = t['nodes']
        key = 'mix' if (len(set(nodes)) > 1) else (nodes[0] if nodes else 'W')
        if t['special'] == 'CHECKPOINT': key = 'M'
        cid = f'v{uid}{t["k"]}'
        o.append(f'<clipPath id="{cid}"><polygon points="{poly(hp)}"/></clipPath>'
                 f'<polygon points="{poly([(cx + (x - cx) * 1.06, cy + (y - cy) * 1.06) for x, y in hp])}" fill="#1D2220" fill-opacity="0.55"/>'
                 f'<image href="{BACK[key]}" clip-path="url(#{cid})" x="{cx - R * 1.4:.1f}" y="{cy - R:.1f}" width="{R * 2.8:.1f}" height="{R * 2:.1f}" preserveAspectRatio="xMidYMid slice"/>'
                 f'<polygon points="{poly(hp)}" fill="#1D2220" fill-opacity="{0.0 if vis else 0.18}" stroke="#F7F1E4" stroke-width="{3 * k:.1f}"/>')
    elif style == 'pin':
        if t['special']:
            ic, col = SPEC[t['special']]
            py = cy - 6 * k
            o.append(f'<ellipse cx="{cx:.1f}" cy="{cy + 16 * k:.1f}" rx="{14 * k:.1f}" ry="{5 * k:.1f}" fill="#10201C" fill-opacity="0.4"/>'
                     f'<path d="M{cx:.1f} {cy + 16 * k:.1f} L{cx - 11 * k:.1f} {py + 8 * k:.1f} A{17 * k:.1f} {17 * k:.1f} 0 1 1 {cx + 11 * k:.1f} {py + 8 * k:.1f} Z" fill="{col}" stroke="#F7F1E4" stroke-width="{2.2 * k:.1f}"/>')
            o.append(icon(ic, cx, py - 4 * k, 17 * k, '#F7F1E4', 2.4) if ic else f'<text x="{cx:.1f}" y="{py + 2 * k:.1f}" text-anchor="middle" font-family="EditUndo" font-size="{16 * k:.1f}" fill="#F7F1E4">2</text>')
        else:
            o.append(f'<ellipse cx="{cx:.1f}" cy="{cy + 10 * k:.1f}" rx="{20 * k:.1f}" ry="{7 * k:.1f}" fill="#10201C" fill-opacity="0.35"/>'
                     f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{13 * k:.1f}" fill="#F7F1E4" stroke="#1D2220" stroke-width="{2.4 * k:.1f}"/>'
                     f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{5 * k:.1f}" fill="#1D2220"/>')
        if t['k'] == 'H':
            o.append(f'<polygon points="{poly(hp)}" fill="#F7F1E4" fill-opacity="0.12" stroke="#F7F1E4" stroke-width="{2 * k:.1f}" stroke-dasharray="{6 * k:.1f} {4 * k:.1f}"/>')
        # node chips under the pin
        n = len(t['nodes'])
        if n:
            w = 19 * k; pw = n * (w + 3 * k) + 8 * k
            o.append(f'<rect x="{cx - pw / 2:.1f}" y="{cy + 22 * k:.1f}" width="{pw:.1f}" height="{w * 1.1 + 6 * k:.1f}" rx="{7 * k:.1f}" fill="#1D2220" fill-opacity="0.72"/>')
            o.append(chips(t, cx, cy + 25 * k - R * .42, R, k))
        if STANDING.get(t['k']):
            o.append(tokens(t, cx + 40 * k, cy - 12 * k, R, k, uid))
        return ''.join(o)
    o.append(chips(t, cx, cy, R, k, pencil))
    o.append(special_svg(t, cx, cy, R, k, corner=vis or bool(STANDING.get(t['k'])), pencil=pencil))
    if not pencil and t['k'] in 'P':
        pass
    o.append(tokens(t, cx, cy, R, k, uid, standing=bool(geo)))
    return ''.join(o)

DEFS = lambda uid: f'<defs><filter id="soft{uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter></defs>'

def map_svg(style, uid, bg, vb='0 0 1600 1000', w=1600, h=1000, gray_only=False, extra='', routes_only=False, bgfilter=''):
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" style="display:block">', DEFS(uid)]
    o.append(f'<image href="{bg}" x="0" y="0" width="1600" height="1000" preserveAspectRatio="none" {bgfilter}/>')
    o.append(extra)
    for p in PATHS:
        o.append(path_svg(p, p['pts'], 1, gray_only, routes_only))
    for p in PATHS:
        for x, y, a in bridges(p['pts']): o.append(bridge_svg(x, y, a))
    for p in PATHS:
        o.append(badge_svg(p, p['pts']))
    if not routes_only:
        for t in sorted(TILES.values(), key=lambda t: t['y']):
            o.append(tile_svg(t, style, uid))
    else:
        for t in TILES.values():
            o.append(f'<polygon points="{poly(hex_pointy(t["x"], t["y"], 54 * t["s"]))}" fill="#0F1A16" fill-opacity="0.25" stroke="#F7F1E4" stroke-opacity="0.35" stroke-width="1.5"/>')
    o.append('</svg>')
    return ''.join(o)

# ------------------------------------------------------------------ html
def head(title):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&amp;display=swap">
<style>
@font-face{{font-family:'EditUndo';src:url({FONT}) format('truetype');font-display:block}}
body{{margin:0}}
.eu{{font-family:'EditUndo',monospace}}
.ds{{font-family:'DM Sans',sans-serif}}
</style>
</helmet>
'''
def foot(w, h):
    return f'''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
'''

def compass(x, y, s=1):
    pts_l = f'M0 -{34*s} L{6*s} -{6*s} L0 0 Z M0 {34*s} L-{6*s} {6*s} L0 0 Z M{34*s} 0 L{6*s} {6*s} L0 0 Z M-{34*s} 0 L-{6*s} -{6*s} L0 0 Z'
    pts_d = f'M0 -{34*s} L-{6*s} -{6*s} L0 0 Z M0 {34*s} L{6*s} {6*s} L0 0 Z M{34*s} 0 L{6*s} -{6*s} L0 0 Z M-{34*s} 0 L-{6*s} {6*s} L0 0 Z'
    return (f'<svg width="{90*s}" height="{100*s}" viewBox="-{45*s} -{55*s} {90*s} {100*s}" style="position:absolute;left:{x}px;top:{y}px">'
            f'<circle r="{24*s}" fill="none" stroke="#F7F1E4" stroke-opacity="0.8" stroke-width="1.5"/><circle r="{20*s}" fill="none" stroke="#F7F1E4" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="2 3"/>'
            f'<g transform="rotate(45) scale(.6)"><path d="{pts_l}" fill="#F7F1E4" fill-opacity="0.85"/><path d="{pts_d}" fill="#1D2220" fill-opacity="0.6"/></g>'
            f'<path d="{pts_l}" fill="#F7F1E4"/><path d="{pts_d}" fill="#1D2220"/>'
            f'<text y="-{40*s}" text-anchor="middle" font-family="EditUndo" font-size="{14*s}" fill="#F7F1E4" stroke="#1D2220" stroke-width="3" paint-order="stroke">N</text></svg>')

def cartouche(x, y, title='MEADOW', sub='SECTION I · TIER I · DAY 3'):
    return f'''<div style="position:absolute;left:{x}px;top:{y}px;padding:12px 18px 12px 18px;background:#F4EDDA;border:2px solid #1D2220;box-shadow:inset 0 0 0 4px #F4EDDA, inset 0 0 0 5.5px #1D2220, 0 6px 16px rgba(0,0,0,.25);border-radius:4px;display:flex;flex-direction:column;align-items:center;gap:4px">
<span class="eu" style="font-size:30px;letter-spacing:.08em;color:#1D2220;line-height:1">{title}</span>
<span class="eu" style="font-size:11px;letter-spacing:.1em;color:#5E5648">{sub}</span>
<div style="display:flex;align-items:center;gap:0;margin-top:4px"><div style="width:30px;height:6px;background:#1D2220"></div><div style="width:30px;height:6px;background:#F4EDDA;border:1.5px solid #1D2220;box-sizing:border-box"></div><div style="width:30px;height:6px;background:#1D2220"></div><span class="ds" style="font-size:11px;color:#5E5648;margin-left:8px">about half a day</span></div>
</div>'''

def label(x, y, text, size=17, color='#1F5E6E', rot=0, halo='#F4EDDA'):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;transform:rotate({rot}deg);font-family:Fraunces,serif;font-style:italic;font-weight:600;font-size:{size}px;color:{color};'
            f'text-shadow:0 0 3px {halo},0 0 3px {halo},0 0 6px {halo};white-space:nowrap;letter-spacing:.02em">{text}</div>')

def legend_html(x, y, dark=True):
    rows = []
    def line_sample(kind, col=GRAY):
        p = {'type': kind, 'who': None}
        pts = [(6, 12), (70, 12)]
        svg = path_svg(dict(p), pts, 0.9)
        if col != GRAY:
            svg = path_svg(dict(type=kind, who=[k for k, v in HIKERS.items() if v == col][0]), pts, 0.9)
        return f'<svg width="76" height="24" viewBox="0 0 76 24">{svg}</svg>'
    items = [('normal', 'Trail', 'dashed'), ('steep', 'Steep, muddy, rough', 'dotted + cost badge'), ('paved', 'Paved', 'solid, free')]
    for kind, name, note in items:
        rows.append(f'<div style="display:flex;align-items:center;gap:10px">{line_sample(kind)}<span class="ds" style="font-size:12.5px;color:#F7F1E4;font-weight:600;white-space:nowrap">{name}</span><span class="ds" style="font-size:11.5px;color:#B9B2A2;white-space:nowrap">{note}</span></div>')
    sw = ''.join(f'<div style="width:14px;height:14px;border-radius:50%;background:{c};border:1.5px solid #1D2220"></div>' for c in HIKERS.values())
    rows.append(f'<div style="display:flex;align-items:center;gap:10px;margin-top:2px"><div style="display:flex;gap:3px;width:76px">{sw}</div><span class="ds" style="font-size:12.5px;color:#F7F1E4;font-weight:600">Walked</span><span class="ds" style="font-size:11.5px;color:#B9B2A2">first hiker\'s color, solid</span></div>')
    return f'<div style="position:absolute;left:{x}px;top:{y}px;padding:12px 14px;background:rgba(29,34,32,.86);border-radius:12px;display:flex;flex-direction:column;gap:7px;box-shadow:0 6px 16px rgba(0,0,0,.25)"><span class="eu" style="font-size:11px;letter-spacing:.1em;color:#E9B44C">LEGEND</span>{"".join(rows)}</div>'

def note(x, y, w, title, body, dark=True):
    bg = 'rgba(29,34,32,.88)' if dark else '#F4EDDA'
    tc = '#E9B44C' if dark else '#1D2220'; bc = '#E4DDCD' if dark else '#3B3A35'
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;box-sizing:border-box;padding:12px 14px;background:{bg};border-radius:12px;display:flex;flex-direction:column;gap:5px;box-shadow:0 6px 16px rgba(0,0,0,.22)"><span class="eu" style="font-size:12px;letter-spacing:.08em;color:{tc}">{title}</span><span class="ds" style="font-size:13px;line-height:1.4;color:{bc}">{body}</span></div>'

def write(name, html):
    open(os.path.join(PROJ, name), 'w').write(html)

# ------------------------------------------------------------------ board 1: top-down
def board_topdown():
    h = head('Illustrated map · top-down')
    h += '<div style="position:relative;width:1600px;height:1000px;overflow:hidden;background:#EEE5CB">'
    h += f'<div style="position:absolute;left:0;top:0">{map_svg("glass", "a", BL("reveal"))}</div>'
    h += label(1092, 628, 'Tumalo Pond', 17, '#1F5E6E')
    h += label(404, 560, 'Ochoco Lookout', 16, '#5A3F66')
    h += label(600, 860, 'Santiam Creek', 15, '#1F5E6E', rot=-22)
    h += label(624, 408, 'Siletz Run', 14, '#1F5E6E', rot=-4)
    h += label(1072, 470, 'Metolius Woods', 15, '#2A4A3A')
    h += label(1200, 150, 'unexplored', 15, '#6E6655', rot=-4, halo='#EEE5CB')
    h += compass(1480, 22)
    h += cartouche(28, 860)
    h += legend_html(1236, 842)
    h += note(28, 24, 330, 'TOP-DOWN · CONCEPT', 'Chosen look: top-down, dark see-through hexes. Generated around this run\'s trail tree: River tiles get the river, Mountain tiles the peaks, Forest tiles the woods. Where nobody has been yet, the map is still a pencil sketch, and it paints itself in as tiles are revealed.')
    h += '</div>' + foot(1600, 1000)
    write('MapTopDown.dc.html', h)

# ------------------------------------------------------------------ board 2: tilted
def board_tilted():
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000" style="display:block">', DEFS('b')]
    o.append(f'<image href="{BL("tilted")}" x="0" y="0" width="1600" height="1000" preserveAspectRatio="none"/>')
    gp = {(g['a'], g['b']): g['pts'] for g in TILT['paths']}
    for p in PATHS:
        pts = gp[(p['a'], p['b'])]
        k = TILT['tiles'][p['a']]['s'] * 1.05
        o.append(path_svg(p, pts, k))
    for p in PATHS:
        pts = gp[(p['a'], p['b'])]
        o.append(badge_svg(p, pts, TILT['tiles'][p['a']]['s']))
    for t in sorted(TILES.values(), key=lambda t: t['y']):
        g = TILT['tiles'][t['k']]
        o.append(tile_svg(t, 'glass', 'b', geo=g, k=g['s']))
    o.append('</svg>')
    h = head('Illustrated map · tilted')
    h += '<div style="position:relative;width:1600px;height:1000px;overflow:hidden;background:#9CC3E0">'
    h += f'<div style="position:absolute;left:0;top:0">{"".join(o)}</div>'
    h += cartouche(28, 860)
    h += note(28, 24, 330, "TILTED BIRD'S-EYE · CONCEPT", 'Same generated land, seen at an angle like Fedorczuk\'s paintings: trees, peaks and the far ranges stand up, and rows farther up the trail sit a little smaller. Everything is still played on the same tiles and paths.')
    h += note(1180, 846, 392, 'BEST USE: SECTION INTRO', 'Tiles shrink toward the top and ridges can hide paths, so play stays top-down. This view works as a short establishing shot when a section starts: the camera opens tilted, then settles flat into the top-down map.')
    h += '</div>' + foot(1600, 1000)
    write('MapTilted.dc.html', h)

# ------------------------------------------------------------------ board 3: tile looks
def board_tiles():
    opts = [('glass', 'A · DARK GLASS HEX', 'Chosen. A see-through dark hex with a cream edge: the land shows through, and the tile still reads at a glance.'),
            ('vignette', 'B · PAINTED VIGNETTE', 'Each tile is a little painting of its nodes (your backdrop art), set into the map like a stamp. Most decorative, but it hides the most map.'),
            ('pin', 'C · LANDMARK PINS', 'Like the Fallout map: no hexes, just pins for special spaces and dots for plain ones. The hex outline appears only on the tile you select.'),
            ('clearing', 'D · SOFT CLEARINGS', 'A pale glow in the land with a faint dashed hex, so tiles feel like places in the woods rather than pieces on top.')]
    h = head('Tile looks · 4 options')
    h += '<div style="position:relative;width:1600px;height:1000px;overflow:hidden;background:#1D2220">'
    h += '<span class="eu" style="position:absolute;left:24px;top:22px;font-size:20px;letter-spacing:.06em;color:#F7F1E4">TILE LOOKS ON THE ILLUSTRATED MAP</span>'
    h += '<span class="ds" style="position:absolute;left:24px;top:50px;font-size:13px;color:#B9B2A2">Same spot on the map, four ways to draw the tiles. Pencil tiles (top right) are still unexplored. Paths, badges and hikers stay the same in all four.</span>'
    pos = [(20, 84), (810, 84), (20, 538), (810, 538)]
    for (x, y), (st, t1, t2) in zip(pos, opts):
        svg = map_svg(st, st, BL('painted'), vb='455 300 770 440', w=770, h=440)
        h += f'<div style="position:absolute;left:{x}px;top:{y}px;width:770px;height:440px;border-radius:12px;overflow:hidden">{svg}</div>'
        if st == 'glass':
            h += f'<div class="eu" style="position:absolute;left:{x + 770 - 112}px;top:{y + 12}px;padding:7px 12px;background:#E9B44C;color:#1D2220;border-radius:8px;font-size:12px;letter-spacing:.08em">CHOSEN</div>'
            h += f'<div style="position:absolute;left:{x - 4}px;top:{y - 4}px;width:774px;height:444px;border:4px solid #E9B44C;border-radius:15px;box-sizing:border-box;pointer-events:none"></div>'
        h += f'<div style="position:absolute;left:{x + 12}px;top:{y + 12}px;max-width:330px;padding:9px 12px;background:rgba(29,34,32,.88);border-radius:10px;display:flex;flex-direction:column;gap:4px"><span class="eu" style="font-size:12px;letter-spacing:.08em;color:#E9B44C">{t1}</span><span class="ds" style="font-size:12.5px;line-height:1.38;color:#E4DDCD">{t2}</span></div>'
    h += '</div>' + foot(1600, 1000)
    write('MapTileLooks.dc.html', h)

# ------------------------------------------------------------------ board 4: trail lines
def board_lines():
    h = head('Trail lines · types and routes')
    h += '<div style="position:relative;width:1600px;height:1000px;overflow:hidden;background:#1D2220">'
    h += '<span class="eu" style="position:absolute;left:24px;top:22px;font-size:20px;letter-spacing:.06em;color:#F7F1E4">TRAIL LINES</span>'
    # left column: types
    rows = [('normal', None, 'TRAIL', 'Dashed. The normal path between tiles: 1 Appetite.'),
            ('steep', None, 'STEEP', 'Dotted, with the badge: −1 Energy on top of the normal cost.'),
            ('muddy', None, 'MUDDY', 'Dotted, with the badge: −1 more Appetite.'),
            ('rough', None, 'ROUGH', 'Dotted, with the badge: −1 Morale.'),
            ('paved', None, 'PAVED', 'Solid. Costs no Appetite.')]
    y = 74
    for kind, who, name, txt in rows:
        pts = [(14, 24), (60, 18), (110, 30), (170, 22)]
        p = dict(type=kind, who=who, pts=pts)
        svg = f'<svg width="190" height="48" viewBox="0 0 190 48" style="background:#A6BC6A;border-radius:8px">{path_svg(p, pts, 1.1)}{badge_svg(p, pts, 1)}</svg>'
        h += f'<div style="position:absolute;left:24px;top:{y}px;display:flex;align-items:center;gap:16px">{svg}<div style="display:flex;flex-direction:column;gap:3px;width:330px"><span class="eu" style="font-size:13px;letter-spacing:.06em;color:#F7F1E4">{name}</span><span class="ds" style="font-size:13px;line-height:1.35;color:#C9C2B2">{txt}</span></div></div>'
        y += 64
    y += 14
    h += f'<span class="eu" style="position:absolute;left:24px;top:{y}px;font-size:14px;letter-spacing:.06em;color:#E9B44C">WHO WALKED IT</span>'
    y += 30
    states = [(None, 'normal', 'NOT WALKED YET', 'Gray. Every path starts this way.'),
              ('finn', 'normal', 'WALKED', 'The first hiker to cross paints it their color for the section, and a dashed path turns solid.'),
              ('cody', 'steep', 'WALKED, DOTTED', 'Steep, muddy and rough paths take the color but stay dotted, so their extra cost still shows.'),
              ('ellie', 'normal', 'MOVE ALL', 'The whole group crossed together: it takes the color of the hiker who did the Move All.')]
    for who, kind, name, txt in states:
        pts = [(14, 24), (60, 18), (110, 30), (170, 22)]
        p = dict(type=kind, who=who, pts=pts)
        svg = f'<svg width="190" height="48" viewBox="0 0 190 48" style="background:#A6BC6A;border-radius:8px">{path_svg(p, pts, 1.1)}</svg>'
        h += f'<div style="position:absolute;left:24px;top:{y}px;display:flex;align-items:center;gap:16px">{svg}<div style="display:flex;flex-direction:column;gap:3px;width:330px"><span class="eu" style="font-size:13px;letter-spacing:.06em;color:#F7F1E4">{name}</span><span class="ds" style="font-size:13px;line-height:1.35;color:#C9C2B2">{txt}</span></div></div>'
        y += 64
    h += note(24, y + 2, 536, 'WINDING AND BRIDGES', 'Paths bend between tiles instead of running straight, and where one crosses a river the map draws a little plank bridge. The bends are only looks: every path still connects exactly the same two tiles.')
    # right: route history view
    svg = map_svg('glass', 'r', BL('painted'), vb='430 330 760 640', w=1000, h=842, routes_only=True,
                  bgfilter='style="filter:saturate(.35) brightness(.72) contrast(.9)"')
    h += f'<div style="position:absolute;left:588px;top:74px;width:990px;height:842px;border-radius:14px;overflow:hidden">{svg}</div>'
    # tile ghosts as small dots on route view
    h += note(608, 94, 380, 'LOOK BACK · ROUTE VIEW', 'A button on the map (or holding Tab) fades the land and the tiles so only the walked paths stand out, in each hiker\'s color. A quick way to see where everyone has been.')
    leg = ''.join(f'<div style="display:flex;align-items:center;gap:6px"><div style="width:16px;height:16px;border-radius:50%;background:{c};border:1.5px solid #F7F1E4"></div><span class="ds" style="font-size:13px;color:#F7F1E4;font-weight:600">{n.title()}</span></div>' for n, c in HIKERS.items())
    h += f'<div style="position:absolute;left:608px;top:860px;display:flex;gap:16px;padding:9px 14px;background:rgba(29,34,32,.86);border-radius:10px">{leg}</div>'
    h += '</div>' + foot(1600, 1000)
    write('MapTrailLines.dc.html', h)

# ------------------------------------------------------------------ board 5: how it is drawn + stamp kit
def board_layers():
    h = head('Illustrated map · how it is drawn')
    h += '<div style="position:relative;width:1600px;height:1000px;overflow:hidden;background:#F4EDDA">'
    h += '<span class="eu" style="position:absolute;left:24px;top:22px;font-size:20px;letter-spacing:.06em;color:#1D2220">HOW THE MAP IS DRAWN</span>'
    h += '<span class="ds" style="position:absolute;left:24px;top:50px;font-size:13px;color:#5E5648">Built in layers every time a section starts, from the trail tree the game already makes. Only the stamps are hand-painted.</span>'
    stages = [('stage-1-sketch', '1 · Pencil sketch', 'Contour lines and shading. This is what unexplored land looks like.'),
              ('stage-2-land', '2 · Land from nodes', 'Forest tiles grow woods, Wildlife tiles open meadows, Mountain tiles raise rock.'),
              ('stage-3-relief', '3 · Light and shadow', 'Light from the top left, cut into 4 flat tones like a painting.'),
              ('stage-4-water', '4 · Water', 'The river runs through River tiles; River ×2 becomes a pond.'),
              ('stage-5-forest', '5 · Trees and details', 'Thousands of small tree crowns, autumn patches, flowers, grass.'),
              ('reveal', '6 · Painted as you explore', 'Revealed tiles paint the land around them. Then paths and tiles go on top.')]
    for i, (k, t1, t2) in enumerate(stages):
        x = 24 + i * 260
        h += f'<div style="position:absolute;left:{x}px;top:86px;width:244px;display:flex;flex-direction:column;gap:6px"><img src="{BL(k)}" style="width:244px;height:153px;object-fit:cover;border-radius:8px;border:2px solid #1D2220"><span class="eu" style="font-size:12px;letter-spacing:.05em;color:#1D2220">{t1}</span><span class="ds" style="font-size:12.5px;line-height:1.35;color:#5E5648">{t2}</span></div>'
    h += '<div style="position:absolute;left:24px;top:350px;width:1552px;height:2px;background:#1D2220;opacity:.15"></div>'
    h += '<span class="eu" style="position:absolute;left:24px;top:372px;font-size:18px;letter-spacing:.06em;color:#1D2220">STAMP KIT · FOR WYATT TO PAINT</span>'
    h += '<span class="ds" style="position:absolute;left:24px;top:398px;font-size:13px;color:#5E5648;width:1100px">These are my code placeholders. The game scatters them over the land (trees on forest edges, rocks on peaks, a bridge where a path crosses water). Because they\'re drawn side-on, one set works for both the top-down and the tilted map.</span>'
    names = ['Conifer', 'Leafy tree', 'Autumn tree', 'Bush', 'Rock outcrop', 'Peak', 'Cabin', 'Fire lookout', 'Bridge', 'Tent', 'Deer', 'Waterfall']
    for row in range(2):
        y0 = 440 + row * 196
        h += f'<div style="position:absolute;left:24px;top:{y0}px;width:1000px;height:166px;border-radius:12px;background:#E9DFC4 url({BL("stamps")}) 0 {-166.5 * row:.1f}px / 1000px 333px no-repeat"></div>'
        for i in range(6):
            h += f'<span class="ds" style="position:absolute;left:{24 + i * 166.7:.0f}px;top:{y0 + 170}px;width:166px;text-align:center;font-size:12px;font-weight:600;color:#3B3A35">{names[row * 6 + i]}</span>'
    spec = ('<b>Angle:</b> side-on with a little height (3/4), like a storybook map.<br><b>Light:</b> from the top left, with a lavender shadow side.<br>'
            '<b>Size:</b> PNG with transparency, about 512 px tall for trees and peaks, 256 px for small things.<br>'
            '<b>Variety:</b> 3 or 4 of each tree, so forest edges don\'t repeat.<br><b>Per biome:</b> Meadow first; the Rainforest and Alpine sets swap trees and add snow later.')
    h += f'<div style="position:absolute;left:1048px;top:440px;width:528px;box-sizing:border-box;padding:16px 18px;background:#1D2220;border-radius:12px;display:flex;flex-direction:column;gap:8px"><span class="eu" style="font-size:12px;letter-spacing:.08em;color:#E9B44C">HOW TO PAINT THEM</span><span class="ds" style="font-size:13.5px;line-height:1.5;color:#E4DDCD">{spec}</span></div>'
    pal = [('Meadow', ['#ECE29B', '#D3CF77', '#AEBB63', '#86A066']), ('Forest', ['#7EB06A', '#5A9663', '#3F7A5C', '#2D5E52']),
           ('Rock', ['#F4D6B5', '#DDA286', '#B77B7E', '#7F6890']), ('Water', ['#D6F5EE', '#9FDCD2', '#4BB0C1', '#3A92AA']),
           ('Autumn', ['#E8CE84', '#E2AE6C', '#C47E47', '#94503F']), ('Sky', ['#FBF8F0', '#C9CCE2', '#A3ACD2', '#86BBE0'])]
    sw = ''
    for n, cs in pal:
        sw += f'<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start"><div style="display:flex">' + ''.join(f'<div style="width:20px;height:20px;background:{c}"></div>' for c in cs) + f'</div><span class="ds" style="font-size:11.5px;color:#C9C2B2">{n}</span></div>'
    h += f'<div style="position:absolute;left:1048px;top:672px;width:528px;box-sizing:border-box;padding:14px 18px;background:#1D2220;border-radius:12px;display:flex;flex-direction:column;gap:10px"><span class="eu" style="font-size:12px;letter-spacing:.08em;color:#E9B44C">PALETTE (FROM THE FEDORCZUK BOARD)</span><div style="display:flex;flex-wrap:wrap;gap:14px 18px">{sw}</div></div>'
    h += note(24, 880, 1552, 'WHY GENERATED INSTEAD OF ONE BIG PAINTING', 'The trail tree is different every run, so a single painting can\'t line up with it. Generating the land from the tiles means the river really runs through the River tiles and the peaks sit on the Mountain tiles, which also makes the map a hint: you can read what\'s ahead from the land before you get there. A painted backdrop for each biome can still sit behind it all if we want more hand-made texture.', dark=True)
    h += '</div>' + foot(1600, 1000)
    write('MapLayers.dc.html', h)

# ------------------------------------------------------------------ board 6: ideas
def board_ideas():
    h = head('Illustrated map · more ideas')
    h += '<div style="position:relative;width:1600px;height:1000px;overflow:hidden;background:#1D2220">'
    h += '<span class="eu" style="position:absolute;left:24px;top:22px;font-size:20px;letter-spacing:.06em;color:#F7F1E4">MORE IDEAS FOR THE ILLUSTRATED MAP</span>'
    th = [('grade-night', 'NIGHT', 'The whole map shifts to moonlight blues, and tiles with a fire glow warm.'),
          ('grade-rain', 'RAIN', 'Colors cool and dull, with slanted rain over everything.'),
          ('grade-snow', 'SNOW', 'Open ground goes white while the woods stay dark.')]
    for i, (k, t1, t2) in enumerate(th):
        x = 24 + i * 522
        h += f'<div style="position:absolute;left:{x}px;top:66px;width:506px;display:flex;flex-direction:column;gap:6px"><img src="{BL(k)}" style="width:506px;height:316px;object-fit:cover;border-radius:10px"><span class="eu" style="font-size:13px;letter-spacing:.06em;color:#E9B44C">{t1}</span><span class="ds" style="font-size:13px;color:#C9C2B2">{t2}</span></div>'
    ideas = [('MAP STYLE SETTING', 'Settings → Map style: Classic or Illustrated. Both use the same tiles, paths and rules, so it\'s a pure look switch. Play is top-down; the tilted view is saved for a section-intro shot.'),
             ('PAINTED AS YOU EXPLORE', 'Unexplored land is a pencil sketch. When a tile is revealed (entering, Scout, the Overlook), the paint spreads out from it, like watercolor soaking into paper.'),
             ('OREGON PLACE NAMES', 'Ponds, lookouts, creeks, woods and meadows get names from places in Oregon ("Tumalo Pond", "Ochoco Lookout"), never repeating in a run. A name appears when the paint reaches it.'),
             ('THE LAND IS A HINT', 'Because the land is built from the nodes, you can guess what\'s ahead: woods mean Forest, a river means River. Unrevealed nodes still show as ?, so nothing is given away for free.'),
             ('CAMP LIFE ON THE MAP', 'Tents and a little fire appear where hikers sleep, shelters show as stamps on their tile, and smoke rises from a ranger station at the checkpoint.'),
             ('SEASONS BY BIOME', 'Meadow in late summer gold, the Rainforest deep and wet, Alpine in snow. Same generator, different palette and stamps.')]
    for i, (t1, t2) in enumerate(ideas):
        x = 24 + (i % 3) * 522; y = 470 + (i // 3) * 160
        h += note(x, y, 506, t1, t2)
    h += '</div>' + foot(1600, 1000)
    write('MapIdeas.dc.html', h)

def canvas():
    p = os.path.join(PROJ, 'canvas.json'); c = json.load(open(p))
    B = c['boards']
    B['MapTopDown.dc.html'] = {'x': 0, 'y': 15700, 'w': 1600, 'h': 1000, 'title': 'Phase 11 concept · illustrated map, top-down'}
    B['MapTilted.dc.html'] = {'x': 1680, 'y': 15700, 'w': 1600, 'h': 1000, 'title': "Phase 11 concept · illustrated map, tilted bird's-eye"}
    B['MapTileLooks.dc.html'] = {'x': 0, 'y': 16820, 'w': 1600, 'h': 1000, 'title': 'Phase 11 concept · tile looks (4 options)'}
    B['MapTrailLines.dc.html'] = {'x': 1680, 'y': 16820, 'w': 1600, 'h': 1000, 'title': 'Phase 11 concept · trail lines and route colors'}
    B['MapLayers.dc.html'] = {'x': 0, 'y': 17940, 'w': 1600, 'h': 1000, 'title': 'Phase 11 concept · how the map is drawn, stamp kit'}
    B['MapIdeas.dc.html'] = {'x': 1680, 'y': 17940, 'w': 1600, 'h': 1000, 'title': 'Phase 11 concept · more ideas'}
    json.dump(c, open(p, 'w'), indent=2)

if __name__ == '__main__':
    board_topdown(); board_tilted(); board_tiles(); board_lines(); board_layers(); board_ideas(); canvas()
    print('ok')
