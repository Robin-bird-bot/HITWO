import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLASS_COLORS, classesOf } from '../../content/classes';
import { TRAITS } from '../../content/traits';
import { xpForLevel } from '../../engine';
import type { HikerSetup } from '../../engine/newGame';
import { fixtureGame, fixtureHiker, hiker, run } from '../../engine/test/fixtures';
import type { GameState, SlotType, TraitOption } from '../../engine/types';
import { LevelUpScreen } from './LevelUpScreen';
import {
  ANY_CLASS,
  canPlace,
  cardScale,
  NEW_SLOT,
  offersSlot,
  optionCard,
  pickAction,
  targetsFor,
  xpBar,
} from './levelUpView';

/** Ash, a Tank, with these slots and a level-up open offering these options. */
function game(
  options: TraitOption[],
  slots: { type: SlotType; traitId?: string | null }[] = [
    { type: 'T', traitId: 'leader' },
    { type: 'U' },
    { type: 'T/U' },
    { type: 'M', traitId: null },
  ],
): GameState {
  const ash: HikerSetup = {
    ...fixtureHiker('ash'),
    classes: ['leader'],
    slots: slots.map((s) => ({ type: s.type, traitId: s.traitId ?? null })),
  };
  const s = fixtureGame({ seed: 3, hikers: [ash, fixtureHiker('birch')] });
  hiker(s, 'ash').pendingLevels = 1;
  s.traitPick = { hikerId: 'ash', source: 'levelUp', level: 1, options };
  return s;
}
const ash = (s: GameState) => hiker(s, 'ash');
const trait = (traitId: string): TraitOption => ({ kind: 'trait', traitId });

/** A Trail or Utility trait in one class and not another (nor Jack, nor general). */
const classTrait = (cls: string, not: string) =>
  Object.values(TRAITS).find(
    (d) =>
      d.type === 'T' &&
      !d.kind &&
      !d.setting &&
      d.id !== 'strong' &&
      d.id !== 'backtracker' &&
      classOf(d.id, cls) &&
      !classOf(d.id, not) &&
      !classOf(d.id, 'jack'),
  )!;
const classOf = (id: string, cls: string) =>
  classesOf({ id, group: TRAITS[id]?.group }).includes(cls as never);

describe('option cards', () => {
  it('a trait from one of the hiker’s roles: tagged with the role, in its color', () => {
    const def = classTrait('leader', 'scout');
    const card = optionCard(ash(game([])), trait(def.id));
    expect(card.name).toBe(def.name.toUpperCase());
    expect(card.source).toEqual({ label: 'LEADER', color: CLASS_COLORS.leader });
    expect(card.ring).toBe('#F2B950');
    expect(card.fill).toBe('#8A6320');
  });

  it('a trait from another class is a wild card', () => {
    const def = classTrait('scout', 'leader');
    expect(optionCard(ash(game([])), trait(def.id)).source).toEqual(ANY_CLASS);
    expect(ANY_CLASS.label).toBe('WILD CARD · ANY CLASS');
  });

  it('a usable trait says so and is round; a Morale trait has no tag', () => {
    const usable = Object.values(TRAITS).find((d) => d.ability && d.type === 'U' && !d.setting)!;
    const card = optionCard(ash(game([])), trait(usable.id));
    expect(card.typeLine).toBe('UTILITY · USABLE');
    expect(card.badge.shape).toBe('circle');
    const morale = Object.values(TRAITS).find((d) => d.type === 'M' && !d.ability && !d.setting)!;
    const m = optionCard(ash(game([])), trait(morale.id));
    expect(m.typeLine).toBe('MORALE');
    expect(m.badge.shape).toBe('diamond');
    expect(m.source).toBeUndefined();
  });

  it('a new slot is a card too', () => {
    const card = optionCard(ash(game([])), { kind: 'slot', slot: 'T/U' });
    expect(card).toMatchObject({
      name: 'NEW SLOT',
      typeLine: 'TRAIL OR UTILITY',
      text: 'An empty slot for a trait you pick later.',
    });
    expect(card.badge.shape).toBe('empty');
  });

  it('a trait with a setting is named with it', () => {
    const card = optionCard(ash(game([])), {
      kind: 'trait',
      traitId: 'finder',
      setting: { x: 'river' },
    });
    expect(card.name).toBe('RIVER FINDER');
  });
});

