/**
 * Prepare (docs/design/20-challenge-popup.md, section 4): hikers spend
 * resources and items from their packs to make a challenge easier. Pure:
 * the pop-up keeps the fills and asks this module what's possible.
 *
 * - **A row** is one effect (SLOWER ATTACKS) with a few **slots**, each one
 *   use of it. Per-hiker rows (+1 HEART) have one slot in each hiker's row.
 * - **A slot** takes one of a few things (`accepts`), `need` of it, from any
 *   hiker who has that many free: a stack used in one slot can't be used in
 *   another.
 * - **The inventory** shows one tile per hiker stack of each thing the slot
 *   takes (a faded tile with no owner when nobody has one), the ones that
 *   can be picked first.
 * - **Effects** add up per row: each filled slot adds the row's `step` to
 *   its setting, which the game reads when it starts (and so does the demo).
 *   Per-hiker rows list the hikers instead.
 * - **Spending** happens only on Start: resources come out of the owners'
 *   packs, and an item loses one use (it's gone at none). Items that don't
 *   track uses stay in the pack; they're listed so the summary can say so.
 */
import type { MinigameSettings } from './types';

export interface Thing {
  kind: 'resource' | 'item';
  id: string;
}

const things =
  (kind: Thing['kind']) =>
  (...ids: string[]): Thing[] =>
    ids.map((id) => ({ kind, id }));
export const res = things('resource');
export const item = things('item');

/** Food: Meat, Fish or Mushroom ×1, the general stamina help (section 7). */
export const FOOD: readonly Thing[] = res('meat', 'fish', 'mushroom');

export interface PrepRow {
  id: string;
  /** In the pixel font: SLOWER ATTACKS. */
  label: string;
  /** One short line on what each slot does: −1 speed each. */
  line: string;
  /** How many slots (a per-hiker row has one in each hiker's row instead). */
  slots: number;
  perHiker?: true;
  accepts: readonly Thing[];
  /** How many of the thing one slot takes (Grass or Moss ×2). */
  need: number;
  /** The setting each filled slot adds `step` to (a per-hiker row lists the hikers). */
  effect: { param: string; step: number };
  /** Only when this holds for the run (the night version, Tier III and up). */
  onlyIf?(settings: MinigameSettings): boolean;
  /** Filling it skips the challenge: Start becomes SKIP IT. */
  skip?: true;
  /** A per-hiker slot's corner tag: "+1♥". */
  tag?: string;
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
  row: PrepRow;
  /** A per-hiker slot: whose row it's in. */
  hiker?: string;
}

/** What fills a slot: whose stack of what. */
export interface Fill {
  hiker: string;
  thing: Thing;
}

export type Fills = Readonly<Record<string, Fill>>;

const same = (a: Thing, b: Thing) => a.kind === b.kind && a.id === b.id;

/** The rows that apply this run (section 4, "Only rows that can apply this run"). */
export const rowsFor = (rows: readonly PrepRow[], settings: MinigameSettings): PrepRow[] =>
  rows.filter((r) => !r.onlyIf || r.onlyIf(settings));

/** Every slot: a row's slots in order, and a per-hiker row's one per hiker in line order. */
export function slotsFor(rows: readonly PrepRow[], hikers: readonly string[]): Slot[] {
  return rows.flatMap((row) =>
    row.perHiker
      ? hikers.map((hiker) => ({ key: `${row.id}:${hiker}`, row, hiker }))
      : Array.from({ length: row.slots }, (_, k) => ({ key: `${row.id}:${k}`, row })),
  );
}

