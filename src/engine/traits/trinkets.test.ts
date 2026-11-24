import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TRAITS } from '../../content/traits';
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
const traitsOf = (s: GameState, id: string) => hiker(s, id).slots.map((x) => x.traitId);

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

describe('Cherished Photo', () => {
  it('a random Trail or Utility trait, into an empty slot', () => {
    const s = game({ slots: [{ type: 'M', traitId: 'zen' }, { type: 'T/U' }] });
    const after = run(s, trinket(s, 'cherishedPhoto'));
    const got = TRAITS[traitsOf(after, 'ash')[1] ?? '']!;
    expect(['T', 'U']).toContain(got.type);
    expect(got.kind === 'special' || got.kind === 'unique').toBe(false);
  });

  it('needs an empty Trail or Utility slot', () => {
    const s = game({ slots: [{ type: 'T', traitId: 'leader' }, { type: 'M' }] });
    expect(validateAction(s, trinket(s, 'cherishedPhoto'))).toBe(
      'Ash has no empty slot for a new Trail or Utility trait.',
    );
  });
});

describe('Family Photo', () => {
  const copy = (s: GameState, choice: string) => trinket(s, 'familyPhoto', { choice });

  it('copies a trait from another hiker, setting and all', () => {
    const s = game(
      { slots: [{ type: 'U' }] },
      { slots: [{ type: 'U', traitId: 'finder', setting: { x: 'river' } }] },
    );
    const after = run(s, copy(s, 'birch|0'));
    expect(hiker(after, 'ash').slots[0]).toMatchObject({
      traitId: 'finder',
      setting: { x: 'river' },
    });
    expect(traitsOf(after, 'birch')).toEqual(['finder']);
  });

  it('gives the version for the receiver’s family', () => {
    const s = game(
      { slots: [{ type: 'U' }], family: 'cat' },
      { slots: [{ type: 'U', traitId: 'copier' }] },
    );
    expect(traitsOf(run(s, copy(s, 'birch|0')), 'ash')).toEqual(['copycat']);
  });

  it('not special traits, and only into an empty slot that fits', () => {
    const special = game({ slots: [{ type: 'U' }] }, { slots: [{ type: 'U', traitId: 'mentor' }] });
    expect(validateAction(special, copy(special, 'birch|0'))).toBe('Mentor can’t be copied.');
    const full = game({ slots: [{ type: 'T' }] }, { slots: [{ type: 'U', traitId: 'forager' }] });
    expect(validateAction(full, copy(full, 'birch|0'))).toBe('Ash has no empty slot for Forager.');
    expect(validateAction(full, trinket(full, 'familyPhoto'))).toBe('Pick a trait to copy.');
  });
});

describe('Old Photo', () => {
  it('opens a pick of up to 3 traits of the same type and tier for that slot', () => {
    let s = game({
      slots: [
        { type: 'T', traitId: 'leader' },
        { type: 'U', traitId: 'forager' },
      ],
    });
    s = run(s, trinket(s, 'oldPhoto', { choice: '0' }));
    expect(s.traitPick).toMatchObject({ hikerId: 'ash', source: 'oldPhoto', slot: 0 });
    const options = s.traitPick!.options;
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
    for (const o of options) {
      const def = o.kind === 'trait' ? TRAITS[o.traitId] : undefined;
      expect(def).toMatchObject({ type: 'T', tier: TRAITS.leader!.tier });
      expect(def?.id).not.toBe('leader');
    }
    expect(validateAction(s, END)).toBe('Pick a trait for the Old Photo first.');
    const first = options[0]!;
    s = run(s, { type: 'pickTrait', option: 0 });
    expect(traitsOf(s, 'ash')[0]).toBe(first.kind === 'trait' ? first.traitId : undefined);
    expect(traitsOf(s, 'ash')[1]).toBe('forager');
    // An Old Photo isn't a level-up.
    expect(hiker(s, 'ash').level).toBe(0);
  });

  it('can’t swap a special trait, or an empty slot', () => {
    const s = game({ slots: [{ type: 'U', traitId: 'mentor' }, { type: 'T' }] });
    expect(validateAction(s, trinket(s, 'oldPhoto', { choice: '0' }))).toBe(
      'Old Photo can’t replace that trait.',
    );
    expect(validateAction(s, trinket(s, 'oldPhoto', { choice: '1' }))).toBe(
      'Ash has no trait there.',
    );
  });
});

describe('Instruction Manual', () => {
  it('adds the slot picked: Trail, Utility or a mixed one', () => {
    const s = game({ slots: [{ type: 'T' }] });
    const after = run(s, trinket(s, 'instructionManual', { choice: 'U/M' }));
    expect(hiker(after, 'ash').slots.at(-1)).toEqual({ type: 'U/M', traitId: null });
    expect(validateAction(s, trinket(s, 'instructionManual', { choice: 'W' }))).toBe(
      'That kind of slot isn’t one of the choices.',
    );
  });

  it('never past 6 slots', () => {
    const s = game({ slots: Array.from({ length: 6 }, () => ({ type: 'T' as SlotType })) });
    expect(validateAction(s, trinket(s, 'instructionManual', { choice: 'T' }))).toBe(
      'Ash already has 6 slots.',
    );
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
