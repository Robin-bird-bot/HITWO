/**
 * The minigame framework (Phase 10.8, docs/design/10-minigames.md). Every
 * challenge minigame is described the same way, so the Minigame testing tab
 * and real challenges share one set of parts: the pop-up, the party GPS and
 * the game itself. Nothing here knows about runs or saves.
 *
 * Every minigame plays on a 4:3 screen, laid out at 1280 × 960 (the turned
 * GPS). Anything the player places or moves can be dragged, with mouse or
 * touch, and tap, then tap always works too (Nov 24 follow-up).
 */

/** A hiker in a minigame: who, and their color (their portrait ring and their figure). */
export interface MinigameHiker {
  id: string;
  name: string;
  color: string;
  /** The id their minigame art uses (hiker-<art>-100.png): Grandpa Wink is "wink". */
  art: string;
}

/**
 * How a minigame ended, for every hiker. Bearrels says who was safe and who
 * was hit in which round; the puzzle games say who passed and who failed
 * (`wording`), and the round is 0.
 */
export interface MinigameResult {
  safe: string[];
  hit: { hikerId: string; round: number }[];
  /** "1 safe, 2 hit" (Bearrels) or "2 passed, 1 failed" (the puzzle games). */
  wording?: 'safe-hit' | 'passed-failed';
  /** The hiker who earned +1 Energy (Find the Path: the first one through). Shown only in test mode for now. */
  energy?: string;
  /** Hits each hiker took (Dodge): "Mom: 1 hit". Every hit will count for the challenge's effect later. */
  hits?: Record<string, number>;
}

/** One setting on the testing tab. */
export type MinigameSetting =
  | {
      kind: 'range';
      id: string;
      label: string;
      min: number;
      max: number;
      default: number;
      /** Under the stepper ("3 to 6"). */
      hint: string;
    }
  | {
      kind: 'choice';
      id: string;
      label: string;
      options: readonly number[];
      /** What each option's button says (Tier: I, II, III), when not the number. */
      labels?: readonly string[];
      default: number;
      hint: string;
    }
  | {
      /**
       * A number in a range, or "auto" (the tier's or the default value,
       * `autoValue`, shown in the hint). Stepping below the minimum gives Auto.
       */
      kind: 'autoRange';
      id: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      autoValue: number;
      hint: string;
    }
  | {
      /** A few named options, such as Auto, On and Off ("Auto" uses the tier's value). */
      kind: 'pick';
      id: string;
      label: string;
      /** Every option it can ever have (a remembered value outside these goes back to the default). */
      options: readonly { id: string; label: string }[];
      default: string;
      hint?: string;
      /** Shown as a dropdown instead of a row of buttons (long lists: Dodge's Animal and Attack). */
      menu?: boolean;
      /**
       * The options right now, when they follow other settings (Dodge's Attack
       * follows the Animal, the Tier and Claude's ideas). A disabled one is
       * shown greyed out; a value not open right now plays and shows as the default.
       */
      optionsFor?(settings: MinigameSettings): readonly PickOption[];
    }
  | {
      /** The art style: a few named looks for the same game (testing only for now). */
      kind: 'style';
      id: string;
      label: string;
      options: readonly { id: string; label: string }[];
      default: string;
    }
  | {
      kind: 'hikers';
      id: string;
      label: string;
      min: number;
      max: number;
      default: readonly string[];
    };

/** One option of a pick setting that follows other settings. */
export interface PickOption {
  id: string;
  label: string;
  disabled?: boolean;
}

/** A minigame's settings, by setting id: numbers, a style id, and the hikers picked. */
export type MinigameSettingValue = number | string | readonly string[];
export type MinigameSettings = Record<string, MinigameSettingValue>;

/** A minigame as data: what the testing tab lists and the pop-up names. */
export interface MinigameInfo {
  id: string;
  name: string;
  /** The base game it's a skin of (Barrels, Snake…). */
  baseGame: string;
  /** One line on how it plays. */
  description: string;
  /** Playable now, or listed as "coming soon". */
  status: 'ready' | 'soon';
  /** The hikers set their order first (Line up) when 2 or more play. */
  lineUp?: boolean;
  settings: readonly MinigameSetting[];
}
