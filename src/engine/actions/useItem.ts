/**
 * Using an item (a free action): an active hiker uses a tool from their bag.
 * TODO(wyatt): using a tool is a free action.
 *
 * - Who it's for (ItemUse.target): the user, a hiker on their tile (passed
 *   out included), or every hiker on the tile.
 * - Some ask for a pick (`choice`): a stat (Survival Kit), a node (Planter),
 *   a resource (Swiss Army Knife) or a clothing item (Clothing Patch). The
 *   Bandaid's condition comes in `conditionId`.
 * - A use that would do nothing is refused, so the tool isn't wasted.
 * - It takes a use; a tool with none left is gone.
 * - Clumsy hikers can't use tools (the condition's canAct hook).
 * - Map tools pick a tile on the map (src/engine/items/scout.ts).
 */
import { BALANCE } from '../../config/balance';
import { CONDITIONS } from '../../content/conditions';
import { ITEMS } from '../../content/items';
import { RESOURCES } from '../../content/resources';
import { changeAbundance } from '../abundance';
import { addCondition, hasCondition, removeCondition } from '../conditions';
import { canActReason, gainResources, type ItemDef, type ItemUse } from '../effects';
import { resourceCount, resourceLimit } from '../inventory';
import { addBoost, hasBoost } from '../items/boosts';
import { applyMapUse, mapUseReason } from '../items/scout';
import { fullDurability, qualityOf } from '../items/make';
import { valueAt } from '../items/quality';
import { loseUses, removeItem } from '../items/wear';
import { noteGone } from '../items/gone';
import { pushEvent } from '../log';
import { adjacentTileIds, hikersOnTile, tileNodeTypes } from '../map';
import { pick } from '../rng';
import { cureInjuries, shiftStat, statMax, changeStat } from '../stats';
import type {
  Action,
  ConditionInstance,
  GameState,
  Hiker,
  ItemInstance,
  NodeType,
  ResourceId,
  StatName,
} from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type UseAction = Extract<Action, { type: 'useItem' }>;

const STATS: readonly StatName[] = ['appetite', 'energy', 'morale'];
const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];
const NODE_NAME: Record<NodeType, string> = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
};
const STAT_NAME: Record<StatName, string> = {
  appetite: 'Appetite',
  energy: 'Energy',
  morale: 'Morale',
};

/** A hiker's negative conditions: the ones a Bandaid or a Medkit can cure. */
export function negativeConditions(hiker: Hiker): ConditionInstance[] {
  return hiker.conditions.filter((c) => CONDITIONS[c.id]?.kind === 'negative');
}

/** What a use asks the player to pick, if anything. */
export type UseChoice = 'condition' | 'stat' | 'node' | 'resource' | 'clothes' | 'tile';

export function choiceOfUse(use: ItemUse): UseChoice | undefined {
  if (use.map?.pick) return 'tile';
  if (use.pickCondition) return 'condition';
  if (use.fillStat) return 'stat';
  if (use.addNode) return 'node';
  if (use.boost?.chooseResource) return 'resource';
  if (use.repair?.which === 'one') return 'clothes';
  return undefined;
}

/** Whether the item is used on the hiker using it, someone they pick, or the whole tile. */
export const targetOfUse = (use: ItemUse) => use.target ?? 'hiker';

/** Hikers on the trail on a tile (passed out included). */
const onTile = (state: GameState, hiker: Hiker) =>
  hikersOnTile(state, hiker.tileId).filter(
    (h) => h.status === 'active' || h.status === 'passedOut',
  );

/** Who the use reaches: one hiker, or everyone on the user's tile. */
function targetsOf(state: GameState, use: ItemUse, user: Hiker, target: Hiker): Hiker[] {
  return targetOfUse(use) === 'tile' ? onTile(state, user) : [target];
}

/** Clothes a hiker wears or carries, for a Clothing Patch. */
export function clothesOf(hiker: Hiker): ItemInstance[] {
  const worn = Object.values(hiker.inventory.equipped).filter(
    (i): i is ItemInstance => !!i && ITEMS[i.itemId]?.type === 'clothes',
  );
  const bag = hiker.inventory.bag.filter((i) => ITEMS[i.itemId]?.type === 'clothes');
  return [...worn, ...bag];
}

const wornClothes = (hiker: Hiker) =>
  Object.values(hiker.inventory.equipped).filter(
    (i): i is ItemInstance => !!i && ITEMS[i.itemId]?.type === 'clothes',
  );

