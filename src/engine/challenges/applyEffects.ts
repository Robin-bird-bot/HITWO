/**
 * The effect engine (Nov 5 update, 3b): applies a card's typed effects. Every
 * challenge, Trial and opportunity goes through here; nothing checks for a
 * particular card by name.
 *
 * - Hiker effects (conditions, injuries, stats, losses from a pack) apply to
 *   each target, with their chance rolled per hiker.
 * - Party and map effects (Abundance, nodes, lines, the party purse) apply
 *   once, with their chance rolled once.
 * - Effects that wait on a later phase still record their data on the
 *   hiker or item (TODO(phase N) notes say where).
 */
import { BALANCE } from '../../config/balance';
import { ITEMS, TIER_3_ITEMS, findableItems } from '../../content';
import { CONDITIONS, NEGATIVE_CONDITIONS } from '../../content/conditions';
import { RESOURCES } from '../../content/resources';
import { changeAbundance } from '../abundance';
import { addCondition, hasCondition, removeCondition } from '../conditions';
import { countShelter } from '../counters';
import type { ItemType } from '../effects';
import { bagSlots, resourceCount } from '../inventory';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import { pick, roll, shuffle } from '../rng';
import { addInjury, changeStat } from '../stats';
import { enterTile } from '../actions/common';
import type {
  CardRolls,
  GameState,
  Hiker,
  HikerId,
  ItemId,
  NodeType,
  ResourceId,
  TileId,
} from '../types';
import { amount, chanceOf, type AmountContext } from './rolls';
import { noteArrival, phaseIndex } from './trials';
import type { CardDef, Effect, EffectOp, ResourceFilter, Tier } from './types';

export interface EffectRun {
  card: CardDef;
  tileId: TileId;
  /** The hikers these effects are for. */
  targets: readonly Hiker[];
  /** Everyone on the tile (for "for every hiker on this tile"). */
  onTile: readonly Hiker[];
  rolls: CardRolls;
  /** A Risk challenge's worked-out loss, or how many steps the wind blows. */
  risk?: number;
}

type MoveTo = (
  h: Hiker,
  to: TileId | undefined,
  how: 'swept' | 'back' | 'blown' | 'falseTrail' | 'tunnel',
) => void;

export interface EffectResult {
  /** Hikers moved onto tiles nobody had landed on: those tiles trigger next. */
  entered: { tileId: TileId; hikerIds: HikerId[] }[];
  /** Other challenges to start (Bear Country). */
  triggers: { tileId: TileId; tier: Tier; node: NodeType }[];
  injured: Set<HikerId>;
}

/** Effects that happen once for the whole card, not once per hiker. */
const ONCE: ReadonlySet<EffectOp['op']> = new Set([
  'loseAllOf',
  'loseItem',
  'abundance',
  'nodesVanish',
  'nodesBecome',
  'hideNodes',
  'lines',
  'raiseTier',
  'trigger',
  'gainItem',
  'gainCaps',
  'placeShelter',
  'tileLuck',
]);

const isOnce = (e: Effect) =>
  ONCE.has(e.op) ||
  (e.op === 'loseResources' && e.from === 'party') ||
  (e.op === 'move' && (e.how === 'falseTrail' || e.how === 'tunnel'));

/** Can't be moved by anything (Frozen, Napping). */
export const immovable = (h: Hiker) => h.conditions.some((c) => CONDITIONS[c.id]?.immovable);

export const isFood = (itemId: ItemId) => ITEMS[itemId]?.type === 'food';
export const foodCarried = (h: Hiker) => h.inventory.bag.filter((i) => isFood(i.itemId)).length;

function matches(filter: ResourceFilter | undefined, id: ResourceId): boolean {
  if (!filter) return true;
  const def = RESOURCES.find((r) => r.id === id);
  if (filter.ids && !filter.ids.includes(id)) return false;
  if (filter.nodes && (!def || !filter.nodes.includes(def.node))) return false;
  return true;
}

/** One entry per single resource a hiker carries. */
function units(h: Hiker, filter?: ResourceFilter): ResourceId[] {
  const out: ResourceId[] = [];
  for (const [id, n] of Object.entries(h.inventory.resources)) {
    if (!matches(filter, id)) continue;
    for (let i = 0; i < (n ?? 0); i++) out.push(id);
  }
  return out;
}

