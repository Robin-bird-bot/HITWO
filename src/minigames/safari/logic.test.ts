/**
 * Safari (docs/design/18-minigames-quick.md, sections 4 and 9): for every
 * question type, the answer matches what was shown (replaying where every
 * animal was, moment by moment); the right answer is always on a sign,
 * there are no repeated signs, and no number is below 0; the guessing and
 * relay rules; "fastest" and "slowest" always have a clear answer; the
 * beam's center line goes through the pointer; a Bigfoot question only
 * comes when he showed up.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS, type Tier } from '../types';
import {
  beamAngle,
  BEAM_FROM,
  fittingQuestions,
  guess,
  guesser,
  inBeam,
  isBigfootType,
  newSafari,
  numberSigns,
  question,
  QUESTION_TYPES,
  result,
  tick,
  type QuestionType,
  type SafariState,
} from './logic';
import {
  bigfootAt,
  kindInfo,
  outFor,
  planRun,
  positionAt,
  WALK,
  type Kind,
  type SafariRun,
} from './run';

const S = BALANCE.minigames.safari;
const Q = BALANCE.minigames.quick;
const one = (k: Kind) => kindInfo(k).one.toUpperCase();
const many = (k: Kind) => kindInfo(k).many.toUpperCase();

/** What could be seen, by replaying every animal's spot through the watch. */
function watched(run: SafariRun) {
  const firstSeen = new Map<number, number>();
  const wentUp = new Set<number>();
  const lastSpot = new Map<number, { y: number; t: number }>();
  const bigfootFirst = { t: Infinity };
  const outWithBigfoot = new Set<Kind>();
  for (let t = 0; t <= run.watchSec + 30; t += 0.02) {
    const bf = bigfootAt(run, t);
    if (bf && t < bigfootFirst.t) bigfootFirst.t = t;
    for (const a of run.animals) {
      const p = positionAt(a, t);
      if (!p) continue;
      const inView =
        a.does === 'fly'
          ? p.x > -kindInfo(a.kind).w / 2 && p.x < 320 + kindInfo(a.kind).w / 2
          : p.y > S.top + 2;
      if (inView && !firstSeen.has(a.id) && t <= run.watchSec) firstSeen.set(a.id, t);
      if (p.up) wentUp.add(a.id);
      lastSpot.set(a.id, { y: p.y, t });
      if (bf) outWithBigfoot.add(a.kind);
    }
  }
  const seen = run.animals.filter((a) => firstSeen.has(a.id));
  const count = (k: Kind) => seen.filter((a) => a.kind === k).length;
  const order = [...seen].sort((a, b) => firstSeen.get(a.id)! - firstSeen.get(b.id)!);
  const hid = run.animals.filter(
    (a) => a.does !== 'fly' && !wentUp.has(a.id) && lastSpot.get(a.id)!.y < S.bottom - 5,
  ).length;
  const herds = new Map<number, number>();
  for (const a of seen) if (a.herd !== null) herds.set(a.herd, (herds.get(a.herd) ?? 0) + 1);
  const before = order.filter((a) => firstSeen.get(a.id)! < bigfootFirst.t).at(-1);
  return {
    seen,
    count,
    order,
    wentUp: wentUp.size,
    hid,
    herds,
    before,
    outWithBigfoot,
    bigfootFirst: bigfootFirst.t,
  };
}

