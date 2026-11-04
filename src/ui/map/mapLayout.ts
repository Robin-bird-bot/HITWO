/**
 * Map geometry and the camera, in stage pixels (the 1600×1000 stage).
 * Sizes follow docs/mockups/Main.dc.html: 112×128 hexes, tiles in a row
 * 256 px apart (128 px per half-step), rows 152 px apart.
 *
 * World coordinates: a tile's centre is at (col × 128, rowsFromTop × 152),
 * so the checkpoint is at the top and the trailhead at the bottom.
 */
import type { Section, Tile } from '../../engine';

export const HEX = { w: 112, h: 128 };
export const CHECKPOINT_HEX = { w: 136, h: 156 };
export const HALF_STEP = 128;
export const ROW_STEP = 152;

/** The open area of the stage between the side panels, where the map is centred. */
export const MAP_VIEW = { x: 312, y: 0, w: 912, h: 1000 };
export const ZOOM = { min: 0.5, max: 1.5, default: 1, step: 1.25 };

/** Room around the trail: under the top bar, beside it, and above the bottom edge. */
const PAD = { top: 200, bottom: 110, side: 170 };

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The world point shown at the centre of MAP_VIEW, and the zoom. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function lastRowOf(section: Section): number {
  return Math.max(...Object.values(section.tiles).map((t) => t.row));
}

export function tileCenter(tile: Tile, lastRow: number): Point {
  return { x: tile.col * HALF_STEP, y: (lastRow - tile.row) * ROW_STEP };
}

export function mapBounds(section: Section): Bounds {
  const lastRow = lastRowOf(section);
  const centers = Object.values(section.tiles).map((t) => tileCenter(t, lastRow));
  const xs = centers.map((c) => c.x);
  const ys = centers.map((c) => c.y);
  return {
    minX: Math.min(...xs) - HEX.w / 2 - PAD.side,
    maxX: Math.max(...xs) + HEX.w / 2 + PAD.side,
    minY: Math.min(...ys) - CHECKPOINT_HEX.h / 2 - PAD.top,
    maxY: Math.max(...ys) + HEX.h / 2 + PAD.bottom,
  };
}

/** Keeps the camera inside the map. A map smaller than the view is centred. */
export function clampCamera(cam: Camera, b: Bounds): Camera {
  const zoom = clamp(cam.zoom, ZOOM.min, ZOOM.max);
  const halfW = MAP_VIEW.w / 2 / zoom;
  const halfH = MAP_VIEW.h / 2 / zoom;
  const axis = (v: number, min: number, max: number, half: number) =>
    max - min <= 2 * half ? (min + max) / 2 : clamp(v, min + half, max - half);
  return { zoom, x: axis(cam.x, b.minX, b.maxX, halfW), y: axis(cam.y, b.minY, b.maxY, halfH) };
}

const viewCenter = (): Point => ({
  x: MAP_VIEW.x + MAP_VIEW.w / 2,
  y: MAP_VIEW.y + MAP_VIEW.h / 2,
});

export function worldToStage(cam: Camera, p: Point): Point {
  const c = viewCenter();
  return { x: c.x + (p.x - cam.x) * cam.zoom, y: c.y + (p.y - cam.y) * cam.zoom };
}

export function stageToWorld(cam: Camera, s: Point): Point {
  const c = viewCenter();
  return { x: cam.x + (s.x - c.x) / cam.zoom, y: cam.y + (s.y - c.y) / cam.zoom };
}

/** Zooms by a factor, keeping the world point under `anchor` (a stage point) still. */
export function zoomAt(cam: Camera, factor: number, anchor: Point, b: Bounds): Camera {
  const fixed = stageToWorld(cam, anchor);
  const zoom = clamp(cam.zoom * factor, ZOOM.min, ZOOM.max);
  const c = viewCenter();
  return clampCamera(
    { zoom, x: fixed.x - (anchor.x - c.x) / zoom, y: fixed.y - (anchor.y - c.y) / zoom },
    b,
  );
}

/** Moves the camera by a drag of (dx, dy) stage pixels. */
export function panBy(cam: Camera, dx: number, dy: number, b: Bounds): Camera {
  return clampCamera({ ...cam, x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom }, b);
}

/** Centres the camera on a point, as far as the map's edges allow. */
export function focusOn(p: Point, zoom: number, b: Bounds): Camera {
  return clampCamera({ x: p.x, y: p.y, zoom }, b);
}

/** CSS transform placing world coordinates on the stage. */
export function worldTransform(cam: Camera): string {
  const c = viewCenter();
  return `translate(${c.x - cam.x * cam.zoom}px, ${c.y - cam.y * cam.zoom}px) scale(${cam.zoom})`;
}

/** How far the map has scrolled up from its lowest position, in stage pixels (for parallax). */
export function scrollAbove(cam: Camera, b: Bounds): number {
  const lowest = clampCamera({ ...cam, y: Number.POSITIVE_INFINITY }, b).y;
  return Math.max(0, (lowest - cam.y) * cam.zoom);
}

/** The part of the map's height the camera shows, as fractions from the top (for the rail). */
export function visibleRange(cam: Camera, b: Bounds): { top: number; bottom: number } {
  const halfH = MAP_VIEW.h / 2 / cam.zoom;
  const h = b.maxY - b.minY;
  return {
    top: clamp((cam.y - halfH - b.minY) / h, 0, 1),
    bottom: clamp((cam.y + halfH - b.minY) / h, 0, 1),
  };
}

/** A world y as a fraction of the map's height, from the top. */
export function heightRatio(y: number, b: Bounds): number {
  return clamp((y - b.minY) / (b.maxY - b.minY), 0, 1);
}
