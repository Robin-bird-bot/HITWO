/**
 * What a hiker's picture is made of (Phase 10b, docs/ASSETS.md):
 *
 * - Wyatt's **portrait**, framed for the card's 750 × 620 window, on the
 *   window's forest backdrop. `portraits.json` gives each one's `faceY` for
 *   the views that only show part of it.
 * - No portrait yet: the hiker's **family icon** (Ben, Mindy), or the
 *   **variant star**, in the middle of the window.
 * - The old placeholder party and the dev test hikers keep their **image**:
 *   the placeholder portrait, or initials on their color.
 *
 * Pure apart from the asset paths, so it's easy to test.
 */
import { asset, ASSETS } from '../../config/assets';
import { characterFor } from '../../content/characters';
import { ROSTER_BY_ID, type RosterHiker } from '../../content/roster';

/** The family icons in public/assets/cards/family/ (white, drawn in #1A1A1A through a mask). */
export type FamilyIcon = 'human' | 'dog' | 'cat' | 'plush' | 'duo' | 'variant';
export const FAMILY_ICONS: readonly FamilyIcon[] = [
  'human',
  'dog',
  'cat',
  'plush',
  'duo',
  'variant',
];
export const familyIconSrc = (icon: FamilyIcon): string => asset(`cards/family/${icon}.png`);

/** A hiker's family icon: a Duo has its own, everyone else their family's. */
export function familyIcon(hiker: Pick<RosterHiker, 'family' | 'duo'>): FamilyIcon {
  return hiker.duo ? 'duo' : hiker.family;
}

/** The portrait window's shape (750 × 620). */
export const WINDOW_ASPECT = 750 / 620;

/** Where the face sits when portraits.json doesn't say: a little above the middle. */
const FACE_Y_DEFAULT = 0.4;

type PortraitsJson = Record<string, { hiker: string; faceY: number }>;
const JSON_FILES = import.meta.glob<PortraitsJson>('/public/assets/portraits/portraits.json', {
  eager: true,
  import: 'default',
});
/** portraits.json, by file name without `.png`. */
export const FACE_Y: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(Object.values(JSON_FILES)[0] ?? {}).map(([file, v]) => [
    file.replace(/\.png$/, ''),
    v.faceY,
  ]),
);

export type PortraitArt =
  | { kind: 'portrait'; src: string; faceY: number }
  | { kind: 'icon'; icon: FamilyIcon }
  | { kind: 'image'; src: string };

const initialsCache = new Map<string, string>();

/** A test hiker's initials on a square of their color, as an image. */
function initialsSrc(hikerId: string, color: string, initials: string): string {
  const hit = initialsCache.get(hikerId);
  if (hit) return hit;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${color}"/>` +
    `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="40" fill="#1D2220">${initials}</text></svg>`;
  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  initialsCache.set(hikerId, src);
  return src;
}

/** What to draw for a hiker (or a roster id on the selection screen). */
export function portraitArt(hikerId: string): PortraitArt {
  const roster = ROSTER_BY_ID.get(hikerId);
  if (roster) {
    if (roster.portrait) {
      return {
        kind: 'portrait',
        src: asset(`portraits/${roster.portrait}.png`),
        faceY: FACE_Y[roster.portrait] ?? FACE_Y_DEFAULT,
      };
    }
    return { kind: 'icon', icon: roster.variantOf ? 'variant' : familyIcon(roster) };
  }
  const c = characterFor(hikerId);
  if (c.portrait === 'initials') {
    return { kind: 'image', src: initialsSrc(hikerId, c.color, c.initials ?? '?') };
  }
  return { kind: 'image', src: ASSETS.portraits.placeholder };
}

/**
 * Where the portrait window goes inside a box so the face sits in the
 * middle, as percentages of the box (left and width of its width, top of its
 * height). `zoom` is the window's width as a share of the box's; the window
 * always covers the box, so its edges never show.
 */
export function cropWindow(
  boxAspect: number,
  zoom: number,
  faceY: number,
): { left: number; top: number; width: number } {
  const width = Math.max(zoom, WINDOW_ASPECT / boxAspect);
  const height = (width * boxAspect) / WINDOW_ASPECT; // as a share of the box's height
  const top = Math.min(0, Math.max(1 - height, 0.5 - faceY * height));
  return { left: ((1 - width) / 2) * 100, top: top * 100, width: width * 100 };
}
