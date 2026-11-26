/**
 * Fake Trail Signs' rule generator (docs/design/19-minigames-signs-trails.md,
 * section 1, "The rules" and "Making rules and signs").
 *
 * - **A sign** is NAME TYPE NN with a shape at each end: "PACIFIC LOOP 34",
 *   both ends pointy. The digits are "the two numbers": in 34, the first is
 *   3 and the last is 4.
 * - **A rule** is "IF <condition>, <requirement>." A sign follows it when the
 *   condition is false, or when it's true and the requirement holds.
 * - **Parts:** each condition and requirement is a small piece with its
 *   words, a test, and a topic (the type, the name, the shape or the
 *   number). Requirements also say why a sign breaks them ("3 + 4 IS NOT
 *   MORE THAN 7"). Each tier draws from the doc's lists: Tier I's parts,
 *   Tier III's added, and Tier IV's (AND / OR, NOT A <TYPE>, the same first
 *   letter) added.
 * - **A new rule:** a random condition and a random requirement about
 *   different topics, not a rule already in play, and one that still leaves
 *   real signs and fake signs possible (checked against a seeded pool of
 *   random signs): when its condition is true, some signs follow every
 *   rule, and some break only the new one.
 *
 * Pure and seeded.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, pick } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { Tier } from '../types';

const F = BALANCE.minigames.fakeSigns;

export type Shape = 'square' | 'pointy' | 'round';
export const SHAPES: readonly Shape[] = ['square', 'pointy', 'round'];

export const TYPES = ['LOOP', 'TRAIL', 'RIDGE', 'FALLS', 'LAKE', 'PASS', 'PEAK', 'CREEK'] as const;
export type TrailType = (typeof TYPES)[number];

/** One-word trail names, 3 to 8 letters (the doc's, and more like them). */
export const NAMES = [
  'ELK',
  'FOX',
  'OAK',
  'OWL',
  'ASH',
  'ELM',
  'IVY',
  'BEAR',
  'FERN',
  'PINE',
  'LYNX',
  'HAWK',
  'ORCA',
  'IRIS',
  'ASPEN',
  'CEDAR',
  'EAGLE',
  'MAPLE',
  'OTTER',
  'RAVEN',
  'BISON',
  'ALDER',
  'BIRCH',
  'HERON',
  'MOOSE',
  'ACORN',
  'WILLOW',
  'CANYON',
  'SUMMIT',
  'SPRUCE',
  'COYOTE',
  'LUPINE',
  'OSPREY',
  'AUTUMN',
  'PACIFIC',
  'JUNIPER',
  'HEMLOCK',
  'SYCAMORE',
  'BLUEBELL',
] as const;

export interface Sign {
  name: string;
  type: TrailType;
  /** 10 to 99. */
  num: number;
  left: Shape;
  right: Shape;
}

export type Topic = 'type' | 'name' | 'shape' | 'number';

export interface Condition {
  id: string;
  text: string;
  topics: readonly Topic[];
  test(s: Sign): boolean;
}

export interface Requirement extends Condition {
  /** Why a sign that breaks it does: "3 + 4 IS NOT MORE THAN 7". */
  why(s: Sign): string;
}

export interface Rule {
  cond: Condition;
  req: Requirement;
  text: string;
}

const first = (s: Sign) => Math.floor(s.num / 10);
const last = (s: Sign) => s.num % 10;
const isVowel = (c: string | undefined) => !!c && 'AEIOU'.includes(c);
const SH = (shape: Shape) => shape.toUpperCase();
const shapeWord = (s: Sign) =>
  s.left === s.right ? SH(s.left) : `${SH(s.left)} AND ${SH(s.right)}`;

/** Whether a rule holds for a sign (the condition is false, or the requirement holds). */
export const follows = (rule: Rule, s: Sign): boolean => !rule.cond.test(s) || rule.req.test(s);

/** The rules a sign breaks, by index. */
export const broken = (rules: readonly Rule[], s: Sign): number[] =>
  rules.flatMap((r, i) => (follows(r, s) ? [] : [i]));

/** "PACIFIC LOOP 34". */
export const signText = (s: Sign): string => `${s.name} ${s.type} ${s.num}`;

