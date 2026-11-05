import { describe, expect, it } from 'vitest';
import { STARTING_PARTY } from '../../content/characters';
import { createGame } from '../../engine';
import { fixtureGame, hiker, place, toNight } from '../../engine/test/fixtures';
import { actionStates, conditionChips, statNote, statusTag } from './hikerInfo';

const byId = (s: ReturnType<typeof fixtureGame>, id: string) =>
  Object.fromEntries(actionStates(s, hiker(s, id)).map((a) => [a.id, a]));

describe('action grid', () => {
  it('marks unbuilt actions with the phase they arrive in', () => {
    const a = byId(fixtureGame(), 'ash');
    expect(a.watch?.status).toBe('soon');
    expect(a.fire?.reason).toBe('Sitting by the fire arrives in Phase 6.');
    expect(a.craft?.sub).toBe('Phase 9');
  });

  it('makes Scavenge ready on a tile with nodes, with its cost', () => {
    const s = fixtureGame();
    expect(byId(s, 'ash').scavenge).toMatchObject({
      status: 'blocked',
      reason: 'There’s nothing to scavenge on this tile.',
    });
    place(s, 'ash', 'L');
    expect(byId(s, 'ash').scavenge).toMatchObject({ status: 'ready', sub: '−1 Appetite' });
    place(s, 'ash', 'L', { appetite: 5 });
    expect(byId(s, 'ash').scavenge?.reason).toMatch(/^Hungry/);
  });

  it('gives the engine’s reason for actions not allowed right now', () => {
    const s = fixtureGame();
    expect(byId(s, 'ash').sleep).toMatchObject({
      status: 'blocked',
      reason: 'Hikers sleep at night.',
    });
    place(s, 'ash', 'T', { appetite: 2 });
    expect(byId(s, 'ash').move?.reason).toMatch(/^Famished/);
    expect(byId(s, 'ash').moveAll?.reason).toMatch(/^Famished/);
  });

  it('readies Sleep at night, showing the Energy it gives', () => {
    expect(byId(toNight(fixtureGame()), 'ash').sleep).toMatchObject({
      status: 'ready',
      sub: '+1 Energy',
    });
  });

  it('readies Move All only when someone here can come along', () => {
    const s = fixtureGame();
    expect(byId(s, 'ash').moveAll?.status).toBe('ready');
    for (const id of ['birch', 'cedar', 'dot']) place(s, id, 'L');
    expect(byId(s, 'ash').moveAll?.reason).toBe('Nobody else on this tile can come along.');
  });

  it('shows a Cat’s moves as free', () => {
    const game = createGame({ seed: 1, hikers: STARTING_PARTY });
    expect(byId(game, 'hiker-4').move?.sub).toBe('No Appetite');
    expect(byId(game, 'hiker-1').move?.sub).toMatch(/^−\d Appetite$/);
  });
});

describe('hiker card details', () => {
  it('names the next threshold', () => {
    expect(statNote('energy', 8)).toBe('Fatigued at 6');
    expect(statNote('energy', 5)).toBe('Exhausted at 3');
    expect(statNote('appetite', 2)).toBe('Famished');
    expect(statNote('morale', 8)).toBe('Luck +1.2');
    expect(statNote('morale', 0)).toBe('Luck −2');
  });

  it('shows threshold states and injuries as condition icons', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 4, energy: 3 });
    hiker(s, 'ash').injuries = 2;
    expect(conditionChips(hiker(s, 'ash')).map((c) => c.key)).toEqual([
      'hungry',
      'exhausted',
      'injury',
    ]);
  });

  it('tags hikers as acting, ready, acted or passed out', () => {
    const s = fixtureGame();
    const h = hiker(s, 'ash');
    expect(statusTag(h, true)).toBe('ACTING');
    expect(statusTag(h, false)).toBe('READY');
    h.acted = true;
    expect(statusTag(h, false)).toBe('ACTED');
    h.status = 'passedOut';
    expect(statusTag(h, false)).toBe('PASSED OUT');
  });
});
