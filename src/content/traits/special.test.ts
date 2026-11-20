import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../../engine/applyAction';
import { requirementNeed } from '../../engine/challenges/resolve';
import { addCondition, hasCondition } from '../../engine/conditions';
import {
  abilitiesFor,
  fireCraft,
  fireSitByFire,
  nightShield,
  workingTrait,
} from '../../engine/effects';
import { craftSetup } from '../../engine/items/craft';
import { makeItem } from '../../engine/items/make';
import type { HikerSetup } from '../../engine/newGame';
import { scavengeSetup } from '../../engine/scavenge/setup';
import { changeStat } from '../../engine/stats';
import {
  END,
  fixtureGame,
  fixtureHiker,
  hiker,
  place,
  run,
  toNight,
} from '../../engine/test/fixtures';
import type {
  Action,
  ChallengeSection,
  Family,
  GameState,
  ResourceId,
  ScavengeCard,
} from '../../engine/types';
import type { Requirement } from '../../engine/challenges/types';
import type { Quality } from '../../engine/items/quality';
import { tagTeamSide } from './special';

const N = BALANCE.traits;
type Who = 'ash' | 'birch' | 'cedar' | 'dot';
interface Setup {
  traits?: string[];
  family?: Family;
}

/** Ash, Birch, Cedar and Dot on the trailhead, each with a family and traits, Morale 5. */
function party(
  who: Partial<Record<Who, Setup>>,
  opts: { seed?: number; challenges?: boolean } = {},
) {
  const hikers: HikerSetup[] = (['ash', 'birch', 'cedar', 'dot'] as const).map((id) => ({
    ...fixtureHiker(id, who[id]?.traits),
    family: who[id]?.family ?? 'human',
  }));
  const s = fixtureGame({ seed: opts.seed ?? 1, hikers, challenges: !!opts.challenges });
  for (const id of ['ash', 'birch', 'cedar', 'dot']) hiker(s, id).stats.morale = 5;
  return s;
}
/** Everyone on tile L (a Forest tile). */
const onL = (s: GameState) => {
  for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'L');
  return s;
};

const use = (hikerId: string, abilityId: string, choice?: string): Action => ({
  type: 'useAbility',
  hikerId,
  abilityId,
  ...(choice ? { choice } : {}),
});
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const moveAll = (hikerId: string, toTileId: string, bring: string[]): Action => ({
  type: 'moveAll',
  hikerId,
  toTileId,
  bring,
});
const giveWood = (fromId: string, toId: string): Action => ({
  type: 'give',
  fromId,
  toId,
  resource: 'wood',
});
/** Puts a food card in the hiker's bag and eats a bite of it. */
const eat = (s: GameState, id: string, itemId = 'pelmeni', quality: Quality = 3) => {
  const item = makeItem(s, itemId, { quality });
  hiker(s, id).inventory.bag.push(item);
  return run(s, { type: 'eat', hikerId: id, itemUid: item.uid });
};
const morale = (s: GameState, id: string) => hiker(s, id).stats.morale;
const choicesOf = (s: GameState, id: string, abilityId: string) =>
  abilitiesFor(s, hiker(s, id))
    .find((a) => a.ability.id === abilityId)
    ?.choices?.map((c) => c.id) ?? [];
/** How many of `seeds` runs something happens in. */
const times = (seeds: number, f: (seed: number) => boolean) =>
  Array.from({ length: seeds }, (_, i) => f(i + 1)).filter(Boolean).length;

/** Lays a chosen card face up as the first card of an open scavenge, then takes it. */
function scavengeWith(
  s: GameState,
  id: string,
  card: Partial<ScavengeCard> & Pick<ScavengeCard, 'type'>,
) {
  const open = run(s, { type: 'scavenge', hikerId: id });
  if (!open.scavenge) throw new Error('no deal');
  open.scavenge.cards[0] = { rarity: 'common', node: 'forest', ...card, flipped: true };
  return run(open, { type: 'scavengeTake', card: 0 });
}
const WOOD = { type: 'resource' as const, resources: ['wood' as ResourceId] };
const resourceTotal = (s: GameState, id: string) =>
  Object.values(hiker(s, id).inventory.resources).reduce<number>((n, x) => n + (x ?? 0), 0);

