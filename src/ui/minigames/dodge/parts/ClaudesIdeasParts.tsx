/**
 * Drawing Claude's ideas (docs/design/12-minigames-dodge.md, section 6;
 * mockups 5, 9, 10, 11 and 13): the shout's waves, the bear hug's arrows,
 * honey drops and puddles, the X slash, the thrown sword (its path, its
 * spin and the bear's paw), the bouncing zigzag dash, pinecones, the wall
 * scurry and its nuts, and the herd of moose. Cut one by removing it here
 * and from minigames/dodge/attacks/claudesIdeas.ts.
 */
import { BALANCE } from '../../../../config/balance';
import {
  dashAt,
  dashPasses,
  dropY,
  herdX,
  MOOSE,
  scurryAt,
  scurryBlinking,
  scurryStart,
  thrownAt,
  thrownBackAt,
  waveRadius,
} from '../../../../minigames/dodge/attacks/claudesIdeas';
import styles from '../Dodge.module.css';
import { Arrow, Bang, Paw, Spinning, Sprite } from './Bits';
import { arcPath, deg, LIGHT, MID, pathOf, type DrawTable } from './drawTypes';

const D = BALANCE.minigames.dodge;

/** Bear with a Sword's paw beside his head (only when he's the one head above the box). */
const PAW = { left: { x: 140, y: 52 }, right: { x: 179, y: 52 } } as const;

export const CLAUDES_DRAW: DrawTable<
  | 'shout'
  | 'hug'
  | 'drop'
  | 'puddle'
  | 'slash'
  | 'thrown'
  | 'dash'
  | 'pinecone'
  | 'scurry'
  | 'nut'
  | 'herd'
