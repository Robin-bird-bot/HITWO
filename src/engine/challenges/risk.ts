/**
 * Risk challenges (04-challenges.md: Dry Mouth, Thin Ice, Blazing Sun,
 * Dangerous Current, Storm, Lightning, Insane Wind, Bear With a Gun!!,
 * Hypothermia). There's no pass or fail: each hiker may spend some of what
 * they carry to lower their danger, then the game rolls.
 *
 * - A chance: base + points per thing still carried − points per thing spent.
 * - A threshold: carrying at least X resources means it happens.
 * - A loss: a rolled amount, minus some for each thing spent.
 * - A chain (Insane Wind): a run of falling chances, each lowered by what's spent.
 *
 * All of it is data on the card (RiskDef); nothing here names a card.
 */
import { ITEMS } from '../../content';
import type { ItemType } from '../effects';
import type { CardRolls, Gift, Hiker, ResourceId } from '../types';
import { resourceFits } from './resolve';
import { amount } from './rolls';
import type { ChallengeDef, ResourceFilter, RiskDef } from './types';

const ITEM_TYPES: readonly string[] = ['tool', 'food', 'clothes', 'shelter', 'trinket'];

export interface RiskReading {
  kind: RiskDef['measure']['kind'];
  /** A chance or threshold: 0–100 (%). A loss: the amount. A chain: each step's chance, 0–100. */
  value: number;
  steps?: number[];
  /** Threshold: how many they'd carry, and the line. */
  carried?: number;
  at?: number;
}

/** What's left in a hiker's pack after spending these. */
interface Pack {
  resources: Partial<Record<ResourceId, number>>;
  itemTypes: ItemType[];
}

function packAfter(h: Hiker, spent: readonly Gift[]): Pack {
  const resources = { ...h.inventory.resources };
  for (const g of spent) {
    if (g.kind === 'resource') resources[g.resource] = (resources[g.resource] ?? 0) - g.count;
  }
  const gone = new Set(spent.flatMap((g) => (g.kind === 'item' ? [g.uid] : [])));
  const itemTypes = h.inventory.bag
    .filter((i) => !gone.has(i.uid))
    .flatMap((i) => {
      const def = ITEMS[i.itemId];
      return def ? [def.type] : [];
    });
  return { resources, itemTypes };
}

type What = ResourceFilter | 'anyResource' | 'anyItem' | ItemType;

/** How many of a kind of thing are in a pack. */
function countIn(pack: Pack, what: What, rolls: CardRolls): number {
  if (what === 'anyItem') return pack.itemTypes.length;
  if (typeof what === 'string' && ITEM_TYPES.includes(what)) {
    return pack.itemTypes.filter((t) => t === what).length;
  }
  const filter = what === 'anyResource' ? undefined : (what as ResourceFilter);
  return Object.entries(pack.resources).reduce(
    (n, [id, c]) => n + (resourceFits(filter, id, { rolls }) ? Math.max(0, c ?? 0) : 0),
    0,
  );
}

/** How many of a kind of thing were spent. */
function countSpent(h: Hiker, spent: readonly Gift[], what: What, rolls: CardRolls): number {
  let n = 0;
  for (const g of spent) {
    if (g.kind === 'resource' && what !== 'anyItem' && !ITEM_TYPES.includes(what as string)) {
      const filter = what === 'anyResource' ? undefined : (what as ResourceFilter);
      if (resourceFits(filter, g.resource, { rolls })) n += g.count;
    }
    if (g.kind === 'item') {
      const type = ITEMS[h.inventory.bag.find((i) => i.uid === g.uid)?.itemId ?? '']?.type;
      if (what === 'anyItem' || what === type) n += 1;
    }
  }
  return n;
}

/** Can a hiker spend this on the card at all? */
export function riskSpendFits(card: ChallengeDef, h: Hiker, gift: Gift, rolls: CardRolls): boolean {
  if (!card.risk) return false;
  if (gift.kind === 'resource') {
    return card.risk.spend.some(
      (s) =>
        'resources' in s &&
        (s.resources === 'any' || resourceFits(s.resources, gift.resource, { rolls })),
    );
  }
  if (gift.kind === 'item') {
    const type = ITEMS[h.inventory.bag.find((i) => i.uid === gift.uid)?.itemId ?? '']?.type;
    return card.risk.spend.some((s) => 'items' in s && (s.items === 'any' || s.items === type));
  }
  return false;
}

/** A hiker's danger after spending these. */
export function riskReading(
  card: ChallengeDef,
  rolls: CardRolls,
  h: Hiker,
  spent: readonly Gift[],
): RiskReading | undefined {
  const m = card.risk?.measure;
  if (!m) return undefined;
  const ctx = { rolls, onTile: [], hiker: h };
  const pack = packAfter(h, spent);
  const pts = (p: number | string) => amount(p, ctx);
  switch (m.kind) {
    case 'chance': {
      let v = m.base === undefined ? 0 : pts(m.base);
      for (const p of m.perCarried ?? []) v += pts(p.points) * countIn(pack, p.what, rolls);
      for (const p of m.perSpent ?? []) v -= pts(p.points) * countSpent(h, spent, p.what, rolls);
      return { kind: 'chance', value: clamp(v) };
    }
    case 'threshold': {
      const at = amount(m.carriedAtLeast, ctx);
      const carried = countIn(pack, 'anyResource', rolls);
      return { kind: 'threshold', value: carried >= at ? 100 : 0, carried, at };
    }
    case 'loss': {
      let v = amount(m.base, ctx);
      for (const p of m.perSpent) v -= p.amount * countSpent(h, spent, p.what, rolls);
      return { kind: 'loss', value: Math.max(0, v) };
    }
    case 'chain': {
      const off = m.perSpent.reduce(
        (n, p) => n + p.points * countSpent(h, spent, p.what, rolls),
        0,
      );
      const steps = m.chances.map((c) => clamp(Math.round(c * 100) - off));
      return { kind: 'chain', value: steps[0] ?? 0, steps };
    }
  }
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
