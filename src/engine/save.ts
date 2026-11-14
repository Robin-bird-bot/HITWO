/**
 * Saves are versioned (CLAUDE.md rule 7). Bump SAVE_VERSION whenever the shape
 * of GameState changes, and add a migration from the old version. Loading
 * never throws: a save that can't be read comes back as { ok: false }.
 */
import { rollTrailShop } from './station/trail';
import { openStation } from './station/stock';
import { BALANCE } from '../config/balance';
import { freshAbundance } from './abundance';
import { freshCounters } from './counters';
import { WONDERS } from '../content/wonders';
import { RENAMED_ITEMS } from '../content/items';
import { withDefaults } from './items/make';
import { shelterNights } from './items/shelters';
import {
  NODE_TYPES,
  PHASES,
  type GameState,
  type ItemInstance,
  type Tile,
  type WeatherState,
} from './types';
import { freshWeather } from './weather';

export const SAVE_VERSION = 13;

export type LoadFailure = 'empty' | 'corrupt' | 'tooNew' | 'unsupported';
export type LoadResult = { ok: true; state: GameState } | { ok: false; reason: LoadFailure };

type SaveData = Record<string, unknown>;

/** Upgrades a save from version N (the key) to N + 1. */
const MIGRATIONS: Record<number, (save: SaveData) => SaveData> = {
  // Phase 4: Abundance meters (at the start value) and today's scavenges.
  1: (save) => ({ ...save, abundance: freshAbundance(), scavengedToday: [] }),
  // Phase 5: which challenges this section has used.
  2: (save) => ({ ...save, usedCards: [] }),
  // Phase 5 (Nov 6 update): run counters for Wonder goals, starting from zero.
  3: (save) => ({ ...save, counters: freshCounters() }),
  // Phase 5 (Nov 6 update): every biome has a Wonder. An older trail gets one on a tile nobody has reached.
  4: (save) => addWonder(save),
  // Phase 6: real weather with a forecast. The old debug weather carries over as Storm or Heatwave.
  5: (save) => ({ ...save, weather: upgradeWeather(save) }),
  // Phase 7: a passed-out hiker's countdown, starting full; injuries stop at the pass-out line.
  6: (save) => ({
    ...save,
    hikers: Array.isArray(save.hikers) ? save.hikers.map(addCountdown) : [],
  }),
  // Phase 8: the Nov 7 item list. Old items become their replacements, and every
  // item gets a Quality (3) and full uses, bites or durability.
  7: (save) => upgradeItems(save),
  // Phase 8 step 5: a shelter on a tile is an object with its nights left (Ruins built ids).
  8: (save) => upgradeShelters(save),
  // Phase 8 step 7: crafting. Blueprints, craft tiers, an open craft and the trinket set are
  // all optional, so an older save needs nothing new.
  9: (save) => save,
  // Phase 9: check-ins, the station visit and the summit (all optional).
  10: (save) => save,
  // Phase 9 step 2: a station opened in step 1 had only its number. Stock it now.
  11: (save) => upgradeStation(save),
  // Phase 9 step 6: a Merchant or Trader someone already reached gets its wares.
  12: (save) => upgradeTrailShops(save),
};

/** Side features on tiles already reached, from before they had wares. */
function upgradeTrailShops(save: SaveData): SaveData {
  const state = save as unknown as GameState;
  for (const tile of Object.values(state.section?.tiles ?? {})) {
    if (tile.feature && tile.visited && !tile.shop) rollTrailShop(state, tile);
  }
  return save;
}

/** A step 1 station (just `{ checkpoint }`) gets its theme, stock and next section. */
function upgradeStation(save: SaveData): SaveData {
  const station = save.station;
  if (!isRecord(station) || typeof station.themeId === 'string') return save;
  const state = save as unknown as GameState;
  state.station = openStation(state);
  return save;
}

/** Shelters stored as item ids become placed shelters with their full nights. */
function upgradeShelters(save: SaveData): SaveData {
  const section = save.section;
  if (!isRecord(section) || !isRecord(section.tiles)) return save;
  for (const [id, tile] of Object.entries(section.tiles)) {
    if (!isRecord(tile) || !Array.isArray(tile.shelters)) continue;
    tile.shelters = tile.shelters.map((s, i) =>
      isString(s) ? { uid: `shelter-${id}-${i}-${s}`, itemId: s, nightsLeft: shelterNights(s) } : s,
    );
  }
  return save;
}

/** An old item id's replacement (03-items.md, "Older items, merged or replaced"). */
const renamed = (id: unknown) => (isString(id) ? (RENAMED_ITEMS[id] ?? id) : id);

function upgradeItem(item: unknown): unknown {
  if (!isRecord(item) || !isString(item.itemId)) return item;
  // Wear and lost uses were recorded on items until they had durability and uses.
  const { wear, usesLost, ...rest } = item;
  const out = withDefaults({
    ...(rest as unknown as ItemInstance),
    itemId: String(renamed(item.itemId)),
  });
  if (isNumber(wear) && out.durability !== undefined)
    out.durability = Math.max(1, out.durability - wear);
  if (isNumber(usesLost) && out.usesLeft !== undefined)
    out.usesLeft = Math.max(1, out.usesLeft - usesLost);
  return out;
}

/** Ids shown in the trail log and on an open scavenge deal, renamed. */
function renameIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(renameIds);
  if (!isRecord(v)) return v;
  const out: SaveData = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === 'itemId') out[k] = renamed(x);
    else if (k === 'items' && Array.isArray(x)) out[k] = x.map(renamed);
    else out[k] = renameIds(x);
  }
  return out;
}

