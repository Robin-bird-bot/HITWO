/**
 * Dodge's attack library and animals (docs/design/12-minigames-dodge.md,
 * section 13): what each animal uses at each level, the Attack picker,
 * Claude's ideas, warnings, the Squirrel Army's acorns and shrapnel (and
 * its Easy level), the bear hug and the shrinking box, honey, the Stampede,
 * and a fuzz run of every animal on every tier.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS } from '../types';
import { ANIMAL_IDS, attackChoices, boxFor, pool, type LevelPick, type Rank } from './animals';
import { edges } from './geometry';
import { ATTACKS } from './library';
import { effectiveBox, hitShapes, newDodge, step, type DodgeState } from './logic';
import type { AnimalId, AttackId, Part } from './types';

const D = BALANCE.minigames.dodge;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const DT = 1 / 60;
const STILL = { x: 0, y: 0 };
const LEVELS: readonly (1 | 2 | 3)[] = [1, 2, 3];
const pick = (r: Rank): LevelPick => (r === 0 ? 'easy' : r);

/** A wandering sprite: it never stands still for long. */
const wander = (t: number) => ({ x: Math.sin(t * 1.3), y: Math.cos(t * 0.9) });

/** Plays a whole game (with plenty of lives, so it runs to the clock), calling `each` every step. */
function play(
  s0: DodgeState,
  each?: (s: DodgeState, prev: DodgeState) => void,
  input: (t: number) => { x: number; y: number } = wander,
): DodgeState {
  let s = s0;
  for (let i = 0; i < 100000 && !s.over; i++) {
    const prev = s;
    s = step(s, DT, input(s.time));
    each?.(s, prev);
  }
  return s;
}

/** A game at a level (Easy is 0), at Tier IV: nothing overlaps there. */
const many = (animal: AnimalId, level: Rank, extra: Partial<Parameters<typeof newDodge>[0]> = {}) =>
  newDodge({ animal, tier: 4, level: pick(level), lives: 3, lengthSec: 60, ...extra }, FOUR, 7);

/** Every part that ever showed up in a game, by id (the first time it was seen). */
function partsSeen(s0: DodgeState, input?: (t: number) => { x: number; y: number }): Part[] {
  const seen = new Map<number, Part>();
  play(
    s0,
    (s) => {
      for (const p of s.parts) if (!seen.has(p.id)) seen.set(p.id, p);
    },
    input,
  );
  return [...seen.values()];
}

const ids = (animal: AnimalId, level: Rank, ideas = true) =>
  [...new Set(pool(animal, level, ideas).map((e) => e.attack))].sort();

