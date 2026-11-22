/**
 * Where the illustrated map's corner pieces sit (map-corners update): the
 * section box in the land's bottom-left corner and the compass in its
 * top-right, about `inset` in. Place names keep clear of both.
 */
import { MAP_STYLE, u } from '../../../../config/mapStyle';

const C = MAP_STYLE.corners;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Where the corner pieces go: about `inset` in from the land's corners (map-corners update). */
export function cornerBoxes(land: { x0: number; y0: number; width: number; height: number }): {
  section: Box;
  compass: Box;
} {
  const inset = u(C.inset);
  const box = { w: u(C.box.w), h: u(C.box.h) };
  const size = u(C.compass);
  // The compass's N sits above it, inside its box.
  const n = size * 0.25;
  return {
    section: {
      x0: land.x0 + inset,
      y0: land.y0 + land.height - inset - box.h,
      x1: land.x0 + inset + box.w,
      y1: land.y0 + land.height - inset,
    },
    compass: {
      x0: land.x0 + land.width - inset - size,
      y0: land.y0 + inset,
      x1: land.x0 + land.width - inset,
      y1: land.y0 + inset + size + n,
    },
  };
}
