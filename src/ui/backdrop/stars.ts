import { nextFloat, seedRng } from '../../engine/rng';

export interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  /** Twinkle length and start offset, in seconds. */
  duration: number;
  delay: number;
}

const SIZES = [10, 12, 14, 18, 22];
const STAR_SEED = 20261103;

/**
 * About 90 Edit Undo asterisks across the top half of the night sky
 * (BUILD_PLAN "Motion"). Seeded, so they never jump between renders.
 */
export function makeStars(count = 90, width = 1600, height = 1000): Star[] {
  const rng = seedRng(STAR_SEED);
  const r = () => nextFloat(rng);
  return Array.from({ length: count }, () => ({
    x: Math.round(r() * width),
    y: Math.round(r() * height * 0.52),
    size: SIZES[Math.floor(r() * SIZES.length)] as number,
    opacity: Math.round((0.2 + r() * 0.75) * 100) / 100,
    duration: Math.round((3 + r() * 4) * 10) / 10,
    delay: Math.round(r() * 50) / 10,
  }));
}
