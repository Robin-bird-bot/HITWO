/**
 * Little builders for challenge, opportunity and Trial content, so each card
 * reads close to the docs (src/content/challenges.ts and
 * src/content/minigameChallenges.ts use them).
 */
import { BALANCE } from '../config/balance';
import type { CategoryId } from './resources';
import type {
  Amount,
  ChallengeDef,
  CostOption,
  Effect,
  Requirement,
  ResourceFilter,
  RollDef,
  TrialDef,
} from '../engine/challenges/types';
import type { ItemType } from '../engine/effects';
import type { NodeType, StatName } from '../engine/types';

// ── Little builders, so each card reads close to the doc ────────────────────

export const F: NodeType = 'forest';
export const R: NodeType = 'river';
export const W: NodeType = 'wildlife';
export const M: NodeType = 'mountain';

export const X = (min: number, max: number, reverse = false): RollDef => ({
  roll: 'x',
  range: [min, max],
  ...(reverse ? { reverse: true as const } : {}),
});
export const Y = (min: number, max: number): RollDef => ({ roll: 'y', range: [min, max] });

export const nodesOf = (...nodes: NodeType[]): ResourceFilter => ({ nodes });
export const idsOf = (...ids: string[]): ResourceFilter => ({ ids });

export const res = (
  count: Amount,
  filter?: ResourceFilter,
  extra: Partial<Extract<Requirement, { kind: 'resources' }>> = {},
): Requirement => ({ kind: 'resources', count, ...(filter ? { filter } : {}), ...extra });
export const items = (count: Amount, ...itemTypes: ItemType[]): Requirement => ({
  kind: 'items',
  count,
  ...(itemTypes.length ? { itemTypes } : {}),
});
export const caps = (count: Amount): Requirement => ({ kind: 'caps', count });
export const stat = (count: Amount, ...stats: StatName[]): Requirement => ({
  kind: 'stat',
  stats,
  count,
});
export const durability = (
  count: Amount,
  extra: { slot?: 'gear'; oneItem?: true } = {},
): Requirement => ({
  kind: 'durability',
  count,
  ...extra,
});

export type Unit = 'phases' | 'days' | 'nights';
export const cond = (
  id: string,
  duration: Amount,
  unit: Unit,
  extra: Partial<Effect> = {},
): Effect => ({ op: 'condition', id, duration, unit, ...extra }) as Effect;
export const injury = (extra: Partial<Effect> = {}): Effect =>
  ({ op: 'injury', ...extra }) as Effect;
export const lose = (s: StatName, n: Amount, extra: Partial<Effect> = {}): Effect =>
  ({ op: 'stat', stat: s, delta: n, lose: true, ...extra }) as Effect;

export const DESCRIPTION = 'Placeholder text';

export type ChallengeInput = Omit<ChallengeDef, 'id' | 'kind' | 'description' | 'art'> & {
  kind?: 'challenge' | 'opportunity';
  art?: boolean;
};
export type TrialInput = Omit<TrialDef, 'id' | 'kind' | 'description' | 'art'> & { art?: boolean };

/** "Bear With a Gun!!" → "bear-with-a-gun": the id, and the art's file name. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ch(input: ChallengeInput): ChallengeDef {
  return {
    kind: 'challenge',
    // Every challenge and Trial has art (Nov 6 update).
    art: true,
    ...input,
    id: slug(input.name),
    description: DESCRIPTION,
    descriptionPlaceholder: true,
  } as ChallengeDef;
}

/** Every Trial is switched off for now (Phase 10.6), Rocco Raccoon's included. */
export function trial(input: TrialInput): TrialDef {
  return {
    art: true,
    ...input,
    id: slug(input.name),
    kind: 'trial',
    enabled: false,
    description: DESCRIPTION,
    descriptionPlaceholder: true,
  } as TrialDef;
}

export const opt = (...reqs: Requirement[]): CostOption => reqs;

// ── The punishments (docs/design/24-challenges-reset.md, section 2) ────────
// X (Energy, Appetite, random resources, a category) and Y (Bleeding) come
// from the punishment table at the tile's tier. Every card in the Nov 26 list
// also rolls `backup`, the X Energy a punishment that takes nothing costs.

const PT = BALANCE.challenges.punish;

/** The punishment table's X, rolled once for the card. */
export const PX = (): RollDef => ({ roll: 'x', range: PT.x[1], byTier: PT.x });
/** Bleeding's Y, rolled for each hiker. */
export const PY = (): RollDef => ({ roll: 'y', range: PT.bleeding[1], byTier: PT.bleeding });

/** The punishments, reading the rolls `x` and `y`. */
export const P = {
  energy: lose('energy', 'x'),
  appetite: lose('appetite', 'x'),
  bleeding: cond('bleeding', 'y', 'phases'),
  injury: injury(),
  back: { op: 'move', how: 'cameFrom' } as Effect,
  random: { op: 'loseResources', count: 'x', from: 'hiker' } as Effect,
  randomParty: { op: 'loseResources', count: 'x', from: 'party' } as Effect,
  singles: { op: 'loseSingles' } as Effect,
  bigStacks: { op: 'loseBigStacks' } as Effect,
  most: { op: 'loseMost' } as Effect,
  category: (category: CategoryId): Effect => ({ op: 'loseCategory', category, count: 'x' }),
} as const;

/** A part of a punishment only from (or up to) a tier: "1 injury from Tier III". */
export const fromTier = (e: Effect, tier: number): Effect => ({ ...e, fromTier: tier });
export const upToTier = (e: Effect, tier: number): Effect => ({ ...e, upToTier: tier });

/**
 * A challenge in the Nov 26 list: its punishment follows the backup rule,
 * and it rolls the punishment table's X and Y (and `backup`) when they're used.
 */
export function listed(input: ChallengeInput): ChallengeDef {
  return ch({
    ...input,
    backup: true,
    rolls: { x: PX(), y: PY(), backup: PX(), ...(input.rolls ?? {}) },
  });
}
