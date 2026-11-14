/**
 * Opening a ranger station and stocking it (docs/design/06-ranger-stations.md,
 * "Stock each visit" and "The stations"). All of it from the seeded RNG.
 *
 * - The theme: a random one not used yet this run (the two Rocco shops are
 *   separate themes, so both can come up).
 * - Items: 6 at the first station, +1 at each later one, at most 10. Each slot
 *   has an 8% chance to be a trinket; otherwise the first 4 come from the
 *   theme's focus and the rest from anything. Featured items are 3× as likely,
 *   and the tier is rolled by biome.
 * - Rocco's "Borrowed" Boutique stocks the party's used-or-lost items first.
 * - Rocco's Random Resale sells everything face-down.
 * - Blueprints for sale, free temporary ones for the Workbench, resource
 *   bundles, one shared special, and this visit's market.
 * - The next section is made now, so Preview Next Trail can show it.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS, TABLE_ITEMS } from '../../content/items';
import { RESOURCES } from '../../content/resources';
import { STATION_THEME_BY_ID, STATION_THEMES } from '../../content/stations';
import type { ItemDef } from '../effects';
import { makeItem, qualityOf } from '../items/make';
import { hasQuality, type Quality } from '../items/quality';
import { pick, roll, shuffle, weightedPick } from '../rng';
import { generateSection } from '../trail/generate';
import type {
  BlueprintOffer,
  BundleOffer,
  GameState,
  ItemId,
  ItemOffer,
  SpecialOffer,
  StationSpecialId,
  StationVisit,
} from '../types';
import { blueprintPrice, itemPrice } from './prices';
import type { StationFocus, StationTheme } from './types';

const S = BALANCE.station;

/** The resource packs Rocco's Random Resale can put in its bundles. */
const PACKS: readonly ItemId[] = [
  'forestPack',
  'wildlifePack',
  'riverPack',
  'mountainPack',
  'resourcePack',
];

/** Item cards at this station (1 is the first checkpoint). */
export function stationItemCount(checkpoint: number): number {
  return Math.min(S.items.max, S.items.base + S.items.step * Math.max(0, checkpoint - 1));
}

/** A random theme not used yet this run (or the debug panel's pick). */
function pickTheme(state: GameState): StationTheme {
  const forced = state.debugNextTheme;
  delete state.debugNextTheme;
  if (forced && STATION_THEME_BY_ID[forced]) return STATION_THEME_BY_ID[forced];
  const used = new Set(state.stationThemes ?? []);
  const left = STATION_THEMES.filter((t) => !used.has(t.id));
  return pick(state.rng, left.length ? left : STATION_THEMES);
}

/** Every station sells from the doc's tables; Puked Nuggets only where featured (Chef Bear). */
const sellable = (theme: StationTheme) =>
  TABLE_ITEMS.filter((d) => !d.notFound || theme.featured.includes(d.id));

/** The items a focus (or a blueprint pool) stands for. Trinkets only come from the trinket chance. */
function poolOf(theme: StationTheme, focus: StationFocus): ItemDef[] {
  const all = sellable(theme).filter((d) => d.type !== 'trinket');
  if ('type' in focus) return all.filter((d) => d.type === focus.type);
  if ('items' in focus) return all.filter((d) => focus.items.includes(d.id));
  return all;
}

/** The biome's tier weights for the section this station ends. */
const tierWeights = (state: GameState) =>
  S.tierWeights[Math.min(state.sectionIndex, S.tierWeights.length - 1)] ?? { 1: 1 };

/**
 * One item from a pool: a tier rolled by biome (falling back to the biome's
 * other tiers, then any), featured or favored items more likely, no repeats
 * while others are left.
 */
function pickFrom(
  state: GameState,
  pool: readonly ItemDef[],
  favored: readonly ItemId[],
  taken: ReadonlySet<ItemId>,
): ItemId | undefined {
  const weights = tierWeights(state);
  const tier = weightedPick(
    state.rng,
    Object.entries(weights).map(([t, w]) => ({ item: Number(t), weight: w })),
  );
  const fresh = pool.filter((d) => !taken.has(d.id));
  const choices = [
    fresh.filter((d) => d.tier === tier),
    fresh.filter((d) => (weights[d.tier] ?? 0) > 0),
    fresh,
    [...pool],
  ].find((c) => c.length);
  if (!choices) return undefined;
  return weightedPick(
    state.rng,
    choices.map((d) => ({ item: d.id, weight: favored.includes(d.id) ? S.featuredWeight : 1 })),
  );
}

/** Rocco's log: all of it if it fits, otherwise the least used or lost (ties at random). */
export function fromUsedOrLost(state: GameState, slots: number): ItemId[] {
  const log = Object.entries(state.usedOrLost ?? {}).filter(([id]) => !!ITEMS[id]);
  // Shuffled first, so the stable sort breaks ties at random.
  const order = shuffle(state.rng, log).sort((a, b) => a[1] - b[1]);
  return order.slice(0, slots).map(([id]) => id);
}

/** Shop Quality: the plain curve, the same at every station (Luck doesn't change it). */
function shopQuality(state: GameState): Quality {
  return weightedPick(
    state.rng,
    S.qualityOdds.map((weight, i) => ({ item: (i + 1) as Quality, weight })),
  );
}

function stockItem(state: GameState, theme: StationTheme, itemId: ItemId, i: number): ItemOffer {
  const def = ITEMS[itemId];
  const quality = def && hasQuality(def) ? shopQuality(state) : undefined;
  const item = makeItem(state, itemId, { prefix: 'shop', ...(quality ? { quality } : {}) });
  // A Mystery Item costs its tier's Quality 3 price, whatever is inside.
  const price = theme.mystery ? itemPrice(itemId, 3) : itemPrice(itemId, qualityOf(item));
  return { kind: 'item', id: `item-${i}`, item, price, ...(theme.mystery ? { hidden: true } : {}) };
}

