/**
 * Every game's pop-up content (docs/design/20-challenge-popup.md, sections
 * 1, 3, 7 and 8): How to play with its red phrase and only the rule lines
 * that apply (tier lines tagged), this run's numbers after Prepare, text
 * that fits the left column, bars as a share of the most, and Prepare
 * options grouped into cost cards of at most [3] slots.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { defaultSettings, MINIGAMES } from '../catalog';
import {
  applyPrepare,
  cardsFor,
  effectOpen,
  expand,
  slotsFor,
  targetOpen,
  type Card,
  type Fills,
  type Slot,
} from '../prepare';
import { TIERS, type MinigameSettings } from '../types';
import { POPUPS } from './index';
import type { GamePopup } from './types';

const READY = MINIGAMES.filter((m) => m.status === 'ready');
const HIKERS = ['finn', 'mom', 'ellie'];
const text = (p: readonly { text: string }[]) => p.map((x) => x.text).join('');

/** Fills every slot it can, each with the first effect (and hiker) still open. */
function fillAll(slots: readonly Slot[]): Fills {
  let fills: Fills = {};
  for (const s of slots) {
    const e = s.card.effects.find((x) => effectOpen(x, fills, HIKERS, s.key));
    if (!e) continue;
    const target = e.perHiker ? HIKERS.find((h) => targetOpen(e, h, fills, s.key)) : undefined;
    const thing = expand(s.card.accepts)[0]!;
    fills = {
      ...fills,
      [s.key]: { hiker: 'finn', thing, effect: e.id, ...(target && { target }) },
    };
  }
  return fills;
}

const cardsOf = (popup: GamePopup, s: MinigameSettings): Card[] =>
  cardsFor(popup.options(s), s, HIKERS.length);

/**
 * Whether How to play fits the left column at the window's smallest size
 * (section 1.1): the stage is fixed (1600 × 1000, scaled), so this is the
 * column's own room. Lines are estimated from DM Sans semi-bold's average
 * width (about half the font size): the main text at 21 px and the rule
 * lines at 16 px in a 430 px column (rules indented 22 px), against the
 * room between HOW TO PLAY and CONTROLS.
 */
function heightOf(main: string, rules: readonly string[]): number {
  const lines = (s: string, perLine: number) => Math.ceil(s.length / perLine);
  const mainPx = lines(main, Math.floor(430 / (21 * 0.5))) * 29;
  const rulesPx = rules.reduce((h, r) => h + lines(r, Math.floor(408 / (16 * 0.5))) * 22 + 8, 0);
  return mainPx + 12 + rulesPx;
}
/** From under HOW TO PLAY (about y 450) to the top of CONTROLS with two rows (about y 840). */
const ROOM = 390;

describe('every game’s pop-up content', () => {
  it('every playable game has it, and nothing else does', () => {
    expect(Object.keys(POPUPS).sort()).toEqual(READY.map((m) => m.id).sort());
  });

  it.each(READY.map((m) => [m.name, m] as const))(
    '%s: How to play with one red phrase and tagged rule lines that fit; controls; bars; cards',
    (_, info) => {
      const popup = POPUPS[info.id]!;
      for (const tier of TIERS) {
        const s = { ...defaultSettings(info), tier, hikers: HIKERS };
        const how = popup.howToPlay(s);
        expect(how.filter((p) => p.red).length).toBeGreaterThanOrEqual(1);
        const rules = popup.rules(s);
        expect(rules.length).toBeLessThanOrEqual(BALANCE.minigames.prepare.ruleLines);
        for (const r of rules) {
          if (r.when) expect(r.when).toMatch(/^TIER (I|II|III|IV|V)( AND UP)?$/);
          expect(text(r.text).length).toBeGreaterThan(0);
        }
        expect(
          heightOf(
            text(how),
            rules.map((r) => text(r.text)),
          ),
        ).toBeLessThanOrEqual(ROOM);
        expect(popup.controls.length).toBeGreaterThan(0);
        for (const c of popup.controls) expect(c.inputs.length).toBeGreaterThan(0);
        // Bars: the tier's value as a share of the most it can be.
        const bars = popup.bars(s);
        expect(bars.length).toBeGreaterThan(0);
        for (const b of bars) {
          expect(b.base).toBe(b.value);
          expect(Number.isFinite(b.base)).toBe(true);
          expect(b.max).toBeGreaterThanOrEqual(b.base);
          if (b.kind === 'level') expect(b.max).toBe(BALANCE.minigames.prepare.levels);
        }
        // Cards: at most 4 (Sketchy Bridge has 4; with 4 or more the pop-up's right column
        // tightens to fit), at most [3] slots, upper-case labels.
        expect(cardsOf(popup, s).length).toBeLessThanOrEqual(4);
        for (const c of cardsOf(popup, s)) {
          expect(c.slots).toBeGreaterThan(0);
          expect(c.slots).toBeLessThanOrEqual(BALANCE.minigames.prepare.cardSlots);
          expect(c.title).toBe(c.title.toUpperCase());
          for (const e of c.effects) expect(e.label).toBe(e.label.toUpperCase());
        }
      }
    },
  );

  it.each(READY.map((m) => [m.name, m] as const))(
    '%s: filling every slot changes only the values, never the bars’ tier values',
    (_, info) => {
      const popup = POPUPS[info.id]!;
      const s = { ...defaultSettings(info), tier: 3, hikers: HIKERS };
      const slots = slotsFor(cardsOf(popup, s));
      const after = applyPrepare(s, slots, fillAll(slots));
      const before = popup.bars(s);
      const changed = popup.bars(after);
      expect(changed.map((b) => b.id)).toEqual(before.map((b) => b.id));
      changed.forEach((b, k) => {
        expect(b.base).toBe(before[k]!.base);
        expect(b.max).toBeGreaterThanOrEqual(b.value);
      });
    },
  );
});

