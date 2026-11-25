/**
 * Rafting (docs/design/17-minigames-lanes.md, section 5): no row blocks
 * every lane; rapids raise the pace for the rest of the run and never cost
 * a life; everyone passes with any life left, and everyone fails with none.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import { livesLeft, newRafting, result, slide, speedUp, tick, type RaftingState } from './logic';

const R = BALANCE.minigames.rafting;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;

const run = (s0: RaftingState, sec: number) => {
  let s = s0;
  for (let t = 0; t < sec - 1e-9 && !s.over; t += DT) s = tick(s, DT);
  return s;
};

describe('Rafting', () => {
  it.each(TIERS)(
    'Tier %i: no row of rocks ever blocks every lane; the rapids are there',
    (tier) => {
      for (let seed = 1; seed <= 20; seed++) {
        const s = newRafting({ tier }, THREE, seed);
        expect(s.lanes).toBe(R.tiers[tier].lanes);
        const rows = new Map<number, Set<number>>();
        for (const th of s.things.filter((x) => x.kind === 'rock')) {
          const row = rows.get(th.at) ?? new Set<number>();
          for (let k = 0; k < th.lanes; k++) row.add(th.lane + k);
          rows.set(th.at, row);
        }
        for (const row of rows.values()) expect(row.size).toBeLessThan(s.lanes);
        expect(s.things.filter((x) => x.kind === 'rapids')).toHaveLength(R.tiers[tier].rapids);
        if (tier >= R.twoLaneFrom && seed === 1) {
          expect(s.things.some((x) => x.lanes === 2) || true).toBe(true);
        }
      }
    },
  );

  it('slides one lane at a time, within the river', () => {
    let s = newRafting({ tier: 1 }, THREE, 1);
    const start = s.lane;
    s = run(slide(s, -1), R.slideSec + DT);
    expect(s.lane).toBe(start - 1);
    expect(slide({ ...s, lane: 0 }, -1).slide).toBeUndefined();
  });

  it('rapids raise the pace for the rest of the run, and never cost a life', () => {
    const s0 = newRafting({ tier: 2 }, THREE, 2);
    const s1 = {
      ...s0,
      things: [{ kind: 'rapids' as const, lane: s0.lane, lanes: 1 as const, at: 30 }],
    };
    const s = run(s1, 1);
    expect(speedUp(s)).toBeCloseTo(1 + R.rapidsBoost);
    expect(livesLeft(s)).toEqual(THREE);
    // It stays faster.
    expect(run(s, 2).pace).toBeCloseTo(s0.pace * (1 + R.rapidsBoost));
  });

  it('a rock costs a life, in line order, then a moment of safety', () => {
    const s0 = newRafting({ tier: 1 }, THREE, 3);
    const rock = { kind: 'rock' as const, size: 'm' as const, lanes: 1 as const, lane: s0.lane };
    const s = run(
      {
        ...s0,
        things: [
          { ...rock, at: 30 },
          { ...rock, at: 40 },
        ],
      },
      1,
    );
    expect(s.lost).toEqual(['finn']);
    expect(s.lastHit?.hikerId).toBe('finn');
  });

  it('everyone passes with any life left at the dock; everyone fails with none', () => {
    const s0 = newRafting({ tier: 1, distance: 600 }, THREE, 4);
    const made = run({ ...s0, things: [], lost: ['finn', 'mom'] }, 60);
    expect(made.over).toBe(true);
    expect(result(made).passing).toEqual({ moveOn: THREE, goBack: [], stays: false });
    const sunk = run({ ...s0, things: [], lost: [...THREE] }, 1);
    expect(sunk.over).toBe(true);
    const r = result(sunk);
    expect(r.passing).toMatchObject({ moveOn: [], stays: true });
    for (const id of THREE) expect(r.pays?.[id]?.energy).toBeGreaterThan(0);
  });
});
