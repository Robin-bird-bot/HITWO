/**
 * Rock Climb (docs/design/19-minigames-signs-trails.md, sections 4 and 7,
 * and 22-minigame-revisions.md, sections 2 and 6): for 1 to 4 hikers the
 * sequence gives everyone equal turns; only same-color holds grab, within
 * reach; the planned path is always reachable; a fall costs one try and [1]
 * energy (none with the Harness, once); a hiker with no tries leaves the
 * sequence and no hold keeps their color; everyone out fails everyone; the
 * top passes only when the hand goes above the line; no timer by default.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import {
  activeColor,
  activeHand,
  fallSec,
  grab,
  grabClosest,
  handAt,
  reachableHolds,
  hold,
  letGo,
  makeSequence,
  newRockClimb,
  nextHold,
  onLastMove,
  planWall,
  result,
  tick,
  type RockClimbState,
} from './logic';

const R = BALANCE.minigames.rockClimb;
const PARTIES = [
  ['finn'],
  ['finn', 'mom'],
  ['finn', 'mom', 'ellie'],
  ['finn', 'mom', 'ellie', 'wyatt'],
];

/** Aims straight at the next path hold with exactly the right power, then grabs it mid-jump. */
function climbOne(s0: RockClimbState): RockClimbState {
  const target = nextHold(s0)!;
  const dx = target.x - s0.at.x;
  const dh = target.h - s0.at.h;
  const deg = (Math.atan2(dh, dx) * 180) / Math.PI;
  const dist = Math.hypot(dx, dh);
  // The arrow and power meter are stopped exactly where we need them.
  let s: RockClimbState = {
    ...s0,
    phase: 'jump',
    phaseAt: s0.time,
    jump: { from: s0.at, deg, dist, tried: false },
  };
  for (let k = 0; k < 120 && s.phase === 'jump'; k++) {
    const hand = handAt(s);
    if (Math.hypot(hand.x - target.x, hand.h - target.h) <= s.reach * 0.5)
      return grab(s, target.id);
    s = tick(s, 1 / 120);
  }
  return s;
}

/** A jump that goes nowhere near a hold (or the top): a fall, played out until the next aim. */
const fallOnce = (x: RockClimbState) =>
  tick(
    tick(
      {
        ...x,
        phase: 'jump',
        phaseAt: x.time,
        jump: { from: x.at, deg: 10, dist: 30, tried: false },
      },
      R.jumpSec + R.hangSec + 0.01,
    ),
    fallSec + 0.01,
  );

/** Straight up from the last hold, `past` units beyond the top line (negative: short of it). */
function jumpTop(s0: RockClimbState, past: number): RockClimbState {
  let s: RockClimbState = {
    ...s0,
    phase: 'jump',
    phaseAt: s0.time,
    jump: { from: s0.at, deg: 90, dist: s0.topH - s0.at.h + past, tried: false },
  };
  for (let k = 0; k < 400 && s.phase === 'jump'; k++) s = tick(s, 1 / 120);
  return s;
}

/** Climbs every path hold, then over the top. */
function climbAll(s0: RockClimbState): RockClimbState {
  let s = s0;
  while (!onLastMove(s) && !s.over) s = climbOne(s);
  s = jumpTop(s, 10);
  return tick(s, R.topSec + 0.01);
}

