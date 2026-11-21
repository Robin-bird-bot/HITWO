import { describe, expect, it } from 'vitest';
import { TRAIT_LIST, TRAITS } from '../../content/traits';
import { setDaily } from '../../engine/traits/daily';
import { END, fixtureGame, fixtureHiker, hiker, run, toNight } from '../../engine/test/fixtures';
import type { Action, GameState } from '../../engine/types';
import { initials, kindWord, traitBadges } from './badges';
import { forecastView, moraleAtRisk } from './forecastView';

/** Ash with these traits (each in a W slot), and an empty T slot at the end. */
function game(traits: string[]): GameState {
  const s = fixtureGame({ hikers: [fixtureHiker('ash', traits), fixtureHiker('birch')] });
  hiker(s, 'ash').slots.push({ type: 'T', traitId: null });
  return s;
}
const badges = (s: GameState) => traitBadges(s, hiker(s, 'ash'));
const use = (abilityId: string): Action => ({ type: 'useAbility', hikerId: 'ash', abilityId });

describe('badge shapes', () => {
  it('a circle for a usable trait, a diamond for an always-on one, an outline for an empty slot', () => {
    const b = badges(game(['stoic', 'leader', 'extrinsic']));
    expect(b.map((x) => x.shape)).toEqual(['circle', 'diamond', 'diamond', 'empty']);
    expect(b.map((x) => x.state)).toEqual(['ready', 'on', 'on', 'empty']);
  });

  it('usable traits are the ones with an ability; every Morale trait is always on', () => {
    for (const def of TRAIT_LIST) {
      if (def.type === 'M') expect(def.ability).toBeUndefined();
    }
    expect(TRAITS.stoic?.ability).toBeDefined();
    expect(TRAITS.leader?.ability).toBeUndefined();
  });
});

describe('usable badge states', () => {
  it('ready, with its uses left', () => {
    const [stoic] = badges(game(['stoic']));
    expect(stoic).toMatchObject({
      state: 'ready',
      usesLeft: 1,
      usesMax: 1,
      abilityId: 'stoic',
      status: { text: 'Ready: 1 use today.', tone: 'ready' },
    });
  });

  it('used up, and back when its uses reset (Trespasser: the next biome)', () => {
    let s = run(game(['trespasser']), use('trespasser'));
    expect(badges(s)[0]).toMatchObject({
      state: 'used',
      usesLeft: 0,
      status: { text: 'Used. Back in the next biome.', tone: 'used' },
    });
    // Not back the next day: it's once per biome.
    s = run(toNight(s), END);
    expect(badges(s)[0]?.state).toBe('used');
    s = run(s, { type: 'debug', op: { kind: 'refillUses', hikerId: 'ash' } });
    expect(badges(s)[0]?.state).toBe('ready');
  });

  it('a daily trait comes back the next morning', () => {
    const s = game(['stoic']);
    hiker(s, 'ash').stats.morale = 8;
    hiker(s, 'ash').stats.energy = 5;
    let after = run(s, { ...use('stoic'), choice: 'energy' } as Action);
    expect(badges(after)[0]).toMatchObject({
      state: 'used',
      status: { text: 'Used. Back tomorrow.' },
    });
    after = run(toNight(after), END);
    expect(badges(after)[0]?.state).toBe('ready');
  });

  it('only during a scavenge: Gambler', () => {
    expect(badges(game(['gambler']))[0]).toMatchObject({
      shape: 'circle',
      state: 'during',
      during: 'SCAVENGE',
      status: { text: 'Only during a scavenge.' },
    });
  });
});

describe('what the window says', () => {
  it('the name with its setting, the kind, and what it does', () => {
    const [finder] = badges(game(['finder:river']));
    expect(finder).toMatchObject({ name: 'River Finder', kindWord: 'Utility · Tier I' });
    expect(finder?.text).toContain('River');
  });

  it('today’s pick for Nosework and Moody', () => {
    const s = game(['nosework']);
    setDaily(s, hiker(s, 'ash'), hiker(s, 'ash').slots[0]!, 'river');
    expect(badges(s)[0]?.status).toEqual({ text: 'Today: River.', tone: 'info' });
  });

  it('a trait waiting on Sit by the Fire says so', () => {
    expect(badges(game(['storyteller']))[0]?.status?.text).toBe(
      'Works once Sit by the Fire is in the game.',
    );
  });

  it('kinds and initials', () => {
    expect(kindWord(TRAITS.leader!)).toBe('Trail · Tier I');
    expect(kindWord(TRAITS.extrinsic!)).toBe('Morale');
    expect(kindWord(TRAITS.mentor!)).toBe('Utility · Special');
    expect(kindWord(TRAITS.yodeler!)).toBe('Utility · Unique');
    expect(
      [
        'Leader',
        'Second Wind',
        'Boss & Gracie',
        'Quirky (Focused)',
        'River Finder',
        '[Node] Finder',
      ].map(initials),
    ).toEqual(['Le', 'SW', 'BG', 'Qu', 'RF', 'Fi']);
  });
});

describe('trait warnings on the badges', () => {
  it('a Morale badge says what it’s about to do; others whether they’re working', () => {
    const s = game(['extrinsic', 'focused']);
    hiker(s, 'ash').stats.morale = 5; // room to gain
    const view = forecastView(s);
    const [extrinsic, focused] = traitBadges(s, hiker(s, 'ash'), view);
    // Birch is here too: +1 tomorrow, and Focused isn't working (not alone).
    expect(extrinsic).toMatchObject({
      morale: { delta: 1, when: 'tomorrow' },
      status: { text: 'With company: gains 1 Morale tomorrow morning.', tone: 'gain' },
    });
    expect(focused).toMatchObject({ working: false, status: { text: 'Not working right now.' } });
  });

  it('follows an action being looked at: moving away alone', () => {
    const s = game(['extrinsic', 'focused']);
    const view = forecastView(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    const [extrinsic, focused] = traitBadges(s, hiker(s, 'ash'), view);
    expect(extrinsic?.morale).toEqual({ delta: -1, when: 'tomorrow' });
    expect(extrinsic?.status?.tone).toBe('loss');
    expect(focused?.working).toBe(true);
    expect(moraleAtRisk(view, 'ash')).toBe(1);
  });

  it('nothing without a forecast (warnings off)', () => {
    const s = game(['extrinsic', 'focused']);
    const [extrinsic, focused] = traitBadges(s, hiker(s, 'ash'));
    expect(extrinsic?.morale).toBeUndefined();
    expect(focused?.working).toBeUndefined();
  });
});
