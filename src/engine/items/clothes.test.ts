import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { validateAction } from '../applyAction';
import { addCondition, hasCondition } from '../conditions';
import { moveAllCost, moveCost } from '../costs';
import { gainCaps } from '../effects';
import { resourceLimit } from '../inventory';
import { hitChance } from '../night/nightEvents';
import { scavengeSetup } from '../scavenge/setup';
import { addInjury, changeStat } from '../stats';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { Action, EquipSlot, GameState, ItemInstance } from '../types';
import { earnFreeMove } from './freeMoves';
import { fullDurability, makeItem } from './make';
import type { Quality } from './quality';
import { itemText } from './text';
import { loseDurability } from './wear';

/** Puts clothes on a hiker, at a Quality; returns the item. */
function wear(s: GameState, id: string, itemId: string, quality: Quality = 3): ItemInstance {
  const item = makeItem(s, itemId, { quality });
  const slot = ITEMS[itemId]?.slot as EquipSlot;
  hiker(s, id).inventory.equipped[slot] = item;
  return item;
}

const full = (item: ItemInstance) => fullDurability(ITEMS[item.itemId]!, item.quality);
const worn = (s: GameState, id: string, slot: EquipSlot) => hiker(s, id).inventory.equipped[slot];
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });

/** Takes card i of the open scavenge, picking Wood or the first item when it asks. */
function takeAny(s: GameState, i: number): Action {
  const c = s.scavenge?.cards[i];
  return {
    type: 'scavengeTake',
    card: i,
    ...(c?.pick ? { picks: Array.from({ length: c.pick.count }, () => 'wood' as const) } : {}),
    ...(c?.items?.length ? { item: c.items[0] } : {}),
  };
}

/** Ash scavenges tile M and takes the first card. */
function scavengeOnM(s: GameState): GameState {
  place(s, 'ash', 'M');
  s = run(s, { type: 'scavenge', hikerId: 'ash' }, { type: 'scavengeFlip', cards: [0] });
  return run(s, takeAny(s, 0));
}

describe('durability', () => {
  it('Umbrella: the other clothes’ wear comes off the Umbrella', () => {
    let s = fixtureGame();
    const shirt = wear(s, 'ash', 'plainShirt');
    const umbrella = wear(s, 'ash', 'umbrella');
    s = run(s, END, END, END); // one camp
    expect(worn(s, 'ash', 'body')?.durability).toBe(full(shirt));
    expect(worn(s, 'ash', 'gear')?.durability).toBe(full(umbrella) - 2);
  });

  it('Heavy Jacket: sometimes loses nothing', () => {
    let saved = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = fixtureGame({ seed });
      const jacket = wear(s, 'ash', 'heavyJacket');
      loseDurability(s, hiker(s, 'ash'), jacket, 1, 'test');
      if (jacket.durability === full(jacket)) saved += 1;
    }
    expect(saved).toBeGreaterThan(3); // 25%
    expect(saved).toBeLessThan(20);
  });

  it('Birkenstocks: made with a node, and only save durability on it', () => {
    const s = fixtureGame();
    const shoes = wear(s, 'ash', 'birkenstocks');
    expect(shoes.node).toBeDefined();
    expect(itemText(ITEMS.birkenstocks!, 3, 'forest')).toBe(
      'On a tile with a Forest node, a 75% chance not to lose durability.',
    );
    // On the trailhead (no nodes) they always lose it.
    loseDurability(s, hiker(s, 'ash'), shoes, 1, 'test');
    expect(shoes.durability).toBe(full(shoes) - 1);

    let saved = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const t = fixtureGame({ seed });
      place(t, 'ash', 'M'); // a Forest node
      const b = wear(t, 'ash', 'birkenstocks');
      b.node = 'forest';
      loseDurability(t, hiker(t, 'ash'), b, 1, 'test');
      if (b.durability === full(b)) saved += 1;
    }
    expect(saved).toBeGreaterThan(20); // 75%
  });
});

