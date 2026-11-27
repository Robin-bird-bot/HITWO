/**
 * Crafting and teaching (docs/design/03-items.md, "Crafting"; Phase 8 step 7).
 *
 * - Craft (uses the action): pay a recipe from the hikers on the tile.
 *   A basic recipe deals cards to pick 1 from (craftTake); a known blueprint
 *   makes exactly that item. The item goes in the crafter's bag, so it needs
 *   room. Crafting an item with its own recipe teaches its blueprint.
 * - Teach (a free action): a hiker passes a blueprint to another on the same
 *   tile, for 4, 6 or 8 of the teacher's Morale by its tier (Wyatt, Nov 13).
 */
import { gainXp } from '../xp';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { countCrafted, countFoodCrafted } from '../counters';
import { foodAppetiteEstimate } from '../items/foodValue';
import { computeCost, fireCraft, fireAction, recipeSubs, wrapsPresents } from '../effects';
import { bagSlots } from '../inventory';
import {
  autoPay,
  craftQuality,
  craftRecipe,
  craftSetup,
  atWorkbench,
  canUseBlueprint,
  craftTier,
  dealCraft,
  knowsBlueprint,
  paymentReason,
  rollTrinketRecipe,
  spend,
  swapsIn,
  CRAFT_TYPES,
} from '../items/craft';
import { earnFreeMove } from '../items/freeMoves';
import { noteCrafted } from '../challenges/trials';
import { makeItem, qualityOf } from '../items/make';
import type { Quality } from '../items/quality';
import { pushEvent } from '../log';
import { changeStat } from '../stats';
import type { Action, GameState, Hiker, ItemId, NodeType, PaidSlot } from '../types';
import {
  findHiker,
  mustFindHiker,
  notActiveReason,
  payCost,
  phaseActionReason,
  spendAction,
} from './common';

type CraftAction = Extract<Action, { type: 'craft' }>;
type TakeAction = Extract<Action, { type: 'craftTake' }>;
type TeachAction = Extract<Action, { type: 'teach' }>;

const NUMERAL = ['', 'I', 'II', 'III', 'IV'];
const TYPE_WORD = {
  tool: 'tools',
  clothes: 'clothes',
  food: 'food',
  shelter: 'shelters',
  trinket: 'trinkets',
};

/** The spaces this craft pays with: as given, or filled by the game. */
function slotsFor(state: GameState, hiker: Hiker, action: CraftAction): (PaidSlot | null)[] {
  if (action.slots) return action.slots;
  const recipe = craftRecipe(state, hiker, action.itemType, action.blueprint);
  return recipe ? autoPay(state, hiker, recipe) : [];
}

/**
 * Why this hiker can't craft at all right now (before any recipe): acted,
 * Inept, Exhausted… At a station's Workbench crafting is free.
 */
export function craftOpenReason(state: GameState, hiker: Hiker): string | undefined {
  // Gift Wrapper's window wraps Presents instead.
  const probe: Action = wrapsPresents(state, hiker)
    ? { type: 'wrapPresent', hikerId: hiker.id, recipe: 'sameResource' }
    : { type: 'craft', hikerId: hiker.id, itemType: 'tool' };
  return craftGate(state, hiker, probe);
}

function craftGate(state: GameState, hiker: Hiker | undefined, action: Action) {
  if (hiker && atWorkbench(state, hiker)) return undefined;
  return phaseActionReason(state, hiker, action);
}

export function validateCraft(state: GameState, action: CraftAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = craftGate(state, hiker, action);
  if (reason || !hiker) return reason;
  // Gift Wrapper: Presents only, even at a station's Workbench.
  if (wrapsPresents(state, hiker)) return `${hiker.name} only wraps Presents.`;
  if (!CRAFT_TYPES.includes(action.itemType)) return 'That isn’t something to craft.';
  if (action.blueprint) {
    const def = ITEMS[action.blueprint];
    if (!def || def.type !== action.itemType) return 'That blueprint isn’t that type.';
    if (!canUseBlueprint(state, hiker, def.id)) {
      return `${hiker.name} doesn’t know that blueprint.`;
    }
    if (!def.recipe) return `The ${def.name} has no recipe of its own.`;
    const tier = craftTier(state, hiker, def.type);
    if (def.tier > tier) {
      return `${hiker.name} crafts ${TYPE_WORD[def.type]} at Tier ${NUMERAL[tier]}: the ${def.name} needs Tier ${NUMERAL[def.tier]}. A ranger station’s workbench raises it.`;
    }
    if (def.madeWithNode && !action.node) return `Pick a node for the ${def.name}.`;
  }
  if (hiker.inventory.bag.length >= bagSlots(state, hiker).total) {
    return `${hiker.name}’s bag is full. Make room for what they craft first.`;
  }
  const recipe = craftRecipe(state, hiker, action.itemType, action.blueprint);
  if (!recipe) return 'There’s no recipe for that.';
  return paymentReason(state, hiker, recipe, slotsFor(state, hiker, action));
}