describe('rule lines show only when they apply', () => {
  it('Trail Map: the sign line only when there are signs', () => {
    const tm = POPUPS.trailMap!;
    const signs = (n: number) =>
      tm.rules({ tier: 3, signs: n }).some((r) => text(r.text).includes('every sign'));
    expect(signs(2)).toBe(true);
    expect(signs(0)).toBe(false);
  });

  it('Dodge: an animal’s lines only at the tiers they come, tagged', () => {
    const d = POPUPS.dodge!;
    const lines = (animal: string, tier: number) =>
      d.rules({ animal, tier, level: 'auto' }).map((r) => [text(r.text), r.when ?? '']);
    expect(lines('bees', 1)).toEqual([
      ['A hiker who loses every heart is out. The others keep going.', ''],
    ]);
    expect(lines('bees', 3)).toContainEqual([
      'Bees can come in waves from both sides.',
      'TIER III AND UP',
    ]);
    // Bullet Ring from Tier IV only; the gray traps always.
    expect(lines('gunBear', 3).map(([t]) => t)).not.toContain(
      'Bullet rings fly out from the top. Find the gaps.',
    );
    expect(lines('gunBear', 4)).toContainEqual([
      'Bullet rings fly out from the top. Find the gaps.',
      'TIER IV AND UP',
    ]);
    expect(lines('swordBear', 3)).toContainEqual(['The box can shrink.', 'TIER III AND UP']);
  });

  it('Raccoon Shuffle: the take-away line only from Tier III', () => {
    const rs = POPUPS.raccoonShuffle!;
    const takes = (tier: number) => rs.rules({ tier }).some((r) => text(r.text).includes('takes'));
    expect(takes(2)).toBe(false);
    expect(takes(3)).toBe(true);
  });
});

describe('How to play uses this run’s numbers after Prepare', () => {
  it('Dodge: Bear Spray shortens “Survive for” and the SURVIVE bar', () => {
    const d = POPUPS.dodge!;
    const s = { animal: 'bear', tier: 3, hikers: HIKERS };
    const slots = slotsFor(cardsOf(d, s));
    const spray = slots.find((x) => x.card.id === 'bearSpray')!;
    const fills: Fills = {
      [spray.key]: { hiker: 'mom', thing: { kind: 'item', id: 'bearSpray' }, effect: 'bearSpray' },
    };
    const after = applyPrepare(s, slots, fills);
    const before = d.bars(s).find((b) => b.id === 'survive')!;
    const bar = d.bars(after).find((b) => b.id === 'survive')!;
    expect(bar.value).toBe(Math.round(before.base * 0.75));
    expect(text(d.howToPlay(after))).toContain(`Survive for ${bar.value} seconds.`);
    expect(text(d.howToPlay(s))).toContain(`Survive for ${before.base} seconds.`);
  });
});

describe('Dodge’s cards', () => {
  const titles = (animal: string) =>
    cardsOf(POPUPS.dodge!, { animal, tier: 2 }).map((c) => `${c.title}:${c.color}:${c.slots}`);

  it('match section 7 by animal; the Woods Monster allows +1 heart only', () => {
    expect(titles('bees')).toEqual(['FOOD:green:3', 'SMOKY FIRE:red:1']);
    expect(titles('gunBear')).toEqual(['FOOD:green:3', 'BEAR SPRAY:red:1', 'SANDBAGS:red:1']);
    expect(titles('ants')).toEqual(['FOOD:green:3', 'SALT LINE:red:2']);
    const monster = cardsOf(POPUPS.dodge!, { animal: 'monster', tier: 5 });
    expect(monster.map((c) => c.effects.map((e) => e.id))).toEqual([['lives']]);
  });

  it('SLOWER takes a level off ATTACK SPEED; SMOKY FIRE takes a bee off each wave', () => {
    const s = { animal: 'bees', tier: 2, hikers: HIKERS };
    const slots = slotsFor(cardsOf(POPUPS.dodge!, s));
    const fills: Fills = {
      'lives+slower:0': {
        hiker: 'mom',
        thing: { kind: 'resource', id: 'fish' },
        effect: 'slower',
      },
      'smoke:0': { hiker: 'mom', thing: { kind: 'resource', id: 'grass' }, effect: 'smoke' },
    };
    const bars = POPUPS.dodge!.bars(applyPrepare(s, slots, fills));
    expect(bars.find((b) => b.id === 'speed')).toMatchObject({ base: 5, value: 4, max: 10 });
    const bees = bars.find((b) => b.id === 'bees')!;
    expect(bees.value).toBe(bees.base - 1);
  });
});
