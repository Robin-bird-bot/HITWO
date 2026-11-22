import { makeItem, withDefaults } from './items/make';
import { ITEMS, isOffered } from '../content/items';
import { PARTY_COLORS } from '../content/partyColors';
import { fireBiomeStart, fireRunStart, wrapsPresents } from './effects';
import { makePresent } from './items/presents';
import { scoutAround } from './traits/reveal';
import { rollDailyTraits } from './traits/daily';
import { noteXpRows } from './xp';
import { freshCounters } from './counters';
import { BALANCE } from '../config/balance';
import { freshAbundance } from './abundance';
import { RESOURCES } from '../content/resources';
import { resourceCount, resourceLimit } from './inventory';
import { pick, seedRng, shuffle } from './rng';
import { SAVE_VERSION } from './save';
import { generateSection } from './trail/generate';
import { freshWeather } from './weather';
import type {
  BiomeId,
  ClassId,
  Family,
  GameState,
  Hiker,
  HikerId,
  Inventory,
  ItemId,
  ItemTypeName,
  Section,
  Stats,
  TraitSlot,
} from './types';

/**
 * What a character brings (07-characters.md, "Starting bags"): items, which
 * roll Quality like any other, and random blueprints they already know (no
 * item slot), Tier 1 and maybe of one type.
 */
export interface StartingBag {
  items?: readonly ItemId[];
  blueprints?: { count: number; tier: 1; type?: ItemTypeName };
  /** Plain Presents (Grammy Clause, the Grinch), each with a random wrapping. */
  presents?: number;
}

export interface HikerSetup {
  id: HikerId;
  name: string;
  family: Family;
  slots: TraitSlot[];
  placeholder?: boolean;
  /** Their 1 or 2 classes (07-characters.md). */
  classes?: readonly ClassId[];
  /** Who they are, for traits that belong to certain characters. */
  characterId?: string;
  /** A dev-only test hiker. */
  test?: true;
  /** A Duo: the two characters sharing the card. */
  duo?: readonly [string, string];
  /** Starting stats when a character doesn't start full. */
  stats?: Partial<Stats>;
  /** Items and resources the character starts with. */
  inventory?: Partial<Inventory>;
  /** Handed out when the run starts (the real roster, Phase 10b). */
  startingBag?: StartingBag;
  /** Their party color. Without one, their spot's: 1 orange, 2 blue, 3 yellow, 4 purple. */
  color?: string;
}

export interface NewGameOptions {
  seed: number;
  hikers: readonly HikerSetup[];
  /** A ready-made section (tests). Without one, the seed generates the trail. */
  section?: Section;
  biome?: BiomeId;
  tier?: number;
  /** Each hiker starts with a few random resources (on unless a test turns it off). */
  startingResources?: boolean;
}

