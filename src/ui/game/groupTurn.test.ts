import { describe, expect, it } from 'vitest';
import { applyAction, type GameState } from '../../engine';
import { fixtureGame, hiker, place } from '../../engine/test/fixtures';
import { groupActionStates } from '../panels/hikerInfo';
import {
  groupMoveTargets,
  orderNumbers,
  skipWords,
  startGroup,
  stepGroup,
  toggleInGroup,
  type GroupRun,
} from './groupTurn';

/** Runs a group to the end (or until it waits or asks someone to pick), returning who acted, in order. */
function runAll(s: GameState, run: GroupRun) {
  const acted: string[] = [];
  let state = s;
  let r: GroupRun | null = run;
  for (let i = 0; r && i < 20; i++) {
    const step = stepGroup(state, r);
    if (step.kind !== 'act') return { state, acted, step };
    acted.push(
      step.action.type === 'move'
        ? step.action.hikerId
        : (step.action as { hikerId: string }).hikerId,
    );
    state = applyAction(state, step.action);
    r = step.run;
  }
  return { state, acted, step: null };
}

describe('multi-select: one action, each hiker in turn (Nov 14 update)', () => {
  it('follows the turn order they were picked in', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    const { run, skipped } = startGroup(s, ['cedar', 'ash', 'birch'], 'tend');
    expect(skipped).toEqual([]);
    const { acted, state } = runAll(s, run);
    expect(acted).toEqual(['cedar', 'ash', 'birch']);
    expect(['ash', 'birch', 'cedar'].every((id) => hiker(state, id).acted)).toBe(true);
  });

  it('moves each hiker separately, and the first to arrive faces the tile’s challenge alone', () => {
    let checked = false;
    for (let seed = 1; seed <= 40 && !checked; seed++) {
      let s = fixtureGame({ seed, challenges: true });
      place(s, 'ash', 'L');
      place(s, 'birch', 'L');
      const { run } = startGroup(s, ['ash', 'birch'], 'move', 'M');
      const first = stepGroup(s, run);
      if (first.kind !== 'act') continue;
      s = applyAction(s, first.action);
      if (!s.challenge) continue;
      // Ash arrived first and faces it alone; Birch waits.
      expect(hiker(s, 'ash').tileId).toBe('M');
      expect(s.challenge.hikerIds).toEqual(['ash']);
      expect(hiker(s, 'birch').tileId).toBe('L');
      expect(stepGroup(s, first.run).kind).toBe('wait');
      // Once it's over (test only: cleared by hand), Birch follows; the card doesn't open again.
      delete s.challenge;
      const second = stepGroup(s, first.run);
      expect(second.kind === 'act' && second.action).toEqual({
        type: 'move',
        hikerId: 'birch',
        toTileId: 'M',
      });
      if (second.kind !== 'act') return;
      s = applyAction(s, second.action);
      expect(hiker(s, 'birch').tileId).toBe('M');
      expect(s.challenge).toBeUndefined();
      expect(stepGroup(s, second.run).kind).toBe('done');
      checked = true;
    }
    expect(checked).toBe(true);
  });

  it('hikers who can’t reach the tile go last, each to pick their own', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    place(s, 'birch', 'R'); // R isn't connected to L
    const { run, skipped } = startGroup(s, ['birch', 'ash'], 'move', 'L');
    expect(run.pending).toEqual(['ash']);
    expect(run.later).toEqual(['birch']);
    expect(skipped).toEqual([]);
    const { step } = runAll(s, run);
    expect(step?.kind).toBe('own');
    expect(step?.kind === 'own' && step.run.own).toBe('birch');
  });

  it('skips a hiker who can’t take the action, saying why', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    hiker(s, 'birch').acted = true;
    const { run, skipped } = startGroup(s, ['ash', 'birch', 'cedar'], 'tend');
    expect(skipped).toEqual([
      { hikerId: 'birch', reason: 'Birch has already acted this morning.' },
    ]);
    const { acted } = runAll(s, run);
    expect(acted).toEqual(['ash', 'cedar']);
  });

  it('says who was skipped and why, in plain words', () => {
    const nameOf = (id: string) => ({ ash: 'Ash', birch: 'Birch' })[id] ?? id;
    expect(skipWords([], nameOf)).toBe('');
    expect(
      skipWords(
        [
          { hikerId: 'birch', reason: 'Birch has already acted this morning.' },
          { hikerId: 'ash', reason: 'The way is blocked.' },
        ],
        nameOf,
      ),
    ).toBe('Skipped. Birch has already acted this morning. Ash: The way is blocked.');
  });

  it('a hiker who can no longer go when their turn comes is skipped then', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch']) place(s, id, 'L');
    const { run } = startGroup(s, ['ash', 'birch'], 'tend');
    hiker(s, 'birch').acted = true;
    const { acted, step } = runAll(s, run);
    expect(acted).toEqual(['ash']);
    expect(step).toEqual({
      kind: 'done',
      skipped: [{ hikerId: 'birch', reason: 'Birch has already acted this morning.' }],
    });
  });
});

describe('picking the group', () => {
  it('adds to the end from the hiker already selected, removes on a second pick', () => {
    expect(toggleInGroup([], 'ash', 'cedar')).toEqual(['ash', 'cedar']);
    expect(toggleInGroup(['ash', 'cedar'], 'ash', 'birch')).toEqual(['ash', 'cedar', 'birch']);
    expect(toggleInGroup(['ash', 'cedar', 'birch'], 'ash', 'cedar')).toEqual(['ash', 'birch']);
    // A group of one is no group.
    expect(toggleInGroup(['ash', 'birch'], 'ash', 'birch')).toEqual([]);
    expect(toggleInGroup([], 'ash', 'ash')).toEqual([]);
  });

  it('numbers the badges in turn order', () => {
    expect(orderNumbers(['cedar', 'ash'])).toEqual({ cedar: 1, ash: 2 });
  });
});

describe('the group’s action buttons and tiles', () => {
  it('a shared action can be pressed when only some of the group can take it', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    hiker(s, 'ash').acted = true;
    // Ash is selected and has acted, but Birch and Cedar can still tend.
    const own = groupActionStates(s, hiker(s, 'ash'));
    expect(own.find((a) => a.id === 'tend')?.status).not.toBe('ready');
    const shared = groupActionStates(s, hiker(s, 'ash'), ['ash', 'birch', 'cedar']);
    expect(shared.find((a) => a.id === 'tend')).toMatchObject({
      status: 'ready',
      sub: '2 of 3 hikers',
    });
    // Move All and Craft stay the selected hiker's own.
    expect(shared.find((a) => a.id === 'craft')).toEqual(own.find((a) => a.id === 'craft'));
  });

  it('a group can be sent to any tile one of them can reach', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M');
    place(s, 'birch', 'R');
    const ok = (ids: string[]) =>
      groupMoveTargets(s, ids)
        .filter((t) => t.reason === null)
        .map((t) => t.tileId)
        .sort();
    const ashOnly = ok(['ash']);
    const both = ok(['ash', 'birch']);
    expect(both).toEqual([...new Set([...ashOnly, ...ok(['birch'])])].sort());
    expect(both.length).toBeGreaterThanOrEqual(ashOnly.length);
  });
});
