import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { NIGHT_CREATURES, NIGHT_OUTCOMES, type NightOutcome } from '../../content/nightEvents';
import { fullDurability } from '../items/make';
import { validateAction } from '../applyAction';
import { addCondition, hasCondition } from '../conditions';
import { deserialize, serialize } from '../save';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { GameEvent, GameState, HikerId } from '../types';
import { canApply, fillLine, hitChance, pickTier, safeFrom, tierOdds } from './nightEvents';

type NightEvent = Extract<GameEvent, { kind: 'nightEvent' }>;

const lastNight = (s: GameState) => s.log.findLast((e): e is NightEvent => e.kind === 'nightEvent');

const outcome = (tier: 1 | 2 | 3, id: string): NightOutcome => {
  const o = NIGHT_OUTCOMES[tier].find((x) => x.id === id);
  if (!o) throw new Error(`No outcome ${id}`);
  return o;
};

/** Night, with everyone spread out and empty-handed unless a test sets them up. */
function night(seed = 1, opts: { challenges?: boolean } = {}) {
  const s = toNight(fixtureGame({ seed, nightEvents: true, ...opts }));
  s.caps = 0;
  for (const h of s.hikers) {
    h.inventory.resources = {};
    h.inventory.bag = [];
    h.xp = 0;
  }
  return s;
}

/** Forces tonight's event and runs it now. */
const runNight = (s: GameState, force: { tier?: 1 | 2 | 3; creatureId?: string; hit?: HikerId }) =>
  run(
    s,
    { type: 'debug', op: { kind: 'forceNight', ...force } },
    { type: 'debug', op: { kind: 'runNight' } },
  );

/** Tries seeds until the night event hits `hikerId` with `outcomeId`. */
function findHit(
  setup: (seed: number) => GameState,
  force: { tier?: 1 | 2 | 3; creatureId?: string; hit: HikerId },
  outcomeId: string,
  ok: (s: GameState, e: NightEvent) => boolean = () => true,
) {
  for (let seed = 1; seed < 400; seed++) {
    const s = runNight(setup(seed), force);
    const e = lastNight(s);
    const hit = e?.hits.find((h) => h.hikerId === force.hit);
    if (e && hit?.outcomeId === outcomeId && ok(s, e)) return { s, e, hit };
  }
  throw new Error(`No seed gave ${outcomeId}`);
}

describe('the tier', () => {
  it('follows the biome odds over many nights', () => {
    for (const sectionIndex of [0, 1, 2]) {
      const s = fixtureGame({ seed: 7 + sectionIndex });
      s.sectionIndex = sectionIndex;
      const counts = { 1: 0, 2: 0, 3: 0 };
      const n = 6000;
      for (let i = 0; i < n; i++) counts[pickTier(s)] += 1;
      const odds = tierOdds(sectionIndex);
      expect(counts[1] / n).toBeCloseTo(odds[0], 1);
      expect(counts[2] / n).toBeCloseTo(odds[1], 1);
      expect(counts[3] / n).toBeCloseTo(odds[2], 1);
    }
  });

  it('uses the last biome’s odds past the third', () => {
    expect(tierOdds(5)).toEqual(tierOdds(2));
    expect(tierOdds(0)).toEqual([0.7, 0.25, 0.05]);
  });

  it('picks one creature from that tier', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = runNight(night(seed), { tier: 2, hit: 'ash' });
      const e = lastNight(s);
      expect(NIGHT_CREATURES.find((c) => c.id === e?.creatureId)?.tier).toBe(2);
    }
  });
});

describe('each hiker’s chance', () => {
  it('is 30%, ×1.5 alone and ×0.75 for each other hiker', () => {
    const s = night();
    place(s, 'ash', 'L');
    place(s, 'birch', 'M');
    place(s, 'cedar', 'M');
    place(s, 'dot', 'T');
    expect(hitChance(s, hiker(s, 'ash'))).toBeCloseTo(0.45);
    expect(hitChance(s, hiker(s, 'birch'))).toBeCloseTo(0.225);
    place(s, 'dot', 'M');
    expect(hitChance(s, hiker(s, 'birch'))).toBeCloseTo(0.16875);
    place(s, 'ash', 'M');
    expect(hitChance(s, hiker(s, 'birch'))).toBeCloseTo(0.1265625);
  });

  it('goes up 10 points at Morale 5 or less, 20 at 2 or less', () => {
    const s = night();
    place(s, 'ash', 'L', { morale: 5 });
    expect(hitChance(s, hiker(s, 'ash'))).toBeCloseTo(0.55);
    place(s, 'ash', 'L', { morale: 2 });
    expect(hitChance(s, hiker(s, 'ash'))).toBeCloseTo(0.65);
    place(s, 'ash', 'M', { morale: 4 });
    place(s, 'birch', 'M');
    expect(hitChance(s, hiker(s, 'ash'))).toBeCloseTo(0.325);
  });
});

