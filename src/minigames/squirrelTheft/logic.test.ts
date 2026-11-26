/**
 * Squirrel Theft (docs/design/23-minigames-final.md, sections 4 and 13):
 * the stolen things come back exactly when the bar ends at or above the
 * line; a nut feeds what's under it when it lands, not when it was thrown.
 * And the intro, turns, bears, Prepare, and the bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { squirrelTheftBot } from './bot';
import {
  happyEnough,
  newSquirrelTheft,
  result,
  skipIntro,
  thrower,
  throwNut,
  tick,
  type SquirrelTheftState,
  type Target,
} from './logic';

const ST = BALANCE.minigames.squirrelTheft;
const DT = 1 / 120;
const PACKS = { finn: { wood: 2, salt: 1 }, mom: { fish: 3 }, ellie: {} };
const THREE = ['finn', 'mom', 'ellie'];

/** Past the intro and the first hand-off, with nothing popping up on its own. */
function ready(s0: SquirrelTheftState): SquirrelTheftState {
  let s = skipIntro(s0);
  s = { ...s, nextAt: 9999 };
  return tick(s, BALANCE.minigames.quick.handoffSec + DT);
}
const run = (s: SquirrelTheftState, sec: number) => {
  let out = s;
  for (let t = 0; t < sec && !out.over; t += DT) out = tick({ ...out, nextAt: 9999 }, DT);
  return out;
};
const squirrel = (
  s: SquirrelTheftState,
  x: number,
  y: number,
  more: Partial<Target> = {},
): Target => ({
  id: 900 + x,
  kind: 'squirrel',
  x,
  y,
  upAt: s.time,
  until: s.time + 5,
  ...more,
});

describe('the intro', () => {
  it('takes the challenge’s number of things from across the party’s packs', () => {
    const s = newSquirrelTheft({ tier: 1, packs: PACKS, stolen: 3 }, THREE, 4);
    expect(s.phase).toBe('intro');
    expect(s.stolen).toHaveLength(3);
    for (const x of s.stolen)
      expect(Object.keys(PACKS[x.hiker as keyof typeof PACKS])).toContain(x.id);
    expect(newSquirrelTheft({ tier: 1, packs: PACKS, stolen: 6 }, THREE, 4).stolen).toHaveLength(6);
    // It ends after [3 s] on its own.
    expect(tick(s, ST.introSec + DT).phase).toBe('play');
  });
});

describe('throwing', () => {
  it('a nut feeds what’s under it when it lands, not when it was thrown', () => {
    let s = ready(newSquirrelTheft({ tier: 1, packs: PACKS }, THREE, 1));
    // A squirrel is at the spot when the nut is thrown, but ducks before it lands: no feed.
    s = { ...s, targets: [squirrel(s, 100, 140, { until: s.time + ST.flightSec / 2 })] };
    s = run(throwNut(s, { x: 100, y: 140 }), ST.flightSec + 0.05);
    expect(s.happy).toBe(0);
    // Nothing there when thrown, but one pops up there before it lands: fed.
    s = throwNut({ ...s, targets: [] }, { x: 200, y: 104 });
    s = { ...s, targets: [squirrel(s, 200, 104, { upAt: s.time + 0.1 })] };
    s = run(s, ST.flightSec + 0.05);
    expect(s.happy).toBe(1);
  });

  it('a runner is fed where it is when the nut lands', () => {
    let s = ready(newSquirrelTheft({ tier: 2, packs: PACKS }, THREE, 1));
    const run1 = squirrel(s, 20, 53, { run: { x0: 20, x1: 200, speed: 80 } });
    s = { ...s, targets: [run1] };
    // Thrown at where it is now: by the time it lands, it has run on.
    let missed = run(throwNut(s, { x: 20, y: 53 }), ST.flightSec + 0.05);
    expect(missed.happy).toBe(0);
    // Led: aimed where it will be.
    missed = { ...missed, targets: [{ ...run1, upAt: missed.time }] };
    const lead = 20 + 80 * ST.flightSec;
    const fed = run(throwNut(missed, { x: lead, y: 53 }), ST.flightSec + 0.05);
    expect(fed.happy).toBe(1);
  });

  it('a nut on a bear takes [2] off the bar', () => {
    let s = ready(newSquirrelTheft({ tier: 3, packs: PACKS }, THREE, 1));
    s = { ...s, happy: 3, targets: [{ ...squirrel(s, 160, 140), kind: 'bear' }] };
    s = run(throwNut(s, { x: 160, y: 140 }), ST.flightSec + 0.05);
    expect(s.happy).toBe(3 - ST.bear.cost);
  });

  it('each hiker throws their own nuts, in turn', () => {
    let s = ready(newSquirrelTheft({ tier: 1, packs: PACKS }, THREE, 1));
    expect(thrower(s)).toBe('finn');
    for (let k = 0; k < ST.tiers[1].nuts; k++) s = throwNut(s, { x: 10, y: 10 });
    expect(throwNut(s, { x: 10, y: 10 })).toBe(s);
    s = run(s, ST.flightSec + 0.05);
    expect(thrower(s)).toBe('mom');
  });
});

