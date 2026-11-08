import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS, TIER_3_ITEMS } from '../../content';
import { WONDER_BY_ID, WONDERS } from '../../content/wonders';
import { validateAction } from '../applyAction';
import { revealableFrom, unrevealedTiles } from '../challenges/buttons';
import { revealCardOn } from '../challenges/reveal';
import { addCondition } from '../conditions';
import { seedRng } from '../rng';
import { deserialize, serialize } from '../save';
import { changeStat } from '../stats';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import { checkSection } from '../trail/check';
import { generateSection } from '../trail/generate';
import type { Action, GameState, HikerId } from '../types';
import type { WonderPick } from './types';
import { goalPlayable, scaledNumber, wonderProgress } from './wonders';

/** The fixture with a hidden Wonder on M (no nodes, like a generated one). */
function withWonder(id = 'crater-lake', setup: (s: GameState) => void = () => {}): GameState {
  const s = fixtureGame({ seed: 3, challenges: true });
  s.section.tiles.M!.nodes = [];
  s.section.tiles.M!.wonder = { id, decoys: 2 };
  setup(s);
  return s;
}

/** A revealed Wonder on M showing just the goals given (index into its 5, and X). */
function showing(s: GameState, id: string, goals: { index: number; x?: number }[]): void {
  s.section.tiles.M!.nodes = [];
  s.section.tiles.M!.wonder = { id, decoys: 2, goals, tier3: [...TIER_3_ITEMS] };
}

/** Is one goal met, with these hikers on M? */
function met(s: GameState, id: string, index: number, x?: number): boolean {
  showing(s, id, [x === undefined ? { index } : { index, x }]);
  return wonderProgress(s, 'M')!.goals[0]!.met;
}

const accomplish = (picks: Record<HikerId, WonderPick>): Action => ({
  type: 'accomplishWonder',
  tileId: 'M',
  picks,
});

describe('Wonder tiles', () => {
  it('every section gets exactly one, on a plain tile with no nodes', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const section = generateSection(seedRng(seed), { biome: 'meadow', tier: 1 });
      expect(checkSection(section)).toEqual([]);
      const tiles = Object.values(section.tiles).filter((t) => t.wonder);
      expect(tiles).toHaveLength(1);
      const t = tiles[0]!;
      expect(t.kind).toBe('normal');
      expect(t.nodes).toEqual([]);
      expect(t.special).toBeNull();
      expect(t.wonder!.decoys).toBeGreaterThanOrEqual(1);
      seen.add(t.wonder!.id);
    }
    expect([...seen].sort()).toEqual(WONDERS.map((w) => w.id).sort());
  });

  it('a new biome gets a Wonder not used yet this run', () => {
    const used = WONDERS.slice(0, 6).map((w) => w.id);
    for (let seed = 1; seed <= 30; seed++) {
      const section = generateSection(seedRng(seed), {
        biome: 'meadow',
        tier: 1,
        usedWonders: used,
      });
      const w = Object.values(section.tiles).find((t) => t.wonder)?.wonder;
      expect(w?.id).toBe(WONDERS[6]!.id);
    }
  });

  it('nobody can scavenge there', () => {
    const s = withWonder();
    place(s, 'ash', 'M');
    s.section.tiles.M!.visited = true;
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toMatch(/Wonder/);
  });
});

