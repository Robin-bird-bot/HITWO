/**
 * Prepare, version 3 (docs/design/20-challenge-popup.md, section 4): hikers
 * spend resources and items from their packs to make a challenge easier.
 * Pure: the pop-up keeps the fills and asks this module what's possible.
 *
 * - **An option** is one effect (+1 HEART, SLOWER ATTACKS) and its cost.
 * - **A cost card** holds every option with the same cost (the same things
 *   accepted, the same number needed). Its slots are the options' limits
 *   added up, at most [3]. A Food card is titled FOOD; any other takes its
 *   first option's title and color.
 * - **Filling a slot:** pick a hiker's stack in the pop-up inventory, then
 *   (when the card has several effects) what it does, then (for a per-hiker
 *   effect) who gets it. An effect with no use left, or a hiker who already
 *   has the most of it, can't be picked.
 * - **A slot's outline** shows the hikers who could fill it now: none when
 *   nobody has enough free, or when the card's effects are all used up. A
 *   ×2 slot takes 2 of the same thing from one hiker.
 * - **Effects** add up: each fill adds its effect's step to its setting,
 *   which the game reads when it starts (and so does the demo). A per-hiker
 *   effect lists its hikers instead.
 * - **Spending** happens only on Start: resources come out of the owners'
 *   packs, and an item loses one use (it's gone at none). Items that don't
 *   track uses stay in the pack; they're listed so the summary can say so.
 */
import { BALANCE } from '../config/balance';
import { ITEMS } from '../content/items';
import { RESOURCES } from '../content/resources';
import type { MinigameSettings } from './types';

/** A resource, an item, or a group: any resource of one node ("forest"). */
export interface Thing {
  kind: 'resource' | 'item' | 'group';
  id: string;
}

const things =
  (kind: Thing['kind']) =>
  (...ids: string[]): Thing[] =>
    ids.map((id) => ({ kind, id }));
export const res = things('resource');
export const item = things('item');
export const group = things('group');

/** Food: Meat, Fish or Mushroom ×1, the general stamina help (section 7). */
export const FOOD: readonly Thing[] = res('meat', 'fish', 'mushroom');

/** What a slot really takes: a group stands for every resource of its node. */
export function expand(accepts: readonly Thing[]): Thing[] {
  return accepts.flatMap((t) =>
    t.kind === 'group'
      ? RESOURCES.filter((r) => r.node === t.id).map((r) => ({
          kind: 'resource' as const,
          id: r.id,
        }))
      : [t],
  );
}

export type CardColor = 'green' | 'blue' | 'red';

/** One Prepare effect and its cost. */
export interface Option {
  id: string;
  /** The card's title when the option has the card to itself (a Food card is always FOOD). */
  title: string;
  /** Green: more for you. Blue: see or know more. Red: a weaker challenge. */
  color: CardColor;
  accepts: readonly Thing[];
  /** How many of the thing one slot takes (×2 Clay). */
  need: number;
  /** Its name in the pixel font: "+1 HEART", "SLOWER ATTACKS". */
  label: string;
  /** On a filled slot's badge: "SLOW", "−1 BEE" (a per-hiker one shows the hiker instead). */
  short: string;
  /** One short note in softer ink: "−1 speed". */
  note: string;
  /** Given to one hiker, picked after filling. */
  perHiker?: true;
  /** Uses at most (each hiker, for a per-hiker effect). */
  max: number;
  /** A per-hiker effect's uses at most in all (Falling Rocks' HARDHAT: one, for one hiker). */
  total?: number;
  /** The setting each use adds `step` to (a per-hiker effect lists its hikers). */
  param: string;
  step: number;
  /** Only when this holds for the run (the night version, Tier III and up). */
  onlyIf?(settings: MinigameSettings): boolean;
  /** Filling it skips the challenge: Start becomes SKIP IT. */
  skip?: true;
}

export interface Card {
  id: string;
  title: string;
  color: CardColor;
  accepts: readonly Thing[];
  need: number;
  slots: number;
  effects: readonly Option[];
}

export interface PackItem {
  uid: string;
  itemId: string;
  usesLeft?: number;
  durability?: number;
}

export interface Pack {
  resources: Readonly<Partial<Record<string, number>>>;
  items: readonly PackItem[];
}

export type Packs = Readonly<Record<string, Pack>>;

export interface Slot {
  key: string;
  card: Card;
}

/** A filled slot: whose stack of what, what it does, and (per-hiker) who gets it. */
export interface Fill {
  hiker: string;
  thing: Thing;
  effect: string;
  target?: string;
}

export type Fills = Readonly<Record<string, Fill>>;