/** How many of a thing a hiker carries (items: how many of that item). */
export function have(packs: Packs, hiker: string, thing: Thing): number {
  const pack = packs[hiker];
  if (!pack) return 0;
  return thing.kind === 'resource'
    ? (pack.resources[thing.id] ?? 0)
    : pack.items.filter((i) => i.itemId === thing.id).length;
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
    return f && s.key !== except && f.hiker === hiker && same(f.thing, thing) ? n + s.row.need : n;
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

/** Whether a hiker has enough of something the slot takes, free, to fill it. */
export const canFill = (
  slot: Slot,
  slots: readonly Slot[],
  fills: Fills,
  packs: Packs,
  hiker: string,
): boolean =>
  slot.row.accepts.some((t) => free(packs, slots, fills, hiker, t, slot.key) >= slot.row.need);

/** The hikers (in line order) who could fill an empty slot now: its outline's colors. */
export const whoCanFill = (
  slot: Slot,
  slots: readonly Slot[],
  fills: Fills,
  packs: Packs,
  order: readonly string[],
): string[] => (fills[slot.key] ? [] : order.filter((h) => canFill(slot, slots, fills, packs, h)));

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
 * takes, in the slot's order of things, then line order; a faded tile with
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
  for (const thing of slot.row.accepts) {
    let any = false;
    for (const hiker of order) {
      const n = have(packs, hiker, thing);
      if (n <= 0) continue;
      any = true;
      const f = free(packs, slots, fills, hiker, thing, slot.key);
      out.push({ thing, hiker, free: f, ok: f >= slot.row.need, partlyUsed: f < n });
    }
    if (!any) out.push({ thing, hiker: null, free: 0, ok: false, partlyUsed: false });
  }
  // Stable: usable ones first, each group keeping its order.
  return [...out.filter((t) => t.ok), ...out.filter((t) => !t.ok)];
}

/** Fills a slot from a tile (nothing happens for a tile that can't be picked). */
export function fillSlot(fills: Fills, slot: Slot, tile: Tile): Fills {
  if (!tile.ok || !tile.hiker) return fills;
  return { ...fills, [slot.key]: { hiker: tile.hiker, thing: tile.thing } };
}

/** Empties a slot. */
export function emptySlot(fills: Fills, key: string): Fills {
  if (!fills[key]) return fills;
  const next = { ...fills };
  delete next[key];
  return next;
}

/** How many of each row's slots are filled, and for per-hiker rows, whose. */
export function effects(
  slots: readonly Slot[],
  fills: Fills,
): { counts: Record<string, number>; perHiker: Record<string, string[]>; skip: boolean } {
  const counts: Record<string, number> = {};
  const perHiker: Record<string, string[]> = {};
  let skip = false;
  for (const s of slots) {
    if (!fills[s.key]) continue;
    counts[s.row.id] = (counts[s.row.id] ?? 0) + 1;
    if (s.row.perHiker && s.hiker) (perHiker[s.row.id] ??= []).push(s.hiker);
    if (s.row.skip) skip = true;
  }
  return { counts, perHiker, skip };
}

/**
 * The game's settings with Prepare on top: each filled slot adds its row's
 * step to the row's setting; a per-hiker row's setting lists the hikers
 * (one entry per filled slot).
 */
export function applyPrepare(
  settings: MinigameSettings,
  slots: readonly Slot[],
  fills: Fills,
): MinigameSettings {
  const out: MinigameSettings = { ...settings };
  for (const s of slots) {
    if (!fills[s.key] || s.row.skip) continue;
    const { param, step } = s.row.effect;
    if (s.row.perHiker && s.hiker) {
      const list = Array.isArray(out[param]) ? (out[param] as readonly string[]) : [];
      out[param] = [...list, s.hiker];
      continue;
    }
    const now = typeof out[param] === 'number' ? (out[param] as number) : 0;
    out[param] = Math.round((now + step) * 1e6) / 1e6;
  }
  return out;
}

/** A setting Prepare added to (0 when it didn't). */
export const prepNumber = (settings: MinigameSettings, param: string): number => {
  const v = settings[param];
  return typeof v === 'number' ? v : 0;
};

/** How many times Prepare added a hiker to a per-hiker setting (+1 heart each). */
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
    spent.push({ hiker: f.hiker, thing: f.thing, count: s.row.need });
    if (f.thing.kind === 'resource') {
      pack.resources[f.thing.id] = Math.max(0, (pack.resources[f.thing.id] ?? 0) - s.row.need);
      continue;
    }
    // Each slot uses its own item (a stack of two Bear Sprays fills two slots).
    for (let k = 0; k < s.row.need; k++) {
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
