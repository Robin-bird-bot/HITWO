/**
 * The attack library (docs/design/12-minigames-dodge.md, section 6): every
 * attack by id, and every kind of part's rules by kind.
 */
import { BALANCE } from '../../config/balance';
import { BEE_ATTACKS, BEE_RULES } from './attacks/bees';
import { BEAR_ATTACKS, BITE_RULES, CLAWS_RULES } from './attacks/bear';
import { BOBCAT_ATTACKS, POUNCE_RULES } from './attacks/bobcat';
import { CLAUDE_RULES, CLAUDES_IDEAS } from './attacks/claudesIdeas';
import {
  ACORN_RULES,
  BOMB_RULES,
  CRUMBS_RULES,
  SHRAPNEL_RULES,
  SQUIRREL_ATTACKS,
} from './attacks/squirrels';
import { JAB_RULES, POKE_RULES, SWING_RULES, SWORD_ATTACKS } from './attacks/sword';
import type { AttackDef, AttackId, Part, PartRules, Tier } from './types';

export const ATTACKS: Readonly<Record<AttackId, AttackDef>> = Object.fromEntries(
  [
    ...BEE_ATTACKS,
    ...SWORD_ATTACKS,
    ...BEAR_ATTACKS,
    ...BOBCAT_ATTACKS,
    ...SQUIRREL_ATTACKS,
    ...CLAUDES_IDEAS,
  ].map((a) => [a.id, a]),
) as Record<AttackId, AttackDef>;

/** The first tier an attack shows up on. */
export const unlockTier = (id: AttackId): Tier =>
  (BALANCE.minigames.dodge.unlocks[id] as Tier | undefined) ?? 1;

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
  ...CLAUDE_RULES,
};

/** A part's rules. */
export const rulesFor = (p: Part): PartRules<Part> => RULES[p.kind] as PartRules<Part>;
