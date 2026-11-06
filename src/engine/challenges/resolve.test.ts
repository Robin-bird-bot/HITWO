import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { deserialize, serialize } from '../save';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, ChallengeSection, GameState, Gift } from '../types';
import { revealTile } from './reveal';

/** Ash and Birch on L, with a challenge of our choosing open there. */
function opened(cardId: string, setup: (s: GameState) => void = () => {}): GameState {
  const s = fixtureGame({ seed: 3, challenges: true });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  setup(s);
  return run(s, { type: 'debug', op: { kind: 'openChallenge', cardId, tileId: 'L' } });
}

const resolve = (...sections: ChallengeSection[]): Action => ({
  type: 'resolveChallenge',
  sections,
});
const res = (from: string, resource: string, count = 1, req = 0): Gift => ({
  kind: 'resource',
  req,
  from,
  resource,
  count,
});
const stat = (from: string, s: 'energy' | 'appetite' | 'morale', count: number): Gift => ({
  kind: 'stat',
  req: 0,
  from,
  stat: s,
  count,
});
const xpFor = (tier: number) => BALANCE.challenges.passXpPerTier * tier;

describe('opening a challenge', () => {
  it('opens when the first hiker lands on a new tile, and blocks everything else', () => {
    let opens = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(fixtureGame({ seed, challenges: true }), {
        type: 'move',
        hikerId: 'ash',
        toTileId: 'L',
      });
      if (!s.challenge) continue;
      opens += 1;
      expect(s.challenge).toMatchObject({ tileId: 'L', hikerIds: ['ash'], tier: 1 });
      expect(s.usedCards).toContain(s.challenge.cardId);
      expect(validateAction(s, { type: 'move', hikerId: 'birch', toTileId: 'M' })).toBe(
        'Finish the challenge first.',
      );
      expect(validateAction(s, { type: 'endPhase' })).toBe('Finish the challenge first.');
    }
    // Most tiles open one; the rest drew a card the pop-up can't show until steps 3 and 4.
    expect(opens).toBeGreaterThan(10);
  });

  it('opens for the whole group on Move All, and only once per tile', () => {
    const s = fixtureGame({ seed: 2, challenges: true });
    s.section.tiles.L!.visited = true;
    const back = run(s, { type: 'moveAll', hikerId: 'ash', toTileId: 'L', bring: ['birch'] });
    expect(back.challenge).toBeUndefined();

    for (let seed = 1; seed <= 20; seed++) {
      const g = run(fixtureGame({ seed, challenges: true }), {
        type: 'moveAll',
        hikerId: 'ash',
        toTileId: 'M',
        bring: ['birch', 'cedar'],
      });
      if (g.challenge) expect(g.challenge.hikerIds).toEqual(['ash', 'birch', 'cedar']);
    }
  });

  it('never opens on the trailhead or checkpoint, or with challenges switched off', () => {
    const s = fixtureGame({ challenges: true });
    s.section.tiles.T!.visited = undefined;
    revealTile(s, 'T', ['ash']);
    expect(s.challenge).toBeUndefined();
    const off = run(fixtureGame(), { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(off.challenge).toBeUndefined();
  });

  it('survives a save and reload with the same card and numbers', () => {
    const s = opened('steep-trail');
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state.challenge).toEqual(s.challenge);
  });

  it('queues a tile landed on while a challenge is open, and opens it next', () => {
    const s = opened('flies', (g) => place(g, 'cedar', 'M'));
    revealTile(s, 'M', ['cedar']);
    expect(s.challengeQueue).toEqual([{ tileId: 'M', hikerIds: ['cedar'] }]);
    const after = run(s, resolve({ pay: false, gifts: [] }));
    expect(after.challengeQueue).toBeUndefined();
    // M opens next, unless it drew a card the pop-up can't show yet.
    if (after.challenge) expect(after.challenge.tileId).toBe('M');
  });
});

