/**
 * Difficulty (Phase 10.6, docs/design/08-overhaul-plan.md): every number a
 * difficulty changes, in one place. The game always plays on Medium for now;
 * there's no player-facing choice yet. The debug panel can switch it, and the
 * change applies to the next section made.
 *
 * Numbers in [brackets] in the update are first guesses: TODO(wyatt).
 */
export type DifficultyId = 'easy' | 'medium' | 'hard' | 'nightmare';

export const DIFFICULTY_IDS: readonly DifficultyId[] = ['easy', 'medium', 'hard', 'nightmare'];

export interface DifficultySettings {
  name: string;
  /** The share of plain tiles that hold a challenge when a section is made. */
  challengeShare: number;
  /** Plain tiles without a challenge that get an opportunity, per section. */
  opportunitiesPerSection: number;
  /** A multiplier on the section's middle rows (BALANCE.trail.middleRows), rounded. */
  sectionRows: number;
  /** Added to every tile's challenge tier. */
  challengeTierOffset: number;
  /**
   * Not used yet (the same at every level): added to every hiker's Luck,
   * scaling the odds of every rarity above Common, scaling the Appetite actions
   * cost, and scaling the night event odds. Each plugs in when difficulties
   * are built (Luck in thresholds.ts, rarity in scavenge/deal.ts, Appetite in
   * costs.ts). The night event odds already use theirs.
   */
  luckBonus: number;
  rarityMultiplier: number;
  appetiteDrainMultiplier: number;
  nightEventChanceMultiplier: number;
  /** Starting kit picks: today's for every level (null means "as now"). */
  startingKitPicks: number | null;
}

/**
 * Half the map is challenges and the rest is empty, at every difficulty, with
 * no opportunities for now (29-core-loop.md, section 5; Wyatt: "only about
 * 50% of the spaces are occupied by challenges, with the rest being empty.
 * We'll incorporate opportunities later"). Difficulties still differ in
 * section rows. TODO(wyatt): [50%].
 */
const MAP = { challengeShare: 0.5, opportunitiesPerSection: 0 } as const;

const SAME = {
  challengeTierOffset: 0,
  luckBonus: 0,
  rarityMultiplier: 1,
  appetiteDrainMultiplier: 1,
  nightEventChanceMultiplier: 1,
  startingKitPicks: null,
} as const;

export const DIFFICULTY: Readonly<Record<DifficultyId, DifficultySettings>> = {
  /** TODO(wyatt): section rows ×[0.8]. (Before Nov 27: 25% challenges, 3 opportunities.) */
  easy: {
    name: 'Easy',
    ...MAP,
    sectionRows: 0.8,
    ...SAME,
  },
  /** (Before Nov 27: 2 opportunities.) */
  medium: {
    name: 'Medium',
    ...MAP,
    sectionRows: 1,
    ...SAME,
  },
  /** TODO(wyatt): section rows ×[1.2]. (Before Nov 27: 75% challenges, 1 opportunity.) */
  hard: {
    name: 'Hard',
    ...MAP,
    sectionRows: 1.2,
    ...SAME,
  },
  /** TODO(wyatt): section rows ×[1.4]. (Before Nov 27: every plain tile a challenge.) */
  nightmare: {
    name: 'Nightmare',
    ...MAP,
    sectionRows: 1.4,
    ...SAME,
  },
};

/** Always Medium for now. */
export const DEFAULT_DIFFICULTY: DifficultyId = 'medium';

/**
 * Spread challenges out: no path from the trailhead to the checkpoint should
 * have more than this many challenge tiles in a row, if it can be avoided.
 * TODO(wyatt): [3].
 */
export const MAX_CHALLENGES_IN_A_ROW = 3;

export const difficultyOf = (state: { difficulty?: DifficultyId }): DifficultySettings =>
  DIFFICULTY[state.difficulty ?? DEFAULT_DIFFICULTY];
