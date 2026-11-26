/**
 * Dodge tuning and the Woods Monster (docs/design/12-minigames-dodge.md,
 * section 14): tiers and levels, pacing and overlaps (only at Tier V),
 * warnings on every side, bees by level, claw facing, the 3-second hug,
 * Stalk and the Zigzag dash, the Wave and the scurry's nuts, the Woods
 * Monster, and the portraits.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TIERS, type Tier } from '../types';
import {
  ANIMAL_IDS,
  animalsAt,
  boxFor,
  levelFor,
  pickAnimal,
  PORTRAITS,
  type LevelPick,
  type Rank,
} from './animals';
import { CLAW_TIP, clawsAt, clawShape, clawTurn } from './attacks/bear';
import { armAt, glareBeam, monsterEyes } from './attacks/monster';
import { stalkAt } from './attacks/bobcat';
import { edges, HUD, markSpot, SCREEN, type Box } from './geometry';
import { ATTACKS } from './library';
import { seedRng } from '../../engine/rng';
import { effectiveBox, newDodge, step, type DodgeOptions, type DodgeState } from './logic';
import type { AnimalId, AttackId, Part } from './types';

const D = BALANCE.minigames.dodge;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const DT = 1 / 60;
const LEVELS: readonly (1 | 2 | 3)[] = [1, 2, 3];
const pick = (r: Rank): LevelPick => (r === 0 ? 'easy' : r);

const wander = (t: number) => ({ x: Math.sin(t * 1.3), y: Math.cos(t * 0.9) });

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

/** A game at a level (Easy is 0), at Tier IV (no overlaps) unless `extra` says otherwise. */
const game = (animal: AnimalId, level: Rank, extra: Partial<DodgeOptions> = {}, seed = 7) =>
  newDodge({ animal, tier: 4, level: pick(level), lives: 3, lengthSec: 60, ...extra }, FOUR, seed);

/** A game at a tier, its level by the tier (Auto). */
const atTier = (animal: AnimalId, tier: Tier, extra: Partial<DodgeOptions> = {}, seed = 7) =>
  newDodge({ animal, tier, lives: 3, lengthSec: 60, ...extra }, FOUR, seed);

/** The rounds that hold up the next attack (a changer past its warning doesn't). */
const holding = (s: DodgeState) =>
  s.rounds.filter((r) => !(r.kind === 'changer' && s.time >= r.calmAt)).length;

/** Every part that showed up, the first time it was seen. */
function partsSeen(s0: DodgeState): Part[] {
  const seen = new Map<number, Part>();
  play(s0, (s) => {
    for (const p of s.parts) if (!seen.has(p.id)) seen.set(p.id, p);
  });
  return [...seen.values()];
}

const kindOf = (id: AttackId) => ATTACKS[id].kind;

