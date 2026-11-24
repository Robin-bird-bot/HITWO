/**
 * The minigame framework (Phase 10.8, docs/design/10-minigames.md). Every
 * challenge minigame is described the same way, so the Minigame testing tab
 * and real challenges share one set of parts: the pop-up, the party GPS and
 * the game itself. Nothing here knows about runs or saves.
 */

/** A hiker in a minigame: who, their color (rim light and portrait ring) and silhouette shape. */
export interface MinigameHiker {
  id: string;
  name: string;
  color: string;
  shape: SilhouetteShape;
}

/** The silhouette each hiker is drawn as (layout.json `shapes`). */
export type SilhouetteShape = 'dog-floppy' | 'dog-fluffy' | 'hat' | 'messy' | 'curly' | 'bald';

/** How a minigame ended: who was safe, and who was hit in which round. */
export interface MinigameResult {
  safe: string[];
  hit: { hikerId: string; round: number }[];
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
      default: number;
      hint: string;
    }
  | {
      kind: 'hikers';
      id: string;
      label: string;
      min: number;
      max: number;
      default: readonly string[];
    };

/** A minigame's settings, by setting id: numbers, and the hikers picked. */
export type MinigameSettings = Record<string, number | readonly string[]>;

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
  settings: readonly MinigameSetting[];
}