describe('the end', () => {
  const finish = (happy: number) => {
    let s = ready(newSquirrelTheft({ tier: 1, packs: PACKS, stolen: 4 }, THREE, 2));
    s = { ...s, happy, nutsLeft: { finn: 1, mom: 0, ellie: 0 } };
    s = throwNut(s, { x: 5, y: 5 });
    s = run(s, 5);
    // Past the others' empty turns.
    for (let k = 0; k < 4 && !s.over; k++) s = run(s, BALANCE.minigames.quick.handoffSec + 0.1);
    return s;
  };

  it('the stolen things come back exactly when the bar ends at or above the line', () => {
    const s0 = newSquirrelTheft({ tier: 1, packs: PACKS, stolen: 4 }, THREE, 2);
    const line = s0.line;
    expect(line).toBe(Math.ceil(s0.nutsAll * ST.tiers[1].line));
    const at = finish(line);
    expect(at.over).toBe(true);
    expect(happyEnough(at)).toBe(true);
    const ok = result(at);
    expect(ok.safe).toEqual(THREE);
    for (const id of THREE) expect(ok.pays?.[id]?.stolen ?? []).toEqual([]);
    const below = finish(line - 1);
    const bad = result(below);
    expect(bad.safe).toEqual([]);
    const lost = THREE.flatMap((id) => bad.pays?.[id]?.stolen ?? []);
    expect(lost.sort()).toEqual(below.stolen.map((x) => x.id).sort());
    // Nothing else is lost.
    for (const id of THREE) expect(bad.pays?.[id]?.energy).toBeUndefined();
  });
});

describe('Prepare and the settings', () => {
  it('+1 nut for a hiker, BAIT keeps squirrels up longer, Bear Spray means no bears', () => {
    const s = newSquirrelTheft(
      { tier: 3, packs: PACKS, extraNuts: { mom: 2 }, baitSec: ST.baitSec, noBears: true },
      THREE,
      1,
    );
    expect(s.nutsLeft.mom).toBe(ST.tiers[3].nuts + 2);
    expect(s.upSec).toBeCloseTo(ST.tiers[3].upSec + ST.baitSec);
    expect(s.bears).toBe(false);
    expect(newSquirrelTheft({ tier: 1, packs: PACKS, bears: 'on' }, THREE, 1).bears).toBe(true);
    expect(newSquirrelTheft({ tier: 3, packs: PACKS }, THREE, 1).bears).toBe(true);
  });
});

describe('the demo bot', () => {
  it('feeds plenty of squirrels at Tier I', () => {
    let total = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let s = newSquirrelTheft({ tier: 1, packs: PACKS }, THREE, seed);
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      for (let k = 0; k < 120 * 90 && !s.over; k++) {
        const a = squirrelTheftBot(s, mem, rng, s.time);
        if (a?.kind === 'skip') s = skipIntro(s);
        else if (a) s = throwNut(s, a.to);
        s = tick(s, DT);
      }
      expect(s.over).toBe(true);
      total += s.happy;
    }
    expect(total / 6).toBeGreaterThan(5);
  });
});
