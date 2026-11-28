/**
 * The scavenge window's poster (35-ui-overhaul.md, section 5): a scene drawn
 * for the tile's node in flat two-tone shapes, like a park poster, so it
 * stays sharp at any size. Pines for Forest, a river valley for River, hills
 * with deer for Wildlife, snowy peaks for Mountain; a sun with rays behind.
 * Ported from the prototype's `sceneSVG`, seeded by the tile's id so a tile's
 * poster never changes between visits (Claude's idea).
 */
import { ASSETS } from '../../config/assets';
import type { NodeType } from '../../engine';

const W = 1000;
const H = 208;

/** The prototype's small seeded random (mulberry32). */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = {
  forest: {
    sky: ['#eaf0d9', '#c9dcbb'],
    sun: '#fbf3d5',
    far: '#a7c29f',
    lit: ['#79a684', '#4f7f61'],
    dark: ['#557f63', '#2d5441'],
  },
  river: {
    sky: ['#e9f1f3', '#c3d8e4'],
    sun: '#fbf6e3',
    far: '#a3b9c9',
    farD: '#87a1b5',
    lit: ['#6f97b3', '#3f6c8c'],
    dark: ['#4f7896', '#264a66'],
    water: '#a8d4ea',
  },
  wildlife: {
    sky: ['#f7e8c4', '#efcd94'],
    sun: '#fff3d2',
    far: '#dcb984',
    mid: '#bb915a',
    midD: '#9c7444',
    ground: '#6c5233',
  },
  mountain: {
    sky: ['#eff1f0', '#d3d9db'],
    sun: '#fbf8ee',
    lit: ['#cfd3d5', '#a5abb0'],
    dark: ['#8f959a', '#6c7277'],
    ground: '#55524c',
  },
} as const;

type Shape =
  | { kind: 'polygon'; points: string; fill: string }
  | { kind: 'path'; d: string; fill?: string; stroke?: string; width?: number };

