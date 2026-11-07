/**
 * The shape of the whole game. Everything here is plain JSON data so a game
 * can be saved, loaded, replayed and compared in tests.
 */
import type { WonderPick, WonderState } from './wonders/types';

export type HikerId = string;
export type TileId = string;
export type LineId = string;
export type TraitId = string;
export type ConditionId = string;
export type ItemId = string;
export type ResourceId = string;

// ── Stats ──────────────────────────────────────────────────────────────────

export type StatName = 'energy' | 'appetite' | 'morale';
export const STAT_NAMES: readonly StatName[] = ['energy', 'appetite', 'morale'];

/** Energy, Appetite and Morale, 0–10. 10 is best for all three. */
export type Stats = Record<StatName, number>;

/** An amount of each stat, used for costs and gains. */
export type StatAmounts = Record<StatName, number>;

// ── Time ───────────────────────────────────────────────────────────────────

export type Phase = 'morning' | 'afternoon' | 'night';
export const PHASES: readonly Phase[] = ['morning', 'afternoon', 'night'];

// ── Map ────────────────────────────────────────────────────────────────────

/** The four resource nodes, each with its own Abundance meter. */
export type NodeType = 'forest' | 'river' | 'wildlife' | 'mountain';
export const NODE_TYPES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];
/** What can sit in a tile's node spot: a resource node, or a Cap node (acorn caps more likely). */
export type NodeKind = NodeType | 'caps';
export type LineKind = 'normal' | 'paved' | 'steep' | 'muddy' | 'rough';
export const LINE_KINDS: readonly LineKind[] = ['normal', 'paved', 'steep', 'muddy', 'rough'];
export type BiomeId = 'meadow' | 'temperateRainforest' | 'alpine';
export type TileKind = 'trailhead' | 'normal' | 'checkpoint';
export type SpecialSpace =
  | 'opportunity'
  | 'challenge'
  | 'choice'
  | 'trailSign'
  | 'geoCache'
  | 'campsite'
  | 'overlook'
  | 'narrowPath'
  | 'mystery';
export const SPECIAL_SPACES: readonly SpecialSpace[] = [
  'opportunity',
  'challenge',
  'choice',
  'trailSign',
  'geoCache',
  'campsite',
  'overlook',
  'narrowPath',
  'mystery',
];
/** Side features attach to a normal tile and add an extra option there. */
export type SideFeature = 'merchant' | 'trader';

/** What weather did to a node (Phase 6): flooded counts as River; frozen and on fire give nothing. */
export type NodeWeatherState = 'flooded' | 'frozen' | 'fire';

export interface TileNode {
  type: NodeKind;
  /** Shown on the map. Hidden nodes show as ? until a hiker enters or scouts the tile. */
  revealed: boolean;
  /** A Bounty node: extra resources are more likely, at an extra Abundance cost. */
  bounty?: true;
  /** Changed by the weather, and what it was before, so it goes back when the weather ends. */
  weather?: { state: NodeWeatherState; was: NodeType };
}

export interface Tile {
  id: TileId;
  /** 0 is the trailhead row; rows count up toward the checkpoint. */
  row: number;
  /**
   * Position on a staggered hex grid, in half-tile steps: tiles in one row are
   * 2 apart, and a tile's neighbours in the next row are at col ± 1.
   */
  col: number;
  kind: TileKind;
  special: SpecialSpace | null;
  /** Narrow Path only: how many hikers it holds at once. */
  narrowCapacity?: number;
  feature?: SideFeature;
  /** A hiker has landed here. The special icon moves to the corner once true. */
  visited?: true;
  /** Its challenge will be this many tiers higher, or lower (Warning Bird, Predator Bait). */
  tierBonus?: number;
  /** Raised once already by Predator's Den (each tile only once). */
  denRaised?: true;
  /**
   * Its card, picked early and shown on the map (Old Firewatch Tower). It opens
   * as usual when someone lands here, with its numbers rolled then.
   */
  revealedCard?: { cardId: string; tier: 1 | 2 | 3; scale: number; alternative?: string };
  /** Shelters built on this tile (Ruins). TODO(phase 9): hikers placing shelter cards. */
  shelters?: ItemId[];
  /** Scavenging here gets extra Luck until a phase number (Hungry Animals). */
  luckBonus?: { amount: number; until: number; cause: string };
  /** This biome's Wonder (one per section). Its tile has no nodes and never draws a card. */
  wonder?: WonderState;
  nodes: TileNode[];
}

