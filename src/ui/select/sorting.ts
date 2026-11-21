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
 */
import { CLASS_COLORS, CLASS_NAMES } from '../../content/classes';
import { HOUSEHOLDS, ROSTER, type RosterHiker } from '../../content/roster';
import { CLASS_IDS } from '../../engine/types';
import { deviceSetting } from '../app/deviceSetting';

export const FILTERS = [
  ['all', 'ALL'],
  ['human', 'HUMANS'],
  ['dog', 'DOGS'],
  ['cat', 'CATS'],
  ['plush', 'PLUSH'],
  ['variant', 'VARIANTS'],
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
  return filter === 'variant' ? !!h.variantOf : h.family === filter;
}

/** Traits a hiker starts with; open slots don't count. */
export const traitCount = (h: RosterHiker): number => h.slots.filter((s) => !!s.traitId).length;

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
 * FAMILY: each household's hikers in the table's order, each followed by
 * their variants (in roster order). Other is everyone else, by name. A hiker
 * in two households (Mom) shows in both.
 */
function byFamily(list: RosterHiker[]): Draft[] {
  const otherBases = ROSTER.filter((h) => !h.variantOf && h.households.includes('other'))
    .sort(byName)
    .map((h) => h.id);
  return HOUSEHOLDS.map((house) => {
    const bases = house.id === 'other' ? otherBases : house.members;
    // Base first, then its variants in the list's (roster) order.
    const hikers = bases.flatMap((base) => [
      ...list.filter((h) => h.id === base),
      ...list.filter((h) => h.variantOf === base),
    ]);
    return { key: house.id, label: house.name.toUpperCase(), color: house.color, hikers };
  });
}

/** CLASS: by main role, in role order, each in the role's color. */
function byClass(list: RosterHiker[]): Draft[] {
  return CLASS_IDS.map((c) => ({
    key: c,
    label: CLASS_NAMES[c].toUpperCase(),
    color: CLASS_COLORS[c],
    hikers: list.filter((h) => h.classes?.[0] === c).sort(byName),
  }));
}

/** TRAITS: by how many traits they start with, fewest first. */
function byTraits(list: RosterHiker[]): Draft[] {
  const counts = [...new Set(list.map(traitCount))].sort((a, b) => a - b);
  return counts.map((n) => ({
    key: `traits-${n}`,
    label: `${n} TRAIT${n === 1 ? '' : 'S'}`,
    color: TRAIT_COUNT_COLORS[n] ?? OTHER_TRAIT_COUNT_COLOR,
    hikers: list.filter((h) => traitCount(h) === n).sort(byName),
  }));
}

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
  const shown = list.filter((h) => passes(h, filter));
  return SORTERS[sort](shown)
    .filter((g) => g.hikers.length > 0)
    .map(({ key, label, color, hikers }) => ({
      key,
      hikers,
      ...(label && color ? { ribbon: { label, color, count: hikerWords(hikers.length) } } : {}),
    }));
}