function takeResource(h: Hiker, id: ResourceId): void {
  const n = (h.inventory.resources[id] ?? 0) - 1;
  if (n > 0) h.inventory.resources[id] = n;
  else delete h.inventory.resources[id];
}

function logLost(
  state: GameState,
  h: Hiker,
  resources: ResourceId[],
  items: ItemId[],
  cause: string,
) {
  if (resources.length || items.length) {
    pushEvent(state, { kind: 'lost', hikerId: h.id, resources, items, cause });
  }
}

function tileNodeTypes(state: GameState, tileId: TileId): NodeType[] {
  const tile = state.section.tiles[tileId];
  return [...new Set((tile?.nodes ?? []).flatMap((n) => (n.type === 'caps' ? [] : [n.type])))];
}

/** Connected tiles a hiker can be moved onto (never the checkpoint before Phase 8). */
function neighbours(state: GameState, tileId: TileId) {
  return adjacentTileIds(state.section, tileId)
    .map((id) => state.section.tiles[id])
    .filter((t): t is NonNullable<typeof t> => !!t && t.kind !== 'checkpoint');
}

/**
 * "Back one tile": a landed-on tile connected behind, picked at random if
 * there are several; if none, an unrevealed one behind; if nothing is behind,
 * left or right.
 */
export function backTile(state: GameState, fromId: TileId): TileId | undefined {
  const from = state.section.tiles[fromId];
  if (!from) return undefined;
  const near = neighbours(state, fromId);
  const behind = near.filter((t) => t.row < from.row);
  const landed = behind.filter((t) => t.visited);
  const choose = landed.length
    ? landed
    : behind.length
      ? behind
      : near.filter((t) => t.row === from.row);
  return choose.length ? pick(state.rng, choose).id : undefined;
}

export function applyEffects(
  state: GameState,
  run: EffectRun,
  effects: readonly Effect[],
): EffectResult {
  const result: EffectResult = { entered: [], triggers: [], injured: new Set() };
  const cause = run.card.name;
  const ctxFor = (h?: Hiker): AmountContext => ({
    rolls: run.rolls,
    onTile: run.onTile,
    foodCarried,
    ...(h ? { hiker: h } : {}),
    ...(run.risk !== undefined ? { risk: run.risk } : {}),
  });

  const moved = new Map<TileId, HikerId[]>();
  const moveTo: MoveTo = (h, to, how) => {
    if (!to || to === h.tileId) return;
    // Frozen: can't move or be moved (04-challenges.md, "New conditions").
    if (immovable(h)) return;
    const tile = state.section.tiles[to];
    if (!tile) return;
    const wasNew = !tile.visited;
    const from = h.tileId;
    h.cameFrom = from;
    h.tileId = to;
    enterTile(state, to);
    pushEvent(state, { kind: 'moved', hikerId: h.id, from, to, how, cause });
    noteArrival(state, [h.id], to);
    if (wasNew) moved.set(to, [...(moved.get(to) ?? []), h.id]);
  };

  for (const effect of effects) {
    if (effect.onlyIf && !run.rolls.includes[effect.onlyIf]) continue;

    if (isOnce(effect)) {
      if (effect.chance !== undefined && !roll(state.rng, chanceOf(effect.chance, ctxFor())))
        continue;
      applyOnce(state, run, effect, ctxFor(), result, moveTo);
      continue;
    }

    const targets =
      effect.target === 'injured'
        ? run.targets.filter((h) => result.injured.has(h.id))
        : run.targets;
    for (const h of targets) {
      if (h.status === 'abandoned') continue;
      const ctx = ctxFor(h);
      if (effect.chance !== undefined && !roll(state.rng, chanceOf(effect.chance, ctx))) continue;
      applyToHiker(state, run, effect, h, ctx, cause, result, moveTo);
    }
  }

  for (const [tileId, hikerIds] of moved) result.entered.push({ tileId, hikerIds });
  return result;
}

