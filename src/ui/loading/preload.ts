/**
 * What a loading screen loads (35-ui-overhaul.md, section 9): the biome's
 * backdrops and map art, and its ambience (the music joins in step 9). The
 * bar fills with real progress: each image, the map's stamps, and each
 * sound file.
 */
import { audio } from '../../audio/engine';
import { bedFor, oneShotsFor, type AmbienceScene } from '../../audio/ambience';
import { ASSETS } from '../../config/assets';
import type { BiomeId } from '../../engine';
import { BIOME_LAND } from '../backdrop/land';
import { loadStamps } from '../map/illustrated/generate';

export interface PreloadPlan {
  images: string[];
  sounds: string[];
}

/** The biome's art and sounds, by day and by night. */
export function preloadPlan(biome: BiomeId): PreloadPlan {
  const images = [
    ...BIOME_LAND[biome].map((l) => l.src),
    ASSETS.sky.sun,
    ASSETS.sky.moon,
    ASSETS.textures.halftone,
    ...Object.values(ASSETS.nodes),
  ];
  const scenes: AmbienceScene[] = [
    { place: 'trail', biome, night: false },
    { place: 'trail', biome, night: true },
  ];
  const sounds = scenes.flatMap((scene) => {
    const bed = bedFor(scene);
    return [...(bed ? [bed] : []), ...oneShotsFor(scene).flatMap((r) => r.ids)];
  });
  return { images: [...new Set(images)], sounds: [...new Set(sounds)] };
}

function loadImage(src: string): Promise<void> {
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => done();
    img.onerror = () => done();
    img.src = src;
  });
}

/** Loads the biome, telling how far along it is (0–1). A part that fails still counts as done. */
export async function preloadBiome(
  biome: BiomeId,
  onProgress: (share: number) => void,
): Promise<void> {
  const plan = preloadPlan(biome);
  // Images and the stamps are one part each; the sounds count by file.
  let soundFiles = 0;
  let soundsDone = 0;
  let partsDone = 0;
  const parts = plan.images.length + 1;
  const report = () => {
    const total = parts + soundFiles;
    onProgress(total ? (partsDone + soundsDone) / total : 1);
  };
  const part = async (p: Promise<unknown>) => {
    await p.catch(() => undefined);
    partsDone += 1;
    report();
  };
  report();
  await Promise.all([
    ...plan.images.map((src) => part(loadImage(src))),
    part(loadStamps()),
    audio
      .preload(plan.sounds, (done, total) => {
        soundFiles = total;
        soundsDone = done;
        report();
      })
      .catch(() => undefined),
  ]);
  onProgress(1);
}
