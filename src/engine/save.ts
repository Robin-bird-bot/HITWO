/**
 * Saves are versioned (CLAUDE.md rule 7). Bump SAVE_VERSION whenever the shape
 * of GameState changes, and add a migration from the old version. Loading
 * never throws: a save that can't be read comes back as { ok: false }.
 */
import { rollTrailShop } from './station/trail';
import { openStation } from './station/stock';
import { BALANCE } from '../config/balance';
import { clampAbundance, freshAbundance } from './abundance';
import { freshCounters } from './counters';
import { WONDERS } from '../content/wonders';
import { STARTING_PARTY } from '../content/characters';
import { PARTY_COLORS } from '../content/partyColors';
import { TEST_HIKERS } from '../content/testHikers';
import { TREES_BY_HIKER } from '../content/trails/trees';
import { RENAMED_ITEMS } from '../content/items';
import { withDefaults } from './items/make';
import { shelterDeployments } from './items/shelters';
import {
  NODE_TYPES,
  PHASES,
  type ActiveTrial,
  type GameState,
  type ItemInstance,
  type Tile,
  type WeatherState,
} from './types';
import { freshWeather } from './weather';
import { levelForXp } from './xp';

export const SAVE_VERSION = 22;

export type LoadFailure = 'empty' | 'corrupt' | 'tooNew' | 'unsupported';
export type LoadResult = { ok: true; state: GameState } | { ok: false; reason: LoadFailure };

type SaveData = Record<string, unknown>;

/** Upgrades a save from version N (the key) to N + 1. */
const MIGRATIONS: Record<number, (save: SaveData) => SaveData> = {
  // Phase 4: Abundance meters (a meter per node then, at its start value) and today's scavenges.
  1: (save) => ({ ...save, abundance: oldMeters(), scavengedToday: [] }),
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
  // Phase 9.5 (Nov 14 update): one Abundance bar, the average of the four meters.
  13: (save) => upgradeAbundance(save),
  // Phase 10a: hikers have classes, and the four Finders and Hounds are one trait each with a node.
  14: (save) => upgradeTraits(save),
  // Phase 10a step 6: levels start at 0 with new XP lines. XP already earned is
  // kept, and the levels it reaches wait for the next camp step.
  15: (save) => upgradeLevels(save),
  // Phase 10b: each hiker keeps a party color. Older hikers get the color they had.
  16: (save) => addPartyColors(save),
  // Holiday hikers (Nov 20): Planner Wink is Prepared Wink and Showgirl Gdog is Showqueen
  // Gdog, ids and names. Presents, wish lists and the rest are new and optional.
  17: (save) => upgradePresents(renameHikers(save)),
  // Phase 10.5: who walked each line, and the places found on the illustrated map. Both
  // optional, so an older save starts with nothing walked and nothing found.
  18: (save) => save,
  // Phase 10.6 (Simplify): Storm is gone, weather no longer changes nodes,
  // Wonders are off, and shelters are carried and set up.
  19: (save) => simplify(save),
  // Phase 10.7 (Skill Trails): party XP, trees and morale types for the 6 designed
  // hikers. Anyone else in a run keeps their old traits (they no longer level up).
  20: (save) => skillTrails(save),
  // Phase 10.8 step 7: challenges can show Tiers IV and V (`shownTier` on open and revealed
  // cards). The field is optional and old cards read as their own tier, so nothing changes.
  21: (save) => save,
};

function skillTrails(save: SaveData): SaveData {
  const hikers = Array.isArray(save.hikers) ? (save.hikers as SaveData[]) : [];
  let xp = 0;
  const upgraded = hikers.map((h) => {
    const trees = typeof h.characterId === 'string' ? TREES_BY_HIKER.get(h.characterId) : undefined;
    xp += typeof h.xp === 'number' ? h.xp : 0;
    const rest = { ...h };
    delete rest.pendingLevels;
    if (!trees) return rest;
    const first = trees.trees[0].steps[0].id;
    return {
      ...rest,
      classes: trees.trees.map((t) => t.cls),
      trails: { learned: [first] },
      slots: [{ type: 'trail', traitId: first }],
      moraleType: trees.moraleType,
    };
  });
  const level = levelForXp(xp);
  const next: SaveData = {
    ...save,
    hikers: upgraded,
    party: { xp, level, points: level * BALANCE.trails.pointsPerLevel },
  };
  delete next.traitPick;
  return next;
}

/** Storm days become Rain (Phase 10.6). */
const noStorm = (w: unknown): unknown => (w === 'storm' ? 'rain' : w);

