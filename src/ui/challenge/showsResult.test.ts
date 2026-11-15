import { describe, expect, it } from 'vitest';
import { CARDS } from '../../content';
import type { GameEvent, GameState } from '../../engine';
import { fixtureGame, hiker, place, run } from '../../engine/test/fixtures';
import { isRandom, nothingHappenedLine, showsResult } from './showsResult';

type ChallengeEvent = Extract<GameEvent, { kind: 'challenge' }>;

/** Ash and Birch on L with a card open there, then the party doesn't pay. */
function failed(cardId: string, setup: (s: GameState) => void = () => {}, seed = 3) {
  let s = fixtureGame({ seed, challenges: true });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  setup(s);
  s = run(s, { type: 'debug', op: { kind: 'openChallenge', cardId, tileId: 'L' } });
  s = run(s, { type: 'resolveChallenge', sections: [{ pay: false, gifts: [] }] });
  const event = s.log.findLast((e): e is ChallengeEvent => e.kind === 'challenge');
  if (!event) throw new Error('no challenge line');
  return { s, event, result: { cardId, fromId: event.id } };
}

const carry = (s: GameState, id: string, fish: number) => {
  hiker(s, id).inventory.resources = { fish };
};

describe('a failed challenge left to chance shows what happened', () => {
  it('Freeagle: the result window opens, listing what was stolen', () => {
    let times = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { s, event, result } = failed('freeagle', (g) => carry(g, 'ash', 4), seed);
      expect(showsResult(s, event, false)).toBe(true);
      const stolen = s.log.some((e) => e.id > event.id && e.kind === 'lost');
      if (stolen) times++;
      // Four Fish at 50% each: either some went (listed) or none did (said so).
      expect(nothingHappenedLine(s, result, true)).toBe(stolen ? null : 'Nothing was lost.');
    }
    expect(times).toBeGreaterThan(0);
  });

  it('says nothing was lost when the party carried nothing it could lose', () => {
    const { s, event, result } = failed('freeagle', (g) => {
      carry(g, 'ash', 0);
      carry(g, 'birch', 0);
    });
    expect(showsResult(s, event, false)).toBe(true);
    expect(nothingHappenedLine(s, result, true)).toBe('Nothing was lost.');
  });

  it('a penalty with nothing left to chance still skips the window', () => {
    const fixed = Object.values(CARDS).find(
      (c) =>
        c.kind === 'challenge' &&
        c.scope === 'party' &&
        !c.risk &&
        c.penalty.length > 0 &&
        !c.penalty.some(isRandom),
    );
    expect(fixed).toBeDefined();
    if (!fixed) return;
    const { s, event, result } = failed(fixed.id);
    expect(showsResult(s, event, false)).toBe(false);
    expect(nothingHappenedLine(s, result, true)).toBeNull();
  });
});
