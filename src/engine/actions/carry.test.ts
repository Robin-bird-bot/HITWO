import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { applyEffects } from '../challenges/applyEffects';
import { addCondition } from '../conditions';
import { moveAllCost, moveCost } from '../costs';
import { abandonHike } from '../health';
import { deserialize, serialize } from '../save';
import { addInjury, cureInjuries } from '../stats';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { Action, GameState } from '../types';

const pickUp = (carrierId: string, hikerId: string): Action => ({
  type: 'pickUp',
  carrierId,
  hikerId,
});
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });

function knockOut(s: GameState, id: string) {
  for (let i = 0; i < 3; i++) addInjury(s, hiker(s, id), 'test');
}

/** Ash carrying Birch on the trailhead; Cedar and Dot off on L. */
function carrying(): GameState {
  const s = fixtureGame();
  place(s, 'cedar', 'L');
  place(s, 'dot', 'L');
  knockOut(s, 'birch');
  return run(s, pickUp('ash', 'birch'));
}

describe('picking up and putting down', () => {
  it('picks up a passed-out hiker on the same tile, as a free action', () => {
    const s = carrying();
    expect(hiker(s, 'ash').carrying).toBe('birch');
    expect(hiker(s, 'ash').acted).toBe(false);
    expect(s.log.at(-1)).toMatchObject({ kind: 'carry', how: 'pickedUp', carrierId: 'ash' });
  });

  it('puts them down, for free', () => {
    const s = run(carrying(), { type: 'putDown', carrierId: 'ash' });
    expect(hiker(s, 'ash').carrying).toBeUndefined();
    expect(s.log.at(-1)).toMatchObject({ kind: 'carry', how: 'putDown' });
  });

  it('only a passed-out hiker, on this tile, carried by one hiker at a time', () => {
    const s = fixtureGame();
    expect(validateAction(s, pickUp('ash', 'birch'))).toBe(
      'Only a passed-out hiker can be carried.',
    );
    knockOut(s, 'birch');
    knockOut(s, 'cedar');
    place(s, 'birch', 'L');
    expect(validateAction(s, pickUp('ash', 'birch'))).toBe('Birch isn’t on this tile.');
    place(s, 'birch', 'T');
    const held = run(s, pickUp('ash', 'birch'));
    expect(validateAction(held, pickUp('dot', 'birch'))).toBe('Ash is already carrying Birch.');
    expect(validateAction(held, pickUp('ash', 'cedar'))).toBe(
      'Ash is already carrying Birch. Put them down first.',
    );
    expect(validateAction(held, pickUp('cedar', 'birch'))).toBe('Cedar has passed out.');
  });

  it('not a Frozen hiker', () => {
    const s = fixtureGame();
    knockOut(s, 'birch');
    addCondition(s, hiker(s, 'birch'), 'frozen', 2, 'phases', 'test');
    expect(validateAction(s, pickUp('ash', 'birch'))).toBe('Birch can’t be moved right now.');
  });
});

describe('moving while carrying', () => {
  it('the carried hiker comes along, and the carrier pays +1 Appetite', () => {
    const s = carrying();
    const plain = BALANCE.lines.baseAppetite.normal;
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(plain + BALANCE.carry.appetite);
    const before = hiker(s, 'ash').stats.appetite;
    const after = run(s, move('ash', 'L'));
    expect(hiker(after, 'birch')).toMatchObject({ tileId: 'L', cameFrom: 'T' });
    expect(hiker(after, 'ash').stats.appetite).toBe(before - plain - BALANCE.carry.appetite);
    expect(after.log.find((e) => e.kind === 'move')).toMatchObject({ carried: ['birch'] });
  });

  it('Move All brings them too, and only the carrier pays the extra', () => {
    const s = carrying();
    place(s, 'cedar', 'T');
    const costs = moveAllCost(s, 'cedar', 'L', ['ash']) ?? [];
    expect(costs.find((c) => c.hikerId === 'ash')?.cost.appetite).toBe(BALANCE.carry.appetite);
    const after = run(s, { type: 'moveAll', hikerId: 'cedar', toTileId: 'L', bring: ['ash'] });
    expect(hiker(after, 'birch').tileId).toBe('L');
  });

  it('Full blocks the extra Appetite too', () => {
    const s = carrying();
    addCondition(s, hiker(s, 'ash'), 'full', 1, 'days', 'test');
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(0);
  });

  it('a carried hiker who becomes Frozen stops the move', () => {
    const s = carrying();
    addCondition(s, hiker(s, 'birch'), 'frozen', 2, 'phases', 'test');
    expect(validateAction(s, move('ash', 'L'))).toBe(
      'Birch can’t be moved right now. Put them down first.',
    );
  });

  it('a carried hiker never counts down: their carrier is with them', () => {
    let s = carrying();
    s = run(s, move('ash', 'M'));
    s = run(toNight(s), END);
    expect(hiker(s, 'birch').countdown).toBe(BALANCE.passOut.countdownNights);
  });
});

describe('a carry ends', () => {
  it('when the carried hiker wakes', () => {
    const s = carrying();
    cureInjuries(s, hiker(s, 'birch'), 1, 'test');
    expect(hiker(s, 'ash').carrying).toBeUndefined();
  });

  it('when the carrier passes out: they drop the hiker where they are', () => {
    const s = carrying();
    knockOut(s, 'ash');
    expect(hiker(s, 'ash').carrying).toBeUndefined();
    expect(s.log.some((e) => e.kind === 'carry' && e.how === 'dropped')).toBe(true);
  });

  it('when either one leaves the hike', () => {
    const s = carrying();
    abandonHike(s, hiker(s, 'birch'), 'choice');
    expect(hiker(s, 'ash').carrying).toBeUndefined();
  });

  it('when a card moves the carrier', () => {
    const s = carrying();
    const ash = hiker(s, 'ash');
    applyEffects(
      s,
      {
        card: { name: 'Test' },
        tileId: 'T',
        targets: [ash],
        onTile: [ash],
        rolls: { x: {}, y: {}, includes: {}, luck: 0 },
      },
      [{ op: 'move', how: 'swept' }],
    );
    expect(ash.carrying).toBeUndefined();
    expect(hiker(s, 'birch').tileId).toBe('T');
    expect(s.log.some((e) => e.kind === 'carry' && e.how === 'dropped')).toBe(true);
  });
});

describe('saves', () => {
  it('keep who is carrying whom', () => {
    const s = carrying();
    const back = deserialize(serialize(s));
    expect(back.ok && hiker(back.state, 'ash').carrying).toBe('birch');
  });
});