// ── 02-traits-and-conditions.md ──

describe('Fluffy', () => {
  it('crafting with Fur gives 1 Fur back', () => {
    const s = party({ ash: { traits: ['fluffy'] } });
    fireCraft(s, hiker(s, 'ash'), 'pelmeni', 'food', { paid: ['wood'] });
    expect(hiker(s, 'ash').inventory.resources.fur ?? 0).toBe(0);
    fireCraft(s, hiker(s, 'ash'), 'pelmeni', 'food', { paid: ['fur', 'wood'] });
    expect(hiker(s, 'ash').inventory.resources.fur).toBe(1);
  });
});

describe('Misophonia', () => {
  it('−1 Morale when another hiker eats on the tile; +2 when crafting food', () => {
    let s = party({ ash: { traits: ['misophonia'] } });
    s = eat(s, 'birch');
    expect(morale(s, 'ash')).toBe(5 + N.misophonia.otherEats);
    s = eat(s, 'ash');
    expect(morale(s, 'ash')).toBe(5 + N.misophonia.otherEats);
    fireCraft(s, hiker(s, 'ash'), 'pelmeni', 'food');
    expect(morale(s, 'ash')).toBe(5 + N.misophonia.otherEats + N.misophonia.craftsFood);
  });
});

describe('Rain Lover', () => {
  it('during rain or snow, every Morale gain is 1 larger', () => {
    const s = party({ ash: { traits: ['rainLover'] } });
    changeStat(s, hiker(s, 'ash'), 'morale', 1, 'test');
    expect(morale(s, 'ash')).toBe(6);
    s.weather.today = 'rain';
    changeStat(s, hiker(s, 'ash'), 'morale', 1, 'test');
    expect(morale(s, 'ash')).toBe(6 + 1 + N.rainLover.extra);
    changeStat(s, hiker(s, 'ash'), 'morale', -1, 'test');
    expect(morale(s, 'ash')).toBe(6 + N.rainLover.extra);
  });
});

describe('Yodeler', () => {
  it('every hiker within 2 tiles gains 1 Morale, or 2 on a Mountain tile', () => {
    let s = party({ ash: { traits: ['yodeler'] } });
    place(s, 'ash', 'L');
    place(s, 'cedar', 'C');
    place(s, 'dot', 'R'); // 2 away
    s.section.tiles.R!.nodes = [{ type: 'mountain', revealed: true }];
    s = run(s, use('ash', 'yodeler'));
    expect(morale(s, 'ash')).toBe(5 + N.yodeler.morale);
    expect(morale(s, 'birch')).toBe(5 + N.yodeler.morale);
    expect(morale(s, 'cedar')).toBe(5 + N.yodeler.morale);
    expect(morale(s, 'dot')).toBe(5 + N.yodeler.mountain);
    expect(hiker(s, 'ash').acted).toBe(false);
    expect(validateAction(s, use('ash', 'yodeler'))).not.toBeNull();
  });

  it('only during the day', () => {
    const s = toNight(party({ ash: { traits: ['yodeler'] } }));
    expect(validateAction(s, use('ash', 'yodeler'))).toBe('Yodeling is for the day.');
  });
});

describe('Dog Mom', () => {
  it('when a Dog on the tile scavenges, this hiker gains a resource from that node', () => {
    let s = onL(party({ ash: { traits: ['dogMom'] }, birch: { family: 'dog' } }));
    s = scavengeWith(s, 'birch', WOOD);
    expect(resourceTotal(s, 'ash')).toBe(1);
    // Not for a Human scavenging.
    s = scavengeWith(s, 'cedar', WOOD);
    expect(resourceTotal(s, 'ash')).toBe(1);
  });
});

describe('Artist', () => {
  it('crafting gives every hiker on the tile 1 Morale', () => {
    const s = party({ ash: { traits: ['artist'] } });
    place(s, 'dot', 'L');
    fireCraft(s, hiker(s, 'ash'), 'pelmeni', 'food');
    expect(morale(s, 'ash')).toBe(6);
    expect(morale(s, 'birch')).toBe(6);
    expect(morale(s, 'dot')).toBe(5);
  });
});

