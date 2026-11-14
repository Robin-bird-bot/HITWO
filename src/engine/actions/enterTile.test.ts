import { describe, expect, it } from 'vitest';
import { validateAction } from '../applyAction';
import { fixtureGame, hiker, place, run } from '../test/fixtures';

const hide = (s: ReturnType<typeof fixtureGame>, tileId: string) => {
  const tile = s.section.tiles[tileId]!;
  tile.nodes = [
    { type: 'forest', revealed: false },
    { type: 'river', revealed: true },
    { type: 'forest', revealed: false },
  ];
};

describe('entering a tile', () => {
  it('marks it visited and reveals its hidden nodes', () => {
    const s0 = fixtureGame();
    hide(s0, 'L');
    const s = run(s0, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    const tile = s.section.tiles.L!;
    expect(tile.visited).toBe(true);
    expect(tile.nodes.every((n) => n.revealed)).toBe(true);
    expect(s.log.find((e) => e.kind === 'move')).toMatchObject({ revealed: ['forest', 'forest'] });
  });

  it('works the same for Move All', () => {
    const s0 = fixtureGame();
    hide(s0, 'L');
    const s = run(s0, { type: 'moveAll', hikerId: 'ash', toTileId: 'L', bring: ['birch'] });
    expect(s.section.tiles.L?.visited).toBe(true);
    expect(s.section.tiles.L?.nodes.every((n) => n.revealed)).toBe(true);
  });

  it('records nothing new on a tile already explored', () => {
    const s = run(fixtureGame(), { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(s.log.find((e) => e.kind === 'move')).not.toHaveProperty('revealed');
  });

  it('can be the checkpoint (checking in, Phase 9)', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    expect(validateAction(s, { type: 'move', hikerId: 'ash', toTileId: 'C' })).toBeNull();
    expect(
      validateAction(s, { type: 'moveAll', hikerId: 'ash', toTileId: 'C', bring: ['birch'] }),
    ).toBeNull();
  });
});

describe('the set-stats debug tool', () => {
  it('sets stats directly, without the injury rule', () => {
    const s = run(fixtureGame(), {
      type: 'debug',
      op: { kind: 'setStats', hikerId: 'ash', stats: { energy: 0, appetite: 3 } },
    });
    expect(hiker(s, 'ash').stats).toEqual({ energy: 0, appetite: 3, morale: 10 });
    expect(hiker(s, 'ash').injuries).toBe(0);
  });

  it('passes a hiker out at 3 injuries, and wakes them below that', () => {
    let s = run(fixtureGame(), {
      type: 'debug',
      op: { kind: 'setStats', hikerId: 'ash', stats: {}, injuries: 3 },
    });
    expect(hiker(s, 'ash').status).toBe('passedOut');
    s = run(s, { type: 'debug', op: { kind: 'setStats', hikerId: 'ash', stats: {}, injuries: 1 } });
    expect(hiker(s, 'ash').status).toBe('active');
  });
});
