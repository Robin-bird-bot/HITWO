/**
 * Wonders as data (04-challenges.md, "Wonders"; Nov 6 update, 3). Each Wonder
 * has 5 goals (3 are picked when it's revealed) and 3 rewards (each hiker on
 * the tile picks 1). Goals and rewards are kinds the engine knows; nothing in
 * the engine names a Wonder.
 */
import type { ItemType } from '../effects';
import type { ConditionId, HikerId, ItemId, NodeType, ResourceId, StatName } from '../types';

/**
 * A goal's number: X[n+] is "at least", X[n−] "at most". Each biome after the
 * first scales it by BALANCE.wonders.biomeScale (an "at most" shrinks). A
 * number written without an X in the doc doesn't scale.
 */
export interface GoalNumber {
  base: number;
  compare: 'atLeast' | 'atMost' | 'moreThan' | 'lessThan';
  scales?: false;
}

/** What a goal checks, against only the hikers on the Wonder's tile. */
export type GoalCheck =
  /** They carry X of these resources between them, any mix. */
  | { kind: 'carryAny'; resources: readonly ResourceId[] }
  /** They carry X resources between them. */
  | { kind: 'carryTotal' }
  /** One hiker carries X of a single resource (from the list, or any). */
  | { kind: 'oneCarriesOne'; resources?: readonly ResourceId[] }
  /** One hiker carries X resources of every node type. */
  | { kind: 'oneCarriesEachNode' }
  /** Every hiker here carries X of a resource. */
  | { kind: 'eachCarries'; resource: ResourceId }
  /** They have X conditions of a kind between them. */
  | { kind: 'conditions'; which: 'negative' | 'positive' }
  /** A stat added up across them. */
  | { kind: 'statTotal'; stat: StatName }
  /** Every hiker here has X of a stat. */
  | { kind: 'eachStat'; stat: StatName }
  /** Every hiker here has the same value of a stat. */
  | { kind: 'sameStat'; stat: StatName }
  /** One hiker has `low` or less of a stat and another has `high` or more. */
  | { kind: 'spread'; stat: StatName; low: number; high: number }
  /** One hiker has every stat full. */
  | { kind: 'fullStats' }
  /** No hiker here has an injury. */
  | { kind: 'noInjuries' }
  /** The party purse holds X caps. */
  | { kind: 'caps' }
  /** A node type's Abundance is X. */
  | { kind: 'abundance'; node: NodeType }
  /** They carry X items of a type between them. */
  | { kind: 'itemsOfType'; type: ItemType }
  /** One hiker here has a run counter of X (challenges passed or failed, nights without sleep). */
  | { kind: 'counter'; counter: 'passed' | 'failed' | 'daysSinceSleep' }
  /** X shelters have been placed in this biome. */
  | { kind: 'sheltersPlaced' }
  /** X hikers are on the tile. */
  | { kind: 'hikersHere' }
  /** One hiker here is level X. */
  | { kind: 'level' }
  /** Every hiker here is in one of these threshold states. */
  | { kind: 'eachThreshold'; states: readonly ('fatigued' | 'exhausted')[] }
  /** One hiker here has one of these conditions. */
  | { kind: 'oneHasCondition'; conditions: readonly ConditionId[] }
  /** There's a weather right now (not Clear). */
  | { kind: 'weatherActive' }
  /** The hikers here have X clothing durability between them (Fort Rock). */
  | { kind: 'clothesDurability' }
  /** One hiker here has X clothing items equipped (Pittock Mansion). */
  | { kind: 'clothesWorn' }
  /** One hiker here has crafted X items of one type (Multnomah Falls). */
  | { kind: 'craftedOfType' }
  /** Needs a system that isn't built yet; never picked until then. */
  | { kind: 'waiting' };

export interface WonderGoalDef {
  /** The checklist line. `{x}` is the scaled number. */
  text: string;
  check: GoalCheck;
  x?: GoalNumber;
  /** A goal that needs a later system is left out when the 3 are picked. */
  waitingOn?: string;
}

/** What a reward gives the hiker who picks it. */
export type WonderReward =
  | { kind: 'xp' }
  | { kind: 'caps' }
  /** One of the 3 Tier III items rolled at reveal; no two hikers take the same one. */
  | { kind: 'tier3' }
  | { kind: 'shelters'; count: number }
  /** Raise one node type's Abundance (the hiker's choice). */
  | { kind: 'abundance'; amount: number }
  | { kind: 'cureInjuries' }
  /** Reveal every challenge in this biome. */
  | { kind: 'revealBiome' }
  | { kind: 'energized'; energy: number; days: number }
  | { kind: 'maxStat'; stat: StatName; amount: number }
  /** Every negative condition becomes a random positive one. */
  | { kind: 'flipConditions'; days: number }
  /** Double the current and full durability of one equipped clothing item (Fort Rock). */
  | { kind: 'doubleDurability' }
  /** Needs a system that isn't built yet: shown greyed out. */
  | { kind: 'waiting' };

export interface WonderRewardDef {
  title: string;
  text: string;
  reward: WonderReward;
  /** At most this many hikers can pick it (Fort Rock's shelters). */
  maxTakers?: number;
  waitingOn?: string;
}

export interface WonderDef {
  id: string;
  name: string;
  /** Wyatt is writing these. */
  description?: string;
  goals: readonly WonderGoalDef[];
  rewards: readonly WonderRewardDef[];
}

/** One hiker's reward pick. */
export interface WonderPick {
  /** Which of the 3 rewards (0–2). */
  reward: number;
  /** The Tier III item, for a "pick 1 of 3". */
  itemId?: ItemId;
  /** The node type, for +Abundance. */
  node?: NodeType;
}

/** A Wonder on its tile: hidden, then revealed with its 3 goals, then accomplished. */
export interface WonderState {
  id: string;
  /** Hidden node badges it shows until revealed, so it looks like any tile. */
  decoys: number;
  /** Set when revealed: the 3 goals (index into the Wonder's 5) and their numbers. */
  goals?: { index: number; x?: number }[];
  /** The 3 Tier III items for "pick 1 of 3", rolled at reveal. */
  tier3?: ItemId[];
  /** Who took which reward. Set once it's accomplished. */
  claimed?: Record<HikerId, WonderPick>;
}
