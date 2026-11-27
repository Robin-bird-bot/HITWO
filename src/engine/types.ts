/**
 * The shape of the whole game. Everything here is plain JSON data so a game
 * can be saved, loaded, replayed and compared in tests.
 */
import type { DifficultyId } from '../config/difficulty';
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

/**
 * What weather did to a node (Phase 6). Weather no longer changes nodes
 * (Phase 10.6); this stays for old trail log lines.
 */
export type NodeWeatherState = 'flooded' | 'frozen' | 'fire';

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
  /** A side feature's wares, rolled the first time someone stands here (Phase 9). */
  shop?: TrailShop;
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
    /** The tier it shows (I to V; above III, a Tier III card scaled up). Older saves: `tier`. */
    shownTier?: number;
    alternative?: string;
    /** Picked early by a scouting tool to know its kind, but not shown (Security Camera); placed with the pool. */
    hidden?: true;
    /** A minigame challenge's version, picked by the tile (24-challenges-reset.md, section 4). */
    version?: number;
  };
  /** No card here: a quiet tile (Phase 10.6 difficulty), or a Fire Flower burned it away. */
  quiet?: true;
  /** A plain tile that holds an opportunity, not a challenge (Phase 10.6 difficulty). */
  opportunity?: true;
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
  /**
   * The first hiker to cross it, either way, and never changed after (Phase
   * 10.5): its path takes their party color. A Move All counts its mover.
   */
  walkedBy?: HikerId;
}

