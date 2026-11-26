/**
 * Safari (docs/design/18-minigames-quick.md, section 4): the party watches
 * animals come down a hillside (see `run.ts`), then answers a question
 * together; with 3 or more hikers there are two, as a relay.
 *
 * - **The questions** are picked after the run is planned, from the ones
 *   the run fits (`fittingQuestions`): a question about a kind needs one of
 *   that kind; "first" and "last" can't be part of a herd; "never showed
 *   up" needs a kind that didn't come. When Bigfoot came, question 1 is
 *   about him. Question 2 is a different type.
 * - **Answers** (`answerFor`) come straight from the plan. "See" counts every
 *   animal that came into view, even ones that turned back or hid. Bigfoot
 *   isn't counted or offered on the normal questions.
 * - **Guessing:** the hiker at the front picks a sign. Right: that hiker
 *   and everyone after them pass. Wrong: the sign is crossed out, that hiker
 *   fails, and the next one guesses. Everyone wrong: everyone fails.
 * - **Two questions (relay):** a right guess on question 1 passes only that
 *   hiker; everyone after them answers question 2 the same way. If the
 *   last hiker answers question 1, there's no question 2.
 *
 * Pure and seeded.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { quickResult } from '../quick/turns';
import type { MinigameResult, Tier } from '../types';
import {
  KINDS,
  bigfootAt,
  bigfootSeenAt,
  kindInfo,
  kindsOut,
  planRun,
  seenAt,
  type Kind,
  type SafariRun,
} from './run';

const S = BALANCE.minigames.safari;

/** Every question type, the tier it starts at, and whether it's about Bigfoot. */
export const QUESTION_TYPES = [
  { id: 'howMany', from: 1, label: 'How many of a kind' },
  { id: 'first', from: 2, label: 'Which came first' },
  { id: 'last', from: 2, label: 'Which came last' },
  { id: 'fastest', from: 2, label: 'Which was fastest' },
  { id: 'slowest', from: 2, label: 'Which was slowest' },
  { id: 'moreOr', from: 2, label: 'More of A or B' },
  { id: 'never', from: 3, label: 'Which never showed up' },
  { id: 'turnedBack', from: 3, label: 'How many turned back' },
  { id: 'hid', from: 3, label: 'How many hid' },
  { id: 'inAll', from: 4, label: 'How many in all' },
  { id: 'biggestHerd', from: 4, label: 'Biggest herd' },
  { id: 'bigfootBefore', from: 3, label: 'Bigfoot: right before him' },
  { id: 'bigfootOut', from: 3, label: 'Bigfoot: who was out' },
  { id: 'bigfootWhen', from: 3, label: 'Bigfoot: when' },
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number]['id'];
const BIGFOOT_TYPES: readonly QuestionType[] = ['bigfootBefore', 'bigfootOut', 'bigfootWhen'];
export const isBigfootType = (t: QuestionType) => BIGFOOT_TYPES.includes(t);
export const isQuestionType = (v: unknown): v is QuestionType =>
  QUESTION_TYPES.some((q) => q.id === v);

/** A sign: its words, and the animal on it (for its icon). */
export interface Sign {
  label: string;
  kind?: Kind | 'bigfoot';
}

export interface Question {
  type: QuestionType;
  /** The kind(s) it's about. */
  kind?: Kind;
  other?: Kind;
  text: string;
  signs: Sign[];
  /** The right sign's label. */
  answer: string;
}

export interface SafariOptions {
  tier: Tier;
  /** The Version setting: "auto" rolls night and fog by tier. */
  version?: 'auto' | 'day' | 'night' | 'fog';
  /** The Questions setting: "auto" is 2 with 3 or more hikers. */
  questions?: 'auto' | 1 | 2;
  /** The Bigfoot setting. */
  bigfoot?: 'auto' | 'always' | 'never';
  /** The Question setting: one type every time, or "random". */
  question?: QuestionType | 'random';
}

export type SafariPhase = 'watch' | 'question' | 'done';

