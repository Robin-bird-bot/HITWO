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
import { addCondition, addStacks } from './conditions';
import { pushEvent } from './log';
import { hikersOnTile, isAlone, isSheltered } from './map';
import { int, pick, roll } from './rng';
import { changeStat, cureInjuries } from './stats';
import { thresholdSources } from './thresholds';
import { resourceLimit } from './inventory';
import { boostSources } from './items/boosts';
import { shelterSources } from './items/shelters';
import { loseDurability, removeItem } from './items/wear';
import { valueAt, type QualityValues } from './items/quality';
import type { Recipe } from './items/recipe';
import type {
  Action,
  ConditionInstance,
  ConditionUnit,
  EquipSlot,
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
  StatName,
  TileId,
  TraitType,
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
  | 'endOfDay.appetite'
  /** Scavenging: the Appetite paid when a card is taken (with the night extra). */
  | 'scavenge.appetite'
  /** Tend's Energy cost. */
  | 'tend.energy';

/** Amounts a hiker gains. Modified totals round up. */
export type GainKey =
  | 'sleep.energy'
  /** Appetite from a bite of food (Food Poisoning takes 2 off it). */
  | 'eat.appetite'
  /** Abundance restored by Tend (the Thumbs and Maintenance add to it). */
  | 'tend.abundance'
  /** Caps the party gains, each time (Fancy Attire: +1). */
  | 'caps';

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
}

/** What an event handler or ability can do. */
export interface EffectContext extends QueryContext {
  changeStat(hiker: Hiker, stat: StatName, delta: number, cause: string): void;
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
  tally(hiker: Hiker, key: string, add: number, per: 'phase' | 'day'): number;
  roll(chance: number): boolean;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

// ── Hooks, abilities and sources ───────────────────────────────────────────

type ModifierResult = Modifier | Modifier[] | undefined;

export interface MoveHookEvent {
  from: TileId;
  to: TileId;
  role: Role;
  line: Line;
  /** The Move action, or Move All. */
  via: 'move' | 'moveAll';
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
  /** The hiker crafted an item. */
  onCraft?(e: { itemId: ItemId; type: ItemType }, ctx: EffectContext): void;
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
  /** Used in the scavenge window to reroll a card (Gambler), not from the Abilities panel. */
  scavengeReroll?: true;
  validate?(ctx: QueryContext, choice: string | undefined): string | undefined;
  apply(ctx: EffectContext, choice: string | undefined): void;
}

export interface TraitDef {
  id: string;
  name: string;
  type: TraitType;
  /** Trail and Utility traits have a tier; Morale traits don't. */
  tier: 1 | 2 | 3 | null;
  /** The exact wording from the design doc. */
  text: string;
  hooks?: Hooks;
  ability?: AbilityDef;
  placeholder?: boolean;
}

export type ItemType = 'tool' | 'clothes' | 'food' | 'shelter' | 'trinket';

/**
 * What using an item does to its target (Phase 7: the medical items). A use
 * that would do nothing is refused. TODO(phase 8): every item's use (step 3).
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
  /** Nodes on the tile gain Abundance: one at random, or every one. */
  abundance?: { value: string; which: 'random' | 'all' };
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
  for (const c of hiker.conditions) {
    const def = CONDITIONS[c.id];
    if (!def?.hooks) continue;
    sources.push({ id: `condition:${c.id}`, kind: 'condition', name: def.name, hooks: def.hooks });
  }
  const off = suppressedTraitTypes(hiker);
  for (const slot of hiker.slots) {
    if (!slot.traitId) continue;
    const def = TRAITS[slot.traitId];
    // An unknown id (content removed since the save) is skipped, not fatal.
    if (!def || off.has(def.type)) continue;
    sources.push({
      id: `trait:${def.id}`,
      kind: 'trait',
      name: def.name,
      hooks: def.hooks ?? {},
      ability: def.ability,
    });
  }
  return sources;
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
    changeStat: (hiker, stat, delta, cause) => changeStat(state, hiker, stat, delta, cause),
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
  };
}

/** A per-hiker count that starts over each phase or day, kept with the ability uses. */
export function tally(
  state: GameState,
  hiker: Hiker,
  key: string,
  add: number,
  per: 'phase' | 'day',
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

/** A gain after every modifier from the given hikers' sources. */
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
  return out;
}

/** A hiker crafted an item: their own sources hear of it, then everyone on the tile's. */
export function fireCraft(state: GameState, crafter: Hiker, itemId: ItemId, type: ItemType): void {
  const own = effectContext(state, crafter);
  for (const source of effectSourcesFor(state, crafter))
    source.hooks.onCraft?.({ itemId, type }, own);
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

/** Does anything stop this negative condition reaching the hiker? */
export function blocksCondition(state: GameState, hiker: Hiker, id: string): boolean {
  const ctx = effectContext(state, hiker);
  return effectSourcesFor(state, hiker).some((s) => s.hooks.blockCondition?.(id, ctx));
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

// ── Events ─────────────────────────────────────────────────────────────────

export function fireHook(state: GameState, hiker: Hiker, name: EventHookName): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks[name]?.(ctx);
}

export function fireMove(state: GameState, hiker: Hiker, e: MoveHookEvent): void {
  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker)) source.hooks.onMove?.(e, ctx);
}

/** The total change to a stat change from the hiker's sources. A blocked loss becomes 0. */
export function adjustStatChange(state: GameState, hiker: Hiker, q: StatChangeQuery): number {
  const ctx = queryContext(state, hiker);
  let delta = q.delta;
  let blocked = false;
  for (const source of effectSourcesFor(state, hiker)) {
    const m = source.hooks.modifyStatChange?.(q, ctx);
    if (!m) continue;
    delta += m.add ?? 0;
    if (m.blockLoss) blocked = true;
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

/** The key that resets an ability's use count each day, phase or biome. */
export function abilityPeriod(state: GameState, per: AbilityDef['limit']['per']): string {
  if (per === 'day') return `day ${state.day}`;
  if (per === 'phase') return `day ${state.day} ${state.phase}`;
  return `section ${state.sectionIndex}`;
}

export interface AvailableAbility {
  ability: AbilityDef;
  sourceName: string;
  usesLeft: number;
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
    out.push({
      ability,
      sourceName: source.name,
      usesLeft: Math.max(0, ability.limit.uses - used),
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