export function applyCraft(state: GameState, action: CraftAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const slots = slotsFor(state, hiker, action).filter((s): s is PaidSlot => !!s);
  const setup = craftSetup(state, hiker, action.itemType);
  // Garbage Connoisseur: each resource swapped in changes every bite's Appetite.
  const recipe = craftRecipe(state, hiker, action.itemType, action.blueprint);
  const subs = recipeSubs(state, hiker, action.itemType);
  const biteMod = subs && recipe ? subs.perSwap * swapsIn(recipe, slots) : 0;
  if (!atWorkbench(state, hiker)) spendAction(state, hiker);
  spend(state, slots);
  // Work costs Energy, a workbench visit too (29-core-loop.md, section 1).
  payCost(state, hiker, { appetite: 0, energy: craftCost(state, hiker), morale: 0 }, 'Craft');

  if (action.blueprint) {
    const quality = craftQuality(state.rng, action.blueprint, setup);
    finishCraft(state, hiker, action.blueprint, quality, {
      blueprint: true,
      durability: setup.durability,
      paid: slots,
      ...(action.node ? { node: action.node } : {}),
      ...(biteMod ? { biteMod } : {}),
    });
    return;
  }
  state.crafting = {
    hikerId: hiker.id,
    type: action.itemType,
    options: dealCraft(state, action.itemType, craftTier(state, hiker, action.itemType), setup),
    ...(setup.durability ? { durability: setup.durability } : {}),
    ...(biteMod ? { biteMod } : {}),
    paid: slots,
  };
  // Nothing at all could be dealt (no items of the type): the craft ends with nothing.
  if (!state.crafting.options.length) delete state.crafting;
}

export function validateCraftTake(state: GameState, action: TakeAction): string | undefined {
  const open = state.crafting;
  if (!open) return 'Nobody is crafting right now.';
  const option = open.options[action.index];
  if (!option) return 'That card isn’t on the table.';
  const def = ITEMS[option.itemId];
  if (def?.madeWithNode && !action.node) return `Pick a node for the ${def.name}.`;
  return undefined;
}

export function applyCraftTake(state: GameState, action: TakeAction): void {
  const open = state.crafting;
  const option = open?.options[action.index];
  if (!open || !option) throw new Error('applyCraftTake: no card');
  const hiker = mustFindHiker(state, open.hikerId);
  delete state.crafting;
  finishCraft(state, hiker, option.itemId, option.quality, {
    blueprint: false,
    durability: open.durability ?? 0,
    paid: open.paid,
    ...(action.node ? { node: action.node } : {}),
    ...(open.biteMod ? { biteMod: open.biteMod } : {}),
  });
}

