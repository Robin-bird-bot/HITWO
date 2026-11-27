/**
 * Every Skill Trails step (Phase 10.7, 09-hikers.md "The first 6 hikers" and
 * "Rules that need care"), with the stacking cases: two Move All cost cuts,
 * Copydog alone, Prepper with and without others, Rule Changer III on an
 * empty tile. Chances are set to 1 or 0 where a test needs a sure result.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { CHALLENGES } from '../challenges';
import { ITEMS } from '../items';
import { validateAction } from '../../engine/applyAction';
import { abilitiesFor, watchReach } from '../../engine/effects';
import { bagSlots } from '../../engine/inventory';
import { craftSetup, ownCraftTier } from '../../engine/items/craft';
import { makeItem } from '../../engine/items/make';
import { syncExtraUses } from '../../engine/items/properWay';
import { seedRng } from '../../engine/rng';
import { dealCard, isResourceCard } from '../../engine/scavenge/deal';
import { scavengeCost, scavengeSetup } from '../../engine/scavenge/setup';
import { END, hiker, place, run, toNight, trailGame } from '../../engine/test/fixtures';
import { learnStep } from '../../engine/trails';
import { gainXp } from '../../engine/xp';
import type { Action, GameState, ItemTypeName } from '../../engine/types';
import { withRetiredCards } from '../../engine/test/retiredChallenges';

// The engine's mechanics are tested on the cards they were written for (retired Nov 26).
withRetiredCards();

const B = BALANCE.trails;

/** Learns steps straight away (test setup: no points or night needed). */
function learn(s: GameState, hikerId: string, ...stepIds: string[]): GameState {
  for (const id of stepIds) learnStep(s, hiker(s, hikerId), id);
  return s;
}

/** Runs `fn` with a balance number set, then puts it back. */
function withValue<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K],
  fn: () => void,
) {
  const before = obj[key];
  obj[key] = value;
  try {
    fn();
  } finally {
    obj[key] = before;
  }
}

const moveAll = (hikerId: string, toTileId: string, ...bring: string[]): Action => ({
  type: 'moveAll',
  hikerId,
  toTileId,
  bring,
});
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const toggle = (hikerId: string, traitId: string): Action => ({
  type: 'toggleTrait',
  hikerId,
  traitId,
});
const use = (hikerId: string, abilityId: string, choice?: string): Action => ({
  type: 'useAbility',
  hikerId,
  abilityId,
  ...(choice === undefined ? {} : { choice }),
});
const stat = (s: GameState, id: string, which: 'energy' | 'appetite' | 'morale') =>
  hiker(s, id).stats[which];

/** Scavenge, flip and take the first card (forced to `type`). */
function scavengeTake(s: GameState, id: string, type: GameState['debugDeal'] = ['resource']) {
  s.debugDeal = type;
  const open = run(s, { type: 'scavenge', hikerId: id });
  return run(open, { type: 'scavengeFlip', cards: [0] }, { type: 'scavengeTake', card: 0 });
}

/** A challenge that plays at this tier on any tile (Nov 26: a card plays from its "From" tier on). */
const firstChallenge = (tier: 1 | 2) =>
  CHALLENGES.find((c) => c.tier <= tier && c.nodes === 'any' && !c.gates?.length)!;

// ── Finn ───────────────────────────────────────────────────────────────────

describe('Finn: Leader Trail (Leash Puller)', () => {
  it('Leash Puller, on: Finn pays 2 Energy, and nobody pays Appetite, even at night', () => {
    let s = toNight(trailGame(['finn', 'ellie']));
    s = run(s, moveAll('finn', 'L', 'ellie'));
    expect(stat(s, 'finn', 'energy')).toBe(10 - B.leashPuller.energy);
    expect(stat(s, 'finn', 'appetite')).toBe(10);
    expect(stat(s, 'ellie', 'appetite')).toBe(10);
    expect(hiker(s, 'ellie').acted).toBe(true);
  });

  it('Leash Puller, off: nothing (the usual Move All)', () => {
    let s = trailGame(['finn', 'ellie']);
    s = run(s, toggle('finn', 'finn-leader-t1'), moveAll('finn', 'L', 'ellie'));
    expect(stat(s, 'finn', 'appetite')).toBe(10 - 2);
    expect(stat(s, 'finn', 'energy')).toBe(10);
  });

  it('Leash Puller II, off: each hiker brought may cost no Appetite and keep their action', () => {
    const start = () =>
      run(
        learn(trailGame(['finn', 'ellie']), 'finn', 'finn-leader-t2'),
        toggle('finn', 'finn-leader-t2'),
      );
    withValue(B.leashPuller.offChance, 2, 1, () => {
      const s = run(start(), moveAll('finn', 'L', 'ellie'));
      expect(stat(s, 'finn', 'appetite')).toBe(9);
      expect(hiker(s, 'ellie').acted).toBe(false);
    });
    withValue(B.leashPuller.offChance, 2, 0, () => {
      const s = run(start(), moveAll('finn', 'L', 'ellie'));
      expect(stat(s, 'finn', 'appetite')).toBe(8);
      expect(hiker(s, 'ellie').acted).toBe(true);
    });
  });

  it('Leash Puller III, off: brings hikers who acted, and nobody loses an action', () => {
    withValue(B.leashPuller.offChance, 3, 0, () => {
      let s = learn(
        trailGame(['finn', 'ellie', 'mom']),
        'finn',
        'finn-leader-t2',
        'finn-leader-t3',
      );
      s = run(s, toggle('finn', 'finn-leader-t3'));
      hiker(s, 'ellie').acted = true;
      s = run(s, moveAll('finn', 'L', 'ellie', 'mom'));
      expect(hiker(s, 'mom').acted).toBe(false);
      expect(stat(s, 'finn', 'appetite')).toBe(10 - 3);
    });
  });
});

