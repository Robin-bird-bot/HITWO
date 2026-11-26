/**
 * Drawing the Ants' parts (docs/design/21-minigames-dodge-camp.md, section
 * 2; mockups 26 to 29 in docs/mockups/minigames/dodge-new/): marching
 * lines and their turn hints, the mill's ring, fire ants and their blasts,
 * the Ant Hill and the ants it fires, the leaf parade and the crumb rush.
 * The ant art faces up; each one is turned to the way it walks.
 */
import { BALANCE } from '../../../../config/balance';
import {
  crumbAnt,
  fireAntAt,
  hillRise,
  marchAnts,
  marchHint,
  millAnts,
  paradeAt,
  paradeLeaves,
  walkerAt,
} from '../../../../minigames/dodge/attacks/ants';
import { edges, type Box } from '../../../../minigames/dodge/geometry';
import type { Point } from '../../../../minigames/dodge/logic';
import { RED } from '../../../../minigames/greens';
import { Arrow, Bang, Sprite } from './Bits';
import { deg, LIGHT, type DrawTable } from './drawTypes';

const AN = BALANCE.minigames.dodge.ants;
const ants = (f: string) => `ants/${f}`;

/** The walking frame now. */
const frame = (time: number, red = false) =>
  ants(`${red ? 'fire-ant' : 'ant'}-${Math.floor(time / AN.frameSec) % 2 === 0 ? 1 : 2}.png`);

/** One ant (7 × 9, facing up), turned to walk along `dir`. */
function ant(at: Point, dir: Point, file: string, key?: number | string) {
  return (
    <Sprite
      key={key}
      file={file}
      x={at.x}
      y={at.y}
      w={7}
      h={9}
      turn={deg(Math.atan2(dir.y, dir.x)) + 90}
    />
  );
}

/** Where a path first crosses into the box, a little outside it (for its "!"). */
function entryMark(box: Box, from: Point, to: Point): Point {
  const e = edges(box);
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx > 0) return { x: e.left - 6, y: from.y };
  if (dx < 0) return { x: e.right + 6, y: from.y };
  if (dy > 0) return { x: from.x, y: e.top - 6 };
  return { x: from.x, y: e.bottom + 6 };
}

export const ANT_DRAW: DrawTable<
  'march' | 'mill' | 'fireAnts' | 'antHill' | 'walker' | 'parade' | 'crumbRush'
