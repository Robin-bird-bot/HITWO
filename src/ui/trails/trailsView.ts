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
 */
import { CLASS_COLORS } from '../../content/classes';
import type { TrailStep, Tree } from '../../content/trails/trees';
import {
  hasLearned,
  learnReason,
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
  step: TrailStep;
  look: StepLook;
  state: StepState;
  cost: number;
  /** The party level it needs, when the party isn't there yet. */
  needLevel?: number;
  /** Why Learn is greyed out right now, if it is. */
  reason?: string;
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
    steps: tree.steps.map((step, i): StepView => {
      const look = stepLook(step.id)!;
      const cost = stepCost(step);
      if (hasLearned(hiker, step.id)) return { step, look, state: 'learned', cost };
      const below = tree.steps[i - 1];
      const level = unlockLevel(step);
      const open = (!below || hasLearned(hiker, below.id)) && party.level >= level;
      const reason = learnReason(state, hiker, step.id);
      return {
        step,
        look,
        state: open ? 'open' : 'notYet',
        cost,
        ...(party.level < level ? { needLevel: level } : {}),
        ...(reason ? { reason } : {}),
      };
    }),
  }));
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
