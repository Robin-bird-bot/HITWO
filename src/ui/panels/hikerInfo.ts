/**
 * Plain-language facts about hikers and what they can do, for the panels.
 * Pure functions of the game state, so they're easy to test.
 */
import { tileLabel } from '../../content/tileLabels';
import { BALANCE } from '../../config/balance';
import {
  adjacentTileIds,
  blockedByStatus,
  hikersOnTile,
  isSheltered,
  moraleLuck,
  moveCost,
  scavengeCost,
  tendCost,
  tendableNodes,
  thresholdStates,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
  type StatName,
  type Tile,
} from '../../engine';
import type { IconName } from '../icons/paths';
import { SPECIAL_LOOK } from '../map/looks';

const T = BALANCE.thresholds;

export const STAT_META: Record<StatName, { label: string; icon: IconName }> = {
  energy: { label: 'Energy', icon: 'zap' },
  appetite: { label: 'Appetite', icon: 'utensils' },
  morale: { label: 'Morale', icon: 'heart' },
};

/**
 * Where each bar turns amber (a threshold) and red (critical). Energy and
 * Appetite follow the threshold states; Morale has none in the rules, so its
 * bar uses 5 and 2 (Wyatt, Nov 3).
 */
export const BAR_LEVELS: Record<StatName, { low: number; critical: number }> = {
  energy: { low: T.fatigued, critical: T.exhausted },
  appetite: { low: T.hungry, critical: T.famished },
  morale: { low: 5, critical: 2 },
};

/** Bar colors (Wyatt, Nov 3): each stat's own color, amber at a threshold, red when critical. */
export const BAR_COLOR: Record<StatName, string> & { low: string; critical: string } = {
  energy: '#7FC29B',
  appetite: '#C08A5A',
  morale: '#B98AE0',
  low: '#F0A83A',
  critical: '#E5624A',
};

export type BarLevel = 'normal' | 'low' | 'critical';

export function barLevel(stat: StatName, value: number): BarLevel {
  const l = BAR_LEVELS[stat];
  if (value <= l.critical) return 'critical';
  if (value <= l.low) return 'low';
  return 'normal';
}

export function barColor(stat: StatName, value: number): string {
  const level = barLevel(stat, value);
  return level === 'normal' ? BAR_COLOR[stat] : BAR_COLOR[level];
}

/** The next threshold for a stat, or the state it's in. */
export function statNote(stat: StatName, value: number): string {
  if (stat === 'energy') {
    if (value <= T.exhausted) return 'Exhausted';
    if (value <= T.fatigued) return `Exhausted at ${T.exhausted}`;
    return `Fatigued at ${T.fatigued}`;
  }
  if (stat === 'appetite') {
    if (value <= T.famished) return 'Famished';
    if (value <= T.hungry) return `Famished at ${T.famished}`;
    return `Hungry at ${T.hungry}`;
  }
  // Morale: no injury at 0 (Wyatt, Nov 5); it sets the hiker's base Luck instead.
  const luck = moraleLuck(value);
  return luck === 0 ? 'Luck 0' : `Luck ${luck > 0 ? '+' : '−'}${Math.abs(luck)}`;
}

export interface ConditionChip {
  key: string;
  icon: IconName;
  label: string;
  kind: 'state' | 'injury' | 'positive' | 'negative';
}

/** Threshold states and injuries, as icons on the hiker card. Timed conditions arrive in Phase 6. */
export function conditionChips(h: Hiker): ConditionChip[] {
  const states = thresholdStates(h);
  const chips: ConditionChip[] = [];
  if (states.includes('famished')) {
    chips.push({
      key: 'famished',
      icon: 'utensils',
      kind: 'state',
      label: 'Famished: can’t move or scavenge',
    });
  } else if (states.includes('hungry')) {
    chips.push({
      key: 'hungry',
      icon: 'utensils',
      kind: 'state',
      label: 'Hungry: can’t scavenge or move the group',
    });
  }
  if (states.includes('exhausted')) {
    chips.push({
      key: 'exhausted',
      icon: 'battery',
      kind: 'state',
      label: 'Exhausted: can only sleep',
    });
  } else if (states.includes('fatigued')) {
    chips.push({
      key: 'fatigued',
      icon: 'battery',
      kind: 'state',
      label: 'Fatigued: at night, can only sleep',
    });
  }
  if (h.injuries > 0) {
    chips.push({
      key: 'injury',
      icon: 'medical',
      kind: 'injury',
      label: `${h.injuries} ${h.injuries === 1 ? 'injury' : 'injuries'} (passes out at ${BALANCE.injuries.passOutAt})`,
    });
  }
  return chips;
}

