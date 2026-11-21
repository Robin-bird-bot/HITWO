import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { classesOf, isGeneral } from '../../content/classes';
import { TRAITS } from '../../content/traits';
import { validateAction } from '../applyAction';
import type { HikerSetup } from '../newGame';
import { deserialize, serialize } from '../save';
import { END, fixtureGame, fixtureHiker, hiker, place, run, toNight } from '../test/fixtures';
import type { ClassId, Family, GameState, SlotType, TraitOption } from '../types';
import { gainXp } from '../xp';
import { offerShape, optionSource, rollOffer, rollSetting } from './levelUp';

const L = BALANCE.levelUp;

interface Who {
  slots?: { type: SlotType; traitId?: string | null }[];
  family?: Family;
  classes?: ClassId[];
  characterId?: string;
}

/** Ash (set up as asked) and Birch, on the trailhead. */
function game(ash: Who = {}, seed = 1): GameState {
  const hikers: HikerSetup[] = [
    {
      ...fixtureHiker('ash'),
      family: ash.family ?? 'human',
      classes: ash.classes ?? ['tank'],
      slots: (ash.slots ?? [{ type: 'T' }, { type: 'U' }, { type: 'M' }]).map((s) => ({
        type: s.type,
        traitId: s.traitId ?? null,
      })),
      ...(ash.characterId ? { characterId: ash.characterId } : {}),
    },
    fixtureHiker('birch', ['leader']),
  ];
  return fixtureGame({ seed, hikers });
}
const ash = (s: GameState) => hiker(s, 'ash');

/** Many offers for Ash at a level, one per seed. */
function offers(who: Who, level: number, seeds = 120): TraitOption[][] {
  return Array.from({ length: seeds }, (_, i) => {
    const s = game(who, i + 1);
    return rollOffer(s, ash(s), level);
  });
}
const traitsIn = (all: TraitOption[][]) =>
  all.flat().flatMap((o) => (o.kind === 'trait' ? [TRAITS[o.traitId]!] : []));

describe('the offer’s shape', () => {
  it('levels 1–3: 3 options of that tier; from 4, one more a level, Tier III, up to 6', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(offerShape)).toEqual([
      { count: 3, tier: 1 },
      { count: 3, tier: 2 },
      { count: 3, tier: 3 },
      { count: 4, tier: 3 },
      { count: 5, tier: 3 },
      { count: 6, tier: 3 },
      { count: 6, tier: 3 },
    ]);
  });

  it('every option is a trait of the right tier (or a new slot), none twice', () => {
    for (const offer of offers({}, 2)) {
      expect(offer).toHaveLength(3);
      const ids = offer.flatMap((o) => (o.kind === 'trait' ? [o.traitId] : []));
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        const def = TRAITS[id]!;
        if (def.type !== 'M') expect(def.tier).toBe(2);
      }
    }
  });
});