describe('scavenging and carrying', () => {
  it('Flannel shows another card; Glasses reroll one without an ability', () => {
    let s = fixtureGame();
    place(s, 'ash', 'M');
    const before = scavengeSetup(s, hiker(s, 'ash')).count;
    wear(s, 'ash', 'flannel');
    wear(s, 'ash', 'glasses');
    expect(scavengeSetup(s, hiker(s, 'ash')).count).toBe(before + 1);
    s = run(s, { type: 'scavenge', hikerId: 'ash' }, { type: 'scavengeFlip', cards: [0] });
    expect(s.scavenge?.rerolls).toBe(1);
    s = run(s, { type: 'scavengeReroll', card: 0 });
    expect(s.scavenge?.rerolls).toBe(0);
    expect(validateAction(s, { type: 'scavengeReroll', card: 0 })).toBe(
      'Nobody here can reroll a card.',
    );
  });

  it('Fanny Pack: more resources', () => {
    const s = fixtureGame();
    wear(s, 'ash', 'fannyPack'); // 3 at Quality 3
    expect(resourceLimit(s, hiker(s, 'ash'))).toBe(BALANCE.inventory.resourceLimit + 3);
  });

  it('Jeans: scavenging costs 1 less Appetite, and the Jeans wear', () => {
    let s = fixtureGame();
    const jeans = wear(s, 'ash', 'jeans');
    s = scavengeOnM(s);
    expect(hiker(s, 'ash').stats.appetite).toBe(10);
    expect(worn(s, 'ash', 'body')?.durability).toBe(full(jeans) - 1);
  });

  it('Pajamas: more Energy from sleep; scavenging wears them', () => {
    let s = fixtureGame();
    const pj = wear(s, 'ash', 'pajamas');
    s = scavengeOnM(s);
    expect(worn(s, 'ash', 'body')?.durability).toBe(full(pj) - 1);
    s = toNight(s);
    place(s, 'ash', 'R', { energy: 3 }); // the campsite
    s = run(s, { type: 'sleep', hikerId: 'ash' });
    const plain = (() => {
      let t = toNight(fixtureGame());
      place(t, 'ash', 'R', { energy: 3 });
      t = run(t, { type: 'sleep', hikerId: 'ash' });
      return hiker(t, 'ash').stats.energy;
    })();
    expect(hiker(s, 'ash').stats.energy).toBe(plain + 1);
  });

  it('Snack Pack: now and then +1 Appetite at the end of a phase, for 1 durability', () => {
    let fed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = fixtureGame({ seed });
      place(s, 'ash', 'T', { appetite: 5 });
      const pack = wear(s, 'ash', 'snackPack');
      s = run(s, END);
      if (hiker(s, 'ash').stats.appetite === 6) {
        fed += 1;
        expect(worn(s, 'ash', 'gear')?.durability).toBe(full(pack) - 1);
      }
    }
    expect(fed).toBeGreaterThan(1); // 15%
    expect(fed).toBeLessThan(15);
  });
});

