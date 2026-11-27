/**
 * Fake Trail Signs (docs/design/19-minigames-signs-trails.md, section 1):
 * learn the rules, then judge trail signs as REAL or FAKE. Every round adds
 * another rule (see `rules.ts` for the generator).
 *
 * - **A round:** the rules screen (I UNDERSTAND), then the tier's signs one
 *   at a time. Every sign right: the hiker passes and a rule is added (up
 *   to the tier's cap). A wrong answer: the hiker fails, the box says why,
 *   and the next hiker gets the same rules with new signs.
 * - **Turns (Wyatt):** one round per hiker in line order. If every hiker
 *   has played and the rules haven't reached the tier's minimum, hikers who
 *   passed play again in line order until it does (a wrong answer fails
 *   them too). It ends when the minimum is reached and everyone has played,
 *   or when nobody who could play is left.
 * - **The signs:** real ones follow every rule; fakes break exactly one,
 *   the newest rule at least half the time; at least half of a round's signs
 *   make the newest rule's condition true; [40–60%] are fake, with at least
 *   one of each when there are 3 or more.
 * - Tiers IV and V show only the newest rule; the old ones still count.
 * - Hikers who fail lose [1] energy.
 *
 * Pure and seeded.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { quickResult } from '../quick/turns';
import type { MinigameResult, Tier } from '../types';
import { broken, newRule, signPool, signText, type Rule, type Sign } from './rules';

const F = BALANCE.minigames.fakeSigns;

export interface PlannedSign {
  sign: Sign;
  fake: boolean;
  /** The rule a fake breaks (its index). */
  breaks: number | null;
}

export interface FakeSignsOptions {
  tier: Tier;
  /** The Signs per round setting ("auto": the tier's). */
  signs?: number | 'auto';
  /** The Most rules setting ("auto": the tier's cap). */
  cap?: number | 'auto';
  /** The Show old rules setting. */
  showOld?: 'auto' | 'always' | 'never';
  /** The Time per sign setting (seconds; null: none). */
  timePerSign?: number | null;
  /** Prepare's FIX A SIGN: wrong answers forgiven in the whole game (24-challenges-reset.md, section 5). */
  fixes?: number;
}

export type Phase = 'rules' | 'signs' | 'wrong' | 'done';

export interface FakeSignsState {
  tier: Tier;
  signsPer: number;
  cap: number;
  min: number;
  showOld: boolean;
  timePerSign: number | null;
  order: readonly string[];
  rules: Rule[];
  /** Each hiker's result so far (none until they've played). */
  status: Readonly<Record<string, 'passed' | 'failed'>>;
  /** Rounds each hiker has played. */
  played: Readonly<Record<string, number>>;
  /** Who's playing this round, and how many rounds there have been. */
  current: string | null;
  round: number;
  phase: Phase;
  signs: PlannedSign[];
  index: number;
  /** How long the current sign has been up (for Time per sign). */
  signTime: number;
  /** The last right answer (a short tick) and the last wrong one (the box saying why). */
  lastRight?: { at: number };
  /** FIX A SIGN: wrong answers still forgiven, and the last one forgiven (a short FIXED). */
  fixesLeft: number;
  fixed?: { at: number };
  wrong?: { at: number; said: 'real' | 'fake'; sign: PlannedSign; text: string };
  time: number;
  over: boolean;
  rng: RngState;
}

/**
 * Plans a round's signs for these rules: real ones follow every rule; fakes
 * break exactly one (the newest at least half the time); at least half make
 * the newest rule's condition true; [40–60%] fake, at least one real and one
 * fake with 3 or more signs. No sign twice.
 */
