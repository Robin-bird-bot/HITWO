import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../content';
import { blueprintKey } from '../../engine';
import { fixtureGame, hiker } from '../../engine/test/fixtures';
import { arrange, craftables, matchBench } from './bench';

const slot = (resource: string) => ({ from: 'ash', resource });

describe('the workbench by hand (35-ui-overhaul.md, section 6)', () => {
  const sack = ITEMS.sack?.recipe ?? [];

  it('arranges resources into a recipe’s spaces, in any order', () => {
    const bench = ['wood', 'grass', 'fur', 'grass', 'stone', 'grass'].map(slot);
    const ordered = arrange(sack, bench);
    expect(ordered?.map((s) => s.resource).slice(0, 4)).toEqual(['grass', 'grass', 'grass', 'fur']);
    expect(
      ordered
        ?.map((s) => s.resource)
        .slice(4)
        .sort(),
    ).toEqual(['stone', 'wood']);
    // One short, or one that fits nowhere: no match.
    expect(arrange(sack, bench.slice(1))).toBeNull();
    expect(
      arrange(sack, ['wood', 'grass', 'clay', 'grass', 'stone', 'grass'].map(slot)),
    ).toBeNull();
  });

  it('keeps a key part all one resource (2 Fur or Moss)', () => {
    const s = fixtureGame();
    const ash = hiker(s, 'ash');
    ash.inventory.resources = { fur: 2, wood: 1, mushroom: 1, moss: 1 };
    // Moss fits both the key part and the Forest part; the Fur pair has to stay together.
    const bench = ['moss', 'fur', 'wood', 'fur', 'mushroom'].map(slot);
    const m = matchBench(s, ash, bench, 'basic:clothes:1');
    expect(m?.craftable.key).toBe('basic:clothes:1');
    expect(m?.ordered.slice(0, 2).map((p) => p.resource)).toEqual(['fur', 'fur']);
  });

  it('names the recipe a bench filled by hand makes', () => {
    const s = fixtureGame();
    const ash = hiker(s, 'ash');
    ash.blueprints = ['sack'];
    ash.inventory.resources = { grass: 3, fur: 1, wood: 1, stone: 1 };
    expect(craftables(s, ash).some((c) => c.key === blueprintKey('sack'))).toBe(true);
    const bench = ['stone', 'grass', 'grass', 'fur', 'wood', 'grass'].map(slot);
    const m = matchBench(s, ash, bench, blueprintKey('sack'));
    expect(m?.craftable.key).toBe(blueprintKey('sack'));
    expect(m?.ordered.map((p) => p.resource).slice(0, 4)).toEqual([
      'grass',
      'grass',
      'grass',
      'fur',
    ]);
    // More of one than the party has: no match.
    ash.inventory.resources = { grass: 2, fur: 1, wood: 1, stone: 1 };
    expect(matchBench(s, ash, bench, blueprintKey('sack'))?.craftable.key).not.toBe(
      blueprintKey('sack'),
    );
  });
});
