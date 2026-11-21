/**
 * The hook system (CLAUDE.md rule 4).
 *
 * Every rule that changes play is an EffectSource: a threshold state, a trait,
 * and later a family, condition or item. Sources plug handlers into hook
 * points, and the engine asks all of a hiker's sources at each point. The
 * engine never checks for a particular trait by name.
 */
import { BALANCE } from '../config/balance';
import { FAMILIES, ITEMS, TRAITS } from '../content';
import { CONDITIONS } from '../content/conditions';
import { WEATHERS } from '../content/weather';
import { tagTeamSide } from '../content/traits/special';
import {
  addCondition,
  addStacks,
  removeCondition,
  shortenCondition,
  takeCondition,
} from './conditions';
import { revealCardOn } from './challenges/reveal';
import { makeItem } from './items/make';
import { bagSlots } from './inventory';
import { pushEvent } from './log';
import { hikersOnTile, isAlone, isSheltered, tileDistance } from './map';
import { int, pick, roll } from './rng';
import { changeStat, cureInjuries, shiftStat } from './stats';
import { thresholdSources } from './thresholds';
import { resourceLimit } from './inventory';
import { boostSources } from './items/boosts';
import { shelterSources } from './items/shelters';
import { loseDurability, removeItem } from './items/wear';
import { noteGone } from './items/gone';
import { revealAhead, tilesAhead } from './traits/reveal';
import { gainXp } from './xp';
import { valueAt, type QualityValues } from './items/quality';
import type { Recipe } from './items/recipe';
import type {
  Action,
  ConditionInstance,
  ConditionUnit,
  EquipSlot,
  Family,
  GameState,
  Hiker,
  HikerId,
  ItemId,
  ItemInstance,
  PlacedShelter,
  Line,
  NodeType,
  Phase,
  ResourceId,
  ScavengeBonus,
  ScavengeCardType,
  SlotType,
  StatName,
  TileId,
  TraitSetting,
  TraitSlot,
  TraitType,
  XpSource,
} from './types';

// ── Queries ────────────────────────────────────────────────────────────────

/** Amounts a hiker pays. Modified totals round down and never go below 0. */
export type CostKey =
  /** A hiker's own crossing of a line: the line's base, its extra and the night extra. */
  | 'move.appetite'
  | 'move.energy'
  | 'move.morale'
  /** Carrying a passed-out hiker: the carrier's extra Appetite on each move. */
  | 'move.carry'
  /** The mover's whole Appetite cost for Move All (own crossing plus the group). */
  | 'moveAll.appetite'
  /** The mover's Appetite for bringing one hiker along (subjectId = that hiker). */
  | 'moveAll.perHiker'
  | 'night.noSleepEnergy'
  /** Scavenging: the Appetite paid when a card is taken (with the night extra). */
  | 'scavenge.appetite'
  /** Tend's Appetite cost (Nov 14 update; it was Energy). */
  | 'tend.appetite'
  /** How much Abundance a scavenge drains (Eco-conscious). */
  | 'scavenge.drain'
  /** What a purchase costs the buyer, in caps (Frugal). */
  | 'buy.caps'
  /** The Morale teaching a blueprint costs (Teacher). */
  | 'teach.morale';

/** Amounts a hiker gains. Modified totals round up. */
export type GainKey =
  | 'sleep.energy'
  /** Appetite from a bite of food (Food Poisoning takes 2 off it). */
  | 'eat.appetite'
  /** Abundance restored by Tend (the Thumbs and Maintenance add to it). */
  | 'tend.abundance'
  /** Caps the party gains, each time (Fancy Attire: +1). */
  | 'caps'
  /** Caps from one sale, before the party's own caps bonuses (Charismatic, Non-Non-Profit). */
  | 'sale.caps';

/** Whether a hiker is acting themselves or being brought along by someone's Move All. */
export type Role = 'actor' | 'brought';

export interface AmountQuery<K extends string> {
  key: K;
  /** The hiker taking the action. */
  actorId: HikerId;
  /** The hiker this amount is about (the brought hiker for moveAll.perHiker). */
  subjectId: HikerId;
  role: Role;
  phase: Phase;
  line?: Line;
  /** Moves: the Move action or Move All. */
  via?: 'move' | 'moveAll';
  /** Moves: where from and to (Roller Skates: sideways or backward). */
  fromTileId?: TileId;
  toTileId?: TileId;
  /**
   * Moves (move.appetite, move.energy, move.morale): what the base amount is
   * made of, the line's base cost, its extra (Steep, Muddy, Rough) and the
   * night extra (Light-Up Skechers, Trooper Mask).
   */
  parts?: { base: number; line: number; night: number };
}

export type CostQuery = AmountQuery<CostKey>;
export type GainQuery = AmountQuery<GainKey>;

/** How much a hiker can hold. Flat modifiers only. */
export type CapacityKey = 'bag.slots' | 'resources';

export interface CapacityQuery {
  key: CapacityKey;
}

export interface Modifier {
  source: string;
  /** Added first. */
  flat?: number;
  /** Applied after flat amounts: −50 halves, +50 adds half. */
  percent?: number;
}

/** A hiker about to scavenge their tile. */
export interface ScavengeQuery {
  tileId: TileId;
  phase: Phase;
}

/** How a source changes a scavenge. Each one with a label shows in the bonuses pop-over. */
export interface ScavengeModifier {
  source: string;
  label: string;
  tone: ScavengeBonus['tone'];
  /** More (or fewer) cards to choose from. */
  cards?: number;
  luck?: number;
  /** Multipliers on how likely each node is (Finder, Hound). */
  nodeWeight?: Partial<Record<NodeType, number>>;
  /** Multipliers on how likely each card type is. */
  typeWeight?: Partial<Record<ScavengeCardType, number>>;
  /** Multipliers on card types, only for cards from one node (Hound's ×2 results). */
  nodeTypeWeight?: Partial<Record<NodeType, Partial<Record<ScavengeCardType, number>>>>;
  /** Extra copies of the first resource taken (Copier, Copydog). */
  bonus?: { count: number; appetiteEach: number };
  /** A chance the card taken slips away and the hiker gets nothing (Butterfingers). */
  dropChance?: number;
  /** Extra cards the hiker can keep from this deal (a Sack). */
  keep?: number;
  /** Cards the hiker can reroll in this scavenge (Glasses). */
  rerolls?: number;
  /** Multipliers on how likely each resource is, on cards of one resource (Swiss Army Knife). */
  resourceWeight?: Partial<Record<ResourceId, number>>;
  /** Cards added to the deal (a Supply Map's Choice card for a node). */
  addCards?: { type: ScavengeCardType; node: NodeType }[];
  /** Also draw from the revealed nodes of the tiles next to this one (Eagle Eye). */
  adjacentNodes?: true;
}

/** A hiker about to craft an item of this type on a tile. */
export interface CraftQuery {
  type: ItemType;
  tileId: TileId;
}

/** How a source changes crafting. Each one shows in the Craft window. */
export interface CraftModifier {
  source: string;
  label: string;
  tone: ScavengeBonus['tone'];
  /** Luck for the Quality roll (Morale, Lucky, Dogs). */
  luck?: number;
  /** More (or fewer) cards to pick from on a basic recipe (Tunnel Vision). */
  cards?: number;
  /** Quality added after the roll, up to 5 (a Tailgate or Lodge on the tile). */
  quality?: number;
  /** Clothes come out with this much more durability (Engineering Vest). */
  durability?: number;
}

export interface ActQuery {
  action: Action;
  role: Role;
  phase: Phase;
}

// ── Contexts handed to content ─────────────────────────────────────────────

/** What a query handler can read. */
export interface QueryContext {
  readonly state: Readonly<GameState>;
  readonly self: Hiker;
  hikersOnTile(tileId: TileId): Hiker[];
  isAlone(hiker: Hiker): boolean;
  /** On a campsite or a tile with a shelter. */
  sheltered(hiker: Hiker): boolean;
  /** How many clothing items the hiker has equipped. */
  clothesWorn(hiker: Hiker): number;
  /** The hiker's instance of a condition, if they have it (its stacks, node, time left). */
  condition(hiker: Hiker, id: string): ConditionInstance | undefined;
  /** A running count kept by `tally`, read without changing it (a once-a-day rule's use). */
  used(hiker: Hiker, key: string, per: 'phase' | 'day' | 'biome'): number;
  /** How many lines apart two tiles are (Infinity if they don't connect). */
  distance(a: TileId, b: TileId): number;
  /** What this hiker's sources add to one of their abilities (Tag Team: Fetch reaches farther). */
  boost(abilityId: string): { reach: number; items: boolean };
  /** Can this hiker move by themselves right now (a Plush with Shifty, alone)? */
  canMoveAlone(): boolean;
}

