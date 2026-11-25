/**
 * Passing challenges (docs/design/14-minigames-trail-blocks.md, section 1):
 * moving on, going back, and what happens when nobody passes.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { passingResult, payText } from './passing';

const P = BALANCE.minigames.passing;
const THREE = ['finn', 'mom', 'ellie'];

describe('passing challenges', () => {
  it('passers move on, the rest go back and pay their own cost, and the challenge is gone', () => {
    const r = passingResult(THREE, 2, ['finn', 'ellie'], {
      mom: { resources: 1, conditions: ['bleeding'] },
    });
    expect(r.passing).toEqual({ moveOn: ['finn', 'ellie'], goBack: ['mom'], stays: false });
    expect(r.safe).toEqual(['finn', 'ellie']);
    expect(r.hit.map((h) => h.hikerId)).toEqual(['mom']);
    expect(r.pays).toEqual({ mom: { resources: 1, conditions: ['bleeding'] } });
  });

  it.each([1, 2, 3] as const)(
    'Tier %i: nobody passes, so everyone goes back losing the tier’s energy, and it stays face up',
    (tier) => {
      const r = passingResult(THREE, tier, [], { finn: { energy: 1 }, mom: { resources: 1 } });
      expect(r.passing).toEqual({ moveOn: [], goBack: THREE, stays: true });
      const e = P.nobodyEnergy[tier];
      expect(r.pays?.finn).toEqual({ energy: Math.max(1, e) });
      expect(r.pays?.mom).toEqual({ resources: 1, energy: e });
      expect(r.pays?.ellie).toEqual({ energy: e });
    },
  );

  it('a passer can still pay (a Trail Block hiker who ran out)', () => {
    const r = passingResult(THREE, 1, THREE, { mom: { energy: 1 } });
    expect(r.passing?.stays).toBe(false);
    expect(r.hit).toEqual([]);
    expect(r.pays).toEqual({ mom: { energy: 1 } });
  });

  it('costs read plainly', () => {
    expect(payText({ energy: 2 })).toBe('−2 Energy');
    expect(payText({ resources: 1, conditions: ['bleeding'] })).toBe('−1 resource · Bleeding');
    expect(payText(undefined)).toBe('');
  });
});
