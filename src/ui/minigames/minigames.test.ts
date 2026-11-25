/**
 * The minigame parts (Phase 10.8): the GPS upright and turned, the testing
 * tab's remembered settings (the art style among them), and that test mode
 * never reaches the saved hike.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  BEARRELS,
  cleanSettings,
  defaultSettings,
  FIND_OBJECT,
  FIND_PATH,
  MINIGAMES,
  REMEMBER_PATH,
  TRAILDLE,
} from '../../minigames/catalog';
import { minigameHiker } from '../../minigames/hikers';
import type { StorageLike } from '../../store/autosave';
import { AUTOSAVE_KEY } from '../../store/autosave';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';
import {
  DEVICE,
  gpsMotion,
  gpsTransform,
  gpsTurned,
  gpsUpright,
  scanlineMotion,
  styleButtonSpot,
} from './gpsLayout';
import {
  readTestingSettings,
  TESTING_KEY,
  TEST_HIKERS,
  writeTestingSettings,
} from './testingSettings';

const G = BALANCE.minigames.gps;

function fakeStorage(start: Record<string, string> = {}) {
  const data = new Map(Object.entries(start));
  const writes: string[] = [];
  const storage: StorageLike = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
    removeItem: (k) => {
      writes.push(k);
      data.delete(k);
    },
  };
  return { storage, data, writes };
}

const inStage = (r: { left: number; top: number; width: number; height: number }) =>
  r.left >= 0 && r.top >= 0 && r.left + r.width <= STAGE_WIDTH && r.top + r.height <= STAGE_HEIGHT;

describe('the party GPS', () => {
  it('upright, its screen is 3:4', () => {
    expect(DEVICE.screen.w / DEVICE.screen.h).toBeCloseTo(3 / 4);
    expect(DEVICE.height).toBeGreaterThan(DEVICE.width);
  });

  it('desktop: turned, the 4:3 screen fills most of the window (up to 92% wide, 86% tall), all inside', () => {
    const t = gpsTurned(false);
    expect(t.screen.width / t.screen.height).toBeCloseTo(4 / 3);
    expect(t.screen.width).toBeLessThanOrEqual(STAGE_WIDTH * G.maxScreenWidth);
    expect(t.screen.height).toBeLessThanOrEqual(STAGE_HEIGHT * G.maxScreenHeight + 0.01);
    expect(t.screen.height).toBeGreaterThanOrEqual(STAGE_HEIGHT * 0.85);
    expect(inStage(t.screen)).toBe(true);
    expect(inStage(t.body)).toBe(true);
    // Landscape now: the body is wider than tall, and most of the window.
    expect(t.body.width).toBeGreaterThan(t.body.height);
    expect(t.body.width).toBeGreaterThan(STAGE_WIDTH * 0.85);
  });

  it('a phone in landscape: the screen is almost the whole height; the body may run past the edge, the screen never does', () => {
    const t = gpsTurned(true);
    expect(t.screen.height / STAGE_HEIGHT).toBeGreaterThanOrEqual(0.94);
    expect(t.screen.width / t.screen.height).toBeCloseTo(4 / 3);
    expect(inStage(t.screen)).toBe(true);
  });

  it('upright in its pop-up slot: small, and turned back', () => {
    const t = gpsTurned(false);
    const slot = { left: 486, top: 182, width: 430, height: 700 };
    const up = gpsUpright(t, slot);
    expect(up.scale).toBeLessThan(0.6);
    // It fits the slot, nub and all, centered on it.
    expect((DEVICE.height + DEVICE.nub.h) * t.unit * up.scale).toBeLessThanOrEqual(
      slot.height + 0.01,
    );
    expect(DEVICE.width * t.unit * up.scale).toBeLessThanOrEqual(slot.width + 0.01);
    expect(t.center.x + up.dx).toBeCloseTo(slot.left + slot.width / 2);
    expect(gpsTransform('upright', up)).toContain('rotate(0deg)');
    expect(gpsTransform('turned', up)).toContain('rotate(90deg) scale(1)');
  });

  it('turns over 700 ms and back over 500 ms; with reduced motion it crossfades instead', () => {
    expect(gpsMotion(false, 'turned')).toEqual({ kind: 'turn', ms: G.turnMs });
    expect(gpsMotion(false, 'upright')).toEqual({ kind: 'turn', ms: G.returnMs });
    expect(gpsMotion(true, 'turned').kind).toBe('crossfade');
    expect([G.turnMs, G.returnMs]).toEqual([700, 500]);
  });

  it('scanlines drift and a band sweeps across during play; with reduced motion they stay still', () => {
    expect(scanlineMotion(true, false)).toEqual({ drift: true, band: true });
    expect(scanlineMotion(true, true)).toEqual({ drift: false, band: false });
    // Upright in the pop-up they stand still.
    expect(scanlineMotion(false, false)).toEqual({ drift: false, band: false });
    expect(G.scanlines).toMatchObject({ dark: 0.08, everyPx: 3, driftPxPerSec: 10 });
  });

  it('the Style button sits on the turned body, beside the screen, on the stage', () => {
    for (const phone of [false, true]) {
      const t = gpsTurned(phone);
      const spot = styleButtonSpot(t);
      expect(spot.left).toBeGreaterThanOrEqual(10);
      expect(spot.top).toBeGreaterThanOrEqual(10);
      // A 170-wide button ends before the screen starts.
      expect(spot.left + 200).toBeLessThan(t.screen.left);
    }
  });
});

describe('the minigame list', () => {
  it('Bearrels and the four puzzle games play; Ants Are Marching, Cracked Bridge, Fly Swatter and Trail Memory are coming soon', () => {
    expect(MINIGAMES.map((m) => [m.name, m.baseGame, m.status])).toEqual([
      ['Bearrels', 'Barrels', 'ready'],
      ['Traildle', 'Puzzle', 'ready'],
      ['Find the Object', 'Reaction', 'ready'],
      ['Remember the Path', 'Memory', 'ready'],
      ['Find the Path', 'Minefield', 'ready'],
      ['Ants Are Marching', 'Snake', 'soon'],
      ['Cracked Bridge', 'Platformer', 'soon'],
      ['Fly Swatter', 'Reaction', 'soon'],
      ['Trail Memory', 'Memory', 'soon'],
    ]);
  });

  it('the puzzle games: Tier (I, II, III), Hikers, and their overrides, where Auto uses the tier', () => {
    const ids = (info: (typeof MINIGAMES)[number]) => info.settings.map((s) => s.id);
    expect(ids(TRAILDLE)).toEqual(['tier', 'hikers', 'signs', 'timer']);
    expect(ids(FIND_OBJECT)).toEqual(['tier', 'hikers', 'mode']);
    expect(ids(REMEMBER_PATH)).toEqual(['tier', 'hikers']);
    expect(ids(FIND_PATH)).toEqual(['tier', 'hikers', 'fog']);
    expect(defaultSettings(TRAILDLE)).toEqual({
      tier: 1,
      hikers: ['finn', 'ellie', 'mom'],
      signs: 'auto',
      timer: 'auto',
    });
    for (const info of [TRAILDLE, FIND_OBJECT, REMEMBER_PATH, FIND_PATH])
      expect(info.lineUp).toBe(true);
    // A remembered override that isn't an option, or a tier out of range, goes back to the default.
    expect(cleanSettings(TRAILDLE, { signs: '12', tier: 4 }, TEST_HIKERS)).toMatchObject({
      signs: 'auto',
      tier: 1,
    });
    expect(cleanSettings(FIND_PATH, { fog: 'on' }, TEST_HIKERS).fog).toBe('on');
  });

  it('Bearrels’ settings: art style (Detailed pixel), barrels 3–6 (3), rounds 1–5 (3), shots 1 or 2 (1), hikers 1–4 (Finn, Ellie, Mom)', () => {
    expect(BEARRELS.settings[0]).toMatchObject({ kind: 'style', label: 'Art style' });
    expect(defaultSettings(BEARRELS)).toEqual({
      style: 'pixel',
      barrels: 3,
      rounds: 3,
      shots: 1,
      hikers: ['finn', 'ellie', 'mom'],
    });
  });

  it('remembered settings out of range are put back in range', () => {
    expect(
      cleanSettings(
        BEARRELS,
        {
          barrels: 12,
          rounds: -1,
          shots: 3,
          hikers: ['cody', 'finn', 'finn', 'ellie', 'mom', 'wyatt', 'gdog'],
        },
        TEST_HIKERS,
      ),
    ).toEqual({
      style: 'pixel',
      barrels: 6,
      rounds: 1,
      shots: 1,
      hikers: ['finn', 'ellie', 'mom', 'wyatt'],
    });
    // A known style is kept; anything else is Earthy pixel.
    expect(cleanSettings(BEARRELS, { style: 'drawn' }, TEST_HIKERS).style).toBe('drawn');
    // An old style (Earthy, Teal, Silhouette) or anything else: Detailed pixel.
    expect(cleanSettings(BEARRELS, { style: 'teal' }, TEST_HIKERS).style).toBe('pixel');
    expect(cleanSettings(BEARRELS, { style: 3 }, TEST_HIKERS).style).toBe('pixel');
    // No hikers left: back to the default.
    expect(cleanSettings(BEARRELS, { hikers: ['cody'] }, TEST_HIKERS).hikers).toEqual([
      'finn',
      'ellie',
      'mom',
    ]);
  });

  it('each hiker’s color (layout.json); Grandpa Wink is Wink', () => {
    expect(minigameHiker('finn')).toMatchObject({ color: '#E2683C', art: 'finn' });
    expect(minigameHiker('grandpaWink')).toMatchObject({
      name: 'Wink',
      color: '#3FB8B0',
      art: 'wink',
    });
    // A run's party color wins.
    expect(minigameHiker('mom', '#123456').color).toBe('#123456');
    // A future hiker without minigame art gets a plain color.
    expect(minigameHiker('cody').color).toBe('#C9C2B2');
  });
});

describe('test mode never touches the saved hike', () => {
  it('the testing tab remembers its settings under its own key, and nothing else', () => {
    const save = '{"saveVersion":21}';
    const { storage, data, writes } = fakeStorage({ [AUTOSAVE_KEY]: save });
    expect(readTestingSettings(storage, 'bearrels')).toEqual(defaultSettings(BEARRELS));
    const next = {
      style: 'drawn',
      barrels: 5,
      rounds: 2,
      shots: 2,
      hikers: ['wyatt', 'gdog'],
    };
    writeTestingSettings(storage, 'bearrels', next);
    expect(readTestingSettings(storage, 'bearrels')).toEqual(next);
    expect(new Set(writes)).toEqual(new Set([TESTING_KEY]));
    expect(data.get(AUTOSAVE_KEY)).toBe(save);
  });

  it('a broken remembered value falls back to the defaults', () => {
    const { storage } = fakeStorage({ [TESTING_KEY]: 'not json' });
    expect(readTestingSettings(storage, 'bearrels')).toEqual(defaultSettings(BEARRELS));
  });

  it('no minigame code imports the game store or the save', () => {
    const sources = import.meta.glob(
      ['/src/minigames/**/*.{ts,tsx}', '/src/ui/minigames/**/*.{ts,tsx}'],
      {
        query: '?raw',
        import: 'default',
        eager: true,
      },
    ) as Record<string, string>;
    const files = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(8);
    for (const [path, text] of files) {
      expect(text, path).not.toMatch(
        /gameStore|engine\/save'|from '\.\.\/\.\.\/engine'|applyAction/,
      );
    }
  });
});