/** What an event handler or ability can do. */
export interface EffectContext extends QueryContext {
  /** `why`: a few words for the log, like a Morale trait's reason ("alone right now"). */
  changeStat(hiker: Hiker, stat: StatName, delta: number, cause: string, why?: string): void;
  /** Gives a hiker resources, as many as fit (Raccoon Friend), and logs it. */
  gain(hiker: Hiker, resources: readonly ResourceId[], cause: string): void;
  addCondition(
    hiker: Hiker,
    id: string,
    remaining: number,
    unit: ConditionUnit,
    cause: string,
  ): void;
  /** Adds (or, with a negative n, takes away) stacks of a stacking condition. */
  addStacks(hiker: Hiker, id: string, n: number, cause: string): void;
  /** A hiker's item loses durability (worn out at 0). */
  wearItem(hiker: Hiker, uid: string, n: number, cause: string): void;
  /** A hiker's item breaks: gone at once (the Hardhat). */
  breakItem(hiker: Hiker, uid: string, cause: string): void;
  /** Cures injuries (the Medic Tent). */
  heal(hiker: Hiker, n: number, cause: string): void;
  /**
   * Adds to a running count for this hiker that resets each phase or day, and
   * returns the new total (Thrill Seeker's Energy lost this phase).
   */
  tally(hiker: Hiker, key: string, add: number, per: 'phase' | 'day' | 'biome'): number;
  roll(chance: number): boolean;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** A line in the trail log about what a trait did. */
  note(hiker: Hiker, trait: string, text: string): void;
  /** Tiles nobody has reached that hold a card or a Wonder. */
  tilesAhead(): TileId[];
  /** Shows a tile's nodes and card for the rest of the biome (Prepared). */
  revealAhead(tileId: TileId, cause: string): void;
  /** The player picks a tile for this hiker to reveal (Tactical). */
  askTilePick(hiker: Hiker): void;
  /** Moves a condition to another hiker with its time left (Supportive). */
  takeCondition(from: Hiker, to: Hiker, id: string, cause: string): void;
  /** Takes time off a condition, in its own unit (Hardy, Therapist). */
  shortenCondition(hiker: Hiker, id: string, by: number, cause: string): void;
  /** Takes resources from a hiker (one of each id listed; Lead Stomach, Alchemist) and logs it. */
  spendResources(hiker: Hiker, ids: readonly ResourceId[], cause: string): void;
  /** Evens a stat out across these hikers, rounded down (Liberal). */
  evenOut(hikers: readonly Hiker[], stat: StatName, cause: string): void;
  /** The hiker hasn't used their action after all (Lanky). */
  refundAction(hiker: Hiker, cause: string): void;
  /** Takes a condition off a hiker (Forgetful, Comedian). */
  cure(hiker: Hiker, id: string, cause: string): void;
  /** Puts a new item in a hiker's bag, if there's room (Nugget Puker). */
  giveItem(hiker: Hiker, itemId: ItemId, cause: string): void;
  /** A trait gives a hiker XP (Storyteller). */
  gainXp(hiker: Hiker, xp: number, cause: string): void;
  /** Passes XP on to a hiker: nothing adds to it or passes it on again (Wise, VR Headset). */
  shareXp(hiker: Hiker, xp: number, cause: string): void;
  /** The party gains caps (MBA). */
  gainCaps(n: number, cause: string): void;
  /** Picks a new card for a tile whose card is shown (Rule Changer). */
  rerollCard(tileId: TileId, cause: string): void;
  /** Uses up the hiker's action for this phase (Good Boy gives his away). */
  useAction(hiker: Hiker): void;
  /** Moves a resource or a bag item from one hiker to another, if it fits (Fetch). */
  take(
    from: Hiker,
    to: Hiker,
    thing: { resource: ResourceId } | { itemUid: string },
    cause: string,
  ): void;
}

// ── Hooks, abilities and sources ───────────────────────────────────────────

type ModifierResult = Modifier | Modifier[] | undefined;

/** An XP gain being worked out: its source, and the amount so far. */
export interface XpQuery {
  source: XpSource;
  amount: number;
  /** A second card taken in the same scavenge (Gambler): "every scavenge" bonuses count once. */
  repeat?: true;
}

/** More XP: flat amounts first, then percentages, rounded up (the stacking rule). */
export interface XpModifier {
  source: string;
  flat?: number;
  percent?: number;
}

export interface MoveHookEvent {
  from: TileId;
  to: TileId;
  role: Role;
  line: Line;
  /** The Move action, or Move All. */
  via: 'move' | 'moveAll';
  /** Nobody had landed on the tile before (Wanderlust: "an unrevealed tile"). */
  firstVisit?: boolean;
}

/** What a hiker did, for traits that react to an action (Action, Traveler, Simple Pleasures). */
export interface ActionHookEvent {
  kind: 'move' | 'scavenge' | 'craft' | 'tend' | 'eat' | 'sleep' | 'watch';
  /** Moves: their own (or leading the group), or being brought along. */
  role: Role;
  tileId: TileId;
  /** Scavenging: the node the card came from. */
  node?: NodeType;
  /** Crafting: what was made. */
  itemType?: ItemType;
}

/** A stat change about to happen, for sources that change it (Strained, Refreshed, Inspired). */
export interface StatChangeQuery {
  stat: StatName;
  delta: number;
  cause: string;
}

/** What a source does to a stat change: add to it, or stop a loss altogether. */
export interface StatChangeModifier {
  add?: number;
  /** No loss at all (Refreshed, Full). */
  blockLoss?: true;
}

/** A stat's maximum: a hard cap (Dejected: Morale 5) or a change to it (Burning: −1 a stack). */
export interface StatMaxModifier {
  cap?: number;
  delta?: number;
}

export interface Hooks {
  modifyCost?(q: CostQuery, ctx: QueryContext): ModifierResult;
  modifyStatChange?(q: StatChangeQuery, ctx: QueryContext): StatChangeModifier | undefined;
  modifyStatMax?(stat: StatName, ctx: QueryContext): StatMaxModifier | undefined;
  /** After a stat changed (Thrill Seeker). */
  onStatChange?(
    e: { stat: StatName; from: number; to: number; cause: string },
    ctx: EffectContext,
  ): void;
  /** At the end of every phase, before conditions tick (Soaked, Allergies, Ringing Ears). */
  onPhaseEnd?(e: { phase: Phase }, ctx: EffectContext): void;
  modifyGain?(q: GainQuery, ctx: QueryContext): ModifierResult;
  modifyCapacity?(q: CapacityQuery, ctx: QueryContext): ModifierResult;
  /** Returns a reason when this source stops the action. */
  canAct?(q: ActQuery, ctx: QueryContext): string | undefined;
  onMove?(e: MoveHookEvent, ctx: EffectContext): void;
  onStartOfDay?(ctx: EffectContext): void;
  onEndOfDay?(ctx: EffectContext): void;
  onSleep?(ctx: EffectContext): void;
  onMoraleChange?(e: { delta: number; cause: string }, ctx: EffectContext): void;
  /** Changes to a scavenge before the cards are dealt: extra cards, Luck, odds. */
  modifyScavenge?(
    q: ScavengeQuery,
    ctx: QueryContext,
  ): ScavengeModifier | ScavengeModifier[] | undefined;
  /** Changes to a craft: Luck, cards, Quality and durability. */
  modifyCraft?(q: CraftQuery, ctx: QueryContext): CraftModifier | CraftModifier[] | undefined;
  /**
   * The hiker crafted an item: the item itself (in their bag, to improve:
   * Chef, Talented, Careful Hands) and the resources it took (Savvy).
   */
  onCraft?(
    e: { itemId: ItemId; type: ItemType; item?: ItemInstance; paid?: readonly ResourceId[] },
    ctx: EffectContext,
  ): void;
  /** Someone on this hiker's tile (them included) crafted an item (Soup Socks). */
  onTileCraft?(e: { crafterId: HikerId; itemId: ItemId; type: ItemType }, ctx: EffectContext): void;
  /** The hiker ate a bite of food. */
  onEat?(e: { itemId: ItemId }, ctx: EffectContext): void;
  /** Stops a negative condition before it lands (a Star; the Puffer Jacket in step 4). */
  blockCondition?(id: string, ctx: EffectContext): boolean;
  /** Stops an injury before it lands (a Star; the Hardhat in step 4). */
  blockInjury?(cause: string, ctx: EffectContext): boolean;
  /** Can trade items and resources with any hiker on any tile (Walkie-Talkie). */
  tradeAnywhere?(ctx: QueryContext): boolean;
  /** Can't be hit by night events (Bear Spray). */
  nightSafe?(ctx: QueryContext): boolean;
  /** Hikers on this one's tile are this many percent less likely to be hit at night (Disco Harness). */
  nightShield?(ctx: QueryContext): number;
  /** At the start of every phase, after the last one ended (Dog Socks, Sleepy Socks). */
  onPhaseStart?(e: { phase: Phase }, ctx: EffectContext): void;
  /** The hiker took a scavenge card (the first, with a Sack) (Jeans, Pajamas). */
  onScavenge?(e: { tileId: TileId }, ctx: EffectContext): void;
  /** Someone on this hiker's tile (them included) ate a bite (Soup Socks). */
  onTileEat?(e: { eaterId: HikerId; itemId: ItemId }, ctx: EffectContext): void;
  /** Moving costs Energy instead of Appetite when Appetite is lower (Trail Shoes). */
  moveWithEnergy?(ctx: QueryContext): boolean;
  /** Move All with this many others: they keep their action (Lifted Boots). */
  broughtKeepAction?(count: number, ctx: QueryContext): boolean;

  // ── Trail traits (Phase 10a) ──
  /** Being brought along by someone's Move All keeps this hiker's action (Follower). */
  keepsActionWhenBrought?(ctx: QueryContext): boolean;
  /** A move to this tile that doesn't use the action (Fast, Stalker). */
  freeMove?(
    q: { fromTileId: TileId; toTileId: TileId },
    ctx: QueryContext,
  ): TraitFreeMove | undefined;
  /** A cost about to be paid: true waives its Appetite (Never Hungry's chance). */
  waiveAppetite?(e: { cause: string }, ctx: EffectContext): boolean;
  /**
   * How many tiles away this hiker can hand things over (Manager: items, 1
   * tile; Carrier Pigeon: sending anything, anywhere).
   */
  giveReach?(
    q: { what: 'item' | 'resource'; role: 'sender' | 'receiver' },
    ctx: QueryContext,
  ): number;
  /** The nodes of every tile next to this hiker's are shown (Scout). */
  revealsAdjacent?(ctx: QueryContext): boolean;
  /** A new biome began (a new section of the trail, and the first) (Prepared, Tactical). */
  onBiomeStart?(ctx: EffectContext): void;
  /** No card triggers for this hiker now (Trespasser's day). */
  skipsChallenges?(ctx: QueryContext): boolean;
  /** Keeping watch also guards tiles this many lines away (Lookout). */
  watchReach?(ctx: QueryContext): number;
  /** Move All can also bring hikers this many tiles away (Sherpa). */
  bringReach?(ctx: QueryContext): number;
  /** Moving the group costs this much Energy instead of the mover's Appetite (Puller). */
  pullsGroup?(ctx: QueryContext): number | undefined;
  /** Has the positive conditions of everyone on the tile (Susceptible). */
  borrowsPositive?(ctx: QueryContext): boolean;
  /** Everyone on the tile has this hiker's positive conditions (Transparent). */
  lendsPositive?(ctx: QueryContext): boolean;