describe('moving', () => {
  it('Hiking Stick: Hungry and moving alone costs no Appetite; the stick wears', () => {
    let s = fixtureGame();
    const stick = wear(s, 'ash', 'hikingStick');
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(1);
    place(s, 'ash', 'T', { appetite: 4 });
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(0);
    s = run(s, move('ash', 'L'));
    expect(hiker(s, 'ash').stats.appetite).toBe(4);
    expect(worn(s, 'ash', 'gear')?.durability).toBe(full(stick) - 2);
  });

  it('Trooper Mask ignores line extras, and wears for it', () => {
    let s = fixtureGame();
    const before = moveCost(s, 'ash', 'M'); // steep: +1 Energy
    const mask = wear(s, 'ash', 'trooperMask');
    const after = moveCost(s, 'ash', 'M');
    expect(after?.energy).toBe((before?.energy ?? 0) - 1);
    s = run(s, move('ash', 'M'));
    expect(worn(s, 'ash', 'gear')?.durability).toBe(full(mask) - 1);
  });

  it('Light-Up Skechers: no night extra', () => {
    const s = toNight(fixtureGame());
    const before = moveCost(s, 'ash', 'L')?.appetite ?? 0;
    wear(s, 'ash', 'lightUpSkechers');
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(before - BALANCE.night.moveExtraAppetite);
  });

  it('Trail Shoes: Energy pays when Appetite is lower', () => {
    const s = fixtureGame();
    wear(s, 'ash', 'trailShoes');
    place(s, 'ash', 'T', { appetite: 4, energy: 8 });
    expect(moveCost(s, 'ash', 'L')).toMatchObject({ appetite: 0, energy: 1 });
    place(s, 'ash', 'T', { appetite: 9, energy: 8 });
    expect(moveCost(s, 'ash', 'L')).toMatchObject({ appetite: 1, energy: 0 });
  });

  it('Toe Shoes: being brought along costs the mover nothing extra', () => {
    const s = fixtureGame();
    const before = moveAllCost(s, 'ash', 'L', ['birch'])?.[0]?.cost.appetite ?? 0;
    wear(s, 'birch', 'toeShoes');
    const after = moveAllCost(s, 'ash', 'L', ['birch'])?.[0]?.cost.appetite;
    expect(after).toBe(before - BALANCE.moveAll.perHikerAppetite);
  });

  it('Roller Skates: sideways and backward cost no Appetite', () => {
    const s = fixtureGame();
    wear(s, 'ash', 'rollerSkates');
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(1); // forward
    place(s, 'ash', 'L');
    expect(moveCost(s, 'ash', 'M')?.appetite).toBe(0); // sideways (muddy's extra too)
    expect(moveCost(s, 'ash', 'T')?.appetite).toBe(0); // backward
  });

  it('Jogging Shoes: the first move each phase doesn’t use the action', () => {
    let s = fixtureGame();
    wear(s, 'ash', 'joggingShoes');
    s = run(s, move('ash', 'L'));
    expect(hiker(s, 'ash').acted).toBe(false);
    s = run(s, move('ash', 'M'));
    expect(hiker(s, 'ash').acted).toBe(true);
    s = run(s, END);
    // A new phase: a hiker who already acted still gets the free move.
    hiker(s, 'ash').acted = true;
    expect(validateAction(s, move('ash', 'L'))).toBeNull();
  });

  it('Hiking Crocs: after a pass, one free move a day, 1 Appetite cheaper', () => {
    let s = fixtureGame();
    const crocs = wear(s, 'ash', 'hikingCrocs');
    hiker(s, 'ash').acted = true;
    expect(validateAction(s, move('ash', 'L'))).toBe('Ash has already acted this morning.');
    earnFreeMove(s, hiker(s, 'ash'), 'afterChallenge');
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(0);
    s = run(s, move('ash', 'L'));
    expect(worn(s, 'ash', 'feet')?.durability).toBe(full(crocs) - 1);
    // Once a day.
    earnFreeMove(s, hiker(s, 'ash'), 'afterChallenge');
    expect(hiker(s, 'ash').freeMove).toBeUndefined();
  });

  it('Lifted Boots: bringing exactly 1 hiker leaves them their action', () => {
    let s = fixtureGame();
    wear(s, 'ash', 'liftedBoots');
    s = run(s, { type: 'moveAll', hikerId: 'ash', toTileId: 'L', bring: ['birch'] });
    expect(hiker(s, 'birch').acted).toBe(false);
    expect(hiker(s, 'ash').acted).toBe(true);
    let t = fixtureGame();
    wear(t, 'ash', 'liftedBoots');
    t = run(t, { type: 'moveAll', hikerId: 'ash', toTileId: 'L', bring: ['birch', 'cedar'] });
    expect(hiker(t, 'birch').acted).toBe(true);
  });

  it('Speedy Socks: now and then +1 Morale on a move', () => {
    let cheered = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = fixtureGame({ seed });
      place(s, 'ash', 'T', { morale: 5 });
      wear(s, 'ash', 'speedySocks');
      s = run(s, move('ash', 'L'));
      if (hiker(s, 'ash').stats.morale === 6) cheered += 1;
    }
    expect(cheered).toBeGreaterThan(2); // 20%
    expect(cheered).toBeLessThan(18);
  });
});

describe('protection', () => {
  it('Hardhat blocks the next injury, then breaks', () => {
    const s = fixtureGame();
    wear(s, 'ash', 'hardhat');
    addInjury(s, hiker(s, 'ash'), 'test');
    expect(hiker(s, 'ash').injuries).toBe(0);
    expect(worn(s, 'ash', 'gear')).toBeUndefined();
    expect(s.log.at(-1)).toMatchObject({ kind: 'itemGone', why: 'broke' });
    addInjury(s, hiker(s, 'ash'), 'test');
    expect(hiker(s, 'ash').injuries).toBe(1);
  });

  it('Puffer Jacket blocks negative conditions, for durability', () => {
    const s = fixtureGame();
    const jacket = wear(s, 'ash', 'pufferJacket');
    addCondition(s, hiker(s, 'ash'), 'sleepy', 1, 'days', 'test');
    expect(hasCondition(hiker(s, 'ash'), 'sleepy')).toBe(false);
    expect(jacket.durability).toBe(full(jacket) - 2);
    addCondition(s, hiker(s, 'ash'), 'lucky', 1, 'days', 'test');
    expect(hasCondition(hiker(s, 'ash'), 'lucky')).toBe(true);
  });

  it('Rain Jacket: never Wet or Soaked', () => {
    const s = fixtureGame();
    wear(s, 'ash', 'rainJacket');
    addCondition(s, hiker(s, 'ash'), 'wet', 1, 'days', 'test');
    addCondition(s, hiker(s, 'ash'), 'soaked', 1, 'days', 'test');
    expect(hiker(s, 'ash').conditions).toEqual([]);
  });

  it('a Star blocks for free before a Puffer Jacket pays', () => {
    let s = fixtureGame();
    const jacket = wear(s, 'ash', 'pufferJacket');
    const star = makeItem(s, 'star', { quality: 3 });
    hiker(s, 'ash').inventory.bag.push(star);
    s = run(s, { type: 'useItem', hikerId: 'ash', itemUid: star.uid, targetId: 'ash' });
    addCondition(s, hiker(s, 'ash'), 'sleepy', 1, 'days', 'test');
    expect(worn(s, 'ash', 'body')?.durability).toBe(full(jacket));
  });
});