/** The item goes in the bag, its blueprint is learned, and everything that listens hears of it. */
function finishCraft(
  state: GameState,
  hiker: Hiker,
  itemId: ItemId,
  quality: Quality | undefined,
  how: {
    blueprint: boolean;
    durability: number;
    paid: PaidSlot[];
    node?: NodeType;
    /** Food: Appetite added to every bite (Garbage Connoisseur's swaps). */
    biteMod?: number;
  },
): void {
  const def = ITEMS[itemId];
  if (!def) return;
  const item = makeItem(state, itemId, {
    prefix: 'crafted',
    ...(quality ? { quality } : {}),
    ...(how.node ? { node: how.node } : {}),
  });
  // Engineering Vest: crafted clothes last longer.
  if (def.type === 'clothes' && how.durability > 0 && item.durability !== undefined) {
    item.durability += how.durability;
    item.maxDurability = item.durability;
  }
  if (def.type === 'food' && how.biteMod) item.appetiteMod = (item.appetiteMod ?? 0) + how.biteMod;
  hiker.inventory.bag.push(item);
  // Only items with their own recipe have a blueprint to learn (not trinkets).
  const learned = !!def.recipe && !knowsBlueprint(hiker, itemId);
  if (learned) hiker.blueprints = [...(hiker.blueprints ?? []), itemId];
  pushEvent(state, {
    kind: 'crafted',
    hikerId: hiker.id,
    itemId,
    ...(item.quality ? { quality: item.quality } : {}),
    blueprint: how.blueprint,
    ...(learned ? { learned: true as const } : {}),
    paid: how.paid,
  });
  countCrafted(state, hiker.id, def.type);
  if (def.type === 'food') countFoodCrafted(state, foodAppetiteEstimate(def, qualityOf(item) ?? 3));
  // Crafting XP by the item's tier: 1, 2, 4 or 8 (action XP, under the row rule).
  const xp = BALANCE.xp.craft[Math.min(def.tier, BALANCE.xp.craft.length) - 1] ?? 0;
  gainXp(state, hiker, xp, 'craft', `Crafted ${def.name}`);
  // Rocco's Rebuilding Trial.
  noteCrafted(state, hiker, def.type);
  // A new set of trinket resources after every trinket.
  if (def.type === 'trinket') state.trinketRecipe = rollTrinketRecipe(state.rng);
  fireCraft(state, hiker, itemId, def.type, { item, paid: how.paid.map((p) => p.resource) });
  fireAction(state, hiker, {
    kind: 'craft',
    role: 'actor',
    tileId: hiker.tileId,
    itemType: def.type,
  });
  // Work Boots: a free move after crafting.
  earnFreeMove(state, hiker, 'afterCraft');
}

/**
 * Crafting's Energy cost, paid when the craft happens (29-core-loop.md,
 * section 1; Wyatt: "let's make crafting also cost 1 energy for now").
 */
export function craftCost(state: GameState, hiker: Hiker): number {
  return computeCost(
    state,
    [hiker],
    {
      key: 'craft.energy',
      actorId: hiker.id,
      subjectId: hiker.id,
      role: 'actor',
      phase: state.phase,
    },
    BALANCE.items.craft.energy,
  );
}

/** What teaching this blueprint costs the teacher: by its tier, and half for a Teacher. */
export function teachCost(state: GameState, teacher: Hiker, itemId: ItemId): number {
  return computeCost(
    state,
    [teacher],
    {
      key: 'teach.morale',
      actorId: teacher.id,
      subjectId: teacher.id,
      role: 'actor',
      phase: state.phase,
    },
    baseTeachCost(itemId),
  );
}

/** What teaching this blueprint costs, by its tier (Wyatt, Nov 13). */
function baseTeachCost(itemId: ItemId): number {
  const tier = ITEMS[itemId]?.tier ?? 1;
  return BALANCE.items.craft.teachMorale[tier] ?? BALANCE.items.craft.teachMorale[1] ?? 4;
}

export function validateTeach(state: GameState, action: TeachAction): string | undefined {
  const teacher = findHiker(state, action.hikerId);
  // At a station, checked-in hikers can teach each other.
  const reason = teacher && atWorkbench(state, teacher) ? undefined : notActiveReason(teacher);
  if (reason || !teacher) return reason;
  const def = ITEMS[action.itemId];
  if (!def || !knowsBlueprint(teacher, action.itemId)) {
    return `${teacher.name} doesn’t know that blueprint.`;
  }
  const student = findHiker(state, action.toId);
  if (!student || student.id === teacher.id) return 'Pick someone else to teach.';
  const ready = student.status === 'active' || atWorkbench(state, student);
  if (!ready) return `${student.name} can’t learn right now.`;
  if (student.tileId !== teacher.tileId) return `${student.name} isn’t on this tile.`;
  if (knowsBlueprint(student, def.id)) return `${student.name} already knows the ${def.name}.`;
  const cost = teachCost(state, teacher, def.id);
  if (teacher.stats.morale < cost) {
    return `${teacher.name} needs ${cost} Morale to teach the ${def.name}.`;
  }
  return undefined;
}

export function applyTeach(state: GameState, action: TeachAction): void {
  const teacher = mustFindHiker(state, action.hikerId);
  const student = mustFindHiker(state, action.toId);
  const cost = teachCost(state, teacher, action.itemId);
  student.blueprints = [...(student.blueprints ?? []), action.itemId];
  pushEvent(state, {
    kind: 'taught',
    hikerId: teacher.id,
    toId: student.id,
    itemId: action.itemId,
    morale: cost,
  });
  changeStat(state, teacher, 'morale', -cost, 'Teaching');
}
