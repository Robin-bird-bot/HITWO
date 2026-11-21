import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { CLASS_COLORS } from '../../content/classes';
import { ROSTER, type RosterHiker } from '../../content/roster';
import { CLASS_IDS } from '../../engine/types';
import type { StorageLike } from '../../store/autosave';
import { SHOW_DIFFICULTY } from '../debug/debugFlags';
import { HikerSelect } from './HikerSelect';
import { HIKER_SORT, sortHikers, traitCount, type HikerGroup } from './sorting';

const ids = (g: HikerGroup | undefined) => g?.hikers.map((h) => h.id) ?? [];
const ribbons = (groups: HikerGroup[]) =>
  groups.map((g) => [g.ribbon?.label, g.ribbon?.color, g.ribbon?.count]);

describe('DEFAULT', () => {
  const groups = sortHikers(ROSTER, 'default');

  it('one group with no ribbon', () => {
    expect(groups).toHaveLength(1);
    expect(groups[0]?.ribbon).toBeUndefined();
  });

  it('the 10 starters in roster order, then everyone else by name', () => {
    const list = ids(groups[0]);
    expect(list.slice(0, 10)).toEqual([
      'wyatt',
      'mom',
      'ellie',
      'finn',
      'gdog',
      'grandpaWink',
      'cody',
      'grandpaSherman',
      'pearl',
      'brutus',
    ]);
    const rest = groups[0]?.hikers.slice(10).map((h) => h.name) ?? [];
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, 'en')));
    expect(rest.slice(0, 3)).toEqual(['Agility Finn', 'Anni', 'Ben']);
    expect(list).toHaveLength(ROSTER.length);
  });
});

describe('FAMILY', () => {
  const groups = sortHikers(ROSTER, 'family');
  const group = (label: string) => groups.find((g) => g.ribbon?.label === label);

  it('five ribbons in order, in their colors', () => {
    expect(ribbons(groups)).toEqual([
      ['ELMERS', '#B5543A', '16 HIKERS'],
      ['BROOKS', '#3D7EA6', '10 HIKERS'],
      ['SHERMAN', '#D08A2E', '7 HIKERS'],
      ['LEICHTY', '#4E8F5A', '4 HIKERS'],
      ['OTHER', '#6B6F78', '5 HIKERS'],
    ]);
  });

  it('each family in the table’s order, with variants right after their base hiker', () => {
    expect(ids(group('ELMERS'))).toEqual([
      'wyatt',
      'wywee',
      'mom',
      'graduateMom',
      'ellie',
      'ellieDevourer',
      'noseworkEllie',
      'finn',
      'followerFinn',
      'agilityFinn',
      'cody',
      'duke',
      'scarlet',
      'hershal',
      'sinjon',
      'brutus',
    ]);
    expect(ids(group('BROOKS'))).toEqual([
      'mom',
      'graduateMom',
      'gdog',
      'showgirlGdog',
      'grandpaWink',
      'plannerWink',
      'pepper',
      'melissa',
      'muffin',
      'coco',
    ]);
    expect(ids(group('SHERMAN'))).toEqual([
      'grandpaSherman',
      'pearl',
      'kai',
      'catie',
      'mitchell',
      'nathan',
      'madeline',
    ]);
    expect(ids(group('LEICHTY'))).toEqual(['erin', 'jackson', 'anni', 'bossGracie']);
  });

  it('Other is everyone else, by name', () => {
    expect(ids(group('OTHER'))).toEqual(['ben', 'goldie', 'leah', 'loki', 'mindy']);
  });

  it('Mom (and Graduate Mom) show in both Elmers and Brooks; everyone else once', () => {
    const seen = new Map<string, number>();
    for (const g of groups) for (const h of g.hikers) seen.set(h.id, (seen.get(h.id) ?? 0) + 1);
    expect(seen.size).toBe(ROSTER.length);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual(['mom', 'graduateMom']);
  });

  it('a filter keeps variants with their family, even without the base hiker', () => {
    const variants = sortHikers(ROSTER, 'family', 'variant');
    expect(ids(variants.find((g) => g.ribbon?.label === 'ELMERS'))).toEqual([
      'wywee',
      'graduateMom',
      'ellieDevourer',
      'noseworkEllie',
      'followerFinn',
      'agilityFinn',
    ]);
    // Families with no variants are left out.
    expect(variants.map((g) => g.ribbon?.label)).toEqual(['ELMERS', 'BROOKS']);
  });
});

