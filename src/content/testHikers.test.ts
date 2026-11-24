import { describe, expect, it } from 'vitest';
import { createGame, deserialize, SAVE_VERSION, serialize } from '../engine';
import { fixtureGame, fixtureHiker } from '../engine/test/fixtures';
import { fitsSlot } from '../engine/traits/slots';
import { characterFor, STARTING_PARTY } from './characters';
import { TEST_HIKERS } from './testHikers';
import { TRAITS } from './traits';

describe('test hikers (Nov 20 update, section 7)', () => {
  it('are the 11 from the update, each with traits that exist and fit their slots', () => {
    expect(TEST_HIKERS.map((h) => h.name)).toEqual([
      'Test Leader',
      'Test Hardy',
      'Test Scavenger',
      'Test Crafter',
      'Test Scout',
      'Test Support',
      'Test Merchant',
      'Test Cat',
      'Test Plush',
      'Test Duo',
      'Test Wild',
    ]);
    for (const h of TEST_HIKERS) {
      expect(h.classes?.length, h.name).toBeGreaterThan(0);
      for (const slot of h.slots) {
        if (!slot.traitId) continue;
        const def = TRAITS[slot.traitId];
        expect(def, `${h.name}: ${slot.traitId}`).toBeDefined();
        if (def) expect(fitsSlot(slot.type, def), `${h.name}: ${def.name}`).toBe(true);
      }
    }
  });

  it('have no art: initials on their color, and never join the starting party', () => {
    for (const h of TEST_HIKERS) {
      expect(h.test).toBe(true);
      expect(h.placeholder).toBe(true);
      expect(characterFor(h.id)).toMatchObject({ portrait: 'initials', color: h.color });
      expect(STARTING_PARTY.some((c) => c.id === h.id)).toBe(false);
    }
  });

  it('start a hike like any hiker, keeping their classes, settings and Duo', () => {
    const s = createGame({ seed: 4, hikers: TEST_HIKERS.slice(0, 4) });
    expect(s.hikers.map((h) => h.classes)).toEqual([
      ['leader'],
      ['hardy'],
      ['scavenger'],
      ['crafter'],
    ]);
    expect(s.hikers[2]?.slots[2]).toMatchObject({ traitId: 'finder', setting: { x: 'river' } });
    expect(s.hikers.every((h) => h.test)).toBe(true);
    const duo = createGame({ seed: 4, hikers: TEST_HIKERS.filter((h) => h.duo) });
    expect(duo.hikers[0]?.duo).toEqual(['Boss', 'Gracie']);
  });
});

describe('saves from before Phase 10a (v14 → v15)', () => {
  function v14(): string {
    const old = JSON.parse(
      serialize(
        fixtureGame({
          hikers: [
            { ...fixtureHiker('hiker-1', ['riverFinder', 'leader']), family: 'human' },
            fixtureHiker('birch', ['rockHound']),
          ],
        }),
      ),
    ) as { saveVersion: number; hikers: Record<string, unknown>[] };
    old.saveVersion = 14;
    for (const h of old.hikers) delete h.classes;
    return JSON.stringify(old);
  }

  it('gives hikers their character’s classes, and the old Finders and Hounds their node', () => {
    const loaded = deserialize(v14());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const [first, birch] = loaded.state.hikers;
    expect(first?.classes).toEqual(['leader']);
    expect(birch?.classes).toEqual([]);
    expect(first?.slots[0]).toMatchObject({ traitId: 'finder', setting: { x: 'river' } });
    expect(first?.slots[1]).toMatchObject({ traitId: 'leader' });
    expect(birch?.slots[0]).toMatchObject({ traitId: 'hound', setting: { x: 'mountain' } });
    expect(loaded.state.saveVersion).toBe(SAVE_VERSION);
  });
});