describe('tiers and levels', () => {
  it('each tier offers only the animals in the table, at their level; the Woods Monster is always Level 3', () => {
    expect(animalsAt(1).sort()).toEqual(['bees', 'squirrels']);
    expect(animalsAt(2).sort()).toEqual(['ants', 'bear', 'bees', 'bobcat', 'squirrels']);
    expect(animalsAt(3)).toHaveLength(9);
    // Nov 26: Ants from Tier II, Bear with a Gun from Tier III (his first tier, Level 2).
    expect(levelFor('ants', 2)).toBe(1);
    expect(levelFor('gunBear', 3)).toBe(2);
    expect(animalsAt(1)).not.toContain('gunBear');
    expect(animalsAt(2)).not.toContain('gunBear');
    expect(levelFor('bees', 1)).toBe(0);
    expect(levelFor('squirrels', 1)).toBe(0);
    expect(levelFor('bear', 2)).toBe(1);
    expect(levelFor('swordBear', 3)).toBe(2);
    expect(levelFor('stampede', 4)).toBe(3);
    for (const tier of TIERS) {
      expect(levelFor('monster', tier)).toBe(3);
      expect(atTier('monster', tier).level).toBe(3);
    }
    // Not in the table at a tier (testing only): its lowest level.
    expect(levelFor('bear', 1)).toBe(1);
    expect(levelFor('swordBear', 1)).toBe(2);
    // The Level setting overrides; Easy only for Bees and the Squirrel Army.
    expect(atTier('bear', 1, { level: 3 }).level).toBe(3);
    expect(atTier('bear', 1, { level: 'easy' }).easy).toBe(false);
    expect(atTier('bees', 5, { level: 'easy' }).easy).toBe(true);
  });

  it('a random animal for a tier comes from the weights, never the Woods Monster', () => {
    for (const tier of TIERS) {
      const rng = seedRng(tier * 101);
      const counts = new Map<AnimalId, number>();
      for (let k = 0; k < 2000; k++) {
        const a = pickAnimal(rng, tier);
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
      expect(counts.has('monster')).toBe(false);
      for (const a of counts.keys()) expect(D.weights[tier][a]).toBeGreaterThan(0);
      const total = Object.values(D.weights[tier]).reduce<number>((x, y) => x + (y ?? 0), 0);
      for (const [a, n] of counts)
        expect(n / 2000).toBeCloseTo((D.weights[tier][a] ?? 0) / total, 1);
    }
  });

  it('the length goes by tier, the speed and gap by level', () => {
    for (const tier of TIERS) expect(atTier('bees', tier).lengthSec).toBe(60);
    for (const tier of TIERS)
      expect(newDodge({ animal: 'bear', tier }, FOUR, 1).lengthSec).toBe(D.tiers[tier].lengthSec);
    expect(game('bees', 0).speed).toBe(D.levels[0].speed);
    for (const level of LEVELS) expect(game('bear', level).speed).toBe(D.levels[level].speed);
  });
});

describe('pacing and overlaps', () => {
  it.each([0, 1, 2, 3] as const)(
    'Level %i: each attack starts the level’s gap after the last ones end',
    (level) => {
      let emptiedAt: number | null = null;
      let checked = 0;
      const gap = D.levels[level].gapSec;
      play(game('bees', level), (s, prev) => {
        if (prev.rounds.length > 0 && s.rounds.length === 0) emptiedAt = s.time;
        if (s.starts.length > prev.starts.length) {
          expect(s.starts.at(-1)!.overlapped).toBe(false);
          if (emptiedAt !== null) {
            expect(s.time - emptiedAt).toBeGreaterThanOrEqual(gap - 1e-9);
            expect(s.time - emptiedAt).toBeLessThanOrEqual(gap + DT + 1e-9);
            checked++;
          }
          emptiedAt = null;
        }
      });
      expect(checked).toBeGreaterThan(5);
    },
  );

  it('below Tier V, attacks never overlap (every animal, Auto)', () => {
    for (const animal of ANIMAL_IDS) {
      for (const tier of [1, 2, 3, 4] as const) {
        const end = play(atTier(animal, tier, {}, tier * 7));
        expect(end.starts.length).toBeGreaterThan(5);
        expect(end.starts.some((x) => x.overlapped)).toBe(false);
      }
    }
  });

  it('never two area attacks or two changers at once, and never more than the tier allows', () => {
    for (const animal of ['stampede', 'bear', 'swordBear', 'monster'] as const) {
      for (const tier of TIERS) {
        for (const overlaps of ['auto', 'on'] as const) {
          const s0 = atTier(animal, tier, { overlaps, lengthSec: 30 });
          let most = 0;
          play(s0, (s) => {
            const areas = s.rounds.filter((r) => r.kind === 'area').length;
            const changers = s.rounds.filter((r) => r.kind === 'changer').length;
            expect(areas).toBeLessThanOrEqual(1);
            expect(changers + (s.shrunk ? 1 : 0)).toBeLessThanOrEqual(1);
            expect(holding(s)).toBeLessThanOrEqual(s0.maxAtOnce);
            most = Math.max(most, holding(s));
          });
          if (overlaps === 'on') expect(most).toBe(s0.maxAtOnce);
          if (overlaps === 'auto' && tier < 5) expect(most).toBe(1);
        }
      }
    }
  }, 30_000);

  it('overlaps only at Tier V (about its chance), never when off, and never with one attack picked', () => {
    const share = (tier: Tier, extra: Partial<DodgeOptions> = {}) => {
      let starts = 0;
      let overlapped = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const end = play(atTier('bees', tier, extra, seed));
        starts += end.starts.length;
        overlapped += end.starts.filter((x) => x.overlapped).length;
      }
      return overlapped / starts;
    };
    for (const tier of [1, 2, 3, 4] as const) expect(share(tier)).toBe(0);
    const t5 = share(5);
    expect(t5).toBeGreaterThan(0.3);
    expect(share(5, { overlaps: 'on' })).toBeGreaterThan(t5);
    expect(share(2, { overlaps: 'on' })).toBeGreaterThan(0.3);
    expect(share(5, { overlaps: 'off' })).toBe(0);
    expect(share(5, { attack: 'lane' })).toBe(0);
    expect(share(5, { attack: 'lane', overlaps: 'on' })).toBe(0);
  });

  it('every attack has a kind, as in the design', () => {
    expect(kindOf('sweep')).toBe('area');
    expect(kindOf('shout')).toBe('area');
    expect(kindOf('fire')).toBe('area');
    expect(kindOf('herd')).toBe('area');
    expect(kindOf('claws')).toBe('missile');
    expect(kindOf('wave')).toBe('missile');
    expect(kindOf('hands')).toBe('missile');
    expect(kindOf('hug')).toBe('changer');
    expect(kindOf('darkness')).toBe('changer');
    // Bear with a Gun and Ants (Nov 26).
    expect(kindOf('aimedShot')).toBe('missile');
    expect(kindOf('rapidFire')).toBe('missile');
    expect(kindOf('ricochet')).toBe('missile');
    expect(kindOf('snipe')).toBe('changer');
    expect(kindOf('traps')).toBe('changer');
    expect(kindOf('quickDraw')).toBe('area');
    expect(kindOf('marching')).toBe('missile');
    expect(kindOf('antMill')).toBe('missile');
    expect(kindOf('leafcutter')).toBe('missile');
    expect(kindOf('crumbRush')).toBe('missile');
    expect(kindOf('fireAnts')).toBe('area');
    expect(kindOf('antHill')).toBe('changer');
  });
});