  // ── Utility traits (Phase 10a) ──
  /** After the hiker took a scavenge card: the node it came from, if any (Pockets, Generous). */
  onScavenged?(e: { tileId: TileId; node?: NodeType }, ctx: EffectContext): void;
  /** Someone else on this hiker's tile took a scavenge card (Dog Mom). */
  onTileScavenged?(
    e: { scavengerId: HikerId; tileId: TileId; node?: NodeType },
    ctx: EffectContext,
  ): void;
  /** The hiker used a tool (German Efficiency). */
  onToolUse?(e: { itemId: ItemId }, ctx: EffectContext): void;
  /** A night without sleep costs this stat instead of Energy (Nocturnal: Appetite). */
  noSleepStat?(ctx: QueryContext): StatName | undefined;
  /** Can Sleep in the Morning or Afternoon too (Day Napper). */
  sleepsByDay?(ctx: QueryContext): boolean;
  /** Crafts this type at this tier (Artisan: 2, Master: 3). */
  craftTier?(type: ItemType, ctx: QueryContext): number | undefined;
  /** One random item at each shop is free (Thrifty). */
  freeShopItem?(ctx: QueryContext): boolean;
  // ── Morale traits (Phase 10a) ──
  /** The hiker did something (Action, Traveler, Conservationist, Simple Pleasures). */
  onAction?(e: ActionHookEvent, ctx: EffectContext): void;
  /**
   * A challenge on this hiker's tile was passed or failed, by these hikers
   * (one section: a hiker, or the whole party) (Thrill-Seeker, Soccer Mom).
   */
  onChallengeResult?(
    e: { passed: boolean; hikerIds: readonly HikerId[] },
    ctx: EffectContext,
  ): void;
  /**
   * A stat change for someone on this hiker's tile, this hiker included (Show
   * Girl: Humans here get +1 from every Morale gain).
   */
  modifyTileStatChange?(
    q: StatChangeQuery & { target: Hiker },
    ctx: QueryContext,
  ): StatChangeModifier | undefined;
  /** A hiker on this hiker's tile levelled up (Proud Mentor). Fired from Phase 10a step 6. */
  onTileLevelUp?(e: { hikerId: HikerId }, ctx: EffectContext): void;
  /** This hiker took a level-up (MBA). */
  onLevelUp?(e: { level: number }, ctx: EffectContext): void;
  /**
   * For trait warnings: does the trait's condition hold right now (Focused:
   * alone)? The same check its effect uses. Leave it out for a trait that's
   * always working.
   */
  workingNow?(ctx: QueryContext): boolean;
  // ── XP (Phase 10a step 6; src/engine/xp.ts) ──
  /** Extra XP for this kind of gain, before anything else (Postcard, Textbook). */
  xpForSource?(q: XpQuery, ctx: QueryContext): number;
  /** Each time this hiker gains XP: more of it (Thinking Cap, Linguist). */
  modifyXp?(q: XpQuery, ctx: QueryContext): XpModifier | undefined;
  /** Each time someone else on this hiker's tile gains XP: more of it (Mentor; Trainer for Pets). */
  modifyTileXp?(q: XpQuery, target: Hiker, ctx: QueryContext): XpModifier | undefined;
  /** This hiker gained XP (Wise passes some on). */
  onXpGained?(e: { xp: number; source: XpSource }, ctx: EffectContext): void;
  /** Someone else on this hiker's tile gained XP (VR Headset). */
  onTileXpGained?(e: { hikerId: HikerId; xp: number }, ctx: EffectContext): void;

  // ── Families, Plush, Duos and special traits (Phase 10a step 5) ──
  /** Changes someone else's scavenge on this hiker's tile (Dog Whisperer, Lucky Charm). */
  modifyTileScavenge?(
    q: ScavengeQuery,
    target: Hiker,
    ctx: QueryContext,
  ): ScavengeModifier | undefined;
  /** Changes someone else's craft on this hiker's tile (Lucky Charm). */
  modifyTileCraft?(q: CraftQuery, target: Hiker, ctx: QueryContext): CraftModifier | undefined;
  /** More for one of this hiker's abilities (Tag Team: Fetch takes items, from farther). */
  abilityBoost?(
    abilityId: string,
    ctx: QueryContext,
  ): { reach?: number; items?: boolean } | undefined;
  /** Night events that take food or resources skip hikers on this tile (Mouser). */
  guardsSupplies?(ctx: QueryContext): boolean;
  /** Changes a gain for someone else on this hiker's tile (Snores: their sleep). */
  modifyTileGain?(q: GainQuery, ctx: QueryContext): ModifierResult;
  /** Someone slept on this hiker's tile (Cuddle Buddy). */
  onTileSleep?(e: { sleeperId: HikerId }, ctx: EffectContext): void;
  /** Stops a condition reaching someone on this hiker's tile (Cuddle Buddy: Nightmares). */
  blockTileCondition?(id: string, target: Hiker, ctx: QueryContext): boolean;
  /** Can move by themselves (a Plush, normally carried: Shifty, Night Shifty). */
  movesAlone?(ctx: QueryContext): boolean;
  /**
   * This hiker leads a Move All: a chance that one hiker's part of it costs
   * no Appetite (Just Around the Next Corner). Asked once for each hiker in the group.
   */
  waiveForGroup?(e: { payerId: HikerId }, ctx: EffectContext): boolean;
  /** Move All can bring hikers who've already acted (Tank Butt). */
  bringsActed?(ctx: QueryContext): boolean;
  /** A challenge on this hiker's tile costs this much less of each thing it asks (Easy Mode). */
  easesChallenges?(ctx: QueryContext): number;
  /** Leading the group onto a challenge, this hiker takes its harm instead of the others (Alpha Dog). */
  takesGroupHarm?(ctx: QueryContext): boolean;
  /** Quality 1 food gives this hiker no bad condition (Garbage Gut). */
  ignoresBadFood?(ctx: QueryContext): boolean;
  /** The hiker put on clothes (Stylish). */
  onEquip?(e: { item: ItemInstance }, ctx: EffectContext): void;
  /** The hiker gave something to someone this many lines away (Gracie's day). */
  onGive?(e: { toId: HikerId; distance: number }, ctx: EffectContext): void;
  /**
   * The hiker Sits by the Fire (Singer, Storyteller, Comedian, Chatty).
   * TODO(wyatt): Sit by the Fire is still held, so nothing calls this in play yet.
   */
  onSitByFire?(ctx: EffectContext): void;
}

/** A trait's move that doesn't use the action, and what it does to the cost. */
export interface TraitFreeMove {
  /** The tally key that counts its uses, and how often they come back. */
  key: string;
  per: 'phase' | 'day';
  /** Appetite off the move ('all' makes it free). */
  discount?: number | 'all';
  /** Extra Appetite the move costs (Fast). */
  extra?: number;
}

export type EventHookName = 'onStartOfDay' | 'onEndOfDay' | 'onSleep';

export interface AbilityChoice {
  id: string;
  label: string;
}

/** An active trait: a button in the hiker's Abilities panel. Using one is a free action. */
export interface AbilityDef {
  id: string;
  label: string;
  limit: { per: 'day' | 'phase' | 'biome'; uses: number };
  choices?: readonly AbilityChoice[];
  /** Choices that depend on the moment (Supportive: who to help, and with what). */
  choicesFor?(ctx: QueryContext): AbilityChoice[];
  /** Used in the scavenge window to reroll a card (Gambler), not from the Abilities panel. */
  scavengeReroll?: true;
  validate?(ctx: QueryContext, choice: string | undefined): string | undefined;
  apply(ctx: EffectContext, choice: string | undefined): void;
}

/**
 * normal: offered to anyone whose classes fit; family: only some families
 * can have it; special and unique: only the characters they belong to.
 */
export type TraitKind = 'normal' | 'family' | 'special' | 'unique';

/** What a trait's setting holds: a node, two nodes, one action or two actions. */
export type TraitSettingKind = 'node' | 'nodes' | 'action' | 'actions';

export interface TraitDef {
  id: string;
  name: string;
  type: TraitType;
  /** Trail and Utility traits have a tier; Morale, special and unique traits don't. */
  tier: 1 | 2 | 3 | null;
  /** The wording from the design doc, without its [brackets]. */
  text: string;
  hooks?: Hooks;
  /** A usable trait: a button in the Abilities panel. Every other trait is always on. */
  ability?: AbilityDef;
  placeholder?: boolean;
  /**
   * Its icon file in public/assets/traits/, when it isn't the name in
   * lowercase with dashes: a shared file (Human Food uses `glutton`) or a
   * different one (the Morale Thrill-Seeker uses `thrill-seeker-morale`).
   */
  icon?: string;
  /** Normal unless it says otherwise. */
  kind?: TraitKind;
  /** Family traits and family versions: the families that can have it. */
  who?: readonly Family[];
  /** Special and unique traits: the characters it belongs to (07-characters.md). */
  owners?: readonly string[];
  /**
   * One effect under family names (Puller and Leash Puller): the group they
   * share. A hiker is only offered the version for their family.
   */
  group?: string;
  /** What's set for this trait on the hiker (Finder's node, Location's two nodes). */
  setting?: TraitSettingKind;
  /** Hooks that read the setting. */
  hooksWith?(setting: TraitSetting): Hooks;
  /** The name with its setting ("River Finder"). */
  nameWith?(setting: TraitSetting): string;
  /** What it does, with its setting filled in. */
  textWith?(setting: TraitSetting): string;
  /**
   * Changes each morning: into another trait (Quirky, Zany), a node
   * (Nosework) or a condition (Moody). Today's pick is kept on the slot.
   */
  daily?: 'trait' | 'node' | 'condition';
  /** A daily trait that becomes another trait: the tiers it draws from (Quirky: Tier I). */
  dailyTiers?: readonly (1 | 2 | 3)[];
  /**
   * A Duo's Tag Team trait: only their Tag Team slot holds it. Whose days are
   * odd and whose are even.
   */
  tagTeam?: readonly [odd: string, even: string];
  /** A rule the game doesn't have yet, that this trait needs (Sit by the Fire). */
  waitsOn?: string;
}