/** The shapes of one node's scene, in drawing order. */
function sceneShapes(
  node: NodeType,
  seed: number,
): { shapes: Shape[]; sun: { x: number; y: number; r: number } } {
  const r = rng(seed);
  const R = (a: number, b: number) => a + r() * (b - a);
  const out: Shape[] = [];
  const poly = (points: string, fill: string) => out.push({ kind: 'polygon', points, fill });
  const tree = (x: number, base: number, h: number, lit: string, dark: string) => {
    poly(
      `${x - h * 0.035},${base - h * 0.08} ${x + h * 0.035},${base - h * 0.08} ${x + h * 0.035},${base + h * 0.02} ${x - h * 0.035},${base + h * 0.02}`,
      '#3b2a1e',
    );
    for (let i = 0; i < 3; i++) {
      const ay = base - h + i * h * 0.27;
      const by = ay + h * 0.46;
      const hw = h * (0.2 + 0.07 * i);
      poly(`${x},${ay} ${x - hw},${by} ${x},${by}`, lit);
      poly(`${x},${ay} ${x},${by} ${x + hw},${by}`, dark);
    }
  };
  const peak = (
    x: number,
    base: number,
    w: number,
    h: number,
    lit: string,
    dark: string,
    snow: boolean,
  ) => {
    const ax = x + R(-w * 0.08, w * 0.08);
    const ay = base - h;
    const m = ax + w * 0.07;
    poly(`${x - w / 2},${base} ${ax},${ay} ${m},${base}`, lit);
    poly(`${ax},${ay} ${x + w / 2},${base} ${m},${base}`, dark);
    if (snow) {
      poly(
        `${ax},${ay} ${ax - w * 0.11},${ay + h * 0.26} ${ax - w * 0.04},${ay + h * 0.2} ${ax + w * 0.02},${ay + h * 0.29} ${ax + w * 0.1},${ay + h * 0.23}`,
        '#f6f6f1',
      );
    }
  };
  const hills = (y: number, amp: number, fill: string, k = 5) => {
    let d = `M0 ${H} L0 ${y}`;
    for (let i = 0; i < k; i++) {
      const x0 = (i * W) / k;
      const x1 = ((i + 1) * W) / k;
      d += ` Q${(x0 + x1) / 2} ${y - R(amp * 0.4, amp)} ${x1} ${y + R(-8, 8)}`;
    }
    out.push({ kind: 'path', d: `${d} L${W} ${H}Z`, fill });
  };

  if (node === 'forest') {
    const p = PALETTE.forest;
    hills(120, 40, p.far, 4);
    for (let x = -10; x < W + 40; x += R(34, 50)) tree(x, 168, R(70, 100), p.lit[0], p.dark[0]);
    for (let x = -30; x < W + 60; x += R(70, 110)) tree(x, 232, R(130, 190), p.lit[1], p.dark[1]);
  } else if (node === 'river') {
    const p = PALETTE.river;
    for (let x = -60; x < W + 100; x += R(120, 190))
      peak(x, 130, R(180, 260), R(60, 95), p.far, p.farD, false);
    out.push({
      kind: 'path',
      d: `M0 ${H} L0 132 Q250 120 470 128 L520 128 Q760 118 ${W} 134 L${W} ${H}Z`,
      fill: p.lit[0],
    });
    out.push({
      kind: 'path',
      d: `M470 128 Q505 150 440 175 Q360 200 300 ${H} L700 ${H} Q600 196 575 170 Q545 145 525 128Z`,
      fill: p.water,
    });
    for (let i = 0; i < 7; i++) {
      const y = 140 + i * 10;
      out.push({
        kind: 'path',
        d: `M${490 - i * 22} ${y} q${14 + i * 3} -3 ${28 + i * 6} 0`,
        stroke: '#e9f6fc',
        width: 2.5,
      });
    }
    for (let x = -20; x < 360; x += R(40, 64)) tree(x, 226, R(120, 170), p.lit[1], p.dark[1]);
    for (let x = 700; x < W + 60; x += R(40, 64)) tree(x, 226, R(120, 170), p.lit[1], p.dark[1]);
  } else if (node === 'wildlife') {
    const p = PALETTE.wildlife;
    hills(126, 36, p.far, 3);
    out.push({
      kind: 'path',
      d: `M0 ${H} L0 150 Q220 104 480 140 Q700 172 ${W} 128 L${W} ${H}Z`,
      fill: p.mid,
    });
    out.push({ kind: 'path', d: `M480 140 Q700 172 ${W} 128 L${W} ${H} L520 ${H}Z`, fill: p.midD });
    out.push({
      kind: 'path',
      d: `M0 ${H} L0 182 Q300 168 600 186 Q820 196 ${W} 176 L${W} ${H}Z`,
      fill: p.ground,
    });
    for (let x = 6; x < W; x += R(16, 30)) {
      const h = R(16, 34);
      out.push({
        kind: 'path',
        d: `M${x} 196 q-2 ${-h * 0.6} -7 ${-h} M${x} 196 q1 ${-h * 0.7} 6 ${-h * 0.95} M${x} 196 l0 ${-h * 0.8}`,
        stroke: '#8d6c42',
        width: 3,
      });
    }
  } else {
    const p = PALETTE.mountain;
    for (let x = -40; x < W + 120; x += R(140, 210))
      peak(x, 150, R(220, 320), R(100, 140), p.lit[0], p.dark[0], true);
    for (let x = -80; x < W + 120; x += R(110, 170))
      peak(x, 190, R(170, 240), R(60, 90), p.lit[1], p.dark[1], r() > 0.5);
    out.push({
      kind: 'path',
      d: `M0 ${H} L0 186 L120 172 L230 188 L380 168 L520 190 L660 174 L800 192 L${W} 170 L${W} ${H}Z`,
      fill: p.ground,
    });
    for (let x = 30; x < W; x += R(110, 200)) tree(x, 214, R(60, 90), '#4f6f5c', '#34503f');
  }
  return {
    shapes: out,
    sun: { x: 790, y: node === 'wildlife' ? 120 : 112, r: node === 'wildlife' ? 74 : 56 },
  };
}

/** One node's poster scene, filling its box (cropped, never stretched). */
export function PosterScene({ node, seed }: { node: NodeType; seed: number }) {
  const { shapes, sun } = sceneShapes(node, seed);
  const p = PALETTE[node];
  const id = `sky-${node}-${seed}`;
  const rays = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const b = a + Math.PI / 56;
    return `${sun.x},${sun.y} ${sun.x + Math.cos(a) * 900},${sun.y + Math.sin(a) * 900} ${sun.x + Math.cos(b) * 900},${sun.y + Math.sin(b) * 900}`;
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
      {rays.map((points, i) => (
        <polygon key={i} points={points} fill="#fff" opacity={0.22} />
      ))}
      <circle cx={sun.x} cy={sun.y} r={sun.r} fill={p.sun} />
      {shapes.map((s, i) =>
        s.kind === 'polygon' ? (
          <polygon key={i} points={s.points} fill={s.fill} />
        ) : (
          <path
            key={i}
            d={s.d}
            fill={s.fill ?? 'none'}
            {...(s.stroke
              ? { stroke: s.stroke, strokeWidth: s.width, strokeLinecap: 'round' as const }
              : {})}
          />
        ),
      )}
      {node === 'wildlife' && (
        <>
          <image href={ASSETS.ui.deer} x={560} y={74} width={82} height={101} />
          <image
            href={ASSETS.ui.deer}
            x={660}
            y={96}
            width={56}
            height={69}
            transform="translate(1376 0) scale(-1 1)"
          />
        </>
      )}
    </svg>
  );
}
