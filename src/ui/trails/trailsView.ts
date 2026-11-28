/**
 * What the Skill Trails window shows for one hiker (Phase 10.7,
 * docs/mockups/skill-trails/): their 3 trees, each step's state, its cost or
 * the party level it needs, and why Learn is greyed out. Pure, so it's easy
 * to test.
 *
 * - **Learned:** solid, glowing trail; bright badge.
 * - **Can learn now** (`open`): the step below is learned and the party level
 *   is high enough. Moving dashes, a pulsing badge, and its cost.
 * - **Not yet:** dark dashes, a dim badge, and the party level it needs.
 * - **Levels** (26-fixes-and-wyatt-trees.md, section 5.1): a learned step
 *   with levels shows pips (●○○) and can be pressed again for the next one.
 */
import { CLASS_COLORS } from '../../content/classes';
import {
  atLevel,
  levelCount,
  stepLevelOf,
  type TrailStep,
  type Tree,
} from '../../content/trails/trees';
import {
  hasLearned,
  learnReason,
  levelCost,
  partyOf,
  stepCost,
  treesOf,
  unlockLevel,
  type GameState,
  type Hiker,
} from '../../engine';
import { stepLook, type StepLook } from './stepLook';

export type StepState = 'learned' | 'open' | 'notYet';

export interface StepView {
  /** The step with its words at the hiker's level. */
  step: TrailStep;
  look: StepLook;
  state: StepState;
  cost: number;
  /** The party level it needs, when the party isn't there yet. */
  needLevel?: number;
  /** Why Learn (or the next level) is greyed out right now, if it is. */
  reason?: string;
  /** Its levels: the hiker's (0 before it's learned) and how many it has. */
  level: number;
  levels: number;
  /** A learned step's next level: its words and its cost. */
  next?: { step: TrailStep; cost: number };
}

export interface TreeView {
  tree: Tree;
  color: string;
  steps: StepView[];
}

export function trailsView(state: GameState, hiker: Hiker): TreeView[] {
  const trees = treesOf(hiker);
  if (!trees) return [];
  const party = partyOf(state);
  return trees.trees.map((tree) => ({
    tree,
    color: CLASS_COLORS[tree.cls],
    steps: tree.steps.map((base, i): StepView => {
      const look = stepLook(base.id)!;
      const levels = levelCount(base);
      const level = stepLevelOf(hiker, base.id);
      const step = { ...base, ...atLevel(base, Math.max(1, level)) };
      if (hasLearned(hiker, base.id)) {
        const nextCost = levelCost(hiker, base.id);
        const reason = nextCost === undefined ? undefined : learnReason(state, hiker, base.id);
        return {
          step,
          look,
          state: 'learned',
          cost: stepCost(base),
          level,
          levels,
          ...(nextCost !== undefined
            ? { next: { step: { ...base, ...atLevel(base, level + 1) }, cost: nextCost } }
            : {}),
          ...(reason ? { reason } : {}),
        };
      }
      const cost = stepCost(base);
      const below = tree.steps[i - 1];
      const need = unlockLevel(step);
      const open = (!below || hasLearned(hiker, below.id)) && party.level >= need;
      const reason = learnReason(state, hiker, step.id);
      return {
        step,
        look,
        state: open ? 'open' : 'notYet',
        cost,
        level,
        levels,
        ...(party.level < need ? { needLevel: need } : {}),
        ...(reason ? { reason } : {}),
      };
    }),
  }));
}

/**
 * How many steps (or next levels) this hiker could learn with the party's
 * points: the picker's "2 STEPS TO LEARN". `anyTime` counts by day too.
 */
export function stepsToLearn(state: GameState, hiker: Hiker, anyTime = false): number {
  const trees = treesOf(hiker);
  if (!trees) return 0;
  return trees.trees
    .flatMap((t) => t.steps)
    .filter((step) => !learnReason(state, hiker, step.id, { anyTime })).length;
}

/** The step to show first: the first one that can be learned now, else the first learned. */
export function firstStep(view: readonly TreeView[]): string | undefined {
  const all = view.flatMap((t) => t.steps);
  return (
    all.find((s) => s.state === 'open' && !s.reason)?.step.id ??
    all.find((s) => s.state === 'open')?.step.id ??
    all.find((s) => s.state === 'learned')?.step.id ??
    all[0]?.step.id
  );
}

/** A step's text in parts, with the parts that changed from the tier before marked (shown in yellow). */
export function marked(
  text: string,
  changed: readonly string[] = [],
): { text: string; changed: boolean }[] {
  const parts: { text: string; changed: boolean }[] = [];
  let rest = text;
  while (rest) {
    let at = -1;
    let hit = '';
    for (const c of changed) {
      const i = rest.indexOf(c);
      if (i >= 0 && (at < 0 || i < at || (i === at && c.length > hit.length))) {
        at = i;
        hit = c;
      }
    }
    if (at < 0 || !hit) {
      parts.push({ text: rest, changed: false });
      break;
    }
    if (at > 0) parts.push({ text: rest.slice(0, at), changed: false });
    parts.push({ text: hit, changed: true });
    rest = rest.slice(at + hit.length);
  }
  return parts;
}
