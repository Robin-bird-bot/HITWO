# Phase 11 concept: painted top-down trail map generated around the trail tree.
import math, random, sys, os
import numpy as np, cairo, opensimplex
from scipy import ndimage
from skimage import measure
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from topo_layout import *

OUT = os.path.join(os.path.dirname(__file__), '..', 'topo')
os.makedirs(OUT, exist_ok=True)
S = 2                      # render scale
GW, GH = W, H              # field grid (1x)
opensimplex.seed(7)
xs = np.arange(GW, dtype=float); ys = np.arange(GH, dtype=float)
X, Y = np.meshgrid(xs, ys)

def fbm(scale, oct=4, seed=0):
    opensimplex.seed(seed)
    tot = np.zeros((GH, GW)); amp = 1; f = 1 / scale; norm = 0
    for o in range(oct):
        # compute on a coarse grid then zoom for speed
        step = max(1, int(scale / (8 * 2 ** o)))
        cx = np.arange(0, GW + step, step, dtype=float); cy = np.arange(0, GH + step, step, dtype=float)
        n = opensimplex.noise2array(cx * f, cy * f)
        n = ndimage.zoom(n, step, order=1)[:GH, :GW]
        tot += amp * n; norm += amp; amp *= .5; f *= 2
    return tot / norm

def hx(c):
    c = c.lstrip('#'); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], float) / 255

def gauss(cx, cy, s):
    return np.exp(-((X - cx) ** 2 + (Y - cy) ** 2) / (2 * s * s))

def poly_mask(pts, width):
    im = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(im)
    d.line(pts, fill=255, width=width, joint='curve'); return np.array(im) > 0

# ---------------------------------------------------------------- fields
def smooth_pts(pts, n=12):
    """Catmull-Rom through pts."""
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
    out.append(pts[-1]); return out

def meander(pts, amp, seed):
    rr = random.Random(seed); ph = [rr.uniform(0, 6) for _ in range(3)]
    out = []; acc = 0
    for i in range(len(pts)):
        p0 = pts[max(0, i - 1)]; p1 = pts[min(len(pts) - 1, i + 1)]
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]; l = math.hypot(dx, dy) or 1
        if i: acc += math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        o = amp * (math.sin(acc / 37 + ph[0]) * .6 + math.sin(acc / 17 + ph[1]) * .3 + math.sin(acc / 9 + ph[2]) * .1)
        out.append((pts[i][0] - dy / l * o, pts[i][1] + dx / l * o))
    return out
RIV = meander(smooth_pts(RIVER, 16), 7, 1); CRK = meander(smooth_pts(CREEK + [], 20), 6, 2)
riv_d = ndimage.distance_transform_edt(~poly_mask(RIV, 2))
crk_d = ndimage.distance_transform_edt(~poly_mask(CRK, 2))
lcx, lcy, lrx, lry = LAKE
lake_n = fbm(60, 2, 5)
lake = (((X - lcx) / lrx) ** 2 + ((Y - lcy) / lry) ** 2) < (1 + 0.35 * lake_n)
lake_d = ndimage.distance_transform_edt(~lake)
water_d = np.minimum(np.minimum(riv_d, crk_d * 1.6), lake_d)

n1 = fbm(260, 5, 1); n2 = fbm(90, 4, 2); n3 = fbm(30, 3, 3)
mtn = np.zeros((GH, GW)); fst = np.zeros((GH, GW)); mdw = np.zeros((GH, GW))
for t in TILES.values():
    mtn += t['nodes'].count('M') * gauss(t['x'] + 40, t['y'] - 30, 120)
    fst += t['nodes'].count('F') * gauss(t['x'], t['y'], 115)
    mdw += (t['nodes'].count('W') + (1.3 if t['k'] in 'AD' else 0)) * gauss(t['x'], t['y'], 95)
# off-tree land: big ranges on the far left/top, forests around
mtn += 1.6 * gauss(150, 120, 190) + 1.2 * gauss(1500, 220, 170) + 0.8 * gauss(330, 540, 140)
peak = np.zeros((GH, GW))
for t in TILES.values():
    for j in range(t['nodes'].count('M')):
        peak += gauss(t['x'] + 70 - 120 * j, t['y'] - 45 + 20 * j, 62)
peak += 1.5 * gauss(120, 110, 150) + 1.2 * gauss(1520, 210, 120) + 0.7 * gauss(300, 520, 85)
fst += 0.9 * gauss(260, 760, 220) + 0.8 * gauss(1380, 620, 200) + 0.6 * gauss(1350, 930, 160)
mdw += 0.7 * gauss(1180, 960, 170) + 0.5 * gauss(150, 960, 160)

