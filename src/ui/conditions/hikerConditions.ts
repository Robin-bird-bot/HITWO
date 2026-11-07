/**
 * A hiker's conditions as badges (the approved Phase 6 mockup): threshold
 * states, timed conditions with their time left, and stacking ones with their
 * count. Shivering at 3 or more also shows Frozen.
 */
import { BALANCE } from '../../config/balance';
import { CONDITIONS } from '../../content/conditions';
import { thresholdStates, type ConditionInstance, type Hiker } from '../../engine';
import { NODE_NAME } from '../map/looks';
import { CONDITION_ICON, timeWords, type ConditionLook } from './conditionLook';

/** What a weather-long condition shows as its time: the weather it lasts through. */
const WEATHER_TIME: Record<string, { short: string; long: string }> = {
  shivering: { short: 'SNOW', long: 'Until the snow ends' },
  burning: { short: 'HEAT', long: 'Until the heatwave ends' },
};

const THRESHOLD_LOOKS: Record<string, Omit<ConditionLook, 'tone'>> = {
  famished: {
    key: 'famished',
    name: 'Famished',
    text: `Can’t move or scavenge (Appetite ${BALANCE.thresholds.famished} or less).`,
    icon: 'utensils',
  },
  hungry: {
    key: 'hungry',
    name: 'Hungry',
    text: `Can’t scavenge or move the group (Appetite ${BALANCE.thresholds.hungry} or less).`,
    icon: 'utensils',
  },
  exhausted: {
    key: 'exhausted',
    name: 'Exhausted',
    text: `Can only sleep (Energy ${BALANCE.thresholds.exhausted} or less).`,
    icon: 'battery',
  },
  fatigued: {
    key: 'fatigued',
    name: 'Fatigued',
    text: `At night, can only sleep (Energy ${BALANCE.thresholds.fatigued} or less).`,
    icon: 'battery',
  },
};

/** Hungry and Fatigued, or the worse Famished and Exhausted in their place. */
export function thresholdLooks(h: Hiker): ConditionLook[] {
  const states = thresholdStates(h);
  const shown = [
    states.includes('famished') ? 'famished' : states.includes('hungry') ? 'hungry' : undefined,
    states.includes('exhausted')
      ? 'exhausted'
      : states.includes('fatigued')
        ? 'fatigued'
        : undefined,
  ];
  return shown.flatMap((k) => {
    const look = k ? THRESHOLD_LOOKS[k] : undefined;
    return look ? [{ ...look, tone: 'state' as const }] : [];
  });
}

function timeOf(c: ConditionInstance): { short: string; long: string } | undefined {
  if (c.unit === 'weather')
    return WEATHER_TIME[c.id] ?? { short: 'WX', long: 'Until the weather ends' };
  return timeWords(c.remaining, c.unit);
}

/** One badge per condition, plus Frozen while Shivering is high enough. */
export function timedLooks(h: Hiker): ConditionLook[] {
  const out: ConditionLook[] = [];
  for (const c of h.conditions) {
    const def = CONDITIONS[c.id];
    const time = timeOf(c);
    const node = c.node ? ` (${NODE_NAME[c.node]})` : '';
    out.push({
      key: c.id,
      name: `${def?.name ?? c.id}${node}`,
      text: def?.text ?? '',
      icon: CONDITION_ICON[c.id] ?? 'alert',
      tone: def?.kind === 'positive' ? 'positive' : 'negative',
      ...(time ? time : {}),
      ...(c.stacks !== undefined ? { stacks: c.stacks } : {}),
    });
    const frozenAt = def?.stacking?.frozenAt;
    if (frozenAt !== undefined && (c.stacks ?? 0) >= frozenAt) {
      out.push({
        key: `${c.id}:frozen`,
        name: 'Frozen',
        text: `Can’t move or be moved while ${def?.name ?? c.id} is ${frozenAt} or more.`,
        icon: 'snowflake',
        tone: 'negative',
        short: time?.short ?? '',
        long: `Until ${def?.name ?? c.id} drops below ${frozenAt}`,
      });
    }
  }
  return out;
}

/** The injury badge, for lists that show injuries as badges. */
export function injuryLook(h: Hiker): ConditionLook | undefined {
  if (h.injuries <= 0) return undefined;
  const of = BALANCE.injuries.passOutAt;
  return {
    key: 'injury',
    name: h.injuries === 1 ? '1 injury' : `${h.injuries} injuries`,
    text: `Strikes: the ${of}${of === 3 ? 'rd' : 'th'} one makes this hiker pass out.`,
    icon: 'medical',
    tone: 'injury',
    long: `${h.injuries} of ${of}`,
  };
}

/** Counts for a map token's corner: bad and good conditions. */
export function conditionCounts(h: Hiker): { bad: number; good: number } {
  let bad = 0;
  let good = 0;
  for (const c of h.conditions) {
    if (CONDITIONS[c.id]?.kind === 'positive') good += 1;
    else bad += 1;
  }
  return { bad, good };
}
