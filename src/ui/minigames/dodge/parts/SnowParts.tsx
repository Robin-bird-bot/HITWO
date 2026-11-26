/**
 * Drawing the snow animals' attacks (docs/design/23-minigames-final.md,
 * sections 9.2 and 9.3; mockups 51 and 52): the Snow Leopard's leaps (a
 * red dotted line first), prowling, tail sweeps and snow kicks; the
 * Snowgirl's snowballs and their sliding chunks, icicles, antler charges,
 * snowflake rings and the avalanche.
 */
import { BALANCE } from '../../../../config/balance';
import {
  avalancheY,
  chargeAt,
  flakesNow,
  icicleTip,
  leapAt,
  pelletAt,
  tailBand,
} from '../../../../minigames/dodge/attacks/snow';
import { RED } from '../../../../minigames/greens';
import styles from '../Dodge.module.css';
import { Bang, Sprite } from './Bits';
import { deg, LIGHT, type DrawTable } from './drawTypes';

const S = BALANCE.minigames.dodge.snow;
const snow = (f: string) => `snow/${f}`;
const WHITE = '#f4f8dc';

export const SNOW_DRAW: DrawTable<
  'leap' | 'tail' | 'pellet' | 'snowball' | 'icicle' | 'charge' | 'flakes' | 'avalanche'
> = {
  leap: {
    svg(p, c) {
      // A red dotted line to where the sprite was, while he crouches.
      if (c.time >= p.activeAt || p.to === p.from) return null;
      return (
        <line
          x1={p.from.x}
          y1={p.from.y}
          x2={p.to.x}
          y2={p.to.y}
          stroke={RED}
          strokeWidth={0.8}
          strokeDasharray="1 2.5"
          strokeLinecap="round"
        />
      );
    },
    outside(p, c) {
      const at = leapAt(p, c.box, c.time);
      const dir = p.to === p.from ? 0 : deg(Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x));
      const flip = Math.abs(dir) > 90;
      return (
        <Sprite
          file={snow('leopard.png')}
          x={at.x}
          y={at.y}
          w={38}
          h={16}
          turn={flip ? dir - 180 : dir}
          flipX={flip}
        />
      );
    },
    warn: (p, c) =>
      c.time < p.activeAt && p.to !== p.from ? (
        <Bang x={p.from.x} y={p.from.y} box={c.box} />
      ) : null,
  },

  tail: {
    under(p, c) {
      const b = tailBand(p, c.box);
      if (c.time < p.activeAt)
        return (
          <span className={styles.hatch} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
        );
      if (c.time > p.activeAt + S.tail.sweepSec) return null;
      return (
        <span
          className={styles.part}
          style={{ left: b.x, top: b.y, width: b.w, height: b.h, background: LIGHT, opacity: 0.7 }}
        />
      );
    },
  },

  pellet: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const at = pelletAt(p, c.time);
      const r = p.big ? S.snowballs.chunkRadius : S.kick.radius;
      return (
        <span
          className={styles.part}
          style={{
            left: at.x - r,
            top: at.y - r,
            width: 2 * r,
            height: 2 * r,
            borderRadius: '50%',
            background: WHITE,
            boxShadow: '0 0 0 0.5px #0f170c',
          }}
        />
      );
    },
  },

  snowball: {
    under(p, c) {
      if (c.time >= p.activeAt) return null;
      // Its shadow grows where it'll land.
      const u = (c.time - p.warnAt) / (p.activeAt - p.warnAt);
      const r = S.snowballs.radius * (0.4 + 0.6 * u);
      return (
        <span
          className={styles.part}
          style={{
            left: p.x - r,
            top: p.y - r * 0.5,
            width: 2 * r,
            height: r,
            borderRadius: '50%',
            background: '#0f170c',
            opacity: 0.25 + 0.45 * u,
          }}
        />
      );
    },
    over(p, c) {
      if (c.time >= p.activeAt) return null;
      // Lobbed along an arc onto its shadow.
      const u = (c.time - p.warnAt) / (p.activeAt - p.warnAt);
      const x = p.from.x + (p.x - p.from.x) * u;
      const y = p.from.y + (p.y - p.from.y) * u - Math.sin(Math.PI * u) * 30;
      return <Sprite file={snow('snowball.png')} x={x} y={y} w={10} h={10} />;
    },
  },

  icicle: {
    over(p, c) {
      const tip = icicleTip(p, c.time);
      const glint = c.time < p.activeAt && Math.floor(c.time * 10) % 2 === 0;
      return (
        <Sprite
          file={snow('icicle.png')}
          x={p.x}
          y={tip - S.icicles.length / 2}
          w={6}
          h={16}
          opacity={glint ? 0.6 : 1}
        />
      );
    },
  },

  charge: {
    under(p, c) {
      if (c.time >= p.activeAt) return null;
      // The stripe she'll charge through.
      const half = S.charge.band / 2;
      const horizontal = p.dir.y === 0;
      return (
        <span
          className={styles.hatch}
          style={
            horizontal
              ? { left: c.left, top: p.from.y - half, width: c.right - c.left, height: 2 * half }
              : { left: p.from.x - half, top: c.top, width: 2 * half, height: c.bottom - c.top }
          }
        />
      );
    },
    outside(p, c) {
      if (c.time < p.activeAt) return null;
      const at = chargeAt(p, c.time);
      return (
        <Sprite file={snow('snowgirl.png')} x={at.x} y={at.y} w={32} h={28} flipX={p.dir.x < 0} />
      );
    },
  },

  flakes: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      return (
        <>
          {flakesNow(p, c.time).map((q, k) => (
            <span
              key={k}
              className={styles.part}
              style={{
                left: q.x - 1.5,
                top: q.y - 1.5,
                width: 3,
                height: 3,
                background: WHITE,
                transform: 'rotate(45deg)',
              }}
            />
          ))}
        </>
      );
    },
    warn: (p, c) => (c.time < p.activeAt ? <Bang x={p.from.x} y={p.from.y} box={c.box} /> : null),
  },

  avalanche: {
    under(p, c) {
      if (c.time >= p.activeAt) return null;
      const cw = (c.right - c.left) / p.cols;
      return (
        <>
          {Array.from({ length: p.cols }, (_, k) =>
            k === p.gap ? null : (
              <span
                key={k}
                className={styles.hatch}
                style={{ left: c.left + k * cw, top: c.top, width: cw, height: c.bottom - c.top }}
              />
            ),
          )}
        </>
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const cw = (c.right - c.left) / p.cols;
      const y = avalancheY(p, c.box, c.time);
      return (
        <>
          {Array.from({ length: p.cols }, (_, k) =>
            k === p.gap ? null : (
              <span
                key={k}
                className={styles.part}
                style={{
                  left: c.left + k * cw,
                  top: y,
                  width: cw,
                  height: S.avalanche.band,
                  background: WHITE,
                  opacity: 0.9,
                }}
              />
            ),
          )}
        </>
      );
    },
  },
};