describe('what each animal uses, by level', () => {
  it.each([
    // Bees by level (Nov 25): one at a time first; full rows only at Level 3.
    ['bees', 0, ['pairs', 'single']],
    ['bees', 1, ['lane', 'single']],
    ['bees', 2, ['cross', 'lane', 'zigzag']],
    ['bees', 3, ['aimed', 'cross', 'diagonal', 'lane']],
    ['bear', 1, ['bite', 'claws']],
    ['bear', 2, ['bite', 'claws', 'hug', 'shout']],
    ['bear', 3, ['bite', 'claws', 'honey', 'hug', 'shout']],
    ['swordBear', 1, ['claws', 'jab', 'poke', 'sweep', 'wave']],
    ['swordBear', 3, ['claws', 'jab', 'poke', 'sweep', 'thrown', 'wave', 'xSlash']],
    ['bobcat', 1, ['claws', 'pounce', 'stalk']],
    ['bobcat', 2, ['claws', 'dash', 'pounce', 'stalk']],
    ['bobcat', 3, ['claws', 'dash', 'landingSwipe', 'pounce', 'stalk']],
    ['squirrels', 0, ['acorns', 'bombs', 'pinecones']],
    ['squirrels', 1, ['acorns', 'bombs', 'pinecones']],
    ['squirrels', 2, ['acorns', 'bombs', 'pinecones', 'scurry']],
    // The Woods Monster always plays Level 3 (here forced lower); Darkness needs Level 3.
    ['monster', 2, ['arms', 'fire', 'glare', 'hands', 'ritual', 'runes', 'wisps']],
    ['monster', 3, ['arms', 'darkness', 'fire', 'glare', 'hands', 'ritual', 'runes', 'wisps']],
    // Bear with a Gun and Ants (Nov 26).
    ['gunBear', 1, ['aimedShot', 'rapidFire', 'traps']],
    ['gunBear', 2, ['aimedShot', 'rapidFire', 'ricochet', 'snipe', 'traps']],
    ['gunBear', 3, ['aimedShot', 'quickDraw', 'rapidFire', 'ricochet', 'snipe', 'traps']],
    ['ants', 1, ['antMill', 'leafcutter', 'marching']],
    ['ants', 2, ['antHill', 'antMill', 'fireAnts', 'leafcutter', 'marching']],
    ['ants', 3, ['antHill', 'antMill', 'crumbRush', 'fireAnts', 'leafcutter', 'marching']],
  ] as const)('%s at Level %i', (animal, level, expected) => {
    expect(ids(animal, level)).toEqual([...expected].sort());
  });

  it('the Woods Monster’s attacks are never in the Stampede', () => {
    const his = new Set(ids('monster', 3));
    for (const level of LEVELS) expect(ids('stampede', level).some((a) => his.has(a))).toBe(false);
  });

  it('the Stampede has every animal’s attacks at the level, plus Herd rush', () => {
    for (const level of LEVELS) {
      const all = new Set(
        (['bees', 'bear', 'swordBear', 'bobcat', 'squirrels', 'gunBear', 'ants'] as const).flatMap(
          (a) => ids(a, level),
        ),
      );
      expect(ids('stampede', level)).toEqual([...all, 'herd'].sort());
    }
  });

  it('the Stampede never plays Easy', () => {
    expect(many('stampede', 0).easy).toBe(false);
    expect(many('stampede', 0).level).toBe(1);
    expect(many('bear', 0).easy).toBe(false);
    expect(many('bees', 0).easy).toBe(true);
  });

  it('switching Claude’s ideas off removes every attack marked as one', () => {
    for (const animal of ANIMAL_IDS) {
      for (const level of [0, ...LEVELS] as const) {
        const off = pool(animal, level, false);
        expect(off.every((e) => !ATTACKS[e.attack].claudesIdea)).toBe(true);
        expect(attackChoices(animal, level, false).some((c) => c.claudesIdea)).toBe(false);
      }
    }
    // And in play, none of their parts ever show up.
    const claude = new Set([
      'shout',
      'hug',
      'drop',
      'puddle',
      'slash',
      'thrown',
      'dash',
      'pinecone',
      'scurry',
      'nut',
      'herd',
      'hand',
      'wisp',
      'beam',
      'ritual',
      'dark',
    ]);
    for (const animal of ['stampede', 'monster'] as const) {
      const seen = partsSeen(many(animal, 3, { ideas: false }));
      expect(seen.length).toBeGreaterThan(20);
      expect(seen.some((p) => claude.has(p.kind))).toBe(false);
    }
  });

  it('the testing tab lists each attack once, with the levels it plays at', () => {
    const bear = attackChoices('bear', 1, true);
    expect(bear.map((c) => c.id)).toEqual(['claws', 'bite', 'shout', 'hug', 'honey']);
    expect(bear.find((c) => c.id === 'shout')).toMatchObject({
      unlocked: false,
      where: 'from Level 2',
      claudesIdea: true,
    });
    expect(bear.find((c) => c.id === 'claws')).toMatchObject({
      unlocked: true,
      where: 'every level',
    });
    const bees = attackChoices('bees', 0, true);
    expect(bees.map((c) => c.id)).toEqual([
      'single',
      'pairs',
      'lane',
      'cross',
      'diagonal',
      'zigzag',
      'aimed',
    ]);
    expect(bees.filter((c) => c.unlocked).map((c) => c.id)).toEqual(['single', 'pairs']);
    expect(bees.find((c) => c.id === 'single')?.where).toBe('Easy and Level 1 only');
    expect(bees.find((c) => c.id === 'pairs')?.where).toBe('Easy only');
    expect(bees.find((c) => c.id === 'lane')?.where).toBe('from Level 1');
    expect(bees.find((c) => c.id === 'zigzag')?.where).toBe('Level 2 only');
    expect(bees.find((c) => c.id === 'aimed')?.where).toBe('Level 3 only');
    const stampede = attackChoices('stampede', 3, true).map((c) => c.id);
    expect(new Set(stampede).size).toBe(stampede.length);
    expect(stampede).toContain('herd');
    // Darkness needs Level 3 (the Woods Monster always plays it, unless the Level setting says otherwise).
    const monster = attackChoices('monster', 2, true);
    expect(monster.filter((c) => !c.unlocked).map((c) => c.id)).toEqual(['darkness']);
    expect(monster.find((c) => c.id === 'darkness')?.where).toBe('Level 3 only');
    expect(attackChoices('monster', 3, true).every((c) => c.unlocked)).toBe(true);
  });
});