describe('Keep Watch', () => {
  it('is a night action that uses the hiker’s action', () => {
    const day = fixtureGame();
    expect(validateAction(day, { type: 'keepWatch', hikerId: 'ash' })).toBe(
      'Hikers keep watch at night.',
    );
    const s = run(toNight(fixtureGame()), { type: 'keepWatch', hikerId: 'ash' });
    expect(hiker(s, 'ash').acted).toBe(true);
    expect(hiker(s, 'ash').watching).toBe(true);
    expect(s.log.at(-1)).toMatchObject({ kind: 'watch', hikerId: 'ash' });
  });

  it('needs only one watcher on a tile', () => {
    const s = run(toNight(fixtureGame()), { type: 'keepWatch', hikerId: 'ash' });
    expect(validateAction(s, { type: 'keepWatch', hikerId: 'birch' })).toBe(
      'Ash is already keeping watch on this tile.',
    );
  });

  it('isn’t for Fatigued hikers, who can only sleep', () => {
    const s = toNight(fixtureGame());
    place(s, 'ash', 'T', { energy: BALANCE.thresholds.fatigued });
    expect(validateAction(s, { type: 'keepWatch', hikerId: 'ash' })).toMatch(/^Fatigued/);
  });

  it('ends in the morning, and the watcher pays for the night without sleep', () => {
    const s = run(toNight(fixtureGame()), { type: 'keepWatch', hikerId: 'ash' }, END);
    expect(hiker(s, 'ash').watching).toBeUndefined();
    expect(
      s.log.some((e) => e.kind === 'stat' && e.cause === 'No sleep' && e.hikerId === 'ash'),
    ).toBe(true);
  });
});

describe('who is safe', () => {
  it('everyone on a watched tile, and anyone in a shelter', () => {
    let s = night();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    place(s, 'cedar', 'R'); // the campsite
    place(s, 'dot', 'M');
    s = run(s, { type: 'keepWatch', hikerId: 'birch' });
    expect(safeFrom(s, hiker(s, 'ash'))).toEqual({ why: 'watch', by: 'birch' });
    expect(safeFrom(s, hiker(s, 'birch'))).toEqual({ why: 'watch', by: 'birch' });
    expect(safeFrom(s, hiker(s, 'cedar'))).toEqual({ why: 'shelter' });
    expect(safeFrom(s, hiker(s, 'dot'))).toBeUndefined();

    // Even a forced hit can't reach a hiker who's safe.
    s = runNight(s, { tier: 1, hit: 'ash' });
    const e = lastNight(s);
    expect(e?.hits).toEqual([]);
    expect(e?.safe).toEqual(
      expect.arrayContaining([
        { hikerId: 'ash', why: 'watch', by: 'birch' },
        { hikerId: 'cedar', why: 'shelter' },
      ]),
    );
  });

  it('a forced hit lands on an exposed hiker', () => {
    const s = night();
    place(s, 'ash', 'L');
    const e = lastNight(runNight(s, { tier: 1, hit: 'ash' }));
    expect(e?.hits.map((h) => h.hikerId)).toContain('ash');
  });
});

