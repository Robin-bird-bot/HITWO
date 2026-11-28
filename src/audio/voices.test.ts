import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { nextFloat, seedRng } from '../engine/rng';
import { admit, jitterFor, perSoundLimit, pickVersion, type Voice } from './voices';

const L = BALANCE.audio.limits;

const voice = (id: string, started: number): Voice & { stopped: boolean } => {
  const v = {
    id,
    started,
    stopped: false,
    stop() {
      v.stopped = true;
    },
  };
  return v;
};

describe('pickVersion', () => {
  it('never plays the same version twice in a row', () => {
    const rng = seedRng(7);
    const random = () => nextFloat(rng);
    for (const count of [2, 3, 4]) {
      let last: number | undefined;
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const v = pickVersion(count, last, random);
        expect(v).not.toBe(last);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(count);
        seen.add(v);
        last = v;
      }
      expect(seen.size).toBe(count);
    }
  });

  it('plays the only version of a single-file sound', () => {
    expect(pickVersion(1, 0, () => 0.9)).toBe(0);
  });
});

describe('limits', () => {
  it('stops the oldest of the same sound past its limit', () => {
    const playing = Array.from({ length: L.perSound }, (_, i) => voice('ui.click', i * 100));
    const a = admit(playing, 'ui.click', 1000, 200);
    expect(a).toEqual({ play: true, stop: [playing[0]] });
  });

  it('stops the oldest of all past the total', () => {
    const playing = Array.from({ length: L.total }, (_, i) => voice(`s.${i}`, 1000 - i));
    const a = admit(playing, 'new.one', 2000, undefined);
    expect(a.play).toBe(true);
    if (a.play) expect(a.stop.map((v) => v.id)).toEqual([`s.${L.total - 1}`]);
  });

  it('won’t start the same sound twice within a few milliseconds', () => {
    expect(admit([], 'ui.click', 1000, 1000 - L.retriggerMs + 1)).toEqual({ play: false });
    expect(admit([], 'ui.click', 1000, 1000 - L.retriggerMs)).toEqual({ play: true, stop: [] });
  });

  it('allows fewer footsteps and more ticks and brushing', () => {
    expect(perSoundLimit('foot.dirt')).toBe(L.footsteps);
    expect(perSoundLimit('mg.tick')).toBe(L.ticks);
    expect(perSoundLimit('scav.brush.forest')).toBe(L.ticks);
    expect(perSoundLimit('card.flip')).toBe(L.perSound);
  });
});

describe('jitter', () => {
  const J = BALANCE.audio.jitter;
  const steps = [0, 0.25, 0.5, 0.999];

  it('changes pitch and volume a little on sounds with versions and on footsteps', () => {
    for (const r of steps) {
      for (const [id, versions] of [
        ['card.deal', 4],
        ['foot.mud', 1],
      ] as const) {
        const { rate, gain } = jitterFor(id, versions, undefined, () => r);
        expect(rate).toBeGreaterThanOrEqual(1 - J.pitch);
        expect(rate).toBeLessThanOrEqual(1 + J.pitch);
        expect(gain).toBeGreaterThanOrEqual(Math.pow(10, -J.volumeDb / 20));
        expect(gain).toBeLessThanOrEqual(Math.pow(10, J.volumeDb / 20));
      }
    }
    expect(jitterFor('card.deal', 4, undefined, () => 0).rate).toBeCloseTo(1 - J.pitch);
  });

  it('leaves single sounds and sounds with their own rate alone', () => {
    expect(jitterFor('ui.confirm', 1, undefined, () => 0)).toEqual({ rate: 1, gain: 1 });
    expect(jitterFor('craft.slot', 2, 1.18, () => 0)).toEqual({ rate: 1.18, gain: 1 });
  });
});
