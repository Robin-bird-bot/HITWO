/**
 * The minigame parts (Phase 10.8): the GPS's lifted size, the testing tab's
 * remembered settings, and that test mode never reaches the saved hike.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { BEARRELS, cleanSettings, defaultSettings, MINIGAMES } from '../../minigames/catalog';
import { minigameHiker } from '../../minigames/hikers';
import type { StorageLike } from '../../store/autosave';
import { AUTOSAVE_KEY } from '../../store/autosave';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';
import { gpsSize } from './gpsLayout';
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

describe('the party GPS, lifted', () => {
  it('desktop: a 16:9 screen as large as fits, up to 88% of the width, inside the window', () => {
    const s = gpsSize(false);
    expect(s.screenWidth / s.screenHeight).toBeCloseTo(16 / 9);
    expect(s.screenWidth).toBeLessThanOrEqual(STAGE_WIDTH * G.maxScreenWidth);
    expect(s.width).toBeLessThanOrEqual(STAGE_WIDTH);
    expect(s.height).toBeLessThanOrEqual(STAGE_HEIGHT);
    expect(s.screenWidth).toBeGreaterThan(STAGE_WIDTH * 0.7);
  });

  it('a phone in landscape: smaller sides, and the screen gets at least 80% of the height', () => {
    const s = gpsSize(true);
    expect(s.screenHeight / STAGE_HEIGHT).toBeGreaterThanOrEqual(G.phoneScreenHeight);
    expect(s.side).toBeLessThan(gpsSize(false).side);
    expect(s.width).toBeLessThanOrEqual(STAGE_WIDTH);
    expect(s.height).toBeLessThanOrEqual(STAGE_HEIGHT);
  });
});

describe('the minigame list', () => {
  it('Bearrels plays; Ants Are Marching, Cracked Bridge, Fly Swatter and Trail Memory are coming soon', () => {
    expect(MINIGAMES.map((m) => [m.name, m.baseGame, m.status])).toEqual([
      ['Bearrels', 'Barrels', 'ready'],
      ['Ants Are Marching', 'Snake', 'soon'],
      ['Cracked Bridge', 'Platformer', 'soon'],
      ['Fly Swatter', 'Reaction', 'soon'],
      ['Trail Memory', 'Memory', 'soon'],
    ]);
  });

  it('Bearrels’ settings: barrels 3–6 (3), rounds 1–5 (3), shots 1 or 2 (1), hikers 1–4 (Finn, Ellie, Mom)', () => {
    expect(defaultSettings(BEARRELS)).toEqual({
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
    ).toEqual({ barrels: 6, rounds: 1, shots: 1, hikers: ['finn', 'ellie', 'mom', 'wyatt'] });
    // No hikers left: back to the default.
    expect(cleanSettings(BEARRELS, { hikers: ['cody'] }, TEST_HIKERS).hikers).toEqual([
      'finn',
      'ellie',
      'mom',
    ]);
  });

  it('each hiker’s color and silhouette (layout.json); Grandpa Wink is Wink', () => {
    expect(minigameHiker('finn')).toMatchObject({ color: '#E2683C', shape: 'dog-floppy' });
    expect(minigameHiker('grandpaWink')).toMatchObject({
      name: 'Wink',
      color: '#3FB8B0',
      shape: 'bald',
    });
    // A run's party color wins.
    expect(minigameHiker('mom', '#123456').color).toBe('#123456');
    // A future hiker: a dog gets the floppy dog, anyone else the messy hair.
    expect(minigameHiker('cody').shape).toBe('dog-floppy');
    expect(minigameHiker('pearl').shape).toBe('dog-floppy');
    expect(minigameHiker('ben').shape).toBe('messy');
  });
});

describe('test mode never touches the saved hike', () => {
  it('the testing tab remembers its settings under its own key, and nothing else', () => {
    const save = '{"saveVersion":21}';
    const { storage, data, writes } = fakeStorage({ [AUTOSAVE_KEY]: save });
    expect(readTestingSettings(storage, 'bearrels')).toEqual(defaultSettings(BEARRELS));
    const next = { barrels: 5, rounds: 2, shots: 2, hikers: ['wyatt', 'gdog'] };
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
