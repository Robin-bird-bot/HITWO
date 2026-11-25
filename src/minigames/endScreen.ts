/**
 * The end screen every minigame shares (docs/design/16-challenge-end-screen.md):
 * what it says. CHALLENGE PASSED when at least one hiker passed, CHALLENGE
 * FAILED when nobody did; a row per hiker in line order with their result
 * and what they pay; and, for a passing challenge, a line about the tile.
 */
import { BALANCE } from '../config/balance';
import type { MinigameResult, Pay } from './types';

const E = BALANCE.minigames.endScreen;

/** Whether the challenge was passed: at least one hiker passed. */
export const endPassed = (r: MinigameResult): boolean => r.safe.length > 0;

/** "CHALLENGE PASSED" or "CHALLENGE FAILED". */
export const endTitle = (r: MinigameResult): string =>
  endPassed(r) ? 'CHALLENGE PASSED' : 'CHALLENGE FAILED';

/** What a hiker pays, as the end screen writes it: "−1 RESOURCE, BLEEDING". */
export function costText(p: Pay | undefined): string {
  if (!p) return '';
  const parts: string[] = [];
  if (p.energy) parts.push(`−${p.energy} ENERGY`);
  if (p.resources) parts.push(`−${p.resources} RESOURCE${p.resources === 1 ? '' : 'S'}`);
  for (const c of p.conditions ?? []) parts.push(c.toUpperCase());
  return parts.join(', ');
}

export interface EndRow {
  id: string;
  passed: boolean;
  cost: string;
}

/** One row per hiker, in line order: passed or failed, and what they pay. */
export const endRows = (r: MinigameResult, order: readonly string[]): EndRow[] =>
  order.map((id) => ({
    id,
    passed: !r.hit.some((h) => h.hikerId === id),
    cost: costText(r.pays?.[id]),
  }));

/** What stands on the tile, for the tile line ("THE TREE"; "THE ANIMALS" take "STAY"). */
export interface TileThing {
  name: string;
  plural?: boolean;
}

/**
 * The line about the tile, for passing challenges only: "THE WAY IS CLEAR"
 * when it was cleared, "THE BEAR STAYS ON THE TILE" when nobody passed.
 */
export function tileLine(r: MinigameResult, thing: TileThing): string | null {
  if (!r.passing) return null;
  if (!r.passing.stays) return 'THE WAY IS CLEAR';
  return `THE ${thing.name.toUpperCase()} ${thing.plural ? 'STAY' : 'STAYS'} ON THE TILE`;
}

/** How the end screen comes in: red drips (failed), a clock wipe (passed), or a crossfade (reduced motion). */
export type EndTransition = 'drips' | 'wipe' | 'fade';

export const endTransition = (r: MinigameResult, reducedMotion: boolean): EndTransition =>
  reducedMotion ? 'fade' : endPassed(r) ? 'wipe' : 'drips';

/** How long the transition takes, until the end screen is fully in. */
export const transitionSec = (tr: EndTransition): number =>
  tr === 'fade' ? E.fadeSec : tr === 'wipe' ? E.wipeSec : E.drips.coverSec + E.drips.wipeSec;

/** Whether a tap continues yet: only a moment after the screen is in, so a late tap from the game doesn't skip it. */
export const canContinue = (t: number, tr: EndTransition): boolean =>
  t >= transitionSec(tr) + E.inputAfterSec;

/** Whether the title shows now: it flashes for a moment once the screen is in (never with reduced motion). */
export function titleShown(t: number, tr: EndTransition): boolean {
  if (tr === 'fade') return true;
  const shown = t - transitionSec(tr);
  if (shown < 0 || shown >= E.flash.forSec) return true;
  return shown % (E.flash.onSec + E.flash.offSec) < E.flash.onSec;
}
