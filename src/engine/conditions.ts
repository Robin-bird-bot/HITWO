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
import { CONDITIONS, NEGATIVE_CONDITIONS, POSITIVE_CONDITIONS } from '../content/conditions';
import { blocksCondition, tally } from './effects';
import { pushEvent } from './log';
import { tileNodeTypes } from './map';
import { pick, shuffle } from './rng';
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
  extra: {
    node?: NodeType;
    then?: ConditionInstance['then'];
    /** Several stacks of a stat bonus ("3 stacks of Sated": +3 Appetite). */
    stacks?: number;
    /** Ends with this phase ("Lucky for this phase"), not the next. */
    thisPhase?: true;
  } = {},
): void {
  if (hiker.status === 'abandoned') return;
  const def = CONDITIONS[id];
  // Something blocks negative conditions (a Star, a Puffer Jacket).
  if (def?.kind === 'negative' && blocksCondition(state, hiker, id)) return;
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

  const stacks = Math.max(1, extra.stacks ?? 1);
  if (existing) {
    if (remaining * PHASES_PER[unit] > existing.remaining * PHASES_PER[existing.unit]) {
      existing.remaining = remaining;
      existing.unit = unit;
      if (unit === 'phases' && !extra.thisPhase) existing.fresh = true;
    }
    // More stacks of a stat bonus than it has: the extra ones apply now.
    const had = existing.stacks ?? 1;
    if (!def?.stacking && stacks > had) {
      existing.stacks = stacks;
      applyShift(state, hiker, existing, stacks - had);
    }
  } else {
    const c: ConditionInstance = {
      id,
      remaining,
      unit,
      ...(extra.node ? { node: extra.node } : {}),
      ...(extra.then ? { then: extra.then } : {}),
      ...(unit === 'phases' && !extra.thisPhase ? { fresh: true as const } : {}),
      ...(stacks > 1 ? { stacks } : {}),
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
    applyShift(state, hiker, c, stacks);
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
function applyShift(state: GameState, hiker: Hiker, c: ConditionInstance, times = 1): void {
  const def = CONDITIONS[c.id];
  if (!def?.shift) return;
  for (const [stat, each] of Object.entries(def.shift) as [keyof Hiker['stats'], number][]) {
    const amount = each * times;
    const from = hiker.stats[stat];
    // A positive condition can push a stat above its maximum.
    changeStat(state, hiker, stat, amount, def.name, { pastMax: amount > 0 });
    const moved = hiker.stats[stat] - from;
    // Never give back more than the condition itself took (Strained may have taken more).
    const counted = amount < 0 ? Math.max(amount, moved) : Math.min(amount, moved);
    if (counted !== 0) c.applied = { ...c.applied, [stat]: (c.applied?.[stat] ?? 0) + counted };
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
      // Bleeding and a Splint give an injury when they run out (not when cured).
      const def = CONDITIONS[c.id];
      if (def?.onRunOut === 'injury') addInjury(state, hiker, `${def.name} ran out`);
      if (c.then) addCondition(state, hiker, c.then.id, c.then.remaining, c.then.unit, 'follow-on');
    }
  }
}

/**
 * Random conditions from food (Chocolate Rose, Mystery Meat): good or bad,
 * different ones, picked first from those the hiker doesn't have. A
 * condition about a node (Allergies) takes one from the hiker's tile.
 */
export function addRandomConditions(
  state: GameState,
  hiker: Hiker,
  kind: 'positive' | 'negative',
  count: number,
  remaining: number,
  unit: 'phases' | 'days',
  cause: string,
): void {
  if (count <= 0 || remaining <= 0) return;
  const all = kind === 'positive' ? POSITIVE_CONDITIONS : NEGATIVE_CONDITIONS;
  const fresh = all.filter((id) => !hasCondition(hiker, id));
  const order = [
    ...shuffle(state.rng, fresh),
    ...shuffle(
      state.rng,
      all.filter((id) => !fresh.includes(id)),
    ),
  ];
  const nodes = tileNodeTypes(state, hiker.tileId);
  let given = 0;
  for (const id of order) {
    if (given >= count) break;
    const needsNode = CONDITIONS[id]?.takesNode;
    if (needsNode && !nodes.length) continue;
    const node = needsNode ? pick(state.rng, nodes) : undefined;
    addCondition(state, hiker, id, remaining, unit, cause, node ? { node } : {});
    given += 1;
  }
}
