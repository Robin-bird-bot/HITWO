/**
 * The night camp recap (35-ui-overhaul.md, section 7), as data: the XP the
 * party earned since the last recap in lines grouped by what caused it, the
 * party bar's fill one tick at a time, and the level-ups on the way. Pure,
 * so the timing and the sums can be tested.
 */
import { BALANCE } from '../../config/balance';
import { partyOf, xpForLevel, type GameEvent, type GameState, type XpSource } from '../../engine';
import type { IconName } from '../icons/paths';
import { lastRecap, levelFill } from '../trails/partyProgress';

const C = BALANCE.ui.overhaul.camp;

export interface RecapLine {
  key: string;
  icon: IconName;
  text: string;
  /** XP, negative for XP lost. */
  xp: number;
}

export interface BarPoint {
  xp: number;
  level: number;
}

export interface RecapPlan {
  from: BarPoint;
  to: BarPoint;
  lines: RecapLine[];
  /** What the lines add up to: the XP since the last recap. */
  total: number;
  /** The party levels reached since, in order. */
  levels: number[];
  /** The points those levels gave. */
  points: number;
  /** Skill trail tiers that opened (Tier II at party level 2, Tier III at 4). */
  opened: number[];
}

type XpEvent = Extract<GameEvent, { kind: 'xp' }>;

/** Action XP groups by kind; milestones by what they were. */
const GROUPED: readonly (XpSource | undefined)[] = ['scavenge', 'craft', 'fire', 'challenge'];

const ICON: Record<XpSource, IconName> = {
  scavenge: 'search',
  craft: 'hammer',
  fire: 'flame',
  challenge: 'alert',
  wonder: 'eye',
  checkpoint: 'tower',
  objective: 'check',
  reward: 'star',
  item: 'bag',
  trait: 'sparkles',
  shared: 'users',
  debug: 'zap',
};

function both(names: readonly string[]): string {
  return names.length === 2 ? `${names[0]} and ${names[1]}` : (names[0] ?? '');
}

function words(source: XpSource | undefined, events: readonly XpEvent[]): string {
  const n = events.length;
  const causes = [...new Set(events.map((e) => e.cause))];
  switch (source) {
    case 'scavenge':
      return n === 1 ? 'Scavenged once' : `Scavenged ${n} times`;
    case 'craft':
      return n === 1 ? (causes[0] ?? 'Crafted') : `Crafted ${n} things`;
    case 'fire': {
      const hikers = new Set(events.map((e) => e.hikerId)).size;
      return hikers === 1 ? 'Sat by the fire' : `${hikers} hikers sat by the fire`;
    }
    case 'challenge':
      return causes.length <= 2 ? `Passed ${both(causes)}` : `Passed ${causes.length} challenges`;
    case 'wonder':
      return `Found ${causes[0] ?? 'a Wonder'}`;
    case 'item':
      return `Used ${causes[0] ?? 'an item'}`;
    default:
      return causes[0] ?? 'XP';
  }
}

/** The XP lines since the last recap, in the order they first happened. */
export function recapLines(state: GameState, sinceId = lastRecap(state).eventId): RecapLine[] {
  const groups = new Map<string, { source: XpSource | undefined; events: XpEvent[] }>();
  for (const e of state.log) {
    if (e.id < sinceId || e.kind !== 'xp' || e.xp <= 0 || e.none) continue;
    const key = GROUPED.includes(e.source) ? `${e.source}` : `${e.source ?? 'xp'}:${e.cause}`;
    const group = groups.get(key) ?? { source: e.source, events: [] };
    group.events.push(e);
    groups.set(key, group);
  }
  return [...groups].map(([key, g]) => ({
    key,
    icon: g.source ? ICON[g.source] : 'star',
    text: words(g.source, g.events),
    xp: g.events.reduce((n, e) => n + e.xp, 0),
  }));
}

/** Everything the recap shows tonight. */
export function recapPlan(state: GameState): RecapPlan {
  const party = partyOf(state);
  const last = lastRecap(state);
  const from = { xp: last.xp, level: last.level };
  const to = { xp: party.xp, level: Math.max(party.level, last.level) };
  const lines = recapLines(state, last.eventId);
  // XP the lines don't explain: lost (a night event, a card) or gone from the log.
  const rest = to.xp - from.xp - lines.reduce((n, l) => n + l.xp, 0);
  if (rest < 0) lines.push({ key: 'lost', icon: 'minus', text: 'XP lost', xp: rest });
  if (rest > 0) lines.push({ key: 'more', icon: 'star', text: 'More XP', xp: rest });
  const levels: number[] = [];
  for (let l = from.level + 1; l <= to.level; l++) levels.push(l);
  const unlock = BALANCE.trails.unlockLevel;
  const opened = ([2, 3] as const).filter(
    (tier) => from.level < unlock[tier] && to.level >= unlock[tier],
  );
  return {
    from,
    to,
    lines,
    total: to.xp - from.xp,
    levels,
    points: levels.length * BALANCE.trails.pointsPerLevel,
    opened,
  };
}

