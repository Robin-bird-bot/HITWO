/**
 * The action wheel's buttons (35-ui-overhaul.md, section 4): by day Move,
 * Move all, Scavenge, Craft, Tend and Abilities; at night Sleep, Watch and
 * Sit by the fire. Each has its cost on a badge, and a line that says what it
 * does, or why it can't be done now. The side grid setting shows the same
 * actions in the old grid.
 */
import { BALANCE } from '../../config/balance';
import { abilitiesFor, type GameState, type Hiker, type HikerId } from '../../engine';
import type { IconName } from '../icons/paths';
import { groupActionStates, type ActionId, type ActionState } from '../panels/hikerInfo';

export type WheelId = ActionId | 'abilities';

export interface WheelAction {
  id: WheelId;
  label: string;
  icon: IconName;
  /** The cost badge: "−1" with a stat icon, or a few words ("1 ready"). Null when blocked. */
  cost: { text: string; icon?: 'zap' | 'utensils' } | null;
  ready: boolean;
  /** What it does (ready), or why it can't be done now (blocked). */
  text: string;
}

/** What each action does, in a few plain words. */
const DOES: Record<WheelId, string> = {
  move: 'Walk to a connected tile.',
  moveAll: 'Bring the hikers on this tile along.',
  scavenge: 'Draw cards from this tile and keep 1.',
  craft: 'Make an item from your resources.',
  tend: 'Raise the biome’s Abundance.',
  abilities: 'Use one of this hiker’s abilities.',
  sleep: 'Rest for the night.',
  watch: 'Guard this tile tonight.',
  fire: 'Sit by the fire tonight.',
};

const DAY: readonly ActionId[] = ['move', 'moveAll', 'scavenge', 'craft', 'tend'];
const NIGHT: readonly ActionId[] = ['sleep', 'watch', 'fire'];

/**
 * "−1 Appetite" → "−1" with the Appetite icon ("−1 per hiker" is Move all's
 * Appetite each); "No Energy" → "Free"; other words stay as they are.
 */
function costOf(sub: string): WheelAction['cost'] {
  if (/^No (Energy|Appetite)$/.test(sub)) return { text: 'Free' };
  const m = /^([−+]\d+)( each| per hiker)?(?: (Energy|Appetite))?$/.exec(sub);
  if (m?.[1] && (m[2] || m[3])) {
    return {
      text: `${m[1]}${m[2] ? ' each' : ''}`,
      icon: m[3] === 'Energy' ? 'zap' : 'utensils',
    };
  }
  return sub ? { text: sub } : null;
}

function fromState(a: ActionState): WheelAction {
  const ready = a.status === 'ready';
  return {
    id: a.id,
    label: a.id === 'moveAll' ? 'Move all' : a.id === 'fire' ? 'Sit by the fire' : a.label,
    icon: a.icon,
    cost: ready ? costOf(a.sub) : null,
    ready,
    text: ready ? DOES[a.id] : (a.reason ?? 'Not right now.'),
  };
}

/** The wheel's buttons for this hiker (and their group), in order: keys 1 to 6 press them. */
export function wheelActions(
  state: GameState,
  hiker: Hiker,
  group?: readonly HikerId[],
): WheelAction[] {
  const states = groupActionStates(state, hiker, group);
  const night = state.phase === 'night';
  const out = (night ? NIGHT : DAY).flatMap((id) => {
    const a = states.find((s) => s.id === id);
    return a ? [fromState(a)] : [];
  });
  if (night) return out;
  const usable = abilitiesFor(state, hiker).filter((a) => a.usesLeft > 0).length;
  const acted = hiker.acted && hiker.status === 'active';
  out.push({
    id: 'abilities',
    label: 'Abilities',
    icon: 'sparkles',
    cost: usable ? { text: `${usable} ready` } : null,
    ready: usable > 0,
    text: usable
      ? DOES.abilities
      : acted || abilitiesFor(state, hiker).length
        ? 'No abilities ready right now.'
        : 'This hiker has no abilities.',
  });
  return out;
}

/** The action a number key presses (1 is the first button). */
export function actionForKey(actions: readonly WheelAction[], key: string): WheelAction | null {
  const n = Number(key);
  if (!Number.isInteger(n) || n < 1) return null;
  return actions[n - 1] ?? null;
}

/** Where the arc opens: above the token, or below it near the top edge (Claude's idea). */
export function wheelOpensBelow(y: number): boolean {
  const W = BALANCE.ui.overhaul.wheel;
  return y - W.radius - W.button - W.bubbleRoom < 0;
}