/** A line between two tiles. Hikers can cross it either way. */
export interface Line {
  id: LineId;
  a: TileId;
  b: TileId;
  kind: LineKind;
}

export interface Section {
  biome: BiomeId;
  tier: number;
  tiles: Record<TileId, Tile>;
  lines: Line[];
  trailheadId: TileId;
  checkpointId: TileId;
}

// ── Night events ───────────────────────────────────────────────────────────

/** One hiker a night event hit: what happened, as a sentence and a short chip. */
export interface NightHit {
  hikerId: HikerId;
  outcomeId: string;
  text: string;
  chip: string;
}

// ── Weather ────────────────────────────────────────────────────────────────

export type WeatherId = 'clear' | 'rain' | 'storm' | 'snow' | 'heatwave';

export interface WeatherState {
  today: WeatherId;
  /** The day this weather began. Its hiker effect starts the day after (a grace day). */
  since: number;
  /** The weather on each coming day, tomorrow first (at least the forecast's length). */
  ahead: WeatherId[];
  /** Its own RNG stream for the schedule, so planning ahead doesn't shift other draws. */
  rng: RngState;
  /** Debug and tests: the weather stays as it is. */
  hold?: true;
}

// ── Hikers ─────────────────────────────────────────────────────────────────

export type Family = 'human' | 'dog' | 'cat';
export type HikerStatus = 'active' | 'passedOut' | 'abandoned' | 'checkedIn';

/** Trail, Utility or Morale. */
export type TraitType = 'T' | 'U' | 'M';
export type SlotType = TraitType | 'T/U' | 'T/M' | 'U/M' | 'W';

export interface TraitSlot {
  type: SlotType;
  traitId: TraitId | null;
}

/** A timed condition on a hiker. Phase 5 gives it timing; Phase 6 its effects. */
/**
 * How a condition's time is counted. Phases tick down at the end of every
 * phase; days and nights at camp. 'weather' never ticks: it lasts until the
 * weather that caused it ends (Shivering, Burning).
 */
export type ConditionUnit = 'days' | 'phases' | 'nights' | 'weather';

export interface ConditionInstance {
  id: ConditionId;
  remaining: number;
  unit: ConditionUnit;
  /** Allergies: which node. */
  node?: NodeType;
  /** A condition that starts when this one ends ("Hangry, then Nauseous"). */
  then?: { id: ConditionId; remaining: number; unit: 'days' | 'phases' | 'nights' };
  /** Added during this phase: its first end of phase doesn't count. */
  fresh?: true;
  /** Stacking conditions (Shivering, Burning): how many. */
  stacks?: number;
  /** What its stat change actually moved, given back or taken back when it ends (Sleepy, Energized). */
  applied?: Partial<Record<StatName, number>>;
}

export type EquipSlot = 'body' | 'feet' | 'gear';

/** One item a hiker carries (Phase 9 fills in the details). */
export interface ItemInstance {
  uid: string;
  itemId: ItemId;
  quality?: number;
  usesLeft?: number;
  daysLeft?: number;
  /** Food: gives this much more (or less) Appetite. TODO(phase 9): used when eating arrives. */
  appetiteMod?: number;
  /** Tools: uses lost to challenges. TODO(phase 9): taken off its uses when tools arrive. */
  usesLost?: number;
  /** Clothes: durability lost to weather and night events. TODO(phase 9): taken off its durability. */
  wear?: number;
}

export interface Inventory {
  bag: ItemInstance[];
  equipped: Partial<Record<EquipSlot, ItemInstance>>;
  resources: Partial<Record<ResourceId, number>>;
}

