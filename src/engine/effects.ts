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
import { changeStat } from './stats';
import { thresholdSources } from './thresholds';
import type {
  Action,
  ConditionInstance,
  ConditionUnit,
  EquipSlot,
  GameState,
  Hiker,
  HikerId,
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
  /** Abundance restored by Tend (the Thumbs and Maintenance add to it). */
  | 'tend.abundance';

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
}

export type CostQuery = AmountQuery<CostKey>;
export type GainQuery = AmountQuery<GainKey>;

/** How much a hiker can hold. Flat modifiers only. */
export type CapacityKey = 'bag.slots';

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
  /** Phase 9. */
  onCraft?(e: unknown, ctx: EffectContext): void;
  /** Phase 9. */
  onEat?(e: unknown, ctx: EffectContext): void;
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

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  /** Clothes are equipped in one of these slots. */
  slot?: EquipSlot;
  tier: 1 | 2 | 3 | 4;
  text: string;
  /** Equipped items plug into hooks, like traits. */
  hooks?: Hooks;
  placeholder?: boolean;
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
  for (const item of Object.values(hiker.inventory.equipped)) {
    const def = item && ITEMS[item.itemId];
    if (!item || !def) continue;
    sources.push({ id: `item:${item.uid}`, kind: 'item', name: def.name, hooks: def.hooks ?? {} });
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

/** Clothing items a hiker has equipped (Phase 9 adds the ways to put them on). */
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
  let room = BALANCE.inventory.resourceLimit - carried;
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
