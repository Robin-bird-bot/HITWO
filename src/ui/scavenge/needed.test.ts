import { describe, expect, it } from 'vitest';
import { fixtureGame, hiker, run } from '../../engine/test/fixtures';
import { basicKey, blueprintKey, starredRecipes, wantedRibbon } from './needed';

describe('needed (35-ui-overhaul.md, section 5)', () => {
  it('marks a card NEEDED only while a starred recipe still lacks it', () => {
    let s = run(fixtureGame(), {
      type: 'star',
      what: 'recipe',
      id: blueprintKey('sack'),
      on: true,
    });
    const ash = () => hiker(s, 'ash');
    expect(wantedRibbon(s, ash(), ['grass'])).toBe('NEEDED · SACK');
    expect(wantedRibbon(s, ash(), ['fur'])).toBe('NEEDED · SACK');
    // Once the party holds the Sack's Grass (and enough for its "any 2"), Grass isn't needed.
    s = structuredClone(s);
    ash().inventory.resources = { grass: 5 };
    expect(wantedRibbon(s, ash(), ['grass'])).not.toBe('NEEDED · SACK');
    expect(wantedRibbon(s, ash(), ['fur'])).toBe('NEEDED · SACK');
    // Everything paid: nothing is needed.
    ash().inventory.resources = { grass: 3, fur: 1, wood: 2 };
    expect(wantedRibbon(s, ash(), ['fur'])).toBeNull();
    expect(starredRecipes(s, ash())[0]?.missing).toBe(0);
  });

  it('marks a starred resource STARRED, and nothing else', () => {
    const s = run(fixtureGame(), { type: 'star', what: 'resource', id: 'wood', on: true });
    expect(wantedRibbon(s, hiker(s, 'ash'), ['wood'])).toBe('STARRED');
    expect(wantedRibbon(s, hiker(s, 'ash'), ['stone'])).toBeNull();
    expect(wantedRibbon(s, hiker(s, 'ash'), [])).toBeNull();
  });

  it('names basic recipes by type and tier', () => {
    const s = run(fixtureGame(), {
      type: 'star',
      what: 'recipe',
      id: basicKey('tool', 2),
      on: true,
    });
    expect(starredRecipes(s, hiker(s, 'ash'))[0]?.name).toBe('Tools · Tier II');
  });
});
