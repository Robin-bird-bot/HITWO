/**
 * Dodge (docs/design/12-minigames-dodge.md, section 13): switching hikers,
 * hits and lives, the ending, staying in the box,
 * and the controls. The attack library's tests are in attacks.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { hikerStatus, resultLine } from '../results';
import {
  clampToBox,
  joystickVector,
  keysToVector,
  newDodge,
  result,
  step,
  type DodgeState,
} from './logic';

const D = BALANCE.minigames.dodge;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;
const STILL = { x: 0, y: 0 };

/** Plays with no attacks (they're never due), so only the clock and switching run. */
const calm = (s: DodgeState): DodgeState => ({ ...s, nextAttackAt: Infinity });
const run = (s: DodgeState, seconds: number, input = STILL) => {
  let out = s;
  for (let t = 0; t < seconds - 1e-9; t += DT) out = step(out, DT, input);
  return out;
};
/** Puts a bee right on the sprite, already flying. */
const beeOn = (s: DodgeState): DodgeState => ({
  ...s,
  parts: [
    {
      kind: 'bee',
      id: 99,
      round: 0,
      x: s.pos.x,
      y: s.pos.y,
      vx: 0,
      vy: 0,
      warnAt: s.time - 1,
      activeAt: s.time - 0.5,
      mark: { x: 0, y: 0 },
    },
  ],
});

describe('switching hikers', () => {
  it('the active hiker switches every N seconds in line order, skipping hikers who are out', () => {
    let s = calm(newDodge({ animal: 'bees', tier: 1, switchSec: 3 }, THREE, 1));
    expect(s.active).toBe('finn');
    s = run(s, 3.05);
    expect(s.active).toBe('mom');
    s = { ...s, lives: { ...s.lives, ellie: 0 } };
    s = run(s, 3);
    expect(s.active).toBe('finn');
  });

  it('one hiker left means no switching', () => {
    let s = calm(newDodge({ animal: 'bees', tier: 1 }, THREE, 1));
    s = { ...s, lives: { finn: 2, mom: 0, ellie: 0 } };
    s = run(s, 12);
    expect(s.active).toBe('finn');
  });
});

describe('hits and lives', () => {
  it('a hit costs the active hiker 1 life, then 1 s of safety', () => {
    let s = calm(newDodge({ animal: 'bees', tier: 1 }, THREE, 1));
    s = step(beeOn(s), DT, STILL);
    expect(s.lives.finn).toBe(D.lives - 1);
    expect(s.hits.finn).toBe(1);
    expect(s.lastHit?.hikerId).toBe('finn');
    // Still on the bee, but safe for a second.
    s = run(beeOn(s), 0.5);
    expect(s.lives.finn).toBe(D.lives - 1);
    s = run(s, 0.6);
    s = step(beeOn(s), DT, STILL);
    expect(s.lives.finn).toBe(D.lives - 2);
  });

  it('a hiker at 0 lives is out for good, and the next takes over at once', () => {
    let s = calm(newDodge({ animal: 'bees', tier: 1, lives: 1, switchSec: 3 }, THREE, 1));
    s = run(s, 1);
    s = step(beeOn(s), DT, STILL);
    expect(s.lives.finn).toBe(0);
    expect(s.active).toBe('mom');
    expect(s.switchIn).toBeCloseTo(3);
    s = run({ ...s, parts: [] }, 10);
    expect(s.active).not.toBe('finn');
  });
});

describe('the ending', () => {
  it('ends when time runs out; pass or fail and hit counts per hiker', () => {
    let s = calm(newDodge({ animal: 'bees', tier: 1, lives: 1, lengthSec: 10 }, THREE, 1));
    s = step(beeOn(s), DT, STILL);
    s = run({ ...s, parts: [] }, 10);
    expect(s.over).toBe(true);
    const r = result(s);
    expect(r.safe).toEqual(['mom', 'ellie']);
    expect(r.hit.map((h) => h.hikerId)).toEqual(['finn']);
    expect(r.hits).toEqual({ finn: 1, mom: 0, ellie: 0 });
    expect(resultLine(r)).toBe('2 passed, 1 failed');
    expect(hikerStatus(r, 'finn').text).toBe('Failed · 1 hit');
    expect(hikerStatus(r, 'mom').text).toBe('Passed · 0 hits');
  });

  it('ends early if everyone is out', () => {
    let s = calm(newDodge({ animal: 'bees', tier: 1, lives: 1 }, ['finn'], 1));
    s = step(beeOn(s), DT, STILL);
    expect(s.over).toBe(true);
    expect(s.time).toBeLessThan(1);
  });

  it('length, lives and switch time come from the tier unless the testing tab overrides them', () => {
    const t3 = newDodge({ animal: 'swordBear', tier: 3 }, THREE, 1);
    expect(t3.lengthSec).toBe(D.tiers[3].lengthSec);
    expect(t3.maxLives).toBe(D.lives);
    expect(t3.switchSec).toBe(D.switchSec);
    const custom = newDodge(
      { animal: 'swordBear', tier: 3, lengthSec: 45, lives: 3, switchSec: 8 },
      THREE,
      1,
    );
    expect([custom.lengthSec, custom.maxLives, custom.switchSec]).toEqual([45, 3, 8]);
  });
});

describe('controls', () => {
  it('the sprite never leaves the box, even when it shrinks', () => {
    let s = calm(newDodge({ animal: 'swordBear', tier: 3 }, THREE, 1));
    s = run(s, 3, { x: 1, y: 1 });
    const corner = s.pos;
    expect(corner.x).toBeLessThanOrEqual(s.box.cx + s.box.w / 2 - 5 + 1e-9);
    s = {
      ...s,
      boxMove: {
        from: s.box,
        to: { ...s.box, w: D.sword.shrunk[0], h: D.sword.shrunk[1] },
        at: s.time,
        sec: D.boxEaseSec,
      },
    };
    s = run(s, 1, { x: 1, y: 1 });
    expect(s.box.w).toBeCloseTo(D.sword.shrunk[0]);
    expect(s.pos.x).toBeLessThanOrEqual(s.box.cx + s.box.w / 2 - 5 + 1e-9);
    expect(s.pos.y).toBeLessThanOrEqual(s.box.cy + s.box.h / 2 - 6 + 1e-9);
    expect(clampToBox({ x: 999, y: -999 }, s.box)).toEqual({
      x: s.box.cx + s.box.w / 2 - 5,
      y: s.box.cy - s.box.h / 2 + 6,
    });
  });

  it('the joystick: a vector from where the finger landed, full speed at 24 px, and it stops on release', () => {
    const start = { x: 100, y: 100 };
    expect(joystickVector(start, { x: 112, y: 100 }).move).toEqual({ x: 0.5, y: 0 });
    const far = joystickVector(start, { x: 100, y: 200 });
    expect(far.move.y).toBeCloseTo(1);
    expect(far.knob).toEqual({ x: 100, y: 124 });
    expect(joystickVector(start, start).move).toEqual({ x: 0, y: 0 });
  });

  it('WASD and the arrow keys both work; diagonals are normalized', () => {
    expect(keysToVector(new Set(['ArrowRight']))).toEqual({ x: 1, y: 0 });
    expect(keysToVector(new Set(['d']))).toEqual({ x: 1, y: 0 });
    expect(keysToVector(new Set(['w']))).toEqual({ x: 0, y: -1 });
    const diag = keysToVector(new Set(['a', 'ArrowDown']));
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
    expect(diag.x).toBeLessThan(0);
    expect(keysToVector(new Set())).toEqual({ x: 0, y: 0 });
  });
});
