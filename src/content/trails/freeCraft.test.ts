/**
 * Free crafting (docs/design/29-core-loop.md, sections 4 and 10): the
 * crafters' Tier 1 steps give a leveled chance that crafting their type
 * costs no Energy. Each level's chance lands near [25/50/75/100%]; only that
 * step's type is free; Garbage Connoisseur II and III keep the level; Family
 * Cookbook still gives its recipes.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { freeCraftBy } from '../../engine/effects';
import { hiker, run, trailGame } from '../../engine/test/fixtures';
import { learnStep } from '../../engine/trails';
import type { GameState, ItemTypeName } from '../../engine/types';
import { RESOURCES } from '../resources';
import { atLevel, STEPS } from './trees';

const FREE = BALANCE.trails.freeCraft.chance;

/** A hiker with a crafting tree's Tier 1 step at a level. */
function crafter(id: string, tree: string, level: number): GameState {
  const s = trailGame([[id, tree]]);
  const h = hiker(s, id);
  h.trails!.levels = { ...h.trails!.levels, [`${tree}-t1`]: level };
  return s;
}

/** The share of `n` crafts of a type the hiker's steps make free. */
function freeShare(s: GameState, id: string, type: ItemTypeName, n = 600): number {
  let free = 0;
  for (let k = 0; k < n; k++) if (freeCraftBy(s, hiker(s, id), type)) free++;
  return free / n;
}

const CRAFTERS: [string, string, ItemTypeName, string][] = [
  ['ellie', 'ellie-chef', 'food', 'Garbage Connoisseur'],
  ['gdog', 'gdog-chef', 'food', 'Family Cookbook'],
  ['gdog', 'gdog-tailor', 'clothes', 'Clothing Catalogue'],
  ['grandpaWink', 'wink-architect', 'shelter', 'Floor Plans'],
];

describe('free crafting', () => {
  it.each(CRAFTERS)('%s, %s: each level’s chance lands near [25/50/75/100%]', (id, tree, type) => {
    for (let level = 1; level <= 4; level++) {
      const share = freeShare(crafter(id, tree, level), id, type);
      expect(share).toBeGreaterThan(FREE[level - 1]! - 0.07);
      expect(share).toBeLessThan(FREE[level - 1]! + 0.07);
    }
  });

  it.each(CRAFTERS)('%s, %s: only that step’s type is free', (id, tree, type) => {
    const s = crafter(id, tree, 4);
    for (const other of ['food', 'clothes', 'shelter', 'tool', 'trinket'] as ItemTypeName[]) {
      if (other === type) continue;
      expect(freeCraftBy(s, hiker(s, id), other)).toBeUndefined();
    }
  });

  it('Garbage Connoisseur II and III keep the level reached', () => {
    const s = crafter('ellie', 'ellie-chef', 4);
    learnStep(s, hiker(s, 'ellie'), 'ellie-chef-t2');
    expect(freeCraftBy(s, hiker(s, 'ellie'), 'food')).toBe('Garbage Connoisseur II');
    learnStep(s, hiker(s, 'ellie'), 'ellie-chef-t3');
    expect(freeCraftBy(s, hiker(s, 'ellie'), 'food')).toBe('Garbage Connoisseur III');
    // At level 2 the chance stays Garbage Connoisseur's.
    const two = crafter('ellie', 'ellie-chef', 2);
    learnStep(two, hiker(two, 'ellie'), 'ellie-chef-t2');
    const share = freeShare(two, 'ellie', 'food');
    expect(share).toBeGreaterThan(FREE[1]! - 0.07);
    expect(share).toBeLessThan(FREE[1]! + 0.07);
  });

  it('a free craft costs no Energy, and the log says which step did it', () => {
    let s = crafter('gdog', 'gdog-chef', 4);
    hiker(s, 'gdog').inventory.resources = Object.fromEntries(RESOURCES.map((r) => [r.id, 3]));
    const before = hiker(s, 'gdog').stats.energy;
    s = run(s, { type: 'craft', hikerId: 'gdog', itemType: 'food' });
    expect(hiker(s, 'gdog').stats.energy).toBe(before);
    expect(s.log).toContainEqual(
      expect.objectContaining({ kind: 'trait', trait: 'Family Cookbook', text: 'no Energy.' }),
    );
  });

  it('without the step’s luck, a craft costs its Energy as before', () => {
    let s = crafter('gdog', 'gdog-tailor', 4);
    hiker(s, 'gdog').inventory.resources = Object.fromEntries(RESOURCES.map((r) => [r.id, 3]));
    const before = hiker(s, 'gdog').stats.energy;
    s = run(s, { type: 'craft', hikerId: 'gdog', itemType: 'tool' });
    expect(hiker(s, 'gdog').stats.energy).toBe(before - BALANCE.items.craft.energy);
    expect(s.log.some((e) => e.kind === 'trait')).toBe(false);
  });

  it('Family Cookbook, Clothing Catalogue and Floor Plans are passive steps that still give recipes', () => {
    for (const [id, tree] of CRAFTERS.slice(1)) {
      const step = STEPS.get(`${tree}-t1`)!.step;
      expect(step.kind).toBe('passive');
      // Up to 3 (fewer when the type has fewer Tier 1 recipes: steps.test.ts counts them).
      const known = hiker(trailGame([[id, tree]]), id).blueprints ?? [];
      expect(known.length).toBeGreaterThan(0);
      expect(known.length).toBeLessThanOrEqual(BALANCE.trails.recipes);
    }
  });

  it('the words: the chance at each level, and none at the last', () => {
    const cookbook = STEPS.get('gdog-chef-t1')!.step;
    expect(cookbook.text).toBe(
      'Learn 3 random food recipes. Crafting food has a 25% chance to cost no Energy.',
    );
    expect(cookbook.startText).toBe(
      'Start with 3 random food recipes. Crafting food has a 25% chance to cost no Energy.',
    );
    expect(atLevel(cookbook, 2)).toMatchObject({
      text: 'Learn 3 random food recipes. Crafting food has a 50% chance to cost no Energy.',
      changed: ['50%'],
    });
    expect(atLevel(cookbook, 4)).toMatchObject({
      text: 'Learn 3 random food recipes. Crafting food costs no Energy.',
      changed: ['Crafting food costs no Energy.'],
    });
    expect(STEPS.get('ellie-chef-t1')!.step.text).toMatch(
      /Crafting food has a 25% chance to cost no Energy\.$/,
    );
    expect(STEPS.get('wink-architect-t1')!.step.text).toMatch(/Crafting shelters has a 25%/);
    expect(STEPS.get('ellie-chef-t2')!.step.text).toMatch(/^As Garbage Connoisseur/);
  });
});
