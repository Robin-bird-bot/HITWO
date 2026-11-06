import { describe, expect, it } from 'vitest';
import { blockedByStatus } from './status';
import { END, fixtureGame, hiker, place, run, toNight } from './test/fixtures';

describe('blocked by status (Nov 5, 2b)', () => {
  it('counts threshold states', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L', { appetite: 2 });
    expect(blockedByStatus(s, { type: 'move', hikerId: 'ash', toTileId: 'M' })).toMatch(
      /^Famished/,
    );
    expect(blockedByStatus(s, { type: 'scavenge', hikerId: 'ash' })).toMatch(/^Famished/);
    place(s, 'birch', 'L', { energy: 3 });
    expect(blockedByStatus(s, { type: 'tend', hikerId: 'birch', node: 'forest' })).toMatch(
      /^Exhausted/,
    );
  });

  it('counts Morale at 0 on a line that costs Morale', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M', { morale: 0 });
    expect(blockedByStatus(s, { type: 'move', hikerId: 'ash', toTileId: 'R' })).toMatch(
      /^Morale 0/,
    );
  });

  it('counts a brought hiker’s status', () => {
    const s = fixtureGame();
    place(s, 'birch', 'T', { energy: 2 });
    expect(
      blockedByStatus(s, { type: 'moveAll', hikerId: 'ash', toTileId: 'L', bring: ['birch'] }),
    ).toMatch(/Birch can’t come along/);
  });

  it('counts being passed out', () => {
    const s = fixtureGame();
    hiker(s, 'ash').status = 'passedOut';
    expect(blockedByStatus(s, { type: 'move', hikerId: 'ash', toTileId: 'L' })).toMatch(
      /passed out/,
    );
  });

  it('ignores normal limits', () => {
    const s = fixtureGame();
    expect(blockedByStatus(s, { type: 'sleep', hikerId: 'ash' })).toBeUndefined(); // daytime
    expect(blockedByStatus(s, { type: 'scavenge', hikerId: 'ash' })).toBeUndefined(); // no nodes
    const moved = run(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(blockedByStatus(moved, { type: 'move', hikerId: 'ash', toTileId: 'M' })).toBeUndefined(); // acted
    // Tend at night is normal even for a Fatigued hiker.
    place(s, 'ash', 'L', { energy: 5 });
    const night = toNight(s);
    expect(
      blockedByStatus(night, { type: 'tend', hikerId: 'ash', node: 'forest' }),
    ).toBeUndefined();
    expect(blockedByStatus(night, { type: 'move', hikerId: 'ash', toTileId: 'M' })).toMatch(
      /^Fatigued/,
    );
    expect(blockedByStatus(run(night, END), { type: 'sleep', hikerId: 'ash' })).toBeUndefined();
  });

  it('allows what is allowed', () => {
    expect(
      blockedByStatus(fixtureGame(), { type: 'move', hikerId: 'ash', toTileId: 'L' }),
    ).toBeUndefined();
  });
});
