import { describe, expect, it } from 'vitest';
import { fixtureGame, run } from '../../engine/test/fixtures';
import { aheadChips, marketChips, talkLine } from './stationTalk';

/** Everyone checked in at Finn's, the first station. */
function station() {
  return run(fixtureGame({ seed: 5 }), {
    type: 'debug',
    op: { kind: 'openStation', themeId: 'finn' },
  });
}

describe('the shopkeeper’s talk', () => {
  it('greets with the doc’s quote at the first station', () => {
    expect(talkLine(station(), 'greet')).toContain('Pets first, then shopping!');
  });

  it('“What’s selling?”: ×2 chips for the 4 high resources, ×½ for the 4 low ones', () => {
    const s = station();
    const chips = marketChips(s);
    expect(chips.filter((c) => c.text === '×2')).toHaveLength(4);
    expect(chips.filter((c) => c.text === '×½')).toHaveLength(4);
    expect(chips.every((c) => !!c.img)).toBe(true);
  });

  it('“What’s ahead?”: the next section’s tier and common nodes, then the biome’s chips', () => {
    const chips = aheadChips(station());
    expect(chips[0]?.text).toBe('TIER II');
    expect(chips.some((c) => c.text.endsWith('COMMON'))).toBe(true);
    expect(chips.map((c) => c.text)).toContain('RAIN MOST DAYS');
  });
});
