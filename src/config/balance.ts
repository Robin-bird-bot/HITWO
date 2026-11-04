/**
 * Every tunable number in the game lives here (CLAUDE.md, architecture rule 3):
 * costs, thresholds, odds, rarity weights, XP, tree size and so on. The design
 * doc calls these "adjustable settings from day one".
 *
 * Engine code reads numbers from BALANCE and never hard-codes them. A guess
 * made while the docs are silent gets a `// TODO(wyatt):` comment.
 */
import type { BiomeId, LineKind, NodeType, SpecialSpace, StatName } from '../engine/types';

type PartialStats = Partial<Record<StatName, number>>;

/**
 * How often each line kind appears.
 * TODO(wyatt): first guess. Per-biome weights (mud in the Rainforest) come in Phase 11.
 */
const LINE_KIND_WEIGHTS: Record<LineKind, number> = {
  normal: 60,
  steep: 12,
  muddy: 12,
  rough: 8,
  paved: 8,
};

/**
 * Which resource nodes each biome favors (Meadow balanced, Rainforest Forest
 * and River, Alpine Mountain). TODO(wyatt): first guess at the strengths.
 */
const BIOME_NODE_WEIGHTS: Record<BiomeId, Record<NodeType, number>> = {
  meadow: { forest: 1, river: 1, wildlife: 1, mountain: 1 },
  temperateRainforest: { forest: 3, river: 3, wildlife: 2, mountain: 1 },
  alpine: { forest: 1, river: 1, wildlife: 1, mountain: 3 },
};

/** How often each special space appears, once a tile is special. TODO(wyatt): first guess. */
const SPECIAL_WEIGHTS: Record<SpecialSpace, number> = {
  opportunity: 20,
  challenge: 15,
  choice: 10,
  trailSign: 10,
  geoCache: 10,
  campsite: 10,
  overlook: 10,
  narrowPath: 8,
  mystery: 7,
};

/** What crossing each kind of line costs on top of its base Appetite. */
const LINE_EXTRA: Record<LineKind, PartialStats> = {
  normal: {},
  paved: {},
  steep: { energy: 1 },
  muddy: { appetite: 1 },
  rough: { morale: 1 },
};

export const BALANCE = {
  party: {
    size: 4,
  },

  stats: {
    min: 0,
    max: 10,
    /** Stats start full and drop. */
    start: { energy: 10, appetite: 10, morale: 10 },
  },

  /** Threshold states apply at or below these values. */
  thresholds: {
    hungry: 5, // Appetite
    famished: 2, // Appetite
    fatigued: 6, // Energy
    exhausted: 3, // Energy
  },

  injuries: {
    passOutAt: 3,
    /** Gaining an injury raises each stat below this back up to it. */
    raiseStatsBelowTo: 5,
  },

  lines: {
    /** Appetite to cross each kind of line (a normal line is the 1-Appetite move). */
    baseAppetite: { normal: 1, paved: 0, steep: 1, muddy: 1, rough: 1 } as Record<LineKind, number>,
    /**
     * Extra cost to cross. Every hiker who crosses pays their own extra, even
     * when brought along by Move All (Wyatt, Nov 3).
     */
    extra: LINE_EXTRA,
  },

  night: {
    /** Each hiker who moves at night pays this much extra Appetite. */
    moveExtraAppetite: 1,
    /** A night without sleep costs this much Energy. */
    noSleepEnergy: 2,
  },

  moveAll: {
    /**
     * The mover pays their own crossing (the line's base Appetite) plus this
     * much for each hiker brought along: bringing 3 on a normal line = 4.
     * TODO(wyatt): on a paved line the mover's own crossing is free, but the
     * per-hiker cost still applies. Is that right?
     */
    perHikerAppetite: 1,
  },

  scavenge: {
    appetite: 1,
  },

  endOfDay: {
    appetite: 1,
  },

  sleep: {
    energy: 2,
    shelteredEnergy: 3,
  },

  chance: {
    /** A "chance" with no number in the trait text. */
    default: 0.25,
  },

  /** Numbers used by specific traits (see src/content/traits.ts). */
  traits: {
    leader: { moveAllDiscount: 1 },
    stoic: { moraleCost: 2, gain: 1 },
    extrinsic: { together: 1, alone: -1 },
  },

  rules: {
    /** TODO(wyatt): at camp, the no-sleep Energy drain happens before the end-of-day Appetite drain. */
    noSleepDrainFirst: true,
    /** TODO(wyatt): passed-out hikers skip the camp-step drains until Phase 7 settles passing out. */
    passedOutHikersDrainAtCamp: false,
    /** TODO(wyatt): two percentage modifiers multiply in turn (−50% twice = 25%) rather than add. */
    percentModifiersMultiply: true,
    /**
     * TODO(wyatt): who can be brought along by Move All. Being brought uses the
     * hiker's action, so an Exhausted hiker can't be brought in the day and a
     * Fatigued one can't be brought at night. Hungry and Famished hikers can.
     */
    exhaustedOrFatiguedCanBeBrought: false,
  },

  /** One section's trail: a tree from the trailhead to the checkpoint (Phase 2). */
  trail: {
    /** Rows between the trailhead and the checkpoint (Wyatt, Nov 3: like the mockup). */
    middleRows: 5,
    minWidth: 2,
    maxWidth: 3,
    /** How a row's width changes from the row below. Leans wider so the trail branches out. */
    widthChangeWeights: { grow: 2, same: 1, shrink: 1 },
    /** When a row shifts sideways, how much more likely it is to shift back toward the center. */
    recenterWeight: 2,
    /** Chance to keep each optional line up to the next row (every tile always keeps one). */
    keepUpLineChance: 0.7,
    /** Chance of a sideways line between neighbours in the same row. */
    sidewaysLineChance: 0.35,
    lineKindWeights: LINE_KIND_WEIGHTS,
    /** How many nodes a middle tile has. TODO(wyatt): first guess. */
    nodeCountWeights: { 1: 35, 2: 45, 3: 20 } as Record<1 | 2 | 3, number>,
    /** At most this many nodes of one type on a tile (2 = a double node). */
    maxSameNode: 2,
    /** Chance a node spot is a Cap node instead of a resource node. TODO(wyatt): first guess. */
    capNodeChance: 0.06,
    /** Chance a resource node is a Bounty node. TODO(wyatt): first guess. */
    bountyChance: 0.06,
    /** Chance each node starts revealed (Wyatt, Nov 3: about 1 in 3). */
    nodeRevealedChance: 1 / 3,
    /** Chance a middle tile is a special space (Wyatt, Nov 3: about 1 in 3). */
    specialChance: 1 / 3,
    specialWeights: SPECIAL_WEIGHTS,
    narrowCapacity: { min: 1, max: 3 },
    /**
     * Side features attach to non-special middle tiles, at most one of each per section.
     * TODO(wyatt): first guess at how often.
     */
    sideFeatures: {
      merchant: { chance: 0.12, maxPerSection: 1 },
      trader: { chance: 0.08, maxPerSection: 1 },
    },
  },

  biomes: {
    nodeWeights: BIOME_NODE_WEIGHTS,
  },

  log: {
    maxEvents: 200,
  },
};
