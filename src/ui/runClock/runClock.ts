/**
 * The run clock (docs/design/29-core-loop.md, section 9): how long a run
 * takes in real time played, to check Wyatt's targets (Easy about 30–45
 * minutes, Medium about an hour).
 *
 * - It counts time while the game screen is up and the page is in view
 *   (paused in the background), by section, and each minigame challenge's
 *   time with its name and tier.
 * - It lives in the UI, not the engine (the engine never sees wall-clock
 *   time), and is kept in localStorage by the run's seed: one run at a time.
 * - When a run ends, a short summary goes to the console.
 *
 * These are the pure parts; `store.ts` keeps it and `useRunClock.ts` runs it.
 */
import { BALANCE } from '../../config/balance';
import type { DifficultyId } from '../../config/difficulty';

export interface MinigameTime {
  name: string;
  tier: number;
  /** The section it was played in (0 is the first). */
  section: number;
  sec: number;
}

export interface RunClock {
  /** The run's seed: a new seed is a new run. */
  seed: number;
  difficulty: DifficultyId;
  totalSec: number;
  /** Seconds in each section, by section index. */
  sections: number[];
  minigames: MinigameTime[];
  /** A minigame open now: its name, tier and the total when it opened. */
  open?: { name: string; tier: number; section: number; fromSec: number };
  /** The run is over and its summary was logged. */
  ended?: true;
}

export const freshClock = (seed: number, difficulty: DifficultyId): RunClock => ({
  seed,
  difficulty,
  totalSec: 0,
  sections: [],
  minigames: [],
});

/** Played time added to the run and its section. */
export function addTime(clock: RunClock, sec: number, section: number): RunClock {
  if (clock.ended || sec <= 0) return clock;
  const sections = [...clock.sections];
  while (sections.length <= section) sections.push(0);
  sections[section] = (sections[section] ?? 0) + sec;
  return { ...clock, totalSec: clock.totalSec + sec, sections };
}

/** A minigame challenge opens (its pop-up first, then the game). */
export const openMinigame = (
  clock: RunClock,
  game: { name: string; tier: number },
  section: number,
): RunClock =>
  clock.ended ? clock : { ...clock, open: { ...game, section, fromSec: clock.totalSec } };

/** The minigame open now is done: its time is kept. */
export function closeMinigame(clock: RunClock): RunClock {
  const open = clock.open;
  if (!open) return clock;
  const rest: RunClock = { ...clock };
  delete rest.open;
  const entry: MinigameTime = {
    name: open.name,
    tier: open.tier,
    section: open.section,
    sec: Math.max(0, clock.totalSec - open.fromSec),
  };
  return { ...rest, minigames: [...clock.minigames, entry] };
}

/** "4:05", "1:02:03". */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** The target for the run's difficulty, "30–45 min", or null when it has none. */
export function targetText(difficulty: DifficultyId): string | null {
  const t = BALANCE.run.targetMinutes[difficulty];
  return t ? `${t[0]}–${t[1]} min` : null;
}

/** The longest minigames first (the summary's five). */
export const longestMinigames = (clock: RunClock, count = 5): MinigameTime[] =>
  [...clock.minigames].sort((a, b) => b.sec - a.sec).slice(0, count);

const TIER = ['I', 'II', 'III', 'IV', 'V'];
const DIFFICULTY_NAME: Readonly<Record<DifficultyId, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  nightmare: 'Nightmare',
};

/** The summary logged when a run ends: the total, each section, the 5 longest minigames, the difficulty. */
export function summary(clock: RunClock): string {
  const target = targetText(clock.difficulty);
  const lines = [
    `Run clock: ${clockText(clock.totalSec)} (${DIFFICULTY_NAME[clock.difficulty]}${target ? `, aim ${target}` : ''})`,
    ...clock.sections.map((sec, k) => `  Section ${k + 1}: ${clockText(sec)}`),
    `  Minigames: ${clock.minigames.length}, ${clockText(clock.minigames.reduce((n, m) => n + m.sec, 0))} in all`,
    ...longestMinigames(clock).map(
      (m) => `    ${m.name} (Tier ${TIER[m.tier - 1] ?? m.tier}): ${clockText(m.sec)}`,
    ),
  ];
  return lines.join('\n');
}
