/**
 * Eating (a free action): an active hiker eats one bite of a food in their
 * bag. TODO(wyatt): eating is a free action.
 *
 * - The food's Appetite comes with any change recorded on the card (a
 *   challenge's −1, Meatball Soup's +1), less Food Poisoning's 2. Jerky never
 *   loses Appetite value, so a recorded loss doesn't count for it.
 * - Then the food's own effect (ItemDef.onEat): conditions, Morale, rolls.
 * - A bite is used up (Costco Sample can keep it). The last bite finishes it.
 * - Advent Calendar: only 1 bite a day.
 * - A camp meal (Rotisserie Chicken, Phase 10.6): another hiker on the
 *   owner's tile can eat a bite of it straight from the owner's pack, with
 *   no trade first. It stays in the owner's pack.
 */
import { ITEMS } from '../../content/items';
import { addCondition, addRandomConditions, removeCondition } from '../conditions';
import {
  canActReason,
  computeGain,
  effectContext,
  effectSourcesFor,
  fireTileEat,
  fireAction,
  hikerHas,
} from '../effects';
import type { EatContext } from '../effects';
import { hikersOnTile } from '../map';
import { pushEvent } from '../log';
import { qualityOf } from '../items/make';
import { valueAt } from '../items/quality';
import { removeItem } from '../items/wear';
import { noteGone } from '../items/gone';
import { int, pick, roll } from '../rng';
import { changeStat } from '../stats';
import type { Action, GameState, Hiker, ItemInstance } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';
import { negativeConditions } from './useItem';
import { noteEat } from '../challenges/trials';
import { CONDITIONS } from '../../content/conditions';

type EatAction = Extract<Action, { type: 'eat' }>;

/** Whose pack the bite comes from: the eater's own, or a camp meal's owner on their tile. */
function ownerOf(state: GameState, action: EatAction): Hiker | undefined {
  return findHiker(state, action.fromHikerId ?? action.hikerId);
}

export function validateEat(state: GameState, action: EatAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  const owner = ownerOf(state, action);
  if (!owner) return 'Nobody has that.';
  const item = owner.inventory.bag.find((i) => i.uid === action.itemUid);
  if (!item) return `${owner.name} doesn’t have that.`;
  const def = ITEMS[item.itemId];
  if (!def || def.type !== 'food') return `${def?.name ?? 'That'} isn’t food.`;
  if (owner.id !== hiker.id) {
    if (!def.campMeal) return `${def.name} isn’t a camp meal: trade for it first.`;
    if (owner.tileId !== hiker.tileId) return `${hiker.name} isn’t on ${owner.name}’s tile.`;
  }
  if (def.oneBiteADay && item.lastBiteDay === state.day) {
    return `${hiker.name} already had today’s bite of the ${def.name}.`;
  }
  return canActReason(state, hiker, { action, role: 'actor', phase: state.phase });
}

/** The Appetite a bite of this food gives, before Food Poisoning and other sources. */
export function biteAppetite(item: ItemInstance, base: number): number {
  const def = ITEMS[item.itemId];
  const mod = item.appetiteMod ?? 0;
  return base + (def?.keepsValue ? Math.max(0, mod) : mod);
}

export function applyEat(state: GameState, action: EatAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const owner = ownerOf(state, action) ?? hiker;
  const item = owner.inventory.bag.find((i) => i.uid === action.itemUid);
  const def = item && ITEMS[item.itemId];
  if (!item || !def) return;
  const quality = qualityOf(item);
  const fullBites = Math.max(1, valueAt(def.bites ?? 1, quality));
  const bitesLeft = Math.max(1, item.bitesLeft ?? fullBites);
  // Garbage Gut: Quality 1 food gives this hiker no bad condition.
  const toughGut = quality === 1 && hikerHas(state, hiker, 'ignoresBadFood');
  const bad = (id: string) => toughGut && CONDITIONS[id]?.kind === 'negative';
  let keep = false;
  let ateAppetite = false;

  pushEvent(state, {
    kind: 'ate',
    hikerId: hiker.id,
    itemId: item.itemId,
    bitesLeft: bitesLeft - 1,
    ...(owner.id !== hiker.id ? { fromHikerId: owner.id } : {}),
  });

  const e: EatContext = {
    hiker,
    v: (key) => valueAt(def.values?.[key], quality),
    bitesLeft,
    firstBite: bitesLeft >= fullBites,
    night: state.phase === 'night',
    appetite: (n) => {
      ateAppetite = true;
      const base = Math.max(0, biteAppetite(item, n));
      const gain = computeGain(
        state,
        [hiker],
        {
          key: 'eat.appetite',
          actorId: hiker.id,
          subjectId: hiker.id,
          role: 'actor',
          phase: state.phase,
        },
        base,
      );
      changeStat(state, hiker, 'appetite', gain, def.name);
    },
    stat: (stat, n) => changeStat(state, hiker, stat, n, def.name),
    condition: (id, n, unit, extra = {}) => {
      if (n <= 0 || bad(id)) return;
      addCondition(state, hiker, id, n, unit, def.name, {
        ...(extra.stacks ? { stacks: extra.stacks } : {}),
        ...(extra.thisPhase ? { thisPhase: true as const } : {}),
        ...(extra.then
          ? { then: { id: extra.then.id, remaining: extra.then.n, unit: extra.then.unit } }
          : {}),
      });
    },
    chance: (pct) => pct > 0 && roll(state.rng, pct / 100),
    rollY: (lo, hi) => int(state.rng, lo, Math.max(lo, hi)),
    randomPositive: (count, n, unit) =>
      addRandomConditions(state, hiker, 'positive', count, n, unit, def.name),
    randomNegative: (n, unit) => {
      if (!toughGut) addRandomConditions(state, hiker, 'negative', 1, n, unit, def.name);
    },
    cureRandomNegative: (count) => {
      for (let i = 0; i < count; i++) {
        const bad = negativeConditions(hiker);
        if (!bad.length) return;
        removeCondition(state, hiker, pick(state.rng, bad).id);
      }
    },
    otherFood: (scope) => {
      const owners = scope === 'tile' ? hikersOnTile(state, hiker.tileId) : [hiker];
      return owners
        .flatMap((h) => h.inventory.bag)
        .filter((i) => i !== item && ITEMS[i.itemId]?.type === 'food');
    },
    keepBite: () => {
      keep = true;
    },
  };
  def.onEat?.(e);
  // Food with no Appetite of its own still gives what's been added to the card.
  if (!ateAppetite && (item.appetiteMod ?? 0) > 0) e.appetite(0);
  if (def.oneBiteADay) item.lastBiteDay = state.day;

  const ctx = effectContext(state, hiker);
  for (const source of effectSourcesFor(state, hiker))
    source.hooks.onEat?.({ itemId: item.itemId }, ctx);
  fireTileEat(state, hiker, item.itemId);
  fireAction(state, hiker, { kind: 'eat', role: 'actor', tileId: hiker.tileId });
  // Mold Invasion: eating on its tile brings its penalty.
  noteEat(state, hiker);

  if (keep) {
    pushEvent(state, { kind: 'biteKept', hikerId: hiker.id, itemId: item.itemId });
    return;
  }
  item.bitesLeft = bitesLeft - 1;
  if (item.bitesLeft <= 0) finishFood(state, owner, item);
}

function finishFood(state: GameState, hiker: Hiker, item: ItemInstance): void {
  removeItem(hiker, item.uid);
  noteGone(state, item.itemId);
  pushEvent(state, {
    kind: 'itemGone',
    hikerId: hiker.id,
    itemId: item.itemId,
    why: 'eaten',
    cause: '',
  });
}
