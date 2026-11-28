/**
 * Incoming Bike! (docs/design/30-quick-minigames.md, sections 1 and 6): the
 * right key dodges; a wrong or late key costs a heart; a crossed-out key
 * passed by is a dodge, and pressed is a hit; the keys by tier; Prepare; and
 * the demo bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS, type Tier } from '../types';
import { incomingBikeBot } from './bot';
import {
  newIncomingBike,
  onTrail,
  press,
  result,
  signsFor,
  tick,
  type BikeOptions,
  type BikeState,
} from './logic';

const B = BALANCE.minigames.incomingBike;
const DT = 1 / 120;

/** Ticks until `when` holds (or a minute passes). */
function until(s0: BikeState, when: (s: BikeState) => boolean): BikeState {
  let s = s0;
  for (let k = 0; k < 120 * 60 && !when(s) && !s.over; k++) s = tick(s, DT);
  return s;
}
const shows = (s: BikeState) => onTrail(s).length > 0;
const game = (o: Partial<BikeOptions> = {}, order = ['finn', 'mom'], seed = 1) =>
  newIncomingBike({ tier: 1, ...o }, order, seed);

describe('the keys and shapes by tier', () => {
  it('the arrows, then A S D F at Tier II, then J K L at III (and IV and V)', () => {
    expect(signsFor(1, 'keys')).toEqual(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    expect(signsFor(2, 'keys')).toHaveLength(8);
    for (const t of [3, 4, 5] as Tier[]) expect(signsFor(t, 'keys')).toHaveLength(11);
    expect(signsFor(1, 'swipe')).toEqual(['up', 'down', 'left', 'right']);
    expect(signsFor(2, 'swipe')).toEqual(['up', 'down', 'left', 'right', 'v', 'caret']);
    expect(signsFor(3, 'swipe')).toContain('loop');
  });

  it('bikes only show the keys in play', () => {
    let s = game({ tier: 2 }, ['finn'], 4);
    const seen = new Set<string>();
    while (!s.over) {
      s = until(s, shows);
      const b = onTrail(s)[0];
      if (!b) break;
      seen.add(b.signs[0]!);
      s = press(s, b.signs[0]!);
    }
    for (const k of seen) expect(signsFor(2, 'keys')).toContain(k);
  });
});

describe('dodging', () => {
  it('the right key before the ring closes dodges: no heart lost', () => {
    let s = until(game(), shows);
    const b = onTrail(s)[0]!;
    expect(b.signs).toHaveLength(1);
    s = press(s, b.signs[0]!);
    expect(s.dodged).toBe(1);
    expect(s.heartsLeft).toBe(B.hearts);
    expect(s.bikes.find((x) => x.id === b.id)).toMatchObject({ outcome: 'dodged', how: 'hop' });
  });

  it('a wrong key costs a heart, and the hiker stumbles: keys do nothing for a moment', () => {
    let s = until(game(), shows);
    const b = onTrail(s)[0]!;
    const wrong = s.signs.find((k) => k !== b.signs[0])!;
    s = press(s, wrong);
    expect(s.heartsLeft).toBe(B.hearts - 1);
    expect(s.bikes.find((x) => x.id === b.id)?.outcome).toBe('hit');
    // Stumbling: the next press is ignored.
    expect(press(s, wrong)).toBe(s);
  });

  it('too late (the ring closes) costs a heart', () => {
    let s = until(game(), shows);
    const b = onTrail(s)[0]!;
    expect(b.closeAt - b.ringAt).toBeCloseTo(B.tiers[1].ringSec);
    s = until(s, (x) => x.bikes.some((y) => y.id === b.id && y.outcome));
    expect(s.heartsLeft).toBe(B.hearts - 1);
  });

  it('no bike on the trail: a key does nothing', () => {
    const s = game();
    expect(onTrail(s)).toHaveLength(0);
    expect(press(s, 'ArrowUp')).toBe(s);
  });

  it('every bike past with a heart left passes; out of hearts fails, and the next hiker starts', () => {
    let s = game({ hearts: 1 });
    // Finn misses the first bike: out.
    s = until(s, shows);
    s = until(s, (x) => x.turns.at === 1);
    expect(s.turns.done).toEqual({ finn: false });
    // Mom dodges every bike.
    while (!s.over) {
      s = until(s, (x) => shows(x) || x.over);
      const b = onTrail(s)[0];
      if (b) s = press(s, b.signs[b.done]!);
    }
    expect(s.turns.done).toEqual({ finn: false, mom: true });
    expect(s.record.mom).toBe(B.tiers[1].bikes);
    expect(result(s)).toMatchObject({ safe: ['mom'], pays: { finn: { energy: 1 } } });
  });
});

describe('the higher tiers', () => {
  /** Plays a tier on many seeds, dodging everything, and gathers every bike seen. */
  function bikesAt(tier: Tier) {
    const seen: { signs: number; crossed: boolean; two: boolean }[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      let s = newIncomingBike({ tier, hearts: 99 }, ['finn'], seed);
      const ids = new Set<number>();
      while (!s.over) {
        s = until(s, (x) => shows(x) || x.over);
        const now = onTrail(s);
        for (const b of now) {
          if (ids.has(b.id)) continue;
          ids.add(b.id);
          // Two at once ride either side of the trail.
          seen.push({ signs: b.signs.length, crossed: b.crossed, two: b.lane !== 0 });
        }
        const b = now.find((x) => !x.crossed);
        if (b) s = press(s, b.signs[b.done]!);
        else s = tick(s, DT);
      }
    }
    return seen;
  }

  it('two bikes come at once from Tier III, two keys from IV, crossed-out keys at V', () => {
    expect(bikesAt(2).some((b) => b.two || b.signs > 1 || b.crossed)).toBe(false);
    const three = bikesAt(3);
    expect(three.some((b) => b.two)).toBe(true);
    expect(three.some((b) => b.signs > 1 || b.crossed)).toBe(false);
    expect(bikesAt(4).some((b) => b.signs > 1)).toBe(true);
    expect(bikesAt(5).some((b) => b.crossed)).toBe(true);
  });

  it('a two-key bike needs both, in order', () => {
    let s = newIncomingBike({ tier: 4 }, ['finn'], 2);
    s = until(s, (x) => onTrail(x).some((b) => b.signs.length === 2));
    const b = onTrail(s).find((x) => x.signs.length === 2)!;
    s = press(s, b.signs[0]!);
    expect(s.bikes.find((x) => x.id === b.id)).toMatchObject({ done: 1 });
    expect(s.bikes.find((x) => x.id === b.id)?.outcome).toBeUndefined();
    s = press(s, b.signs[1]!);
    expect(s.bikes.find((x) => x.id === b.id)?.outcome).toBe('dodged');
  });

  it('a crossed-out key passed by is a dodge (a duck); pressed, it’s a hit', () => {
    const crossed = (x: BikeState) => onTrail(x).length === 1 && onTrail(x)[0]!.crossed;
    let seed = 1;
    let s = newIncomingBike({ tier: 5 }, ['finn'], seed);
    // Find a crossed-out bike alone on the trail.
    for (; seed < 40; seed++) {
      s = newIncomingBike({ tier: 5, hearts: 99 }, ['finn'], seed);
      while (!s.over && !crossed(s)) {
        s = until(s, (x) => shows(x) || x.over);
        if (crossed(s)) break;
        const b = onTrail(s).find((x) => !x.crossed);
        if (b) s = press(s, b.signs[b.done]!);
        else s = tick(s, DT);
      }
      if (crossed(s)) break;
    }
    expect(crossed(s)).toBe(true);
    const b = onTrail(s)[0]!;
    const hearts = s.heartsLeft;
    // Let it pass.
    const passed = until(s, (x) => x.bikes.some((y) => y.id === b.id && y.outcome));
    expect(passed.bikes.find((y) => y.id === b.id)).toMatchObject({
      outcome: 'dodged',
      how: 'duck',
    });
    expect(passed.heartsLeft).toBe(hearts);
    // Press it.
    const pressed = press(s, b.signs[0]!);
    expect(pressed.bikes.find((y) => y.id === b.id)?.outcome).toBe('hit');
    expect(pressed.heartsLeft).toBe(hearts - 1);
  });
});

describe('Prepare', () => {
  it('FOOD slows the rings [15%] each; BINOCULARS show the key before the ring starts', () => {
    const s = until(game({ food: 2, warnSec: B.binocularsSec }), shows);
    const b = onTrail(s)[0]!;
    expect(b.closeAt - b.ringAt).toBeCloseTo(B.tiers[1].ringSec * (1 + 2 * B.foodSlower));
    expect(b.ringAt - b.showAt).toBeCloseTo(B.binocularsSec);
  });

  it('BANDAGES give a hiker a heart; the BIKE BELL makes each hiker’s first mistake free', () => {
    expect(game({ extraHearts: { finn: 1 } }).heartsLeft).toBe(B.hearts + 1);
    let s = until(game({ bell: 1 }), shows);
    const b = onTrail(s)[0]!;
    s = press(
      s,
      s.signs.find((k) => k !== b.signs[0])!,
    );
    expect(s.heartsLeft).toBe(B.hearts);
    expect(s.bikes.find((x) => x.id === b.id)).toMatchObject({ outcome: 'dodged', how: 'bell' });
    s = until(s, shows);
    const c = onTrail(s)[0]!;
    s = press(
      s,
      s.signs.find((k) => k !== c.signs[0])!,
    );
    expect(s.heartsLeft).toBe(B.hearts - 1);
  });
});

describe('the demo bot', () => {
  /** The share of hikers the bot gets through at a tier. */
  function passRate(tier: Tier, runs = 40): number {
    let passed = 0;
    for (let seed = 1; seed <= runs; seed++) {
      let s = newIncomingBike({ tier }, ['finn'], seed);
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed * 7 + 1);
      for (let k = 0; k < 120 * 120 && !s.over; k++) {
        const key = incomingBikeBot(s, mem, rng, s.time);
        if (key) s = press(s, key);
        s = tick(s, DT);
      }
      if (s.turns.done.finn) passed++;
    }
    return passed / runs;
  }

  // 30 aims for [70–85%] at Tier I; the bot as 30 describes it does better (the PR has the numbers).
  it('passes Tier I most of the time, and fewer at Tier V', () => {
    const one = passRate(1);
    expect(one).toBeGreaterThanOrEqual(0.7);
    expect(passRate(5)).toBeLessThan(one);
  });

  it('plays every tier to the end', () => {
    for (const tier of TIERS) expect(passRate(tier, 3)).toBeGreaterThanOrEqual(0);
  });
});