describe('Stylish', () => {
  it('+1 Luck with all 3 equipment slots filled', () => {
    const s = onL(party({ ash: { traits: ['stylish'] } }));
    const ash = hiker(s, 'ash');
    ash.inventory.equipped.body = makeItem(s, 'harness');
    ash.inventory.equipped.feet = makeItem(s, 'joggingShoes');
    expect(scavengeSetup(s, ash).luck).toBe(0);
    ash.inventory.equipped.gear = makeItem(s, 'umbrella');
    expect(scavengeSetup(s, ash).luck).toBe(N.stylish.luck);
    expect(craftSetup(s, ash, 'tool').luck).toBe(N.stylish.luck);
  });

  it('clothes last 3 extra days when this hiker puts them on, once per item', () => {
    let s = party({ ash: { traits: ['stylish'] } });
    const item = makeItem(s, 'umbrella');
    const days = item.durability!;
    hiker(s, 'ash').inventory.bag.push(item);
    s = run(s, { type: 'putOn', hikerId: 'ash', itemUid: item.uid });
    const worn = () => hiker(s, 'ash').inventory.equipped.gear!;
    expect(worn().durability).toBe(days + N.stylish.days);
    // Off and on again: no more days.
    const again = worn();
    hiker(s, 'ash').inventory.equipped.gear = undefined;
    hiker(s, 'ash').inventory.bag.push(again);
    s = run(s, { type: 'putOn', hikerId: 'ash', itemUid: again.uid });
    expect(worn().durability).toBe(days + N.stylish.days);
  });
});

describe('Show Girl', () => {
  it('Humans on the tile get +1 from every Morale gain', () => {
    const s = party({ ash: { traits: ['showGirl'] }, cedar: { family: 'dog' } });
    place(s, 'dot', 'L');
    for (const id of ['ash', 'birch', 'cedar', 'dot'])
      changeStat(s, hiker(s, id), 'morale', 1, 'test');
    expect(morale(s, 'ash')).toBe(5 + 1 + N.showGirl.extra);
    expect(morale(s, 'birch')).toBe(5 + 1 + N.showGirl.extra);
    expect(morale(s, 'cedar')).toBe(6); // a Dog
    expect(morale(s, 'dot')).toBe(6); // another tile
  });
});

describe('Nugget Puker', () => {
  it('eating food gives a Puked Nuggets card; eating those doesn’t', () => {
    let s = eat(party({ ash: { traits: ['nuggetPuker'] } }), 'ash');
    const nuggets = () => hiker(s, 'ash').inventory.bag.filter((i) => i.itemId === 'pukedNuggets');
    expect(nuggets()).toHaveLength(1);
    s = run(s, { type: 'eat', hikerId: 'ash', itemUid: nuggets()[0]!.uid });
    expect(nuggets()).toHaveLength(0);
  });
});

describe('Loud', () => {
  it('can trade from 1 tile away', () => {
    const s = party({ ash: { traits: ['loud'] } });
    hiker(s, 'ash').inventory.resources.wood = 2;
    hiker(s, 'cedar').inventory.resources.wood = 2;
    place(s, 'birch', 'L');
    place(s, 'dot', 'L');
    expect(validateAction(s, giveWood('ash', 'birch'))).toBeNull();
    expect(validateAction(s, giveWood('cedar', 'dot'))).not.toBeNull();
  });

  it('at night, others on its tile get Ringing Ears', () => {
    const s = toNight(party({ ash: { traits: ['loud'] } }));
    expect(hasCondition(hiker(s, 'birch'), 'ringingEars')).toBe(true);
    expect(hasCondition(hiker(s, 'ash'), 'ringingEars')).toBe(false);
  });
});

// ── New in 07-characters.md ──

describe('Wanderer', () => {
  it('once per daytime phase, moving alone to an unrevealed tile doesn’t use the action', () => {
    let s = run(party({ ash: { traits: ['wanderer'] } }), move('ash', 'L'));
    expect(hiker(s, 'ash').acted).toBe(false);
    s = run(s, move('ash', 'M'));
    expect(hiker(s, 'ash').acted).toBe(true);
  });

  it('not to a tile someone has been on', () => {
    const s = run(
      party({ ash: { traits: ['wanderer'] } }),
      move('birch', 'L'),
      END,
      move('ash', 'L'),
    );
    expect(hiker(s, 'ash').acted).toBe(true);
  });
});