const within = (rng: RngState, [a, b]: readonly [number, number]) => int(rng, a, b);

// ── Conditions ──────────────────────────────────────────────────────────────

type Maker<T> = (rng: RngState) => T;

const T1_CONDITIONS: readonly Maker<Condition>[] = [
  (rng) => {
    const t = pick(rng, TYPES);
    return {
      id: `type:${t}`,
      text: `THE TRAIL IS A ${t}`,
      topics: ['type'],
      test: (s) => s.type === t,
    };
  },
  (rng) => {
    const n = within(rng, F.nameLonger);
    return {
      id: `name>${n}`,
      text: `THE TRAIL NAME HAS MORE THAN ${n} LETTERS`,
      topics: ['name'],
      test: (s) => s.name.length > n,
    };
  },
  (rng) => {
    const n = within(rng, F.nameShorter);
    return {
      id: `name<=${n}`,
      text: `THE TRAIL NAME HAS ${n} LETTERS OR FEWER`,
      topics: ['name'],
      test: (s) => s.name.length <= n,
    };
  },
  (rng) => {
    const sh = pick(rng, SHAPES);
    return {
      id: `sign:${sh}`,
      text: `THE SIGN IS ${SH(sh)}`,
      topics: ['shape'],
      test: (s) => s.left === sh && s.right === sh,
    };
  },
  (rng) => {
    const n = within(rng, F.numberOver);
    return {
      id: `num>${n}`,
      text: `THE NUMBER IS OVER ${n}`,
      topics: ['number'],
      test: (s) => s.num > n,
    };
  },
  (rng) => {
    const even = nextFloat(rng) < 0.5;
    return {
      id: `num:${even ? 'even' : 'odd'}`,
      text: `THE NUMBER IS ${even ? 'EVEN' : 'ODD'}`,
      topics: ['number'],
      test: (s) => (s.num % 2 === 0) === even,
    };
  },
];

const T3_CONDITIONS: readonly Maker<Condition>[] = [
  () => ({
    id: 'name:vowel',
    text: 'THE NAME STARTS WITH A VOWEL',
    topics: ['name'],
    test: (s) => isVowel(s.name[0]),
  }),
  (rng) => {
    const sh = pick(rng, SHAPES);
    const which = pick(rng, ['LEFT', 'RIGHT', 'EITHER'] as const);
    return {
      id: `end:${which}:${sh}`,
      text: which === 'EITHER' ? `EITHER END IS ${SH(sh)}` : `THE ${which} END IS ${SH(sh)}`,
      topics: ['shape'],
      test: (s) =>
        which === 'LEFT'
          ? s.left === sh
          : which === 'RIGHT'
            ? s.right === sh
            : s.left === sh || s.right === sh,
    };
  },
  () => ({
    id: 'ends:differ',
    text: 'THE ENDS DON’T MATCH',
    topics: ['shape'],
    test: (s) => s.left !== s.right,
  }),
  () => ({
    id: 'digits:first>last',
    text: 'THE FIRST NUMBER IS BIGGER THAN THE LAST',
    topics: ['number'],
    test: (s) => first(s) > last(s),
  }),
];

const T4_CONDITIONS: readonly Maker<Condition>[] = [
  (rng) => {
    const t = pick(rng, TYPES);
    return {
      id: `!type:${t}`,
      text: `THE TRAIL ISN’T A ${t}`,
      topics: ['type'],
      test: (s) => s.type !== t,
    };
  },
  () => ({
    id: 'name=type',
    text: 'THE NAME AND THE TYPE START WITH THE SAME LETTER',
    topics: ['name', 'type'],
    test: (s) => s.name[0] === s.type[0],
  }),
  // Two conditions joined: "<X> AND <Z>" or "<X> OR <Z>".
  (rng) => {
    const pool = [...T1_CONDITIONS, ...T3_CONDITIONS];
    const x = pick(rng, pool)(rng);
    let z = pick(rng, pool)(rng);
    for (let k = 0; k < 10 && z.id === x.id; k++) z = pick(rng, pool)(rng);
    const and = nextFloat(rng) < 0.5;
    return {
      id: `${x.id}${and ? '&' : '|'}${z.id}`,
      text: `${x.text} ${and ? 'AND' : 'OR'} ${z.text}`,
      topics: [...new Set([...x.topics, ...z.topics])],
      test: and ? (s) => x.test(s) && z.test(s) : (s) => x.test(s) || z.test(s),
    };
  },
];

