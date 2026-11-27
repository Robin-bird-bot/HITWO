/**
 * Minigame challenges played from tiles (docs/design/25-challenges-on-the-map.md,
 * sections 3 and 6).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { deserialize, serialize } from '../save';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, GameState } from '../types';
import {
  minigameSettings,
  openMinigameCard,
  type MinigameOutcome,
  type PrepSpend,
} from './minigame';

/** Ash and Birch on L (they came from T), with a minigame challenge open there. */
function opened(cardId: string, tier?: number): GameState {
  const s = fixtureGame({ seed: 3, challenges: true });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  hiker(s, 'ash').cameFrom = 'T';
  hiker(s, 'birch').cameFrom = 'T';
  hiker(s, 'ash').inventory.resources = { fish: 2, wood: 1 };
  hiker(s, 'birch').inventory.resources = { salt: 1 };
  return run(s, {
    type: 'debug',
    op: { kind: 'openChallenge', cardId, tileId: 'L', ...(tier ? { tier } : {}) },
  });
}

const finish = (outcome: MinigameOutcome, spent: PrepSpend[] = []): Action => ({
  type: 'resolveMinigameChallenge',
  outcome,
  spent,
});

describe('a minigame challenge on a tile', () => {
  it('opens as a minigame, with its game’s settings at the tile’s tier', () => {
    const s = opened('eagle-attack', 2);
    const card = openMinigameCard(s.challenge)!;
    expect(card.minigame?.game).toBe('dodge');
    expect(s.challenge?.shownTier).toBe(2);
    expect(minigameSettings(card, s.challenge!)).toMatchObject({ animal: 'eagle', tier: 2 });
  });

  it('Prepare spends exactly the fills, from the right hikers (all or nothing)', () => {
    const s = opened('bee-attack');
    const spent: PrepSpend[] = [
      { hiker: 'ash', kind: 'resource', id: 'fish', count: 1 },
      { hiker: 'birch', kind: 'resource', id: 'salt', count: 1 },
    ];
    // Birch hasn't got any Fish.
    expect(
      validateAction(
        s,
        finish({ passed: ['ash', 'birch'] }, [
          { hiker: 'birch', kind: 'resource', id: 'fish', count: 1 },
        ]),
      ),
    ).toMatch(/doesn’t have/);
    const after = run(s, finish({ passed: ['ash', 'birch'] }, spent));
    expect(hiker(after, 'ash').inventory.resources).toEqual({ fish: 1, wood: 1 });
    expect(hiker(after, 'birch').inventory.resources).toEqual({});
    expect(after.challenge).toBeUndefined();
  });

  it('passers get XP; failers take the punishment', () => {
    const s = opened('bee-attack');
    const x = s.challenge!.rolls.x.x!;
    const ashXp = hiker(s, 'ash').xp ?? 0;
    const birchEnergy = hiker(s, 'birch').stats.energy;
    const after = run(s, finish({ passed: ['ash'] }));
    expect((hiker(after, 'ash').xp ?? 0) - ashXp).toBe(BALANCE.challenges.passXpPerTier * 1);
    expect(hiker(after, 'birch').stats.energy).toBe(Math.max(0, birchEnergy - x));
    // The game's default fail cost is replaced: Ash pays nothing.
    expect(hiker(after, 'ash').stats.energy).toBe(hiker(s, 'ash').stats.energy);
  });

  it('failed hikers on a passing challenge go back first', () => {
    const s = opened('stay-on-the-trail');
    const after = run(s, finish({ passed: ['ash'] }));
    expect(hiker(after, 'ash').tileId).toBe('L');
    expect(hiker(after, 'birch').tileId).toBe('T');
    // Somebody passed: the tile is clear.
    expect(after.section.tiles.L?.revealedCard).toBeUndefined();
  });

  it('nobody passing leaves the challenge face up on the tile', () => {
    const s = opened('stay-on-the-trail');
    const after = run(s, finish({ passed: [] }));
    expect(hiker(after, 'ash').tileId).toBe('T');
    expect(hiker(after, 'birch').tileId).toBe('T');
    const card = after.section.tiles.L?.revealedCard;
    expect(card?.cardId).toBe('stay-on-the-trail');
    expect(card?.hidden).toBeUndefined();
  });

  it('a game that keeps its own costs: Rock Climb’s falls are paid as well', () => {
    const s = opened('rock-climb', 2);
    const before = hiker(s, 'ash').stats.energy;
    const after = run(s, finish({ passed: ['ash'], pays: { ash: { energy: 2 } } }));
    expect(hiker(after, 'ash').stats.energy).toBe(before - 2);
  });

  it('the hiker the game hurt takes the card’s hurt instead (Sketchy Bridge’s breaker)', () => {
    const s = opened('sketchy-bridge');
    const after = run(
      s,
      finish({ passed: [], pays: { ash: { conditions: ['injury'] }, birch: { energy: 1 } } }),
    );
    // At Tier I the breaker bleeds; the one behind loses 1 Energy.
    expect(hiker(after, 'ash').conditions.some((c) => c.id === 'bleeding')).toBe(true);
    expect(hiker(after, 'birch').conditions.some((c) => c.id === 'bleeding')).toBe(false);
    expect(hiker(after, 'birch').stats.energy).toBe(hiker(s, 'birch').stats.energy - 1);
  });

  it('SKIP IT passes everyone without playing', () => {
    const s = opened('gun-bear-attack', 3);
    const after = run(s, finish({ passed: [], skipped: true }));
    expect(hiker(after, 'ash').injuries).toBe(0);
    expect(hiker(after, 'birch').injuries).toBe(0);
    expect(after.log.at(-1)).toBeDefined();
  });

  it('a reload with the pop-up up opens it again: the challenge stays open in the save', () => {
    const s = opened('bee-attack');
    const loaded = deserialize(serialize(s));
    if (!loaded.ok) throw new Error(loaded.reason);
    expect(loaded.state.challenge).toEqual(s.challenge);
    expect(openMinigameCard(loaded.state.challenge)?.id).toBe('bee-attack');
  });
});
