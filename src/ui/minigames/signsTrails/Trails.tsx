/**
 * Trails on the GPS (docs/design/19-minigames-signs-trails.md, section 2;
 * mockups 16-trails-switchbacks.png and 17-trails-off.png), in scene units
 * (320 × 240): top-down, the trail scrolls down from y 22 to 195 over the
 * type's ground; the active hiker (the Dodge person icon in their color)
 * moves left and right at y [178]. Checkpoints are lines across the trail
 * with a flag whose cloth is in the hiker's color.
 *
 * Steering: Left and Right (or A and D), or the mouse (or a finger, while
 * it's down): the icon heads toward the pointer's x.
 */
import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { g, RED } from '../../../minigames/greens';
import { middleAt, TRAIL_TYPES, widthAt, type TrailType } from '../../../minigames/trails/course';
import { aim, checkpoints, newTrails, result, steer, tick } from '../../../minigames/trails/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { art as dodgeArt } from '../dodge/parts/drawTypes';
import { useTinted } from '../dodge/tint';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { litKey, useLitArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './Trails.module.css';

const T = BALANCE.minigames.trails;
const file = (f: string) => `minigames/trails/${f}`;
const art = (f: string) => asset(file(f));
const TOP = 22;
const BOTTOM = 195;
const FLAG = file('checkpoint-flag.png');

export function Trails({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const picked = pickOf(settings, 'type');
  const type: TrailType = TRAIL_TYPES.some((t) => t.id === picked)
    ? (picked as TrailType)
    : 'forest';
  const [game, setGame] = useState(() =>
    newTrails(
      {
        tier,
        type,
        barSec: typeof settings.bar === 'number' ? settings.bar : 'auto',
        section: typeof settings.section === 'number' ? settings.section : 'auto',
        gusts: pickOf(settings, 'gusts') !== 'off',
        scree: pickOf(settings, 'scree') !== 'off',
        knives: pickOf(settings, 'knives') !== 'off',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const ids = useId().replace(/:/g, '');
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const tints = useTinted(hikers.map((h) => h.color));
  const flags = useLitArt(
    [FLAG],
    hikers.map((h) => h.color),
  );

  const held = useRef({ left: false, right: false });
  const steerNow = () => {
    const dir = held.current.left === held.current.right ? 0 : held.current.left ? -1 : 1;
    setGame((s) => steer(s, dir));
  };
  useKeys(
    running,
    (key) => {
      if (key === 'ArrowLeft' || key === 'a') held.current.left = true;
      else if (key === 'ArrowRight' || key === 'd') held.current.right = true;
      else return false;
      steerNow();
      return true;
    },
    (key) => {
      if (key === 'ArrowLeft' || key === 'a') held.current.left = false;
      else if (key === 'ArrowRight' || key === 'd') held.current.right = false;
      else return;
      steerNow();
    },
  );
  const pointAt = (e: ReactPointerEvent) => {
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    setGame((s) => aim(s, p.x));
  };

  const info = TRAIL_TYPES.find((t) => t.id === game.type)!;
  const c = game.course;
  const w = c.width;
  const who = game.runner;
  const color = who ? byId(who).color : '#d3dfaf';
  // The trail on screen: distance at a screen y (the hiker's y is the current distance).
  const distAt = (y: number) => game.d + (T.hikerY - y);
  const ys: number[] = [];
  for (let y = TOP - 4; y <= BOTTOM + 4; y += 3) ys.push(y);
  // The edges (Ridgeline's knife edges narrow it).
  const halfAt = (y: number) => widthAt(c, distAt(y)) / 2;
  const left = ys.map((y) => `${(middleAt(c, distAt(y)) - halfAt(y)).toFixed(1)},${y}`);
  const right = ys.map((y) => `${(middleAt(c, distAt(y)) + halfAt(y)).toFixed(1)},${y}`).reverse();
  const ridge = c.type === 'ridgeline';
  // Ridgeline: scree patches on the trail, the crumbly lips, and the wind.
  const screeShapes = ridge
    ? c.scree.flatMap((p, k) => {
        const top = T.hikerY - (p.to - game.d);
        const bottom = T.hikerY - (p.from - game.d);
        if (bottom < TOP || top > BOTTOM) return [];
        const yy: number[] = [];
        for (let y = Math.max(TOP - 2, top); y <= Math.min(BOTTOM + 2, bottom); y += 3) yy.push(y);
        const l = yy.map((y) => `${(middleAt(c, distAt(y)) - halfAt(y) + 1).toFixed(1)},${y}`);
        const r = yy
          .map((y) => `${(middleAt(c, distAt(y)) + halfAt(y) - 1).toFixed(1)},${y}`)
          .reverse();
        return [{ key: k, points: [...l, ...r].join(' ') }];
      })
    : [];
  const lips: { x: number; y: number }[] = [];
  if (ridge) {
    const lip = T.ridge.lipEvery;
    const first = Math.ceil((game.d - (BOTTOM - T.hikerY)) / lip) * lip;
    for (let d = first; T.hikerY - (d - game.d) > TOP - 4; d += lip) {
      const y = T.hikerY - (d - game.d);
      const mid = middleAt(c, d);
      const half = widthAt(c, d) / 2;
      lips.push({ x: mid - half - 6, y }, { x: mid + half - 2, y });
    }
  }
  const gust = game.gust;
  const blowing = gust && game.time >= gust.warnAt;
  const river =
    c.riverSide !== null
      ? (() => {
          const side = c.riverSide;
          const near = ys.map(
            (y) => `${(middleAt(c, distAt(y)) + side * (w / 2 + T.river.gap)).toFixed(1)},${y}`,
          );
          const far = ys
            .map(
              (y) =>
                `${(middleAt(c, distAt(y)) + side * (w / 2 + T.river.gap + T.river.width)).toFixed(1)},${y}`,
            )
            .reverse();
          return [...near, ...far].join(' ');
        })()
      : null;
  const scrollY = game.d % 32;
  const water = Math.floor(game.time / 0.5) % 2 === 0 ? 'tile-water-1.png' : 'tile-water-2.png';
  const blink = game.off && Math.floor(game.time / 0.12) % 2 === 0;
  // How close the runner is to their checkpoint (a section away at most).
  const progress = Math.max(0, Math.min(1, 1 - (game.goal - game.d) / game.section));
  const word = (id: string) => {
    if (id === who && game.phase === 'run') return 'NOW';
    const st = game.status[id];
    return st === 'passed'
      ? 'PASSED'
      : st === 'failed'
        ? 'FAILED'
        : st === 'now'
          ? 'NOW'
          : 'WAITING';
  };

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={(e) => running && pointAt(e)}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && running && pointAt(e)}
        onPointerUp={(e) => e.pointerType !== 'mouse' && setGame((s) => aim(s, null))}
        onPointerLeave={() => setGame((s) => aim(s, null))}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The ground, the river and the trail, scrolling down. */}
        <span
          className={styles.ground}
          style={{
            backgroundImage: `url(${art(`${info.ground}.png`)})`,
            backgroundPositionY: `${scrollY}px`,
          }}
        />
        <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
          <defs>
            <clipPath id={`${ids}-view`}>
              <rect x="0" y={TOP} width="320" height={BOTTOM - TOP} />
            </clipPath>
            <pattern
              id={`${ids}-path`}
              patternUnits="userSpaceOnUse"
              width="32"
              height="32"
              y={scrollY}
            >
              <image
                href={art('tile-path.png')}
                width="32"
                height="32"
                style={{ imageRendering: 'pixelated' }}
              />
            </pattern>
            <pattern
              id={`${ids}-water`}
              patternUnits="userSpaceOnUse"
              width="32"
              height="32"
              y={scrollY}
            >
              <image
                href={art(water)}
                width="32"
                height="32"
                style={{ imageRendering: 'pixelated' }}
              />
            </pattern>
            <pattern
              id={`${ids}-scree`}
              patternUnits="userSpaceOnUse"
              width="32"
              height="32"
              y={scrollY}
            >
              <image
                href={art('tile-scree.png')}
                width="32"
                height="32"
                style={{ imageRendering: 'pixelated' }}
              />
            </pattern>
          </defs>
          <g clipPath={`url(#${ids}-view)`}>
            {river && <polygon points={river} fill={`url(#${ids}-water)`} />}
            <polygon
              points={[...left, ...right].join(' ')}
              fill={`url(#${ids}-path)`}
              stroke={g(5)}
              strokeWidth={1}
            />
            {screeShapes.map((p) => (
              <polygon key={p.key} points={p.points} fill={`url(#${ids}-scree)`} />
            ))}
            {lips.map((l, k) => (
              <image
                key={k}
                href={art('ridge-edge.png')}
                x={l.x}
                y={l.y - 2}
                width="8"
                height="4"
                style={{ imageRendering: 'pixelated' }}
              />
            ))}
            {/* The checkpoints: the runner's in their color, the rest faint. */}
            {checkpoints(game).map((cp) => {
              const y = T.hikerY - (cp - game.d);
              if (y < TOP - 30 || y > BOTTOM) return null;
              const mid = middleAt(c, cp);
              const mine = cp === game.goal;
              return (
                <g key={cp}>
                  <line
                    x1={mid - w / 2}
                    x2={mid + w / 2}
                    y1={y}
                    y2={y}
                    stroke={mine ? color : g(7)}
                    strokeWidth={mine ? 1.5 : 0.75}
                    strokeDasharray={mine ? undefined : '2 2'}
                  />
                  {mine && (
                    <>
                      <image
                        href={flags[litKey(FLAG, color)] ?? art('checkpoint-flag.png')}
                        x={mid + w / 2 - 2}
                        y={y - 25}
                        width="18"
                        height="26"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <text
                        x={mid - 2}
                        y={y - 3}
                        className={styles.cpText}
                        fill={g(9)}
                        textAnchor="middle"
                      >
                        {cp >= c.length ? 'THE END' : 'CHECKPOINT'}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Ridgeline's wind: streaks blowing across from one side, and the gust arrow at that edge. */}
        {blowing && gust && (
          <>
            {[40, 78, 116, 154].map((y, k) => {
              const t = (game.time - gust.warnAt) * 220 + k * 70;
              const x = gust.dir > 0 ? (t % 380) - 40 : 320 - ((t % 380) - 40);
              return (
                <img
                  key={k}
                  className={`${ui.sprite} ${styles.wind}`}
                  src={art(Math.floor(game.time / 0.15) % 2 ? 'wind-1.png' : 'wind-2.png')}
                  alt=""
                  draggable={false}
                  style={{ left: x, top: y, transform: gust.dir < 0 ? 'scaleX(-1)' : undefined }}
                />
              );
            })}
            <img
              className={`${ui.sprite} ${styles.gustArrow}`}
              src={art('gust-arrow.png')}
              alt="A gust"
              draggable={false}
              style={{
                left: gust.dir > 0 ? 4 : 302,
                top: 100,
                transform: gust.dir < 0 ? 'scaleX(-1)' : undefined,
                opacity: game.time < gust.pushAt && Math.floor(game.time / 0.12) % 2 ? 0.4 : 1,
              }}
            />
          </>
        )}

        {/* The hiker. */}
        {who && game.phase === 'run' && (
          <>
            {game.off && (
              <span
                className={styles.offRing}
                style={{ left: game.x - 9, top: T.hikerY - 15, borderColor: RED }}
              />
            )}
            <img
              className={`${ui.sprite} ${styles.hiker}`}
              src={tints[color] ?? dodgeArt('person.png')}
              alt=""
              draggable={false}
              style={{ left: game.x - 5, top: T.hikerY - 12, opacity: blink ? 0.3 : 1 }}
            />
          </>
        )}
        {game.phase === 'made' && game.made && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(game.made).name.toUpperCase()} MADE IT
          </span>
        )}
        {game.phase === 'handover' && game.ranOut && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(game.ranOut).name.toUpperCase()} RAN OUT
          </span>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          {game.comeback
            ? `${who ? byId(who).name.toUpperCase() : ''} IS BACK TO FINISH THE TRAIL.`
            : 'MOVE LEFT AND RIGHT TO STAY ON THE TRAIL. REACH YOUR CHECKPOINT.'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>TRAILS · {info.name.toUpperCase()}</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>{game.goal >= c.length ? 'TO THE END' : 'TO CHECKPOINT'}</span>
          <span className={hud.bar}>
            <span style={{ width: `${progress * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : (who ?? undefined)}
          extra={(id) => (
            <span
              className={styles.bar}
              aria-label={`${(game.bars[id] ?? 0).toFixed(1)} seconds of bar left`}
            >
              <span
                style={{
                  width: `${((game.bars[id] ?? 0) / game.barSec) * 100}%`,
                  background: byId(id).color,
                }}
              />
            </span>
          )}
        />
      </div>
    </PixelScreen>
  );
}