> = {
  shout: {
    svg(p, c) {
      const r = waveRadius(p, c.time);
      if (c.time < p.activeAt || r <= 0 || r > p.maxR) return null;
      return (
        <path
          d={arcPath(p.cx, p.cy, r, p.at - p.spread / 2, p.at + p.spread / 2)}
          fill="none"
          stroke={LIGHT}
          strokeWidth={p.half * 2}
          strokeLinecap="round"
        />
      );
    },
    // The bear's mouth glows, and a short arrow shows which way the shout goes.
    warn(p, c) {
      if (!p.lead || c.time >= p.activeAt) return null;
      const glow = c.reduced ? 0.8 : 0.5 + 0.5 * Math.abs(Math.sin(c.time * 10));
      const dir = { x: Math.cos(p.at), y: Math.sin(p.at) };
      // Where the shout's line comes into the box.
      const into = dir.y > 0.05 ? (c.top - p.cy) / dir.y : 0;
      const at = { x: p.cx + dir.x * into, y: p.cy + dir.y * into };
      const inside = { x: at.x + dir.x * 6, y: at.y + dir.y * 6 };
      return (
        <>
          <span className={styles.glow} style={{ left: p.cx - 5, top: p.cy - 5, opacity: glow }} />
          <Arrow x={inside.x} y={inside.y} angle={deg(p.at)} size={8} box={c.box} />
        </>
      );
    },
  },

  hug: {
    warn(p, c) {
      if (c.time >= p.activeAt) return null;
      return (
        <>
          <Arrow x={c.left - 9} y={c.box.cy} angle={0} size={10} box={c.box} />
          <Arrow x={c.right + 9} y={c.box.cy} angle={180} size={10} box={c.box} />
        </>
      );
    },
  },

  drop: {
    over(p, c) {
      if (c.time < p.activeAt || p.done) return null;
      return <Sprite file="honey-drop.png" x={p.x} y={dropY(p, c.time)} w={6} h={8} />;
    },
    warn(p, c) {
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
    outside(p, c) {
      // The whole path first: out along one line and back along the other,
      // arrowheads at both ends and a curved arrow where it turns.
      const back = thrownBackAt(p);
      if (c.time > back) return null;
      const [a, b, d, e] = p.path as [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
      ];
      const out = b.x > a.x ? 1 : -1;
      const turnR = Math.abs(d.y - b.y) / 2;
      const turnX = b.x - out * turnR;
      const fade = c.time < p.activeAt ? 0.95 : 0.55;
      const path = (
        <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
          <g opacity={fade} fill="none" stroke={LIGHT} strokeLinecap="round">
            <line
              x1={a.x}
              y1={a.y}
              x2={turnX}
              y2={b.y}
              strokeWidth={0.8}
              strokeDasharray="0.8 2.6"
            />
            <line
              x1={turnX}
              y1={d.y}
              x2={e.x}
              y2={e.y}
              strokeWidth={0.8}
              strokeDasharray="0.8 2.6"
            />
            <path
              d={`M${turnX} ${b.y} A${turnR} ${turnR} 0 0 ${out > 0 ? 1 : 0} ${turnX} ${d.y}`}
              strokeWidth={0.8}
            />
          </g>
        </svg>
      );
      // The sword spinning, two fading copies behind it, and a light arc as it spins.
      const flying = c.time >= p.activeAt;
      const now = thrownAt(p, c.time);
      const ghosts = [0.06, 0.12].map((dt) => thrownAt(p, Math.max(p.activeAt, c.time - dt)));
      // The bear's paw: it sweeps forward at the throw, and reaches out for the catch.
      const side = out > 0 ? 'left' : 'right';
      const paw = PAW[side];
      const throwU = (c.time - (p.activeAt - 0.2)) / 0.35;
      const catching = c.time > back - 0.45;
      let pawTurn: number | null = null;
      if (throwU >= 0 && throwU <= 1) pawTurn = (side === 'left' ? 1 : -1) * (-50 + 110 * throwU);
      else if (catching) pawTurn = (side === 'left' ? 1 : -1) * 45;
      return (
        <>
          {path}
          {flying && !now.end && (
            <>
              <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
                <path
                  d={arcPath(
                    now.at.x,
                    now.at.y,
                    D.thrown.length / 2 + 2,
                    now.angle + 0.3,
                    now.angle + 1.9,
                  )}
                  fill="none"
                  stroke={LIGHT}
                  strokeWidth={0.6}
                  opacity={0.7}
                />
              </svg>
              {ghosts.map((g, k) => (
                <Spinning key={k} x={g.at.x} y={g.at.y} angle={g.angle} opacity={k ? 0.25 : 0.5} />
              ))}
              <Spinning x={now.at.x} y={now.at.y} angle={now.angle} />
            </>
          )}
          {c.animal === 'swordBear' && pawTurn !== null && (
            <Paw x={paw.x} y={paw.y} turn={pawTurn} />
          )}
        </>
      );
    },
    warn(p, c) {
      // Arrowheads at both ends: the way out, and the way back.
      if (c.time > thrownBackAt(p)) return null;
      const [a, b, d, e] = p.path;
      const out = b!.x > a!.x ? 1 : -1;
      const tipOut = { x: (out > 0 ? c.right : c.left) - out * 6, y: b!.y };
      const tipBack = { x: (out > 0 ? c.left : c.right) + out * 6, y: e!.y };
      return (
        <>
          <Arrow x={tipOut.x} y={tipOut.y} angle={out > 0 ? 0 : 180} size={6} box={c.box} />
          <Arrow x={tipBack.x} y={tipBack.y} angle={out > 0 ? 180 : 0} size={6} box={c.box} />
          {c.time < p.activeAt && (
            <Bang
              x={(out > 0 ? c.left : c.right) - out * 7}
              y={d!.y - (d!.y - b!.y) / 2}
              box={c.box}
            />
          )}
        </>
      );
    },
  },

  dash: {
    svg(p, c) {
      // Each pass's dotted line: the first before it starts, each next one before its bounce.
      return (
        <>
          {dashPasses(p)
            .filter((pass) => c.time >= pass.showAt && c.time < pass.doneAt)
            .map((pass, k) => (
              <path
                key={k}
                d={pathOf(pass.points)}
                fill="none"
                stroke={LIGHT}
                strokeWidth={0.7}
                strokeDasharray="0.8 2.4"
                strokeLinecap="round"
                opacity={0.9}
              />
            ))}
        </>
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const { at, dir, end } = dashAt(p, c.time);
      if (end) return null;
      return <Sprite file="bobcat-head.png" x={at.x} y={at.y} w={19} h={18} flipX={dir.x < 0} />;
    },
    warn(p, c) {
      if (c.time >= p.activeAt) return null;
      return <Bang x={p.path[0]!.x} y={p.path[0]!.y} box={c.box} />;
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
    warn: (p, c) => (c.time < p.activeAt ? <Bang x={p.x} y={c.top - 6} box={c.box} /> : null),
  },

  scurry: {
    over(p, c) {
      // Each squirrel blinks just before it flicks a nut.
      return scurryAt(p, c.box, c.time).map((s) => {
        const angle = deg(Math.atan2(s.dir.y, s.dir.x));
        const upsideDown = Math.abs(angle) > 90;
        const blink =
          scurryBlinking(p, s.k, c.time) && Math.floor(c.time / 0.08) % 2 === 0 ? 0.35 : 1;
        return (
          <Sprite
            key={s.k}
            file="squirrel-run.png"
            x={s.at.x}
            y={s.at.y}
            w={14}
            h={10}
            turn={upsideDown ? angle + 180 : angle}
            flipX={upsideDown}
            opacity={blink}
          />
        );
      });
    },
    warn(p, c) {
      if (c.time >= p.activeAt) return null;
      const at = scurryStart(p, c.box);
      return (
        <Bang
          x={at.x < c.box.cx ? c.left - 6 : c.right + 6}
          y={at.y < c.box.cy ? c.top - 6 : c.bottom + 6}
          box={c.box}
        />
      );
    },
  },

  nut: {
    over: (p) => (p.done ? null : <Sprite file="nut.png" x={p.x} y={p.y} w={5} h={5} />),
  },

  herd: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const x = herdX(p, c.time);
      return p.lanes.map((y) => (
        <Sprite key={y} file="moose.png" x={x} y={y} w={MOOSE.w} h={MOOSE.h} flipX={p.vx < 0} />
      ));
    },
    warn(p, c) {
      if (c.time >= p.activeAt) return null;
      const left = p.from === 'left';
      const x = left ? c.left - 6 : c.right + 6;
      return (
        <>
          {p.lanes.map((y) => (
            <Arrow key={y} x={x} y={y} angle={left ? 0 : 180} box={c.box} />
          ))}
          <Bang x={x} y={c.top - 6} box={c.box} />
        </>
      );
    },
  },
};