/**
 * Phase 10.6 (Simplify), for a version 19 save:
 * - Storm becomes Rain, today and in the forecast;
 * - nodes the weather changed go back to what they were;
 * - a Wonder still on this section's tiles becomes a quiet tile;
 * - a placed shelter becomes a set-up one: its nights left become its
 *   deployments left, and its owner is whoever placed it, or else the first
 *   hiker on its tile. Only one stays up on a tile (the one with the most).
 *   Shelters in packs keep their full deployments (nothing to change).
 */
function simplify(save: SaveData): SaveData {
  const out = structuredClone(save);
  if (isRecord(out.weather)) {
    out.weather.today = noStorm(out.weather.today);
    if (Array.isArray(out.weather.ahead)) out.weather.ahead = out.weather.ahead.map(noStorm);
  }
  const tiles = isRecord(out.section) && isRecord(out.section.tiles) ? out.section.tiles : {};
  for (const tile of Object.values(tiles)) {
    if (!isRecord(tile)) continue;
    for (const node of Array.isArray(tile.nodes) ? tile.nodes : []) {
      if (!isRecord(node) || !isRecord(node.weather)) continue;
      if (isString(node.weather.was)) node.type = node.weather.was;
      delete node.weather;
    }
    if (tile.wonder) {
      delete tile.wonder;
      tile.quiet = true;
    }
    if (Array.isArray(tile.shelters) && tile.shelters.length) {
      const firstHere = (Array.isArray(out.hikers) ? out.hikers : []).find(
        (h) => isRecord(h) && h.tileId === tile.id && h.status !== 'abandoned',
      );
      const converted = tile.shelters.filter(isRecord).map((s) => {
        const { nightsLeft, ...rest } = s;
        const by = isString(s.by) ? s.by : isRecord(firstHere) ? firstHere.id : undefined;
        return {
          ...rest,
          deploymentsLeft: isNumber(nightsLeft) ? Math.max(0, nightsLeft) : 0,
          ...(isString(by) ? { by } : {}),
        };
      });
      converted.sort((a, b) => b.deploymentsLeft - a.deploymentsLeft);
      tile.shelters = converted.slice(0, 1);
    }
  }
  return out;
}

/** Renamed roster ids (holiday-hikers-2), and the names that went with them. */
const RENAMED_HIKERS: Readonly<Record<string, { id: string; name: string; was: string }>> = {
  plannerWink: { id: 'preparedWink', name: 'Prepared Wink', was: 'Planner Wink' },
  showgirlGdog: { id: 'showqueenGdog', name: 'Showqueen Gdog', was: 'Showgirl Gdog' },
};

/**
 * A renamed hiker keeps everything: their id is swapped wherever it appears
 * whole (as a value or a key: the log, counters, trials…), and their name too.
 */
function renameHikers(save: SaveData): SaveData {
  const swap = (v: unknown): unknown => {
    if (isString(v)) return RENAMED_HIKERS[v]?.id ?? v;
    if (Array.isArray(v)) return v.map(swap);
    if (!isRecord(v)) return v;
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [RENAMED_HIKERS[k]?.id ?? k, swap(x)]),
    );
  };
  const out = swap(save) as SaveData;
  if (!Array.isArray(out.hikers)) return out;
  const names = new Map(Object.values(RENAMED_HIKERS).map((r) => [r.was, r.name]));
  out.hikers = out.hikers.map((raw: unknown) =>
    isRecord(raw) && isString(raw.name) && names.has(raw.name)
      ? { ...raw, name: names.get(raw.name) }
      : raw,
  );
  return out;
}

/**
 * The first holiday zip's Presents had a `stuffed` flag: stuffed ones are
 * Tier 2+, the rest plain (holiday-hikers-2, "Changes"). Only a save made with
 * that build has any.
 */
function upgradePresents(save: SaveData): SaveData {
  const fix = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(fix);
    if (!isRecord(v)) return v;
    if (v.itemId === 'present' && v.grade === undefined) {
      const { stuffed, ...rest } = v;
      return { ...rest, grade: stuffed ? 'tier2plus' : 'plain' };
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)]));
  };
  return fix(save) as SaveData;
}

/** The color each older hiker already showed: their character's, else their spot's. */
function addPartyColors(save: SaveData): SaveData {
  if (!Array.isArray(save.hikers)) return save;
  const hikers = save.hikers.map((raw: unknown, i: number) => {
    if (!isRecord(raw) || isString(raw.color)) return raw;
    const id = isString(raw.id) ? raw.id : '';
    const known = [...STARTING_PARTY, ...TEST_HIKERS].find((c) => c.id === id)?.color;
    return { ...raw, color: known ?? PARTY_COLORS[i % PARTY_COLORS.length] };
  });
  return { ...save, hikers };
}

