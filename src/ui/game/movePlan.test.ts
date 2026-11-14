import { describe, expect, it } from 'vitest';
import { fixtureGame, fixtureHiker, hiker, place, toNight } from '../../engine/test/fixtures';
import { bringOptions, movePreview, moveTargets, nextReadyHiker } from './movePlan';

describe('move targets', () => {
  it('lists every connected tile with whether the hiker can go there', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const targets = moveTargets(s, hiker(s, 'ash'), { kind: 'move' });
    expect(targets.map((t) => t.tileId).sort()).toEqual(['C', 'M', 'T']);
    expect(targets.find((t) => t.tileId === 'C')?.reason).toBeNull();
    expect(targets.find((t) => t.tileId === 'M')?.reason).toBeNull();
  });

  it('a move onto the checkpoint previews the check-in and anyone left behind', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'L');
    hiker(s, 'dot').status = 'passedOut';
    const p = movePreview(s, hiker(s, 'ash'), { kind: 'moveAll', bring: ['birch', 'cedar'] }, 'C');
    expect(p?.checkIn).toEqual({ last: true, summit: false, leftBehind: ['Dot'] });
    const alone = movePreview(s, hiker(s, 'ash'), { kind: 'move' }, 'C');
    expect(alone?.checkIn).toEqual({ last: false, summit: false, leftBehind: [] });
  });

  it('blocks every tile once the hiker has acted', () => {
    const s = fixtureGame();
    hiker(s, 'ash').acted = true;
    const targets = moveTargets(s, hiker(s, 'ash'), { kind: 'move' });
    expect(targets.every((t) => t.reason === 'Ash has already acted this morning.')).toBe(true);
  });
});

describe('move preview', () => {
  it('shows each stat before and after, and what the move reveals', () => {
    const s = fixtureGame();
    s.section.tiles.M!.nodes = [{ type: 'forest', revealed: false }];
    const p = movePreview(s, hiker(s, 'ash'), { kind: 'move' }, 'M');
    expect(p?.rows).toEqual([
      {
        hikerId: 'ash',
        name: 'Ash',
        injury: false,
        changes: [
          { stat: 'energy', from: 10, to: 9 },
          { stat: 'appetite', from: 10, to: 9 },
        ],
      },
    ]);
    expect(p?.reveals).toBe(1);
    expect(p?.title).toBe('MOVE');
    expect(p?.reason).toBeNull();
  });

  it('names sideways moves and warns when a stat would hit 0', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M', { morale: 1 });
    const p = movePreview(s, hiker(s, 'ash'), { kind: 'move' }, 'R');
    expect(p?.title).toBe('SIDEWAYS MOVE');
    expect(p?.rows[0]?.injury).toBe(true);
  });

  it('notes the night’s extra cost', () => {
    const p = movePreview(
      toNight(fixtureGame()),
      hiker(fixtureGame(), 'ash'),
      { kind: 'move' },
      'L',
    );
    expect(p?.night).toBe(true);
  });

  it('lists each hiker’s cost for Move All', () => {
    const s = fixtureGame();
    const p = movePreview(s, hiker(s, 'ash'), { kind: 'moveAll', bring: ['birch'] }, 'M');
    expect(
      p?.rows.map((r) => [r.name, r.changes.map((c) => `${c.stat} ${c.from}→${c.to}`)]),
    ).toEqual([
      ['Ash', ['energy 10→9', 'appetite 10→8']],
      ['Birch', ['energy 10→9']],
    ]);
  });
});

describe('bringing hikers along', () => {
  it('offers everyone on the tile, saying why someone can’t come', () => {
    const s = fixtureGame();
    place(s, 'cedar', 'T', { energy: 3 });
    hiker(s, 'dot').acted = true;
    const options = bringOptions(s, hiker(s, 'ash'));
    expect(options.map((o) => [o.hiker.id, o.reason?.split('.')[0] ?? null])).toEqual([
      ['birch', null],
      ['cedar', 'Cedar can’t come along'],
      ['dot', 'Dot has already acted this morning'],
    ]);
  });
});

describe('after a hiker acts', () => {
  it('selects the next hiker who still has their action', () => {
    const s = fixtureGame({
      hikers: ['a', 'b', 'c'].map((id) => fixtureHiker(id)),
    });
    hiker(s, 'b').acted = true;
    expect(nextReadyHiker(s, 'a')?.id).toBe('c');
    hiker(s, 'c').acted = true;
    expect(nextReadyHiker(s, 'a')?.id).toBe('a');
    hiker(s, 'a').acted = true;
    expect(nextReadyHiker(s, 'a')).toBeUndefined();
  });
});
