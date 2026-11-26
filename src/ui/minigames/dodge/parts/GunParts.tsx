/**
 * Drawing Bear with a Gun's parts (docs/design/21-minigames-dodge-camp.md,
 * section 1; mockups 22 to 25 in docs/mockups/minigames/dodge-new/): the
 * aim line and the shot, the crosshair and its holes, the traps, the Rapid
 * Fire cone and bullets, the Ricochet's path, and Quick Draw's bands.
 */
import { BALANCE } from '../../../../config/balance';
import { portraitAt, PORTRAITS } from '../../../../minigames/dodge/animals';
import {
  bulletAt,
  holeRadius,
  quickDrawBands,
  ricochetAt,
  shotFront,
  shotLanes,
  trapArc,
} from '../../../../minigames/dodge/attacks/gunBear';
import { RED } from '../../../../minigames/greens';
import styles from '../Dodge.module.css';
import { Bang, Sprite } from './Bits';
import { deg, LIGHT, MID, pathOf, type DrawTable } from './drawTypes';

const G = BALANCE.minigames.dodge.gun;
const gun = (f: string) => `bear-gun/${f}`;

/** The muzzle flash at the gun's spot. */
const flash = (x: number, y: number) => (
  <Sprite file={gun('muzzle-flash.png')} x={x} y={y} w={16} h={16} />
);

/** Quick blinking for a locked aim. */
const blink = (time: number, every = 0.05) => Math.floor(time / every) % 2 === 0;

export const GUN_DRAW: DrawTable<
  'shot' | 'crosshair' | 'hole' | 'trap' | 'bullet' | 'ricochet' | 'quickDraw'