export interface SafariState {
  tier: Tier;
  run: SafariRun;
  questions: Question[];
  order: readonly string[];
  phase: SafariPhase;
  /** The question being answered (0 or 1). */
  q: number;
  /** Who's still to answer it, front first. */
  waiting: string[];
  /** Signs crossed out on this question. */
  crossed: number[];
  /** Each hiker who has a result. */
  passed: Readonly<Record<string, boolean>>;
  lastGuess?: { by: string; sign: number; right: boolean; at: number };
  time: number;
  over: boolean;
  rng: RngState;
}

const upper = (s: string) => s.toUpperCase();
const one = (k: Kind) => upper(kindInfo(k).one);
const many = (k: Kind) => upper(kindInfo(k).many);

/** How many of a kind came. */
const countOf = (run: SafariRun, k: Kind) => run.animals.filter((a) => a.kind === k).length;
/** The animals in the order they came into view. */
const byEntry = (run: SafariRun) => [...run.animals].sort((a, b) => seenAt(a) - seenAt(b));
const walkersOut = (run: SafariRun) => run.kinds.filter((k) => run.speeds[k] !== undefined);

/** The kind that came first or last, when it came alone (not in a herd); else null. */
function firstOrLast(run: SafariRun, last: boolean): Kind | null {
  const sorted = byEntry(run);
  const a = last ? sorted.at(-1) : sorted[0];
  if (!a || a.herd !== null) return null;
  // Nothing else came within a moment of it.
  const next = last ? sorted.at(-2) : sorted[1];
  if (next && Math.abs(seenAt(next) - seenAt(a)) < 0.4) return null;
  return a.kind;
}

/** Which third of the watch Bigfoot crossed in. */
const bigfootThird = (run: SafariRun): 'EARLY' | 'MIDDLE' | 'LATE' => {
  const mid = run.bigfoot!.at + S.bigfootSec / 2;
  const third = run.watchSec / 3;
  return mid < third ? 'EARLY' : mid < 2 * third ? 'MIDDLE' : 'LATE';
};

/** The one kind on the hillside the whole time Bigfoot crossed, or null. */
export function outWithBigfoot(run: SafariRun): Kind | null {
  if (!run.bigfoot) return null;
  let kind: Kind | null = null;
  for (let t = run.bigfoot.at; t <= run.bigfoot.at + S.bigfootSec + 1e-9; t += 0.05) {
    const out = kindsOut(run, t);
    if (out.size !== 1) return null;
    const k = [...out][0]!;
    if (kind && k !== kind) return null;
    kind = k;
  }
  return kind;
}

/** The kind that came right before Bigfoot, or null when two came too close together to tell. */
export function beforeBigfoot(run: SafariRun): Kind | null {
  const at = bigfootSeenAt(run);
  if (at === null) return null;
  const before = byEntry(run).filter((a) => seenAt(a) < at);
  const last = before.at(-1);
  if (!last || at - seenAt(last) < 0.4) return null;
  const prev = before.at(-2);
  if (prev && prev.kind !== last.kind && seenAt(last) - seenAt(prev) < 0.4) return null;
  return last.kind;
}

/** The answer to a question about this run, from the plan. */
export function answerFor(
  q: Pick<Question, 'type' | 'kind' | 'other'>,
  run: SafariRun,
): string | null {
  switch (q.type) {
    case 'howMany':
      return String(countOf(run, q.kind!));
    case 'first':
    case 'last': {
      const k = firstOrLast(run, q.type === 'last');
      return k ? one(k) : null;
    }
    case 'fastest':
    case 'slowest': {
      const ws = walkersOut(run).sort((a, b) => run.speeds[a]! - run.speeds[b]!);
      const k = q.type === 'fastest' ? ws.at(-1) : ws[0];
      return k ? one(k) : null;
    }
    case 'moreOr': {
      const a = countOf(run, q.kind!);
      const b = countOf(run, q.other!);
      return a > b ? many(q.kind!) : b > a ? many(q.other!) : 'THE SAME';
    }
    case 'never':
      return q.kind && countOf(run, q.kind) === 0 ? one(q.kind) : null;
    case 'turnedBack':
      return String(run.animals.filter((a) => a.does === 'turnBack').length);
    case 'hid':
      return String(run.animals.filter((a) => a.does === 'hide').length);
    case 'inAll':
      return String(run.animals.length);
    case 'biggestHerd': {
      const sizes = new Map<number, number>();
      for (const a of run.animals)
        if (a.herd !== null) sizes.set(a.herd, (sizes.get(a.herd) ?? 0) + 1);
      return String(Math.max(1, ...sizes.values()));
    }
    case 'bigfootBefore': {
      const k = beforeBigfoot(run);
      return k ? one(k) : null;
    }
    case 'bigfootOut': {
      const k = outWithBigfoot(run);
      return k ? one(k) : null;
    }
    case 'bigfootWhen':
      return run.bigfoot ? bigfootThird(run) : null;
  }
}