function rollItems(state: GameState, theme: StationTheme, checkpoint: number): ItemOffer[] {
  const count = stationItemCount(checkpoint);
  const boutique = 'usedOrLost' in theme.focus;
  const fixed = boutique ? fromUsedOrLost(state, count) : [];
  const focus = poolOf(theme, theme.focus);
  const anything = poolOf(theme, { any: true });
  const trinkets = sellable(theme).filter((d) => d.type === 'trinket');
  const taken = new Set<ItemId>(fixed);
  const out: ItemOffer[] = [];
  for (let i = 0; i < count; i++) {
    let itemId = fixed[i];
    // The 8% trinket chance only applies to slots the log doesn't fill.
    if (!itemId && roll(state.rng, S.trinketChance)) {
      itemId = pickFrom(state, trinkets, theme.favoredTrinkets ?? [], taken);
    } else if (!itemId) {
      const fromFocus = !boutique && i < S.focusSlots;
      itemId = pickFrom(state, fromFocus ? focus : anything, theme.featured, taken);
    }
    if (!itemId) continue;
    taken.add(itemId);
    out.push(stockItem(state, theme, itemId, i));
  }
  return out;
}

function rollBlueprints(
  state: GameState,
  theme: StationTheme,
  count: number,
  not: ReadonlySet<ItemId>,
): ItemId[] {
  const pool = poolOf(theme, theme.blueprints).filter((d) => !!d.recipe && !not.has(d.id));
  const taken = new Set<ItemId>();
  for (let i = 0; i < count; i++) {
    const id = pickFrom(state, pool, [], taken);
    if (!id || taken.has(id)) break;
    taken.add(id);
  }
  return [...taken];
}

function rollBundles(state: GameState, theme: StationTheme): BundleOffer[] {
  const count = theme.bundles?.count ?? S.bundles;
  return Array.from({ length: count }, (_, i): BundleOffer => {
    const id = `bundle-${i}`;
    if (theme.bundles?.packs && roll(state.rng, S.packChance)) {
      const item = makeItem(state, pick(state.rng, PACKS), { prefix: 'shop' });
      return { kind: 'bundle', id, item, price: S.bundlePrice };
    }
    const resource = pick(state.rng, RESOURCES).id;
    return { kind: 'bundle', id, resource, count: S.bundleSize, price: S.bundlePrice };
  });
}

function rollSpecial(state: GameState): SpecialOffer | undefined {
  const ids = Object.keys(S.specials) as StationSpecialId[];
  if (!ids.length) return undefined;
  const special = pick(state.rng, ids);
  return { kind: 'special', id: 'special', special, price: S.specials[special] ?? 0 };
}

/** This visit's market: 4 resources sell for ×2 and 4 others for ×½. */
function rollMarket(state: GameState): StationVisit['market'] {
  const ids = shuffle(
    state.rng,
    RESOURCES.map((r) => r.id),
  );
  return {
    high: ids.slice(0, S.market.high),
    low: ids.slice(S.market.high, S.market.high + S.market.low),
  };
}

/** Everything on the counter, rolled fresh (a new visit, or the debug panel's reroll). */
export function rollStock(
  state: GameState,
  theme: StationTheme,
  checkpoint: number,
): Pick<
  StationVisit,
  'items' | 'blueprints' | 'bundles' | 'special' | 'market' | 'tempBlueprints'
> {
  const items = rollItems(state, theme, checkpoint);
  const forSale = rollBlueprints(state, theme, S.blueprints, new Set());
  const blueprints = forSale.map((itemId, i): BlueprintOffer => ({
    kind: 'blueprint',
    id: `blueprint-${i}`,
    itemId,
    price: blueprintPrice(itemId),
    ...(theme.mystery ? { hidden: true } : {}),
  }));
  const tempBlueprints = rollBlueprints(state, theme, S.tempBlueprints, new Set(forSale));
  const bundles = rollBundles(state, theme);
  const special = rollSpecial(state);
  const market = rollMarket(state);
  return { items, blueprints, bundles, ...(special ? { special } : {}), market, tempBlueprints };
}

/** Everyone is in: this checkpoint's station, with the next section made ahead of time. */
export function openStation(state: GameState): StationVisit {
  const checkpoint = state.sectionIndex + 1;
  const theme = pickTheme(state);
  state.stationThemes = [...(state.stationThemes ?? []), theme.id];
  // This biome's Wonder is used: the next one gets a different one.
  const wonder = Object.values(state.section.tiles).find((t) => t.wonder)?.wonder?.id;
  if (wonder && !(state.usedWonders ?? []).includes(wonder)) {
    state.usedWonders = [...(state.usedWonders ?? []), wonder];
  }
  const nextIndex = state.sectionIndex + 1;
  const biomes = BALANCE.run.biomes;
  const next = generateSection(state.rng, {
    biome: biomes[nextIndex] ?? biomes[biomes.length - 1] ?? 'meadow',
    tier: Math.min(nextIndex + 1, 3),
    usedWonders: state.usedWonders ?? [],
  });
  return { checkpoint, themeId: theme.id, ...rollStock(state, theme, checkpoint), next };
}

/** The station's theme. */
export const stationTheme = (state: GameState): StationTheme | undefined =>
  state.station ? STATION_THEME_BY_ID[state.station.themeId] : undefined;