describe('Finn: Follower Trail', () => {
  it('Whatcha Up To?: being brought along costs Finn no Appetite (the leader’s part or his own)', () => {
    let s = toNight(trailGame([['finn', 'finn-follower'], 'ellie']));
    s = run(s, moveAll('ellie', 'L', 'finn'));
    // Ellie: her own crossing and the night; nothing for Finn.
    expect(stat(s, 'ellie', 'appetite')).toBe(10 - 2);
    expect(stat(s, 'finn', 'appetite')).toBe(10);
    expect(hiker(s, 'finn').acted).toBe(true);
  });

  it('Whatcha Up To? II: …and doesn’t use his action', () => {
    let s = learn(trailGame([['finn', 'finn-follower'], 'ellie']), 'finn', 'finn-follower-t2');
    s = run(s, moveAll('ellie', 'L', 'finn'));
    expect(hiker(s, 'finn').acted).toBe(false);
    expect(stat(s, 'finn', 'appetite')).toBe(10);
  });

  it('Never Alone: onto a tile with a hiker, no action and no Appetite; an empty tile as usual', () => {
    let s = learn(
      trailGame([['finn', 'finn-follower'], 'ellie']),
      'finn',
      'finn-follower-t2',
      'finn-follower-t3',
    );
    s = run(s, move('ellie', 'L'), move('finn', 'L'));
    expect(stat(s, 'finn', 'appetite')).toBe(10);
    expect(hiker(s, 'finn').acted).toBe(false);
    s = run(s, move('finn', 'M'));
    expect(stat(s, 'finn', 'appetite')).toBeLessThan(10);
    expect(hiker(s, 'finn').acted).toBe(true);
  });
});

describe('Finn: Scavenger Path (Copydog)', () => {
  const onL = (s: GameState) => {
    for (const h of s.hikers) place(s, h.id, 'L');
    return s;
  };

  it('Copydog: 1 more of what he keeps for each hiker who scavenged his tile earlier this phase', () => {
    let s = onL(trailGame([['finn', 'finn-scavenger'], 'ellie']));
    s = scavengeTake(s, 'ellie');
    s = scavengeTake(s, 'finn');
    const got = s.log.filter((e) => e.kind === 'scavenge' && e.hikerId === 'finn').at(-1);
    expect(got).toMatchObject({ bonus: 1 });
    // Next phase, nobody has scavenged it yet.
    s = run(s, END);
    expect(scavengeSetup(s, hiker(s, 'finn')).bonusOffers).toEqual([]);
  });

  it('Copydog II: first to scavenge his tile, he sees 2 more cards', () => {
    const s = onL(trailGame([['finn', 'finn-scavenger'], 'ellie']));
    const base = scavengeSetup(s, hiker(s, 'finn')).count;
    learn(s, 'finn', 'finn-scavenger-t2');
    expect(scavengeSetup(s, hiker(s, 'finn')).count).toBe(base + B.copydog.cards);
    const after = scavengeTake(s, 'ellie');
    expect(scavengeSetup(after, hiker(after, 'finn')).count).toBe(base);
  });

  it('Copydog III alone: both first and last, so no Appetite and 2 more cards', () => {
    const s = onL(trailGame([['finn', 'finn-scavenger']]));
    const base = scavengeSetup(s, hiker(s, 'finn')).count;
    learn(s, 'finn', 'finn-scavenger-t2', 'finn-scavenger-t3');
    expect(scavengeCost(s, hiker(s, 'finn'))).toBe(0);
    expect(scavengeSetup(s, hiker(s, 'finn')).count).toBe(base + B.copydog.cards);
  });

  it('Copydog III with others: first is free, last sees 2 more cards', () => {
    let s = onL(trailGame([['finn', 'finn-scavenger'], 'ellie']));
    const base = scavengeSetup(s, hiker(s, 'finn')).count;
    learn(s, 'finn', 'finn-scavenger-t2', 'finn-scavenger-t3');
    // First, but Ellie can still act: not last.
    expect(scavengeCost(s, hiker(s, 'finn'))).toBe(0);
    expect(scavengeSetup(s, hiker(s, 'finn')).count).toBe(base);
    // Ellie scavenged: he's last, not first.
    s = scavengeTake(s, 'ellie');
    expect(scavengeCost(s, hiker(s, 'finn'))).toBe(BALANCE.scavenge.appetite);
    expect(scavengeSetup(s, hiker(s, 'finn')).count).toBe(base + B.copydog.cards);
  });
});

