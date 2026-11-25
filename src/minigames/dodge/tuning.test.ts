/**
 * Dodge tuning and the Woods Monster (docs/design/12-minigames-dodge.md,
 * section 14, third pass): pacing and overlaps, warnings on every side,
 * staggered bees, claw facing, the 3-second hug, Stalk and the Zigzag dash,
 * the Wave and the scurry's nuts, and the Woods Monster.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { boxFor } from './animals';
import { CLAW_TIP, clawsAt, clawShape, clawTurn } from './attacks/bear';
import { stalkAt } from './attacks/bobcat';
import { edges, HUD, markSpot, SCREEN, type Box } from './geometry';
import { ATTACKS } from './library';
import { effectiveBox, newDodge, step, type DodgeOptions, type DodgeState } from './logic';
import type { AnimalId, AttackId, Part, Tier } from './types';

const D = BALANCE.minigames.dodge;
const FOUR = ['finn', 'mom', 'ellie', 'wyatt'];
const DT = 1 / 60;
const TIERS: readonly Tier[] = [1, 2, 3];

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

const game = (animal: AnimalId, tier: Tier, extra: Partial<DodgeOptions> = {}, seed = 7) =>
  newDodge({ animal, tier, lives: 3, lengthSec: 60, ...extra }, FOUR, seed);

/** Every part that showed up, the first time it was seen. */
function partsSeen(s0: DodgeState): Part[] {
  const seen = new Map<number, Part>();
  play(s0, (s) => {
    for (const p of s.parts) if (!seen.has(p.id)) seen.set(p.id, p);
  });
  return [...seen.values()];
}

const kindOf = (id: AttackId) => ATTACKS[id].kind;

