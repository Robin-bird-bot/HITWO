import { describe, expect, it } from 'vitest';
import { CARDS } from '../../content/challenges';
import { validateAction } from '../applyAction';
import { deserialize, serialize } from '../save';
import { END, fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, GameState } from '../types';
import { deadlineOf, noteScavenged, phaseIndex, timeLeft } from './trials';
import type { TrialDef } from './types';

const ACCEPT: Action = { type: 'acceptTrial' };
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });

/** Ash and Birch on L, with a Trial of our choosing revealed there and accepted. */
function started(cardId: string, setup: (s: GameState) => void = () => {}): GameState {
  const s = fixtureGame({ seed: 4 });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  setup(s);
  const open = run(s, { type: 'debug', op: { kind: 'openChallenge', cardId, tileId: 'L' } });
  expect(open.challenge?.cardId).toBe(cardId);
  return run(open, ACCEPT);
}

describe('starting a Trial', () => {
  it('blocks the game until "Got it", then counts down', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const open = run(s, {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'train', tileId: 'L' },
    });
    expect(validateAction(open, END)).toBe('Finish the challenge first.');
    const after = run(open, ACCEPT);
    expect(after.challenge).toBeUndefined();
    expect(after.trials).toMatchObject([{ cardId: 'train', tileId: 'L', hikers: ['ash'] }]);
    expect(after.log.at(-1)).toMatchObject({ kind: 'trial', outcome: 'started' });
    expect(timeLeft(after, after.trials![0]!)).toBe('1 MORE PHASE');
  });

  it('works out deadlines: phases from the next one, days, and "by night"', () => {
    const s = fixtureGame(); // Day 1 Morning = phase 0
    const open = { rolls: { x: { n: 2 }, y: {}, includes: {}, luck: 0 } };
    expect(deadlineOf(s, { phases: 2 }, open)).toBe(2);
    expect(deadlineOf(s, { phases: 'n' }, open)).toBe(2);
    expect(deadlineOf(s, { days: 4 }, open)).toBe(12);
    expect(deadlineOf(s, { until: 'endOfNextPhase' }, open)).toBe(1);
    expect(deadlineOf(s, { until: 'night' }, open)).toBe(2);
    expect(deadlineOf(s, { until: 'nextMorning' }, open)).toBe(2);
  });

  it('survives a save and reload', () => {
    const s = started('rising-fog');
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state.trials).toEqual(s.trials);
  });
});

describe('Train!! (leave the tile by the end of the next phase)', () => {
  it('ends early once everyone has left', () => {
    const s = run(started('train'), END, move('ash', 'T'), move('birch', 'T'), END);
    expect(s.trials).toBeUndefined();
    expect(s.log.some((e) => e.kind === 'trial' && e.outcome === 'passed')).toBe(true);
    expect(hiker(s, 'ash').injuries).toBe(0);
  });

  it('injures whoever is still there at the deadline', () => {
    const s = run(started('train'), END, move('ash', 'T'), END);
    expect(s.trials).toBeUndefined();
    expect(hiker(s, 'ash').injuries).toBe(0);
    expect(hiker(s, 'birch').injuries).toBe(1);
    expect(s.log.find((e) => e.kind === 'trial' && e.outcome === 'failed')).toMatchObject({
      hikerIds: ['birch'],
    });
  });
});

describe('Rising Fog (the whole party together within X phases)', () => {
  it('passes when every hiker is on one tile at the end of a phase', () => {
    const s = run(started('rising-fog'), move('cedar', 'L'), move('dot', 'L'), END);
    expect(s.trials).toBeUndefined();
    expect(s.hikers.every((h) => h.conditions.length === 0)).toBe(true);
  });

  it('blinds every hiker if the party never gathers', () => {
    let s = started('rising-fog');
    const ends = s.trials![0]!.endsAt;
    while (phaseIndex(s) <= ends) s = run(s, END);
    expect(s.trials).toBeUndefined();
    expect(s.hikers.every((h) => h.conditions.some((c) => c.id === 'blind'))).toBe(true);
  });
});