describe('Forgetful', () => {
  it('each morning, a chance to forget one negative condition', () => {
    const forgot = times(30, (seed) => {
      const s = party({ ash: { traits: ['forgetful'] } }, { seed });
      addCondition(s, hiker(s, 'ash'), 'bored', 5, 'days', 'test');
      const next = run(toNight(s), END);
      return !hasCondition(hiker(next, 'ash'), 'bored');
    });
    expect(forgot).toBeGreaterThan(0);
    expect(forgot).toBeLessThan(30);
  });
});

describe('Snores', () => {
  it('night events are 50% less likely to hit hikers on the tile', () => {
    const s = party({ ash: { traits: ['snores'] } });
    expect(nightShield(s, hiker(s, 'birch'))).toBe(N.snores.shield);
    place(s, 'birch', 'L');
    expect(nightShield(s, hiker(s, 'birch'))).toBe(0);
  });

  it('others sleeping on the tile get 1 less Energy from sleep', () => {
    const slept = (traits: string[]) => {
      const s = toNight(party({ ash: { traits } }));
      hiker(s, 'birch').stats.energy = 3;
      return hiker(run(s, { type: 'sleep', hikerId: 'birch' }), 'birch').stats.energy;
    };
    expect(slept(['snores'])).toBe(slept([]) + N.snores.sleep);
  });
});

describe('Alpha Dog', () => {
  const resolve = (...sections: ChallengeSection[]): Action => ({
    type: 'resolveChallenge',
    sections,
  });
  const fail = (id: string): ChallengeSection => ({ hikerId: id, pay: false, gifts: [] });
  /** Ash and Birch on L, facing Squirrel Ambush (fail: 1 injury each), with Ash leading. */
  function ambush(traits: string[]) {
    const s = party({ ash: { traits, family: 'dog' } }, { challenges: true });
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    const open = run(s, {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'squirrel-ambush', tileId: 'L' },
    });
    open.challenge!.leaderId = 'ash';
    return run(open, resolve(fail('ash'), fail('birch')));
  }

  it('the hiker who led the group takes the harm instead of the others (once)', () => {
    const s = ambush(['alphaDog']);
    expect(hiker(s, 'ash').injuries).toBe(1);
    expect(hiker(s, 'birch').injuries).toBe(0);
    const plain = ambush([]);
    expect(hiker(plain, 'ash').injuries).toBe(1);
    expect(hiker(plain, 'birch').injuries).toBe(1);
  });

  it('Move All marks who led the group onto the challenge', () => {
    const led = times(20, (seed) => {
      const s = party({ ash: { traits: ['alphaDog'] } }, { seed, challenges: true });
      const after = run(s, moveAll('ash', 'L', ['birch']));
      if (after.challenge) expect(after.challenge.leaderId).toBe('ash');
      return !!after.challenge;
    });
    expect(led).toBeGreaterThan(0);
  });
});

describe('Lanky', () => {
  it('each move has a chance not to use the action', () => {
    const free = times(40, (seed) => {
      const s = run(party({ ash: { traits: ['lanky'] } }, { seed }), move('ash', 'L'));
      return !hiker(s, 'ash').acted;
    });
    expect(free).toBeGreaterThan(0);
    expect(free).toBeLessThan(40);
  });
});

describe('Good Boy', () => {
  it('gives this hiker’s action to a hiker on the tile, who gets a free action', () => {
    let s = party({ ash: { traits: ['goodBoy'] } });
    expect(choicesOf(s, 'ash', 'goodBoy')).toEqual(['birch', 'cedar', 'dot']);
    s = run(s, use('ash', 'goodBoy', 'birch'));
    expect(hiker(s, 'ash').acted).toBe(true);
    expect(hasCondition(hiker(s, 'birch'), 'motivated')).toBe(true);
  });

  it('not after acting', () => {
    const s = run(party({ ash: { traits: ['goodBoy'] } }), move('ash', 'L'));
    place(s, 'birch', 'L');
    expect(validateAction(s, use('ash', 'goodBoy', 'birch'))).toBe('Ash has already acted.');
  });
});