function applyToHiker(
  state: GameState,
  run: EffectRun,
  e: Effect,
  h: Hiker,
  ctx: AmountContext,
  cause: string,
  result: EffectResult,
  moveTo: MoveTo,
): void {
  switch (e.op) {
    case 'condition': {
      if (e.ifHas && !e.ifHas.some((id) => hasCondition(h, id))) return;
      const nodes = tileNodeTypes(state, run.tileId);
      const node = e.node === 'tile' ? (nodes.length ? pick(state.rng, nodes) : undefined) : e.node;
      addCondition(state, h, e.id, amount(e.duration, ctx), e.unit, cause, {
        ...(node ? { node } : {}),
        ...(e.then
          ? { then: { id: e.then.id, remaining: amount(e.then.duration, ctx), unit: e.then.unit } }
          : {}),
      });
      return;
    }
    case 'cureInjury': {
      const healed = Math.min(h.injuries, e.count);
      if (healed <= 0) return;
      h.injuries -= healed;
      if (h.status === 'passedOut' && h.injuries < BALANCE.injuries.passOutAt) h.status = 'active';
      pushEvent(state, { kind: 'healed', hikerId: h.id, healed, injuries: h.injuries, cause });
      return;
    }
    case 'cureConditions':
      for (const c of [...h.conditions]) {
        if (e.only === 'negative' && CONDITIONS[c.id]?.kind !== 'negative') continue;
        removeCondition(state, h, c.id);
      }
      return;
    case 'refill': {
      const missing = BALANCE.stats.max - h.stats[e.stat];
      if (missing > 0) changeStat(state, h, e.stat, missing, cause);
      return;
    }
    case 'randomCondition': {
      const id = pick(state.rng, e.from ?? NEGATIVE_CONDITIONS);
      const nodes = tileNodeTypes(state, run.tileId);
      const node = CONDITIONS[id]?.takesNode && nodes.length ? pick(state.rng, nodes) : undefined;
      addCondition(state, h, id, amount(e.duration, ctx), e.unit, cause, node ? { node } : {});
      return;
    }
    case 'injury':
      addInjury(state, h, cause);
      result.injured.add(h.id);
      return;
    case 'stat': {
      const n = amount(e.delta, ctx);
      changeStat(state, h, e.stat, e.lose ? -n : n, cause);
      return;
    }
    case 'xp': {
      const n = amount(e.delta, ctx);
      h.xp = Math.max(0, h.xp + (e.lose ? -n : n));
      return;
    }
    case 'loseResources': {
      const lost = shuffle(state.rng, units(h)).slice(0, amount(e.count, ctx));
      for (const id of lost) takeResource(h, id);
      logLost(state, h, lost, [], cause);
      return;
    }
    case 'loseEachResource': {
      const lost = units(h, e.filter).filter(() => roll(state.rng, chanceOf(e.chance, ctx)));
      for (const id of lost) takeResource(h, id);
      logLost(state, h, lost, [], cause);
      return;
    }
    case 'loseBagItems': {
      const lost = h.inventory.bag.filter(() => roll(state.rng, chanceOf(e.chance, ctx)));
      h.inventory.bag = h.inventory.bag.filter((i) => !lost.includes(i));
      logLost(
        state,
        h,
        [],
        lost.map((i) => i.itemId),
        cause,
      );
      return;
    }
    case 'loseFood':
    case 'spoilFood': {
      const food = h.inventory.bag.filter((i) => isFood(i.itemId));
      let lost = food;
      if (e.op === 'spoilFood') lost = food.filter(() => roll(state.rng, e.chance));
      else if (e.mode === 'count')
        lost = shuffle(state.rng, food).slice(0, amount(e.count ?? 0, ctx));
      else if (e.mode === 'each')
        lost = food.filter(() => roll(state.rng, chanceOf(e.chance ?? 0, ctx)));
      h.inventory.bag = h.inventory.bag.filter((i) => !lost.includes(i));
      logLost(
        state,
        h,
        [],
        lost.map((i) => i.itemId),
        cause,
      );
      return;
    }
    case 'foodAppetite': {
      // TODO(phase 9): eating uses appetiteMod.
      const n = amount(e.delta, ctx);
      const change = typeof e.delta === 'number' ? n : -n;
      for (const item of h.inventory.bag) {
        if (isFood(item.itemId)) item.appetiteMod = (item.appetiteMod ?? 0) + change;
      }
      return;
    }
    case 'toolUses': {
      // TODO(phase 9): tools take usesLost off their uses.
      const n = amount(e.delta, ctx);
      for (const item of h.inventory.bag) {
        if (ITEMS[item.itemId]?.type === 'tool') item.usesLost = (item.usesLost ?? 0) + n;
      }
      return;
    }
    case 'loseClothes':
      // TODO(phase 9): clothing durability. Fashion Critic waits until then.
      return;
    case 'gainResources': {
      const room = BALANCE.inventory.resourceLimit - resourceCount(h);
      const options = RESOURCES.filter((r) => matches(e.filter, r.id)).map((r) => r.id);
      const wanted = amount(e.count, ctx);
      const n = Math.max(0, Math.min(room, wanted));
      const got: ResourceId[] = [];
      for (let i = 0; i < n; i++) {
        const id = pick(state.rng, options);
        h.inventory.resources[id] = (h.inventory.resources[id] ?? 0) + 1;
        got.push(id);
      }
      const noRoom = wanted - n;
      if (got.length || noRoom > 0) {
        pushEvent(state, {
          kind: 'gained',
          hikerId: h.id,
          resources: got,
          items: [],
          ...(noRoom > 0 ? { noRoom } : {}),
          cause,
        });
      }
      return;
    }
    case 'move': {
      if (e.how === 'swept') {
        const near = neighbours(state, h.tileId);
        moveTo(h, near.length ? pick(state.rng, near).id : undefined, 'swept');
      } else if (e.how === 'back') {
        moveTo(h, backTile(state, h.tileId), 'back');
      } else if (e.how === 'cameFrom') {
        const back = h.cameFrom && adjacentTileIds(state.section, h.tileId).includes(h.cameFrom);
        moveTo(h, back ? h.cameFrom : backTile(state, h.tileId), 'back');
      } else if (e.how === 'trailhead') {
        moveTo(h, state.section.trailheadId, 'back');
      } else if (e.how === 'blown') {
        // Only the tile they end on triggers its challenge.
        const steps = run.risk ?? blownSteps(state, e.chances ?? [1]);
        let at = h.tileId;
        for (let i = 0; i < steps; i++) at = backTile(state, at) ?? at;
        moveTo(h, at, 'blown');
      }
      return;
    }
    default:
      // A party effect that reached here (gainItem for one hiker, from a Trial reward).
      applyOnce(state, run, e, ctx, result, moveTo, h);
  }
}

