import { describe, expect, it } from 'vitest';
import { STARTING_PARTY } from '../../content/characters';
import { applyAction, createGame, type Action, type GameState } from '../../engine';
import { fixtureGame, place, run, toNight } from '../../engine/test/fixtures';
import { describeLog, signed } from './describeLog';

const texts = (s: GameState) => describeLog(s, 50).map((l) => l.text);

describe('trail log sentences', () => {
  it('count stats down with a real minus sign', () => {
    expect(signed(-1, 'appetite')).toBe('−1 Appetite');
    expect(signed(2, 'energy')).toBe('+2 Energy');
  });

  it('say what a scavenge found, with its cost', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const open = run(s, { type: 'scavenge', hikerId: 'ash' });
    if (!open.scavenge) throw new Error('no deal');
    open.scavenge.cards[0] = {
      type: 'x2',
      rarity: 'uncommon',
      node: 'forest',
      resources: ['wood', 'wood'],
      flipped: true,
    };
    const after = run(open, { type: 'scavengeTake', card: 0 });
    expect(texts(after)).toEqual(['Ash scavenged Wood ×2 (−1 Appetite).']);
  });

  it('describe tending, giving and returning', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    s.abundance.forest = 3;
    s.hikers[0]!.inventory.resources = { wood: 2 };
    const after = run(
      s,
      { type: 'tend', hikerId: 'ash', node: 'forest' },
      { type: 'give', fromId: 'ash', toId: 'birch', resource: 'wood' },
      { type: 'returnToNature', hikerId: 'ash', resource: 'wood' },
    );
    expect(texts(after)).toEqual([
      'Ash tended the Forest (Forest Abundance 3 → 5, −1 Energy).',
      'Ash gave Wood to Birch.',
      'Ash returned Wood to nature (+1 Forest).',
    ]);
  });

  it('fold a move and its costs into one line', () => {
    const s = run(fixtureGame(), { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(texts(s)).toEqual(['Ash moved to Trail tile (−1 Appetite, −1 Energy).']);
  });

  it('describe leading the group', () => {
    const s = run(fixtureGame(), {
      type: 'moveAll',
      hikerId: 'ash',
      toTileId: 'L',
      bring: ['birch', 'cedar'],
    });
    expect(texts(s)).toEqual(['Ash led Birch and Cedar to Trail tile (−3 Appetite).']);
  });

  it('give each hiker one line for the night’s drains, then the new day', () => {
    let s = fixtureGame();
    for (const a of [
      { type: 'endPhase' },
      { type: 'endPhase' },
      { type: 'sleep', hikerId: 'ash' },
      { type: 'endPhase' },
    ] as Action[]) {
      s = applyAction(s, a);
    }
    const lines = texts(s);
    expect(lines).toContain('Ash slept.');
    expect(lines).toContain('Birch: −2 Energy (no sleep), −1 Appetite (end of day).');
    expect(lines).toContain('Ash: −1 Appetite (end of day).');
    expect(lines.at(-1)).toBe('Day 2 · Morning');
  });

  it('explain injuries', () => {
    // Ash goes without sleep at Energy 1: −2 takes Energy to 0.
    const s0 = fixtureGame();
    place(s0, 'ash', 'L', { energy: 1 });
    const s = run(toNight(s0), { type: 'endPhase' });
    expect(texts(s)).toContain(
      'Ash took an injury (energy hit 0): 1 of 3. Stats below 5 rise to 5.',
    );
  });

  it('describe abilities with their effect', () => {
    const game = createGame({ seed: 1, hikers: STARTING_PARTY });
    const s = applyAction(game, {
      type: 'useAbility',
      hikerId: 'hiker-2',
      abilityId: 'stoic',
      choice: 'energy',
    });
    expect(texts(s)).toEqual(['Hiker 2 used Stoic (−2 Morale).']);
  });

  it('keep only the most recent lines', () => {
    let s = fixtureGame();
    for (let i = 0; i < 9; i++) s = applyAction(s, { type: 'endPhase' });
    expect(describeLog(s, 3)).toHaveLength(3);
  });
});