describe('Spoiled', () => {
  it('when another hiker on the tile eats, gains 1 Appetite too', () => {
    const s = party({ ash: { traits: ['spoiled'] } });
    hiker(s, 'ash').stats.appetite = 5;
    expect(hiker(eat(s, 'birch'), 'ash').stats.appetite).toBe(5 + N.spoiled.appetite);
    place(s, 'birch', 'L');
    expect(hiker(eat(s, 'birch'), 'ash').stats.appetite).toBe(5);
  });
});

describe('Fluff Armor', () => {
  it('a chance to block a negative condition, at most once per day', () => {
    let blockedOnce = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = party({ ash: { traits: ['fluffArmor'] } }, { seed });
      const ash = hiker(s, 'ash');
      addCondition(s, ash, 'bored', 2, 'days', 'test');
      if (hasCondition(ash, 'bored')) continue;
      blockedOnce++;
      // Already used today: the next one gets through.
      addCondition(s, ash, 'unlucky', 2, 'days', 'test');
      expect(hasCondition(ash, 'unlucky')).toBe(true);
    }
    expect(blockedOnce).toBeGreaterThan(0);
    expect(blockedOnce).toBeLessThan(30);
  });
});

describe('Hype Dog', () => {
  it('makes a hiker on this or an adjacent tile Energized for 1 day', () => {
    let s = party({ ash: { traits: ['hypeDog'] } });
    place(s, 'birch', 'L');
    place(s, 'cedar', 'C'); // 2 away
    expect(choicesOf(s, 'ash', 'hypeDog')).toEqual(['ash', 'birch', 'dot']);
    s = run(s, use('ash', 'hypeDog', 'birch'));
    expect(hasCondition(hiker(s, 'birch'), 'energized')).toBe(true);
    expect(hiker(s, 'ash').acted).toBe(false);
  });
});

describe('Lucky Charm', () => {
  it('every other hiker on the tile gets +1 Luck scavenging and crafting', () => {
    const s = onL(party({ ash: { traits: ['luckyCharm'] } }));
    expect(scavengeSetup(s, hiker(s, 'birch')).luck).toBe(N.luckyCharm.luck);
    expect(craftSetup(s, hiker(s, 'birch'), 'tool').luck).toBe(N.luckyCharm.luck);
    expect(scavengeSetup(s, hiker(s, 'ash')).luck).toBe(0);
    place(s, 'birch', 'M');
    expect(scavengeSetup(s, hiker(s, 'birch')).luck).toBe(0);
  });
});

describe('Cuddle Buddy', () => {
  it('hikers who sleep on the tile gain 1 Morale and can’t get Nightmares', () => {
    let s = toNight(party({ ash: { traits: ['cuddleBuddy'] } }));
    s = run(s, { type: 'sleep', hikerId: 'birch' }, { type: 'sleep', hikerId: 'ash' });
    expect(morale(s, 'birch')).toBe(5 + N.cuddleBuddy.morale);
    expect(morale(s, 'ash')).toBe(5 + N.cuddleBuddy.morale);
    addCondition(s, hiker(s, 'birch'), 'nightmares', 1, 'nights', 'test');
    expect(hasCondition(hiker(s, 'birch'), 'nightmares')).toBe(false);
    place(s, 'cedar', 'L');
    addCondition(s, hiker(s, 'cedar'), 'nightmares', 1, 'nights', 'test');
    expect(hasCondition(hiker(s, 'cedar'), 'nightmares')).toBe(true);
  });
});

describe('Rule Changer', () => {
  it('once per biome, rerolls the card on an adjacent revealed tile', () => {
    let s = party({ ash: { traits: ['ruleChanger'] } }, { challenges: true });
    place(s, 'ash', 'L');
    s.section.tiles.M!.revealedCard = { cardId: 'squirrel-ambush', tier: 1, scale: 1 };
    s.section.tiles.R!.revealedCard = { cardId: 'squirrel-ambush', tier: 1, scale: 1 }; // 2 away
    expect(choicesOf(s, 'ash', 'ruleChanger')).toEqual(['M']);
    s = run(s, use('ash', 'ruleChanger', 'M'));
    expect(s.log.some((e) => e.kind === 'revealedCard' && e.cause === 'Rule Changer')).toBe(true);
    expect(validateAction(s, use('ash', 'ruleChanger', 'M'))).not.toBeNull();
  });
});