describe('what can be offered', () => {
  it('only the types the slots can hold, filled or open', () => {
    const t = traitsIn(offers({ slots: [{ type: 'T', traitId: 'leader' }, { type: 'T' }] }, 1));
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((d) => d.type === 'T')).toBe(true);
    const mixed = traitsIn(offers({ slots: [{ type: 'U/M' }] }, 1));
    expect(new Set(mixed.map((d) => d.type))).toEqual(new Set(['U', 'M']));
  });

  it('never a trait the hiker has', () => {
    const t = traitsIn(offers({ slots: [{ type: 'T', traitId: 'leader' }, { type: 'T' }] }, 1));
    expect(t.some((d) => d.id === 'leader')).toBe(false);
  });

  it('Trail and Utility from the classes, Jack and general traits, with at most 1 from any class', () => {
    const who: Who = { classes: ['tank'], slots: [{ type: 'T' }, { type: 'U' }] };
    let outside = 0;
    for (const offer of offers(who, 1, 200)) {
      const out = offer.filter((o) => {
        if (o.kind !== 'trait') return false;
        const def = TRAITS[o.traitId]!;
        const cls = classesOf(def);
        return !isGeneral(def) && !cls.includes('jack') && !cls.includes('tank');
      });
      expect(out.length).toBeLessThanOrEqual(L.anyClass);
      outside += out.length;
    }
    // The any-class option does come up.
    expect(outside).toBeGreaterThan(0);
  });

  it('Morale traits come up less often than Trail or Utility ones', () => {
    // A Test Tank's slots: T, T, T/U and M.
    const who: Who = {
      classes: ['tank'],
      slots: [{ type: 'T' }, { type: 'T' }, { type: 'T/U' }, { type: 'M' }],
    };
    const t = traitsIn(offers(who, 1, 300));
    const count = (type: string) => t.filter((d) => d.type === type).length;
    expect(count('M')).toBeGreaterThan(0);
    expect(count('M')).toBeLessThan(count('T') * 0.8);
    expect(count('M')).toBeLessThan(count('U') * 0.8);
  });

  it('only the family version that fits', () => {
    const tank: Who = { classes: ['tank'], slots: [{ type: 'T' }, { type: 'T' }] };
    const dog = traitsIn(offers({ ...tank, family: 'dog' }, 2, 200)).map((d) => d.id);
    const human = traitsIn(offers(tank, 2, 200)).map((d) => d.id);
    expect(dog).toContain('leashPuller');
    expect(dog).not.toContain('puller');
    expect(human).toContain('puller');
    expect(human).not.toContain('leashPuller');
    // Family traits only for their family: Herder is a Dog's.
    expect(human).not.toContain('herder');
  });

  it('special and unique traits only for their owners', () => {
    const who: Who = { classes: ['support'], slots: [{ type: 'U' }] };
    const owner = traitsIn(offers({ ...who, characterId: 'hershal' }, 1, 300)).map((d) => d.id);
    const other = traitsIn(offers({ ...who, characterId: 'catie' }, 1, 300)).map((d) => d.id);
    expect(owner).toContain('mentor');
    expect(other).not.toContain('mentor');
    expect(other.some((id) => TRAITS[id]?.owners && !TRAITS[id]?.owners?.includes('catie'))).toBe(
      false,
    );
  });

  it('a new slot sometimes, never past 6', () => {
    const five = offers({ slots: Array.from({ length: 5 }, () => ({ type: 'W' as SlotType })) }, 1);
    expect(five.flat().some((o) => o.kind === 'slot')).toBe(true);
    const six = offers({ slots: Array.from({ length: 6 }, () => ({ type: 'W' as SlotType })) }, 1);
    expect(six.flat().some((o) => o.kind === 'slot')).toBe(false);
  });

  it('a trait with a setting comes with one rolled', () => {
    const s = game();
    expect(rollSetting(s.rng, 'node').x).toMatch(/forest|river|wildlife|mountain/);
    const two = rollSetting(s.rng, 'nodes');
    expect(two.x).not.toBe(two.y);
  });
});