/** How many times an ability was used in its current period (day, phase or biome). */
export interface AbilityUse {
  period: string;
  count: number;
}

export interface Hiker {
  id: HikerId;
  name: string;
  family: Family;
  placeholder?: boolean;
  status: HikerStatus;
  tileId: TileId;
  stats: Stats;
  /** Strikes toward passing out. */
  injuries: number;
  slots: TraitSlot[];
  conditions: ConditionInstance[];
  inventory: Inventory;
  /** Has used their action this phase. */
  acted: boolean;
  /** Has slept this night. */
  slept: boolean;
  /** Is keeping watch tonight: hikers on this tile are safe from the night event. */
  watching?: true;
  /** The tile this hiker last moved from (Tourist Trap sends them back). */
  cameFrom?: TileId;
  abilityUses: Record<string, AbilityUse>;
  xp: number;
  level: number;
  /** Permanent raises to a stat's maximum (Sleeping Giant's +2 maximum Energy). */
  maxBonus?: Partial<Record<StatName, number>>;
}

// ── Scavenging ─────────────────────────────────────────────────────────────

/** Card rarity, from most to least common. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary' | 'mythic';
export const RARITIES: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'veryRare',
  'legendary',
  'mythic',
];

/** Every kind of scavenge card (docs/design/01-design-doc.md, "Scavenge cards"). */
export type ScavengeCardType =
  | 'resource'
  | 'x2'
  | 'x3'
  | 'pair'
  | 'trio'
  | 'mixed'
  | 'wild'
  | 'wildX2'
  | 'varietyWild'
  | 'varietyPair'
  | 'varietyBundle'
  | 'choice'
  | 'choiceX2'
  | 'pickOfTheWild'
  | 'pairOfTheWild'
  | 'bundleOfTheWild'
  | 'caps'
  | 'toolFind'
  | 'foodFind'
  | 'clothesFind'
  | 'shelterFind'
  | 'trinketFind'
  | 'choiceTool'
  | 'choiceFood'
  | 'choiceClothes'
  | 'choiceShelter'
  | 'choiceTrinket';

/** One dealt card. Its contents are rolled when it's dealt; a Wild's stay hidden until taken. */
export interface ScavengeCard {
  type: ScavengeCardType;
  rarity: Rarity;
  /**
   * The node the card came from; taking it drains this node's Abundance.
   * Null only on a tile with nothing but Cap nodes.
   */
  node: NodeType | null;
  /** Mixed cards: the second node. */
  node2?: NodeType;
  /** Came from a Bounty node (extra Abundance cost). */
  bounty?: true;
  /** What the card gives, when it's fixed (Resource, ×2, Pair, Wild, Variety…). */
  resources?: ResourceId[];
  /** Choice cards: the player picks `count` resources from a node or from all 16, `each` of every pick. */
  pick?: { count: number; from: NodeType | 'all'; each: number };
  caps?: number;
  /** Item finds: the item. Choice items: the items to pick 1 from. */
  items?: ItemId[];
  flipped: boolean;
}

/** A line in the scavenge window's bonuses pop-over: what's changing this draw, and why. */
export interface ScavengeBonus {
  source: string;
  label: string;
  /** Luck (green), extra cards or better odds (gold), or a drawback (red). */
  tone: 'luck' | 'bonus' | 'warning';
}

/** Bonus resources a trait offers on this scavenge (Copier, Copydog). */
export interface ScavengeBonusOffer {
  source: string;
  /** Extra copies of the first resource taken. */
  count: number;
  /** Appetite for each one; 0 means they come free and are always taken. */
  appetiteEach: number;
}

/** An open scavenge: dealt, waiting for the hiker to take a card. */
export interface PendingScavenge {
  hikerId: HikerId;
  tileId: TileId;
  cards: ScavengeCard[];
  luck: number;
  bonuses: ScavengeBonus[];
  /** The RNG before the deal. "Not now" puts it back, so dealing again gives the same cards. */
  rngBefore: RngState;
  bonusOffers?: ScavengeBonusOffer[];
  /** Butterfingers: the chance the card taken slips away. */
  dropChance?: number;
}

