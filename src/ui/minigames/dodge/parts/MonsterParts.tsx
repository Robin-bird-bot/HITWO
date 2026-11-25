/**
 * Drawing the Woods Monster's attacks (docs/design/12-minigames-dodge.md,
 * section 12; mockups 14 and 15): fire tongues with their embers, grasping
 * hands and their cracks, candle wisps, rune beams, the ritual circle and
 * The Eye. Darkness is drawn by the Dodge screen itself, over the box.
 */
import { BALANCE } from '../../../../config/balance';
import {
  CANDLES,
  EYE,
  eyeAt,
  flameBase,
  flameHeight,
  gazeCone,
  HAND,
  handUp,
  ritualDrawn,
} from '../../../../minigames/dodge/attacks/monster';
import ui from '../../gpsUi.module.css';
import styles from '../Dodge.module.css';
import { Bang, Sprite } from './Bits';
import { arcPath, art, LIGHT, MID, type DrawTable } from './drawTypes';

const D = BALANCE.minigames.dodge;

export const MONSTER_DRAW: DrawTable<
  'flame' | 'hand' | 'wisp' | 'beam' | 'ritual' | 'eye' | 'dark'
> = {
  flame: {
    svg(p, c) {
      // Embers on the floor (or the ceiling) where it'll rise.
      if (c.time >= p.activeAt) return null;
      const b = flameBase(p, c.box);
      const y = p.ceiling ? b.y + 2 : b.y - 2;
      const on = c.reduced || Math.floor(c.time / 0.15) % 2 === 0;
      return (
        <g fill={LIGHT} opacity={on ? 0.9 : 0.5}>
          {[-1, 0, 1].map((k) => (
            <rect key={k} x={b.x + k * 3 - 0.6} y={y - 0.6} width={1.2} height={1.2} />
          ))}
        </g>
      );
    },
    over(p, c) {
      const h = flameHeight(p, c.box, c.time);
      if (h < 0.5) return null;
      const b = flameBase(p, c.box);
      const frame = Math.floor(c.time / D.fire.frameSec) % 2 === 0 ? 'flame-1.png' : 'flame-2.png';
      return (
        <img
          className={`${ui.sprite} ${styles.part}`}
          src={art(frame)}
          alt=""
          draggable={false}
          style={{
            left: b.x - b.w / 2,
            top: p.ceiling ? b.y : b.y - h,
            width: b.w,
            height: h,
            transform: p.ceiling ? 'scaleY(-1)' : undefined,
          }}
        />
      );
    },
    warn(p, c) {
      if (c.time >= p.activeAt) return null;
      const b = flameBase(p, c.box);
      return <Bang x={b.x} y={p.ceiling ? c.top - 7 : c.bottom + 7} box={c.box} />;
    },
  },

  hand: {
    svg(p, c) {
      // A crack in the ground where it'll burst up.
      if (c.time >= p.activeAt) return null;
      const y = p.y + HAND.below;
      return (
        <path
          d={`M${p.x - 6} ${y} l2.5 -1.2 l2 1.6 l2 -1.8 l2.2 1.4 l2.2 -1.1 l1.6 1.1`}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.7}
          opacity={0.6 + 0.4 * Math.abs(Math.sin(c.time * 12))}
        />
      );
    },
    over(p, c) {
      const up = handUp(p, c.time);
      if (up <= 0) return null;
      const bottom = p.y + HAND.below;
      return (
        <img
          className={`${ui.sprite} ${styles.part}`}
          src={art('hand.png')}
          alt=""
          draggable={false}
          style={{
            left: p.x - HAND.w / 2,
            top: bottom - HAND.h,
            width: HAND.w,
            height: HAND.h,
            transform: `scaleY(${up.toFixed(2)})`,
            transformOrigin: '50% 100%',
          }}
        />
      );
    },
  },

  wisp: {
    outside(p, c) {
      if (c.time < p.activeAt) return null;
      const fade = Math.max(0, Math.min(1, (p.until - c.time) / 0.5));
      return <Sprite file="wisp.png" x={p.x} y={p.y} w={7} h={7} opacity={fade} />;
    },
    warn(p, c) {
      // The candle flickers with a "!" before a wisp comes off it.
      if (c.time >= p.activeAt) return null;
      const candle = CANDLES[p.candle]!;
      return (
        <>
          <span
            className={styles.glow}
            style={{
              left: candle.x - 5,
              top: candle.y - 5,
              opacity: c.reduced ? 0.8 : 0.4 + 0.6 * Math.abs(Math.sin(c.time * 14)),
            }}
          />
          <Bang x={candle.x} y={candle.y - 10} box={c.box} />
        </>
      );
    },
  },

  beam: {
    svg(p, c) {
      if (c.time < p.activeAt) {
        // The thin warning line, flashing.
        const on = c.reduced || Math.floor(c.time / 0.1) % 2 === 0;
        return (
          <line
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={LIGHT}
            strokeWidth={0.5}
            opacity={on ? 0.9 : 0.4}
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
          strokeWidth={p.half * 2}
          strokeLinecap="round"
          opacity={fade}
        />
      );
    },
  },

  ritual: {
    svg(p, c) {
      if (c.time >= p.activeAt) {
        // It closes: the inside erupts.
        const u = (c.time - p.activeAt) / (p.eruptSec + 0.2);
        if (u > 1) return null;
        return <circle cx={p.cx} cy={p.cy} r={p.r} fill={LIGHT} opacity={0.7 * (1 - u)} />;
      }
      // The ring draws itself round.
      const drawn = ritualDrawn(p, c.time);
      const a0 = -Math.PI / 2;
      return (
        <path
          d={arcPath(p.cx, p.cy, p.r, a0, a0 + drawn * 2 * Math.PI * 0.999)}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.8}
        />
      );
    },
    over(p, c) {
      if (c.time >= p.activeAt + p.eruptSec) return null;
      const drawn = ritualDrawn(p, c.time);
      return Array.from({ length: p.runes }, (_, k) => {
        if (k / p.runes > drawn) return null;
        const a = -Math.PI / 2 + (k / p.runes) * 2 * Math.PI;
        return (
          <Sprite
            key={k}
            file="rune.png"
            x={p.cx + p.r * Math.cos(a)}
            y={p.cy + p.r * Math.sin(a)}
            w={9}
            h={9}
          />
        );
      });
    },
  },

  eye: {
    svg(p, c) {
      // The pale cone of its gaze (just an outline while it opens).
      const cone = gazeCone(p, c.box, c.time);
      if (cone.kind !== 'triangle') return null;
      const pts = cone.points.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
      const done = c.time > p.activeAt + p.sweepSec;
      if (done) return null;
      const opening = c.time < p.activeAt;
      return (
        <polygon
          points={pts}
          fill={opening ? 'none' : LIGHT}
          fillOpacity={0.22 + Math.min(0.3, p.gaze)}
          stroke={opening ? MID : 'none'}
          strokeWidth={0.6}
          strokeDasharray={opening ? '2 2' : undefined}
        />
      );
    },
    over(p, c) {
      const at = eyeAt(p, c.box);
      const open =
        c.time < p.activeAt
          ? 0.2 + 0.8 * ((c.time - p.warnAt) / Math.max(0.01, p.activeAt - p.warnAt))
          : c.time > p.activeAt + p.sweepSec
            ? Math.max(0, 1 - (c.time - p.activeAt - p.sweepSec) / 0.3)
            : 1;
      return (
        <img
          className={`${ui.sprite} ${styles.part}`}
          src={art('eye.png')}
          alt=""
          draggable={false}
          style={{
            left: at.x - EYE.w / 2,
            top: at.y - EYE.h / 2,
            width: EYE.w,
            height: EYE.h,
            transform: `scaleY(${open.toFixed(2)})`,
          }}
        />
      );
    },
    warn: (p, c) =>
      c.time < p.activeAt ? (
        <Bang x={eyeAt(p, c.box).x + EYE.w / 2 + 5} y={c.top + 6} box={c.box} />
      ) : null,
  },

  dark: {},
};
