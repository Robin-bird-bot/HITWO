/**
 * Drawing the parts of Wyatt's attacks (docs/design/12-minigames-dodge.md,
 * sections 5 and 6; mockups 1 to 8 and 10 to 12): bees, the Sword Volley
 * (22-minigame-revisions.md, mockup 39), jabs, poke-ups and the wave, claws, the bite, the pounce and the stalk,
 * acorns, bombs, shrapnel and crumbs.
 */
import { biteOpen, clawsAt, clawsEntry, clawTurn } from '../../../../minigames/dodge/attacks/bear';
import { hopFrom, shadowSize, stalkAt } from '../../../../minigames/dodge/attacks/bobcat';
import { acornStage, bombAt, bombLit } from '../../../../minigames/dodge/attacks/squirrels';
import {
  jabDepth,
  pokeDepth,
  pokeX,
  volleyTip,
  waveAt,
  wavePath,
  waveWall,
} from '../../../../minigames/dodge/attacks/sword';
import { beeAt, rayToWall } from '../../../../minigames/dodge/logic';
import { BALANCE } from '../../../../config/balance';
import styles from '../Dodge.module.css';
import { Arrow, Bang, ShortSword, Sprite, Sword } from './Bits';
import { arcPath, deg, DARK, LIGHT, MID, pathOf, type DrawTable } from './drawTypes';

const D = BALANCE.minigames.dodge;

export const WYATT_DRAW: DrawTable<
  | 'bee'
  | 'volley'
  | 'jab'
  | 'poke'
  | 'wave'
  | 'claws'
  | 'bite'
  | 'pounce'
  | 'stalk'
  | 'acorn'
  | 'bomb'
  | 'shrapnel'
  | 'crumbs'