/** Who scavenged where today (Copier, Copydog, and the night's Abundance recovery). */
export interface ScavengeRecord {
  hikerId: HikerId;
  tileId: TileId;
  nodes: NodeType[];
}

// ── Challenges, opportunities and Trials ───────────────────────────────────

/** A card's rolled numbers (see src/engine/challenges/rolls.ts). */
export interface CardRolls {
  x: Record<string, number>;
  /** Each hiker's own Y values. */
  y: Record<HikerId, Record<string, number>>;
  /** Which "(25%)" parts made it onto the card. */
  includes: Record<string, boolean>;
  /** Fox with a Specific Taste: the resources it'll take. */
  options?: ResourceId[];
  /** The Luck used for X (the average of the hikers entering). */
  luck: number;
}

/**
 * A challenge waiting on the party (Phase 5). It opens when the first hiker
 * lands on a tile and blocks everything else until it's resolved.
 */
export interface OpenChallenge {
  cardId: string;
  tileId: TileId;
  /** The tier it plays at, and its range scale (Tier III one tier up: ×1.5). */
  tier: 1 | 2 | 3;
  scale: number;
  /** The hikers on the tile when it was revealed: only they're affected. */
  hikerIds: HikerId[];
  rolls: CardRolls;
  /** Opened on a Challenge space: passing hikers each get a random reward. */
  special?: 'challenge';
  /** A Choice space: the other challenge, with its own rolls, until the party picks one. */
  alternative?: { cardId: string; rolls: CardRolls };
  /** A Trial's targets, picked when it's revealed so the pop-up can show them. */
  trial?: { targetTile?: TileId; resource?: ResourceId };
  /** Button opportunities: presses so far, by button (and hiker, for per-hiker buttons). */
  presses?: Record<string, number>;
}

/**
 * Counts kept over the whole run, for Wonder goals (Nov 6 update, 3c). Saved
 * and migrated like everything else.
 */
export interface RunCounters {
  /** Challenges each hiker passed and failed (not Risk challenges). */
  passed: Record<HikerId, number>;
  failed: Record<HikerId, number>;
  /** Items each hiker crafted, by type. Stays empty until Phase 9. */
  crafted: Record<HikerId, Partial<Record<string, number>>>;
  /** Nights in a row each hiker hasn't slept, counted at camp. */
  daysSinceSleep: Record<HikerId, number>;
  /** Shelters built in each section (by section index). */
  sheltersPlaced: Record<number, number>;
}

/** A tile a hiker landed on while a challenge was open: it opens next. */
export interface QueuedReveal {
  tileId: TileId;
  hikerIds: HikerId[];
  /** A card's effect starts a challenge of this tier and node (Bear Country). */
  forced?: { tier: 1 | 2 | 3; node: NodeType };
}

/** What a Challenge space gives a passing hiker (Phase 5 first guess). */
export type SpaceReward = 'item' | 'lucky' | 'doubleXp';

/** One thing handed in toward a challenge cost, into requirement `req` of the option. */
export type Gift =
  | { kind: 'resource'; req: number; from: HikerId; resource: ResourceId; count: number }
  | { kind: 'item'; req: number; from: HikerId; uid: string }
  | { kind: 'caps'; req: number; count: number }
  | { kind: 'stat'; req: number; from: HikerId; stat: StatName; count: number };

/** What the party decided for one section of the pop-up. */
export interface ChallengeSection {
  /** The hiker this section judges; left out on a party challenge. */
  hikerId?: HikerId;
  /** Pay the cost, or take the penalty. */
  pay: boolean;
  /** Which cost option ("or" alternative) was paid. */
  option?: number;
  gifts: Gift[];
}

/** What a section paid, for the trail log. */
export interface ChallengePaid {
  resources: ResourceId[];
  items: ItemId[];
  caps: number;
  stats: Partial<Record<StatName, number>>;
}

/**
 * A Trial in progress (04-challenges.md, "Trials"). Its goal is checked at the
 * end of every phase; meeting it early ends it, and missing the deadline
 * brings the penalty. At most BALANCE.challenges.maxTrials at once.
 */
