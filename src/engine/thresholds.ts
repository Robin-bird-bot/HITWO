/**
 * Threshold states: Hungry, Famished, Fatigued and Exhausted. They are worked
 * out from the stats every time, never stored, and they plug into the same
 * hooks as traits.
 */
import { BALANCE } from '../config/balance';
import type { ActQuery, EffectSource } from './effects';
import { moraleLuck } from './scavenge/rarity';
import type { Action, Hiker } from './types';

const T = BALANCE.thresholds;

export const isHungry = (h: Hiker) => h.stats.appetite <= T.hungry;
export const isFamished = (h: Hiker) => h.stats.appetite <= T.famished;
export const isFatigued = (h: Hiker) => h.stats.energy <= T.fatigued;
export const isExhausted = (h: Hiker) => h.stats.energy <= T.exhausted;

export type ThresholdState = 'hungry' | 'famished' | 'fatigued' | 'exhausted';

export function thresholdStates(h: Hiker): ThresholdState[] {
  const out: ThresholdState[] = [];
  if (isHungry(h)) out.push('hungry');
  if (isFamished(h)) out.push('famished');
  if (isFatigued(h)) out.push('fatigued');
  if (isExhausted(h)) out.push('exhausted');
  return out;
}

const isMove = (a: Action) => a.type === 'move' || a.type === 'moveAll';
/** Free actions (abilities, eating, using a tool) don't count: Exhausted only stops the phase's action. */
const FREE: readonly ActQuery['action']['type'][] = ['useAbility', 'eat', 'useItem'];
const usesAction = (q: ActQuery) => q.role === 'brought' || !FREE.includes(q.action.type);
const isSleep = (q: ActQuery) => q.role === 'actor' && q.action.type === 'sleep';
const canBeBrought = BALANCE.rules.exhaustedOrFatiguedCanBeBrought;

export function thresholdSources(h: Hiker): EffectSource[] {
  const sources: EffectSource[] = [];

  if (isExhausted(h)) {
    sources.push({
      id: 'threshold:exhausted',
      kind: 'threshold',
      name: 'Exhausted',
      hooks: {
        canAct(q) {
          if (!usesAction(q) || isSleep(q)) return undefined;
          if (q.role === 'brought' && canBeBrought) return undefined;
          return `Exhausted: can only sleep (Energy ${T.exhausted} or less).`;
        },
      },
    });
  } else if (isFatigued(h)) {
    sources.push({
      id: 'threshold:fatigued',
      kind: 'threshold',
      name: 'Fatigued',
      hooks: {
        canAct(q) {
          if (q.phase !== 'night' || !usesAction(q) || isSleep(q)) return undefined;
          if (q.role === 'brought' && canBeBrought) return undefined;
          return `Fatigued: can only sleep at night (Energy ${T.fatigued} or less).`;
        },
      },
    });
  }

  if (isFamished(h)) {
    sources.push({
      id: 'threshold:famished',
      kind: 'threshold',
      name: 'Famished',
      hooks: {
        canAct(q) {
          if (q.role !== 'actor') return undefined;
          if (q.action.type === 'scavenge') {
            return `Famished: too hungry to scavenge (Appetite ${T.famished} or less).`;
          }
          if (!isMove(q.action)) return undefined;
          return `Famished: too hungry to move (Appetite ${T.famished} or less).`;
        },
      },
    });
  }

  if (isHungry(h)) {
    sources.push({
      id: 'threshold:hungry',
      kind: 'threshold',
      name: 'Hungry',
      hooks: {
        canAct(q) {
          if (q.role !== 'actor') return undefined;
          if (q.action.type === 'scavenge') {
            return `Hungry: too hungry to scavenge (Appetite ${T.hungry} or less).`;
          }
          if (q.action.type !== 'moveAll') return undefined;
          return `Hungry: can't move the group (Appetite ${T.hungry} or less).`;
        },
      },
    });
  }

  // Morale sets a base Luck (Wyatt, Nov 5: −2 at 0, 0 at 5, +2 at 10).
  const luck = moraleLuck(h.stats.morale);
  if (luck !== 0) {
    const high = luck > 0;
    sources.push({
      id: 'morale:luck',
      kind: 'threshold',
      name: high ? 'High Morale' : 'Low Morale',
      hooks: {
        modifyScavenge: () => ({
          source: high ? 'High Morale' : 'Low Morale',
          label: `Luck ${high ? '+' : '−'}${Math.abs(luck)} from Morale (${h.stats.morale})`,
          tone: high ? 'luck' : 'warning',
          luck,
        }),
        // The same Luck shifts a crafted item's Quality.
        modifyCraft: () => ({
          source: high ? 'High Morale' : 'Low Morale',
          label: `Luck ${high ? '+' : '−'}${Math.abs(luck)} from Morale (${h.stats.morale})`,
          tone: high ? 'luck' : 'warning',
          luck,
        }),
      },
    });
  }

  return sources;
}
