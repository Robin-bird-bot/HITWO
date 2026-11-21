# Phase 11 concept: tilted bird's-eye render of the same generated terrain.
import json
from topo import *

PADX, PADT, PADB = 700, 170, 60          # 1x padding for the wider far view
HK = 235                       # height scale (px at 1x)

def proj(x, y, h):
    """world (1x) -> screen (1x)"""
    d = 1000 - y
    s = 1 / (1 + d / 1400)
    return 800 + (x - 800) * s, 990 - d * 1.16 * s - h * s, s

def main():
    # colour map without contours, with water + meadow detail
    base = np.stack([up(paint_base()[..., i]) for i in range(3)], -1)
    s_, buf = surf_from(base); ctx = cairo.Context(s_)
    draw_meadow_details(ctx); draw_water(ctx)
    cmap = surf_to_arr(s_, buf)
    cmap = cmap * (1 + grain(cmap.shape, 3) * .8)
    hmap = up((Hgt - Hgt.min()) * HK)
    fmask = up(forest, 0) > .5
    # darken forest floor (trees are drawn as sprites)
    cmap[fmask] = cmap[fmask] * 0.92
    # pad (reflect) so the far view is filled
    P = PADX * S; T = PADT * S
    B = PADB * S
    cmap = np.pad(cmap, ((T, B), (P, P), (0, 0)), mode='reflect')
    hmap = np.pad(hmap, ((T, B), (P, P)), mode='reflect')
    RH, RW = hmap.shape
    SW, SH = W * S, H * S
    wy = (np.arange(RH) - T) / S               # world y (1x) per row
    d = 1000 - wy
    sc = 1 / (1 + d / 1400)
    sxs = (np.arange(SW) / S)                  # screen x (1x)
    wx = 800 + (sxs[None, :] - 800) / sc[:, None]          # (RH, SW) world x
    ix = np.clip(np.round(wx * S + P).astype(np.int32), 0, RW - 1)
    hh = hmap[np.arange(RH)[:, None], ix]
    sy = (990 - d[:, None] * 1.16 * sc[:, None] - hh * sc[:, None]) * S   # screen y (2x)
    # visibility: scan from the near edge (last row) to the far edge
    syr = sy[::-1]
    M = np.minimum.accumulate(syr, axis=0)
    vis = np.full((SH, SW), -1, np.int32)
    ypix = np.arange(SH, dtype=float)
    for c in range(SW):
        idx = np.searchsorted(-M[:, c], -ypix, side='left')
        ok = idx < RH
        vis[ok, c] = RH - 1 - idx[ok]
    img = np.zeros((SH, SW, 3))
    ok = vis >= 0
    rows = vis[ok]; cols = np.nonzero(ok)[1]
    img[ok] = cmap[rows, ix[rows, cols]]
    # atmospheric haze with distance
    dist = np.zeros((SH, SW)); dist[ok] = d[rows]
    haze = np.clip((dist - 250) / 1100, 0, 1)[..., None] ** 1.3
    img = img * (1 - 0.55 * haze) + hx('#C9D7E3') * 0.55 * haze

    # sky
    yy = np.arange(SH)[:, None, None] / SH
    sky = hx('#86BBE0') * (1 - yy * 2.2).clip(0, 1) + hx('#EDE9D2') * (yy * 2.2).clip(0, 1)
    sky = np.broadcast_to(sky, img.shape).copy()
    s2, b2 = surf_from(sky); c = cairo.Context(s2)
    rr = random.Random(8)
    # far ranges: light from the left, shadow strip on right-facing slopes
    horizon = M.min() / S
    for li, (col, colS, base_y, amp, per) in enumerate([('#B9BFDB', '#9EA4CA', horizon + 30, 95, 210), ('#A3ACD2', '#878EBD', horizon + 40, 70, 150)]):
        pts = []; x = -40
        while x < W + 60:
            pts.append((x, base_y - amp * (0.3 + 0.7 * abs(math.sin(x / per + li * 2))) ** 1.2 - rr.uniform(0, 14)))
            x += rr.uniform(22, 48)
        def rng(dx=0, dy=0):
            c.move_to((-60 + dx) * S, (base_y + 300) * S)
            for p in pts: c.line_to((p[0] + dx) * S, (p[1] + dy) * S)
            c.line_to((W + 80 + dx) * S, (base_y + 300) * S); c.close_path()
        rgb(c, colS); rng(); c.fill()
        c.save(); rng(); c.clip(); rgb(c, col); rng(-15, 5); c.fill()
        # snow on the highest peaks
        for i in range(1, len(pts) - 1):
            if pts[i][1] < base_y - amp * .82 and pts[i][1] < pts[i - 1][1] and pts[i][1] < pts[i + 1][1]:
                rgb(c, '#F6F3EC', .95)
                c.move_to(pts[i][0] * S, pts[i][1] * S)
                c.line_to((pts[i][0] - 16) * S, (pts[i][1] + 14) * S); c.line_to((pts[i][0] - 6) * S, (pts[i][1] + 10) * S)
                c.line_to((pts[i][0] + 2) * S, (pts[i][1] + 16) * S); c.line_to((pts[i][0] + 10) * S, (pts[i][1] + 8) * S); c.close_path(); c.fill()
        c.restore()
    # clouds (flat bottoms, lit tops)
    for cx_, cy_, sz in [(230, 52, 1.0), (640, 30, .75), (1040, 60, 1.15), (1400, 36, .85)]:
        blobs = [(cx_ + rr.uniform(-55, 55) * sz, cy_ + rr.uniform(-12, 4) * sz, rr.uniform(14, 26) * sz) for _ in range(9)]
        c.save(); c.rectangle(0, 0, SW, (cy_ + 12 * sz) * S); c.clip()
        rgb(c, '#C9CCE2')
        for bx, by, br in blobs: c.arc(bx * S, (by + 4) * S, br * S, 0, 2 * math.pi); c.fill()
        rgb(c, '#FBF8F0')
        for bx, by, br in blobs: c.arc((bx - 4) * S, (by - 3) * S, br * .84 * S, 0, 2 * math.pi); c.fill()
        c.restore()
    sky = surf_to_arr(s2, b2)
    img[~ok] = sky[~ok]

    # trees as upright sprites
    s3, b3 = surf_from(img); c3 = cairo.Context(s3)
    cr = crowns(seed=3, step=10.5)
    trees = []
    for y, x, r, qq, u, v in cr:
        h = hmap[int(min(RH - 1, (y * S) + T)), int(x * S + P)]
        sx, syy, s = proj(x, y, h)
        trees.append((-(1000 - y), sx, syy, s, r, u, v, y))
    trees.sort()
    for _, sx, syy, s, r, u, v, wy_ in trees:
        X_, Y_ = int(sx * S), int(syy * S)
        if not (0 <= X_ < SW and 0 <= Y_ < SH): continue
        if vis[Y_, X_] >= 0 and abs(vis[Y_, X_] - (wy_ * S + T)) > 6 * S: continue   # hidden behind a ridge
        hgt = (r * 3.0 + 8) * s; wid = r * 1.5 * s
        hz = min(1, max(0, ((1000 - wy_) - 250) / 1100)) ** 1.3 * .55
        def mix(col):
            v_ = hx(col); return tuple(v_ * (1 - hz) + hx('#C9D7E3') * hz)
        con = u < .62
        if v < .16 and not con:
            pal = AUT[int(v * 100) % 3]; lt, mid, dk = pal[2], pal[1], pal[0]
        else:
            lt, mid, dk = ('#79A967', '#4E8A5E', '#2C5B50') if not con else ('#5E9566', '#3C7058', '#23463F')
        Xs, Ys = sx * S, syy * S; H_ = hgt * S; Wd = wid * S
        c3.set_source_rgba(0.11, 0.2, 0.24, .35)        # ground shadow
        c3.save(); c3.translate(Xs + Wd * .5, Ys); c3.scale(1, .32); c3.arc(0, 0, Wd * .9, 0, 2 * math.pi); c3.restore(); c3.fill()
        if con:
            for k in range(3):
                t0 = k / 3
                yb = Ys - H_ * (0.12 + 0.28 * k); yt = yb - H_ * .5; wb = Wd * (1 - .25 * k)
                c3.set_source_rgb(*mix(dk)); c3.move_to(Xs - wb, yb); c3.line_to(Xs, yt); c3.line_to(Xs + wb, yb); c3.close_path(); c3.fill()
                c3.set_source_rgb(*mix(lt)); c3.move_to(Xs - wb, yb); c3.line_to(Xs, yt); c3.line_to(Xs - wb * .05, yb + 1); c3.close_path(); c3.fill()
        else:
            c3.set_source_rgb(*mix('#5B4A3E')); c3.rectangle(Xs - Wd * .08, Ys - H_ * .35, Wd * .16, H_ * .35); c3.fill()
            c3.set_source_rgb(*mix(dk)); c3.arc(Xs, Ys - H_ * .62, Wd * .95, 0, 2 * math.pi); c3.fill()
            c3.set_source_rgb(*mix(mid)); c3.arc(Xs - Wd * .18, Ys - H_ * .68, Wd * .72, 0, 2 * math.pi); c3.fill()
            c3.set_source_rgb(*mix(lt)); c3.arc(Xs - Wd * .38, Ys - H_ * .8, Wd * .34, 0, 2 * math.pi); c3.fill()
    img = surf_to_arr(s3, b3)
    img = img * (1 + grain(img.shape, 6) * .7)
    to_img(img).save(os.path.join(OUT, 'tilted.webp'), quality=88, method=5)
    to_img(img).resize((1600, 1000), Image.LANCZOS).save(os.path.join(OUT, 'prev-tilted.jpg'), quality=88)

    # projected tile + path geometry for the board overlay (1x)
    def H_at(x, y):
        return float(hmap[int(min(RH - 1, max(0, y * S + T))), int(min(RW - 1, max(0, x * S + P)))])
    geo = {'tiles': {}, 'paths': []}
    for k, t in TILES.items():
        h = H_at(t['x'], t['y'])
        cx_, cy_, s = proj(t['x'], t['y'], h)
        R = 54 * t['s']
        hexp = []
        for i in range(6):
            a = math.pi / 6 + i * math.pi / 3
            px, py, _ = proj(t['x'] + R * math.cos(a), t['y'] + R * math.sin(a), h)
            hexp.append((round(px, 1), round(py, 1)))
        geo['tiles'][k] = dict(x=round(cx_, 1), y=round(cy_, 1), s=round(s, 3), hex=hexp)
    for p in PATHS:
        pts = [proj(x, y, H_at(x, y) + 2)[:2] for x, y in p['pts']]
        geo['paths'].append(dict(a=p['a'], b=p['b'], pts=[(round(x, 1), round(y, 1)) for x, y in pts]))
    json.dump(geo, open(os.path.join(OUT, 'tilt-geo.json'), 'w'))
    print('tilt done')

if __name__ == '__main__':
    main()
