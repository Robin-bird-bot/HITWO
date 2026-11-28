# How the TrailMate look turns an item's art into LCD greens (the prototype's recipe).
# Usage: python3 greenify.py in.png out.png
import sys
import numpy as np
from PIL import Image

GREENS = ['#111A10', '#1D2918', '#2B3A23', '#3C4E2F', '#52653F', '#6A7E51', '#859A66', '#A0B37D', '#BAC995', '#D3DFAF']
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def greenify(path, px=42, scale=2):
    """Shrink to about 42 px, stretch the contrast, map to 4 greens (G1, G3, G5, G7), add a G0 outline, then draw at 2x with crisp pixels."""
    src = Image.open(path).convert('RGBA'); src.thumbnail((px - 4, px - 4), Image.LANCZOS)
    can = Image.new('RGBA', (px, px), (0, 0, 0, 0)); can.alpha_composite(src, ((px - src.width) // 2, (px - src.height) // 2))
    a = np.array(can).astype(float); on = a[..., 3] > 110
    lum = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11
    if on.any():
        lo, hi = np.percentile(lum[on], 4), np.percentile(lum[on], 96); lum = np.clip((lum - lo) / max(1, hi - lo), 0, 1)
    pal = [hx(GREENS[k]) for k in (1, 3, 5, 7)]
    q = np.clip((lum * 4).astype(int), 0, 3)
    out = np.zeros((px, px, 4), np.uint8)
    for k in range(4):
        m = on & (q == k); out[m, :3] = pal[k]; out[m, 3] = 255
    ring = np.zeros_like(on)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): ring |= np.roll(np.roll(on, dy, 0), dx, 1)
    ring &= ~on; out[ring, :3] = hx(GREENS[0]); out[ring, 3] = 255
    return Image.fromarray(out).resize((px * scale, px * scale), Image.NEAREST)

if __name__ == '__main__':
    greenify(sys.argv[1]).save(sys.argv[2])