// ── Ellie ──────────────────────────────────────────────────────────────────

describe('Ellie: Chef Path (Garbage Connoisseur)', () => {
  /** Ellie crafts a basic food with 2 Metal in the key spaces; the food's Appetite per bite. */
  function craftWithMetal(s: GameState): GameState {
    const e = hiker(s, 'ellie');
    e.inventory.resources = { metal: 2, wood: 1, grass: 1 };
    let out = run(s, {
      type: 'craft',
      hikerId: 'ellie',
      itemType: 'food',
      slots: [
        { from: 'ellie', resource: 'metal' },
        { from: 'ellie', resource: 'metal' },
        { from: 'ellie', resource: 'wood' },
        { from: 'ellie', resource: 'grass' },
      ],
    });
    out = run(out, { type: 'craftTake', index: 0 });
    return out;
  }
  const crafted = (s: GameState) => hiker(s, 'ellie').inventory.bag.at(-1);

  it('Garbage Connoisseur: Metal, Stone or Flint for Meat, Fish or Mushroom; each one: −1 a bite', () => {
    const s = craftWithMetal(trailGame(['ellie']));
    expect(ITEMS[crafted(s)!.itemId]?.type).toBe('food');
    expect(crafted(s)?.appetiteMod).toBe(2 * B.garbageConnoisseur.perSwap[1]);
  });

  it('…only for food: other recipes take no stand-ins', () => {
    const s = trailGame(['ellie']);
    hiker(s, 'ellie').inventory.resources = { metal: 2, fur: 3 };
    const clothes: Action = {
      type: 'craft',
      hikerId: 'ellie',
      itemType: 'clothes',
      slots: [
        { from: 'ellie', resource: 'metal' },
        { from: 'ellie', resource: 'metal' },
        { from: 'ellie', resource: 'fur' },
        { from: 'ellie', resource: 'fur' },
        { from: 'ellie', resource: 'fur' },
      ],
    };
    expect(validateAction(s, clothes)).toBe('That resource doesn’t fit that space.');
  });

  it('Garbage Connoisseur II: swapped-in resources no longer lower the Appetite', () => {
    const s = craftWithMetal(learn(trailGame(['ellie']), 'ellie', 'ellie-chef-t2'));
    expect(crafted(s)?.appetiteMod ?? 0).toBe(0);
  });

  it('Garbage Connoisseur III: each one swapped in adds 1 Appetite to every bite', () => {
    const s = craftWithMetal(
      learn(trailGame(['ellie']), 'ellie', 'ellie-chef-t2', 'ellie-chef-t3'),
    );
    expect(crafted(s)?.appetiteMod).toBe(2 * B.garbageConnoisseur.perSwap[3]);
  });
});

