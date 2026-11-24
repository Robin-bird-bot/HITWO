import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS, isOffered } from '../../content/items';
import { itemText } from '../items/text';
import { gainXp } from '../xp';
import { validateAction } from '../applyAction';
import { makeItem } from '../items/make';
import type { HikerSetup } from '../newGame';
import { END, fixtureGame, fixtureHiker, hiker, run } from '../test/fixtures';
import type { Action, Family, GameState, SlotType } from '../types';
import { xpForLevel } from '../xp';

interface Who {
  slots: { type: SlotType; traitId?: string | null; setting?: { x: string } }[];
  family?: Family;
}

/** Ash and Birch on the trailhead with these slots. */
function game(ash: Who, birch: Who = { slots: [{ type: 'T', traitId: 'leader' }] }, seed = 1) {
  const setup = (id: string, w: Who): HikerSetup => ({
    ...fixtureHiker(id),
    family: w.family ?? 'human',
    slots: w.slots.map((s) => ({
      type: s.type,
      traitId: s.traitId ?? null,
      ...(s.setting ? { setting: s.setting } : {}),
    })),
  });
  return fixtureGame({ seed, hikers: [setup('ash', ash), setup('birch', birch)] });
}
/** Gives Ash the trinket and returns the action that uses it. */
function trinket(s: GameState, itemId: string, extra: Partial<Action> = {}): Action {
  const item = makeItem(s, itemId);
  hiker(s, 'ash').inventory.bag.push(item);
  return {
    type: 'useItem',
    hikerId: 'ash',
    itemUid: item.uid,
    targetId: 'ash',
    ...extra,
  } as Action;
}

describe('Diploma', () => {
  it('a big share of a level’s XP, and the level waits for camp', () => {
    const step = xpForLevel(1) - xpForLevel(0);
    const { min, max } = BALANCE.items.diplomaXp;
    for (let seed = 1; seed <= 10; seed++) {
      const s = game({ slots: [{ type: 'W' }] }, undefined, seed);
      const after = run(s, trinket(s, 'diploma'));
      const xp = hiker(after, 'ash').xp;
      expect(xp).toBeGreaterThanOrEqual(Math.ceil(step * min));
      expect(xp).toBeLessThanOrEqual(Math.ceil(step * max));
      expect(hiker(after, 'ash').inventory.bag).toHaveLength(0);
    }
  });
});

describe('retired trinkets (Phase 10.7: no more giving or swapping traits)', () => {
  it.each(['cherishedPhoto', 'familyPhoto', 'oldPhoto', 'instructionManual'])(
    '%s: never offered; one already in a pack does nothing and reads “Retired”',
    (id) => {
      expect(ITEMS[id]?.retired).toBe(true);
      expect(isOffered(ITEMS[id])).toBe(false);
      expect(itemText(ITEMS[id]!)).toBe('Retired.');
      const s = game({ slots: [{ type: 'W' }] });
      expect(validateAction(s, trinket(s, id, { choice: 'T' }))).toBe(
        `The ${ITEMS[id]?.name} is retired: it doesn’t do anything now.`,
      );
    },
  );
});

describe('trinkets that wear out (Phase 10.7)', () => {
  const carry = (s: GameState, id: string) => {
    const item = makeItem(s, id);
    hiker(s, 'ash').inventory.bag.push(item);
    return item;
  };

  it('Field Notebook: XP from scavenging is doubled; −1 durability each time; gone at 0', () => {
    const s = game({ slots: [] });
    const book = carry(s, 'fieldNotebook');
    expect(book.durability).toBe(BALANCE.items.fieldNotebook.durability);
    expect(gainXp(s, hiker(s, 'ash'), 2, 'scavenge', 'test')).toBe(4);
    expect(book.durability).toBe(BALANCE.items.fieldNotebook.durability - 1);
    // Other XP isn't doubled, and doesn't wear it.
    expect(gainXp(s, hiker(s, 'ash'), 2, 'challenge', 'test')).toBe(2);
    expect(book.durability).toBe(BALANCE.items.fieldNotebook.durability - 1);
    book.durability = 1;
    gainXp(s, hiker(s, 'ash'), 2, 'scavenge', 'test');
    expect(hiker(s, 'ash').inventory.bag).toHaveLength(0);
  });

  it('Merit Badge: +3 XP for each challenge passed; −1 durability every phase', () => {
    let s = game({ slots: [] });
    const badge = carry(s, 'meritBadge');
    expect(gainXp(s, hiker(s, 'ash'), 2, 'challenge', 'test')).toBe(
      2 + BALANCE.items.meritBadge.xp,
    );
    expect(gainXp(s, hiker(s, 'ash'), 2, 'craft', 'test')).toBe(2);
    s = run(s, END);
    const worn = hiker(s, 'ash').inventory.bag.find((i) => i.uid === badge.uid);
    expect(worn?.durability).toBe(BALANCE.items.meritBadge.durability - 1);
    worn!.durability = 1;
    s = run(s, END);
    expect(hiker(s, 'ash').inventory.bag).toHaveLength(0);
  });

  it('both are offered like other Tier 2 trinkets', () => {
    for (const id of ['fieldNotebook', 'meritBadge']) {
      expect(ITEMS[id]?.tier).toBe(2);
      expect(isOffered(ITEMS[id])).toBe(true);
    }
  });
});

describe('a Diploma', () => {
  it('fills most of the way to the party’s next level (Phase 10.7)', () => {
    let s = game({ slots: [{ type: 'W' }] });
    s = run(s, trinket(s, 'diploma'));
    const xp = s.party?.xp ?? 0;
    const { min, max } = BALANCE.items.diplomaXp;
    expect(xp).toBeGreaterThanOrEqual(Math.ceil(xpForLevel(1) * min));
    expect(xp).toBeLessThanOrEqual(Math.ceil(xpForLevel(1) * max));
    expect(hiker(s, 'ash').pendingLevels).toBeUndefined();
    expect(s.traitPick).toBeUndefined();
  });
});
