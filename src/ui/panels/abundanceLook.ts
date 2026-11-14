/**
 * How the one Abundance bar looks (Nov 14 update): green when full, through
 * gold, to red when empty, and a tooltip with the Empty-card chance.
 */
import { BALANCE } from '../../config/balance';
import { emptyChance } from '../../engine';

/** The bar's colors: empty, half and full (the condition-ring red, accent gold and green). */
const STOPS = ['#E5624A', '#E9B44C', '#7FC29B'] as const;

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The bar's color at this level, blended evenly between the stops. */
export function abundanceColor(level: number, max = BALANCE.abundance.max): string {
  const t = Math.max(0, Math.min(1, level / max)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(t));
  const a = channels(STOPS[i] ?? STOPS[0]);
  const b = channels(STOPS[i + 1] ?? STOPS[2]);
  const mix = a.map((c, k) => Math.round(c + ((b[k] ?? c) - c) * (t - i)));
  return `#${mix
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** The Empty-card chance as a whole percent. */
export const emptyPercent = (level: number) => Math.round(emptyChance(level) * 100);

/** The tooltip: the level, and what it means when scavenging. */
export function abundanceTip(level: number): string {
  return `Abundance ${level} of ${BALANCE.abundance.max}. Each resource card has a ${emptyPercent(level)}% chance to be Empty.`;
}
