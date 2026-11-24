/**
 * The Skill Trails map's shape (skill-trails-window.jpg, look A): one
 * trailhead at the bottom, a short trunk to a fork, and three trails winding
 * gently up to three columns of steps, plus the topographic lines behind.
 * Worked out from the map's size, in its own pixels. Pure.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface TrailColumn {
  x: number;
  /** Where the tree's name sits. */
  nameY: number;
  /** The steps, Tier 1 first. */
  nodes: [Pt, Pt, Pt];
  /** The path up to each step: from the fork to Tier 1, then step to step. */
  paths: [string, string, string];
}

export interface TrailMapShape {
  width: number;
  height: number;
  trailhead: Pt;
  fork: Pt;
  trunk: string;
  columns: [TrailColumn, TrailColumn, TrailColumn];
  /** Contour lines for the dark topographic background. */
  contours: string[];
}

const f = (n: number) => n.toFixed(1);

/** A gentle S between two points straight above each other, bending to `side`. */
function wind(a: Pt, b: Pt, side: number): string {
  const dy = a.y - b.y;
  return `M${f(a.x)} ${f(a.y)} C${f(a.x + 30 * side)} ${f(a.y - dy * 0.35)} ${f(b.x - 30 * side)} ${f(
    b.y + dy * 0.35,
  )} ${f(b.x)} ${f(b.y)}`;
}

/** From the fork out to a column's first step: across, then up. */
function branch(fork: Pt, to: Pt): string {
  const dx = to.x - fork.x;
  if (Math.abs(dx) < 1) {
    return `M${f(fork.x)} ${f(fork.y)} C${f(fork.x - 24)} ${f(fork.y - 30)} ${f(to.x + 24)} ${f(
      to.y + 50,
    )} ${f(to.x)} ${f(to.y)}`;
  }
  return `M${f(fork.x)} ${f(fork.y)} C${f(fork.x + dx * 0.45)} ${f(fork.y + 6)} ${f(to.x - dx * 0.1)} ${f(
    to.y + (fork.y - to.y) * 0.75,
  )} ${f(to.x)} ${f(to.y)}`;
}

/** A small, stable hash in 0–1 (no randomness: the same map every time). */
const hash = (n: number) => {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

/** Wavy closed loops around a few hill tops. */
function contourLines(w: number, h: number): string[] {
  const hills = [
    { x: w * 0.18, y: h * 0.3, r: w * 0.05 },
    { x: w * 0.62, y: h * 0.22, r: w * 0.04 },
    { x: w * 0.85, y: h * 0.7, r: w * 0.05 },
    { x: w * 0.38, y: h * 0.78, r: w * 0.035 },
  ];
  const out: string[] = [];
  hills.forEach((hill, k) => {
    for (let ring = 0; ring < 6; ring++) {
      const r = hill.r * (1 + ring * 0.75);
      const pts: Pt[] = [];
      const n = 28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const wobble =
          1 + 0.18 * Math.sin(a * 3 + k + ring * 0.7) + 0.08 * (hash(k * 97 + ring * 13 + i) - 0.5);
        pts.push({
          x: hill.x + Math.cos(a) * r * wobble * 1.35,
          y: hill.y + Math.sin(a) * r * wobble,
        });
      }
      // A smooth closed curve through the points (midpoint quadratics).
      const mid = (p: Pt, q: Pt) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      const start = mid(pts[n - 1]!, pts[0]!);
      let d = `M${f(start.x)} ${f(start.y)}`;
      for (let i = 0; i < n; i++) {
        const p = pts[i]!;
        const m = mid(p, pts[(i + 1) % n]!);
        d += ` Q${f(p.x)} ${f(p.y)} ${f(m.x)} ${f(m.y)}`;
      }
      out.push(`${d} Z`);
    }
  });
  return out;
}

export function trailMap(width: number, height: number): TrailMapShape {
  const trailhead = { x: width / 2, y: height - 52 };
  const fork = { x: width / 2, y: height * 0.84 };
  const tierY = [height * 0.71, height * 0.45, height * 0.2] as const;
  const xs = [width * 0.19, width * 0.5, width * 0.81] as const;
  const columns = xs.map((x, c): TrailColumn => {
    const nodes: [Pt, Pt, Pt] = [
      { x, y: tierY[0] },
      { x, y: tierY[1] },
      { x, y: tierY[2] },
    ];
    const side = c === 0 ? -1 : 1;
    return {
      x,
      nameY: 62,
      nodes,
      paths: [
        branch(fork, nodes[0]),
        wind(nodes[0], nodes[1], side),
        wind(nodes[1], nodes[2], -side),
      ],
    };
  }) as [TrailColumn, TrailColumn, TrailColumn];
  return {
    width,
    height,
    trailhead,
    fork,
    trunk: `M${f(trailhead.x)} ${f(trailhead.y)} C${f(trailhead.x - 6)} ${f(trailhead.y - 30)} ${f(
      fork.x + 6,
    )} ${f(fork.y + 30)} ${f(fork.x)} ${f(fork.y)}`,
    columns,
    contours: contourLines(width, height),
  };
}