Hgt = 0.45 * (1 - Y / GH) + 0.16 * mtn + 0.30 * peak * (0.8 + 0.4 * (n2 + 1) / 2) + 0.16 * n1 + 0.025 * n2
Hgt -= 0.10 * np.exp(-(riv_d / 70) ** 2) + 0.05 * np.exp(-(crk_d / 40) ** 2)
Hgt = ndimage.gaussian_filter(Hgt, 2)

# hillshade
gy, gx = np.gradient(ndimage.gaussian_filter(Hgt, 5) * 300)
L = np.array([-0.62, -0.62, 0.48]); L /= np.linalg.norm(L)
nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
shade = (-gx * L[0] - gy * L[1] + L[2]) * nz          # 0..1
shade = ndimage.gaussian_filter(shade, 2.5)
q = np.digitize(shade, np.quantile(shade, [0.12, 0.42, 0.84]))   # 0 shadow .. 3 highlight
q = ndimage.median_filter(q, 7)
slope = np.sqrt(gx ** 2 + gy ** 2)

rock = (peak + 0.35 * n2 + 0.15 * n3 > 0.62)
forest_f = fst * 0.85 - mdw * 1.3 - peak * 0.5 + 0.40 * n2 + 0.12 * n3 + 0.12 + 0.25 * n1
forest = (forest_f > 0.32) & ~rock & (water_d > 9)
bank = (water_d <= 6) & (water_d > 0)
water = (riv_d < 6.5 + 2.5 * (n3 > 0)) | (crk_d < 3.2) | lake
# tiles sit in small clearings so the land reads under them
clear = np.zeros((GH, GW), bool)
for t in TILES.values():
    clear |= ((X - t['x']) ** 2 + (Y - t['y']) ** 2) < (36 * t['s']) ** 2
forest &= ~clear

def up(a, order=1):
    return ndimage.zoom(a.astype(float), S, order=order)

PAL = {
 'meadowA': ['#86A066', '#AEBB63', '#D3CF77', '#ECE29B'],   # shadow..highlight
 'meadowB': ['#829E68', '#A6BC6A', '#CBD283', '#E6E4A3'],
 'floor':   ['#264B4A', '#2F5B4D', '#3A6A50', '#477954'],
 'rock':    ['#7F6890', '#B77B7E', '#DDA286', '#F4D6B5'],
 'bank':    ['#C9B98E', '#DCCB9A', '#E9DAAA', '#F3E6BE'],
}
def classify(qq, cls_mask, pal):
    out = np.zeros(qq.shape + (3,))
    for i in range(4):
        out[qq == i] = hx(pal[i])
    return out

def paint_base(flat=False):
    qq = np.full_like(q, 2) if flat else q
    meadow_mix = (fbm(140, 3, 9) > 0.05)
    base = np.where(meadow_mix[..., None], classify(qq, None, PAL['meadowA']), classify(qq, None, PAL['meadowB']))
    base = np.where(forest[..., None], classify(qq, None, PAL['floor']), base)
    base = np.where(rock[..., None], classify(qq, None, PAL['rock']), base)
    base = np.where(bank[..., None], classify(qq, None, PAL['bank']), base)
    # elevation tint: higher land a touch cooler and lighter (atmosphere)
    e = np.clip((Hgt - Hgt.min()) / (Hgt.max() - Hgt.min()), 0, 1)[..., None]
    base = base * (1 - 0.10 * e) + hx('#C9D6E8') * 0.10 * e
    return base

def to_img(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))

# ---------------------------------------------------------------- cairo helpers
def surf_from(arr):
    im = to_img(arr).convert('RGBA')
    b = np.array(im)[..., [2, 1, 0, 3]].copy()
    s = cairo.ImageSurface.create_for_data(memoryview(b), cairo.FORMAT_ARGB32, im.width, im.height)
    return s, b

def surf_to_arr(s, buf):
    s.flush()
    a = np.frombuffer(s.get_data(), np.uint8).reshape(s.get_height(), s.get_width(), 4)
    return a[..., [2, 1, 0]].astype(float) / 255

def rgb(ctx, c, a=1):
    v = hx(c); ctx.set_source_rgba(v[0], v[1], v[2], a)