const same = (a: Thing, b: Thing) => a.kind === b.kind && a.id === b.id;
const costKey = (o: Pick<Option, 'accepts' | 'need'>) =>
  `${o.need}|${o.accepts.map((t) => `${t.kind}:${t.id}`).join(',')}`;
const FOOD_KEY = costKey({ accepts: FOOD, need: 1 });

/** An option's most uses in all: per-hiker effects once (or `max`) for each hiker. */
const limitOf = (o: Option, hikers: number) =>
  o.perHiker ? Math.min(o.total ?? Infinity, o.max * hikers) : o.max;

/**
 * The cards for this run (section 4.1): the options that apply, grouped by
 * cost in their order. A challenge's own options join the same grouping.
 */
export function cardsFor(
  options: readonly Option[],
  settings: MinigameSettings,
  hikers: number,
): Card[] {
  const cards = new Map<string, Option[]>();
  for (const o of options) {
    if (o.onlyIf && !o.onlyIf(settings)) continue;
    const key = costKey(o);
    cards.set(key, [...(cards.get(key) ?? []), o]);
  }
  const most = BALANCE.minigames.prepare.cardSlots;
  return [...cards.entries()].map(([key, effects]) => {
    const first = effects[0]!;
    return {
      id: effects.map((e) => e.id).join('+'),
      title: key === FOOD_KEY ? 'FOOD' : first.title,
      color: first.color,
      accepts: first.accepts,
      need: first.need,
      slots: Math.max(
        1,
        Math.min(
          most,
          effects.reduce((n, e) => n + limitOf(e, hikers), 0),
        ),
      ),
      effects,
    };
  });
}

/** Every slot, card by card. */
export const slotsFor = (cards: readonly Card[]): Slot[] =>
  cards.flatMap((card) =>
    Array.from({ length: card.slots }, (_, k) => ({ key: `${card.id}:${k}`, card })),
  );