export interface ActiveTrial {
  uid: string;
  cardId: string;
  tileId: TileId;
  /** The hikers it covers: those on the tile when it was revealed. */
  hikers: HikerId[];
  rolls: CardRolls;
  /** Phase numbers since the start of the hike: when it started, and the phase it's judged at the end of. */
  startedAt: number;
  endsAt: number;
  /** The row it was revealed on (Avalanche Warning), and each hiker's row then (Smoke on the Wind). */
  row: number;
  startRows: Record<HikerId, number>;
  /** A marked tile (Rocco's red tile). */
  targetTile?: TileId;
  /** A picked resource (Rocco's Resource Trial, Ranger's Request). */
  resource?: ResourceId;
  /** Hikers who've met their part of the goal (or reached Rocco's tile). */
  done: HikerId[];
  /** Hikers already penalized along the way (Jogger, The Grim Sleeper!). */
  penalized: HikerId[];
  /** Ranger's Request: how much of the resource each hiker has scavenged since it started. */
  gathered?: Record<HikerId, number>;
}

// ── Randomness ─────────────────────────────────────────────────────────────

/** sfc32 state: four unsigned 32-bit integers. */
export type RngState = [number, number, number, number];

// ── Actions ────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'move'; hikerId: HikerId; toTileId: TileId }
  | { type: 'moveAll'; hikerId: HikerId; toTileId: TileId; bring: HikerId[] }
  | { type: 'sleep'; hikerId: HikerId }
  /** Night only: keeps watch, so hikers on this tile are safe from tonight's night event. */
  | { type: 'keepWatch'; hikerId: HikerId }
  | { type: 'useAbility'; hikerId: HikerId; abilityId: string; choice?: string }
  /** Deals the scavenge cards, face down. Nothing is paid until a card is taken. */
  | { type: 'scavenge'; hikerId: HikerId }
  | { type: 'scavengeFlip'; cards: number[] }
  /** "Not now": only before any card is flipped. Costs nothing. */
  | { type: 'scavengeCancel' }
  /** Takes a card, with the exact resources (Choice cards) or item (Choice items) picked. */
  | {
      type: 'scavengeTake';
      card: number;
      picks?: ResourceId[];
      item?: ItemId;
      /** How many paid bonus resources to take (Copier). Free ones are always taken. */
      bonus?: number;
    }
  /** Rerolls one flipped card (Gambler's ability). */
  | { type: 'scavengeReroll'; card: number }
  /** Restores Abundance for a node on the hiker's tile (day only). */
  | { type: 'tend'; hikerId: HikerId; node: NodeType }
  /** A free action: hands one resource or bag item to a hiker on the same tile. */
  | { type: 'give'; fromId: HikerId; toId: HikerId; resource?: ResourceId; itemUid?: string }
  /** A free action: puts a resource back, +1 Abundance to its node. */
  | { type: 'returnToNature'; hikerId: HikerId; resource: ResourceId }
  /** Drop a bag item for good (a free action; Weak can leave a hiker with too many). */
  | { type: 'dropItem'; hikerId: HikerId; itemUid: string }
  | { type: 'endPhase' }
  /** Finishes the open challenge: every section's pay-or-penalty, and what was handed in. */
  | { type: 'resolveChallenge'; sections: ChallengeSection[] }
  /** On a Choice space: which of the two challenges the party takes on. */
  | { type: 'chooseChallenge'; cardId: string }
  /** "Got it": the open Trial starts its countdown. */
  | { type: 'acceptTrial' }
  /** A button on an opportunity (Snake Slots' Pull, Predator Bait…), which happens at once. */
  | { type: 'pressButton'; button: string; hikerId?: HikerId; choice?: string }
  /** Accomplish a Wonder: every hiker on its tile picks one reward. */
  | { type: 'accomplishWonder'; tileId: TileId; picks: Record<HikerId, WonderPick> }
  /** Dev tools for playtesting (the backtick debug panel). Not part of the rules. */
  | { type: 'debug'; op: DebugOp };

