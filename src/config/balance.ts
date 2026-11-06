/**
 * Every tunable number in the game lives here (CLAUDE.md, architecture rule 3):
 * costs, thresholds, odds, rarity weights, XP, tree size and so on. The design
 * doc calls these "adjustable settings from day one".
 *
 * Engine code reads numbers from BALANCE and never hard-codes them. A guess
 * made while the docs are silent gets a `// TODO(wyatt):` comment.
 */
import type {
  BiomeId,
  LineKind,
  NodeType,
  Rarity,
  ScavengeCardType,
  SpecialSpace,
  StatName,
} from '../engine/types';

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
    /** Stats that give an injury when they hit 0 (Wyatt, Nov 5: not Morale, which stops at 0). */
    fromStats: ['energy', 'appetite'] as StatName[],
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
    /**
     * Each hiker who scavenges at night pays this much extra Appetite.
     * TODO(wyatt): "Move or Scavenge at the night penalty" (Phase 6), so the
     * same as a night move for now.
     */
    scavengeExtraAppetite: 1,
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
    /** Cards dealt, before family, trait and Abundance changes ("draw 3, pick 1"). */
    cards: 3,
    /**
     * Rarity odds in percent at set Luck values. Luck in between is
     * interpolated per point; Luck beyond the ends is clamped to them.
     */
    rarityByLuck: [
      // TODO(wyatt): first guess. Common 85%, the rest at 60% of their Luck 0 odds.
      {
        luck: -5,
        odds: { common: 85, uncommon: 9, rare: 3.6, veryRare: 1.5, legendary: 0.6, mythic: 0.3 },
      },
      // Wyatt, Nov 4.
      {
        luck: 0,
        odds: { common: 75, uncommon: 15, rare: 6, veryRare: 2.5, legendary: 1, mythic: 0.5 },
      },
      {
        luck: 5,
        odds: { common: 50, uncommon: 25, rare: 14, veryRare: 7, legendary: 3, mythic: 1 },
      },
    ] as { luck: number; odds: Record<Rarity, number> }[],
    /**
     * How likely each card type is within its rarity (1 when not listed).
     * TODO(wyatt): all equally likely to start.
     */
    typeWeights: {} as Partial<Record<ScavengeCardType, number>>,
    /** A Cap node on the tile makes Acorn caps cards this many times likelier. TODO(wyatt): first guess. */
    capNodeCapsWeight: 4,
    /** From a Bounty node, cards that give 2 or more resources are this many times likelier. TODO(wyatt): first guess. */
    bountyMultipleWeight: 2,
    /** Acorn caps cards give this many caps, each amount equally likely. TODO(wyatt): first guess. */
    caps: { min: 1, max: 3 },
    /** Choice item cards offer this many items to pick from (fewer if fewer exist). */
    choiceItemOptions: 5,
  },

  /** Challenges, opportunities and Trials (docs/design/04-challenges.md). */
  challenges: {
    /** What a new tile gets (Wyatt, Nov 5: 70 / 20 / 10). */
    mix: { challenge: 70, trial: 20, opportunity: 10 },
    /**
     * A challenge one tier above its own has its ranges scaled by this
     * (Wyatt, Nov 5: ×1.5). Backwards ranges (Dangerous Current) shrink.
     */
    tierScale: 1.5,
    /**
     * How strongly Luck skews X and Y toward the party's good end: the roll
     * is u^(2^(Luck × this)), so Luck +2 makes the good end about twice as
     * likely as the bad end. TODO(wyatt): first guess.
     */
    luckSkew: 0.5,
    /** At most this many Trials at once. */
    maxTrials: 2,
    /** How likely each card is to be picked (1 when not listed). TODO(wyatt): all equal to start. */
    weights: {} as Record<string, number>,
    /** XP for passing a challenge: this × the trail tier (the XP table). */
    passXpPerTier: 2,
    /**
     * Special spaces that never get a card when a hiker lands on them.
     * TODO(wyatt): do Trail Sign, Geo-cache, Campsite, Overlook, Narrow Path and
     * Mystery tiles also have a challenge? For now every tile does, except the
     * trailhead and the checkpoint.
     */
    noCardOn: [] as readonly SpecialSpace[],
    /**
     * On a Challenge space, each passing hiker gets one of these at random: an
     * item, Lucky for 1 day, or the XP again. TODO(wyatt): first guess.
     */
    spaceRewards: ['item', 'lucky', 'doubleXp'] as const,
  },

  /** Opportunities (Nov 6 update). TODO(wyatt): first guesses where the doc gives no number. */
  opportunities: {
    /** Snake Slots: "a lot of caps", "a few caps" and "several resources". */
    slots: { lotOfCaps: 15, fewCaps: 2, severalResources: 3 },
    /** How long Mysterious Berries' random negative condition and Citro Tub's Energized last. */
    conditionDays: 1,
  },

  luck: {
    /** Luck is clamped to this range. */
    min: -5,
    max: 5,
    /**
     * Morale sets a base Luck (Wyatt, Nov 5): this at Morale 0 and at Morale
     * 10, in even steps between (−2 → 0 at Morale 5 → +2, 0.4 per point).
     */
    fromMorale: { atZero: -2, atTen: 2 },
  },

  abundance: {
    /** Each node type's meter runs 0 to max (Main.dc.html shows 0–10). */
    max: 10,
    /** Every meter starts each biome here ("about 75%"). TODO(wyatt): first guess. */
    start: 8,
    /** At or below this a node is low (Main.dc.html colours 4 and under red). */
    lowAt: 4,
    /** Cards from a Bounty node drain this much extra. TODO(wyatt): first guess. */
    bountyExtraDrain: 1,
    /** Tend restores this much to one node on the tile (day only). TODO(wyatt): first guess. */
    tend: 2,
    /** Tend costs this much Energy (Wyatt, Nov 5). */
    tendEnergy: 1,
    /** Each night, every node nobody scavenged that day recovers this much. */
    nightRecovery: 1,
    /** Returning a resource to nature restores this much to its node. */
    returnToNature: 1,
    /**
     * When every resource node on the tile is low: fewer cards and less Luck
     * ("a low meter means fewer cards to choose from, rarer good results").
     * TODO(wyatt): first guess.
     */
    lowTile: { cards: -1, luck: -1 },
  },

  inventory: {
    /** Items: 4 bag slots + 3 equipped (Body, Feet, Gear). A Backpack adds 2. */
    bagSlots: 4,
    equipSlots: 3,
    /** Resources per hiker. */
    resourceLimit: 10,
  },

  xp: {
    /**
     * XP needed to reach each level (index 0 = level 1).
     * TODO(wyatt): placeholder until Phase 10 sets XP and leveling.
     */
    levelAt: [0, 50, 150, 300, 500, 750],
  },

  endOfDay: {
    appetite: 1,
  },

  /** Sleep (Wyatt, Nov 5: +1, or +2 in a shelter). A night without sleep still costs night.noSleepEnergy. */
  sleep: {
    energy: 1,
    shelteredEnergy: 2,
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
    forager: { cards: 1 },
    gambler: { usesPerDay: 1 },
    /** "Higher chance of drawing that node's resources." TODO(wyatt): first guess. */
    finder: { nodeWeight: 1.5 },
    /** "Much higher chance … and of ×2 results." TODO(wyatt): first guess; ×2 means ×2 and Wild ×2 cards. */
    hound: { nodeWeight: 3, doubleWeight: 2 },
    /** "Higher chance of Item find cards." TODO(wyatt): first guess; Choice items aren't included. */
    archaeologist: { itemFindWeight: 2 },
    /**
     * Copier and Copydog: 1 extra resource per hiker who scavenged this tile
     * earlier the same day. TODO(wyatt): the extra is one more of the first
     * resource taken, and cards with no resources (caps, items) get none.
     */
    copier: { appetiteEach: 1 },
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
