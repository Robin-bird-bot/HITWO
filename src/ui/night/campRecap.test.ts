import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../../engine';
import { fixtureGame, hiker, run } from '../../engine/test/fixtures';
import { gainXp, loseXp } from '../../engine/xp';
import { describeLog } from '../log/describeLog';
import { shownProgress } from '../trails/partyProgress';
import { barTicks, campTimeline, recapPlan, xpPerTick } from './campRecap';
import { BALANCE } from '../../config/balance';

const C = BALANCE.ui.overhaul.camp;

/** A day's XP: two lucky scavenges, a craft, one challenge passed by two hikers, a checkpoint. */
function busyDay() {
  const s = structuredClone(fixtureGame());
  const ash = hiker(s, 'ash');
  const birch = hiker(s, 'birch');
  gainXp(s, ash, 2, 'scavenge', 'A lucky draw');
  gainXp(s, ash, 2, 'craft', 'Crafted Trowel');
  gainXp(s, birch, 2, 'scavenge', 'A lucky draw');
  gainXp(s, ash, 3, 'challenge', 'Blisters');
  gainXp(s, birch, 3, 'challenge', 'Blisters');
  gainXp(s, birch, 4, 'checkpoint', 'Reached the checkpoint', { quiet: true });
  return s;
}

describe('the night camp recap (35-ui-overhaul.md, section 7)', () => {
  it('groups the XP since the last recap into lines that add up', () => {
    const plan = recapPlan(busyDay());
    expect(plan.lines.map((l) => [l.text, l.xp])).toEqual([
      ['Scavenged 2 times', 4],
      ['Crafted Trowel', 2],
      ['Passed Blisters', 6],
      ['Reached the checkpoint', 4],
    ]);
    expect(plan.lines.reduce((n, l) => n + l.xp, 0)).toBe(plan.total);
    expect(plan.total).toBe(16);
  });

  it('logs a quiet gain for the recap but leaves it out of the trail log', () => {
    const s = busyDay();
    const quiet = s.log.findLast((e) => e.kind === 'xp');
    expect(quiet).toMatchObject({ kind: 'xp', source: 'checkpoint', quiet: true, xp: 4 });
    expect(describeLog(s).some((l) => l.id === quiet?.id)).toBe(false);
  });

  it('starts from the last recap, and the pill shows the bar as the recap left it', () => {
    let s = run(busyDay(), { type: 'campRecap' });
    expect(recapPlan(s).lines).toEqual([]);
    expect(recapPlan(s).total).toBe(0);
    s = structuredClone(s);
    gainXp(s, hiker(s, 'ash'), 10, 'wonder', 'Blue Pool');
    const plan = recapPlan(s);
    expect(plan.lines.map((l) => [l.text, l.xp])).toEqual([['Found Blue Pool', 10]]);
    // 26 XP is party level 1 (20): the pill still shows level 0 and no new points.
    expect(s.party?.level).toBe(1);
    expect(shownProgress(s)).toMatchObject({ level: 0, points: 0 });
    expect(plan.levels).toEqual([1]);
    s = run(s, { type: 'campRecap' });
    expect(shownProgress(s)).toMatchObject({ level: 1, points: 1 });
  });

  it('counts XP lost as a line, so the lines still add up', () => {
    const s = structuredClone(run(busyDay(), { type: 'campRecap' }));
    gainXp(s, hiker(s, 'ash'), 3, 'challenge', 'Bees');
    loseXp(s, hiker(s, 'ash'), 5);
    const plan = recapPlan(s);
    expect(plan.lines.map((l) => [l.text, l.xp])).toEqual([
      ['Passed Bees', 3],
      ['XP lost', -5],
    ]);
    expect(plan.lines.reduce((n, l) => n + l.xp, 0)).toBe(plan.total);
  });

  it('plays one level-up for one level and two for two, with the engine’s points', () => {
    for (const [xp, levels] of [
      [25, [1]],
      [55, [1, 2]],
      [12, []],
    ] as const) {
      const s = structuredClone(fixtureGame());
      gainXp(s, hiker(s, 'ash'), xp, 'checkpoint', 'Reached the checkpoint');
      const plan = recapPlan(s);
      const ticks = barTicks(plan);
      expect(plan.levels).toEqual(levels);
      expect(ticks.filter((t) => t.levelUp).map((t) => t.levelUp)).toEqual(levels);
      expect(ticks.at(-1)?.xp).toBe(xp);
      expect(plan.points).toBe(s.party?.points);
      const steps = campTimeline(plan, ticks);
      expect(steps.filter((t) => t.sound?.id === 'levelUp')).toHaveLength(levels.length);
      expect(steps.filter((t) => t.kind === 'chips')).toHaveLength(levels.length ? 1 : 0);
      // Tier II opens at party level 2.
      expect(plan.opened).toEqual(levels.length === 2 ? [2] : []);
    }
  });

  it('fills one XP a tick, or several when one at a time would take over 3 s', () => {
    expect(xpPerTick(20)).toBe(1);
    expect(xpPerTick(Math.floor(C.maxFillMs / C.tickMs))).toBe(1);
    expect(xpPerTick(100)).toBe(Math.ceil((100 * C.tickMs) / C.maxFillMs));
    const plan = { from: { xp: 0, level: 0 }, to: { xp: 100, level: 3 } };
    const ticks = barTicks(plan);
    const fills = ticks.filter((t) => !t.levelUp);
    // It stops at each level's end, so no level is skipped over.
    expect(fills.filter((t) => t.fill === 1).map((t) => t.xp)).toEqual([20, 50, 90]);
    expect(ticks.at(-1)?.xp).toBe(100);
  });

  it('brings the lines in 0.42 s apart, then the bar one tick at a time', () => {
    const plan = recapPlan(busyDay());
    const steps = campTimeline(plan, barTicks(plan));
    const lines = steps.filter((t) => t.kind === 'line').map((t) => t.at);
    expect(lines).toEqual(plan.lines.map((_, i) => C.startMs + i * C.lineGapMs));
    const ticks = steps.filter((t) => t.kind === 'tick');
    expect(ticks[1]!.at - ticks[0]!.at).toBe(C.tickMs);
    expect(steps.at(-1)?.kind).toBe('done');
  });

  it('skips the animation with reduced motion: everything at once, one jingle', () => {
    const s = structuredClone(fixtureGame());
    gainXp(s, hiker(s, 'ash'), 55, 'checkpoint', 'Reached the checkpoint');
    const plan = recapPlan(s);
    const steps = campTimeline(plan, barTicks(plan), { reduced: true });
    expect(steps.every((t) => t.at === 0)).toBe(true);
    expect(steps.filter((t) => t.sound).map((t) => t.sound?.id)).toEqual(['levelUp']);
    expect(steps.filter((t) => t.kind === 'levelUp')).toHaveLength(2);
    expect(steps.at(-1)?.kind).toBe('done');
  });

  it('keeps the recap mark in the save, and an older save starts it at the bar', () => {
    const s = run(busyDay(), { type: 'campRecap' });
    const back = deserialize(serialize(s));
    expect(back.ok && back.state.party?.recap).toEqual(s.party?.recap);
    const old = JSON.parse(serialize(busyDay())) as Record<string, unknown>;
    old.saveVersion = 25;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok && loaded.state.party?.recap).toEqual({
      xp: 16,
      level: 0,
      eventId: loaded.ok ? loaded.state.nextEventId : -1,
    });
  });
});
