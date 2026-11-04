import { describe, expect, it } from 'vitest';
import { STARTING_PARTY } from '../../content/characters';
import { validateAction } from '../applyAction';
import { createGame } from '../newGame';
import { run } from '../test/fixtures';

const game = () => createGame({ seed: 11, hikers: STARTING_PARTY });

describe('debug actions', () => {
  it('skip to a phase without draining anyone', () => {
    const s = run(game(), { type: 'debug', op: { kind: 'skipToPhase', phase: 'night' } });
    expect([s.day, s.phase]).toEqual([1, 'night']);
    for (const h of s.hikers) expect(h.stats).toEqual({ energy: 10, appetite: 10, morale: 10 });
    expect(s.log.at(-1)).toMatchObject({ kind: 'debug', note: 'Skipped to night' });
  });

  it('reveal every node on the map', () => {
    const s = run(game(), { type: 'debug', op: { kind: 'revealMap' } });
    const nodes = Object.values(s.section.tiles).flatMap((t) => t.nodes);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((n) => n.revealed)).toBe(true);
  });

  it('are always allowed', () => {
    expect(validateAction(game(), { type: 'debug', op: { kind: 'revealMap' } })).toBeNull();
  });
});

describe('a new game', () => {
  it('starts the party on a visited trailhead', () => {
    const s = game();
    expect(s.section.tiles[s.section.trailheadId]?.visited).toBe(true);
    expect(s.hikers.map((h) => h.name)).toEqual(['Hiker 1', 'Hiker 2', 'Hiker 3', 'Hiker 4']);
    expect(s.hikers.map((h) => h.family)).toEqual(['human', 'human', 'dog', 'cat']);
    expect(s.hikers.every((h) => h.placeholder)).toBe(true);
  });
});
