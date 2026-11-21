import { describe, expect, it } from 'vitest';
import { TRAITS } from '../../content/traits';
import {
  abilityPeriod,
  effectSourcesFor,
  scavengeModifiers,
  tally,
  workingTrait,
} from '../effects';
import { fixtureGame, fixtureHiker, hiker, run } from '../test/fixtures';
import type { SlotType } from '../types';
import { canAddSlot, familyCanHave, familyVersion, fitsSlot, slotReason } from './slots';

const T = (id: string) => {
  const def = TRAITS[id];
  if (!def) throw new Error(`no trait ${id}`);
  return def;
};

describe('what fits each slot type', () => {
  const cases: [SlotType, string[], string[]][] = [
    ['T', ['leader'], ['forager', 'extrinsic']],
    ['U', ['forager'], ['leader', 'extrinsic']],
    ['M', ['extrinsic'], ['leader', 'forager']],
    ['T/U', ['leader', 'forager'], ['extrinsic']],
    ['T/M', ['leader', 'extrinsic'], ['forager']],
    ['U/M', ['forager', 'extrinsic'], ['leader']],
    ['W', ['leader', 'forager', 'extrinsic'], ['bossGracie']],
    ['tag', ['bossGracie'], ['leader', 'forager', 'extrinsic']],
  ];
  it.each(cases)('%s', (slot, yes, no) => {
    for (const id of yes) expect(fitsSlot(slot, T(id)), id).toBe(true);
    for (const id of no) expect(fitsSlot(slot, T(id)), id).toBe(false);
  });

  it('special and unique traits take a slot like any other', () => {
    expect(fitsSlot('T', T('soldiersMarch'))).toBe(true);
    expect(fitsSlot('M', T('showGirl'))).toBe(true);
  });
});

describe('slot rules', () => {
  const party = () =>
    fixtureGame({ hikers: [fixtureHiker('ash', ['puller', 'forager']), fixtureHiker('birch')] });

  it('no trait twice, counting family versions as the same trait', () => {
    const s = party();
    const ash = hiker(s, 'ash');
    expect(slotReason(ash, 1, T('puller'))).toBe('Ash already has Puller.');
    expect(slotReason(ash, 1, T('leashPuller'))).toBe('Ash already has Leash Puller.');
    expect(slotReason(ash, 0, T('puller'))).toBeNull(); // its own slot
    // A W slot holds any trait.
    expect(slotReason(ash, 0, T('extrinsic'))).toBeNull();
    s.hikers[0]!.slots[0]!.type = 'T';
    expect(slotReason(ash, 0, T('extrinsic'))).toBe('Extrinsic doesn’t fit a T slot.');
  });

  it('at most 6 slots', () => {
    let s = party();
    for (let i = 0; i < 6; i++) {
      s = run(s, { type: 'debug', op: { kind: 'addSlot', hikerId: 'birch', slotType: 'T' } });
    }
    expect(hiker(s, 'birch').slots).toHaveLength(6);
    expect(canAddSlot(hiker(s, 'birch'))).toBe(false);
  });
});

describe('family versions', () => {
  it('a hiker gets the version for their family', () => {
    expect(familyVersion(T('puller'), 'dog').id).toBe('leashPuller');
    expect(familyVersion(T('puller'), 'human').id).toBe('puller');
    expect(familyVersion(T('glutton'), 'dog').id).toBe('humanFood');
    expect(familyVersion(T('copier'), 'cat').id).toBe('copycat');
    expect(familyVersion(T('copier'), 'dog').id).toBe('copydog');
    expect(familyVersion(T('copier'), 'plush').id).toBe('copier');
    expect(familyVersion(T('leader'), 'dog').id).toBe('leader');
  });

  it('family traits are only for their families; Plush aren’t pets', () => {
    expect(familyCanHave(T('herder'), 'dog')).toBe(true);
    expect(familyCanHave(T('herder'), 'human')).toBe(false);
    expect(familyCanHave(T('loyal'), 'cat')).toBe(true);
    expect(familyCanHave(T('loyal'), 'plush')).toBe(false);
    expect(familyCanHave(T('leader'), 'plush')).toBe(true);
  });
});

