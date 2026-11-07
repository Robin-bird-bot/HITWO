import { freshCounters } from './counters';
import { BALANCE } from '../config/balance';
import { freshAbundance } from './abundance';
import { seedRng } from './rng';
import { SAVE_VERSION } from './save';
import { generateSection } from './trail/generate';
import { freshWeather } from './weather';
import type {
  BiomeId,
  Family,
  GameState,
  Hiker,
  HikerId,
  Inventory,
  Section,
  Stats,
  TraitSlot,
} from './types';

export interface HikerSetup {
  id: HikerId;
  name: string;
  family: Family;
  slots: TraitSlot[];
  placeholder?: boolean;
  /** Starting stats when a character doesn't start full. */
  stats?: Partial<Stats>;
  /** Items and resources the character starts with. */
  inventory?: Partial<Inventory>;
}

export interface NewGameOptions {
  seed: number;
  hikers: readonly HikerSetup[];
  /** A ready-made section (tests). Without one, the seed generates the trail. */
  section?: Section;
  biome?: BiomeId;
  tier?: number;
}

/** A new hike: Day 1 Morning, every hiker on the trailhead. The seed decides the trail. */
export function createGame({
  seed,
  hikers,
  section: given,
  biome = 'meadow',
  tier = 1,
}: NewGameOptions): GameState {
  const rng = seedRng(seed);
  const section = structuredClone(given ?? generateSection(rng, { biome, tier }));
  const trailhead = section.tiles[section.trailheadId];
  if (trailhead) trailhead.visited = true;
  return {
    saveVersion: SAVE_VERSION,
    seed,
    rng,
    day: 1,
    phase: 'morning',
    sectionIndex: 0,
    section,
    weather: freshWeather(seed),
    hikers: hikers.map((setup): Hiker => ({
      id: setup.id,
      name: setup.name,
      family: setup.family,
      ...(setup.placeholder ? { placeholder: true } : {}),
      status: 'active',
      tileId: section.trailheadId,
      stats: { ...BALANCE.stats.start, ...setup.stats },
      injuries: 0,
      slots: setup.slots.map((s) => ({ ...s })),
      conditions: [],
      inventory: {
        bag: structuredClone(setup.inventory?.bag ?? []),
        equipped: structuredClone(setup.inventory?.equipped ?? {}),
        resources: structuredClone(setup.inventory?.resources ?? {}),
      },
      acted: false,
      slept: false,
      abilityUses: {},
      xp: 0,
      level: 1,
    })),
    caps: 0,
    abundance: freshAbundance(),
    scavengedToday: [],
    usedCards: [],
    counters: freshCounters(),
    nextEventId: 1,
    log: [],
  };
}