export type DebugOp =
  /** Jumps straight to a phase on the same day, skipping any drains. */
  | { kind: 'skipToPhase'; phase: Phase }
  /** Reveals every node on the map. */
  | { kind: 'revealMap' }
  /** Adds resources to a hiker, up to the resource limit. */
  | { kind: 'giveResources'; hikerId: HikerId; resources: Partial<Record<ResourceId, number>> }
  /** Sets a hiker's stats and injuries directly, without the usual injury rules. */
  | { kind: 'setStats'; hikerId: HikerId; stats: Partial<Stats>; injuries?: number }
  /** Sets Abundance meters directly. */
  | { kind: 'setAbundance'; abundance: Partial<Record<NodeType, number>> }
  /** Puts a trait (or nothing) in one of a hiker's slots, whatever the slot type. */
  | { kind: 'setTrait'; hikerId: HikerId; slot: number; traitId: TraitId | null }
  /** The next scavenge deals these card types first, where they can happen. */
  | { kind: 'nextDeal'; types: ScavengeCardType[] }
  /** Gives a hiker a condition, by the usual rules (Wet again makes Soaked). */
  | {
      kind: 'addCondition';
      hikerId: HikerId;
      conditionId: ConditionId;
      remaining: number;
      unit: ConditionInstance['unit'];
    }
  /** Takes every condition off a hiker. */
  | { kind: 'clearConditions'; hikerId: HikerId }
  /** Opens a challenge on a tile, for the hikers there (replacing any open one). */
  | { kind: 'openChallenge'; cardId: string; tileId: TileId }
  /** Reveals a tile's card early, as Old Firewatch Tower does. */
  | { kind: 'revealCard'; tileId: TileId }
  /** Reveals this section's Wonder where it stands. */
  | { kind: 'revealWonder' }
  /** Puts every hiker who's still hiking on one tile (to test Wonder goals). */
  | { kind: 'gatherAt'; tileId: TileId }
  /** Picks and opens a card as if the tile were this special space. */
  | { kind: 'openSpace'; tileId: TileId; space: 'choice' | 'challenge' | 'opportunity' }
  /** Shows the rolled X and Y numbers in the challenge pop-up. */
  | { kind: 'showRolls'; on: boolean }
  /** Turns challenges off (landing on a new tile opens nothing) or back on. */
  | { kind: 'setChallenges'; on: boolean }
  /** The section's tier, for which challenges come up. */
  | { kind: 'setTier'; tier: 1 | 2 | 3 }
  /** Counts the section as snowy (Phase 11 makes this real). */
  | { kind: 'setSnowy'; on: boolean }
  /** The weather challenge gates check (Phase 6 makes this real). */
  /** Sets today's weather (it starts today), and whether it holds instead of changing. */
  | { kind: 'setWeather'; weather: WeatherId; hold?: boolean }
  /** Skips the grace day, so the weather's hiker effect starts now. */
  | { kind: 'skipGraceDay' }
  /** Turns a tile's first fitting node flooded, frozen or on fire. */
  | { kind: 'nodeState'; tileId: TileId; state: NodeWeatherState }
  /** Puts a clothing item on a hiker (equipping arrives in Phase 9). */
  | { kind: 'wearClothes'; hikerId: HikerId }
  /** Tonight's night event: force its tier, creature, and a hit on a hiker. Nothing set clears it. */
  | { kind: 'forceNight'; tier?: 1 | 2 | 3; creatureId?: string; hit?: HikerId }
  /** Runs tonight's night event now, as if it were camp. */
  | { kind: 'runNight' };

export type ActionType = Action['type'];

// ── Trail log ──────────────────────────────────────────────────────────────

