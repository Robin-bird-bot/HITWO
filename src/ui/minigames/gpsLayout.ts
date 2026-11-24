/**
 * The party GPS's lifted size (docs/design/10-minigames.md, "The party GPS"),
 * in stage pixels (1600 × 1000). The screen is 16:9 and as large as fits, up
 * to 88% of the width. On a phone in landscape the side controls shrink, so
 * the screen gets at least 80% of the height.
 */
import { BALANCE } from '../../config/balance';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';

const G = BALANCE.minigames.gps;

/** The screen's own size: minigames are laid out at 1280 × 720 and scaled to fit. */
export const SCREEN = { width: 1280, height: 720 } as const;

export interface GpsSize {
  /** The whole handheld. */
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
  /** Each side's controls (D-pad, buttons). */
  side: number;
  /** The yellow rim, the dark face's padding, the bezel and the TRAILMATE label. */
  rim: number;
  pad: number;
  bezel: number;
  label: number;
}

const MARGIN = 16;

export function gpsSize(phone: boolean): GpsSize {
  const rim = 14;
  const bezel = 10;
  const pad = phone ? 12 : 22;
  const label = phone ? 22 : 30;
  // The height the chrome takes, top to bottom, besides the screen.
  const chromeH = 2 * rim + 2 * pad + 2 * bezel + label;
  if (phone) {
    // The screen first: at least 80% of the height, then whatever the sides can have.
    const screenHeight = STAGE_HEIGHT * G.phoneScreenHeight;
    const screenWidth = (screenHeight * 16) / 9;
    const side = Math.max(36, (STAGE_WIDTH - 2 * MARGIN - screenWidth - 2 * rim - 2 * bezel) / 2);
    return finish({ screenWidth, screenHeight, side, rim, pad, bezel, label });
  }
  const side = 118;
  const byWidth = STAGE_WIDTH - 2 * MARGIN - 2 * side - 2 * rim - 2 * bezel;
  const byHeight = ((STAGE_HEIGHT - 2 * MARGIN - chromeH) * 16) / 9;
  const screenWidth = Math.min(STAGE_WIDTH * G.maxScreenWidth, byWidth, byHeight);
  return finish({
    screenWidth,
    screenHeight: (screenWidth * 9) / 16,
    side,
    rim,
    pad,
    bezel,
    label,
  });
}

function finish(s: Omit<GpsSize, 'width' | 'height'>): GpsSize {
  return {
    ...s,
    width: s.screenWidth + 2 * s.side + 2 * s.rim + 2 * s.bezel,
    height: s.screenHeight + 2 * s.rim + 2 * s.pad + 2 * s.bezel + s.label,
  };
}
