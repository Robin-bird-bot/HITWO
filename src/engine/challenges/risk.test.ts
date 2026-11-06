import { describe, expect, it } from 'vitest';
import { CARDS } from '../../content/challenges';
import { validateAction } from '../applyAction';
import { addCondition } from '../conditions';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, ChallengeSection, GameState, Gift } from '../types';
import { riskReading } from './risk';
import type { ChallengeDef } from './types';

function opened(cardId: string, setup: (s: GameState) => void = () => {}, tileId = 'L') {
  const s = fixtureGame({ seed: 5, challenges: true });
  place(s, 'ash', tileId);
  place(s, 'birch', tileId);
  setup(s);
  return run(s, { type: 'debug', op: { kind: 'openChallenge', cardId, tileId } });
}
const card = (id: string) => CARDS[id] as ChallengeDef;
const spend = (from: string, resource: string, count = 1): Gift => ({
  kind: 'resource',
  req: 0,
  from,
  resource,
  count,
});
const resolve = (...sections: ChallengeSection[]): Action => ({
  type: 'resolveChallenge',
  sections,
});
const both = (ash: Gift[] = [], birch: Gift[] = []) =>
  resolve({ hikerId: 'ash', pay: true, gifts: ash }, { hikerId: 'birch', pay: true, gifts: birch });

