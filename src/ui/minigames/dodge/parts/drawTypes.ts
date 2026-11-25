/**
 * How Dodge draws its parts: each kind of part can draw on three layers,
 * all in scene units (320 × 240):
 *
 * - `svg`: inside the box, under the sprite (warnings, shadows, rings, puddles);
 * - `over`: inside the box, over the sprite (bees, claws, acorns, blades);
 * - `outside`: on the whole screen, not clipped (the "!" marks, arrows, the
 *   squirrels popping up, the sweep's sword).
 */
import type { ReactNode } from 'react';
import { asset } from '../../../../config/assets';
import type { Box, Part } from '../../../../minigames/dodge/logic';

export interface DrawCtx {
  time: number;
  /** The box as it is now (squeezed by a hug, if one is on), and its walls. */
  box: Box;
  left: number;
  right: number;
  top: number;
  bottom: number;
  beeFrame: string;
  reduced: boolean;
}

export interface PartDrawing<P extends Part> {
  svg?(p: P, c: DrawCtx): ReactNode;
  /** Inside the box, under the sprite, as page elements (the sweep's hatching). */
  under?(p: P, c: DrawCtx): ReactNode;
  over?(p: P, c: DrawCtx): ReactNode;
  outside?(p: P, c: DrawCtx): ReactNode;
}

export type DrawTable<K extends Part['kind']> = {
  [Kind in K]: PartDrawing<Extract<Part, { kind: Kind }>>;
};

export const art = (f: string) => asset(`minigames/dodge/${f}`);

export const LIGHT = '#d3dfaf';
export const MID = '#a0b37d';
export const DARK = '#0f170c';

export const deg = (radians: number) => (radians * 180) / Math.PI;

/** A path through points, for SVG. */
export const pathOf = (points: readonly { x: number; y: number }[]) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

/** An arc around (cx, cy) from angle a0 to a1 (radians), for SVG. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const sweep = a1 - a0;
  const large = Math.abs(sweep) > Math.PI ? 1 : 0;
  const dir = sweep >= 0 ? 1 : 0;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} ${dir} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
