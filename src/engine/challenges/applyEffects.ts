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
import { gainXp, loseXp } from '../xp';
import { durabilityLeft, makeItem } from '../items/make';
import { loseDurability, loseUses, removeItem } from '../items/wear';
import { noteGone } from '../items/gone';
import { setUpShelterOn, shelterDeployments, shelterOn } from '../items/shelters';
import { ITEMS, TIER_3_ITEMS, findableItems } from '../../content';
import { craftableItems } from '../../content/items';
import { BALANCE } from '../../config/balance';
import { CONDITIONS, NEGATIVE_CONDITIONS } from '../../content/conditions';
import { categoriesOf, RESOURCES } from '../../content/resources';
import { changeAbundance } from '../abundance';
import { addCondition, hasCondition, removeCondition } from '../conditions';
import { gainCaps, type ItemType } from '../effects';
import { bagSlots, resourceCount, resourceLimit } from '../inventory';
import { pushEvent } from '../log';
import { adjacentTileIds, tileNodeTypes } from '../map';
import { pick, roll, shuffle } from '../rng';
import { addInjury, changeStat, cureInjuries, statMax } from '../stats';
import { endCarry } from '../health';
import { enterTile } from '../actions/common';
import { cardShown, revealCardOn, triggers } from './reveal';
import type {
  CardRolls,
  GameState,
  Hiker,
  HikerId,
  ItemId,
  ItemInstance,
  NodeType,
  ResourceId,
  TileId,
} from '../types';
import { amount, chanceOf, type AmountContext } from './rolls';
import { noteArrival, phaseIndex } from './trials';
import type { Effect, EffectOp, ResourceFilter, Tier } from './types';

export interface EffectRun {
  /** Where the effects come from (a challenge card, a night event's creature), for the log. */
  card: { name: string };
  tileId: TileId;
  /** The hikers these effects are for. */
  targets: readonly Hiker[];
  /** Everyone on the tile (for "for every hiker on this tile"). */
  onTile: readonly Hiker[];
  rolls: CardRolls;
  /** A Risk challenge's worked-out loss, or how many steps the wind blows. */
  risk?: number;
  /** The tile's tier (I to V): Your Most takes all of it from Tier III. */
  tier?: number;
  /**
   * A challenge's punishment (24-challenges-reset.md, section 2), with the
   * backup rule: each thing it can't take costs 1 Energy instead; one that
   * takes nothing at all costs `energy` instead; and a hiker who'd go below
   * 0 Energy gains 1 injury instead, once per challenge (`injured`, shared
   * across the challenge's sections).
   */
  backup?: { energy: number; injured: Set<HikerId> };
}

type MoveTo = (
  h: Hiker,
  to: TileId | undefined,
  how: 'swept' | 'back' | 'blown' | 'falseTrail' | 'tunnel' | 'chased',
) => void;

