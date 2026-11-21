/**
 * Making a section's land, start to finish: the model, its features, and the
 * two painted images. Runs in the land worker (landWorker.ts), or on the main
 * thread where there's no worker or no OffscreenCanvas.
 */
import { asset } from '../../../config/assets';
import { buildFeatures, STAMP_KINDS, type LandFeatures, type StampKind } from './land/features';
import { OREGON_NAMES } from './land/input';
import { buildLand, LAND_TIMINGS, type LandInput } from './land/model';
import { paintLand, type StampImages } from './paint';

export interface LandTimings {
  land: number;
  features: number;
  paint: number;
  total: number;
  parts: Record<string, number>;
}

/** What the screen needs from a section's land (the images, and what's drawn over them). */
export interface LandResult {
  key: string;
  x0: number;
  y0: number;
  width: number;
  height: number;
  scale: number;
  painted: CanvasImageSource;
  sketch: CanvasImageSource;
  features: LandFeatures;
  /** For the debug panel's views. */
  debug: { gw: number; gh: number; type: Uint8Array; heightN: Float32Array };
  timings: LandTimings;
}

let stampLoad: Promise<StampImages> | undefined;

/** The stamp images, loaded once. A missing one is left out (and skipped when painting). */
export function loadStamps(): Promise<StampImages> {
  stampLoad ??= Promise.all(
    STAMP_KINDS.map(async (kind): Promise<[StampKind, ImageBitmap | undefined]> => {
      try {
        const res = await fetch(asset(`map/stamps/${kind}.png`));
        if (!res.ok) return [kind, undefined];
        return [kind, await createImageBitmap(await res.blob())];
      } catch {
        return [kind, undefined];
      }
    }),
  ).then((pairs) => Object.fromEntries(pairs.filter(([, img]) => img)) as StampImages);
  return stampLoad;
}

export interface Generated {
  result: Omit<LandResult, 'painted' | 'sketch'>;
  painted: HTMLCanvasElement | OffscreenCanvas;
  sketch: HTMLCanvasElement | OffscreenCanvas;
}

export async function generate(key: string, input: LandInput, scale: number): Promise<Generated> {
  const t0 = performance.now();
  const land = buildLand(input);
  const t1 = performance.now();
  const features = buildFeatures(land, OREGON_NAMES);
  const t2 = performance.now();
  const images = await loadStamps();
  const t3 = performance.now();
  const p = paintLand(land, features, images, scale);
  const t4 = performance.now();
  return {
    result: {
      key,
      x0: land.x0,
      y0: land.y0,
      width: land.width,
      height: land.height,
      scale,
      features,
      debug: { gw: land.gw, gh: land.gh, type: land.type, heightN: land.heightN },
      timings: {
        land: t1 - t0,
        features: t2 - t1,
        paint: t4 - t3,
        total: t4 - t0 - (t3 - t2),
        parts: { ...LAND_TIMINGS },
      },
    },
    painted: p.painted,
    sketch: p.sketch,
  };
}
