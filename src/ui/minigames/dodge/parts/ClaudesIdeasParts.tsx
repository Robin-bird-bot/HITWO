/**
 * Drawing Claude's ideas (docs/design/12-minigames-dodge.md, section 6;
 * mockups 5 and 9): roar rings, the bear hug's arrows, honey drops and
 * puddles, the X slash, the thrown sword, the zigzag dash, pinecones, the
 * wall scurry and the herd of moose. Cut one by removing it here and from
 * minigames/dodge/attacks/claudesIdeas.ts.
 */
import { BALANCE } from '../../../../config/balance';
import {
  dashAt,
  dropY,
  herdX,
  MOOSE,
  ringRadius,
  scurryAt,
  scurryStart,
  thrownAt,
} from '../../../../minigames/dodge/attacks/claudesIdeas';
import styles from '../Dodge.module.css';
import ui from '../../gpsUi.module.css';
import { Arrow, Bang, Sprite } from './Bits';
import { arcPath, art, deg, LIGHT, MID, pathOf, type DrawTable } from './drawTypes';

const D = BALANCE.minigames.dodge;

export const CLAUDES_DRAW: DrawTable<
  'ring' | 'hug' | 'drop' | 'puddle' | 'slash' | 'thrown' | 'dash' | 'pinecone' | 'scurry' | 'herd'
> = {
  ring: {
    svg(p, c) {
      const r = ringRadius(p, c.time);
      if (c.time < p.activeAt || r <= 0 || r > p.maxR) return null;
      const half = Math.min(Math.PI, p.gap / 2 / r);
      if (half >= Math.PI) return null;
      return (
        <path
          d={arcPath(p.cx, p.cy, r, p.gapAt + half, p.gapAt - half + 2 * Math.PI)}
          fill="none"
          stroke={LIGHT}
          strokeWidth={p.half * 2}
        />
      );
    },
    // The "!" at the mouth until the first ring goes (the later rings wait behind it).
    outside: (p, c) =>
      c.time < p.activeAt && p.activeAt - p.warnAt <= D.warnSec + 1e-6 ? (
        <Bang x={p.cx} y={p.cy - 8} />
      ) : null,
  },

  hug: {
    outside(p, c) {
      if (c.time >= p.activeAt) return null;
      return (
        <>
          <Arrow x={c.left - 9} y={c.box.cy} angle={0} size={10} />
          <Arrow x={c.right + 9} y={c.box.cy} angle={180} size={10} />
        </>
      );
    },
  },

  drop: {
    over(p, c) {
      if (c.time < p.activeAt || p.done) return null;
      return <Sprite file="honey-drop.png" x={p.x} y={dropY(p, c.time)} w={6} h={8} />;
    },
    outside(p, c) {
      if (c.time >= p.activeAt) return null;
      return (
        <Sprite
          file="honey-drop.png"
          x={p.x}
          y={c.top - 5}
          w={6}
          h={8}
          opacity={0.6 + 0.4 * Math.abs(Math.sin(c.time * 8))}
        />
      );
    },
  },

  puddle: {
    svg(p, c) {
      const fade = Math.min(1, (p.until - c.time) / 0.5);
      return (
        <g opacity={fade}>
          <ellipse
            cx={p.x}
            cy={p.y}
            rx={p.rx}
            ry={p.ry}
            fill="#7f9a5f"
            stroke={MID}
            strokeWidth={0.5}
          />
          <text
            x={p.x}
            y={p.y + 1.2}
            textAnchor="middle"
            className={styles.svgLabel}
            fill="#1d2918"
          >
            STICKY
          </text>
        </g>
      );
    },
  },

  slash: {
    svg(p, c) {
      if (c.time < p.activeAt) {
        return (
          <line
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={MID}
            strokeWidth={0.6}
            strokeDasharray="3 2"
            opacity={0.8}
          />
        );
      }
      if (c.time > p.endAt + 0.1) return null;
      const fade = c.time <= p.endAt ? 1 : 1 - (c.time - p.endAt) / 0.1;
      return (
        <line
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke="#eef5d0"
          strokeWidth={D.xSlash.thickness}
          strokeLinecap="round"
          opacity={fade}
        />
      );
    },
  },

  thrown: {
    svg(p, c) {
      if (c.time >= p.activeAt) return null;
      return (
        <path
          d={pathOf(p.path)}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.6}
          strokeDasharray="1 2.5"
          opacity={0.85}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const { at, angle, end } = thrownAt(p, c.time);
      if (end) return null;
      return (
        <img
          className={`${ui.sprite} ${styles.part}`}
          src={art('sword.png')}
          alt=""
          draggable={false}
          style={{
            left: at.x - 3.5,
            top: at.y - 32,
            width: 7,
            height: 64,
            transform: `rotate(${(deg(angle) - 90).toFixed(1)}deg)`,
          }}
        />
      );
    },
  },

  dash: {
    svg(p, c) {
      if (c.time >= p.activeAt) return null;
      return (
        <path
          d={pathOf(p.path)}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.6}
          strokeDasharray="1 2.5"
          opacity={0.85}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const { at, dir, end } = dashAt(p, c.time);
      if (end) return null;
      return <Sprite file="bobcat-head.png" x={at.x} y={at.y} w={19} h={18} flipX={dir.x < 0} />;
    },
  },

  pinecone: {
    over(p, c) {
      if (c.time < p.activeAt || p.done) return null;
      return (
        <Sprite
          file="pinecone.png"
          x={p.x}
          y={p.y}
          w={9}
          h={13}
          turn={p.rolling ? deg(p.x / D.pinecones.radius) : 0}
        />
      );
    },
    outside: (p, c) => (c.time < p.activeAt ? <Bang x={p.x} y={c.top - 6} /> : null),
  },

  scurry: {
    over(p, c) {
      return scurryAt(p, c.box, c.time).map((s, k) => {
        const angle = deg(Math.atan2(s.dir.y, s.dir.x));
        const upsideDown = Math.abs(angle) > 90;
        return (
          <Sprite
            key={k}
            file="squirrel-run.png"
            x={s.at.x}
            y={s.at.y}
            w={14}
            h={10}
            turn={upsideDown ? angle + 180 : angle}
            flipX={upsideDown}
          />
        );
      });
    },
    outside(p, c) {
      if (c.time >= p.activeAt) return null;
      const at = scurryStart(p, c.box);
      return (
        <Bang
          x={at.x < c.box.cx ? c.left - 6 : c.right + 6}
          y={at.y < c.box.cy ? c.top - 6 : c.bottom + 6}
        />
      );
    },
  },

  herd: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const x = herdX(p, c.time);
      return p.lanes.map((y) => (
        <Sprite key={y} file="moose.png" x={x} y={y} w={MOOSE.w} h={MOOSE.h} flipX={p.vx < 0} />
      ));
    },
    outside(p, c) {
      if (c.time >= p.activeAt) return null;
      const left = p.from === 'left';
      const x = left ? c.left - 6 : c.right + 6;
      return (
        <>
          {p.lanes.map((y) => (
            <Arrow key={y} x={x} y={y} angle={left ? 0 : 180} />
          ))}
          <Bang x={x} y={c.top - 6} />
        </>
      );
    },
  },
};