/** The answer worked out from what was watched (null: no single answer to check against). */
function watchedAnswer(s: SafariState, i: number): string | null {
  const q = s.questions[i]!;
  const run = s.run;
  const w = watched(run);
  switch (q.type) {
    case 'howMany':
      return String(w.count(q.kind!));
    case 'first':
      return one(w.order[0]!.kind);
    case 'last':
      return one(w.order.at(-1)!.kind);
    case 'fastest':
    case 'slowest': {
      // Measure each walking kind's speed from how its animals moved.
      const speed = new Map<Kind, number>();
      for (const a of run.animals.filter((x) => x.does !== 'fly')) {
        const p0 = positionAt(a, a.enterAt + 0.1)!;
        const p1 = positionAt(a, a.enterAt + 0.2)!;
        speed.set(a.kind, Math.abs(p1.y - p0.y) / 0.1);
      }
      const sorted = [...speed].sort((a, b) => a[1] - b[1]);
      return one((q.type === 'fastest' ? sorted.at(-1) : sorted[0])![0]);
    }
    case 'moreOr': {
      const a = w.count(q.kind!);
      const b = w.count(q.other!);
      return a > b ? many(q.kind!) : b > a ? many(q.other!) : 'THE SAME';
    }
    case 'never':
      return w.count(q.kind!) === 0 ? one(q.kind!) : 'SHOWED UP';
    case 'turnedBack':
      return String(w.wentUp);
    case 'hid':
      return String(w.hid);
    case 'inAll':
      return String(w.seen.length);
    case 'biggestHerd':
      return String(Math.max(1, ...w.herds.values()));
    case 'bigfootBefore':
      return w.before ? one(w.before.kind) : null;
    case 'bigfootOut':
      return w.outWithBigfoot.size === 1 ? one([...w.outWithBigfoot][0]!) : 'MORE THAN ONE';
    case 'bigfootWhen': {
      const mid = run.bigfoot!.at + S.bigfootSec / 2;
      return mid < run.watchSec / 3 ? 'EARLY' : mid < (2 * run.watchSec) / 3 ? 'MIDDLE' : 'LATE';
    }
  }
}

const HIKERS = ['finn', 'mom', 'ellie', 'wyatt'];

describe('Safari: the run', () => {
  it.each(TIERS)(
    'Tier %i: the kinds, the most out at once, the last one in before the end',
    (tier) => {
      const t = S.tiers[tier];
      for (let seed = 1; seed <= 25; seed++) {
        const run = planRun(seedRng(seed), tier, { night: false, fog: false, bigfoot: false });
        expect(run.kinds.length).toBeLessThanOrEqual(t.kinds);
        expect(run.kinds.length).toBeGreaterThanOrEqual(Math.min(t.kinds, 3));
        if (tier === 1) expect(run.kinds).not.toContain('bird');
        expect(run.animals.length).toBeLessThanOrEqual(t.animals + S.animalsSpread);
        for (const a of run.animals)
          expect(a.enterAt).toBeLessThanOrEqual(t.watchSec - S.lastEntrySec + 1e-9);
        for (let s = 0; s < t.watchSec; s += 0.05) {
          const out = run.animals.filter((a) => a.enterAt <= s && s < a.enterAt + outFor(a)).length;
          expect(out).toBeLessThanOrEqual(t.maxOnScreen);
        }
      }
    },
  );

  it.each(TIERS)(
    'Tier %i: "fastest" and "slowest" always have a clear answer; middle kinds in the range',
    (tier) => {
      const [lo, hi] = S.tiers[tier].walkSec;
      for (let seed = 1; seed <= 40; seed++) {
        const run = planRun(seedRng(seed), tier, { night: false, fog: false, bigfoot: false });
        const sp = Object.values(run.speeds).sort((a, b) => a - b);
        if (sp.length < 2) continue;
        expect(sp.at(-1)! / sp.at(-2)!).toBeGreaterThanOrEqual(S.fastestGap - 1e-9);
        expect(sp[0]! / sp[1]!).toBeLessThanOrEqual(
          Math.max(S.slowestGap, 1 / S.fastestGap) + 1e-9,
        );
        for (const v of sp.slice(1, -1)) {
          expect(WALK / v).toBeGreaterThanOrEqual(lo - 1e-9);
          expect(WALK / v).toBeLessThanOrEqual(hi + 1e-9);
        }
      }
    },
  );
});

