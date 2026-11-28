/**
 * A card flipping face up (32-audio-system.md, section 6; 35-ui-overhaul.md,
 * section 5): `card.flip`, then one chime per rarity step up to its own, a
 * moment apart, like a slot machine. Common just snaps; Uncommon adds one
 * chime; Mythic adds five.
 */
import { BALANCE } from '../config/balance';
import { RARITIES, type Rarity } from '../engine';
import type { Cue } from './gameSounds';

const STEPS: Record<Exclude<Rarity, 'common'>, string> = {
  uncommon: 'card.reveal.uncommon',
  rare: 'card.reveal.rare',
  veryRare: 'card.reveal.veryRare',
  legendary: 'card.reveal.legendary',
  mythic: 'card.reveal.mythic',
};

/** The flip and its chimes, `start` seconds from now. */
export function revealCues(rarity: Rarity, start = 0): Cue[] {
  const gap = BALANCE.audio.revealGapMs / 1000;
  const up = RARITIES.slice(1, RARITIES.indexOf(rarity) + 1) as Exclude<Rarity, 'common'>[];
  return [
    { id: 'card.flip', ...(start ? { delay: start } : {}) },
    ...up.map((r, i) => ({ id: STEPS[r], delay: start + (i + 1) * gap })),
  ];
}