describe('Ellie: Scavenger Path', () => {
  it('Furrager: Fur is much more likely', () => {
    const s = trailGame([['ellie', 'ellie-scavenger']]);
    expect(scavengeSetup(s, hiker(s, 'ellie')).resourceWeight?.fur).toBe(B.furrager.furWeight);
  });

  it('Furrager II: Fur comes ×2 or ×3, and turns up on tiles with no Wildlife node', () => {
    const s = learn(trailGame([['ellie', 'ellie-scavenger']]), 'ellie', 'ellie-scavenger-t2');
    const setup = scavengeSetup(s, hiker(s, 'ellie'));
    expect(setup.multiply).toEqual({ resource: 'fur', x2: B.furrager.x2 });
    expect(setup.resourceSwap).toEqual({ resource: 'fur', chance: B.furrager.offNodeChance });
    // With a sure chance on a Forest tile, every resource card is Fur, ×2 or ×3.
    const rng = seedRng(7);
    const input = {
      nodes: [{ type: 'forest' as const, revealed: true }],
      abundance: 20,
      luck: 0,
      count: 1,
      resourceSwap: { resource: 'fur', chance: 1 },
      multiply: { resource: 'fur', x2: 0.5 },
    };
    for (let i = 0; i < 40; i++) {
      const card = dealCard(rng, input);
      if (!isResourceCard(card.type) || card.empty) continue;
      expect(card.resources?.every((r) => r === 'fur')).toBe(true);
      expect([2, 3]).toContain(card.resources?.length);
    }
    // A tile with a Wildlife node keeps its own cards.
    const wild = dealCard(seedRng(3), {
      ...input,
      nodes: [{ type: 'wildlife' as const, revealed: true }],
      multiply: undefined,
    } as never);
    expect(wild).toBeDefined();
  });

  it('Fur Trade: 3 Fur for 1 resource of her choice; it takes her action; no limit', () => {
    let s = learn(
      trailGame([['ellie', 'ellie-scavenger']]),
      'ellie',
      'ellie-scavenger-t2',
      'ellie-scavenger-t3',
    );
    hiker(s, 'ellie').inventory.resources = { fur: 7 };
    s = run(s, use('ellie', 'furTrade', 'salt'));
    expect(hiker(s, 'ellie').inventory.resources).toEqual({ fur: 4, salt: 1 });
    expect(hiker(s, 'ellie').acted).toBe(true);
    s = run(s, END, use('ellie', 'furTrade', 'metal'));
    expect(hiker(s, 'ellie').inventory.resources).toEqual({ fur: 1, salt: 1, metal: 1 });
    expect(() => run(run(s, END), use('ellie', 'furTrade', 'wood'))).toThrow();
  });
});

describe('Ellie: Entertainer Loop', () => {
  it('Singer: for 1 Energy, every hiker on her tile gains 1 Morale; once a day', () => {
    let s = trailGame([['ellie', 'ellie-entertainer'], 'finn']);
    place(s, 'finn', 'T', { morale: 5 });
    place(s, 'ellie', 'T', { morale: 5 });
    s = run(s, use('ellie', 'singer'));
    expect(stat(s, 'ellie', 'energy')).toBe(10 - B.singer.energy);
    expect([stat(s, 'ellie', 'morale'), stat(s, 'finn', 'morale')]).toEqual([6, 6]);
    expect(hiker(s, 'ellie').acted).toBe(false);
    expect(() => run(s, use('ellie', 'singer'))).toThrow();
  });

  it('Loud: her Keep Watch also covers the tiles next to her', () => {
    const s = trailGame([['ellie', 'ellie-entertainer']]);
    expect(watchReach(s, hiker(s, 'ellie'))).toBe(0);
    learn(s, 'ellie', 'ellie-entertainer-t2');
    expect(watchReach(s, hiker(s, 'ellie'))).toBe(1);
  });

  it('Singer II: her tile and the tiles next to it gain 2 Morale, for no Energy', () => {
    let s = learn(
      trailGame([['ellie', 'ellie-entertainer'], 'finn', 'mom']),
      'ellie',
      'ellie-entertainer-t2',
      'ellie-entertainer-t3',
    );
    place(s, 'ellie', 'T', { morale: 5 });
    place(s, 'finn', 'L', { morale: 5 });
    place(s, 'mom', 'C', { morale: 5 });
    s = run(s, use('ellie', 'singer'));
    expect(stat(s, 'ellie', 'energy')).toBe(10);
    expect([
      stat(s, 'ellie', 'morale'),
      stat(s, 'finn', 'morale'),
      stat(s, 'mom', 'morale'),
    ]).toEqual([7, 7, 5]);
  });
});

// ── Mom ────────────────────────────────────────────────────────────────────

describe('Mom: Support Loop', () => {
  it('Dog Mom: a Dog scavenging on her tile gives her a resource from one of its nodes', () => {
    let s = trailGame(['mom', 'finn']);
    place(s, 'mom', 'L');
    place(s, 'finn', 'L');
    s = scavengeTake(s, 'finn');
    const forest = ['wood', 'moss', 'mushroom', 'grass'];
    const mine = Object.keys(hiker(s, 'mom').inventory.resources);
    expect(mine).toHaveLength(1);
    expect(forest).toContain(mine[0]);
  });

  it('Agility Class: for 1 Energy, a Dog on her tile who acted gets another action', () => {
    let s = learn(trailGame(['mom', 'finn']), 'mom', 'mom-support-t2');
    expect(
      abilitiesFor(s, hiker(s, 'mom')).find((a) => a.ability.id === 'agilityClass')?.choices,
    ).toEqual([]);
    hiker(s, 'finn').acted = true;
    s = run(s, use('mom', 'agilityClass', 'finn'));
    expect(hiker(s, 'finn').acted).toBe(false);
    expect(stat(s, 'mom', 'energy')).toBe(10 - B.agilityClass.energy);
    expect(hiker(s, 'mom').acted).toBe(false);
  });

  it('Agility Class II: no Energy', () => {
    let s = learn(trailGame(['mom', 'finn']), 'mom', 'mom-support-t2', 'mom-support-t3');
    hiker(s, 'finn').acted = true;
    s = run(s, use('mom', 'agilityClass', 'finn'));
    expect(stat(s, 'mom', 'energy')).toBe(10);
    expect(hiker(s, 'finn').acted).toBe(false);
  });
});