describe('warnings', () => {
  it('every box keeps at least 12 units from both HUDs', () => {
    const boxes: Box[] = Object.values(D.animals).map((a) => ({
      cx: a.at[0],
      cy: a.at[1],
      w: a.box[0],
      h: a.box[1],
    }));
    for (const b of boxes) {
      const e = edges(b);
      expect(e.top - HUD.top).toBeGreaterThanOrEqual(D.hudGap);
      expect(HUD.bottom - e.bottom).toBeGreaterThanOrEqual(D.hudGap);
    }
  });

  /** A marker is visible: on screen, clear of both HUDs, and next to the box. */
  const visible = (p: { x: number; y: number }, box: Box) => {
    const e = edges(box);
    const h = 3.5;
    const onScreen =
      p.x - h >= 0 && p.x + h <= SCREEN.w && p.y - h >= HUD.top && p.y + h <= HUD.bottom;
    const dx = Math.max(e.left - p.x, 0, p.x - e.right);
    const dy = Math.max(e.top - p.y, 0, p.y - e.bottom);
    return onScreen && Math.hypot(dx, dy) <= 9;
  };

  /** A level each bee pattern plays at. */
  const BEE_LEVEL = {
    single: 0,
    pairs: 0,
    lane: 2,
    cross: 2,
    zigzag: 2,
    diagonal: 3,
    aimed: 3,
  } as const;

  it.each(['single', 'pairs', 'lane', 'cross', 'diagonal', 'zigzag', 'aimed'] as const)(
    'every %s bee’s "!" shows next to the box, on every side, never under a HUD',
    (pattern) => {
      const sides = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const s0 = game('bees', BEE_LEVEL[pattern], { attack: pattern, lengthSec: 15 }, seed);
        expect(s0.only).toBe(pattern);
        for (const p of partsSeen(s0)) {
          if (p.kind !== 'bee') continue;
          const at = markSpot(p.mark, s0.box);
          expect(visible(at, s0.box), `${pattern} ${JSON.stringify(p.mark)}`).toBe(true);
          const e = edges(s0.box);
          sides.add(
            p.mark.y > e.bottom
              ? 'bottom'
              : p.mark.y < e.top
                ? 'top'
                : p.mark.x < e.left
                  ? 'left'
                  : 'right',
          );
        }
      }
      if (pattern === 'cross') expect([...sides].sort()).toEqual(['left', 'top']);
      if (pattern !== 'cross' && pattern !== 'zigzag') expect(sides.has('bottom')).toBe(true);
    },
  );

  it('a marker that would sit under a HUD or off the screen moves just inside the box edge', () => {
    const box = boxFor('bees');
    const e = edges(box);
    expect(markSpot({ x: 150, y: e.bottom + 5 }, box)).toMatchObject({
      y: e.bottom + 5,
      inside: false,
    });
    const under = markSpot({ x: 150, y: 220 }, box);
    expect(under.inside).toBe(true);
    expect(under.y).toBeCloseTo(e.bottom - 4.5);
    expect(visible(under, box)).toBe(true);
    const off = markSpot({ x: -10, y: 300 }, box);
    expect(off).toMatchObject({ x: e.left + 4.5, y: e.bottom - 4.5, inside: true });
  });
});