describe('Safari: the questions', () => {
  const types = QUESTION_TYPES.map((q) => q.id);
  it.each(types)(
    '%s: the answer matches what was shown, and it’s on a sign; no repeats, nothing below 0',
    (type) => {
      let checked = 0;
      for (const tier of [3, 4, 5] as Tier[]) {
        for (let seed = 1; seed <= 12; seed++) {
          const s = newSafari(
            { tier, question: type as QuestionType, questions: 1 },
            ['finn'],
            seed * 31 + tier,
          );
          const q = s.questions[0]!;
          if (q.type !== type) continue;
          checked++;
          const seen = watchedAnswer(s, 0);
          if (seen !== null) expect(q.answer).toBe(seen);
          const labels = q.signs.map((x) => x.label);
          expect(labels).toContain(q.answer);
          expect(new Set(labels).size).toBe(labels.length);
          for (const l of labels)
            if (/^\d+$/.test(l) || /^-/.test(l)) expect(Number(l)).toBeGreaterThanOrEqual(0);
          if (isBigfootType(q.type)) expect(s.run.bigfoot).not.toBeNull();
        }
      }
      expect(checked).toBeGreaterThan(5);
    },
  );

  it('a Bigfoot question only comes when he showed up, and then question 1 is always about him', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = newSafari({ tier: 5 }, HIKERS, seed);
      const [q1, q2] = s.questions;
      if (s.run.bigfoot) expect(isBigfootType(q1!.type)).toBe(true);
      else expect(s.questions.some((q) => isBigfootType(q.type))).toBe(false);
      if (q2) {
        expect(isBigfootType(q2.type)).toBe(false);
        expect(q2.type).not.toBe(q1!.type);
      }
    }
    expect(newSafari({ tier: 2 }, ['finn'], 1).run.bigfoot).toBeNull();
    expect(newSafari({ tier: 1, bigfoot: 'always' }, ['finn'], 1).run.bigfoot).not.toBeNull();
  });

  it('the questions follow the tier', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const tier of TIERS) {
        const s = newSafari({ tier, bigfoot: 'never' }, ['finn'], seed);
        const from = QUESTION_TYPES.find((x) => x.id === s.questions[0]!.type)!.from;
        expect(from).toBeLessThanOrEqual(tier);
        expect(fittingQuestions(s.run, tier)).toContain(s.questions[0]!.type);
      }
    }
  });

  it('number signs: a run around the answer, the right gap, never below 0', () => {
    const rng = seedRng(4);
    for (let ans = 0; ans <= 6; ans++) {
      for (const gap of [1, 2]) {
        const signs = numberSigns(rng, ans, 4, gap).map((x) => Number(x.label));
        expect(signs).toContain(ans);
        expect(Math.min(...signs)).toBeGreaterThanOrEqual(0);
        for (let k = 1; k < signs.length; k++) expect(signs[k]! - signs[k - 1]!).toBe(gap);
      }
    }
  });
});