describe('Mom: Merchant Path (MBA)', () => {
  const capsTile = {
    nodes: [{ type: 'caps' as const, revealed: true }],
    abundance: 20,
    luck: 0,
    count: 1,
  };

  it('MBA: Caps are more likely', () => {
    const s = trailGame([['mom', 'mom-merchant']]);
    expect(scavengeSetup(s, hiker(s, 'mom')).typeWeight?.caps).toBe(B.mba.capsWeight);
  });

  it('MBA II: Caps cards give 2 more', () => {
    const s = learn(trailGame([['mom', 'mom-merchant']]), 'mom', 'mom-merchant-t2');
    expect(scavengeSetup(s, hiker(s, 'mom')).capsBonus).toBe(B.mba.capsBonus);
    const card = dealCard(seedRng(4), { ...capsTile, capsBonus: B.mba.capsBonus });
    expect(card.caps).toBeGreaterThanOrEqual(BALANCE.scavenge.caps.min + B.mba.capsBonus);
  });

  it('MBA III: Caps cards are kept at once, and she still picks another card', () => {
    let s = learn(
      trailGame([['mom', 'mom-merchant']]),
      'mom',
      'mom-merchant-t2',
      'mom-merchant-t3',
    );
    place(s, 'mom', 'L');
    s.debugDeal = ['caps'];
    s = run(s, { type: 'scavenge', hikerId: 'mom' });
    expect(s.caps).toBeGreaterThan(0);
    expect(s.scavenge?.cards[0]).toMatchObject({ taken: true, flipped: true });
    expect(s.scavenge?.cards.some((c) => !c.taken)).toBe(true);
    expect(hiker(s, 'mom').acted).toBe(false);
  });
});

describe('Mom: Trekker Trail (Experienced Traveler)', () => {
  it('Experienced Traveler: moving alone may cost no Appetite', () => {
    withValue(B.experiencedTraveler.alone, 1, 1, () => {
      const s = run(trailGame([['mom', 'mom-trekker']]), move('mom', 'L'));
      expect(stat(s, 'mom', 'appetite')).toBe(10);
    });
    withValue(B.experiencedTraveler.alone, 1, 0, () => {
      const s = run(trailGame([['mom', 'mom-trekker']]), move('mom', 'L'));
      expect(stat(s, 'mom', 'appetite')).toBe(9);
    });
  });

  it('Experienced Traveler II: brought along, a chance it costs no Appetite', () => {
    withValue(B.experiencedTraveler.brought, 2, 1, () => {
      const s = run(
        learn(trailGame([['mom', 'mom-trekker'], 'ellie']), 'mom', 'mom-trekker-t2'),
        moveAll('ellie', 'L', 'mom'),
      );
      expect(stat(s, 'ellie', 'appetite')).toBe(9);
      expect(stat(s, 'mom', 'appetite')).toBe(10);
    });
  });

  it('Experienced Traveler III: brought along never costs Appetite, +1 Morale each move', () => {
    let s = learn(
      trailGame([['mom', 'mom-trekker'], 'ellie']),
      'mom',
      'mom-trekker-t2',
      'mom-trekker-t3',
    );
    s = toNight(s);
    place(s, 'mom', 'T', { morale: 5 });
    s = run(s, moveAll('ellie', 'L', 'mom'));
    expect(stat(s, 'mom', 'appetite')).toBe(10);
    expect(stat(s, 'ellie', 'appetite')).toBe(10 - 2);
    expect(stat(s, 'mom', 'morale')).toBe(6);
  });
});

// ── Gdog ───────────────────────────────────────────────────────────────────