/** A slot's trait as it works today: a daily trait as today's pick, with its setting. */
export interface WorkingTrait {
  def: TraitDef;
  /** The trait whose rules run: today's trait for Quirky and Zany, else `def`. */
  runs: TraitDef;
  setting: TraitSetting;
  name: string;
  /** What it does, with its setting filled in (today's trait's text for Quirky and Zany). */
  text: string;
}

/** What the trait in this slot is and does today, or nothing for an empty or unknown slot. */
export function workingTrait(state: GameState, slot: TraitSlot): WorkingTrait | undefined {
  const def = slot.traitId ? TRAITS[slot.traitId] : undefined;
  if (!def) return undefined;
  const today = slot.daily?.day === state.day ? slot.daily.pick : undefined;
  if (def.daily === 'trait') {
    const runs = today ? TRAITS[today] : undefined;
    return runs
      ? {
          def,
          runs,
          setting: slot.setting ?? {},
          name: `${def.name} (${runs.name})`,
          text: `Today: ${runs.text}`,
        }
      : { def, runs: def, setting: {}, name: def.name, text: def.text };
  }
  const setting = def.daily === 'node' && today ? { x: today } : (slot.setting ?? {});
  // A Duo's Tag Team says whose day it is.
  if (def.tagTeam) {
    const side = tagTeamSide(state.day, def.tagTeam);
    return { def, runs: def, setting, name: def.name, text: `${side}’s day today. ${def.text}` };
  }
  return {
    def,
    runs: def,
    setting,
    name: def.nameWith?.(setting) ?? def.name,
    text: def.textWith?.(setting) ?? def.text,
  };
}

/** A trait's hooks with its setting. */
export function traitHooks(def: TraitDef, setting: TraitSetting): Hooks {
  return def.hooksWith ? { ...def.hooks, ...def.hooksWith(setting) } : (def.hooks ?? {});
}

export type ItemType = 'tool' | 'clothes' | 'food' | 'shelter' | 'trinket';

/**
 * What using an item does: to its target, the tile, or the map. A use that
 * would do nothing is refused (src/engine/actions/useItem.ts).
 */
export interface ItemUse {
  /** Cures this many injuries (waking a passed-out hiker who drops below 3). */
  injuries?: number;
  /** Cures these conditions if the target has them (Bandages: Bleeding). */
  cures?: readonly string[];
  /** Cures one negative condition the player picks (Bandaid). TODO(wyatt): the player picks. */
  pickCondition?: true;
  /** Cures every negative condition (Medkit, Ointment). */
  allNegative?: true;
  /** Then gives this condition; a target who has it already can't use another. */
  gives?: { id: string; duration: QualityValues | number; unit: 'days' | 'phases' };
  /**
   * Who it's for: the user ('self'), a hiker on the tile they pick ('hiker',
   * the default), or every hiker on the tile ('tile').
   */
  target?: 'self' | 'hiker' | 'tile';
  /** Morale gained, from a value at the item's Quality (Stuffed Animal, Ukulele). */
  morale?: string;
  /** Fills a stat the player picks to its maximum (Survival Kit). */
  fillStat?: true;
  /** Evens out each stat across every hiker on the tile, rounded down (Liberal Policy). */
  averageStats?: true;
  /** Clothes gain durability: one item the player picks, or every item worn. */
  repair?: { value: string; which: 'one' | 'worn' };
  /** The biome's Abundance rises by this value (Fertilizer). */
  abundance?: { value: string };
  /** Adds a node the player picks to the tile (Planter). */
  addNode?: true;
  /** Gives random resources from a node, or any (the resource packs). */
  resources?: { value: string; node?: NodeType };
  /** Keeps watch over this tile and the ones next to it tonight (Camping Lamp). */
  lampTonight?: true;
  /** For good: every caps gain is bigger (Wallet: BALANCE.items.walletCaps). */
  capsBonus?: true;
  /** For good: the target's maximum of this stat goes up (the Serums: BALANCE.items.serumMax). */
  maxStat?: StatName;
  /** XP: a rolled share of what the hiker's next level takes (Diploma: BALANCE.items.diplomaXp). */
  levelXp?: true;
  /** A random Trail or Utility trait, into an empty slot that fits (Cherished Photo). */
  randomTrait?: true;
  /** Copies a trait the player picks from another hiker, into an empty slot that fits (Family Photo). */
  copyTrait?: true;
  /** One of the target's traits, picked, becomes 1 of 3 of its type and tier (Old Photo). */
  swapTrait?: true;
  /** A new slot, of one of these types the player picks (Instruction Manual). */
  addSlot?: readonly SlotType[];
  /**
   * A map tool (src/engine/items/scout.ts): what it does, and the tile the
   * player picks on the map as `choice` (adjacent along a line, beside it on
   * the grid, any tile, or any tile in a row). No pick: it works around the hiker.
   */
  map?: {
    does:
      | 'scan'
      | 'scanAround'
      | 'kind'
      | 'countAround'
      | 'countRow'
      | 'look'
      | 'reveal'
      | 'pave'
      | 'hop'
      | 'remove'
      | 'lower';
    pick?: 'adjacent' | 'beside' | 'any' | 'row';
  };
  /** Works for a while: its `boostHooks` (src/engine/items/boosts.ts). */
  boost?: {
    lasts: { unit: 'phases' | 'nights'; n: number | string };
    /** For every hiker on the tile (Wheelbarrow). */
    tile?: true;
    /** Gone after the next scavenge on this tile (Supply Map). */
    once?: true;
    /** Pick a resource for it (Swiss Army Knife). */
    chooseResource?: true;
    /** Only worth using on a tile with this node (Woodcutting Axe). */
    needsNode?: NodeType;
    /** For scavenging: only worth it while the hiker can still scavenge this phase. */
    scavenging?: true;
  };
}

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  /** Clothes are equipped in one of these slots. */
  slot?: EquipSlot;
  /** Feet: shoes or socks (a hiker wears one or the other). */
  footwear?: 'shoes' | 'socks';
  tier: 1 | 2 | 3 | 4;
  /**
   * The effect, as a template for the card (src/engine/items/text.ts): {key}
   * is a value at this item's Quality, [ ... ] drops out when a value in it is 0.
   */
  text: string;
  /** Food at Quality 1: its downside, added to the card. */
  atQuality1?: string;
  /** Values that change with Quality ((X a/b/c/d/e) in 03-items.md), for the text and effects. */
  values?: Readonly<Record<string, QualityValues>>;
  /** Tools: uses. */
  uses?: QualityValues | number;
  /** Food: bites. */
  bites?: QualityValues | number;
  /** Clothes: days of durability, when not the tier's usual (Plain Shirt lasts longer). */
  durability?: QualityValues;
  /** Shelters: nights it lasts once placed. */
  nights?: number;
  /** Trinkets: used up when used, or works while carried. */
  trinket?: 'use' | 'keep';
  /** Its own recipe, used once the hiker knows its blueprint. */
  recipe?: Recipe;
  /** Only from finds, shops or events. */
  notCrafted?: true;
  /** Never found by scavenging either (Puked Nuggets: only from the Nugget Puker). */
  notFound?: true;
  /** Its art in public/assets/items/{art}.png; null when there's none yet (the type's icon). */
  art?: string | null;
  /** Equipped items plug into hooks, like traits. */
  hooks?: Hooks;
  /**
   * Hooks that read the item's own values at its Quality (`v('items')` for a
   * Backpack) and know the item itself (Jeans wear themselves out).
   */
  hooksAt?: (v: (key: string) => number, item: ItemInstance) => Hooks;
  /** Clothes: the hiker's other clothes' durability losses come off this instead (Umbrella). */
  takesWear?: true;
  /**
   * Clothes: a chance (a value at its Quality) not to lose durability; with
   * `onNode`, only on a tile with the node it was made with (Birkenstocks).
   */
  wearSave?: { value: string; onNode?: true };
  /** Made with a random node, shown on the card (Birkenstocks). */
  madeWithNode?: true;
  /**
   * Shoes: a move that doesn't use the hiker's action. `eachPhase` is the
   * first move each phase (Jogging Shoes); the others come after passing a
   * challenge (Hiking Crocs) or crafting (Work Boots), once a day, cost 1 less
   * Appetite and take 1 more durability.
   */
  freeMove?: 'eachPhase' | 'afterChallenge' | 'afterCraft';
  /** Body: turns a failed challenge into a pass, for this much durability (a value) (Harness). */
  harness?: string;
  /** Shelters: hooks that know the placed shelter (the Medic Tent remembers who it healed). */
  placedHooks?: (placed: PlacedShelter) => Hooks;
  /** Shelters: also shelters the tiles next to it (RV), or guards them from night events (Tree-House). */
  shelterReach?: 'shelters' | 'guards';
  /** Why an item can't be used yet, when its use waits on a later phase (the Photos). */
  notYet?: string;
  /** Always this Quality (Puked Nuggets: always 1). */
  fixedQuality?: 1 | 2 | 3 | 4 | 5;
  /** Can be used from the bag, as a free action, on a hiker on the same tile. */
  use?: ItemUse;
  /** Food: what eating a bite does (src/engine/actions/eat.ts). */
  onEat?: (e: EatContext) => void;
  /** Food that never loses Appetite value (Jerky). */
  keepsValue?: true;
  /** Food: only 1 bite a day (Advent Calendar). */
  oneBiteADay?: true;
  /**
   * Hooks that work for a while once the item is used (a Shovel this phase),
   * reading its values at its Quality and what was picked.
   */
  boostHooks?: (v: (key: string) => number, choice?: string) => Hooks;
  placeholder?: boolean;
}