export type GameEventBody =
  | {
      kind: 'move';
      hikerId: HikerId;
      from: TileId;
      to: TileId;
      brought: HikerId[];
      /** Nodes shown for the first time by entering the tile. */
      revealed?: NodeKind[];
    }
  | { kind: 'stat'; hikerId: HikerId; stat: StatName; from: number; to: number; cause: string }
  | { kind: 'injury'; hikerId: HikerId; injuries: number; cause: string }
  /** Injuries a card cured (Airlift): how many, and how many are left. */
  | { kind: 'healed'; hikerId: HikerId; healed: number; injuries: number; cause: string }
  | { kind: 'passedOut'; hikerId: HikerId }
  | { kind: 'sleep'; hikerId: HikerId }
  | {
      kind: 'scavenge';
      hikerId: HikerId;
      tileId: TileId;
      card: ScavengeCardType;
      resources: ResourceId[];
      caps?: number;
      items?: ItemId[];
      /** Resources that didn't fit (the hiker was nearly full). */
      left?: number;
      /** Bonus resources from traits (Copier, Copydog), included in resources. */
      bonus?: number;
      /** Butterfingers: the card slipped away and the hiker got nothing. */
      dropped?: true;
    }
  | { kind: 'ability'; hikerId: HikerId; abilityId: string; choice?: string }
  | { kind: 'tend'; hikerId: HikerId; node: NodeType; from: number; to: number }
  | { kind: 'give'; fromId: HikerId; toId: HikerId; resource?: ResourceId; itemId?: ItemId }
  | { kind: 'returned'; hikerId: HikerId; resource: ResourceId; node: NodeType }
  /** Overnight, nodes nobody scavenged recover. */
  | { kind: 'recovered'; nodes: NodeType[] }
  | { kind: 'phase'; day: number; phase: Phase }
  | {
      kind: 'condition';
      hikerId: HikerId;
      condition: ConditionId;
      remaining: number;
      unit: ConditionUnit;
      cause: string;
      /** A stacking condition's new count. */
      stacks?: number;
    }
  | { kind: 'conditionEnded'; hikerId: HikerId; condition: ConditionId }
  /** The weather changed at the start of a day. */
  | { kind: 'weatherChanged'; from: WeatherId; to: WeatherId; days: number }
  /** Weather changed nodes this phase: which tiles, and (fires) which tiles it spread to. */
  | { kind: 'nodesChanged'; state: NodeWeatherState; tiles: TileId[]; spread?: TileId[] }
  /** A hiker is keeping watch tonight. */
  | { kind: 'watch'; hikerId: HikerId }
  /** The night event (05-nights-and-weather.md): the creature, who it hit, and who was safe. */
  | {
      kind: 'nightEvent';
      tier: 1 | 2 | 3;
      creatureId: string;
      hits: NightHit[];
      /** Hikers who were safe: someone kept watch on their tile (`by`), or a shelter. */
      safe: { hikerId: HikerId; why: 'watch' | 'shelter'; by?: HikerId }[];
      /** The events from this id up to this one are what it did (the log folds them in). */
      from: number;
    }
  /** A condition made this action free (Motivated). */
  | { kind: 'freeAction'; hikerId: HikerId; cause: string }
  /** A hiker landed on a new tile and its challenge opened. */
  | { kind: 'challengeOpened'; cardId: string; tileId: TileId }
  /** A challenge was resolved: who passed, and what they paid. */
  | {
      kind: 'challenge';
      cardId: string;
      tileId: TileId;
      party: boolean;
      results: {
        hikerId?: HikerId;
        passed: boolean;
        paid?: ChallengePaid;
        xp?: number;
        /** A Risk challenge: the odds or amount, and whether it hit. */
        risk?: { kind: 'chance' | 'threshold' | 'loss' | 'chain'; value: number; hit: boolean };
        /** A Challenge space's reward. */
        reward?: SpaceReward;
      }[];
    }
  /** A card moved a hiker (swept, blown back, sent back, false trail markers). */
  | {
      kind: 'moved';
      hikerId: HikerId;
      from: TileId;
      to: TileId;
      how: 'swept' | 'back' | 'blown' | 'falseTrail' | 'tunnel' | 'chased';
      cause: string;
    }
  /** A Trial started, was met, ran out, ended, or a hiker earned part of it. */
  | {
      kind: 'trial';
      cardId: string;
      outcome: 'started' | 'passed' | 'failed' | 'ended' | 'reached' | 'paid';
      hikerIds?: HikerId[];
      /** Rocco: how many days it took. Ranger's Request: how many were taken, and the caps paid. */
      days?: number;
      taken?: number;
      caps?: number;
    }
  /** A tile's card was revealed early, and shows on the map. */
  | { kind: 'revealedCard'; tileId: TileId; cardId: string; cause: string }
  /** A Wonder was found: its 3 goals are picked. `cause` is how, if nobody landed there. */
  | { kind: 'wonderRevealed'; tileId: TileId; wonderId: string; cause?: string }
  /** A Wonder was accomplished, and who took which reward. */
  | {
      kind: 'wonderAccomplished';
      tileId: TileId;
      wonderId: string;
      picks: Record<HikerId, WonderPick>;
    }
  /** A button on an opportunity was pressed, and what came of it. */
  | {
      kind: 'pressed';
      cardId: string;
      button: string;
      hikerId?: HikerId;
      note: string;
      /** Predator Bait: the tile that got easier (shown in blue for a moment) and the harder one. */
      easier?: TileId;
      harder?: TileId;
    }
  /** On a Choice space, the party picked one challenge over the other. */
  | { kind: 'challengeChosen'; cardId: string; over: string }
  /** What a card gave: resources or items to a hiker, or caps to the purse. */
  | {
      kind: 'gained';
      hikerId?: HikerId;
      resources: ResourceId[];
      items: ItemId[];
      caps?: number;
      /** Resources that didn't fit in the hiker's pack and were left behind. */
      noRoom?: number;
      cause: string;
    }
  /** Resources, items or caps a challenge or night event took. */
  | {
      kind: 'lost';
      hikerId: HikerId;
      resources: ResourceId[];
      items: ItemId[];
      caps?: number;
      cause: string;
    }
  | { kind: 'debug'; note: string };