/** The tier's question types that this run fits (Bigfoot's only when he came). */
export function fittingQuestions(run: SafariRun, tier: Tier): QuestionType[] {
  const out: QuestionType[] = [];
  for (const t of QUESTION_TYPES) {
    if (t.from > tier) continue;
    if (isBigfootType(t.id)) {
      if (run.bigfoot && answerFor({ type: t.id }, run) !== null) out.push(t.id);
      continue;
    }
    if (t.id === 'howMany' || t.id === 'moreOr') {
      if (run.kinds.length >= (t.id === 'moreOr' ? 2 : 1)) out.push(t.id);
    } else if (t.id === 'never') {
      if (KINDS.some((k) => !run.kinds.includes(k.id))) out.push(t.id);
    } else if (t.id === 'fastest' || t.id === 'slowest') {
      if (walkersOut(run).length >= 2) out.push(t.id);
    } else if (answerFor({ type: t.id }, run) !== null) out.push(t.id);
  }
  return out;
}

/** Number signs: a run of the tier's count around the answer, the answer at a random place, none below 0. */
export function numberSigns(rng: RngState, answer: number, count: number, gap: number): Sign[] {
  const places = Array.from({ length: count }, (_, p) => p).filter((p) => answer - p * gap >= 0);
  const p = places[int(rng, 0, places.length - 1)]!;
  return Array.from({ length: count }, (_, k) => ({ label: String(answer + (k - p) * gap) }));
}

/** Animal signs: the answer and other kinds, shuffled, up to the tier's count. */
function kindSigns(rng: RngState, answer: Kind, others: readonly Kind[], count: number): Sign[] {
  const rest = shuffle(
    rng,
    others.filter((k) => k !== answer),
  ).slice(0, count - 1);
  return shuffle(rng, [answer, ...rest]).map((k) => ({ label: one(k), kind: k }));
}

