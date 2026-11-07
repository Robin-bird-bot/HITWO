/**
 * Conditions on hikers (docs/design/02-traits-and-conditions.md).
 *
 * - Timed ones tick down: phase conditions at the end of every phase (one
 *   added during a phase skips that phase's tick, so "1 phase" means the next
 *   full phase); day and night ones at camp.
 * - Getting the same condition again keeps the longer time, unless the
 *   condition says it turns into another (Wet → Soaked).
 * - A condition's stat change (Sleepy −2 Energy) is applied when it starts
 *   and undone when it ends (Wyatt, Nov 6): what it took is given back, and
 *   what it gave is taken back, never below 0.
 * - Stacking conditions (Shivering, Burning) count up, last until their
 *   weather ends, and at a set count give an injury and reset.
 * - Effects plug into the hooks through effectSourcesFor (src/content/conditions.ts).
 */
import { CONDITIONS } from '../content/conditions';
import { tally } from './effects';
import { pushEvent } from './log';
import { addInjury, changeStat, clampToCaps, shiftStat } from './stats';
import type { ConditionInstance, ConditionUnit, GameState, Hiker, NodeType } from './types';

/** Phases in a unit, to compare times across units (a day is 3 phases; weather lasts longest). */
const PHASES_PER: Record<ConditionUnit, number> = { phases: 1, days: 3, nights: 3, weather: 1e6 };

export function hasCondition(hiker: Hiker, id: string): boolean {
  return hiker.conditions.some((c) => c.id === id);
}

export function addCondition(
  state: GameState,
  hiker: Hiker,
  id: string,
  remaining: number,
  unit: ConditionUnit,
  cause: string,
  extra: { node?: NodeType; then?: ConditionInstance['then'] } = {},
): void {
  if (hiker.status === 'abandoned') return;
  const def = CONDITIONS[id];
  // Stacking conditions are added in stacks; "remaining" is how many.
  if (def?.stacking) {
    addStacks(state, hiker, id, remaining, cause);
    return;
  }
  if (remaining <= 0 && unit !== 'weather') return;
  const existing = hiker.conditions.find((c) => c.id === id);

  // Wet again → Soaked, for whichever is longer: the time left or the new time.
  if (existing && def?.again) {
    const phases = Math.max(
      existing.remaining * PHASES_PER[existing.unit],
      remaining * PHASES_PER[unit],
    );
    removeCondition(state, hiker, existing.id, { quiet: true });
    addCondition(state, hiker, def.again, phases, 'phases', cause);
    return;
  }

  if (existing) {
    if (remaining * PHASES_PER[unit] > existing.remaining * PHASES_PER[existing.unit]) {
      existing.remaining = remaining;
      existing.unit = unit;
      if (unit === 'phases') existing.fresh = true;
    }
  } else {
    const c: ConditionInstance = {
      id,
      remaining,
      unit,
      ...(extra.node ? { node: extra.node } : {}),
      ...(extra.then ? { then: extra.then } : {}),
      ...(unit === 'phases' ? { fresh: true as const } : {}),
    };
    hiker.conditions.push(c);
    pushEvent(state, {
      kind: 'condition',
      hikerId: hiker.id,
      condition: id,
      remaining,
      unit,
      cause,
    });
    applyShift(state, hiker, c);
    clampToCaps(state, hiker);
    return;
  }
  pushEvent(state, { kind: 'condition', hikerId: hiker.id, condition: id, remaining, unit, cause });
}

/**
 * Starts a condition's stat change, and remembers how much it really moved.
 * TODO(wyatt): a loss follows the normal rules, so Sleepy taking Energy to 0
 * gives an injury; and while a cap holds a stat (Burning), Energized can't
 * push past it.
 */
function applyShift(state: GameState, hiker: Hiker, c: ConditionInstance): void {
  const def = CONDITIONS[c.id];
  if (!def?.shift) return;
  for (const [stat, amount] of Object.entries(def.shift) as [keyof Hiker['stats'], number][]) {
    const from = hiker.stats[stat];
    // A positive condition can push a stat above its maximum.
    changeStat(state, hiker, stat, amount, def.name, { pastMax: amount > 0 });
    const moved = hiker.stats[stat] - from;
    // Never give back more than the condition itself took (Strained may have taken more).
    const counted = amount < 0 ? Math.max(amount, moved) : Math.min(amount, moved);
    if (counted !== 0) c.applied = { ...c.applied, [stat]: counted };
  }
}

/** Ends a condition: gives back what its stat change took, or takes back what it gave. */
export function removeCondition(
  state: GameState,
  hiker: Hiker,
  id: string,
  { quiet = false }: { quiet?: boolean } = {},
): void {
  const c = hiker.conditions.find((x) => x.id === id);
  if (!c) return;
  hiker.conditions = hiker.conditions.filter((x) => x !== c);
  if (!quiet) pushEvent(state, { kind: 'conditionEnded', hikerId: hiker.id, condition: id });
  const name = CONDITIONS[id]?.name ?? id;
  for (const [stat, moved] of Object.entries(c.applied ?? {}) as [keyof Hiker['stats'], number][]) {
    shiftStat(state, hiker, stat, -moved, `${name} ended`);
  }
}

/**
 * Adds stacks of a stacking condition (or takes them away with a negative n).
 * At 0 it ends; at its injury count the hiker gains an injury and it resets.
 */
export function addStacks(
  state: GameState,
  hiker: Hiker,
  id: string,
  n: number,
  cause: string,
): void {
  const def = CONDITIONS[id];
  if (!def?.stacking || n === 0 || hiker.status === 'abandoned') return;
  const c = hiker.conditions.find((x) => x.id === id);
  const before = c?.stacks ?? 0;
  const after = Math.max(0, before + n);
  if (after === before) return;
  if (n > 0) tally(state, hiker, `${id}:gained`, n, 'phase');
  if (after === 0) {
    removeCondition(state, hiker, id);
    return;
  }
  if (c) c.stacks = after;
  else hiker.conditions.push({ id, remaining: 0, unit: 'weather', stacks: after });
  pushEvent(state, {
    kind: 'condition',
    hikerId: hiker.id,
    condition: id,
    remaining: 0,
    unit: 'weather',
    cause,
    stacks: after,
  });
  if (after >= def.stacking.injuryAt) {
    removeCondition(state, hiker, id);
    addInjury(state, hiker, def.name);
  }
  clampToCaps(state, hiker);
}

/** Ends every condition that lasts until the weather ends (when it changes). */
export function endWeatherConditions(state: GameState): void {
  for (const h of state.hikers) {
    for (const c of h.conditions.filter((x) => x.unit === 'weather')) {
      removeCondition(state, h, c.id);
    }
  }
}

/** Ticks phase conditions (end of every phase) or day and night ones (camp). */
export function tickConditions(state: GameState, which: 'phases' | 'days'): void {
  for (const hiker of state.hikers) {
    const ended: ConditionInstance[] = [];
    for (const c of hiker.conditions) {
      if (c.unit === 'weather') continue;
      const matches = which === 'phases' ? c.unit === 'phases' : c.unit !== 'phases';
      if (!matches) continue;
      if (c.fresh) {
        delete c.fresh;
        continue;
      }
      c.remaining -= 1;
      if (c.remaining <= 0) ended.push(c);
    }
    for (const c of ended) {
      removeCondition(state, hiker, c.id);
      // TODO(phase 7): Bleeding gives an injury when it runs out.
      if (c.then) addCondition(state, hiker, c.then.id, c.then.remaining, c.then.unit, 'follow-on');
    }
  }
}