export type GameEvent = GameEventBody & { id: number; day: number; phase: Phase };

// ── The game ───────────────────────────────────────────────────────────────

export interface GameState {
  saveVersion: number;
  seed: number;
  rng: RngState;
  /** 1 on the first day. */
  day: number;
  phase: Phase;
  sectionIndex: number;
  section: Section;
  hikers: Hiker[];
  /** The party purse of acorn caps. */
  caps: number;
  /** Each node type's Abundance meter, 0 to BALANCE.abundance.max. */
  abundance: Record<NodeType, number>;
  /** Who scavenged where today. Cleared each morning. */
  scavengedToday: ScavengeRecord[];
  /** An open scavenge, waiting for a card to be taken. */
  scavenge?: PendingScavenge;
  /** Debug only: card types the next scavenge deals first. */
  debugDeal?: ScavengeCardType[];
  /** Challenges, Trials and opportunities already seen in this section (no repeats). */
  usedCards: string[];
  /** The challenge waiting on the party, if any. Nothing else can happen until it's done. */
  challenge?: OpenChallenge;
  /** Tiles landed on while a challenge was open (a hiker swept onto one): they open next. */
  challengeQueue?: QueuedReveal[];
  /** Debug only: show the rolled numbers in the challenge pop-up. */
  debugRolls?: true;
  /** Debug only: what tonight's night event will be. */
  debugNight?: { tier?: 1 | 2 | 3; creatureId?: string; hit?: HikerId };
  /** Tests only: no night event at camp (unless the debug panel forces one). */
  noNightEvents?: true;
  /** Debug and tests only: landing on a new tile opens no challenge. */
  noChallenges?: true;
  /** Run counters for Wonder goals. */
  counters: RunCounters;
  /** Trials in progress (at most BALANCE.challenges.maxTrials). */
  trials?: ActiveTrial[];
  /** The snowy, high part of the trail (Phase 11). Until then, a debug toggle. */
  snowy?: true;
  /** Today's weather, since when, and the days ahead (the forecast). */
  weather: WeatherState;
  nextEventId: number;
  /** The most recent events, oldest first. */
  log: GameEvent[];
}