describe('Rock Climb: the sequence and the wall', () => {
  it('for 1 to 4 hikers, everyone gets the same number of turns (8 for even parties, 9 for odd)', () => {
    for (const party of PARTIES) {
      for (let seed = 1; seed <= 20; seed++) {
        const seq = makeSequence(seedRng(seed), party);
        expect(seq).toHaveLength(party.length % 2 === 0 ? R.seqEven : R.seqOdd);
        const counts = party.map((id) => seq.filter((x) => x === id).length);
        expect(new Set(counts).size).toBe(1);
      }
    }
  });

  it.each(TIERS)(
    'Tier %i: the planned path is always reachable; a decoy never strands the climber',
    (tier) => {
      for (const party of PARTIES) {
        for (let seed = 1; seed <= 10; seed++) {
          const { holds, path, topH, topColor } = planWall(
            seedRng(seed),
            tier,
            party,
            R.tiers[tier].holds,
          );
          expect(path).toHaveLength(R.tiers[tier].holds);
          // The top line: [40–70] above the last path hold; the last move has a color too.
          const last = holds[path.at(-1)!]!.h;
          expect(topH - last).toBeGreaterThanOrEqual(R.topAbove[0]);
          expect(topH - last).toBeLessThanOrEqual(R.topAbove[1]);
          expect(party).toContain(topColor);
          let p = { x: 160, h: 0 };
          for (const id of path) {
            const h = holds[id]!;
            const dist = Math.hypot(h.x - p.x, h.h - p.h);
            expect(dist).toBeGreaterThanOrEqual(R.power[0]);
            expect(dist).toBeLessThanOrEqual(R.power[1]);
            expect(h.h).toBeGreaterThan(p.h);
            expect(h.x).toBeGreaterThanOrEqual(R.wallX[0]);
            expect(h.x).toBeLessThanOrEqual(R.wallX[1]);
            p = h;
          }
          // A decoy never strands the climber: for every move needing its color from within jumping
          // range, that move's own hold is still reachable from the decoy.
          const range = R.power[1] + R.tiers[tier].reach;
          for (const d of holds.filter((h) => h.path === null && h.color !== null)) {
            path.forEach((id, k) => {
              const to = holds[id]!;
              const from = k === 0 ? { x: 160, h: 0 } : holds[path[k - 1]!]!;
              if (to.color !== d.color || Math.hypot(from.x - d.x, from.h - d.h) > range) return;
              const dist = Math.hypot(to.x - d.x, to.h - d.h);
              expect(to.h).toBeGreaterThan(d.h);
              expect(dist).toBeLessThanOrEqual(R.power[1]);
              expect(dist).toBeGreaterThanOrEqual(R.power[0]);
            });
          }
          expect(holds.filter((h) => h.path === null).length).toBeGreaterThan(0);
        }
      }
    },
  );
});