describe('revealing a Wonder', () => {
  it('landing there reveals it: 3 goals that can be met now, and 3 Tier III items, never a card', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = withWonder('fort-rock', (g) => {
        g.seed = seed;
        g.rng = seedRng(seed);
      });
      const after = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
      expect(after.challenge).toBeUndefined();
      const w = after.section.tiles.M!.wonder!;
      expect(w.goals).toHaveLength(3);
      // Fort Rock's clothing durability goal (index 4) waits on Phase 8.
      expect(w.goals!.map((g) => g.index)).not.toContain(4);
      expect(new Set(w.goals!.map((g) => g.index)).size).toBe(3);
      expect([...w.tier3!].sort()).toEqual([...TIER_3_ITEMS].sort());
      expect(after.log.at(-1)).toMatchObject({ kind: 'wonderRevealed', tileId: 'M' });
    }
  });

  it('every Wonder has at least 3 goals that can be picked now', () => {
    for (const w of WONDERS) {
      expect(w.goals).toHaveLength(5);
      expect(w.rewards).toHaveLength(3);
      expect(w.goals.filter(goalPlayable).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('scales X by biome: more for "at least", less for "at most", none for fixed numbers', () => {
    expect(scaledNumber({ base: 6, compare: 'atLeast' }, 0)).toBe(6);
    expect(scaledNumber({ base: 6, compare: 'atLeast' }, 1)).toBe(9);
    expect(scaledNumber({ base: 5, compare: 'atMost' }, 1)).toBe(3);
    expect(scaledNumber({ base: 2, compare: 'atLeast', scales: false }, 2)).toBe(2);
    const s = withWonder('witchs-castle', (g) => {
      g.sectionIndex = 1;
    });
    const after = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    for (const g of after.section.tiles.M!.wonder!.goals!) {
      const def = WONDER_BY_ID['witchs-castle']!.goals[g.index]!;
      if (def.x) expect(g.x).toBe(scaledNumber(def.x, 1));
    }
  });

  it('an early reveal reveals the Wonder instead of a card, and it can be revealed from next door', () => {
    const s = withWonder();
    expect(revealableFrom(s, hiker(s, 'ash')).map((t) => t.id)).toContain('M');
    expect(unrevealedTiles(s).map((t) => t.id)).not.toContain('M');
    expect(revealCardOn(s, 'M', 'Old Firewatch Tower')).toBe('crater-lake');
    expect(s.section.tiles.M!.revealedCard).toBeUndefined();
    expect(s.section.tiles.M!.wonder!.goals).toHaveLength(3);
    expect(s.log.at(-1)).toMatchObject({ kind: 'wonderRevealed', cause: 'Old Firewatch Tower' });
    // Landing there later doesn't pick new goals.
    const goals = structuredClone(s.section.tiles.M!.wonder!.goals);
    const after = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(after.section.tiles.M!.wonder!.goals).toEqual(goals);
    expect(after.challenge).toBeUndefined();
  });

  it('saves and loads with its goals', () => {
    const s = run(withWonder(), { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(deserialize(serialize(s))).toEqual({ ok: true, state: s });
  });
});

describe('Wonder goals, against only the hikers on the tile', () => {
  it('carrying: any mix, one hiker, everyone, every node type, totals', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    place(s, 'birch', 'M');
    place(s, 'cedar', 'L');
    hiker(s, 'ash').inventory.resources = { grass: 2, fish: 2, oil: 1 };
    hiker(s, 'birch').inventory.resources = { fish: 1 };
    // Cedar's flint is on another tile, so it doesn't count.
    hiker(s, 'cedar').inventory.resources = { flint: 5 };
    expect(met(s, 'crater-lake', 0, 6)).toBe(true);
    expect(wonderProgress(s, 'M')!.goals[0]!.readout).toBe('6/6');
    expect(met(s, 'crater-lake', 0, 7)).toBe(false);
    // Each hiker carries 2 Fish: Birch has 1.
    expect(met(s, 'crater-lake', 2, 2)).toBe(false);
    hiker(s, 'birch').inventory.resources = { fish: 2 };
    expect(met(s, 'crater-lake', 2, 2)).toBe(true);
    // One hiker carries 3 of one of Bones, Mushroom, Shell or Salt.
    hiker(s, 'ash').inventory.resources = { bones: 2, salt: 2 };
    expect(met(s, 'witchs-castle', 3, 3)).toBe(false);
    hiker(s, 'ash').inventory.resources = { bones: 3 };
    expect(met(s, 'witchs-castle', 3, 3)).toBe(true);
    // One hiker carries 5 of the same resource (any).
    hiker(s, 'birch').inventory.resources = { clay: 5 };
    expect(met(s, 'multnomah-falls', 3, 5)).toBe(true);
    // One hiker carries 2 of every node type.
    hiker(s, 'ash').inventory.resources = { wood: 2, fish: 1, clay: 1, meat: 2, stone: 1 };
    expect(met(s, 'multnomah-falls', 4, 2)).toBe(false);
    hiker(s, 'ash').inventory.resources = { wood: 2, fish: 1, clay: 1, meat: 2, stone: 2 };
    expect(met(s, 'multnomah-falls', 4, 2)).toBe(true);
    // 20 resources between them.
    hiker(s, 'ash').inventory.resources = { wood: 10 };
    hiker(s, 'birch').inventory.resources = { clay: 9 };
    expect(met(s, 'pittock-mansion', 2, 20)).toBe(false);
    hiker(s, 'birch').inventory.resources = { clay: 10 };
    expect(met(s, 'pittock-mansion', 2, 20)).toBe(true);
  });

  it('items: shelter cards carried, and no more than X tools', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    const bag = hiker(s, 'ash').inventory.bag;
    bag.push({ uid: 'a', itemId: 'medicTent' }, { uid: 'b', itemId: 'medicTent' });
    expect(met(s, 'pittock-mansion', 4, 3)).toBe(false);
    bag.push({ uid: 'c', itemId: 'medicTent' });
    expect(met(s, 'pittock-mansion', 4, 3)).toBe(true);
    expect(met(s, 'crater-lake', 4, 1)).toBe(true);
    bag.push({ uid: 'd', itemId: 'bandaid' }, { uid: 'e', itemId: 'medkit' });
    expect(met(s, 'crater-lake', 4, 1)).toBe(false);
  });

  it('stats: totals, everyone, the same, a spread, full', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M', { energy: 3, appetite: 6, morale: 1 });
    place(s, 'birch', 'M', { energy: 5, appetite: 6, morale: 3 });
    expect(met(s, 'witchs-castle', 4)).toBe(true); // less than 5 Morale combined
    expect(met(s, 'sleeping-giant', 0, 10)).toBe(false); // more than 10 Energy
    expect(met(s, 'sleeping-giant', 1)).toBe(true); // everyone Fatigued or Exhausted
    expect(met(s, 'multnomah-falls', 2)).toBe(true); // the same Appetite
    expect(met(s, 'multnomah-falls', 1)).toBe(false); // ≤2 Morale and another ≥8
    hiker(s, 'birch').stats.morale = 8;
    expect(met(s, 'multnomah-falls', 1)).toBe(true);
    expect(met(s, 'swiss-alps', 2, 9)).toBe(false); // everyone 9+ Morale
    expect(met(s, 'pittock-mansion', 3)).toBe(false); // one hiker full
    Object.assign(hiker(s, 'birch').stats, { energy: 10, appetite: 10, morale: 10 });
    expect(met(s, 'pittock-mansion', 3)).toBe(true);
    // A raised maximum raises "full" too.
    hiker(s, 'birch').maxBonus = { energy: 2 };
    expect(met(s, 'pittock-mansion', 3)).toBe(false);
  });

  it('conditions, injuries, the party, Abundance, counters and levels', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    place(s, 'birch', 'M');
    addCondition(s, hiker(s, 'ash'), 'bleeding', 1, 'days', 'test');
    addCondition(s, hiker(s, 'birch'), 'wet', 1, 'days', 'test');
    addCondition(s, hiker(s, 'birch'), 'lucky', 1, 'days', 'test');
    expect(met(s, 'witchs-castle', 0, 2)).toBe(true);
    expect(met(s, 'witchs-castle', 0, 3)).toBe(false);
    expect(met(s, 'witchs-castle', 1, 1)).toBe(true);
    expect(met(s, 'sleeping-giant', 3)).toBe(false);
    addCondition(s, hiker(s, 'ash'), 'sleepy', 1, 'days', 'test');
    expect(met(s, 'sleeping-giant', 3)).toBe(true);

    expect(met(s, 'swiss-alps', 1)).toBe(true); // no injuries
    hiker(s, 'birch').injuries = 1;
    expect(met(s, 'swiss-alps', 1)).toBe(false);
    expect(met(s, 'swiss-alps', 3, 3)).toBe(false); // 3 hikers here
    place(s, 'cedar', 'M');
    expect(met(s, 'swiss-alps', 3, 3)).toBe(true);

    s.caps = 9;
    expect(met(s, 'pittock-mansion', 1, 10)).toBe(false);
    s.caps = 10;
    expect(met(s, 'pittock-mansion', 1, 10)).toBe(true);
    s.abundance.river = BALANCE.abundance.max;
    expect(met(s, 'crater-lake', 1, 10)).toBe(true);

    s.counters.failed.ash = 3;
    expect(met(s, 'fort-rock', 3, 3)).toBe(true);
    s.counters.passed.dot = 9; // Dot isn't here
    expect(met(s, 'swiss-alps', 0, 5)).toBe(false);
    s.counters.daysSinceSleep.birch = 3;
    expect(met(s, 'sleeping-giant', 4, 3)).toBe(true);
    s.counters.sheltersPlaced[0] = 2;
    expect(met(s, 'fort-rock', 1, 3)).toBe(false);
    s.counters.sheltersPlaced[0] = 3;
    expect(met(s, 'fort-rock', 1, 3)).toBe(true);

    expect(met(s, 'swiss-alps', 4, 2)).toBe(false);
    hiker(s, 'ash').xp = 50;
    expect(met(s, 'swiss-alps', 4, 2)).toBe(true);
  });

  it('Crater Lake: there’s a weather right now (Phase 6)', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    expect(met(s, 'crater-lake', 3)).toBe(false);
    s.weather.today = 'rain';
    expect(met(s, 'crater-lake', 3)).toBe(true);
  });

  it('nothing about the hikers ticks with nobody there', () => {
    const s = fixtureGame();
    expect(met(s, 'multnomah-falls', 2)).toBe(false);
    expect(met(s, 'crater-lake', 4, 5)).toBe(false);
  });
});