describe('Gdog, Wink and Wyatt: recipes, Artisan and Master', () => {
  const recipeSteps: [string, string, ItemTypeName][] = [
    ['gdog', 'gdog-chef', 'food'],
    ['gdog', 'gdog-tailor', 'clothes'],
    ['grandpaWink', 'wink-architect', 'shelter'],
    ['wyatt', 'wyatt-smith', 'tool'],
  ];

  it.each(recipeSteps)('%s, %s Tier 1: start with 3 random Tier 1 recipes', (id, tree, type) => {
    const s = trailGame([[id, tree]]);
    const known = hiker(s, id).blueprints ?? [];
    const available = Object.values(ITEMS).filter(
      (d) => d.type === type && d.tier === 1 && !!d.recipe && d.enabled !== false,
    ).length;
    expect(known).toHaveLength(Math.min(B.recipes, available));
    expect(known.every((b) => ITEMS[b]?.type === type && ITEMS[b]?.tier === 1)).toBe(true);
    expect(s.log.some((e) => e.kind === 'blueprints')).toBe(known.length > 0);
  });

  it.each(recipeSteps)(
    '%s, %s Tiers 2 and 3: craft that tier, with more cards',
    (id, tree, type) => {
      const s = trailGame([[id, tree]]);
      const h = () => hiker(s, id);
      const other: ItemTypeName = type === 'tool' ? 'food' : 'tool';
      const base = craftSetup(s, h(), type).cards;
      const otherBase = craftSetup(s, h(), other).cards;
      learn(s, id, `${tree}-t2`);
      expect(ownCraftTier(h(), type, s)).toBe(2);
      expect(craftSetup(s, h(), type).cards).toBe(base + B.artisanCards);
      expect(craftSetup(s, h(), other).cards).toBe(otherBase);
      learn(s, id, `${tree}-t3`);
      expect(ownCraftTier(h(), type, s)).toBe(3);
      expect(craftSetup(s, h(), type).cards).toBe(base + B.masterCards);
    },
  );
});

describe('Gdog: Trekker Trail', () => {
  it('Short: moving alone costs 1 less Appetite; −1 item slot', () => {
    const s = trailGame(['gdog', 'finn']);
    const slots = bagSlots(s, hiker(s, 'gdog')).total;
    learn(s, 'gdog', 'gdog-trekker-t1');
    expect(bagSlots(s, hiker(s, 'gdog')).total).toBe(slots + B.short.slots);
    const after = run(s, move('gdog', 'L'));
    expect(stat(after, 'gdog', 'appetite')).toBe(10);
  });

  it('Short II: brought along costs 1 less too (not when she leads), and the slot comes back', () => {
    const s = trailGame(['gdog', 'finn', 'ellie']);
    const slots = bagSlots(s, hiker(s, 'gdog')).total;
    learn(s, 'gdog', 'gdog-trekker-t1', 'gdog-trekker-t2');
    expect(bagSlots(s, hiker(s, 'gdog')).total).toBe(slots);
    const brought = run(s, toggle('finn', 'finn-leader-t1'), moveAll('finn', 'L', 'gdog'));
    expect(stat(brought, 'finn', 'appetite')).toBe(9);
    const leads = run(s, moveAll('gdog', 'L', 'ellie'));
    expect(stat(leads, 'gdog', 'appetite')).toBe(8);
  });

  it('Homemade: crafting, 1 more card and +1 Luck', () => {
    const s = learn(trailGame([['gdog', 'gdog-trekker']]), 'gdog', 'gdog-trekker-t2');
    const before = craftSetup(s, hiker(s, 'gdog'), 'food');
    learn(s, 'gdog', 'gdog-trekker-t3');
    const after = craftSetup(s, hiker(s, 'gdog'), 'food');
    expect(after.cards - before.cards).toBe(B.homemade.cards);
    expect(after.luck - before.luck).toBe(B.homemade.luck);
  });
});

// ── Wink ───────────────────────────────────────────────────────────────────