export interface BarTick {
  xp: number;
  level: number;
  /** How far through the level the bar is (0–1). */
  fill: number;
  /** The bar reached this party level here: the level-up plays. */
  levelUp?: number;
}

/** XP per tick: one, or several when one at a time would take longer than [3 s]. */
export function xpPerTick(total: number): number {
  return Math.max(1, Math.ceil((total * C.tickMs) / C.maxFillMs));
}

/**
 * The bar's fill, one tick at a time, from the last recap to now. Each level
 * reached adds a tick with `levelUp` (and the bar starts over after it).
 */
export function barTicks(plan: Pick<RecapPlan, 'from' | 'to'>): BarTick[] {
  const ticks: BarTick[] = [];
  const step = xpPerTick(plan.to.xp - plan.from.xp);
  let { xp, level } = plan.from;
  const up = () => {
    level += 1;
    ticks.push({ xp, level, fill: levelFill(xp, level), levelUp: level });
  };
  while (xp < plan.to.xp) {
    const edge = xpForLevel(level + 1);
    const canLevel = level < plan.to.level;
    xp = Math.min(plan.to.xp, xp + step, canLevel ? edge : Infinity);
    ticks.push({ xp, level, fill: canLevel && xp >= edge ? 1 : levelFill(xp, level) });
    if (canLevel && xp >= edge) up();
  }
  // XP lost overall: the bar drops to where it is now.
  if (xp > plan.to.xp) {
    xp = plan.to.xp;
    ticks.push({ xp, level, fill: levelFill(xp, level) });
  }
  // Levels the engine gave that the XP left behind (XP lost after them).
  while (level < plan.to.level) up();
  return ticks;
}

/** One moment of the recap: a line comes in, the bar moves, a level-up, the buttons. */
export type CampStep =
  | { at: number; kind: 'line'; index: number; sound?: CampSound }
  | { at: number; kind: 'total'; sound?: CampSound }
  | { at: number; kind: 'tick'; index: number; sound?: CampSound }
  | { at: number; kind: 'levelUp'; level: number; sound?: CampSound }
  | { at: number; kind: 'chips'; sound?: CampSound }
  | { at: number; kind: 'done'; sound?: CampSound };

export interface CampSound {
  id: string;
  rate?: number;
  volume?: number;
}

/**
 * When each part of the recap happens (ms from the start), with its sound.
 * Reduced motion: everything at once, and only the last level-up's jingle.
 */
export function campTimeline(
  plan: RecapPlan,
  ticks: readonly BarTick[],
  { reduced = false }: { reduced?: boolean } = {},
): CampStep[] {
  if (reduced) {
    const steps: CampStep[] = plan.lines.map((_, index) => ({ at: 0, kind: 'line', index }));
    steps.push({ at: 0, kind: 'total' });
    if (ticks.length) steps.push({ at: 0, kind: 'tick', index: ticks.length - 1 });
    plan.levels.forEach((level, i) => {
      const last = i === plan.levels.length - 1;
      steps.push({ at: 0, kind: 'levelUp', level, ...(last ? { sound: { id: 'levelUp' } } : {}) });
    });
    if (plan.levels.length) steps.push({ at: 0, kind: 'chips' });
    steps.push({ at: 0, kind: 'done' });
    return steps;
  }
  const steps: CampStep[] = [];
  let at = C.startMs;
  plan.lines.forEach((_, index) => {
    steps.push({ at, kind: 'line', index, sound: { id: 'ui.tab', volume: 0.7 } });
    at += C.lineGapMs;
  });
  steps.push({ at, kind: 'total' });
  at += C.totalMs;
  ticks.forEach((t, index) => {
    if (t.levelUp !== undefined) {
      steps.push({ at, kind: 'levelUp', level: t.levelUp, sound: { id: 'levelUp' } });
      // The stamp, the rays and the confetti, then the bar starts over.
      at += C.levelMs;
      steps.push({ at, kind: 'tick', index });
      return;
    }
    const rate = 1 + t.fill * C.xpRate;
    steps.push({ at, kind: 'tick', index, sound: { id: 'xp.gain', rate, volume: 0.8 } });
    at += C.tickMs;
  });
  if (plan.levels.length) {
    steps.push({ at, kind: 'chips', sound: { id: 'trait.learn', volume: 0.7 } });
  }
  at += C.buttonsMs;
  steps.push({ at, kind: 'done' });
  return steps;
}