describe('Rocco Raccoon’s Running Trial', () => {
  it('marks a red tile, and stacks rewards by how quickly each hiker reaches it', () => {
    const s = started('rocco-raccoons-running-trial');
    const trial = s.trials![0]!;
    expect(['M', 'R']).toContain(trial.targetTile);
    const caps = s.caps;
    // Ash gets there the same day: an item, Refreshed, 3 resources and the caps.
    const after = run(s, END, move('ash', 'T'), END, move('ash', trial.targetTile!));
    const ash = hiker(after, 'ash');
    expect(ash.inventory.bag).toHaveLength(1);
    expect(ash.conditions.map((c) => c.id)).toContain('refreshed');
    expect(Object.values(ash.inventory.resources).reduce<number>((a, b) => a + (b ?? 0), 0)).toBe(
      3,
    );
    expect(after.caps).toBeGreaterThan(caps);
    expect(after.log.find((e) => e.kind === 'trial' && e.outcome === 'reached')).toMatchObject({
      hikerIds: ['ash'],
      days: 1,
    });
    // Birch never makes it: a random negative condition after 4 days.
    let s2 = after;
    while (s2.trials?.length) s2 = run(s2, END);
    expect(hiker(s2, 'birch').conditions.length).toBeGreaterThan(0);
    // Ash made it, so no penalty (Refreshed has long run out).
    expect(hiker(s2, 'ash').conditions).toEqual([]);
  });

  it('gives nothing on day 4', () => {
    let s = started('rocco-raccoons-running-trial');
    const target = s.trials![0]!.targetTile!;
    for (let i = 0; i < 10; i++) s = run(s, END); // Day 4, Afternoon
    place(s, 'ash', 'T', { energy: 10, appetite: 10, morale: 10 });
    const bag = hiker(s, 'ash').inventory.bag.length;
    s = run(s, move('ash', target));
    expect(hiker(s, 'ash').inventory.bag.length).toBe(bag);
    expect(s.log.find((e) => e.kind === 'trial' && e.outcome === 'reached')).toMatchObject({
      days: 4,
    });
  });
});

describe('Trials judged by what hikers do', () => {
  it('Jogger: whoever acts in the next phase becomes Buzzed', () => {
    const s = run(started('jogger'), END, move('ash', 'T'), END);
    expect(s.trials).toBeUndefined();
    expect(hiker(s, 'ash').conditions.map((c) => c.id)).toContain('buzzed');
    expect(hiker(s, 'birch').conditions).toEqual([]);
  });

  it('The Grim Sleeper!: sleeping on or next to the tile tonight', () => {
    let s = started('the-grim-sleeper');
    s = run(s, END, END); // night
    s = run(s, { type: 'sleep', hikerId: 'ash' });
    expect(hiker(s, 'ash').injuries).toBe(1);
    expect(hiker(s, 'ash').conditions.map((c) => c.id)).toContain('nightmares');
  });

  it('Ranger’s Request: takes what was gathered since it started and pays X caps each', () => {
    let s = started('rangers-request');
    const trial = s.trials![0]!;
    const id = trial.resource!;
    const ash = hiker(s, 'ash');
    ash.inventory.resources = { [id]: 3 };
    noteScavenged(s, ash, [id, id]);
    while (s.trials?.length) s = run(s, END);
    const pay = trial.rolls.x.pay ?? 0;
    expect(hiker(s, 'ash').inventory.resources[id] ?? 0).toBe(1);
    expect(s.caps).toBe(2 * pay);
    expect(s.log.find((e) => e.kind === 'trial' && e.outcome === 'paid')).toMatchObject({
      taken: 2,
      caps: 2 * pay,
    });
  });
});

describe('Trial content', () => {
  it('picks no Trial that waits on a later phase', () => {
    const off = Object.values(CARDS).filter(
      (c): c is TrialDef => c.kind === 'trial' && c.goal.kind === 'off',
    );
    expect(off.map((c) => c.id).sort()).toEqual(['frozen-fingers']);
  });
});
