/**
 * Luck and rarity odds (Wyatt, Nov 4). Each point of Luck moves the odds a
 * fifth of the way from the Luck 0 row toward the Luck +5 row (or toward the
 * Luck −5 row when negative). Luck can be fractional: Morale gives 0.4 per
 * point (Nov 5).
 */
import { BALANCE } from '../../config/balance';
import { weightedPick } from '../rng';
import { RARITIES, type Rarity, type RngState } from '../types';

export function clampLuck(luck: number): number {
  return Math.max(BALANCE.luck.min, Math.min(BALANCE.luck.max, luck));
}

/**
 * Base Luck from Morale: −2 at 0, 0 at 5, +2 at 10, in even steps (Wyatt,
 * Nov 5). Morale above 10 (from a positive condition) counts as 10.
 */
export function moraleLuck(morale: number): number {
  const { atZero, atTen } = BALANCE.luck.fromMorale;
  const m = Math.max(BALANCE.stats.min, Math.min(BALANCE.stats.max, morale));
  const luck = atZero + ((atTen - atZero) * m) / BALANCE.stats.max;
  // Keep one decimal so 0.4 steps don't pick up floating-point dust.
  return Math.round(luck * 10) / 10;
}

/** Each rarity's chance (0–1, adding up to 1) at this Luck. */
export function rarityOdds(luck: number): Record<Rarity, number> {
  const rows = [...BALANCE.scavenge.rarityByLuck].sort((a, b) => a.luck - b.luck);
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) throw new Error('rarityOdds(): no rarity rows in balance.ts');
  const l = Math.max(first.luck, Math.min(last.luck, luck));

  let lo = first;
  let hi = last;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a && b && l >= a.luck && l <= b.luck) {
      lo = a;
      hi = b;
      break;
    }
  }
  const t = hi.luck === lo.luck ? 0 : (l - lo.luck) / (hi.luck - lo.luck);
  const raw = Object.fromEntries(
    RARITIES.map((r) => [r, lo.odds[r] + (hi.odds[r] - lo.odds[r]) * t]),
  ) as Record<Rarity, number>;
  const total = RARITIES.reduce((sum, r) => sum + raw[r], 0);
  return Object.fromEntries(RARITIES.map((r) => [r, raw[r] / total])) as Record<Rarity, number>;
}

export function rollRarity(rng: RngState, luck: number): Rarity {
  const odds = rarityOdds(luck);
  return weightedPick(
    rng,
    RARITIES.map((r) => ({ item: r, weight: odds[r] })),
  );
}

/** The next rarity down (Common stays Common). */
export function stepDown(rarity: Rarity): Rarity {
  return RARITIES[Math.max(0, RARITIES.indexOf(rarity) - 1)] ?? 'common';
}
