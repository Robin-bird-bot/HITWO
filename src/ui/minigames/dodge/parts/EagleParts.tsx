/**
 * Drawing the Eagle's attacks (docs/design/23-minigames-final.md, section
 * 9.1; mockups 48 to 50): swoops along a dotted path, feathers drifting
 * down, the talons' shadow, wing gusts, curly hairs, the comb-over, and
 * Freeagle's oil barrels and puddles.
 */
import { BALANCE } from '../../../../config/balance';
import {
  combX,
  featherAt,
  fuseLeft,
  hairAt,
  hairCurve,
  swoopAt,
} from '../../../../minigames/dodge/attacks/eagle';
import { RED } from '../../../../minigames/greens';
import styles from '../Dodge.module.css';
import { Bang, Sprite } from './Bits';
import { deg, LIGHT, pathOf, type DrawTable } from './drawTypes';

const E = BALANCE.minigames.dodge.eagle;
const eagle = (f: string) => `eagle/${f}`;

export const EAGLE_DRAW: DrawTable<
  'swoop' | 'feather' | 'talon' | 'gust' | 'hair' | 'comb' | 'barrel' | 'oil'
> = {
  swoop: {
    svg(p, c) {
      // The dotted path: bright while it warns, faint as he flies it.
      const warning = c.time < p.activeAt;
      return (
        <line
          x1={p.from.x}
          y1={p.from.y}
          x2={p.to.x}
          y2={p.to.y}
          stroke={LIGHT}
          strokeWidth={0.8}
          strokeDasharray="1 2.5"
          strokeLinecap="round"
          opacity={warning ? 0.9 : 0.3}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const at = swoopAt(p, c.time);
      const turn = deg(Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x));
      return <Sprite file={eagle('eagle.png')} x={at.x} y={at.y} w={36} h={18} turn={turn} />;
    },
    warn: (p, c) => (c.time < p.activeAt ? <Bang x={p.mark.x} y={p.mark.y} box={c.box} /> : null),
  },

  feather: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const at = featherAt(p, c.time);
      const sway = Math.sin(((c.time - p.activeAt) * 2 * Math.PI) / E.feather.swaySec + p.phase);
      return <Sprite file={eagle('feather.png')} x={at.x} y={at.y} w={6} h={12} turn={sway * 25} />;
    },
  },

  talon: {
    under(p, c) {
      if (c.time >= p.activeAt) return null;
      // The shadow follows, then darkens as the talons come.
      const u =
        c.time < p.stopAt ? 0.3 : 0.3 + (0.6 * (c.time - p.stopAt)) / (p.activeAt - p.stopAt);
      const r = E.talon.radius;
      return (
        <span
          className={styles.part}
          style={{
            left: p.x - r,
            top: p.y - r * 0.6,
            width: 2 * r,
            height: 1.2 * r,
            borderRadius: '50%',
            background: '#0f170c',
            opacity: u,
          }}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt || c.time > p.activeAt + E.talon.showSec) return null;
      const r = E.talon.radius;
      return (
        <svg
          className={styles.part}
          viewBox="0 0 24 24"
          style={{ left: p.x - r, top: p.y - r, width: 2 * r, height: 2 * r }}
        >
          <path
            d="M6 3l3 9M12 2v10M18 3l-3 9M8 21l4-8 4 8"
            stroke={LIGHT}
            strokeWidth={2}
            fill="none"
          />
        </svg>
      );
    },
  },

  gust: {
    svg(p, c) {
      // Feathers stream across (the warning), then arrows show the push.
      const t = c.time - p.warnAt;
      const lines = Array.from({ length: 6 }, (_, k) => {
        const y = c.top + ((k + 0.5) * (c.bottom - c.top)) / 6;
        const run = ((t * 160 + k * 37) % (c.right - c.left + 40)) - 20;
        const x = p.dir === 1 ? c.left + run : c.right - run;
        return (
          <line
            key={k}
            x1={x}
            y1={y}
            x2={x + p.dir * 14}
            y2={y}
            stroke={LIGHT}
            strokeWidth={0.6}
            opacity={0.6}
          />
        );
      });
      return <>{lines}</>;
    },
  },

  hair: {
    svg(p, c) {
      if (c.time >= p.activeAt) return null;
      const pts = Array.from({ length: 13 }, (_, k) => hairCurve(p, k / 12));
      return (
        <path
          d={pathOf(pts)}
          fill="none"
          stroke={RED}
          strokeWidth={0.6}
          strokeDasharray="1 2"
          opacity={0.7}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const { at } = hairAt(p, c.time);
      return (
        <Sprite
          file={eagle('hair.png')}
          x={at.x}
          y={at.y}
          w={14}
          h={10}
          turn={(c.time * 720) % 360}
        />
      );
    },
  },

  comb: {
    under(p, c) {
      if (c.time >= p.activeAt) return null;
      // The side it sweeps in from is hatched, with the gap left clear.
      return (
        <span
          className={styles.hatch}
          style={{
            left: p.side === 'left' ? c.left : c.right - 14,
            top: c.top,
            width: 14,
            height: c.bottom - c.top,
          }}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const x = combX(p, c.box, c.time) - E.comb.thick / 2;
      const g0 = p.gapAt - E.comb.gap / 2;
      const g1 = p.gapAt + E.comb.gap / 2;
      return (
        <>
          <span
            className={`${styles.part} ${styles.comb}`}
            style={{ left: x, top: c.top, width: E.comb.thick, height: g0 - c.top }}
          />
          <span
            className={`${styles.part} ${styles.comb}`}
            style={{ left: x, top: g1, width: E.comb.thick, height: c.bottom - g1 }}
          />
        </>
      );
    },
  },

  barrel: {
    under(p, c) {
      if (c.time >= p.activeAt) return null;
      const u = (c.time - p.warnAt) / (p.activeAt - p.warnAt);
      return (
        <span
          className={styles.part}
          style={{
            left: p.x - 7,
            top: p.y + 3,
            width: 14,
            height: 5,
            borderRadius: '50%',
            background: '#0f170c',
            opacity: 0.3 + 0.5 * u,
          }}
        />
      );
    },
    over(p, c) {
      if (c.time >= p.burstAt) {
        if (c.time > p.burstAt + E.oil.burstShowSec) return null;
        const r = E.oil.burst;
        return (
          <span
            className={styles.part}
            style={{
              left: p.x - r,
              top: p.y - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: '50%',
              background: LIGHT,
              opacity: 0.8,
            }}
          />
        );
      }
      // Tossed in along an arc, then sitting with its fuse counting down.
      const u = Math.min(1, (c.time - p.warnAt) / (p.activeAt - p.warnAt));
      const y = c.time < p.activeAt ? p.y - (1 - u) * 50 - Math.sin(Math.PI * u) * 10 : p.y;
      return (
        <>
          <Sprite file={eagle('oil-barrel.png')} x={p.x} y={y} w={12} h={14} />
          {c.time >= p.activeAt && (
            <span className={styles.fuse} style={{ left: p.x - 3, top: p.y - 15, color: RED }}>
              {fuseLeft(p, c.time)}
            </span>
          )}
        </>
      );
    },
  },

  oil: {
    under(p, c) {
      const fade = Math.max(0, Math.min(1, (p.until - c.time) / 1));
      return (
        <Sprite
          file={eagle('oil-puddle.png')}
          x={p.x}
          y={p.y}
          w={p.r * 2}
          h={p.r * 1.1}
          opacity={0.9 * fade}
        />
      );
    },
  },
};