export type StatusTag = 'PASSED OUT' | 'ACTED' | 'ACTING' | 'READY' | 'CHECKED IN' | 'LEFT';

export function statusTag(h: Hiker, selected: boolean): StatusTag {
  if (h.status === 'passedOut') return 'PASSED OUT';
  if (h.status === 'checkedIn') return 'CHECKED IN';
  if (h.status === 'abandoned') return 'LEFT';
  if (h.acted) return 'ACTED';
  return selected ? 'ACTING' : 'READY';
}

export const FAMILY_LOOK = {
  human: { label: 'HUMAN', icon: 'user' },
  dog: { label: 'DOG', icon: 'paw' },
  cat: { label: 'CAT', icon: 'paw' },
} as const satisfies Record<Hiker['family'], { label: string; icon: IconName }>;

export function xpProgress(h: Hiker): { level: number; xp: number; next: number | null } {
  const levels = BALANCE.xp.levelAt;
  const next = levels[h.level] ?? null;
  return { level: h.level, xp: h.xp, next };
}

/** What to call a tile: its label, special space, or kind. */
export function tileName(tile: Tile): string {
  if (tile.kind === 'trailhead') return 'Trailhead';
  if (tile.kind === 'checkpoint') return 'Checkpoint';
  const allKnown = tile.nodes.length > 0 && tile.nodes.every((n) => n.revealed);
  const label = allKnown ? tileLabel(tile.nodes) : null;
  if (label) return label;
  if (tile.special) return SPECIAL_LOOK[tile.special].name;
  return 'Trail tile';
}

// ── Actions ────────────────────────────────────────────────────────────────

export type ActionId =
  'move' | 'moveAll' | 'scavenge' | 'craft' | 'fire' | 'tend' | 'sleep' | 'watch';

export interface ActionState {
  id: ActionId;
  label: string;
  icon: IconName;
  /** Short line under the label, e.g. "−1 Appetite". */
  sub: string;
  /**
   * ready; blocked for a normal reason (grey, hidden in Simple mode); stopped
   * by an abnormal status like Exhausted or Morale 0 (red, shown in both
   * modes); or not built yet.
   */
  status: 'ready' | 'blocked' | 'status' | 'soon';
  /** Why it can't be taken, in plain words. */
  reason?: string;
}

const SOON: Record<'craft' | 'fire' | 'tend' | 'watch', { phase: number; what: string }> = {
  tend: { phase: 4, what: 'Tending' },
  fire: { phase: 6, what: 'Sitting by the fire' },
  watch: { phase: 6, what: 'Keeping watch' },
  craft: { phase: 9, what: 'Crafting' },
};

function soon(id: keyof typeof SOON, label: string, icon: IconName): ActionState {
  const { phase, what } = SOON[id];
  return {
    id,
    label,
    icon,
    sub: `Phase ${phase}`,
    status: 'soon',
    reason: `${what} arrives in Phase ${phase}.`,
  };
}

const costText = (appetite: number) => (appetite === 0 ? 'No Appetite' : `−${appetite} Appetite`);

type Judgement = Pick<ActionState, 'status' | 'reason'>;

/**
 * Ready if any of the candidate actions is allowed. Otherwise red when only
 * a status (Exhausted, Morale 0, a condition…) stops one of them, or grey
 * with the first normal reason.
 */
