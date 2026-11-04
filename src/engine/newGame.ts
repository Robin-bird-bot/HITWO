import { BALANCE } from '../config/balance';
import { seedRng } from './rng';
import { SAVE_VERSION } from './save';
import type { Family, GameState, Hiker, HikerId, Section, Stats, TraitSlot } from './types';

export interface HikerSetup {
  id: HikerId;
  name: string;
  family: Family;
  slots: TraitSlot[];
  placeholder?: boolean;
  /** Starting stats when a character doesn't start full. */
  stats?: Partial<Stats>;
}

export interface NewGameOptions {
  seed: number;
  section: Section;
  hikers: readonly HikerSetup[];
}

/** A new hike: Day 1 Morning, every hiker on the trailhead. */
export function createGame({ seed, section, hikers }: NewGameOptions): GameState {
  return {
    saveVersion: SAVE_VERSION,
    seed,
    rng: seedRng(seed),
    day: 1,
    phase: 'morning',
    sectionIndex: 0,
    section,
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
      inventory: { bag: [], equipped: {}, resources: {} },
      acted: false,
      slept: false,
      abilityUses: {},
      xp: 0,
      level: 1,
    })),
    caps: 0,
    nextEventId: 1,
    log: [],
  };
}
