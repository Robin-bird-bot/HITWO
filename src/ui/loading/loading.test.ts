import { describe, expect, it } from 'vitest';
import { known } from '../../audio/testManifest';
import { LOADING_TIPS } from '../../content/loadingTips';
import { preloadPlan } from './preload';
import { FLOOR, hopHeight, startRunner, stepRunner, type RunnerState } from './runner';

const ON_DISK = new Set(
  Object.keys(import.meta.glob('/public/assets/**/*.{png,jpg,webp,svg}')).map((p) =>
    p.replace('/public/', '/'),
  ),
);
const onDisk = (url: string) => ON_DISK.has(url.replace(import.meta.env.BASE_URL, '/'));

describe('the loading screens (35-ui-overhaul.md, section 9)', () => {
  it('load each biome’s backdrops and its day and night ambience', () => {
    const meadow = preloadPlan('meadow');
    expect(meadow.images.length).toBeGreaterThan(3);
    expect(meadow.images.every(onDisk)).toBe(true);
    for (const biome of ['meadow', 'temperateRainforest', 'alpine'] as const) {
      const plan = preloadPlan(biome);
      expect(plan.sounds.some((id) => id.endsWith('.day'))).toBe(true);
      expect(plan.sounds.some((id) => id.endsWith('.night'))).toBe(true);
      expect(plan.sounds.filter((id) => !known(id))).toEqual([]);
    }
  });

  it('have short tips with no brackets', () => {
    expect(LOADING_TIPS.length).toBeGreaterThanOrEqual(6);
    for (const tip of LOADING_TIPS) {
      expect(tip).not.toMatch(/[[\]]/);
      expect(tip.length).toBeLessThan(80);
    }
  });

  it('the Runner hops over every obstacle, then turns back at the edge with new ones', () => {
    let s: RunnerState = startRunner();
    let jumps = 0;
    let swaps = 0;
    const dirs = new Set<number>();
    for (let t = 0; t < 30; t += 1 / 60) {
      const before = s;
      const step = stepRunner(s, 1 / 60);
      if (step.jumped) jumps += 1;
      if (step.swapped) {
        swaps += 1;
        // Every obstacle on that run was hopped over.
        expect(before.obstacles.every((o) => o.cleared)).toBe(true);
      }
      s = step.state;
      dirs.add(s.dir);
      expect(hopHeight(s)).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1600);
    }
    expect(swaps).toBeGreaterThanOrEqual(4);
    expect(jumps).toBeGreaterThanOrEqual(swaps * 4);
    expect([...dirs].sort()).toEqual([-1, 1]);
    expect(FLOOR).toBeLessThan(1000);
  });
});