export interface EffectResult {
  /** Hikers moved onto tiles nobody had landed on: those tiles trigger next. */
  entered: { tileId: TileId; hikerIds: HikerId[] }[];
  /** Other challenges to start (Bear Country). */
  triggers: { tileId: TileId; tier: Tier; node: NodeType }[];
  injured: Set<HikerId>;
  /** What the effects actually took or touched, for a night event's line. */
  touched: { resources: number; caps: number; items: ItemId[]; other?: HikerId };
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
  ((e.op === 'loseResources' || e.op === 'loseCategory') && e.from === 'party') ||
  (e.op === 'move' && (e.how === 'falseTrail' || e.how === 'tunnel'));

/** Can't be moved by anything (Frozen, Napping). */
/** Can't be moved by anything: Frozen, Napping, or enough Shivering to count as Frozen. */
export const immovable = (h: Hiker) =>
  h.conditions.some((c) => {
    const def = CONDITIONS[c.id];
    const frozenAt = def?.stacking?.frozenAt;
    return !!def?.immovable || (frozenAt !== undefined && (c.stacks ?? 0) >= frozenAt);
  });

export const isFood = (itemId: ItemId) => ITEMS[itemId]?.type === 'food';
/** Clothing items a hiker has on (Phase 8 adds the ways to put them on). */
export const equippedClothes = (h: Hiker): ItemInstance[] =>
  Object.values(h.inventory.equipped).filter(
    (i): i is ItemInstance => !!i && ITEMS[i.itemId]?.type === 'clothes',
  );
/** On the map: not checked in or gone from the hike. */
export const onMap = (h: Hiker) => h.status === 'active' || h.status === 'passedOut';
export const foodCarried = (h: Hiker) => h.inventory.bag.filter((i) => isFood(i.itemId)).length;

function matches(filter: ResourceFilter | undefined, id: ResourceId): boolean {
  if (!filter) return true;
  const def = RESOURCES.find((r) => r.id === id);
  if (filter.ids && !filter.ids.includes(id)) return false;
  if (filter.nodes && (!def || !filter.nodes.includes(def.node))) return false;
  if (filter.categories && !categoriesOf(id).some((c) => filter.categories!.includes(c)))
    return false;
  return true;
}

/**
 * Energy lost to a challenge's punishment. With the backup rule, a hiker who
 * would go below 0 gains 1 injury instead, once per challenge: the game's
 * own rule already turns hitting 0 Energy into an injury (and lifts their
 * stats), so the loss stops at 0 the first time, and at 1 after that.
 */
function loseEnergy(state: GameState, run: EffectRun, h: Hiker, n: number, cause: string): void {
  if (n <= 0) return;
  const backup = run.backup;
  if (backup && h.stats.energy - n <= 0) {
    if (backup.injured.has(h.id)) {
      if (h.stats.energy > 1) changeStat(state, h, 'energy', 1 - h.stats.energy, cause);
      return;
    }
    backup.injured.add(h.id);
    if (h.stats.energy > 0) changeStat(state, h, 'energy', -h.stats.energy, cause);
    else addInjury(state, h, cause);
    return;
  }
  changeStat(state, h, 'energy', -n, cause);
}

/** The backup rule: each of `missing` things a punishment couldn't take costs 1 Energy. */
function backupMissing(state: GameState, run: EffectRun, h: Hiker, missing: number, cause: string) {
  if (run.backup && missing > 0) loseEnergy(state, run, h, missing, cause);
}

/** The backup rule: a punishment that took nothing at all costs X Energy for the tier. */
function backupNothing(state: GameState, run: EffectRun, h: Hiker, cause: string) {
  if (run.backup) loseEnergy(state, run, h, run.backup.energy, cause);
}

/** The resources a hiker has exactly this many of (or at least, with `atLeast`). */
function heldAt(h: Hiker, test: (n: number) => boolean): ResourceId[] {
  return Object.entries(h.inventory.resources)
    .filter(([, n]) => test(n ?? 0))
    .map(([id]) => id as ResourceId);
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
  // Rocco's "Borrowed" Boutique remembers what the party lost.
  for (const id of items) noteGone(state, id);
}

/** Connected tiles a card can move a hiker onto (never the checkpoint: checking in is the hiker's own move). */
function neighbours(state: GameState, tileId: TileId) {
  return adjacentTileIds(state.section, tileId)
    .map((id) => state.section.tiles[id])
    .filter((t): t is NonNullable<typeof t> => !!t && t.kind !== 'checkpoint');
}

/** Connected tiles in the rows behind (a night event chases a hiker onto one). */
export function behindTiles(state: GameState, tileId: TileId) {
  const from = state.section.tiles[tileId];
  return from ? neighbours(state, tileId).filter((t) => t.row < from.row) : [];
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
  const result: EffectResult = {
    entered: [],
    triggers: [],
    injured: new Set(),
    touched: { resources: 0, caps: 0, items: [] },
  };
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
    // Carried or carrying, a card moving either one breaks the carry.
    endCarry(state, h, 'dropped');
    h.cameFrom = from;
    h.tileId = to;
    enterTile(state, to);
    pushEvent(state, { kind: 'moved', hikerId: h.id, from, to, how, cause });
    noteArrival(state, [h.id], to);
    if (wasNew) moved.set(to, [...(moved.get(to) ?? []), h.id]);
  };

