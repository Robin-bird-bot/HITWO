/**
 * Skill Trails and party points (Phase 10.7, 09-hikers.md "The system").
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { HIKER_TREES, STEPS } from '../content/trails/trees';
import { TRAITS } from '../content/traits';
import { validateAction } from './applyAction';
import { deserialize, serialize } from './save';
import { givePoints, hiker, run, toNight, trailGame } from './test/fixtures';
import { heldTraits, learnReason, stepCost, toggleOn } from './trails';
import type { Action } from './types';

const B = BALANCE.trails;
const learn = (hikerId: string, stepId: string): Action => ({ type: 'learnStep', hikerId, stepId });

describe('the trees', () => {
  it('6 hikers, 3 trees each, 3 steps each: 54 steps, each one a trait', () => {
    expect(HIKER_TREES.map((h) => h.hikerId).sort()).toEqual(
      ['ellie', 'finn', 'gdog', 'grandpaWink', 'mom', 'wyatt'].sort(),
    );
    expect(STEPS.size).toBe(54);
    for (const { step } of STEPS.values()) {
      expect(TRAITS[step.id]?.name, step.id).toBe(step.name);
      // An upgrade replaces a step in its own tree, below it.
      if (step.upgrades) {
        const up = STEPS.get(step.upgrades);
        expect(up?.tree, step.id).toBe(STEPS.get(step.id)?.tree);
        expect(up!.step.tier, step.id).toBeLessThan(step.tier);
      }
      // Every changed part is in the text, so it can be shown in yellow.
      const text = `${step.text ?? ''} ${step.on ?? ''} ${step.off ?? ''}`;
      for (const part of step.changed ?? []) expect(text, step.id).toContain(part);
      // No [brackets] or code words in player text.
      expect(text, step.id).not.toMatch(/[[\]]/);
    }
  });

  it('tree names: the class plus Trail, Path or Loop', () => {
    const finn = HIKER_TREES.find((h) => h.hikerId === 'finn')!;
    expect(finn.trees.map((t) => t.name)).toEqual([
      'Leader Trail',
      'Follower Trail',
      'Scavenger Path',
    ]);
    const ellie = HIKER_TREES.find((h) => h.hikerId === 'ellie')!;
    expect(ellie.trees.map((t) => t.name)).toEqual([
      'Chef Path',
      'Scavenger Path',
      'Entertainer Loop',
    ]);
  });
});

describe('starting a run', () => {
  it('each hiker starts with the Tier 1 trait picked, free, and their morale type', () => {
    const s = trailGame([['finn', 'finn-scavenger'], 'ellie']);
    expect(hiker(s, 'finn').trails).toEqual({ learned: ['finn-scavenger-t1'] });
    expect(hiker(s, 'finn').slots).toEqual([{ type: 'trail', traitId: 'finn-scavenger-t1' }]);
    expect(hiker(s, 'finn').moraleType).toBe('extrovert');
    // No pick: the first tree.
    expect(hiker(s, 'ellie').trails?.learned).toEqual(['ellie-chef-t1']);
    expect(hiker(s, 'ellie').moraleType).toBe('foody');
    expect(s.party).toEqual({ xp: 0, level: 0, points: 0 });
  });
});

describe('costs and unlocks', () => {
  it('Tier 2 costs 1, Tier 3 costs 2, opening another tree costs 2; a step can set its own', () => {
    const step = (id: string) => STEPS.get(id)!.step;
    expect(stepCost(step('finn-leader-t2'))).toBe(B.cost.tier2);
    expect(stepCost(step('finn-leader-t3'))).toBe(B.cost.tier3);
    expect(stepCost(step('finn-follower-t1'))).toBe(B.cost.openTree);
    expect(stepCost({ ...step('finn-leader-t2'), cost: 5 })).toBe(5);
  });

  it('a step needs the one below it, the party level, the points, and night or a station', () => {
    let s = trailGame(['finn']);
    const finn = () => hiker(s, 'finn');
    expect(learnReason(s, finn(), 'finn-leader-t3')).toBe('Learn Leash Puller II first.');
    expect(learnReason(s, finn(), 'finn-leader-t2')).toBe(`Needs party level ${B.unlockLevel[2]}.`);
    givePoints(s, B.unlockLevel[2], 0);
    expect(learnReason(s, finn(), 'finn-leader-t2')).toBe('Needs 1 point.');
    givePoints(s, B.unlockLevel[2], 3);
    // By day the window plans, but Learn waits.
    expect(learnReason(s, finn(), 'finn-leader-t2')).toBe('Learn at night or at a ranger station.');
    expect(learnReason(s, finn(), 'finn-leader-t2', { anyTime: true })).toBeUndefined();
    s = toNight(s);
    expect(validateAction(s, learn('finn', 'finn-leader-t2'))).toBeNull();
    s = run(s, learn('finn', 'finn-leader-t2'));
    expect(s.party?.points).toBe(3 - B.cost.tier2);
    expect(learnReason(s, finn(), 'finn-leader-t2')).toBe('Already learned.');
    // Tier 3 needs party level 4.
    expect(learnReason(s, finn(), 'finn-leader-t3')).toBe(`Needs party level ${B.unlockLevel[3]}.`);
    // Another tree's Tier 1: any level, 2 points.
    expect(validateAction(s, learn('finn', 'finn-follower-t1'))).toBeNull();
  });

  it('a hiker can only learn their own steps', () => {
    const s = givePoints(toNight(trailGame(['finn', 'ellie'])), 9, 9);
    expect(validateAction(s, learn('finn', 'ellie-chef-t2'))).toBe('Finn can’t learn that.');
  });
});

describe('upgrades and toggles', () => {
  it('an upgrade replaces the trait it upgrades: one badge', () => {
    let s = givePoints(toNight(trailGame(['ellie'])), 4, 9);
    s = run(
      s,
      learn('ellie', 'ellie-entertainer-t1'),
      learn('ellie', 'ellie-entertainer-t2'),
      learn('ellie', 'ellie-entertainer-t3'),
    );
    // Singer II took Singer's place; Loud stays.
    expect(heldTraits(hiker(s, 'ellie'))).toEqual([
      'ellie-chef-t1',
      'ellie-entertainer-t3',
      'ellie-entertainer-t2',
    ]);
    expect(hiker(s, 'ellie').slots.map((x) => x.traitId)).toEqual(heldTraits(hiker(s, 'ellie')));
  });

  it('a toggle starts on, switches for free on the hiker’s turn, and stays switched when upgraded', () => {
    let s = trailGame(['finn']);
    expect(toggleOn(hiker(s, 'finn'), 'finn-leader-t1')).toBe(true);
    s = run(s, { type: 'toggleTrait', hikerId: 'finn', traitId: 'finn-leader-t1' });
    expect(toggleOn(hiker(s, 'finn'), 'finn-leader-t1')).toBe(false);
    expect(hiker(s, 'finn').acted).toBe(false);
    s = givePoints(toNight(s), 2, 1);
    s = run(s, learn('finn', 'finn-leader-t2'));
    expect(toggleOn(hiker(s, 'finn'), 'finn-leader-t2')).toBe(false);
    s = run(s, { type: 'toggleTrait', hikerId: 'finn', traitId: 'finn-leader-t2' });
    expect(toggleOn(hiker(s, 'finn'), 'finn-leader-t2')).toBe(true);
    // Only a toggle the hiker holds.
    expect(
      validateAction(s, { type: 'toggleTrait', hikerId: 'finn', traitId: 'finn-follower-t1' }),
    ).toBe('Finn doesn’t have that switch.');
  });
});

describe('saves', () => {
  it('trails, toggles and the party bar survive a reload', () => {
    let s = trailGame(['finn', 'mom']);
    s = run(s, { type: 'toggleTrait', hikerId: 'finn', traitId: 'finn-leader-t1' });
    givePoints(s, 3, 2);
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state).toEqual(s);
  });

  it('a v20 save: the 6 keep their first tree’s Tier 1, and the party level comes from all XP', () => {
    const s = trailGame(['finn', 'mom']);
    const old = JSON.parse(serialize(s));
    old.saveVersion = 20;
    delete old.party;
    for (const h of old.hikers) {
      delete h.trails;
      delete h.moraleType;
      h.slots = [{ type: 'T', traitId: 'leader' }];
      h.classes = ['leader'];
      h.pendingLevels = 1;
    }
    old.hikers[0].xp = 30;
    old.hikers[1].xp = 25;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const [finn, mom] = loaded.state.hikers;
    expect(finn).toMatchObject({
      trails: { learned: ['finn-leader-t1'] },
      slots: [{ type: 'trail', traitId: 'finn-leader-t1' }],
      moraleType: 'extrovert',
      classes: ['leader', 'follower', 'scavenger'],
    });
    expect(finn?.pendingLevels).toBeUndefined();
    expect(mom?.trails?.learned).toEqual(['mom-support-t1']);
    expect(loaded.state.party).toEqual({ xp: 55, level: 2, points: 2 * B.pointsPerLevel });
  });

  it('a v20 save with a locked hiker carries on: they keep their old traits', () => {
    const s = trailGame(['finn']);
    const old = JSON.parse(serialize(s));
    old.saveVersion = 20;
    old.hikers.push({
      ...old.hikers[0],
      id: 'cody',
      name: 'Cody',
      characterId: 'cody',
      slots: [{ type: 'T', traitId: 'alphaDog' }],
    });
    for (const h of old.hikers) delete h.trails;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.hikers[1]?.slots).toEqual([{ type: 'T', traitId: 'alphaDog' }]);
    expect(loaded.state.hikers[1]?.trails).toBeUndefined();
  });
});
