/**
 * Walked paths and found places (Phase 10.5, section 11 and 10): who crossed
 * each line first, and the illustrated map's "Found …" log lines.
 */
import { describe, expect, it } from 'vitest';
import { validateAction } from '../applyAction';
import { lineBetween } from '../map';
import { deserialize, serialize } from '../save';
import { END, fixtureGame, place, run } from '../test/fixtures';

const walker = (s: ReturnType<typeof fixtureGame>, a: string, b: string) =>
  lineBetween(s.section, a, b)?.walkedBy;

describe('walked paths', () => {
  it('a line takes the first hiker who crosses it, either way, and keeps them', () => {
    let s = fixtureGame();
    expect(s.section.lines.every((l) => l.walkedBy === undefined)).toBe(true);
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(walker(s, 'T', 'L')).toBe('ash');
    // Birch crosses the same line: it stays Ash's.
    s = run(s, { type: 'move', hikerId: 'birch', toTileId: 'L' });
    expect(walker(s, 'T', 'L')).toBe('ash');
    // Back the other way, next phase: still Ash's.
    s = run(s, END, { type: 'move', hikerId: 'birch', toTileId: 'T' });
    expect(walker(s, 'T', 'L')).toBe('ash');
    expect(walker(s, 'T', 'M')).toBeUndefined();
  });

  it('a Move All paints the line in the mover’s color', () => {
    const s = run(fixtureGame(), {
      type: 'moveAll',
      hikerId: 'cedar',
      toTileId: 'R',
      bring: ['ash', 'birch'],
    });
    expect(walker(s, 'T', 'R')).toBe('cedar');
  });

  it('is saved, and an older save loads with nothing walked', () => {
    const s = run(fixtureGame(), { type: 'move', hikerId: 'ash', toTileId: 'L' });
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && walker(loaded.state, 'T', 'L')).toBe('ash');

    const old = JSON.parse(serialize(fixtureGame()));
    old.saveVersion = 18;
    const back = deserialize(JSON.stringify(old));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.state.section.lines.every((l) => !l.walkedBy)).toBe(true);
  });
});

describe('found places', () => {
  it('"Found …" goes in the trail log once per name', () => {
    let s = run(fixtureGame(), { type: 'foundPlace', name: 'Tumalo Pond' });
    expect(s.foundPlaces).toEqual(['Tumalo Pond']);
    expect(s.log.at(-1)).toMatchObject({ kind: 'found', name: 'Tumalo Pond' });
    expect(validateAction(s, { type: 'foundPlace', name: 'Tumalo Pond' })).toBe(
      'Tumalo Pond was already found.',
    );
    s = run(s, { type: 'foundPlace', name: 'Ochoco Lookout' });
    expect(s.log.filter((e) => e.kind === 'found')).toHaveLength(2);
  });

  it('is only a look: it never waits on a challenge or a pick, and changes nothing else', () => {
    const s = fixtureGame({ challenges: true });
    place(s, 'ash', 'T');
    const opened = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    const blocked = opened.challenge
      ? validateAction(opened, { type: 'foundPlace', name: 'Santiam Creek' })
      : null;
    expect(blocked).toBeNull();
    const after = run(opened, { type: 'foundPlace', name: 'Santiam Creek' });
    expect(after.hikers).toEqual(opened.hikers);
    expect(after.challenge).toEqual(opened.challenge);
  });
});
