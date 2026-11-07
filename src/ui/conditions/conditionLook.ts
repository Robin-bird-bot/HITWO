/**
 * How conditions look (Phase 6, step 1 mockup): an icon for each one, the ring
 * colors from CLAUDE.md, and short and long time-left wording.
 */
import type { IconName } from '../icons/paths';

/** One icon per condition, so they can be told apart at a glance. */
export const CONDITION_ICON: Record<string, IconName> = {
  // Negative
  sleepy: 'moon',
  nauseous: 'utensils',
  bored: 'heart',
  dejected: 'heart',
  inappetent: 'utensils',
  buzzed: 'zap',
  hangry: 'flame',
  foodPoisoning: 'utensils',
  blind: 'eye',
  sluggish: 'footprints',
  nightmares: 'moon',
  strained: 'battery',
  brainFog: 'cloud',
  allergies: 'sprout',
  unlucky: 'dice',
  wet: 'droplet',
  soaked: 'rain',
  inept: 'hammer',
  clumsy: 'hammer',
  weak: 'backpack',
  butterfingers: 'bag',
  tunnelVision: 'search',
  frozen: 'snowflake',
  bleeding: 'medical',
  ringingEars: 'ear',
  shivering: 'snowflake',
  burning: 'flame',
  napping: 'moon',
  // Positive
  refreshed: 'battery',
  full: 'utensils',
  sated: 'utensils',
  energized: 'zap',
  lucky: 'dice',
  inspired: 'sparkles',
  motivated: 'star',
  raccoonFriend: 'paw',
};

/** Ring colors (CLAUDE.md): positive, negative, threshold state, and injury (solid). */
export type ConditionTone = 'positive' | 'negative' | 'state' | 'injury';

export const TONE_LOOK: Record<ConditionTone, { ring: string; bg: string; fg: string }> = {
  positive: { ring: '#7FC29B', bg: 'rgba(127,194,155,0.16)', fg: '#A6DDBC' },
  negative: { ring: '#E5624A', bg: 'rgba(229,98,74,0.16)', fg: '#F39A86' },
  state: { ring: '#E9B44C', bg: 'rgba(233,180,76,0.16)', fg: '#F2C978' },
  injury: { ring: '#E5624A', bg: '#E5624A', fg: '#1D2220' },
};

/** What a badge shows: everything a glance needs, and the one-line description. */
export interface ConditionLook {
  key: string;
  name: string;
  /** The one-line effect, from 02-traits-and-conditions.md. */
  text: string;
  icon: IconName;
  tone: ConditionTone;
  /** "2d", "3ph", or "SNOW" / "HEAT" for weather conditions. Threshold states have none. */
  short?: string;
  /** "2 more days", "Until the snow ends". */
  long?: string;
  /** Shivering and Burning. */
  stacks?: number;
}

const UNIT = {
  days: ['d', 'day'],
  phases: ['ph', 'phase'],
  nights: ['n', 'night'],
} as const;

export function timeWords(
  remaining: number,
  unit: keyof typeof UNIT,
): { short: string; long: string } {
  const [s, word] = UNIT[unit];
  return {
    short: `${remaining}${s}`,
    long: `${remaining} more ${word}${remaining === 1 ? '' : 's'}`,
  };
}
