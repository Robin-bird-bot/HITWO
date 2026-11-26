/**
 * Tiers I to V (docs/design/15-challenge-tiers.md): every minigame accepts
 * Tiers IV and V. Each one's numbers run to V in the balance, every game
 * starts and plays at Tiers IV and V, and the games without their own IV and
 * V numbers use the fallback values (harder versions of Tier III).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { ANIMAL_IDS } from './dodge/animals';
import { newDodge, step as dodgeStep } from './dodge/logic';
import { newFindObject, tick as findObjectTick } from './findObject/logic';
import { choices, newFindPath, pick } from './findPath/logic';
import { newMemory, previewDone, tick as memoryTick } from './memory/logic';
import { passingResult } from './passing';
import { newPicturePuzzle, tick as pictureTick } from './picturePuzzle/logic';
import { newRememberPath } from './rememberPath/logic';
import { newSleepingBear, tick as bearTick } from './sleepingBear/logic';
import { check, newMinefield } from './minefield/logic';
import { newTrailBlocks, press, tick as blocksTick, VERSIONS } from './trailBlocks/logic';
import { newTrailMap } from './trailMap/logic';
import { newTraildle, tick as traildleTick } from './traildle/logic';
import { TIERS, type Tier } from './types';
import { newWhackoon, tick as whackoonTick } from './whackoon/logic';

const M = BALANCE.minigames;
const TWO = ['finn', 'mom'];
const HARD: readonly Tier[] = [4, 5];

describe('Tiers I to V', () => {
  it('every game’s numbers run from Tier I to Tier V', () => {
    const records: Record<string, Readonly<Record<number, unknown>>> = {
      traildle: M.traildle.tiers,
      findObject: M.findObject.tiers,
      findObjectKinds: M.findObject.kinds,
      rememberPath: M.rememberPath.tiers,
      findPath: M.findPath.tiers,
      trailMap: M.trailMap.tiers,
      memory: M.memory.tiers,
      picturePuzzle: M.picturePuzzle.tiers,
      minefield: M.minefield.tiers,
      trailBlocks: M.trailBlocks.work,
      chopPass: M.trailBlocks.chop.passSec,
      chopZone: M.trailBlocks.chop.zone,
      rockFill: M.trailBlocks.rockslide.fillSec,
      rockZone: M.trailBlocks.rockslide.zone,
      riverSpots: M.trailBlocks.river.spots,
      riverSpot: M.trailBlocks.river.spot,
      riverPass: M.trailBlocks.river.passSec,
      animalsShrink: M.trailBlocks.animals.shrinkSec,
      animalsRing: M.trailBlocks.animals.thickness,
      sleepingBear: M.sleepingBear.tiers,
      whackoon: M.whackoon.tiers,
      dodge: M.dodge.tiers,
      dodgeRoster: M.dodge.roster,
      dodgeWeights: M.dodge.weights,
      passing: M.passing.nobodyEnergy,
    };
    for (const [name, record] of Object.entries(records)) {
      expect(Object.keys(record).map(Number).sort(), name).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('nobody passing at Tiers IV and V costs 2 energy, as at Tier III', () => {
    for (const tier of [3, 4, 5] as const) {
      const r = passingResult(TWO, tier, [], {});
      expect(r.pays).toEqual({ finn: { energy: 2 }, mom: { energy: 2 } });
    }
  });

  it.each(HARD)('Tier %i: every game starts and plays', (tier) => {
    // Traildle: the fallback (codes stay at 8 signs; less time).
    const traildle = traildleTick(newTraildle({ tier, signs: 'auto', timer: 'auto' }, TWO, 1), 1);
    expect(traildle.signs).toBe(8);
    expect(traildle.timerSec).toBe(M.traildle.tiers[tier].timerSec);
    // Find the Object: more targets, less time.
    const find = findObjectTick(newFindObject({ tier, mode: 'auto' }, TWO, 2), 1);
    expect(find.targets).toHaveLength(2 + M.findObject.tiers[tier].extraTargets);
    expect(find.secPerTarget).toBe(M.findObject.tiers[tier].secPerTarget);
    // Remember the Path: a longer path.
    const path = newRememberPath(tier, TWO, 3);
    expect(path.path.length).toBeGreaterThanOrEqual(M.rememberPath.tiers[tier].length[0]);
    expect(path.path.length).toBeLessThanOrEqual(M.rememberPath.tiers[tier].length[1]);
    // Find the Path: a pick works.
    const trail = newFindPath({ tier, fog: 'auto' }, TWO, 4);
    expect(pick(trail, choices(trail)[0]!).outcome).not.toBe('ignored');
    // Trail Map: its signs.
    expect(newTrailMap({ tier }, TWO, 5).signs).toHaveLength(M.trailMap.tiers[tier].signs);
    // Memory: the clock runs.
    const memory = memoryTick(previewDone(newMemory({ tier, swaps: 'off' }, TWO, 6)), 1);
    expect(memory.timeLeft).toBeCloseTo(M.memory.tiers[tier].timeSec - 1);
    // Picture Puzzle: 5 × 5 on IV, 6 × 6 on V.
    const picture = pictureTick(newPicturePuzzle({ tier }, TWO, 7), 1);
    expect(picture.grid).toBe(M.picturePuzzle.tiers[tier].grid);
    // Minefield (it was Thin Ice): its grid and piles.
    const field = check(newMinefield({ tier }, TWO, 8), 0).state;
    expect([field.cols, field.rows]).toEqual([
      M.minefield.tiers[tier].cols,
      M.minefield.tiers[tier].rows,
    ]);
    expect(field.holeCount).toBe(M.minefield.tiers[tier].holes + 2 * M.minefield.holesPerHiker);
    // Trail Blocks: every version swings.
    for (const v of VERSIONS) {
      let s = newTrailBlocks({ version: v.id, tier }, TWO, 9);
      for (let k = 0; k < 120; k++) s = blocksTick(s, 1 / 60, v.id === 'rockslide' && k < 30);
      s = press(s);
      expect(Number.isFinite(s.work)).toBe(true);
    }
    // Sleeping Bear and Whackoon.
    let bear = newSleepingBear({ tier }, TWO, 10);
    for (let k = 0; k < 120; k++) bear = bearTick(bear, 1 / 60, true);
    expect(bear.total).toBeCloseTo(M.sleepingBear.tiers[tier].secPerHiker * 2);
    let whack = newWhackoon({ tier }, TWO, 11);
    for (let k = 0; k < 120; k++) whack = whackoonTick(whack, 1 / 60);
    expect(whack.cols).toBe(4);
    // Dodge: every animal.
    for (const animal of ANIMAL_IDS) {
      let d = newDodge({ animal, tier, lives: 3 }, TWO, 12);
      for (let k = 0; k < 300; k++) d = dodgeStep(d, 1 / 60, { x: 1, y: 0 });
      expect(d.hudTier).toBe(tier);
      expect(d.level).toBe(3);
    }
  });

  it('the fallback values are harder versions of Tier III', () => {
    const t3 = M.traildle.tiers[3];
    expect(M.traildle.tiers[4].timerSec).toBeCloseTo(t3.timerSec! * 0.85);
    expect(M.traildle.tiers[5].timerSec).toBeCloseTo(t3.timerSec! * 0.7);
    const f3 = M.findObject.tiers[3];
    expect(M.findObject.tiers[4].secPerTarget).toBeCloseTo(f3.secPerTarget * 0.85);
    expect(M.findObject.tiers[5].windSpeed).toBeCloseTo(f3.windSpeed * 1.3);
    expect(M.findObject.tiers[5].light).toBeCloseTo(f3.light * 0.7);
    const r3 = M.rememberPath.tiers[3];
    expect(M.rememberPath.tiers[4].length).toEqual([r3.length[0] + 1, r3.length[1] + 1]);
    expect(M.rememberPath.tiers[5].strikes).toBe(r3.strikes);
    // A chance, rounded to the nearest 5%.
    expect(M.findPath.tiers[5].revealChance).toBeCloseTo(M.findPath.tiers[3].revealChance * 0.7, 1);
    for (const t of TIERS) expect(M.traildle.tiers[t].signs[1]).toBeLessThanOrEqual(8);
  });
});
