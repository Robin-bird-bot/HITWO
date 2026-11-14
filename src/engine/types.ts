/**
 * The shape of the whole game. Everything here is plain JSON data so a game
 * can be saved, loaded, replayed and compared in tests.
 */
import type { StationThemeId } from './station/types';
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
  revealedCard?: {
    cardId: string;
    tier: 1 | 2 | 3;
    scale: number;
    alternative?: string;
    /** Picked early by a scouting tool to know its kind, but not shown (Security Camera). */
    hidden?: true;
  };
  /** No card here: CHALLENGE_SHARE left it empty, or a Fire Flower burned it away. */
  quiet?: true;
  /** What scouting found out, shown on the map: a card or not, and maybe its kind and tier. */
  scan?: { has: boolean; kind?: 'challenge' | 'opportunity' | 'trial'; tier?: number };
  /** Shelters placed on this tile, by a hiker or Ruins. */
  shelters?: PlacedShelter[];
  /** Scavenging here gets extra Luck until a phase number (Hungry Animals). */
  luckBonus?: { amount: number; until: number; cause: string };
  /** This biome's Wonder (one per section). Its tile has no nodes and never draws a card. */
  wonder?: WonderState;
  /** Items working for everyone on this tile this phase (a Wheelbarrow). */
  boosts?: ItemBoost[];
  /** A Camping Lamp keeps watch here tonight. */
  lampTonight?: true;
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
  /**
   * Added during this phase (or, for days, during the camp step): its first
   * tick doesn't count.
   */
  fresh?: true;
  /** Stacking conditions (Shivering, Burning): how many. */
  stacks?: number;
  /** What its stat change actually moved, given back or taken back when it ends (Sleepy, Energized). */
  applied?: Partial<Record<StatName, number>>;
}

export type EquipSlot = 'body' | 'feet' | 'gear';

/** An item's effect that lasts a while after it's used (docs/design/03-items.md). */
export interface ItemBoost {
  itemId: ItemId;
  quality?: 1 | 2 | 3 | 4 | 5;
  /** Phases or nights left, counting this one. */
  remaining: number;
  unit: 'phases' | 'nights';
  /** What was picked when it was used (the Swiss Army Knife's resource). */
  choice?: string;
  /** Only works on this tile (a Supply Map). */
  tileId?: TileId;
  /** Gone after one scavenge on its tile (a Supply Map). */
  once?: true;
}

/** One item a hiker carries (docs/design/03-items.md). */
/**
 * A shelter standing on a tile (03-items.md, "Shelters"). It counts down its
 * nights at each camp step and is gone when they run out.
 */
export interface PlacedShelter {
  uid: string;
  itemId: ItemId;
  /** Nights left, counting tonight. */
  nightsLeft: number;
  /** Who placed it; none when Ruins built it. */
  by?: HikerId;
  /** Medic Tent: hikers it has already healed. */
  healed?: HikerId[];
}