describe('pacing and overlaps', () => {
  it.each(TIERS)(
    'Tier %i with overlaps off: each attack starts the tier’s gap after the last ones end',
    (tier) => {
      let emptiedAt: number | null = null;
      let checked = 0;
      play(game('bees', tier, { overlaps: 'off' }), (s, prev) => {
        if (prev.rounds.length > 0 && s.rounds.length === 0) emptiedAt = s.time;
        if (s.starts.length > prev.starts.length) {
          expect(s.starts.at(-1)!.overlapped).toBe(false);
          if (emptiedAt !== null) {
            expect(s.time - emptiedAt).toBeGreaterThanOrEqual(D.tiers[tier].gapSec - 1e-9);
            expect(s.time - emptiedAt).toBeLessThanOrEqual(D.tiers[tier].gapSec + DT + 1e-9);
            checked++;
          }
          emptiedAt = null;
        }
      });
      expect(checked).toBeGreaterThan(5);
    },
  );

  it('never two area attacks or two changers at once, and never more than the tier allows', () => {
    for (const animal of ['stampede', 'bear', 'swordBear', 'monster'] as const) {
      for (const tier of TIERS) {
        for (const overlaps of ['auto', 'on'] as const) {
          const s0 = game(animal, tier, { overlaps });
          let most = 0;
          play(s0, (s) => {
            const areas = s.rounds.filter((r) => r.kind === 'area').length;
            const changers = s.rounds.filter((r) => r.kind === 'changer').length;
            expect(areas).toBeLessThanOrEqual(1);
            expect(changers + (s.shrunk ? 1 : 0)).toBeLessThanOrEqual(1);
            expect(s.rounds.length).toBeLessThanOrEqual(s0.maxAtOnce);
            most = Math.max(most, s.rounds.length);
          });
          if (overlaps === 'on') expect(most).toBe(s0.maxAtOnce);
        }
      }
    }
  });

  it('overlaps happen more on higher tiers, never when off, and never with one attack picked', () => {
    const share = (tier: Tier, extra: Partial<DodgeOptions> = {}) => {
      let starts = 0;
      let overlapped = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const end = play(game('bees', tier, extra, seed));
        starts += end.starts.length;
        overlapped += end.starts.filter((x) => x.overlapped).length;
      }
      return overlapped / starts;
    };
    const t1 = share(1);
    const t3 = share(3);
    expect(t1).toBeGreaterThan(0.1);
    expect(t3).toBeGreaterThan(t1 + 0.15);
    expect(share(3, { overlaps: 'on' })).toBeGreaterThan(t3);
    expect(share(3, { overlaps: 'off' })).toBe(0);
    expect(share(3, { attack: 'lane' })).toBe(0);
    expect(share(3, { attack: 'lane', overlaps: 'on' })).toBe(0);
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

  it.each(['lane', 'cross', 'diagonal', 'zigzag', 'aimed'] as const)(
    'every %s bee’s "!" shows next to the box, on every side, never under a HUD',
    (pattern) => {
      const sides = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const s0 = game('bees', 3, { attack: pattern, lengthSec: 15 }, seed);
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
      if (pattern === 'lane' || pattern === 'diagonal' || pattern === 'aimed')
        expect(sides.has('bottom')).toBe(true);
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
  it('in a Lane, the bees of one row start at different times, within the stagger', () => {
    const seen = partsSeen(game('bees', 1, { attack: 'lane', lengthSec: 20 }));
    const byRound = new Map<number, number[]>();
    for (const p of seen)
      if (p.kind === 'bee') byRound.set(p.round, [...(byRound.get(p.round) ?? []), p.warnAt]);
    expect(byRound.size).toBeGreaterThan(3);
    for (const starts of byRound.values()) {
      expect(new Set(starts).size).toBe(starts.length);
      expect(Math.max(...starts) - Math.min(...starts)).toBeLessThanOrEqual(D.bees.staggerSec);
    }
  });
});

describe('claws', () => {
  const claws = (animal: AnimalId, tier: Tier) =>
    partsSeen(game(animal, tier, { attack: 'claws', lengthSec: 20 })).filter(
      (p): p is Extract<Part, { kind: 'claws' }> => p.kind === 'claws',
    );

  it('are never upside down: each claw points its tip along its path, whatever way it swings', () => {
    let checked = 0;
    for (const animal of ['bear', 'swordBear', 'bobcat'] as const) {
      for (const tier of TIERS) {
        for (const p of claws(animal, tier)) {
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

  it.each(TIERS)(
    'Tier %i: every Claws attack sends its rows, all curved, from different corners',
    (tier) => {
      const byRound = new Map<number, Extract<Part, { kind: 'claws' }>[]>();
      for (const p of claws('bear', tier))
        byRound.set(p.round, [...(byRound.get(p.round) ?? []), p]);
      expect(byRound.size).toBeGreaterThan(2);
      for (const rows of byRound.values()) {
        expect(rows).toHaveLength(D.claws.rows[tier]);
        expect(rows.every((r) => r.count === D.claws.count[tier])).toBe(true);
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
    const withClaws = partsSeen(game('swordBear', 3, { overlaps: 'off' }));
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
  it.each(TIERS)('Tier %i: Stalk aims each hop where the sprite is when its aim shows', (tier) => {
    let hops = 0;
    play(game('bobcat', tier, { attack: 'stalk', lengthSec: 15 }), (s, prev) => {
      for (const p of s.parts) {
        if (p.kind !== 'stalk') continue;
        expect(p.hops).toHaveLength(D.stalk.hops[tier]);
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
  });

  it.each([2, 3] as const)(
    'Tier %i: the Zigzag dash bounces off the walls the right number of times',
    (tier) => {
      const dashes = partsSeen(game('bobcat', tier, { attack: 'dash', lengthSec: 15 })).filter(
        (p): p is Extract<Part, { kind: 'dash' }> => p.kind === 'dash',
      );
      expect(dashes.length).toBeGreaterThan(2);
      for (const d of dashes) {
        expect(d.passes).toHaveLength(D.dash.passes[tier]);
        expect(d.bounces).toHaveLength(D.dash.passes[tier] - 1);
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
  it.each(TIERS)('Tier %i: the Wave comes along the right walls', (tier) => {
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

  it.each([2, 3] as const)('Tier %i: Wall scurry squirrels flick nuts at the sprite', (tier) => {
    const seen = partsSeen(game('squirrels', tier, { attack: 'scurry', lengthSec: 15 }));
    const nuts = seen.filter((p) => p.kind === 'nut');
    expect(nuts.length).toBeGreaterThan(8);
    expect(nuts.every((n) => n.child)).toBe(true);
  });
});

describe('the Woods Monster', () => {
  it('plays one tier up, and on Tier III faster still, with more overlaps and one more at once', () => {
    const t1 = game('monster', 1);
    expect(t1.tier).toBe(2);
    expect(t1.hudTier).toBe(1);
    expect(t1.speed).toBe(D.tiers[2].speed);
    expect(t1.overlapChance).toBe(D.tiers[2].overlapChance);
    expect(t1.maxAtOnce).toBe(D.tiers[2].maxAtOnce);
    const t2 = game('monster', 2);
    expect(t2.tier).toBe(3);
    expect(t2.boost).toBe(false);
    const t3 = game('monster', 3);
    expect(t3.tier).toBe(3);
    expect(t3.speed).toBeCloseTo(D.tiers[3].speed * D.monster.boost.speed);
    expect(t3.overlapChance).toBeCloseTo(D.tiers[3].overlapChance + D.monster.boost.overlapChance);
    expect(t3.maxAtOnce).toBe(D.tiers[3].maxAtOnce + D.monster.boost.maxAtOnce);
    // His fire on Tier I already has Tier II's second set.
    const flames = partsSeen(game('monster', 1, { attack: 'fire', lengthSec: 6 })).filter(
      (p) => p.kind === 'flame',
    );
    expect(new Set(flames.map((p) => p.activeAt)).size).toBeGreaterThan(1);
  });

  it('lasts 40 s by default, and the Length setting still wins', () => {
    for (const tier of TIERS)
      expect(newDodge({ animal: 'monster', tier }, FOUR, 1).lengthSec).toBe(D.monster.lengthSec);
    expect(newDodge({ animal: 'monster', tier: 1, lengthSec: 20 }, FOUR, 1).lengthSec).toBe(20);
  });

  it('on Tier III the second half shrinks the box over 1 s, with the sprite pushed inside, and Darkness only comes then', () => {
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

  it('below Tier III there’s no second half', () => {
    let changed = false;
    play(newDodge({ animal: 'monster', tier: 2, lives: 3 }, FOUR, 5), (s) => {
      if (s.secondHalf || Math.abs(s.box.w - D.animals.monster.box[0]) > 1e-9) changed = true;
    });
    expect(changed).toBe(false);
  });

  it('The Eye only hits after the sprite stays in its gaze a moment', () => {
    // Standing still under the eye: hits come, but never twice within the hold.
    let hits = 0;
    let last = -Infinity;
    play(
      newDodge({ animal: 'monster', tier: 1, attack: 'eye', lives: 3, lengthSec: 20 }, FOUR, 3),
      (s, prev) => {
        const n = Object.values(s.hits).reduce((a, b) => a + b, 0);
        const was = Object.values(prev.hits).reduce((a, b) => a + b, 0);
        if (n > was) {
          expect(s.time - last).toBeGreaterThan(D.eye.holdSec);
          last = s.time;
          hits++;
        }
      },
      () => ({ x: 0, y: 0 }),
    );
    expect(hits).toBeGreaterThan(0);
  });
});

describe('a fuzz run with every Overlaps setting', () => {
  it.each(
    (['bees', 'bear', 'swordBear', 'bobcat', 'squirrels', 'stampede', 'monster'] as const).flatMap(
      (a) => (['off', 'on'] as const).map((o) => [a, o] as const),
    ),
  )(
    '%s with overlaps %s on Tier III: it always ends, with nothing off the map',
    (animal, overlaps) => {
      const end = play(newDodge({ animal, tier: 3, overlaps, lives: 3 }, FOUR, 13), (s) => {
        expect(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y)).toBe(true);
        for (const p of s.parts) {
          if ('x' in p) expect(Number.isFinite(p.x)).toBe(true);
        }
      });
      expect(end.over).toBe(true);
    },
  );
});