> = {
  bee: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const at = beeAt(p, c.time);
      return <Sprite file={c.beeFrame} x={at.x} y={at.y} w={10} h={7} flipX={p.vx < 0} />;
    },
    warn: (p, c) => (c.time < p.activeAt ? <Bang x={p.mark.x} y={p.mark.y} box={c.box} /> : null),
  },

  volley: {
    svg(p, c) {
      // The next sword to fly shows its path, dotted, to the far wall.
      if (c.time < p.pathAt || c.time >= p.activeAt) return null;
      const far = rayToWall(c.box, p.tip, p.dir);
      return (
        <line
          x1={p.tip.x}
          y1={p.tip.y}
          x2={p.tip.x + p.dir.x * far}
          y2={p.tip.y + p.dir.y * far}
          stroke={LIGHT}
          strokeWidth={0.75}
          strokeDasharray="0.75 3"
          strokeLinecap="round"
          opacity={0.55}
        />
      );
    },
    over(p, c) {
      // Only what's inside the box shows: the tip while it waits, then the sword flying across.
      if (c.time < p.warnAt) return null;
      const tip = volleyTip(p, c.time);
      return <ShortSword x={tip.x} y={tip.y} angle={Math.atan2(p.dir.y, p.dir.x)} />;
    },
    warn(p, c) {
      // Its number, just outside the wall, until it flies.
      if (c.time < p.warnAt || c.time >= p.activeAt) return null;
      const out = D.volley.tipIn + 7;
      return (
        <span
          className={styles.volleyNo}
          style={{ left: p.tip.x - p.dir.x * out - 4.5, top: p.tip.y - p.dir.y * out - 4.5 }}
        >
          {p.n}
        </span>
      );
    },
  },

  jab: {
    svg(p, c) {
      // The lane, outlined, from its warning until the blade is back.
      if (c.time > p.activeAt + p.thrustSec + p.holdSec + p.pullSec) return null;
      const half = D.jab.laneWidth / 2;
      const n = { x: -p.dir.y * half, y: p.dir.x * half };
      const end = { x: p.from.x + p.dir.x * p.reach, y: p.from.y + p.dir.y * p.reach };
      const pts = [
        { x: p.from.x + n.x, y: p.from.y + n.y },
        { x: end.x + n.x, y: end.y + n.y },
        { x: end.x - n.x, y: end.y - n.y },
        { x: p.from.x - n.x, y: p.from.y - n.y },
      ];
      return (
        <polygon
          points={pts.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.75}
          opacity={c.time < p.activeAt ? 0.9 : 0.5}
        />
      );
    },
    over(p, c) {
      const d = jabDepth(p, c.time);
      if (d <= 0) return null;
      // The tip leads; the hilt follows a blade's length behind (outside the box, hidden).
      const hilt = {
        x: p.from.x + p.dir.x * (d - D.sword.blade),
        y: p.from.y + p.dir.y * (d - D.sword.blade),
      };
      return <Sword x={hilt.x} y={hilt.y} angle={Math.atan2(p.dir.y, p.dir.x)} />;
    },
    warn: (p, c) =>
      c.time < p.activeAt ? (
        <Bang x={p.from.x - p.dir.x * 6} y={p.from.y - p.dir.y * 6} box={c.box} />
      ) : null,
  },

  poke: {
    over(p, c) {
      const stab = pokeDepth(p, c.time);
      if (!stab || stab.depth <= 0) return null;
      const x = p.spots[stab.spot]!;
      const wall = p.side === 'bottom' ? c.bottom : c.top;
      const tip = p.side === 'bottom' ? wall - stab.depth : wall + stab.depth;
      const up = p.side === 'bottom' ? -1 : 1;
      return (
        <Sword x={x} y={tip - up * D.sword.blade} angle={up < 0 ? -Math.PI / 2 : Math.PI / 2} />
      );
    },
    warn(p, c) {
      // The arrow sliding just outside the wall, and a "!" at each stab spot just before it.
      const x = pokeX(p, c.time);
      const y = p.side === 'bottom' ? c.bottom + 5 : c.top - 5;
      const dir = p.spots.length > 1 ? Math.sign(p.spots[1]! - p.spots[0]!) || 1 : 1;
      const marks = p.spots.filter(
        (_, k) => c.time >= p.stabAt[k]! - D.poke.markSec && c.time <= p.stabAt[k]! + p.stabSec,
      );
      const markY = p.side === 'bottom' ? c.bottom + 11 : c.top - 11;
      return (
        <>
          <span
            className={styles.slideLine}
            style={{ left: dir > 0 ? x - 22 : x, top: y - 0.4, width: 22 }}
          />
          <Arrow x={x} y={y} angle={dir > 0 ? 0 : 180} size={6} box={c.box} />
          {marks.map((mx) => (
            <Bang key={mx} x={mx} y={markY} box={c.box} />
          ))}
        </>
      );
    },
  },

  wave: {
    svg(p, c) {
      // The tip's path, a moment ahead of the sword.
      const pts = wavePath(p, c.box, c.time);
      if (pts.length < 2) return null;
      return (
        <path
          d={pathOf(pts)}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.8}
          strokeDasharray="0.8 2.4"
          strokeLinecap="round"
          opacity={0.9}
        />
      );
    },
    over(p, c) {
      const at = waveAt(p, c.box, c.time);
      if (!at) return null;
      const wall = waveWall(p, c.box);
      const tip = wall.y + wall.inward * at.depth;
      return (
        <Sword
          x={at.x}
          y={tip - wall.inward * D.sword.blade}
          angle={wall.inward > 0 ? Math.PI / 2 : -Math.PI / 2}
        />
      );
    },
    warn(p, c) {
      // The sword's track just outside the wall, with an arrow where it is.
      const wall = waveWall(p, c.box);
      const y = wall.y - wall.inward * 5;
      const run = (c.time - p.activeAt) * p.speed;
      if (run > c.box.w) return null;
      const x = Math.max(c.left, Math.min(c.right, p.dir > 0 ? c.left + run : c.right - run));
      return (
        <>
          <span
            className={styles.slideLine}
            style={{ left: p.dir > 0 ? x - 22 : x, top: y - 0.4, width: 22 }}
          />
          <Arrow x={x} y={y} angle={p.dir > 0 ? 0 : 180} size={6} box={c.box} />
          {c.time < p.activeAt && <Bang x={x} y={y - wall.inward * 7} box={c.box} />}
        </>
      );
    },
  },

  claws: {
    svg(p, c) {
      // Faint claw lines where the row will go.
      if (c.time >= p.activeAt) return null;
      const span = p.endAt - p.activeAt;
      const { cx, cy, r, a0, w } = p.path;
      return Array.from({ length: p.count }, (_, k) => {
        const rr = r + (k - (p.count - 1) / 2) * p.spacing;
        return (
          <path
            key={k}
            d={arcPath(cx, cy, rr, a0, a0 + w * span)}
            fill="none"
            stroke={MID}
            strokeWidth={0.6}
            opacity={0.45}
          />
        );
      });
    },
    over(p, c) {
      if (c.time < p.activeAt || c.time > p.endAt) return null;
      // Each claw turned (never mirrored) to point along its path, tip first, every frame.
      return clawsAt(p, c.time).map((cl, k) => (
        <Sprite
          key={k}
          file="claw.png"
          x={cl.at.x}
          y={cl.at.y}
          w={9}
          h={18}
          turn={clawTurn(cl.dir)}
        />
      ));
    },
    warn(p, c) {
      // An arrow just outside the edge where the row comes in.
      if (c.time >= p.activeAt) return null;
      const entry = clawsEntry(p, c.box);
      return (
        <Arrow
          x={entry.at.x - entry.dir.x * 5}
          y={entry.at.y - entry.dir.y * 5}
          angle={deg(Math.atan2(entry.dir.y, entry.dir.x))}
          box={c.box}
        />
      );
    },
  },

  bite: {
    svg(p, c) {
      if (c.time >= p.activeAt) return null;
      return (
        <rect
          x={p.cx - p.w / 2}
          y={p.cy - p.h / 2}
          width={p.w}
          height={p.h}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.6}
          opacity={0.8}
        />
      );
    },
    over(p, c) {
      const gap = biteOpen(p, c.time) * (p.h / 2);
      return (
        <>
          <Sprite file="jaw.png" x={p.cx} y={p.cy - gap - 5} w={34} h={10} />
          <Sprite file="jaw.png" x={p.cx} y={p.cy + gap + 5} w={34} h={10} flipY />
        </>
      );
    },
    warn: (p, c) =>
      c.time < p.activeAt ? (
        <Bang x={p.cx + p.w / 2 + 6} y={p.cy - p.h / 2 - 2} box={c.box} />
      ) : null,
  },

  pounce: {
    svg(p, c) {
      if (c.time > p.activeAt && !p.feint) {
        // The dust ring after landing.
        const u = Math.min(1, (c.time - p.activeAt) / p.dustSec);
        return (
          <ellipse
            cx={p.cx}
            cy={p.cy}
            rx={p.rx * (0.6 + 0.6 * u)}
            ry={p.ry * (0.6 + 0.6 * u)}
            fill="none"
            stroke={LIGHT}
            strokeWidth={0.8}
            opacity={1 - u}
          />
        );
      }
      if (c.time > p.activeAt) return null;
      const k = shadowSize(p, c.time);
      // A feint fades as the real shadow shows.
      const fade = p.feint
        ? Math.max(0, Math.min(1, (p.activeAt - c.time) / Math.max(0.01, D.pounce.feintRealSec)))
        : 1;
      return (
        <>
          <ellipse
            cx={p.cx}
            cy={p.cy}
            rx={p.rx * k}
            ry={p.ry * k}
            fill={DARK}
            stroke={LIGHT}
            strokeWidth={0.5}
            opacity={fade}
          />
          {!p.feint && (
            <text x={p.cx} y={p.cy - p.ry - 3} textAnchor="middle" className={styles.svgLabel}>
              LANDS HERE
            </text>
          )}
        </>
      );
    },
    over(p, c) {
      if (p.feint || c.time < p.activeAt) return null;
      return <Sprite file="bobcat-head.png" x={p.cx} y={p.cy} w={30} h={28} />;
    },
  },

  stalk: {
    svg(p, c) {
      // Before each hop: the aim line and where it'll land.
      const k = p.hops.findIndex((h) => c.time >= h.aimAt && c.time < h.hopAt);
      const hop = p.hops[k];
      if (!hop?.to) return null;
      const from = hopFrom(p, k);
      return (
        <>
          <line
            x1={from.x}
            y1={from.y}
            x2={hop.to.x}
            y2={hop.to.y}
            stroke={MID}
            strokeWidth={0.8}
            opacity={0.8}
          />
          <ellipse
            cx={hop.to.x}
            cy={hop.to.y + 2}
            rx={D.stalk.radius + 2}
            ry={(D.stalk.radius + 2) * 0.55}
            fill="none"
            stroke={LIGHT}
            strokeWidth={0.6}
          />
        </>
      );
    },
    over(p, c) {
      // The bobcat at half size, flipped to face where it's going.
      const { at } = stalkAt(p, c.time);
      const k = p.hops.findIndex((h) => c.time < h.landAt);
      const next = p.hops[k]?.to ?? p.exit;
      const left = next ? next.x < at.x : false;
      return <Sprite file="bobcat-head.png" x={at.x} y={at.y} w={15} h={14} flipX={left} />;
    },
  },

  acorn: {
    over(p, c) {
      if (c.time < p.activeAt || p.done) return null;
      return <Sprite file={`acorn-${acornStage(p)}.png`} x={p.x} y={p.y} w={10} h={12} />;
    },
    outside(p, c) {
      // The squirrel pops up at the edge, then ducks away just after throwing.
      if (c.time > p.activeAt + 0.3) return null;
      const turn = p.side === 'top' ? 90 : p.side === 'bottom' ? -90 : 0;
      return (
        <Sprite
          file="squirrel-run.png"
          x={p.squirrel.x}
          y={p.squirrel.y}
          w={14}
          h={10}
          turn={turn}
          flipX={p.side === 'right'}
        />
      );
    },
    warn: (p, c) =>
      c.time < p.activeAt ? (
        <Bang
          x={p.squirrel.x + (p.side === 'left' ? -6 : p.side === 'right' ? 6 : 0)}
          y={p.squirrel.y + (p.side === 'top' ? -8 : p.side === 'bottom' ? 8 : -9)}
          box={c.box}
        />
      ) : null,
  },

  crumbs: {
    over(p, c) {
      const fade = 1 - Math.min(1, (c.time - p.activeAt) / D.acorns.crumbsSec);
      return <Sprite file="acorn-crumbs.png" x={p.x} y={p.y} w={12} h={8} opacity={fade} />;
    },
  },

  bomb: {
    svg(p, c) {
      if (c.time < p.landAt) {
        // The spot it'll land on.
        return (
          <circle
            cx={p.x}
            cy={p.y}
            r={5}
            fill="none"
            stroke={LIGHT}
            strokeWidth={0.6}
            strokeDasharray="1.5 1.5"
          />
        );
      }
      if (c.time >= p.activeAt) {
        if (c.time > p.activeAt + p.blastSec) return null;
        return <circle cx={p.x} cy={p.y} r={p.radius} fill={LIGHT} opacity={0.55} />;
      }
      // The blast radius, pulsing.
      const pulse = c.reduced ? 0.8 : 0.55 + 0.35 * Math.abs(Math.sin((c.time - p.landAt) * 6));
      return (
        <circle
          cx={p.x}
          cy={p.y}
          r={p.radius}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.6}
          opacity={pulse}
        />
      );
    },
    outside(p, c) {
      if (c.time >= p.activeAt) return null;
      const { at, lift } = bombAt(p, c.time);
      return (
        <Sprite
          file={bombLit(p, c.time) ? 'bomb-lit.png' : 'bomb.png'}
          x={at.x}
          y={at.y - lift}
          w={12}
          h={15}
        />
      );
    },
  },

  shrapnel: {
    over: (p) => <Sprite file="shrapnel.png" x={p.x} y={p.y} w={4} h={4} />,
  },
};
