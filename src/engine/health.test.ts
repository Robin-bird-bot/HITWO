import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { validateAction } from './applyAction';
import { addCondition, removeCondition } from './conditions';
import { abandonHike, isHikeOver } from './health';
import { deserialize } from './save';
import { addInjury, cureInjuries } from './stats';
import { END, fixtureGame, hiker, place, run, toNight } from './test/fixtures';
import type { GameState } from './types';

const N = BALANCE.passOut.countdownNights;

/** Passes a hiker out with 3 injuries. */
function knockOut(s: GameState, id: string) {
  for (let i = 0; i < 3; i++) addInjury(s, hiker(s, id), 'test');
  return hiker(s, id);
}

/** Ends phases through the next camp step (to the next morning). */
const throughCamp = (s: GameState) => run(toNight(s), END);

describe('injuries and passing out', () => {
  it('the 3rd injury passes a hiker out with a full countdown', () => {
    const s = fixtureGame();
    const ash = knockOut(s, 'ash');
    expect(ash.injuries).toBe(3);
    expect(ash.status).toBe('passedOut');
    expect(ash.countdown).toBe(N);
    expect(s.log.find((e) => e.kind === 'passedOut')).toMatchObject({ countdown: N });
  });

  it('injuries stop at 3, and gaining one raises stats below 5', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 2, appetite: 7, morale: 1 });
    addInjury(s, hiker(s, 'ash'), 'test');
    expect(hiker(s, 'ash').stats).toEqual({ energy: 5, appetite: 7, morale: 5 });
    knockOut(s, 'ash');
    const before = s.log.length;
    addInjury(s, hiker(s, 'ash'), 'one too many');
    expect(hiker(s, 'ash').injuries).toBe(3);
    expect(s.log.length).toBe(before);
  });

  it('a passed-out hiker can’t act, and skips the camp drains', () => {
    let s = fixtureGame();
    place(s, 'birch', 'T');
    knockOut(s, 'ash');
    expect(validateAction(s, { type: 'move', hikerId: 'ash', toTileId: 'L' })).toBe(
      'Ash has passed out.',
    );
    const stats = { ...hiker(s, 'ash').stats };
    s = throughCamp(s);
    expect(hiker(s, 'ash').stats).toEqual(stats);
  });
});

describe('the countdown', () => {
  it('drops at camp only when no active hiker shares the tile', () => {
    let s = fixtureGame();
    knockOut(s, 'ash'); // everyone starts on T, so Ash has company
    s = throughCamp(s);
    expect(hiker(s, 'ash').countdown).toBe(N);

    for (const id of ['birch', 'cedar', 'dot']) place(s, id, 'L');
    s = throughCamp(s);
    expect(hiker(s, 'ash').countdown).toBe(N - 1);
    expect(s.log.some((e) => e.kind === 'countdown' && e.left === N - 1)).toBe(true);
  });

  it('abandons the hike at 0', () => {
    let s = fixtureGame();
    knockOut(s, 'ash');
    for (const id of ['birch', 'cedar', 'dot']) place(s, id, 'L');
    for (let i = 0; i < N; i++) s = throughCamp(s);
    expect(hiker(s, 'ash').status).toBe('abandoned');
    expect(hiker(s, 'ash').countdown).toBeUndefined();
    expect(s.log.find((e) => e.kind === 'abandoned')).toMatchObject({
      hikerId: 'ash',
      why: 'countdown',
    });
  });

  it('starts full again when the hiker passes out again', () => {
    let s = fixtureGame();
    knockOut(s, 'ash');
    for (const id of ['birch', 'cedar', 'dot']) place(s, id, 'L');
    s = throughCamp(s);
    cureInjuries(s, hiker(s, 'ash'), 1, 'test');
    addInjury(s, hiker(s, 'ash'), 'test');
    expect(hiker(s, 'ash').countdown).toBe(N);
  });
});