describe('the Attack picker', () => {
  it('one attack plays only that attack, and it still follows the level', () => {
    const rows = (level: 1 | 2 | 3) => {
      const s0 = many('bear', level, { attack: 'claws' });
      expect(s0.only).toBe('claws');
      const rounds = new Set<string>();
      const counts = new Set<number>();
      play(s0, (s) => {
        for (const r of s.rounds) rounds.add(r.attack);
        for (const p of s.parts) if (p.kind === 'claws') counts.add(p.count);
      });
      expect([...rounds]).toEqual(['claws']);
      return counts;
    };
    expect([...rows(1)]).toEqual([D.claws.count[1]]);
    expect([...rows(2)]).toEqual([D.claws.count[2]]);
  });

  it('an attack the animal doesn’t make at the level plays as All', () => {
    expect(many('bees', 0, { attack: 'lane' }).only).toBe('all');
    expect(many('bees', 0, { attack: 'single' }).only).toBe('single');
    expect(many('bees', 3, { attack: 'single' }).only).toBe('all');
    expect(many('bear', 1, { attack: 'shout' }).only).toBe('all');
    expect(many('bear', 2, { attack: 'shout' }).only).toBe('shout');
    expect(many('bear', 2, { attack: 'shout', ideas: false }).only).toBe('all');
    expect(many('bees', 3, { attack: 'claws' }).only).toBe('all');
    expect(many('monster', 2, { attack: 'darkness' }).only).toBe('all');
    expect(many('monster', 3, { attack: 'darkness' }).only).toBe('darkness');
  });

  it('never the same attack twice in a row, unless it’s the only one', () => {
    for (const animal of ['bear', 'bobcat', 'squirrels', 'swordBear', 'monster'] as const) {
      const order: AttackId[] = [];
      play(many(animal, 3), (s, prev) => {
        if (s.roundNo !== prev.roundNo) order.push(s.history.at(-1)!.attack);
      });
      expect(order.length).toBeGreaterThan(5);
      for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
    }
  });
});

describe('warnings', () => {
  /** Attacks with their own, shorter warning in the design. */
  const shortest: Partial<Record<Part['kind'], number>> = {
    jab: D.jab.warnSec,
    claws: D.claws.bobcat.warnSec,
    pounce: D.pounce.feintRealSec,
    swing: D.sword.warnMinSec,
    stalk: D.warnMinSec,
    hand: D.hands.crackSec,
    // Aimed Shot at Level 3: the aim tracks [0.32 s], then locks [0.2 s].
    shot: D.gun.aimed.trackSec[3] + D.gun.aimed.lockSec,
  };
  it.each([
    ['bees', 0] as const,
    ['squirrels', 0] as const,
    ...ANIMAL_IDS.flatMap((a) => LEVELS.map((l) => [a, l] as const)),
  ])('%s at Level %i: every attack warns first, never under the minimum', (animal, level) => {
    const seen = partsSeen(many(animal, level)).filter((p) => !p.child);
    expect(seen.length).toBeGreaterThan(5);
    for (const p of seen) {
      const warn = p.activeAt - p.warnAt;
      expect(warn, p.kind).toBeGreaterThanOrEqual(D.warnMinSec - 1e-9);
      expect(warn, p.kind).toBeGreaterThanOrEqual((shortest[p.kind] ?? D.warnSec) - 1e-9);
    }
  });
});