/** How much more durability a clothing item can take. */
function durabilityRoom(item: ItemInstance): number {
  const def = ITEMS[item.itemId];
  if (!def) return 0;
  const full = fullDurability(def, qualityOf(item));
  return Math.max(0, full - (item.durability ?? full));
}

/** The resources a pick can be: those of a node on this tile. */
export function resourceChoices(state: GameState, hiker: Hiker): ResourceId[] {
  const nodes = tileNodeTypes(state, hiker.tileId);
  return RESOURCES.filter((r) => nodes.includes(r.node)).map((r) => r.id);
}

/** The node types a Planter can add here, while the tile has room for another. */
export function nodeChoices(state: GameState, hiker: Hiker): NodeType[] {
  const tile = state.section.tiles[hiker.tileId];
  if (!tile || tile.kind !== 'normal' || tile.wonder) return [];
  if (tile.nodes.length >= BALANCE.items.maxNodes) return [];
  return [...NODES];
}

/** Why a use's pick isn't right, if it isn't. */
function choiceReason(
  state: GameState,
  def: ItemDef,
  use: ItemUse,
  user: Hiker,
  target: Hiker,
  action: UseAction,
): string | undefined {
  const kind = choiceOfUse(use);
  const choice = action.choice;
  if (kind === 'condition') {
    const bad = negativeConditions(target);
    if (action.conditionId !== undefined) {
      if (!bad.some((c) => c.id === action.conditionId)) {
        return `${target.name} doesn’t have that condition.`;
      }
    } else if (bad.length > 1) {
      return 'Pick which condition to cure.';
    }
    return undefined;
  }
  if (action.conditionId !== undefined) return `${def.name} doesn’t cure a condition you pick.`;
  // A map tool checks its tile itself (src/engine/items/scout.ts).
  if (kind === 'tile') return undefined;
  if (!kind) return choice === undefined ? undefined : `${def.name} doesn’t need a pick.`;
  if (choice === undefined) {
    return {
      stat: 'Pick a stat to fill.',
      node: 'Pick a node to add.',
      resource: 'Pick a resource.',
      clothes: 'Pick a clothing item.',
    }[kind];
  }
  switch (kind) {
    case 'stat':
      return (STATS as readonly string[]).includes(choice)
        ? undefined
        : 'Pick Appetite, Energy or Morale.';
    case 'node':
      return (nodeChoices(state, user) as string[]).includes(choice)
        ? undefined
        : 'That node can’t be added here.';
    case 'resource':
      return (resourceChoices(state, user) as string[]).includes(choice)
        ? undefined
        : 'This tile has no node for that resource.';
    case 'clothes':
      return clothesOf(target).some((i) => i.uid === choice)
        ? undefined
        : `${target.name} doesn’t have that clothing item.`;
  }
}