// ── Requirements ────────────────────────────────────────────────────────────

const T1_REQUIREMENTS: readonly Maker<Requirement>[] = [
  (rng) => {
    const even = nextFloat(rng) < 0.5;
    const word = even ? 'EVEN' : 'ODD';
    return {
      id: `last:${word}`,
      text: `THE LAST NUMBER MUST BE ${word}`,
      topics: ['number'],
      test: (s) => (last(s) % 2 === 0) === even,
      why: (s) => `${last(s)} IS NOT ${word}`,
    };
  },
  (rng) => {
    const n = within(rng, F.numberMust);
    const under = nextFloat(rng) < 0.5;
    const word = under ? 'UNDER' : 'OVER';
    return {
      id: `num:${word}:${n}`,
      text: `THE NUMBER MUST BE ${word} ${n}`,
      topics: ['number'],
      test: (s) => (under ? s.num < n : s.num > n),
      why: (s) => `${s.num} IS NOT ${word} ${n}`,
    };
  },
  (rng) => {
    const n = within(rng, F.sumMust);
    const more = nextFloat(rng) < 0.5;
    const word = more ? 'MORE THAN' : 'LESS THAN';
    return {
      id: `sum:${word}:${n}`,
      text: `ITS TWO NUMBERS MUST ADD UP TO ${word} ${n}`,
      topics: ['number'],
      test: (s) => (more ? first(s) + last(s) > n : first(s) + last(s) < n),
      why: (s) => `${first(s)} + ${last(s)} IS NOT ${word} ${n}`,
    };
  },
  (rng) => {
    const sh = pick(rng, SHAPES);
    return {
      id: `must:${sh}`,
      text: `THE SIGN MUST BE ${SH(sh)}`,
      topics: ['shape'],
      test: (s) => s.left === sh && s.right === sh,
      why: (s) => `THE SIGN IS ${shapeWord(s)}, NOT ${SH(sh)}`,
    };
  },
  (rng) => {
    const a = pick(rng, TYPES);
    let b = pick(rng, TYPES);
    for (let k = 0; k < 10 && b === a; k++) b = pick(rng, TYPES);
    return {
      id: `types:${[a, b].sort().join('/')}`,
      text: `IT MUST BE A ${a} OR A ${b}`,
      topics: ['type'],
      test: (s) => s.type === a || s.type === b,
      why: (s) => `IT’S A ${s.type}, NOT A ${a} OR A ${b}`,
    };
  },
];

const T3_REQUIREMENTS: readonly Maker<Requirement>[] = [
  () => ({
    id: 'must:first>last',
    text: 'THE FIRST NUMBER MUST BE BIGGER THAN THE LAST',
    topics: ['number'],
    test: (s) => first(s) > last(s),
    why: (s) => `${first(s)} IS NOT BIGGER THAN ${last(s)}`,
  }),
  (rng) => {
    const sh = pick(rng, SHAPES);
    const which = pick(rng, ['LEFT', 'RIGHT'] as const);
    const end = (s: Sign) => (which === 'LEFT' ? s.left : s.right);
    return {
      id: `must:${which}:${sh}`,
      text: `THE ${which} END MUST BE ${SH(sh)}`,
      topics: ['shape'],
      test: (s) => end(s) === sh,
      why: (s) => `THE ${which} END IS ${SH(end(s))}`,
    };
  },
  () => ({
    id: 'must:name-even',
    text: 'THE NAME MUST HAVE AN EVEN NUMBER OF LETTERS',
    topics: ['name'],
    test: (s) => s.name.length % 2 === 0,
    why: (s) => `${s.name} HAS ${s.name.length} LETTERS`,
  }),
];

