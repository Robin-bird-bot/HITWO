import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { coverRadius, spotlightMs, spotlightSteps } from './transition';

const S = BALANCE.ui.overhaul.spotlight;

describe('the spotlight (35-ui-overhaul.md, section 10)', () => {
  it('closes to 90 px, holds, goes black, changes, then opens', () => {
    const steps = spotlightSteps({ cover: 1500 });
    expect(steps.map((s) => s.kind)).toEqual(['iris', 'wait', 'iris', 'change', 'wait', 'iris']);
    expect(steps[0]).toMatchObject({ r0: 1500, r1: S.minR, ms: S.closeMs, sound: 'trans.irisIn' });
    expect(steps[1]).toMatchObject({ ms: S.holdMs });
    expect(steps[2]).toMatchObject({ r0: S.minR, r1: 0, ms: S.blackMs });
    expect(steps[5]).toMatchObject({ r0: 0, r1: 1500, ms: S.openMs, sound: 'trans.irisOut' });
    expect(spotlightMs(steps)).toBe(S.closeMs + S.holdMs + S.blackMs + S.gapMs + S.openMs);
  });

  it('checking in, the doors swing open after it opens, with their creak', () => {
    const steps = spotlightSteps({ cover: 1500, doors: true });
    expect(steps.at(-1)).toEqual({
      kind: 'doors',
      waitMs: S.doorWaitMs,
      ms: S.doorMs,
      sound: 'trans.door',
    });
  });

  it('with reduced motion, a short fade instead (and no doors)', () => {
    const steps = spotlightSteps({ cover: 1500, reduced: true, doors: true });
    expect(steps).toEqual([
      { kind: 'fade', to: 1, ms: S.fadeMs },
      { kind: 'change' },
      { kind: 'fade', to: 0, ms: S.fadeMs },
    ]);
  });

  it('opens wide enough to show every corner', () => {
    const r = coverRadius({ x: 100, y: 50 }, 1600, 1000);
    expect(r).toBeGreaterThanOrEqual(Math.hypot(1500, 950));
    expect(coverRadius({ x: 800, y: 500 }, 1600, 1000)).toBeGreaterThanOrEqual(
      Math.hypot(800, 500),
    );
  });
});