describe('picking an outcome', () => {
  it('skips outcomes that can’t apply', () => {
    const s = night();
    place(s, 'ash', 'L');
    const ash = hiker(s, 'ash');
    const fits = NIGHT_OUTCOMES[1].filter((o) => canApply(s, ash, o)).map((o) => o.id);
    // No caps, resources, items, clothes, food or XP: only Morale and a condition are left.
    expect(fits).toEqual(['loseMorale', 'condition']);

    s.caps = 2;
    ash.inventory.resources = { wood: 2 };
    ash.xp = 3;
    ash.inventory.bag = [{ uid: 'f1', itemId: 'energyDrink' }];
    hiker(s, 'birch').inventory.bag = [{ uid: 't1', itemId: 'bandaid' }];
    expect(NIGHT_OUTCOMES[1].filter((o) => canApply(s, ash, o)).map((o) => o.id)).toEqual([
      'swapResources',
      'stealCaps',
      'stealResources',
      'loseMorale',
      'foodOne',
      'swapItemFar',
      'loseXp',
      'condition',
    ]);
  });

  it('only picks from the tier’s outcomes, for every hit over many nights', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = runNight(night(seed), { tier: 3, hit: 'ash' });
      for (const hit of lastNight(s)?.hits ?? []) {
        expect(NIGHT_OUTCOMES[3].map((o) => o.id)).toContain(hit.outcomeId);
      }
    }
  });

  it('Tier 2’s injury: only alone, with 4 or less Energy or Appetite', () => {
    const s = night();
    const injury = outcome(2, 'injury');
    place(s, 'ash', 'L', { energy: 4, appetite: 9 });
    expect(canApply(s, hiker(s, 'ash'), injury)).toBe(true);
    place(s, 'ash', 'L', { energy: 5, appetite: 5 });
    expect(canApply(s, hiker(s, 'ash'), injury)).toBe(false);
    place(s, 'ash', 'T', { appetite: 3 });
    expect(canApply(s, hiker(s, 'ash'), injury)).toBe(false); // not alone
  });

  it('Tier 3’s injuries: 2 or fewer hikers on the tile', () => {
    const s = night();
    const weak = outcome(3, 'injuryWeak');
    const scared = outcome(3, 'injuryScared');
    place(s, 'ash', 'L', { energy: 6, morale: 5 });
    place(s, 'birch', 'L');
    expect(canApply(s, hiker(s, 'ash'), weak)).toBe(true);
    expect(canApply(s, hiker(s, 'ash'), scared)).toBe(true);
    place(s, 'cedar', 'L');
    expect(canApply(s, hiker(s, 'ash'), weak)).toBe(false);
    expect(canApply(s, hiker(s, 'ash'), scared)).toBe(false);
    place(s, 'cedar', 'T');
    place(s, 'ash', 'L', { energy: 7, appetite: 7, morale: 6 });
    expect(canApply(s, hiker(s, 'ash'), weak)).toBe(false);
    expect(canApply(s, hiker(s, 'ash'), scared)).toBe(false);
  });

  it('chased back: needs a connected tile behind, and a hiker who can move', () => {
    const s = night();
    const chased = outcome(2, 'chased');
    place(s, 'ash', 'T'); // the trailhead: nothing behind
    expect(canApply(s, hiker(s, 'ash'), chased)).toBe(false);
    place(s, 'ash', 'M');
    expect(canApply(s, hiker(s, 'ash'), chased)).toBe(true);
    addCondition(s, hiker(s, 'ash'), 'frozen', 1, 'phases', 'test');
    expect(canApply(s, hiker(s, 'ash'), chased)).toBe(false);
  });
});