describe('waking', () => {
  it('curing below 3 wakes the hiker and clears the countdown', () => {
    const s = fixtureGame();
    knockOut(s, 'ash');
    cureInjuries(s, hiker(s, 'ash'), 1, 'Bandages');
    expect(hiker(s, 'ash')).toMatchObject({ status: 'active', injuries: 2 });
    expect(hiker(s, 'ash').countdown).toBeUndefined();
    expect(s.log.at(-1)).toMatchObject({ kind: 'woke', hikerId: 'ash', cause: 'Bandages' });
  });

  it('a cure with nothing to cure does nothing', () => {
    const s = fixtureGame();
    const before = s.log.length;
    cureInjuries(s, hiker(s, 'ash'), 1, 'test');
    expect(s.log.length).toBe(before);
  });
});

describe('conditions that give an injury when they run out', () => {
  it('Bleeding gives 1 injury when it runs out', () => {
    let s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'bleeding', 1, 'phases', 'test');
    s = run(s, END, END);
    expect(hiker(s, 'ash').injuries).toBe(1);
    expect(s.log.some((e) => e.kind === 'injury' && e.cause === 'Bleeding ran out')).toBe(true);
  });

  it('Bleeding cured first gives no injury', () => {
    let s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'bleeding', 1, 'phases', 'test');
    removeCondition(s, hiker(s, 'ash'), 'bleeding');
    s = run(s, END, END);
    expect(hiker(s, 'ash').injuries).toBe(0);
  });

  it('a Splint’s injury comes back when it runs out, and can pass the hiker out again', () => {
    let s = fixtureGame();
    hiker(s, 'ash').injuries = 2;
    addCondition(s, hiker(s, 'ash'), 'splinted', 1, 'days', 'test');
    s = throughCamp(s);
    expect(hiker(s, 'ash')).toMatchObject({ injuries: 3, status: 'passedOut' });
  });

  it('Splinted is never a random condition', async () => {
    const { NEGATIVE_CONDITIONS, POSITIVE_CONDITIONS } = await import('../content/conditions');
    expect([...NEGATIVE_CONDITIONS, ...POSITIVE_CONDITIONS]).not.toContain('splinted');
  });
});

describe('the hike ending', () => {
  it('ends when nobody is active, and refuses everything but debug', () => {
    let s = fixtureGame();
    for (const id of ['birch', 'cedar', 'dot']) abandonHike(s, hiker(s, id), 'choice');
    expect(isHikeOver(s)).toBe(false);
    hiker(s, 'ash').injuries = 2;
    s = run(s, { type: 'debug', op: { kind: 'setStats', hikerId: 'ash', stats: {}, injuries: 3 } });
    expect(isHikeOver(s)).toBe(true);
    expect(s.log.filter((e) => e.kind === 'hikeOver')).toHaveLength(1);
    expect(validateAction(s, { type: 'endPhase' })).toBe('The hike is over.');
    expect(validateAction(s, { type: 'debug', op: { kind: 'revealMap' } })).toBeNull();
  });
});

describe('debug tools', () => {
  it('setting injuries passes out or wakes a hiker', () => {
    let s = fixtureGame();
    const set = (injuries: number) =>
      run(s, { type: 'debug', op: { kind: 'setStats', hikerId: 'ash', stats: {}, injuries } });
    s = set(5);
    expect(hiker(s, 'ash')).toMatchObject({ status: 'passedOut', injuries: 3, countdown: N });
    s = set(1);
    expect(hiker(s, 'ash').status).toBe('active');
  });

  it('sets a countdown', () => {
    let s = fixtureGame();
    knockOut(s, 'ash');
    s = run(s, { type: 'debug', op: { kind: 'setCountdown', hikerId: 'ash', nights: 1 } });
    expect(hiker(s, 'ash').countdown).toBe(1);
  });
});

describe('saves', () => {
  it('upgrades a version 6 save: a passed-out hiker gets a full countdown', () => {
    const v6 = structuredClone(fixtureGame()) as unknown as Record<string, unknown>;
    const hikers = v6.hikers as Record<string, unknown>[];
    hikers[0] = { ...hikers[0], status: 'passedOut', injuries: 4 };
    const loaded = deserialize(JSON.stringify({ ...v6, saveVersion: 6 }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.hikers[0]).toMatchObject({ injuries: 3, countdown: N });
    expect(loaded.state.hikers[1]?.countdown).toBeUndefined();
  });
});