describe('CLASS', () => {
  const groups = sortHikers(ROSTER, 'class');

  it('by main role, in role order, in the role’s color, by name inside', () => {
    expect(groups.map((g) => g.key)).toEqual([...CLASS_IDS]);
    for (const g of groups) {
      expect(g.ribbon?.color).toBe(CLASS_COLORS[g.key as keyof typeof CLASS_COLORS]);
      expect(g.hikers.every((h) => h.classes?.[0] === g.key)).toBe(true);
      const names = g.hikers.map((h) => h.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    }
    expect(groups[0]?.ribbon?.label).toBe('TANK');
    // Ellie is Support and Entertainer: only her main role counts.
    expect(ids(groups.find((g) => g.key === 'support'))).toContain('ellie');
    expect(ids(groups.find((g) => g.key === 'entertainer'))).not.toContain('ellie');
  });
});

describe('TRAITS', () => {
  it('3 TRAITS and 4 TRAITS; open slots don’t count', () => {
    const groups = sortHikers(ROSTER, 'traits');
    expect(groups.map((g) => [g.ribbon?.label, g.ribbon?.color])).toEqual([
      ['3 TRAITS', '#5C7FA3'],
      ['4 TRAITS', '#3F5C82'],
    ]);
    // Brutus has 4 slots, one of them open.
    expect(ids(groups[0])).toContain('brutus');
    expect(traitCount(ROSTER.find((h) => h.id === 'brutus') as RosterHiker)).toBe(3);
  });

  it('any other count gets the dark ribbon', () => {
    const finn = ROSTER.find((h) => h.id === 'finn') as RosterHiker;
    const two: RosterHiker = { ...finn, id: 'two', slots: finn.slots.slice(0, 2) };
    const groups = sortHikers([finn, two], 'traits');
    expect(groups.map((g) => [g.ribbon?.label, g.ribbon?.color, g.ribbon?.count])).toEqual([
      ['2 TRAITS', '#2E4766', '1 HIKER'],
      ['3 TRAITS', '#5C7FA3', '1 HIKER'],
    ]);
  });
});

describe('DIFFICULTY', () => {
  const groups = sortHikers(ROSTER, 'difficulty');

  it('EASY 1–3, MEDIUM 4–5, HARD 6–7, EXPERT 8–10', () => {
    expect(groups.map((g) => [g.ribbon?.label, g.ribbon?.color])).toEqual([
      ['EASY', '#4E9A5F'],
      ['MEDIUM', '#C9A227'],
      ['HARD', '#D9642E'],
      ['EXPERT', '#B23A48'],
    ]);
    const bands: [number, number][] = [
      [1, 3],
      [4, 5],
      [6, 7],
      [8, 10],
    ];
    groups.forEach((g, i) => {
      const [lo, hi] = bands[i] ?? [0, 0];
      expect(g.hikers.every((h) => h.difficulty >= lo && h.difficulty <= hi)).toBe(true);
    });
    expect(groups.reduce((n, g) => n + g.hikers.length, 0)).toBe(ROSTER.length);
  });

  it('inside a band, by rating, then by name', () => {
    expect(ids(groups[0]).slice(0, 4)).toEqual(['anni', 'finn', 'sinjon', 'wywee']);
    expect(ids(groups[3])).toEqual(['bossGracie', 'pepper']);
  });
});

describe('filters and sorts combine', () => {
  it('DOGS sorted by class: only dogs, no empty groups', () => {
    const groups = sortHikers(ROSTER, 'class', 'dog');
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.hikers.length).toBeGreaterThan(0);
      expect(g.hikers.every((h) => h.family === 'dog')).toBe(true);
    }
  });
});

describe('the sort is remembered on this device', () => {
  const store = (value: string | null): StorageLike => ({
    getItem: () => value,
    setItem: () => {},
    removeItem: () => {},
  });

  it('reads a stored sort, and falls back to DEFAULT', () => {
    expect(HIKER_SORT.read(store('family'))).toBe('family');
    expect(HIKER_SORT.read(store('sideways'))).toBe('default');
    expect(HIKER_SORT.read(store(null))).toBe('default');
    expect(HIKER_SORT.read(undefined)).toBe('default');
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(HIKER_SORT.read(broken)).toBe('default');
    expect(() => HIKER_SORT.write(broken, 'class')).not.toThrow();
  });
});

describe('hidden difficulty', () => {
  const screen = () =>
    renderToStaticMarkup(createElement(HikerSelect, { onStart: () => {}, onBack: () => {} }));

  afterEach(() => {
    SHOW_DIFFICULTY.set('off');
    HIKER_SORT.set('default');
  });

  it('never shows with the debug toggle off, even sorted by difficulty', () => {
    HIKER_SORT.set('difficulty');
    const html = screen();
    expect(html).toContain('EASY');
    expect(html).not.toContain('data-difficulty');
  });

  it('the debug toggle shows each card’s rating in its corner', () => {
    SHOW_DIFFICULTY.set('on');
    const html = screen();
    expect(html.match(/data-difficulty="\d+"/g)).toHaveLength(ROSTER.length);
    expect(html).toContain('data-difficulty="9"');
  });
});