/** Builds a question of a type for this run (null if it doesn't fit after all). */
export function makeQuestion(
  rng: RngState,
  type: QuestionType,
  run: SafariRun,
  tier: Tier,
): Question | null {
  const t = S.tiers[tier];
  const count = t.signs;
  const numbers = (text: string, q: Pick<Question, 'type' | 'kind'>): Question | null => {
    const ans = answerFor(q, run);
    if (ans === null) return null;
    return { ...q, text, signs: numberSigns(rng, Number(ans), count, t.numberGap), answer: ans };
  };
  const kinds = (
    text: string,
    q: Pick<Question, 'type'>,
    pool: readonly Kind[],
  ): Question | null => {
    const ans = answerFor(q, run);
    if (ans === null) return null;
    const k = KINDS.find((x) => upper(x.one) === ans)!.id;
    return { ...q, text, signs: kindSigns(rng, k, pool, count), answer: ans };
  };
  switch (type) {
    case 'howMany': {
      const kind = run.kinds[int(rng, 0, run.kinds.length - 1)]!;
      return numbers(`HOW MANY ${many(kind)} DID YOU SEE?`, { type, kind });
    }
    case 'first':
      return kinds('WHICH ANIMAL CAME FIRST?', { type }, run.kinds);
    case 'last':
      return kinds('WHICH CAME LAST?', { type }, run.kinds);
    case 'fastest':
      return kinds('WHICH WAS MOVING FASTEST?', { type }, walkersOut(run));
    case 'slowest':
      return kinds('WHICH WAS MOVING SLOWEST?', { type }, walkersOut(run));
    case 'moreOr': {
      const [kind, other] = shuffle(rng, run.kinds);
      if (!kind || !other) return null;
      const ans = answerFor({ type, kind, other }, run)!;
      return {
        type,
        kind,
        other,
        text: `WERE THERE MORE ${many(kind)} OR ${many(other)}?`,
        signs: [
          { label: many(kind), kind },
          { label: many(other), kind: other },
          { label: 'THE SAME' },
        ],
        answer: ans,
      };
    }
    case 'never': {
      const absent = KINDS.map((k) => k.id).filter((k) => !run.kinds.includes(k));
      if (!absent.length) return null;
      const kind = absent[int(rng, 0, absent.length - 1)]!;
      const signs = shuffle(rng, [kind, ...shuffle(rng, run.kinds).slice(0, count - 1)]).map(
        (k) => ({
          label: one(k),
          kind: k,
        }),
      );
      return { type, kind, text: 'WHICH ANIMAL NEVER SHOWED UP?', signs, answer: one(kind) };
    }
    case 'turnedBack':
      return numbers('HOW MANY TURNED BACK?', { type });
    case 'hid':
      return numbers('HOW MANY HID IN A BUSH?', { type });
    case 'inAll':
      return numbers('HOW MANY ANIMALS DID YOU SEE IN ALL?', { type });
    case 'biggestHerd':
      return numbers('HOW BIG WAS THE BIGGEST HERD?', { type });
    case 'bigfootBefore':
      return kinds('WHICH ANIMAL CAME RIGHT BEFORE BIGFOOT?', { type }, run.kinds);
    case 'bigfootOut':
      return kinds('WHICH ANIMAL WAS OUT WHEN BIGFOOT WENT BY?', { type }, run.kinds);
    case 'bigfootWhen': {
      const ans = answerFor({ type }, run);
      if (!ans) return null;
      return {
        type,
        text: 'WHEN DID BIGFOOT SHOW UP?',
        signs: ['EARLY', 'MIDDLE', 'LATE'].map((label) => ({ label })),
        answer: ans,
      };
    }
  }
}

/** Night and fog for this game: the Version setting, or the tier's chances (never both). */
function looks(
  rng: RngState,
  tier: Tier,
  version: SafariOptions['version'],
): { night: boolean; fog: boolean } {
  if (version === 'day') return { night: false, fog: false };
  if (version === 'night') return { night: true, fog: false };
  if (version === 'fog') return { night: false, fog: true };
  const t = S.tiers[tier];
  const night = nextFloat(rng) < t.night;
  return { night, fog: !night && nextFloat(rng) < t.fog };
}

/**
 * Plans the run, then picks the questions it fits. A forced question type
 * the run doesn't fit plans again (up to 20 times), then falls back to one
 * that fits.
 */
