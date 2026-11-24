/**
 * The selection screen's list (Phase 10b, mockups/HikerSort.png and
 * SortRibbons.png): the filter chips and the SORT control. Filters and sorts
 * combine.
 *
 * - **DEFAULT:** the 10 starters in roster order, then everyone else by
 *   name. One group, no ribbon.
 * - **FAMILY, CLASS, TRAITS, DIFFICULTY:** groups, each under a ribbon with
 *   its name, color and how many hikers it holds. Empty groups are left out.
 *
 * The sort is remembered on this device; the filter isn't.
 *
 * Phase 10.7: locked hikers go to the end of each group. BY STARTING TRAIT
 * shows each designed hiker 3 times, once per tree (its one class), so
 * picking a card picks that hiker with that start; locked hikers aren't in it.
 */
import { CLASS_COLORS, CLASS_NAMES } from '../../content/classes';
import { HOUSEHOLDS, type RosterHiker } from '../../content/roster';
import { TREES_BY_HIKER } from '../../content/trails/trees';
import { CLASS_IDS } from '../../engine/types';
import { deviceSetting } from '../app/deviceSetting';

export const FILTERS = [
  ['all', 'ALL'],
  ['human', 'HUMANS'],
  ['dog', 'DOGS'],
  ['cat', 'CATS'],
  ['plush', 'PLUSH'],
  ['variant', 'VARIANTS'],
  ['start', 'BY STARTING TRAIT'],
] as const;
export type FilterId = (typeof FILTERS)[number][0];

export const SORTS = [
  ['default', 'DEFAULT'],
  ['family', 'FAMILY'],
  ['class', 'CLASS'],
  ['traits', 'TRAITS'],
  ['difficulty', 'DIFFICULTY'],
] as const;
export type SortId = (typeof SORTS)[number][0];

/** The SORT control's choice, remembered on this device. */
export const HIKER_SORT = deviceSetting<SortId>(
  'hike-in-the-woods/hiker-sort',
  SORTS.map(([id]) => id),
  'default',
);

/** Traits sort ribbons (SortRibbons.png): 3 and 4 traits, and any other count. */
export const TRAIT_COUNT_COLORS: Readonly<Record<number, string>> = {
  3: '#5C7FA3',
  4: '#3F5C82',
};
export const OTHER_TRAIT_COUNT_COLOR = '#2E4766';

/** Difficulty sort ribbons, by the hidden 1–10 rating (each band up to `max`). */
export const DIFFICULTY_BANDS: readonly { label: string; color: string; max: number }[] = [
  { label: 'EASY', color: '#4E9A5F', max: 3 },
  { label: 'MEDIUM', color: '#C9A227', max: 5 },
  { label: 'HARD', color: '#D9642E', max: 7 },
  { label: 'EXPERT', color: '#B23A48', max: 10 },
];

export interface Ribbon {
  label: string;
  color: string;
  /** "13 HIKERS". */
  count: string;
}

export interface HikerGroup {
  key: string;
  /** None for DEFAULT. */
  ribbon?: Ribbon;
  hikers: RosterHiker[];
}

/** Whether a filter chip lets this hiker through. */
export function passes(h: RosterHiker, filter: FilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'start') return !h.locked && TREES_BY_HIKER.has(h.id);
  return filter === 'variant' ? !!h.variantOf : h.family === filter;
}

/** Traits a hiker starts with; open slots don't count. */
export const traitCount = (h: RosterHiker): number => h.slots.filter((s) => !!s.traitId).length;

/**
 * BY STARTING TRAIT: a designed hiker once per tree, each copy with that
 * tree's class alone and `start` set to it (the card shows that one start).
 */
export function startCards(h: RosterHiker): RosterHiker[] {
  const trees = TREES_BY_HIKER.get(h.id);
  return trees ? trees.trees.map((t) => ({ ...h, classes: [t.cls], start: t.id })) : [h];
}

/** A list card's key: the hiker, and its start in BY STARTING TRAIT. */
export const cardKey = (h: RosterHiker): string => (h.start ? `${h.id}:${h.start}` : h.id);

const byName = (a: RosterHiker, b: RosterHiker) => a.name.localeCompare(b.name, 'en');

const hikerWords = (n: number) => `${n} HIKER${n === 1 ? '' : 'S'}`;