/** Why the use would do nothing right now, if it would. */
function uselessReason(
  state: GameState,
  def: ItemDef,
  use: ItemUse,
  user: Hiker,
  target: Hiker,
  action: UseAction,
): string | undefined {
  const targets = targetsOf(state, use, user, target);
  const who = targetOfUse(use) === 'tile' ? 'anyone here' : target.name;
  const no = `${def.name} wouldn’t help ${who} right now.`;
  const tile = state.section.tiles[user.tileId];

  if (use.map) return mapUseReason(state, user, use.map, action.choice);
  if (use.boost) {
    const b = use.boost;
    if (b.needsNode && !tileNodeTypes(state, user.tileId).includes(b.needsNode)) {
      return `This tile has no ${NODE_NAME[b.needsNode]} node.`;
    }
    if (b.once && tileNodeTypes(state, user.tileId).length === 0) {
      return 'This tile has no nodes to scavenge.';
    }
    const already = b.tile
      ? (tile?.boosts ?? []).some((x) => x.itemId === def.id)
      : hasBoost(target, def.id);
    if (already)
      return `A ${def.name} is already working ${b.tile ? 'on this tile' : `for ${target.name}`}.`;
    if (b.scavenging) {
      const canStill = (b.tile ? onTile(state, user) : [target]).some(
        (h) => h.status === 'active' && !h.acted,
      );
      if (!canStill) {
        return b.tile
          ? `Everyone here has already acted this ${state.phase}.`
          : `${target.name} has already acted this ${state.phase}.`;
      }
    }
    return undefined;
  }
  // Raising a maximum or the caps bonus always does something.
  if (use.capsBonus || use.maxStat) return undefined;
  if (use.lampTonight) {
    return tile?.lampTonight ? 'A Camping Lamp is already lit here tonight.' : undefined;
  }
  if (use.resources) {
    return resourceCount(target) >= resourceLimit(state, target)
      ? `${target.name}’s resources are full.`
      : undefined;
  }
  if (use.abundance) {
    const nodes = tileNodeTypes(state, user.tileId);
    if (!nodes.length) return 'This tile has no nodes.';
    return nodes.some((n) => state.abundance[n] < BALANCE.abundance.max)
      ? undefined
      : 'Every node here is already at full Abundance.';
  }
  if (use.addNode) {
    return nodeChoices(state, user).length ? undefined : `This tile can’t take another node.`;
  }
  if (use.fillStat) {
    const stat = action.choice as StatName;
    return target.stats[stat] < statMax(state, target, stat)
      ? undefined
      : `${target.name}’s ${STAT_NAME[stat]} is already full.`;
  }
  if (use.averageStats) {
    if (targets.length < 2) return `${def.name} needs at least 2 hikers on the tile.`;
    const differs = STATS.some((s) => new Set(targets.map((h) => h.stats[s])).size > 1);
    return differs ? undefined : 'Everyone here already has the same stats.';
  }
  if (use.repair) {
    if (use.repair.which === 'one') {
      const item = clothesOf(target).find((i) => i.uid === action.choice);
      return item && durabilityRoom(item) > 0
        ? undefined
        : 'That clothing item is already like new.';
    }
    const worn = wornClothes(target);
    if (!worn.length) return `${target.name} isn’t wearing any clothes to clean.`;
    return worn.some((i) => durabilityRoom(i) > 0)
      ? undefined
      : `${target.name}’s clothes are already like new.`;
  }

  const helps = targets.some(
    (t) =>
      ((use.injuries ?? 0) > 0 && t.injuries > 0) ||
      (use.cures ?? []).some((id) => hasCondition(t, id)) ||
      ((!!use.pickCondition || !!use.allNegative) && negativeConditions(t).length > 0) ||
      (!!use.morale && t.stats.morale < statMax(state, t, 'morale')),
  );
  return helps ? undefined : no;
}

export function validateUse(state: GameState, action: UseAction): string | undefined {
  const user = findHiker(state, action.hikerId);
  const reason = notActiveReason(user);
  if (reason || !user) return reason;
  const item = user.inventory.bag.find((i) => i.uid === action.itemUid);
  if (!item) return `${user.name} doesn’t have that.`;
  const def = ITEMS[item.itemId];
  const use = def?.use;
  if (!def || !use) {
    return `${def?.name ?? 'That item'} can’t be used yet.${def?.notYet ? ` ${def.notYet}` : ''}`;
  }
  const blocked = canActReason(state, user, { action, role: 'actor', phase: state.phase });
  if (blocked) return blocked;

  const target = findHiker(state, action.targetId);
  if (!target || target.status === 'abandoned' || target.status === 'checkedIn') {
    return 'That hiker isn’t on the trail.';
  }
  if (targetOfUse(use) !== 'hiker' && target.id !== user.id) {
    return targetOfUse(use) === 'tile'
      ? `${def.name} works for everyone on the tile at once.`
      : `${def.name} is only for the hiker using it.`;
  }
  if (target.tileId !== user.tileId) return `${target.name} isn’t on this tile.`;
  if (use.gives && hasCondition(target, use.gives.id)) {
    return `${target.name} is already ${CONDITIONS[use.gives.id]?.name ?? use.gives.id}.`;
  }
  return (
    choiceReason(state, def, use, user, target, action) ??
    uselessReason(state, def, use, user, target, action)
  );
}

