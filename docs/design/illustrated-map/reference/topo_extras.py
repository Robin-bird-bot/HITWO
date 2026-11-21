# Stamp kit placeholders + time-of-day / weather grades of the top-down map.
import os, math, random
import numpy as np, cairo
from PIL import Image, ImageFilter
from scipy import ndimage
OUT = os.path.join(os.path.dirname(__file__), '..', 'topo')

def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
def rgb(c, col, a=1):
    v = hx(col); c.set_source_rgba(v[0], v[1], v[2], a)

# ------------------------------------------------------------ stamps (placeholders Wyatt will replace)
CELL = 220
NAMES = ['Conifer', 'Leafy tree', 'Autumn tree', 'Bush', 'Rock outcrop', 'Peak', 'Cabin', 'Fire lookout', 'Bridge', 'Tent', 'Deer', 'Waterfall']
def stamps():
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, CELL * 6, CELL * 2); c = cairo.Context(s)
    def shadow(x, y, w):
        c.set_source_rgba(0.11, 0.2, 0.24, .28); c.save(); c.translate(x + 8, y); c.scale(1, .3); c.arc(0, 0, w, 0, 2 * math.pi); c.restore(); c.fill()
    def conifer(x, y, h, lt='#6EA36C', dk='#2C5B50', mid='#3F7458'):
        shadow(x, y, h * .32)
        rgb(c, '#5B4A3E'); c.rectangle(x - 4, y - h * .14, 8, h * .14); c.fill()
        for k in range(4):
            yb = y - h * (.1 + .22 * k); yt = yb - h * .38; wb = h * (.3 - .055 * k)
            rgb(c, dk); c.move_to(x - wb, yb); c.line_to(x, yt); c.line_to(x + wb, yb); c.close_path(); c.fill()
            rgb(c, lt); c.move_to(x - wb, yb); c.line_to(x, yt); c.line_to(x - wb * .1, yb); c.close_path(); c.fill()
    def leafy(x, y, h, lt, mid, dk):
        shadow(x, y, h * .34)
        rgb(c, '#5B4A3E'); c.rectangle(x - 5, y - h * .4, 10, h * .4); c.fill()
        for (dx, dy, r, col) in [(0, -.62, .34, dk), (-.16, -.7, .26, mid), (.14, -.55, .22, dk), (-.2, -.78, .14, lt), (-.05, -.86, .12, lt)]:
            rgb(c, col); c.arc(x + dx * h, y + dy * h, r * h, 0, 2 * math.pi); c.fill()
    def rock(x, y, w):
        shadow(x, y, w * .6)
        pts = [(-.6, 0), (-.45, -.45), (-.1, -.7), (.3, -.55), (.6, -.2), (.55, 0)]
        rgb(c, '#86698C'); c.move_to(x + pts[0][0] * w, y + pts[0][1] * w)
        for p in pts[1:]: c.line_to(x + p[0] * w, y + p[1] * w)
        c.close_path(); c.fill()
        rgb(c, '#DDA286'); c.move_to(x - .6 * w, y); c.line_to(x - .45 * w, y - .45 * w); c.line_to(x - .1 * w, y - .7 * w); c.line_to(x + .02 * w, y - .2 * w); c.close_path(); c.fill()
        rgb(c, '#F4D6B5'); c.move_to(x - .45 * w, y - .45 * w); c.line_to(x - .1 * w, y - .7 * w); c.line_to(x - .2 * w, y - .4 * w); c.close_path(); c.fill()
    def peak(x, y, w):
        rgb(c, '#7F6890'); c.move_to(x - w, y); c.line_to(x - .1 * w, y - 1.3 * w); c.line_to(x + w, y); c.close_path(); c.fill()
        rgb(c, '#C88C82'); c.move_to(x - w, y); c.line_to(x - .1 * w, y - 1.3 * w); c.line_to(x - .05 * w, y); c.close_path(); c.fill()
        rgb(c, '#F6F3EC'); c.move_to(x - .1 * w, y - 1.3 * w); c.line_to(x - .42 * w, y - .85 * w); c.line_to(x - .22 * w, y - .9 * w); c.line_to(x - .08 * w, y - .78 * w); c.line_to(x + .2 * w, y - .9 * w); c.close_path(); c.fill()
    def cabin(x, y, w):
        shadow(x, y, w * .7)
        rgb(c, '#8A5A3C'); c.rectangle(x - w * .55, y - w * .55, w * 1.1, w * .55); c.fill()
        rgb(c, '#A8714A'); c.rectangle(x - w * .55, y - w * .55, w * .5, w * .55); c.fill()
        rgb(c, '#4A3A4E'); c.move_to(x - w * .7, y - w * .5); c.line_to(x, y - w * 1.05); c.line_to(x + w * .7, y - w * .5); c.close_path(); c.fill()
        rgb(c, '#6E5A72'); c.move_to(x - w * .7, y - w * .5); c.line_to(x, y - w * 1.05); c.line_to(x - w * .05, y - w * .5); c.close_path(); c.fill()
        rgb(c, '#F6D27A'); c.rectangle(x + w * .12, y - w * .38, w * .2, w * .18); c.fill()
        rgb(c, '#E7E2D8', .7); c.arc(x + w * .32, y - w * 1.1, w * .08, 0, 7); c.fill(); c.arc(x + w * .4, y - w * 1.25, w * .1, 0, 7); c.fill()
    def tower(x, y, w):
        shadow(x, y, w * .5)
        rgb(c, '#6B5446'); c.set_line_width(4)
        c.move_to(x - w * .35, y); c.line_to(x - w * .15, y - w * 1.2); c.move_to(x + w * .35, y); c.line_to(x + w * .15, y - w * 1.2)
        c.move_to(x - w * .3, y - w * .4); c.line_to(x + w * .3, y - w * .4); c.move_to(x - w * .22, y - w * .8); c.line_to(x + w * .22, y - w * .8); c.stroke()
        rgb(c, '#A8714A'); c.rectangle(x - w * .28, y - w * 1.45, w * .56, w * .28); c.fill()
        rgb(c, '#F6D27A'); c.rectangle(x - w * .2, y - w * 1.4, w * .4, w * .1); c.fill()
        rgb(c, '#C8553D'); c.move_to(x - w * .38, y - w * 1.44); c.line_to(x, y - w * 1.7); c.line_to(x + w * .38, y - w * 1.44); c.close_path(); c.fill()
    def bridge(x, y, w):
        rgb(c, '#4BB0C1'); c.rectangle(x - w, y - w * .28, w * 2, w * .56); c.fill()
        rgb(c, '#9FDCD2'); c.rectangle(x - w, y - w * .28, w * 2, w * .08); c.fill()
        for i in range(7):
            rgb(c, '#A8714A' if i % 2 else '#8A5A3C'); c.rectangle(x - w * .35 + i * w * .1, y - w * .45, w * .09, w * .9); c.fill()
        rgb(c, '#5B4A3E'); c.set_line_width(3); c.move_to(x - w * .38, y - w * .47); c.line_to(x + w * .38, y - w * .47); c.move_to(x - w * .38, y + w * .47); c.line_to(x + w * .38, y + w * .47); c.stroke()
    def tent(x, y, w):
        shadow(x, y, w * .7)
        rgb(c, '#C4683E'); c.move_to(x - w * .7, y); c.line_to(x, y - w * .8); c.line_to(x + w * .7, y); c.close_path(); c.fill()
        rgb(c, '#E2894A'); c.move_to(x - w * .7, y); c.line_to(x, y - w * .8); c.line_to(x - w * .05, y); c.close_path(); c.fill()
        rgb(c, '#3B2E2A'); c.move_to(x - w * .12, y); c.line_to(x, y - w * .35); c.line_to(x + w * .14, y); c.close_path(); c.fill()
        rgb(c, '#F0A35A'); c.arc(x + w * .95, y - w * .08, w * .1, 0, 7); c.fill()
    def deer(x, y, w):
        rgb(c, '#9A6A44')
        c.save(); c.translate(x, y - w * .55); c.scale(1, .5); c.arc(0, 0, w * .45, 0, 7); c.restore(); c.fill()
        c.set_line_width(5); c.set_line_cap(cairo.LINE_CAP_ROUND)
        for dx in (-.3, -.15, .2, .32):
            c.move_to(x + dx * w, y - w * .5); c.line_to(x + dx * w, y); c.stroke()
        c.move_to(x + w * .35, y - w * .65); c.line_to(x + w * .55, y - w * 1.0); c.stroke()
        c.arc(x + w * .6, y - w * 1.02, w * .12, 0, 7); c.fill()
        rgb(c, '#5B4A3E'); c.set_line_width(2.5)
        c.move_to(x + w * .58, y - w * 1.12); c.line_to(x + w * .5, y - w * 1.35); c.line_to(x + w * .4, y - w * 1.4); c.move_to(x + w * .5, y - w * 1.3); c.line_to(x + w * .62, y - w * 1.42); c.stroke()
        rgb(c, '#F3E6CF'); c.arc(x - w * .4, y - w * .6, w * .07, 0, 7); c.fill()
    def waterfall(x, y, w):
        rgb(c, '#86698C'); c.rectangle(x - w * .8, y - w * 1.2, w * .5, w * 1.2); c.fill(); c.rectangle(x + w * .3, y - w * 1.2, w * .5, w * 1.2); c.fill()
        rgb(c, '#DDA286'); c.rectangle(x - w * .8, y - w * 1.2, w * .22, w * 1.2); c.fill()
        rgb(c, '#4BB0C1'); c.rectangle(x - w * .3, y - w * 1.2, w * .6, w * 1.2); c.fill()
        rgb(c, '#D6F5EE')
        for i in range(5): c.rectangle(x - w * .25 + i * w * .11, y - w * 1.2, w * .03, w * 1.15); c.fill()
        rgb(c, '#F6F3EC'); c.arc(x - w * .2, y - w * .05, w * .2, 0, 7); c.fill(); c.arc(x + w * .15, y - w * .02, w * .22, 0, 7); c.fill()
    cells = [
        lambda x, y: conifer(x, y, 150),
        lambda x, y: leafy(x, y, 150, '#A6CB78', '#6E9A5C', '#3F7A5C'),
        lambda x, y: leafy(x, y, 150, '#E8CE84', '#CDAA52', '#C47E47'),
        lambda x, y: leafy(x, y, 80, '#A6CB78', '#6E9A5C', '#3F7A5C'),
        lambda x, y: rock(x, y, 110),
        lambda x, y: peak(x, y, 85),
        lambda x, y: cabin(x, y, 80),
        lambda x, y: tower(x, y, 80),
        lambda x, y: bridge(x, y - 50, 80),
        lambda x, y: tent(x, y, 80),
        lambda x, y: deer(x, y, 90),
        lambda x, y: waterfall(x, y, 80),
    ]
    for i, f in enumerate(cells):
        cx = (i % 6) * CELL + CELL / 2; cy = (i // 6) * CELL + CELL - 30
        f(cx, cy)
    s.write_to_png(os.path.join(OUT, 'stamps.png'))

# ------------------------------------------------------------ grades
def grades():
    im = Image.open(os.path.join(OUT, 'topdown-painted.webp')).convert('RGB').resize((800, 500), Image.LANCZOS)
    a = np.asarray(im).astype(float) / 255
    lum = a @ np.array([.3, .59, .11])
    # night: cool moonlight, lifted shadows into blue-violet, warm campfire glow on the campsite
    night = lum[..., None] * np.array([.36, .44, .72]) * .8 + a * np.array([.22, .30, .42]) + np.array([.03, .04, .11])
    yy, xx = np.mgrid[0:500, 0:800]
    for (gx, gy, r) in [(509, 255, 60), (404, 200, 45)]:
        g = np.exp(-((xx - gx) ** 2 + (yy - gy) ** 2) / (2 * r * r))[..., None]
        night = night + g * np.array([.55, .32, .12]) * .8
    Image.fromarray((np.clip(night, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, 'grade-night.webp'), quality=88)
    # rain: desaturated, cooler, diagonal streaks
    rain = a * .78 + lum[..., None] * .22
    rain = rain * np.array([.9, .95, 1.02]) - .04
    rs = np.random.RandomState(2)
    streak = np.zeros((500, 800))
    for _ in range(900):
        x0, y0 = rs.randint(0, 800), rs.randint(0, 500); L_ = rs.randint(8, 18)
        for t in range(L_):
            x, y = x0 + t // 3, y0 + t
            if 0 <= x < 800 and 0 <= y < 500: streak[y, x] = 1
    rain = rain * (1 - .35 * streak[..., None]) + streak[..., None] * .35 * np.array([.85, .92, .98])
    Image.fromarray((np.clip(rain, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, 'grade-rain.webp'), quality=88)
    # snow: whiten open ground, keep forests darker
    sat = a.max(-1) - a.min(-1)
    snowmask = np.clip((lum - .45) / .2, 0, 1)[..., None]
    snow = a * (1 - snowmask) + (np.array([.93, .95, .98]) - (1 - lum[..., None]) * .15) * snowmask
    snow = snow * np.array([.95, .98, 1.05])
    Image.fromarray((np.clip(snow, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, 'grade-snow.webp'), quality=88)

if __name__ == '__main__':
    stamps(); grades(); print('ok')