/** A thing's name: "Meat", "Bear Spray"; an item the game doesn't have yet from its id. */
export function thingName(t: Thing): string {
  if (t.kind === 'resource') return RESOURCES.find((r) => r.id === t.id)?.name ?? t.id;
  if (t.kind === 'group') return `${t.id[0]!.toUpperCase()}${t.id.slice(1)} resources`;
  return ITEMS[t.id]?.name ?? t.id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** The cost written out (section 4.2): "×1 MEAT, FISH OR MUSHROOM", "×2 FOREST RESOURCES". */
export function costText(card: Pick<Card, 'accepts' | 'need'>): string {
  const names = card.accepts.map((t) => thingName(t).toUpperCase());
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} OR ${names.at(-1)}` : (names[0] ?? '');
  return `×${card.need} ${list}`;
}

/** How many of a thing a hiker carries (items: how many of that item). */
export function have(packs: Packs, hiker: string, thing: Thing): number {
  const pack = packs[hiker];
  if (!pack) return 0;
  return thing.kind === 'item'
    ? pack.items.filter((i) => i.itemId === thing.id).length
    : (pack.resources[thing.id] ?? 0);
}

/** How many of a hiker's thing the filled slots use (all but `except`). */
export function used(
  slots: readonly Slot[],
  fills: Fills,
  hiker: string,
  thing: Thing,
  except?: string,
): number {
  return slots.reduce((n, s) => {
    const f = fills[s.key];
    return f && s.key !== except && f.hiker === hiker && same(f.thing, thing) ? n + s.card.need : n;
  }, 0);
}

/** How many of a hiker's thing are still free for a slot (its own fill counts as free). */
export const free = (
  packs: Packs,
  slots: readonly Slot[],
  fills: Fills,
  hiker: string,
  thing: Thing,
  except?: string,
): number => have(packs, hiker, thing) - used(slots, fills, hiker, thing, except);

/** How many fills use an effect (for one hiker, when given), all but `except`. */
export function uses(fills: Fills, effect: string, target?: string, except?: string): number {
  return Object.entries(fills).filter(
    ([key, f]) =>
      key !== except && f.effect === effect && (target === undefined || f.target === target),
  ).length;
}

/** Whether a hiker can still get a per-hiker effect (they don't have the most yet). */
export const targetOpen = (effect: Option, hiker: string, fills: Fills, except?: string): boolean =>
  uses(fills, effect.id, hiker, except) < effect.max;

/** Whether an effect has a use left (for a per-hiker one: some hiker can still get it). */
export const effectOpen = (
  effect: Option,
  fills: Fills,
  hikers: readonly string[],
  except?: string,
): boolean =>
  effect.perHiker
    ? (effect.total === undefined || uses(fills, effect.id, undefined, except) < effect.total) &&
      hikers.some((h) => targetOpen(effect, h, fills, except))
    : uses(fills, effect.id, undefined, except) < effect.max;

/** Whether a hiker has enough of something the slot takes, free, to fill it. */
export const canFill = (
  slot: Slot,
  slots: readonly Slot[],
  fills: Fills,
  packs: Packs,
  hiker: string,
): boolean =>
  expand(slot.card.accepts).some(
    (t) => free(packs, slots, fills, hiker, t, slot.key) >= slot.card.need,
  );

/**
 * The hikers (in line order) who could fill an empty slot now: its
 * outline's colors. None when the card's effects are all used up.
 */
export function whoCanFill(
  slot: Slot,
  slots: readonly Slot[],
  fills: Fills,
  packs: Packs,
  order: readonly string[],
): string[] {
  if (fills[slot.key]) return [];
  if (!slot.card.effects.some((e) => effectOpen(e, fills, order, slot.key))) return [];
  return order.filter((h) => canFill(slot, slots, fills, packs, h));
}

/** The cards in their order, but cards nobody can fill go last (section 4.1). */
export function orderCards(
  cards: readonly Card[],
  slots: readonly Slot[],
  fills: Fills,
  packs: Packs,
  order: readonly string[],
): Card[] {
  const fillable = (c: Card) =>
    slots.some(
      (s) =>
        s.card.id === c.id &&
        (!!fills[s.key] || whoCanFill(s, slots, fills, packs, order).length > 0),
    );
  return [...cards.filter(fillable), ...cards.filter((c) => !fillable(c))];
}

export interface Tile {
  thing: Thing;
  /** Whose stack (none: nobody has one). */
  hiker: string | null;
  /** How many are free for this slot. */
  free: number;
  /** Enough free to fill it. */
  ok: boolean;
  /** Some of the stack is in other slots. */
  partlyUsed: boolean;
}

/**
 * The inventory for a slot: one tile per hiker stack of each thing it
 * takes, in the card's order of things, then line order; a faded tile with
 * no owner for a thing nobody has; the ones that can be picked first.
 */
export function tilesFor(
  slot: Slot,
  slots: readonly Slot[],
  fills: Fills,
  packs: Packs,
  order: readonly string[],
): Tile[] {
  const out: Tile[] = [];
  for (const thing of expand(slot.card.accepts)) {
    let any = false;
    for (const hiker of order) {
      const n = have(packs, hiker, thing);
      if (n <= 0) continue;
      any = true;
      const f = free(packs, slots, fills, hiker, thing, slot.key);
      out.push({ thing, hiker, free: f, ok: f >= slot.card.need, partlyUsed: f < n });
    }
    if (!any) out.push({ thing, hiker: null, free: 0, ok: false, partlyUsed: false });
  }
  return [...out.filter((t) => t.ok), ...out.filter((t) => !t.ok)];
}

/**
 * What's left to pick after a tile (section 4.4): what it does (only with
 * several effects), then who gets it (only for a per-hiker effect).
 */
export function nextStep(slot: Slot, effectId: string | null): 'what' | 'who' | 'done' {
  const effects = slot.card.effects;
  if (effectId === null) {
    if (effects.length > 1) return 'what';
    return effects[0]?.perHiker ? 'who' : 'done';
  }
  return effects.find((e) => e.id === effectId)?.perHiker ? 'who' : 'done';
}

/**
 * Fills a slot (section 4.4): a tile that can be picked, an effect with a
 * use left, and a hiker who can still get it when it's per-hiker. Anything
 * else leaves the fills as they were.
 */
export function fillSlot(
  fills: Fills,
  slot: Slot,
  tile: Tile,
  effectId: string,
  hikers: readonly string[],
  target?: string,
): Fills {
  if (!tile.ok || !tile.hiker) return fills;
  const effect = slot.card.effects.find((e) => e.id === effectId);
  if (!effect || !effectOpen(effect, fills, hikers, slot.key)) return fills;
  if (effect.perHiker && (!target || !targetOpen(effect, target, fills, slot.key))) return fills;
  const fill: Fill = { hiker: tile.hiker, thing: tile.thing, effect: effect.id };
  if (effect.perHiker && target) fill.target = target;
  return { ...fills, [slot.key]: fill };
}

/** Empties a slot (its effect is free again). */
export function emptySlot(fills: Fills, key: string): Fills {
  if (!fills[key]) return fills;
  const next = { ...fills };
  delete next[key];
  return next;
}

/** A fill's effect. */
export const effectOf = (slot: Slot, fill: Fill): Option | undefined =>
  slot.card.effects.find((e) => e.id === fill.effect);

/** How many times each effect is used, who got the per-hiker ones, and whether SKIP IT is filled. */
export function effects(
  slots: readonly Slot[],
  fills: Fills,
): { counts: Record<string, number>; perHiker: Record<string, string[]>; skip: boolean } {
  const counts: Record<string, number> = {};
  const perHiker: Record<string, string[]> = {};
  let skip = false;
  for (const s of slots) {
    const f = fills[s.key];
    const e = f && effectOf(s, f);
    if (!f || !e) continue;
    counts[e.id] = (counts[e.id] ?? 0) + 1;
    if (e.perHiker && f.target) (perHiker[e.id] ??= []).push(f.target);
    if (e.skip) skip = true;
  }
  return { counts, perHiker, skip };
}

/**
 * The game's settings with Prepare on top: each fill adds its effect's step
 * to the effect's setting; a per-hiker effect's setting lists its hikers.
 */
export function applyPrepare(
  settings: MinigameSettings,
  slots: readonly Slot[],
  fills: Fills,
): MinigameSettings {
  const out: MinigameSettings = { ...settings };
  for (const s of slots) {
    const f = fills[s.key];
    const e = f && effectOf(s, f);
    if (!f || !e || e.skip) continue;
    if (e.perHiker) {
      if (!f.target) continue;
      const list = Array.isArray(out[e.param]) ? (out[e.param] as readonly string[]) : [];
      out[e.param] = [...list, f.target];
      continue;
    }
    const now = typeof out[e.param] === 'number' ? (out[e.param] as number) : 0;
    out[e.param] = Math.round((now + e.step) * 1e6) / 1e6;
  }
  return out;
}

/** A setting Prepare added to (0 when it didn't). */
export const prepNumber = (settings: MinigameSettings, param: string): number => {
  const v = settings[param];
  return typeof v === 'number' ? v : 0;
};

/** How many times Prepare gave a hiker a per-hiker effect (+1 heart each). */
export const prepFor = (settings: MinigameSettings, param: string, hiker: string): number => {
  const v = settings[param];
  return Array.isArray(v) ? v.filter((h) => h === hiker).length : 0;
};

/** A per-hiker setting as counts by hiker: { finn: 1 }. */
export function perHikerCounts(settings: MinigameSettings, param: string): Record<string, number> {
  const v = settings[param];
  const out: Record<string, number> = {};
  if (Array.isArray(v)) for (const h of v) out[h] = (out[h] ?? 0) + 1;
  return out;
}

export interface Spent {
  hiker: string;
  thing: Thing;
  count: number;
}

/**
 * Start: what's in the slots comes out of the owners' packs. Resources are
 * taken; an item loses one use and is gone at none. An item that doesn't
 * track uses (clothes, trinkets) stays, and is listed in `untracked`.
 */
export function spend(
  packs: Packs,
  slots: readonly Slot[],
  fills: Fills,
): { packs: Packs; spent: Spent[]; untracked: string[] } {
  const next: Record<string, { resources: Partial<Record<string, number>>; items: PackItem[] }> =
    Object.fromEntries(
      Object.entries(packs).map(([h, p]) => [
        h,
        { resources: { ...p.resources }, items: p.items.map((i) => ({ ...i })) },
      ]),
    );
  const spent: Spent[] = [];
  const untracked: string[] = [];
  const usedUids = new Set<string>();
  for (const s of slots) {
    const f = fills[s.key];
    if (!f) continue;
    const pack = next[f.hiker];
    if (!pack) continue;
    spent.push({ hiker: f.hiker, thing: f.thing, count: s.card.need });
    if (f.thing.kind !== 'item') {
      pack.resources[f.thing.id] = Math.max(0, (pack.resources[f.thing.id] ?? 0) - s.card.need);
      continue;
    }
    // Each slot uses its own item (a stack of two Bear Sprays fills two slots).
    for (let k = 0; k < s.card.need; k++) {
      const at = pack.items.findIndex((i) => i.itemId === f.thing.id && !usedUids.has(i.uid));
      if (at < 0) break;
      const it = pack.items[at]!;
      usedUids.add(it.uid);
      if (it.usesLeft === undefined) {
        untracked.push(f.thing.id);
        continue;
      }
      if (it.usesLeft <= 1) pack.items.splice(at, 1);
      else pack.items[at] = { ...it, usesLeft: it.usesLeft - 1 };
    }
  }
  return { packs: next, spent, untracked: [...new Set(untracked)] };
}
