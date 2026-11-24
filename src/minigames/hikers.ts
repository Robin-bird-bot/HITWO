/**
 * How each hiker looks in a minigame (docs/design/10-minigames.md, "Art
 * style"): a silhouette whose rim light and bandana are the hiker's own
 * color, the same color that rings their portrait. A hiker in a run uses
 * their party color; otherwise their color from Bearrels' layout.json.
 */
import { ROSTER_BY_ID } from '../content/roster';
import type { MinigameHiker, SilhouetteShape } from './types';
import LAYOUT from '../../public/assets/minigames/bearrels/layout.json';

const COLORS: Readonly<Record<string, string>> = LAYOUT.hikerColors;
const SHAPES: Readonly<Record<string, string>> = LAYOUT.shapes;
/** Roster ids that the art names differently. */
const ART_ID: Readonly<Record<string, string>> = { grandpaWink: 'wink' };

const SHAPE_IDS: readonly SilhouetteShape[] = [
  'dog-floppy',
  'dog-fluffy',
  'hat',
  'messy',
  'curly',
  'bald',
];
const isShape = (s: string | undefined): s is SilhouetteShape =>
  !!s && (SHAPE_IDS as readonly string[]).includes(s);

/** The scene's inks (layout.json `inks`). */
export const INKS: Readonly<Record<string, string>> = LAYOUT.inks;

/** A hiker as a minigame draws them. `color`: their party color in a run, when there is one. */
export function minigameHiker(id: string, color?: string): MinigameHiker {
  const roster = ROSTER_BY_ID.get(id);
  const art = ART_ID[id] ?? id;
  const shape = SHAPES[art];
  return {
    id,
    name: roster?.name.replace(/^Grandpa /, '') ?? id,
    color: color ?? COLORS[art] ?? '#C9C2B2',
    // A future hiker: a dog gets the floppy dog, anyone else the messy hair.
    shape: isShape(shape) ? shape : roster?.family === 'dog' ? 'dog-floppy' : 'messy',
  };
}