describe('taking a level-up', () => {
  /** Ash at level 0 with a level-up open, offering exactly these options. */
  function opened(options: TraitOption[], who: Who = {}) {
    const s = game(who);
    ash(s).pendingLevels = 1;
    s.traitPick = { hikerId: 'ash', source: 'levelUp', level: 1, options };
    return s;
  }
  const take = (option: number, replaceSlot?: number) => ({
    type: 'pickTrait' as const,
    option,
    ...(replaceSlot !== undefined ? { replaceSlot } : {}),
  });

  it('a trait goes in an empty slot that fits, the narrowest first', () => {
    const s = run(
      opened([{ kind: 'trait', traitId: 'leader' }], { slots: [{ type: 'W' }, { type: 'T' }] }),
      take(0),
    );
    expect(ash(s).slots.map((x) => x.traitId)).toEqual([null, 'leader']);
    expect(ash(s)).toMatchObject({ level: 1, pendingLevels: 0 });
    expect(s.traitPick).toBeUndefined();
    expect(s.log.some((e) => e.kind === 'traitGained' && e.traitId === 'leader')).toBe(true);
  });

  it('with no empty slot that fits, the player picks the trait it replaces', () => {
    const s = opened([{ kind: 'trait', traitId: 'fast' }], {
      slots: [
        { type: 'T', traitId: 'leader' },
        { type: 'U', traitId: 'forager' },
      ],
    });
    expect(validateAction(s, take(0))).toBe('Pick which of Ash’s traits Fast replaces.');
    expect(validateAction(s, take(0, 1))).toBe('Fast doesn’t fit that slot.');
    const after = run(s, take(0, 0));
    expect(ash(after).slots.map((x) => x.traitId)).toEqual(['fast', 'forager']);
    expect(after.log.at(-1)).toMatchObject({ kind: 'traitGained', replaced: 'leader' });
  });

  it('a new slot is added empty', () => {
    const s = run(opened([{ kind: 'slot', slot: 'T/U' }]), take(0));
    expect(ash(s).slots.at(-1)).toEqual({ type: 'T/U', traitId: null });
  });

  it('keeps the setting it was offered with', () => {
    const s = run(
      opened([{ kind: 'trait', traitId: 'finder', setting: { x: 'river' } }], {
        slots: [{ type: 'U' }],
      }),
      take(0),
    );
    expect(ash(s).slots[0]).toMatchObject({ traitId: 'finder', setting: { x: 'river' } });
  });

  it('the next level waiting opens right after', () => {
    let s = opened([{ kind: 'slot', slot: 'T' }]);
    ash(s).pendingLevels = 2;
    s = run(s, take(0));
    expect(s.traitPick).toMatchObject({ hikerId: 'ash', level: 2 });
  });

  it('nothing else happens until it’s picked', () => {
    const s = opened([{ kind: 'slot', slot: 'T' }]);
    expect(validateAction(s, END)).toBe('Pick from the level-up first.');
    expect(validateAction(s, { type: 'debug', op: { kind: 'revealMap' } })).toBeNull();
  });

  it('MBA: caps by the new level', () => {
    const s = opened([{ kind: 'slot', slot: 'T' }], { slots: [{ type: 'U', traitId: 'mba' }] });
    ash(s).level = 1;
    s.traitPick!.level = 2;
    const before = s.caps;
    expect(run(s, take(0)).caps).toBe(before + BALANCE.traits.mba.capsPerLevel * 2);
  });

  it('Proud Mentor: +1 Morale when someone on the tile levels up', () => {
    const s = opened([{ kind: 'slot', slot: 'T' }]);
    hiker(s, 'birch').slots = [{ type: 'M', traitId: 'proudMentor' }];
    hiker(s, 'birch').stats.morale = 5;
    expect(hiker(run(s, take(0)), 'birch').stats.morale).toBe(6);
  });

  it('a daily trait taken mid-day gets today’s pick', () => {
    const s = run(
      opened([{ kind: 'trait', traitId: 'zany' }], { slots: [{ type: 'U' }] }),
      take(0),
    );
    expect(ash(s).slots[0]?.daily?.day).toBe(s.day);
  });

  it('opens at the camp step with real options', () => {
    let s = game({ slots: [{ type: 'W' }, { type: 'W' }] });
    gainXp(s, ash(s), 20, 'challenge', 'test');
    s = run(toNight(s), END);
    expect(s.traitPick?.options).toHaveLength(3);
    const first = s.traitPick!.options[0]!;
    s = run(s, take(0));
    expect(ash(s).level).toBe(1);
    if (first.kind === 'trait') expect(ash(s).slots[0]?.traitId).toBe(first.traitId);
  });

  it('the debug panel opens one now, at a chosen tier', () => {
    const s = run(game({ slots: [{ type: 'W' }] }), {
      type: 'debug',
      op: { kind: 'levelUpNow', hikerId: 'ash', tier: 3 },
    });
    expect(s.traitPick?.level).toBe(1);
    for (const o of s.traitPick!.options) {
      if (o.kind === 'trait' && TRAITS[o.traitId]!.type !== 'M') {
        expect(TRAITS[o.traitId]!.tier).toBe(3);
      }
    }
  });
});