describe('Strong Walker and Tank Butt', () => {
  it('Strong Walker: hikers it moves with the group keep their action', () => {
    const s = run(party({ ash: { traits: ['strongWalker'] } }), moveAll('ash', 'L', ['birch']));
    expect(hiker(s, 'ash').acted).toBe(true);
    expect(hiker(s, 'birch').acted).toBe(false);
  });

  it('Tank Butt: can bring hikers who’ve already acted this phase', () => {
    const acted = (traits: string[]) => {
      const s = party({ ash: { traits } });
      hiker(s, 'birch').acted = true;
      return s;
    };
    expect(validateAction(acted([]), moveAll('ash', 'L', ['birch']))).not.toBeNull();
    const s = acted(['tankButt']);
    expect(validateAction(s, moveAll('ash', 'L', ['birch']))).toBeNull();
    expect(hiker(run(s, moveAll('ash', 'L', ['birch'])), 'birch').tileId).toBe('L');
  });
});

describe('Just Around the Next Corner', () => {
  it('near the checkpoint, moving alone often costs no Appetite', () => {
    const free = times(30, (seed) => {
      const s = run(
        party({ ash: { traits: ['justAroundTheNextCorner'] } }, { seed }),
        move('ash', 'L'),
      );
      return hiker(s, 'ash').stats.appetite === BALANCE.stats.max;
    });
    expect(free).toBeGreaterThan(30 / 2);
    expect(free).toBeLessThan(30);
  });

  it('moving the group, each hiker’s part has a smaller chance to cost no Appetite', () => {
    // Ash pays 1 for their own crossing and 1 for bringing Birch: two parts, each 25%.
    const paid = Array.from({ length: 40 }, (_, i) => {
      const s = run(
        party({ ash: { traits: ['justAroundTheNextCorner'] } }, { seed: i + 1 }),
        moveAll('ash', 'L', ['birch']),
      );
      expect(hiker(s, 'birch').stats.appetite).toBe(BALANCE.stats.max);
      return BALANCE.stats.max - hiker(s, 'ash').stats.appetite;
    });
    const freed = paid.reduce((n, p) => n + (2 - p), 0);
    expect(paid.filter((p) => p === 2).length).toBeGreaterThan(40 / 2);
    expect(paid.filter((p) => p === 1).length).toBeGreaterThan(0);
    expect(freed).toBeGreaterThan(0);
    expect(freed).toBeLessThan(80 / 2);
  });

  it('not far from the checkpoint', () => {
    // Every fixture tile is near its checkpoint, so this one has none in reach.
    const s = party({ ash: { traits: ['justAroundTheNextCorner'] } });
    s.section.checkpointId = 'nowhere';
    const group = run(s, moveAll('ash', 'L', ['birch']));
    expect(hiker(group, 'ash').stats.appetite).toBe(BALANCE.stats.max - 2);
    const alone = run(s, move('ash', 'L'));
    expect(hiker(alone, 'ash').stats.appetite).toBe(BALANCE.stats.max - 1);
  });
});

describe('Coach and Comedian', () => {
  it('Coach: gives a hiker on the tile Motivated, as a free action', () => {
    const s = run(party({ ash: { traits: ['coach'] } }), use('ash', 'coach', 'cedar'));
    expect(hasCondition(hiker(s, 'cedar'), 'motivated')).toBe(true);
    expect(hiker(s, 'ash').acted).toBe(false);
  });

  it('Comedian: Sitting by the Fire gives everyone there 1 Morale and ends Bored', () => {
    const s = party({ ash: { traits: ['comedian'] } });
    addCondition(s, hiker(s, 'birch'), 'bored', 2, 'days', 'test');
    fireSitByFire(s, hiker(s, 'ash'));
    expect(morale(s, 'ash')).toBe(5 + N.comedian.morale);
    expect(morale(s, 'birch')).toBe(5 + N.comedian.morale);
    expect(hasCondition(hiker(s, 'birch'), 'bored')).toBe(false);
  });
});

