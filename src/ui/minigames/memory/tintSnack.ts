/**
 * The trail snacks in a hiker's color (docs/design/13-minigames-puzzles-2.md,
 * section 2, "The tint"): the snack's dark greens become a dark shade of the
 * color, its middle greens the color itself, and its light greens a pale
 * shade. The outline (the darkest greens) stays. Made once per snack and
 * color in a canvas, and kept.
 */
import { useEffect, useState } from 'react';
import { asset } from '../../../config/assets';
import { GREENS } from '../../../minigames/greens';

const made = new Map<string, string>();

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const PALETTE = GREENS.map(rgb);
const mix = (a: [number, number, number], b: [number, number, number], k: number) =>
  a.map((v, i) => Math.round(v + (b[i]! - v) * k)) as [number, number, number];
const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

/** What each of the ten greens becomes, for a color (null: keep it). */
function mapping(color: string): ([number, number, number] | null)[] {
  const c = rgb(color);
  return [
    null,
    null,
    mix(c, BLACK, 0.5),
    mix(c, BLACK, 0.42),
    mix(c, BLACK, 0.32),
    mix(c, BLACK, 0.15),
    c,
    mix(c, WHITE, 0.18),
    mix(c, WHITE, 0.5),
    mix(c, WHITE, 0.68),
  ];
}

/** The nearest of the ten greens to a pixel. */
function nearestGreen(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  PALETTE.forEach(([pr, pg, pb], i) => {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function tint(img: HTMLImageElement, color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const to = mapping(color);
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3]! < 10) continue;
    const next = to[nearestGreen(data.data[i]!, data.data[i + 1]!, data.data[i + 2]!)];
    if (!next) continue;
    [data.data[i], data.data[i + 1], data.data[i + 2]] = next;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

export const snackKey = (snack: string, color: string) => `${snack}|${color}`;

/** The tinted snacks for these (snack, color) pairs, by `snackKey` (the plain snack until ready). */
export function useSnackTints(
  pairs: readonly { snack: string; color: string }[],
): Readonly<Record<string, string>> {
  const key = [...new Set(pairs.map((p) => snackKey(p.snack, p.color)))].sort().join(',');
  const [tints, setTints] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pairs.flatMap((p) => {
        const k = snackKey(p.snack, p.color);
        return made.has(k) ? [[k, made.get(k)!]] : [];
      }),
    ),
  );
  useEffect(() => {
    if (typeof document === 'undefined' || !key) return;
    let live = true;
    const wanted = key.split(',').map((k) => k.split('|') as [string, string]);
    const snacks = [...new Set(wanted.map(([s]) => s))];
    Promise.all(
      snacks.map(
        (snack) =>
          new Promise<[string, HTMLImageElement]>((resolve) => {
            const img = new Image();
            img.onload = () => resolve([snack, img]);
            img.onerror = () => resolve([snack, img]);
            img.src = asset(`minigames/find-object/snacks/${snack}.png`);
          }),
      ),
    ).then((loaded) => {
      if (!live) return;
      const imgs = new Map(loaded);
      const out: Record<string, string> = {};
      for (const [snack, color] of wanted) {
        const k = snackKey(snack, color);
        const img = imgs.get(snack);
        if (!made.has(k) && img?.naturalWidth) made.set(k, tint(img, color));
        if (made.has(k)) out[k] = made.get(k)!;
      }
      setTints(out);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return tints;
}
