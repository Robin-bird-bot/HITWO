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
  DODGE,
  FIND_OBJECT,
  FIND_PATH,
  MEMORY,
  MINIGAMES,
  MINIGAMES_BY_CATEGORY,
  PICTURE_PUZZLE,
  REMEMBER_PATH,
  SLEEPING_BEAR,
  THIN_ICE,
  TRAILDLE,
  TRAIL_BLOCKS,
  TRAIL_MAP,
  WHACKOON,
  CROSSING,
  TRAIN,
  RAFTING,
  TRAIL_BLAZES,
  FIREFLY_CATCH,
  SIZE_UP,
  FLY_SWATTER,
  SAFARI,
  RACCOON_SHUFFLE,
  FAKE_SIGNS,
  TRAILS,
  CROSSROADS,
  ROCK_CLIMB,
  endInfo,
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
  it('is grouped by category, every game in one; Trail Memory is gone (Memory Puzzle replaces it)', () => {
    expect(
      MINIGAMES_BY_CATEGORY.map((c) => [c.name, c.games.map((m) => [m.name, m.status])]),
    ).toEqual([
      [
        'Movement and dodging',
        [
          ['Dodge', 'ready'],
          ['Crossing', 'ready'],
          ['Train!', 'ready'],
          ['Rafting', 'ready'],
          ['Trails', 'ready'],
          ['Rock Climb', 'ready'],
          ['Ants Are Marching', 'soon'],
          ['Cracked Bridge', 'soon'],
        ],
      ],
      [
        'Puzzle and logic',
        [
          ['Traildle', 'ready'],
          ['Find the Path', 'ready'],
          ['Fake Trail Signs', 'ready'],
          ['Trail Map', 'ready'],
          ['Picture Puzzle', 'ready'],
          ['Thin Ice', 'ready'],
        ],
      ],
      [
        'Memory',
        [
          ['Remember the Path', 'ready'],
          ['Memory Puzzle', 'ready'],
          ['Safari', 'ready'],
          ['Crossroads', 'ready'],
        ],
      ],
      ['Search', [['Find the Object', 'ready']]],
      [
        'Reaction and timing',
        [
          ['Trail Blocks', 'ready'],
          ['Sleeping Bear', 'ready'],
          ['Whackoon', 'ready'],
          ['Trail Blazes', 'ready'],
          ['Firefly Catch', 'ready'],
          ['Size Up', 'ready'],
          ['Fly Swatter', 'ready'],
        ],
      ],
      [
        'Guess and luck',
        [
          ['Bearrels', 'ready'],
          ['Raccoon Shuffle', 'ready'],
        ],
      ],
    ]);
    const listed = MINIGAMES_BY_CATEGORY.flatMap((c) => c.games);
    expect(listed).toHaveLength(MINIGAMES.length);
    expect(MINIGAMES.some((m) => m.id === 'trailMemory')).toBe(false);
  });

  it('the lane games’ settings: Crossing’s version, lives and time; Train!’s lives, clock and fog; Rafting’s distance', () => {
    const ids = (info: (typeof MINIGAMES)[number]) => info.settings.map((x) => x.id);
    expect(ids(CROSSING)).toEqual(['version', 'tier', 'hikers', 'lives', 'time']);
    expect(ids(TRAIN)).toEqual(['tier', 'hikers', 'lives', 'survive', 'fog']);
    expect(ids(RAFTING)).toEqual(['tier', 'hikers', 'distance']);
    const version = CROSSING.settings[0];
    if (version?.kind !== 'pick') throw new Error('Version is a pick');
    expect(version.options.map((o) => o.label)).toEqual([
      'Road Crossing',
      'River Crossing',
      'Critter Crossing',
      'Mixed',
    ]);
    expect([CROSSING, TRAIN, RAFTING].every((m) => m.category === 'move' && m.lineUp)).toBe(true);
    expect(cleanSettings(TRAIN, { fog: 'thick', survive: 70 }, TEST_HIKERS)).toMatchObject({
      fog: 'auto',
      survive: 60,
    });
    expect(cleanSettings(RAFTING, { distance: 2550 }, TEST_HIKERS).distance).toBe(2600);
  });

  it('the quick games’ settings, including the tuning helpers (Show % live, Show answer, Show the empty bins)', () => {
    const ids = (info: (typeof MINIGAMES)[number]) => info.settings.map((x) => x.id);
    expect(ids(TRAIL_BLAZES)).toEqual(['tier', 'hikers', 'mode', 'tries']);
    expect(ids(FIREFLY_CATCH)).toEqual(['tier', 'hikers', 'catches', 'time']);
    expect(ids(SIZE_UP)).toEqual(['tier', 'hikers', 'find', 'time', 'live']);
    expect(ids(FLY_SWATTER)).toEqual(['tier', 'hikers', 'bees', 'strikes']);
    expect(ids(SAFARI)).toEqual([
      'tier',
      'hikers',
      'version',
      'questions',
      'bigfoot',
      'question',
      'answer',
    ]);
    expect(ids(RACCOON_SHUFFLE)).toEqual(['tier', 'hikers', 'night', 'packs', 'empties']);
    expect(defaultSettings(TRAIL_BLAZES)).toMatchObject({ mode: 'tries', tries: 'auto' });
    expect(defaultSettings(SIZE_UP)).toMatchObject({ find: 'random', live: 'off' });
    expect(defaultSettings(SAFARI)).toMatchObject({
      version: 'auto',
      questions: 'auto',
      bigfoot: 'auto',
      question: 'random',
      answer: 'off',
    });
    expect(defaultSettings(RACCOON_SHUFFLE)).toMatchObject({
      night: 'auto',
      packs: 'random',
      empties: 'off',
    });
    expect(cleanSettings(TRAIL_BLAZES, { tries: 9, mode: 'sometimes' }, TEST_HIKERS)).toMatchObject(
      {
        tries: 5,
        mode: 'tries',
      },
    );
    expect(
      [TRAIL_BLAZES, FIREFLY_CATCH, SIZE_UP, FLY_SWATTER].every((m) => m.category === 'reaction'),
    ).toBe(true);
    expect(SAFARI.category).toBe('memory');
    expect(RACCOON_SHUFFLE.category).toBe('luck');
    expect(
      [TRAIL_BLAZES, FIREFLY_CATCH, SIZE_UP, FLY_SWATTER, SAFARI, RACCOON_SHUFFLE].every(
        (m) => m.lineUp && m.status === 'ready',
      ),
    ).toBe(true);
  });

  it('signs and trails: their settings, categories and the Rock Climb note for 5 or 6 hikers', () => {
    const ids = (info: (typeof MINIGAMES)[number]) => info.settings.map((x) => x.id);
    expect(ids(FAKE_SIGNS)).toEqual([
      'tier',
      'hikers',
      'signs',
      'cap',
      'showOld',
      'time',
      'answers',
    ]);
    expect(ids(TRAILS)).toEqual(['type', 'tier', 'hikers', 'bar', 'section']);
    expect(ids(CROSSROADS)).toEqual(['tier', 'hikers', 'arrows', 'study', 'newArrows', 'turn']);
    expect(ids(ROCK_CLIMB)).toEqual(['tier', 'hikers', 'holds', 'time', 'tries']);
    expect(FAKE_SIGNS.category).toBe('puzzle');
    expect(CROSSROADS.category).toBe('memory');
    expect([TRAILS, ROCK_CLIMB].every((m) => m.category === 'move')).toBe(true);
    const type = TRAILS.settings[0];
    if (type?.kind !== 'pick') throw new Error('Type is a pick');
    expect(type.options.map((o) => o.label)).toEqual([
      'Forest Path',
      'Switchbacks',
      'Ridgeline',
      'Riverbank',
    ]);
    const hikers = ROCK_CLIMB.settings.find((x) => x.kind === 'hikers');
    expect(hikers?.kind === 'hikers' && hikers.max).toBe(6);
    expect(ROCK_CLIMB.note?.({ hikers: ['finn', 'mom', 'ellie', 'wyatt'] })).toBeNull();
    expect(ROCK_CLIMB.note?.({ hikers: TEST_HIKERS.slice(0, 5) })).toMatch(/5 or 6/);
    expect(endInfo(TRAILS, { type: 'switchbacks', tier: 2 })).toEqual({
      subtitle: 'SWITCHBACKS · TIER II',
      thing: { name: 'trail' },
    });
  });

  it('the new challenges’ settings: Trail Blocks’ version and hit quality, fake-outs and skunks', () => {
    const ids = (info: (typeof MINIGAMES)[number]) => info.settings.map((s) => s.id);
    expect(ids(TRAIL_BLOCKS)).toEqual(['version', 'tier', 'hikers', 'quality']);
    expect(ids(SLEEPING_BEAR)).toEqual(['tier', 'hikers', 'fakeOuts']);
    // Whackoon is everyone at once, in colors (the Mode setting is gone).
    expect(ids(WHACKOON)).toEqual(['tier', 'hikers', 'skunks']);
    expect(defaultSettings(WHACKOON)).toMatchObject({ skunks: 'auto' });
    const version = TRAIL_BLOCKS.settings[0];
    if (version?.kind !== 'pick') throw new Error('Version is a pick');
    expect(version.options.map((o) => o.label)).toEqual([
      'Chop Tree',
      'Mine Rockslide',
      'River Flood',
      'Clearing Animals',
    ]);
    expect(defaultSettings(TRAIL_BLOCKS)).toMatchObject({ version: 'chop', quality: 'off' });
    expect(defaultSettings(SLEEPING_BEAR)).toMatchObject({ fakeOuts: 'auto' });
    expect(cleanSettings(WHACKOON, { skunks: 'maybe' }, TEST_HIKERS).skunks).toBe('auto');
    expect([TRAIL_BLOCKS, SLEEPING_BEAR, WHACKOON].every((m) => m.category === 'reaction')).toBe(
      true,
    );
  });

  it('the third batch’s settings, and timers that can be switched off', () => {
    const ids = (info: (typeof MINIGAMES)[number]) => info.settings.map((s) => s.id);
    // Nov 25: Trail Map's Mode and Memory's Misses and Timer are gone.
    expect(ids(TRAIL_MAP)).toEqual(['tier', 'hikers', 'grid', 'time', 'signs']);
    expect(ids(MEMORY)).toEqual([
      'tier',
      'hikers',
      'match',
      'preview',
      'swaps',
      'time',
      'matchBonus',
      'missCost',
    ]);
    expect(ids(PICTURE_PUZZLE)).toEqual([
      'tier',
      'hikers',
      'grid',
      'thumbnail',
      'secPerPiece',
      'rightSpot',
      'picture',
    ]);
    const picture = PICTURE_PUZZLE.settings.find((x) => x.id === 'picture');
    if (picture?.kind !== 'pick') throw new Error('Picture is a pick');
    expect(picture.options.map((o) => o.id)).toEqual([
      'random',
      'lake-island',
      'mountain-lake',
      'green-valley',
      'foggy-forest',
      'canyon-trail',
      'rocky-butte',
    ]);
    const grid = PICTURE_PUZZLE.settings.find((x) => x.id === 'grid');
    if (grid?.kind !== 'pick') throw new Error('Grid is a pick');
    expect(grid.options.map((o) => o.id)).toEqual(['auto', '4', '5', '6']);
    expect(ids(THIN_ICE)).toEqual(['tier', 'hikers', 'grid', 'holesPerHiker', 'timer']);
    expect(defaultSettings(THIN_ICE)).toMatchObject({
      grid: 'auto',
      holesPerHiker: 2,
      timer: 'auto',
    });
    expect(PICTURE_PUZZLE.lineUp && THIN_ICE.lineUp).toBe(true);
    expect(TRAIL_MAP.lineUp || MEMORY.lineUp).toBeFalsy();
    // Off is kept where a setting can be off, and nowhere else.
    expect(cleanSettings(TRAIL_MAP, { time: 'off', grid: 'off' }, TEST_HIKERS)).toMatchObject({
      time: 'off',
      grid: 'auto',
    });
    expect(
      cleanSettings(
        MEMORY,
        { time: 33, preview: 0.7, matchBonus: 12, missCost: 'off' },
        TEST_HIKERS,
      ),
    ).toMatchObject({
      time: 35,
      preview: 0.5,
      matchBonus: 10,
      missCost: 'auto',
    });
    expect(cleanSettings(TRAIL_MAP, { signs: 5 }, TEST_HIKERS).signs).toBe(3);
    expect(cleanSettings(THIN_ICE, { grid: '12x9', holesPerHiker: 9 }, TEST_HIKERS)).toMatchObject({
      grid: '12x9',
      holesPerHiker: 4,
    });
  });

  it('the puzzle games: Tier (I to V), Hikers, and their overrides, where Auto uses the tier', () => {
    // Every game with a Tier offers I to V (15-challenge-tiers.md).
    for (const info of MINIGAMES) {
      const tier = info.settings.find((x) => x.id === 'tier');
      if (!tier) continue;
      if (tier.kind !== 'choice') throw new Error('Tier is a choice');
      expect(tier.options).toEqual([1, 2, 3, 4, 5]);
      expect(tier.labels).toEqual(['I', 'II', 'III', 'IV', 'V']);
    }
    const ids = (info: (typeof MINIGAMES)[number]) => info.settings.map((s) => s.id);
    expect(ids(TRAILDLE)).toEqual(['tier', 'hikers', 'signs', 'timer']);
    expect(ids(FIND_OBJECT)).toEqual([
      'tier',
      'hikers',
      'mode',
      'rounds',
      'secPerTarget',
      'extraSec',
    ]);
    expect(ids(REMEMBER_PATH)).toEqual(['tier', 'hikers']);
    expect(ids(FIND_PATH)).toEqual(['tier', 'hikers', 'fog', 'hide']);
    // Auto-or-number settings: "auto" by default, numbers kept in range.
    expect(defaultSettings(FIND_OBJECT)).toMatchObject({ rounds: 'auto', secPerTarget: 'auto' });
    expect(cleanSettings(FIND_OBJECT, { rounds: 9, extraSec: -3 }, TEST_HIKERS)).toMatchObject({
      rounds: 5,
      extraSec: 0,
      secPerTarget: 'auto',
    });
    expect(defaultSettings(TRAILDLE)).toEqual({
      tier: 1,
      hikers: ['finn', 'ellie', 'mom'],
      signs: 'auto',
      timer: 'auto',
    });
    for (const info of [TRAILDLE, FIND_OBJECT, REMEMBER_PATH, FIND_PATH, DODGE]) {
      expect(info.lineUp).toBe(true);
    }
    // Dodge: Animal, Attack, Overlaps, Level, Include Claude's ideas, Show hitboxes, Portrait
    // style and motion, Tier, Hikers, Lives (1 to 3), Length (10 to 60 s) and Switch every (3 to 10 s).
    expect(ids(DODGE)).toEqual([
      'animal',
      'attack',
      'overlaps',
      'level',
      'ideas',
      'hitboxes',
      'motion',
      'tier',
      'hikers',
      'lives',
      'length',
      'switch',
    ]);
    expect(defaultSettings(DODGE)).toMatchObject({
      animal: 'bees',
      attack: 'all',
      overlaps: 'auto',
      level: 'auto',
      ideas: 'on',
      hitboxes: 'off',
      motion: 'on',
      lives: 'auto',
      length: 'auto',
    });
    expect(cleanSettings(DODGE, { lives: 7, length: 33, switch: 1 }, TEST_HIKERS)).toMatchObject({
      lives: 3,
      length: 35,
      switch: 3,
    });
    // A remembered override that isn't an option, or a tier out of range, goes back to the default.
    expect(cleanSettings(TRAILDLE, { signs: '12', tier: 6 }, TEST_HIKERS)).toMatchObject({
      signs: 'auto',
      tier: 1,
    });
    expect(cleanSettings(TRAILDLE, { tier: 5 }, TEST_HIKERS).tier).toBe(5);
    expect(cleanSettings(FIND_PATH, { fog: 'on' }, TEST_HIKERS).fog).toBe('on');
  });

  it('Dodge’s Animal and Attack: seven animals; the Attack list follows the Animal, the level (from the Tier or the Level setting) and Claude’s ideas', () => {
    const animal = DODGE.settings.find((s) => s.id === 'animal');
    const attack = DODGE.settings.find((s) => s.id === 'attack');
    if (animal?.kind !== 'pick' || attack?.kind !== 'pick' || !attack.optionsFor) {
      throw new Error('Dodge needs Animal and Attack picks');
    }
    expect(animal.options.map((o) => o.label)).toEqual([
      'Bees',
      'Bear',
      'Bear with a Sword',
      'Bobcat',
      'Squirrel Army',
      'Wild Predator Stampede',
      'Woods Monster',
    ]);
    expect(animal.menu && attack.menu).toBe(true);
    const open = (settings: Record<string, string | number>) =>
      attack.optionsFor!(settings).map((o) => `${o.id}${o.disabled ? ' (closed)' : ''}`);
    // A Bear isn't at Tier I: it plays its lowest level, 1. At Tier II it's Level 1 too.
    expect(open({ animal: 'bear', tier: 2, ideas: 'on' })).toEqual([
      'all',
      'claws',
      'bite',
      'shout (closed)',
      'hug (closed)',
      'honey (closed)',
    ]);
    expect(open({ animal: 'bear', tier: 3, ideas: 'off' })).toEqual(['all', 'claws', 'bite']);
    expect(attack.optionsFor({ animal: 'bear', tier: 3, ideas: 'on' })[3]).toMatchObject({
      label: 'Shout · Claude’s idea',
    });
    expect(attack.optionsFor({ animal: 'bear', tier: 2, ideas: 'on' })[3]?.label).toBe(
      'Shout · Claude’s idea · from Level 2',
    );
    // The Level setting wins over the tier.
    expect(open({ animal: 'bear', tier: 2, level: '2', ideas: 'off' })).toEqual([
      'all',
      'claws',
      'bite',
    ]);
    expect(open({ animal: 'bear', tier: 5, level: '1', ideas: 'on' })).toContain('shout (closed)');
    // Bees at Tier I are Easy: one at a time and pairs only.
    expect(open({ animal: 'bees', tier: 1, ideas: 'on' })).toEqual([
      'all',
      'single',
      'pairs',
      'lane (closed)',
      'cross (closed)',
      'diagonal (closed)',
      'zigzag (closed)',
      'aimed (closed)',
    ]);
    // The Woods Monster always plays Level 3: everything is open, at any tier.
    expect(open({ animal: 'monster', tier: 1, ideas: 'on' })).toEqual([
      'all',
      'fire',
      'arms',
      'hands',
      'wisps',
      'runes',
      'ritual',
      'glare',
      'darkness',
    ]);
    // Long arms are Wyatt's, and Glare isn't marked Claude's idea any more.
    expect(open({ animal: 'monster', tier: 1, ideas: 'off' })).toEqual([
      'all',
      'fire',
      'arms',
      'glare',
    ]);
    expect(cleanSettings(DODGE, { level: 'hard' }, TEST_HIKERS).level).toBe('auto');
    // The Portrait style setting is gone (Solid + red only).
    expect(DODGE.settings.some((x) => x.id === 'portrait')).toBe(false);
    // A remembered attack is kept while the animal changes; one no animal uses goes back to All.
    expect(cleanSettings(DODGE, { animal: 'bobcat', attack: 'shout' }, TEST_HIKERS).attack).toBe(
      'shout',
    );
    expect(cleanSettings(DODGE, { attack: 'roar' }, TEST_HIKERS).attack).toBe('all');
    expect(cleanSettings(DODGE, { overlaps: 'sometimes' }, TEST_HIKERS).overlaps).toBe('auto');
    expect(cleanSettings(DODGE, { overlaps: 'on' }, TEST_HIKERS).overlaps).toBe('on');
    expect(cleanSettings(DODGE, { attack: 'fireball' }, TEST_HIKERS).attack).toBe('all');
    expect(cleanSettings(DODGE, { animal: 'dragon' }, TEST_HIKERS).animal).toBe('bees');
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
