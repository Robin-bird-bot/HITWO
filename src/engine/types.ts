/**
 * The shape of the whole game. Everything here is plain JSON data so a game
 * can be saved, loaded, replayed and compared in tests.
 */

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

export interface TileNode {
  type: NodeKind;
  /** Shown on the map. Hidden nodes show as ? until a hiker enters or scouts the tile. */
  revealed: boolean;
  /** A Bounty node: extra resources are more likely, at an extra Abundance cost. */
  bounty?: true;
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

/** A timed condition on a hiker (Phase 6). */
export interface ConditionInstance {
  id: ConditionId;
  remaining: number;
  unit: 'days' | 'phases';
}

export type EquipSlot = 'body' | 'feet' | 'gear';

/** One item a hiker carries (Phase 9 fills in the details). */
export interface ItemInstance {
  uid: string;
  itemId: ItemId;
  quality?: number;
  usesLeft?: number;
  daysLeft?: number;
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
  abilityUses: Record<string, AbilityUse>;
  xp: number;
  level: number;
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
}

/** Who scavenged where today (Copier, Copydog, and the night's Abundance recovery). */
export interface ScavengeRecord {
  hikerId: HikerId;
  tileId: TileId;
  nodes: NodeType[];
}

// ── Randomness ─────────────────────────────────────────────────────────────

/** sfc32 state: four unsigned 32-bit integers. */
export type RngState = [number, number, number, number];

// ── Actions ────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'move'; hikerId: HikerId; toTileId: TileId }
  | { type: 'moveAll'; hikerId: HikerId; toTileId: TileId; bring: HikerId[] }
  | { type: 'sleep'; hikerId: HikerId }
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
  | { type: 'endPhase' }
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
  | { kind: 'nextDeal'; types: ScavengeCardType[] };

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
    }
  | { kind: 'ability'; hikerId: HikerId; abilityId: string; choice?: string }
  | { kind: 'tend'; hikerId: HikerId; node: NodeType; from: number; to: number }
  | { kind: 'give'; fromId: HikerId; toId: HikerId; resource?: ResourceId; itemId?: ItemId }
  | { kind: 'returned'; hikerId: HikerId; resource: ResourceId; node: NodeType }
  /** Overnight, nodes nobody scavenged recover. */
  | { kind: 'recovered'; nodes: NodeType[] }
  | { kind: 'phase'; day: number; phase: Phase }
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
  nextEventId: number;
  /** The most recent events, oldest first. */
  log: GameEvent[];
}
