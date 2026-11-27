/**
 * Camp Cleanup (docs/design/21-minigames-dodge-camp.md, sections 4 and 9):
 * movement is cell by cell, no reversing, and queued turns work; a pickup
 * adds a bag of that color at the end; a crash removes a random number of
 * bags in the tier's range, from the end only, and never a hiker;
 * obstacles never close off part of the board; results compare each
 * hiker's bags with the quota.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import {
  bagsOf,
  everyoneHasEnough,
  cellsOf,
  newCampCleanup,
  placeObstacles,
  result,
  room,
  tick,
  turn,
  type CampCleanupState,
} from './logic';

const C = BALANCE.minigames.campCleanup;
const Q = BALANCE.minigames.quick;
const THREE = ['finn', 'mom', 'ellie'];

/** No trash on the board, so nothing gets in the way. */
const clear = (s: CampCleanupState): CampCleanupState => ({ ...s, trash: [] });

/** One step's worth of time. */
const step = (s: CampCleanupState) => tick(s, s.stepSec + 1e-6);

describe('Camp Cleanup', () => {
  it('the snake starts as the hikers in line order at the left middle, heading right, and moves a cell a step', () => {
    let s = newCampCleanup({ tier: 1, obstacles: 'off' }, THREE, 1);
    expect(s.snake.map((g) => g.owner)).toEqual(THREE);
    expect(s.snake.every((g) => g.kind === 'hiker' && g.y === Math.floor(C.rows / 2))).toBe(true);
    expect(s.dir).toBe('right');
    const head = s.snake[0]!;
    s = clear(s);
    s = step(s);
    expect(s.snake[0]).toMatchObject({ x: head.x + 1, y: head.y });
    // Each one follows the one in front.
    expect(s.snake[1]).toMatchObject({ x: head.x, y: head.y });
  });

  it('no reversing; up to two turns queue up, so a U-turn works', () => {
    let s = clear(newCampCleanup({ tier: 1, obstacles: 'off' }, ['finn'], 2));
    expect(turn(s, 'left')).toBe(s);
    s = turn(turn(s, 'down'), 'left');
    expect(s.queue).toEqual(['down', 'left']);
    expect(turn(s, 'up')).toBe(s);
    const head = s.snake[0]!;
    s = step(s);
    expect(s.snake[0]).toMatchObject({ x: head.x, y: head.y + 1 });
    s = step(s);
    expect(s.snake[0]).toMatchObject({ x: head.x - 1, y: head.y + 1 });
    expect(s.dir).toBe('left');
  });

  it('a pickup adds a bag of that color at the end, and new trash appears away from the head', () => {
    let s = newCampCleanup({ tier: 1, obstacles: 'off' }, THREE, 3);
    const head = s.snake[0]!;
    // Put Mom's trash right in front of the head.
    s = {
      ...s,
      trash: s.trash.map((t) => (t.owner === 'mom' ? { ...t, x: head.x + 1, y: head.y } : t)),
    };
    s = step(s);
    expect(s.pending).toEqual(['mom']);
    const fresh = s.trash.find((t) => t.owner === 'mom')!;
    expect(
      Math.abs(fresh.x - s.snake[0]!.x) + Math.abs(fresh.y - s.snake[0]!.y),
    ).toBeGreaterThanOrEqual(C.trashAway);
    s = step(s);
    expect(s.snake.at(-1)).toMatchObject({ kind: 'bag', owner: 'mom' });
    expect(bagsOf(s, 'mom')).toBe(1);
  });

  it.each(TIERS)(
    'Tier %i: a crash drops a random number of bags in range, from the end only, never a hiker',
    (tier) => {
      for (let seed = 1; seed <= 20; seed++) {
        let s = newCampCleanup({ tier, obstacles: 'off' }, THREE, seed);
        // The three hikers and ten bags along the top row, heading up into the wall.
        const owners = [...THREE, ...Array.from({ length: 10 }, (_, k) => THREE[k % 3]!)];
        const snake = owners.map((owner, k) => ({
          x: 20 - k,
          y: 0,
          kind: k < 3 ? ('hiker' as const) : ('bag' as const),
          owner,
        }));
        s = { ...clear(s), snake, dir: 'up' };
        const before = s.snake.length;
        s = step(s);
        expect(s.phase).toBe('crash');
        const lost = before - s.snake.length;
        const [a, b] = C.tiers[tier].crash;
        expect(lost).toBeGreaterThanOrEqual(a);
        expect(lost).toBeLessThanOrEqual(b);
        expect(s.snake.filter((g) => g.kind === 'hiker')).toHaveLength(3);
        expect(s.lastCrash!.lost.every((g) => g.kind === 'bag')).toBe(true);
      }
    },
  );

  it('after a crash it waits for a direction, then turns toward the most room if none comes', () => {
    let s = clear(newCampCleanup({ tier: 1, obstacles: 'off' }, ['finn'], 5));
    s = { ...s, snake: [{ ...s.snake[0]!, x: C.cols - 1 }], dir: 'right' };
    s = step(s);
    expect(s.phase).toBe('crash');
    s = tick(s, C.crashSec + 0.01);
    expect(s.phase).toBe('wait');
    const waited = tick(s, C.waitSec + 0.01);
    expect(waited.phase).toBe('run');
    expect(waited.dir === 'up' || waited.dir === 'down' || waited.dir === 'left').toBe(true);
    const chosen = turn(s, 'up');
    expect(chosen.phase).toBe('run');
    expect(chosen.dir).toBe('up');
  });

  it.each([2, 3, 4, 5] as const)(
    'Tier %i: obstacles never close off part of the board, and keep off the start',
    (tier) => {
      const { cols, rows, obstacles } = C.tiers[tier];
      for (let seed = 1; seed <= 30; seed++) {
        const board = { cols, rows };
        const obs = placeObstacles(seedRng(seed), board, obstacles);
        expect(obs.length).toBe(obstacles);
        const blocked = new Set(obs.flatMap((o) => cellsOf(o).map((c) => `${c.x},${c.y}`)));
        expect(room(board, { x: 1, y: Math.floor(rows / 2) }, blocked)).toBe(
          cols * rows - blocked.size,
        );
        for (const o of obs) for (const c of cellsOf(o)) expect(c.y).not.toBe(Math.floor(rows / 2));
      }
      // Nov 26 evening: Tier I has none, and Tier II now has a couple.
      expect(newCampCleanup({ tier: 1 }, THREE, 1).obstacles).toHaveLength(0);
      expect(newCampCleanup({ tier: 2 }, THREE, 1).obstacles).toHaveLength(C.tiers[2].obstacles);
    },
  );

  it('the grid shrinks with the tier, and the time is much shorter (Nov 26 evening)', () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const s = newCampCleanup({ tier }, THREE, 1);
      expect([s.cols, s.rows]).toEqual([C.tiers[tier].cols, C.tiers[tier].rows]);
      expect(s.cols).toBeLessThanOrEqual(C.cols);
      expect(s.rows).toBeLessThanOrEqual(C.rows);
      expect(s.timeSec).toBe(C.tiers[tier].timeSec);
      expect(s.snake.every((g) => g.y === Math.floor(s.rows / 2))).toBe(true);
    }
    expect(newCampCleanup({ tier: 5 }, THREE, 1).cols).toBeLessThan(
      newCampCleanup({ tier: 1 }, THREE, 1).cols,
    );
  });

  it('when time runs out, each hiker passes with their quota of bags; those short lose 1 energy', () => {
    let s = newCampCleanup({ tier: 1, obstacles: 'off', timeSec: 1 }, ['finn', 'mom'], 6);
    const tail = s.snake.at(-1)!;
    s = {
      ...s,
      snake: [
        ...s.snake,
        ...Array.from({ length: s.quota }, (_, k) => ({
          x: tail.x,
          y: tail.y + 1 + k,
          kind: 'bag' as const,
          owner: 'finn',
        })),
      ],
    };
    s = {
      ...s,
      trash: [],
      dir: 'down',
      snake: s.snake.map((g, k) => ({ ...g, x: 5, y: 1 + (s.snake.length - k) })),
    };
    for (let k = 0; k < 200 && !s.over; k++) s = tick(s, 0.01);
    expect(s.over).toBe(true);
    expect(result(s)).toMatchObject({ safe: ['finn'], pays: { mom: { energy: Q.failEnergy } } });
  });

  /** Everyone given their quota of bags, the line laid down the left, heading down a long empty column. */
  const stocked = (tier: 1 | 3 = 1, timeSec = 60): CampCleanupState => {
    const s0 = newCampCleanup({ tier, obstacles: 'off', timeSec }, ['finn', 'mom'], 6);
    const bags = ['finn', 'mom'].flatMap((owner) =>
      Array.from({ length: s0.quota }, () => ({ x: 0, y: 0, kind: 'bag' as const, owner })),
    );
    const snake = [...s0.snake, ...bags].map((g, k, all) => ({ ...g, x: 1, y: all.length - k }));
    return { ...s0, snake, trash: [], dir: 'down', queue: [], stepSec: 100, stepLeft: 100 };
  };

  describe('the countdown (Nov 26 evening)', () => {
    it('starts the moment everyone has their quota, and at 0 everyone passes before time runs out', () => {
      let s = tick(stocked(), 0.01);
      expect(everyoneHasEnough(s)).toBe(true);
      expect(s.countdown).toBe(C.tiers[1].countdownSec);
      for (let k = 0; k < 1000 && !s.over; k++) s = tick(s, 0.05);
      expect(s.over).toBe(true);
      expect(s.timeLeft).toBeGreaterThan(0);
      expect(s.time).toBeCloseTo(C.tiers[1].countdownSec + 0.01, 1);
      expect(result(s)).toMatchObject({ safe: ['finn', 'mom'] });
    });

    it('is longer at higher tiers', () => {
      expect(tick(stocked(3), 0.01).countdown).toBe(C.tiers[3].countdownSec);
      expect(C.tiers[5].countdownSec).toBeGreaterThan(C.tiers[1].countdownSec);
    });

    it('a crash below the quota cancels it; back at the quota, it starts over from the full time', () => {
      let s = tick(stocked(), 0.01);
      s = tick(s, 2);
      expect(s.countdown).toBeCloseTo(C.tiers[1].countdownSec - 2, 5);
      // Mom loses a bag: cancelled.
      const lost = s.snake.findLastIndex((g) => g.owner === 'mom' && g.kind === 'bag');
      const dropped = s.snake[lost]!;
      s = tick({ ...s, snake: s.snake.filter((_, k) => k !== lost) }, 0.5);
      expect(s.countdown).toBeNull();
      expect(s.over).toBe(false);
      // Back at the quota: the full countdown again.
      s = tick({ ...s, snake: [...s.snake, { ...dropped, y: 0 }] }, 0.5);
      expect(s.countdown).toBe(C.tiers[1].countdownSec);
    });

    it('the game timer keeps running under it; if time runs out first, the usual end applies', () => {
      let s = tick(stocked(1, 2), 0.01);
      expect(s.countdown).not.toBeNull();
      for (let k = 0; k < 1000 && !s.over; k++) s = tick(s, 0.05);
      expect(s.over).toBe(true);
      expect(s.timeLeft).toBe(0);
      expect(s.countdown).toBeGreaterThan(0);
    });
  });

  it('5 or 6 hikers need one bag fewer; Prepare: more time, fewer bags, fewer obstacles, slower', () => {
    const six = ['finn', 'mom', 'ellie', 'wyatt', 'gdog', 'grandpaWink'];
    expect(newCampCleanup({ tier: 2 }, six, 1).quota).toBe(C.tiers[2].quota - C.bigPartyLess);
    const p = newCampCleanup(
      { tier: 4, extraSec: 10, fewerBags: 1, fewerObstacles: 2, slower: 0.2 },
      THREE,
      1,
    );
    expect(p.timeSec).toBe(C.tiers[4].timeSec + 10);
    expect(p.quota).toBe(C.tiers[4].quota - 1);
    expect(p.obstacles).toHaveLength(C.tiers[4].obstacles - 2);
    expect(p.stepSec).toBeCloseTo(1 / (C.tiers[4].speed * 0.8));
  });
});
