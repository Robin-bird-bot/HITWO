import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { ITEMS } from '../content/items';
import { validateAction } from './applyAction';
import { fireSitByFire } from './effects';
import { makeItem } from './items/make';
import type { HikerSetup } from './newGame';
import { END, fixtureGame, fixtureHiker, hiker, place, run, toNight } from './test/fixtures';
import type { Action, Family, GameState, ResourceId, ScavengeCard, XpSource } from './types';
import { gainXp, levelForXp, loseXp, onXpRow, xpForLevel } from './xp';

const X = BALANCE.xp;
type Who = 'ash' | 'birch' | 'cedar' | 'dot';

/** Ash, Birch, Cedar and Dot on the trailhead, each with a family and traits. */
function party(who: Partial<Record<Who, { traits?: string[]; family?: Family }>> = {}, seed = 1) {
  const hikers: HikerSetup[] = (['ash', 'birch', 'cedar', 'dot'] as const).map((id) => ({
    ...fixtureHiker(id, who[id]?.traits),
    family: who[id]?.family ?? 'human',
  }));
  return fixtureGame({ seed, hikers });
}
const xp = (s: GameState, id: string) => hiker(s, id).xp;
const gain = (s: GameState, id: string, n: number, source: XpSource = 'challenge') =>
  gainXp(s, hiker(s, id), n, source, 'test');
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const nextMorning = (s: GameState) => run(toNight(s), END);

/** Lays a chosen card face up as the first card of an open scavenge, then takes it. */
function scavengeWith(s: GameState, id: string, card: Partial<ScavengeCard>) {
  const open = run(s, { type: 'scavenge', hikerId: id });
  if (!open.scavenge) throw new Error('no deal');
  open.scavenge.cards[0] = {
    type: 'resource',
    resources: ['wood' as ResourceId],
    rarity: 'common',
    node: 'forest',
    ...card,
    flipped: true,
  };
  return run(open, { type: 'scavengeTake', card: 0 });
}

describe('levels', () => {
  it('need 20, 50, 90, 140, 200 and 270 XP, then 10 more each time', () => {
    expect([1, 2, 3, 4, 5, 6].map(xpForLevel)).toEqual([20, 50, 90, 140, 200, 270]);
    expect(xpForLevel(7)).toBe(270 + 80);
    expect(xpForLevel(8)).toBe(350 + 90);
    expect(xpForLevel(0)).toBe(0);
  });

  it('XP reaches a level at its line', () => {
    expect([0, 19, 20, 49, 50, 269, 270, 350].map(levelForXp)).toEqual([0, 0, 1, 1, 2, 5, 6, 7]);
  });

  it('hikers start at level 0 with no XP', () => {
    const s = party();
    expect(s.hikers.every((h) => h.level === 0 && h.xp === 0 && !h.pendingLevels)).toBe(true);
  });

  it('a level reached waits for the camp step', () => {
    // Ash has a slot, so there's something to offer.
    let s = party({ ash: { traits: ['leader'] } });
    gain(s, 'ash', 25);
    expect(hiker(s, 'ash')).toMatchObject({ xp: 25, level: 0, pendingLevels: 1 });
    expect(s.log.some((e) => e.kind === 'levelReached' && e.level === 1)).toBe(true);
    // Not mid-day: the window opens the next morning.
    s = run(s, END);
    expect(s.traitPick).toBeUndefined();
    s = nextMorning(s);
    expect(s.traitPick).toMatchObject({ hikerId: 'ash', source: 'levelUp', level: 1 });
    expect(validateAction(s, move('birch', 'L'))).toBe('Pick from the level-up first.');
  });

  it('two levels at once wait as two level-ups', () => {
    const s = party();
    gain(s, 'ash', 55);
    expect(hiker(s, 'ash').pendingLevels).toBe(2);
  });

  it('losing XP keeps the levels already reached', () => {
    const s = party();
    gain(s, 'ash', 25);
    expect(loseXp(hiker(s, 'ash'), 10)).toBe(10);
    expect(hiker(s, 'ash')).toMatchObject({ xp: 15, pendingLevels: 1 });
    expect(loseXp(hiker(s, 'ash'), 99)).toBe(15);
  });
});

describe('the row rule', () => {
  it('action XP counts on the first day on a row', () => {
    const s = party();
    expect(onXpRow(s, hiker(s, 'ash'))).toBe(true);
    expect(gain(s, 'ash', 2, 'craft')).toBe(2);
  });

  it('not the next day on the same row; milestones still count', () => {
    const s = nextMorning(party());
    expect(onXpRow(s, hiker(s, 'ash'))).toBe(false);
    expect(gain(s, 'ash', 2, 'craft')).toBe(0);
    expect(s.log.at(-1)).toMatchObject({ kind: 'xp', xp: 0, none: 'row' });
    expect(gain(s, 'ash', 2, 'challenge')).toBe(2);
  });

  it('moving forward starts a new row at once; going back earns nothing', () => {
    let s = nextMorning(party());
    s = run(s, move('ash', 'L'));
    expect(onXpRow(s, hiker(s, 'ash'))).toBe(true);
    // Sideways on the same row, the same day: still the new row.
    s = run(s, END, move('ash', 'M'));
    expect(onXpRow(s, hiker(s, 'ash'))).toBe(true);
    s = run(s, END, move('ash', 'T'));
    expect(onXpRow(s, hiker(s, 'ash'))).toBe(false);
  });
});