describe('Morale, caps and nights', () => {
  it('Cozy Sweater: every Morale gain is bigger', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { morale: 4 });
    wear(s, 'ash', 'cozySweater');
    changeStat(s, hiker(s, 'ash'), 'morale', 2, 'test');
    expect(hiker(s, 'ash').stats.morale).toBe(7);
  });

  it('Fancy Attire: +1 to every caps gain the party makes', () => {
    const s = fixtureGame();
    expect(gainCaps(s, 3)).toBe(3);
    wear(s, 'birch', 'fancyAttire');
    expect(gainCaps(s, 3)).toBe(4);
    expect(s.caps).toBe(7);
  });

  it('Disco Harness: everyone on its tile is less likely to be hit at night', () => {
    const s = fixtureGame();
    const before = hitChance(s, hiker(s, 'ash'));
    wear(s, 'birch', 'discoHarness'); // 50% at Quality 3
    expect(hitChance(s, hiker(s, 'ash'))).toBeCloseTo(before / 2);
  });

  it('Dog Socks: Dogs here may gain 1 Morale at the start of a phase, at most 1', () => {
    let cheered = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = fixtureGame({ seed });
      hiker(s, 'birch').family = 'dog';
      place(s, 'birch', 'T', { morale: 5 });
      wear(s, 'ash', 'dogSocks');
      wear(s, 'cedar', 'dogSocks');
      s = run(s, END);
      const m = hiker(s, 'birch').stats.morale;
      expect(m).toBeLessThanOrEqual(6);
      if (m === 6) cheered += 1;
    }
    expect(cheered).toBeGreaterThan(5);
  });
});

describe('Harness', () => {
  function opened(): GameState {
    const s = fixtureGame({ seed: 3, challenges: true });
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    return run(s, {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'steep-trail', tileId: 'L' },
    });
  }

  it('turns a fail into a pass, for its durability', () => {
    let s = opened();
    const harness = wear(s, 'birch', 'harness');
    s = run(s, {
      type: 'resolveChallenge',
      sections: [
        { hikerId: 'ash', pay: false, gifts: [] },
        { hikerId: 'birch', pay: false, harness: true, gifts: [] },
      ],
    });
    expect(hiker(s, 'birch').xp).toBe(BALANCE.challenges.passXpPerTier);
    expect(hiker(s, 'birch').conditions).toEqual([]);
    expect(worn(s, 'birch', 'body')?.durability).toBe(full(harness) - 4);
    expect(s.log.find((e) => e.kind === 'challenge')).toMatchObject({
      results: [{ passed: false }, { passed: true, harness: true }],
    });
  });

  it('needs the Harness, with enough durability left', () => {
    const s = opened();
    const pass = (hikerId: string): Action => ({
      type: 'resolveChallenge',
      sections: [
        { hikerId: 'ash', pay: false, ...(hikerId === 'ash' ? { harness: true } : {}), gifts: [] },
        {
          hikerId: 'birch',
          pay: false,
          ...(hikerId === 'birch' ? { harness: true } : {}),
          gifts: [],
        },
      ],
    });
    expect(validateAction(s, pass('ash'))).toBe('No Harness here can do that.');
    const harness = wear(s, 'ash', 'harness');
    harness.durability = 3;
    expect(validateAction(s, pass('ash'))).toBe('No Harness here can do that.');
    harness.durability = 4;
    expect(validateAction(s, pass('ash'))).toBeNull();
  });

  it('Hiking Crocs earn their free move on a pass', () => {
    let s = opened();
    wear(s, 'ash', 'hikingCrocs');
    s = run(s, {
      type: 'resolveChallenge',
      sections: [
        {
          hikerId: 'ash',
          pay: true,
          option: 0,
          gifts: [{ kind: 'stat', req: 0, from: 'ash', stat: 'energy', count: 2 }],
        },
        { hikerId: 'birch', pay: false, gifts: [] },
      ],
    });
    expect(hiker(s, 'ash').freeMove).toEqual({ itemId: 'hikingCrocs', day: 1 });
  });
});
