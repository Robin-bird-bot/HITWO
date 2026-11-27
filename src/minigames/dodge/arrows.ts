/**
 * Red arrows on the attacks that move across the box
 * (docs/design/26-fixes-and-wyatt-trees.md, section 3.1; mockups 56 and 57):
 * during the warning they show which way the attack will go, blinking; they
 * fade once it starts moving.
 *
 * - **Comb-Over:** [4] arrows in front of the hair wall, pointing the way it
 *   sweeps (none across the gap).
 * - **Avalanche:** a down arrow under each falling column (none over the gap).
 * - **Antler Charge, Swoop, Wing Gust and Tail Sweep** (Claude's idea):
 *   arrows along the path, pointing the way it goes.
 *
 * Every attack with `movesAcross` has arrows here; nothing else does.
 */
import { BALANCE } from '../../config/balance';
import { avalancheColumns, tailBand } from './attacks/snow';
import { edges, type Box } from './geometry';
import type { Point } from './shapes';
import type { Part } from './types';

const D = BALANCE.minigames.dodge;
const A = D.arrows;

/** An arrow's middle and the way it points (degrees: 0 is right, 90 is down). */
export interface MoveArrow {
  x: number;
  y: number;
  angle: number;
}

/** How visible a part's arrows are now: fully during the warning, fading once it moves. */
export function arrowFade(p: Pick<Part, 'warnAt' | 'activeAt'>, time: number): number {
  if (time < p.warnAt) return 0;
  if (time < p.activeAt) return 1;
  return Math.max(0, 1 - (time - p.activeAt) / A.fadeSec);
}

const angleOf = (d: Point) => (Math.atan2(d.y, d.x) * 180) / Math.PI;

/** `n` arrows spread along a line from `a` to `b`, pointing from a to b. */
function along(a: Point, b: Point, n: number): MoveArrow[] {
  const angle = angleOf({ x: b.x - a.x, y: b.y - a.y });
  return Array.from({ length: n }, (_, k) => {
    const u = (k + 1) / (n + 1);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle };
  });
}

/** The part of a line through `at` (along `dir`) that's inside the box. */
function acrossBox(at: Point, dir: Point, box: Box): [Point, Point] {
  const e = edges(box);
  if (Math.abs(dir.x) >= Math.abs(dir.y)) {
    const y = at.y;
    return dir.x >= 0
      ? [
          { x: e.left, y },
          { x: e.right, y },
        ]
      : [
          { x: e.right, y },
          { x: e.left, y },
        ];
  }
  const x = at.x;
  return dir.y >= 0
    ? [
        { x, y: e.top },
        { x, y: e.bottom },
      ]
    : [
        { x, y: e.bottom },
        { x, y: e.top },
      ];
}

/** The arrows a part shows during its warning (none for parts that don't move across). */
export function moveArrows(p: Part, box: Box): MoveArrow[] {
  const e = edges(box);
  switch (p.kind) {
    case 'comb': {
      // Just in front of the hatched strip the wall comes in from.
      const dir = p.side === 'left' ? 1 : -1;
      const x = p.side === 'left' ? e.left + 20 : e.right - 20;
      // [4] arrows spread over the wall above and below the gap, by how much wall there is.
      const half = D.eagle.comb.gap / 2 + 3;
      const parts = [
        [e.top, p.gapAt - half],
        [p.gapAt + half, e.bottom],
      ].filter(([a, b]) => b! - a! > 6) as [number, number][];
      const total = parts.reduce((n, [a, b]) => n + (b - a), 0);
      const counts = parts.map(([a, b]) => Math.floor((A.comb * (b - a)) / total));
      // The ones left over go to the longest stretches.
      const rest = parts
        .map(([a, b], k) => ({ k, extra: (A.comb * (b - a)) / total - counts[k]! }))
        .sort((x, y) => y.extra - x.extra);
      for (let k = 0; counts.reduce((n, c) => n + c, 0) < A.comb; k++)
        counts[rest[k % rest.length]!.k]!++;
      return parts.flatMap(([a, b], k) =>
        Array.from({ length: counts[k]! }, (_, j) => ({
          x,
          y: a + ((j + 0.5) * (b - a)) / counts[k]!,
          angle: dir === 1 ? 0 : 180,
        })),
      );
    }
    case 'avalanche':
      return avalancheColumns(p, box).map((c) => ({
        x: c.x + c.w / 2,
        y: e.top + D.snow.avalanche.band / 2 + 8,
        angle: 90,
      }));
    case 'charge': {
      const [a, b] = acrossBox(p.from, p.dir, box);
      return along(a, b, A.along);
    }
    case 'swoop':
      return along(p.from, p.to, A.along);
    case 'gust': {
      // Across the middle of the box, the way it pushes.
      const dir = { x: p.dir, y: 0 };
      return [0.3, 0.5, 0.7].map((u) => ({
        x: e.left + box.w / 2,
        y: e.top + box.h * u,
        angle: angleOf(dir),
      }));
    }
    case 'tail': {
      // Along the band it sweeps: across the bottom, or down a side.
      const b = tailBand(p, box);
      const way = p.id % 2 === 0 ? 1 : -1;
      if (p.side === 'bottom') {
        const y = b.y + b.h / 2;
        const [l, r] = [b.x, b.x + b.w];
        return way === 1
          ? along({ x: l, y }, { x: r, y }, A.along)
          : along({ x: r, y }, { x: l, y }, A.along);
      }
      const x = b.x + b.w / 2;
      const [t, bot] = [b.y, b.y + b.h];
      return way === 1
        ? along({ x, y: t }, { x, y: bot }, A.along)
        : along({ x, y: bot }, { x, y: t }, A.along);
    }
    default:
      return [];
  }
}
