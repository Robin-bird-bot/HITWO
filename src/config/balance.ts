/**
 * Every tunable number in the game lives here (CLAUDE.md, architecture rule 3):
 * costs, thresholds, odds, rarity weights, XP, tree size and so on. The design
 * doc calls these "adjustable settings from day one".
 *
 * Engine code reads numbers from BALANCE and never hard-codes them. A guess
 * made while the docs are silent gets a `// TODO(wyatt):` comment.
 */
import type { LineKind, StatName } from '../engine/types';

type PartialStats = Partial<Record<StatName, number>>;

/** What crossing each kind of line costs on top of its base Appetite. */
const LINE_EXTRA: Record<LineKind, PartialStats> = {
  normal: {},
  paved: {},
  steep: { energy: 1 },
  muddy: { appetite: 1 },
  rough: { morale: 1 },
};

export const BALANCE = {
  party: {
    size: 4,
  },

  stats: {
    min: 0,
    max: 10,
    /** Stats start full and drop. */
    start: { energy: 10, appetite: 10, morale: 10 },
  },

  /** Threshold states apply at or below these values. */
  thresholds: {
    hungry: 5, // Appetite
    famished: 2, // Appetite
    fatigued: 6, // Energy
    exhausted: 3, // Energy
  },

  injuries: {
    passOutAt: 3,
    /** Gaining an injury raises each stat below this back up to it. */
    raiseStatsBelowTo: 5,
  },

  lines: {
    /** Appetite to cross each kind of line (a normal line is the 1-Appetite move). */
    baseAppetite: { normal: 1, paved: 0, steep: 1, muddy: 1, rough: 1 } as Record<LineKind, number>,
    /**
     * Extra cost to cross. Every hiker who crosses pays their own extra, even
     * when brought along by Move All (Wyatt, Nov 3).
     */
    extra: LINE_EXTRA,
  },

  night: {
    /** Each hiker who moves at night pays this much extra Appetite. */
    moveExtraAppetite: 1,
    /** A night without sleep costs this much Energy. */
    noSleepEnergy: 2,
  },

  moveAll: {
    /**
     * The mover pays their own crossing (the line's base Appetite) plus this
     * much for each hiker brought along: bringing 3 on a normal line = 4.
     * TODO(wyatt): on a paved line the mover's own crossing is free, but the
     * per-hiker cost still applies. Is that right?
     */
    perHikerAppetite: 1,
  },

  scavenge: {
    appetite: 1,
  },

  endOfDay: {
    appetite: 1,
  },

  sleep: {
    energy: 2,
    shelteredEnergy: 3,
  },

  chance: {
    /** A "chance" with no number in the trait text. */
    default: 0.25,
  },

  /** Numbers used by specific traits (see src/content/traits.ts). */
  traits: {
    leader: { moveAllDiscount: 1 },
    stoic: { moraleCost: 2, gain: 1 },
    extrinsic: { together: 1, alone: -1 },
  },

  rules: {
    /** TODO(wyatt): at camp, the no-sleep Energy drain happens before the end-of-day Appetite drain. */
    noSleepDrainFirst: true,
    /** TODO(wyatt): passed-out hikers skip the camp-step drains until Phase 7 settles passing out. */
    passedOutHikersDrainAtCamp: false,
    /** TODO(wyatt): two percentage modifiers multiply in turn (−50% twice = 25%) rather than add. */
    percentModifiersMultiply: true,
    /**
     * TODO(wyatt): who can be brought along by Move All. Being brought uses the
     * hiker's action, so an Exhausted hiker can't be brought in the day and a
     * Fatigued one can't be brought at night. Hungry and Famished hikers can.
     */
    exhaustedOrFatiguedCanBeBrought: false,
  },

  log: {
    maxEvents: 200,
  },
};