const T4_REQUIREMENTS: readonly Maker<Requirement>[] = [
  () => ({
    id: 'must:sum-even',
    text: 'ITS TWO NUMBERS MUST ADD UP TO AN EVEN NUMBER',
    topics: ['number'],
    test: (s) => (first(s) + last(s)) % 2 === 0,
    why: (s) => `${first(s)} + ${last(s)} IS ${first(s) + last(s)}`,
  }),
  () => ({
    id: 'must:3x',
    text: 'THE NUMBER MUST BE A MULTIPLE OF 3',
    topics: ['number'],
    test: (s) => s.num % 3 === 0,
    why: (s) => `${s.num} IS NOT A MULTIPLE OF 3`,
  }),
  () => ({
    id: 'must:ends-differ',
    text: 'THE ENDS MUST NOT MATCH',
    topics: ['shape'],
    test: (s) => s.left !== s.right,
    why: () => 'THE ENDS MATCH',
  }),
  (rng) => {
    const sh = pick(rng, SHAPES);
    return {
      id: `!must:${sh}`,
      text: `THE SIGN MUST NOT BE ${SH(sh)}`,
      topics: ['shape'],
      test: (s) => !(s.left === sh && s.right === sh),
      why: () => `THE SIGN IS ${SH(sh)}`,
    };
  },
];

/** The tier's pools (the doc's "Rule pool" row). */
export function pools(tier: Tier): { conds: Maker<Condition>[]; reqs: Maker<Requirement>[] } {
  const conds = [...T1_CONDITIONS];
  const reqs = [...T1_REQUIREMENTS];
  if (tier >= 3) {
    conds.push(...T3_CONDITIONS);
    reqs.push(...T3_REQUIREMENTS);
  }
  if (tier >= 4) {
    conds.push(...T4_CONDITIONS);
    reqs.push(...T4_REQUIREMENTS);
  }
  return { conds, reqs };
}

/** Whether the sign's ends can differ at this tier (from Tier III). */
export const mixedEnds = (tier: Tier): boolean => F.tiers[tier].mixedEnds;

/** A random sign for the tier: any name, type and number; matching ends at Tiers I and II. */
export function randomSign(rng: RngState, tier: Tier): Sign {
  const left = pick(rng, SHAPES);
  return {
    name: pick(rng, NAMES),
    type: pick(rng, TYPES),
    num: int(rng, 10, 99),
    left,
    right: mixedEnds(tier) ? pick(rng, SHAPES) : left,
  };
}

/** A pool of random signs to check rules against. */
export const signPool = (rng: RngState, tier: Tier, n = F.poolSize): Sign[] =>
  Array.from({ length: n }, () => randomSign(rng, tier));

/**
 * Whether a new rule still works with the rules before it: among signs that
 * make its condition true, some follow every rule (real), and some break
 * only the new one (fake). At least `F.minOfEach` of each, so a round has
 * room to choose.
 */
export function workable(rules: readonly Rule[], rule: Rule, pool: readonly Sign[]): boolean {
  let real = 0;
  let fake = 0;
  for (const s of pool) {
    if (!rule.cond.test(s)) continue;
    if (!rules.every((r) => follows(r, s))) continue;
    if (rule.req.test(s)) real++;
    else fake++;
    if (real >= F.minOfEach && fake >= F.minOfEach) return true;
  }
  return false;
}

/**
 * A new rule for the tier: a condition and a requirement about different
 * topics, not already in play, that keeps real and fake signs possible.
 * Null if none can be found (very unlikely).
 */
export function newRule(
  rng: RngState,
  tier: Tier,
  rules: readonly Rule[],
  pool: readonly Sign[],
): Rule | null {
  const { conds, reqs } = pools(tier);
  for (let k = 0; k < 400; k++) {
    const cond = pick(rng, conds)(rng);
    const req = pick(rng, reqs)(rng);
    if (req.topics.some((t) => cond.topics.includes(t))) continue;
    const text = `IF ${cond.text}, ${req.text}.`;
    if (rules.some((r) => r.text === text || (r.cond.id === cond.id && r.req.id === req.id)))
      continue;
    const rule = { cond, req, text };
    if (workable(rules, rule, pool)) return rule;
  }
  return null;
}
