/**
 * The attack library (docs/design/12-minigames-dodge.md, section 6): every
 * attack by id, and every kind of part's rules by kind.
 */
import { BALANCE } from '../../config/balance';
import { BEE_ATTACKS, BEE_RULES } from './attacks/bees';
import { BEAR_ATTACKS, BITE_RULES, CLAWS_RULES } from './attacks/bear';
import { BOBCAT_ATTACKS, POUNCE_RULES, STALK_RULES } from './attacks/bobcat';
import { CLAUDE_RULES, CLAUDES_IDEAS } from './attacks/claudesIdeas';
import { MONSTER_ATTACKS, MONSTER_RULES } from './attacks/monster';
import {
  ACORN_RULES,
  BOMB_RULES,
  CRUMBS_RULES,
  SHRAPNEL_RULES,
  SQUIRREL_ATTACKS,
} from './attacks/squirrels';
import { JAB_RULES, POKE_RULES, SWING_RULES, SWORD_ATTACKS, WAVE_RULES } from './attacks/sword';
import type { AttackDef, AttackId, Level, Part, PartRules } from './types';

const D = BALANCE.minigames.dodge;

/** A level as a number: 0 is Easy, then Levels 1, 2 and 3. */
export type Rank = 0 | 1 | 2 | 3;

export const ATTACKS: Readonly<Record<AttackId, AttackDef>> = Object.fromEntries(
  [
    ...BEE_ATTACKS,
    ...SWORD_ATTACKS,
    ...BEAR_ATTACKS,
    ...BOBCAT_ATTACKS,
    ...SQUIRREL_ATTACKS,
    ...CLAUDES_IDEAS,
    ...MONSTER_ATTACKS,
  ].map((a) => [a.id, a]),
) as Record<AttackId, AttackDef>;

/** The first level an attack shows up on (Easy counts as Level 1). */
export const unlockLevel = (id: AttackId): Level => (D.unlocks[id] as Level | undefined) ?? 1;

const RANKS: readonly Rank[] = [0, 1, 2, 3];

/** The levels a bee pattern plays at, or none for an attack that isn't one. */
const beeRanks = (id: AttackId): Rank[] => RANKS.filter((r) => D.bees.levels[r].includes(id));

/**
 * The levels an attack plays at: a bee pattern's own list; anything else
 * from its first level up (Easy plays Level 1's attacks).
 */
export function ranksOf(id: AttackId): Rank[] {
  const bees = beeRanks(id);
  return bees.length ? bees : RANKS.filter((r) => Math.max(1, r) >= unlockLevel(id));
}

/** Whether an attack plays at a level. */
export const playsAt = (id: AttackId, rank: Rank): boolean => ranksOf(id).includes(rank);

const RULES: { [K in Part['kind']]: PartRules<Extract<Part, { kind: K }>> } = {
  bee: BEE_RULES,
  swing: SWING_RULES,
  jab: JAB_RULES,
  poke: POKE_RULES,
  claws: CLAWS_RULES,
  bite: BITE_RULES,
  pounce: POUNCE_RULES,
  acorn: ACORN_RULES,
  bomb: BOMB_RULES,
  shrapnel: SHRAPNEL_RULES,
  crumbs: CRUMBS_RULES,
  wave: WAVE_RULES,
  stalk: STALK_RULES,
  ...CLAUDE_RULES,
  ...MONSTER_RULES,
};

/** A part's rules. */
export const rulesFor = (p: Part): PartRules<Part> => RULES[p.kind] as PartRules<Part>;
