import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { givePoints, hiker, toNight, trailGame } from '../../engine/test/fixtures';
import { trailMap } from './trailMap';
import { firstStep, marked, trailsView } from './trailsView';

describe('the Skill Trails view', () => {
  it('learned, can learn now, and not yet (with the level it needs)', () => {
    const s = givePoints(trailGame(['finn']), 0, 0);
    const view = trailsView(s, hiker(s, 'finn'));
    const leader = view[0]!.steps;
    expect(leader.map((x) => x.state)).toEqual(['learned', 'notYet', 'notYet']);
    expect(leader[1]).toMatchObject({ needLevel: BALANCE.trails.unlockLevel[2], cost: 1 });
    // Another tree's Tier 1: open at any level, for 2 points.
    expect(view[1]!.steps[0]).toMatchObject({ state: 'open', cost: BALANCE.trails.cost.openTree });
  });

  it('by day, Learn waits for night or a station; at night it’s ready', () => {
    let s = givePoints(trailGame(['finn']), 2, 3);
    const day = trailsView(s, hiker(s, 'finn'))[0]!.steps[1]!;
    expect(day).toMatchObject({ state: 'open', reason: 'Learn at night or at a ranger station.' });
    s = givePoints(toNight(s), 2, 3);
    const night = trailsView(s, hiker(s, 'finn'))[0]!.steps[1]!;
    expect(night.reason).toBeUndefined();
    expect(firstStep(trailsView(s, hiker(s, 'finn')))).toBe('finn-leader-t2');
  });

  it('a step with levels: its level, the next one and what it costs (26, section 5.1)', () => {
    let s = givePoints(toNight(trailGame([['wyatt', 'wyatt-scout']])), 0, 1);
    let sight = trailsView(s, hiker(s, 'wyatt'))[2]!.steps[0]!;
    expect(sight).toMatchObject({ state: 'learned', level: 1, levels: 4 });
    expect(sight.next?.cost).toBe(BALANCE.trails.cost.level);
    expect(sight.next?.step.text).toContain('50%');
    expect(sight.reason).toBeUndefined();
    hiker(s, 'wyatt').trails!.levels = { 'wyatt-scout-t1': 4 };
    s = givePoints(s, 0, 1);
    sight = trailsView(s, hiker(s, 'wyatt'))[2]!.steps[0]!;
    expect(sight.level).toBe(4);
    expect(sight.next).toBeUndefined();
    expect(sight.step.text).toContain('every minigame challenge');
  });

  it('marks the parts of an upgrade that changed', () => {
    expect(marked('Moving alone: 50%. Brought along: free.', ['50%', 'free'])).toEqual([
      { text: 'Moving alone: ', changed: false },
      { text: '50%', changed: true },
      { text: '. Brought along: ', changed: false },
      { text: 'free', changed: true },
      { text: '.', changed: false },
    ]);
    expect(marked('Nothing changed.')).toEqual([{ text: 'Nothing changed.', changed: false }]);
  });

  it('the map: three columns above one trailhead, each step higher than the last', () => {
    const m = trailMap(1140, 808);
    expect(m.columns.map((c) => Math.round(c.x))).toEqual([217, 570, 923]);
    for (const c of m.columns) {
      expect(c.nodes[0].y).toBeGreaterThan(c.nodes[1].y);
      expect(c.nodes[1].y).toBeGreaterThan(c.nodes[2].y);
      expect(c.nodes[0].y).toBeLessThan(m.fork.y);
    }
    expect(m.trailhead.y).toBeGreaterThan(m.fork.y);
  });
});
