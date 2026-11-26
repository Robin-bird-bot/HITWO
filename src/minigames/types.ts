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
  /**
   * The resources they carry, by resource id, for games that take things
   * (Raccoon Shuffle). In the testing tab it's a made-up pack (`testPack`).
   */
  pack?: Readonly<Partial<Record<string, number>>>;
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
  /** What each hiker pays (shown on the results card; applied once challenges run from tiles). */
  pays?: Record<string, Pay>;
  /**
   * A passing challenge (docs/design/14-minigames-trail-blocks.md, section 1):
   * who moves onto the tile, who goes back, and whether the challenge stays
   * on the tile (face up) because nobody got past.
   */
  passing?: { moveOn: string[]; goBack: string[]; stays: boolean };
}

/** A cost: energy, resources lost at random, resources taken (by id), and conditions gained. */
export interface Pay {
  energy?: number;
  resources?: number;
  /** Resources taken, by id, one each (Raccoon Shuffle: what the raccoon stole). */
  stolen?: string[];
  conditions?: string[];
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
       * `autoValue`, shown in the hint). Stepping below the minimum gives Auto,
       * or Off first when the setting can be switched off (`off`: timers).
       */
      kind: 'autoRange';
      id: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      autoValue: number;
      hint: string;
      off?: boolean;
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

/**
 * The kinds of minigame (docs/design/13-minigames-puzzles-2.md, section 5):
 * the testing tab lists the games under these, in this order.
 */
export type MinigameCategory = 'move' | 'puzzle' | 'memory' | 'search' | 'reaction' | 'luck';

export const CATEGORIES: readonly { id: MinigameCategory; name: string }[] = [
  { id: 'move', name: 'Movement and dodging' },
  { id: 'puzzle', name: 'Puzzle and logic' },
  { id: 'memory', name: 'Memory' },
  { id: 'search', name: 'Search' },
  { id: 'reaction', name: 'Reaction and timing' },
  { id: 'luck', name: 'Guess and luck' },
];

/**
 * Challenge tiers I to V (docs/design/15-challenge-tiers.md). Tiers I to III
 * bring in new challenges; IV and V are harder versions of Tier III.
 */
export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIERS: readonly Tier[] = [1, 2, 3, 4, 5];
export const TIER_LABELS: Readonly<Record<Tier, string>> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
};
export const isTier = (v: unknown): v is Tier => (TIERS as readonly unknown[]).includes(v);

/** Any tier number as its label, I to V (kept in range). */
export const tierLabel = (n: number): string =>
  TIER_LABELS[Math.max(1, Math.min(5, Math.round(n))) as Tier];

/** A minigame as data: what the testing tab lists and the pop-up names. */
export interface MinigameInfo {
  id: string;
  name: string;
  /** Where the testing tab lists it. */
  category: MinigameCategory;
  /** The base game it's a skin of (Barrels, Snake…). */
  baseGame: string;
  /** One line on how it plays. */
  description: string;
  /** Playable now, or listed as "coming soon". */
  status: 'ready' | 'soon';
  /** The hikers set their order first (Line up) when 2 or more play. */
  lineUp?: boolean;
  settings: readonly MinigameSetting[];
  /** A note for the testing tab, shown under the hikers when it applies (Rock Climb with 5 or 6 hikers). */
  note?(settings: MinigameSettings): string | null;
}