describe('where a held option can go', () => {
  it('only slots it fits: a trait to REPLACE, an EMPTY slot, and the rest can’t', () => {
    const s = game([trait('fast')]);
    expect(targetsFor(s, s.traitPick!, ash(s), 0)).toEqual({
      slots: ['replace', 'no', 'empty', 'no'],
      plus: false,
    });
    expect(canPlace(s, s.traitPick!, ash(s), { option: 0, slot: 1 })).toBe(false);
    expect(canPlace(s, s.traitPick!, ash(s), { option: 0, slot: NEW_SLOT })).toBe(false);
  });

  it('a NEW SLOT only goes on the + spot', () => {
    const s = game([{ kind: 'slot', slot: 'U' }]);
    expect(targetsFor(s, s.traitPick!, ash(s), 0)).toEqual({
      slots: ['no', 'no', 'no', 'no'],
      plus: true,
    });
    expect(offersSlot(s.traitPick!, ash(s))).toBe(true);
    expect(offersSlot({ ...s.traitPick!, options: [trait('fast')] }, ash(s))).toBe(false);
  });

  it('an Old Photo’s trait only goes in its slot', () => {
    const s = game([]);
    s.traitPick = { hikerId: 'ash', source: 'oldPhoto', slot: 0, options: [trait('fast')] };
    expect(targetsFor(s, s.traitPick, ash(s), 0).slots).toEqual(['replace', 'no', 'no', 'no']);
  });
});

describe('CONFIRM', () => {
  it('sends the option and the slot it was dropped on', () => {
    expect(pickAction({ option: 2, slot: 0 })).toEqual({
      type: 'pickTrait',
      option: 2,
      replaceSlot: 0,
    });
    expect(pickAction({ option: 1, slot: NEW_SLOT })).toEqual({ type: 'pickTrait', option: 1 });
  });

  it('dropped on a trait: it’s replaced; dropped on an empty slot: it fills that one', () => {
    const s = game([trait('fast')]);
    const replaced = run(s, pickAction({ option: 0, slot: 0 }));
    expect(ash(replaced).slots.map((x) => x.traitId)).toEqual(['fast', null, null, null]);
    const filled = run(s, pickAction({ option: 0, slot: 2 }));
    expect(ash(filled).slots.map((x) => x.traitId)).toEqual(['leader', null, 'fast', null]);
  });
});

describe('the XP bar and the card row', () => {
  it('shows this level’s XP, full at a level-up', () => {
    // Level 2 needs 50 in all, 30 more than level 1.
    expect(xpBar(50, 2, xpForLevel)).toEqual({ have: 30, need: 30 });
    expect(xpBar(95, 2, xpForLevel)).toEqual({ have: 30, need: 30 });
    expect(xpBar(20, 1, xpForLevel)).toEqual({ have: 20, need: 20 });
  });

  it('cards keep their size while they fit, and shrink to fit 6 in a row', () => {
    expect(cardScale(3)).toBe(1);
    expect(cardScale(5)).toBe(1);
    expect(cardScale(6)).toBeCloseTo(0.9167, 3);
    expect(6 * 240 * cardScale(6) + 5 * 24).toBeCloseTo(1440);
  });
});

describe('the screen', () => {
  const html = (s: GameState) =>
    renderToStaticMarkup(createElement(LevelUpScreen, { state: s, onAction: () => {} }));

  it('a level-up: the hiker, LEVEL N!, the options, their traits, KEEP and CONFIRM', () => {
    const out = html(game([trait('fast'), { kind: 'slot', slot: 'T' }]));
    expect(out).toContain('aria-label="Ash levels up"');
    expect(out).toContain('LEVEL 1!');
    expect(out).toContain('PICK A NEW TRAIT');
    expect(out).toContain('YOUR TRAITS');
    expect(out).toContain('KEEP MY TRAITS');
    expect(out).toMatch(/disabled="">CONFIRM/);
    expect(out).toContain('NEW SLOT');
    // The + spot for the new slot.
    expect(out).toContain('data-plus');
  });

  it('an Old Photo: no XP bar, no KEEP MY TRAITS, and it names the trait it replaces', () => {
    const s = game([]);
    s.traitPick = { hikerId: 'ash', source: 'oldPhoto', slot: 0, options: [trait('fast')] };
    const out = html(s);
    expect(out).toContain('aria-label="Old Photo"');
    expect(out).toContain('OLD PHOTO');
    expect(out).toContain('Drag one onto Leader.');
    expect(out).not.toContain('KEEP MY TRAITS');
    expect(out).not.toContain('progressbar');
  });

  it('nothing open: nothing drawn', () => {
    const s = game([]);
    delete s.traitPick;
    expect(html(s)).toBe('');
  });
});