/** Every item a save holds, renamed and filled in. */
function upgradeItems(save: SaveData): SaveData {
  const hikers = Array.isArray(save.hikers)
    ? save.hikers.map((h) => {
        if (!isRecord(h) || !isRecord(h.inventory)) return h;
        const inv = h.inventory;
        const equipped = isRecord(inv.equipped)
          ? Object.fromEntries(Object.entries(inv.equipped).map(([k, v]) => [k, upgradeItem(v)]))
          : {};
        const bag = Array.isArray(inv.bag) ? inv.bag.map(upgradeItem) : [];
        return { ...h, inventory: { ...inv, bag, equipped } };
      })
    : save.hikers;
  return {
    ...save,
    hikers,
    ...(Array.isArray(save.log) ? { log: renameIds(save.log) } : {}),
    ...(isRecord(save.scavenge) ? { scavenge: renameIds(save.scavenge) } : {}),
  };
}

/** A passed-out hiker gets a full countdown, and injuries past the line come down to it. */
function addCountdown(h: unknown): unknown {
  if (!isRecord(h)) return h;
  const out = { ...h };
  if (isNumber(out.injuries)) out.injuries = Math.min(out.injuries, BALANCE.injuries.passOutAt);
  if (out.status === 'passedOut' && !isNumber(out.countdown)) {
    out.countdown = BALANCE.passOut.countdownNights;
  }
  return out;
}

/** The weather a version 5 save had ('stormy', 'sunny' or none), as today's, with a fresh forecast. */
function upgradeWeather(save: SaveData): WeatherState {
  const seed = isNumber(save.seed) ? save.seed : 0;
  const day = isNumber(save.day) ? save.day : 1;
  const w = freshWeather(seed, day);
  const old = save.weather;
  w.today = old === 'stormy' ? 'storm' : old === 'sunny' ? 'heatwave' : 'clear';
  return w;
}

/**
 * Puts a Wonder on a plain tile nobody has landed on, preferring one whose
 * nodes are all still hidden, so the map looks the same. Picked from the seed,
 * so loading the same save twice gives the same Wonder.
 */
function addWonder(save: SaveData): SaveData {
  const section = save.section;
  if (!isRecord(section) || !isRecord(section.tiles)) return save;
  const tiles = Object.values(section.tiles as Record<string, Tile>);
  if (tiles.some((t) => t.wonder)) return save;
  const plain = tiles
    .filter((t) => t.kind === 'normal' && !t.visited && !t.special && !t.feature && !t.revealedCard)
    .sort((a, b) => a.id.localeCompare(b.id));
  const hidden = plain.filter((t) => t.nodes.every((n) => !n.revealed));
  const spots = hidden.length ? hidden : plain;
  const seed = isNumber(save.seed) ? Math.abs(Math.floor(save.seed)) : 0;
  const tile = spots[seed % Math.max(1, spots.length)];
  const wonder = WONDERS[seed % WONDERS.length];
  if (!tile || !wonder) return save;
  tile.wonder = { id: wonder.id, decoys: Math.max(1, tile.nodes.length) };
  tile.nodes = [];
  return save;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(text: string | null | undefined): LoadResult {
  if (!text) return { ok: false, reason: 'empty' };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isRecord(data) || typeof data.saveVersion !== 'number')
    return { ok: false, reason: 'corrupt' };

  let save: SaveData = data;
  let version = data.saveVersion;
  if (version > SAVE_VERSION) return { ok: false, reason: 'tooNew' };
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return { ok: false, reason: 'unsupported' };
    try {
      save = migrate(save);
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    version += 1;
    save.saveVersion = version;
  }

  if (!looksLikeGameState(save)) return { ok: false, reason: 'corrupt' };
  return { ok: true, state: save };
}

function isRecord(v: unknown): v is SaveData {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string';

function looksLikeHiker(v: unknown): boolean {
  if (!isRecord(v) || !isString(v.id) || !isString(v.tileId) || !isString(v.status)) return false;
  const stats = v.stats;
  return (
    isRecord(stats) &&
    isNumber(stats.energy) &&
    isNumber(stats.appetite) &&
    isNumber(stats.morale) &&
    isNumber(v.injuries) &&
    Array.isArray(v.slots) &&
    isRecord(v.abilityUses)
  );
}

/** A light shape check: enough to refuse a broken save instead of crashing later. */
function looksLikeGameState(v: SaveData): v is SaveData & GameState {
  const section = v.section;
  return (
    isNumber(v.seed) &&
    Array.isArray(v.rng) &&
    v.rng.length === 4 &&
    v.rng.every(isNumber) &&
    isNumber(v.day) &&
    PHASES.includes(v.phase as GameState['phase']) &&
    isRecord(section) &&
    isRecord(section.tiles) &&
    Array.isArray(section.lines) &&
    isString(section.trailheadId) &&
    Array.isArray(v.hikers) &&
    v.hikers.every(looksLikeHiker) &&
    isNumber(v.caps) &&
    isRecord(v.abundance) &&
    NODE_TYPES.every((n) => isNumber((v.abundance as SaveData)[n])) &&
    Array.isArray(v.scavengedToday) &&
    Array.isArray(v.usedCards) &&
    isRecord(v.counters) &&
    isRecord(v.weather) &&
    isString(v.weather.today) &&
    Array.isArray(v.weather.ahead) &&
    (v.scavenge === undefined || isRecord(v.scavenge)) &&
    isNumber(v.nextEventId) &&
    Array.isArray(v.log)
  );
}
