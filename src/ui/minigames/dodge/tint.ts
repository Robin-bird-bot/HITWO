/**
 * The party sprite in each hiker's color (docs/design/12-minigames-dodge.md,
 * section 1): person.png's white pixels are recolored, and the dark outline
 * stays. Made once per color in a canvas and kept.
 */
import { useEffect, useState } from 'react';
import { asset } from '../../../config/assets';

const made = new Map<string, string>();

function tint(img: HTMLImageElement, color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hex = color.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.data.length; i += 4) {
    const white = data.data[i]! > 230 && data.data[i + 1]! > 230 && data.data[i + 2]! > 230;
    if (white && data.data[i + 3]! > 0) {
      data.data[i] = r ?? 255;
      data.data[i + 1] = g ?? 255;
      data.data[i + 2] = b ?? 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

/** The tinted sprites for these colors (missing ones fall back to the plain sprite until ready). */
export function useTinted(colors: readonly string[]): Readonly<Record<string, string>> {
  const key = [...new Set(colors)].join(',');
  const [tints, setTints] = useState<Record<string, string>>(() =>
    Object.fromEntries(colors.flatMap((c) => (made.has(c) ? [[c, made.get(c)!]] : []))),
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const img = new Image();
    img.onload = () => {
      const out: Record<string, string> = {};
      for (const c of key.split(',')) {
        if (!c) continue;
        if (!made.has(c)) made.set(c, tint(img, c));
        out[c] = made.get(c)!;
      }
      setTints(out);
    };
    img.src = asset('minigames/dodge/person.png');
  }, [key]);
  return tints;
}