describe('the lines', () => {
  it('fill in the creature, hiker, number and plural', () => {
    expect(
      fillLine('{Creature} stole {X} cap{s} from {hiker}.', {
        Creature: 'The raccoons',
        X: '1',
        s: '',
        hiker: 'Cody',
      }),
    ).toBe('The raccoons stole 1 cap from Cody.');
    expect(fillLine('{unknown} stays', {})).toBe('{unknown} stays');
  });

  it('use a creature’s own line, with the number that was actually taken', () => {
    const { hit, s } = findHit(
      (seed) => {
        const s = night(seed);
        place(s, 'ash', 'L');
        hiker(s, 'ash').inventory.resources = { wood: 2, moss: 1 };
        return s;
      },
      { creatureId: 'bears', hit: 'ash' },
      'stealAll',
    );
    expect(hit.text).toBe('A bear tore into Ash’s pack and ate every resource.');
    expect(hit.chip).toBe('−3 resources');
    expect(hiker(s, 'ash').inventory.resources).toEqual({});
  });

  it('say what really happened: caps the purse didn’t have aren’t stolen', () => {
    const { hit, s } = findHit(
      (seed) => {
        const s = night(seed);
        s.caps = 1;
        place(s, 'ash', 'L');
        return s;
      },
      { creatureId: 'raccoons', hit: 'ash' },
      'stealCaps',
    );
    expect(hit.text).toBe('The raccoons stole 1 cap from Ash.');
    expect(hit.chip).toBe('−1 cap');
    expect(s.caps).toBe(0);
  });

  it('name the condition the hiker really got (Wet on Wet is Soaked)', () => {
    const { hit } = findHit(
      (seed) => {
        const s = night(seed);
        place(s, 'ash', 'L');
        addCondition(s, hiker(s, 'ash'), 'wet', 1, 'days', 'test');
        return s;
      },
      { creatureId: 'drunk-hiker', hit: 'ash' },
      'condition',
      (s) => hasCondition(hiker(s, 'ash'), 'soaked'),
    );
    // Not the drunk hiker's Wet line: it's the generic one, with Soaked.
    expect(hit.text).toBe('A drunk hiker bothered Ash all night. They’re Soaked.');
    expect(hit.chip).toMatch(/^Soaked · \d+ (phase|day)s?$/);
  });

  it('use a creature’s line for one condition', () => {
    const { hit } = findHit(
      (seed) => {
        const s = night(seed);
        place(s, 'ash', 'L');
        return s;
      },
      { creatureId: 'drunk-hiker', hit: 'ash' },
      'condition',
      (s) => hasCondition(hiker(s, 'ash'), 'wet'),
    );
    expect(hit.text).toBe('A drunk hiker spilled their drink on Ash. They’re Wet.');
    expect(hit.chip).toBe('Wet · 1 day');
  });

  it('name the other hiker in an item swap', () => {
    const { hit, s } = findHit(
      (seed) => {
        const s = night(seed);
        place(s, 'ash', 'L');
        hiker(s, 'ash').inventory.bag = [{ uid: 'f1', itemId: 'energyDrink' }];
        hiker(s, 'birch').inventory.bag = [{ uid: 't1', itemId: 'bandaid' }];
        return s;
      },
      { creatureId: 'raccoons', hit: 'ash' },
      'swapItemFar',
    );
    expect(hit.text).toBe('The raccoons swapped Ash’s Energy Drink for Birch’s Bandaid.');
    expect(hiker(s, 'ash').inventory.bag.map((i) => i.itemId)).toEqual(['bandaid']);
    expect(hiker(s, 'birch').inventory.bag.map((i) => i.itemId)).toEqual(['energyDrink']);
  });
});

describe('the new effects', () => {
  it('swapping resources keeps how many the hiker carries', () => {
    const { s, hit } = findHit(
      (seed) => {
        const s = night(seed);
        place(s, 'ash', 'L');
        hiker(s, 'ash').inventory.resources = { wood: 4, moss: 1 };
        return s;
      },
      { creatureId: 'opossums', hit: 'ash' },
      'swapResources',
    );
    const carried = Object.values(hiker(s, 'ash').inventory.resources).reduce<number>(
      (a, n) => a + (n ?? 0),
      0,
    );
    expect(carried).toBe(5);
    expect(hit.chip).toMatch(/^\d resources? swapped$/);
  });

  it('wear on clothes takes durability off the item', () => {
    const { s, hit } = findHit(
      (seed) => {
        const s = run(night(seed), { type: 'debug', op: { kind: 'wearClothes', hikerId: 'ash' } });
        place(s, 'ash', 'L');
        return s;
      },
      { creatureId: 'bats', hit: 'ash' },
      'wearOne',
    );
    const worn = Object.values(hiker(s, 'ash').inventory.equipped)[0];
    const def = ITEMS[worn?.itemId ?? ''];
    expect(worn?.durability).toBe(fullDurability(def!, 3) - 1);
    expect(hit.chip).toBe('−1 durability');
  });

  it('stealing items takes them from the bag', () => {
    const { s, hit } = findHit(
      (seed) => {
        const s = night(seed);
        place(s, 'ash', 'L');
        hiker(s, 'ash').inventory.bag = [
          { uid: 'a', itemId: 'bandaid' },
          { uid: 'b', itemId: 'energyDrink' },
          { uid: 'c', itemId: 'bandaid' },
        ];
        return s;
      },
      { creatureId: 'cultists', hit: 'ash' },
      'stealItems',
    );
    const n = Number(/^−(\d)/.exec(hit.chip)?.[1]);
    expect(hiker(s, 'ash').inventory.bag).toHaveLength(3 - n);
  });
});