/** What a food's onEat can do (src/engine/actions/eat.ts). */
export interface EatContext {
  hiker: Hiker;
  /** A value at this food's Quality. */
  v(key: string): number;
  /** Bites left, counting this one (Din Tai Fung). */
  bitesLeft: number;
  /** Eaten at night (S'mores). */
  night: boolean;
  /** Gains Appetite from the food: plus any change recorded on it, less Food Poisoning. */
  appetite(n: number): void;
  /** Any other stat change (Morale, Energy). */
  stat(stat: StatName, n: number): void;
  condition(
    id: string,
    n: number,
    unit: 'phases' | 'days',
    extra?: { stacks?: number; thisPhase?: true; then?: { id: string; n: number; unit: 'days' } },
  ): void;
  /** A chance out of 100. */
  chance(pct: number): boolean;
  /** A whole number from lo to hi (Y[1–10]). */
  rollY(lo: number, hi: number): number;
  randomPositive(count: number, n: number, unit: 'phases' | 'days'): void;
  randomNegative(n: number, unit: 'phases' | 'days'): void;
  cureRandomNegative(count: number): void;
  /** Other food carried by hikers on this tile, or only this hiker's (Meatball Soup). */
  otherFood(scope: 'tile' | 'own'): ItemInstance[];
  /** This bite isn't used up (Costco Sample). */
  keepBite(): void;
}

/** A family's built-in strengths and drawbacks (always on, no slot). */
export interface FamilyDef {
  name: string;
  hooks: Hooks;
}

export interface EffectSource {
  id: string;
  kind: 'threshold' | 'trait' | 'family' | 'condition' | 'item' | 'weather';
  name: string;
  /** Items and boosts: which item. */
  itemId?: ItemId;
  hooks: Hooks;
  ability?: AbilityDef;
}

/** Trait types a condition switches off while it lasts (Brain Fog: Utility). */
function suppressedTraitTypes(hiker: Hiker): Set<TraitType> {
  const off = new Set<TraitType>();
  for (const c of hiker.conditions) {
    for (const t of CONDITIONS[c.id]?.suppressTraits ?? []) off.add(t);
  }
  return off;
}

/** Every source affecting a hiker right now, the weather included (Storm's Thunder). */
export function effectSourcesFor(state: GameState, hiker: Hiker): EffectSource[] {
  const sources = thresholdSources(hiker);
  const weather = WEATHERS[state.weather?.today ?? 'clear'];
  if (weather?.hooks) {
    sources.push({
      id: `weather:${weather.id}`,
      kind: 'weather',
      name: weather.node?.name ?? weather.name,
      hooks: weather.hooks,
    });
  }
  const family = FAMILIES[hiker.family];
  if (family) {
    sources.push({
      id: `family:${hiker.family}`,
      kind: 'family',
      name: family.name,
      hooks: family.hooks,
    });
  }
  // Boosts before worn items, so a free block (a Star) comes before one that costs (Puffer Jacket).
  sources.push(...boostSources(state, hiker));
  sources.push(...shelterSources(state, hiker));
  for (const item of Object.values(hiker.inventory.equipped)) {
    const def = item && ITEMS[item.itemId];
    if (!item || !def) continue;
    sources.push({
      id: `item:${item.uid}`,
      kind: 'item',
      itemId: item.itemId,
      name: def.name,
      hooks: itemHooks(def, item),
    });
  }
  // Keep trinkets work while carried (Postcard, Textbook). TODO(wyatt): two of the same count once.
  const kept = new Set<ItemId>();
  for (const item of hiker.inventory.bag) {
    const def = ITEMS[item.itemId];
    if (def?.trinket !== 'keep' || !def.hooks || kept.has(item.itemId)) continue;
    kept.add(item.itemId);
    sources.push({
      id: `item:${item.uid}`,
      kind: 'item',
      itemId: item.itemId,
      name: def.name,
      hooks: def.hooks,
    });
  }
  for (const c of hiker.conditions) {
    const def = CONDITIONS[c.id];
    if (!def?.hooks) continue;
    sources.push({ id: `condition:${c.id}`, kind: 'condition', name: def.name, hooks: def.hooks });
  }
  sources.push(...borrowedConditions(state, hiker));
  const off = suppressedTraitTypes(hiker);
  for (const slot of hiker.slots) {
    // An unknown id (content removed since the save) is skipped, not fatal.
    const trait = workingTrait(state, slot);
    if (!trait || off.has(trait.def.type)) continue;
    const { runs, setting } = trait;
    sources.push({
      id: `trait:${trait.def.id}`,
      kind: 'trait',
      name: trait.name,
      hooks: traitHooks(runs, setting),
      ability: runs.ability,
    });
  }
  return sources;
}

/**
 * Does one of this hiker's own traits say yes to a flag? Read from the traits
 * alone, so it can be asked while working out another hiker's sources.
 */
function traitFlag(
  state: GameState,
  hiker: Hiker,
  flag: 'borrowsPositive' | 'lendsPositive',
): boolean {
  const off = suppressedTraitTypes(hiker);
  const ctx = queryContext(state, hiker);
  return hiker.slots.some((slot) => {
    const trait = workingTrait(state, slot);
    return (
      !!trait && !off.has(trait.def.type) && !!traitHooks(trait.runs, trait.setting)[flag]?.(ctx)
    );
  });
}

/**
 * Positive conditions shared on a tile: a Susceptible hiker has everyone's,
 * and everyone has a Transparent hiker's, while they share it. They work
 * through their hooks (Lucky's Luck, Refreshed); a stat change a condition
 * made when it started (Energized's +1) stays with its owner.
 * TODO(wyatt): shared conditions bring their effects, not their stat changes.
 */
function borrowedConditions(state: GameState, hiker: Hiker): EffectSource[] {
  if (hiker.status !== 'active') return [];
  const others = hikersOnTile(state, hiker.tileId).filter((o) => o.id !== hiker.id);
  if (!others.length) return [];
  const borrows = traitFlag(state, hiker, 'borrowsPositive');
  const own = new Set(hiker.conditions.map((c) => c.id));
  const out: EffectSource[] = [];
  for (const other of others) {
    if (!borrows && !traitFlag(state, other, 'lendsPositive')) continue;
    for (const c of other.conditions) {
      const def = CONDITIONS[c.id];
      if (def?.kind !== 'positive' || !def.hooks || own.has(c.id)) continue;
      own.add(c.id);
      out.push({
        id: `borrowed:${c.id}`,
        kind: 'condition',
        name: `${def.name} (from ${other.name})`,
        hooks: def.hooks,
      });
    }
  }
  return out;
}

/** An item's hooks, reading its own values at its Quality. */
function itemHooks(def: ItemDef, item: ItemInstance): Hooks {
  if (!def.hooksAt) return def.hooks ?? {};
  const quality = def.fixedQuality ?? item.quality ?? 3;
  return { ...def.hooks, ...def.hooksAt((key) => valueAt(def.values?.[key], quality), item) };
}

/** An item a hiker wears or carries, by uid. */
function findCarried(hiker: Hiker, uid: string): ItemInstance | undefined {
  return (
    Object.values(hiker.inventory.equipped).find((i) => i?.uid === uid) ??
    hiker.inventory.bag.find((i) => i.uid === uid)
  );
}

// ── Contexts ───────────────────────────────────────────────────────────────

export function queryContext(state: GameState, self: Hiker): QueryContext {
  return {
    state,
    self,
    hikersOnTile: (tileId) => hikersOnTile(state, tileId),
    isAlone: (hiker) => isAlone(state, hiker),
    sheltered: (hiker) => isSheltered(state, hiker),
    clothesWorn,
    condition: (hiker, id) => hiker.conditions.find((c) => c.id === id),
    used: (hiker, key, per) => readTally(state, hiker, key, per),
    distance: (a, b) => tileDistance(state.section, a, b),
    boost: (abilityId) => {
      const out = { reach: 0, items: false };
      const ctx = queryContext(state, self);
      for (const s of effectSourcesFor(state, self)) {
        const b = s.hooks.abilityBoost?.(abilityId, ctx);
        if (!b) continue;
        out.reach = Math.max(out.reach, b.reach ?? 0);
        out.items ||= !!b.items;
      }
      return out;
    },
    canMoveAlone: () => {
      const ctx = queryContext(state, self);
      return effectSourcesFor(state, self).some((s) => s.hooks.movesAlone?.(ctx));
    },
  };
}

/** Clothing items a hiker has equipped (Phase 8 adds the ways to put them on). */
export function clothesWorn(hiker: Hiker): number {
  return Object.values(hiker.inventory.equipped).filter(
    (i) => i && ITEMS[i.itemId]?.type === 'clothes',
  ).length;
}

