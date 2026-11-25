/**
 * The party GPS's geometry (docs/design/10-minigames.md, "The party GPS"), in
 * stage pixels (1600 × 1000).
 *
 * The handheld is drawn upright in its own units around a 3:4 screen
 * (600 × 800). In the pop-up it sits small in its slot; on Start it turns 90°
 * clockwise and grows until its screen, now 4:3 landscape, is as large as
 * fits: up to 92% of the width and 86% of the height, or almost the whole
 * height on a phone. The body may run past the window's edge; the screen never does.
 */
import { BALANCE } from '../../config/balance';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';

const G = BALANCE.minigames.gps;

/** The upright handheld, in its own units. */
export const DEVICE = {
  screen: { w: 600, h: 800 },
  /** From the body's left and right edges to the screen. */
  side: 30,
  /** From the body's top to the screen, and from the screen to the bottom (TRAILMATE, the knob). */
  top: 38,
  bottom: 196,
  /** The antenna nub above the top edge, near the left. */
  nub: { left: 78, w: 84, h: 46 },
  width: 0,
  height: 0,
};
DEVICE.width = DEVICE.screen.w + 2 * DEVICE.side;
DEVICE.height = DEVICE.top + DEVICE.screen.h + DEVICE.bottom;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TurnedGps {
  /** Stage pixels per device unit, once turned. */
  unit: number;
  /** The device's middle (the body's, not counting the nub). */
  center: { x: number; y: number };
  /** The turned body and its 4:3 screen. */
  body: Rect;
  screen: Rect;
}

/** The GPS turned sideways, as large as it gets. */
export function gpsTurned(phone: boolean): TurnedGps {
  const screenHeight = phone
    ? STAGE_HEIGHT * G.phoneScreenHeight
    : Math.min(STAGE_HEIGHT * G.maxScreenHeight, (STAGE_WIDTH * G.maxScreenWidth * 3) / 4);
  // Turned, the upright screen's width is its height.
  const unit = screenHeight / DEVICE.screen.w;
  const bodyWidth = DEVICE.height * unit;
  const bodyHeight = DEVICE.width * unit;
  // The upright screen sits above the body's middle; turned clockwise, it's to the right.
  const screenShift = (DEVICE.height / 2 - (DEVICE.top + DEVICE.screen.h / 2)) * unit;
  const screenWidth = DEVICE.screen.h * unit;
  // The nub ends up on the right: center body and nub together, then keep the screen inside.
  let cx = STAGE_WIDTH / 2 - (DEVICE.nub.h * unit) / 2;
  const margin = 8;
  const screenLeft = () => cx + screenShift - screenWidth / 2;
  if (screenLeft() < margin) cx += margin - screenLeft();
  if (screenLeft() + screenWidth > STAGE_WIDTH - margin) {
    cx -= screenLeft() + screenWidth - (STAGE_WIDTH - margin);
  }
  const cy = STAGE_HEIGHT / 2;
  return {
    unit,
    center: { x: cx, y: cy },
    body: {
      left: cx - bodyWidth / 2,
      top: cy - bodyHeight / 2,
      width: bodyWidth,
      height: bodyHeight,
    },
    screen: {
      left: screenLeft(),
      top: cy - screenHeight / 2,
      width: screenWidth,
      height: screenHeight,
    },
  };
}

/**
 * The GPS upright in its slot in the pop-up (stage pixels): how far it moves
 * from the turned middle, and how small it is, nub included.
 */
export function gpsUpright(
  turned: TurnedGps,
  slot: Rect,
): { dx: number; dy: number; scale: number } {
  const fullHeight = (DEVICE.height + DEVICE.nub.h) * turned.unit;
  const scale = Math.min(slot.height / fullHeight, slot.width / (DEVICE.width * turned.unit));
  // The nub is above the body: the body's middle is half a nub below the slot's.
  const bodyMiddle = slot.top + slot.height / 2 + (DEVICE.nub.h * turned.unit * scale) / 2;
  return {
    dx: slot.left + slot.width / 2 - turned.center.x,
    dy: bodyMiddle - turned.center.y,
    scale,
  };
}

/** The device's transform, upright in its slot or turned in the middle. */
export function gpsTransform(
  pose: 'upright' | 'turned',
  upright: { dx: number; dy: number; scale: number },
): string {
  return pose === 'turned'
    ? 'translate(0px, 0px) rotate(90deg) scale(1)'
    : `translate(${upright.dx}px, ${upright.dy}px) rotate(0deg) scale(${upright.scale})`;
}

/**
 * How it changes pose: a turn (it spins and grows), or with reduced motion a
 * crossfade (it fades out, changes place, and fades back in; no spin).
 */
export function gpsMotion(
  reduced: boolean,
  to: 'upright' | 'turned',
): { kind: 'turn' | 'crossfade'; ms: number } {
  return { kind: reduced ? 'crossfade' : 'turn', ms: to === 'turned' ? G.turnMs : G.returnMs };
}

/** Where the test mode's Style button goes: the turned body's knob end, top corner, kept on the stage. */
export function styleButtonSpot(turned: TurnedGps): { left: number; top: number } {
  return {
    left: Math.max(10, turned.body.left + 34),
    top: Math.max(10, turned.body.top + 60),
  };
}

/**
 * What the scanlines do: they belong to the glass, so they turn with the GPS
 * (across when upright, up and down once turned). During play they drift
 * sideways and a soft band sweeps across; with reduced motion they stay still.
 */
export function scanlineMotion(
  playing: boolean,
  reduced: boolean,
): { drift: boolean; band: boolean } {
  const moving = playing && !reduced;
  return { drift: moving, band: moving };
}
