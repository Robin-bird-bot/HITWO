import { describe, expect, it } from 'vitest';
import { GUTTER, placeWindow, readOffsets, WINDOW_KEY, writeOffsets } from './windowLayout';

// The turn panel's default box in Simple mode.
const TURN = { x: 1240, y: 72, w: 344, h: 600 };

describe('placing a dragged window', () => {
  it('moves by the offset when there’s room', () => {
    expect(placeWindow(TURN, { x: -500, y: 100 })).toEqual({ x: -500, y: 100 });
  });

  it('keeps the window fully on the 1600×1000 stage', () => {
    expect(placeWindow(TURN, { x: 400, y: 900 })).toEqual({
      x: 1600 - 344 - 1240,
      y: 1000 - 600 - 72,
    });
    expect(placeWindow(TURN, { x: -2000, y: -500 })).toEqual({ x: -1240, y: -72 });
  });

  it('snaps to the 16 px gutter when dragged close to an edge', () => {
    // 10 px from the left edge → snaps to the gutter.
    expect(placeWindow(TURN, { x: 10 - 1240, y: 0 })).toEqual({ x: GUTTER - 1240, y: 0 });
    // Top edge 30 px down snaps to the gutter; 40 px down is too far to snap.
    expect(placeWindow(TURN, { x: 0, y: 30 - 72 })).toEqual({ x: 0, y: GUTTER - 72 });
    expect(placeWindow(TURN, { x: 0, y: 40 - 72 })).toEqual({ x: 0, y: 40 - 72 });
  });

  it('can keep a window on the stage without snapping (after it grows)', () => {
    expect(placeWindow(TURN, { x: 10 - 1240, y: 0 }, false)).toEqual({ x: 10 - 1240, y: 0 });
  });
});

describe('remembering window positions', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };

  it('round-trips offsets', () => {
    const storage = memory();
    writeOffsets(storage, { turn: { x: -300, y: 40 }, scavenge: { x: 0, y: -120 } });
    expect(readOffsets(storage)).toEqual({ turn: { x: -300, y: 40 }, scavenge: { x: 0, y: -120 } });
  });

  it('ignores junk and survives storage that throws', () => {
    const storage = memory();
    storage.setItem(WINDOW_KEY, '{"turn": {"x": "far"}, "party": {"x": 5, "y": 6}}');
    expect(readOffsets(storage)).toEqual({ party: { x: 5, y: 6 } });
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    expect(readOffsets(broken)).toEqual({});
    expect(() => writeOffsets(broken, { turn: { x: 1, y: 1 } })).not.toThrow();
  });
});