> = {
  march: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const f = frame(c.time);
      return <>{marchAnts(p, c.time).map((a, k) => ant(a.at, a.dir, f, k))}</>;
    },
    warn(p, c) {
      if (c.time < p.activeAt) {
        const at = entryMark(c.box, p.path[0]!, p.path[1]!);
        return <Bang x={at.x} y={at.y} box={c.box} />;
      }
      // Level 1: a tiny arrow at the lead's next turn.
      const hint = marchHint(p, c.time);
      if (!hint) return null;
      return (
        <Arrow
          x={hint.at.x + hint.dir.x * 5}
          y={hint.at.y + hint.dir.y * 5}
          angle={deg(Math.atan2(hint.dir.y, hint.dir.x))}
          box={c.box}
          size={4}
        />
      );
    },
  },

  mill: {
    svg(p, c) {
      // While it warns, the ring it'll walk shows dotted.
      if (c.time >= p.activeAt) return null;
      return (
        <circle
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill="none"
          stroke={LIGHT}
          strokeWidth={0.7}
          strokeDasharray="1 2.5"
          opacity={0.8}
        />
      );
    },
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const f = frame(c.time);
      return <>{millAnts(p, c.time).map((a, k) => ant(a.at, a.dir, f, k))}</>;
    },
  },

  fireAnts: {
    svg(p, c) {
      if (c.time < p.redAt || c.time >= p.activeAt) return null;
      // The blasts' reach in red, and a light ring around the safe ant.
      return (
        <>
          {p.ants.map((a, k) =>
            k === p.safe ? (
              <circle
                key={k}
                cx={fireAntAt(p, k, c.time).x}
                cy={fireAntAt(p, k, c.time).y}
                r={AN.fire.safe}
                fill="none"
                stroke={LIGHT}
                strokeWidth={0.6}
              />
            ) : (
              <circle
                key={k}
                cx={a.at.x}
                cy={a.at.y}
                r={AN.fire.blast}
                fill="none"
                stroke={RED}
                strokeWidth={0.5}
              />
            ),
          )}
        </>
      );
    },
    over(p, c) {
      if (c.time >= p.activeAt) {
        // The blasts: boom-1, then boom-2.
        const u = (c.time - p.activeAt) / AN.fire.boomSec;
        const size = AN.fire.blast * 2;
        return (
          <>
            {p.ants.map((a, k) =>
              k === p.safe ? (
                ant(fireAntAt(p, k, c.time), { x: 0, y: -1 }, frame(0), k)
              ) : (
                <Sprite
                  key={k}
                  file={ants(u < 0.5 ? 'boom-1.png' : 'boom-2.png')}
                  x={a.at.x}
                  y={a.at.y}
                  w={size}
                  h={size}
                />
              ),
            )}
          </>
        );
      }
      // Walking in, standing, then all but one red, blinking faster and faster.
      const red = c.time >= p.redAt;
      const u = red ? (c.time - p.redAt) / (p.activeAt - p.redAt) : 0;
      const every = 0.2 - 0.15 * u;
      const lit = Math.floor((c.time - p.redAt) / every) % 2 === 0;
      return (
        <>
          {p.ants.map((a, k) => {
            const at = fireAntAt(p, k, c.time);
            const walking = c.time < p.stopAt || (k === p.safe && !!p.moveTo && red && u < 0.6);
            const to = k === p.safe && p.moveTo && red ? p.moveTo : a.at;
            const dir = walking
              ? {
                  x: to.x - (c.time < p.stopAt ? a.from.x : a.at.x),
                  y: to.y - (c.time < p.stopAt ? a.from.y : a.at.y),
                }
              : { x: 0, y: -1 };
            const isRed = red && k !== p.safe && lit;
            return ant(at, dir, walking ? frame(c.time) : isRed ? frame(0, true) : frame(0), k);
          })}
        </>
      );
    },
  },

  antHill: {
    under(p, c) {
      // A crack while it warns, then the hill rising, up, and sinking.
      if (c.time < p.activeAt)
        return <Sprite file={ants('anthill-1.png')} x={p.x} y={p.y} w={26} h={18} />;
      const rise = hillRise(p, c.time);
      const file = rise >= 1 ? 'anthill-3.png' : rise > 0 ? 'anthill-2.png' : 'anthill-1.png';
      return <Sprite file={ants(file)} x={p.x} y={p.y - 2} w={26} h={18} />;
    },
  },

  walker: {
    over: (p, c) =>
      c.time < p.activeAt ? null : ant(walkerAt(p, c.time), { x: p.vx, y: p.vy }, frame(c.time)),
  },

  parade: {
    over(p, c) {
      if (c.time < p.activeAt) return null;
      const across = p.side === 'left' || p.side === 'right';
      const sign = p.end > p.start ? 1 : -1;
      const dir = across ? { x: sign, y: 0 } : { x: 0, y: sign };
      const f = frame(c.time);
      return (
        <>
          {paradeLeaves(p, c.time).map((r, k) => {
            const at = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
            return (
              <span key={k}>
                {ant(at, dir, f)}
                <Sprite
                  file={ants('leaf.png')}
                  x={at.x}
                  y={at.y}
                  w={12}
                  h={10}
                  turn={across ? 90 : 0}
                />
              </span>
            );
          })}
        </>
      );
    },
    warn(p, c) {
      if (c.time >= p.activeAt) return null;
      const e = edges(c.box);
      const c0 = paradeAt(p, p.activeAt);
      const mid =
        p.side === 'left' || p.side === 'right' ? (e.top + e.bottom) / 2 : (e.left + e.right) / 2;
      const at = p.side === 'left' || p.side === 'right' ? { x: c0, y: mid } : { x: mid, y: c0 };
      const angle = { left: 0, right: 180, top: 90, bottom: -90 }[p.side];
      return (
        <>
          <Bang x={at.x} y={at.y} box={c.box} />
          <Arrow
            x={at.x + Math.cos((angle * Math.PI) / 180) * 8}
            y={at.y + Math.sin((angle * Math.PI) / 180) * 8}
            angle={angle}
            box={c.box}
          />
        </>
      );
    },
  },

  crumbRush: {
    under: (p) => (
      <>
        {p.crumbs.map((cr, k) => (
          <Sprite key={k} file={ants('crumb.png')} x={cr.x} y={cr.y} w={6} h={5} />
        ))}
      </>
    ),
    over(p, c) {
      const f = frame(c.time);
      return (
        <>
          {p.ants.map((_, k) => {
            const a = crumbAnt(p, k, c.time);
            return a ? ant(a.at, a.dir, f, k) : null;
          })}
        </>
      );
    },
    warn: (p, c) =>
      c.time < p.activeAt ? (
        <>
          {p.crumbs.map((cr, k) => (
            <Bang key={k} x={cr.x} y={cr.y - 7} box={c.box} />
          ))}
        </>
      ) : null,
  },
};
