import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { END, hiker, place, run, trailGame } from '../../engine/test/fixtures';
import { describeLog } from './describeLog';

describe('morale types in the trail log (Phase 10.7)', () => {
  it('“Finn +1 Morale (Extrovert).”', () => {
    const s = trailGame(['finn', 'ellie', 'mom']);
    for (const h of s.hikers) if (h.id !== 'finn') delete h.moraleType;
    place(s, 'finn', 'T', { morale: 5 });
    expect(s.hikers.length).toBeGreaterThanOrEqual(BALANCE.moraleTypes.crowd);
    const after = run(s, END);
    expect(hiker(after, 'finn').stats.morale).toBe(6);
    expect(describeLog(after).map((l) => l.text)).toContain('Finn +1 Morale (Extrovert).');
  });
});