describe('a party challenge (Flies)', () => {
  const withResources = (s: GameState) => {
    hiker(s, 'ash').inventory.resources = { wood: 2 };
    hiker(s, 'birch').inventory.resources = { moss: 1, fish: 2 };
  };

  it('can be paid by anyone on the tile, and gives every hiker XP', () => {
    const s = opened('flies', withResources);
    const after = run(
      s,
      resolve({ pay: true, option: 1, gifts: [res('ash', 'wood', 2), res('birch', 'moss')] }),
    );
    expect(after.challenge).toBeUndefined();
    expect(hiker(after, 'ash').inventory.resources).toEqual({});
    expect(hiker(after, 'birch').inventory.resources).toEqual({ fish: 2 });
    expect(hiker(after, 'ash').xp).toBe(xpFor(1));
    expect(hiker(after, 'birch').xp).toBe(xpFor(1));
    expect(after.log.at(-1)).toMatchObject({
      kind: 'challenge',
      cardId: 'flies',
      party: true,
      results: [{ passed: true, paid: { resources: ['wood', 'wood', 'moss'] } }],
    });
  });

  it('can be paid with a food card', () => {
    const s = opened('flies', (g) => {
      hiker(g, 'birch').inventory.bag = [{ uid: 'f1', itemId: 'energyDrink' }];
    });
    const after = run(
      s,
      resolve({
        pay: true,
        option: 0,
        gifts: [{ kind: 'item', req: 0, from: 'birch', uid: 'f1' }],
      }),
    );
    expect(hiker(after, 'birch').inventory.bag).toEqual([]);
  });

  it('applies the penalty to every hiker on the tile when skipped', () => {
    const s = opened('flies', (g) => {
      hiker(g, 'ash').inventory.bag = [{ uid: 'f1', itemId: 'energyDrink' }];
      hiker(g, 'birch').inventory.bag = [{ uid: 'f2', itemId: 'energyDrink' }];
    });
    const after = run(s, resolve({ pay: false, gifts: [] }));
    expect(hiker(after, 'ash').inventory.bag[0]?.appetiteMod).toBe(-1);
    expect(hiker(after, 'birch').inventory.bag[0]?.appetiteMod).toBe(-1);
    expect(hiker(after, 'ash').xp).toBe(0);
  });

  it('refuses a payment that doesn’t match', () => {
    const s = opened('flies', (g) => {
      withResources(g);
      place(g, 'cedar', 'M');
      hiker(g, 'cedar').inventory.resources = { wood: 3 };
    });
    const pay = (gifts: Gift[], option = 1) =>
      validateAction(s, resolve({ pay: true, option, gifts }));
    expect(pay([res('ash', 'wood', 2), res('birch', 'fish')])).toBe(
      'Something handed in doesn’t fit that space.',
    );
    expect(pay([res('ash', 'wood', 2)])).toBe('Needs 1 more.');
    expect(pay([res('ash', 'wood', 2), res('birch', 'moss'), res('birch', 'moss')])).toBe(
      'That’s more than it asks for.',
    );
    expect(pay([res('cedar', 'wood', 3)])).toBe('Something handed in doesn’t fit that space.');
    expect(pay([res('ash', 'wood', 3)])).toBe('Ash doesn’t have 3 Wood.');
    expect(pay([], 0)).toBe('Needs 1 more.');
    expect(validateAction(s, resolve())).toBe('Every part of the challenge needs an answer.');
    expect(validateAction(s, resolve({ pay: false, gifts: [res('ash', 'wood')] }))).toBe(
      'Nothing is spent when taking the penalty.',
    );
  });
});

