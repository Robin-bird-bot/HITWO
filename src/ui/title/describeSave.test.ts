import { describe, expect, it } from 'vitest';
import { STARTING_PARTY } from '../../content/characters';
import { applyAction, createGame, deserialize, serialize } from '../../engine';
import { describeSave } from './describeSave';

describe('the Continue button', () => {
  it('describes the saved hike', () => {
    let game = createGame({ seed: 8, hikers: STARTING_PARTY });
    expect(describeSave(game)).toBe('Day 1 · Morning · Meadow');
    for (let i = 0; i < 4; i++) game = applyAction(game, { type: 'endPhase' });
    expect(describeSave(game)).toBe('Day 2 · Afternoon · Meadow');
  });

  it('describes a game loaded back from its save the same way', () => {
    const game = createGame({ seed: 8, hikers: STARTING_PARTY });
    const loaded = deserialize(serialize(game));
    expect(loaded.ok && describeSave(loaded.state)).toBe(describeSave(game));
  });

  it('says when the hike is over', () => {
    let game = createGame({ seed: 8, hikers: STARTING_PARTY });
    for (const h of game.hikers) {
      game = applyAction(game, { type: 'abandon', hikerId: h.id });
    }
    expect(describeSave(game)).toBe('Hike over · Day 1 · Meadow');
  });
});