export function effectContext(state: GameState, self: Hiker): EffectContext {
  return {
    ...queryContext(state, self),
    changeStat: (hiker, stat, delta, cause, why) =>
      changeStat(state, hiker, stat, delta, cause, why ? { why } : {}),
    gain: (hiker, resources, cause) => gainResources(state, hiker, resources, cause),
    addCondition: (hiker, id, remaining, unit, cause) =>
      addCondition(state, hiker, id, remaining, unit, cause),
    addStacks: (hiker, id, n, cause) => addStacks(state, hiker, id, n, cause),
    wearItem: (hiker, uid, n, cause) => {
      const item = findCarried(hiker, uid);
      if (item) loseDurability(state, hiker, item, n, cause);
    },
    heal: (hiker, n, cause) => cureInjuries(state, hiker, n, cause),
    breakItem: (hiker, uid, cause) => {
      const item = findCarried(hiker, uid);
      if (!item) return;
      removeItem(hiker, uid);
      noteGone(state, item.itemId);
      pushEvent(state, {
        kind: 'itemGone',
        hikerId: hiker.id,
        itemId: item.itemId,
        why: 'broke',
        cause,
      });
    },
    tally: (hiker, key, add, per) => tally(state, hiker, key, add, per),
    roll: (chance) => roll(state.rng, chance),
    int: (min, max) => int(state.rng, min, max),
    pick: (items) => pick(state.rng, items),
    note: (hiker, trait, text) =>
      pushEvent(state, { kind: 'trait', hikerId: hiker.id, trait, text }),
    tilesAhead: () => tilesAhead(state),
    revealAhead: (tileId, cause) => revealAhead(state, tileId, cause),
    takeCondition: (from, to, id, cause) => takeCondition(state, from, to, id, cause),
    spendResources: (hiker, ids, cause) => {
      for (const id of ids) {
        const left = (hiker.inventory.resources[id] ?? 0) - 1;
        if (left > 0) hiker.inventory.resources[id] = left;
        else delete hiker.inventory.resources[id];
      }
      if (ids.length) {
        pushEvent(state, {
          kind: 'lost',
          hikerId: hiker.id,
          resources: [...ids],
          items: [],
          cause,
        });
      }
    },
    useAction: (hiker) => {
      hiker.acted = true;
    },
    take: (from, to, thing, cause) => {
      if ('resource' in thing) {
        const have = from.inventory.resources[thing.resource] ?? 0;
        const carried = Object.values(to.inventory.resources).reduce<number>(
          (n, c) => n + (c ?? 0),
          0,
        );
        if (have < 1 || carried >= resourceLimit(state, to)) return;
        if (have > 1) from.inventory.resources[thing.resource] = have - 1;
        else delete from.inventory.resources[thing.resource];
        to.inventory.resources[thing.resource] = (to.inventory.resources[thing.resource] ?? 0) + 1;
        pushEvent(state, {
          kind: 'give',
          fromId: from.id,
          toId: to.id,
          resource: thing.resource,
          taken: true,
        });
      } else {
        const i = from.inventory.bag.findIndex((x) => x.uid === thing.itemUid);
        const item = from.inventory.bag[i];
        if (!item || to.inventory.bag.length >= bagSlots(state, to).total) return;
        from.inventory.bag.splice(i, 1);
        to.inventory.bag.push(item);
        pushEvent(state, {
          kind: 'give',
          fromId: from.id,
          toId: to.id,
          itemId: item.itemId,
          taken: true,
        });
      }
      pushEvent(state, {
        kind: 'trait',
        hikerId: to.id,
        trait: cause,
        text: `${to.name} fetched it from ${from.name}.`,
      });
    },
    refundAction: (hiker, cause) => {
      if (!hiker.acted) return;
      hiker.acted = false;
      pushEvent(state, { kind: 'freeAction', hikerId: hiker.id, cause });
    },
    cure: (hiker, id, cause) => {
      if (!hiker.conditions.some((c) => c.id === id)) return;
      removeCondition(state, hiker, id);
      pushEvent(state, {
        kind: 'trait',
        hikerId: hiker.id,
        trait: cause,
        text: `${hiker.name} is rid of ${CONDITIONS[id]?.name ?? id}.`,
      });
    },
    giveItem: (hiker, itemId, cause) => {
      if (hiker.inventory.bag.length >= bagSlots(state, hiker).total) return;
      hiker.inventory.bag.push(makeItem(state, itemId, { prefix: 'trait' }));
      pushEvent(state, {
        kind: 'gained',
        hikerId: hiker.id,
        resources: [],
        items: [itemId],
        cause,
      });
    },
    gainXp: (hiker, xp, cause) => {
      gainXp(state, hiker, xp, 'trait', cause);
    },
    shareXp: (hiker, xp, cause) => {
      gainXp(state, hiker, xp, 'shared', cause);
    },
    gainCaps: (n, cause) => {
      const got = gainCaps(state, n);
      if (got > 0) {
        pushEvent(state, { kind: 'trait', hikerId: self.id, trait: cause, text: `+${got} caps.` });
      }
    },
    rerollCard: (tileId, cause) => {
      const tile = state.section.tiles[tileId];
      if (!tile?.revealedCard) return;
      delete tile.revealedCard;
      revealCardOn(state, tileId, cause);
    },
    evenOut: (hikers, stat, cause) => {
      if (!hikers.length) return;
      const avg = Math.floor(hikers.reduce((n, h) => n + h.stats[stat], 0) / hikers.length);
      for (const h of hikers) shiftStat(state, h, stat, avg - h.stats[stat], cause);
    },
    shortenCondition: (hiker, id, by, cause) => shortenCondition(state, hiker, id, by, cause),
    askTilePick: (hiker) => {
      if (!state.tacticalPicks?.includes(hiker.id)) {
        state.tacticalPicks = [...(state.tacticalPicks ?? []), hiker.id];
      }
    },
  };
}

/** A tally's count now, without adding to it. */
function readTally(
  state: Readonly<GameState>,
  hiker: Hiker,
  key: string,
  per: 'phase' | 'day' | 'biome',
): number {
  const use = hiker.abilityUses[`tally:${key}`];
  return use && use.period === abilityPeriod(state, per) ? use.count : 0;
}

/** A per-hiker count that starts over each phase, day or biome, kept with the ability uses. */
export function tally(
  state: GameState,
  hiker: Hiker,
  key: string,
  add: number,
  per: 'phase' | 'day' | 'biome',
): number {
  const id = `tally:${key}`;
  const period = abilityPeriod(state, per);
  const use = hiker.abilityUses[id];
  const count = (use && use.period === period ? use.count : 0) + add;
  if (add !== 0) hiker.abilityUses[id] = { period, count };
  return count;
}

// ── Modifiers ──────────────────────────────────────────────────────────────

const EPSILON = 1e-9;

/**
 * Flat amounts first, then percentages. Fractions round in the player's
 * favor: costs round down (never below 0), gains round up.
 */
export function applyModifiers(
  base: number,
  modifiers: readonly Modifier[],
  direction: 'cost' | 'gain',
): number {
  let value = base;
  for (const m of modifiers) value += m.flat ?? 0;
  const percents = modifiers.map((m) => m.percent ?? 0).filter((p) => p !== 0);
  if (BALANCE.rules.percentModifiersMultiply) {
    for (const p of percents) value *= 1 + p / 100;
  } else {
    value *= 1 + percents.reduce((sum, p) => sum + p, 0) / 100;
  }
  const rounded = direction === 'cost' ? Math.floor(value + EPSILON) : Math.ceil(value - EPSILON);
  return Math.max(0, rounded);
}

function asList(result: ModifierResult): Modifier[] {
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

/** A cost after every modifier from the given hikers' sources. */
export function computeCost(
  state: GameState,
  owners: readonly Hiker[],
  q: CostQuery,
  base: number,
): number {
  const mods: Modifier[] = [];
  for (const owner of owners) {
    const ctx = queryContext(state, owner);
    for (const source of effectSourcesFor(state, owner)) {
      mods.push(...asList(source.hooks.modifyCost?.(q, ctx)));
    }
  }
  return applyModifiers(base, mods, 'cost');
}

/**
 * A gain after every modifier from the given hikers' sources, and from
 * anyone else on the subject's tile who changes others' gains (Snores).
 */
export function computeGain(
  state: GameState,
  owners: readonly Hiker[],
  q: GainQuery,
  base: number,
): number {
  const mods: Modifier[] = [];
  for (const owner of owners) {
    const ctx = queryContext(state, owner);
    for (const source of effectSourcesFor(state, owner)) {
      mods.push(...asList(source.hooks.modifyGain?.(q, ctx)));
    }
  }
  const subject = state.hikers.find((h) => h.id === q.subjectId);
  if (subject && subject.status === 'active') {
    for (const other of hikersOnTile(state, subject.tileId)) {
      if (other.id === subject.id) continue;
      const ctx = queryContext(state, other);
      for (const source of effectSourcesFor(state, other)) {
        mods.push(...asList(source.hooks.modifyTileGain?.(q, ctx)));
      }
    }
  }
  return applyModifiers(base, mods, 'gain');
}

/** Every change the hiker's sources make to crafting this type here. */
export function craftModifiers(state: GameState, hiker: Hiker, q: CraftQuery): CraftModifier[] {
  const ctx = queryContext(state, hiker);
  const out: CraftModifier[] = [];
  for (const source of effectSourcesFor(state, hiker)) {
    const result = source.hooks.modifyCraft?.(q, ctx);
    if (result) out.push(...(Array.isArray(result) ? result : [result]));
  }
  // Others on the tile can help too (Lucky Charm).
  for (const other of tileCompany(state, hiker)) {
    const octx = queryContext(state, other);
    for (const source of effectSourcesFor(state, other)) {
      const m = source.hooks.modifyTileCraft?.(q, hiker, octx);
      if (m) out.push(m);
    }
  }
  return out;
}

/** Everyone else on a hiker's tile, still hiking or checked in together at the station. */
function tileCompany(state: GameState, hiker: Hiker): Hiker[] {
  return state.hikers.filter(
    (h) =>
      h.id !== hiker.id &&
      h.tileId === hiker.tileId &&
      (h.status === 'active' || h.status === 'checkedIn'),
  );
}

/** A hiker crafted an item: their own sources hear of it, then everyone on the tile's. */
export function fireCraft(
  state: GameState,
  crafter: Hiker,
  itemId: ItemId,
  type: ItemType,
  extra: { item?: ItemInstance; paid?: readonly ResourceId[] } = {},
): void {
  const own = effectContext(state, crafter);
  for (const source of effectSourcesFor(state, crafter))
    source.hooks.onCraft?.({ itemId, type, ...extra }, own);
  for (const hiker of hikersOnTile(state, crafter.tileId)) {
    if (hiker.status !== 'active') continue;
    const ctx = effectContext(state, hiker);
    for (const source of effectSourcesFor(state, hiker)) {
      source.hooks.onTileCraft?.({ crafterId: crafter.id, itemId, type }, ctx);
    }
  }
}

/** Every change the hiker's sources make to a scavenge on this tile. */
export function scavengeModifiers(
  state: GameState,
  hiker: Hiker,
  q: ScavengeQuery,
): ScavengeModifier[] {
  const ctx = queryContext(state, hiker);
  const out: ScavengeModifier[] = [];
  for (const source of effectSourcesFor(state, hiker)) {
    const result = source.hooks.modifyScavenge?.(q, ctx);
    if (result) out.push(...(Array.isArray(result) ? result : [result]));
  }
  // Others on the tile can help too (Dog Whisperer, Lucky Charm).
  for (const other of tileCompany(state, hiker)) {
    const octx = queryContext(state, other);
    for (const source of effectSourcesFor(state, other)) {
      const m = source.hooks.modifyTileScavenge?.(q, hiker, octx);
      if (m) out.push(m);
    }
  }
  return out;
}

/** The first reason any of the hiker's sources gives for stopping this action. */
export function canActReason(state: GameState, hiker: Hiker, q: ActQuery): string | undefined {
  const ctx = queryContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) {
    const reason = source.hooks.canAct?.(q, ctx);
    if (reason) return reason;
  }
  return undefined;
}

