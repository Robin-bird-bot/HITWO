/**
 * Rolling a card's numbers when it's revealed (04-challenges.md, "How to
 * read a challenge"):
 * - X once for the whole card, Y once for each hiker.
 * - Luck skews each roll toward the party's good end: the low end, or the
 *   high end for a range that runs backwards. X uses the average Luck of the
 *   hikers entering; Y uses each hiker's own.
 * - One tier above its own, a card's ranges scale by TIER_SCALE.
 * - "(25%)" parts are included or not, once, at reveal.
 */
import { BALANCE } from '../../config/balance';
import { RESOURCES } from '../../content/resources';
import { nextFloat, roll as rollChance, shuffle } from '../rng';
import { moraleLuck } from '../scavenge/rarity';
import { ITEMS } from '../../content/items';
import { durabilityLeft } from '../items/make';
import type { CardRolls, Hiker, ItemInstance, RngState } from '../types';

export type { CardRolls };
import type { Amount, CardDef, Chance, RollDef } from './types';

/** A hiker's Luck for challenges: Morale's base Luck, for now. */
export function challengeLuck(hiker: Hiker): number {
  return moraleLuck(hiker.stats.morale);
}

/** A roll's range one tier higher (×TIER_SCALE), or shrunk if it runs backwards. */
export function scaledRange(def: RollDef, scale: number): [number, number] {
  const [lo, hi] = def.range;
  if (scale === 1) return [lo, hi];
  const f = def.reverse ? 1 / scale : scale;
  const a = Math.round(lo * f);
  const b = Math.round(hi * f);
  return [Math.min(a, b), Math.max(a, b)];
}

/**
 * A roll's range at a tile's tier (24-challenges-reset.md, sections 2 and 4):
 * a punishment's from its table (above Tier III, Tier III's scaled up); any
 * other number from the card's "From" tier, scaled up for each tier above it.
 */
export function rangeAt(def: RollDef, fromTier: number, at: number): [number, number] {
  const T = BALANCE.challenges.tierScale;
  if (def.byTier) {
    const base = def.byTier[Math.max(1, Math.min(3, at)) as 1 | 2 | 3];
    return scaledRange({ ...def, range: base }, T ** Math.max(0, at - 3));
  }
  return scaledRange(def, T ** Math.max(0, at - fromTier));
}

/** One roll in a range, skewed toward the good end by Luck. */
export function rollValue(
  rng: RngState,
  def: RollDef,
  luck: number,
  scale = 1,
  range?: readonly [number, number],
): number {
  const [lo, hi] = range ?? scaledRange(def, scale);
  const exponent = 2 ** (luck * BALANCE.challenges.luckSkew);
  const u = nextFloat(rng) ** exponent;
  const steps = hi - lo + 1;
  const k = Math.min(steps - 1, Math.floor(u * steps));
  return def.reverse ? hi - k : lo + k;
}

function randomOfName(card: CardDef): string | undefined {
  if (card.kind === 'trial') return undefined;
  for (const option of card.cost) {
    for (const req of option) {
      if (req.kind === 'resources' && req.filter?.randomOf) return req.filter.randomOf;
    }
  }
  return undefined;
}

/**
 * Rolls everything on a card when it's revealed. `fixedLuck` replaces every
 * hiker's Luck (the #debug-challenges page and the debug panel use it).
 */
export function rollCard(
  rng: RngState,
  card: CardDef,
  hikers: readonly Hiker[],
  scale = 1,
  fixedLuck?: number,
  at?: number,
): CardRolls {
  // With the tile's tier, a challenge's numbers follow rangeAt (Nov 26 evening).
  const rangeOf = (def: RollDef) =>
    at !== undefined && card.kind === 'challenge' ? rangeAt(def, card.tier, at) : undefined;
  const luckOf = (h: Hiker) => fixedLuck ?? challengeLuck(h);
  const luck =
    fixedLuck ??
    (hikers.length ? hikers.reduce((sum, h) => sum + challengeLuck(h), 0) / hikers.length : 0);
  const rolls: CardRolls = { x: {}, y: {}, includes: {}, luck };
  const defs = Object.entries(card.rolls ?? {});
  for (const [name, def] of defs) {
    if (def.roll === 'x') rolls.x[name] = rollValue(rng, def, luck, scale, rangeOf(def));
  }
  for (const h of hikers) {
    const own: Record<string, number> = {};
    for (const [name, def] of defs) {
      if (def.roll === 'y') own[name] = rollValue(rng, def, luckOf(h), scale, rangeOf(def));
    }
    rolls.y[h.id] = own;
  }
  for (const [name, chance] of Object.entries(card.includes ?? {})) {
    rolls.includes[name] = rollChance(rng, chance);
  }
  const optionsName = randomOfName(card);
  if (optionsName) {
    const n = rolls.x[optionsName] ?? 0;
    // Picked from what the hikers here carry (Nov 26 evening); all 16 if they carry nothing.
    const carried = RESOURCES.map((r) => r.id).filter((id) =>
      hikers.some((h) => (h.inventory.resources[id] ?? 0) > 0),
    );
    rolls.options = shuffle(rng, carried.length ? carried : RESOURCES.map((r) => r.id)).slice(
      0,
      Math.max(1, n),
    );
  }
  return rolls;
}

// ── Reading numbers off a card ──────────────────────────────────────────────

/** What a card's numbers can depend on. */
export interface AmountContext {
  rolls: CardRolls;
  /** The hiker this is for (their Y, their food, their injuries). */
  hiker?: Hiker;
  /** Everyone on the tile. */
  onTile: readonly Hiker[];
  /** A Risk challenge's worked-out loss. */
  risk?: number;
  /** Counts that need content (food cards carried), from the caller. */
  foodCarried?: (h: Hiker) => number;
}

export function amount(a: Amount, ctx: AmountContext): number {
  if (typeof a === 'number') return a;
  if (typeof a === 'string') {
    if (a === 'risk') return ctx.risk ?? 0;
    if (a in ctx.rolls.x) return ctx.rolls.x[a] ?? 0;
    const own = ctx.hiker ? ctx.rolls.y[ctx.hiker.id] : undefined;
    return own?.[a] ?? 0;
  }
  const base = amount(a.base, ctx);
  const per = perCount(a.per, ctx);
  return a.plus ? base + per : base * per;
}

function perCount(per: Exclude<Amount, number | string>['per'], ctx: AmountContext): number {
  switch (per) {
    case 'hikerOnTile':
      return ctx.onTile.length;
    case 'twoHikersOnTile':
      return Math.ceil(ctx.onTile.length / 2);
    case 'dogOnTile':
      return ctx.onTile.filter((h) => h.family === 'dog').length;
    case 'foodCarried':
      return ctx.hiker && ctx.foodCarried ? ctx.foodCarried(ctx.hiker) : 0;
    case 'injury':
      return ctx.hiker?.injuries ?? 0;
    case 'halfWornDurability': {
      const worn = Object.values(ctx.hiker?.inventory.equipped ?? {}).filter(
        (i): i is ItemInstance => !!i && ITEMS[i.itemId]?.type === 'clothes',
      );
      return Math.ceil(worn.reduce((n, i) => n + durabilityLeft(i), 0) / 2);
    }
  }
}

/** A chance as a fraction: 0.5 stays 0.5; a named percent roll "chance" of 24 is 0.24. */
export function chanceOf(c: Chance, ctx: AmountContext): number {
  if (typeof c === 'number') return c;
  return amount(c, ctx) / 100;
}