def path_curve(ctx, pts):
    ctx.move_to(pts[0][0] * S, pts[0][1] * S)
    for p in pts[1:]:
        ctx.line_to(p[0] * S, p[1] * S)

def draw_contours(ctx, color, alpha, w, every=5, skip_water=True, sketch=False):
    lv = np.linspace(Hgt.min() + 0.02, Hgt.max() - 0.02, 26)
    hsm = ndimage.gaussian_filter(Hgt, 3)
    for i, l in enumerate(lv):
        for c in measure.find_contours(hsm, l):
            if len(c) < 30: continue
            major = i % every == 0
            rgb(ctx, color, alpha * (1.6 if major else 1))
            ctx.set_line_width(w * (1.7 if major else 1) * S)
            ctx.move_to(c[0][1] * S, c[0][0] * S)
            for r_, c_ in c[1::2]:
                ctx.line_to(c_ * S, r_ * S)
            ctx.stroke()

def draw_water(ctx, sketch=False):
    ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    lake_poly = []
    for a in np.linspace(0, 2 * math.pi, 90):
        r = 1 + 0.17 * math.sin(3 * a + 1) + 0.08 * math.sin(7 * a)
        lake_poly.append((lcx + lrx * r * math.cos(a), lcy + lry * r * math.sin(a)))
    def stroke_all(w_r, w_c, col, a):
        rgb(ctx, col, a)
        for i in range(len(RIV) - 1):
            k = 1 + 0.28 * math.sin(i * 0.11) + 0.12 * math.sin(i * 0.37 + 1) + 0.25 * (i / len(RIV))
            ctx.set_line_width(w_r * k * S)
            ctx.move_to(RIV[i][0] * S, RIV[i][1] * S); ctx.line_to(RIV[i + 1][0] * S, RIV[i + 1][1] * S); ctx.stroke()
        ctx.set_line_width(w_c * S); path_curve(ctx, CRK); ctx.stroke()
        path_curve(ctx, lake_poly); ctx.close_path(); ctx.fill_preserve(); ctx.set_line_width((w_r - 12) * S); ctx.stroke()
    if sketch:
        stroke_all(16, 9, '#6F8088', 0.75)
        stroke_all(13, 6.5, '#EEE6CF', 1)
        rgb(ctx, '#8FA6AC', .35); ctx.set_line_width(1.2 * S)
        for o in (-3, 3):
            path_curve(ctx, [(x + o * .3, y + o) for x, y in RIV[::2]]); ctx.stroke()
        return
    stroke_all(22, 12, '#E7D9A9', 1)     # sand bank
    stroke_all(17, 9, '#9FDCD2', 1)      # shallows
    stroke_all(12.5, 6, '#4BB0C1', 1)    # water
    rgb(ctx, '#3A92AA', 1); ctx.set_line_width(4.5 * S); path_curve(ctx, RIV[3:-3]); ctx.stroke()
    # lake depth
    rgb(ctx, '#3A92AA', 1)
    path_curve(ctx, [(lcx + (x - lcx) * .62, lcy + (y - lcy) * .58) for x, y in lake_poly]); ctx.close_path(); ctx.fill()
    # sparkles / current strokes
    rr = random.Random(4)
    rgb(ctx, '#D6F5EE', 0.9)
    for pts, step in ((RIV, 5), (CRK, 7)):
        for i in range(2, len(pts) - 3, step):
            if rr.random() < .16:
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]
                o = rr.choice([-1, 1]) * rr.uniform(2.5, 3.5)
                ctx.set_line_width(rr.uniform(1.2, 2.2) * S)
                ctx.move_to((x0 + o) * S, (y0 + o) * S); ctx.line_to((x1 + o) * S, (y1 + o) * S); ctx.stroke()
    for i in range(14):
        a = rr.uniform(0, 2 * math.pi); rad = rr.uniform(.2, .8)
        x = lcx + lrx * rad * math.cos(a); y = lcy + lry * rad * math.sin(a)
        ctx.set_line_width(1.6 * S); ctx.move_to((x - 6) * S, y * S); ctx.line_to((x + 6) * S, y * S); ctx.stroke()

