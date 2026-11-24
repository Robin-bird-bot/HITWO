/**
 * Bearrels' scene geometry, from Wyatt's SVG parts (barrel.svg, bear-*.svg):
 * the barrel's outline and where it goes, and the bear's rock.
 */
import type { BarrelBox } from '../../../minigames/bearrels/logic';

export const BARREL = 'M16 432 Q4 507 16 596 Q100 610 184 596 Q196 507 184 432 Q100 412 16 432Z';
/** The barrel art's own width and top (barrel.svg). */
const ART = { width: 168, top: 420, center: 100 };

/** Where a barrel's art goes: centered on its box, scaled to its width. */
export const barrelTransform = (b: BarrelBox) => {
  const k = b.width / ART.width;
  return `translate(${b.x - ART.center * k} ${b.top - ART.top * k}) scale(${k})`;
};

/** How far down the bear sits when hidden: only its ears show over the rock. */
export const BEAR_HIDDEN_Y = 252;
export const ROCK = 'M400 430 C450 380 530 370 640 372 C750 370 830 380 880 430 L880 450 L400 450Z';
