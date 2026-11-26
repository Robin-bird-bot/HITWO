/**
 * Every game's pop-up content (docs/design/20-challenge-popup.md, sections
 * 6 to 8): each playable game has How to play (with its red phrase),
 * Controls, bars and Prepare; the bars show the tier's value and every
 * Prepare change; per-hiker rows have their per-hiker values.
 */
import { describe, expect, it } from 'vitest';
import { MINIGAMES } from '../catalog';
import { defaultSettings } from '../catalog';
import { applyPrepare, rowsFor, slotsFor, type Fills } from '../prepare';
import { POPUPS } from './index';

const READY = MINIGAMES.filter((m) => m.status === 'ready');
const HIKERS = ['finn', 'mom', 'ellie'];

describe('every game’s pop-up content', () => {
  it('every playable game has it, and nothing else does', () => {
    expect(Object.keys(POPUPS).sort()).toEqual(READY.map((m) => m.id).sort());
  });

  it.each(READY.map((m) => [m.name, m] as const))(
    '%s: How to play with one red phrase, real controls, bars and Prepare rows',
    (_, info) => {
      const popup = POPUPS[info.id]!;
      for (const tier of [1, 3, 5]) {
        const s = { ...defaultSettings(info), tier };
        const how = popup.howToPlay(s);
        expect(how.filter((p) => p.red)).toHaveLength(1);
        // Short enough for the left column (2 to 4 short sentences).
        expect(how.map((p) => p.text).join('').length).toBeLessThan(260);
        expect(popup.controls.length).toBeGreaterThan(0);
        for (const c of popup.controls) expect(c.inputs.length).toBeGreaterThan(0);
        const bars = popup.bars(s);
        expect(bars.length).toBeGreaterThan(0);
        for (const b of bars) {
          expect(b.base).toBe(b.value);
          expect(b.max).toBeGreaterThanOrEqual(Math.min(b.value, b.max));
          expect(Number.isFinite(b.base)).toBe(true);
        }
        const rows = popup.prepare(s);
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          expect(r.accepts.length).toBeGreaterThan(0);
          expect(r.label).toBe(r.label.toUpperCase());
        }
      }
    },
  );

  it.each(READY.map((m) => [m.name, m] as const))(
    '%s: filling every slot changes the bars, always toward easier, in green',
    (_, info) => {
      const popup = POPUPS[info.id]!;
      const s = { ...defaultSettings(info), tier: 3, hikers: HIKERS };
      const slots = slotsFor(rowsFor(popup.prepare(s), s), HIKERS);
      const fills: Fills = Object.fromEntries(
        slots.map((sl) => [sl.key, { hiker: 'finn', thing: sl.row.accepts[0]! }]),
      );
      const after = applyPrepare(s, slots, fills);
      const before = popup.bars(s);
      const changed = popup.bars(after);
      expect(changed.map((b) => b.id)).toEqual(before.map((b) => b.id));
      changed.forEach((b, k) => expect(b.base).toBe(before[k]!.base));
      // Per-hiker values grow with their row.
      const per = popup.perHiker?.(after);
      if (per) expect(slots.some((sl) => sl.row.id === per.row && sl.row.perHiker)).toBe(true);
    },
  );

  it('Dodge: the prototype’s rows by animal; the Woods Monster only allows +1 HEART', () => {
    const ids = (animal: string) =>
      rowsFor(POPUPS.dodge!.prepare({ animal, tier: 2 }), { animal, tier: 2 }).map((r) => r.id);
    expect(ids('bees')).toEqual(['lives', 'slower', 'smoke']);
    expect(ids('gunBear')).toEqual(['lives', 'slower', 'bearSpray', 'sandbags']);
    expect(ids('ants')).toEqual(['lives', 'slower', 'salt']);
    expect(ids('monster')).toEqual(['lives']);
    const s = { animal: 'bees', tier: 2 };
    const slots = slotsFor(rowsFor(POPUPS.dodge!.prepare(s), s), HIKERS);
    const fills: Fills = {
      'slower:0': { hiker: 'mom', thing: { kind: 'resource', id: 'fish' } },
      'smoke:0': { hiker: 'mom', thing: { kind: 'resource', id: 'grass' } },
    };
    const bars = POPUPS.dodge!.bars(applyPrepare(s, slots, fills));
    expect(bars.find((b) => b.id === 'speed')).toMatchObject({ base: 5, value: 4, max: 10 });
    expect(bars.find((b) => b.id === 'bees')!.value).toBe(
      bars.find((b) => b.id === 'bees')!.base - 1,
    );
  });
});