export function newSafari(
  options: SafariOptions,
  order: readonly string[],
  seed: number,
): SafariState {
  const tier = options.tier;
  const rng = seedRng(seed);
  const { night, fog } = looks(rng, tier, options.version);
  const forced = options.question && options.question !== 'random' ? options.question : null;
  const bigfoot =
    options.bigfoot === 'always' || (forced !== null && isBigfootType(forced))
      ? true
      : options.bigfoot === 'never'
        ? false
        : nextFloat(rng) < S.tiers[tier].bigfoot;
  const howMany =
    options.questions === 1 || options.questions === 2
      ? options.questions
      : order.length >= 3
        ? 2
        : 1;

  let run = planRun(rng, tier, { night, fog, bigfoot });
  // A forced type may come from any tier (testing); otherwise only the tier's.
  const fits = (r: SafariRun) => fittingQuestions(r, forced ? 5 : tier);
  for (let k = 0; forced && !fits(run).includes(forced) && k < 20; k++) {
    run = planRun(rng, tier, { night, fog, bigfoot });
  }
  const open = fits(run);
  const questions: Question[] = [];
  const firstPool =
    forced && open.includes(forced)
      ? [forced]
      : run.bigfoot && open.some(isBigfootType)
        ? open.filter(isBigfootType)
        : open.filter((t) => !isBigfootType(t));
  const q1 = makeQuestion(
    rng,
    firstPool[int(rng, 0, Math.max(0, firstPool.length - 1))] ?? 'howMany',
    run,
    tier,
  );
  if (q1) questions.push(q1);
  if (howMany === 2) {
    const pool = open.filter((t) => t !== q1?.type && !isBigfootType(t));
    const q2 = makeQuestion(
      rng,
      pool[int(rng, 0, Math.max(0, pool.length - 1))] ?? 'howMany',
      run,
      tier,
    );
    if (q2) questions.push(q2);
  }
  return {
    tier,
    run,
    questions,
    order,
    phase: 'watch',
    q: 0,
    waiting: [...order],
    crossed: [],
    passed: {},
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The hiker guessing now. */
export const guesser = (s: SafariState): string | undefined =>
  s.phase === 'question' ? s.waiting[0] : undefined;

/** The question being answered. */
export const question = (s: SafariState): Question | undefined => s.questions[s.q];

/** The front hiker picks a sign. */
export function guess(s: SafariState, sign: number): SafariState {
  const q = question(s);
  const who = guesser(s);
  if (s.over || !q || !who || s.crossed.includes(sign) || !q.signs[sign]) return s;
  const right = q.signs[sign]!.label === q.answer;
  const lastGuess = { by: who, sign, right, at: s.time };
  const rest = s.waiting.slice(1);
  if (!right) {
    const passed = { ...s.passed, [who]: false };
    const done = rest.length === 0;
    return {
      ...s,
      passed,
      waiting: rest,
      crossed: [...s.crossed, sign],
      lastGuess,
      ...(done ? { phase: 'done' as const } : {}),
    };
  }
  // Right on question 1 of 2: only this hiker passes; the rest go on to question 2.
  if (s.q === 0 && s.questions.length > 1) {
    const passed = { ...s.passed, [who]: true };
    if (rest.length === 0) return { ...s, passed, waiting: [], lastGuess, phase: 'done' };
    return { ...s, passed, waiting: rest, q: 1, crossed: [], lastGuess };
  }
  // Right: this hiker and everyone after them pass.
  const passed = { ...s.passed, ...Object.fromEntries(s.waiting.map((id) => [id, true])) };
  return { ...s, passed, waiting: [], lastGuess, phase: 'done' };
}

export function tick(s: SafariState, dt: number): SafariState {
  if (s.over) return s;
  const time = s.time + dt;
  if (s.phase === 'watch' && time >= s.run.watchSec) return { ...s, time, phase: 'question' };
  // A moment after the last guess, it's over.
  if (s.phase === 'done' && (!s.lastGuess || time - s.lastGuess.at >= 1.2))
    return { ...s, time, over: true };
  return { ...s, time };
}

/** Who passed; those who failed lose [1] energy. */
export const result = (s: SafariState): MinigameResult =>
  quickResult(s.order, (id) => s.passed[id] === true);

// ── Night: the flashlight ──────────────────────────────────────────────────

/** The beam comes up from the bottom middle of the hillside. */
export const BEAM_FROM = { x: 160, y: S.bottom } as const;

/** The beam's center line (radians, y down): straight at the pointer. */
export const beamAngle = (p: { x: number; y: number }): number =>
  Math.atan2(p.y - BEAM_FROM.y, p.x - BEAM_FROM.x);

/** Whether a point is in the beam (within half its width of the center line). */
export function inBeam(p: { x: number; y: number }, angle: number): boolean {
  const a = Math.atan2(p.y - BEAM_FROM.y, p.x - BEAM_FROM.x);
  let d = Math.abs(a - angle) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d <= ((S.beamDeg / 2) * Math.PI) / 180;
}

export { bigfootAt };