describe('bees', () => {
  /** When each bee of each round sets off, by round. */
  const startsOf = (level: Rank, attack: AttackId) => {
    const byRound = new Map<number, number[]>();
    for (const p of partsSeen(game('bees', level, { attack, lengthSec: 20 })))
      if (p.kind === 'bee') byRound.set(p.round, [...(byRound.get(p.round) ?? []), p.warnAt]);
    expect(byRound.size).toBeGreaterThan(2);
    return [...byRound.values()].map((list) => list.sort((a, b) => a - b));
  };

  it.each([0, 1] as const)(
    'Level %i: One at a time sends its bees one by one, aimed, well apart',
    (level) => {
      const every = D.bees.single.everySec[level];
      for (const starts of startsOf(level, 'single')) {
        expect(starts.length).toBeGreaterThanOrEqual(D.bees.single.bees[0]);
        expect(starts.length).toBeLessThanOrEqual(D.bees.single.bees[1]);
        for (let i = 1; i < starts.length; i++)
          expect(starts[i]! - starts[i - 1]!).toBeCloseTo(every);
      }
      const bees = partsSeen(game('bees', level, { attack: 'single', lengthSec: 8 })).filter(
        (p): p is Extract<Part, { kind: 'bee' }> => p.kind === 'bee',
      );
      expect(bees.every((b) => b.aimSpeed !== undefined)).toBe(true);
      if (level === 0) expect(bees.every((b) => b.aimSpeed === D.bees.single.easySpeed)).toBe(true);
    },
  );

  it('Easy: Pairs send two bees, one after the other', () => {
    for (const starts of startsOf(0, 'pairs')) {
      expect(starts).toHaveLength(2);
      expect(starts[1]! - starts[0]!).toBeCloseTo(D.bees.pairs.everySec);
    }
  });

  it.each([1, 2] as const)(
    'Level %i: a Lane comes in staggered, within the level’s stagger',
    (level) => {
      const L = D.bees.lane[level];
      for (const starts of startsOf(level, 'lane')) {
        expect(starts.length).toBeGreaterThanOrEqual(L.bees[0]);
        expect(starts.length).toBeLessThanOrEqual(L.bees[1]);
        expect(new Set(starts).size).toBe(starts.length);
        expect(starts.at(-1)! - starts[0]!).toBeLessThanOrEqual(L.staggerSec);
      }
    },
  );

  it('full rows only at Level 3: every bee in a Lane or a Cross sets off at once', () => {
    for (const attack of ['lane', 'cross'] as const) {
      for (const starts of startsOf(3, attack)) expect(new Set(starts).size).toBe(1);
    }
    for (const starts of startsOf(2, 'cross')) expect(new Set(starts).size).toBeGreaterThan(1);
  });

  it('Level 3: the Aimed swarm sends its bees all at once, aimed', () => {
    for (const starts of startsOf(3, 'aimed')) {
      expect(starts).toHaveLength(D.bees.aimed.bees);
      expect(new Set(starts).size).toBe(1);
    }
  });
});

