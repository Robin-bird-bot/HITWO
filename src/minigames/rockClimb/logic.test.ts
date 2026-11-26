/**
 * Rock Climb (docs/design/19-minigames-signs-trails.md, sections 4 and 7):
 * for 1 to 4 hikers the sequence gives everyone equal turns; only
 * same-color holds grab, within reach; a fall fails that hiker only once;
 * the planned path is always reachable.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import {
  activeColor,
  activeHand,
  grab,
  grabClosest,
  handAt,
  reachableHolds,
  hold,
  letGo,
  makeSequence,
  newRockClimb,
  nextHold,
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
          const { holds, path } = planWall(seedRng(seed), tier, party, R.tiers[tier].holds);
          expect(path).toHaveLength(R.tiers[tier].holds);
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
            expect(s.phase === 'aim' || s.phase === 'top').toBe(true);
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
    expect(s.phase).toBe('slide');
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

  it('Prepare: Chalk adds reach; the Harness takes the first fall', () => {
    expect(newRockClimb({ tier: 3, extraReach: 4 }, ['finn'], 1).reach).toBe(R.tiers[3].reach + 4);
    let s = newRockClimb({ tier: 1, harness: true }, ['finn', 'mom'], 7);
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
        R.slideSec + 0.01,
      );
    s = fallOnce(s);
    expect(s.fell).toEqual([]);
    expect(s.harness).toBe(false);
    s = fallOnce(s);
    expect(s.fell).toHaveLength(1);
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

  it('a fall fails that hand’s hiker once; the same color goes again', () => {
    let s = newRockClimb({ tier: 1 }, ['finn', 'mom'], 7);
    const color = activeColor(s)!;
    for (let k = 0; k < 2; k++) {
      s = {
        ...s,
        phase: 'jump',
        phaseAt: s.time,
        jump: { from: s.at, deg: 10, dist: 30, tried: false },
      };
      s = tick(s, R.jumpSec + R.hangSec + 0.01);
      expect(s.phase).toBe('slide');
      s = tick(s, R.slideSec + 0.01);
      expect(s.phase).toBe('aim');
      expect(activeColor(s)).toBe(color);
      expect(s.pathAt).toBe(-1);
    }
    expect(s.fell).toEqual([color]);
  });

  it('the top in time: hikers who never fell pass; time running out: nobody passes', () => {
    for (const party of PARTIES) {
      let s = newRockClimb({ tier: 1 }, party, 11);
      // One fall first.
      const faller = activeColor(s)!;
      s = tick(
        {
          ...s,
          phase: 'jump',
          phaseAt: s.time,
          jump: { from: s.at, deg: 10, dist: 30, tried: false },
        },
        R.jumpSec + R.hangSec + 0.01,
      );
      s = tick(s, R.slideSec + 0.01);
      while (s.phase !== 'top' && !s.over) s = climbOne(s);
      s = tick(s, 0.01);
      expect(s.over).toBe(true);
      const r = result(s);
      expect(r.safe).toEqual(party.filter((id) => id !== faller));
      expect(r.passing?.stays).toBe(party.length === 1);
    }
    let late = newRockClimb({ tier: 1, timeSec: 2 }, ['finn', 'mom'], 1);
    late = tick(late, 2.01);
    expect(late.over).toBe(true);
    expect(result(late).safe).toEqual([]);
    expect(result(late).passing?.stays).toBe(true);
  });
});
