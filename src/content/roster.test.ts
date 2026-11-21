import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/newGame';
import { deserialize, serialize } from '../engine/save';
import { familyCanHave, fitsSlot } from '../engine/traits/slots';
import { ITEMS } from './items';
import { PARTY_COLORS } from './partyColors';
import {
  blockedBy,
  canJoin,
  DEFAULT_PARTY,
  HOUSEHOLDS,
  ROSTER,
  ROSTER_BY_ID,
  type RosterHiker,
} from './roster';
import { TRAIT_LIST, TRAITS } from './traits';
import DOC from '../../docs/design/07-characters.md?raw';
import UPDATE from '../../docs/UPDATE-2026-11-20-phase-10b.md?raw';

// ── Reading 07-characters.md ────────────────────────────────────────────────

const clean = (s: string) => s.replace(/\\/g, '').replace(/\*/g, '').replace(/[’']/g, "'").trim();
const byName = new Map(ROSTER.map((h) => [h.name.toLowerCase(), h]));
const hikerNamed = (name: string): RosterHiker => {
  const h = byName.get(clean(name).toLowerCase());
  if (!h) throw new Error(`No roster hiker named ${name}`);
  return h;
};
const CLASS_IDS: Record<string, string> = {
  tank: 'tank',
  hardy: 'hardy',
  scavenger: 'scavenger',
  crafter: 'crafter',
  scout: 'scout',
  support: 'support',
  jack: 'jack',
  entertainer: 'entertainer',
  moneymaker: 'moneymaker',
};
const classesFrom = (text: string) =>
  clean(text)
    .replace(/\.$/, '')
    .split(/ and |, /)
    .map((c) => CLASS_IDS[c.trim().toLowerCase()] ?? `?${c}`);
const slotsFrom = (text: string) =>
  clean(text)
    .split('.')[0]!
    .split(', ')
    .filter((s) => !s.startsWith('with '))
    .map((s) => (s === 'Tag Team' ? 'tag' : s));

/** A trait name as the doc writes it, as the id the roster uses. */
function traitIdFor(written: string): string {
  const name = clean(written)
    .replace(/\(.*?\)/g, '')
    .trim();
  if (name === 'Green Thumb') return 'thumb';
  const def = TRAIT_LIST.find((t) => t.name === name);
  if (!def) throw new Error(`No trait named ${written}`);
  return def.id;
}

/** The hiker sections: "### Name "Title"", their class, slots and trait table. */
function docHikers(): {
  name: string;
  title?: string;
  classes: string[];
  slots: string[];
  traits: (string | null)[];
}[] {
  const out = [];
  const sections = DOC.split(/\n### /).slice(1);
  for (const section of sections) {
    const head = section.split('\n')[0]!;
    // "- **Class:** …", or after "**Variant of:** …" on the holiday hikers' line.
    const cls = /\*\*Class:\*\* (.+)/.exec(section);
    const slotLine = /- \*\*Slots:\*\* (.+)/.exec(section);
    if (!cls || !slotLine) continue; // "Leveling up by class" and the like
    const [, name = '', title] =
      /^([^"]+?)\s*(?:"(.+)")?$/.exec(clean(head).replace(' (Duo)', '')) ?? [];
    const rows = section
      .split('\n')
      .filter((l) => /^\| (T|U|M|T\/U|T\/M|U\/M|W|Tag Team) \|/.test(l))
      .map((l) => l.split('|').map((c) => c.trim()))
      .map((cells) => (cells[2] === '(open)' ? null : traitIdFor(cells[2] ?? '')));
    out.push({
      name,
      ...(title ? { title } : {}),
      classes: classesFrom(cls[1] ?? ''),
      slots: slotsFrom(slotLine[1] ?? ''),
      traits: rows,
    });
  }
  return out;
}

/** The rows of the table under a heading. */
function tableAfter(heading: string): string[][] {
  const at = DOC.indexOf(heading);
  if (at < 0) throw new Error(`No ${heading}`);
  const rest = DOC.slice(at).split('\n');
  const start = rest.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (const line of rest.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  }
  return rows;
}

const sameTrait = (a: string | null, b: string | null) => {
  if (a === b) return true;
  const da = a ? TRAITS[a] : undefined;
  const db = b ? TRAITS[b] : undefined;
  return !!da?.group && da.group === db?.group;
};

// ── The roster against the doc ──────────────────────────────────────────────

describe('the roster matches 07-characters.md', () => {
  it('has every character and variant: 44 hikers (the 4 holiday hikers too), 10 starters', () => {
    expect(ROSTER).toHaveLength(44);
    expect(ROSTER.filter((h) => h.starter).map((h) => h.name)).toEqual([
      'Wyatt',
      'Mom',
      'Ellie',
      'Finn',
      'Gdog',
      'Grandpa Wink',
      'Cody',
      'Grandpa Sherman',
      'Pearl',
      'Brutus',
    ]);
    expect(new Set(ROSTER.map((h) => h.id)).size).toBe(44);
  });

  it('each hiker with a section: classes, slots and traits in order', () => {
    const hikers = docHikers();
    expect(hikers.length).toBe(33);
    for (const d of hikers) {
      const h = hikerNamed(d.name);
      expect(h.classes, d.name).toEqual(d.classes);
      expect(
        h.slots.map((s) => s.type),
        d.name,
      ).toEqual(d.slots);
      const mine = h.slots.map((s) => s.traitId);
      expect(mine.length, d.name).toBe(d.traits.length);
      mine.forEach((id, i) =>
        expect(sameTrait(id, d.traits[i] ?? null), `${d.name} slot ${i + 1}`).toBe(true),
      );
    }
  });

  it('the cats and the variants, from their tables', () => {
    for (const [cell, cls, slotText, traitText] of tableAfter('## Cats')) {
      const h = hikerNamed((cell ?? '').split(' "')[0] ?? '');
      expect(h.classes).toEqual(classesFrom(cls ?? ''));
      expect(h.slots.map((s) => s.type)).toEqual(slotsFrom(slotText ?? ''));
      expect(h.slots.map((s) => s.traitId)).toEqual((traitText ?? '').split(', ').map(traitIdFor));
    }
    for (const [name, base, cls, slotText, traitText] of tableAfter('## Variants')) {
      const h = hikerNamed(name ?? '');
      expect(h.variantOf, name).toBeDefined();
      if (base === 'Wyatt') expect(h.variantOf).toBe('wyatt');
      expect(h.classes, name).toEqual(classesFrom(cls ?? ''));
      expect(
        h.slots.map((s) => s.type),
        name,
      ).toEqual(slotsFrom(slotText ?? ''));
      const want = (traitText ?? '').split(', ').map(traitIdFor);
      h.slots.forEach((s, i) =>
        expect(sameTrait(s.traitId, want[i] ?? null), `${name} ${i}`).toBe(true),
      );
    }
  });

  it('titles: the 10b update’s table, and the doc headings where they have one', () => {
    // The update's table: | Hiker | Title | Hiker | Title |
    const rows = UPDATE.split('\n').filter((l) => /^\| [A-Z].* \| .* \| .* \| .* \|$/.test(l));
    const pairs = rows
      .map((l) =>
        l
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim()),
      )
      .flatMap(([a, b, c, d]) => [
        [a, b],
        [c, d],
      ])
      .filter(([name]) => name && name !== 'Hiker');
    expect(pairs.length).toBe(30);
    for (const [name, title] of pairs) {
      expect(hikerNamed(name ?? '').title, name).toBe(clean(title ?? '').replace(/'/g, '’'));
    }
    for (const d of docHikers()) {
      if (d.title) {
        expect(clean(hikerNamed(d.name).title ?? '').toLowerCase(), d.name).toBe(
          clean(d.title).toLowerCase(),
        );
      }
    }
    // Ben, Mindy and the variants have none yet; the holiday hikers have theirs.
    const holiday = (x: RosterHiker) => x.households.includes('holiday');
    for (const h of ROSTER.filter(
      (x) => (x.variantOf && !holiday(x)) || x.id === 'ben' || x.id === 'mindy',
    )) {
      expect(h.title, h.name).toBeUndefined();
    }
    expect(ROSTER.filter(holiday).map((h) => h.title)).toEqual([
      'The Festive',
      'The Little Helper',
      'The Grumpy',
      'The Rednose Retriever',
    ]);
  });

  it('starting bags', () => {
    const itemByName = new Map(Object.values(ITEMS).map((i) => [i.name.toLowerCase(), i.id]));
    for (const [name, text] of tableAfter('## Starting bags')) {
      const h = hikerNamed(name ?? '');
      const items: string[] = [];
      let blueprints: { count: number; type?: string } | undefined;
      let presents = 0;
      const parts = (text ?? '')
        .replace(/\(.*?\)/g, '')
        .split(/, and |, | and /)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        const bp = /^(\d+) random Tier 1 (?:(\w+) )?blueprints?$/.exec(part);
        if (bp) {
          blueprints = { count: Number(bp[1]), ...(bp[2] ? { type: bp[2] } : {}) };
          continue;
        }
        // "2 Presents", "1 Present" (the holiday hikers): plain ones.
        const gift = /^(\d+) Presents?$/.exec(part);
        if (gift) {
          presents = Number(gift[1]);
          continue;
        }
        const many = /^(\d+) (.+)$/.exec(part);
        const n = many ? Number(many[1]) : 1;
        const id = itemByName.get((many ? many[2]! : part).toLowerCase());
        expect(id, `${name}: ${part}`).toBeDefined();
        for (let i = 0; i < n; i++) items.push(id!);
      }
      expect(h.startingBag.items ?? [], name).toEqual(items);
      expect(h.startingBag.presents ?? 0, name).toBe(presents);
      if (blueprints) {
        expect(h.startingBag.blueprints, name).toEqual({ ...blueprints, tier: 1 });
      } else {
        expect(h.startingBag.blueprints, name).toBeUndefined();
      }
    }
  });

  it('hidden difficulty for everyone', () => {
    const rows = tableAfter('## Difficulty (hidden)');
    expect(rows).toHaveLength(44);
    for (const [name, rating] of rows)
      expect(hikerNamed(name ?? '').difficulty, name).toBe(Number(rating));
  });

  it('households: the Family sort’s table; variants are Other unless given Holiday', () => {
    for (const [family, , members] of tableAfter('## Sorting the hiker selection screen')) {
      const group = HOUSEHOLDS.find((g) => g.name === family);
      expect(group, family).toBeDefined();
      if (members?.startsWith('Everyone else')) continue;
      expect(group!.members.map((id) => ROSTER_BY_ID.get(id)?.name)).toEqual(
        (members ?? '').split(', '),
      );
    }
    expect(ROSTER_BY_ID.get('mom')?.households).toEqual(['elmers', 'brooks']);
    expect(HOUSEHOLDS.map((g) => g.name)).toEqual([
      'Elmers',
      'Brooks',
      'Sherman',
      'Leichty',
      'Holiday',
      'Other',
    ]);
    for (const h of ROSTER.filter((x) => x.variantOf)) {
      const holiday = ['grammyClause', 'lelf', 'grinch', 'redolf'].includes(h.id);
      expect(h.households, h.id).toEqual([holiday ? 'holiday' : 'other']);
    }
    for (const id of ['ben', 'mindy', 'leah', 'loki', 'goldie']) {
      expect(ROSTER_BY_ID.get(id)?.households, id).toEqual(['other']);
    }
  });
});

describe('the roster’s rules', () => {
  it('Mitchell: U, U, M, M with Cat Person', () => {
    const m = ROSTER_BY_ID.get('mitchell')!;
    expect(m.slots.map((s) => s.type)).toEqual(['U', 'U', 'M', 'M']);
    expect(m.slots[3]?.traitId).toBe('catPerson');
  });

  it('every trait fits its slot, suits the family, and belongs to them if it’s special', () => {
    for (const h of ROSTER) {
      for (const s of h.slots) {
        if (!s.traitId) continue;
        const def = TRAITS[s.traitId];
        expect(def, `${h.name}: ${s.traitId}`).toBeDefined();
        expect(fitsSlot(s.type, def!), `${h.name}: ${def!.name} in ${s.type}`).toBe(true);
        expect(familyCanHave(def!, h.family), `${h.name}: ${def!.name}`).toBe(true);
        if (def!.kind === 'special' || def!.kind === 'unique') {
          expect(def!.owners, `${h.name}: ${def!.name}`).toContain(h.characterId);
        }
        if (def!.setting) expect(s.setting?.x, `${h.name}: ${def!.name}`).toBeDefined();
      }
    }
  });

  it('every special and unique trait’s owners are real hikers (Catie, not Katie)', () => {
    for (const def of TRAIT_LIST) {
      for (const owner of def.owners ?? []) {
        expect(ROSTER_BY_ID.has(owner), `${def.name}: ${owner}`).toBe(true);
      }
    }
  });

  it('every portrait named is in portraits.json', async () => {
    const json = (await import('../../public/assets/portraits/portraits.json')).default as Record<
      string,
      { faceY: number }
    >;
    for (const h of ROSTER.filter((x) => x.portrait)) {
      expect(json[`${h.portrait}.png`], h.name).toBeDefined();
    }
    // Only Ben and Mindy have none yet (holiday-hikers-2 sent the variants').
    expect(ROSTER.filter((h) => !h.portrait).map((h) => h.id)).toEqual(['ben', 'mindy']);
  });

  it('no cloning: a variant can’t join with its base hiker or another variant', () => {
    expect(canJoin(['finn'], 'followerFinn')).toBe(false);
    expect(blockedBy(['followerFinn'], 'agilityFinn')).toBe('followerFinn');
    expect(blockedBy(['wywee'], 'wyatt')).toBe('wywee');
    expect(canJoin(['finn'], 'ellie')).toBe(true);
    expect(canJoin(['finn'], 'finn')).toBe(false);
    expect(blockedBy(['mom'], 'graduateMom')).toBe('mom');
  });

  it('no cloning: each holiday hiker with their base hiker, and Wywee with Wyatt', () => {
    for (const [variant, base] of [
      ['grammyClause', 'gdog'],
      ['lelf', 'leah'],
      ['grinch', 'ellie'],
      ['redolf', 'cody'],
      ['wywee', 'wyatt'],
    ] as const) {
      expect(ROSTER_BY_ID.get(variant)?.variantOf, variant).toBe(base);
      expect(canJoin([base], variant), variant).toBe(false);
      expect(canJoin([variant], base), variant).toBe(false);
    }
    // Two variants of the same hiker can't join together either.
    expect(canJoin(['grammyClause'], 'showqueenGdog')).toBe(false);
    expect(canJoin(['grinch'], 'noseworkEllie')).toBe(false);
    expect(canJoin(['grinch'], 'cody')).toBe(true);
  });

  it('the renames: Prepared Wink and Showqueen Gdog, with the trait names kept', () => {
    expect(ROSTER_BY_ID.get('preparedWink')?.name).toBe('Prepared Wink');
    expect(ROSTER_BY_ID.get('showqueenGdog')?.name).toBe('Showqueen Gdog');
    expect(TRAITS.showGirl?.name).toBe('Show Girl');
    expect(TRAITS.showGirl?.owners).toEqual(['showqueenGdog']);
    const old = [['Showgirl', 'Gdog'].join(' '), ['Planner', 'Wink'].join(' ')];
    const oldIds = ['showgirl' + 'Gdog', 'planner' + 'Wink'];
    // Everywhere in the code and the docs, but the save upgrade (which renames them) and
    // the dated update notes (a record of what was sent).
    const files = {
      ...import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', eager: true, import: 'default' }),
      ...import.meta.glob(['/docs/design/*.md', '/docs/*.md', '!/docs/UPDATE-*.md', '/CLAUDE.md'], {
        query: '?raw',
        eager: true,
        import: 'default',
      }),
    } as Record<string, string>;
    for (const [path, text] of Object.entries(files)) {
      if (path.endsWith('/engine/save.ts')) continue;
      for (const word of [...old, ...oldIds])
        expect(text.includes(word), `${path}: ${word}`).toBe(false);
    }
  });
});

describe('starting a run with real hikers', () => {
  const pick = (...ids: string[]) => ids.map((id) => ROSTER_BY_ID.get(id)!);

  it('hands out the starting bags: items roll Quality, blueprints are learned', () => {
    const s = createGame({
      seed: 3,
      hikers: pick('mom', 'gdog', 'preparedWink', 'ellieDevourer'),
      startingResources: false,
    });
    const [mom, gdog, wink, devourer] = s.hikers;
    expect(mom!.inventory.bag.map((i) => i.itemId)).toEqual(['dogFood']);
    expect(mom!.inventory.bag[0]?.quality).toBeGreaterThanOrEqual(1);
    expect(mom!.blueprints).toHaveLength(1);
    expect(ITEMS[mom!.blueprints![0]!]?.tier).toBe(1);
    expect(gdog!.blueprints).toHaveLength(2);
    expect(
      gdog!.blueprints!.every((id) => ITEMS[id]?.type === 'food' && ITEMS[id]?.tier === 1),
    ).toBe(true);
    expect(wink!.inventory.bag.map((i) => i.itemId)).toEqual(['tent', 'binoculars', 'scanner']);
    expect(devourer!.inventory.bag.map((i) => i.itemId)).toEqual(['dogFood', 'dogFood']);
  });

  it('holiday hikers start with their Presents: Grammy’s are hers, the Grinch’s nobody’s', () => {
    const s = createGame({
      seed: 5,
      hikers: pick('grammyClause', 'lelf', 'grinch', 'redolf'),
      startingResources: false,
    });
    const [grammy, lelf, grinch, redolf] = s.hikers;
    expect(grammy!.inventory.bag.map((i) => [i.itemId, i.grade, i.wrappedBy])).toEqual([
      ['present', 'plain', 'grammyClause'],
      ['present', 'plain', 'grammyClause'],
    ]);
    expect(grammy!.wishLists?.small).toHaveLength(3);
    expect(grinch!.inventory.bag.map((i) => [i.itemId, i.grade, i.wrappedBy])).toEqual([
      ['present', 'plain', undefined],
    ]);
    expect(lelf!.blueprints?.every((id) => ITEMS[id]?.type === 'tool')).toBe(true);
    expect(redolf!.inventory.bag.map((i) => i.itemId)).toEqual(['campingLamp']);
  });

  it('the 4 random starting resources stay', () => {
    const s = createGame({ seed: 3, hikers: pick('wyatt') });
    const resources = Object.values(s.hikers[0]!.inventory.resources);
    expect(resources.reduce<number>((n, x) => n + (x ?? 0), 0)).toBe(4);
  });

  it('party colors follow the spot: orange, blue, yellow, purple', () => {
    const s = createGame({ seed: 3, hikers: pick('finn', 'mom', 'cody', 'wyatt') });
    expect(s.hikers.map((h) => h.color)).toEqual(PARTY_COLORS);
  });

  it('special traits work for their owners: Catie’s Artist', () => {
    const s = createGame({ seed: 3, hikers: pick('catie') });
    expect(s.hikers[0]!.characterId).toBe('catie');
  });

  it('the default party is the first four starters', () => {
    expect(DEFAULT_PARTY.map((h) => h.id)).toEqual(['wyatt', 'mom', 'ellie', 'finn']);
  });

  it('a v16 save’s hikers get their colors', () => {
    const s = createGame({ seed: 3, hikers: pick('finn', 'mom') });
    const old = JSON.parse(serialize(s));
    old.saveVersion = 16;
    for (const h of old.hikers) delete h.color;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok && loaded.state.hikers.map((h) => h.color)).toEqual(PARTY_COLORS.slice(0, 2));
  });

  it('a v17 save with the old names loads as Prepared Wink and Showqueen Gdog', () => {
    const s = createGame({ seed: 3, hikers: pick('preparedWink', 'showqueenGdog', 'finn') });
    // Written the way a v17 save had them: the old ids and names, everywhere.
    const old = JSON.parse(
      serialize(s)
        .replaceAll('"preparedWink"', '"planner' + 'Wink"')
        .replaceAll('"showqueenGdog"', '"showgirl' + 'Gdog"')
        .replaceAll('"Prepared Wink"', '"Planner' + ' Wink"')
        .replaceAll('"Showqueen Gdog"', '"Showgirl' + ' Gdog"'),
    );
    old.saveVersion = 17;
    old.counters.passed = { ['planner' + 'Wink']: 2 };
    old.hikers[2].inventory.bag.push({ uid: 'old-present', itemId: 'present', stuffed: true });
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const [wink, gdog, finn] = loaded.state.hikers;
    expect([wink?.id, wink?.characterId, wink?.name]).toEqual([
      'preparedWink',
      'preparedWink',
      'Prepared Wink',
    ]);
    expect([gdog?.id, gdog?.name]).toEqual(['showqueenGdog', 'Showqueen Gdog']);
    expect(loaded.state.counters.passed).toEqual({ preparedWink: 2 });
    // The first holiday zip's stuffed Present is a Tier 2+ one.
    expect(finn?.inventory.bag.at(-1)).toMatchObject({ itemId: 'present', grade: 'tier2plus' });
    expect(finn?.inventory.bag.at(-1)).not.toHaveProperty('stuffed');
  });
});
