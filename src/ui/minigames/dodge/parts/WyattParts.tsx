/**
 * Drawing the parts of Wyatt's attacks (docs/design/12-minigames-dodge.md,
 * sections 5 and 6; mockups 1 to 8): bees, the sword's sweep, jabs and
 * poke-ups, claws, the bite, the pounce, acorns, bombs, shrapnel and crumbs.
 */
import { clawsAt, clawsEntry, biteOpen } from '../../../../minigames/dodge/attacks/bear';
import { shadowSize } from '../../../../minigames/dodge/attacks/bobcat';
import { acornStage, bombAt, bombLit } from '../../../../minigames/dodge/attacks/squirrels';
import { jabDepth, pokeDepth, pokeX } from '../../../../minigames/dodge/attacks/sword';
import { beeAt, swingAngle, swordPivot } from '../../../../minigames/dodge/logic';
import { BALANCE } from '../../../../config/balance';
import styles from '../Dodge.module.css';
import { Arrow, Bang, Sprite, Sword } from './Bits';
import { arcPath, deg, DARK, LIGHT, MID, type DrawTable } from './drawTypes';

const D = BALANCE.minigames.dodge;
/** claw.png's long axis points up and to the right (9 across, 18 up). */
const CLAW_AXIS = Math.atan2(-18, 9);
export const WYATT_DRAW: DrawTable<
  | 'bee'
  | 'swing'
  | 'jab'
  | 'poke'
  | 'claws'
  | 'bite'
  | 'pounce'
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
    outside: (p, c) => (c.time < p.activeAt ? <Bang x={p.mark.x} y={p.mark.y} /> : null),
  },

  swing: {
    under(p, c) {
      if (c.time >= p.activeAt) return null;
      return (
        <span
          className={styles.hatch}
          style={{
            left: p.side === 'left' ? c.left : c.box.cx,
            top: c.top,
            width: c.box.w / 2,
            height: c.box.h,
          }}
        >
          <span className={styles.bang}>!</span>
        </span>
      );
    },
    outside(p, c) {
      // The sword, turning around its pivot above the box, with a light trail.
      const angle = swingAngle(p, c.time);
      const shown = angle ?? (c.time < p.activeAt ? 0 : null);
      if (shown === null) return null;
      const pivot = swordPivot(c.box);
      const toward = (a: number) => (p.side === 'right' ? Math.PI / 2 - a : Math.PI / 2 + a);
      return (
        <>
          {angle !== null &&
            [0.12, 0.24, 0.36].map((back, k) => (
              <Sword
                key={back}
                x={pivot.x}
                y={pivot.y}
                angle={toward(Math.max(0, shown - back))}
                opacity={0.35 - k * 0.1}
                ghost
              />
            ))}
          <Sword x={pivot.x} y={pivot.y} angle={toward(shown)} />
        </>
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
    outside: (p, c) =>
      c.time < p.activeAt ? <Bang x={p.from.x - p.dir.x * 6} y={p.from.y - p.dir.y * 6} /> : null,
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
    outside(p, c) {
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
          <Arrow x={x} y={y} angle={dir > 0 ? 0 : 180} size={6} />
          {marks.map((mx) => (
            <Bang key={mx} x={mx} y={markY} />
          ))}
        </>
      );
    },
  },

  claws: {
    svg(p, c) {
      // Faint claw lines where the row will go.
      if (c.time >= p.activeAt) return null;
      const span = p.endAt - p.activeAt;
      if (p.path.type === 'line') {
        const { vx, vy } = p.path;
        return clawsAt(p, p.activeAt).map((cl, k) => (
          <line
            key={k}
            x1={cl.at.x}
            y1={cl.at.y}
            x2={cl.at.x + vx * span}
            y2={cl.at.y + vy * span}
            stroke={MID}
            strokeWidth={0.6}
            opacity={0.45}
          />
        ));
      }
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
      return clawsAt(p, c.time).map((cl, k) => (
        <Sprite
          key={k}
          file="claw.png"
          x={cl.at.x}
          y={cl.at.y}
          w={9}
          h={18}
          turn={deg(Math.atan2(cl.axis.y, cl.axis.x) - CLAW_AXIS)}
        />
      ));
    },
    outside(p, c) {
      if (c.time >= p.activeAt) return null;
      const entry = clawsEntry(p);
      return (
        <Arrow
          x={entry.at.x - entry.dir.x * 4}
          y={entry.at.y - entry.dir.y * 4}
          angle={deg(Math.atan2(entry.dir.y, entry.dir.x))}
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
          {c.time < p.activeAt && <Bang x={p.cx + p.w / 2 + 6} y={p.cy - p.h / 2 - 2} />}
        </>
      );
    },
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
        <>
          <Sprite
            file="squirrel-run.png"
            x={p.squirrel.x}
            y={p.squirrel.y}
            w={14}
            h={10}
            turn={turn}
            flipX={p.side === 'right'}
          />
          {c.time < p.activeAt && (
            <Bang
              x={p.squirrel.x + (p.side === 'left' ? -6 : p.side === 'right' ? 6 : 0)}
              y={p.squirrel.y + (p.side === 'top' ? -8 : p.side === 'bottom' ? 8 : -9)}
            />
          )}
        </>
      );
    },
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
