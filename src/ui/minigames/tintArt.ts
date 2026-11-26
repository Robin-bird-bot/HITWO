/**
 * Minigame art in a hiker's color (docs/design/14-minigames-trail-blocks.md,
 * "The hiker's color on the tools"), made once per file and color in a
 * canvas, and kept:
 * - **Tint** (`useTintedArt`): white pixels become the color, gray (#9A9A9A)
 *   becomes the color at 70% brightness, and the dark outline stays.
 *   Sleeping Bear's hikers and Whackoon's raccoon masks.
 * - **Wash** (`useWashedArt`): the color laid over every pixel of the art at
 *   a share (30%), only where the art is. The Trail Block tools.
 * - **Outline** (`useOutlinedArt`): only the art's edge pixels (those beside
 *   a clear pixel), in the color. Size Up's reveal.
 * - **Light** (`useLitArt`): the art's lightest green (G9, #D3DFAF) becomes
 *   the color. Trails' checkpoint flag and Rock Climb's holds.
 */
import { useEffect, useState } from 'react';
import { asset } from '../../config/assets';
import { BALANCE } from '../../config/balance';

const made = new Map<string, string>();
const key = (file: string, color: string) => `${file}|${color}`;
const washed = (file: string, color: string) => `${file}|${color}|wash`;
const outlined = (file: string, color: string) => `${file}|${color}|outline`;
const lit = (file: string, color: string) => `${file}|${color}|light`;

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

/** Only the art's edge pixels (beside a clear pixel, or at the border), in the color; the rest clear. */
function outline(img: HTMLImageElement, color: string): string {
  const canvas = document.createElement('canvas');
  const [w, h] = [img.naturalWidth, img.naturalHeight];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const hex = color.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && src.data[(y * w + x) * 4 + 3]! >= 10;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue;
      const i = (y * w + x) * 4;
      out.data[i] = rgb[0]!;
      out.data[i + 1] = rgb[1]!;
      out.data[i + 2] = rgb[2]!;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL();
}

/** The art with its lightest green (G9) in the color. */
function light(img: HTMLImageElement, color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hex = color.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3]! < 10) continue;
    const g9 =
      Math.abs(data.data[i]! - 0xd3) < 10 &&
      Math.abs(data.data[i + 1]! - 0xdf) < 10 &&
      Math.abs(data.data[i + 2]! - 0xaf) < 10;
    if (!g9) continue;
    data.data[i] = rgb[0]!;
    data.data[i + 1] = rgb[1]!;
    data.data[i + 2] = rgb[2]!;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

/** Makes (or reuses) each file's version in each color, the plain art until it's ready. */
function useMadeArt(
  files: readonly string[],
  colors: readonly string[],
  how: 'tint' | 'wash' | 'outline' | 'light',
): Readonly<Record<string, string>> {
  const keyOf = how === 'tint' ? key : how === 'wash' ? washed : how === 'outline' ? outlined : lit;
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
          made.set(
            k,
            how === 'tint'
              ? tint(img, c)
              : how === 'wash'
                ? wash(img, c)
                : how === 'outline'
                  ? outline(img, c)
                  : light(img, c),
          );
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

/** The outlines of these files in these colors, by `outlineKey` (nothing until ready). */
export const useOutlinedArt = (files: readonly string[], colors: readonly string[]) =>
  useMadeArt(files, colors, 'outline');

/** These files with their lightest green in these colors, by `litKey` (the plain art until ready). */
export const useLitArt = (files: readonly string[], colors: readonly string[]) =>
  useMadeArt(files, colors, 'light');

export const tintKey = key;
export const litKey = lit;
export const washKey = washed;
export const outlineKey = outlined;
