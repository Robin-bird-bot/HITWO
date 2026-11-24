import { describe, expect, it } from 'vitest';
import { classesOf, isGeneral, SPECIAL_MORALE, TRAITS_BY_CLASS } from '../classes';
import { isUsable, TRAIT_LIST, TRAITS } from './index';
import DOC from '../../../docs/design/02-traits-and-conditions.md?raw';

/** The rows of the markdown table under a heading (until the next heading). */
function tableRows(heading: string, nth = 0): string[][] {
  const parts = DOC.split(heading);
  const after = parts[1 + nth] ?? '';
  const section = after.split(/\n#{2,3} |\n\*\*/)[0] ?? '';
  return section
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
    .slice(1)
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    );
}

const TIER: Record<string, number> = { I: 1, II: 2, III: 3 };
const norm = (n: string) => n.replace(/[’']/g, '’').toLowerCase();
// The old system's traits (02 and 07): Skill Trails steps (Phase 10.7) reuse some names.
const byName = new Map(TRAIT_LIST.filter((t) => !t.area).map((t) => [norm(t.name), t]));

/** Doc names that are several traits, or written differently from the trait's own name. */
const SPLITS: Record<string, string[]> = {
  'green / blue / gray / yellow thumb': ['[Color] Thumb'],
  'wet / sappy / fuzzy / rocky pockets': ['[Node] Pockets'],
  'artisan cook / crafter / architect / tailor': [
    'Artisan Cook',
    'Artisan Crafter',
    'Artisan Architect',
    'Artisan Tailor',
  ],
  'master cook / crafter / architect / tailor': [
    'Master Cook',
    'Master Crafter',
    'Master Architect',
    'Master Tailor',
  ],
};

function traitsNamed(docName: string) {
  const names = SPLITS[norm(docName)] ?? [docName];
  return names.map((n) => byName.get(norm(n)));
}

describe('every trait in 02-traits-and-conditions.md is in the game', () => {
  it.each([
    ['## Trail traits', 'T'],
    ['## Utility traits', 'U'],
  ] as const)('%s, with the right type and tier', (heading, type) => {
    const rows = tableRows(heading);
    expect(rows.length).toBeGreaterThan(30);
    for (const [tier = '', name = ''] of rows) {
      for (const t of traitsNamed(name)) {
        expect(t, name).toBeDefined();
        expect(t?.type, name).toBe(type);
        expect(t?.tier, name).toBe(TIER[tier]);
      }
    }
  });

  it('the Morale traits, with no tier', () => {
    const rows = tableRows('## Morale traits');
    expect(rows.length).toBe(24);
    for (const [name = ''] of rows) {
      const t = byName.get(norm(name)) ?? byName.get(norm(`${name}`));
      // The Morale Thrill-Seeker shares its name with the Trail trait's spelling, hyphen aside.
      expect(t, name).toBeDefined();
      expect(t?.type, name).toBe('M');
      expect(t?.tier, name).toBeNull();
    }
  });

  it('the family traits, for the right families', () => {
    const who = { Humans: ['human'], Dogs: ['dog'], Cats: ['cat'], Pets: ['dog', 'cat'] };
    for (const [slot = '', tier = '', name = '', w = ''] of tableRows(
      '**Family Trail and Utility traits**',
    )) {
      const t = byName.get(norm(name));
      expect(t, name).toBeDefined();
      expect(t?.type, name).toBe(slot === 'Trail' ? 'T' : 'U');
      expect(t?.tier, name).toBe(TIER[tier]);
      expect(t?.who, name).toEqual(who[w as keyof typeof who]);
    }
    for (const [name = '', w = ''] of tableRows('**Family Morale traits**')) {
      const t = byName.get(norm(name));
      expect(t?.type, name).toBe('M');
      expect(t?.who, name).toEqual(who[w as keyof typeof who]);
    }
  });

  it('the special and unique traits, with their kind and type', () => {
    const rows = tableRows('## Special and unique traits');
    expect(rows.length).toBe(16);
    for (const [name = '', kind = '', slot = ''] of rows) {
      const t = byName.get(norm(name));
      expect(t, name).toBeDefined();
      expect(t?.kind, name).toBe(kind.startsWith('Unique') ? 'unique' : 'special');
      expect(t?.type, name).toBe(slot === 'Trail' ? 'T' : slot === 'Utility' ? 'U' : 'M');
    }
  });

  it('every new trait from 07-characters.md (the Nov 20 update’s list)', () => {
    const NEW = [
      'Wanderer',
      'Forgetful',
      'Snores',
      'Alpha Dog',
      'Lanky',
      'Good Boy',
      'Spoiled',
      'Fluff Armor',
      'Mentor',
      'Storyteller',
      'Hype Dog',
      'Shifty',
      'Night Shifty',
      'Lucky Charm',
      'Cuddle Buddy',
      'Rule Changer',
      'Strong Walker',
      'Just Around the Next Corner',
      'Tank Butt',
      'Linguist',
      'Coach',
      'Comedian',
      'Easy Mode',
      'Garbage Gut',
      'Boss & Gracie',
      'Leash Puller',
      'Human Food',
    ];
    for (const name of NEW) expect(byName.get(norm(name)), name).toBeDefined();
  });

  it('has no trait twice', () => {
    expect(new Set(TRAIT_LIST.map((t) => t.id)).size).toBe(TRAIT_LIST.length);
  });
});

describe('classes (07-characters.md)', () => {
  it('only names traits that exist', () => {
    for (const ids of Object.values(TRAITS_BY_CLASS)) {
      for (const id of ids) expect(TRAITS[id], id).toBeDefined();
    }
  });

  it('gives every open Trail and Utility trait a class, or makes it general', () => {
    const open = TRAIT_LIST.filter(
      (t) => t.type !== 'M' && (t.kind ?? 'normal') !== 'special' && t.kind !== 'unique',
    );
    for (const t of open) {
      expect(classesOf(t).length > 0 || isGeneral(t), t.name).toBe(true);
    }
  });

  it('gives family versions their group’s classes, and Strong and Backtracker none', () => {
    expect(classesOf(TRAITS.leashPuller!)).toEqual(['leader']);
    expect(classesOf(TRAITS.humanFood!)).toEqual(['hardy']);
    expect(isGeneral(TRAITS.strong!)).toBe(true);
    expect(isGeneral(TRAITS.backtracker!)).toBe(true);
  });

  it('keeps the special Morale traits with their owners', () => {
    for (const id of SPECIAL_MORALE) {
      expect(TRAITS[id]?.type, id).toBe('M');
      expect(['special', 'unique']).toContain(TRAITS[id]?.kind);
    }
  });
});

describe('usable traits', () => {
  it('are the ones with an ability; the rest are always on', () => {
    expect(isUsable(TRAITS.stoic!)).toBe(true);
    expect(isUsable(TRAITS.gambler!)).toBe(true);
    expect(isUsable(TRAITS.leader!)).toBe(false);
    // Every Morale trait is always on.
    expect(TRAIT_LIST.filter((t) => t.type === 'M').some(isUsable)).toBe(false);
  });
});