describe('claws', () => {
  const claws = (animal: AnimalId, level: 1 | 2 | 3) =>
    partsSeen(game(animal, level, { attack: 'claws', lengthSec: 20 })).filter(
      (p): p is Extract<Part, { kind: 'claws' }> => p.kind === 'claws',
    );

  it('are never upside down: each claw points its tip along its path, whatever way it swings', () => {
    let checked = 0;
    for (const animal of ['bear', 'swordBear', 'bobcat'] as const) {
      for (const level of LEVELS) {
        for (const p of claws(animal, level)) {
          for (let k = 0; k <= 8; k++) {
            const t = p.activeAt + ((p.endAt - p.activeAt) * k) / 8;
            for (const c of clawsAt(p, t)) {
              // Turning the sprite's tip (rotation only) lands it on the claw's direction.
              const a = CLAW_TIP + (clawTurn(c.dir) * Math.PI) / 180;
              expect(Math.cos(a)).toBeCloseTo(c.dir.x, 6);
              expect(Math.sin(a)).toBeCloseTo(c.dir.y, 6);
              // Its hitbox lies along its path too.
              const sh = clawShape(c, p.length, p.thickness);
              if (sh.kind !== 'segment') throw new Error('a claw is a segment');
              const along = (sh.x2 - sh.x1) * c.dir.x + (sh.y2 - sh.y1) * c.dir.y;
              expect(along).toBeCloseTo(p.length, 6);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it.each(LEVELS)(
    'Level %i: every Claws attack sends its rows, all curved, from different corners',
    (level) => {
      const byRound = new Map<number, Extract<Part, { kind: 'claws' }>[]>();
      for (const p of claws('bear', level))
        byRound.set(p.round, [...(byRound.get(p.round) ?? []), p]);
      expect(byRound.size).toBeGreaterThan(2);
      for (const rows of byRound.values()) {
        expect(rows).toHaveLength(D.claws.rows[level]);
        expect(rows.every((r) => r.count === D.claws.count[level])).toBe(true);
        const pivots = new Set(
          rows.map((r) => `${Math.sign(r.path.cx - 160)},${Math.sign(r.path.cy - 141)}`),
        );
        expect(pivots.size).toBe(rows.length);
        const gaps = rows.map((r) => r.warnAt).sort((a, b) => a - b);
        for (let i = 1; i < gaps.length; i++)
          expect(gaps[i]! - gaps[i - 1]!).toBeCloseTo(D.claws.rowGapSec);
      }
    },
  );

  it('Bobcat claws are faster, with a shorter warning', () => {
    const bear = claws('bear', 1)[0]!;
    const cat = claws('bobcat', 1)[0]!;
    expect(Math.abs(cat.path.w * cat.path.r)).toBeCloseTo(
      Math.abs(bear.path.w * bear.path.r) * D.claws.bobcat.speed,
    );
    expect(cat.activeAt - cat.warnAt).toBeCloseTo(D.claws.bobcat.warnSec);
  });

  it('Bear with a Sword’s sword attacks sometimes bring a row of claws, but not with one attack picked', () => {
    const rows = (extra: Partial<DodgeOptions>) =>
      partsSeen(game('swordBear', 3, extra)).filter((p) => p.kind === 'claws').length;
    expect(rows({ attack: 'sweep' })).toBe(0);
    const withClaws = partsSeen(game('swordBear', 3));
    const swordRounds = new Set(
      withClaws
        .filter(
          (p) => p.kind === 'swing' || p.kind === 'jab' || p.kind === 'poke' || p.kind === 'wave',
        )
        .map((p) => p.round),
    );
    const extra = withClaws.filter((p) => p.kind === 'claws' && swordRounds.has(p.round));
    expect(extra.length).toBeGreaterThan(0);
  });
});

describe('the bear', () => {
  it('a Bear hug lasts 3 s, and other attacks run during it', () => {
    let hugs = 0;
    let during = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let hug: Extract<Part, { kind: 'hug' }> | undefined;
      play(game('bear', 2, {}, seed), (s, prev) => {
        const h = s.parts.find((p): p is Extract<Part, { kind: 'hug' }> => p.kind === 'hug');
        if (h && h.id !== hug?.id) {
          hug = h;
          hugs++;
          expect(h.holdSec).toBe(3);
        }
        const on =
          hug && s.time > hug.activeAt && s.time < hug.activeAt + 2 * hug.squeezeSec + hug.holdSec;
        if (on && s.starts.length > prev.starts.length && s.starts.at(-1)!.attack !== 'hug')
          during++;
      });
    }
    expect(hugs).toBeGreaterThan(0);
    expect(during).toBeGreaterThan(hugs);
  });

  it('a Shout’s waves are small arcs aimed at where the sprite was', () => {
    const s0 = game('bear', 3, { attack: 'shout', lengthSec: 8 });
    let checked = 0;
    play(
      s0,
      (s, prev) => {
        if (s.starts.length === prev.starts.length) return;
        const waves = s.parts.filter(
          (p): p is Extract<Part, { kind: 'shout' }> =>
            p.kind === 'shout' && p.round === s.roundNo - 1,
        );
        const lead = waves[0]!;
        expect(waves.length).toBeGreaterThanOrEqual(D.shout.waves[0]);
        expect(lead.spread).toBeCloseTo((D.shout.spreadDeg * Math.PI) / 180);
        expect(lead.at).toBeCloseTo(Math.atan2(prev.pos.y - lead.cy, prev.pos.x - lead.cx), 1);
        checked++;
      },
      () => ({ x: 0, y: 0 }),
    );
    expect(checked).toBeGreaterThan(1);
  });
});

describe('the bobcat', () => {
  it.each(LEVELS)(
    'Level %i: Stalk aims each hop where the sprite is when its aim shows',
    (level) => {
      let hops = 0;
      play(game('bobcat', level, { attack: 'stalk', lengthSec: 15 }), (s, prev) => {
        for (const p of s.parts) {
          if (p.kind !== 'stalk') continue;
          expect(p.hops).toHaveLength(D.stalk.hops[level]);
          const before = prev.parts.find((q) => q.id === p.id);
          p.hops.forEach((h, k) => {
            const was = before?.kind === 'stalk' ? before.hops[k] : undefined;
            if (h.to && !was?.to) {
              hops++;
              const e = edges(s.box);
              const m = D.stalk.radius;
              expect(h.to.x).toBeCloseTo(Math.min(e.right - m, Math.max(e.left + m, s.pos.x)));
              expect(h.to.y).toBeCloseTo(Math.min(e.bottom - m, Math.max(e.top + m, s.pos.y)));
              expect(s.time).toBeGreaterThanOrEqual(h.aimAt);
              expect(s.time - h.aimAt).toBeLessThan(DT + 1e-9);
            }
          });
          // It lands where it aimed.
          const last = p.hops.findLast(
            (h) => h.to && s.time >= h.landAt && s.time < h.landAt + D.stalk.crouchSec,
          );
          if (last?.to) expect(stalkAt(p, s.time).at).toEqual(last.to);
        }
      });
      expect(hops).toBeGreaterThan(5);
    },
  );

  it.each([2, 3] as const)(
    'Level %i: the Zigzag dash bounces off the walls the right number of times',
    (level) => {
      const dashes = partsSeen(game('bobcat', level, { attack: 'dash', lengthSec: 15 })).filter(
        (p): p is Extract<Part, { kind: 'dash' }> => p.kind === 'dash',
      );
      expect(dashes.length).toBeGreaterThan(2);
      for (const d of dashes) {
        expect(d.passes).toHaveLength(D.dash.passes[level]);
        expect(d.bounces).toHaveLength(D.dash.passes[level] - 1);
        const e = edges(boxFor('bobcat'));
        for (const b of d.bounces) {
          const onWall = [b.x - e.left, e.right - b.x, b.y - e.top, e.bottom - b.y].some(
            (v) => Math.abs(v) < 1e-3,
          );
          expect(onWall).toBe(true);
        }
        // Sharp turns: legs about as long as the design says.
        const legs = d.path
          .slice(2, -2)
          .map((q, i, all) =>
            i ? Math.hypot(q.x - all[i - 1]!.x, q.y - all[i - 1]!.y) : D.dash.leg,
          );
        expect(Math.max(...legs)).toBeLessThan(D.dash.leg * 1.5);
      }
    },
  );
});

describe('the sword bear’s Wave and the squirrels’ nuts', () => {
  it.each(LEVELS)('Level %i: the Wave comes along the right walls', (tier) => {
    const waves = partsSeen(game('swordBear', tier, { attack: 'wave', lengthSec: 20 })).filter(
      (p): p is Extract<Part, { kind: 'wave' }> => p.kind === 'wave',
    );
    const byRound = new Map<number, string[]>();
    for (const w of waves) byRound.set(w.round, [...(byRound.get(w.round) ?? []), w.side]);
    const sides = new Set([...byRound.values()].map((x) => x.sort().join('+')));
    if (tier === 1) expect([...sides]).toEqual(['top']);
    if (tier === 2) expect([...sides].sort()).toEqual(['bottom', 'top']);
    if (tier === 3) expect([...sides]).toEqual(['bottom+top']);
  });

  it.each([2, 3] as const)('Level %i: Wall scurry squirrels flick nuts at the sprite', (tier) => {
    const seen = partsSeen(game('squirrels', tier, { attack: 'scurry', lengthSec: 15 }));
    const nuts = seen.filter((p) => p.kind === 'nut');
    expect(nuts.length).toBeGreaterThan(8);
    expect(nuts.every((n) => n.child)).toBe(true);
  });
});

describe('the Woods Monster', () => {
  it('always plays Level 3; only at Tier V does he overlap and get his boss boost', () => {
    for (const tier of [3, 4] as const) {
      const s = atTier('monster', tier);
      expect(s.level).toBe(3);
      expect(s.hudTier).toBe(tier);
      expect(s.boost).toBe(false);
      expect(s.speed).toBe(D.levels[3].speed);
      expect(s.overlapChance).toBe(0);
    }
    const t5 = atTier('monster', 5);
    expect(t5.boost).toBe(true);
    expect(t5.speed).toBeCloseTo(D.levels[3].speed * D.monster.boost.speed);
    expect(t5.overlapChance).toBeCloseTo(D.tiers[5].overlapChance + D.monster.boost.overlapChance);
    expect(t5.maxAtOnce).toBe(D.tiers[5].maxAtOnce + D.monster.boost.maxAtOnce);
    // At Level 3 his fire has the second set.
    const flames = partsSeen(atTier('monster', 3, { attack: 'fire', lengthSec: 6 })).filter(
      (p) => p.kind === 'flame',
    );
    expect(new Set(flames.map((p) => p.activeAt)).size).toBeGreaterThan(1);
  });

  it('lasts 40 s by default, and the Length setting still wins', () => {
    for (const tier of TIERS)
      expect(newDodge({ animal: 'monster', tier }, FOUR, 1).lengthSec).toBe(D.monster.lengthSec);
    expect(newDodge({ animal: 'monster', tier: 1, lengthSec: 20 }, FOUR, 1).lengthSec).toBe(20);
  });

  it('the second half shrinks the box over 1 s, with the sprite pushed inside, and Darkness only comes then', () => {
    // Plenty of lives, so it runs to the clock.
    const s0 = newDodge({ animal: 'monster', tier: 3, lives: 99 }, FOUR, 5);
    const half = s0.lengthSec / 2;
    const [w0, h0] = D.animals.monster.box;
    const [w1, h1] = D.monster.shrunk;
    let darkAt = Infinity;
    let checkedMid = false;
    play(
      s0,
      (s) => {
        const e = edges(effectiveBox(s));
        expect(s.pos.x).toBeGreaterThanOrEqual(e.left + 5 - 1e-6);
        expect(s.pos.x).toBeLessThanOrEqual(e.right - 5 + 1e-6);
        expect(s.pos.y).toBeGreaterThanOrEqual(e.top + 6 - 1e-6);
        expect(s.pos.y).toBeLessThanOrEqual(e.bottom - 6 + 1e-6);
        if (s.time < half - DT) expect(s.box.w).toBeCloseTo(w0);
        if (!checkedMid && s.time >= half + D.monster.shrinkSec / 2) {
          expect(s.box.w).toBeGreaterThan(w1 + 2);
          expect(s.box.w).toBeLessThan(w0 - 2);
          checkedMid = true;
        }
        if (s.time > half + D.monster.shrinkSec + DT) {
          expect(s.box.w).toBeCloseTo(w1);
          expect(s.box.h).toBeCloseTo(h1);
        }
        if (s.parts.some((p) => p.kind === 'dark')) darkAt = Math.min(darkAt, s.time);
      },
      // Pressed into a corner, so the shrinking walls push it.
      () => ({ x: 1, y: 1 }),
    );
    expect(h0).toBeGreaterThan(h1);
    expect(darkAt).toBeGreaterThanOrEqual(half);
    expect(darkAt).toBeLessThan(Infinity);
    // Picked alone, Darkness waits for the second half.
    let first = Infinity;
    play(newDodge({ animal: 'monster', tier: 3, attack: 'darkness', lives: 3 }, FOUR, 2), (s) => {
      if (s.parts.some((p) => p.kind === 'dark')) first = Math.min(first, s.time);
    });
    expect(first).toBeGreaterThanOrEqual(half);
    expect(first).toBeLessThan(half + 1.5);
  });

  it('his second half comes at every tier', () => {
    for (const tier of TIERS) {
      const end = play(newDodge({ animal: 'monster', tier, lives: 99 }, FOUR, 5));
      expect(end.secondHalf).toBe(true);
      expect(end.box.w).toBeCloseTo(D.monster.shrunk[0]);
    }
  });

  it('Glare only hits after the sprite stays in a beam a moment', () => {
    // Standing still while the beams sweep: hits come, but never twice within the hold.
    let hits = 0;
    let last = -Infinity;
    play(
      newDodge({ animal: 'monster', tier: 1, attack: 'glare', lives: 3, lengthSec: 20 }, FOUR, 3),
      (s, prev) => {
        const n = Object.values(s.hits).reduce((a, b) => a + b, 0);
        const was = Object.values(prev.hits).reduce((a, b) => a + b, 0);
        if (n > was) {
          expect(s.time - last).toBeGreaterThan(D.glare.holdSec);
          last = s.time;
          hits++;
        }
      },
      () => ({ x: 0, y: 0 }),
    );
    expect(hits).toBeGreaterThan(0);
  });

  it('Glare: his eyes warn first, then a beam from each eye sweeps across in opposite directions, crossing in the middle', () => {
    const glares = partsSeen(
      newDodge({ animal: 'monster', tier: 3, attack: 'glare', lives: 99, lengthSec: 12 }, FOUR, 4),
    ).filter((p): p is Extract<Part, { kind: 'glare' }> => p.kind === 'glare');
    expect(glares.length).toBeGreaterThan(1);
    const eyes = monsterEyes();
    for (const p of glares) {
      expect(p.activeAt - p.warnAt).toBeCloseTo(D.glare.warnSec);
      expect(p.eyes).toEqual(eyes);
      // Opposite directions: one goes left to right, the other right to left.
      expect(Math.sign(p.to[0] - p.from[0])).toBe(-Math.sign(p.to[1] - p.from[1]));
      expect(p.from[0]).toBeCloseTo(p.to[1]);
      const box = boxFor('monster');
      const mid = (t: number, k: 0 | 1) => {
        const b = glareBeam(p, box, t, k);
        if (b.kind !== 'triangle') throw new Error('a beam is a triangle');
        expect(b.points[2].x - b.points[1].x).toBeCloseTo(D.glare.floorWidth);
        return (b.points[1].x + b.points[2].x) / 2;
      };
      const half = p.activeAt + p.sweepSec / 2;
      expect(mid(half, 0)).toBeCloseTo(mid(half, 1));
      expect(mid(half, 0)).toBeCloseTo(box.cx);
    }
  });

  it('Long arms: four thrusts taking turns between the arms, each winding up aimed at the sprite first', () => {
    const arms = partsSeen(
      newDodge({ animal: 'monster', tier: 3, attack: 'arms', lives: 99, lengthSec: 10 }, FOUR, 6),
    ).filter((p): p is Extract<Part, { kind: 'arm' }> => p.kind === 'arm');
    const byRound = new Map<number, Extract<Part, { kind: 'arm' }>[]>();
    for (const a of arms) byRound.set(a.round, [...(byRound.get(a.round) ?? []), a]);
    expect(byRound.size).toBeGreaterThan(0);
    for (const list of byRound.values()) {
      expect(list).toHaveLength(D.arms.thrusts);
      list.sort((a, b) => a.warnAt - b.warnAt);
      list.forEach((a, k) => {
        expect(a.activeAt - a.warnAt).toBeCloseTo(D.arms.windSec);
        expect(a.grabAt - a.activeAt).toBeCloseTo(D.arms.thrustSec);
        expect(a.pullAt - a.grabAt).toBeCloseTo(D.arms.grabSec);
        expect(a.endAt - a.pullAt).toBeCloseTo(D.arms.pullSec);
        if (k) {
          // Alternating arms; the next winds up as the last one thrusts, and an arm is back before its next turn.
          expect(a.side).toBe(-list[k - 1]!.side);
          expect(a.warnAt).toBeGreaterThanOrEqual(list[k - 1]!.activeAt - 1e-9);
          if (k >= 2) expect(a.warnAt).toBeGreaterThanOrEqual(list[k - 2]!.endAt - 1e-9);
        }
      });
    }
  });

  it('Long arms: the thrust reaches where the sprite was as the wind-up started, and hits there', () => {
    let s = newDodge(
      { animal: 'monster', tier: 3, attack: 'arms', lives: 99, lengthSec: 10 },
      FOUR,
      8,
    );
    let checked = 0;
    for (let i = 0; i < 60 * 6; i++) {
      const prev = s;
      s = step(s, DT, { x: 0, y: 0 });
      for (const p of s.parts) {
        if (p.kind !== 'arm') continue;
        const was = prev.parts.find((q) => q.id === p.id);
        if (p.target && was?.kind === 'arm' && !was.target) {
          expect(p.target).toEqual(prev.pos);
          expect(s.time).toBeGreaterThanOrEqual(p.warnAt);
        }
        if (p.target && s.time > p.grabAt && s.time < p.pullAt) {
          expect(armAt(p, s.time).hand).toEqual(p.target);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
    expect(Object.values(s.hits).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

describe('a fuzz run with every Overlaps setting', () => {
  it.each(
    (
      [
        'bees',
        'bear',
        'swordBear',
        'bobcat',
        'squirrels',
        'gunBear',
        'ants',
        'stampede',
        'monster',
      ] as const
    ).flatMap((a) => (['off', 'on'] as const).map((o) => [a, o] as const)),
  )(
    '%s with overlaps %s on Tier V: it always ends, with nothing off the map',
    (animal, overlaps) => {
      const end = play(newDodge({ animal, tier: 5, overlaps, lives: 3 }, FOUR, 13), (s) => {
        expect(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y)).toBe(true);
        for (const p of s.parts) {
          if ('x' in p) expect(Number.isFinite(p.x)).toBe(true);
        }
      });
      expect(end.over).toBe(true);
    },
  );
});

describe('the portraits', () => {
  /** The portrait files, inlined (data URLs), and a PNG's size from its header. */
  const files = import.meta.glob<string>('/public/assets/minigames/dodge/portraits/*/*.png', {
    eager: true,
    query: '?inline',
    import: 'default',
  });
  const size = (file: string) => {
    const url = files[`/public/assets/minigames/dodge/portraits/${file}`];
    if (!url) throw new Error(`missing ${file}`);
    const bytes = atob(url.slice(url.indexOf(',') + 1));
    const word = (at: number) =>
      [0, 1, 2, 3].reduce((n, k) => n * 256 + bytes.charCodeAt(at + k), 0);
    return { w: word(16), h: word(20) };
  };

  it('their sizes match the art (Solid + red only), blink and bob frames included', () => {
    expect(Object.keys(files).every((f) => f.includes('/solid-red/'))).toBe(true);
    const flying = Object.keys(D.portraits.float);
    for (const [who, p] of Object.entries(PORTRAITS)) {
      const frames = flying.includes(who) ? ['', '-blink'] : ['', '-blink', '-bob', '-bob-blink'];
      for (const f of frames) {
        expect(size(`solid-red/${p.file}${f}.png`)).toEqual({ w: p.w, h: p.h });
      }
    }
  });

  it('each sits a gap above its box and never reaches above the line (the box moves down instead)', () => {
    for (const who of [
      'bees',
      'bear',
      'swordBear',
      'bobcat',
      'squirrels',
      'herd',
      'monster',
      'gunBear',
      'ants',
    ] as const) {
      const box = boxFor(who);
      const top = box.cy - box.h / 2 - D.portraits.gap - PORTRAITS[who].h;
      expect(top).toBeGreaterThanOrEqual(D.portraits.minTop - 1e-9);
      const at = D.animals[who].at[1];
      // Moved only as far as needed.
      if (box.cy > at) expect(top).toBeCloseTo(D.portraits.minTop);
    }
    expect(boxFor('squirrels').cy).toBeGreaterThan(D.animals.squirrels.at[1]);
    expect(boxFor('bees').cy).toBe(D.animals.bees.at[1]);
  });
});