describe('the Squirrel Army', () => {
  it('acorns crack on each bounce and break into crumbs on the 3rd', () => {
    const s0 = many('squirrels', 1, { attack: 'acorns' });
    const stages = new Map<number, number[]>();
    let crumbs = 0;
    let broken = 0;
    play(s0, (s, prev) => {
      for (const p of s.parts) {
        if (p.kind === 'acorn') {
          const list = stages.get(p.id) ?? [];
          if (list.at(-1) !== p.bounces) list.push(p.bounces);
          stages.set(p.id, list);
        }
        if (p.kind === 'crumbs' && !prev.parts.some((q) => q.id === p.id)) crumbs++;
      }
      for (const p of prev.parts) {
        if (p.kind === 'acorn' && !s.parts.some((q) => q.id === p.id)) broken++;
      }
    });
    expect(stages.size).toBeGreaterThan(3);
    // Each acorn went 0, 1, 2 (one stage per bounce) and then broke.
    for (const list of stages.values()) expect(list).toEqual([0, 1, 2].slice(0, list.length));
    expect(broken).toBeGreaterThan(0);
    expect(crumbs).toBe(broken);
  });

  it.each([
    ['acorns', 0],
    ['acorns', 1],
    ['acorns', 2],
    ['acorns', 3],
    ['bombs', 0],
    ['bombs', 1],
    ['bombs', 2],
    ['bombs', 3],
  ] as const)('%s at Level %i: shrapnel only at Level 3', (attack, level) => {
    const seen = partsSeen(many('squirrels', level, { attack }));
    const shrapnel = seen.filter((p) => p.kind === 'shrapnel').length;
    if (level === 3) expect(shrapnel).toBeGreaterThan(0);
    else expect(shrapnel).toBe(0);
  });

  it('Easy: one acorn at a time, breaking on the 2nd wall hit; one still bomb with a longer fuse and a smaller blast; fewer pinecone columns', () => {
    const acorns = many('squirrels', 0, { attack: 'acorns' });
    let most = 0;
    let broken = 0;
    play(acorns, (s, prev) => {
      most = Math.max(most, s.parts.filter((p) => p.kind === 'acorn').length);
      for (const p of prev.parts) {
        if (p.kind !== 'acorn' || s.parts.some((q) => q.id === p.id)) continue;
        broken++;
        expect(p.bounces).toBe(D.acorns.easy.breakOn - 1);
      }
    });
    expect(most).toBe(D.acorns.easy.count);
    expect(broken).toBeGreaterThan(3);
    const bombs = partsSeen(many('squirrels', 0, { attack: 'bombs' })).filter(
      (p): p is Extract<Part, { kind: 'bomb' }> => p.kind === 'bomb',
    );
    const byRound = new Map<number, number>();
    for (const b of bombs) byRound.set(b.round, (byRound.get(b.round) ?? 0) + 1);
    expect([...byRound.values()].every((n) => n === D.bombs.easy.count)).toBe(true);
    for (const b of bombs) {
      expect(b.vx === 0 && b.vy === 0).toBe(true);
      expect(b.radius).toBe(D.bombs.easy.radius);
      expect(b.activeAt - b.landAt).toBeCloseTo(D.bombs.easy.fuseSec);
    }
    const cones = partsSeen(many('squirrels', 0, { attack: 'pinecones' })).filter(
      (p) => p.kind === 'pinecone',
    );
    const perRound = new Map<number, number>();
    for (const c of cones) perRound.set(c.round, (perRound.get(c.round) ?? 0) + 1);
    for (const n of perRound.values()) {
      expect(n).toBeGreaterThanOrEqual(D.pinecones.easyColumns[0]);
      expect(n).toBeLessThanOrEqual(D.pinecones.easyColumns[1]);
    }
  });

  it('bombs sit still at Level 1 and roll from Level 2; the blast reaches its radius', () => {
    const sits = partsSeen(many('squirrels', 1, { attack: 'bombs' })).filter(
      (p) => p.kind === 'bomb',
    );
    expect(sits.every((p) => p.kind === 'bomb' && p.vx === 0 && p.vy === 0)).toBe(true);
    const rolls = partsSeen(many('squirrels', 2, { attack: 'bombs' })).filter(
      (p) => p.kind === 'bomb',
    );
    expect(rolls.some((p) => p.kind === 'bomb' && (p.vx !== 0 || p.vy !== 0))).toBe(true);
    expect(rolls.every((p) => p.kind === 'bomb' && p.radius === D.bombs.radius)).toBe(true);
  });
});

describe('the box and the sprite', () => {
  const inside = (s: DodgeState) => {
    const e = edges(effectiveBox(s));
    return (
      s.pos.x >= e.left + 5 - 1e-6 &&
      s.pos.x <= e.right - 5 + 1e-6 &&
      s.pos.y >= e.top + 6 - 1e-6 &&
      s.pos.y <= e.bottom - 6 + 1e-6
    );
  };

  it('a bear hug squeezes the walls in, and the sprite is never left outside', () => {
    let squeezedTo = Infinity;
    play(
      many('bear', 2, { attack: 'hug' }),
      (s) => {
        squeezedTo = Math.min(squeezedTo, effectiveBox(s).w);
        expect(inside(s)).toBe(true);
      },
      (t) => ({ x: Math.sign(Math.sin(t * 0.7)) || 1, y: 0 }),
    );
    expect(squeezedTo).toBeCloseTo(D.animals.bear.box[0] * D.hug.width, 0);
  });

  it('the sword bear’s shrinking box and the Stampede’s changing box never leave the sprite outside', () => {
    for (const animal of ['swordBear', 'stampede'] as const) {
      play(
        many(animal, 3),
        (s) => expect(inside(s)).toBe(true),
        (t) => ({ x: Math.sign(Math.sin(t * 0.5)) || 1, y: Math.sign(Math.cos(t * 0.4)) || 1 }),
      );
    }
  });

  it('honey puddles slow the sprite and never count as a hit', () => {
    const base = { ...many('bear', 3), nextAttackAt: Infinity };
    const puddle: Part = {
      kind: 'puddle',
      id: 1,
      round: 0,
      warnAt: 0,
      activeAt: 0,
      child: true,
      x: base.pos.x,
      y: base.pos.y,
      rx: 200,
      ry: 200,
      until: 100,
    };
    const moved = (s0: DodgeState) => {
      let s = s0;
      for (let i = 0; i < 15; i++) s = step(s, DT, { x: 1, y: 0 });
      return s.pos.x - s0.pos.x;
    };
    const free = moved(base);
    const sticky = moved({ ...base, parts: [puddle] });
    expect(sticky).toBeCloseTo(free * D.honey.slow);
    let s: DodgeState = { ...base, parts: [puddle] };
    for (let i = 0; i < 120; i++) s = step(s, DT, STILL);
    expect(Object.values(s.hits).every((n) => n === 0)).toBe(true);
  });
});