describe('settings and daily traits', () => {
  it('a trait’s setting is kept on the hiker and names it', () => {
    const s = fixtureGame({
      hikers: [fixtureHiker('ash', ['finder:river', 'location:river/mountain'])],
    });
    const [finder, location] = hiker(s, 'ash').slots.map((slot) => workingTrait(s, slot));
    expect(finder?.name).toBe('River Finder');
    expect(location?.name).toBe('Location (River / Mountain)');
    expect(T('finder').textWith?.({ x: 'river' })).toBe(
      'Higher chance of drawing River resources when scavenging.',
    );
  });

  it('Quirky runs today’s trait, and only today', () => {
    let s = fixtureGame({ hikers: [fixtureHiker('ash', ['quirky'])] });
    s = run(s, {
      type: 'debug',
      op: { kind: 'setDaily', hikerId: 'ash', slot: 0, pick: 'forager' },
    });
    const ash = hiker(s, 'ash');
    expect(workingTrait(s, ash.slots[0]!)?.name).toBe('Quirky (Forager)');
    const labels = scavengeModifiers(s, ash, { tileId: ash.tileId, phase: 'morning' }).map(
      (m) => m.label,
    );
    expect(labels).toContain('Forager: 1 extra card to choose from');
    // The next day it's no longer Forager.
    s = run(s, { type: 'debug', op: { kind: 'setDayParity', odd: false } });
    expect(workingTrait(s, hiker(s, 'ash').slots[0]!)?.name).toBe('Quirky');
  });

  it('Nosework’s pick is its node for the day', () => {
    let s = fixtureGame({ hikers: [fixtureHiker('ash', ['nosework'])] });
    s = run(s, {
      type: 'debug',
      op: { kind: 'setDaily', hikerId: 'ash', slot: 0, pick: 'mountain' },
    });
    expect(workingTrait(s, hiker(s, 'ash').slots[0]!)?.setting).toEqual({ x: 'mountain' });
  });

  it('a hiker’s working traits are hook sources with their names', () => {
    const s = fixtureGame({ hikers: [fixtureHiker('ash', ['finder:forest'])] });
    const names = effectSourcesFor(s, hiker(s, 'ash'))
      .filter((x) => x.kind === 'trait')
      .map((x) => x.name);
    expect(names).toEqual(['Forest Finder']);
  });
});

describe('uses come back on schedule', () => {
  it('per phase, per day and per biome (a section of the trail)', () => {
    const s = fixtureGame();
    const ash = hiker(s, 'ash');
    for (const per of ['phase', 'day', 'biome'] as const) tally(s, ash, per, 1, per);
    s.phase = 'afternoon';
    expect(tally(s, ash, 'phase', 0, 'phase')).toBe(0);
    expect(tally(s, ash, 'day', 0, 'day')).toBe(1);
    s.day += 1;
    expect(tally(s, ash, 'day', 0, 'day')).toBe(0);
    expect(tally(s, ash, 'biome', 0, 'biome')).toBe(1);
    s.sectionIndex += 1;
    expect(tally(s, ash, 'biome', 0, 'biome')).toBe(0);
    expect(abilityPeriod(s, 'biome')).toBe('section 1');
  });

  it('the debug panel brings them all back', () => {
    let s = fixtureGame({ hikers: [fixtureHiker('ash', ['stoic'])] });
    s = run(s, { type: 'useAbility', hikerId: 'ash', abilityId: 'stoic', choice: 'energy' });
    expect(hiker(s, 'ash').abilityUses.stoic).toBeDefined();
    s = run(s, { type: 'debug', op: { kind: 'refillUses', hikerId: 'ash' } });
    expect(hiker(s, 'ash').abilityUses).toEqual({});
  });
});
