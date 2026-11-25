/**
 * Sleeping Bear (docs/design/14-minigames-trail-blocks.md, section 6):
 * caught after the grace, safe during a stir, the clock, fake-outs, and
 * crossing.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { newSleepingBear, result, tick, type SleepingBearState } from './logic';

const SB = BALANCE.minigames.sleepingBear;
const THREE = ['finn', 'mom', 'ellie'];
const DT = 1 / 60;

const run = (s0: SleepingBearState, sec: number, holding: boolean) => {
  let s = s0;
  for (let t = 0; t < sec - 1e-9 && !s.over; t += DT) s = tick(s, DT, holding);
  return s;
};

describe('the bear', () => {
  it('moving while he stirs is fine', () => {
    const s0 = { ...newSleepingBear({ tier: 1 }, THREE, 1), bear: 'stir' as const, bearLeft: 0.5 };
    const s = run(s0, 0.4, true);
    expect(s.status.finn).toBe('sneaking');
    expect(s.pos).toBeGreaterThan(0);
  });

  it('moving in the grace after his eyes open is fine; moving after it is caught', () => {
    const awake = {
      ...newSleepingBear({ tier: 1 }, THREE, 1),
      bear: 'awake' as const,
      bearLeft: 2,
      awakeFor: 0,
    };
    const quick = run(awake, SB.graceSec - 0.03, true);
    expect(quick.status.finn).toBe('sneaking');
    const caught = run(awake, SB.graceSec + 0.05, true);
    expect(caught.status.finn).toBe('caught');
    expect(caught.bear).toBe('roar');
    // Standing still while he's awake is safe.
    expect(run(awake, 1, false).status.finn).toBe('sneaking');
    // After the roar, the next hiker starts from the post.
    const next = run(caught, SB.roarSec + 0.05, false);
    expect(next.status.mom).toBe('sneaking');
    expect(next.pos).toBe(0);
  });

  it('fake-outs never wake him; with fake-outs off, every stir wakes him', () => {
    let s = newSleepingBear({ tier: 3, fakeOuts: 'on' }, THREE, 2);
    let fakes = 0;
    let wakes = 0;
    for (let i = 0; i < 60 * 120; i++) {
      const prev = s;
      s = tick({ ...s, clock: 999 }, DT, false);
      if (prev.bear === 'stir' && s.bear !== 'stir') {
        if (prev.fake) {
          fakes++;
          expect(s.bear).toBe('asleep');
        } else {
          wakes++;
          expect(s.bear).toBe('awake');
        }
      }
    }
    expect(fakes).toBeGreaterThan(3);
    expect(wakes).toBeGreaterThan(3);
    let off = newSleepingBear({ tier: 3, fakeOuts: 'off' }, THREE, 2);
    for (let i = 0; i < 60 * 60; i++) {
      off = tick({ ...off, clock: 999 }, DT, false);
      expect(off.fake).toBe(false);
    }
    expect(newSleepingBear({ tier: 1 }, THREE, 1).fakeOut).toBe(0);
  });
});

describe('the clock and crossing', () => {
  it.each([1, 2, 3] as const)('Tier %i: the clock is the time per hiker × hikers', (tier) => {
    expect(newSleepingBear({ tier }, THREE, 1).clock).toBe(SB.tiers[tier].secPerHiker * 3);
  });

  it('walking the whole path while he sleeps crosses, and the next hiker goes', () => {
    const s0 = { ...newSleepingBear({ tier: 1 }, THREE, 3), bearLeft: 999 };
    const s = run(s0, SB.path / SB.speed + 0.1, true);
    expect(s.status.finn).toBe('across');
    expect(s.status.mom).toBe('sneaking');
  });

  it('when the clock runs out, everyone not across fails and loses energy; across moves on', () => {
    let s = { ...newSleepingBear({ tier: 2 }, THREE, 4), bearLeft: 999 };
    s = run(s, SB.path / SB.speed + 0.1, true);
    s = { ...s, clock: 0.05 };
    s = run(s, 0.2, false);
    expect(s.over).toBe(true);
    expect(s.status).toEqual({ finn: 'across', mom: 'timeout', ellie: 'timeout' });
    const r = result(s);
    expect(r.passing).toEqual({ moveOn: ['finn'], goBack: ['mom', 'ellie'], stays: false });
    expect(r.pays).toEqual({
      mom: { energy: SB.timeOutEnergy },
      ellie: { energy: SB.timeOutEnergy },
    });
  });

  it('caught hikers lose a resource and gain Bleeding; nobody across leaves it face up', () => {
    const s: SleepingBearState = {
      ...newSleepingBear({ tier: 3 }, ['finn', 'mom'], 5),
      status: { finn: 'caught', mom: 'timeout' },
      over: true,
    };
    const r = result(s);
    expect(r.passing?.stays).toBe(true);
    expect(r.pays?.finn).toEqual({
      resources: SB.caught.resources,
      conditions: ['bleeding'],
      energy: BALANCE.minigames.passing.nobodyEnergy[3],
    });
  });
});
