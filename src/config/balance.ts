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
  WeatherId,
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
    /** The 3rd injury passes a hiker out. TODO(wyatt): injuries stop there, so a passed-out hiker gains no more. */
    passOutAt: 3,
    /** Stats that give an injury when they hit 0 (Wyatt, Nov 5: not Morale, which stops at 0). */
    fromStats: ['energy', 'appetite'] as StatName[],
    /** Gaining an injury raises each stat below this back up to it. */
    raiseStatsBelowTo: 5,
  },

  /** Items (docs/design/03-items.md). */
  items: {
    /**
     * Quality rolls: the odds of Quality 1–5 (Wyatt, Nov 7). Each point of the
     * crafter's Luck moves `luckStep` points from Quality 1–2 to 4–5, half from
     * each (Luck +2: 5/15/40/25/15).
     */
    quality: { odds: [10, 20, 40, 20, 10] as readonly number[], luckStep: 5 },
    /** A found item is one tier above the biome's this often (Wyatt, Nov 7). */
    findHigher: 0.1,
    /** The highest tier a find can be: Tier 4 waits on Tier 4 items (Wyatt, Nov 7). */
    maxFoundTier: 3,
    /** Equipped clothes lose this much durability at each camp step. */
    campWear: 1,
    /** Clothing durability in days, by tier, at Quality 1–5. */
    durability: {
      1: [4, 5, 5, 5, 6],
      2: [5, 7, 7, 7, 9],
      3: [8, 10, 10, 10, 12],
    } as Record<number, readonly [number, number, number, number, number]>,
    /**
     * Portable shelters (Phase 10.6): how many times each can be set up (the
     * old nights + 1). At 0 it can't be set up again, and it's thrown away
     * when it's packed. TODO(wyatt): every number is a first guess.
     */
    shelterDeployments: {
      hammock: 2,
      tent: 4,
      cabin: 5,
      tailgate: 4,
      yurt: 5,
      hostel: 5,
      treeHouse: 5,
      rv: 5,
      medicTent: 4,
      lodge: 6,
    } as Record<string, number>,
    /**
     * The Diploma's XP: a share of the XP between the hiker's level and the
     * next, rolled. TODO(wyatt): the doc's first guess, 60–100% of a level.
     */
    diplomaXp: { min: 0.6, max: 1 },
    /** The Postcard's extra XP at each checkpoint and each challenge passed. TODO(wyatt): first guess. */
    postcardXp: { checkpoint: 5, challenge: 1 },
    /** The Textbook's extra XP for every scavenge and craft. */
    textbookXp: 1,
    /** Phase 10.7 trinkets (names are placeholders). TODO(wyatt): first guesses. */
    fieldNotebook: { durability: 5, xpPercent: 100 },
    meritBadge: { durability: 8, xp: 3 },
    /** A Planter can't add a node to a tile that already has this many. */
    maxNodes: 3,
    /** Hiking Crocs and Work Boots' free move: Appetite off it, and durability it takes. */
    freeMove: { discount: 1, wear: 1 },
    /** Jeans: scavenging costs this much less Appetite. */
    jeansAppetite: 1,
    /** Shelters' own effects (03-items.md, "Shelters"). */
    shelter: {
      /** Cabin and RV: more Energy from sleeping there. */
      sleepEnergy: 1,
      /** Hostel: more Energy with 2 or more hikers on the tile, and again with all 4. */
      hostel: { company: 2, companyEnergy: 1, everyone: 4, everyoneEnergy: 1 },
      /** Yurt: extra cards when scavenging there. */
      yurtCards: 1,
      /** Medic Tent: injuries healed, once per hiker. */
      medicInjuries: 1,
      /** Tailgate and Lodge: Quality added to what's crafted there (up to 5). */
      craftQuality: 1,
    },
    /** Crafting (03-items.md, "Crafting"; Wyatt, Nov 7 and Nov 13). */
    craft: {
      /** Every hiker crafts every type at this tier until a workbench raises it (Phase 9). */
      startTier: 1,
      maxTier: 3,
      /** A basic recipe deals this many items to pick 1 from. */
      choices: 3,
      /** Each one is a tier higher this often. */
      higher: 0.1,
      /**
       * Higher tiers add to the basic recipe: key and broad resources.
       * TODO(wyatt): the doc's first guess. Trinkets add `trinket` more different resources.
       */
      tierExtra: {
        2: { key: 1, broad: 1, trinket: 1 },
        3: { key: 2, broad: 2, trinket: 2 },
      } as Record<number, { key: number; broad: number; trinket: number }>,
      /** TODO(wyatt): Dogs craft with this Luck for Quality (first guess). */
      dogLuck: -1,
      /**
       * Abandoned Ranger Station: "a random tool, clothing item or blueprint".
       * TODO(wyatt): a blueprint a third of the time (first guess).
       */
      blueprintFind: 1 / 3,
      /** Teaching a blueprint costs the teacher this much Morale, by its tier (Wyatt, Nov 13). */
      teachMorale: { 1: 4, 2: 6, 3: 8 } as Record<number, number>,
    },
    /** Wallet: added to every caps gain, for good. */
    walletCaps: 1,
    /** Serums: added to a stat's maximum, for good. */
    serumMax: 1,
    /** Sleepy Socks also work at the start of a phase with at least this much Energy. */
    sleepySocksEnergy: 7,
    /**
     * TODO(wyatt): the Appetite for each extra card a Sack keeps. First guess: none;
     * the scavenge's cost is paid once.
     */
    sackAppetite: 0,
  },

  /** The medical items (Phase 7). */
  medical: {
    /** Bandages: injuries cured (and Bleeding: Wyatt, Nov 7). */
    bandagesInjuries: 1,
    /** Medkit: injuries cured, plus every negative condition. */
    medkitInjuries: 1,
  },

  /** The run: one section per biome, in this order. The last checkpoint is the summit. */
  run: {
    biomes: ['meadow', 'temperateRainforest', 'alpine'] as BiomeId[],
  },
  /**
   * Checkpoints and ranger stations (Phase 9; docs/design/06-ranger-stations.md).
   * Every station follows the same rules: a theme only changes what's for sale.
   */
  station: {
    /** XP for each hiker reaching a checkpoint (the XP table). */
    checkInXp: 10,
    /**
     * Item cards: 6 at the first station, 1 more at each later one, at most 10
     * (STATION_ITEMS_BASE, _STEP and _MAX in the Nov 13 update).
     */
    items: { base: 6, step: 1, max: 10 },
    /** TODO(wyatt): the first item slots come from the theme's focus; the rest can be anything. */
    focusSlots: 4,
    /** TODO(wyatt): each item slot's chance to be a trinket instead (every shop can sell them). */
    trinketChance: 0.08,
    /** TODO(wyatt): featured items, and a theme's favored trinkets, are this many times as likely. */
    featuredWeight: 3,
    /**
     * Item tiers by biome (the section the station ends), as weights.
     * TODO(wyatt): "mostly Tier 1 with some Tier 2"; "mostly Tier 2"; "Tier 2 and 3".
     */
    tierWeights: [
      { 1: 75, 2: 25 },
      { 1: 15, 2: 75, 3: 10 },
      { 2: 50, 3: 50 },
    ] as Record<number, number>[],
    /** TODO(wyatt): every shop item's Quality, the plain curve (Luck doesn't change it). */
    qualityOdds: [10, 20, 40, 20, 10] as readonly number[],
    /** Blueprints for sale, from the theme's pool; kept for good. */
    blueprints: 3,
    /** Free blueprints at the Workbench for this visit, kept only by crafting there (Wyatt, Nov 13). */
    tempBlueprints: 3,
    /** TODO(wyatt): resource bundles (3 of one resource each) and their price. */
    bundles: 2,
    bundleSize: 3,
    bundlePrice: 4,
    /** TODO(wyatt): Rocco's Random Resale: each of its bundles' chance to be a resource pack. */
    packChance: 0.5,
    /** An item's price: its tier's price × its Quality's multiplier, to the nearest cap. */
    tierPrice: { 1: 4, 2: 8, 3: 14 } as Record<number, number>,
    /** TODO(wyatt): Quality 1–5. Items with no Quality (shelters, trinkets) cost ×1. */
    qualityPrice: [0.5, 0.75, 1, 1.25, 1.5] as readonly number[],
    /** A blueprint costs this × its item's Quality 3 price. */
    blueprintPrice: 1.5,
    /**
     * The market, rolled each visit: this many resources sell for ×2 and this
     * many others for ×½; the rest at the normal price.
     */
    market: { high: 4, low: 4, highMult: 2, lowMult: 0.5 },
    /**
     * TODO(wyatt): a resource's normal sell price (the doc doesn't say). With
     * ×½, two sell together for 1 cap.
     */
    resourcePrice: 1,
    /** Selling an item: this share of its new price, times what's left; at least 1 cap. */
    sellShare: 0.5,
    /**
     * Shared specials: 1 random per visit. TODO(wyatt): the prices; and the
     * Taxi Service is the rejoin, which every station has, so the random one
     * comes from the others.
     */
    specials: { cementMixer: 6, scoutReport: 6 } as Record<string, number>,
    /** Scout Report: the cards on this many tiles of the next biome are shown. */
    scoutTiles: 3,
    /**
     * The rejoin (Taxi Service): one per station, at most `perRun` per run.
     * TODO(wyatt): the price, and the hiker coming back with 2 injuries, 3 in
     * each stat and an empty pack.
     */
    rejoin: { price: 15, perRun: 2, injuries: 2, stat: 3 },
    /** At the station everyone crafts this many tiers above their own (Wyatt, Nov 13). */
    workbenchTiers: 1,
    /**
     * A trail Merchant: 3 cards, each an item, a resource bundle or a
     * blueprint, at station prices and Quality. TODO(wyatt): how likely each.
     */
    merchant: { cards: 3, kinds: { item: 2, bundle: 1, blueprint: 1 } },
    /** A Traveling Trader's item is this many tiers above the biome's (Wyatt, Nov 14), at most 3. */
    traderTierAbove: 1,
  },
  /**
   * Carrying a passed-out hiker (Wyatt, Nov 7: pick up, then carry).
   * TODO(wyatt): anyone can carry anyone; Cats pay the extra too.
   * TODO(wyatt): the Carrier Pack (an item still to place) could make it free.
   */
  carry: {
    /** The carrier's extra Appetite on each move. */
    appetite: 1,
  },

  /** Passing out (01-design-doc.md, "Passing out, abandoning, rejoining"). */
  passOut: {
    /**
     * Nights a passed-out hiker can be left alone before they abandon the hike.
     * TODO(wyatt): it starts full every time they pass out, and drops at each camp
     * step with no active hiker on their tile, the night they pass out included.
     */
    countdownNights: 2,
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

  /**
   * Night events (05-nights-and-weather.md). Every number here is the doc's
   * first guess. TODO(wyatt): tune.
   */
  nightEvents: {
    /** Tier odds by biome (sectionIndex 0, 1, 2): Tier 1, 2, 3. */
    tierOdds: [
      [0.7, 0.25, 0.05],
      [0.45, 0.4, 0.15],
      [0.25, 0.45, 0.3],
    ] as readonly (readonly [number, number, number])[],
    /** Each exposed hiker's chance to be hit. */
    chance: {
      base: 0.3,
      /** Alone on their tile. */
      alone: 1.5,
      /** For each other hiker on the tile. */
      perOther: 0.75,
      /** Low Morale adds points: +10 at Morale 5 or less, +20 at 2 or less. */
      lowMorale: [
        { atMost: 2, add: 0.2 },
        { atMost: 5, add: 0.1 },
      ] as readonly { atMost: number; add: number }[],
    },
    /**
     * The X and Y ranges in the outcomes. Each hiker hit rolls their own.
     * TODO(wyatt): night numbers are rolled flat; should Luck skew them, as it does a challenge's?
     */
    ranges: {
      swapResources: [1, 5],
      stealCaps: [1, 3],
      stealResources: [1, 3],
      loseMorale: [1, 2],
      loseXp: [1, 3],
      loseEnergy: [1, 3],
      loseAppetite: [1, 3],
      allFood: [1, 2],
      stealItems: [1, 2],
      allClothes: [2, 3],
      bigLoss: [2, 3],
      everyStat: [1, 2],
      bleedingPhases: [2, 3],
      conditionDays: [1, 2],
    } as Record<string, readonly [number, number]>,
    /** The night conditions that last a set time: Wet, Unlucky or Clumsy (Tier 1) last a day. */
    tier1ConditionDays: 1,
    /**
     * Tier 3's Frozen and Soaked: the doc gives no time.
     * TODO(wyatt): a first guess of Frozen for 1 phase and Soaked for 1 day.
     */
    frozenPhases: 1,
    soakedDays: 1,
    /** Tier 2's injury: only for a hiker alone with this much Energy or Appetite or less. */
    tier2Injury: { energyOrAppetiteAtMost: 4 },
    /** Tier 3's injuries: on a tile with this many hikers or fewer. */
    tier3Injury: { energyOrAppetiteAtMost: 6, moraleAtMost: 5, maxOnTile: 2 },
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
     * TODO(wyatt): all equally likely to start. The item cards (Nov 14 update)
     * share their rarity with the random finds of the same type: [1] each.
     */
    typeWeights: {
      toolCard: 1,
      foodCard: 1,
      clothesCard: 1,
      shelterCard: 1,
      trinketCard: 1,
    } as Partial<Record<ScavengeCardType, number>>,
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
    // What each plain tile holds is decided when the section is made, by the
    // difficulty (src/config/difficulty.ts, Phase 10.6). Trials are switched off.
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

  /** Wonders (Nov 6 update, 3). TODO(wyatt): first guesses (approved Nov 6). */
  wonders: {
    /** Each biome after the first multiplies a goal's X by this (an "at most" X divides). */
    biomeScale: 1.5,
    /** "Gain a lot of XP": about one level's worth. */
    lotOfXp: 100,
    /** "Gain a lot of caps": about one good shop item. */
    lotOfCaps: 15,
    /** Pittock Mansion: "The party has X caps" (X[?+] in the doc). */
    pittockCaps: 10,
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

  /** One Abundance bar for the whole biome (Nov 14 update; it was a meter per node). */
  abundance: {
    /** The bar runs 0 to max. TODO(wyatt): [20]. */
    max: 20,
    /** It starts each biome here. TODO(wyatt): [15]. */
    start: 15,
    /** Each night it recovers this much. TODO(wyatt): [+1]. */
    nightRecovery: 1,
    /** Cards from a Bounty node drain this much extra. TODO(wyatt): first guess. */
    bountyExtraDrain: 1,
    /** Tend raises it this much (day only). TODO(wyatt): [+2]. */
    tend: 2,
    /** Tend costs this much Appetite (Nov 14 update; it was 1 Energy). */
    tendAppetite: 1,
    /** Returning a resource to nature raises it this much. */
    returnToNature: 1,
    /**
     * Each resource card dealt comes up Empty with this chance: `atFull` with
     * the bar full, rising evenly to `atZero` with it empty. Caps and item
     * cards are never Empty. TODO(wyatt): [5%] and [40%].
     *
     * The scavenger's Luck changes it by `perLuck` of itself for each point,
     * both ways (Wyatt, Nov 14): Luck +5 halves it, Luck −5 makes it half as
     * much again.
     */
    emptyChance: { atFull: 0.05, atZero: 0.4, perLuck: 0.1 },
  },

  inventory: {
    /** Items: 4 bag slots + 3 equipped (Body, Feet, Gear). A Backpack adds 2. */
    bagSlots: 4,
    equipSlots: 3,
    /** Resources per hiker. */
    resourceLimit: 10,
    /**
     * A new run gives each hiker this many random resources (Nov 13 update).
     * It stands in for the start-of-hike rules coming later.
     */
    startingResources: 4,
  },

  /** XP and levels (01-design-doc.md, "XP"; Wyatt, Nov 20). Hikers start at level 0. */
  xp: {
    /** Total XP to reach levels 1–6: each level needs 10 more than the last. */
    levelAt: [20, 50, 90, 140, 200, 270],
    /** Past level 6, each level keeps needing this much more than the one before. TODO(wyatt). */
    stepGrowth: 10,
    /**
     * Milestones (no row rule): a checkpoint is station.checkInXp, a challenge
     * passed is challenges.passXpPerTier × its tier.
     *
     * Party objectives: 10 × their tier. TODO(wyatt): first guess; objectives come in Phase 13.
     */
    objectivePerTier: 10,
    /** Action XP (the row rule): crafting by the item's tier (1–4), a lucky draw, the fire. */
    craft: [1, 2, 4, 8],
    luckyDraw: 2,
    fire: 1,
  },

  /**
   * Skill Trails and party XP (09-hikers.md; Phase 10.7). Every hiker's XP
   * fills one party bar, on the xp.levelAt curve above for now.
   * TODO(wyatt): every number here is a first guess.
   */
  trails: {
    /** Points each party level gives. */
    pointsPerLevel: 1,
    /** What a step costs, unless the step sets its own: Tier 2, Tier 3, and another tree's Tier 1. */
    cost: { tier2: 1, tier3: 2, openTree: 2 },
    /** The party level each tier needs (Tier 1: any). */
    unlockLevel: { 2: 2, 3: 4 },
    /** The steps' own numbers, by trait. */
    leashPuller: {
      /** On: Finn's Move All costs him this much Energy instead of any Appetite. */
      energy: 2,
      /** Off (II, III): each hiker brought along may cost no Appetite. */
      offChance: { 2: 0.25, 3: 0.5 },
    },
    copydog: { cards: 2 },
    furrager: {
      /** Fur is this much more likely. */
      furWeight: 3,
      /** II: a Fur card comes as ×2 this often, else ×3. */
      x2: 0.5,
      /** II: each card's chance to be Fur on a tile with no Wildlife node. */
      offNodeChance: 0.1,
    },
    furTrade: { fur: 3 },
    singer: { energy: 1, morale: 1, moraleII: 2 },
    agilityClass: { energy: 1 },
    mba: { capsWeight: 2, capsBonus: 2 },
    experiencedTraveler: {
      /** Moving alone: no Appetite this often (I, II, III). */
      alone: { 1: 0.25, 2: 0.5, 3: 0.5 },
      /** Being brought along: no Appetite this often (II; III never pays). */
      brought: { 2: 0.25 },
      /** III: Morale each time she moves. */
      morale: 1,
    },
    /** Recipe steps (Family Cookbook, Clothing Catalogue, Floor Plans, Toy Chest). */
    recipes: 3,
    /** Artisan and Master steps: more cards when crafting that type. */
    artisanCards: 1,
    masterCards: 2,
    short: { discount: 1, slots: -1 },
    homemade: { cards: 1, luck: 1 },
    leadTheWay: { discount: 1 },
    justAroundTheNextCorner: { tiles: 3, chance: 0.5 },
    packedToolbox: { tools: 2 },
    properWay: { uses: 1 },
    rainLover: { luck: { 1: 1, 2: 2, 3: 2 }, cards: 1, xpPercent: 100 },
    ruleChanger: { uses: { 1: 1, 2: 2, 3: 2 } },
    garbageConnoisseur: {
      /** Appetite per bite for each resource swapped in (I, II, III). */
      perSwap: { 1: -1, 2: 0, 3: 1 },
    },
  },

  /**
   * Morale types (09-hikers.md; Phase 10.7): checked at the end of every
   * phase for +1, −1 or nothing. Counts include the hiker. TODO(wyatt).
   */
  moraleTypes: {
    change: 1,
    /** Extrovert +1 and Introvert −1 at this many hikers on the tile or more. */
    crowd: 3,
    /** Ambivert: +1 with 2 or 3 on the tile; −1 alone or at this many or more. */
    bigGroup: 4,
    /** Foody (Appetite) and Energetic (Energy): +1 at this or more, −1 at the low mark or less. */
    high: 7,
    low: 3,
  },

  /** Level-up offers (01-design-doc.md, "Leveling"; 02, "Trait rules"). */
  levelUp: {
    /** Levels 1–3 offer this many options; from level 4, one more a level, up to `maxOptions`. */
    options: 3,
    maxOptions: 6,
    /** Options that can come from any class, not just the hiker's own. TODO(wyatt): [1]. */
    anyClass: 1,
    /**
     * Morale traits come up less often: each option is first a type, Trail and
     * Utility at 1 each and Morale at this, then a trait of that type. TODO(wyatt).
     */
    moraleWeight: 0.5,
    /** The chance an option is a new slot instead of a trait. TODO(wyatt): first guess. */
    slotChance: 1 / 8,
    /** A new slot's type: T and U most common, the mixed slots rarer, W rarest. TODO(wyatt). */
    slotWeights: { T: 4, U: 4, 'T/U': 2, 'T/M': 2, 'U/M': 2, W: 1 },
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

  /** Weather (05-nights-and-weather.md, Phase 6). */
  weather: {
    /**
     * The schedule (Phase 10.6): each weather lasts this many days, then the
     * next is drawn from these odds. Every section uses the Meadow odds until
     * Phase 11 gives each biome its own (Snow up high).
     * TODO(wyatt): [1–3] days; Clear [40%], Rain [25%], Wind [20%], Heatwave [15%].
     */
    schedule: {
      days: { min: 1, max: 3 },
      odds: { clear: 40, rain: 25, wind: 20, heatwave: 15, snow: 0 } as Record<WeatherId, number>,
    },
    /** How many days ahead the forecast shows. */
    forecastDays: 3,
    /** On a tile with the weather's node, its resource cards are this many times as likely. TODO(wyatt): [1.5×]. */
    boost: 1.5,
    /**
     * On any tile, each resource card's chance to be one of the weather's node's
     * resources instead (with a small weather icon). TODO(wyatt): [10%].
     */
    swapChance: 0.1,
  },

  /** Condition numbers from 02-traits-and-conditions.md (Phase 6). */
  conditions: {
    /** Sleepy, Nauseous, Bored, Sated, Energized: the stat change while it lasts. */
    shift: { sleepy: -2, nauseous: -2, bored: -2, sated: 1, energized: 1 },
    /** "Can't go above": Dejected (Morale), Inappetent (Appetite), Buzzed (Energy). */
    caps: { dejected: 5, inappetent: 7, buzzed: 7 },
    /** Strained: extra Energy lost each time. Inspired: extra Morale gained each time. */
    strainedExtra: 1,
    /** Food Poisoning: food gives this much less Appetite. */
    foodPoisoning: 2,
    inspiredExtra: 1,
    /** Sluggish: extra Appetite to move. */
    sluggishAppetite: 1,
    /** Lucky and Unlucky: Luck when scavenging (and crafting, Phase 8). */
    luck: 1,
    /** Weak: item slots lost. Tunnel Vision: cards lost. */
    weakSlots: 1,
    tunnelVisionCards: 1,
    /** Wet (each day), Soaked and Allergies (each phase): Morale lost. */
    moraleLoss: 1,
    /**
     * Ringing Ears: "each phase, a chance to lose 1 Morale (75%), or 1 Energy at
     * night (25%)". TODO(wyatt): read as 75% for Morale in a day phase, 25% for
     * Energy at night.
     */
    ringingEars: { dayMorale: 0.75, nightEnergy: 0.25 },
    /** Shivering: Frozen at this many; an injury and back to 0 at this many. */
    shivering: { frozenAt: 3, injuryAt: 5 },
    /** Burning: −1 maximum Energy a stack; an injury and back to 0 at this many; cools 1 a quiet night. */
    burning: { injuryAt: 5, coolPerNight: 1 },
  },

  /** Numbers used by specific traits (see src/content/traits.ts). */
  traits: {
    /** The most trait slots a hiker can have (02-traits-and-conditions.md). */
    maxSlots: 6,
    leader: { moveAllDiscount: 1 },
    // ── Trail traits (Phase 10a step 2), from 02-traits-and-conditions.md ──
    independent: { discount: 1 },
    glutton: { appetite: 1 },
    strong: { slots: 1 },
    mule: { slots: 2 },
    short: { discount: 1, slots: -1 },
    /** "25% chance to cost no Appetite"; "every food restores 1 less". */
    neverHungry: { chance: 0.25, food: -1 },
    /**
     * "Moving the group costs 1 Energy instead of Appetite." TODO(wyatt): the
     * doc's open question; first guess: a flat 1 Energy in place of all the
     * mover's Appetite for the Move All.
     */
    puller: { energy: 1 },
    manager: { reach: 1 },
    fast: { extraAppetite: 1 },
    hardy: { moraleCost: 2, shorten: 1 },
    lookout: { reach: 1 },
    sherpa: { reach: 1 },
    /** "A chance to restore 1 Energy": the doc's default chance. */
    photosynthesis: { chance: 0.25, energy: 1 },
    splitter: { appetite: 1 },
    soldiersMarch: { discount: 1 },
    // ── Utility traits (Phase 10a step 3), from 02-traits-and-conditions.md ──
    collaborative: { luck: 1 },
    focused: { luck: 1 },
    ecoConscious: { drain: 1 },
    /** "Higher chance of acorn caps." TODO(wyatt): first guess, caps cards twice as likely. */
    squirrely: { capsWeight: 2 },
    /**
     * Lead Stomach and Destroyer spend resources. TODO(wyatt): first guess, the
     * ones the hiker has the most of go first.
     */
    leadStomach: { resources: 2, appetite: 1 },
    destroyer: { resources: 3, gain: 1 },
    charismatic: { caps: 2 },
    frugal: { caps: 1 },
    nonNonProfit: { percent: 50 },
    thumb: { cards: 1, abundance: 1 },
    /** Chances the doc doesn't number use its default (25%). */
    chef: { chance: 0.25, appetite: 1 },
    carefulHands: { min: 0, max: 3 },
    teacher: { percent: -50 },
    pockets: { chance: 0.25 },
    savvy: { chance: 0.25 },
    handy: { cards: 1 },
    proficient: { cards: 2 },
    fortunate: { luck: 1 },
    /**
     * Therapist: 1 Morale to shorten every negative condition on the tile by 1
     * day. TODO(wyatt): a phase-based condition loses a day's worth (3 phases).
     */
    therapist: { morale: 1, days: 1 },
    liberal: { energy: 1 },
    /**
     * Talented: "+1 to the numbers on items this hiker crafts". TODO(wyatt):
     * read as each item's main number: food +1 Appetite, a tool +1 use,
     * clothes +1 day of durability (shelters and trinkets have none).
     */
    talented: { bonus: 1 },
    closer: { luck: 1 },
    lovinglyMade: { morale: 8, luck: 1 },
    dreamAlchemist: { chance: 0.1 },
    alchemist: { resources: 2 },
    singer: { morale: 1 },
    /** Thrill Seeker (Nov 6): losing this much Energy in one phase gives Energized for this many days. */
    thrillSeeker: { energyLost: 3, days: 1 },
    stoic: { moraleCost: 2, gain: 1 },
    extrinsic: { together: 1, alone: -1 },
    // ── Morale traits (Phase 10a step 4), from 02-traits-and-conditions.md ──
    /** The usual Morale a Morale trait gives or takes. */
    morale: 1,
    zen: 2,
    foody: { high: 8, low: 5 },
    dressed: { many: 2 },
    slowAndSteady: { forward: -2 },
    misophonia: { otherEats: -1, craftsFood: 2 },
    rainLover: { extra: 1 },
    showGirl: { extra: 1 },
    // ── Family, special and unique traits (Phase 10a step 5) ──
    /** Fetch reaches the next tile; on Boss's days (Tag Team) 2 tiles, and items too. */
    fetch: { reach: 1 },
    dogWhisperer: { cards: 1 },
    /** Boss & Gracie: Boss's days are odd (TODO(wyatt)); both reach 2 tiles. */
    tagTeam: { reach: 2 },
    fluffy: { fur: 1 },
    nosework: { luck: 3 },
    yodeler: { reach: 2, morale: 1, mountain: 2 },
    stylish: { luck: 1, days: 3 },
    /** Loud gives Ringing Ears at night. TODO(wyatt): for a phase, to the others on the tile. */
    loud: { reach: 1, ringingEarsPhases: 1 },
    rabbitDiet: { appetite: 1 },
    /** The bracketed numbers in 07-characters.md. TODO(wyatt). */
    forgetful: { chance: 0.5 },
    snores: { shield: 50, sleep: -1 },
    lanky: { chance: 0.25 },
    spoiled: { appetite: 1 },
    fluffArmor: { chance: 0.5 },
    hypeDog: { reach: 1, days: 1 },
    luckyCharm: { luck: 1 },
    cuddleBuddy: { morale: 1 },
    justAroundTheNextCorner: { tiles: 3, alone: 0.75, group: 0.25 },
    /** Coach's Motivated, and Good Boy's (his action, given this phase). TODO(wyatt): how long. */
    coach: { days: 1 },
    comedian: { morale: 1 },
    easyMode: { less: 1 },
    // ── XP traits (Phase 10a step 6) ──
    /** Wise: others on the tile gain this share of what this hiker gains (rounded up). */
    wise: { percent: 50 },
    /** Mentor: others on the tile gain this much more each time. TODO(wyatt): [1]. */
    mentor: { extra: 1 },
    /** Storyteller: others on the tile gain this at the fire. TODO(wyatt): [2]. */
    storyteller: { xp: 2 },
    linguist: { perOther: 1 },
    /** Trainer: Pets on the tile gain this much more. */
    trainer: { percent: 50 },
    /** MBA: caps for each level of the new level (3 at level 1, 6 at level 2…). TODO(wyatt). */
    mba: { capsPerLevel: 3 },
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
    // ── Holiday hikers (Nov 20 update, holiday-hikers-2) ──
    /** Season of Giving: +1 when someone opens a Present she wrapped; −1 after a day she wrapped none. */
    seasonOfGiving: { opened: 1, noneWrapped: -1 },
    /** Holiday Spirit: +1 when a hiker on the tile opens a Present; −1 after a day nobody opened one. */
    holidaySpirit: { opened: 1, noneOpened: -1 },
    /** Bah Humbug: +1 each time she opens a Present; −1 when another hiker on her tile Sits by the Fire. */
    bahHumbug: { opened: 1, fire: -1 },
    /** Toy Maker: Tools are this many times as likely in the Presents she opens. TODO(wyatt): [3×]. */
    toyMaker: { toolWeight: 3 },
    /** Treat Sniffer: Food is this many times as likely in the Presents he opens. TODO(wyatt): [3×]. */
    treatSniffer: { foodWeight: 3 },
    /** Choosy: she sees this many items and keeps 1. */
    choosy: { choices: 3 },
    /** Spare Parts: resources of her choice for one Present. TODO(wyatt): [2]. */
    spareParts: { resources: 2 },
    /** Wreck the Halls: a random whole number of Morale, all equally likely. TODO(wyatt): [3–8]. */
    wreckTheHalls: { min: 3, max: 8 },
    /** Present Muncher: a random whole number of Appetite, all equally likely. TODO(wyatt): [0–5]. */
    presentMuncher: { min: 0, max: 5 },
  },

  /**
   * Presents (Nov 20 update, holiday-hikers-2; 03-items.md, "Presents"): only
   * Grammy Clause makes them (Gift Wrapper), and they're never in a random pool.
   */
  presents: {
    /** Opening one costs the opener's action and this much Energy. */
    openEnergy: 1,
    /**
     * Which tier is inside, by grade, in percent (the biome's tier doesn't
     * limit it). TODO(wyatt): plain [50/35/15], Tier 2+ [70/30].
     */
    tierOdds: {
      plain: { 1: 50, 2: 35, 3: 15 },
      tier2plus: { 2: 70, 3: 30 },
      tier3: { 3: 100 },
    } as Readonly<
      Record<'plain' | 'tier2plus' | 'tier3', Readonly<Partial<Record<1 | 2 | 3, number>>>>
    >,
    /** Stations buy Presents. TODO(wyatt): [first guess] they won't. */
    sellable: false,
    /** Wrapping colorways (1 candy cane, 2 holly, 3 lilac, 4 midnight, 5 berry). */
    colorways: 5,
    /** Gift Wrapper's plain recipes: this many of one resource, or of one node's resources, any mix. */
    sameResource: 3,
    sameType: 5,
    /** Grammy's two wish lists: specific resources (repeats allowed), rolled from all 16. */
    smallWishList: 3,
    bigWishList: 5,
    /**
     * Crafting XP for a Present, as an item of this tier (action XP, under the
     * row rule). TODO(wyatt): first guess; a Present has no tier of its own.
     */
    xpTier: 1,
  },

  /**
   * Plush hikers (Nov 20 update, 07-characters.md): Energy and Appetite are one
   * bar, Stuffing. At `low` or less they can't move the group and can only
   * sleep at night; at `veryLow` or less they can only sleep; at 0, an injury.
   * TODO(wyatt): [12], [7] and [3].
   */
  plush: { stuffingMax: 12, low: 7, veryLow: 3 },

  rules: {
    /** Passed-out hikers skip the camp-step drains: they're out cold (Wyatt, Nov 7). */
    passedOutHikersDrainAtCamp: false,
    /** TODO(wyatt): two percentage modifiers multiply in turn (−50% twice = 25%) rather than add. */
    percentModifiersMultiply: true,
    /**
     * Who can be brought along by Move All (Wyatt, Nov 14): anyone who hasn't
     * acted, however tired or hungry, since another hiker moves them. Being
     * brought still uses their action.
     */
    exhaustedOrFatiguedCanBeBrought: true,
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

  /**
   * Minigames (Phase 10.8, docs/design/10-minigames.md): the party GPS and
   * Bearrels. TODO(wyatt): every number here is a first guess.
   */
  minigames: {
    gps: {
      /**
       * On Start the GPS turns 90° clockwise and zooms in over this long; on
       * Continue it turns back upright and shrinks over this (Nov 24 follow-up).
       */
      turnMs: 700,
      returnMs: 500,
      /** Turned, the 4:3 screen is as large as fits, up to these shares of the window. */
      maxScreenWidth: 0.92,
      maxScreenHeight: 0.86,
      /**
       * On a phone in landscape the screen is this share of the height. The doc
       * says "almost the full height"; 0.95 is my guess.
       */
      phoneScreenHeight: 0.95,
      /** The stage counts as a phone when it's drawn smaller than this. */
      phoneBelowScale: 0.6,
      /** The pop-up behind dims to this brightness. */
      dim: 0.35,
      /** The upright GPS loops its preview of the game about this often. */
      previewLoopMs: 6000,
      /**
       * The scanlines on the GPS glass (gps-greens update): 1-px lines this dark,
       * every this many px; during play they drift sideways this fast, and a
       * soft brighter band this share of the screen wide sweeps across this often.
       */
      scanlines: { dark: 0.08, everyPx: 3, driftPxPerSec: 10, bandShare: 0.15, bandEveryMs: 6000 },
    },
    bearrels: {
      barrels: { min: 3, max: 6, default: 3 },
      rounds: { min: 1, max: 5, default: 3 },
      shots: { min: 1, max: 2, default: 1 },
      hikers: { min: 1, max: 4, default: ['finn', 'ellie', 'mom'] as readonly string[] },
      /** Silhouette style: the barrel row (its scene units, 1280 × 720 inside the 4:3 view). */
      rowX: [150, 1130] as const,
      barrelTop: 418,
      maxBarrelWidth: 150,
      /** Barrel width = min(max, 980 ÷ (barrels − 1) × this). */
      widthShare: 0.7,
      heightRatio: 1.06,
      /** Hikers behind a barrel: their scale alone, two, and three or four. */
      hikerScale: { one: 1.05, two: 0.8, more: 0.6 },
      hikerSpacing: 76,
      headAbove: 56,
      timing: {
        slideMs: 250,
        bearUpMs: 450,
        sweepMs: 1400,
        holdMs: 300,
        /** After a shot, its effects play this long before the next shot or the duck. */
        fireMs: 450,
        flashInMs: 60,
        flashOutMs: 400,
        secondShotMs: 600,
        duckMs: 500,
        betweenRoundsMs: 700,
        /** The muzzle flash shows this long (Nov 24 follow-up). */
        muzzleMs: 120,
      },
      /**
       * Drag-and-drop (Nov 24 follow-up): a press becomes a drag after moving
       * this far (screen px); a barrel's drop area reaches this far past it
       * (game screen units, 1280 × 960); a drop on nothing flies back this fast.
       * A drop on a barrel slides into place over timing.slideMs.
       */
      drag: { startPx: 6, hitMargin: 12, flyBackMs: 200 },
      /** The red flash's strength, and with reduced motion. */
      flash: 0.4,
      softFlash: 0.2,
      /** A hit hiker tips over this far (degrees). */
      tipDegrees: -24,
    },

    /*
     * The puzzle minigames (Phase 10.8 step 2, docs/design/11-minigames-puzzles.md).
     * TODO(wyatt): every number is a first guess, by game and tier. Tiers are I, II, III.
     */

    /** Traildle: guess hidden digit codes on trail signs, two codes at once at most. */
    traildle: {
      tiers: {
        1: { signs: [3, 4], guesses: 6, repeats: false, timerSec: null },
        2: { signs: [5, 6], guesses: 7, repeats: true, timerSec: 180 },
        3: { signs: [7, 8], guesses: 8, repeats: true, timerSec: 120 },
      } as Readonly<
        Record<
          1 | 2 | 3,
          {
            signs: readonly [number, number];
            guesses: number;
            repeats: boolean;
            timerSec: number | null;
          }
        >
      >,
      /** Two codes at once get this many more guesses. */
      twoCodeExtraGuesses: 1,
      /** The testing tab's Timer "On" on a tier without a timer (Tier I): my guess. */
      timerOnSec: 180,
      /**
       * Fitting the boards (fixes update): small signs up to this wide, rows up
       * to this tall and never shorter than this (the board scrolls instead);
       * the big signs shrink to this for 7 or 8 signs (scene units).
       */
      fit: { maxSign: 16, maxRow: 13, minRow: 9, bigSignScale: 0.85, bigSignsFrom: 7 },
    },

    /** Find the Object: find the named trail snacks in a crowd. */
    findObject: {
      tiers: {
        1: { mode: 'still', distractors: 16, overlap: 0 },
        2: { mode: 'windy', distractors: 22, overlap: 0.25 },
        3: { mode: 'darkWindy', distractors: 26, overlap: 0.25 },
      } as Readonly<
        Record<
          1 | 2 | 3,
          {
            mode: 'still' | 'windy' | 'dark' | 'darkWindy';
            distractors: number;
            overlap: number;
          }
        >
      >,
      /** Rounds in a game (testing tab: 1 to 5); each later round asks for this many more targets. */
      rounds: 3,
      extraTargetsPerRound: 1,
      /** More distractors for each hiker after the first, and for each round after the first. */
      extraDistractorsPerHiker: 3,
      extraDistractorsPerRound: 4,
      /**
       * How many kinds of snack the targets can be: `start` at first, then
       * `more` from round `fromRound`.
       */
      kinds: {
        1: { start: 1, more: 2, fromRound: 2 },
        2: { start: 2, more: 3, fromRound: 3 },
        3: { start: 2, more: 3, fromRound: 3 },
      } as Readonly<Record<1 | 2 | 3, { start: number; more: number; fromRound: number }>>,
      /** The clock each round: these seconds, plus these for each target (testing tab: 0 to 20, and 1 to 8). */
      extraSecPerRound: 3,
      secPerTarget: 3,
      /** A wrong click costs this many seconds. */
      wrongClickSec: 2,
      /** The card naming each round's targets shows this long before the clock starts. */
      introMs: 1500,
      /** Snacks keep this far from the screen's edges (scene units), except in the windy modes. */
      edgeMargin: 4,
      /** Windy: drift (units a second) and a small bob (units, every this many ms). */
      wind: { speed: 12, bob: 2, bobEveryMs: 1500 },
      /** Dark: the flashlight's size and soft edge (scene units); a touch moving less than this (px) is a tap. */
      light: { diameter: 42, softEdge: 8, tapPx: 6 },
    },

    /** Remember the Path: watch the ranger, then walk his path from memory. */
    rememberPath: {
      tiers: {
        1: { cols: 5, rows: 4, length: [5, 6], strikes: 3, stepMs: 500 },
        2: { cols: 6, rows: 5, length: [7, 8], strikes: 2, stepMs: 450 },
        3: { cols: 7, rows: 5, length: [9, 10], strikes: 1, stepMs: 400 },
      } as Readonly<
        Record<
          1 | 2 | 3,
          {
            cols: number;
            rows: number;
            length: readonly [number, number];
            strikes: number;
            stepMs: number;
          }
        >
      >,
      /** Only the ranger's last this many tiles show footprints. */
      footprints: 2,
      /** A wrong step flashes red this long. */
      wrongFlashMs: 400,
    },

    /** Find the Path: take turns guessing a hidden trail, one step at a time. */
    findPath: {
      tiers: {
        1: { cols: 5, rows: 5, fog: false },
        2: { cols: 6, rows: 6, fog: false },
        3: { cols: 7, rows: 7, fog: true },
      } as Readonly<Record<1 | 2 | 3, { cols: number; rows: number; fog: boolean }>>,
      /** Tries for each hiker, each turn. */
      triesPerTurn: 3,
      /** Group attempts: this many, plus this many for each hiker after the first. */
      attempts: 2,
      attemptsPerExtraHiker: 1,
      /** The chance a wrong pick also reveals another tile nobody has picked, and how long its "!" shows. */
      revealChance: 0.35,
      revealMarkMs: 1000,
      /** Making a trail: each step goes up about this often, otherwise left or right. */
      upChance: 0.45,
      /** Fog: only the tiles uncovered in the last this many picks stay visible. */
      fogPicks: 2,
      /** The first hiker through gets this much Energy (shown only in test mode for now). */
      energy: 1,
      /** The trail line draws to a new tile over this long. */
      lineDrawMs: 250,
    },

    /**
     * Dodge (Phase 10.8 steps 3 and 3b, docs/design/12-minigames-dodge.md):
     * one party sprite dodges an animal's attacks in a box. Attacks come from
     * a shared library; an animal is a box, a head and a list of attacks.
     * TODO(wyatt): every number is a first guess, by attack and tier. Sizes,
     * places and distances are in scene units (320 × 240), speeds in units a
     * second. "From" is the first tier an attack or variant shows up on.
     */
    dodge: {
      tiers: {
        1: { lengthSec: 20, speed: 1.0, gapSec: 1.6 },
        2: { lengthSec: 25, speed: 1.2, gapSec: 1.3 },
        3: { lengthSec: 30, speed: 1.4, gapSec: 1.0 },
      } as Readonly<Record<1 | 2 | 3, { lengthSec: number; speed: number; gapSec: number }>>,
      /** Lives per hiker; the active hiker switches this often; the colors blink this long first. */
      lives: 2,
      switchSec: 5,
      blinkSec: 1,
      /** After a hit, no more hits for this long. */
      safeSec: 1,
      /** Every attack is warned this long before it can hit (unless it says otherwise), never less than the minimum. */
      warnSec: 0.6,
      warnMinSec: 0.35,
      /** The first attack comes this soon. */
      firstAttackSec: 0.8,
      /** The sprite's speed and its forgiving hitbox (radius). */
      moveSpeed: 80,
      hitRadius: 3,
      /** The box grows, shrinks or moves over this long. */
      boxEaseSec: 0.4,
      /** The touch joystick's knob goes this far from where the finger landed (screen px). */
      joystickPx: 24,
      /**
       * Each animal's box (width × height) and its middle on screen. The new
       * boxes sit with their bottom at y 196, as in the mockups. "herd" is the
       * Stampede's own box, for Herd rush (my guess, from 9-stampede.png).
       */
      animals: {
        bees: { box: [120, 120], at: [160, 138] },
        bear: { box: [140, 110], at: [160, 141] },
        swordBear: { box: [180, 80], at: [160, 146] },
        bobcat: { box: [150, 110], at: [160, 141] },
        squirrels: { box: [130, 120], at: [160, 136] },
        herd: { box: [160, 100], at: [160, 146] },
      } as Readonly<
        Record<
          'bees' | 'bear' | 'swordBear' | 'bobcat' | 'squirrels' | 'herd',
          { box: readonly [number, number]; at: readonly [number, number] }
        >
      >,
      /**
       * The first tier each attack shows up on (1 when not listed). The
       * attacks marked Claude's idea are in attacks/claudesIdeas.ts.
       */
      unlocks: {
        diagonal: 2,
        zigzag: 2,
        aimed: 3,
        roar: 2,
        hug: 2,
        honey: 3,
        xSlash: 3,
        thrown: 3,
        dash: 2,
        landingSwipe: 3,
        scurry: 2,
      } as Readonly<Partial<Record<string, 1 | 2 | 3>>>,
      /**
       * Wild Predator Stampede: this much longer than the tier's length by
       * default; no animal more than this many times in a row; on Tier III,
       * this chance that a second animal's attack starts this long into the
       * first (my guess at the chance).
       */
      stampede: {
        extraSec: 10,
        maxSameAnimal: 2,
        overlapFrom: 3,
        overlapChance: 0.35,
        overlapAfterSec: 0.8,
      },
      bees: {
        radius: 2.5,
        speed: 80,
        /** The two frames swap this often. */
        frameSec: 0.1,
        /** Lane: this many bees, with one gap lane. Cross: this many per lane. */
        lane: [4, 6] as const,
        cross: [3, 4] as const,
        /** Diagonal: this many bees, this far apart, starting this far apart in time. */
        diagonal: { bees: 5, spacing: 20, staggerSec: 0.12 },
        /** Zigzag: this many bees, swinging this far, this many times a second. */
        zigzag: { bees: 2, amplitude: 28, perSec: 1.2 },
        /** Aimed: this many bees, launched this far apart in time. */
        aimed: { bees: 4, staggerSec: 0.3 },
      },
      /** Bear with a Sword's sweep (unchanged), and its shrinking box on Tier III. */
      sword: {
        /** Tier III: the box sometimes shrinks to this for this many of the bear's attacks. */
        shrunk: [140, 70] as const,
        shrinkFrom: 3,
        shrinkChance: 0.3,
        shrinkSwings: 3,
        /** The sword is this long from its pivot (above the box); the blade is this thick. */
        blade: 116,
        bladeHalfWidth: 2,
        pivotAbove: 8,
        /** The warning starts at this, gets this much shorter each swing, and never goes under this. */
        warnStartSec: 0.8,
        warnShrink: 0.08,
        warnMinSec: 0.35,
        /** The sweep takes this long, a little quicker each swing, never under this. */
        sweepSec: 0.35,
        sweepShrink: 0.03,
        sweepMinSec: 0.2,
        /** Tier II and up: sometimes a double swing, the second this long after the first. */
        doubleFrom: 2,
        doubleChance: 0.35,
        doubleGapSec: 0.3,
      },
      /**
       * Claws (Bear, Bear with a Sword, Bobcat): a row of claw marks this far
       * apart, crossing the box. Each claw hits as a segment this long and
       * thick. Curved swipes swing around a pivot this far outside a corner,
       * over this much of a turn (my guesses), half the time once unlocked.
       * Double: a second row from the opposite side this long after.
       */
      claws: {
        count: { 1: 3, 2: 4, 3: 4 } as Readonly<Record<1 | 2 | 3, number>>,
        spacing: 9,
        speed: 90,
        length: 14,
        thickness: 1,
        curvedFrom: 2,
        curvedChance: 0.5,
        pivotOut: 24,
        sweepDeg: 100,
        doubleFrom: 3,
        doubleDelaySec: 0.5,
        /** Bobcat claws: this much faster, with this warning. Bear with a Sword's never double. */
        bobcat: { speed: 1.25, warnSec: 0.5 },
      },
      /**
       * Bite (Bear): jaws open around a zone this big for this long, then snap
       * shut this fast. Tier III: two bites in a row.
       */
      bite: {
        zone: [40, 26] as const,
        openSec: 0.7,
        snapSec: 0.12,
        doubleFrom: 3,
        closedSec: 0.25,
      },
      /**
       * Sword jab (Bear with a Sword): a lane this wide shows this long, then the
       * blade thrusts to the far wall this fast, stays, and pulls back (my
       * guess). Tier II: two in a row, and diagonal lanes. Tier III: also a fan
       * of this many, this far apart (my guess).
       */
      jab: {
        laneWidth: 5,
        warnSec: 0.5,
        thrustSec: 0.12,
        holdSec: 0.15,
        pullSec: 0.15,
        pairFrom: 2,
        diagonalFrom: 2,
        diagonalDeg: [25, 40] as const,
        fanFrom: 3,
        fanCount: 3,
        fanSpreadDeg: 18,
      },
      /**
       * Poke-up slide (Bear with a Sword): the sword slides just outside a wall
       * at this speed (my guess); every this far along it stabs in this deep
       * (part of the box's depth) for this long; each stab spot shows "!" this
       * long before. Tier II: from the top or the bottom. Tier III: both at once,
       * the top one's spots half a step along.
       */
      poke: {
        slideSpeed: 90,
        spacing: 28,
        depth: 0.45,
        stabSec: 0.25,
        markSec: 0.4,
        topFrom: 2,
        bothFrom: 3,
      },
      /**
       * Pounce (Bobcat): a shadow this big grows over this long, then it lands.
       * Tier II: aimed at the sprite, two in a row. Tier III: also a feint, the
       * real shadow showing this long before landing. The dust and the
       * bobcat stay this long after landing (my guess).
       */
      pounce: {
        shadow: [60, 40] as const,
        growSec: 0.7,
        aimedFrom: 2,
        twoFrom: 2,
        feintFrom: 3,
        feintRealSec: 0.4,
        dustSec: 0.3,
      },
      /**
       * Rolling acorns (Squirrel Army): a squirrel pops up at the edge with a
       * warning, then throws an acorn at this speed, at least this far from the
       * wall's line. Each bounce cracks it; it breaks on this bounce into
       * crumbs that fade over this long. This many at once, by tier.
       */
      acorns: {
        speed: 70,
        minAngleDeg: 25,
        breakOn: 3,
        radius: 3,
        crumbsSec: 0.3,
        count: { 1: 2, 2: 3, 3: 4 } as Readonly<Record<1 | 2 | 3, number>>,
      },
      /**
       * Acorn bombs (Squirrel Army): lobbed over the top edge (this high, my
       * guess) to a spot marked this long before; they sit, or roll at this
       * speed from Tier II; the fuse burns this long; the blast reaches this far
       * for this long. This many at once, by tier.
       */
      bombs: {
        markSec: 0.6,
        lobHeight: 30,
        rollSpeed: 15,
        rollFrom: 2,
        fuseSec: 1.6,
        radius: 26,
        blastSec: 0.2,
        count: { 1: [1, 1], 2: [2, 2], 3: [2, 3] } as Readonly<
          Record<1 | 2 | 3, readonly [number, number]>
        >,
      },
      /**
       * Shrapnel (Tier III): from a bomb's blast and from a breaking acorn, in
       * straight lines at this speed (the acorns' speed is my guess: the same),
       * gone at the walls.
       */
      shrapnel: { from: 3, bombPieces: 8, acornPieces: 4, speed: 100, radius: 1.5 },

      // Claude's ideas (attacks/claudesIdeas.ts): Wyatt keeps or cuts them after playing.
      /** Roar: rings from the top middle of the box, this far apart in time (my guess), each with a gap. */
      roar: { rings: [2, 3] as const, speed: 60, gap: 26, thickness: 2, everySec: 0.7 },
      /** Bear hug: the side walls squeeze in to this much of the width, hold, and go back; Claws come too this often (my guess). */
      hug: { width: 0.55, squeezeSec: 0.5, holdSec: 1, clawsChance: 0.5 },
      /** Honey drips: drops in this many columns, falling this fast (my guess), leaving sticky puddles that slow the sprite. */
      honey: {
        columns: [2, 3] as const,
        speed: 70,
        radius: 3,
        staggerSec: 0.25,
        puddle: [30, 10] as const,
        puddleSec: 3,
        slow: 0.5,
      },
      /** X slash: two diagonal slashes this far apart in time, each showing this long (my guess). */
      xSlash: { gapSec: 0.3, showSec: 0.15, thickness: 3 },
      /** Thrown sword: spins across and back on a lower line (my guesses for all of it). */
      thrown: {
        speed: 140,
        spinPerSec: 2.5,
        length: 48,
        thickness: 3,
        lines: [0.3, 0.75] as const,
      },
      /** Zigzag dash: the bobcat dashes along a zigzag (this fast, this many legs, this wide: my guesses). */
      dash: { warnSec: 0.7, speed: 160, radius: 8, legs: 4, amplitude: 0.35 },
      /** Pinecone rain: this many columns, falling (gravity, one bounce), then rolling off (my guesses). */
      pinecones: {
        columns: [3, 5] as const,
        radius: 4,
        gravity: 260,
        bounce: 0.45,
        rollSpeed: 60,
        staggerSec: 0.15,
      },
      /** Wall scurry: a line of squirrels runs around the box just inside the walls (spacing and size: my guesses). */
      scurry: { squirrels: 4, speed: 110, spacing: 14, inset: 6, radius: 4 },
      /** Herd rush: a wall of moose with this many gaps by tier (speed and lanes: my guesses). */
      herd: {
        speed: 110,
        gaps: { 1: 2, 2: 2, 3: 1 } as Readonly<Record<1 | 2 | 3, number>>,
        lane: 20,
        hitInset: 3,
      },
    },
  },

  /** Screen timings (Nov 14 update). */
  ui: {
    /**
     * Nothing cut off (Phase 10.6): a card row that doesn't fit shrinks evenly
     * down to this scale, then wraps onto another row. TODO(wyatt): [80%].
     */
    cardRowMinScale: 0.8,
    /** Tooltips and hover windows keep this far from the game screen's edges (px). TODO(wyatt): [8 px]. */
    popupMargin: 8,
    /** Hovering a card or item this long (ms) opens its preview. TODO(wyatt): [400 ms]. */
    previewHoverMs: 400,
    /** A long-press on a phone: this long (ms) opens the preview instead of a tap. */
    longPressMs: 450,
    /**
     * The forest outside a station's windows drifts left: seconds for the
     * farthest layer to loop, and for the nearest; the ones between are
     * spaced evenly. TODO(wyatt): [180 s] and [70 s].
     */
    stationDrift: { farSeconds: 180, nearSeconds: 70 },
    /** Multi-select: each grouped hiker acts this long (ms) after the last. TODO(wyatt): first guess. */
    groupStepMs: 350,
    /** A hiker card turns over in this long (ms). TODO(wyatt): [0.35 s]. */
    cardFlipMs: 350,
    /**
     * Hovering a flipped hiker card lifts it to the middle of the screen at
     * this size (times a full 300 × 420 card). TODO(wyatt): [1.2×].
     */
    cardLiftScale: 1.2,
    /**
     * The hiker selection screen's swirling background (src/shaders/
     * hiker-select-bg.frag). TODO(wyatt): swirl [1.2], pixels [150] and pull
     * [0.5] are from the plan; the drift and ease are first guesses.
     */
    /**
     * The level-up screen's opening (mockups/LevelUp.png), in seconds from
     * when it opens. TODO(wyatt): the blur [10 px], the bar's fill [1.2 s]
     * and the deal [0.15 s apart] are bracketed in the plan.
     */
    /**
     * Opening a Present (holiday hikers): the box shakes, the lid pops, then
     * the item flips in like a Mystery Item (520 ms). Choosy's cards are dealt
     * a little apart. Wreck the Halls' confetti burst. TODO(wyatt): first guesses.
     */
    presentOpen: { shakeMs: 700, popMs: 350, flipMs: 520, dealGapMs: 150, smashMs: 900 },
    levelUp: {
      blurPx: 10,
      portraitAt: 0.1,
      barAt: 0.6,
      barSeconds: 1.2,
      badgeAt: 1.8,
      cardsAt: 2.0,
      dealGapSeconds: 0.15,
      traitsAt: 2.5,
    },
    selectBackground: {
      /** How much the paint twists toward the edges. */
      swirl: 1.2,
      /** How many pixel rows tall the screen is (chunkier when lower). */
      pixels: 150,
      /** How much the paint bends toward the pointer. */
      pull: 0.5,
      /** Never drawn at more than this many device pixels per screen pixel. */
      maxPixelRatio: 1.5,
      /** With the pointer away, the bend drifts in a loop this long (s)... */
      driftSeconds: 40,
      /** ...this far from the middle (0 to 0.5 of the screen). */
      driftRadius: 0.25,
      /** How quickly the bend follows the pointer (higher is snappier). */
      pointerEase: 2.5,
    },
  },
};
