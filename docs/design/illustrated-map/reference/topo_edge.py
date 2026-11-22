# Map edge mockups: the map as a sheet of paper on a wooden table, and the cloud alternative.
import os, math
import numpy as np, opensimplex
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage
OUT = os.path.join(os.path.dirname(__file__), '..', 'topo')
W, H = 1600, 1000
CORNERS = True

def fbm(w, h, scale, oct=4, seed=0, sx=1.0, sy=1.0):
    opensimplex.seed(seed)
    tot = np.zeros((h, w)); amp = 1; f = 1 / scale; norm = 0
    for o in range(oct):
        step = max(1, int(scale / (8 * 2 ** o)))
        cx = np.arange(0, w + step, step, dtype=float); cy = np.arange(0, h + step, step, dtype=float)
        n = opensimplex.noise2array(cx * f * sx, cy * f * sy)
        n = ndimage.zoom(n, step, order=1)[:h, :w]
        tot += amp * n; norm += amp; amp *= .5; f *= 2
    return tot / norm

def hx(c):
    c = c.lstrip('#'); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], float) / 255

def wood(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    plank_h = 118
    pid = (yy // plank_h).astype(int)
    rs = np.random.RandomState(3)
    tints = rs.uniform(-.06, .06, pid.max() + 2)
    offs = rs.uniform(0, 4000, pid.max() + 2)
    grain = fbm(w, h, 260, 4, 5, sx=0.08, sy=1.0)
    fine = fbm(w, h, 30, 3, 6, sx=0.05, sy=1.0)
    rings = np.sin((yy + grain * 90) / 7.0) * .5 + .5
    base = hx('#8A5B3B') * (1 + tints[pid])[..., None]
    col = base * (0.86 + 0.14 * rings[..., None]) * (1 + 0.10 * fine[..., None])
    seam = (yy % plank_h) < 2.2
    col[seam] = col[seam] * 0.55
    # plank end joints
    for p in range(pid.max() + 1):
        x = int((offs[p] % 900) + 300)
        col[p * plank_h:(p + 1) * plank_h, x:x + 2] *= .6
    vig = 1 - 0.35 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    col = col * np.clip(vig, .5, 1)[..., None]
    # warm light from top left
    col = col * (1 + 0.10 * (1 - (xx / w + yy / h) / 2))[..., None]
    return np.clip(col, 0, 1)

def sheet_rgba(map_img, sw, sh, margin=26):
    """Cream paper sheet with the map printed inside, a double neat line and a deckled edge."""
    paper = np.ones((sh, sw, 3)) * hx('#EFE6CC')
    g = np.random.RandomState(4).normal(0, 1, (sh, sw)); g = ndimage.gaussian_filter(g, .8)
    paper = paper * (1 + 0.03 * g)[..., None]
    im = Image.fromarray((np.clip(paper, 0, 1) * 255).astype(np.uint8))
    m = map_img.resize((sw - 2 * margin, sh - 2 * margin), Image.LANCZOS)
    im.paste(m, (margin, margin))
    d = ImageDraw.Draw(im)
    if CORNERS:
        from PIL import ImageFont
        F = os.path.join(os.path.dirname(__file__), '..', 'ui2', 'editundo.ttf')
        ink = (29, 34, 32); cream = (244, 237, 218); grey = (94, 86, 72)
        # section cartouche, bottom left, printed on the land
        bx, by, bw, bh = margin + 18, sh - margin - 18 - 74, 168, 74
        d.rectangle([bx, by, bx + bw, by + bh], fill=cream, outline=ink, width=2)
        d.rectangle([bx + 4, by + 4, bx + bw - 4, by + bh - 4], outline=ink, width=1)
        f1 = ImageFont.truetype(F, 22); f2 = ImageFont.truetype(F, 9)
        d.text((bx + bw / 2, by + 22), 'MEADOW', font=f1, fill=ink, anchor='mm')
        d.text((bx + bw / 2, by + 42), 'SECTION I · TIER I', font=f2, fill=grey, anchor='mm')
        for i in range(3):
            d.rectangle([bx + 34 + i * 34, by + 55, bx + 34 + (i + 1) * 34, by + 60], fill=ink if i % 2 == 0 else cream, outline=ink)
        # compass rose, top right
        cx, cy, R = sw - margin - 62, margin + 64, 40
        d.ellipse([cx - R * .7, cy - R * .7, cx + R * .7, cy + R * .7], outline=ink, width=1)
        for ang in range(0, 360, 90):
            a_ = math.radians(ang)
            tip = (cx + R * math.sin(a_), cy - R * math.cos(a_))
            l = (cx + 8 * math.sin(a_ - math.pi / 2), cy - 8 * math.cos(a_ - math.pi / 2))
            r = (cx + 8 * math.sin(a_ + math.pi / 2), cy - 8 * math.cos(a_ + math.pi / 2))
            d.polygon([tip, l, (cx, cy)], fill=cream, outline=ink); d.polygon([tip, r, (cx, cy)], fill=ink)
        for ang in range(45, 360, 90):
            a_ = math.radians(ang)
            tip = (cx + R * .55 * math.sin(a_), cy - R * .55 * math.cos(a_))
            l = (cx + 5 * math.sin(a_ - math.pi / 2), cy - 5 * math.cos(a_ - math.pi / 2))
            r = (cx + 5 * math.sin(a_ + math.pi / 2), cy - 5 * math.cos(a_ + math.pi / 2))
            d.polygon([tip, l, (cx, cy)], fill=cream, outline=ink); d.polygon([tip, r, (cx, cy)], fill=ink)
        d.text((cx, cy - R - 10), 'N', font=ImageFont.truetype(F, 14), fill=ink, anchor='mm', stroke_width=2, stroke_fill=cream)
    for inset, wdt in ((margin - 7, 2), (margin - 12, 1)):
        d.rectangle([inset, inset, sw - inset - 1, sh - inset - 1], outline=(94, 86, 72), width=wdt)
    d.rectangle([margin, margin, sw - margin - 1, sh - margin - 1], outline=(94, 86, 72), width=1)
    # deckled edge alpha
    yy, xx = np.mgrid[0:sh, 0:sw].astype(float)
    dist = np.minimum.reduce([xx, yy, sw - 1 - xx, sh - 1 - yy])
    n = fbm(sw, sh, 14, 2, 9)
    alpha = np.clip((dist - 2.5 - 2.2 * n) / 1.5, 0, 1)
    # slight curl shading at corners and fold lines
    shade = np.ones((sh, sw))
    for fx in (sw / 3, 2 * sw / 3):
        shade *= 1 - 0.05 * np.exp(-((xx - fx) / 3) ** 2)
    shade *= 1 - 0.035 * np.exp(-((yy - sh / 2) / 3) ** 2)
    arr = np.asarray(im).astype(float) / 255 * shade[..., None]
    rgba = np.dstack([arr, alpha])
    return rgba

def compose_table():
    mp = Image.open(os.path.join(OUT, 'topdown-reveal.webp')).convert('RGB')
    tab = wood(W, H)
    sw, sh = 1210, 770
    sheet = sheet_rgba(mp, sw, sh)
    s_img = Image.fromarray((sheet * 255).astype(np.uint8), 'RGBA').rotate(-1.2, resample=Image.BICUBIC, expand=True)
    ox, oy = (W - s_img.width) // 2, (H - s_img.height) // 2 + 6
    # shadow
    a = np.zeros((H, W)); al = np.asarray(s_img)[..., 3] / 255
    a[oy + 14:oy + 14 + s_img.height, ox + 10:ox + 10 + s_img.width] = al
    a = ndimage.gaussian_filter(a, 14) * .55
    tab = tab * (1 - a[..., None])
    base = Image.fromarray((tab * 255).astype(np.uint8)).convert('RGBA')
    base.alpha_composite(s_img, (ox, oy))
    out = base.convert('RGB')
    out.save(os.path.join(OUT, 'edge-table.jpg'), quality=90)
    return out

def compose_clouds():
    mp = Image.open(os.path.join(OUT, 'topdown-painted.webp')).convert('RGB').resize((1240, 775), Image.LANCZOS)
    canvas = np.ones((H, W, 3)) * hx('#DCE6EC')
    ox, oy = (W - 1240) // 2, (H - 775) // 2
    canvas[oy:oy + 775, ox:ox + 1240] = np.asarray(mp) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    dx = np.maximum(0, np.maximum(ox + 90 - xx, xx - (ox + 1240 - 90)))
    dy = np.maximum(0, np.maximum(oy + 90 - yy, yy - (oy + 775 - 90)))
    d = np.hypot(dx, dy)
    n = fbm(W, H, 160, 5, 12) * .5 + .5
    cl = np.clip((d - 15 + 90 * (n - .5)) / 70, 0, 1) ** 0.8
    cloud_col = hx('#F6F4EE') * (0.92 + 0.08 * n[..., None]) - 0.06 * (1 - n[..., None]) * hx('#7E86A8')
    out = canvas * (1 - cl[..., None]) + cloud_col * cl[..., None]
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, 'edge-clouds.jpg'), quality=90)

if __name__ == '__main__':
    compose_table(); compose_clouds(); print('ok')