/** Does anything stop this negative condition reaching the hiker (their own, or someone on their tile)? */
export function blocksCondition(state: GameState, hiker: Hiker, id: string): boolean {
  const ctx = effectContext(state, hiker);
  if (effectSourcesFor(state, hiker).some((s) => s.hooks.blockCondition?.(id, ctx))) return true;
  return hikersOnTile(state, hiker.tileId).some((other) => {
    const octx = queryContext(state, other);
    return effectSourcesFor(state, other).some((s) =>
      s.hooks.blockTileCondition?.(id, hiker, octx),
    );
  });
}

/** Does someone on this hiker's tile keep night events off their food and resources (Mouser)? */
export function suppliesGuarded(state: GameState, hiker: Hiker): boolean {
  return hikersOnTile(state, hiker.tileId).some((other) => {
    const ctx = queryContext(state, other);
    return effectSourcesFor(state, other).some((s) => s.hooks.guardsSupplies?.(ctx));
  });
}

/** Someone slept: everyone else on their tile hears of it (Cuddle Buddy). */
export function fireTileSleep(state: GameState, sleeper: Hiker): void {
  for (const other of hikersOnTile(state, sleeper.tileId)) {
    if (other.id === sleeper.id) continue;
    const ctx = effectContext(state, other);
    for (const s of effectSourcesFor(state, other))
      s.hooks.onTileSleep?.({ sleeperId: sleeper.id }, ctx);
  }
}

/** A yes-or-no hook across a hiker's own sources. */
export function hikerHas(
  state: GameState,
  hiker: Hiker,
  hook: 'bringsActed' | 'takesGroupHarm' | 'ignoresBadFood',
): boolean {
  const ctx = queryContext(state, hiker);
  return effectSourcesFor(state, hiker).some((s) => s.hooks[hook]?.(ctx));
}

/** How much less a challenge on this tile asks for, from someone there (Easy Mode). */
export function challengeEase(state: GameState, tileId: TileId): number {
  let most = 0;
  for (const h of hikersOnTile(state, tileId)) {
    const ctx = queryContext(state, h);
    for (const s of effectSourcesFor(state, h))
      most = Math.max(most, s.hooks.easesChallenges?.(ctx) ?? 0);
  }
  return most;
}

/** The hiker put on clothes (Stylish). */
export function fireEquip(state: GameState, hiker: Hiker, item: ItemInstance): void {
  const ctx = effectContext(state, hiker);
  for (const s of effectSourcesFor(state, hiker)) s.hooks.onEquip?.({ item }, ctx);
}

/** The hiker gave something to someone (Gracie's day counts a far give). */
export function fireGive(state: GameState, giver: Hiker, toId: HikerId, distance: number): void {
  const ctx = effectContext(state, giver);
  for (const s of effectSourcesFor(state, giver)) s.hooks.onGive?.({ toId, distance }, ctx);
}

/** Does anything stop this injury reaching the hiker? */
export function blocksInjury(state: GameState, hiker: Hiker, cause: string): boolean {
  const ctx = effectContext(state, hiker);
  return effectSourcesFor(state, hiker).some((s) => s.hooks.blockInjury?.(cause, ctx));
}

/** Can this hiker trade with any hiker on any tile right now (Walkie-Talkie)? */
export function tradesAnywhere(state: GameState, hiker: Hiker): boolean {
  const ctx = queryContext(state, hiker);
  return effectSourcesFor(state, hiker).some((s) => s.hooks.tradeAnywhere?.(ctx));
}

/** The item keeping this hiker safe from night events whatever their tile (Bear Spray). */
export function nightSafeItem(state: GameState, hiker: Hiker): ItemId | undefined {
  const ctx = queryContext(state, hiker);
  const source = effectSourcesFor(state, hiker).find((s) => s.hooks.nightSafe?.(ctx));
  return source?.itemId;
}

// ── Trail trait questions (Phase 10a) ──────────────────────────────────────

/** Does being brought along by a Move All keep this hiker's action (Follower)? */
export function keepsActionWhenBrought(state: GameState, hiker: Hiker): EffectSource | undefined {
  const ctx = queryContext(state, hiker);
  return effectSourcesFor(state, hiker).find((s) => s.hooks.keepsActionWhenBrought?.(ctx));
}

/** The free moves this hiker's traits give for a move between these tiles, unused so far. */
export function traitFreeMoves(
  state: GameState,
  hiker: Hiker,
  fromTileId: TileId,
  toTileId: TileId,
): { source: string; move: TraitFreeMove }[] {
  const ctx = queryContext(state, hiker);
  const out: { source: string; move: TraitFreeMove }[] = [];
  for (const source of effectSourcesFor(state, hiker)) {
    const move = source.hooks.freeMove?.({ fromTileId, toTileId }, ctx);
    if (move && ctx.used(hiker, move.key, move.per) === 0) out.push({ source: source.name, move });
  }
  return out;
}

/** Does something waive the Appetite of this cost (Never Hungry's chance)? Rolls now. */
export function waivesAppetite(state: GameState, hiker: Hiker, cause: string): string | undefined {
  const ctx = effectContext(state, hiker);
  return effectSourcesFor(state, hiker).find((s) => s.hooks.waiveAppetite?.({ cause }, ctx))?.name;
}

/**
 * Does the hiker leading a Move All make one hiker's part of it free (Just
 * Around the Next Corner)? Rolls now, once for each hiker in the group.
 */
export function waivesForGroup(
  state: GameState,
  leader: Hiker,
  payerId: HikerId,
): string | undefined {
  const ctx = effectContext(state, leader);
  return effectSourcesFor(state, leader).find((s) => s.hooks.waiveForGroup?.({ payerId }, ctx))
    ?.name;
}

/** How far a hiker can hand this kind of thing over, as sender or receiver (0: same tile). */
export function giveReach(
  state: GameState,
  hiker: Hiker,
  what: 'item' | 'resource',
  role: 'sender' | 'receiver',
): number {
  const ctx = queryContext(state, hiker);
  let best = 0;
  for (const s of effectSourcesFor(state, hiker)) {
    best = Math.max(best, s.hooks.giveReach?.({ what, role }, ctx) ?? 0);
  }
  return best;
}

/** The largest of a numeric hook across a hiker's sources (0 when none). */
function mostOf(state: GameState, hiker: Hiker, hook: 'watchReach' | 'bringReach'): number {
  const ctx = queryContext(state, hiker);
  let best = 0;
  for (const s of effectSourcesFor(state, hiker)) best = Math.max(best, s.hooks[hook]?.(ctx) ?? 0);
  return best;
}

/** How many lines away this hiker's watch reaches (0: their own tile) (Lookout). */
export const watchReach = (state: GameState, hiker: Hiker) => mostOf(state, hiker, 'watchReach');

/** How many tiles away Move All can bring hikers from (0: the same tile) (Sherpa). */
export const bringReach = (state: GameState, hiker: Hiker) => mostOf(state, hiker, 'bringReach');

/** The Energy a hiker's Move All costs instead of Appetite, if anything says so (Puller). */
export function pullsGroup(
  state: GameState,
  hiker: Hiker,
): { energy: number; source: string } | undefined {
  const ctx = queryContext(state, hiker);
  for (const s of effectSourcesFor(state, hiker)) {
    const energy = s.hooks.pullsGroup?.(ctx);
    if (energy !== undefined) return { energy, source: s.name };
  }
  return undefined;
}

/** Are the nodes around this hiker shown (Scout)? */
export function revealsAdjacent(state: GameState, hiker: Hiker): boolean {
  const ctx = queryContext(state, hiker);
  return effectSourcesFor(state, hiker).some((s) => s.hooks.revealsAdjacent?.(ctx));
}

/** Does no card trigger for this hiker right now (Trespasser)? */
export function skipsChallenges(state: GameState, hiker: Hiker): boolean {
  const ctx = queryContext(state, hiker);
  return effectSourcesFor(state, hiker).some((s) => s.hooks.skipsChallenges?.(ctx));
}

/** A new biome has begun: every hiker still hiking hears of it (Prepared, Tactical). */
export function fireBiomeStart(state: GameState): void {
  for (const hiker of state.hikers) {
    if (hiker.status !== 'active') continue;
    const ctx = effectContext(state, hiker);
    for (const source of effectSourcesFor(state, hiker)) source.hooks.onBiomeStart?.(ctx);
  }
}

// ── Utility trait questions (Phase 10a) ────────────────────────────────────

/**
 * A hiker took a scavenge card: their own sources hear of it (Pockets,
 * Generous), then everyone else on the tile (Dog Mom).
 */
export function fireScavenged(
  state: GameState,
  hiker: Hiker,
  e: { tileId: TileId; node?: NodeType },
): void {
  const own = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onScavenged?.(e, own);
  for (const other of hikersOnTile(state, e.tileId)) {
    if (other.id === hiker.id) continue;
    const ctx = effectContext(state, other);
    for (const source of effectSourcesFor(state, other)) {
      source.hooks.onTileScavenged?.({ scavengerId: hiker.id, ...e }, ctx);
    }
  }
}

/** A hiker used a tool (German Efficiency). */
export function fireToolUse(state: GameState, hiker: Hiker, itemId: ItemId): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onToolUse?.({ itemId }, ctx);
}