describe('chased back', () => {
  it('moves the hiker behind, and a tile nobody reached opens its challenge in the morning', () => {
    const setup = (seed: number) => {
      const s = night(seed, { challenges: true });
      // Make the trailhead an ordinary tile nobody has reached.
      const t = s.section.tiles.T!;
      t.kind = 'normal';
      delete t.visited;
      t.nodes = [{ type: 'forest', revealed: false }];
      for (const h of s.hikers) place(s, h.id, 'L');
      place(s, 'ash', 'M', { energy: 9, appetite: 9 });
      return s;
    };
    const { s } = findHit(setup, { creatureId: 'wolves', hit: 'ash' }, 'chased');
    expect(hiker(s, 'ash').tileId).toBe('T');
    expect(s.log.some((e) => e.kind === 'moved' && e.how === 'chased')).toBe(true);
    expect(s.challenge).toBeUndefined();
    expect(s.challengeQueue).toEqual([{ tileId: 'T', hikerIds: ['ash'] }]);

    const morning = run(s, END);
    expect(morning.phase).toBe('morning');
    expect(morning.challenge?.tileId).toBe('T');
    expect(morning.challengeQueue).toBeUndefined();
  });
});

describe('the camp step', () => {
  it('runs the night event first, before the night’s drains', () => {
    const s = toNight(fixtureGame({ nightEvents: true }));
    s.debugNight = { tier: 1, hit: 'ash' };
    const after = run(s, END);
    const nightAt = after.log.findIndex((e) => e.kind === 'nightEvent');
    const drainAt = after.log.findIndex((e) => e.kind === 'stat' && e.cause === 'End of day');
    expect(nightAt).toBeGreaterThan(-1);
    expect(nightAt).toBeLessThan(drainAt);
    expect(after.debugNight).toBeUndefined();
  });

  it('gives the same night for the same seed and actions', () => {
    const a = run(toNight(fixtureGame({ seed: 9, nightEvents: true })), END);
    const b = run(toNight(fixtureGame({ seed: 9, nightEvents: true })), END);
    expect(lastNight(a)).toEqual(lastNight(b));
  });

  it('survives a save and load', () => {
    const s = run(night(3), { type: 'keepWatch', hikerId: 'ash' });
    const after = runNight(s, { tier: 2, hit: 'birch' });
    const back = deserialize(serialize(after));
    expect(back).toEqual({ ok: true, state: after });
  });
});

describe('stat chips', () => {
  it('show what was really lost, not the roll', () => {
    const { hit, s } = findHit(
      (seed) => {
        const s = night(seed);
        place(s, 'ash', 'L', { appetite: 1 });
        return s;
      },
      { creatureId: 'hyenas', hit: 'ash' },
      'loseAppetite',
    );
    // Appetite hit 0: an injury, which lifts it again.
    expect(hiker(s, 'ash').injuries).toBe(1);
    expect(hit.chip).toBe('−1 Appetite, +1 injury');
  });
});

describe('conditions from the night event', () => {
  it('last through the next day: the camp step that gave them doesn’t count them down', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = toNight(fixtureGame({ seed, nightEvents: true }));
      place(s, 'ash', 'L');
      s.debugNight = { creatureId: 'drunk-hiker', hit: 'ash' };
      s.caps = 0;
      for (const h of s.hikers) {
        h.inventory.resources = {};
        h.inventory.bag = [];
        h.xp = 0;
      }
      const morning = run(s, END);
      const hit = lastNight(morning)?.hits.find((h) => h.hikerId === 'ash');
      if (hit?.outcomeId !== 'condition') continue;
      const id = morning.log.findLast((e) => e.kind === 'condition' && e.hikerId === 'ash');
      if (id?.kind !== 'condition' || id.unit !== 'days') continue;
      expect(hasCondition(hiker(morning, 'ash'), id.condition)).toBe(true);
      const nextMorning = run(morning, END, END, END);
      expect(hasCondition(hiker(nextMorning, 'ash'), id.condition)).toBe(false);
      return;
    }
    throw new Error('No seed gave a day-long condition');
  });
});
