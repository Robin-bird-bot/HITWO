/**
 * What each game gives the challenge pop-up (docs/design/20-challenge-popup.md,
 * section 6): How to play, Controls, chips, the bars, per-hiker values,
 * Prepare rows, and its random version pinned before the pop-up opens.
 */
import type { PrepRow } from '../prepare';
import type { MinigameSettings } from '../types';

/** How to play, in pieces: the red one is what costs you. */
export interface Phrase {
  text: string;
  red?: true;
}

/** One input in a Controls row: a keycap, a mouse or a finger with a word, or "or". */
export type Input = { key: string } | { mouse: string } | { finger: string } | 'or';

export interface ControlRow {
  /** In the pixel font: MOVE, TAP, PICK. */
  action: string;
  inputs: readonly Input[];
}

export type BarKind = 'level' | 'count' | 'time';

/** A bar (section 3): the value from the tier and settings, and after Prepare. */
export interface Bar {
  id: string;
  label: string;
  kind: BarKind;
  base: number;
  value: number;
  /** Segments in all (a level: 10; a count: the most it can be; time: one per `per` seconds). */
  max: number;
  /** Time: seconds a segment. */
  per?: number;
  /** How the value reads, when it isn't just the number ("5×5"). */
  display?(v: number): string;
}

/** Per-hiker values (LIVES, BAR): hearts or pips per hiker, and the per-hiker row that adds to them. */
export interface PerHiker {
  label: string;
  kind: 'hearts' | 'pips';
  /** Each hiker's value before Prepare. */
  base: number;
  /** The per-hiker Prepare row whose slots add to it, and how much each adds. */
  row: string;
  step: number;
  /** Pips: how a value reads ("2.5 S"). */
  format?(v: number): string;
}

/** What failing costs, for a test challenge (a real one brings its own). */
export interface IfFail {
  who: 'each' | 'everyone';
  label: string;
  value: string;
}

export interface GamePopup {
  howToPlay(settings: MinigameSettings): Phrase[];
  controls: readonly ControlRow[];
  /** After the game's own chip and its category: how long, how hikers take part, the version. */
  chips(settings: MinigameSettings): string[];
  ifFail: readonly IfFail[];
  /** The bars, from the settings with Prepare applied (a Prepare setting missing means none). */
  bars(settings: MinigameSettings): Bar[];
  perHiker?(settings: MinigameSettings): PerHiker | null;
  /** Every Prepare row it could offer (`onlyIf` says which apply this run). */
  prepare(settings: MinigameSettings): PrepRow[];
  /**
   * Pins a random version (night, fog) from the run's seed, so the pop-up,
   * the demo and the game all agree. Returns settings to merge in.
   */
  version?(settings: MinigameSettings, seed: number): MinigameSettings;
}