export function applyUse(state: GameState, action: UseAction): void {
  const user = mustFindHiker(state, action.hikerId);
  const target = mustFindHiker(state, action.targetId);
  const item = user.inventory.bag.find((i) => i.uid === action.itemUid);
  const def = item && ITEMS[item.itemId];
  const use = def?.use;
  if (!item || !def || !use) return;
  const quality = qualityOf(item);
  const v = (key: string) => valueAt(def.values?.[key], quality);
  const targets = targetsOf(state, use, user, target);
  const tile = state.section.tiles[user.tileId];
  const details: string[] = [];

  pushEvent(state, {
    kind: 'used',
    hikerId: user.id,
    targetId: target.id,
    itemId: item.itemId,
    ...(targetOfUse(use) === 'tile' ? { everyone: true as const } : {}),
  });
  const usedEvent = state.log.at(-1);

  for (const t of targets) {
    for (const id of use.cures ?? []) {
      if (hasCondition(t, id)) removeCondition(state, t, id);
    }
    if (use.pickCondition) {
      const id = action.conditionId ?? negativeConditions(t)[0]?.id;
      if (id) removeCondition(state, t, id);
    }
    if (use.allNegative) {
      for (const c of negativeConditions(t)) removeCondition(state, t, c.id);
    }
    if (use.injuries) cureInjuries(state, t, use.injuries, def.name);
    if (use.gives) {
      const days = valueAt(use.gives.duration, quality);
      addCondition(state, t, use.gives.id, days, use.gives.unit, def.name);
    }
    if (use.morale) changeStat(state, t, 'morale', v(use.morale), def.name);
  }

  if (use.fillStat) {
    const stat = action.choice as StatName;
    const missing = statMax(state, target, stat) - target.stats[stat];
    if (missing > 0) changeStat(state, target, stat, missing, def.name);
  }
  if (use.averageStats) {
    // Each stat evened out separately, rounded down. No other effects join in.
    for (const stat of STATS) {
      const avg = Math.floor(targets.reduce((n, h) => n + h.stats[stat], 0) / targets.length);
      for (const h of targets) shiftStat(state, h, stat, avg - h.stats[stat], def.name);
    }
  }
  if (use.repair) {
    const n = v(use.repair.value);
    const items =
      use.repair.which === 'one'
        ? clothesOf(target).filter((i) => i.uid === action.choice)
        : wornClothes(target);
    for (const c of items) {
      const add = Math.min(n, durabilityRoom(c));
      if (add <= 0) continue;
      const full = fullDurability(ITEMS[c.itemId] as ItemDef, qualityOf(c));
      c.durability = (c.durability ?? full) + add;
      details.push(`${ITEMS[c.itemId]?.name ?? 'Clothes'} +${add} durability`);
    }
  }
  if (use.abundance) {
    const n = v(use.abundance.value);
    const nodes = tileNodeTypes(state, user.tileId);
    const which =
      use.abundance.which === 'all' ? nodes : nodes.length ? [pick(state.rng, nodes)] : [];
    for (const node of which) {
      changeAbundance(state, node, n);
      details.push(`${NODE_NAME[node]} Abundance +${n}`);
    }
  }
  if (use.addNode && tile) {
    const node = action.choice as NodeType;
    tile.nodes.push({ type: node, revealed: true });
    details.push(`a ${NODE_NAME[node]} node added`);
  }
  if (use.resources) {
    const from = use.resources.node;
    const pool = RESOURCES.filter((r) => !from || r.node === from).map((r) => r.id);
    const got = Array.from({ length: v(use.resources.value) }, () => pick(state.rng, pool));
    gainResources(state, target, got, def.name);
  }
  if (use.lampTonight && tile) {
    for (const id of [tile.id, ...adjacentTileIds(state.section, tile.id)]) {
      const t = state.section.tiles[id];
      if (t) t.lampTonight = true;
    }
  }
  if (use.boost) {
    const choice = use.boost.once
      ? pick(state.rng, tileNodeTypes(state, user.tileId))
      : action.choice;
    addBoost(state, target, item, choice);
    if (use.boost.once && choice)
      details.push(`a Choice card for ${NODE_NAME[choice as NodeType]}`);
  }
  if (use.map) {
    const did = applyMapUse(state, user, item.itemId, use.map, action.choice);
    if (did) details.push(did);
  }
  if (use.capsBonus) {
    state.capsBonus = (state.capsBonus ?? 0) + BALANCE.items.walletCaps;
    details.push(`+${state.capsBonus} to every caps gain, for good`);
  }
  if (use.maxStat) {
    const stat = use.maxStat;
    target.maxBonus = {
      ...target.maxBonus,
      [stat]: (target.maxBonus?.[stat] ?? 0) + BALANCE.items.serumMax,
    };
    details.push(`maximum ${STAT_NAME[stat]} now ${statMax(state, target, stat)}`);
  }
  if (details.length && usedEvent?.kind === 'used') usedEvent.detail = details.join(', ');
  // A tool takes a use; a trinket is used up.
  if (def.type === 'trinket') {
    removeItem(user, item.uid);
    noteGone(state, item.itemId);
    pushEvent(state, {
      kind: 'itemGone',
      hikerId: user.id,
      itemId: item.itemId,
      why: 'used',
      cause: '',
    });
  } else {
    loseUses(state, user, item, 1, '');
  }
}