/**
 * A hiker Sits by the Fire: 1 XP (action XP, under the row rule), then the
 * traits that listen (Singer, Chatty, Storyteller, Comedian).
 * TODO(wyatt): the action is still held (the grid shows it as "soon"), so
 * nothing calls this in play yet; only tests do.
 */
export function fireSitByFire(state: GameState, hiker: Hiker): void {
  gainXp(state, hiker, BALANCE.xp.fire, 'fire', 'Sat by the fire');
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onSitByFire?.(ctx);
}

/** The stat a night without sleep costs this hiker (Energy, or Appetite for a Nocturnal one). */
export function noSleepStat(state: GameState, hiker: Hiker): StatName {
  const ctx = queryContext(state, hiker);
  for (const s of effectSourcesFor(state, hiker)) {
    const stat = s.hooks.noSleepStat?.(ctx);
    if (stat) return stat;
  }
  return 'energy';
}

/** Can this hiker Sleep in the day (Day Napper)? */
export function sleepsByDay(state: GameState, hiker: Hiker): boolean {
  const ctx = queryContext(state, hiker);
  return effectSourcesFor(state, hiker).some((s) => s.hooks.sleepsByDay?.(ctx));
}

/** The highest tier a hiker's traits let them craft this type at (0 for none). */
export function traitCraftTier(state: GameState, hiker: Hiker, type: ItemType): number {
  const ctx = queryContext(state, hiker);
  let best = 0;
  for (const s of effectSourcesFor(state, hiker))
    best = Math.max(best, s.hooks.craftTier?.(type, ctx) ?? 0);
  return best;
}

/** Does anyone in the party make one item at each shop free (Thrifty)? */
export function partyGetsFreeItem(state: GameState): boolean {
  return state.hikers.some((h) => {
    if (h.status !== 'active' && h.status !== 'checkedIn') return false;
    const ctx = queryContext(state, h);
    return effectSourcesFor(state, h).some((s) => s.hooks.freeShopItem?.(ctx));
  });
}

// ── Events ─────────────────────────────────────────────────────────────────

export function fireHook(state: GameState, hiker: Hiker, name: EventHookName): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks[name]?.(ctx);
}

export function fireMove(state: GameState, hiker: Hiker, e: MoveHookEvent): void {
  // Remembered for the traits about staying put or not moving (Slow and Steady, Wanderlust).
  tally(state, hiker, 'moved', 1, 'phase');
  hiker.lastMovedDay = state.day;
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onMove?.(e, ctx);
  fireAction(state, hiker, { kind: 'move', role: e.role, tileId: e.to });
}

/** A hiker did something: their own sources hear of it (Action, Traveler, Simple Pleasures). */
export function fireAction(state: GameState, hiker: Hiker, e: ActionHookEvent): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onAction?.(e, ctx);
}

/**
 * A challenge was passed or failed by these hikers: everyone on the tile
 * hears of it (Thrill-Seeker for their own, Soccer Mom for anyone's).
 */
export function fireChallengeResult(
  state: GameState,
  tileId: TileId,
  e: { passed: boolean; hikerIds: readonly HikerId[] },
): void {
  for (const hiker of hikersOnTile(state, tileId)) {
    const ctx = effectContext(state, hiker);
    for (const source of effectSourcesFor(state, hiker)) source.hooks.onChallengeResult?.(e, ctx);
  }
}

/** The total change to a stat change from the hiker's sources. A blocked loss becomes 0. */
export function adjustStatChange(state: GameState, hiker: Hiker, q: StatChangeQuery): number {
  const ctx = queryContext(state, hiker);
  let delta = q.delta;
  let blocked = false;
  const take = (m: StatChangeModifier | undefined) => {
    if (!m) return;
    delta += m.add ?? 0;
    if (m.blockLoss) blocked = true;
  };
  for (const source of effectSourcesFor(state, hiker))
    take(source.hooks.modifyStatChange?.(q, ctx));
  // Someone on the tile can change it too (Show Girl).
  if (hiker.status === 'active') {
    for (const other of hikersOnTile(state, hiker.tileId)) {
      const octx = queryContext(state, other);
      for (const source of effectSourcesFor(state, other)) {
        take(source.hooks.modifyTileStatChange?.({ ...q, target: hiker }, octx));
      }
    }
  }
  // Adding can't flip a loss into a gain, or the other way.
  if (q.delta < 0) delta = Math.min(0, delta);
  if (q.delta > 0) delta = Math.max(0, delta);
  return blocked && delta < 0 ? 0 : delta;
}

/** Every change the hiker's sources make to a stat's maximum. */
export function statMaxModifiers(
  state: GameState,
  hiker: Hiker,
  stat: StatName,
): StatMaxModifier[] {
  const ctx = queryContext(state, hiker);
  const out: StatMaxModifier[] = [];
  for (const source of effectSourcesFor(state, hiker)) {
    const m = source.hooks.modifyStatMax?.(stat, ctx);
    if (m) out.push(m);
  }
  return out;
}

export function fireStatChange(
  state: GameState,
  hiker: Hiker,
  e: { stat: StatName; from: number; to: number; cause: string },
): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onStatChange?.(e, ctx);
}

/** A new phase has started (Dog Socks, Sleepy Socks). Active hikers only. */
export function firePhaseStart(state: GameState): void {
  for (const hiker of state.hikers) {
    if (hiker.status !== 'active') continue;
    const ctx = effectContext(state, hiker);
    for (const source of effectSourcesFor(state, hiker)) {
      source.hooks.onPhaseStart?.({ phase: state.phase }, ctx);
    }
  }
}

/** A hiker took a scavenge card (Jeans and Pajamas wear). */
export function fireScavenge(state: GameState, hiker: Hiker, tileId: TileId): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onScavenge?.({ tileId }, ctx);
}

/** Someone ate a bite: every hiker on their tile hears of it (Soup Socks). */
export function fireTileEat(state: GameState, eater: Hiker, itemId: ItemId): void {
  for (const hiker of hikersOnTile(state, eater.tileId)) {
    if (hiker.status !== 'active') continue;
    const ctx = effectContext(state, hiker);
    for (const source of effectSourcesFor(state, hiker)) {
      source.hooks.onTileEat?.({ eaterId: eater.id, itemId }, ctx);
    }
  }
}

/** How much less likely a hiker is to be hit tonight, from anyone on their tile (Disco Harness). */
export function nightShield(state: GameState, hiker: Hiker): number {
  let best = 0;
  for (const other of hikersOnTile(state, hiker.tileId)) {
    const ctx = queryContext(state, other);
    for (const source of effectSourcesFor(state, other)) {
      best = Math.max(best, source.hooks.nightShield?.(ctx) ?? 0);
    }
  }
  return Math.min(100, best);
}

export function firePhaseEnd(state: GameState, hiker: Hiker, phase: Phase): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onPhaseEnd?.({ phase }, ctx);
}

export function fireMoraleChange(state: GameState, hiker: Hiker, delta: number, cause: string) {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) {
    source.hooks.onMoraleChange?.({ delta, cause }, ctx);
  }
}

// ── Abilities ──────────────────────────────────────────────────────────────

/**
 * The key that resets an ability's use count each day, phase or biome. A
 * biome is a section of the trail, so per-biome uses come back at each new section.
 */
export function abilityPeriod(state: Readonly<GameState>, per: AbilityDef['limit']['per']): string {
  if (per === 'day') return `day ${state.day}`;
  if (per === 'phase') return `day ${state.day} ${state.phase}`;
  return `section ${state.sectionIndex}`;
}

export interface AvailableAbility {
  ability: AbilityDef;
  sourceName: string;
  usesLeft: number;
  /** Its choices now: fixed ones, or ones that depend on the moment. */
  choices?: readonly AbilityChoice[];
}

/** The hiker's active traits with their uses left, for the Abilities panel. */
export function abilitiesFor(state: GameState, hiker: Hiker): AvailableAbility[] {
  const out: AvailableAbility[] = [];
  for (const source of effectSourcesFor(state, hiker)) {
    const ability = source.ability;
    if (!ability) continue;
    const use = hiker.abilityUses[ability.id];
    const period = abilityPeriod(state, ability.limit.per);
    const used = use && use.period === period ? use.count : 0;
    const choices = ability.choicesFor?.(queryContext(state, hiker)) ?? ability.choices;
    out.push({
      ability,
      sourceName: source.name,
      usesLeft: Math.max(0, ability.limit.uses - used),
      ...(choices ? { choices } : {}),
    });
  }
  return out;
}

/** Adds resources to a hiker's pack, as many as fit, and logs what they got. */
export function gainResources(
  state: GameState,
  hiker: Hiker,
  resources: readonly ResourceId[],
  cause: string,
): void {
  const carried = Object.values(hiker.inventory.resources).reduce<number>(
    (n, c) => n + (c ?? 0),
    0,
  );
  let room = resourceLimit(state, hiker) - carried;
  const got: ResourceId[] = [];
  for (const id of resources) {
    if (room <= 0) break;
    hiker.inventory.resources[id] = (hiker.inventory.resources[id] ?? 0) + 1;
    got.push(id);
    room -= 1;
  }
  const noRoom = resources.length - got.length;
  if (got.length || noRoom > 0) {
    pushEvent(state, {
      kind: 'gained',
      hikerId: hiker.id,
      resources: got,
      items: [],
      ...(noRoom > 0 ? { noRoom } : {}),
      cause,
    });
  }
}

/**
 * The party gains caps. Each gain can be bigger (Fancy Attire: +1, from any
 * hiker on the trail wearing it). Returns how many were gained.
 */
export function gainCaps(state: GameState, n: number): number {
  if (n <= 0) return 0;
  const party = state.hikers.filter((h) => h.status === 'active' || h.status === 'passedOut');
  const first = party[0];
  const total = first
    ? computeGain(
        state,
        party,
        { key: 'caps', actorId: first.id, subjectId: first.id, role: 'actor', phase: state.phase },
        n,
      )
    : n;
  // Each Wallet used adds to every gain, for good.
  const withWallets = total + (state.capsBonus ?? 0);
  state.caps += withWallets;
  return withWallets;
}
