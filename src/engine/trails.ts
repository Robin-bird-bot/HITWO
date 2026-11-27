/**
 * Skill Trails (docs/design/09-hikers.md; Phase 10.7): learning steps with
 * party points.
 *
 * - Every designed hiker has 3 trees of 3 steps (src/content/trails/trees.ts).
 *   They start with one Tier 1 step, picked on the selection screen, free.
 * - A step costs points: Tier 2 [1], Tier 3 [2], another tree's Tier 1 [2],
 *   unless it has its own cost. Tier 2 needs party level [2], Tier 3 [4], and
 *   a step needs the step below it in the same tree.
 * - Points are spent only at night or at a ranger station.
 * - An upgrade replaces the trait it upgrades: the hiker keeps one badge.
 *   `hiker.slots` lists the traits held (type `trail`), so every hook point
 *   reads them as it reads any trait.
 * - A toggle (Leash Puller) starts on and is switched with a free action.
 *   One that says so starts off (Minigame Master).
 * - **Levels** (26-fixes-and-wyatt-trees.md, section 5.1): a learned step
 *   with levels is pressed again to raise it, for [1] point a level. A level
 *   needs the one before it, not a higher party level.
 */
import { BALANCE } from '../config/balance';
import { TRAITS } from '../content/traits';
import {
  levelCount,
  stepLevelOf,
  STEPS,
  TREES_BY_HIKER,
  type HikerTrees,
  type TrailStep,
  type Tree,
} from '../content/trails/trees';
import { effectContext } from './effects';
import { pushEvent } from './log';
import type { GameState, Hiker } from './types';
import { partyOf } from './xp';

const B = BALANCE.trails;

/** A designed hiker's trees, or none for everyone else. */
export const treesOf = (h: Pick<Hiker, 'characterId'>): HikerTrees | undefined =>
  h.characterId ? TREES_BY_HIKER.get(h.characterId) : undefined;

/** Has this hiker learned this step? */
export const hasLearned = (h: Hiker, stepId: string): boolean =>
  !!h.trails?.learned.includes(stepId);

/** The step a trait chain started from (Leash Puller III → Leash Puller). Toggles are kept by it. */
export function rootStep(stepId: string): string {
  let id = stepId;
  for (let guard = 0; guard < 5; guard++) {
    const up = STEPS.get(id)?.step.upgrades;
    if (!up) return id;
    id = up;
  }
  return id;
}

/**
 * The traits a hiker holds from their trees, in tree order: each step learned,
 * with an upgrade in place of the trait it upgrades.
 */
export function heldTraits(h: Hiker): string[] {
  const trees = treesOf(h);
  if (!trees || !h.trails) return [];
  const held: string[] = [];
  for (const tree of trees.trees) {
    for (const step of tree.steps) {
      if (!hasLearned(h, step.id)) continue;
      const at = step.upgrades ? held.indexOf(step.upgrades) : -1;
      if (at >= 0) held[at] = step.id;
      else held.push(step.id);
    }
  }
  return held;
}

/** Keeps `slots` in step with the trails: one `trail` slot per trait held. */
export function syncTrailSlots(h: Hiker): void {
  if (!h.trails) return;
  h.slots = heldTraits(h).map((traitId) => ({ type: 'trail', traitId }));
}

/** Is this toggle on? Every toggle starts on. */
export const toggleOn = (h: Hiker, traitId: string): boolean =>
  !h.trails?.off?.includes(rootStep(traitId));

/** The tree a step is in, and the step below it (none for Tier 1). */
function placeOf(stepId: string): { step: TrailStep; tree: Tree; below?: TrailStep } | undefined {
  const found = STEPS.get(stepId);
  if (!found) return undefined;
  const below = found.tree.steps[found.step.tier - 2];
  return { step: found.step, tree: found.tree, ...(below ? { below } : {}) };
}

/** What a step costs: its own cost, or its tier's (a Tier 1 opens another tree). */
export function stepCost(step: TrailStep): number {
  if (step.cost !== undefined) return step.cost;
  if (step.tier === 2) return B.cost.tier2;
  if (step.tier === 3) return B.cost.tier3;
  return B.cost.openTree;
}

/** What a learned step's next level costs, or undefined when it's at its last level. */
export function levelCost(h: Hiker, stepId: string): number | undefined {
  const step = STEPS.get(stepId)?.step;
  const level = stepLevelOf(h, stepId);
  if (!step || level < 1 || level >= levelCount(step)) return undefined;
  return step.levels?.[level - 1]?.cost ?? B.cost.level;
}

/** The party level a step needs (Tier 1: any). */
export const unlockLevel = (step: TrailStep): number =>
  step.tier === 1 ? 0 : B.unlockLevel[step.tier];

