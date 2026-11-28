/**
 * TrailMate's item symbols: an item's art in LCD greens
 * (28-packing-screen-trailmate.md, section 1.2; the recipe is
 * `assets/packing-trailmate/greenify.py`). Shrunk to fit about 42 px, the
 * contrast stretched, mapped to 4 greens (G1, G3, G5, G7) with a G0
 * outline, and drawn at 2× with crisp pixels in CSS. Made once per picture
 * in a canvas and kept.
 */
import { useEffect, useState } from 'react';
import { LCD_GREENS } from '../../minigames/palette';

/** The symbol's size in art pixels (drawn at 2×). TODO(wyatt): [42 px]. */
export const GREEN_PX = 42;

const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const PALETTE = [1, 3, 5, 7].map((k) => rgb(LCD_GREENS[k] ?? '#000000'));
const OUTLINE = rgb(LCD_GREENS[0] ?? '#000000');

/** The value at a share of the way through a sorted list (numpy's percentile, linear). */
function percentile(sorted: readonly number[], share: number): number {
  if (!sorted.length) return 0;
  const at = (sorted.length - 1) * share;
  const lo = Math.floor(at);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return (sorted[lo] ?? 0) + ((sorted[hi] ?? 0) - (sorted[lo] ?? 0)) * (at - lo);
}

/** Draws the picture smaller in halving steps, so a big painting shrinks smoothly. */
function shrink(img: HTMLImageElement, w: number, h: number): CanvasImageSource {
  let src: CanvasImageSource = img;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  while (sw / 2 > w && sh / 2 > h) {
    const step = document.createElement('canvas');
    step.width = Math.max(1, Math.round(sw / 2));
    step.height = Math.max(1, Math.round(sh / 2));
    const g = step.getContext('2d');
    if (!g) break;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, step.width, step.height);
    src = step;
    sw = step.width;
    sh = step.height;
  }
  return src;
}

/** The greens version of a loaded picture, as a data URL. */
export function greenify(img: HTMLImageElement, px = GREEN_PX): string {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g || !img.naturalWidth || !img.naturalHeight) return '';
  const fit = Math.min((px - 4) / img.naturalWidth, (px - 4) / img.naturalHeight, 1);
  const w = Math.max(1, Math.round(img.naturalWidth * fit));
  const h = Math.max(1, Math.round(img.naturalHeight * fit));
  g.imageSmoothingQuality = 'high';
  g.drawImage(shrink(img, w, h), Math.floor((px - w) / 2), Math.floor((px - h) / 2), w, h);
  const data = g.getImageData(0, 0, px, px);
  const d = data.data;
  const on = new Uint8Array(px * px);
  const lum = new Float32Array(px * px);
  const lit: number[] = [];
  for (let i = 0; i < px * px; i++) {
    on[i] = (d[i * 4 + 3] ?? 0) > 110 ? 1 : 0;
    lum[i] = (d[i * 4] ?? 0) * 0.3 + (d[i * 4 + 1] ?? 0) * 0.59 + (d[i * 4 + 2] ?? 0) * 0.11;
    if (on[i]) lit.push(lum[i] ?? 0);
  }
  lit.sort((a, b) => a - b);
  const lo = percentile(lit, 0.04);
  const hi = percentile(lit, 0.96);
  const span = Math.max(1, hi - lo);
  const put = (i: number, c: readonly number[]) => {
    d[i * 4] = c[0] ?? 0;
    d[i * 4 + 1] = c[1] ?? 0;
    d[i * 4 + 2] = c[2] ?? 0;
    d[i * 4 + 3] = 255;
  };
  for (let i = 0; i < px * px; i++) {
    if (on[i]) {
      const v = Math.min(1, Math.max(0, ((lum[i] ?? 0) - lo) / span));
      put(i, PALETTE[Math.min(3, Math.floor(v * 4))] ?? OUTLINE);
      continue;
    }
    // A dark outline wherever a lit pixel is next door.
    const x = i % px;
    const y = Math.floor(i / px);
    const near =
      (x > 0 && on[i - 1]) ||
      (x < px - 1 && on[i + 1]) ||
      (y > 0 && on[i - px]) ||
      (y < px - 1 && on[i + px]);
    if (near) put(i, OUTLINE);
    else d[i * 4 + 3] = 0;
  }
  g.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

const made = new Map<string, Promise<string>>();

/** The greens version of a picture by URL at a size (the packing machine's by default), made once. */
export function greenArt(src: string, px = GREEN_PX): Promise<string> {
  const key = `${px}:${src}`;
  let p = made.get(key);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(greenify(img, px));
      img.onerror = () => resolve('');
      img.src = src;
    });
    made.set(key, p);
  }
  return p;
}

/** The greens version of a picture, once it's made (null until then). */
export function useGreenArt(src: string | undefined, px = GREEN_PX): string | null {
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null);
  const key = src ? `${px}:${src}` : '';
  useEffect(() => {
    if (!src) return;
    let live = true;
    void greenArt(src, px).then((u) => {
      if (live) setUrl({ key: `${px}:${src}`, url: u });
    });
    return () => {
      live = false;
    };
  }, [src, px]);
  return url && url.key === key && url.url ? url.url : null;
}