describe('accomplishing a Wonder', () => {
  /** Crater Lake on M with Ash and Birch, its goals all met. */
  function ready(): GameState {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    place(s, 'birch', 'M');
    s.abundance.river = BALANCE.abundance.max;
    hiker(s, 'ash').inventory.resources = { fish: 3 };
    hiker(s, 'birch').inventory.resources = { fish: 3 };
    showing(s, 'crater-lake', [
      { index: 0, x: 6 },
      { index: 1, x: 10 },
      { index: 2, x: 2 },
    ]);
    return s;
  }

  it('waits until every goal is met', () => {
    const s = ready();
    hiker(s, 'birch').inventory.resources = { fish: 1 };
    expect(validateAction(s, accomplish({ ash: { reward: 2 }, birch: { reward: 2 } }))).toBe(
      '2 goals left.',
    );
  });

  it('needs one pick from every hiker there, and only them', () => {
    const s = ready();
    expect(validateAction(s, accomplish({ ash: { reward: 2 } }))).toBe(
      'Birch hasn’t picked a reward.',
    );
    expect(
      validateAction(
        s,
        accomplish({ ash: { reward: 2 }, birch: { reward: 2 }, dot: { reward: 2 } }),
      ),
    ).toBe('Only hikers at the Wonder pick rewards.');
    expect(validateAction(s, accomplish({ ash: { reward: 0 }, birch: { reward: 2 } }))).toBe(
      'Pick a node type.',
    );
  });

  it('two hikers can’t take the same Tier III item', () => {
    const s = ready();
    const [first, second] = TIER_3_ITEMS;
    expect(
      validateAction(
        s,
        accomplish({ ash: { reward: 1, itemId: first }, birch: { reward: 1, itemId: first } }),
      ),
    ).toMatch(/^Two hikers can’t take the same/);
    expect(
      validateAction(
        s,
        accomplish({ ash: { reward: 1, itemId: first }, birch: { reward: 1, itemId: second } }),
      ),
    ).toBeNull();
  });

  it('a Tier III item needs room in the bag', () => {
    const s = ready();
    hiker(s, 'ash').inventory.bag = ['a', 'b', 'c', 'd'].map((uid) => ({
      uid,
      itemId: 'bandaid',
    }));
    expect(
      validateAction(
        s,
        accomplish({ ash: { reward: 1, itemId: TIER_3_ITEMS[0] }, birch: { reward: 2 } }),
      ),
    ).toBe('Ash’s bag is full.');
  });

  it('gives each hiker their reward, and then it’s done for good', () => {
    const s = ready();
    const xp = hiker(s, 'birch').xp;
    s.abundance.forest = 3;
    const after = run(
      s,
      accomplish({
        ash: { reward: 0, node: 'forest' },
        birch: { reward: 2 },
      }),
    );
    expect(after.abundance.forest).toBe(8);
    expect(hiker(after, 'birch').xp).toBe(xp + BALANCE.wonders.lotOfXp);
    expect(after.section.tiles.M!.wonder!.claimed).toEqual({
      ash: { reward: 0, node: 'forest' },
      birch: { reward: 2 },
    });
    expect(after.log.at(-1)).toMatchObject({ kind: 'wonderAccomplished', wonderId: 'crater-lake' });
    expect(wonderProgress(after, 'M')!.accomplished).toBe(true);
    expect(validateAction(after, accomplish({ ash: { reward: 2 }, birch: { reward: 2 } }))).toBe(
      'Crater Lake is already accomplished.',
    );
  });

  it('Fort Rock’s shelters: at most 2 takers, and the durability reward waits', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'M');
    s.counters.sheltersPlaced[0] = 3;
    showing(s, 'fort-rock', [{ index: 1, x: 3 }]);
    expect(
      validateAction(
        s,
        accomplish({ ash: { reward: 0 }, birch: { reward: 0 }, cedar: { reward: 0 } }),
      ),
    ).toBe('At most 2 hikers can pick 2 shelters.');
    expect(
      validateAction(
        s,
        accomplish({ ash: { reward: 0 }, birch: { reward: 1 }, cedar: { reward: 2 } }),
      ),
    ).toMatch(/comes later/);
    const after = run(
      s,
      accomplish({ ash: { reward: 0 }, birch: { reward: 0 }, cedar: { reward: 2 } }),
    );
    // Two shelters from the Meadow's tier (Tier 1: Hammock or Tent).
    const got = hiker(after, 'ash').inventory.bag.map((i) => ITEMS[i.itemId]);
    expect(got).toHaveLength(2);
    expect(got.every((d) => d?.type === 'shelter' && d.tier === 1)).toBe(true);
  });

  it('the other rewards: caps, healing, revealing the biome, Energy, conditions turned good', () => {
    const s = fixtureGame({ challenges: true });
    place(s, 'ash', 'M');
    showing(s, 'pittock-mansion', [{ index: 1, x: 0 }]);
    const caps = s.caps;
    const rich = run(s, accomplish({ ash: { reward: 0 } }));
    expect(rich.caps).toBe(caps + BALANCE.wonders.lotOfCaps);

    const hurt = fixtureGame();
    place(hurt, 'ash', 'M');
    hiker(hurt, 'ash').injuries = 2;
    showing(hurt, 'swiss-alps', [{ index: 3, x: 1 }]);
    expect(hiker(run(hurt, accomplish({ ash: { reward: 0 } })), 'ash').injuries).toBe(0);

    const seer = fixtureGame({ challenges: true });
    place(seer, 'ash', 'M');
    showing(seer, 'multnomah-falls', [{ index: 2 }]);
    const seen = run(seer, accomplish({ ash: { reward: 0 } }));
    expect(seen.section.tiles.L!.revealedCard).toBeDefined();
    expect(seen.section.tiles.R!.revealedCard).toBeDefined();

    const giant = fixtureGame();
    place(giant, 'ash', 'M', { energy: 4 });
    showing(giant, 'sleeping-giant', [{ index: 1 }]);
    const woke = run(giant, accomplish({ ash: { reward: 0 } }));
    // 4, +1 from Energized itself (Phase 6), +5 from the reward.
    expect(hiker(woke, 'ash').stats.energy).toBe(10);
    expect(hiker(woke, 'ash').conditions.map((c) => c.id)).toContain('energized');
    const bigger = run(giant, accomplish({ ash: { reward: 2 } }));
    const ash = hiker(bigger, 'ash');
    expect(ash.maxBonus).toEqual({ energy: 2 });
    changeStat(bigger, ash, 'energy', 20, 'test');
    expect(ash.stats.energy).toBe(12);

    const witch = fixtureGame();
    place(witch, 'ash', 'M');
    addCondition(witch, hiker(witch, 'ash'), 'bleeding', 2, 'days', 'test');
    addCondition(witch, hiker(witch, 'ash'), 'wet', 2, 'days', 'test');
    showing(witch, 'witchs-castle', [{ index: 0, x: 2 }]);
    const flipped = hiker(run(witch, accomplish({ ash: { reward: 0 } })), 'ash');
    expect(flipped.conditions).toHaveLength(2);
    expect(flipped.conditions.every((c) => c.id !== 'bleeding' && c.id !== 'wet')).toBe(true);
  });
});