describe('Risk challenges', () => {
  it('Thin Ice: a chance per resource carried, lowered by spending some', () => {
    const s = opened('thin-ice', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 4, stone: 2 };
    });
    const pct = s.challenge?.rolls.x.pct ?? 0;
    const ash = hiker(s, 'ash');
    expect(riskReading(card('thin-ice'), s.challenge!.rolls, ash, [])?.value).toBe(6 * pct);
    expect(
      riskReading(card('thin-ice'), s.challenge!.rolls, ash, [spend('ash', 'wood', 4)])?.value,
    ).toBe(2 * pct);
    // Birch carries nothing: never falls in.
    let soaked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = { ...s, rng: fixtureGame({ seed }).rng };
      const after = run(g, both());
      if (hiker(after, 'ash').conditions.some((c) => c.id === 'soaked')) soaked += 1;
      expect(hiker(after, 'birch').conditions).toEqual([]);
    }
    expect(soaked / 200).toBeGreaterThan((6 * pct) / 100 - 0.1);
    expect(soaked / 200).toBeLessThan((6 * pct) / 100 + 0.1);
  });

  it('Thin Ice: a hiker already Wet also becomes Frozen', () => {
    const s = opened('thin-ice', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 10 };
      addCondition(g, hiker(g, 'ash'), 'wet', 2, 'days', 'test');
    });
    for (let seed = 1; seed <= 30; seed++) {
      const after = run({ ...s, rng: fixtureGame({ seed }).rng }, both());
      const ids = hiker(after, 'ash').conditions.map((c) => c.id);
      if (ids.includes('soaked')) expect(ids).toContain('frozen');
    }
  });

  it('Dangerous Current: carrying X or more sweeps the hiker away, injured', () => {
    const s = opened('dangerous-current', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 10, stone: 2 };
      hiker(g, 'birch').inventory.resources = { wood: 1 };
    });
    const at = s.challenge?.rolls.x.at ?? 0;
    const after = run(s, both());
    expect(hiker(after, 'ash').injuries).toBe(1);
    expect(hiker(after, 'ash').tileId).not.toBe('L');
    expect(hiker(after, 'birch').tileId).toBe('L');
    // Spending down below the line keeps them safe.
    const safe = run(s, both([spend('ash', 'wood', 12 - at + 1)]));
    expect(hiker(safe, 'ash').injuries).toBe(0);
    expect(hiker(safe, 'ash').tileId).toBe('L');
  });

  it('Storm: lose X Energy, minus 2 per resource and 5 per item spent', () => {
    const s = opened('storm', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 2 };
      hiker(g, 'ash').inventory.bag = [{ uid: 'i1', itemId: 'phone' }];
    });
    const loss = s.challenge?.rolls.x.loss ?? 0;
    const after = run(
      s,
      both([spend('ash', 'wood', 1), { kind: 'item', req: 0, from: 'ash', uid: 'i1' }]),
    );
    expect(hiker(after, 'ash').stats.energy).toBe(10 - Math.max(0, loss - 7));
    expect(hiker(after, 'birch').stats.energy).toBe(10 - loss);
    expect(hiker(after, 'ash').inventory.bag).toEqual([]);
  });

  it('Insane Wind: blown back step by step, unless enough is spent', () => {
    const s = opened(
      'insane-wind',
      (g) => {
        hiker(g, 'ash').inventory.resources = { stone: 7 };
      },
      'M',
    );
    const blown = run(s, both());
    // The first step is 100%: Birch is blown back to the trailhead.
    expect(hiker(blown, 'birch').tileId).toBe('T');
    // 7 Stone take 105 points off every chance: Ash stays.
    const held = run(s, both([spend('ash', 'stone', 7)]));
    expect(hiker(held, 'ash').tileId).toBe('M');
  });

  it('never moves a Frozen hiker', () => {
    const s = opened(
      'insane-wind',
      (g) => addCondition(g, hiker(g, 'birch'), 'frozen', 2, 'phases', 'test'),
      'M',
    );
    expect(hiker(run(s, both()), 'birch').tileId).toBe('M');
  });

  it('only lets each hiker spend their own things, of the kinds the card allows', () => {
    const s = opened(
      'insane-wind',
      (g) => {
        hiker(g, 'ash').inventory.resources = { stone: 2, fish: 1 };
      },
      'M',
    );
    expect(validateAction(s, both([], [spend('ash', 'stone')]))).toBe(
      'Each hiker can only spend what they carry.',
    );
    expect(validateAction(s, both([spend('ash', 'fish')]))).toBe('That can’t be spent on this.');
    expect(validateAction(s, both([spend('ash', 'stone', 3)]))).toBe('Ash doesn’t have 3 Stone.');
  });

  it('logs each hiker’s odds and whether it hit, with no XP', () => {
    const s = opened('dangerous-current', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 12 };
    });
    const after = run(s, both());
    expect(after.log.find((e) => e.kind === 'challenge')).toMatchObject({
      results: [
        { hikerId: 'ash', passed: false, risk: { kind: 'threshold', value: 100, hit: true } },
        { hikerId: 'birch', passed: true, risk: { kind: 'threshold', value: 0, hit: false } },
      ],
    });
    expect(hiker(after, 'ash').xp + hiker(after, 'birch').xp).toBe(0);
  });

  it('opens the next tile when someone is swept onto one nobody has landed on', () => {
    let chained = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = opened('dangerous-current', (g) => {
        g.rng = fixtureGame({ seed }).rng;
        hiker(g, 'ash').inventory.resources = { wood: 12 };
        g.section.tiles.L!.visited = true;
      });
      const after = run(s, both());
      const to = hiker(after, 'ash').tileId;
      if (to === 'M' && after.challenge) {
        chained += 1;
        expect(after.challenge).toMatchObject({ tileId: 'M', hikerIds: ['ash'] });
      }
    }
    expect(chained).toBeGreaterThan(0);
  });
});

describe('opportunities', () => {
  it('Trail Angel: free, and the caps go to the purse', () => {
    const s = opened('trail-angel');
    const after = run(s, resolve({ pay: true, gifts: [] }));
    expect(after.caps).toBe(2);
    expect(after.log.some((e) => e.kind === 'gained' && e.caps === 2)).toBe(true);
    expect(hiker(after, 'ash').xp).toBe(0);
  });

  it('Friendly Fisher: give 3 River resources for a tool, or skip for nothing', () => {
    const s = opened('friendly-fisher', (g) => {
      hiker(g, 'ash').inventory.resources = { fish: 2, clay: 1 };
    });
    const deal = run(
      s,
      resolve({ pay: true, option: 0, gifts: [spend('ash', 'fish', 2), spend('ash', 'clay')] }),
    );
    const items = [...hiker(deal, 'ash').inventory.bag, ...hiker(deal, 'birch').inventory.bag];
    expect(items).toHaveLength(1);
    const skipped = run(s, resolve({ pay: false, gifts: [] }));
    expect(hiker(skipped, 'ash').inventory.resources).toEqual({ fish: 2, clay: 1 });
  });
});