interface Draft {
  key: string;
  label?: string;
  color?: string;
  hikers: RosterHiker[];
}

/** DEFAULT: the starters in roster order, then everyone else by name. */
function starterFirst(list: RosterHiker[]): Draft[] {
  const starters = list.filter((h) => h.starter);
  const rest = list.filter((h) => !h.starter).sort(byName);
  return [{ key: 'all', hikers: [...starters, ...rest] }];
}

/**
 * FAMILY (holiday-hikers-2): ELMERS, BROOKS, SHERMAN, LEICHTY, HOLIDAY and
 * OTHER, each household's hikers in the table's order. Variants are Other
 * unless they're given a household (the holiday hikers' Holiday), so the
 * family groups stay the real family. Other is by name. A hiker in two
 * households (Mom) shows in both.
 */
function byFamily(list: RosterHiker[]): Draft[] {
  return HOUSEHOLDS.map((house) => {
    const hikers =
      house.id === 'other'
        ? list.filter((h) => h.households.includes('other')).sort(byName)
        : house.members.flatMap((id) =>
            list.filter((h) => h.id === id && h.households.includes(house.id)),
          );
    return { key: house.id, label: house.name.toUpperCase(), color: house.color, hikers };
  });
}

/** CLASS: by main class, in class order (Movement, Resources, Utility), each in its color. */
function byClass(list: RosterHiker[]): Draft[] {
  return CLASS_IDS.map((c) => ({
    key: c,
    label: CLASS_NAMES[c].toUpperCase(),
    color: CLASS_COLORS[c],
    hikers: list.filter((h) => h.classes?.[0] === c).sort(byName),
  }));
}

/**
 * TRAITS: the hikers with Skill Trails first (Phase 10.7), then the rest by
 * how many traits they start with, fewest first.
 */
function byTraits(list: RosterHiker[]): Draft[] {
  const trails = list.filter((h) => TREES_BY_HIKER.has(h.id));
  const rest = list.filter((h) => !TREES_BY_HIKER.has(h.id));
  const counts = [...new Set(rest.map(traitCount))].sort((a, b) => a - b);
  return [
    {
      key: 'trails',
      label: 'SKILL TRAILS',
      color: SKILL_TRAILS_COLOR,
      hikers: trails.sort(byName),
    },
    ...counts.map((n) => ({
      key: `traits-${n}`,
      label: `${n} TRAIT${n === 1 ? '' : 'S'}`,
      color: TRAIT_COUNT_COLORS[n] ?? OTHER_TRAIT_COUNT_COLOR,
      hikers: rest.filter((h) => traitCount(h) === n).sort(byName),
    })),
  ];
}

/** The TRAITS sort's ribbon for the hikers with Skill Trails. */
export const SKILL_TRAILS_COLOR = '#7A5C2E';

/** DIFFICULTY: by band, then by rating, then by name. */
function byDifficulty(list: RosterHiker[]): Draft[] {
  let min = 1;
  return DIFFICULTY_BANDS.map((band) => {
    const low = min;
    min = band.max + 1;
    return {
      key: band.label.toLowerCase(),
      label: band.label,
      color: band.color,
      hikers: list
        .filter((h) => h.difficulty >= low && h.difficulty <= band.max)
        .sort((a, b) => a.difficulty - b.difficulty || byName(a, b)),
    };
  });
}

const SORTERS: Record<SortId, (list: RosterHiker[]) => Draft[]> = {
  default: starterFirst,
  family: byFamily,
  class: byClass,
  traits: byTraits,
  difficulty: byDifficulty,
};

/** The list's groups for a sort and a filter, in order, without empty ones. */
export function sortHikers(
  list: readonly RosterHiker[],
  sort: SortId,
  filter: FilterId = 'all',
): HikerGroup[] {
  const passed = list.filter((h) => passes(h, filter));
  const shown = filter === 'start' ? passed.flatMap(startCards) : passed;
  return SORTERS[sort](shown)
    .filter((g) => g.hikers.length > 0)
    .map(({ key, label, color, hikers }) => ({
      key,
      // Locked hikers go to the end of each group, in their sorted order (Phase 10.7).
      hikers: [...hikers.filter((h) => !h.locked), ...hikers.filter((h) => h.locked)],
      ...(label && color ? { ribbon: { label, color, count: hikerWords(hikers.length) } } : {}),
    }));
}
