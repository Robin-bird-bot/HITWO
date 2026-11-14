import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { RESOURCES } from '../content/resources';
import { resourceCount } from './inventory';
import { createGame } from './newGame';
import { fixtureHiker, fixtureSection } from './test/fixtures';

const party = () => ['ash', 'birch', 'cedar', 'dot'].map((id) => fixtureHiker(id));

describe('starting resources', () => {
  it('a new run gives each hiker 4 random resources, the same for the same seed', () => {
    const a = createGame({ seed: 12, section: fixtureSection(), hikers: party() });
    const b = createGame({ seed: 12, section: fixtureSection(), hikers: party() });
    const ids = new Set(RESOURCES.map((r) => r.id));
    for (const h of a.hikers) {
      expect(resourceCount(h)).toBe(BALANCE.inventory.startingResources);
      expect(Object.keys(h.inventory.resources).every((id) => ids.has(id))).toBe(true);
    }
    expect(a.hikers.map((h) => h.inventory.resources)).toEqual(
      b.hikers.map((h) => h.inventory.resources),
    );
  });

  it('picks from every type, duplicates allowed', () => {
    const seen = new Set<string>();
    let doubles = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = createGame({ seed, section: fixtureSection(), hikers: party() });
      for (const h of s.hikers) {
        for (const [id, n] of Object.entries(h.inventory.resources)) {
          seen.add(id);
          if ((n ?? 0) > 1) doubles += 1;
        }
      }
    }
    expect(seen.size).toBe(RESOURCES.length);
    expect(doubles).toBeGreaterThan(0);
  });

  it('fills only up to the resource limit', () => {
    const full = { ...fixtureHiker('ash'), inventory: { resources: { wood: 8 } } };
    const s = createGame({ seed: 3, section: fixtureSection(), hikers: [full] });
    expect(resourceCount(s.hikers[0]!)).toBe(BALANCE.inventory.resourceLimit);
  });

  it('can be turned off (tests)', () => {
    const s = createGame({
      seed: 3,
      section: fixtureSection(),
      hikers: party(),
      startingResources: false,
    });
    expect(s.hikers.every((h) => resourceCount(h) === 0)).toBe(true);
  });
});