describe('Safari: guessing', () => {
  const ready = (o: Parameters<typeof newSafari>[0], order: string[], seed = 3) => {
    let s = newSafari(o, order, seed);
    while (s.phase === 'watch') s = tick(s, 0.1);
    return s;
  };
  const right = (s: SafariState) =>
    question(s)!.signs.findIndex((x) => x.label === question(s)!.answer);
  const wrong = (s: SafariState) =>
    question(s)!.signs.findIndex(
      (x, i) => x.label !== question(s)!.answer && !s.crossed.includes(i),
    );

  it('one question: a wrong guess fails only that hiker; a right guess passes them and everyone after', () => {
    let s = ready({ tier: 2, questions: 1 }, ['finn', 'mom', 'ellie']);
    expect(guesser(s)).toBe('finn');
    const w = wrong(s);
    s = guess(s, w);
    expect(s.passed).toEqual({ finn: false });
    expect(s.crossed).toEqual([w]);
    // A crossed-out sign can't be picked again.
    expect(guess(s, w)).toBe(s);
    expect(guesser(s)).toBe('mom');
    s = guess(s, right(s));
    expect(s.passed).toEqual({ finn: false, mom: true, ellie: true });
    expect(s.phase).toBe('done');
    s = tick(s, 2);
    expect(s.over).toBe(true);
    expect(result(s)).toMatchObject({
      safe: ['mom', 'ellie'],
      pays: { finn: { energy: Q.failEnergy } },
    });
  });

  it('everyone wrong: everyone fails', () => {
    let s = ready({ tier: 4, questions: 1 }, ['finn', 'mom']);
    s = guess(s, wrong(s));
    s = guess(s, wrong(s));
    expect(s.phase).toBe('done');
    expect(s.passed).toEqual({ finn: false, mom: false });
  });

  it('two questions (3 or more hikers): a right guess on question 1 passes only that hiker; the rest go to question 2', () => {
    let s = ready({ tier: 3 }, ['finn', 'mom', 'ellie', 'wyatt']);
    expect(s.questions).toHaveLength(2);
    s = guess(s, wrong(s));
    s = guess(s, right(s));
    expect(s.passed).toEqual({ finn: false, mom: true });
    expect(s.q).toBe(1);
    expect(s.crossed).toEqual([]);
    expect(guesser(s)).toBe('ellie');
    s = guess(s, right(s));
    expect(s.passed).toEqual({ finn: false, mom: true, ellie: true, wyatt: true });
  });

  it('no question 2 when the last hiker answers question 1', () => {
    let s = ready({ tier: 3, questions: 2 }, ['finn', 'mom', 'ellie']);
    s = guess(s, wrong(s));
    s = guess(s, wrong(s));
    s = guess(s, right(s));
    expect(s.phase).toBe('done');
    expect(s.q).toBe(0);
    expect(s.passed).toEqual({ finn: false, mom: false, ellie: true });
  });

  it('Auto gives two questions with 3 or more hikers, one with fewer', () => {
    expect(newSafari({ tier: 2 }, ['finn', 'mom'], 1).questions).toHaveLength(1);
    expect(newSafari({ tier: 2 }, ['finn', 'mom', 'ellie'], 1).questions).toHaveLength(2);
  });
});

describe('Safari: night', () => {
  it('the beam’s center line goes through the pointer, and it’s the tier’s width', () => {
    for (const p of [
      { x: 40, y: 60 },
      { x: 160, y: 30 },
      { x: 300, y: 150 },
    ]) {
      const a = beamAngle(p);
      expect(inBeam(p, a)).toBe(true);
      // Halfway out along the center line is in the beam too.
      expect(inBeam({ x: (p.x + BEAM_FROM.x) / 2, y: (p.y + BEAM_FROM.y) / 2 }, a)).toBe(true);
      // Just past half the width, to one side, isn't.
      const off = a + ((S.beamDeg / 2 + 2) * Math.PI) / 180;
      expect(
        inBeam({ x: BEAM_FROM.x + Math.cos(off) * 100, y: BEAM_FROM.y + Math.sin(off) * 100 }, a),
      ).toBe(false);
    }
  });

  it('night from Tier III and fog from Tier IV, never both; the Version setting forces them', () => {
    for (let seed = 1; seed <= 80; seed++) {
      expect(newSafari({ tier: 2 }, ['finn'], seed).run.night).toBe(false);
      const s = newSafari({ tier: 4 }, ['finn'], seed).run;
      expect(s.night && s.fog).toBeFalsy();
      expect(newSafari({ tier: 3 }, ['finn'], seed).run.fog).toBeNull();
    }
    expect(newSafari({ tier: 1, version: 'night' }, ['finn'], 1).run.night).toBe(true);
    expect(newSafari({ tier: 1, version: 'fog' }, ['finn'], 1).run.fog).not.toBeNull();
  });
});
