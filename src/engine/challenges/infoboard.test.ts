/**
 * The Trail Infoboard (docs/design/25-challenges-on-the-map.md, sections 2 and 6).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { createGame } from '../newGame';
import { fixtureHiker, run } from '../test/fixtures';
import type { GameState } from '../types';
import { boardOf, tilesLeft } from './infoboard';

const IB = BALANCE.challenges.infoboard;
const game = (seed = 6, caps = 10): GameState => {
  const s = createGame({
    seed,
    hikers: ['finn', 'mom'].map((id) => fixtureHiker(id)),
    startingResources: false,
  });
  s.caps = caps;
  return s;
};

describe('the Trail Infoboard', () => {
  it('starts with [2] posters up (or a third of the pool), the rest face down', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = game(seed);
      const pool = s.section.pool ?? [];
      const board = boardOf(s);
      expect(board.faceUp).toHaveLength(
        Math.min(pool.length, Math.max(IB.startUp, Math.floor(pool.length / 3))),
      );
      for (const id of board.faceUp) expect(pool).toContain(id);
    }
  });

  it('only opens from the trailhead tile', () => {
    const s = game();
    expect(validateAction(s, { type: 'infoboardPin' })).toBeNull();
    for (const h of s.hikers)
      h.tileId = Object.keys(s.section.tiles).find((id) => id !== s.section.trailheadId)!;
    expect(validateAction(s, { type: 'infoboardPin' })).toMatch(/trailhead/);
  });

  it('PIN ONE MORE flips one face-down poster and costs [1] cap', () => {
    const s = game();
    const before = boardOf(s).faceUp;
    const after = run(s, { type: 'infoboardPin' });
    expect(after.caps).toBe(s.caps - IB.pinCaps);
    const now = boardOf(after).faceUp;
    expect(now).toHaveLength(before.length + 1);
    for (const id of before) expect(now).toContain(id);
  });

  it('WHERE IS IT? reveals the nearest unrevealed tile with that card, and costs [3]', () => {
    const s = game();
    const card = boardOf(s).faceUp.find((id) => tilesLeft(s, id).length > 0)!;
    const left = tilesLeft(s, card);
    const after = run(s, { type: 'infoboardFind', cardId: card });
    expect(after.caps).toBe(s.caps - IB.findCaps);
    const found = boardOf(after).found;
    expect(found).toHaveLength(1);
    expect(left).toContain(found[0]);
    const tile = after.section.tiles[found[0]!]!;
    expect(tile.revealedCard?.hidden).toBeUndefined();
    expect(tilesLeft(after, card)).toHaveLength(left.length - 1);
  });

  it('ALL FOUND and ALL POSTED stop the boxes', () => {
    let s = game(6, 99);
    const pool = s.section.pool ?? [];
    for (let k = 0; k < pool.length; k++) {
      if (validateAction(s, { type: 'infoboardPin' }) !== null) break;
      s = run(s, { type: 'infoboardPin' });
    }
    expect(boardOf(s).faceUp).toHaveLength(pool.length);
    expect(validateAction(s, { type: 'infoboardPin' })).toMatch(/Every poster/);
    const card = pool.find((id) => tilesLeft(s, id).length > 0)!;
    for (let k = tilesLeft(s, card).length; k > 0; k--)
      s = run(s, { type: 'infoboardFind', cardId: card });
    expect(validateAction(s, { type: 'infoboardFind', cardId: card })).toMatch(/All found/);
  });

  it('not enough caps changes nothing', () => {
    const s = game(6, 0);
    expect(validateAction(s, { type: 'infoboardPin' })).toMatch(/caps/);
    const up = boardOf(s).faceUp.find((id) => tilesLeft(s, id).length > 0)!;
    expect(validateAction(s, { type: 'infoboardFind', cardId: up })).toMatch(/caps/);
  });

  it('is saved per biome: a new section starts with a fresh board', () => {
    const s = run(game(), { type: 'infoboardPin' });
    const pinned = boardOf(s).faceUp.length;
    expect(s.section.infoboard?.faceUp).toHaveLength(pinned);
    // The next biome's section carries no board of its own: it starts fresh.
    const next: GameState = {
      ...s,
      sectionIndex: s.sectionIndex + 1,
      section: { ...s.section, infoboard: undefined },
    };
    const pool = next.section.pool ?? [];
    expect(boardOf(next).faceUp).toHaveLength(
      Math.min(pool.length, Math.max(IB.startUp, Math.floor(pool.length / 3))),
    );
    expect(boardOf(next).found).toEqual([]);
  });
});