export function planSigns(
  rng: RngState,
  tier: Tier,
  rules: readonly Rule[],
  n: number,
): PlannedSign[] {
  const newest = rules.length - 1;
  const rule = rules[newest]!;
  const pool = signPool(rng, tier);
  const seen = new Set<string>();
  const unique = (s: Sign) => {
    const k = `${signText(s)}|${s.left}|${s.right}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
  const realOn: Sign[] = [];
  const realOff: Sign[] = [];
  const fakeNew: Sign[] = [];
  const fakeOld: Sign[] = [];
  for (const s of pool) {
    const b = broken(rules, s);
    if (b.length === 0) (rule.cond.test(s) ? realOn : realOff).push(s);
    else if (b.length === 1) (b[0] === newest ? fakeNew : fakeOld).push(s);
  }
  let fakes = Math.round(n * (F.fakeShare[0] + nextFloat(rng) * (F.fakeShare[1] - F.fakeShare[0])));
  if (n >= 3) fakes = Math.min(n - 1, Math.max(1, fakes));
  fakes = Math.min(n, Math.max(0, fakes));
  const reals = n - fakes;
  // Fakes: the newest rule at least half the time.
  const fromNew = fakeOld.length ? Math.ceil(fakes / 2) : fakes;
  const take = (from: Sign[], k: number): Sign[] => {
    const out: Sign[] = [];
    for (const s of shuffle(rng, from)) {
      if (out.length >= k) break;
      if (unique(s)) out.push(s);
    }
    return out;
  };
  const fakeSigns = [...take(fakeNew, fromNew), ...take(fakeOld, fakes - fromNew)];
  // Top up from the newest rule if the old ones ran short.
  if (fakeSigns.length < fakes) fakeSigns.push(...take(fakeNew, fakes - fakeSigns.length));
  // Reals: enough with the newest condition true that at least half the round has it.
  const onAlready = fakeSigns.filter((s) => rule.cond.test(s)).length;
  const needOn = Math.max(0, Math.min(reals, Math.ceil(n / 2) - onAlready));
  const realSigns = [...take(realOn, needOn)];
  realSigns.push(...take([...realOn, ...realOff], reals - realSigns.length));
  const planned: PlannedSign[] = [
    ...realSigns.map((sign) => ({ sign, fake: false, breaks: null })),
    ...fakeSigns.map((sign) => ({ sign, fake: true, breaks: broken(rules, sign)[0] ?? null })),
  ];
  return shuffle(rng, planned);
}

export function newFakeSigns(
  options: FakeSignsOptions,
  order: readonly string[],
  seed: number,
): FakeSignsState {
  const t = F.tiers[options.tier];
  const rng = seedRng(seed);
  const cap = typeof options.cap === 'number' ? options.cap : t.cap;
  const first = newRule(rng, options.tier, [], signPool(rng, options.tier));
  const s: FakeSignsState = {
    tier: options.tier,
    signsPer: typeof options.signs === 'number' ? options.signs : t.signs,
    cap,
    min: Math.min(t.min, cap),
    showOld: options.showOld === 'always' ? true : options.showOld === 'never' ? false : !t.hideOld,
    timePerSign: options.timePerSign ?? null,
    order,
    rules: first ? [first] : [],
    status: {},
    played: {},
    current: null,
    round: 0,
    phase: 'rules',
    signs: [],
    index: 0,
    signTime: 0,
    fixesLeft: Math.max(0, options.fixes ?? 0),
    time: 0,
    over: order.length === 0 || !first,
    rng,
  };
  return s.over ? { ...s, phase: 'done' } : nextRound(s, rng);
}

/**
 * Who plays next: anyone who hasn't played yet, in line order; then, while
 * the rules are short of the minimum, hikers who passed, in line order after
 * the last one who played. Null: it's over.
 */
export function nextPlayer(s: FakeSignsState): string | null {
  const fresh = s.order.find((id) => !s.played[id]);
  if (fresh) return fresh;
  if (s.rules.length >= s.min) return null;
  const passed = s.order.filter((id) => s.status[id] === 'passed');
  if (!passed.length) return null;
  const lastAt = s.current ? s.order.indexOf(s.current) : -1;
  return passed.find((id) => s.order.indexOf(id) > lastAt) ?? passed[0]!;
}

/** The next round: the next player, the rules screen, and new signs. */
function nextRound(s: FakeSignsState, rng: RngState): FakeSignsState {
  const who = nextPlayer(s);
  if (!who) return { ...s, current: null, phase: 'done' };
  return {
    ...s,
    current: who,
    round: s.round + 1,
    phase: 'rules',
    signs: planSigns(rng, s.tier, s.rules, s.signsPer),
    index: 0,
    signTime: 0,
    wrong: undefined,
  };
}

/** I UNDERSTAND: the signs start. */
export function understand(s: FakeSignsState): FakeSignsState {
  if (s.over || s.phase !== 'rules') return s;
  return { ...s, phase: 'signs', index: 0, signTime: 0 };
}

/** The words for a wrong answer: why the sign was real or fake. */
export function whyText(p: PlannedSign, rules: readonly Rule[]): string {
  if (!p.fake || p.breaks === null) return 'REAL! IT FOLLOWS EVERY RULE.';
  const rule = rules[p.breaks]!;
  return `FAKE! IT BREAKS RULE ${p.breaks + 1}: ${rule.req.why(p.sign)}.`;
}

/** The current hiker answers REAL or FAKE (or runs out of time: `said` null). */
export function answer(s: FakeSignsState, said: 'real' | 'fake' | null): FakeSignsState {
  if (s.over || s.phase !== 'signs' || !s.current) return s;
  const p = s.signs[s.index];
  if (!p) return s;
  const correct = said !== null && (said === 'fake') === p.fake;
  // FIX A SIGN: a wrong answer is forgiven while there's a fix left, and play goes on.
  const fix = !correct && s.fixesLeft > 0;
  const marked = fix
    ? { fixesLeft: s.fixesLeft - 1, fixed: { at: s.time } }
    : { lastRight: { at: s.time } };
  const right = correct || fix;
  const played = { ...s.played, [s.current]: (s.played[s.current] ?? 0) + 1 };
  if (!right) {
    const text = said === null ? `OUT OF TIME. ${whyText(p, s.rules)}` : whyText(p, s.rules);
    return {
      ...s,
      played,
      status: { ...s.status, [s.current]: 'failed' },
      phase: 'wrong',
      wrong: { at: s.time, said: said ?? (p.fake ? 'real' : 'fake'), sign: p, text },
    };
  }
  if (s.index + 1 < s.signs.length) return { ...s, ...marked, index: s.index + 1, signTime: 0 };
  // Every sign right: the hiker passes, and a rule is added (up to the cap).
  const rng: RngState = [...s.rng];
  let rules = s.rules;
  if (rules.length < s.cap) {
    const added = newRule(rng, s.tier, rules, signPool(rng, s.tier));
    if (added) rules = [...rules, added];
  }
  const done: FakeSignsState = {
    ...s,
    played,
    rules,
    status: { ...s.status, [s.current]: 'passed' },
    ...marked,
    rng,
  };
  return nextRound(done, rng);
}

export function tick(s: FakeSignsState, dt: number): FakeSignsState {
  if (s.over) return s;
  const time = s.time + dt;
  if (s.phase === 'done') return { ...s, time, over: true };
  if (s.phase === 'wrong' && s.wrong && time - s.wrong.at >= F.wrongSec) {
    // The same rules for the next hiker, with new signs.
    const rng: RngState = [...s.rng];
    const next = nextRound({ ...s, time }, rng);
    return { ...next, rng };
  }
  if (s.phase === 'signs' && s.timePerSign !== null) {
    const signTime = s.signTime + dt;
    if (signTime >= s.timePerSign) return answer({ ...s, time, signTime }, null);
    return { ...s, time, signTime };
  }
  return { ...s, time };
}

/** Which rules the rules screen shows: all of them, or (Tiers IV and V) only the newest. */
export function shownRules(s: FakeSignsState): {
  rules: { n: number; text: string; newest: boolean }[];
  hidden: number;
} {
  const all = s.rules.map((r, i) => ({ n: i + 1, text: r.text, newest: i === s.rules.length - 1 }));
  if (s.showOld || all.length <= 1) return { rules: all, hidden: 0 };
  return { rules: all.slice(-1), hidden: all.length - 1 };
}

/** Who passed; those who failed lose [1] energy. */
export const result = (s: FakeSignsState): MinigameResult =>
  quickResult(s.order, (id) => s.status[id] === 'passed');
