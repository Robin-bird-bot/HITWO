/**
 * Work costs Energy, moving costs Appetite (docs/design/29-core-loop.md,
 * section 1): scavenging, tending and crafting take Energy, and everything
 * that made them cheaper works on Energy now.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { addCondition } from '../conditions';
import { craftCost } from './craft';
import { scavengeCost } from '../scavenge/setup';
import { fixtureGame, fixtureHiker, hiker, place, run } from '../test/fixtures';
import { moveCost } from '../costs';
import { makeItem } from '../items/make';
import { tendCost } from './tend';
import type { HikerSetup } from '../newGame';
import type { GameState } from '../types';

const withTraits = (traits: string[]): GameState => {
  const hikers: HikerSetup[] = ['ash', 'birch', 'cedar', 'dot'].map((id) =>
    fixtureHiker(id, id === 'ash' ? traits : []),
  );
  return fixtureGame({ hikers });
};

describe('work costs Energy', () => {
  it('scavenging, tending and crafting cost their Energy; moving still costs Appetite', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const ash = hiker(s, 'ash');
    expect(scavengeCost(s, ash)).toBe(BALANCE.scavenge.energy);
    expect(tendCost(s, ash)).toBe(BALANCE.abundance.tendEnergy);
    expect(craftCost(s, ash)).toBe(BALANCE.items.craft.energy);
    expect(moveCost(s, 'ash', 'M')?.appetite).toBeGreaterThan(0);
  });

  it('crafting takes 1 Energy and no Appetite, paid when it happens', () => {
    let s = fixtureGame();
    hiker(s, 'ash').inventory.resources = { wood: 2, stone: 2, moss: 1 };
    s = run(s, { type: 'craft', hikerId: 'ash', itemType: 'tool' });
    expect(hiker(s, 'ash').stats).toMatchObject({
      energy: 10 - BALANCE.items.craft.energy,
      appetite: 10,
    });
    s = run(s, { type: 'craftTake', index: 0 });
    expect(hiker(s, 'ash').stats.energy).toBe(10 - BALANCE.items.craft.energy);
  });

  it('the Shovel, Pirate and Rabbit Diet make scavenging free of Energy', () => {
    const shovel = fixtureGame();
    place(shovel, 'ash', 'L');
    const tool = makeItem(shovel, 'shovel', { prefix: 'test', quality: 3 });
    hiker(shovel, 'ash').inventory.bag.push(tool);
    const used = run(shovel, {
      type: 'useItem',
      hikerId: 'ash',
      itemUid: tool.uid,
      targetId: 'ash',
    });
    expect(scavengeCost(used, hiker(used, 'ash'))).toBe(0);

    const pirate = withTraits(['pirate']);
    place(pirate, 'ash', 'L');
    expect(scavengeCost(pirate, hiker(pirate, 'ash'))).toBe(0);

    const rabbit = withTraits(['rabbitDiet']);
    place(rabbit, 'ash', 'L');
    expect(scavengeCost(rabbit, hiker(rabbit, 'ash'))).toBe(0);
  });

  it('Refreshed stops the Energy of work; Full stops only the Appetite of moves', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    addCondition(s, hiker(s, 'ash'), 'full', 1, 'days', 'test');
    expect(scavengeCost(s, hiker(s, 'ash'))).toBe(BALANCE.scavenge.energy);
    expect(moveCost(s, 'ash', 'M')?.appetite).toBe(0);
    addCondition(s, hiker(s, 'ash'), 'refreshed', 1, 'days', 'test');
    expect(scavengeCost(s, hiker(s, 'ash'))).toBe(0);
    expect(tendCost(s, hiker(s, 'ash'))).toBe(0);
    expect(craftCost(s, hiker(s, 'ash'))).toBe(0);
  });
});