FOREST_T = ['#2E5F52', '#3F7A5C', '#5A9663', '#7EB06A']
AUT = [('#9A5A3A', '#C47E47', '#E2AE6C'), ('#A3863C', '#CDAA52', '#E8CE84'), ('#94503F', '#B86A51', '#D79274')]
AUTN = fbm(80, 3, 31)
def crowns(seed=3, step=11, sketch=False):
    rr = random.Random(seed); out = []
    for gy_ in np.arange(0, GH, step):
        for gx_ in np.arange(0, GW, step):
            x = gx_ + rr.uniform(-3.5, 3.5); y = gy_ + rr.uniform(-3.5, 3.5)
            ix, iy = int(min(GW - 1, max(0, x))), int(min(GH - 1, max(0, y)))
            if not forest[iy, ix]: continue
            r = rr.uniform(6.2, 9.4)
            v = rr.random() * (0.2 if AUTN[iy, ix] > 0.12 else 99)
            out.append((y, x, r, q[iy, ix], rr.random(), v))
    out.sort()
    return out

def draw_crowns(ctx, cr, sketch=False):
    for y, x, r, qq, u, v in cr:
        X_, Y_, R = x * S, y * S, r * S
        if sketch:
            if u < .72: continue
            rgb(ctx, '#7D7766', .42); ctx.set_line_width(1 * S)
            ctx.arc(X_, Y_ - R * .2, R * .55, math.pi * .85, math.pi * 2.15); ctx.stroke()
            ctx.move_to(X_, Y_ + R * .35); ctx.line_to(X_, Y_ + R * .9); ctx.stroke(); continue
        con = u < .42
        rgb(ctx, '#1D3A45', .55)
        ctx.arc(X_ + R * .38, Y_ + R * .5, R, 0, 2 * math.pi); ctx.fill()
        if v < .16 and not con:
            pal = AUT[int(v * 100) % 3]; base, hi = pal[1], pal[2]; dk = pal[0]
        else:
            idx = min(3, max(0, int(qq)))
            base = FOREST_T[max(0, idx - (1 if con else 0))]; hi = FOREST_T[min(3, idx + 1)]; dk = FOREST_T[max(0, idx - 1)]
        if con:
            k = 8; pts = []
            for i in range(k * 2):
                a = i * math.pi / k + u * 3
                rad = R * (1.05 if i % 2 == 0 else .62)
                pts.append((X_ + rad * math.cos(a), Y_ + rad * math.sin(a)))
            rgb(ctx, dk); ctx.move_to(*pts[0]); [ctx.line_to(*p) for p in pts[1:]]; ctx.close_path(); ctx.fill()
            rgb(ctx, base); ctx.arc(X_ - R * .12, Y_ - R * .14, R * .58, 0, 2 * math.pi); ctx.fill()
            rgb(ctx, hi, .9); ctx.arc(X_ - R * .25, Y_ - R * .3, R * .28, 0, 2 * math.pi); ctx.fill()
        else:
            rgb(ctx, dk); ctx.arc(X_, Y_, R, 0, 2 * math.pi); ctx.fill()
            rgb(ctx, base); ctx.arc(X_ - R * .16, Y_ - R * .18, R * .78, 0, 2 * math.pi); ctx.fill()
            rgb(ctx, hi, .9); ctx.arc(X_ - R * .34, Y_ - R * .38, R * .36, 0, 2 * math.pi); ctx.fill()

def draw_meadow_details(ctx, seed=5):
    rr = random.Random(seed)
    nf = fbm(40, 2, 12)
    for i in range(5200):
        x = rr.uniform(0, GW); y = rr.uniform(0, GH)
        ix, iy = int(x), int(y)
        if forest[iy, ix] or rock[iy, ix] or water_d[iy, ix] < 8 or clear[iy, ix]: continue
        if nf[iy, ix] > 0.18:
            rgb(ctx, rr.choice(['#FFF7E2', '#F4A9BB', '#F7D45E', '#C9A2E6']), .95)
            ctx.arc(x * S, y * S, rr.uniform(.9, 1.5) * S, 0, 2 * math.pi); ctx.fill()
        elif rr.random() < .35:
            rgb(ctx, '#6F8F55', .55); ctx.set_line_width(.9 * S)
            ctx.move_to(x * S, y * S); ctx.line_to((x + rr.uniform(-1.5, 1.5)) * S, (y - rr.uniform(2.5, 4.5)) * S); ctx.stroke()
    # rock cracks / strata on mountains
    for i in range(2600):
        x = rr.uniform(0, GW); y = rr.uniform(0, GH)
        if not rock[int(y), int(x)]: continue
        rgb(ctx, '#7F6890', .35 if q[int(y), int(x)] > 1 else .5); ctx.set_line_width(1 * S)
        a = rr.uniform(-.5, .5) - 0.6
        l = rr.uniform(4, 10)
        ctx.move_to(x * S, y * S); ctx.line_to((x + l * math.cos(a)) * S, (y + l * math.sin(a)) * S); ctx.stroke()

