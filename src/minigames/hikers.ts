/**
 * How each hiker looks in a minigame (docs/design/10-minigames.md, "Hikers"):
 * their own color, the same one that rings their portrait, so they're easy
 * to spot on the green screen. A hiker in a run uses their party color;
 * otherwise their color from Bearrels' layout.json.
 */
import { ROSTER_BY_ID } from '../content/roster';
import type { MinigameHiker } from './types';
import LAYOUT from '../../public/assets/minigames/bearrels/layout.json';

const COLORS: Readonly<Record<string, string>> = LAYOUT.colors.hikers;
/** Roster ids that the art names differently. */
const ART_ID: Readonly<Record<string, string>> = { grandpaWink: 'wink' };

/** A hiker as a minigame draws them. `color`: their party color in a run, when there is one. */
export function minigameHiker(id: string, color?: string): MinigameHiker {
  const roster = ROSTER_BY_ID.get(id);
  const art = ART_ID[id] ?? id;
  return {
    id,
    name: roster?.name.replace(/^Grandpa /, '') ?? id,
    color: color ?? COLORS[art] ?? '#C9C2B2',
    art,
  };
}

/** The art ids that have minigame sprites. */
export const HIKER_ART: readonly string[] = Object.keys(COLORS);