describe('Rock Climb: moves', () => {
  it('aim, hold, let go: the arrow stops where it was and the jump goes that way', () => {
    let s = newRockClimb({ tier: 1 }, ['finn', 'mom'], 3);
    s = tick(s, R.tiers[1].swingSec / 2);
    const aimed = hold(s);
    expect(aimed.phase).toBe('power');
    expect(aimed.aimDeg).toBeCloseTo(90, 0);
    const jumped = letGo(tick(aimed, R.tiers[1].powerSec));
    expect(jumped.phase).toBe('jump');
    expect(jumped.jump!.dist).toBeCloseTo(R.power[1], 0);
  });

  it('only a hold of the active hand’s color grabs, and only within reach; hands alternate', () => {
    const s0 = newRockClimb({ tier: 2 }, ['finn', 'mom'], 5);
    expect(activeHand(s0)).toBe('left');
    const target = nextHold(s0)!;
    const s = climbOne(s0);
    const other = s.holds.find((h) => h.color !== null && h.color !== activeColor(s));
    expect(s.pathAt).toBe(0);
    expect(s.at).toEqual({ x: target.x, h: target.h });
    expect(activeHand(s)).toBe('right');
    // Out of reach: queued, not grabbed; a short jump that never gets there falls.
    const far: RockClimbState = {
      ...s,
      phase: 'jump',
      phaseAt: s.time,
      jump: { from: s.at, deg: 90, dist: 5, tried: false },
    };
    const queued = grab(far, nextHold(s)!.id);
    expect(queued.jump?.queued).toBe(nextHold(s)!.id);
    expect(queued.pathAt).toBe(s.pathAt);
    // Another color: nothing.
    if (other) expect(grab(far, other.id)).toBe(far);
  });

  it.each(TIERS)(
    'Tier %i: aim and power at the next path hold, queue its grab as the jump starts: it always grabs',
    (tier) => {
      for (const party of PARTIES) {
        for (let seed = 1; seed <= 6; seed++) {
          let s = newRockClimb({ tier }, party, seed * 13 + tier);
          for (let k = 0; k < 4 && s.phase === 'aim'; k++) {
            const target = nextHold(s)!;
            const dx = target.x - s.at.x;
            const dh = target.h - s.at.h;
            s = {
              ...s,
              phase: 'jump',
              phaseAt: s.time,
              jump: {
                from: s.at,
                deg: (Math.atan2(dh, dx) * 180) / Math.PI,
                dist: Math.hypot(dx, dh),
                tried: false,
              },
            };
            s = grab(s, target.id);
            for (let t = 0; t < R.jumpSec + R.hangSec + 0.1 && s.phase === 'jump'; t += 1 / 120)
              s = tick(s, 1 / 120);
            expect(s.phase).toBe('aim');
            expect(s.at).toEqual({ x: target.x, h: target.h });
          }
        }
      }
    },
  );

  it('a jump that misses the hold by more than the reach never grabs it', () => {
    let s = newRockClimb({ tier: 1 }, ['finn'], 4);
    const target = nextHold(s)!;
    const dx = target.x - s.at.x;
    const dh = target.h - s.at.h;
    // Aimed well off to the side.
    const deg = (Math.atan2(dh, dx) * 180) / Math.PI + 60;
    s = {
      ...s,
      phase: 'jump',
      phaseAt: s.time,
      jump: { from: s.at, deg, dist: Math.hypot(dx, dh), tried: false },
    };
    s = grab(s, target.id);
    for (let t = 0; t < R.jumpSec + R.hangSec + 0.1 && s.phase === 'jump'; t += 1 / 120)
      s = tick(s, 1 / 120);
    expect(s.phase).toBe('fall');
    expect(s.pathAt).toBe(-1);
  });

  it('Space queues the active-color hold the rest of the jump passes closest to; the rings show what it can reach', () => {
    const s0 = newRockClimb({ tier: 2 }, ['finn', 'mom'], 8);
    const target = nextHold(s0)!;
    const dx = target.x - s0.at.x;
    const dh = target.h - s0.at.h;
    const s: RockClimbState = {
      ...s0,
      phase: 'jump',
      phaseAt: 0,
      jump: {
        from: s0.at,
        deg: (Math.atan2(dh, dx) * 180) / Math.PI,
        dist: Math.hypot(dx, dh),
        tried: false,
      },
    };
    expect(reachableHolds(s).map((h) => h.id)).toContain(target.id);
    expect(grabClosest(s).jump?.queued).toBe(target.id);
  });

  it('Prepare: Chalk adds reach; the Harness takes the first fall (no try, no energy); +1 try', () => {
    expect(newRockClimb({ tier: 3, extraReach: 4 }, ['finn'], 1).reach).toBe(R.tiers[3].reach + 4);
    let s = newRockClimb({ tier: 1, harness: true }, ['finn', 'mom'], 7);
    const by = activeColor(s)!;
    s = fallOnce(s);
    expect(s.triesLeft[by]).toBe(R.tries);
    expect(s.energy[by] ?? 0).toBe(0);
    expect(s.harness).toBe(false);
    s = fallOnce(s);
    expect(s.triesLeft[by]).toBe(R.tries - 1);
    expect(s.energy[by]).toBe(R.fallEnergy);
    const more = newRockClimb({ tier: 1, extraTries: { mom: 1 } }, ['finn', 'mom'], 7);
    expect(more.triesLeft).toEqual({ finn: R.tries, mom: R.tries + 1 });
  });

  it('from Tier III, one try per jump: a miss within the hand’s color uses it up', () => {
    const s0 = newRockClimb({ tier: 3 }, ['finn'], 2);
    const jumping: RockClimbState = {
      ...s0,
      phase: 'jump',
      phaseAt: 0,
      jump: { from: s0.at, deg: 90, dist: 5, tried: false },
    };
    const missed = grab(jumping, nextHold(s0)!.id);
    expect(missed.jump!.tried).toBe(true);
  });

  it('a fall costs that hand’s hiker one try and [1] energy; the same color goes again', () => {
    let s = newRockClimb({ tier: 1 }, ['finn', 'mom'], 7);
    const color = activeColor(s)!;
    for (let k = 1; k <= 2; k++) {
      s = tick(
        {
          ...s,
          phase: 'jump',
          phaseAt: s.time,
          jump: { from: s.at, deg: 10, dist: 30, tried: false },
        },
        R.jumpSec + R.hangSec + 0.01,
      );
      expect(s.phase).toBe('fall');
      s = tick(s, fallSec + 0.01);
      expect(s.phase).toBe('aim');
      expect(activeColor(s)).toBe(color);
      expect(s.pathAt).toBe(-1);
      expect(s.triesLeft[color]).toBe(R.tries - k);
      expect(s.energy[color]).toBe(R.fallEnergy * k);
    }
  });

  it('out of tries: the hiker leaves the sequence, and no hold keeps their color', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const party = ['finn', 'mom', 'ellie'];
      let s = newRockClimb({ tier: 2 }, party, seed);
      const color = activeColor(s)!;
      for (let k = 0; k < R.tries; k++) s = fallOnce(s);
      expect(s.out).toEqual([color]);
      expect(s.triesLeft[color]).toBe(0);
      expect(s.holds.some((h) => h.color === color)).toBe(false);
      expect(s.topColor).not.toBe(color);
      expect(activeColor(s)).not.toBe(color);
      expect(s.recolor?.from).toBe(color);
      // The rest of the climb is still possible: every path hold has a color still in.
      for (const id of s.path)
        expect(party.filter((h) => h !== color)).toContain(s.holds[id]!.color);
    }
  });

  it('everyone out fails everyone; their falls still cost energy', () => {
    let s = newRockClimb({ tier: 1 }, ['finn', 'mom'], 3);
    for (let k = 0; k < 2 * R.tries && !s.over; k++) s = fallOnce(s);
    expect(s.over).toBe(true);
    expect(s.out.sort()).toEqual(['finn', 'mom']);
    const r = result(s);
    expect(r.safe).toEqual([]);
    expect(r.passing?.stays).toBe(true);
    expect(r.pays?.finn!.energy).toBeGreaterThanOrEqual(R.tries * R.fallEnergy);
  });

  it('the top passes only when the hand goes above the line; no grab is needed', () => {
    let s = newRockClimb({ tier: 1 }, ['finn', 'mom'], 5);
    while (!onLastMove(s)) s = climbOne(s);
    expect(s.phase).toBe('aim');
    // Short of the line: a fall, and the last move goes again.
    const short = jumpTop(s, -5);
    expect(short.phase).toBe('fall');
    // Over it: the top.
    const over = jumpTop(s, 5);
    expect(over.phase).toBe('top');
    expect(tick(over, R.topSec + 0.01).over).toBe(true);
  });

  it('no timer by default; a testing Time still ends it', () => {
    let s = newRockClimb({ tier: 3 }, ['finn'], 1);
    expect(s.timeSec).toBe(0);
    s = tick(s, 500);
    expect(s.over).toBe(false);
    let late = newRockClimb({ tier: 1, timeSec: 2 }, ['finn', 'mom'], 1);
    late = tick(late, 2.01);
    expect(late.over).toBe(true);
    expect(result(late).safe).toEqual([]);
    expect(result(late).passing?.stays).toBe(true);
  });

  it('over the top: every hiker still in passes (falls or not); everyone pays for their falls; out hikers pay nothing more', () => {
    for (const party of PARTIES) {
      let s = newRockClimb({ tier: 1 }, party, 11);
      // One fall first.
      const faller = activeColor(s)!;
      s = fallOnce(s);
      s = climbAll(s);
      expect(s.over).toBe(true);
      const r = result(s);
      expect(r.safe).toEqual(party);
      expect(r.pays?.[faller]).toEqual({ energy: R.fallEnergy });
      expect(r.passing?.stays).toBe(false);
    }
    // A hiker who's out stays back, paying only for their falls.
    let s = newRockClimb({ tier: 1 }, ['finn', 'mom', 'ellie'], 4);
    const out = activeColor(s)!;
    for (let k = 0; k < R.tries; k++) s = fallOnce(s);
    s = climbAll(s);
    const r = result(s);
    expect(r.safe).not.toContain(out);
    expect(r.passing?.goBack).toEqual([out]);
    expect(r.pays?.[out]).toEqual({ energy: R.tries * R.fallEnergy });
  });
});