/** A new hike: Day 1 Morning, every hiker on the trailhead. The seed decides the trail. */
export function createGame({
  seed,
  hikers,
  section: given,
  biome = 'meadow',
  tier = 1,
  startingResources = true,
}: NewGameOptions): GameState {
  const rng = seedRng(seed);
  const section = structuredClone(given ?? generateSection(rng, { biome, tier }));
  const trailhead = section.tiles[section.trailheadId];
  if (trailhead) trailhead.visited = true;
  const state: GameState = {
    saveVersion: SAVE_VERSION,
    seed,
    rng,
    day: 1,
    phase: 'morning',
    sectionIndex: 0,
    section,
    weather: freshWeather(seed),
    hikers: hikers.map((setup, i): Hiker => ({
      id: setup.id,
      name: setup.name,
      family: setup.family,
      color: setup.color ?? PARTY_COLORS[i % PARTY_COLORS.length] ?? '#C9C2B2',
      ...(setup.placeholder ? { placeholder: true } : {}),
      classes: [...(setup.classes ?? [])],
      ...(setup.characterId ? { characterId: setup.characterId } : {}),
      ...(setup.test ? { test: true } : {}),
      ...(setup.duo ? { duo: setup.duo } : {}),
      status: 'active',
      tileId: section.trailheadId,
      stats: {
        ...BALANCE.stats.start,
        // A Plush hiker starts with full Stuffing (kept in both Energy and Appetite).
        ...(setup.family === 'plush'
          ? { energy: BALANCE.plush.stuffingMax, appetite: BALANCE.plush.stuffingMax }
          : {}),
        ...setup.stats,
      },
      injuries: 0,
      slots: setup.slots.map((s) => ({
        ...s,
        ...(s.setting ? { setting: { ...s.setting } } : {}),
      })),
      conditions: [],
      inventory: {
        bag: (setup.inventory?.bag ?? []).map(withDefaults),
        equipped: Object.fromEntries(
          Object.entries(setup.inventory?.equipped ?? {}).map(([slot, item]) => [
            slot,
            item && withDefaults(item),
          ]),
        ),
        resources: structuredClone(setup.inventory?.resources ?? {}),
      },
      acted: false,
      slept: false,
      abilityUses: {},
      xp: 0,
      // Hikers start at level 0 (Wyatt, Nov 20).
      level: 0,
    })),
    caps: 0,
    abundance: freshAbundance(),
    scavengedToday: [],
    usedCards: [],
    counters: freshCounters(),
    nextEventId: 1,
    log: [],
  };
  hikers.forEach((setup, i) => {
    const h = state.hikers[i];
    if (h && setup.startingBag) giveStartingBag(state, h, setup.startingBag);
  });
  if (startingResources) giveStartingResources(state);
  // The run begins (Gift Wrapper rolls the wish lists), then the first day's daily
  // traits, then the first biome begins (Prepared, Tactical), and Scouts see around the trailhead.
  fireRunStart(state);
  rollDailyTraits(state);
  fireBiomeStart(state);
  scoutAround(state);
  // Day 1 on the trailhead's row is their first: action XP counts there today.
  noteXpRows(state);
  return state;
}

/**
 * A character's starting bag: its items in the bag (rolling Quality), and its
 * random Tier 1 blueprints learned, each one they don't know yet.
 */
function giveStartingBag(state: GameState, h: Hiker, bag: StartingBag): void {
  for (const itemId of bag.items ?? []) {
    if (ITEMS[itemId]) h.inventory.bag.push(makeItem(state, itemId, { prefix: 'start' }));
  }
  // Starting Presents: a wrapper's own count as hers (Season of Giving); anyone else's
  // were wrapped by nobody in the party. TODO(wyatt): first guess.
  const own = wrapsPresents(state, h);
  for (let i = 0; i < (bag.presents ?? 0); i++) {
    h.inventory.bag.push(
      makePresent(state, 'plain', { prefix: 'start', ...(own ? { wrappedBy: h.id } : {}) }),
    );
  }
  const want = bag.blueprints;
  if (!want) return;
  const known = new Set(h.blueprints ?? []);
  const pool = Object.values(ITEMS)
    .filter(
      (d) =>
        d.tier === want.tier &&
        !!d.recipe &&
        isOffered(d) &&
        (!want.type || d.type === want.type) &&
        !known.has(d.id),
    )
    .map((d) => d.id);
  const picked = shuffle(state.rng, pool).slice(0, want.count);
  if (picked.length) h.blueprints = [...known, ...picked];
}

/**
 * Each hiker gets `BALANCE.inventory.startingResources` random resources, each
 * picked evenly from every type (duplicates are fine), up to their limit.
 */
function giveStartingResources(state: GameState): void {
  for (const h of state.hikers) {
    const room = Math.max(0, resourceLimit(state, h) - resourceCount(h));
    const n = Math.min(BALANCE.inventory.startingResources, room);
    for (let i = 0; i < n; i++) {
      const id = pick(state.rng, RESOURCES).id;
      h.inventory.resources[id] = (h.inventory.resources[id] ?? 0) + 1;
    }
  }
}