describe('Easy Mode', () => {
  it('a challenge on this hiker’s tile asks for 1 less of its cost', () => {
    const need = (traits: string[]) => {
      const s = party({ ash: { traits } }, { challenges: true });
      place(s, 'ash', 'L');
      place(s, 'birch', 'L');
      const open = run(s, {
        type: 'debug',
        op: { kind: 'openChallenge', cardId: 'squirrel-ambush', tileId: 'L' },
      });
      open.challenge!.rolls.x.n = 2;
      const caps = { kind: 'caps', count: 'n' } as Requirement;
      return requirementNeed(open, open.challenge!, caps, 'birch');
    };
    expect(need([])).toBe(2);
    expect(need(['easyMode'])).toBe(2 - N.easyMode.less);
  });
});

describe('Garbage Gut', () => {
  it('Quality 1 food never gives this hiker a bad condition', () => {
    const s = party({ ash: { traits: ['garbageGut'] } });
    // Wine at Quality 1: always Unlucky.
    expect(hasCondition(hiker(eat(s, 'ash', 'wine', 1), 'ash'), 'unlucky')).toBe(false);
    expect(hasCondition(hiker(eat(s, 'birch', 'wine', 1), 'birch'), 'unlucky')).toBe(true);
  });
});

// ── Boss & Gracie (a Duo's Tag Team) ──

describe('Tag Team: Boss & Gracie', () => {
  it('Boss’s days are odd, Gracie’s even', () => {
    expect(tagTeamSide(1, ['Boss', 'Gracie'])).toBe('Boss');
    expect(tagTeamSide(2, ['Boss', 'Gracie'])).toBe('Gracie');
    expect(tagTeamSide(7, ['Boss', 'Gracie'])).toBe('Boss');
  });

  /** The Duo (a Dog with Fetch) on L; Birch on M (adjacent), Cedar on R (2 away) with an item. */
  function duo(day: number) {
    const s = party({ ash: { traits: ['fetch', 'bossGracie'], family: 'dog' } });
    s.day = day;
    place(s, 'ash', 'L');
    place(s, 'birch', 'M');
    place(s, 'cedar', 'R');
    place(s, 'dot', 'L');
    hiker(s, 'birch').inventory.resources.wood = 1;
    hiker(s, 'cedar').inventory.resources.stone = 1;
    hiker(s, 'cedar').inventory.bag.push(makeItem(s, 'pelmeni', { quality: 3 }));
    hiker(s, 'ash').inventory.resources.wood = 3;
    return s;
  }

  it('Boss’s days: Fetch takes items too, from 2 tiles away', () => {
    const s = duo(1);
    const choices = choicesOf(s, 'ash', 'fetch');
    expect(choices).toContain('birch|r|wood');
    expect(choices).toContain('cedar|r|stone');
    expect(choices.some((c) => c.startsWith('cedar|i|'))).toBe(true);
    const item = choices.find((c) => c.startsWith('cedar|i|'))!;
    const after = run(s, use('ash', 'fetch', item));
    expect(hiker(after, 'ash').inventory.bag.some((i) => i.itemId === 'pelmeni')).toBe(true);
  });

  it('Gracie’s days: Fetch is as usual, and one give reaches 2 tiles away', () => {
    let s = duo(2);
    expect(choicesOf(s, 'ash', 'fetch')).toEqual(['birch|r|wood']);
    expect(validateAction(s, giveWood('ash', 'cedar'))).toBeNull();
    s = run(s, giveWood('ash', 'cedar'));
    expect(hiker(s, 'cedar').inventory.resources.wood).toBe(1);
    expect(validateAction(s, giveWood('ash', 'cedar'))).not.toBeNull();
    // Gives on the same tile are as usual.
    expect(validateAction(s, giveWood('ash', 'dot'))).toBeNull();
  });

  it('on Boss’s days there’s no far give', () => {
    expect(validateAction(duo(1), giveWood('ash', 'cedar'))).not.toBeNull();
  });
});

describe('the Tag Team says whose day it is', () => {
  it('in the trait’s text', () => {
    const s = party({ ash: { traits: ['bossGracie'], family: 'dog' } });
    const slot = hiker(s, 'ash').slots[0]!;
    expect(workingTrait(s, slot)?.text).toMatch(/^Boss’s day today\./);
    s.day = 2;
    expect(workingTrait(s, slot)?.text).toMatch(/^Gracie’s day today\./);
  });
});