function blownSteps(state: GameState, chances: readonly number[]): number {
  let steps = 0;
  for (const c of chances) {
    if (!roll(state.rng, c)) break;
    steps += 1;
  }
  return steps;
}

function applyOnce(
  state: GameState,
  run: EffectRun,
  e: Effect,
  ctx: AmountContext,
  result: EffectResult,
  moveTo: MoveTo,
  only?: Hiker,
): void {
  const cause = run.card.name;
  const tile = state.section.tiles[run.tileId];
  const targets = only ? [only] : run.targets;
  switch (e.op) {
    case 'loseResources': {
      const pool = shuffle(
        state.rng,
        targets.flatMap((h) => units(h).map((id) => ({ h, id }))),
      ).slice(0, amount(e.count, ctx));
      for (const h of targets) {
        const mine = pool.filter((u) => u.h === h).map((u) => u.id);
        for (const id of mine) takeResource(h, id);
        logLost(state, h, mine, [], cause);
      }
      return;
    }
    case 'loseAllOf': {
      const set = pick(state.rng, e.sets);
      for (const h of targets) {
        const lost = units(h, { ids: set });
        for (const id of lost) takeResource(h, id);
        logLost(state, h, lost, [], cause);
      }
      return;
    }
    case 'loseItem': {
      const holders = targets.filter((h) => h.inventory.bag.length > 0);
      if (!holders.length) return;
      const h = pick(state.rng, holders);
      const item = pick(state.rng, h.inventory.bag);
      h.inventory.bag = h.inventory.bag.filter((i) => i !== item);
      logLost(state, h, [], [item.itemId], cause);
      return;
    }
    case 'abundance': {
      for (const node of e.nodes) {
        let drop = e.delta !== undefined ? amount(e.delta, ctx) : 0;
        if (e.repeatChance !== undefined) {
          // "75% chance to drop 1; repeat until it fails."
          while (roll(state.rng, e.repeatChance)) drop += 1;
        }
        changeAbundance(state, node, -drop);
      }
      return;
    }
    case 'nodesVanish': {
      const tiles = e.where === 'tile' ? (tile ? [tile] : []) : Object.values(state.section.tiles);
      for (const t of tiles) {
        t.nodes = t.nodes.filter(
          (n) => (e.node && n.type !== e.node) || !roll(state.rng, e.chance),
        );
      }
      return;
    }
    case 'nodesBecome': {
      for (const t of neighbours(state, run.tileId)) {
        for (const n of t.nodes) if (roll(state.rng, e.chance)) n.type = e.node;
      }
      return;
    }
    case 'hideNodes': {
      const occupied = new Set(state.hikers.map((h) => h.tileId));
      for (const t of neighbours(state, run.tileId)) {
        if (occupied.has(t.id)) continue;
        for (const n of t.nodes) n.revealed = false;
      }
      return;
    }
    case 'lines': {
      for (const line of state.section.lines) {
        if (line.a === run.tileId || line.b === run.tileId) line.kind = e.kind;
      }
      return;
    }
    case 'raiseTier': {
      const unrevealed = neighbours(state, run.tileId).filter((t) => !t.visited);
      if (!unrevealed.length) return;
      const t = pick(state.rng, unrevealed);
      t.tierBonus = (t.tierBonus ?? 0) + 1;
      return;
    }
    case 'trigger':
      result.triggers.push({ tileId: run.tileId, tier: e.tier, node: e.node });
      return;
    case 'gainItem': {
      const types: readonly ItemType[] =
        e.itemTypes ??
        (e.itemType ? [e.itemType] : ['tool', 'food', 'clothes', 'shelter', 'trinket']);
      const options = e.itemId
        ? [ITEMS[e.itemId]].filter((i) => !!i)
        : e.tier3
          ? TIER_3_ITEMS.flatMap((id) => (ITEMS[id] ? [ITEMS[id]] : []))
          : types.flatMap((t) => findableItems(t));
      const to = targets.find((h) => h.inventory.bag.length < bagSlots(state, h).total);
      if (!options.length || !to) return;
      const item = pick(state.rng, options);
      to.inventory.bag.push({ uid: `gift-${state.nextEventId}-${item.id}`, itemId: item.id });
      pushEvent(state, { kind: 'gained', hikerId: to.id, resources: [], items: [item.id], cause });
      return;
    }
    case 'placeShelter': {
      // TODO(phase 9): a shelter that works like the real shelter cards.
      if (!tile) return;
      const shelters = findableItems('shelter');
      if (!shelters.length) return;
      tile.shelters = [...(tile.shelters ?? []), pick(state.rng, shelters).id];
      countShelter(state);
      return;
    }
    case 'tileLuck': {
      if (!tile) return;
      const now = phaseIndex(state);
      // Until the next morning: the end of tonight.
      const until = now - (now % 3) + 2;
      const amountNow = tile.luckBonus && tile.luckBonus.until >= now ? tile.luckBonus.amount : 0;
      tile.luckBonus = { amount: amountNow + amount(e.amount, ctx), until, cause };
      return;
    }
    case 'gainCaps': {
      const n = amount(e.count, ctx);
      state.caps += n;
      if (n) pushEvent(state, { kind: 'gained', resources: [], items: [], caps: n, cause });
      return;
    }
    case 'move': {
      if (!tile) return;
      if (e.how === 'tunnel') {
        // Secret Tunnel: together to a random tile in the next row up, connected or not.
        const up = Object.values(state.section.tiles).filter(
          (t) => t.row === tile.row + 1 && t.kind !== 'checkpoint',
        );
        if (!up.length) return;
        const to = pick(state.rng, up).id;
        for (const h of targets) moveTo(h, to, 'tunnel');
        return;
      }
      // False Trail Markers: everyone to the same random unrevealed tile in the 3 rows behind.
      const behind = Object.values(state.section.tiles).filter(
        (t) => t.kind !== 'checkpoint' && t.row < tile.row && t.row >= tile.row - 3,
      );
      const unrevealed = behind.filter((t) => !t.visited);
      const choose = unrevealed.length ? unrevealed : behind;
      if (!choose.length) return;
      const to = pick(state.rng, choose).id;
      for (const h of targets) moveTo(h, to, 'falseTrail');
      return;
    }
    default:
      return;
  }
}