export interface ItemInstance {
  uid: string;
  itemId: ItemId;
  /** Quality 1–5 for tools, food and clothes (3 when missing); none for shelters and trinkets. */
  quality?: 1 | 2 | 3 | 4 | 5;
  /** Tools: uses left. */
  usesLeft?: number;
  /** Food: bites left. */
  bitesLeft?: number;
  /** Clothes: days of durability left. */
  durability?: number;
  /** Food eaten one bite a day (Advent Calendar): the day of the last bite. */
  lastBiteDay?: number;
  /** Food: gives this much more (or less) Appetite (a challenge's −1, Meatball Soup's +1). */
  appetiteMod?: number;
  /** Made with a node, which its effect needs (Birkenstocks). */
  node?: NodeType;
  /** Clothes: a full durability above the usual (Fort Rock's reward, an Engineering Vest). */
  maxDurability?: number;
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
  /** A move their shoes gave them that doesn't use their action (Hiking Crocs, Work Boots). */
  freeMove?: { itemId: ItemId; day: number };
  /** Blueprints this hiker knows: crafted, taught or found. They leave if the hiker abandons. */
  blueprints?: ItemId[];
  /** The tier they craft each type at, when above BALANCE.items.craft.startTier (a workbench). */
  craftTier?: Partial<Record<ItemTypeName, number>>;
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
  /**
   * Passed out: camp steps left before they abandon the hike. It drops at each
   * camp step where no active hiker shares their tile.
   */
  countdown?: number;
  /** The passed-out hiker this hiker is carrying: they travel along on every move. */
  carrying?: HikerId;
  /** Items used for an effect that lasts a while (a Shovel this phase, Bear Spray for nights). */
  boosts?: ItemBoost[];
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

/**
 * Why a hiker was safe from a night event: someone kept watch, a shelter, a
 * Camping Lamp on or next to their tile, or an item of their own (Bear Spray).
 */
export interface NightSafe {
  hikerId: HikerId;
  why: 'watch' | 'shelter' | 'lamp' | 'item';
  by?: HikerId;
  item?: ItemId;
}

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
  /** Already taken, on a scavenge that keeps more than one card (a Sack). */
  taken?: true;
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

/** Item types (the same as ItemType in effects.ts, here for the state's shape). */
export type ItemTypeName = 'tool' | 'clothes' | 'food' | 'shelter' | 'trinket';

/** One resource in one space of a recipe, and who gives it. */
export interface PaidSlot {
  from: HikerId;
  resource: ResourceId;
}

/** A basic craft, paid for and dealt, waiting for the crafter to pick 1. */
export interface PendingCraft {
  hikerId: HikerId;
  type: ItemTypeName;
  options: { itemId: ItemId; quality?: 1 | 2 | 3 | 4 | 5 }[];
  /** Extra durability for clothes (Engineering Vest). */
  durability?: number;
  /** What was paid, for the log. */
  paid: PaidSlot[];
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
  /** A Sack: how many more cards can be kept after the first. */
  keeps?: number;
  /** Glasses: cards left to reroll in this scavenge. */
  rerolls?: number;
  /** Cards taken so far (with a Sack, the window stays open for the next). */
  took?: number;
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
  trial?: { targetTile?: TileId; resource?: ResourceId; itemType?: ItemTypeName };
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
  /** Items each hiker crafted, by type. Stays empty until Phase 8. */
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
  | { kind: 'stat'; req: number; from: HikerId; stat: StatName; count: number }
  /** Clothing durability, from an item the giver is wearing. */
  | { kind: 'durability'; req: number; from: HikerId; uid: string; count: number }
  /** Uses from a tool in the giver's bag. */
  | { kind: 'toolUse'; req: number; from: HikerId; uid: string; count: number };

/** What the party decided for one section of the pop-up. */
export interface ChallengeSection {
  /** The hiker this section judges; left out on a party challenge. */
  hikerId?: HikerId;
  /** Pay the cost, or take the penalty. */
  pay: boolean;
  /** A Harness turns the fail into a pass, for its durability (with `pay: false`). */
  harness?: true;
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
  /** Clothing durability and tool uses spent. */
  durability?: number;
  toolUses?: number;
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
  /** Rocco's Rebuilding Trial: the item type to craft. */
  itemType?: ItemTypeName;
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
  /**
   * The hiker leaves the party for good, taking everything they carry. Any
   * hiker, any time; the UI confirms it first.
   */
  | { type: 'abandon'; hikerId: HikerId }
  /** A free action: picks up a passed-out hiker on the same tile, to carry them along. */
  | { type: 'pickUp'; carrierId: HikerId; hikerId: HikerId }
  /** A free action: puts down the hiker being carried. */
  | { type: 'putDown'; carrierId: HikerId }
  /** A free action: puts on clothes from the bag (swapping out whatever is in that slot). */
  | { type: 'putOn'; hikerId: HikerId; itemUid: string }
  /**
   * A free action: takes clothes off into the bag. For a passed-out wearer,
   * `toId` is the active hiker on their tile who takes them.
   */
  | { type: 'takeOff'; hikerId: HikerId; slot: EquipSlot; toId?: HikerId }
  /** A free action: uses a bag item on a hiker on the same tile (the medical items). */
  /**
   * Use a bag item. `conditionId` is the condition to cure (Bandaid); `choice`
   * is whatever else the item asks for: a stat, a node, a resource or a
   * clothing item's uid.
   */
  | {
      type: 'useItem';
      hikerId: HikerId;
      itemUid: string;
      targetId: HikerId;
      conditionId?: string;
      choice?: string;
    }
  /** Eat one bite of a food in the bag (a free action). */
  | { type: 'eat'; hikerId: HikerId; itemUid: string }
  /** Place a shelter from the bag on the hiker's tile (a free action). */
  | { type: 'placeShelter'; hikerId: HikerId; itemUid: string }
  /**
   * Craft (uses the action): a basic recipe for a type (then pick 1 of the
   * cards dealt), or a known blueprint for exactly that item. `slots` says
   * who gives what for each space, in the recipe's order; left out, the game
   * fills them (the crafter's own first). `node` is for an item made with one
   * (Birkenstocks).
   */
  | {
      type: 'craft';
      hikerId: HikerId;
      itemType: ItemTypeName;
      blueprint?: ItemId;
      slots?: PaidSlot[];
      node?: NodeType;
    }
  /** Take one of the cards a basic craft dealt. */
  | { type: 'craftTake'; index: number; node?: NodeType }
  /** Teach a blueprint to a hiker on the same tile (a free action; the teacher pays Morale). */
  | { type: 'teach'; hikerId: HikerId; toId: HikerId; itemId: ItemId }
  /** Drop a bag item for good (a free action; Weak can leave a hiker with too many). */
  | { type: 'dropItem'; hikerId: HikerId; itemUid: string }
  /**
   * At a ranger station (free): buy something off the counter for the party
   * purse. `hikerId` takes it (an item, a bundle), learns it (a blueprint) or,
   * for the rejoin, comes back. Specials pick in the next section.
   */
  | {
      type: 'buy';
      offerId: string;
      hikerId: HikerId;
      /** Cement Mixer: the line to pave. Scout Report: the tiles to show. */
      pick?: { lineId?: string; tileIds?: TileId[] };
    }
  /** At a ranger station (free): sell a bag item, or some of one resource, to the shop. */
  | { type: 'sell'; hikerId: HikerId; itemUid?: string; resource?: ResourceId; count?: number }
  /** Leave the ranger station: the free night, then the next biome's Trailhead. */
  | { type: 'restAndGo' }
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
  /** Everyone still hiking onto a tile one move from the checkpoint. */
  | { kind: 'nearCheckpoint' }
  /** Pretend this is section N (0 is the first; the last checkpoint is the summit). */
  | { kind: 'sectionIndex'; index: number }
  /** The next station's theme. */
  | { kind: 'nextStationTheme'; themeId: StationThemeId }
  /** Everyone still hiking checks in now, and the station opens (with this theme, if given). */
  | { kind: 'openStation'; themeId?: StationThemeId }
  /** Roll the open station's stock, market and blueprints again. */
  | { kind: 'rerollStation' }
  /** Add an item to Rocco's used-or-lost log. */
  | { kind: 'noteGone'; itemId: ItemId; times?: number }
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
  /** Puts a clothing item on a hiker (equipping arrives in Phase 8). */
  | { kind: 'wearClothes'; hikerId: HikerId }
  /** Tonight's night event: force its tier, creature, and a hit on a hiker. Nothing set clears it. */
  | { kind: 'forceNight'; tier?: 1 | 2 | 3; creatureId?: string; hit?: HikerId }
  /** Runs tonight's night event now, as if it were camp. */
  | { kind: 'runNight' }
  /** Puts any item in a hiker's bag, even past the limit, at a Quality (or rolled). */
  | { kind: 'giveItem'; hikerId: HikerId; itemId: ItemId; quality?: 1 | 2 | 3 | 4 | 5 }
  /** Fills every item a hiker has back up: uses, bites and durability. */
  | { kind: 'refillItems'; hikerId: HikerId }
  /** Sets a passed-out hiker's countdown (nights before they abandon if left alone). */
  | { kind: 'setCountdown'; hikerId: HikerId; nights: number }
  /** Sets the tier a hiker crafts one type at (the workbench does this in Phase 9). */
  | { kind: 'setCraftTier'; hikerId: HikerId; itemType: ItemTypeName; tier: number }
  /** Teaches a hiker a blueprint, for free. */
  | { kind: 'learnBlueprint'; hikerId: HikerId; itemId: ItemId };

export type ActionType = Action['type'];

// ── Trail log ──────────────────────────────────────────────────────────────

export type GameEventBody =
  | {
      kind: 'move';
      hikerId: HikerId;
      from: TileId;
      to: TileId;
      brought: HikerId[];
      /** Passed-out hikers carried along. */
      carried?: HikerId[];
      /** Nodes shown for the first time by entering the tile. */
      revealed?: NodeKind[];
    }
  | { kind: 'stat'; hikerId: HikerId; stat: StatName; from: number; to: number; cause: string }
  | { kind: 'injury'; hikerId: HikerId; injuries: number; cause: string }
  /** Injuries a card cured (Airlift): how many, and how many are left. */
  | { kind: 'healed'; hikerId: HikerId; healed: number; injuries: number; cause: string }
  /** The 3rd injury: the hiker passed out, with this many nights before they abandon if left alone. */
  | { kind: 'passedOut'; hikerId: HikerId; countdown: number }
  /** An item is gone: clothes worn out, a tool used up, food eaten. */
  | {
      kind: 'itemGone';
      hikerId: HikerId;
      itemId: ItemId;
      why: 'worn' | 'used' | 'eaten' | 'broke';
      cause: string;
    }
  /** A hiker put clothes on or took them off (`by`: someone took them off a passed-out hiker). */
  | { kind: 'dressed'; hikerId: HikerId; itemId: ItemId; on: boolean; by?: HikerId }
  /** A hiker used an item on someone on their tile (or themselves); it's used up. */
  | {
      kind: 'used';
      hikerId: HikerId;
      targetId: HikerId;
      itemId: ItemId;
      /** Used for everyone on the tile (Ukulele, Healing Spray). */
      everyone?: true;
      /** What it did, when the stats and conditions don't say (Fertilizer: "Forest Abundance +2"). */
      detail?: string;
    }
  /** A shelter went up on a tile: placed by a hiker, or built by Ruins. */
  | { kind: 'shelterPlaced'; tileId: TileId; itemId: ItemId; nights: number; hikerId?: HikerId }
  /** A shelter's last night is over. */
  | { kind: 'shelterGone'; tileId: TileId; itemId: ItemId }
  /** A hiker crafted an item, from a basic recipe or a blueprint. */
  | {
      kind: 'crafted';
      hikerId: HikerId;
      itemId: ItemId;
      quality?: number;
      blueprint: boolean;
      /** They learned its blueprint just now. */
      learned?: true;
      paid: PaidSlot[];
    }
  /**
   * A scouting tool counted the cards on tiles (Minesweeper around the hiker,
   * Linescan along a row), or swept tiles (Scanner, Radar Scanner).
   */
  | {
      kind: 'scouted';
      hikerId: HikerId;
      itemId: ItemId;
      tileIds: TileId[];
      counts?: { challenge: number; opportunity: number; trial: number };
      row?: number;
    }
  /** A hiker found a blueprint (Abandoned Ranger Station). */
  | { kind: 'blueprintFound'; hikerId: HikerId; itemId: ItemId; cause: string }
  /** A hiker taught another a blueprint, for Morale. */
  | { kind: 'taught'; hikerId: HikerId; toId: HikerId; itemId: ItemId; morale: number }
  /** A hiker ate a bite of food; bitesLeft is what's left after it. */
  | { kind: 'ate'; hikerId: HikerId; itemId: ItemId; bitesLeft: number }
  /** Costco Sample: the bite wasn't used up. */
  | { kind: 'biteKept'; hikerId: HikerId; itemId: ItemId }
  /**
   * Carrying: picked up, put down, or dropped (the carrier passed out or a
   * card moved one of them).
   */
  | { kind: 'carry'; carrierId: HikerId; hikerId: HikerId; how: 'pickedUp' | 'putDown' | 'dropped' }
  /** A passed-out hiker came to (an injury was cured). */
  | { kind: 'woke'; hikerId: HikerId; cause: string }
  /** A passed-out hiker spent a night with no active hiker beside them. */
  | { kind: 'countdown'; hikerId: HikerId; left: number }
  /** A hiker left the party: their countdown ran out, or the player chose it. */
  | { kind: 'abandoned'; hikerId: HikerId; why: 'countdown' | 'choice' | 'leftBehind' }
  /** No hiker can act any more. */
  | { kind: 'hikeOver'; day: number }
  /** Hikers checked in at the checkpoint (a carried one too), and the XP each gained. */
  | { kind: 'checkedIn'; hikerIds: HikerId[]; xp: number }
  /** Everyone is in: the ranger station at this checkpoint (1, 2…) opens. */
  | { kind: 'stationOpened'; checkpoint: number }
  /** The last checkpoint: the party reached the summit. */
  | { kind: 'summit' }
  /** Bought at a station: an item, bundle or blueprint (for a hiker), or a special. */
  | {
      kind: 'bought';
      hikerId?: HikerId;
      price: number;
      itemId?: ItemId;
      blueprint?: ItemId;
      resource?: ResourceId;
      count?: number;
      special?: StationSpecialId;
      /** A face-down card turned over (Random Resale). */
      mystery?: true;
    }
  /** Sold at a station. */
  | {
      kind: 'sold';
      hikerId: HikerId;
      caps: number;
      itemId?: ItemId;
      resource?: ResourceId;
      count?: number;
    }
  /** An abandoned hiker came back (the station's rejoin). */
  | { kind: 'rejoined'; hikerId: HikerId; price: number }
  /** The free night at the station, and the next section starts. */
  | { kind: 'nextSection'; biome: BiomeId; section: number }
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
  | {
      kind: 'give';
      fromId: HikerId;
      toId: HikerId;
      resource?: ResourceId;
      itemId?: ItemId;
      /** Taken from a passed-out hiker, rather than given. */
      taken?: true;
    }
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
      safe: NightSafe[];
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
        /** Passed thanks to a Harness. */
        harness?: true;
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

/** A hiker reaching a checkpoint (Phase 12 scores healthy, injured and carried arrivals). */
export interface Arrival {
  /** The section it ended (0 is the first). */
  section: number;
  hikerId: HikerId;
  injuries: number;
  carried: boolean;
}

/** Something on a station's counter. */
interface Offer {
  /** 'item-0', 'blueprint-1', 'bundle-0', 'special'. */
  id: string;
  /** In caps, from the party purse. */
  price: number;
  sold?: true;
  /** Face-down until bought (Rocco's Random Resale): the UI shows only the tier. */
  hidden?: true;
}

export interface ItemOffer extends Offer {
  kind: 'item';
  /** Rolled when the shop is stocked (a fresh copy, full uses, bites or durability). */
  item: ItemInstance;
}

export interface BlueprintOffer extends Offer {
  kind: 'blueprint';
  itemId: ItemId;
}

/** A resource bundle (3 of one resource), or at the Random Resale sometimes a resource pack. */
export interface BundleOffer extends Offer {
  kind: 'bundle';
  resource?: ResourceId;
  count?: number;
  item?: ItemInstance;
}

/** The shared specials: one random per visit. */
export type StationSpecialId = 'cementMixer' | 'scoutReport';

export interface SpecialOffer extends Offer {
  kind: 'special';
  special: StationSpecialId;
}

/** The ranger station at a checkpoint (Phase 9; docs/design/06-ranger-stations.md). */
export interface StationVisit {
  /** 1 at the first checkpoint. */
  checkpoint: number;
  themeId: StationThemeId;
  items: ItemOffer[];
  blueprints: BlueprintOffer[];
  bundles: BundleOffer[];
  special?: SpecialOffer;
  /** This visit's market: these sell for ×2, these for ×½. */
  market: { high: ResourceId[]; low: ResourceId[] };
  /** Free at the Workbench for this visit; kept only by crafting the item here. */
  tempBlueprints: ItemId[];
  /** This station's rejoin was used (one per station). */
  rejoined?: true;
  /** The next section, made now so Preview Next Trail can show it. */
  next: Section;
  /** Scout Report: the cards on these tiles of the next section are shown when it starts. */
  scout?: TileId[];
}

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
  /** The ranger station visit, once everyone has checked in. */
  station?: StationVisit;
  /** Every check-in so far, for the score (Phase 12). */
  arrivals?: Arrival[];
  /** The party reached the summit: the hike is over. */
  summit?: true;
  /** Station themes already used this run (none repeats). */
  stationThemes?: StationThemeId[];
  /**
   * Items the party used up or lost this run, and how often (Rocco's
   * "Borrowed" Boutique). Selling doesn't count.
   */
  usedOrLost?: Record<ItemId, number>;
  /** Abandoned hikers brought back so far this run. */
  rejoinsUsed?: number;
  /** Wonders already used this run, so each biome gets a new one. */
  usedWonders?: string[];
  /** Debug: the next station's theme. */
  debugNextTheme?: StationThemeId;
  /** The party purse of acorn caps. */
  caps: number;
  /** Added to every caps gain for good (each Wallet used: +1). */
  capsBonus?: number;
  /** Each node type's Abundance meter, 0 to BALANCE.abundance.max. */
  abundance: Record<NodeType, number>;
  /** Who scavenged where today. Cleared each morning. */
  scavengedToday: ScavengeRecord[];
  /** An open scavenge, waiting for a card to be taken. */
  scavenge?: PendingScavenge;
  /** A basic craft waiting for its pick. Everything else waits for it too. */
  crafting?: PendingCraft;
  /** The trinket recipe's random different resources, longest first; a new set after each trinket. */
  trinketRecipe?: ResourceId[];
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
  /** Counts items made, so every item's uid is unique. */
  itemSerial?: number;
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
