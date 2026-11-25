/**
 * Minigame art in a hiker's color (docs/design/14-minigames-trail-blocks.md,
 * "The hiker's color on the tools"), made once per file and color in a
 * canvas, and kept:
 * - **Tint** (`useTintedArt`): white pixels become the color, gray (#9A9A9A)
 *   becomes the color at 70% brightness, and the dark outline stays.
 *   Sleeping Bear's hikers and Whackoon's raccoon masks.
 * - **Wash** (`useWashedArt`): the color laid over every pixel of the art at
 *   a share (30%), only where the art is. The Trail Block tools.
 */
import { useEffect, useState } from 'react';
import { asset } from '../../config/assets';
import { BALANCE } from '../../config/balance';

const made = new Map<string, string>();
const key = (file: string, color: string) => `${file}|${color}`;
const washed = (file: string, color: string) => `${file}|${color}|wash`;

function tint(img: HTMLImageElement, color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hex = color.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const shade = BALANCE.minigames.tintShade;
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3]! < 10) continue;
    const [r, g, b] = [data.data[i]!, data.data[i + 1]!, data.data[i + 2]!];
    const white = r > 230 && g > 230 && b > 230;
    const gray = Math.abs(r - 0x9a) < 12 && Math.abs(g - 0x9a) < 12 && Math.abs(b - 0x9a) < 12;
    if (!white && !gray) continue;
    const k = white ? 1 : shade;
    data.data[i] = Math.round(rgb[0]! * k);
    data.data[i + 1] = Math.round(rgb[1]! * k);
    data.data[i + 2] = Math.round(rgb[2]! * k);
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

/** The art with the color laid over its own pixels at a share. */
function wash(img: HTMLImageElement, color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hex = color.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const share = BALANCE.minigames.trailBlocks.wash;
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3]! < 10) continue;
    for (let c = 0; c < 3; c++) {
      data.data[i + c] = Math.round(data.data[i + c]! * (1 - share) + rgb[c]! * share);
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

/** Makes (or reuses) each file's version in each color, the plain art until it's ready. */
function useMadeArt(
  files: readonly string[],
  colors: readonly string[],
  how: 'tint' | 'wash',
): Readonly<Record<string, string>> {
  const keyOf = how === 'tint' ? key : washed;
  const wanted = [...new Set(files)].flatMap((f) => [...new Set(colors)].map((c) => keyOf(f, c)));
  const id = wanted.sort().join(',');
  const [made$, setMade] = useState<Record<string, string>>(() =>
    Object.fromEntries(wanted.flatMap((k) => (made.has(k) ? [[k, made.get(k)!]] : []))),
  );
  useEffect(() => {
    if (typeof document === 'undefined' || !id) return;
    let live = true;
    const pairs = id.split(',').map((k) => k.split('|') as [string, string]);
    const fileList = [...new Set(pairs.map(([f]) => f))];
    Promise.all(
      fileList.map(
        (f) =>
          new Promise<[string, HTMLImageElement]>((resolve) => {
            const img = new Image();
            img.onload = () => resolve([f, img]);
            img.onerror = () => resolve([f, img]);
            img.src = asset(f);
          }),
      ),
    ).then((loaded) => {
      if (!live) return;
      const imgs = new Map(loaded);
      const out: Record<string, string> = {};
      for (const [f, c] of pairs) {
        const k = keyOf(f, c);
        const img = imgs.get(f);
        if (!made.has(k) && img?.naturalWidth)
          made.set(k, how === 'tint' ? tint(img, c) : wash(img, c));
        if (made.has(k)) out[k] = made.get(k)!;
      }
      setMade(out);
    });
    return () => {
      live = false;
    };
  }, [id, how, keyOf]);
  return made$;
}

/** The tinted versions of these files in these colors, by `tintKey` (the plain art until ready). */
export const useTintedArt = (files: readonly string[], colors: readonly string[]) =>
  useMadeArt(files, colors, 'tint');

/** The washed versions of these files in these colors, by `washKey` (the plain art until ready). */
export const useWashedArt = (files: readonly string[], colors: readonly string[]) =>
  useMadeArt(files, colors, 'wash');

export const tintKey = key;
export const washKey = washed;