> = {
  shot: {
    svg(p, c) {
      // Aiming: a thin dashed line from the gun to the sprite. Locked: the lanes blink.
      if (c.time < p.lockAt) {
        return (
          <line
            x1={p.from.x}
            y1={p.from.y}
            x2={p.aim.x}
            y2={p.aim.y}
            stroke={LIGHT}
            strokeWidth={0.6}
            strokeDasharray="2 1.6"
          />
        );
      }
      if (c.time >= p.activeAt || !blink(c.time)) return null;
      return (
        <>
          {shotLanes(p).map(([a, b], k) => (
            <line
              key={k}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={LIGHT}
              strokeWidth={0.6}
              strokeDasharray="2 1.6"
            />
          ))}
        </>
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      // The light trail along the lane, fading once the shot is across, with the bullet at its front.
      const front = shotFront(p, c.time);
      const fade = Math.max(0, 1 - (c.time - p.activeAt - G.aimed.crossSec) / G.aimed.trailSec);
      return (
        <>
          {shotLanes(p).map(([a, b], k) => {
            const tip = { x: a.x + (b.x - a.x) * front, y: a.y + (b.y - a.y) * front };
            const len = Math.hypot(tip.x - a.x, tip.y - a.y);
            return (
              <span key={k}>
                <span
                  className={styles.part}
                  style={{
                    left: a.x,
                    top: a.y - G.aimed.laneWidth / 2,
                    width: len,
                    height: G.aimed.laneWidth,
                    background: MID,
                    opacity: 0.75 * fade,
                    transformOrigin: '0 50%',
                    transform: `rotate(${deg(Math.atan2(b.y - a.y, b.x - a.x)).toFixed(1)}deg)`,
                  }}
                />
                {front < 1 && (
                  <Sprite
                    file={gun('bullet.png')}
                    x={tip.x}
                    y={tip.y}
                    w={8}
                    h={4}
                    turn={deg(Math.atan2(b.y - a.y, b.x - a.x))}
                  />
                )}
              </span>
            );
          })}
        </>
      );
    },
    outside: (p, c) =>
      c.time >= p.lockAt && c.time < p.activeAt + G.aimed.crossSec + 0.08
        ? flash(p.from.x, p.from.y)
        : null,
    warn: (p, c) => (c.time < p.lockAt ? <Bang x={p.from.x} y={p.from.y - 6} box={c.box} /> : null),
  },

  crosshair: {
    svg(p, c) {
      // The blast: a light flash where it hits.
      if (c.time < p.activeAt) return null;
      const u = (c.time - p.activeAt) / G.snipe.blastSec;
      return (
        <circle
          cx={p.x}
          cy={p.y}
          r={G.snipe.blastRadius}
          fill={LIGHT}
          opacity={Math.max(0, 0.8 * (1 - u))}
        />
      );
    },
    over: (p, c) =>
      c.time < p.activeAt ? (
        <Sprite
          file={gun(c.time < p.lockAt ? 'crosshair.png' : 'crosshair-locked.png')}
          x={p.x}
          y={p.y}
          w={27}
          h={27}
        />
      ) : null,
  },

  hole: {
    under(p, c) {
      // Fresh, then fading through hole-2 and hole-3 as it shrinks.
      const r = holeRadius(p, c.time);
      if (r <= 0) return null;
      const fading = c.time > p.until;
      const u = fading ? (c.time - p.until) / G.snipe.fadeSec : 0;
      const file = !fading ? 'hole-1.png' : u < 0.5 ? 'hole-2.png' : 'hole-3.png';
      const size = (30 * r) / p.r;
      return <Sprite file={gun(file)} x={p.x} y={p.y} w={size} h={size} />;
    },
  },

  trap: {
    under(p, c) {
      if (p.gone) return null;
      if (c.time < p.activeAt) {
        // Its shadow where it'll land, darker as it comes down.
        const u = (c.time - p.warnAt) / (p.activeAt - p.warnAt);
        return (
          <Sprite
            file={gun('trap-shadow.png')}
            x={p.x}
            y={p.y + 2}
            w={18}
            h={8}
            opacity={0.4 + 0.6 * u}
          />
        );
      }
      if (p.shutAt !== undefined) {
        const fade = 1 - (c.time - p.shutAt) / G.traps.closedFadeSec;
        return (
          <Sprite file={gun('trap-closed.png')} x={p.x} y={p.y} w={18} h={12} opacity={fade} />
        );
      }
      const fade = c.time < p.openUntil ? 1 : 1 - (c.time - p.openUntil) / G.traps.openFadeSec;
      return <Sprite file={gun('trap-open.png')} x={p.x} y={p.y} w={18} h={12} opacity={fade} />;
    },
    over(p, c) {
      if (p.gone || c.time >= p.activeAt) return null;
      // In the air along its arc.
      const u = (c.time - p.warnAt) / (p.activeAt - p.warnAt);
      const at = trapArc(p, u);
      return <Sprite file={gun('trap-open.png')} x={at.x} y={at.y} w={18} h={12} />;
    },
    svg(p, c) {
      if (p.gone || c.time >= p.activeAt) return null;
      // A few dots ahead of it along the arc.
      const u = (c.time - p.warnAt) / (p.activeAt - p.warnAt);
      const dots = [0.2, 0.4, 0.6, 0.8].filter((k) => k > u).map((k) => trapArc(p, k));
      return (
        <>
          {dots.map((d, k) => (
            <rect
              key={k}
              x={d.x - 0.6}
              y={d.y - 0.6}
              width={1.2}
              height={1.2}
              fill={LIGHT}
              opacity={0.7}
            />
          ))}
        </>
      );
    },
  },

  bullet: {
    svg(p, c) {
      // The first bullet carries the cone: bright while it warns, faint while the spray flies.
      if (!p.cone || c.time > p.cone.until) return null;
      const reach = 260;
      const end = (a: number) => ({ x: p.x + Math.cos(a) * reach, y: p.y + Math.sin(a) * reach });
      const a = end(p.cone.at - p.cone.half);
      const b = end(p.cone.at + p.cone.half);
      const warning = c.time < p.activeAt;
      return (
        <polygon
          points={`${p.x},${p.y} ${a.x},${a.y} ${b.x},${b.y}`}
          fill={LIGHT}
          fillOpacity={warning && blink(c.time, 0.1) ? 0.14 : 0.05}
          stroke={LIGHT}
          strokeOpacity={0.4}
          strokeWidth={0.4}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const at = bulletAt(p, c.time);
      return (
        <Sprite
          file={gun('bullet.png')}
          x={at.x}
          y={at.y}
          w={8}
          h={4}
          turn={deg(Math.atan2(p.vy, p.vx))}
        />
      );
    },
    outside: (p, c) =>
      p.cone && c.time >= p.activeAt && c.time < p.cone.until ? flash(p.x, p.y) : null,
    warn: (p, c) =>
      p.cone && c.time < p.activeAt ? <Bang x={p.x} y={p.y - 6} box={c.box} /> : null,
  },

  ricochet: {
    svg(p, c) {
      // Its whole path, dotted: bright while it warns, faint as it flies.
      const warning = c.time < p.activeAt;
      return (
        <path
          d={pathOf(p.path)}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.7}
          strokeDasharray="0.8 2"
          strokeLinecap="round"
          opacity={warning ? 0.9 : 0.35}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const now = ricochetAt(p, c.time).at;
      const before = ricochetAt(p, c.time - 0.01).at;
      const turn = deg(Math.atan2(now.y - before.y, now.x - before.x));
      return <Sprite file={gun('bullet.png')} x={now.x} y={now.y} w={8} h={4} turn={turn} />;
    },
    outside: (p, c) =>
      c.time >= p.activeAt - 0.1 && c.time < p.activeAt + 0.1
        ? flash(p.path[0]!.x, p.path[0]!.y)
        : null,
    warn: (p, c) =>
      c.time < p.activeAt ? <Bang x={p.path[0]!.x} y={p.path[0]!.y - 6} box={c.box} /> : null,
  },

  quickDraw: {
    under(p, c) {
      const bands = quickDrawBands(p, c.box);
      const band = (r: { x: number; y: number; w: number; h: number }, at: number, key: string) => {
        if (c.time < at) {
          return (
            <span
              key={key}
              className={styles.hatch}
              style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
            />
          );
        }
        if (c.time > at + G.quickDraw.blastSec + 0.1) return null;
        return (
          <span
            key={key}
            className={styles.part}
            style={{
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              background: LIGHT,
              opacity: 0.85,
            }}
          />
        );
      };
      return (
        <>
          {band(bands.row, p.activeAt, 'row')}
          {bands.col && band(bands.col, p.colAt, 'col')}
        </>
      );
    },
    // The "!" over the bear's head.
    warn(p, c) {
      if (c.time >= p.activeAt) return null;
      const at = portraitAt('gunBear');
      return (
        <span
          className={styles.mark}
          style={{ left: at.x + PORTRAITS.gunBear.w / 2 - 3.5, top: at.y - 9, color: RED }}
        >
          !
        </span>
      );
    },
  },
};