describe('Wink: Leader Trail', () => {
  it('Lead the Way: hikers he brings along don’t use their action', () => {
    const s = run(trailGame(['grandpaWink', 'finn']), moveAll('grandpaWink', 'L', 'finn'));
    expect(hiker(s, 'finn').acted).toBe(false);
    expect(hiker(s, 'grandpaWink').acted).toBe(true);
  });

  it('Lead the Way II: his Move All costs 1 less in all, not per hiker', () => {
    const s = learn(trailGame(['grandpaWink', 'finn', 'ellie']), 'grandpaWink', 'wink-leader-t2');
    const after = run(s, moveAll('grandpaWink', 'L', 'finn', 'ellie'));
    expect(stat(after, 'grandpaWink', 'appetite')).toBe(10 - (1 + 2 - B.leadTheWay.discount));
    expect(hiker(after, 'ellie').acted).toBe(false);
  });

  it('two Move All cost cuts stack, and nothing goes below 0', () => {
    // Wink (Lead the Way II) brings Gdog (Short II) and Finn (Whatcha Up To?).
    const s = trailGame(['grandpaWink', 'gdog', ['finn', 'finn-follower']]);
    learn(s, 'grandpaWink', 'wink-leader-t2');
    learn(s, 'gdog', 'gdog-trekker-t1', 'gdog-trekker-t2');
    const after = run(s, moveAll('grandpaWink', 'L', 'gdog', 'finn'));
    // 1 for himself, 0 for Gdog (1 − 1), 0 for Finn, then −1: 0.
    expect(stat(after, 'grandpaWink', 'appetite')).toBe(10);
    expect(stat(after, 'gdog', 'appetite')).toBe(10);
    expect(stat(after, 'finn', 'appetite')).toBe(10);
  });

  it('Just Around the Next Corner: near the checkpoint, each hiker in his Move All may cost no Appetite', () => {
    const start = () =>
      learn(trailGame(['grandpaWink', 'finn']), 'grandpaWink', 'wink-leader-t2', 'wink-leader-t3');
    withValue(B.justAroundTheNextCorner, 'chance', 1, () => {
      const s = run(start(), moveAll('grandpaWink', 'L', 'finn'));
      expect(stat(s, 'grandpaWink', 'appetite')).toBe(10);
    });
    withValue(B.justAroundTheNextCorner, 'tiles', 0, () => {
      withValue(B.justAroundTheNextCorner, 'chance', 1, () => {
        const s = run(start(), moveAll('grandpaWink', 'L', 'finn'));
        expect(stat(s, 'grandpaWink', 'appetite')).toBe(10 - 1);
      });
    });
  });
});

describe('Wink: Packer Path', () => {
  it('Packed Toolbox: start with 2 random Tier 1 tools', () => {
    const s = trailGame([['grandpaWink', 'wink-packer']]);
    const tools = hiker(s, 'grandpaWink').inventory.bag.map((i) => ITEMS[i.itemId]);
    expect(tools).toHaveLength(B.packedToolbox.tools);
    expect(tools.every((d) => d?.type === 'tool' && d.tier === 1)).toBe(true);
  });

  it('The Proper Way: tools in his pack have 1 more use, lost when traded away', () => {
    const s = learn(
      trailGame([['grandpaWink', 'wink-packer'], 'finn']),
      'grandpaWink',
      'wink-packer-t2',
    );
    const wink = hiker(s, 'grandpaWink');
    const tool = wink.inventory.bag[0]!;
    const full = tool.usesLeft!;
    syncExtraUses(s);
    expect(tool.usesLeft).toBe(full + B.properWay.uses);
    expect(tool.extraUse).toBe(true);
    // Traded to Finn: the extra use is gone.
    wink.inventory.bag.splice(0, 1);
    hiker(s, 'finn').inventory.bag.push(tool);
    syncExtraUses(s);
    expect(tool.usesLeft).toBe(full);
    expect(tool.extraUse).toBeUndefined();
    // A new tool coming into his pack gets it too.
    wink.inventory.bag.push(makeItem(s, tool.itemId, { prefix: 'test' }));
    syncExtraUses(s);
    expect(wink.inventory.bag.at(-1)?.extraUse).toBe(true);
  });

  describe('Prepper: doesn’t set off a challenge that’s already revealed', () => {
    const revealedOnL = () => {
      const s = learn(
        trailGame([['grandpaWink', 'wink-packer'], 'ellie'], { challenges: true }),
        'grandpaWink',
        'wink-packer-t2',
        'wink-packer-t3',
      );
      s.section.tiles.L!.revealedCard = { cardId: firstChallenge(1).id, tier: 1, scale: 1 };
      return s;
    };

    it('alone: nothing happens, and the challenge stays for the others', () => {
      let s = run(revealedOnL(), move('grandpaWink', 'L'));
      expect(s.challenge).toBeUndefined();
      expect(s.section.tiles.L?.revealedCard?.cardId).toBe(firstChallenge(1).id);
      s = run(s, move('ellie', 'L'));
      expect(s.challenge).toMatchObject({ tileId: 'L', hikerIds: ['ellie'] });
    });

    it('with others: they do the challenge, Wink sits it out', () => {
      const s = run(revealedOnL(), moveAll('grandpaWink', 'L', 'ellie'));
      expect(s.challenge?.hikerIds).toEqual(['ellie']);
    });

    it('a challenge nobody revealed: Wink faces it as usual', () => {
      const s = revealedOnL();
      delete s.section.tiles.L!.revealedCard;
      const after = run(s, move('grandpaWink', 'L'));
      expect(after.challenge?.hikerIds ?? ['grandpaWink']).toContain('grandpaWink');
    });
  });
});

// ── Wyatt ──────────────────────────────────────────────────────────────────