describe('an each-hiker challenge (Steep Trail)', () => {
  it('judges each hiker: one pays, one fails', () => {
    let strained = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = opened('steep-trail', (g) => {
        g.rng = fixtureGame({ seed }).rng;
      });
      const after = run(
        s,
        resolve(
          { hikerId: 'ash', pay: true, option: 0, gifts: [stat('ash', 'energy', 2)] },
          { hikerId: 'birch', pay: false, gifts: [] },
        ),
      );
      expect(hiker(after, 'ash').stats.energy).toBe(8);
      expect(hiker(after, 'ash').xp).toBe(xpFor(1));
      expect(hiker(after, 'ash').conditions).toEqual([]);
      expect(hiker(after, 'birch').xp).toBe(0);
      const c = hiker(after, 'birch').conditions[0];
      if (c) {
        strained += 1;
        // Strained for Birch's own Y, in days.
        expect(c).toMatchObject({ id: 'strained', unit: 'days' });
        expect(c.remaining).toBe(s.challenge?.rolls.y.birch?.days);
      }
    }
    // A 60% chance to become Strained.
    expect(strained).toBeGreaterThan(15);
    expect(strained).toBeLessThan(35);
  });

  it('lets another hiker on the tile chip in', () => {
    const s = opened('steep-trail');
    const after = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [stat('birch', 'energy', 2)] },
        { hikerId: 'birch', pay: true, option: 0, gifts: [stat('birch', 'energy', 2)] },
      ),
    );
    expect(hiker(after, 'ash').stats.energy).toBe(10);
    expect(hiker(after, 'birch').stats.energy).toBe(6);
  });

  it('checks stat points across every section, and the Morale 0 rule', () => {
    const s = opened('steep-trail', (g) => {
      hiker(g, 'birch').stats.energy = 3;
    });
    expect(
      validateAction(
        s,
        resolve(
          { hikerId: 'ash', pay: true, option: 0, gifts: [stat('birch', 'energy', 2)] },
          { hikerId: 'birch', pay: true, option: 0, gifts: [stat('birch', 'energy', 2)] },
        ),
      ),
    ).toBe('Birch doesn’t have 4 Energy.');

    const split = opened('split-path', (g) => {
      hiker(g, 'ash').stats.morale = 0;
    });
    const morale = split.challenge?.rolls.x.morale ?? 0;
    expect(
      validateAction(
        split,
        resolve({ pay: true, option: 0, gifts: [stat('ash', 'morale', morale)] }),
      ),
    ).toBe('Morale 0: Ash can’t give Morale.');
  });

  it('logs each hiker’s result, and folds paid stats into it', () => {
    const s = opened('steep-trail');
    const after = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [stat('ash', 'energy', 2)] },
        { hikerId: 'birch', pay: false, gifts: [] },
      ),
    );
    const event = after.log.find((e) => e.kind === 'challenge');
    expect(event).toMatchObject({
      party: false,
      results: [
        { hikerId: 'ash', passed: true, paid: { stats: { energy: 2 } }, xp: xpFor(1) },
        { hikerId: 'birch', passed: false },
      ],
    });
    expect(after.log.find((e) => e.kind === 'stat')).toMatchObject({ cause: 'Steep Trail: paid' });
  });
});

describe('other costs', () => {
  it('Rocky Path: a hiker over the limit sheds their own extras', () => {
    const s = opened('rocky-path', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 4, stone: 3 };
    });
    // Ash carries 7 of a 5 limit: 2 to spend. Birch carries none: passes free.
    expect(
      validateAction(
        s,
        resolve(
          { hikerId: 'ash', pay: true, option: 0, gifts: [res('birch', 'wood', 2)] },
          { hikerId: 'birch', pay: true, option: 0, gifts: [] },
        ),
      ),
    ).toBe('Something handed in doesn’t fit that space.');
    const after = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [res('ash', 'stone', 2)] },
        { hikerId: 'birch', pay: true, option: 0, gifts: [] },
      ),
    );
    expect(hiker(after, 'ash').inventory.resources).toEqual({ wood: 4, stone: 1 });
  });

  it('Ninja Turtle: 1 Shell from each hiker', () => {
    const s = opened('ninja-turtle', (g) => {
      hiker(g, 'ash').inventory.resources = { shell: 2 };
      hiker(g, 'birch').inventory.resources = { shell: 1 };
    });
    expect(
      validateAction(s, resolve({ pay: true, option: 1, gifts: [res('ash', 'shell', 2)] })),
    ).toBe('Each hiker on the tile gives one.');
    expect(
      validateAction(
        s,
        resolve({ pay: true, option: 1, gifts: [res('ash', 'shell'), res('birch', 'shell')] }),
      ),
    ).toBeNull();
  });

  it('caps come from the party purse (Annoying Squirrel)', () => {
    const s = opened('annoying-squirrel', (g) => {
      g.caps = 5;
    });
    const n = s.challenge?.rolls.x.caps ?? 0;
    const pay = (count: number) =>
      resolve({ pay: true, option: 1, gifts: [{ kind: 'caps', req: 0, count }] });
    expect(run(s, pay(n)).caps).toBe(5 - n);
    s.caps = n - 1;
    expect(validateAction(s, pay(n))).toBe('The party purse doesn’t have that many caps.');
  });
});
