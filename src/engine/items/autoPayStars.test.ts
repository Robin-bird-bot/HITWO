import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../content';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import { autoPay, blueprintKey } from './craft';

describe('auto-fill spends spare resources first (35-ui-overhaul.md, section 6)', () => {
  // The Sack: Grass 3, Fur 1, any 2.
  const sack = ITEMS.sack!.recipe!;
  const shelterWithStone = Object.values(ITEMS).find((d) =>
    d.recipe?.some((p) => p.ids?.includes('stone')),
  );

  it('picks a spare, then one a starred recipe needs, then a starred one', () => {
    let s = fixtureGame();
    if (shelterWithStone) {
      s = run(s, { type: 'star', what: 'recipe', id: blueprintKey(shelterWithStone.id), on: true });
    }
    s = run(s, { type: 'star', what: 'resource', id: 'clay', on: true });
    hiker(s, 'ash').inventory.resources = { grass: 3, fur: 1, clay: 1, stone: 1, wood: 1 };
    const anyTwo = autoPay(s, hiker(s, 'ash'), sack).slice(4);
    expect(anyTwo.map((p) => p?.resource)).toEqual(['wood', 'stone']);

    // With only the starred one left, it still pays.
    hiker(s, 'ash').inventory.resources = { grass: 3, fur: 1, clay: 2 };
    expect(
      autoPay(s, hiker(s, 'ash'), sack)
        .slice(4)
        .map((p) => p?.resource),
    ).toEqual(['clay', 'clay']);
  });

  it('takes the crafter’s own first inside a group', () => {
    const s = fixtureGame();
    place(s, 'birch', hiker(s, 'ash').tileId);
    hiker(s, 'ash').inventory.resources = { grass: 3, fur: 1, wood: 1 };
    hiker(s, 'birch').inventory.resources = { wood: 5 };
    const anyTwo = autoPay(s, hiker(s, 'ash'), sack).slice(4);
    expect(anyTwo).toEqual([
      { from: 'ash', resource: 'wood' },
      { from: 'birch', resource: 'wood' },
    ]);
  });
});