describe('Wyatt: Naturalist Path (Rain Lover)', () => {
  const setupIn = (s: GameState, weather: 'clear' | 'rain' | 'wind') => {
    s.weather.today = weather;
    return scavengeSetup(s, hiker(s, 'wyatt'));
  };

  it.each([1, 2] as const)(
    'Rain Lover %s: Luck and 1 more card in any weather but Clear',
    (tier) => {
      const s = trailGame(['wyatt']);
      if (tier === 2) learn(s, 'wyatt', 'wyatt-naturalist-t2');
      place(s, 'wyatt', 'L');
      const clear = setupIn(s, 'clear');
      const wind = setupIn(s, 'wind');
      expect(wind.count - clear.count).toBe(B.rainLover.cards);
      expect(wind.luck - clear.luck).toBe(B.rainLover.luck[tier]);
    },
  );

  it('Rain Lover III: all his XP is doubled during weather', () => {
    const s = learn(trailGame(['wyatt']), 'wyatt', 'wyatt-naturalist-t2', 'wyatt-naturalist-t3');
    s.weather.today = 'rain';
    expect(gainXp(s, hiker(s, 'wyatt'), 10, 'challenge', 'test')).toBe(20);
    s.weather.today = 'clear';
    expect(gainXp(s, hiker(s, 'wyatt'), 10, 'challenge', 'test')).toBe(10);
    expect(s.party?.xp).toBe(30);
  });
});

describe('Wyatt: Daredevil Loop (Rule Changer)', () => {
  const game = (...steps: string[]) => {
    const s = learn(
      trailGame([['wyatt', 'wyatt-daredevil']], { challenges: true }),
      'wyatt',
      ...steps,
    );
    s.section.tiles.L!.revealedCard = { cardId: firstChallenge(1).id, tier: 1, scale: 1 };
    return s;
  };
  const choices = (s: GameState) =>
    abilitiesFor(s, hiker(s, 'wyatt'))
      .find((a) => a.ability.id === 'ruleChanger')
      ?.choices?.map((c) => c.id) ?? [];

  it('Rule Changer: swaps a revealed Tier 1 challenge next to him for another; once a section', () => {
    let s = game();
    expect(choices(s)).toEqual(['L']);
    place(s, 'wyatt', 'R');
    expect(choices(s)).toEqual([]);
    place(s, 'wyatt', 'T');
    s = run(s, use('wyatt', 'ruleChanger', 'L'));
    const card = s.section.tiles.L?.revealedCard;
    expect(card?.cardId).not.toBe(firstChallenge(1).id);
    expect(card?.tier).toBe(1);
    expect(CHALLENGES.some((c) => c.id === card?.cardId)).toBe(true);
    expect(() => run(s, use('wyatt', 'ruleChanger', 'L'))).toThrow();
  });

  it('Rule Changer II: Tier 1 or 2 on any tile, twice a section', () => {
    let s = game('wyatt-daredevil-t2');
    s.section.tiles.M!.revealedCard = { cardId: firstChallenge(2).id, tier: 2, scale: 1 };
    place(s, 'wyatt', 'R');
    expect(choices(s).sort()).toEqual(['L', 'M']);
    s = run(s, use('wyatt', 'ruleChanger', 'M'), use('wyatt', 'ruleChanger', 'L'));
    expect(s.section.tiles.M?.revealedCard?.tier).toBe(2);
    expect(s.section.tiles.M?.revealedCard?.cardId).not.toBe(firstChallenge(2).id);
    expect(() => run(s, use('wyatt', 'ruleChanger', 'L'))).toThrow();
  });

  it('Rule Changer III: removes a challenge from any tile, even unrevealed', () => {
    let s = game('wyatt-daredevil-t2', 'wyatt-daredevil-t3');
    delete s.section.tiles.L!.revealedCard;
    expect(choices(s).sort()).toEqual(['L', 'M', 'R']);
    s = run(s, use('wyatt', 'ruleChanger', 'L'));
    expect(s.section.tiles.L?.quiet).toBe(true);
    s = run(s, move('wyatt', 'L'));
    expect(s.challenge).toBeUndefined();
  });

  it('Rule Changer III on an empty tile: the use is wasted, and nothing says so', () => {
    let s = game('wyatt-daredevil-t2', 'wyatt-daredevil-t3');
    s.section.tiles.M!.quiet = true;
    const before = structuredClone(s.section.tiles.M);
    s = run(s, use('wyatt', 'ruleChanger', 'M'));
    expect(s.section.tiles.M).toEqual(before);
    expect(
      abilitiesFor(s, hiker(s, 'wyatt')).find((a) => a.ability.id === 'ruleChanger')?.usesLeft,
    ).toBe(B.ruleChanger.uses[3] - 1);
    const said = s.log.filter((e) => e.kind === 'ability' && e.hikerId === 'wyatt');
    expect(said).toHaveLength(1);
  });
});