# ---------------------------------------------------------------- texture
def grain(shape, seed=1):
    rs = np.random.RandomState(seed)
    g = rs.normal(0, 1, shape[:2]); g = ndimage.gaussian_filter(g, .7)
    streak = ndimage.gaussian_filter(rs.normal(0, 1, shape[:2]), (0.6, 6))   # brushy horizontal streaks
    return (g * 0.022 + streak * 0.05)[..., None]

def paper(shape):
    p = np.ones(shape) * hx('#EEE5CB')
    return p * (1 + grain(shape, 9) * .9)

# ---------------------------------------------------------------- build
def build():
    stages = {}
    base = up(paint_base()[..., 0]), up(paint_base()[..., 1]), up(paint_base()[..., 2])
    base = np.stack(base, -1)
    flat = np.stack([up(paint_base(True)[..., i]) for i in range(3)], -1)
    stages['2-land'] = flat.copy()
    stages['3-relief'] = base.copy()

    # painted map
    s, buf = surf_from(base); ctx = cairo.Context(s)
    draw_contours(ctx, '#F7EFD8', .30, .9)
    draw_meadow_details(ctx)
    draw_water(ctx)
    st4 = surf_to_arr(s, buf).copy(); stages['4-water'] = st4
    cr = crowns()
    draw_crowns(ctx, cr)
    painted = surf_to_arr(s, buf)
    painted = painted * (1 + grain(painted.shape, 2))
    # warm light wash top-left, cool shadow bottom-right
    yy, xx = np.mgrid[0:H * S, 0:W * S] / (H * S)
    wash = (0.05 * (1 - xx / 1.6 - yy) )[..., None]
    painted = painted + wash * hx('#FFE3A8') - 0.04 * np.clip(xx / 1.6 + yy - 1, 0, 1)[..., None]
    stages['5-forest'] = painted.copy()

    # sketch map (unexplored)
    sk = paper(painted.shape)
    s2, b2 = surf_from(sk); c2 = cairo.Context(s2)
    draw_contours(c2, '#857B68', .30, .8)
    draw_water(c2, sketch=True)
    draw_crowns(c2, cr, sketch=True)
    sketch = surf_to_arr(s2, b2)
    # pencil hatching in shadows
    hy, hxg = np.mgrid[0:H * S, 0:W * S]
    shadow2 = up((q == 0) | ((q == 1) & rock), 0) > .5
    hatch = ((hxg + hy) % 10 < 1.6) & shadow2
    sketch[hatch] = sketch[hatch] * .82
    sketch = sketch * (1 + grain(sketch.shape, 4) * .6)
    stages['1-sketch'] = sketch.copy()

    # reveal mask
    m = np.zeros((GH, GW))
    for k in REVEALED:
        t = TILES[k]; m = np.maximum(m, 1 - np.clip((np.hypot(X - t['x'], Y - t['y']) - 150) / 70, 0, 1))
    m = np.maximum(m, 1 - np.clip((np.hypot((X - 800) / 2.2, Y - 1010) - 120) / 70, 0, 1))
    m = ndimage.gaussian_filter(m, 6) + 0.22 * fbm(45, 3, 21)
    m = np.clip((m - 0.45) / 0.10, 0, 1)
    M2 = up(m)[..., None]
    rim = np.clip(1 - np.abs(M2 - 0.55) / 0.25, 0, 1) * 0.16
    reveal = sketch * (1 - M2) + painted * M2 * (1 - rim)
    return painted, sketch, reveal, stages

def save(arr, name, q_=88):
    im = to_img(arr)
    im.save(os.path.join(OUT, name + '.webp'), quality=q_, method=5)
    return im

if __name__ == '__main__':
    painted, sketch, reveal, stages = build()
    save(painted, 'topdown-painted'); save(reveal, 'topdown-reveal'); save(sketch, 'topdown-sketch')
    for k, v in stages.items():
        to_img(v).resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(OUT, 'stage-' + k + '.webp'), quality=86)
    to_img(painted).resize((1600, 1000), Image.LANCZOS).save(os.path.join(OUT, 'prev-painted.jpg'), quality=88)
    to_img(reveal).resize((1600, 1000), Image.LANCZOS).save(os.path.join(OUT, 'prev-reveal.jpg'), quality=88)
    np.save(os.path.join(OUT, 'height.npy'), Hgt)
    print('done')
