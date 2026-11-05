/**
 * Timed conditions on hikers (docs/design/02-traits-and-conditions.md).
 * Phase 5 gives them timing: they're added, tick down and end. Their effects
 * plug into the hooks through effectSourcesFor (only Frozen has one so far).
 *
 * - Phase conditions tick at the end of every phase. One added during a
 *   phase skips that phase's tick, so "1 phase" means the next full phase.
 * - Day and night conditions tick at camp.
 * - Getting the same condition again keeps the longer time, unless the
 *   condition says it turns into another (Wet → Soaked).
 */
import { CONDITIONS } from '../content/conditions';
import { pushEvent } from './log';
import type { ConditionInstance, GameState, Hiker, NodeType } from './types';

type Unit = ConditionInstance['unit'];

/** Phases in a unit, to compare times across units (a day is 3 phases). */
const PHASES_PER: Record<Unit, number> = { phases: 1, days: 3, nights: 3 };

export function hasCondition(hiker: Hiker, id: string): boolean {
  return hiker.conditions.some((c) => c.id === id);
}

export function addCondition(
  state: GameState,
  hiker: Hiker,
  id: string,
  remaining: number,
  unit: Unit,
  cause: string,
  extra: { node?: NodeType; then?: ConditionInstance['then'] } = {},
): void {
  if (remaining <= 0 || hiker.status === 'abandoned') return;
  const def = CONDITIONS[id];
  const existing = hiker.conditions.find((c) => c.id === id);

  // Wet again → Soaked, for whichever is longer: the time left or the new time.
  if (existing && def?.again) {
    const phases = Math.max(
      existing.remaining * PHASES_PER[existing.unit],
      remaining * PHASES_PER[unit],
    );
    hiker.conditions = hiker.conditions.filter((c) => c !== existing);
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
    hiker.conditions.push({
      id,
      remaining,
      unit,
      ...(extra.node ? { node: extra.node } : {}),
      ...(extra.then ? { then: extra.then } : {}),
      ...(unit === 'phases' ? { fresh: true as const } : {}),
    });
  }
  pushEvent(state, { kind: 'condition', hikerId: hiker.id, condition: id, remaining, unit, cause });
}

export function removeCondition(state: GameState, hiker: Hiker, id: string): void {
  const before = hiker.conditions.length;
  hiker.conditions = hiker.conditions.filter((c) => c.id !== id);
  if (hiker.conditions.length < before) {
    pushEvent(state, { kind: 'conditionEnded', hikerId: hiker.id, condition: id });
  }
}

/** Ticks phase conditions (end of every phase) or day and night ones (camp). */
export function tickConditions(state: GameState, which: 'phases' | 'days'): void {
  for (const hiker of state.hikers) {
    const ended: ConditionInstance[] = [];
    for (const c of hiker.conditions) {
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