describe('XP from play', () => {
  it('a lucky draw gives 2 XP; a common one none', () => {
    let s = party();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    s = scavengeWith(s, 'ash', { rarity: 'uncommon' });
    expect(xp(s, 'ash')).toBe(X.luckyDraw);
    s = scavengeWith(s, 'birch', {});
    expect(xp(s, 'birch')).toBe(0);
  });

  it('crafting gives XP by the item’s tier', () => {
    let s = party();
    hiker(s, 'ash').inventory.resources = { wood: 2, stone: 2, moss: 1 };
    s = run(
      s,
      { type: 'craft', hikerId: 'ash', itemType: 'tool' },
      { type: 'craftTake', index: 0 },
    );
    const made = hiker(s, 'ash').inventory.bag[0]!;
    expect(xp(s, 'ash')).toBe(X.craft[ITEMS[made.itemId]!.tier - 1]);
  });

  it('a challenge passed and a checkpoint reached', () => {
    const s = party();
    gain(s, 'ash', BALANCE.challenges.passXpPerTier * 2);
    expect(xp(s, 'ash')).toBe(4);
  });

  it('sitting by the fire gives 1 XP (under the row rule)', () => {
    const s = party();
    fireSitByFire(s, hiker(s, 'ash'));
    expect(xp(s, 'ash')).toBe(X.fire);
  });
});

describe('XP traits and items', () => {
  it('Thinking Cap: +1 from every source', () => {
    const s = party();
    hiker(s, 'ash').inventory.equipped.gear = makeItem(s, 'thinkingCap', { quality: 3 });
    gain(s, 'ash', 4);
    expect(xp(s, 'ash')).toBe(5);
    // Nothing gained, nothing added.
    gain(s, 'ash', 0, 'scavenge');
    expect(xp(s, 'ash')).toBe(5);
  });

  it('Postcard: +5 at a checkpoint, +1 a challenge, nothing else', () => {
    const s = party();
    hiker(s, 'ash').inventory.bag.push(makeItem(s, 'postcard'));
    gain(s, 'ash', 10, 'checkpoint');
    expect(xp(s, 'ash')).toBe(15);
    gain(s, 'ash', 2, 'challenge');
    expect(xp(s, 'ash')).toBe(18);
    gain(s, 'ash', 2, 'craft');
    expect(xp(s, 'ash')).toBe(20);
  });

  it('Textbook: +1 for every scavenge and craft, once a scavenge', () => {
    let s = party();
    hiker(s, 'ash').inventory.bag.push(makeItem(s, 'textbook'));
    place(s, 'ash', 'L');
    s = scavengeWith(s, 'ash', {});
    expect(xp(s, 'ash')).toBe(1);
    gain(s, 'ash', 2, 'craft');
    expect(xp(s, 'ash')).toBe(4);
    gainXp(s, hiker(s, 'ash'), 0, 'scavenge', 'test', { repeat: true });
    expect(xp(s, 'ash')).toBe(4);
  });

  it('Linguist: +1 for each other hiker on the tile', () => {
    const s = party({ ash: { traits: ['linguist'] } });
    gain(s, 'ash', 2);
    expect(xp(s, 'ash')).toBe(2 + 3);
    place(s, 'ash', 'L');
    gain(s, 'ash', 2);
    expect(xp(s, 'ash')).toBe(5 + 2);
  });

  it('Mentor: every other hiker on the tile gains 1 more', () => {
    const s = party({ ash: { traits: ['mentor'] } });
    place(s, 'dot', 'L');
    gain(s, 'birch', 2);
    gain(s, 'dot', 2);
    gain(s, 'ash', 2);
    expect([xp(s, 'birch'), xp(s, 'dot'), xp(s, 'ash')]).toEqual([3, 2, 2]);
  });

  it('Trainer: Pets on the tile gain 50% more, rounded up', () => {
    const s = party({ ash: { traits: ['trainer'] }, birch: { family: 'dog' } });
    gain(s, 'birch', 3);
    gain(s, 'cedar', 3);
    expect([xp(s, 'birch'), xp(s, 'cedar')]).toEqual([5, 3]);
  });

  it('Wise: the others on the tile gain half as much, passed on plainly', () => {
    const s = party({ ash: { traits: ['wise'] } });
    place(s, 'dot', 'L');
    hiker(s, 'birch').inventory.equipped.gear = makeItem(s, 'thinkingCap', { quality: 3 });
    gain(s, 'ash', 5);
    // Rounded up; the Thinking Cap doesn't add to XP passed on.
    expect([xp(s, 'ash'), xp(s, 'birch'), xp(s, 'cedar'), xp(s, 'dot')]).toEqual([5, 3, 3, 0]);
  });

  it('Wise and a VR Headset don’t pass XP back and forth', () => {
    const s = party({ ash: { traits: ['wise'] }, birch: { traits: ['wise'] } });
    gain(s, 'ash', 4);
    expect([xp(s, 'ash'), xp(s, 'birch')]).toEqual([4, 2]);
  });

  it('VR Headset: gains 1 whenever another hiker on the tile gains XP', () => {
    const s = party();
    hiker(s, 'ash').inventory.equipped.gear = makeItem(s, 'vrHeadset', { quality: 3 });
    gain(s, 'birch', 2);
    gain(s, 'cedar', 2);
    expect(xp(s, 'ash')).toBe(2);
    place(s, 'dot', 'L');
    gain(s, 'dot', 2);
    expect(xp(s, 'ash')).toBe(2);
  });

  it('Storyteller: at the fire, every other hiker on the tile gains 2 XP', () => {
    const s = party({ ash: { traits: ['storyteller'] } });
    place(s, 'dot', 'L');
    fireSitByFire(s, hiker(s, 'ash'));
    expect([xp(s, 'ash'), xp(s, 'birch'), xp(s, 'dot')]).toEqual([X.fire, 2, 0]);
  });
});