describe('the Wild Predator Stampede', () => {
  it('is the tier’s length plus 10 s by default, and the Length setting still wins', () => {
    for (const tier of TIERS) {
      expect(newDodge({ animal: 'stampede', tier }, FOUR, 1).lengthSec).toBe(
        D.tiers[tier].lengthSec + D.stampede.extraSec,
      );
    }
    expect(newDodge({ animal: 'stampede', tier: 2, lengthSec: 15 }, FOUR, 1).lengthSec).toBe(15);
  });

  it('the head and the box follow whoever is attacking; no animal more than twice in a row', () => {
    const attackers: string[] = [];
    play(many('stampede', 2), (s, prev) => {
      if (s.roundNo !== prev.roundNo) {
        const who = s.rounds.at(-1)!.attacker;
        attackers.push(who);
        expect(s.showing).toContain(who);
        if (s.starts.at(-1)!.overlapped) {
          // Overlapping: the box stays where it was going.
          expect(s.boxMove.to).toEqual(prev.boxMove.to);
        } else {
          expect(s.boxMove.to.w).toBeCloseTo(
            who === 'swordBear' && s.shrunk ? D.sword.shrunk[0] : boxFor(who).w,
          );
          expect(s.boxMove.to.cy).toBeCloseTo(boxFor(who).cy);
        }
      }
    });
    expect(new Set(attackers).size).toBeGreaterThan(3);
    for (let i = 2; i < attackers.length; i++) {
      expect(attackers[i] === attackers[i - 1] && attackers[i] === attackers[i - 2]).toBe(false);
    }
  });

  it('overlapping attacks usually come from another animal', () => {
    let overlaps = 0;
    let others = 0;
    for (let seed = 1; seed <= 4; seed++) {
      play(
        newDodge({ animal: 'stampede', tier: 5, lives: 3, lengthSec: 60 }, FOUR, seed),
        (s, prev) => {
          if (s.roundNo === prev.roundNo || !s.starts.at(-1)!.overlapped) return;
          overlaps++;
          const who = s.rounds.at(-1)!.attacker;
          if (prev.rounds.every((r) => r.attacker !== who)) others++;
        },
      );
    }
    expect(overlaps).toBeGreaterThan(10);
    expect(others / overlaps).toBeGreaterThan(0.6);
  });

  it('with the Attack picker on Herd rush (only one animal), there are no overlaps', () => {
    let most = 0;
    play(
      newDodge({ animal: 'stampede', tier: 5, attack: 'herd', lives: 3, lengthSec: 60 }, FOUR, 3),
      (s) => {
        most = Math.max(most, s.rounds.length);
      },
    );
    expect(most).toBe(1);
  });
});

describe('a fuzz run', () => {
  it.each(
    ANIMAL_IDS.flatMap((a) => TIERS.flatMap((t) => [true, false].map((i) => [a, t, i] as const))),
  )(
    '%s, Tier %i, Claude’s ideas %s: it always ends, and nothing goes off the map',
    (animal, tier, ideas) => {
      const end = play(newDodge({ animal, tier, ideas, lives: 3 }, FOUR, 11), (s) => {
        expect(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y)).toBe(true);
        for (const sh of hitShapes(s)) {
          const values = Object.values(sh).flatMap((v) =>
            Array.isArray(v) ? v.flatMap((q: { x: number; y: number }) => [q.x, q.y]) : [v],
          );
          expect(values.every((v) => typeof v === 'string' || Number.isFinite(v))).toBe(true);
        }
      });
      expect(end.over).toBe(true);
      expect(end.time).toBeLessThanOrEqual(end.lengthSec + DT);
    },
  );
});
