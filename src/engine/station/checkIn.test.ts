import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { addCondition } from '../conditions';
import { isHikeOver } from '../health';
import { deserialize, serialize } from '../save';
import { addInjury } from '../stats';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { Action, GameState } from '../types';
import { checkInPreview } from './checkIn';

const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const ALL = ['ash', 'birch', 'cedar', 'dot'];

/** Everyone one move from the checkpoint (on M). */
function nearby(): GameState {
  const s = fixtureGame();
  for (const id of ALL) place(s, id, 'M');
  return s;
}

function knockOut(s: GameState, id: string) {
  for (let i = 0; i < 3; i++) addInjury(s, hiker(s, id), 'test');
}

describe('checking in', () => {
  it('moving onto the checkpoint checks in, for a normal move and 10 XP', () => {
    let s = nearby();
    const before = { ...hiker(s, 'ash').stats };
    s = run(s, move('ash', 'C'));
    const ash = hiker(s, 'ash');
    expect(ash).toMatchObject({ status: 'checkedIn', tileId: 'C', xp: BALANCE.station.checkInXp });
    expect(ash.stats.appetite).toBeLessThan(before.appetite);
    expect(s.arrivals).toEqual([{ section: 0, hikerId: 'ash', injuries: 0, carried: false }]);
    expect(s.log.findLast((e) => e.kind === 'checkedIn')).toMatchObject({ hikerIds: ['ash'] });
    expect(s.station).toBeUndefined();
  });

  it('a checked-in hiker can’t act or step back out', () => {
    const s = run(nearby(), move('ash', 'C'));
    expect(validateAction(s, move('ash', 'M'))).toBe('Ash has checked in.');
  });

  it('Move All checks the whole group in', () => {
    const s = run(nearby(), { type: 'moveAll', hikerId: 'ash', toTileId: 'C', bring: ['birch'] });
    expect(['ash', 'birch'].map((id) => hiker(s, id).status)).toEqual(['checkedIn', 'checkedIn']);
  });

  it('a carried hiker arrives with their carrier, still out cold, and is counted as carried', () => {
    let s = nearby();
    knockOut(s, 'birch');
    s = run(s, { type: 'pickUp', carrierId: 'ash', hikerId: 'birch' }, move('ash', 'C'));
    expect(hiker(s, 'birch')).toMatchObject({ status: 'checkedIn', tileId: 'C', injuries: 3 });
    expect(hiker(s, 'ash').carrying).toBeUndefined();
    expect(s.arrivals?.find((a) => a.hikerId === 'birch')).toMatchObject({ carried: true });
  });

  it('waiting at the checkpoint costs nothing: no camp drains, no condition ticks', () => {
    let s = run(nearby(), move('ash', 'C'));
    addCondition(s, hiker(s, 'ash'), 'wet', 1, 'days', 'test');
    const stats = { ...hiker(s, 'ash').stats };
    s = run(toNight(s), END);
    expect(s.day).toBe(2);
    expect(hiker(s, 'ash').stats).toEqual(stats);
    expect(hiker(s, 'ash').conditions.some((c) => c.id === 'wet')).toBe(true);
  });
});

describe('everyone in', () => {
  it('the ranger station opens when the last hiker checks in; it isn’t a game over', () => {
    let s = run(nearby(), move('ash', 'C'), move('birch', 'C'), move('cedar', 'C'));
    expect(s.station).toBeUndefined();
    s = run(s, move('dot', 'C'));
    expect(s.station).toMatchObject({ checkpoint: 1 });
    expect(isHikeOver(s)).toBe(false);
    expect(s.log.findLast((e) => e.kind === 'stationOpened')).toBeTruthy();
  });

  it('a passed-out hiker left on the trail is left behind, and the move confirm says so first', () => {
    let s = nearby();
    knockOut(s, 'dot');
    s = run(s, move('ash', 'C'), move('birch', 'C'));
    expect(checkInPreview(s, ['cedar'])).toMatchObject({ last: true, summit: false });
    expect(checkInPreview(s, ['cedar']).leftBehind.map((h) => h.id)).toEqual(['dot']);
    s = run(s, move('cedar', 'C'));
    expect(hiker(s, 'dot').status).toBe('abandoned');
    expect(s.log.find((e) => e.kind === 'abandoned')).toMatchObject({
      hikerId: 'dot',
      why: 'leftBehind',
    });
    expect(s.station).toBeTruthy();
  });

  it('the last hiker on the trail passing out also opens the station, leaving them behind', () => {
    let s = run(nearby(), move('ash', 'C'), move('birch', 'C'), move('cedar', 'C'));
    s = run(s, { type: 'debug', op: { kind: 'setStats', hikerId: 'dot', stats: {}, injuries: 3 } });
    expect(hiker(s, 'dot').status).toBe('abandoned');
    expect(s.station).toBeTruthy();
  });

  it('at the last section the checkpoint is the summit, and the hike is over', () => {
    let s = nearby();
    s.sectionIndex = BALANCE.run.biomes.length - 1;
    expect(checkInPreview(s, ALL)).toMatchObject({ last: true, summit: true });
    s = run(s, {
      type: 'moveAll',
      hikerId: 'ash',
      toTileId: 'C',
      bring: ['birch', 'cedar', 'dot'],
    });
    expect(s.summit).toBe(true);
    expect(s.station).toBeUndefined();
    expect(isHikeOver(s)).toBe(true);
    expect(s.log.slice(-2).map((e) => e.kind)).toEqual(['summit', 'hikeOver']);
  });

  it('a save mid-check-in loads back the same', () => {
    const s = run(nearby(), move('ash', 'C'));
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state).toEqual(s);
  });
});
