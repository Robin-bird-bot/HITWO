/**
 * Prepare's effects reach the games (docs/design/20-challenge-popup.md,
 * section 7): each wired option changes its engine's numbers the way its
 * row says. (The rows not wired yet are listed in popups/index.ts.)
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { newCampCleanup } from './campCleanup/logic';
import { newCrossing, hop } from './crossing/logic';
import { newDodge } from './dodge/logic';
import { newFakeSigns } from './fakeSigns/logic';
import { newFindObject } from './findObject/logic';
import { newFindPath } from './findPath/logic';
import { newFireflyCatch } from './fireflyCatch/logic';
import { newFlySwatter } from './flySwatter/logic';
import { newPicturePuzzle } from './picturePuzzle/logic';
import { newRafting, tick as raftTick } from './rafting/logic';
import { newRememberPath } from './rememberPath/logic';
import { newSizeUp } from './sizeUp/logic';
import { newSleepingBear } from './sleepingBear/logic';
import { newTraildle } from './traildle/logic';
import { newTrailBlazes } from './trailBlazes/logic';
import { newTrailBlocks } from './trailBlocks/logic';
import { newTrain } from './train/logic';
import { newWhackoon } from './whackoon/logic';

const MG = BALANCE.minigames;
const THREE = ['finn', 'mom', 'ellie'];

describe('Prepare reaches the games', () => {
  it('Dodge: +1 heart for one hiker, slower attacks, fewer bees, Bear Spray, sandbags, salt', () => {
    const s = newDodge(
      {
        animal: 'bees',
        tier: 3,
        extraLives: { mom: 1 },
        slower: 0.2,
        fewerBees: 1,
        shorter: 0.25,
        sandbags: true,
        antSlow: 0.4,
      },
      THREE,
      1,
    );
    expect(s.lives).toEqual({
      finn: MG.dodge.lives,
      mom: MG.dodge.lives + 1,
      ellie: MG.dodge.lives,
    });
    expect(s.startLives.mom).toBe(MG.dodge.lives + 1);
    expect(s.speed).toBeCloseTo(MG.dodge.levels[2].speed * 0.8);
    expect(s.fewerBees).toBe(1);
    expect(s.lengthSec).toBeCloseTo(MG.dodge.tiers[3].lengthSec * 0.75);
    expect(s.sandbags).toBe(true);
    expect(s.antSlow).toBeCloseTo(0.4);
  });

  it('Crossing, Train! and Rafting: +1 life for one hiker, and slower', () => {
    const c = newCrossing(
      { version: 'road', tier: 2, extraLives: { ellie: 1 }, slower: 0.5 },
      THREE,
      3,
    );
    expect(c.lives.ellie).toBe(c.maxLives + 1);
    const plain = newCrossing({ version: 'road', tier: 2 }, THREE, 3);
    const lane = c.lanes.findIndex((l) => l.speed > 0);
    expect(c.lanes[lane]!.speed).toBeCloseTo(plain.lanes[lane]!.speed * 0.5);
    expect(hop).toBeTypeOf('function');
    const t = newTrain({ tier: 4, extraLives: { finn: 2 }, slower: 0.2, brighter: 0.3 }, THREE, 3);
    expect(t.lives.finn).toBe(t.maxLives + 2);
    expect(t.pace).toBeCloseTo(0.8);
    expect(t.warnSec).toBeCloseTo(MG.train.tiers[4].warnSec + 0.3);
    const r = newRafting({ tier: 1, extraLives: { finn: 1 }, slower: 0.1, sturdy: true }, THREE, 3);
    expect(r.spare.finn).toBe(1);
    expect(r.pace).toBeCloseTo(MG.rafting.tiers[1].pace * 0.9);
    expect(r.sturdy).toBe(true);
  });

  it('Rafting: the sturdier raft takes the first hit, then a spare life goes before the hiker’s own', () => {
    let s = newRafting({ tier: 1, extraLives: { finn: 1 }, sturdy: true }, THREE, 5);
    // A rock right under the raft, three times (safety in between).
    const rock = (x: typeof s) => ({
      ...x,
      safeFor: 0,
      things: [
        { kind: 'rock' as const, lane: x.lane, lanes: 1 as const, at: x.traveled, size: 'm' as const },
      ],
    });
    s = raftTick(rock(s), 0.001);
    expect(s.sturdy).toBe(false);
    expect(s.lost).toEqual([]);
    s = raftTick(rock(s), 0.001);
    expect(s.spare.finn).toBe(0);
    expect(s.lost).toEqual([]);
    s = raftTick(rock(s), 0.001);
    expect(s.lost).toEqual(['finn']);
  });

  it('Camp Cleanup: more time, slower, fewer bags, fewer obstacles', () => {
    const s = newCampCleanup(
      { tier: 4, extraSec: 10, slower: 0.2, fewerBags: 1, fewerObstacles: 2 },
      THREE,
      1,
    );
    expect(s.timeSec).toBe(MG.campCleanup.tiers[4].timeSec + 10);
    expect(s.quota).toBe(MG.campCleanup.tiers[4].quota - 1);
    expect(s.obstacles).toHaveLength(MG.campCleanup.tiers[4].obstacles - 2);
  });

  it('the quick games: Trail Blazes, Firefly Catch, Size Up, Fly Swatter, Whackoon, Sleeping Bear', () => {
    const tb = newTrailBlazes({ tier: 2, slower: 0.2, brighter: 2 }, THREE, 1);
    expect(tb.level).toBe(MG.trailBlazes.tiers[2].level + 2);
    expect(tb.pace).toBeCloseTo(0.8);
    const fc = newFireflyCatch({ tier: 3, biggerRing: 6, slower: 0.1 }, THREE, 1);
    expect(fc.ring).toBe(MG.fireflyCatch.tiers[3].ring + 6);
    expect(fc.speed).toBeCloseTo(MG.fireflyCatch.tiers[3].speed * 0.9);
    const su = newSizeUp({ tier: 2, passBonus: 2, extraSec: 4 }, THREE, 1);
    expect(su.pass).toBe(MG.sizeUp.tiers[2].pass + 2);
    expect(su.timeSec).toBe(MG.sizeUp.tiers[2].timeSec + 4);
    const fs = newFlySwatter({ tier: 1, bigger: 8, slowerShrink: 0.3 }, THREE, 1);
    expect(fs.size).toBe(MG.flySwatter.tiers[1].circle + 8);
    expect(fs.shrinkSec).toBeCloseTo(MG.flySwatter.tiers[1].shrinkSec + 0.3);
    const wh = newWhackoon({ tier: 3, slower: 0.2, noSkunks: true }, THREE, 1);
    expect(wh.skunkChance).toBe(0);
    expect(wh.slow).toBeCloseTo(1 / 0.8);
    const sb = newSleepingBear({ tier: 2, quiet: 0.2, extraSec: 10 }, THREE, 1);
    expect(sb.total).toBe(MG.sleepingBear.tiers[2].secPerHiker * 3 + 10);
    expect(sb.quiet).toBeCloseTo(1 / 0.8);
    const blocks = newTrailBlocks({ version: 'chop', tier: 1, lessWork: 0.5 }, THREE, 1);
    const w = MG.trailBlocks.work[1];
    expect(blocks.total).toBe(Math.round((w.base + w.perHiker * 3) * 0.5));
  });

  it('the puzzles: Traildle, Find the Path, Picture Puzzle, Fake Signs, Remember the Path, Find the Object', () => {
    const td = newTraildle({ tier: 1, signs: 'auto', timer: 'auto', extraGuesses: 2 }, THREE, 1);
    expect(td.guessesAllowed).toBeGreaterThanOrEqual(MG.traildle.tiers[1].guesses + 2);
    const fp = newFindPath({ tier: 3, fog: 'off', extraTries: 1 }, THREE, 1);
    expect(fp.tries).toBe(MG.findPath.triesPerTurn + 1);
    const pp = newPicturePuzzle({ tier: 1, extraSec: 10 }, THREE, 1);
    const plain = newPicturePuzzle({ tier: 1 }, THREE, 1);
    expect(pp.timeSec).toBe(plain.timeSec + 10);
    const fsg = newFakeSigns({ tier: 4, cap: 4, signs: 3, showOld: 'always' }, THREE, 1);
    expect(fsg).toBeDefined();
    const rp = newRememberPath(3, THREE, 1, 2);
    expect(rp.path.length).toBeLessThanOrEqual(MG.rememberPath.tiers[3].length[1] - 2);
    const fo = newFindObject({ tier: 2, mode: 'auto', fewer: 1 }, THREE, 1);
    const fo0 = newFindObject({ tier: 2, mode: 'auto' }, THREE, 1);
    expect(fo.targets.length).toBe(fo0.targets.length - 1);
  });
});