function judge(state: GameState, candidates: Action[], fallback: string): Judgement {
  let first: string | null = null;
  let red: string | undefined;
  for (const a of candidates) {
    const reason = validateAction(state, a);
    if (reason === null) return { status: 'ready' };
    first ??= reason;
    red ??= blockedByStatus(state, a);
  }
  if (red) return { status: 'status', reason: red };
  return { status: 'blocked', reason: first ?? fallback };
}

/** The action grid for the selected hiker: what's ready, what's not and why. */
export function actionStates(state: GameState, h: Hiker): ActionState[] {
  const targets = adjacentTileIds(state.section, h.tileId);

  // Move: ready if any connected tile can be reached.
  const moves = targets.map((t): Action => ({ type: 'move', hikerId: h.id, toTileId: t }));
  const moveOk = targets.filter(
    (t) => validateAction(state, { type: 'move', hikerId: h.id, toTileId: t }) === null,
  );
  const cheapest = Math.min(...moveOk.map((t) => moveCost(state, h.id, t)?.appetite ?? 0));
  const move: ActionState = {
    id: 'move',
    label: 'Move',
    icon: 'footprints',
    sub: moveOk.length ? costText(cheapest) : '−1 Appetite',
    ...judge(state, moves, 'No connected tiles.'),
  };

  // Move All: ready if someone here can come along to some connected tile.
  const company = hikersOnTile(state, h.tileId).filter((o) => o.id !== h.id && !o.acted);
  const groupMoves = targets.flatMap((t) =>
    company.map((o): Action => ({ type: 'moveAll', hikerId: h.id, toTileId: t, bring: [o.id] })),
  );
  const moveAll: ActionState = {
    id: 'moveAll',
    label: 'Move All',
    icon: 'users',
    sub: '−1 per hiker',
    ...judge(
      state,
      groupMoves,
      company.length ? 'Nobody can come along.' : 'Nobody else on this tile can come along.',
    ),
  };

  // Tend: ready if some node on this tile can be restored.
  const nodes = tendableNodes(state, h);
  const tends = (nodes.length ? nodes : (['forest'] as const)).map((node): Action => ({
    type: 'tend',
    hikerId: h.id,
    node,
  }));
  const tend: ActionState = {
    id: 'tend',
    label: 'Tend',
    icon: 'sprout',
    sub: `−${tendCost(state, h)} Energy`,
    ...judge(state, tends, 'There’s nothing to tend on this tile.'),
  };

  const scavenge: ActionState = {
    id: 'scavenge',
    label: 'Scavenge',
    icon: 'search',
    sub: costText(scavengeCost(state, h)),
    ...judge(state, [{ type: 'scavenge', hikerId: h.id }], ''),
  };

  const gain = isSheltered(state, h) ? BALANCE.sleep.shelteredEnergy : BALANCE.sleep.energy;
  const sleep: ActionState = {
    id: 'sleep',
    label: 'Sleep',
    icon: 'moon',
    sub: state.phase === 'night' ? `+${gain} Energy` : 'Night',
    ...judge(state, [{ type: 'sleep', hikerId: h.id }], ''),
  };

  return [
    move,
    moveAll,
    scavenge,
    soon('craft', 'Craft', 'hammer'),
    soon('fire', 'Fire', 'flame'),
    tend,
    sleep,
    soon('watch', 'Watch', 'eye'),
  ];
}

/** Simple mode: only the actions the hiker can take right now. */
export function readyActions(state: GameState, h: Hiker): ActionState[] {
  return actionStates(state, h).filter((a) => a.status === 'ready');
}

/**
 * Simple mode's buttons: the actions the hiker can take, plus the ones a
 * status is stopping (red), so it's clear something is wrong (Nov 5, 2b).
 */
export function simpleActions(state: GameState, h: Hiker): ActionState[] {
  return actionStates(state, h).filter((a) => a.status === 'ready' || a.status === 'status');
}

/** Simple mode, when nothing is ready: why (Move's reason is the most useful). */
export function nothingToDoReason(state: GameState, h: Hiker): string {
  return (
    actionStates(state, h).find((a) => a.id === 'move')?.reason ?? `${h.name} can’t act right now.`
  );
}
