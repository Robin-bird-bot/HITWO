/**
 * The end screen (docs/design/16-challenge-end-screen.md, section 5): the
 * title, the list in line order, taps in the first moment ignored, and a
 * crossfade with reduced motion.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import {
  canContinue,
  costText,
  endRows,
  endTitle,
  endTransition,
  tileLine,
  titleShown,
  transitionSec,
} from './endScreen';
import { passFailResult } from './lineup';
import { passingResult } from './passing';

const E = BALANCE.minigames.endScreen;
const THREE = ['finn', 'mom', 'ellie'];

describe('the end screen', () => {
  it('says PASSED when at least one hiker passed, FAILED when nobody did', () => {
    expect(endTitle(passFailResult(THREE, (id) => id === 'mom'))).toBe('CHALLENGE PASSED');
    expect(endTitle(passFailResult(THREE, () => false))).toBe('CHALLENGE FAILED');
    expect(endTitle(passFailResult(THREE, () => true))).toBe('CHALLENGE PASSED');
  });

  it('lists every hiker in line order, exactly as the result says, with what they pay', () => {
    const r = passingResult(THREE, 2, ['mom'], {
      finn: { resources: 1, conditions: ['bleeding'] },
      ellie: { energy: 1 },
    });
    expect(endRows(r, ['ellie', 'finn', 'mom'])).toEqual([
      { id: 'ellie', passed: false, cost: '−1 ENERGY' },
      { id: 'finn', passed: false, cost: '−1 RESOURCE, BLEEDING' },
      { id: 'mom', passed: true, cost: '' },
    ]);
    expect(costText({ energy: 2, resources: 2 })).toBe('−2 ENERGY, −2 RESOURCES');
  });

  it('a passing challenge gets a line about the tile; others don’t', () => {
    expect(tileLine(passingResult(THREE, 1, ['finn'], {}), { name: 'tree' })).toBe(
      'THE WAY IS CLEAR',
    );
    expect(tileLine(passingResult(THREE, 1, [], {}), { name: 'bear' })).toBe(
      'THE BEAR STAYS ON THE TILE',
    );
    expect(tileLine(passingResult(THREE, 1, [], {}), { name: 'animals', plural: true })).toBe(
      'THE ANIMALS STAY ON THE TILE',
    );
    expect(
      tileLine(
        passFailResult(THREE, () => true),
        { name: 'x' },
      ),
    ).toBeNull();
  });

  it('ignores taps until a moment after the screen is in', () => {
    const failed = passFailResult(THREE, () => false);
    const passed = passFailResult(THREE, () => true);
    for (const [r, tr] of [
      [failed, 'drips'],
      [passed, 'wipe'],
    ] as const) {
      expect(endTransition(r, false)).toBe(tr);
      const inAt = transitionSec(tr);
      expect(canContinue(0.1, tr)).toBe(false);
      expect(canContinue(inAt + E.inputAfterSec - 0.01, tr)).toBe(false);
      expect(canContinue(inAt + E.inputAfterSec, tr)).toBe(true);
    }
    expect(transitionSec('drips')).toBeCloseTo(E.drips.coverSec + E.drips.wipeSec);
    expect(transitionSec('wipe')).toBe(E.wipeSec);
  });

  it('with reduced motion: a crossfade instead of the drips or the wipe, and no flashing', () => {
    expect(
      endTransition(
        passFailResult(THREE, () => false),
        true,
      ),
    ).toBe('fade');
    expect(
      endTransition(
        passFailResult(THREE, () => true),
        true,
      ),
    ).toBe('fade');
    expect(transitionSec('fade')).toBe(E.fadeSec);
    for (let t = 0; t < 4; t += 0.05) expect(titleShown(t, 'fade')).toBe(true);
  });

  it('the title flashes for a moment, then stays on', () => {
    const inAt = transitionSec('wipe');
    expect(titleShown(inAt + 0.1, 'wipe')).toBe(true);
    expect(titleShown(inAt + E.flash.onSec + 0.05, 'wipe')).toBe(false);
    expect(titleShown(inAt + E.flash.forSec + 0.01, 'wipe')).toBe(true);
  });
});