  for (const effect of effects) {
    if (effect.onlyIf && !run.rolls.includes[effect.onlyIf]) continue;
    // "1 injury from Tier III": tier-bound parts of a punishment.
    const tier = run.tier ?? 1;
    if (effect.fromTier !== undefined && tier < effect.fromTier) continue;
    if (effect.upToTier !== undefined && tier > effect.upToTier) continue;

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
    case 'cureInjury':
      cureInjuries(state, h, e.count, cause);
      return;
    case 'cureConditions':
      for (const c of [...h.conditions]) {
        if (e.only === 'negative' && CONDITIONS[c.id]?.kind !== 'negative') continue;
        removeCondition(state, h, c.id);
      }
      return;
    case 'refill': {
      const missing = statMax(state, h, e.stat) - h.stats[e.stat];
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
      if (e.lose && e.stat === 'energy') {
        loseEnergy(state, run, h, n, cause);
        return;
      }
      if (e.lose && e.stat === 'appetite') {
        // The backup rule: Appetite they haven't got costs Energy.
        const short = Math.max(0, n - h.stats.appetite);
        changeStat(state, h, e.stat, -n, cause);
        backupMissing(state, run, h, short, cause);
        return;
      }
      changeStat(state, h, e.stat, e.lose ? -n : n, cause);
      return;
    }
    case 'xp': {
      const n = amount(e.delta, ctx);
      if (e.lose) loseXp(state, h, n);
      else gainXp(state, h, n, 'reward', cause);
      return;
    }
    case 'loseResources': {
      const want = amount(e.count, ctx);
      const lost = shuffle(state.rng, units(h)).slice(0, want);
      for (const id of lost) takeResource(h, id);
      logLost(state, h, lost, [], cause);
      result.touched.resources += lost.length;
      backupMissing(state, run, h, want - lost.length, cause);
      return;
    }
    case 'loseCategory': {
      const want = amount(e.count, ctx);
      const lost = shuffle(state.rng, units(h, { categories: [e.category] })).slice(0, want);
      for (const id of lost) takeResource(h, id);
      logLost(state, h, lost, [], cause);
      result.touched.resources += lost.length;
      backupMissing(state, run, h, want - lost.length, cause);
      return;
    }
    case 'loseSingles': {
      const lost = heldAt(h, (n) => n === 1);
      for (const id of lost) takeResource(h, id);
      logLost(state, h, lost, [], cause);
      result.touched.resources += lost.length;
      if (!lost.length) backupNothing(state, run, h, cause);
      return;
    }
    case 'loseBigStacks': {
      const lost = heldAt(h, (n) => n >= 3);
      for (const id of lost) takeResource(h, id);
      logLost(state, h, lost, [], cause);
      result.touched.resources += lost.length;
      if (!lost.length) backupNothing(state, run, h, cause);
      return;
    }
    case 'loseMost': {
      const counts = Object.entries(h.inventory.resources).filter(([, n]) => (n ?? 0) > 0);
      const top = Math.max(0, ...counts.map(([, n]) => n ?? 0));
      if (!top) {
        backupNothing(state, run, h, cause);
        return;
      }
      const id = pick(
        state.rng,
        counts.filter(([, n]) => n === top).map(([r]) => r as ResourceId),
      );
      // Half (rounded up); at Tier III and up, all of it.
      const n = (run.tier ?? 1) >= 3 ? top : Math.ceil(top / 2);
      const lost: ResourceId[] = Array.from({ length: n }, () => id);
      for (const r of lost) takeResource(h, r);
      logLost(state, h, lost, [], cause);
      result.touched.resources += lost.length;
      return;
    }
    case 'loseEachResource': {
      const lost = units(h, e.filter).filter(() => roll(state.rng, chanceOf(e.chance, ctx)));
      for (const id of lost) takeResource(h, id);
      logLost(state, h, lost, [], cause);
      result.touched.resources += lost.length;
      return;
    }
    case 'swapResources': {
      const lost = shuffle(state.rng, units(h)).slice(0, amount(e.count, ctx));
      if (!lost.length) return;
      for (const id of lost) takeResource(h, id);
      const got = lost.map(() => pick(state.rng, RESOURCES).id);
      for (const id of got) h.inventory.resources[id] = (h.inventory.resources[id] ?? 0) + 1;
      logLost(state, h, lost, [], cause);
      pushEvent(state, { kind: 'gained', hikerId: h.id, resources: got, items: [], cause });
      result.touched.resources += lost.length;
      return;
    }
    case 'loseCaps': {
      const n = Math.min(state.caps, amount(e.count, ctx));
      if (n <= 0) return;
      state.caps -= n;
      pushEvent(state, { kind: 'lost', hikerId: h.id, resources: [], items: [], caps: n, cause });
      result.touched.caps += n;
      return;
    }
    case 'wearClothes': {
      const worn = equippedClothes(h);
      const hit = e.which === 'all' ? worn : worn.length ? [pick(state.rng, worn)] : [];
      const n = amount(e.amount, ctx);
      for (const item of hit) loseDurability(state, h, item, n, cause);
      result.touched.items.push(...hit.map((i) => i.itemId));
      return;
    }
    case 'swapItemFar': {
      const far = state.hikers.filter(
        (o) => o.tileId !== h.tileId && onMap(o) && o.inventory.bag.length > 0,
      );
      if (!h.inventory.bag.length || !far.length) return;
      const other = pick(state.rng, far);
      const mine = pick(state.rng, h.inventory.bag);
      const theirs = pick(state.rng, other.inventory.bag);
      h.inventory.bag = h.inventory.bag.map((i) => (i === mine ? theirs : i));
      other.inventory.bag = other.inventory.bag.map((i) => (i === theirs ? mine : i));
      result.touched.items.push(mine.itemId, theirs.itemId);
      result.touched.other = other.id;
      return;
    }
    case 'stealItems': {
      // TODO(wyatt): from the bag, not clothes being worn.
      const lost = shuffle(state.rng, [...h.inventory.bag]).slice(0, amount(e.count, ctx));
      if (!lost.length) return;
      h.inventory.bag = h.inventory.bag.filter((i) => !lost.includes(i));
      const ids = lost.map((i) => i.itemId);
      logLost(state, h, [], ids, cause);
      result.touched.items.push(...ids);
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
      // Eating adds appetiteMod to the bite. Jerky never loses Appetite value.
      const n = amount(e.delta, ctx);
      const change = typeof e.delta === 'number' ? n : -n;
      const food = h.inventory.bag.filter(
        (i) => isFood(i.itemId) && !(change < 0 && ITEMS[i.itemId]?.keepsValue),
      );
      const hit = e.which === 'one' ? (food.length ? [pick(state.rng, food)] : []) : food;
      for (const item of hit) item.appetiteMod = (item.appetiteMod ?? 0) + change;
      result.touched.items.push(...hit.map((i) => i.itemId));
      return;
    }
    case 'toolUses': {
      // Tools at 0 uses are gone.
      const n = amount(e.delta, ctx);
      for (const item of [...h.inventory.bag]) loseUses(state, h, item, n, cause);
      return;
    }
    case 'loseClothes': {
      // Fashion Critic: each worn item, more likely gone the more durability it has left.
      const lost = equippedClothes(h).filter((i) =>
        roll(state.rng, Math.min(1, e.chancePerDurability * durabilityLeft(i))),
      );
      for (const i of lost) removeItem(h, i.uid);
      if (lost.length) {
        logLost(
          state,
          h,
          [],
          lost.map((i) => i.itemId),
          cause,
        );
        result.touched.items.push(...lost.map((i) => i.itemId));
      }
      return;
    }
    case 'peekCard': {
      // Old Trail Sign: a random tile nobody has reached shows its card.
      const tiles = Object.values(state.section.tiles).filter(
        (t) => !t.visited && t.kind === 'normal' && !cardShown(t) && triggers(state, t.id),
      );
      if (!tiles.length) return;
      revealCardOn(state, pick(state.rng, tiles).id, cause);
      return;
    }
    case 'gainResources': {
      const room = resourceLimit(state, h) - resourceCount(h);
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
      } else if (e.how === 'chased') {
        const behind = behindTiles(state, h.tileId);
        moveTo(h, behind.length ? pick(state.rng, behind).id : undefined, 'chased');
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
    case 'loseResources':
    case 'loseCategory': {
      // Across the party: from anyone here, at random.
      const filter = e.op === 'loseCategory' ? { categories: [e.category] } : undefined;
      const want = amount(e.count, ctx);
      const pool = shuffle(
        state.rng,
        targets.flatMap((h) => units(h, filter).map((id) => ({ h, id }))),
      ).slice(0, want);
      for (const h of targets) {
        const mine = pool.filter((u) => u.h === h).map((u) => u.id);
        for (const id of mine) takeResource(h, id);
        logLost(state, h, mine, [], cause);
      }
      result.touched.resources += pool.length;
      // The backup rule: what the party hadn't got costs Energy, shared out in turn.
      const live = targets.filter((h) => h.status !== 'abandoned');
      for (let k = 0; run.backup && live.length && k < want - pool.length; k++)
        loseEnergy(state, run, live[k % live.length]!, 1, cause);
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
      if (!holders.length) {
        // Crow Collector: with no item to take, random resources instead.
        if (e.orResources !== undefined) {
          for (const h of targets) {
            applyToHiker(
              state,
              run,
              { op: 'loseResources', count: e.orResources, from: 'hiker' },
              h,
              { ...ctx, hiker: h },
              cause,
              result,
              moveTo,
            );
          }
        }
        return;
      }
      const h = pick(state.rng, holders);
      const item = pick(state.rng, h.inventory.bag);
      h.inventory.bag = h.inventory.bag.filter((i) => i !== item);
      logLost(state, h, [], [item.itemId], cause);
      return;
    }
    case 'abundance': {
      let drop = e.delta !== undefined ? amount(e.delta, ctx) : 0;
      if (e.repeatChance !== undefined) {
        // "75% chance to drop 1; repeat until it fails."
        while (roll(state.rng, e.repeatChance)) drop += 1;
      }
      changeAbundance(state, -drop);
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
      // Abandoned Ranger Station: now and then a blueprint instead of an item.
      if (e.orBlueprint && roll(state.rng, BALANCE.items.craft.blueprintFind)) {
        const learner = targets[0];
        const known = learner?.blueprints ?? [];
        const plans = types
          .flatMap((t) => craftableItems(t, state.section.tier))
          .filter((d) => d.recipe && !known.includes(d.id));
        if (learner && plans.length) {
          const plan = pick(state.rng, plans);
          learner.blueprints = [...known, plan.id];
          pushEvent(state, { kind: 'blueprintFound', hikerId: learner.id, itemId: plan.id, cause });
          return;
        }
      }
      const to = targets.find((h) => h.inventory.bag.length < bagSlots(state, h).total);
      if (!options.length || !to) return;
      const item = pick(state.rng, options);
      to.inventory.bag.push(makeItem(state, item.id, { prefix: 'gift' }));
      pushEvent(state, { kind: 'gained', hikerId: to.id, resources: [], items: [item.id], cause });
      return;
    }
    case 'placeShelter': {
      // Ruins: a real random shelter, at the biome's tier, set up with nobody as its
      // owner (Phase 10.6). Only 1 can be up on a tile.
      if (!tile || shelterOn(state, tile.id)) return;
      const shelters = findableItems('shelter', state.section.tier);
      const pool = shelters.length ? shelters : findableItems('shelter');
      if (!pool.length) return;
      const id = pick(state.rng, pool).id;
      setUpShelterOn(state, tile.id, id, shelterDeployments(id));
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
      const n = gainCaps(state, amount(e.count, ctx));
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