describe('special spaces', () => {
  const space = (kind: 'choice' | 'challenge' | 'opportunity', seed = 2) => {
    const s = fixtureGame({ seed, challenges: true });
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    return run(s, { type: 'debug', op: { kind: 'openSpace', tileId: 'L', space: kind } });
  };

  it('Choice: two challenges, each with its own numbers, and the party picks one', () => {
    const s = space('choice');
    const open = s.challenge;
    const other = open?.alternative;
    if (!open || !other) throw new Error('no choice');
    expect(other.cardId).not.toBe(open.cardId);
    expect(s.usedCards).toEqual(expect.arrayContaining([open.cardId, other.cardId]));
    expect(validateAction(s, resolve({ pay: false, gifts: [] }))).toBe(
      'Pick one of the two challenges first.',
    );
    const picked = run(s, { type: 'chooseChallenge', cardId: other.cardId });
    expect(picked.challenge).toMatchObject({ cardId: other.cardId, rolls: other.rolls });
    expect(picked.challenge?.alternative).toBeUndefined();
    expect(picked.log.at(-1)).toMatchObject({ kind: 'challengeChosen', over: open.cardId });
  });

  it('Challenge space: a challenge from the next tier’s list', () => {
    let opened = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const open = space('challenge', seed).challenge;
      if (!open) continue;
      opened += 1;
      expect(open).toMatchObject({ tier: 2, special: 'challenge' });
      expect(card(open.cardId)).toMatchObject({ kind: 'challenge', tier: 2 });
    }
    expect(opened).toBeGreaterThan(10);
  });

  it('Challenge space: passing hikers each get an item, Lucky, or double XP', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = fixtureGame({ seed, challenges: true });
      place(s, 'ash', 'L');
      place(s, 'birch', 'L');
      const open = run(s, {
        type: 'debug',
        op: { kind: 'openChallenge', cardId: 'steep-trail', tileId: 'L' },
      });
      open.challenge = { ...open.challenge!, special: 'challenge', tier: 2 };
      const energy = (id: string): Gift => ({
        kind: 'stat',
        req: 0,
        from: id,
        stat: 'energy',
        count: 2,
      });
      const after = run(
        open,
        resolve(
          { hikerId: 'ash', pay: true, option: 0, gifts: [energy('ash')] },
          { hikerId: 'birch', pay: false, gifts: [] },
        ),
      );
      const result = after.log.find((e) => e.kind === 'challenge');
      const ash = result?.kind === 'challenge' ? result.results[0] : undefined;
      expect(ash?.reward).toBeDefined();
      if (ash?.reward) seen.add(ash.reward);
      const r = result?.kind === 'challenge' ? result.results[1] : undefined;
      expect(r?.reward).toBeUndefined();
      const xp = hiker(after, 'ash').xp;
      if (ash?.reward === 'doubleXp') expect(xp).toBe(8);
      else expect(xp).toBe(4);
      if (ash?.reward === 'lucky') {
        expect(hiker(after, 'ash').conditions.map((c) => c.id)).toContain('lucky');
      }
      if (ash?.reward === 'item') expect(hiker(after, 'ash').inventory.bag).toHaveLength(1);
    }
    expect([...seen].sort()).toEqual(['doubleXp', 'item', 'lucky']);
  });

  it('Opportunity space: always an opportunity', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const id = space('opportunity', seed).challenge?.cardId;
      if (id) expect(card(id).kind).toBe('opportunity');
    }
  });
});