/** Levels start over at 0; XP reaching a level makes a level-up wait for camp. */
function upgradeLevels(save: SaveData): SaveData {
  if (!Array.isArray(save.hikers)) return save;
  const hikers = save.hikers.map((raw: unknown) => {
    if (!isRecord(raw)) return raw;
    const xp = isNumber(raw.xp) ? Math.max(0, raw.xp) : 0;
    const pending = levelForXp(xp);
    return { ...raw, xp, level: 0, ...(pending ? { pendingLevels: pending } : {}) };
  });
  return { ...save, hikers };
}

/** The Phase 4 node traits, now one trait each with the node as its setting. */
const NODE_TRAITS: Readonly<Record<string, { traitId: string; node: string }>> = {
  forestFinder: { traitId: 'finder', node: 'forest' },
  riverFinder: { traitId: 'finder', node: 'river' },
  creatureFinder: { traitId: 'finder', node: 'wildlife' },
  rockFinder: { traitId: 'finder', node: 'mountain' },
  forestHound: { traitId: 'hound', node: 'forest' },
  riverHound: { traitId: 'hound', node: 'river' },
  creatureHound: { traitId: 'hound', node: 'wildlife' },
  rockHound: { traitId: 'hound', node: 'mountain' },
};

/**
 * Phase 10a: each hiker gets their character's classes (none for anyone
 * unknown), and the old node traits keep working as Finder or Hound set to
 * their node.
 */
function upgradeTraits(save: SaveData): SaveData {
  if (!Array.isArray(save.hikers)) return save;
  const hikers = save.hikers.map((raw: unknown) => {
    if (!isRecord(raw)) return raw;
    const id = isString(raw.id) ? raw.id : '';
    const slots = Array.isArray(raw.slots)
      ? raw.slots.map((slot: unknown) => {
          if (!isRecord(slot) || !isString(slot.traitId)) return slot;
          const node = NODE_TRAITS[slot.traitId];
          return node ? { ...slot, traitId: node.traitId, setting: { x: node.node } } : slot;
        })
      : [];
    const classes = STARTING_PARTY.find((c) => c.id === id)?.classes ?? [];
    return { ...raw, slots, classes: Array.isArray(raw.classes) ? raw.classes : [...classes] };
  });
  return { ...save, hikers };
}

/** Phase 4's meters: one per node, each 0–10, starting at 8. */
const OLD_METER = { max: 10, start: 8 };
function oldMeters(): Record<string, number> {
  return Object.fromEntries(NODE_TYPES.map((n) => [n, OLD_METER.start]));
}

/**
 * The four node meters (0–10) become one bar: their average, scaled to the
 * bar's range. An Overfished Trial already running starts counting from here.
 */
function upgradeAbundance(save: SaveData): SaveData {
  const old = save.abundance;
  let level = freshAbundance();
  if (typeof old === 'number') level = old;
  else if (isRecord(old)) {
    const values = NODE_TYPES.map((n) => old[n]).filter(isNumber);
    if (values.length) {
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      level = clampAbundance(Math.round((average / OLD_METER.max) * BALANCE.abundance.max));
    }
  }
  const trials = Array.isArray(save.trials)
    ? (save.trials as ActiveTrial[]).map((t) => {
        if (t.cardId !== 'overfished' || t.startAbundance !== undefined) return t;
        const x = { ...t.rolls.x, gain: t.rolls.x.gain ?? 3 };
        return { ...t, rolls: { ...t.rolls, x }, startAbundance: level };
      })
    : save.trials;
  return { ...save, abundance: level, ...(trials ? { trials } : {}) };
}

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

/** The nights a shelter lasted before Phase 10.6 (its deployments − 1), for old saves. */
const shelterNights = (itemId: string) => Math.max(1, shelterDeployments(itemId) - 1);

/** Shelters stored as item ids become placed shelters with their full nights. */
function upgradeShelters(save: SaveData): SaveData {
  const section = save.section;
  if (!isRecord(section) || !isRecord(section.tiles)) return save;
  for (const [id, tile] of Object.entries(section.tiles)) {
    if (!isRecord(tile) || !Array.isArray(tile.shelters)) continue;
    tile.shelters = tile.shelters.map(
      (s, i) =>
        isString(s)
          ? { uid: `shelter-${id}-${i}-${s}`, itemId: s, nightsLeft: shelterNights(s) }
          : s,
      // (Version 19 turns nights left into deployments: see simplify().)
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
  // Storm is gone (Phase 10.6): a stormy day is rain now.
  w.today = old === 'stormy' ? 'rain' : old === 'sunny' ? 'heatwave' : 'clear';
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
    isNumber(v.abundance) &&
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