/** Points are spent only at night or at a ranger station. */
export const canSpendNow = (state: Readonly<GameState>): boolean =>
  state.phase === 'night' || !!state.station;

export const SPEND_WHEN = 'Learn at night or at a ranger station.';

/**
 * Why this hiker can't learn this step now, or undefined if they can.
 * `anyTime` leaves out the night-or-station rule (the window's planning view).
 */
export function learnReason(
  state: Readonly<GameState>,
  h: Hiker,
  stepId: string,
  { anyTime = false }: { anyTime?: boolean } = {},
): string | undefined {
  const trees = treesOf(h);
  const place = placeOf(stepId);
  if (!trees || !place || !h.trails || STEPS.get(stepId)?.hiker !== trees) {
    return `${h.name} can’t learn that.`;
  }
  if (h.status === 'abandoned') return `${h.name} has left the hike.`;
  if (hasLearned(h, stepId)) {
    // Pressed again: its next level, if it has one.
    const next = levelCost(h, stepId);
    if (next === undefined) {
      return levelCount(place.step) > 1 ? 'At its last level.' : 'Already learned.';
    }
    if (partyOf(state).points < next) return `Needs ${next} point${next === 1 ? '' : 's'}.`;
    if (!anyTime && !canSpendNow(state)) return SPEND_WHEN;
    return undefined;
  }
  if (place.below && !hasLearned(h, place.below.id)) return `Learn ${place.below.name} first.`;
  const party = partyOf(state);
  const level = unlockLevel(place.step);
  if (party.level < level) return `Needs party level ${level}.`;
  const cost = stepCost(place.step);
  if (party.points < cost) return `Needs ${cost} point${cost === 1 ? '' : 's'}.`;
  if (!anyTime && !canSpendNow(state)) return SPEND_WHEN;
  return undefined;
}

/**
 * Learns a step: its points are paid (none for the starting step), the
 * hiker's traits update, and a step that gives something gives it now.
 */
export function learnStep(
  state: GameState,
  h: Hiker,
  stepId: string,
  { start = false }: { start?: boolean } = {},
): void {
  const place = placeOf(stepId);
  if (!place) return;
  if (hasLearned(h, stepId)) {
    raiseLevel(state, h, stepId);
    return;
  }
  const cost = start ? 0 : stepCost(place.step);
  h.trails ??= { learned: [] };
  h.trails.learned.push(stepId);
  syncTrailSlots(h);
  // A toggle that starts off (Minigame Master).
  if (place.step.kind === 'toggle' && place.step.startsOff) {
    h.trails.off = [...new Set([...(h.trails.off ?? []), rootStep(stepId)])];
  }
  if (cost) {
    const party = (state.party ??= { xp: 0, level: 0, points: 0 });
    party.points = Math.max(0, party.points - cost);
  }
  pushEvent(state, { kind: 'learned', hikerId: h.id, stepId, cost, ...(start ? { start } : {}) });
  TRAITS[stepId]?.hooks?.onLearn?.(effectContext(state, h), { start });
}

/** A learned step's next level: its points are paid, and it's logged. */
function raiseLevel(state: GameState, h: Hiker, stepId: string): void {
  const cost = levelCost(h, stepId);
  if (cost === undefined || !h.trails) return;
  const level = stepLevelOf(h, stepId) + 1;
  h.trails.levels = { ...h.trails.levels, [stepId]: level };
  const party = (state.party ??= { xp: 0, level: 0, points: 0 });
  party.points = Math.max(0, party.points - cost);
  pushEvent(state, { kind: 'learned', hikerId: h.id, stepId, cost, level });
}

/** Gives a designed hiker their trees, starting with one tree's Tier 1 (the first by default). */
export function startTrails(state: GameState, h: Hiker, startTree?: string): void {
  const trees = treesOf(h);
  if (!trees) return;
  h.moraleType ??= trees.moraleType;
  h.trails = { learned: [] };
  h.slots = [];
  const tree = trees.trees.find((t) => t.id === startTree) ?? trees.trees[0];
  learnStep(state, h, tree.steps[0].id, { start: true });
}

/** Switches a toggle trait (by any step of its chain). */
export function switchToggle(state: GameState, h: Hiker, traitId: string): void {
  const root = rootStep(traitId);
  h.trails ??= { learned: [] };
  const off = new Set(h.trails.off ?? []);
  const on = off.has(root);
  if (on) off.delete(root);
  else off.add(root);
  if (off.size) h.trails.off = [...off];
  else delete h.trails.off;
  pushEvent(state, { kind: 'toggled', hikerId: h.id, traitId, on });
}

/** A toggle trait this hiker holds (it must be held to be switched). */
export const holdsToggle = (h: Hiker, traitId: string): boolean =>
  heldTraits(h).includes(traitId) && STEPS.get(traitId)?.step.kind === 'toggle';
