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

/** A minigame's challenge tier, I to V (docs/design/15-challenge-tiers.md). */
type MgTier = 1 | 2 | 3 | 4 | 5;

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
     * Which tier a challenge gets (15-challenge-tiers.md, Nov 25): each
     * challenge rolls its tier from its biome's table (Biome 1, 2, 3) when
     * it's placed, as [tier, weight] pairs. Normal is used on Easy, Medium
     * and Hard; Nightmare climbs from III to V. Hard, Random tiers and Boss
     * Rush are written down for later and not used yet (Boss Rush: every
     * challenge a Dodge fight, its tiers climbing from I to V by the end).
     * TODO(wyatt): every percentage is a first guess.
     */
    tierTables: {
      normal: [
        [
          [1, 80],
          [2, 20],
        ],
        [
          [2, 75],
          [3, 25],
        ],
        [
          [3, 75],
          [4, 25],
        ],
      ],
      nightmare: [
        [
          [3, 80],
          [4, 20],
        ],
        [
          [4, 75],
          [5, 25],
        ],
        [
          [5, 75],
          [4, 25],
        ],
      ],
      // Later: Hard is Normal with a rare Tier V in Biome 3.
      hard: [
        [
          [1, 80],
          [2, 20],
        ],
        [
          [2, 75],
          [3, 25],
        ],
        [
          [3, 65],
          [4, 25],
          [5, 10],
        ],
      ],
      // Later: every tier equally likely, in every biome.
      random: [0, 1, 2].map(() => [1, 2, 3, 4, 5].map((t) => [t, 20])),
    } as Readonly<
      Record<
        'normal' | 'nightmare' | 'hard' | 'random',
        readonly (readonly (readonly [number, number])[])[]
      >
    >,
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
   * every game. TODO(wyatt): every number here is a first guess.
   */
  minigames: {
    /**
     * A bar that changes all at once (a hit, a plank falling) slides to its
     * new value over this long; one that changes every frame (a timer) has
     * no slide (26-fixes-and-wyatt-trees.md, section 1). TODO(wyatt): [0.25 s].
     */
    barEaseSec: 0.25,
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
      scanlines: {
        dark: 0.1,
        everyPx: 3,
        /** Lines are spaced as on the prototype's 288-px-wide screen (section 2.1, version 3). */
        referenceWidth: 288,
        driftPxPerSec: 10,
        bandShare: 0.15,
        bandEveryMs: 6000,
      },
    },
    /** Every game's Hikers setting in the testing tab: how many, and who by default. */
    hikers: { min: 1, max: 4, default: ['finn', 'ellie', 'mom'] as readonly string[] },
    /** The line-up: a press becomes a drag after moving this far (screen px). */
    lineUp: { dragStartPx: 6 },
    /**
     * The challenge pop-up's Prepare and bars (docs/design/20-challenge-popup.md,
     * version 3: cost cards hold at most [3] slots; slots are [54] across with
     * ghost icons at [50%]; a fillable slot's outline turns once every [2.4 s]
     * and breathes down to [55%] every [1.6 s]; up to [4] rule lines under
     * How to play; bar changes slide in over [0.35 s]. TODO(wyatt).)
     * - Level bars have this many segments; the tier sets the start at tier +
     *   this (Tier I is 4/10); each SLOWER slot is one level, this share
     *   slower. TODO(wyatt): the design gives no mapping; these are my guesses.
     * - Time bars: a segment per [5 s], or [10 s] for games over [60 s].
     * - Slots: [52] across, ghost icons at [26%] cycling every [1.3 s].
     * - The demo: the result shows [2.4 s] before the next round; long games
     *   are cut at [30 s]; the bot goes wrong about this often (its own
     *   games say how).
     * - The testing tab's Packs: Made-up gives each hiker this many kinds of
     *   resources (1 to 3 of each) and this many items; Lots gives this many
     *   of every resource and one of every Prepare item. TODO(wyatt).
     */
    prepare: {
      levels: 10,
      levelFromTier: 3,
      levelStep: 0.1,
      segSec: 5,
      longSegSec: 10,
      longGameSec: 60,
      slotPx: 54,
      ghostOpacity: 0.5,
      ghostCycleSec: 1.3,
      cardSlots: 3,
      ringTurnSec: 2.4,
      ringBreatheSec: 1.6,
      ringBreatheLow: 0.55,
      ruleLines: 4,
      barSlideSec: 0.35,
      demo: { resultSec: 2.4, cutSec: 30, mistake: [0.15, 0.25] as const },
      packs: { madeUp: { kinds: [3, 6] as const, items: [1, 3] as const }, lots: 6 },
    },

    /*
     * The puzzle minigames (Phase 10.8 step 2, docs/design/11-minigames-puzzles.md).
     * TODO(wyatt): every number is a first guess, by game and tier. Tiers are I to V.
     */

    /** Traildle: guess hidden digit codes on trail signs, two codes at once at most. */
    traildle: {
      tiers: {
        1: { signs: [3, 4], guesses: 6, repeats: false, timerSec: null },
        2: { signs: [5, 6], guesses: 7, repeats: true, timerSec: 180 },
        3: { signs: [7, 8], guesses: 8, repeats: true, timerSec: 120 },
        // Tiers IV and V (fallback rule, 15-challenge-tiers.md): timer ×0.85 and ×0.7, guesses the
        // same. The codes can't grow past 8 (the board and the Signs setting stop there). TODO(wyatt).
        4: { signs: [8, 8], guesses: 8, repeats: true, timerSec: 102 },
        5: { signs: [8, 8], guesses: 8, repeats: true, timerSec: 84 },
      } as Readonly<
        Record<
          MgTier,
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
      /**
       * By tier: the mode, distractors and overlap; the seconds per target
       * and per round (when Auto), the wind's speed, the flashlight's size,
       * and more targets every round. Tiers I to III use the old single
       * values; IV and V follow the fallback rule (15-challenge-tiers.md):
       * times ×0.85 and ×0.7, speed ×1.15 and ×1.3, the light ×0.85 and ×0.7,
       * +1 and +2 targets. TODO(wyatt).
       */
      tiers: {
        1: {
          mode: 'still',
          distractors: 16,
          overlap: 0,
          secPerTarget: 3,
          extraSecPerRound: 3,
          windSpeed: 12,
          light: 42,
          extraTargets: 0,
        },
        2: {
          mode: 'windy',
          distractors: 22,
          overlap: 0.25,
          secPerTarget: 3,
          extraSecPerRound: 3,
          windSpeed: 12,
          light: 42,
          extraTargets: 0,
        },
        3: {
          mode: 'darkWindy',
          distractors: 26,
          overlap: 0.25,
          secPerTarget: 3,
          extraSecPerRound: 3,
          windSpeed: 12,
          light: 42,
          extraTargets: 0,
        },
        4: {
          mode: 'darkWindy',
          distractors: 26,
          overlap: 0.25,
          secPerTarget: 2.55,
          extraSecPerRound: 2.55,
          windSpeed: 13.8,
          light: 35.7,
          extraTargets: 1,
        },
        5: {
          mode: 'darkWindy',
          distractors: 26,
          overlap: 0.25,
          secPerTarget: 2.1,
          extraSecPerRound: 2.1,
          windSpeed: 15.6,
          light: 29.4,
          extraTargets: 2,
        },
      } as Readonly<
        Record<
          MgTier,
          {
            mode: 'still' | 'windy' | 'dark' | 'darkWindy';
            distractors: number;
            overlap: number;
            secPerTarget: number;
            extraSecPerRound: number;
            windSpeed: number;
            light: number;
            extraTargets: number;
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
        4: { start: 2, more: 3, fromRound: 3 },
        5: { start: 2, more: 3, fromRound: 3 },
      } as Readonly<Record<MgTier, { start: number; more: number; fromRound: number }>>,
      /** The testing tab's defaults for the clock each round (0 to 20, and 1 to 8); Auto uses the tier's. */
      extraSecPerRound: 3,
      secPerTarget: 3,
      /** A wrong click costs this many seconds. */
      wrongClickSec: 2,
      /** The card naming each round's targets shows this long before the clock starts. */
      introMs: 1500,
      /** Snacks keep this far from the screen's edges (scene units), except in the windy modes. */
      edgeMargin: 4,
      /** Windy: a small bob (units, every this many ms); the drift speed is the tier's. */
      wind: { bob: 2, bobEveryMs: 1500 },
      /** Dark: the flashlight's soft edge (scene units; its size is the tier's); a touch moving less than this (px) is a tap. */
      light: { softEdge: 8, tapPx: 6 },
    },

    /** Remember the Path: watch the ranger, then walk his path from memory. */
    rememberPath: {
      tiers: {
        1: { cols: 5, rows: 4, length: [5, 6], strikes: 3, stepMs: 500 },
        2: { cols: 6, rows: 5, length: [7, 8], strikes: 2, stepMs: 450 },
        3: { cols: 7, rows: 5, length: [9, 10], strikes: 1, stepMs: 400 },
        // Tiers IV and V (fallback rule): +1 and +2 steps, the ranger ×1.15 and ×1.3 as fast,
        // strikes the same; the grid stays 7 × 5. TODO(wyatt).
        4: { cols: 7, rows: 5, length: [10, 11], strikes: 1, stepMs: 348 },
        5: { cols: 7, rows: 5, length: [11, 12], strikes: 1, stepMs: 308 },
      } as Readonly<
        Record<
          MgTier,
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
        1: { cols: 5, rows: 5, fog: false, revealChance: 0.35 },
        2: { cols: 6, rows: 6, fog: false, revealChance: 0.35 },
        3: { cols: 7, rows: 7, fog: true, revealChance: 0.35 },
        // Tiers IV and V (fallback rule, my judgment): a bigger grid doesn't fit the screen, so the
        // chance a wrong pick reveals another tile shrinks like a window, ×0.85 and ×0.7. TODO(wyatt).
        4: { cols: 7, rows: 7, fog: true, revealChance: 0.3 },
        5: { cols: 7, rows: 7, fog: true, revealChance: 0.25 },
      } as Readonly<
        Record<MgTier, { cols: number; rows: number; fog: boolean; revealChance: number }>
      >,
      /** Tries for each hiker, each turn. */
      triesPerTurn: 3,
      /** Group attempts: this many, plus this many for each hiker after the first. */
      attempts: 2,
      attemptsPerExtraHiker: 1,
      /** How long the "!" shows on a tile a wrong pick revealed (the chance is the tier's). */
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

    /** Tinted art (Sleeping Bear's hikers, raccoon masks): the gray parts become the hiker's color at this brightness. TODO(wyatt): [70%]. */
    tintShade: 0.7,

    /**
     * The end screen every minigame shares (16-challenge-end-screen.md).
     * TODO(wyatt): every number is a first guess.
     * - The title sits this far down, this big; it flashes on and off this
     *   long for this long once the screen is in. TAP TO CONTINUE takes
     *   input this long after that. Rows start here, this far apart.
     * - Passing: the clock wipe takes this long. Reduced motion: a crossfade.
     * - Failing: drips this wide start this far apart and cover the screen
     *   in about this long; the screen wipes in from the top this fast,
     *   leaving drips this long hanging from about this share of them.
     */
    endScreen: {
      titleY: 40,
      titleSize: 16,
      flash: { onSec: 0.5, offSec: 0.2, forSec: 2.5 },
      inputAfterSec: 0.8,
      rowsTop: 86,
      rowGap: 22,
      tileY: 172,
      tapY: 216,
      wipeSec: 0.8,
      fadeSec: 0.3,
      drips: {
        width: [2, 5] as const,
        startSec: [0, 0.25] as const,
        coverSec: 1.0,
        wipeSec: 0.3,
        hang: [6, 24] as const,
        hangShare: 0.55,
      },
    },

    /*
     * New challenges, step 1 (Phase 10.8 step 5, docs/design/14-minigames-trail-blocks.md).
     * TODO(wyatt): every number is a first guess, by game and tier. Tiers are I to V.
     */

    /**
     * Passing challenges: hikers who pass move onto the tile; the rest go
     * back and pay. If nobody passes, everyone loses at least this much
     * energy by tier, and the challenge stays on the tile, face up.
     */
    passing: {
      nobodyEnergy: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2 } as Readonly<Record<MgTier, number>>,
    },

    /** Trail Blocks: a first-person timing game in four versions, sharing an energy bar of each hiker's chunk. */
    trailBlocks: {
      /** Each hiker's chunk of the energy bar. Running out costs a hiker this much real energy. */
      chunk: 24,
      ranOutEnergy: 1,
      /** A swing costs this; a miss costs this (in all); a perfect swing gives this back. */
      swingCost: 2,
      missCost: 4,
      perfectRefund: 1,
      /** Work to clear: a base and more per hiker, by tier. */
      work: {
        1: { base: 50, perHiker: 25 },
        2: { base: 60, perHiker: 30 },
        3: { base: 70, perHiker: 35 },
        4: { base: 80, perHiker: 40 },
        5: { base: 90, perHiker: 45 },
      } as Readonly<Record<MgTier, { base: number; perHiker: number }>>,
      /** A good swing does this much work by accuracy; a perfect one (the best share of the zone) does this. */
      good: [8, 14] as const,
      perfect: 16,
      perfectShare: 0.15,
      /** Each swing's animation; the marker freezes where it stopped this long (input waits meanwhile). */
      swingSec: 0.35,
      freezeSec: 1,
      /**
       * The tools (Nov 25, Wyatt's sprites, no arm): the active hiker's color
       * laid over the whole tool at this share. A cleared tree tips over this fast.
       */
      wash: 0.3,
      tipSec: 0.6,
      /**
       * Chop Tree's axe (third pass): it slides down out of view after the
       * marker turns, and up on the other side once it crosses the middle;
       * each slide takes this long, or this share of the pass if that's
       * shorter. The chop: raise, chop-1, chop-2 (the hit), then back to ready.
       */
      axeSlideSec: 0.2,
      axeSlideShare: 0.2,
      chopSec: { raise: 0.08, chop1: 0.04, chop2: 0.12, back: 0.15 },
      /**
       * Clearing Animals' whistle (third pass): 160 × 160 frames at (172, 44),
       * the mouthpiece at (138, 140) in every frame. A good whistle leans
       * toward the ring (the closest of these directions, in degrees, 90 up
       * and 180 left) and moves this far toward it for this long, then eases
       * back over `backSec`. A whiff shakes it this far for this long. Each
       * lean frame's chamber end (where the waves start), measured from the art.
       */
      whistle: {
        x: 172,
        y: 44,
        mouth: { x: 138, y: 140 },
        leans: [105, 125, 145, 165] as const,
        chamber: {
          105: { x: 129, y: 3 },
          125: { x: 85, y: 13 },
          145: { x: 47, y: 37 },
          165: { x: 15, y: 77 },
        } as Readonly<Record<105 | 125 | 145 | 165, { x: number; y: number }>>,
        move: 6,
        leanSec: 0.35,
        backSec: 0.2,
        shake: 1,
        shakeSec: 0.2,
      },
      /**
       * Chop Tree (Nov 25, after Wyatt played it): each pass of the marker
       * across the bar takes a random time from the tier's range, picked
       * every time it turns around; each green zone is this share of the bar.
       */
      chop: {
        passSec: {
          1: [0.8, 1.4],
          2: [0.7, 1.2],
          3: [0.6, 1.0],
          4: [0.55, 0.9],
          5: [0.5, 0.8],
        } as Readonly<Record<MgTier, readonly [number, number]>>,
        zone: { 1: 0.14, 2: 0.11, 3: 0.09, 4: 0.08, 5: 0.07 } as Readonly<Record<MgTier, number>>,
      },
      /** Mine Rockslide: the power bar fills to the top this fast; the green zone is this tall. */
      rockslide: {
        fillSec: { 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.6, 5: 0.55 } as Readonly<Record<MgTier, number>>,
        zone: { 1: 0.24, 2: 0.18, 3: 0.13, 4: 0.11, 5: 0.1 } as Readonly<Record<MgTier, number>>,
      },
      /** River Flood: this many spots, each this wide, on a bar crossed this fast. The water's top goes from here down to here. */
      river: {
        spots: { 1: 4, 2: 4, 3: 5, 4: 5, 5: 6 } as Readonly<Record<MgTier, number>>,
        // Bigger (Nov 25): it was too hard.
        spot: { 1: 0.15, 2: 0.12, 3: 0.1, 4: 0.09, 5: 0.08 } as Readonly<Record<MgTier, number>>,
        passSec: { 1: 1.3, 2: 1.1, 3: 0.9, 4: 0.8, 5: 0.7 } as Readonly<Record<MgTier, number>>,
        waterTop: [128, 196] as const,
      },
      /**
       * Clearing Animals: a ring this big, somewhere new in this area for
       * every try (Nov 25), never over the HUD (whose bottom is here) or the
       * whistle (this area, my guess from its frames); a solid circle starts
       * this many times its size and shrinks to nothing this fast; the ring
       * is this thick. Just outside it (this far) is a weak hit for this much
       * work. The crowd starts this big (my guess).
       */
      animals: {
        ring: { x: 160, y: 64, r: 26 },
        area: { x: [50, 270] as const, y: [44, 150] as const },
        hudBottom: 22,
        // The whistle at rest (third pass): its frame's visible area.
        tool: { x: 237, y: 51, w: 75, h: 135 },
        startScale: 2.2,
        shrinkSec: { 1: 1.5, 2: 1.2, 3: 1.0, 4: 0.9, 5: 0.8 } as Readonly<Record<MgTier, number>>,
        thickness: { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4 } as Readonly<Record<MgTier, number>>,
        weakReach: 5,
        weakWork: 4,
        crowd: 8,
      },
    },

    /** Sleeping Bear: red light, green light past a sleeping bear, one hiker at a time. */
    sleepingBear: {
      tiers: {
        // Nov 25: more time per hiker (10/9/8/7.5/7 s), with the clock paused while he's awake.
        1: { asleep: [2.5, 4.5], stirSec: 0.9, awake: [1.5, 2.5], fakeOut: 0, secPerHiker: 10 },
        2: { asleep: [2, 4], stirSec: 0.7, awake: [1.5, 2.5], fakeOut: 0.3, secPerHiker: 9 },
        3: { asleep: [1.5, 3.5], stirSec: 0.5, awake: [1.5, 2.5], fakeOut: 0.4, secPerHiker: 8 },
        4: { asleep: [1.2, 3], stirSec: 0.45, awake: [1.5, 2.5], fakeOut: 0.45, secPerHiker: 7.5 },
        5: { asleep: [1, 2.5], stirSec: 0.4, awake: [1.5, 2.5], fakeOut: 0.5, secPerHiker: 7 },
      } as Readonly<
        Record<
          MgTier,
          {
            asleep: readonly [number, number];
            stirSec: number;
            awake: readonly [number, number];
            fakeOut: number;
            secPerHiker: number;
          }
        >
      >,
      /** Moving within this long after his eyes open is forgiven. */
      graceSec: 0.12,
      /** Walking speed (Nov 25: was 45) and the path's length (scene units). */
      speed: 55,
      path: 272,
      /**
       * The clock (Nov 25): it stops while he's awake and while a caught
       * hiker is sent off; while he stirs and the hiker keeps moving, it goes
       * up this fast instead (seconds a second), never past the start.
       */
      stirEarnRate: 1,
      /** After a catch, the next hiker starts this long later (my guess). */
      roarSec: 1,
      /** The testing tab's Fake-outs "On" on Tier I uses Tier II's chance. */
      fakeOutOn: 0.3,
      /** What being caught costs (resources lost and a condition), and running out of time. */
      caught: { resources: 1, condition: 'bleeding' },
      timeOutEnergy: 1,
    },

    /**
     * Whackoon: whack-a-mole with raccoons in trash cans; skunks are decoys.
     * Everyone at once, in colors (the Turns mode is gone, Nov 25).
     */
    whackoon: {
      /**
       * By tier: columns of cans (three rows), how long each one stays up,
       * the fewest and the most up at once, how often skunks come, and the
       * whacks each hiker needs on their own color. Between the fewest and
       * the most, another pops up every `everySec` (the old rhythm; my guess).
       */
      tiers: {
        1: { cols: 3, upSec: 1.2, minUp: 2, maxUp: 3, everySec: 0.7, skunks: 0, target: 5 },
        2: { cols: 3, upSec: 1.0, minUp: 2, maxUp: 4, everySec: 0.55, skunks: 0.15, target: 6 },
        3: { cols: 4, upSec: 0.8, minUp: 3, maxUp: 4, everySec: 0.45, skunks: 0.25, target: 7 },
        4: { cols: 4, upSec: 0.7, minUp: 3, maxUp: 5, everySec: 0.4, skunks: 0.3, target: 8 },
        5: { cols: 4, upSec: 0.6, minUp: 3, maxUp: 5, everySec: 0.35, skunks: 0.35, target: 9 },
      } as Readonly<
        Record<
          MgTier,
          {
            cols: number;
            upSec: number;
            minUp: number;
            maxUp: number;
            everySec: number;
            skunks: number;
            target: number;
          }
        >
      >,
      /** One shared clock: this much per hiker. Under the fewest up, another pops up within this long. */
      secPerHiker: 8,
      refillSec: 0.2,
      /** A raccoon peeks this long first; a whacked one bonks this long (my guess). */
      peekSec: 0.15,
      bonkSec: 0.3,
      /** A whacked skunk fogs the cans this long and takes this much off the clock. */
      sprayFogSec: 1,
      sprayCostSec: 2,
      /**
       * The testing tab's Skunks "On" on Tier I uses Tier II's chance. A hiker
       * short of their whacks loses this much energy. Whacking a done
       * hiker's raccoon does nothing, and the mallet can't swing again for this long.
       */
      skunksOn: 0.15,
      failEnergy: 1,
      donePauseSec: 0.5,
      /**
       * The mallet (third pass): Wyatt's hammer, 35 × 37 at the cans' scale.
       * The pointer is at this spot on it (the head's flat face in
       * `mallet-whack`; adjust by eye), and a click swings it this long.
       */
      mallet: { w: 35, h: 37, hotX: 11, hotY: 29, swingSec: 0.15 },
    },

    /*
     * The lane games (Phase 10.8 step 7, docs/design/17-minigames-lanes.md):
     * Crossing, Train! and Rafting, all passing challenges.
     * TODO(wyatt): every number is a first guess, by game and tier.
     */

    /**
     * Crossing (Road, River, Critter, Mixed): Frogger, one hiker at a time.
     * By tier: lanes, lives per hiker, seconds per attempt, lane speeds
     * (units a second, from–to), the gap between things in a lane (from–to),
     * and how many turtle groups dive.
     */
    crossing: {
      tiers: {
        1: { lanes: 4, lives: 3, attemptSec: 20, speed: [25, 40], gap: [64, 110], divers: 0 },
        2: { lanes: 5, lives: 2, attemptSec: 18, speed: [30, 50], gap: [56, 96], divers: 1 },
        3: { lanes: 6, lives: 1, attemptSec: 18, speed: [35, 60], gap: [48, 88], divers: 2 },
        4: { lanes: 7, lives: 1, attemptSec: 16, speed: [40, 70], gap: [44, 80], divers: 2 },
        5: { lanes: 8, lives: 1, attemptSec: 15, speed: [45, 80], gap: [40, 72], divers: 3 },
      } as Readonly<
        Record<
          MgTier,
          {
            lanes: number;
            lives: number;
            attemptSec: number;
            speed: readonly [number, number];
            gap: readonly [number, number];
            divers: number;
          }
        >
      >,
      /** The grid: rows this tall, this many columns; a hop takes this long. */
      row: 16,
      cols: 20,
      hopSec: 0.12,
      /**
       * Critter Crossing is the easy one: speeds and gaps scaled, one more
       * life, and from Tier II some critters stop for a moment now and then
       * (how often: my guess).
       */
      critter: {
        speed: 0.7,
        gap: 1.3,
        extraLives: 1,
        stopFrom: 2,
        stopChance: 0.4,
        stopSec: [0.5, 1.5] as const,
        stopEverySec: [2, 5] as const,
      },
      /** River: logs this many pieces long, turtles in groups this big; diving: up, half, under. */
      logPieces: [3, 5] as const,
      turtles: [2, 3] as const,
      dive: { upSec: 3, halfSec: 0.6, underSec: 1.2 },
      /** Road: logging trucks from this tier. Mixed needs this tier (below it, Road plays). */
      loggerFrom: 3,
      mixedFrom: 3,
      /** A hiker who runs out of lives loses this much energy. After a hit, the next hiker goes this long later (my guess). */
      failEnergy: 1,
      hitPauseSec: 0.6,
    },

    /**
     * Train!: hop between tracks as trains come through; one party sprite,
     * switching hikers, with lives as in Dodge. By tier: tracks, the clock to
     * survive, the warning, train speeds (from–to), a new train every this
     * long, fog, and lives per hiker.
     */
    train: {
      tiers: {
        1: {
          tracks: 3,
          surviveSec: 20,
          warnSec: 1.0,
          speed: [140, 170],
          everySec: 1.6,
          fog: false,
          lives: 2,
        },
        2: {
          tracks: 4,
          surviveSec: 20,
          warnSec: 0.9,
          speed: [150, 190],
          everySec: 1.3,
          fog: false,
          lives: 2,
        },
        3: {
          tracks: 5,
          surviveSec: 25,
          warnSec: 0.8,
          speed: [160, 210],
          everySec: 1.1,
          fog: false,
          lives: 2,
        },
        4: {
          tracks: 5,
          surviveSec: 25,
          warnSec: 0.7,
          speed: [170, 220],
          everySec: 1.0,
          fog: true,
          lives: 2,
        },
        5: {
          tracks: 5,
          surviveSec: 30,
          warnSec: 0.6,
          speed: [180, 240],
          everySec: 0.9,
          fog: true,
          lives: 2,
        },
      } as Readonly<
        Record<
          MgTier,
          {
            tracks: number;
            surviveSec: number;
            warnSec: number;
            speed: readonly [number, number];
            everySec: number;
            fog: boolean;
            lives: number;
          }
        >
      >,
      /** Trains come from either side from this tier (only from the right before). */
      bothSidesFrom: 3,
      /** Tracks this far apart; a hop takes this long; the active hiker switches this often. */
      trackGap: 36,
      hopSec: 0.12,
      switchSec: 5,
      /** After a hit, no more hits for this long. At least one track stays clear for the next this long. */
      safeSec: 1,
      clearSec: 1.5,
      /** An engine (this long) and this many cars (each this long). */
      cars: [1, 4] as const,
      engineLength: 64,
      carLength: 56,
      /** Fog covers the far share of the screen on each side trains come from. */
      fogShare: 0.4,
      failEnergy: 1,
    },

    /**
     * Rafting: the whole party in one raft, heading upriver to the dock. By
     * tier: lanes, the distance (units), the starting pace (units a second),
     * rocks per 100 units, and rapids per run.
     */
    rafting: {
      tiers: {
        1: { lanes: 3, distance: 1200, pace: 60, rocksPer100: 1.0, rapids: 1 },
        2: { lanes: 4, distance: 1400, pace: 66, rocksPer100: 1.3, rapids: 2 },
        3: { lanes: 4, distance: 1600, pace: 72, rocksPer100: 1.6, rapids: 3 },
        4: { lanes: 5, distance: 1800, pace: 78, rocksPer100: 1.9, rapids: 3 },
        5: { lanes: 5, distance: 2000, pace: 84, rocksPer100: 2.2, rapids: 4 },
      } as Readonly<
        Record<
          MgTier,
          { lanes: number; distance: number; pace: number; rocksPer100: number; rapids: number }
        >
      >,
      /** A lane change slides this long. Rapids raise the pace by this share for the rest of the run. */
      slideSec: 0.15,
      rapidsBoost: 0.12,
      /** After a rock hit, no more hits for this long. */
      safeSec: 1,
      /** Large rocks can cover two lanes from this tier, this often (my guess). */
      twoLaneFrom: 5,
      twoLaneChance: 0.3,
      /** The river between the banks (scene x), and where the raft sits (its middle, scene y). */
      river: [61, 259] as const,
      raftY: 179,
      /** The first rocks start this far ahead, and the course stops this far before the dock (my guesses). */
      startClear: 140,
      endClear: 80,
    },

    /*
     * The quick games (Phase 10.8 step 8, docs/design/18-minigames-quick.md):
     * Trail Blazes, Firefly Catch, Size Up, Safari, Fly Swatter and Raccoon
     * Shuffle. None is a passing challenge: each hiker passes or fails on
     * their own. TODO(wyatt): every number is a first guess, by game and tier.
     */
    quick: {
      /** A hiker who fails loses this much energy (Raccoon Shuffle: the raccoon steals instead). */
      failEnergy: 1,
      /** Between one hiker's turn and the next ("MOM, YOUR TURN"; my guess). */
      handoffSec: 1,
      /** After the last turn, the last frame stays up this long before the end screen (my guess). */
      endPauseSec: 1,
    },

    /**
     * Trail Blazes: two trunks scroll past each other (left up, right down);
     * tap when the lit blazes are level. By tier: pairs per hiker, "level"
     * (the centers within this many units), each trunk's speed (units a
     * second), how much each pair changes the speeds (±share; 0: never), a
     * wobble while they approach (±share), tries, and the Clock mode's clock.
     */
    trailBlazes: {
      tiers: {
        1: { pairs: 4, level: 8, speed: 30, change: 0, wobble: 0, tries: 3, clockSec: 25 },
        2: { pairs: 5, level: 7, speed: 34, change: 0, wobble: 0, tries: 3, clockSec: 25 },
        3: { pairs: 6, level: 6, speed: 38, change: 0.25, wobble: 0, tries: 3, clockSec: 25 },
        4: { pairs: 6, level: 5, speed: 42, change: 0.3, wobble: 0, tries: 3, clockSec: 22 },
        5: { pairs: 7, level: 4, speed: 46, change: 0.3, wobble: 0.15, tries: 3, clockSec: 20 },
      } as Readonly<
        Record<
          MgTier,
          {
            pairs: number;
            level: number;
            speed: number;
            change: number;
            wobble: number;
            tries: number;
            clockSec: number;
          }
        >
      >,
      /** The trunks' left edges (scene x) and width, and the blazes' spacing on them. */
      trunkX: [96, 180] as const,
      trunkW: 44,
      blazeGap: 30,
      /** A new lit pair starts this far apart (units), heading toward each other. */
      startApart: [80, 140] as const,
      /** Where a lit pair can start (scene y of the blazes' centers; my guess: on screen, clear of the HUD). */
      litY: [34, 186] as const,
      /** A match's line shows this long. In Clock mode, a miss costs this much. */
      matchLineSec: 0.4,
      missCostSec: 2,
      /** The Tier V wobble's period (my guess). */
      wobbleSec: 1.1,
    },

    /**
     * Firefly Catch: tap when the bouncing firefly is inside the jar ring.
     * By tier: catches needed, seconds per hiker, the ring (across, units),
     * the firefly's speed and the ring's drift (units a second), what a miss
     * costs (seconds), and how long the firefly goes dark (0: never).
     */
    fireflyCatch: {
      tiers: {
        1: { catches: 3, timeSec: 15, ring: 30, speed: 60, drift: 12, missSec: 0, darkSec: 0 },
        2: { catches: 3, timeSec: 15, ring: 26, speed: 75, drift: 20, missSec: 1, darkSec: 0 },
        3: { catches: 3, timeSec: 15, ring: 22, speed: 90, drift: 30, missSec: 1, darkSec: 0.4 },
        4: { catches: 3, timeSec: 15, ring: 19, speed: 100, drift: 40, missSec: 1, darkSec: 0.5 },
        5: { catches: 3, timeSec: 15, ring: 16, speed: 110, drift: 45, missSec: 1, darkSec: 0.6 },
      } as Readonly<
        Record<
          MgTier,
          {
            catches: number;
            timeSec: number;
            ring: number;
            speed: number;
            drift: number;
            missSec: number;
            darkSec: number;
          }
        >
      >,
      /** The play area (scene units). */
      box: { left: 38, right: 282, top: 30, bottom: 192 },
      /** Every so often (seconds, from–to), the firefly's heading wobbles by up to this much (degrees). */
      wobbleEverySec: [0.5, 1] as const,
      wobbleDeg: 20,
      /** It goes dark every so often (seconds, from–to). A new one starts at least this far from the ring. */
      darkEverySec: [1.5, 2.5] as const,
      newAway: 60,
      /** A caught firefly flies down to the jar over this long (my guess). */
      toJarSec: 0.45,
    },

    /**
     * Size Up: grow or shrink a find to match the field guide's sketch. By
     * tier: each step (a share of the sketch's size), passing (within this
     * many percent), seconds per hiker, how it's turned, and how many finds
     * (the first four, or all six).
     */
    sizeUp: {
      tiers: {
        1: { step: 0.04, pass: 8, timeSec: 12, turn: 'upright', finds: 4 },
        2: { step: 0.03, pass: 6, timeSec: 10, turn: 'any', finds: 4 },
        3: { step: 0.02, pass: 5, timeSec: 9, turn: 'mirror', finds: 6 },
        4: { step: 0.015, pass: 4, timeSec: 8, turn: 'mirror', finds: 6 },
        5: { step: 0.01, pass: 3, timeSec: 7, turn: 'mirror', finds: 6 },
      } as Readonly<
        Record<
          MgTier,
          {
            step: number;
            pass: number;
            timeSec: number;
            turn: 'upright' | 'any' | 'mirror';
            finds: number;
          }
        >
      >,
      /** The sketch is drawn at this many times its art's size (from–to), new each turn. */
      sketchScale: [2.5, 3.5] as const,
      /** The find starts this far off the sketch's size (a share, from–to), bigger or smaller. */
      startOff: [0.2, 0.4] as const,
      /** "Sometimes mirrored" (my guess), and how far the size can go (a share of the sketch's; my guess). */
      mirrorChance: 0.5,
      ratio: [0.4, 1.8] as const,
      /** Holding repeats every `repeatSec` after `holdSec`. The reveal lasts this long. */
      holdSec: 0.35,
      repeatSec: 0.1,
      revealSec: 1.5,
    },

    /**
     * Safari: watch animals come down a hillside, then answer a question
     * together (two with 3 or more hikers). By tier: the watch (seconds),
     * animals that come (± `animalsSpread`), kinds in a run, the most on
     * screen at once, the time to walk down (seconds, from–to, for the
     * middle kinds), answer signs, the chances of night, fog and Bigfoot,
     * the gap between number signs, and what they do (chances per animal;
     * my guesses for "+ stop, herds" and "all, more often").
     */
    safari: {
      tiers: {
        1: {
          watchSec: 15,
          animals: 8,
          kinds: 3,
          maxOnScreen: 3,
          walkSec: [5, 8],
          signs: 3,
          night: 0,
          fog: 0,
          bigfoot: 0,
          numberGap: 2,
          does: { stop: 0, herd: 0, birds: false, turnBack: 0, hide: 0 },
        },
        2: {
          watchSec: 18,
          animals: 10,
          kinds: 4,
          maxOnScreen: 4,
          walkSec: [4.5, 7],
          signs: 4,
          night: 0,
          fog: 0,
          bigfoot: 0,
          numberGap: 1,
          does: { stop: 0.2, herd: 0.2, birds: true, turnBack: 0, hide: 0 },
        },
        3: {
          watchSec: 20,
          animals: 12,
          kinds: 5,
          maxOnScreen: 5,
          walkSec: [4, 6.5],
          signs: 4,
          night: 0.25,
          fog: 0,
          bigfoot: 0.05,
          numberGap: 1,
          does: { stop: 0.2, herd: 0.2, birds: true, turnBack: 0.15, hide: 0.15 },
        },
        4: {
          watchSec: 22,
          animals: 14,
          kinds: 6,
          maxOnScreen: 6,
          walkSec: [3.5, 6],
          signs: 5,
          night: 0.25,
          fog: 0.25,
          bigfoot: 0.08,
          numberGap: 1,
          does: { stop: 0.3, herd: 0.3, birds: true, turnBack: 0.2, hide: 0.2 },
        },
        5: {
          watchSec: 25,
          animals: 16,
          kinds: 7,
          maxOnScreen: 6,
          walkSec: [3, 5.5],
          signs: 5,
          night: 0.25,
          fog: 0.25,
          bigfoot: 0.1,
          numberGap: 1,
          does: { stop: 0.3, herd: 0.3, birds: true, turnBack: 0.2, hide: 0.2 },
        },
      } as Readonly<
        Record<
          MgTier,
          {
            watchSec: number;
            animals: number;
            kinds: number;
            maxOnScreen: number;
            walkSec: readonly [number, number];
            signs: number;
            night: number;
            fog: number;
            bigfoot: number;
            numberGap: number;
            does: {
              stop: number;
              herd: number;
              birds: boolean;
              turnBack: number;
              hide: number;
            };
          }
        >
      >,
      animalsSpread: 2,
      /** The fastest kind is at least this much faster than the next; the slowest at most this share of the next. */
      fastestGap: 1.4,
      slowestGap: 0.7,
      /** Herds of this many (from–to); a stop lasts this long (seconds, from–to). */
      herd: [2, 3] as const,
      stopSec: [0.6, 1.5] as const,
      /** Bushes on the hillside, and the last animal comes in at least this long before the watch ends (my guess). */
      bushes: 3,
      lastEntrySec: 2,
      /** Walking frames swap this often. The hillside, top to bottom (scene y). */
      frameSec: 0.25,
      top: 22,
      bottom: 202,
      /** Night: the beam's width (degrees), how dark the rest is, and how fast keys swing it (degrees a second). */
      beamDeg: 30,
      dark: 0.93,
      keyDegPerSec: 120,
      /** Fog hides this share of what's behind it. Bigfoot crosses in this long. */
      fogHide: 0.7,
      bigfootSec: 2,
      /**
       * Birds fly across in this long (seconds, from–to), zigzagging this far
       * up and down every so often; they're left out of "fastest" and
       * "slowest" (my guesses).
       */
      birdSec: [2.5, 3.5] as const,
      zigzag: 8,
      zigzagSec: 0.5,
      /** Between one group coming in and the next, at least this long (seconds, from–to; my guess). */
      gapSec: [0.5, 1.2] as const,
      /** Fog: this many patches, drifting this fast (units a second, from–to; my guesses). */
      fogPatches: 3,
      fogDrift: [6, 12] as const,
    },

    /**
     * Fly Swatter: tap each circle before it shrinks away and the fly lands.
     * By tier: flies per hiker, the circle (across, units), the shrink time,
     * a new circle every so often (seconds), the most up at once, the share
     * of bee circles, strikes allowed, and whether a tap on nothing is a strike.
     */
    flySwatter: {
      tiers: {
        1: {
          flies: 8,
          circle: 44,
          shrinkSec: 1.6,
          everySec: 1.0,
          maxUp: 1,
          bees: 0,
          strikes: 3,
          stray: false,
        },
        2: {
          flies: 10,
          circle: 40,
          shrinkSec: 1.4,
          everySec: 0.8,
          maxUp: 2,
          bees: 0,
          strikes: 3,
          stray: false,
        },
        3: {
          flies: 12,
          circle: 36,
          shrinkSec: 1.2,
          everySec: 0.7,
          maxUp: 3,
          bees: 0.15,
          strikes: 3,
          stray: true,
        },
        4: {
          flies: 14,
          circle: 32,
          shrinkSec: 1.0,
          everySec: 0.6,
          maxUp: 3,
          bees: 0.2,
          strikes: 3,
          stray: true,
        },
        5: {
          flies: 16,
          circle: 28,
          shrinkSec: 0.9,
          everySec: 0.5,
          maxUp: 4,
          bees: 0.25,
          strikes: 3,
          stray: true,
        },
      } as Readonly<
        Record<
          MgTier,
          {
            flies: number;
            circle: number;
            shrinkSec: number;
            everySec: number;
            maxUp: number;
            bees: number;
            strikes: number;
            stray: boolean;
          }
        >
      >,
      /** Where circles appear (their middles, scene units). */
      area: { left: 40, right: 280, top: 40, bottom: 180 },
      /** Wing frames swap this often; the swatter swats this long; a splat stays this long; a sting shakes this long. */
      frameSec: 0.08,
      swatSec: 0.15,
      splatSec: 0.6,
      shakeSec: 0.3,
      /** The testing tab's Bees "On" below Tier III uses Tier III's share. */
      beesOn: 0.15,
    },

    /*
     * Signs and trails (Phase 10.8 step 8, docs/design/19-minigames-signs-trails.md):
     * Fake Trail Signs, Trails, Crossroads and Rock Climb. Trails and Rock
     * Climb are passing challenges. TODO(wyatt): every number is a first guess.
     */

    /**
     * Fake Trail Signs: learn the rules, judge each sign REAL or FAKE; each
     * round adds a rule. By tier: signs per round, the fewest rules the game
     * must reach, the most rules, whether old rules are hidden, and whether
     * a sign's ends can differ.
     */
    fakeSigns: {
      tiers: {
        1: { signs: 2, min: 2, cap: 3, hideOld: false, mixedEnds: false },
        2: { signs: 3, min: 2, cap: 4, hideOld: false, mixedEnds: false },
        3: { signs: 3, min: 3, cap: 4, hideOld: false, mixedEnds: true },
        4: { signs: 4, min: 3, cap: 5, hideOld: true, mixedEnds: true },
        5: { signs: 4, min: 4, cap: 6, hideOld: true, mixedEnds: true },
      } as Readonly<
        Record<
          MgTier,
          { signs: number; min: number; cap: number; hideOld: boolean; mixedEnds: boolean }
        >
      >,
      /** The rules' numbers: names longer than (from–to), names this short or shorter, the number over, must be under or over, the two numbers add up to more or less than. */
      nameLonger: [4, 6] as const,
      nameShorter: [4, 5] as const,
      numberOver: [40, 60] as const,
      numberMust: [30, 70] as const,
      sumMust: [6, 11] as const,
      /** This share of each round's signs are fake (from–to). */
      fakeShare: [0.4, 0.6] as const,
      /** Rules are checked against this many random signs, and need at least this many real and fake ones (my guesses). */
      poolSize: 1500,
      minOfEach: 3,
      /** A wrong answer's box shows this long; a right answer's tick this long (my guess). */
      wrongSec: 2.5,
      rightSec: 0.4,
      /** The sign's board: as wide as the text plus this. */
      boardPad: 6,
    },

    /**
     * Trails (a passing challenge): keep your hiker on a trail scrolling
     * down; one section per hiker, each ending at a checkpoint. By tier:
     * the scroll speed (units a second), the trail's width, a section's
     * length, each hiker's off-trail bar (seconds), Switchbacks' corner
     * spacing (Ridgeline's numbers are in `ridge`, revised Nov 26).
     */
    trails: {
      tiers: {
        1: { scroll: 40, width: 56, section: 500, barSec: 3, corner: 150 },
        2: { scroll: 46, width: 48, section: 600, barSec: 2.5, corner: 130 },
        3: { scroll: 52, width: 40, section: 700, barSec: 2, corner: 120 },
        4: { scroll: 58, width: 34, section: 800, barSec: 1.75, corner: 110 },
        5: { scroll: 64, width: 30, section: 900, barSec: 1.5, corner: 100 },
      } as Readonly<
        Record<
          MgTier,
          {
            scroll: number;
            width: number;
            section: number;
            barSec: number;
            corner: number;
          }
        >
      >,
      /** The hiker: where (scene y), how far left and right, top speed (units a second) reached in this long. */
      hikerY: 178,
      xRange: [24, 296] as const,
      topSpeed: 130,
      accelSec: 0.1,
      /** The trail never moves sideways faster than this share of the hiker's top speed. */
      fairShare: 0.75,
      /** By type: Forest Path is this much wider, Ridgeline this much narrower (Nov 26: was 0.75). */
      forestWide: 1.15,
      ridgeNarrow: 0.6,
      /**
       * Ridgeline, revised Nov 26 (a knife-edge ridge with wind): off the
       * ridge is a sheer drop that drains the bar this many times as fast;
       * a crumbly lip every so often along both edges; knife edges every
       * so often (units, from–to), this long, pinched to this share; jogs
       * this far to the side, with the slope cap at this share of top speed;
       * scree patches this long, where steering is this strong and momentum
       * dies this many times slower; a gust warns this long, then pushes for
       * this long (from–to). By tier: a gust every (seconds, from–to), its
       * push (units a second), and scree patches per section (from–to).
       */
      ridge: {
        drain: 2,
        lipEvery: 8,
        knifeEvery: [250, 400] as const,
        knifeLength: [60, 100] as const,
        knifeShare: 0.6,
        jog: [40, 70] as const,
        fairShare: 0.9,
        screeLength: [40, 70] as const,
        screeSteer: 0.5,
        screeSlide: 3,
        gustWarnSec: 0.8,
        gustSec: [1.0, 1.5] as const,
        tiers: {
          1: { gustEvery: [6, 8], push: 35, scree: [0, 0] },
          2: { gustEvery: [5, 7], push: 45, scree: [1, 1] },
          3: { gustEvery: [4, 6], push: 55, scree: [1, 2] },
          4: { gustEvery: [3, 5], push: 60, scree: [2, 2] },
          5: { gustEvery: [2.5, 4], push: 65, scree: [2, 3] },
        } as Readonly<
          Record<
            MgTier,
            { gustEvery: readonly [number, number]; push: number; scree: readonly [number, number] }
          >
        >,
      },
      /**
       * The course (my guesses): a straight start this long; Forest Path and
       * Riverbank bend this far either side; Ridgeline jogs every so often
       * (units, from–to); the river runs this far from the trail's edge, this wide.
       */
      leadIn: 60,
      bend: 70,
      jogEvery: [90, 170] as const,
      river: { gap: 3, width: 40 },
      /** "<NAME> MADE IT" shows this long (the scroll pauses); after a fail, the next hiker starts this long after. */
      madeSec: 0.8,
      handoverSec: 1,
    },

    /**
     * Crossroads (Wyatt's "Trailmap"): remember a row of arrows, then walk
     * them through 4-way crossings. By tier: the arrows. Each step walks out
     * and in this long; MADE IT shows this long; a press back the way you
     * came bumps this long (my guesses for the last two).
     */
    crossroads: {
      arrows: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 } as Readonly<Record<MgTier, number>>,
      walkOutSec: 0.35,
      walkInSec: 0.35,
      madeSec: 1.2,
      bumpSec: 0.2,
    },

    /**
     * Rock Climb (a passing challenge): aim, hold for power, jump, and grab
     * a hold of the active hand's color. By tier: holds to the top, the
     * time, the arrow's swing (side to side) and the power meter (empty to
     * full) in seconds, the grab reach (units), one grab try per jump or
     * any number, and decoy holds per screen.
     */
    rockClimb: {
      /**
       * By tier: holds to the top, the arrow's swing and the power meter
       * (seconds; faster at high tiers, 22-minigame-revisions.md section 2.3,
       * TODO(wyatt): [1.6, 1.3, 1.0, 0.75, 0.6] and [1.2, 1.0, 0.8, 0.6, 0.48]),
       * grab reach, one grab try or any, and decoys a screen. No timer by
       * default (section 2.1): the tries are the limit now.
       */
      tiers: {
        1: {
          holds: 8,
          swingSec: 1.6,
          powerSec: 1.2,
          reach: 16,
          oneTry: false,
          decoys: 3,
        },
        2: {
          holds: 10,
          swingSec: 1.3,
          powerSec: 1.0,
          reach: 14,
          oneTry: false,
          decoys: 4,
        },
        3: {
          holds: 12,
          swingSec: 1.0,
          powerSec: 0.8,
          reach: 12,
          oneTry: true,
          decoys: 5,
        },
        4: {
          holds: 14,
          swingSec: 0.75,
          powerSec: 0.6,
          reach: 11,
          oneTry: true,
          decoys: 6,
        },
        5: {
          holds: 16,
          swingSec: 0.6,
          powerSec: 0.48,
          reach: 10,
          oneTry: true,
          decoys: 7,
        },
      } as Readonly<
        Record<
          MgTier,
          {
            holds: number;
            swingSec: number;
            powerSec: number;
            reach: number;
            oneTry: boolean;
            decoys: number;
          }
        >
      >,
      /**
       * Tries (22-minigame-revisions.md, section 2.1): each hiker has this
       * many; a fall costs one and this much energy (paid at the end).
       * "<NAME> IS OUT" shows this long, and their holds blink this long as
       * they change color. TODO(wyatt): [3], [1], [1.2 s] and [0.6 s].
       */
      tries: 3,
      fallEnergy: 1,
      outSec: 1.2,
      blinkSec: 0.6,
      /** The Time setting's first value when it's turned on (testing only; Auto is no timer). */
      testTimeSec: 60,
      /** The top line sits this far above the last path hold (section 2.2). TODO(wyatt): [40–70]. */
      topAbove: [40, 70] as const,
      /**
       * A fall (section 2.4): the climber drops with this gravity (units/s²),
       * turning this far, until it's this far down (off the bottom of the
       * screen); then the box shows this long; then the camera slides back
       * to the last hold this long. TODO(wyatt): [600], [20°], [1.2 s], [0.6 s].
       */
      fall: { gravity: 600, turnDeg: 20, drop: 240, boxSec: 1.2, backSec: 0.6 },
      /** Over the top: the climber goes on up and lands on the ledge, and OVER THE TOP! shows this long (my guess). */
      topSec: 1.2,
      /**
       * How it looks (section 2.4). The camera slides up this long after a
       * grab, so the climber sits this far down the screen. The arms are this
       * thick with this outline, from shoulders this far from the body's
       * middle and this far down from its top. The free hand sits this far
       * from its shoulder, catching up with the arrow this fast, its elbow
       * wiggling this much this often, pulling in up to this much at full
       * power. The ring around it: this radius and thickness.
       * TODO(wyatt): every number is from the design's [brackets].
       */
      look: {
        cameraSec: 0.5,
        cameraAt: 0.65,
        arm: 3,
        armOutline: 1,
        shoulder: [5, 8] as const,
        handReach: 24,
        catchSec: 0.08,
        wiggle: 1.5,
        wigglePerSec: 3,
        pullIn: 4,
        ring: [11, 1.4] as const,
      },
      /** A jump goes this far (from empty to full power), and each planned hold is this far from the last. */
      power: [30, 110] as const,
      step: [40, 90] as const,
      /** The color sequence: this long with an even number of hikers, this long with an odd number. */
      seqEven: 8,
      seqOdd: 9,
      /**
       * My guesses: a jump takes this long; a fall slides back this long;
       * holds stay this far inside the wall's edges; a screen of wall is this
       * tall; decoys stay this far from the path; planned holds turn at
       * least this far from flat (degrees); the climber's hand sits at this
       * scene y.
       */
      /**
       * The grab fix (Nov 26): a jump takes this long (easing out), then the
       * hand hangs at the end this long and can still grab; a tap counts for
       * a hold within this many units of its middle.
       */
      jumpSec: 0.9,
      hangSec: 0.25,
      tapTolerance: 16,
      wallX: [24, 296] as const,
      screen: 170,
      decoyClear: 20,
      minTurnDeg: 25,
      handY: 140,
    },

    /**
     * Camp Cleanup (Nov 26; it replaces Ants Are Marching): the party is one
     * snake on a grid, picking up trash in their colors. By tier: the time,
     * the bags each hiker needs, the speed (cells a second), the bags lost in
     * a crash (from–to), and obstacles. TODO(wyatt): every number is a first guess.
     *
     * Nov 26 evening (26-fixes-and-wyatt-trees.md, section 2): smaller grids
     * (cells across × down) and more obstacles at higher tiers, a much
     * shorter time, and the countdown: once every hiker has their quota, the
     * game ends this many seconds later with everyone passing, unless
     * someone crashes below it first. TODO(wyatt): grids [25 × 14, 23 × 13,
     * 21 × 12, 19 × 11, 17 × 10], obstacles [0, 2, 5, 8, 11], time [30, 30,
     * 35, 40, 45 s], countdown [5, 5, 6, 7, 8 s].
     */
    campCleanup: {
      tiers: {
        1: {
          cols: 25,
          rows: 14,
          timeSec: 30,
          quota: 3,
          speed: 5,
          crash: [2, 3],
          obstacles: 0,
          countdownSec: 5,
        },
        2: {
          cols: 23,
          rows: 13,
          timeSec: 30,
          quota: 4,
          speed: 6,
          crash: [2, 4],
          obstacles: 2,
          countdownSec: 5,
        },
        3: {
          cols: 21,
          rows: 12,
          timeSec: 35,
          quota: 4,
          speed: 7,
          crash: [3, 5],
          obstacles: 5,
          countdownSec: 6,
        },
        4: {
          cols: 19,
          rows: 11,
          timeSec: 40,
          quota: 5,
          speed: 8,
          crash: [3, 6],
          obstacles: 8,
          countdownSec: 7,
        },
        5: {
          cols: 17,
          rows: 10,
          timeSec: 45,
          quota: 5,
          speed: 9,
          crash: [4, 7],
          obstacles: 11,
          countdownSec: 8,
        },
      } as Readonly<
        Record<
          MgTier,
          {
            cols: number;
            rows: number;
            timeSec: number;
            quota: number;
            speed: number;
            crash: readonly [number, number];
            obstacles: number;
            countdownSec: number;
          }
        >
      >,
      /**
       * The space the grid sits in (the biggest grid, cells across and down;
       * smaller grids are centered in it), a cell's size (units), and the
       * space's top-left corner on the screen.
       */
      cols: 25,
      rows: 14,
      cell: 12,
      at: { x: 10, y: 28 },
      /** Up to this many turns queue up. New trash lands at least this many cells from the head. */
      queue: 2,
      trashAway: 3,
      /** A crash: the snake stops this long, then waits this long for a direction. */
      crashSec: 0.6,
      waitSec: 1.5,
      /** Obstacles stay this many cells from the start. With 5 or 6 hikers the quota drops by this much. */
      startClear: 3,
      bigParty: 5,
      bigPartyLess: 1,
    },

    /**
     * Raccoon Shuffle (the challenge version): watch which bins hold
     * raccoons, follow the shuffle, pick an empty bin. By tier: bins, empty
     * bins, swaps, the time per swap, the chance two pairs swap at once, and
     * the chance of night.
     */
    raccoonShuffle: {
      /**
       * Revised Nov 26 (it was far too easy). By tier: bins, empty bins,
       * swaps, the first and last swap's time (each shuffle speeds up evenly
       * between them), the share of far swaps (not neighbors), the chance a
       * step is a fake-out, the chance of two swaps at once, the show's
       * length, and the chance of night.
       *
       * Nov 26, second round (22-minigame-revisions.md, section 1): Tiers III
       * and IV have [2] empty bins and Tier V [3], and at the end a raccoon
       * takes [1] (Tier V: [2]) of them away. TODO(wyatt).
       */
      tiers: {
        1: {
          bins: 4,
          empty: 1,
          takeAway: 0,
          swaps: 7,
          swapSec: [0.5, 0.35],
          far: 0.3,
          fake: 0,
          double: 0,
          showSec: 2.2,
          night: 0,
        },
        2: {
          bins: 5,
          empty: 1,
          takeAway: 0,
          swaps: 9,
          swapSec: [0.45, 0.3],
          far: 0.45,
          fake: 0.15,
          double: 0.2,
          showSec: 2.0,
          night: 0,
        },
        3: {
          bins: 6,
          empty: 2,
          takeAway: 1,
          swaps: 11,
          swapSec: [0.4, 0.26],
          far: 0.6,
          fake: 0.2,
          double: 0.35,
          showSec: 1.8,
          night: 0.2,
        },
        4: {
          bins: 7,
          empty: 2,
          takeAway: 1,
          swaps: 13,
          swapSec: [0.36, 0.22],
          far: 0.7,
          fake: 0.25,
          double: 0.5,
          showSec: 1.6,
          night: 0.3,
        },
        5: {
          bins: 8,
          empty: 3,
          takeAway: 2,
          swaps: 15,
          swapSec: [0.32, 0.2],
          far: 0.8,
          fake: 0.3,
          double: 0.6,
          showSec: 1.5,
          night: 0.35,
        },
      } as Readonly<
        Record<
          MgTier,
          {
            bins: number;
            empty: number;
            takeAway: number;
            swaps: number;
            swapSec: readonly [number, number];
            far: number;
            fake: number;
            double: number;
            showSec: number;
            night: number;
          }
        >
      >,
      /**
       * The take-away (Nov 26, second round): a pause after the last swap,
       * then each bin is hauled up into the woods over this long, this long
       * apart. TODO(wyatt): [0.4 s], [0.9 s] and [0.5 s].
       */
      takeAway: { pauseSec: 0.4, haulSec: 0.9, apartSec: 0.5 },
      /** The card (30 × 26 now) and where its 12 × 12 icon goes (right of the red minus). */
      card: { w: 30, h: 26, icon: [13, 2] as const },
      /** Far swaps arc this much higher, to pass over the bins between. A fake-out crosses this share of the way before going back (my guess). */
      farArc: 10,
      fakeReach: 0.35,
      /**
       * The bins stand on this line (scene y). Their middles are this far
       * apart at most, and the row spans at most this much (so 7 and 8 bins
       * stand closer; my guesses).
       */
      binY: 150,
      binGap: 60,
      binSpan: 260,
      /** A swapped bin lifts this high as it arcs over (my guess). */
      arc: 26,
      /** The picked bin open on its own, then every bin open (seconds). */
      pickedSec: 0.8,
      afterSec: 1,
      /** A raccoon with an energy card takes this much energy. */
      raccoonEnergy: 1,
      /** Night: the light around the pointer (across, units), its soft edge, and how dark the rest is. */
      light: 40,
      lightEdge: 6,
      dark: 0.93,
      /** The testing tab's made-up packs: this many resources each (from–to). */
      testPack: [2, 6] as const,
    },

    /*
     * The third batch of minigames (Phase 10.8 step 4, docs/design/13-minigames-puzzles-2.md).
     * TODO(wyatt): every number is a first guess, by game and tier. Tiers are I to V.
     */

    /** Trail Map: turn trail tiles to connect each hiker's trailhead to the exit. */
    trailMap: {
      /** By tier: the grid, the time, the trail signs to connect (Nov 25) and the locked tiles. */
      tiers: {
        1: { size: 4, timeSec: 45, signs: 0, locked: 0 },
        2: { size: 5, timeSec: 55, signs: 1, locked: 2 },
        3: { size: 6, timeSec: 70, signs: 2, locked: 3 },
        4: { size: 6, timeSec: 60, signs: 2, locked: 3 },
        5: { size: 6, timeSec: 55, signs: 3, locked: 4 },
      } as Readonly<
        Record<MgTier, { size: number; timeSec: number; signs: number; locked: number }>
      >,
      /** More time for each hiker after the first. */
      extraSecPerHiker: 15,
      /** The tiles that aren't on a solution trail: how often each piece (they add up to 1). */
      fill: { straight: 0.3, corner: 0.35, tee: 0.2, end: 0.1, cross: 0.05 },
      /** A tile turns this fast; a hiker's token walks the trail this fast (a tile). */
      turnSec: 0.12,
      walkSecPerTile: 0.15,
    },

    /** Memory Puzzle: match snack cards, each set in its hiker's color. */
    memory: {
      /**
       * By tier (Nov 25): no miss limit, only the clock. A match adds time;
       * from Tier II a miss takes some away (once per try).
       */
      tiers: {
        1: {
          cols: 4,
          rows: 4,
          setSize: 2,
          previewSec: 1,
          swaps: 0,
          swapsPerMiss: 0,
          timeSec: 40,
          matchSec: 5,
          missSec: 0,
        },
        2: {
          cols: 5,
          rows: 4,
          setSize: 2,
          previewSec: 1,
          swaps: 2,
          swapsPerMiss: 0,
          timeSec: 45,
          matchSec: 4,
          missSec: 1,
        },
        3: {
          cols: 6,
          rows: 4,
          setSize: 3,
          previewSec: 1,
          swaps: 4,
          swapsPerMiss: 1,
          timeSec: 55,
          matchSec: 4,
          missSec: 2,
        },
        4: {
          cols: 6,
          rows: 4,
          setSize: 3,
          previewSec: 0.8,
          swaps: 6,
          swapsPerMiss: 1,
          timeSec: 50,
          matchSec: 3,
          missSec: 3,
        },
        5: {
          cols: 6,
          rows: 4,
          setSize: 3,
          previewSec: 0.6,
          swaps: 8,
          swapsPerMiss: 1,
          timeSec: 45,
          matchSec: 3,
          missSec: 4,
        },
      } as Readonly<
        Record<
          MgTier,
          {
            cols: number;
            rows: number;
            setSize: 2 | 3;
            previewSec: number;
            swaps: number;
            swapsPerMiss: number;
            timeSec: number;
            matchSec: number;
            missSec: number;
          }
        >
      >,
      /** The "+5 S" or "−2 S" by the clock shows this long. */
      clockNoteSec: 1,
      /** Each swap slides this long. A miss stays up this long before it flips back. */
      swapSec: 0.4,
      missShowSec: 0.8,
      /** The testing tab's Swaps "On" on Tier I uses Tier II's count. */
      swapsOnTier1: 2,
    },

    /**
     * Cracked Pots (24-challenges-reset.md, section 7): Picture Puzzle with
     * shards of pot. By tier: shards per pot, seconds per shard, and what a
     * shard snapping in adds to the clock (as in Picture Puzzle).
     * - A shard snaps in when dropped this close to its spot (units).
     * - The two pots' top-left corners on the screen (one hiker: the first),
     *   and the blanket the shards lie on.
     * - Shards are cut from random points at least this share of the even
     *   spacing apart. Up to this tier, faint crack lines show where the
     *   shards go (Claude's idea, like Picture Puzzle's Tier I locks).
     * - Prepare: FOOD adds this many seconds; GLUE puts one shard of each
     *   pot in place before you start.
     * - Between pairs the screen holds this long. The demo bot drops a shard
     *   every so often, the wrong spot first this often, this far off.
     * TODO(wyatt): [6, 8, 10, 12, 14] shards, [6] snap, +10 s; the seconds and bonuses are my guesses.
     */
    crackedPots: {
      tiers: {
        1: { shards: 6, secPerShard: 6, snapSec: 3 },
        2: { shards: 8, secPerShard: 5, snapSec: 2 },
        3: { shards: 10, secPerShard: 4.5, snapSec: 2 },
        4: { shards: 12, secPerShard: 4, snapSec: 1.5 },
        5: { shards: 14, secPerShard: 3.5, snapSec: 1 },
      } as Readonly<Record<MgTier, { shards: number; secPerShard: number; snapSec: number }>>,
      snap: 6,
      pots: [
        { x: 22, y: 42 },
        { x: 222, y: 42 },
      ] as const,
      blanket: { left: 106, top: 34, right: 214, bottom: 190 },
      apart: 0.55,
      cracksUpTo: 1,
      extraSec: 10,
      breakSec: 1.5,
      bot: { everySec: 0.9, wrongChance: 0.25, wrongBy: 18 },
    },

    /** Picture Puzzle: rebuild pictures from stacked piles; two hikers share one tray. */
    picturePuzzle: {
      /**
       * By tier: the grid, the piles, the seconds per piece, and the time a
       * piece adds the first time it lands in its own spot (Nov 25).
       */
      tiers: {
        1: { grid: 4, piles: 6, secPerPiece: 3, rightSpotSec: 3 },
        2: { grid: 4, piles: 5, secPerPiece: 3, rightSpotSec: 2 },
        3: { grid: 5, piles: 4, secPerPiece: 2.5, rightSpotSec: 2 },
        4: { grid: 5, piles: 4, secPerPiece: 2.2, rightSpotSec: 1.5 },
        5: { grid: 6, piles: 4, secPerPiece: 2, rightSpotSec: 1 },
      } as Readonly<
        Record<
          MgTier,
          { grid: 4 | 5 | 6; piles: number; secPerPiece: number; rightSpotSec: number }
        >
      >,
      /**
       * Wyatt's photos (art/picture-puzzle/picture-<name>.png, 120 × 120,
       * tinted into the GPS greens). A game never repeats one.
       */
      pictures: [
        'lake-island',
        'mountain-lake',
        'green-valley',
        'foggy-forest',
        'canyon-trail',
        'rocky-butte',
      ] as const,
      /** The "+2 S" over a piece shows this long. */
      bonusNoteSec: 1,
      /** Tier I: a piece dropped in its right spot locks; Tier I shows a thumbnail. */
      lockCorrectUpTo: 1,
      thumbnailUpTo: 1,
    },

    /** Minefield, the Dog Waste Zone (23-minigames-final.md, section 6; it was Thin Ice until Nov 26): Minesweeper in a dog park; the piles are mines, and bags are flags. */
    minefield: {
      tiers: {
        1: { cols: 8, rows: 6, holes: 4, timerSec: null },
        2: { cols: 9, rows: 7, holes: 6, timerSec: 180 },
        3: { cols: 10, rows: 8, holes: 8, timerSec: 150 },
        4: { cols: 10, rows: 8, holes: 9, timerSec: 135 },
        5: { cols: 11, rows: 8, holes: 10, timerSec: 120 },
      } as Readonly<
        Record<MgTier, { cols: number; rows: number; holes: number; timerSec: number | null }>
      >,
      /** Wyatt's rule: this many more holes for each hiker (testing tab: 0 to 4). */
      holesPerHiker: 2,
      /** A press held this long flags instead of checking. */
      longPressSec: 0.4,
      /** Prepare (23-minigames-final.md, section 10): a SCANNER bags this many piles before the start. TODO(wyatt): [2]. */
      scannerBags: 2,
    },

    /**
     * Pack It Up (23-minigames-final.md, section 8; Claude's idea, Wyatt
     * approved). By tier: the pack (columns × rows), torn cells, spare cells
     * (none from Tier III: the gear fills it exactly), and each hiker's
     * seconds. Pieces of up to 5 cells come from this tier (4 before it). A
     * piece grows toward one of these sizes (my guess: mostly 3 and 4). The
     * gear pictures, smallest first. FOOD adds this many seconds.
     * TODO(wyatt): [5 × 4, 5 × 5, 6 × 5, 6 × 6, 7 × 6], [1, 2, 3, 4, 4], [2, 1, 0, 0, 0], [60, 60, 75, 90, 90 s], [+10 s].
     */
    packItUp: {
      tiers: {
        1: { cols: 5, rows: 4, torn: 1, spare: 2, timeSec: 60 },
        2: { cols: 5, rows: 5, torn: 2, spare: 1, timeSec: 60 },
        3: { cols: 6, rows: 5, torn: 3, spare: 0, timeSec: 75 },
        4: { cols: 6, rows: 6, torn: 4, spare: 0, timeSec: 90 },
        5: { cols: 7, rows: 6, torn: 4, spare: 0, timeSec: 90 },
      } as Readonly<
        Record<MgTier, { cols: number; rows: number; torn: number; spare: number; timeSec: number }>
      >,
      fiveFrom: 4,
      sizes: [2, 3, 3, 4, 4, 4, 5] as const,
      gear: ['map', 'lantern', 'rope', 'sleeping-bag', 'boots', 'pot', 'tent', 'stove'] as const,
      foodSec: 10,
    },

    /**
     * Birdsong (23-minigames-final.md, section 5), Simon with colored
     * notes. By tier: colors in play, the longest song, how fast the notes
     * cross (units/s) and how far apart they come (seconds). The colors, in
     * the order they're used, each with its shape (white art, tinted). Round
     * 1 has this many notes; songs are new each round from this tier (before
     * it, the same song grows). Each hiker has this many strikes. The screen
     * is this wide; notes start and end this far off it; a second play
     * (Field Notebook) comes this long after the first. A hiker's turn
     * starts after this hand-off, and the answer shows this long before the
     * next round (my guesses). The demo bot gets a note right this often.
     * TODO(wyatt): [4–8], [5–9], [70–110], [0.55–0.35 s], [2], [3], [92%].
     */
    birdsong: {
      tiers: {
        1: { colors: 4, longest: 5, speed: 70, gapSec: 0.55 },
        2: { colors: 5, longest: 6, speed: 80, gapSec: 0.5 },
        3: { colors: 6, longest: 7, speed: 90, gapSec: 0.45 },
        4: { colors: 7, longest: 8, speed: 100, gapSec: 0.4 },
        5: { colors: 8, longest: 9, speed: 110, gapSec: 0.35 },
      } as Readonly<
        Record<MgTier, { colors: number; longest: number; speed: number; gapSec: number }>
      >,
      palette: [
        { name: 'orange', shape: 'star', color: '#E07040' },
        { name: 'blue', shape: 'ring', color: '#4A8FD4' },
        { name: 'yellow', shape: 'diamond', color: '#E9B44C' },
        { name: 'purple', shape: 'cross', color: '#A86CD0' },
        { name: 'red', shape: 'heart', color: '#C8423A' },
        { name: 'teal', shape: 'circle', color: '#3FB3A8' },
        { name: 'pink', shape: 'square', color: '#E58FB0' },
        { name: 'white', shape: 'triangle', color: '#F1EADB' },
      ] as const,
      firstLength: 2,
      newFrom: 3,
      strikes: 3,
      screenW: 320,
      noteMargin: 14,
      replayPauseSec: 0.6,
      handoffSec: 1.2,
      afterSec: 1.2,
      botRight: 0.92,
    },

    /**
     * Squirrel Theft (23-minigames-final.md, section 4), a shooting
     * gallery. By tier: how long a squirrel stays up, each hiker's nuts, and
     * the HAPPY line as a share of all the party's nuts. The intro lasts
     * this long; the thief takes this many things when the challenge
     * doesn't say (the challenge sets it: [3–6]). A nut lands this long
     * after it's thrown and feeds a target within this far of the spot. A
     * squirrel's body (and a bear's) is this big around its middle, for
     * aiming. The first target comes this long in, then one every so often,
     * at most this many up at once; a fed squirrel ducks this long after
     * (all my guesses). Where targets pop up: the far bushes, the log and
     * the near bushes (rows), and the branches (runners, from Tier II, this
     * often, at this speed: my guesses), all matching bg.png. Bears (from
     * Tier III, this often: my guess) take this much off the bar; from Tier
     * IV one pops up where a squirrel just ducked this often (my guess).
     * BAIT keeps squirrels up this much longer.
     * TODO(wyatt): [1.4–0.8 s], [6, 6, 5, 5, 4], [40–60]%, [3 s], [3–6], [0.35 s], [7], [2], [0.3 s].
     */
    squirrelTheft: {
      tiers: {
        1: { upSec: 1.4, nuts: 6, line: 0.4 },
        2: { upSec: 1.2, nuts: 6, line: 0.45 },
        3: { upSec: 1.0, nuts: 5, line: 0.5 },
        4: { upSec: 0.9, nuts: 5, line: 0.55 },
        5: { upSec: 0.8, nuts: 4, line: 0.6 },
      } as Readonly<Record<MgTier, { upSec: number; nuts: number; line: number }>>,
      introSec: 3,
      stolenAuto: 4,
      flightSec: 0.35,
      reach: 7,
      half: [9, 7] as const,
      firstSec: 0.6,
      everySec: [0.5, 0.9] as const,
      maxUp: 3,
      fedSec: 0.4,
      rows: [
        { x0: 20, x1: 300, y: 104 },
        { x0: 50, x1: 270, y: 140 },
        { x0: 20, x1: 300, y: 167 },
      ] as const,
      branches: [
        { x0: 36, x1: 62, y: 53 },
        { x0: 116, x1: 144, y: 53 },
        { x0: 210, x1: 238, y: 53 },
        { x0: 292, x1: 316, y: 53 },
      ] as const,
      runner: { from: 2, chance: 0.3, speed: 22 },
      bear: {
        from: 3,
        chance: 0.2,
        cost: 2,
        half: [12, 9] as const,
        ambushFrom: 4,
        ambushChance: 0.35,
      },
      baitSec: 0.3,
      /** The demo bot misjudges this share of its throws. */
      botMiss: 0.3,
    },

    /**
     * Spooky Ghost! (24-challenges-reset.md, section 6): a haunted Find the
     * Object, always in the dark. By tier: each hiker's finds, the sanity
     * bar's seconds, the ghosts at a time, and the flashlight's radius (the
     * doc's [30] and [26] read as the radius, as mockup 54 draws it, so a
     * ghost that drains you is always in the light).
     * - The field (scene units); a new mitten lands at least this far from
     *   the light; a tap this close to a lit mitten finds it.
     * - Ghosts: while the light is this close to one, sanity drains this many
     *   times as fast. Each fades in over this long, stays this long
     *   (from–to), fades out, and comes back somewhere else: never this
     *   close to the pointer, or this close to a mitten. From this tier they
     *   drift this fast; from this tier this share of them drift toward the
     *   light (my guess). "BOO" shows this long when the light finds one.
     * - Prepare: FOOD makes sanity drain this share slower, LANTERN makes the
     *   light this much bigger, LUCKY CHARM makes ghosts drain this share as much.
     * - The demo bot's light moves this fast, and turns away from a ghost this late.
     * TODO(wyatt): [3, 4, 4, 5, 5], [45, 45, 40, 40, 35 s], [4–8], [30], [26], [80], [20],
     * [4×], [0.8 s], [3–6 s], [50], [20], [10], [15%], [+6], half; the rest are my guesses.
     */
    spookyGhost: {
      tiers: {
        1: { finds: 3, sanitySec: 45, ghosts: 4, light: 30 },
        2: { finds: 4, sanitySec: 45, ghosts: 5, light: 30 },
        3: { finds: 4, sanitySec: 40, ghosts: 6, light: 26 },
        4: { finds: 5, sanitySec: 40, ghosts: 7, light: 26 },
        5: { finds: 5, sanitySec: 35, ghosts: 8, light: 26 },
      } as Readonly<
        Record<MgTier, { finds: number; sanitySec: number; ghosts: number; light: number }>
      >,
      field: { left: 8, right: 312, top: 28, bottom: 190 },
      newAway: 80,
      tapReach: 9,
      ghostNear: 20,
      ghostDrain: 4,
      fadeSec: 0.8,
      staySec: [3, 6] as const,
      clearOfLight: 50,
      clearOfMitten: 20,
      driftFrom: 3,
      drift: 10,
      chaseFrom: 4,
      chaseShare: 0.5,
      booSec: 0.8,
      foodSlower: 0.15,
      lanternBigger: 6,
      charmDrain: 0.5,
      bot: { speed: 110, lateSec: 0.35 },
    },

    /**
     * Fly Block (23-minigames-final.md, section 3), Tempest-style. By tier:
     * panels around the pie, the flies' speed (units/s), flies a round, and
     * a fly every so often (seconds). A lane runs this far out from the ring
     * (my guess, from the screen). Each hiker can take this many bites. The
     * first fly comes this long into a round (my guess). Fast flies (from
     * Tier II) are this much faster; zig-zag flies (from Tier III) blink this
     * long before they hop; horseflies (from Tier IV) are knocked back this
     * far by the first swat; bees (from Tier III) come along this often a
     * fly, a little slower (both my guesses). The share of each kind, and
     * how often a few come at once late in a round, are my guesses. SMOKE
     * takes this many flies off a round. Holding a key moves the swatter
     * this often.
     * TODO(wyatt): [8, 10, 12, 12, 16], [30–54], [12–20], [1.1–0.7 s], [3], [1.6×], [30], [3], [0.12 s].
     */
    flyBlock: {
      tiers: {
        1: { panels: 8, speed: 30, flies: 12, everySec: 1.1 },
        2: { panels: 10, speed: 36, flies: 14, everySec: 1.0 },
        3: { panels: 12, speed: 42, flies: 16, everySec: 0.9 },
        4: { panels: 12, speed: 48, flies: 18, everySec: 0.8 },
        5: { panels: 16, speed: 54, flies: 20, everySec: 0.7 },
      } as Readonly<
        Record<MgTier, { panels: number; speed: number; flies: number; everySec: number }>
      >,
      laneLength: 110,
      bites: 3,
      firstSec: 1,
      fast: { from: 2, share: 0.25, times: 1.6 },
      zig: { from: 3, share: 0.2, blinkSec: 0.3 },
      horse: { from: 4, share: 0.15, knockBack: 30 },
      bee: { from: 3, chance: 0.2, times: 0.8 },
      together: { chance: 0.3, count: 2 },
      smoke: 3,
      repeatSec: 0.12,
    },

    /**
     * Falling Rocks (23-minigames-final.md, section 2), side view. The trail
     * is this long; hikers walk at this speed and back up at this one. The
     * overhangs (centers and half-widths on the trail) match slope.png. By
     * tier: a shadow's warning and a hazard every so often (seconds). Rocks
     * are small, medium or large, hitting within these half-widths. Showers
     * (from Tier II, this often a hazard: my guess) drop this many small
     * rocks over this spread, this far apart; boulders (from Tier III, this
     * often: my guess) rumble this long, then roll at this speed (hitting
     * within this half-width: my guess). Hazards are mostly aimed this far
     * ahead of the hiker (both my guesses). Each hiker has this many lives,
     * and this much safety after a hit. The first hazard comes this long into
     * a turn, and a landed rock bounces away for this long (my guesses). Out
     * of lives brings the challenge's stake (Rockfall: an injury chance and
     * lost resources, until challenges are hooked up). Binoculars add this
     * much warning.
     * TODO(wyatt): [300], [40], [30], [1.0–0.6 s], [1.4–0.8 s], [8, 10, 14], [3–5], [60], [0.15 s], [1.2 s], [70], [2], [1 s], [0.3 s].
     */
    fallingRocks: {
      length: 300,
      walk: 40,
      back: 30,
      overhangs: [
        { x: 87, half: 13 },
        { x: 205, half: 13 },
      ] as const,
      tiers: {
        1: { warnSec: 1.0, everySec: 1.4 },
        2: { warnSec: 0.9, everySec: 1.2 },
        3: { warnSec: 0.8, everySec: 1.0 },
        4: { warnSec: 0.7, everySec: 0.9 },
        5: { warnSec: 0.6, everySec: 0.8 },
      } as Readonly<Record<MgTier, { warnSec: number; everySec: number }>>,
      sizes: ['s', 'm', 'l'] as const,
      half: { s: 8, m: 10, l: 14 },
      shower: { from: 2, chance: 0.25, count: [3, 5] as const, spread: 60, apartSec: 0.15 },
      boulder: { from: 3, chance: 0.15, warnSec: 1.2, speed: 70, half: 12 },
      aimAhead: 0.75,
      ahead: [10, 70] as const,
      lives: 2,
      safeSec: 1,
      firstSec: 1.2,
      bounceSec: 0.6,
      stake: 'injury',
      binocularsSec: 0.3,
    },

    /**
     * Sketchy Bridge (23-minigames-final.md, section 1), Stardew-style. The
     * balance bar is this tall; the zone rises this fast (units/s²) while
     * held, falls this fast when let go, and bounces off the bottom (speed ×
     * this). By tier: the zone's height, the icon's speed (units/s), the
     * in-zone seconds a crossing takes, integrity lost a second outside the
     * zone, and whether wind gusts blow. Integrity starts at this; a plank
     * falls every this many points. The icon picks a new height every this
     * long (staying this far from the ends). From this tier it darts this
     * far (this often a pick: my guess). Gusts flap this long, then push the
     * icon this long at this speed, every so often (speed and how often: my
     * guesses). The hiker who breaks the bridge gets this (the challenge's
     * stake, until challenges are hooked up).
     *
     * Nov 26 evening (26-fixes-and-wyatt-trees.md, section 4: "too jumpy"):
     * a bigger zone at low tiers, a gentler zone (it rises at [360], falls at
     * [260] and never goes faster than [140] units a second: that cap is
     * Claude's idea), and an icon that moves in smaller steps (a new target
     * at most [24–40] from where it is, darts of [16–28], gusts at [50]).
     * TODO(wyatt): every number here; [360], [260], [140], [0.3], [52, 46, 36, 28, 24],
     * [50–96], [8–12 s], [14–22], [100], [4], [24–40], [16–28], [50].
     */
    sketchyBridge: {
      barH: 150,
      rise: 360,
      fall: 260,
      maxSpeed: 140,
      bounce: 0.3,
      tiers: {
        1: { zone: 52, sway: 50, crossSec: 8, drain: 14, gusts: false },
        2: { zone: 46, sway: 60, crossSec: 9, drain: 16, gusts: false },
        3: { zone: 36, sway: 72, crossSec: 10, drain: 18, gusts: false },
        4: { zone: 28, sway: 84, crossSec: 11, drain: 20, gusts: true },
        5: { zone: 24, sway: 96, crossSec: 12, drain: 22, gusts: true },
      } as Readonly<
        Record<
          MgTier,
          { zone: number; sway: number; crossSec: number; drain: number; gusts: boolean }
        >
      >,
      integrity: 100,
      plankEvery: 4,
      retargetSec: [0.6, 1.4] as const,
      /** A new target is this far from the icon (from–to), up or down. */
      targetStep: [24, 40] as const,
      iconMargin: 8,
      dartFrom: 3,
      dartChance: 0.25,
      dart: [16, 28] as const,
      gust: { flapSec: 0.5, pushSec: 0.6, speed: 50, everySec: [3, 6] as const },
      fallCondition: 'injury',
      /** Prepare (section 10): PATCH THE PLANKS adds this much; FOOD makes the zone this much bigger; the Hiking Stick cuts the sway by this share. */
      patch: 20,
      extraZone: 4,
      lessSway: 0.25,
    },

    /**
     * Thin Ice, the crossing (23-minigames-final.md, section 7): by tier,
     * the ice (columns × rows), the share of it that's holes, and each
     * hiker's ice picks. A pick tests a square this many steps away. Falling
     * in brings the challenge's stake (Thin Ice: Soaked, until challenges
     * are hooked up). A press held this long flags.
     * TODO(wyatt): [9 × 7, 10 × 8, 11 × 8, 11 × 9, 12 × 9], [12, 15, 18, 20, 22]%, [3, 3, 2, 2, 1], [2].
     */
    thinIce: {
      tiers: {
        1: { cols: 9, rows: 7, holes: 0.12, picks: 3 },
        2: { cols: 10, rows: 8, holes: 0.15, picks: 3 },
        3: { cols: 11, rows: 8, holes: 0.18, picks: 2 },
        4: { cols: 11, rows: 9, holes: 0.2, picks: 2 },
        5: { cols: 12, rows: 9, holes: 0.22, picks: 1 },
      } as Readonly<Record<MgTier, { cols: number; rows: number; holes: number; picks: number }>>,
      pickReach: 2,
      fallCondition: 'soaked',
      longPressSec: 0.4,
    },

    /**
     * Dodge (Phase 10.8 steps 3, 3b and 3c, docs/design/12-minigames-dodge.md):
     * one party sprite dodges an animal's attacks in a box. Attacks come from
     * a shared library; an animal is a box, a portrait and a list of attacks.
     * TODO(wyatt): every number is a first guess, by attack, tier and level.
     * Sizes, places and distances are in scene units (320 × 240), speeds in
     * units a second.
     *
     * Tiers and levels (Nov 25): each challenge tier (I to V) picks which
     * animals show up and at what level (Easy, 1, 2 or 3). In the attack
     * numbers below, the keys 1, 2 and 3 are Levels 1, 2 and 3 (what used to
     * be Tiers I to III), and "from" is the first level an attack or variant
     * shows up on. Easy (Bees and Squirrel Army only) has its own numbers.
     */
    dodge: {
      /**
       * By tier: the length, the chance the next attack overlaps the current
       * one, and the most attacks at once. Wyatt's call: no overlaps below
       * Tier V.
       */
      tiers: {
        1: { lengthSec: 20, overlapChance: 0, maxAtOnce: 1 },
        2: { lengthSec: 25, overlapChance: 0, maxAtOnce: 1 },
        3: { lengthSec: 30, overlapChance: 0, maxAtOnce: 1 },
        4: { lengthSec: 30, overlapChance: 0, maxAtOnce: 1 },
        5: { lengthSec: 35, overlapChance: 0.6, maxAtOnce: 3 },
      } as Readonly<
        Record<MgTier, { lengthSec: number; overlapChance: number; maxAtOnce: number }>
      >,
      /** By level (0 is Easy): the attack speed, and the gap after the attacks end before the next one. */
      levels: {
        0: { speed: 0.85, gapSec: 1.0 },
        1: { speed: 1.0, gapSec: 0.8 },
        2: { speed: 1.2, gapSec: 0.6 },
        3: { speed: 1.4, gapSec: 0.5 },
      } as Readonly<Record<0 | 1 | 2 | 3, { speed: number; gapSec: number }>>,
      /**
       * Who shows up at each tier, and at what level (0 is Easy). The Woods
       * Monster comes from the night monster event, from Tier III.
       */
      roster: {
        1: { bees: 0, squirrels: 0, ants: 0, eagle: 0 },
        2: { bees: 1, squirrels: 1, bobcat: 1, bear: 1, ants: 1, eagle: 1 },
        3: {
          eagle: 2,
          bees: 2,
          squirrels: 2,
          bobcat: 2,
          bear: 2,
          swordBear: 2,
          ants: 2,
          gunBear: 2,
          stampede: 2,
          monster: 3,
        },
        4: {
          eagle: 3,
          bees: 3,
          squirrels: 3,
          bobcat: 3,
          bear: 3,
          swordBear: 3,
          ants: 3,
          gunBear: 3,
          stampede: 3,
          monster: 3,
        },
        5: {
          eagle: 3,
          bees: 3,
          squirrels: 3,
          bobcat: 3,
          bear: 3,
          swordBear: 3,
          ants: 3,
          gunBear: 3,
          stampede: 3,
          monster: 3,
        },
      } as Readonly<Record<MgTier, Readonly<Partial<Record<string, 0 | 1 | 2 | 3>>>>>,
      /**
       * How common each animal is when one is picked at random for a tier
       * (not the Woods Monster). Ants and Bear with a Gun (Nov 26):
       * TODO(wyatt): [25] at Tier II, then [20] each; at Tier I (Nov 26, second
       * round) bees [40], squirrels [30], ants [30]. The Eagle (Nov 26, third
       * round): [20] at every tier. The snow animals aren't picked at random.
       */
      weights: {
        1: { eagle: 20, bees: 40, squirrels: 30, ants: 30 },
        2: { eagle: 20, bees: 20, squirrels: 25, bobcat: 30, bear: 25, ants: 25 },
        3: {
          eagle: 20,
          bees: 5,
          squirrels: 10,
          bobcat: 25,
          bear: 25,
          swordBear: 20,
          stampede: 15,
          ants: 20,
          gunBear: 20,
        },
        4: {
          eagle: 20,
          bees: 5,
          squirrels: 10,
          bobcat: 20,
          bear: 25,
          swordBear: 20,
          stampede: 20,
          ants: 20,
          gunBear: 20,
        },
        5: {
          eagle: 20,
          bees: 5,
          squirrels: 10,
          bobcat: 20,
          bear: 25,
          swordBear: 20,
          stampede: 20,
          ants: 20,
          gunBear: 20,
        },
      } as Readonly<Record<MgTier, Readonly<Partial<Record<string, number>>>>>,
      /** An overlapping attack starts this far into the current one (from, to). */
      overlapAfterSec: [0.3, 0.8] as const,
      /** The box keeps at least this far from both HUDs, so warnings fit outside it. */
      hudGap: 12,
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
       * Each animal's box (width × height) and its middle on screen. The
       * boxes sit with their bottom at y 196 or 197, as in the mockups, 12
       * clear of the bottom HUD. "herd" is the Stampede's own box, for Herd
       * rush (my guess, from 9-stampede.png).
       */
      animals: {
        bees: { box: [120, 120], at: [160, 137] },
        bear: { box: [140, 110], at: [160, 141] },
        swordBear: { box: [180, 80], at: [160, 146] },
        bobcat: { box: [150, 110], at: [160, 141] },
        squirrels: { box: [130, 120], at: [160, 136] },
        herd: { box: [160, 100], at: [160, 146] },
        monster: { box: [170, 110], at: [160, 141] },
        /** Nov 26. TODO(wyatt): boxes [160 × 110] and [150 × 120]. */
        gunBear: { box: [160, 110], at: [160, 142] },
        ants: { box: [150, 120], at: [160, 136] },
        /** Nov 26, third round (my guesses): the Eagle's three versions, the Snow Leopard and the Snowgirl. */
        eagle: { box: [150, 110], at: [160, 141] },
        toupeeEagle: { box: [150, 110], at: [160, 141] },
        freeagle: { box: [160, 105], at: [160, 144] },
        snowLeopard: { box: [160, 110], at: [160, 141] },
        snowgirl: { box: [150, 110], at: [160, 141] },
      } as Readonly<
        Record<
          | 'bees'
          | 'bear'
          | 'swordBear'
          | 'bobcat'
          | 'squirrels'
          | 'herd'
          | 'monster'
          | 'gunBear'
          | 'ants'
          | 'eagle'
          | 'toupeeEagle'
          | 'freeagle'
          | 'snowLeopard'
          | 'snowgirl',
          { box: readonly [number, number]; at: readonly [number, number] }
        >
      >,
      /**
       * The first level each attack shows up on (1 when not listed). The
       * attacks marked Claude's idea are in attacks/claudesIdeas.ts. The
       * bees' patterns go by `bees.levels` instead.
       */
      unlocks: {
        shout: 2,
        hug: 2,
        honey: 3,
        xSlash: 3,
        thrown: 3,
        dash: 2,
        landingSwipe: 3,
        scurry: 2,
        darkness: 3,
        snipe: 2,
        ricochet: 2,
        quickDraw: 3,
        fireAnts: 2,
        antHill: 2,
        crumbRush: 3,
        wingGust: 2,
        oilBarrels: 2,
        avalanche: 3,
      } as Readonly<Partial<Record<string, 1 | 2 | 3>>>,
      /**
       * Wild Predator Stampede: this much longer than the tier's length by
       * default, and no animal more than this many times in a row. Every
       * attack plays at the Stampede's level (never Easy); overlaps follow
       * the tier above.
       */
      stampede: { extraSec: 10, maxSameAnimal: 2 },
      /**
       * The Woods Monster (boss, Nov 25): always Level 3. At Tier V he
       * overlaps attacks and gets his boss boost: this much speed, these
       * overlap-chance points and one more attack at once. He lasts this
       * long by default. His second half always comes, shrinking the box to
       * this over this long.
       */
      monster: {
        lengthSec: 40,
        boost: { speed: 1.2, overlapChance: 0.2, maxAtOnce: 1 },
        shrunk: [140, 90] as const,
        shrinkSec: 1,
      },
      bees: {
        radius: 2.5,
        speed: 80,
        /** The two frames swap this often. */
        frameSec: 0.1,
        /**
         * The patterns at each level (0 is Easy), Nov 25: bees are the Tier I
         * animal, so they start easiest. Full rows only at Level 3.
         */
        levels: {
          0: ['single', 'pairs'],
          1: ['single', 'lane'],
          2: ['lane', 'cross', 'zigzag'],
          3: ['lane', 'cross', 'diagonal', 'aimed'],
        } as Readonly<Record<0 | 1 | 2 | 3, readonly string[]>>,
        /**
         * One at a time: this many bees from random edge points, each aimed at
         * the sprite as it launches, this far apart (Easy, Level 1). On Easy
         * they fly this fast; at Level 1, at the bees' speed (my reading).
         */
        single: { bees: [6, 8] as const, everySec: { 0: 0.8, 1: 0.6 }, easySpeed: 55 },
        /** Pairs (Easy): two bees from one side in lanes this far apart (a share of the side, my guess), this far apart in time. */
        pairs: { apart: 0.5, everySec: 0.6 },
        /**
         * Lane: this many bees with one gap lane, each starting up to this
         * much later than the first, by level (Level 3: a full row, all at
         * once). Cross: this many per lane, staggered as Lane (Level 2) or in
         * full rows (Level 3).
         */
        lane: {
          1: { bees: [3, 4], staggerSec: 0.6 },
          2: { bees: [4, 6], staggerSec: 0.45 },
          3: { bees: [4, 6], staggerSec: 0 },
        } as Readonly<Record<1 | 2 | 3, { bees: readonly [number, number]; staggerSec: number }>>,
        cross: [3, 4] as const,
        /** Diagonal: this many bees, this far apart, starting this far apart in time. */
        diagonal: { bees: 5, spacing: 20, staggerSec: 0.12 },
        /** Zigzag: this many bees, swinging this far, this many times a second. */
        zigzag: { bees: 2, amplitude: 28, perSec: 1.2 },
        /** Aimed swarm (Level 3): this many bees at once from random edges, aimed at the sprite. */
        aimed: { bees: 4 },
      },
      /**
       * Bear with a Sword. Its shrinking box on Tier III: the box sometimes
       * shrinks to this for this many of the bear's attacks (any of them,
       * Nov 26). The sword is this long from its hilt, and its blade this
       * thick. (The Sword sweep was removed Nov 26: Sword Volley replaces it.)
       */
      sword: {
        shrunk: [140, 70] as const,
        shrinkFrom: 3,
        shrinkChance: 0.3,
        shrinkSwings: 3,
        blade: 116,
        bladeHalfWidth: 2,
      },
      /**
       * Sword Volley (22-minigame-revisions.md, section 5): this many swords
       * by level, each on the box's edge at least this far from the others
       * and from a corner, its tip this far in. They appear this long apart,
       * warn this long after the last, then fly in order this long apart at
       * this speed; each hits as a segment this long and half this wide.
       * TODO(wyatt): every number is a first guess.
       */
      volley: {
        swords: { 1: 3, 2: 4, 3: 5 } as Readonly<Record<1 | 2 | 3, number>>,
        apart: 24,
        corner: 16,
        tipIn: 10,
        appearSec: 0.15,
        warnSec: 0.6,
        flyGapSec: 0.35,
        speed: 260,
        length: 24,
        half: 2,
      },
      /**
       * Claws (Bear, Bear with a Sword, Bobcat): always curved. Each row of
       * claws (this many by tier, this far apart) swings around a pivot this
       * far outside a corner, over this much of a turn, aimed at a point up to
       * this share of the box from its middle (my guesses). One attack sends
       * this many rows by tier, this long apart. Each claw hits as a segment
       * this long and thick.
       */
      claws: {
        count: { 1: 3, 2: 4, 3: 4 } as Readonly<Record<1 | 2 | 3, number>>,
        rows: { 1: 2, 2: 3, 3: 4 } as Readonly<Record<1 | 2 | 3, number>>,
        rowGapSec: 0.25,
        spacing: 9,
        speed: 90,
        length: 14,
        thickness: 1,
        pivotOut: 24,
        sweepDeg: 100,
        aimSpread: 0.2,
        /** Bobcat claws: this much faster, with this warning. */
        bobcat: { speed: 1.5, warnSec: 0.5 },
        /** Bear with a Sword: the chance a claw row comes in on top of a sword attack, by tier. */
        withSword: { 1: 0.4, 2: 0.6, 3: 0.8 } as Readonly<Record<1 | 2 | 3, number>>,
        /** Landing swipe: the row curves on this radius from the landing spot (my guess). */
        landingRadius: 60,
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
       * Wave (Bear with a Sword): the sword slides along a wall at this speed,
       * the blade dipping in and out from 0 to this much of the box's depth,
       * one dip every this many units (my guess, from mockup 11). Its path
       * shows this far ahead in time. Tier II: either wall. Tier III: both at
       * once, half a wave out of step.
       */
      wave: {
        speed: 80,
        depth: 0.45,
        wavelength: 90,
        aheadSec: 0.6,
        eitherFrom: 2,
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
       * Stalk (Bobcat): it comes in at an edge and hops at the sprite this many
       * times by tier. Each hop's aim line and landing show this long first
       * (shorter on faster tiers, never under the minimum), the hop takes this
       * long, then it crouches. It hits as a circle this big during each hop.
       * After the last landing it leaves through the nearest wall in this
       * long (my guess).
       */
      stalk: {
        hops: { 1: 3, 2: 4, 3: 4 } as Readonly<Record<1 | 2 | 3, number>>,
        aimSec: 0.45,
        hopSec: 0.25,
        crouchSec: 0.35,
        radius: 7,
        leaveSec: 0.3,
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
        /** Easy (Nov 25): one acorn at a time, this fast, breaking on this bounce. */
        easy: { count: 1, speed: 55, breakOn: 2 },
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
        /** Easy (Nov 25): one bomb, sitting still, with a longer fuse and a smaller blast. */
        easy: { count: 1, fuseSec: 2.2, radius: 20 },
      },
      /**
       * Shrapnel (Tier III): from a bomb's blast and from a breaking acorn, in
       * straight lines at this speed (the acorns' speed is my guess: the same),
       * gone at the walls.
       */
      shrapnel: { from: 3, bombPieces: 8, acornPieces: 4, speed: 100, radius: 1.5 },

      // Claude's ideas (attacks/claudesIdeas.ts): Wyatt keeps or cuts them after playing.
      /**
       * Shout (it was Roar): a burst of small arc waves, each this wide, this
       * far apart in time, spreading at this speed, from the bear's mouth this
       * far above the box (my guess). Tier III: sometimes a second shout this
       * far to one side right after (my guesses).
       */
      shout: {
        waves: [3, 4] as const,
        spreadDeg: 40,
        everySec: 0.2,
        speed: 60,
        thickness: 2,
        mouthAbove: 22,
        twoFrom: 3,
        twoChance: 0.5,
        twoAngleDeg: 20,
      },
      /** Bear hug (a changer): the side walls squeeze in to this much of the width, hold, and go back. */
      hug: { width: 0.55, squeezeSec: 0.5, holdSec: 3 },
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
      /**
       * Thrown sword: spins across and back on a lower line, this many turns
       * a second. Its length is from mockup 11; its speed and lines are my
       * guesses.
       */
      thrown: {
        speed: 140,
        spinPerSec: 2,
        length: 30,
        thickness: 3,
        lines: [0.3, 0.75] as const,
      },
      /**
       * Zigzag dash: the bobcat dashes along a zigzag with this sharp a turn
       * and legs this long, slanted this much from straight across (my
       * guess) so it comes back on a new line when it bounces off a wall,
       * for this many passes by tier. The first pass shows this long before,
       * each next pass this long before its bounce.
       */
      dash: {
        warnSec: 0.7,
        nextWarnSec: 0.4,
        speed: 160,
        radius: 8,
        turnDeg: 70,
        leg: 18,
        slantDeg: [20, 40] as const,
        passes: { 1: 2, 2: 2, 3: 3 } as Readonly<Record<1 | 2 | 3, number>>,
      },
      /** Pinecone rain: this many columns, falling (gravity, one bounce), then rolling off (my guesses). */
      pinecones: {
        columns: [3, 5] as const,
        /** Easy (Nov 25): fewer columns. */
        easyColumns: [2, 3] as const,
        radius: 4,
        gravity: 260,
        bounce: 0.45,
        rollSpeed: 60,
        staggerSec: 0.15,
      },
      /**
       * Wall scurry: a line of squirrels runs around the box just inside the
       * walls (spacing and size: my guesses). Each flicks a nut at the sprite
       * this often by tier, blinking this long first; nuts fly this fast.
       */
      scurry: {
        squirrels: 4,
        speed: 110,
        spacing: 14,
        inset: 6,
        radius: 4,
        nuts: {
          everySec: { 1: 1.2, 2: 1.2, 3: 0.9 } as Readonly<Record<1 | 2 | 3, number>>,
          blinkSec: 0.35,
          speed: 90,
          radius: 2,
        },
      },
      /** Herd rush: a wall of moose with this many gaps by tier (speed and lanes: my guesses). */
      herd: {
        speed: 110,
        gaps: { 1: 2, 2: 2, 3: 1 } as Readonly<Record<1 | 2 | 3, number>>,
        lane: 20,
        hitInset: 3,
      },

      // The Woods Monster's attacks (attacks/monster.ts). Fire tongues are Wyatt's; the rest are Claude's ideas.
      /**
       * Fire tongues: flames in this many columns (every other slot across
       * the box), rising to this share of the box's height, flickering this
       * long. They rise and sink this fast (my guesses) and fill this much of
       * their slot. Tier II: a second set in the gaps. Tier III: from the
       * ceiling too.
       */
      fire: {
        columns: [5, 7] as const,
        height: [0.4, 0.7] as const,
        riseSec: 0.2,
        flickerSec: 1.2,
        sinkSec: 0.2,
        frameSec: 0.12,
        width: 0.85,
        secondFrom: 2,
        ceilingFrom: 3,
      },
      /**
       * Grasping hands: a chain of this many, this far apart in time, each
       * where the sprite is when its crack shows this long before; they grab
       * this long. They rise this fast (my guess).
       */
      hands: { count: [4, 6] as const, everySec: 0.35, crackSec: 0.4, grabSec: 0.3, riseSec: 0.1 },
      /**
       * Candle wisps: this many from the cultists' candles, this far apart in
       * time (my guess), drifting at this speed and turning at most this fast
       * (my guess), gone after this long. Hit radius: my guess.
       */
      wisps: {
        count: [3, 5] as const,
        everySec: 0.3,
        speed: 35,
        turnDegPerSec: 90,
        radius: 3,
        lifeSec: 3,
      },
      /**
       * Rune beams: this many lines flash for the warning, then burn this
       * long, this thick (my guess). Tier III: sometimes a 5-line star.
       */
      runes: {
        lines: [2, 3] as const,
        burnSec: 0.4,
        thickness: 4,
        starFrom: 3,
        starChance: 0.5,
      },
      /** Ritual circle: runes draw a ring this big around the sprite over this long; then the inside erupts (this long: my guess). */
      ritual: { radius: 24, drawSec: 1.2, eruptSec: 0.2, runes: 6 },
      /**
       * Glare (was The Eye): his eyes flash red this long, then a beam from
       * each eye, this wide at the floor, sweeps across the box (the two in
       * opposite directions) over this long. Staying in one this long is a hit.
       */
      glare: { warnSec: 0.6, floorWidth: 28, sweepSec: 2.4, holdSec: 0.3 },
      /**
       * Long arms (Wyatt's idea): this many thrusts, alternating arms. Each
       * winds up this long (aiming at the sprite), thrusts this fast, grabs
       * this long and pulls back this fast. The arms are this thick and the
       * hand hits as a circle this big. Wound up, the elbow sits this far out
       * and up from the shoulder, and the hand hangs this far from it (my
       * guesses, from mockup 18).
       */
      arms: {
        thrusts: 4,
        windSec: 0.7,
        thrustSec: 0.2,
        grabSec: 0.3,
        pullSec: 0.4,
        thickness: 4,
        handRadius: 6,
        elbowOut: [38, 23] as const,
        hang: 12,
      },
      /**
       * The portraits above the box (section 3; Solid + red only): the bottom
       * sits this far above the box's top at the start; if the top would go
       * above this line, the box moves down instead. They blink every so
       * often (from, to) for this long. The flying ones float up and down
       * this far each way, once every this long; the others swap to their
       * `-bob` frame and back every this long (the old pixel idle bob).
       */
      portraits: {
        gap: 6,
        minTop: 24,
        blinkEverySec: [3, 5] as const,
        blinkSec: 0.15,
        float: {
          bees: { units: 2, sec: 0.8 },
          monster: { units: 3, sec: 1.6 },
        } as Readonly<Partial<Record<string, { units: number; sec: number }>>>,
        bobSec: 0.4,
      },
      /**
       * Ice physics (23-minigames-final.md, section 9.4): on ice, input
       * speeds the sprite up at this rate (units/s²) to the normal top
       * speed; with no input it slides, its speed shrinking by this much a
       * second (speed × e^(−this × dt)). GRIP (Prepare) multiplies the
       * friction by this. TODO(wyatt): [240], [1.2], [2].
       */
      ice: { accel: 240, friction: 1.2, grip: 2 },
      /**
       * Arrows on attacks that move across the box (26-fixes-and-wyatt-trees.md,
       * section 3.1): they blink this many times a second during the warning
       * and fade over this long once the attack starts moving. Comb-Over shows
       * this many in front of its wall; the others this many along their path.
       * TODO(wyatt): [4] a second, [4] arrows; the fade and the others' count are my guesses.
       */
      arrows: { blinkPerSec: 4, fadeSec: 0.2, comb: 4, along: 3 },
      /**
       * The Eagle (section 9.1): his version by level (Easy: Eagle; Level 1:
       * Toupeeagle; Levels 2 and 3: Freeagle). At Easy he only swoops and
       * drops feathers. Swoop: "!" and the dotted path this long, then he
       * flies it this fast, hitting within this radius; this many in a row by
       * level (the last aimed at the sprite from Level 2), this far apart
       * (my guess). Feather Fall: this many by level, falling this fast,
       * swaying this far every this long (hitting within this radius, and
       * coming in over this long: my guesses). Talon Drop: a shadow follows
       * the sprite this long, then the talons strike this long after,
       * within this radius (shown this long: my guess). Wing Gust: feathers
       * stream this long, then the sprite is pushed this fast for this long.
       * Hair Toss: this many curly hairs by level, this fast, curving this
       * much (and hitting within this radius: my guesses). Comb-Over: a wall
       * of hair with one gap this wide sweeps across (this thick, this fast,
       * after this warning: my guesses). Oil Barrels: this many by level,
       * landing on a shadow this long, a fuse this long, bursting within
       * this radius (shown this long: my guess); each leaves a puddle this
       * big for this long, where the sprite slides.
       * TODO(wyatt): every number from the design's [brackets]; the rest are my guesses.
       */
      eagle: {
        easy: ['swoop', 'featherFall'] as readonly string[],
        swoop: {
          warnSec: 0.8,
          speed: 220,
          radius: 7,
          count: { 0: 1, 1: 2, 2: 3, 3: 3 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          apartSec: 0.7,
        },
        feather: {
          count: { 0: 6, 1: 8, 2: 10, 3: 12 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          speed: 30,
          sway: 12,
          swaySec: 1.2,
          radius: 3,
          spreadSec: 2,
        },
        talon: { followSec: 1, strikeSec: 0.4, radius: 12, showSec: 0.2 },
        gust: { warnSec: 0.4, push: 40, sec: 1.2 },
        hair: {
          count: { 1: 3, 2: 4, 3: 5 } as Readonly<Record<1 | 2 | 3, number>>,
          speed: 110,
          curve: 40,
          radius: 3,
          apartSec: 0.3,
        },
        comb: { gap: 20, thick: 8, speed: 70, warnSec: 0.8 },
        oil: {
          barrels: { 1: 2, 2: 2, 3: 3 } as Readonly<Record<1 | 2 | 3, number>>,
          landSec: 0.6,
          fuseSec: 1.4,
          burst: 18,
          burstShowSec: 0.2,
          puddle: 20,
          puddleSec: 6,
        },
      },
      /**
       * The snow animals (sections 9.2 and 9.3): only from their snow
       * challenges and the testing tab; Level 2 at Tier III and Level 3 at
       * Tiers IV and V (their lowest, 2, when tested at Tiers I and II). The
       * whole box is ice. Every attack is Claude's idea but the Claws.
       * Pounce: a red dotted line to where the sprite is, then a leap this
       * long after at this speed, hitting within this radius; at Level 3
       * sometimes a second (this often: my guess). Prowl: he pads round the
       * box for this long (my guess) at this speed (my guess), then pounces
       * with this shorter warning. Tail Sweep: a band this wide (my guess) is
       * warned this long, then the tail sweeps it over this long (my guess).
       * Snow Kick: this many pellets in a cone this wide, this fast, hitting
       * within this radius (after this warning: my guesses). Snowballs: this
       * many by level, each landing on a shadow that grows this long, hitting
       * within this radius as it lands, then bursting into this many chunks
       * that slide out this fast for this long (my guesses). Icicles: this
       * many glint along the top this long, then drop this far apart at this
       * speed (my guesses). Antler Charge: a stripe this wide is warned this
       * long, then she charges through it this fast (my guesses). Shake Off:
       * a ring of this many flakes from the middle, then a second turned half
       * a gap this long after, this fast (my guesses). Avalanche (Level 3):
       * snow falls in columns about this wide, with one gap this wide whose
       * middle is at most this far from the sprite (never over it), after
       * this warning, this fast, in a band this tall (Nov 26 evening,
       * 26-fixes-and-wyatt-trees.md section 3.2: [38], [60] and [1.1 s]; the
       * near gap and the longer warning are Claude's ideas).
       * TODO(wyatt): every number from the design's [brackets]; the rest are my guesses.
       */
      snow: {
        levels: { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3 } as Readonly<Record<MgTier, 2 | 3>>,
        pounce: { warnSec: 0.7, speed: 260, radius: 8, doubleChance: 0.35 },
        prowl: { sec: 1.6, speed: 90, warnSec: 0.5 },
        tail: { band: 24, warnSec: 0.8, sweepSec: 0.4 },
        kick: { count: [8, 12] as const, spreadDeg: 30, speed: 90, radius: 2.5, warnSec: 0.6 },
        snowballs: {
          count: { 1: 3, 2: 3, 3: 5 } as Readonly<Record<1 | 2 | 3, number>>,
          lobSec: 0.8,
          apartSec: 0.35,
          radius: 6,
          chunks: 4,
          chunkSpeed: 50,
          chunkRadius: 3,
          chunkSec: 1.6,
        },
        icicles: {
          count: [5, 8] as const,
          glintSec: 0.6,
          apartSec: 0.18,
          speed: 160,
          half: 2,
          length: 14,
        },
        charge: { band: 18, warnSec: 1, speed: 200, radius: 12 },
        shake: { flakes: 16, apartSec: 0.4, speed: 70, radius: 2, warnSec: 0.6 },
        avalanche: { column: 16, gap: 38, near: 60, warnSec: 1.1, speed: 120, band: 20 },
      },
      /** Darkness (Level 3, second half): the box goes dark for this long, but for a light this big around the sprite (my guess). */
      darkness: { sec: 4, light: 24 },
      /**
       * Holes and the Ant Hill are walls: the sprite's middle keeps this far
       * outside their circle. TODO(wyatt): my guess.
       */
      blockPad: 4,
      /**
       * Bear with a Gun (docs/design/21-minigames-dodge-camp.md, section 1).
       * By level where it says. TODO(wyatt): every number here is a first
       * guess from the design's [brackets]; the ones marked "my guess" are mine.
       */
      gun: {
        /**
         * Aimed Shot: the gun sits this far outside a wall (my guess); the aim
         * line tracks the sprite this long, then locks and blinks this long;
         * the shot's lane is this wide and crosses the box this fast, its
         * trail staying this long. This many shots in a row, this long apart;
         * at Level 3 every third is a double, two lanes this far apart.
         */
        aimed: {
          out: 4,
          trackSec: { 1: 0.5, 2: 0.4, 3: 0.32 } as Readonly<Record<1 | 2 | 3, number>>,
          lockSec: 0.2,
          laneWidth: 6,
          crossSec: 0.06,
          trailSec: 0.15,
          shots: { 1: 3, 2: 4, 3: 5 } as Readonly<Record<1 | 2 | 3, number>>,
          gapSec: 0.25,
          doubleFrom: 3,
          doubleEvery: 3,
          doubleApart: 14,
        },
        /**
         * Snipe (Level 2 and up): the crosshair follows the sprite at this
         * share of its top speed for this long, locks red this long, then
         * blasts a circle this big for this many hearts (the blast shows this
         * long: my guess). The hole it leaves is this big, stays this long and
         * fades over this long. At most this many holes, covering at most this
         * share of the box. Level 3: two snipes back to back.
         */
        snipe: {
          follow: {
            1: { share: 0.7, sec: 1.6 },
            2: { share: 0.7, sec: 1.6 },
            3: { share: 0.85, sec: 2.0 },
          } as Readonly<Record<1 | 2 | 3, { share: number; sec: number }>>,
          lockSec: 0.35,
          blastRadius: 14,
          blastSec: 0.15,
          damage: 2,
          holeRadius: 12,
          holeSec: { 1: 5, 2: 5, 3: 7 } as Readonly<Record<1 | 2 | 3, number>>,
          fadeSec: 2,
          maxHoles: 3,
          maxCover: 0.3,
          twiceFrom: 3,
        },
        /**
         * Bear Traps: this many traps, tossed this far apart in time (my
         * guess), each landing spot's shadow showing this long first. Open
         * this long (then fading this long: my guess); stepping on one costs
         * a heart and slows the sprite to this share for this long, and the
         * closed trap fades in this long. At most this many open; none lands
         * this near the sprite (spots are picked this far from it: my guess)
         * or on a hole. A trap hits as an ellipse this big (my guess), and
         * they land at least this far apart (my guess).
         */
        traps: {
          count: { 1: 2, 2: 3, 3: 4 } as Readonly<Record<1 | 2 | 3, number>>,
          tossGapSec: 0.15,
          shadowSec: 0.6,
          /** Nov 26, second round: a trap lands gray and harmless this much longer, then turns red. TODO(wyatt): [1 s]. */
          armSec: 1,
          openSec: { 1: 8, 2: 10, 3: 12 } as Readonly<Record<1 | 2 | 3, number>>,
          openFadeSec: 0.5,
          slow: 0.5,
          slowSec: 1.5,
          closedFadeSec: 1,
          maxOpen: 5,
          away: 16,
          pickAway: 28,
          hit: [7, 4] as const,
          apart: 22,
        },
        /**
         * Rapid Fire: the gun's warning ("!" and the cone) lasts this long;
         * then this many bullets fly out over this long, each within this many
         * degrees of the cone's middle, at this speed. A bullet hits as a
         * circle this big.
         */
        rapid: {
          warnSec: 0.6,
          bullets: { 1: 8, 2: 10, 3: 12 } as Readonly<Record<1 | 2 | 3, number>>,
          sec: 1.2,
          spreadDeg: 30,
          speed: { 1: 200, 2: 230, 3: 260 } as Readonly<Record<1 | 2 | 3, number>>,
          radius: 2,
        },
        /** Ricochet (Claude's idea, Level 2 and up): one slow shot whose path shows this long first, bouncing this many times. */
        ricochet: {
          speed: 260,
          warnSec: 0.8,
          bounces: { 1: 3, 2: 4, 3: 5 } as Readonly<Record<1 | 2 | 3, number>>,
          radius: 2,
          /** Shots by tier (Nov 26, second round): [2] at Tier III, [3] at IV, [4] at V, [0.25 s] apart. */
          shots: { 1: 2, 2: 2, 3: 2, 4: 3, 5: 4 } as Readonly<Record<MgTier, number>>,
          gapSec: 0.25,
        },
        /**
         * Bullet Ring (Nov 26, second round), only from Tier IV: "!" over the
         * portrait and the muzzle flash at the top edge's middle this long,
         * then this many rings by tier, this long apart, each this many
         * pellets moving out at this speed, turned this many degrees from
         * the last. A pellet hits as a circle this big. TODO(wyatt).
         */
        bulletRing: {
          fromTier: 4,
          warnSec: 0.6,
          rings: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 4 } as Readonly<Record<MgTier, number>>,
          apartSec: 0.45,
          bullets: 16,
          speed: 70,
          turnDeg: 11,
          radius: 2,
        },
        /**
         * Quick Draw (Claude's idea, Level 3): "!" over the portrait this
         * long, then a band this thick across the sprite's row, then this long
         * later one down its column. Each blast shows and hits this long (my
         * guess). A band never covers more than 1 − this share of the box.
         */
        quickDraw: { warnSec: 0.6, band: 16, gapSec: 0.3, blastSec: 0.12, safeShare: 0.3 },
      },
      /**
       * Ants (docs/design/21-minigames-dodge-camp.md, section 2). An ant
       * hits as a circle this big; its two frames swap this often.
       * TODO(wyatt): every number here is a first guess from the design's
       * [brackets]; the ones marked "my guess" are mine.
       */
      ants: {
        radius: 3,
        frameSec: 0.12,
        /** Easy (Tier I, Nov 26) plays only these. */
        easy: ['marching', 'antMill'] as readonly string[],
        /**
         * Marching Lines: this many ants a line on a grid this big, turning
         * every so many cells, at this speed; this many lines, this long
         * apart. After this long each heads out by the nearest wall. At
         * Level 1 the lead shows its next turn this many cells ahead.
         */
        march: {
          ants: { 0: 6, 1: 8, 2: 10, 3: 12 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          grid: 7,
          /** Cells between turns by level (0 is Easy, Nov 26): turning more often as it gets harder. */
          turnEvery: {
            0: [5, 8],
            1: [4, 7],
            2: [3, 6],
            3: [3, 6],
          } as Readonly<Record<0 | 1 | 2 | 3, readonly [number, number]>>,
          speed: { 0: 38, 1: 45, 2: 55, 3: 65 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          lines: { 0: 1, 1: 1, 2: 2, 3: 3 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          apartSec: 0.5,
          walkSec: 5,
          hintUpTo: 1,
          hintCells: 2,
        },
        /**
         * Ant Mill: a ring of this many ants this big around a spot for this
         * long, turning this fast; with a column of this many marching across
         * elsewhere (at the marching speed: my guess), kept this far outside
         * the ring (my guess). Level 2: the ring drifts toward the sprite this
         * fast. Level 3: two rings, turning opposite ways.
         */
        mill: {
          ring: { 0: 10, 1: 12, 2: 14, 3: 16 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          radius: 22,
          sec: 4,
          turn: { 0: 0.9, 1: 1.2, 2: 1.2, 3: 1.2 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          column: { 0: 0, 1: 8, 2: 10, 3: 12 } as Readonly<Record<0 | 1 | 2 | 3, number>>,
          clear: 8,
          driftFrom: 2,
          drift: 10,
          twoFrom: 3,
        },
        /**
         * Fire Ants (Level 2 and up): this many walk in (over this long: my
         * guess) to spots this far apart, wait this long, then all but one
         * turn red and blink for this long before blowing up, each blast
         * this big (shown this long: my guess). No blast reaches within this
         * far of the safe ant, which starts at least this far from the sprite.
         * Level 3: it walks this far (my guess) to a new spot during the warning.
         */
        fire: {
          ants: { 1: 4, 2: 4, 3: 5 } as Readonly<Record<1 | 2 | 3, number>>,
          tierFive: 6,
          walkSec: 0.6,
          apart: 30,
          stopSec: 0.6,
          redSec: 1.2,
          blast: 26,
          boomSec: 0.3,
          safe: 12,
          fromSprite: 40,
          moveFrom: 3,
          move: [18, 28] as const,
        },
        /**
         * Ant Hill (Level 2 and up): a crack this far from the sprite shows
         * this long, the hill rises (this long: my guess) and stays up this
         * long (longer at Tier V), solid as a circle this big. While up it
         * fires an ant at the sprite this often, at this speed. Then it sinks
         * (this long: my guess).
         */
        hill: {
          away: 50,
          crackSec: 0.6,
          riseSec: 0.2,
          upSec: { 1: 3, 2: 3, 3: 4 } as Readonly<Record<1 | 2 | 3, number>>,
          tierFiveSec: 5,
          radius: 10,
          everySec: { 1: 0.4, 2: 0.4, 3: 0.3 } as Readonly<Record<1 | 2 | 3, number>>,
          speed: { 1: 70, 2: 70, 3: 80 } as Readonly<Record<1 | 2 | 3, number>>,
          sinkSec: 0.3,
        },
        /** Leafcutter Parade (Claude's idea): a row of leaf carriers crosses at this speed with these gaps; a leaf hits as this box. */
        parade: {
          speed: 40,
          gap: { 1: 18, 2: 15, 3: 12 } as Readonly<Record<1 | 2 | 3, number>>,
          leaf: [10, 8] as const,
        },
        /**
         * Crumb Rush (Claude's idea, Level 3): this many crumbs (more at Tier
         * V), each at least this far from the sprite and from each other (my
         * guesses); then this many ants pour in from the walls over this long
         * (my guess) at this speed, and stay this long once there (my guess).
         */
        crumbs: {
          count: 2,
          tierFive: 3,
          away: 25,
          apart: 40,
          ants: 16,
          pourSec: 1,
          speed: 60,
          staySec: 0.4,
        },
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