export interface Section {
  biome: BiomeId;
  tier: number;
  tiles: Record<TileId, Tile>;
  lines: Line[];
  trailheadId: TileId;
  checkpointId: TileId;
  /**
   * The biome's challenge pool, placed on its tiles when the section is made
   * (25-challenges-on-the-map.md, section 1). Missing on sections made before.
   */
  pool?: string[];
  /** The Trail Infoboard: posters pinned face up, and tiles found with WHERE IS IT? (section 2). */
  infoboard?: { faceUp: string[]; found: TileId[] };
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

/** Storm and Fog are gone for now; Wind is new (Phase 10.6). */
export type WeatherId = 'clear' | 'rain' | 'snow' | 'wind' | 'heatwave';

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

/** Plush (Nov 20 update): stuffed animals that aren't quite real (07-characters.md). */
export type Family = 'human' | 'dog' | 'cat' | 'plush';
export const FAMILY_IDS: readonly Family[] = ['human', 'dog', 'cat', 'plush'];
export type HikerStatus = 'active' | 'passedOut' | 'abandoned' | 'checkedIn';

/** Trail, Utility or Morale. */
export type TraitType = 'T' | 'U' | 'M';
/**
 * What a slot holds: one type, either of two, any (W), or a Duo's Tag Team
 * trait (`tag`), which only a Tag Team trait fits.
 */
/**
 * `trail`: a learned Skill Trails trait (Phase 10.7). A designed hiker has no
 * slots to fill: their `slots` list what their trees give them, kept in step
 * with `trails` by src/engine/trails.ts. Nothing can be put in one by hand.
 */
export type SlotType = TraitType | 'T/U' | 'T/M' | 'U/M' | 'W' | 'tag' | 'trail';
export const SLOT_TYPES: readonly SlotType[] = ['T', 'U', 'M', 'T/U', 'T/M', 'U/M', 'W', 'tag'];

/**
 * What a character is good at (09-hikers.md, "Names and classes"; Phase 10.7).
 * A designed hiker's classes are their 3 trees' classes, in tree order. Tank
 * is now Leader, Guardian is Watcher and Moneymaker is Merchant.
 */
export type ClassId =
  | 'leader'
  | 'follower'
  | 'scout'
  | 'trekker'
  | 'scavenger'
  | 'crafter'
  | 'chef'
  | 'smith'
  | 'tailor'
  | 'architect'
  | 'packer'
  | 'naturalist'
  | 'merchant'
  | 'support'
  | 'entertainer'
  | 'hardy'
  | 'watcher'
  | 'daredevil'
  | 'jack';
/** In area order: Movement, Resources, Utility. */
export const CLASS_IDS: readonly ClassId[] = [
  'leader',
  'follower',
  'scout',
  'trekker',
  'scavenger',
  'crafter',
  'chef',
  'smith',
  'tailor',
  'architect',
  'packer',
  'naturalist',
  'merchant',
  'support',
  'entertainer',
  'hardy',
  'watcher',
  'daredevil',
  'jack',
];

/**
 * Morale types (09-hikers.md; Phase 10.7): one per hiker, checked at the end
 * of every phase for +1, −1 or nothing. They replace the Morale traits.
 */
export type MoraleTypeId =
  'extrovert' | 'introvert' | 'ambivert' | 'foody' | 'energetic' | 'wanderlust' | 'homebody';
export const MORALE_TYPE_IDS: readonly MoraleTypeId[] = [
  'extrovert',
  'introvert',
  'ambivert',
  'foody',
  'energetic',
  'wanderlust',
  'homebody',
];

/** A class's area: what its tree is named for (Leader Trail, Merchant Path, Daredevil Loop). */
export type ClassArea = 'movement' | 'resources' | 'utility';
export const CLASS_AREAS: readonly ClassArea[] = ['movement', 'resources', 'utility'];

/**
 * A trait's setting, stored with it on the hiker: a node ([Node] Finder,
 * Conservationist [X]), two nodes (Location [X/Y]), or one or two actions
 * (Traveler [X], Action [X/Y]).
 */
export interface TraitSetting {
  x?: string;
  y?: string;
}

export interface TraitSlot {
  type: SlotType;
  traitId: TraitId | null;
  /** The trait's setting, when it has one. */
  setting?: TraitSetting;
  /**
   * Today's pick, for a trait that changes each morning: the trait Quirky or
   * Zany is today, Nosework's node, Moody's condition. Only counts on `day`.
   */
  daily?: { day: number; pick: string };
}

/**
 * Where XP comes from (01-design-doc.md, "XP"). Craft, scavenge and fire are
 * action XP, under the row rule; the rest are milestones. `trait` is XP a
 * trait gives (Storyteller); `shared` is XP passed on (Wise, VR Headset),
 * which nothing adds to or passes on again.
 */
export type XpSource =
  | 'checkpoint'
  | 'objective'
  | 'challenge'
  | 'reward'
  | 'wonder'
  | 'item'
  | 'trait'
  | 'craft'
  | 'scavenge'
  | 'fire'
  | 'shared'
  | 'debug';

/** One choice in a trait pick: a trait (with its setting, if it has one) or a new empty slot. */
export type TraitOption =
  { kind: 'trait'; traitId: TraitId; setting?: TraitSetting } | { kind: 'slot'; slot: SlotType };

/**
 * A trait pick waiting for the player, rolled with the seeded RNG so a reload
 * shows the same choices: a level-up's offer (opened at the camp step, or
 * from the debug panel), or an Old Photo's 3 traits for one slot.
 */
export interface TraitPick {
  hikerId: HikerId;
  source: 'levelUp' | 'oldPhoto';
  /** The level being reached (a level-up). */
  level?: number;
  options: TraitOption[];
  /** Old Photo: the slot whose trait the pick replaces. */
  slot?: number;
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
 * A shelter set up on a tile (Phase 10.6: carried and set up, not left
 * behind). While it's up it takes no pack slot, and everyone on the tile is
 * sheltered.
 */
export interface PlacedShelter {
  uid: string;
  itemId: ItemId;
  /** Times it can still be set up after this one. At 0 it's thrown away when packed. */
  deploymentsLeft: number;
  /** Who set it up; none when Ruins built it. It packs itself when they leave. */
  by?: HikerId;
  /** The pack item it came from, so packing it gives the same card back. */
  itemUid?: string;
  /** Medic Tent: hikers it has already healed, this time it's up. */
  healed?: HikerId[];
}

export interface ItemInstance {
  uid: string;
  itemId: ItemId;
  /** Quality 1–5 for tools, food and clothes (3 when missing); none for shelters and trinkets. */
  quality?: 1 | 2 | 3 | 4 | 5;
  /** Tools: uses left. */
  usesLeft?: number;
  /** Tools: carries The Proper Way's extra use (counted in usesLeft), lost when it leaves that pack. */
  extraUse?: true;
  /** Food: bites left. */
  bitesLeft?: number;
  /** Shelters (Phase 10.6): times it can still be set up (full when missing). */
  deploymentsLeft?: number;
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
  /** Clothes a Stylish hiker has put on: their extra days were given (once per item). */
  styled?: true;
  /** A Present's wrapping (1–5), picked at random when it's wrapped (holiday hikers). */
  colorway?: number;
  /** A Present: who wrapped it (Season of Giving). None for a starting bag's. */
  wrappedBy?: HikerId;
  /** A Present: what's inside, set by the recipe it was wrapped with. */
  grade?: PresentGrade;
}

/**
 * A Present's grade (03-items.md, "Presents"): a plain one holds Tier 1–3, a
 * Tier 2+ one Tier 2 or 3, a Tier 3 one Tier 3.
 */
export type PresentGrade = 'plain' | 'tier2plus' | 'tier3';
export const PRESENT_GRADES: readonly PresentGrade[] = ['plain', 'tier2plus', 'tier3'];

/** Gift Wrapper's four recipes (07-characters.md, Grammy Clause). */
export type PresentRecipe = 'sameResource' | 'sameType' | 'smallWish' | 'bigWish';
export const PRESENT_RECIPES: readonly PresentRecipe[] = [
  'sameResource',
  'sameType',
  'smallWish',
  'bigWish',
];

/** Grammy's two wish lists: specific resources, repeats allowed, rolled from all 16. */
export interface WishLists {
  small: ResourceId[];
  big: ResourceId[];
}

/** A Present opened by a hiker who picks 1 of several (Choosy), waiting for the pick. */
export interface PresentPick {
  hikerId: HikerId;
  /** The items rolled, Quality and all. The one picked goes in the bag. */
  options: ItemInstance[];
  grade: PresentGrade;
  wrappedBy?: HikerId;
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
  /** Their party color, from their spot when the run started (Phase 10b). */
  color?: string;
  placeholder?: boolean;
  /** Their classes: which Trail and Utility traits level-ups offer them. */
  classes: ClassId[];
  /** Who they are, for special and unique traits that belong to certain characters. */
  characterId?: string;
  /** A dev-only test hiker (no art). Never in the real roster. */
  test?: true;
  /** A Duo: the two characters sharing this hiker card (Boss & Gracie). */
  duo?: readonly [string, string];
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
  /**
   * Skill Trails (Phase 10.7): the steps learned, in order, and the toggles
   * switched off (by trait id; every toggle starts on). Only the designed
   * hikers have it.
   */
  trails?: { learned: string[]; off?: string[] };
  /** Their morale type, checked at the end of every phase (Phase 10.7). */
  moraleType?: MoraleTypeId;
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
  /** XP this hiker earned. Since Phase 10.7 it all goes into the party bar too. */
  xp: number;
  /** The old system's levels (before Phase 10.7). Hikers no longer level up on their own. */
  level: number;
  /** Levels reached that still wait for the camp step to be picked. */
  pendingLevels?: number;
  /**
   * The XP row rule: the furthest row reached in this section, and the day
   * they first got there. Action XP only counts on that row, that day.
   */
  xpRow?: { section: number; row: number; day: number };
  /** Permanent raises to a stat's maximum (Sleeping Giant's +2 maximum Energy). */
  maxBonus?: Partial<Record<StatName, number>>;
  /** The last day they moved (Wanderlust: "didn't move the day before"). */
  lastMovedDay?: number;
  /** The last day they faced a challenge (Thrill-Seeker: "facing no challenge the day before"). */
  lastChallengeDay?: number;
  /** Gift Wrapper: the two wish lists, rolled at the start of the run and after every Present. */
  wishLists?: WishLists;
  /** The last day they wrapped a Present (Season of Giving). */
  lastWrapDay?: number;
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
  | 'choiceTrinket'
  /** Item cards (Nov 14 update): the real item, Quality rolled, face up when flipped. */
  | 'toolCard'
  | 'foodCard'
  | 'clothesCard'
  | 'shelterCard'
  | 'trinketCard';

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
   * The node the card came from (its art and resources); taking it drains the
   * biome's Abundance. Null only on a tile with nothing but Cap nodes.
   */
  node: NodeType | null;
  /** A resource card that came up Empty (low Abundance): it gives nothing. */
  empty?: true;
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
  /** An item card's Quality, rolled when it was dealt (the plain curve); kept as it is. */
  itemQuality?: 1 | 2 | 3 | 4 | 5;
  flipped: boolean;
  /** Already taken, on a scavenge that keeps more than one card (a Sack). */
  taken?: true;
  /** Turned into the weather's node's resources by the weather (Phase 10.6): shows its icon. */
  weather?: WeatherId;
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
/** The types a recipe can make (a Present is wrapped, not crafted: `wrapPresent`). */
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
  /** Food: Appetite added to every bite (Garbage Connoisseur's swaps; Phase 10.7). */
  biteMod?: number;
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
  /** The phase it was in (Copydog's "earlier this phase"; Phase 10.7). Older records have none. */
  phase?: Phase;
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
  /** The hiker who led the group onto the tile, if a Move All did (Alpha Dog). */
  leaderId?: HikerId;
  /** The tier it plays at, and its range scale (Tier III one tier up: ×1.5). */
  tier: 1 | 2 | 3;
  scale: number;
  /** The tier it shows (I to V; above III, a Tier III card scaled up). Older saves: `tier`. */
  shownTier?: number;
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
  /** A minigame challenge's version, picked by the tile (24-challenges-reset.md, section 4). */
  version?: number;
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
  /**
   * Food crafted, and its Appetite over all its bites (an estimate), for the
   * debug panel's stats (Phase 10.6 tuning). Missing in older saves.
   */
  foodCrafted?: { count: number; appetite: number };
}

/** A tile a hiker landed on while a challenge was open: it opens next. */
export interface QueuedReveal {
  tileId: TileId;
  hikerIds: HikerId[];
  /** A card's effect starts a challenge of this tier and node (Bear Country). */
  forced?: { tier: 1 | 2 | 3; node: NodeType };
  /** The hiker who led the group onto the tile (Alpha Dog). */
  leaderId?: HikerId;
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
  /** Overfished: the biome's Abundance when it started (it has to rise from here). */
  startAbundance?: number;
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
  /** Skill Trails (free): learn a step for party points, at night or at a ranger station. */
  | { type: 'learnStep'; hikerId: HikerId; stepId: string }
  /** Switch a toggle trait on or off (free, on the hiker's turn; Leash Puller). */
  | { type: 'toggleTrait'; hikerId: HikerId; traitId: TraitId }
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
  /** Raises the biome's Abundance from a tile with a resource node (day only). */
  | { type: 'tend'; hikerId: HikerId }
  /** A free action: hands one resource or bag item to a hiker on the same tile. */
  | { type: 'give'; fromId: HikerId; toId: HikerId; resource?: ResourceId; itemUid?: string }
  /** A free action: puts a resource back, +1 Abundance. */
  | { type: 'returnToNature'; hikerId: HikerId; resource: ResourceId }
  /**
   * Tactical: reveals the nodes and card of a tile the hiker picks, for the
   * rest of the biome. No tile skips it.
   */
  | { type: 'tactical'; hikerId: HikerId; tileId?: TileId }
  /**
   * The hiker leaves the party for good, taking everything they carry. Any
   * hiker, any time; the UI confirms it first.
   */
  | { type: 'abandon'; hikerId: HikerId }
  /**
   * A free action: the hiker takes an injury on purpose, raising every stat
   * below the line back up to it (a way out when stuck). The UI confirms it.
   */
  | { type: 'submitToInjury'; hikerId: HikerId }
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
  /**
   * Eat a bite: from the hiker's own pack, or (`fromHikerId`) a camp meal in
   * another hiker's pack on the same tile (Rotisserie Chicken, Phase 10.6).
   */
  | { type: 'eat'; hikerId: HikerId; itemUid: string; fromHikerId?: HikerId }
  /** Place a shelter from the bag on the hiker's tile (a free action). */
  /** Set up a shelter from the pack on this hiker's tile (Phase 10.6). */
  | { type: 'setUpShelter'; hikerId: HikerId; itemUid: string }
  /** Pack up the shelter on this hiker's tile into their pack (Phase 10.6). */
  | { type: 'packUpShelter'; hikerId: HikerId }
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
  /**
   * Gift Wrapper (uses the action, like crafting): wrap a Present with one of
   * the four recipes. `slots` says who gives what, as for a craft; left out,
   * the game fills them. `resource` or `node` picks which one for the plain
   * recipes (3 of one resource, 5 of one node).
   */
  | {
      type: 'wrapPresent';
      hikerId: HikerId;
      recipe: PresentRecipe;
      slots?: PaidSlot[];
      resource?: ResourceId;
      node?: NodeType;
    }
  /** Open a Present in the hiker's own bag: their action and 1 Energy, for a random item. */
  | { type: 'openPresent'; hikerId: HikerId; itemUid: string }
  /** Choosy: keep one of the items a Present held. */
  | { type: 'presentTake'; index: number }
  /**
   * The illustrated map painted a named place for the first time (Phase 10.5):
   * the trail log says "Found …". Only a look: it changes nothing else.
   */
  | { type: 'foundPlace'; name: string }
  /**
   * Takes one option of the open trait pick (a level-up or an Old Photo). A
   * trait with no empty slot that fits replaces the trait in `replaceSlot`.
   */
  /** `keep`: a level-up taken with no new trait (KEEP MY TRAITS); the level still counts. */
  | { type: 'pickTrait'; option: number; replaceSlot?: number; keep?: true }
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
  /** A trail Merchant (free): buy one of their cards for the purse; `hikerId` takes it. */
  | { type: 'merchantBuy'; hikerId: HikerId; offerId: string }
  /** A Traveling Trader (free): give them an item of the type they want for theirs. */
  | { type: 'trade'; hikerId: HikerId; itemUid: string }
  /** Leave the ranger station: the free night, then the next biome's Trailhead. */
  | { type: 'restAndGo' }
  | { type: 'endPhase' }
  /** Finishes the open challenge: every section's pay-or-penalty, and what was handed in. */
  | { type: 'resolveChallenge'; sections: ChallengeSection[] }
  /** Finishes a minigame challenge (25-challenges-on-the-map.md, section 3): how it went, and what Prepare spent. */
  | import('./challenges/minigame').ResolveMinigameAction
  /** The Trail Infoboard's tip boxes (25-challenges-on-the-map.md, section 2). */
  | import('./challenges/infoboard').InfoboardAction
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
  /** Sets the Abundance bar directly. */
  | { kind: 'setAbundance'; abundance: number }
  /** Puts a trait (or nothing) in one of a hiker's slots, whatever the slot type, with its setting. */
  | {
      kind: 'setTrait';
      hikerId: HikerId;
      slot: number;
      traitId: TraitId | null;
      setting?: TraitSetting;
    }
  /** Adds a slot of any type (up to the most a hiker can have). */
  | { kind: 'addSlot'; hikerId: HikerId; slotType: SlotType }
  /** Takes a slot away, with its trait. */
  | { kind: 'removeSlot'; hikerId: HikerId; slot: number }
  /** Every usable trait and once-a-while rule of this hiker comes back now. */
  | { kind: 'refillUses'; hikerId: HikerId }
  /** XP and levels: sets them outright (no level-ups). */
  | { kind: 'setXp'; hikerId: HikerId; xp: number; level?: number }
  /** Skill Trails (Phase 10.7): party XP, a point, every step for a hiker, a morale type. */
  | { kind: 'partyXp'; xp: number }
  | { kind: 'partyPoints'; points: number }
  | { kind: 'learnAll'; hikerId: HikerId }
  | { kind: 'setMoraleType'; hikerId: HikerId; moraleType: MoraleTypeId }
  /** Opens a level-up for the hiker right now, with options of this tier. */
  | { kind: 'levelUpNow'; hikerId: HikerId; tier: 1 | 2 | 3 }
  /** Moves the day number to the next odd or even day (Tag Team), keeping the phase. */
  | { kind: 'setDayParity'; odd: boolean }
  /** Sets what a daily trait is today (Quirky, Zany, Nosework, Moody). */
  | { kind: 'setDaily'; hikerId: HikerId; slot: number; pick: string }
  /** The next scavenge deals these card types first, where they can happen. */
  | { kind: 'nextDeal'; types: ScavengeCardType[] }
  /** The edge test (Phase 10.6): open a scavenge or a craft with this many cards. */
  | { kind: 'edgeScavenge'; hikerId: HikerId; count: number }
  | { kind: 'edgeCraft'; hikerId: HikerId; count: number }
  /** The difficulty for the next section made (Phase 10.6). */
  | { kind: 'setDifficulty'; difficulty: DifficultyId }
  /** Add a shelter to a hiker's pack with this many deployments (Phase 10.6). */
  | { kind: 'addShelter'; hikerId: HikerId; itemId: ItemId; deployments: number }
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
  | {
      kind: 'openChallenge';
      cardId: string;
      tileId: TileId;
      /** The tile's tier (I to V); the card's own when left out. */ tier?: number;
    }
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
  /** Put a side feature on a tile (rolling its wares if someone is there). */
  | { kind: 'setFeature'; tileId: TileId; feature: SideFeature }
  /** Add caps to the party purse. */
  | { kind: 'giveCaps'; caps: number }
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
  /** Settings → Testing: pools with no cost cards; the unreached tiles are placed again. */
  | { kind: 'setMinigamesOnly'; on: boolean }
  /** The weather challenge gates check (Phase 6 makes this real). */
  /** Sets today's weather (it starts today), and whether it holds instead of changing. */
  | { kind: 'setWeather'; weather: WeatherId; hold?: boolean }
  /** Skips the grace day, so the weather's hiker effect starts now. */
  /** Turns a tile's first fitting node flooded, frozen or on fire. */
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
  | { kind: 'learnBlueprint'; hikerId: HikerId; itemId: ItemId }
  /** Puts a Present in a hiker's bag (even past the limit), with this wrapping and grade. */
  | { kind: 'givePresent'; hikerId: HikerId; colorway: number; grade: PresentGrade }
  /** Gift Wrapper's wish lists: rolled again, or set by hand. */
  | { kind: 'setWishLists'; hikerId: HikerId; lists?: WishLists };

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
  | {
      kind: 'stat';
      hikerId: HikerId;
      stat: StatName;
      from: number;
      to: number;
      cause: string;
      /** Why, in a few words, when a trait says ("alone right now"). */
      why?: string;
    }
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
  /** Phase 10.6: set up, packed up (by hand, or on its own when its owner left), or worn out. */
  | {
      kind: 'shelterSetUp';
      tileId: TileId;
      itemId: ItemId;
      left: number;
      hikerId?: HikerId;
    }
  | {
      kind: 'shelterPackedUp';
      tileId: TileId;
      itemId: ItemId;
      hikerId: HikerId;
      left: number;
      auto?: true;
    }
  | { kind: 'shelterWornOut'; tileId: TileId; itemId: ItemId; hikerId?: HikerId }
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
  /** Blueprints learned all at once (Family Cookbook, Toy Chest: Phase 10.7). */
  | { kind: 'blueprints'; hikerId: HikerId; itemIds: ItemId[]; cause: string }
  /** A named place on the illustrated map was painted for the first time. */
  | { kind: 'found'; name: string }
  /** A hiker wrapped a Present (Gift Wrapper). */
  | {
      kind: 'wrapped';
      hikerId: HikerId;
      grade: PresentGrade;
      recipe: PresentRecipe;
      paid: PaidSlot[];
    }
  /** A hiker opened a Present and got an item (or, Choosy, the items to pick from). */
  | {
      kind: 'presentOpened';
      hikerId: HikerId;
      grade: PresentGrade;
      /** What they got; none yet while a Choosy pick waits. */
      itemId?: ItemId;
      wrappedBy?: HikerId;
      /** Its wrapping, for the opening on screen. */
      colorway?: number;
    }
  /** A Present taken apart, eaten or smashed by a trait (Spare Parts, Present Muncher, Wreck the Halls). */
  | {
      kind: 'presentGone';
      hikerId: HikerId;
      how: 'parts' | 'eaten' | 'smashed';
      trait: string;
      /** Its wrapping, for the smash on screen. */
      colorway?: number;
    }
  /** A hiker ate a bite of food; bitesLeft is what's left after it. */
  | {
      kind: 'ate';
      hikerId: HikerId;
      itemId: ItemId;
      bitesLeft: number;
      /** A camp meal eaten from this hiker's pack (Phase 10.6). */
      fromHikerId?: HikerId;
    }
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
  /** Traded with a Traveling Trader. */
  | { kind: 'traded'; hikerId: HikerId; gave: ItemId; got: ItemId }
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
      /** The card was Empty: it gave nothing. */
      empty?: true;
      /** Kept at once as the cards were dealt (MBA III); the hiker still takes another. */
      kept?: true;
    }
  | { kind: 'ability'; hikerId: HikerId; abilityId: string; choice?: string }
  /** `node` only in logs from before the one bar (save v13 and older). */
  | { kind: 'tend'; hikerId: HikerId; node?: NodeType; from: number; to: number }
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
  /** The bar's overnight recovery. `nodes` only in logs from before the one bar. */
  | { kind: 'recovered'; from?: number; to?: number; nodes?: NodeType[] }
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
  /** A trait did something worth a line of its own ("Never Hungry: the move cost no Appetite"). */
  | { kind: 'trait'; hikerId: HikerId; trait: string; text: string }
  /** XP gained (after every bonus), and from what. `none` says why action XP didn't count. */
  | { kind: 'xp'; hikerId: HikerId; xp: number; cause: string; none?: 'row' }
  /** A hiker reached a level: it waits for the camp step. */
  | { kind: 'levelReached'; hikerId: HikerId; level: number }
  /** The party reached a level (Phase 10.7): "Party level 3! +1 point". */
  | { kind: 'partyLevel'; level: number; points: number }
  /** A hiker learned a Skill Trails step (or started with it). */
  | { kind: 'learned'; hikerId: HikerId; stepId: string; cost: number; start?: true }
  /** A toggle trait switched on or off. */
  | { kind: 'toggled'; hikerId: HikerId; traitId: TraitId; on: boolean }
  /** A level-up or a trinket gave a trait or a slot (and maybe replaced a trait). */
  | {
      kind: 'traitGained';
      hikerId: HikerId;
      cause: string;
      traitId?: TraitId;
      slot?: SlotType;
      replaced?: TraitId;
      level?: number;
    }
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
  /** The Trail Infoboard: a poster pinned face up for caps (25-challenges-on-the-map.md, section 2). */
  | { kind: 'infoboardPin'; cardId: string; caps: number }
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

/** A hiker reaching a checkpoint (Phase 13 scores healthy, injured and carried arrivals). */
export interface Arrival {
  /** The section it ended (0 is the first). */
  section: number;
  hikerId: HikerId;
  injuries: number;
  carried: boolean;
}

/**
 * A trail tile's side feature (01-design-doc.md, "Side features"; Phase 9):
 * - a Merchant's 3 cards, each bought once (Wyatt, Nov 14);
 * - a Traveling Trader's item, one tier above the biome's, for any 1 item of
 *   another type (Wyatt, Nov 14), once.
 */
export type TrailShop =
  | { kind: 'merchant'; offers: (ItemOffer | BlueprintOffer | BundleOffer)[] }
  | {
      kind: 'trader';
      item: ItemInstance;
      wants: 'tool' | 'clothes' | 'food';
      /** Who traded, and what the Trader got. */
      traded?: { hikerId: HikerId; itemId: ItemId };
    };

/** Something on a station's counter. */
interface Offer {
  /** 'item-0', 'blueprint-1', 'bundle-0', 'special'. */
  id: string;
  /** In caps, from the party purse. */
  price: number;
  sold?: true;
  /** Face-down until bought (Rocco's Random Resale): the UI shows only the tier. */
  hidden?: true;
  /** Free for this party: Thrifty's 1 item at each shop (Phase 10a). */
  free?: true;
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

export interface PartyXp {
  xp: number;
  /** Party levels reached so far. */
  level: number;
  /** Points not spent yet. */
  points: number;
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
  /**
   * Party XP (Phase 10.7): every hiker's XP fills one bar. Each party level
   * gives points to spend on any hiker's Skill Trails.
   */
  party?: PartyXp;
  /** The ranger station visit, once everyone has checked in. */
  station?: StationVisit;
  /** Every check-in so far, for the score (Phase 13). */
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
  /** The biome's Abundance bar, 0 to BALANCE.abundance.max (save v14; a meter per node before). */
  abundance: number;
  /** Who scavenged where today. Cleared each morning. */
  scavengedToday: ScavengeRecord[];
  /** An open scavenge, waiting for a card to be taken. */
  scavenge?: PendingScavenge;
  /** A basic craft waiting for its pick. Everything else waits for it too. */
  crafting?: PendingCraft;
  /** A level-up or an Old Photo's trait pick. Everything else waits for it too. */
  traitPick?: TraitPick;
  /**
   * Places on the illustrated map whose names have been found (Phase 10.5):
   * the trail log says "Found …" once for each.
   */
  foundPlaces?: string[];
  /** The difficulty (Phase 10.6): always Medium for now; the debug panel can switch it. */
  difficulty?: DifficultyId;
  /** A Present opened by a Choosy hiker: the items to pick 1 from. Everything else waits for it. */
  presentPick?: PresentPick;
  /** The last day anyone in the party opened a Present (Holiday Spirit). */
  lastPresentDay?: number;
  /** The trinket recipe's random different resources, longest first; a new set after each trinket. */
  trinketRecipe?: ResourceId[];
  /** Debug only: card types the next scavenge deals first. */
  debugDeal?: ScavengeCardType[];
  /** Tactical (Phase 10a): hikers who pick a tile to reveal for this biome. */
  tacticalPicks?: HikerId[];
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
  /**
   * Testing tools (Settings → Testing; 25-challenges-on-the-map.md, section
   * 3.2): pools with no cost cards. (Auto-pass and showing placed cards are the UI's.)
   */
  testing?: { minigamesOnly?: true };
  /** Today's weather, since when, and the days ahead (the forecast). */
  weather: WeatherState;
  nextEventId: number;
  /** The most recent events, oldest first. */
  log: GameEvent[];
}
