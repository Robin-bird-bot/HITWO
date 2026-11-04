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
import { hikersOnTile, isAlone } from './map';
import { int, pick, roll } from './rng';
import { changeStat } from './stats';
import { thresholdSources } from './thresholds';
import type {
  Action,
  EquipSlot,
  GameState,
  Hiker,
  HikerId,
  Line,
  NodeType,
  Phase,
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
  | 'scavenge.appetite';

/** Amounts a hiker gains. Modified totals round up. */
export type GainKey = 'sleep.energy';

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
}

/** What an event handler or ability can do. */
export interface EffectContext extends QueryContext {
  changeStat(hiker: Hiker, stat: StatName, delta: number, cause: string): void;
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

export interface Hooks {
  modifyCost?(q: CostQuery, ctx: QueryContext): ModifierResult;
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
  kind: 'threshold' | 'trait' | 'family' | 'condition' | 'item';
  name: string;
  hooks: Hooks;
  ability?: AbilityDef;
}

/**
 * Every source affecting a hiker right now. `_state` is unused until tile
 * conditions and weather become sources (Phase 6).
 */
export function effectSourcesFor(_state: GameState, hiker: Hiker): EffectSource[] {
  const sources = thresholdSources(hiker);
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
  for (const slot of hiker.slots) {
    if (!slot.traitId) continue;
    const def = TRAITS[slot.traitId];
    // An unknown id (content removed since the save) is skipped, not fatal.
    if (!def) continue;
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
  };
}

export function effectContext(state: GameState, self: Hiker): EffectContext {
  return {
    ...queryContext(state, self),
    changeStat: (hiker, stat, delta, cause) => changeStat(state, hiker, stat, delta, cause),
    roll: (chance) => roll(state.rng, chance),
    int: (min, max) => int(state.rng, min, max),
    pick: (items) => pick(state.rng, items),
  };
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
