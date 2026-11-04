import { describe, expect, it } from 'vitest';
import { createGame } from '../../engine';
import { STARTING_PARTY } from '../../content/characters';
import { LINE_LOOK, tileLook } from './looks';

describe('tile looks', () => {
  const game = createGame({ seed: 5, hikers: STARTING_PARTY });
  const { section } = game;
  const head = section.tiles[section.trailheadId]!;

  it('marks the selected hiker’s tile as current, and the trailhead as visited', () => {
    expect(tileLook(section, head, head.id)).toBe('current');
    expect(tileLook(section, head, null)).toBe('visited');
  });

  it('reveals tiles next to a visited tile, and leaves far tiles in fog', () => {
    const next = section.lines.find((l) => l.a === head.id || l.b === head.id)!;
    const nextId = next.a === head.id ? next.b : next.a;
    expect(tileLook(section, section.tiles[nextId]!, null)).toBe('revealed');
    const far = Object.values(section.tiles).find(
      (t) => t.row === 4 && t.nodes.every((n) => !n.revealed),
    );
    if (far) expect(tileLook(section, far, null)).toBe('fog');
  });
});

describe('line cost badges', () => {
  it('count down, since stats count down, and paved lines say FREE', () => {
    expect(LINE_LOOK.paved.badge?.text).toBe('FREE');
    for (const kind of ['steep', 'muddy', 'rough'] as const) {
      expect(LINE_LOOK[kind].badge?.text).toBe('-1');
      expect(LINE_LOOK[kind].tooltip).toMatch(/−1 extra (Energy|Appetite|Morale) to cross/);
    }
    expect(LINE_LOOK.steep.badge?.icon).toBe('zap');
    expect(LINE_LOOK.muddy.badge?.icon).toBe('utensils');
    expect(LINE_LOOK.rough.badge?.icon).toBe('heart');
  });
});
