/**
 * The new Prepare effects of the challenge reset (docs/design/24-challenges-reset.md,
 * section 5): each reaches its game the way its card says.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { newCrossroads } from './crossroads/logic';
import { newDodge, step as dodgeStep } from './dodge/logic';
import { answer, newFakeSigns, understand } from './fakeSigns/logic';
import { inLight, lightDiameter, newFindObject } from './findObject/logic';
import { newMemory } from './memory/logic';
import { newPackItUp } from './packItUp/logic';
import { newPicturePuzzle } from './picturePuzzle/logic';
import { POPUPS } from './popups';
import { cardsFor } from './prepare';
import { newRememberPath } from './rememberPath/logic';
import { newRockClimb } from './rockClimb/logic';
import { newSketchyBridge } from './sketchyBridge/logic';
import { newTrailBlazes, triesOf } from './trailBlazes/logic';
import { newTrailBlocks } from './trailBlocks/logic';
import { newTraildle, submit } from './traildle/logic';
import { newTrailMap } from './trailMap/logic';
import { newTrails, tick as trailsTick } from './trails/logic';
import { newWhackoon } from './whackoon/logic';
import type { MinigameSettings } from './types';

const MG = BALANCE.minigames;
const THREE = ['finn', 'mom', 'ellie'];
const optionIds = (game: string, s: MinigameSettings) =>
  (POPUPS[game]?.options(s) ?? []).filter((o) => !o.onlyIf || o.onlyIf(s)).map((o) => o.id);

describe('movement and dodging', () => {
  it('Rock Climb FOOD: a slower arrow', () => {
    const base = newRockClimb({ tier: 2 }, THREE, 1);
    const fed = newRockClimb({ tier: 2, slower: 2 }, THREE, 1);
    expect(fed.swingSec).toBeCloseTo(base.swingSec * (1 + 2 * MG.rockClimb.foodSwing));
    expect(optionIds('rockClimb', { tier: 2 })).toContain('slower');
  });

  it('Sketchy Bridge FOOD: less sway (the Hiking Stick is gone)', () => {
    const base = newSketchyBridge({ tier: 3 }, THREE, 1);
    const fed = newSketchyBridge({ tier: 3, lessSway: 2 * MG.sketchyBridge.foodSway }, THREE, 1);
    expect(fed.sway).toBeCloseTo(base.sway * (1 - 2 * MG.sketchyBridge.foodSway));
    const ids = optionIds('sketchyBridge', { tier: 3 });
    expect(ids).toContain('slower');
    expect(ids).not.toContain('stick');
  });

  it('Trails WINDBREAK (Ridgeline): gusts push half as hard', () => {
    const pushed = (windbreak: boolean) => {
      const s = newTrails({ tier: 3, type: 'ridgeline', windbreak }, THREE, 1);
      const at = { ...s, time: 1, gust: { dir: 1 as const, warnAt: 0, pushAt: 0, endAt: 5 } };
      return trailsTick(at, 0.01).x - at.x;
    };
    expect(pushed(true)).toBeCloseTo(pushed(false) * MG.trails.ridge.windbreak, 5);
    expect(optionIds('trails', { tier: 3, type: 'ridgeline' })).toContain('windbreak');
    expect(optionIds('trails', { tier: 3, type: 'forest' })).not.toContain('windbreak');
  });

  it('Dodge SMOKE, for every animal: every warning lasts longer', () => {
    const firstWarn = (warnExtra: number) => {
      let s = newDodge({ animal: 'bear', tier: 2, warnExtra }, THREE, 3);
      for (let k = 0; k < 600 && !s.parts.some((p) => !p.child); k++)
        s = dodgeStep(s, 1 / 60, s.pos);
      const p = s.parts.find((x) => !x.child)!;
      return p.activeAt - p.warnAt;
    };
    expect(firstWarn(MG.dodge.smokeWarnSec)).toBeCloseTo(firstWarn(0) + MG.dodge.smokeWarnSec, 5);
    for (const animal of ['bees', 'bear', 'ants', 'bobcat'])
      expect(optionIds('dodge', { animal, tier: 2 })).toContain('smoke');
  });
});

describe('puzzles and memory', () => {
  it('Traildle KNOCK ONE DOWN: a board passes with all but one sign right', () => {
    const s = newTraildle({ tier: 1, signs: 4, timer: 'off', knockOne: true }, ['finn'], 2);
    const code = s.boards[0]!.code;
    const guess = [...code];
    guess[0] = (code[0]! + 1) % 10;
    // Avoid a digit that's in the code elsewhere (it would mark "wrong spot", still not right).
    expect(submit(s, guess).boards[0]!.solved).toBe(true);
    const strict = newTraildle({ tier: 1, signs: 4, timer: 'off' }, ['finn'], 2);
    expect(submit(strict, guess).boards[0]!.solved).toBe(false);
  });

  it('Trail Map PLACE A PIECE: more trail tiles start turned right and locked', () => {
    const locked = (placed: number) =>
      newTrailMap({ tier: 2, placed }, THREE, 4).tiles.filter((t) => t.locked).length;
    expect(locked(2)).toBe(locked(0) + 2);
  });

  it('Picture Puzzle CORNERS: each picture’s four corners start in place, locked', () => {
    const s = newPicturePuzzle({ tier: 2, corners: true }, ['finn', 'mom'], 5);
    const g = s.grid;
    for (const grid of s.grids) {
      for (const cell of [0, g - 1, g * (g - 1), g * g - 1]) {
        const id = grid[cell]!;
        expect(id).not.toBeNull();
        expect(s.pieces[id]!.cell).toBe(cell);
        expect(s.locked[id]).toBe(true);
      }
    }
    const inPiles = s.piles.flat().length;
    expect(inPiles).toBe(s.pieces.length - 4 * s.grids.length);
  });

  it('Fake Trail Signs FIX A SIGN: one wrong answer is forgiven', () => {
    let s = understand(newFakeSigns({ tier: 1, fixes: 1 }, ['finn'], 7));
    const sign = s.signs[s.index]!;
    s = answer(s, sign.fake ? 'real' : 'fake');
    expect(s.status.finn).not.toBe('failed');
    expect(s.fixesLeft).toBe(0);
    expect(s.fixed).toBeDefined();
  });

  it('Pack It Up MEND A TEAR: a torn cell can hold gear', () => {
    const torn = (mended: number) =>
      newPackItUp({ tier: 3, mended }, ['finn'], 9).torn.filter(Boolean).length;
    expect(torn(1)).toBe(torn(0) - 1);
  });

  it('Remember the Path BREADCRUMBS: steps of the path stay marked (never the first or last)', () => {
    const s = newRememberPath(2, ['finn'], 3, 0, 2);
    expect(s.crumbs).toHaveLength(2);
    const inner = s.path.slice(1, -1);
    for (const c of s.crumbs) expect(inner.some((t) => t.c === c.c && t.r === c.r)).toBe(true);
    expect(newRememberPath(2, ['finn'], 3).crumbs).toEqual([]);
  });

  it('Memory Puzzle LUCKY PAIR: sets start matched', () => {
    const s = newMemory({ tier: 2, lucky: 1 }, THREE, 4);
    const matchedSets = new Set(s.cardSet.filter((_, id) => s.matched[id]));
    expect(matchedSets.size).toBe(1);
    // Without it, the same deal and nothing matched.
    const plain = newMemory({ tier: 2 }, THREE, 4);
    expect(plain.cards).toEqual(s.cards);
    expect(plain.matched.some(Boolean)).toBe(false);
  });

  it('Crossroads TRAIL MARKER: crossings after the first show their arrow', () => {
    const s = newCrossroads({ tier: 3, markers: 2 }, THREE, 6);
    expect(s.marked).toHaveLength(2);
    expect(s.marked).not.toContain(0);
    const plain = newCrossroads({ tier: 3 }, THREE, 6);
    expect(plain.arrows).toEqual(s.arrows);
    expect(plain.marked).toEqual([]);
  });

  it('Find the Object FLASHLIGHT (dark): a bigger light', () => {
    const dark = newFindObject({ tier: 2, mode: 'dark' }, THREE, 1);
    const lit = newFindObject({ tier: 2, mode: 'dark', flashlight: true }, THREE, 1);
    expect(lightDiameter(lit)).toBe(lightDiameter(dark) + MG.findObject.flashlight);
    // A snack just past the plain light's edge is in the bigger one.
    const r = lightDiameter(dark) / 2 + 2;
    const at = { x: 100 + r - 8, y: 100 - 8 };
    expect(inLight(at, { x: 100, y: 100 }, dark)).toBe(false);
    expect(inLight(at, { x: 100, y: 100 }, lit)).toBe(true);
    expect(optionIds('findObject', { tier: 1, mode: 'still' })).not.toContain('flashlight');
    expect(optionIds('findObject', { tier: 1, mode: 'dark' })).toContain('flashlight');
  });
});

describe('reaction and timing', () => {
  it('Trail Blocks SNACK: each hiker’s energy chunk is bigger', () => {
    const s = newTrailBlocks({ version: 'chop', tier: 2, snacks: 2 }, THREE, 1);
    expect(s.chunkSize).toBeCloseTo(MG.trailBlocks.chunk * (1 + 2 * MG.trailBlocks.snack));
    expect(s.chunks.every((c) => c === s.chunkSize)).toBe(true);
    for (const version of ['chop', 'rockslide', 'river', 'animals'])
      expect(optionIds('trailBlocks', { tier: 2, version })).toContain('snack');
  });

  it('Whackoon SHINY BAIT: one whack fewer each', () => {
    const base = newWhackoon({ tier: 3 }, THREE, 1);
    expect(newWhackoon({ tier: 3, fewerWhacks: 1 }, THREE, 1).target).toBe(base.target - 1);
  });

  it('Trail Blazes LUCKY CHARM: +1 try for the hiker picked', () => {
    const s = newTrailBlazes({ tier: 2, extraTries: { mom: 1 } }, THREE, 1);
    expect(triesOf(s, 'mom')).toBe(s.tries + 1);
    expect(triesOf(s, 'finn')).toBe(s.tries);
    expect(optionIds('trailBlazes', { tier: 2, mode: 'clock' })).not.toContain('tries');
  });

  it('Fly Swatter SMOKE: offered only when there are bees', () => {
    expect(optionIds('flySwatter', { tier: 1 })).not.toContain('smoke');
    expect(optionIds('flySwatter', { tier: 3 })).toContain('smoke');
    const cards = cardsFor(POPUPS.flySwatter!.options({ tier: 3 }), { tier: 3 }, 3);
    expect(cards.some((c) => c.title === 'SMOKE')).toBe(true);
  });
});
