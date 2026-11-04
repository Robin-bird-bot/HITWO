/**
 * Every tunable number in the game lives here (CLAUDE.md, architecture rule 3):
 * costs, thresholds, odds, rarity weights, XP, tree size and so on. The design
 * doc calls these "adjustable settings from day one".
 *
 * Engine code reads numbers from BALANCE and never hard-codes them. A guess
 * made while the docs are silent gets a `// TODO(wyatt):` comment.
 *
 * Phase 1 fills this in.
 */
export const BALANCE = {} as const;
