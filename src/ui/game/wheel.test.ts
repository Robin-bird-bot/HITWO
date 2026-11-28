import { describe, expect, it } from 'vitest';
import { fixtureGame, hiker, toNight } from '../../engine/test/fixtures';
import { actionForKey, wheelActions } from './wheel';

describe('the action wheel (35-ui-overhaul.md, section 4)', () => {
  it('shows six actions by day', () => {
    const s = fixtureGame();
    const acts = wheelActions(s, hiker(s, 'ash'));
    expect(acts.map((a) => a.id)).toEqual([
      'move',
      'moveAll',
      'scavenge',
      'craft',
      'tend',
      'abilities',
    ]);
  });

  it('shows Sleep, Watch and Sit by the fire at night', () => {
    const s = toNight(fixtureGame());
    expect(wheelActions(s, hiker(s, 'ash')).map((a) => a.id)).toEqual(['sleep', 'watch', 'fire']);
  });

  it('says why a blocked action can’t be done, and puts the cost on a ready one', () => {
    const s = fixtureGame();
    const acts = wheelActions(s, hiker(s, 'ash'));
    for (const a of acts) {
      expect(a.text.length).toBeGreaterThan(0);
      if (!a.ready) expect(a.cost).toBeNull();
    }
    expect(acts.find((a) => a.id === 'craft')?.cost).toEqual({ text: '−1', icon: 'zap' });
    expect(acts.find((a) => a.id === 'moveAll')?.cost).toEqual({
      text: '−1 each',
      icon: 'utensils',
    });
    expect(acts.find((a) => a.id === 'move')?.cost).toEqual({ text: 'Free' });
    expect(acts.find((a) => a.id === 'tend')?.ready).toBe(false);
    // Once the hiker has acted, everything says so.
    const after = structuredClone(s);
    hiker(after, 'ash').acted = true;
    const blocked = wheelActions(after, hiker(after, 'ash')).filter((a) => a.id !== 'abilities');
    expect(blocked.every((a) => !a.ready && a.text.length > 0)).toBe(true);
  });

  it('presses the right button with keys 1 to 6', () => {
    const s = fixtureGame();
    const acts = wheelActions(s, hiker(s, 'ash'));
    expect(actionForKey(acts, '1')?.id).toBe('move');
    expect(actionForKey(acts, '3')?.id).toBe('scavenge');
    expect(actionForKey(acts, '6')?.id).toBe('abilities');
    expect(actionForKey(acts, '7')).toBeNull();
    expect(actionForKey(acts, '0')).toBeNull();
    expect(actionForKey(acts, 'x')).toBeNull();
  });
});
