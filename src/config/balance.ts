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
     * Nights each shelter lasts once placed.
     * TODO(wyatt): Tailgate, Yurt, Hostel, Tree-House, RV, Medic Tent and Lodge are the doc's first guesses.
     */
    shelterNights: {
      hammock: 1,
      tent: 3,
      cabin: 5,
      tailgate: 3,
      yurt: 4,
      hostel: 4,
      treeHouse: 4,
      rv: 4,
      medicTent: 3,
      lodge: 5,
    } as Record<string, number>,
    /** TODO(wyatt): the Diploma's XP, as a share of a level (first guess 60–100%). TODO(phase 10). */
    diplomaXp: { min: 0.6, max: 1 },
    /** TODO(wyatt): the Postcard's extra XP (first guess). TODO(phase 10). */
    postcardXp: { checkpoint: 5, challenge: 1 },
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
     * CHALLENGE_SHARE: the share of each biome's plain tiles (no special space,
     * no Wonder) that hold a card. 1 means every one, as before. Below 1, the
     * rest are quiet, and the scouting tools are worth more. Special spaces
     * and Wonders always keep theirs. TODO(wyatt): try lowering it.
     */
    share: { meadow: 1, temperateRainforest: 1, alpine: 1 } as Record<BiomeId, number>,
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
    /**
     * A new run gives each hiker this many random resources (Nov 13 update).
     * It stands in for the start-of-hike rules coming later.
     */
    startingResources: 4,
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

  /** Weather (05-nights-and-weather.md, Phase 6). */
  weather: {
    /**
     * The placeholder schedule until Phase 11 gives each biome its own odds:
     * Clear for 2–4 days, then a random weather for 2–3 days (Wyatt, Nov 6).
     * TODO(phase 11): per-biome odds (Snow up high, Heatwave in the Meadow).
     */
    schedule: {
      clearDays: { min: 2, max: 4 },
      weatherDays: { min: 2, max: 3 },
      weights: { rain: 35, storm: 20, snow: 15, heatwave: 30 },
    },
    /** How many days ahead the forecast shows. */
    forecastDays: 3,
    /** Each phase, the chance a node floods, freezes or catches fire. */
    nodeChance: 0.15,
    /** Each phase, the chance fire spreads to a connected tile with a Forest node. */
    fireSpread: 0.35,
    /** Luck a Fire node gives the other nodes on its tile. */
    fireLuck: 1,
    /** Drizzle: each clothing item's chance to lose 1 durability each phase. */
    drizzleWear: 0.35,
    /** Drizzle: how long Wet lasts. TODO(wyatt): the doc doesn't say; first guess. */
    drizzleWetDays: 1,
    /** Thunder: how likely Wildlife cards are while it storms. */
    thunderWildlifeWeight: 0.25,
    /** Sheer Cold: Shivering each phase, less 1 a clothing item, 1 a hiker with you, 2 for a shelter. */
    sheerCold: { base: 3, perClothes: 1, perHiker: 1, shelter: 2 },
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
    leader: { moveAllDiscount: 1 },
    /** Thrill Seeker (Nov 6): losing this much Energy in one phase gives Energized for this many days. */
    thrillSeeker: { energyLost: 3, days: 1 },
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
    /** Passed-out hikers skip the camp-step drains: they're out cold (Wyatt, Nov 7). */
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