describe('the level-up screen', () => {
  function opened(options: TraitOption[], who: Who = {}) {
    const s = game(who);
    ash(s).pendingLevels = 1;
    s.traitPick = { hikerId: 'ash', source: 'levelUp', level: 1, options };
    return s;
  }
  const keep = { type: 'pickTrait' as const, option: -1, keep: true as const };

  it('KEEP MY TRAITS takes nothing, but the level counts', () => {
    const s = opened([
      { kind: 'trait', traitId: 'leader' },
      { kind: 'slot', slot: 'T' },
    ]);
    const slots = structuredClone(ash(s).slots);
    expect(validateAction(s, keep)).toBeNull();
    const after = run(s, keep);
    expect(ash(after).slots).toEqual(slots);
    expect(ash(after)).toMatchObject({ level: 1, pendingLevels: 0 });
    expect(after.traitPick).toBeUndefined();
    expect(after.log.at(-1)).toMatchObject({
      kind: 'trait',
      text: 'Ash reached level 1 and kept their traits.',
    });
  });

  it('kept or not, the next level-up waiting opens after (MBA still pays)', () => {
    const s = opened([{ kind: 'slot', slot: 'T' }], { slots: [{ type: 'U', traitId: 'mba' }] });
    ash(s).pendingLevels = 2;
    const before = s.caps;
    const after = run(s, keep);
    expect(after.caps).toBe(before + BALANCE.traits.mba.capsPerLevel);
    expect(after.traitPick).toMatchObject({ hikerId: 'ash', level: 2 });
  });

  it('an Old Photo can’t be kept: one of its traits must be taken', () => {
    const s = game({ slots: [{ type: 'T', traitId: 'leader' }] });
    s.traitPick = {
      hikerId: 'ash',
      source: 'oldPhoto',
      slot: 0,
      options: [{ kind: 'trait', traitId: 'fast' }],
    };
    expect(validateAction(s, keep)).toBe('Pick a trait for the Old Photo.');
  });

  it('only a slot that fits takes a trait; dropping on a trait replaces it for good', () => {
    const s = opened([{ kind: 'trait', traitId: 'fast' }], {
      slots: [{ type: 'T', traitId: 'leader' }, { type: 'U' }, { type: 'T/U' }],
    });
    const at = (slot: number) => ({ type: 'pickTrait' as const, option: 0, replaceSlot: slot });
    expect(validateAction(s, at(0))).toBeNull();
    expect(validateAction(s, at(1))).toBe('Fast doesn’t fit that slot.');
    expect(validateAction(s, at(2))).toBeNull();
    // The open Trail-or-Utility slot, chosen over nothing else.
    expect(ash(run(s, at(2))).slots.map((x) => x.traitId)).toEqual(['leader', null, 'fast']);
    const replaced = run(s, at(0));
    expect(ash(replaced).slots.map((x) => x.traitId)).toEqual(['fast', null, null]);
    expect(ash(replaced).slots.some((x) => x.traitId === 'leader')).toBe(false);
  });

  it('a NEW SLOT option adds a slot', () => {
    const s = run(opened([{ kind: 'slot', slot: 'U/M' }]), { type: 'pickTrait', option: 0 });
    expect(ash(s).slots).toHaveLength(4);
    expect(ash(s).slots.at(-1)).toEqual({ type: 'U/M', traitId: null });
  });

  it('two hikers leveling come one after another, in party order', () => {
    let s = game({ slots: [{ type: 'W' }, { type: 'W' }] });
    hiker(s, 'birch').slots.push({ type: 'W', traitId: null });
    gainXp(s, ash(s), 20, 'challenge', 'test');
    gainXp(s, hiker(s, 'birch'), 20, 'challenge', 'test');
    s = run(toNight(s), END);
    expect(s.traitPick?.hikerId).toBe('ash');
    s = run(s, keep);
    expect(s.traitPick?.hikerId).toBe('birch');
    s = run(s, keep);
    expect(s.traitPick).toBeUndefined();
    expect([ash(s).level, hiker(s, 'birch').level]).toEqual([1, 1]);
  });
});

describe('where an option comes from (its card’s tag)', () => {
  const def = (id: string) => TRAITS[id]!;

  it('the hiker’s own role, Jack, or a wild card from another class', () => {
    const s = game({ classes: ['scout', 'tank'] });
    const scoutTrait = Object.values(TRAITS).find(
      (d) =>
        d.type !== 'M' &&
        !d.kind &&
        classesOf(d).includes('scout') &&
        !classesOf(d).includes('tank'),
    );
    const otherTrait = Object.values(TRAITS).find(
      (d) =>
        d.type !== 'M' &&
        !isGeneral(d) &&
        (d.kind === undefined || d.kind === 'normal') &&
        classesOf(d).length > 0 &&
        !classesOf(d).some((c) => ['scout', 'tank', 'jack'].includes(c)),
    );
    expect(scoutTrait && optionSource(ash(s), scoutTrait)).toBe('scout');
    expect(otherTrait && optionSource(ash(s), otherTrait)).toBe('any');
    expect(optionSource(ash(s), def('dayNapper'))).toBe('jack');
  });

  it('none for Morale and general traits', () => {
    const s = game();
    expect(optionSource(ash(s), def('strong'))).toBeUndefined();
    const morale = Object.values(TRAITS).find((d) => d.type === 'M')!;
    expect(optionSource(ash(s), morale)).toBeUndefined();
  });
});

describe('saves', () => {
  it('a v15 save: levels start at 0, and XP already earned waits for camp', () => {
    const s = game();
    place(s, 'ash', 'L');
    const old = JSON.parse(serialize(s));
    old.saveVersion = 15;
    old.hikers[0].level = 1;
    old.hikers[0].xp = 55;
    delete old.hikers[0].xpRow;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.hikers[0]).toMatchObject({ level: 0, xp: 55, pendingLevels: 2 });
    expect(loaded.state.hikers[1]?.pendingLevels).toBeUndefined();
  });

  it('an open level-up survives a reload', () => {
    const s = run(game({ slots: [{ type: 'W' }] }), {
      type: 'debug',
      op: { kind: 'levelUpNow', hikerId: 'ash', tier: 1 },
    });
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state.traitPick).toEqual(s.traitPick);
  });
});
