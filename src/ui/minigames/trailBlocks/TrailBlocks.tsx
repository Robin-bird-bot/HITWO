/**
 * Trail Blocks on the GPS (docs/design/14-minigames-trail-blocks.md, section
 * 2; mockups 1-chop-tree.png to 4-clear-animals.png), in scene units
 * (320 × 240): a first-person view of the obstacle on the trail (Wyatt's
 * pine and rock pile), the tool swinging by itself with a wash of the active
 * hiker's color, the work bar at the top and the energy bar at the bottom.
 *
 * - Chop Tree and River Flood: a marker sweeps across the strip above the
 *   energy bar; click, tap or press Space to swing. In Chop Tree the axe is
 *   on the side the marker is on, passed behind the hiker's back between
 *   edges (third pass), and chops around the end of its handle.
 * - Mine Rockslide: hold (mouse, finger or Space) to fill the tall bar on
 *   the left; let go in the green zone.
 * - Clearing Animals: click when the solid circle's edge is in the ring;
 *   every try is somewhere new. A good whistle leans toward the ring; a
 *   whiff just shakes.
 * - After a swing, the marker (or the power, or the circle) holds where it
 *   stopped for a moment in a light frame.
 */
import { TIER_LABELS } from '../../../minigames/types';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { g } from '../../../minigames/greens';
import {
  activeHiker,
  animalsLeft,
  axePose,
  chopFrame,
  chopHitSec,
  circleRadius,
  frozen,
  markerAt,
  newTrailBlocks,
  powerAt,
  press,
  release,
  result,
  stage,
  tick,
  VERSIONS,
  waterTop,
  whistlePose,
  type Version,
} from '../../../minigames/trailBlocks/logic';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import { useWashedArt, washKey } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './TrailBlocks.module.css';
import { prepNumber } from '../../../minigames/prepare';

const B = BALANCE.minigames.trailBlocks;
const FIXED = 1 / 120;
const file = (f: string) => `minigames/trail-blocks/${f}`;
const art = (f: string) => asset(file(f));

/**
 * Each version's tool frames. The pickaxe and bucket (160 × 124, at (160,
 * 72)) go ready → raised → strike. The axe has its own chop (`chopFrame`),
 * and the whistle (160 × 160, at (172, 44)) rests or leans (`whistlePose`).
 */
const TOOL: Readonly<Record<Version, readonly string[]>> = {
  chop: ['axe-ready', 'axe-raise', 'axe-chop-1', 'axe-chop-2'],
  rockslide: ['pickaxe-ready', 'pickaxe-raised', 'pickaxe-strike'],
  river: ['bucket-ready', 'bucket-scoop', 'bucket-toss'],
  animals: [
    'whistle-rest',
    'whistle-lean-105',
    'whistle-lean-125',
    'whistle-lean-145',
    'whistle-lean-165',
  ],
};
const W = BALANCE.minigames.trailBlocks.whistle;
/** The waves art radiates up and left from this spot (its source). */
const WAVES_FROM = { x: 45, y: 37 };

/** The crowd on the trail (Clearing Animals): who stands where (top-left), as in mockup 4. */
const CROWD: readonly { kind: string; x: number; y: number; w: number; h: number }[] = [
  { kind: 'deer', x: 103, y: 93, w: 34, h: 42 },
  { kind: 'deer', x: 146, y: 90, w: 34, h: 42 },
  { kind: 'turkey', x: 161, y: 114, w: 30, h: 32 },
  { kind: 'turkey', x: 199, y: 110, w: 30, h: 32 },
  { kind: 'raccoon', x: 84, y: 145, w: 28, h: 26 },
  { kind: 'raccoon', x: 134, y: 137, w: 28, h: 26 },
  { kind: 'rabbit', x: 191, y: 143, w: 20, h: 26 },
  { kind: 'rabbit', x: 62, y: 128, w: 20, h: 26 },
];

export function TrailBlocks({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const picked = pickOf(settings, 'version');
  const version: Version = VERSIONS.some((v) => v.id === picked) ? (picked as Version) : 'chop';
  const info = VERSIONS.find((v) => v.id === version)!;
  const showQuality = pickOf(settings, 'quality') === 'on';
  const [game, setGame] = useState(() =>
    newTrailBlocks(
      { version, tier, lessWork: prepNumber(settings, 'prep.lessWork') },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const holding = useRef(false);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const toolFiles = TOOL[version].map((f) => file(`${f}.png`));
  const washes = useWashedArt(
    toolFiles,
    hikers.map((h) => h.color),
  );

  // The game loop: fixed steps, as fast as the screen draws.
  const running = !still && (game.phase === 'play' || game.phase === 'swing');
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function loop(now) {
      spare = Math.min(0.25, spare + (now - last) / 1000);
      last = now;
      const steps = Math.floor(spare / FIXED);
      spare -= steps * FIXED;
      const hold = holding.current;
      if (steps > 0) {
        setGame((s) => {
          let out = s;
          for (let i = 0; i < steps; i++) out = tick(out, FIXED, hold);
          return out;
        });
      }
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // The end: a moment to see it, then the results.
  useEffect(() => {
    if (still || reported.current || (game.phase !== 'cleared' && game.phase !== 'out')) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1800);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  // A swing's sound.
  const swings = game.swings;
  const lastQuality = game.lastSwing?.quality;
  useEffect(() => {
    if (!swings || still) return;
    playSound(lastQuality === 'miss' ? 'miss' : 'hit');
  }, [swings, lastQuality, still]);

  const down = () => {
    if (!running) return;
    if (version === 'rockslide') holding.current = true;
    else setGame((s) => press(s));
  };
  const up = () => {
    if (version !== 'rockslide' || !holding.current) return;
    holding.current = false;
    setGame((s) => release(s));
  };

  // Space: press (or hold, for the rockslide).
  useEffect(() => {
    if (still) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) down();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      up();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  });

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    down();
  };

  // What the tool shows: the axe chops on its own side; the whistle rests or
  // leans; the pickaxe and bucket go ready → raised → strike → ready.
  const since = game.lastSwing ? game.time - game.lastSwing.at : 99;
  const pose = version === 'chop' ? axePose(game) : { side: 'right' as const, up: 1 };
  const side = pose.side;
  const still$ = frozen(game);
  const whistle = version === 'animals' ? whistlePose(game) : null;
  const toolFrame =
    version === 'chop'
      ? chopFrame(since)
      : whistle
        ? whistle.frame
        : TOOL[version][since < 0.12 ? 1 : since < B.swingSec ? 2 : 0]!;
  const toolFile = file(`${toolFrame}.png`);
  const chopHit =
    version === 'chop' && game.lastSwing && since >= chopHitSec() && since < chopHitSec() + 0.5;
  const who = activeHiker(game);
  const color = (who ? byId(who) : hikers.at(-1))?.color ?? '#d3dfaf';
  const st = stage(game);
  const done = game.phase === 'cleared';
  const pop =
    game.lastSwing && since < 0.8
      ? game.lastSwing.quality === 'miss'
        ? 'THUNK'
        : game.lastSwing.quality === 'perfect'
          ? 'PERFECT!'
          : game.lastSwing.quality === 'weak'
            ? 'WEAK'
            : null
      : null;

  return (
    <PixelScreen measure={!still}>
      <div
        className={styles.play}
        onPointerDown={onPointerDown}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          className={`${ui.sprite} ${styles.bg}`}
          src={art('bg-trail.png')}
          alt=""
          draggable={false}
        />

        {/* The obstacle. */}
        {version === 'chop' &&
          (done ? (
            <>
              <img
                className={`${ui.sprite} ${styles.stump}`}
                src={art('tree-stump.png')}
                alt=""
                draggable={false}
              />
              <img
                className={`${ui.sprite} ${styles.tree} ${styles.felled}`}
                src={art('tree-4.png')}
                alt=""
                draggable={false}
                style={{ animationDuration: `${B.tipSec}s, 0.5s` }}
              />
            </>
          ) : (
            <img
              className={`${ui.sprite} ${styles.tree}`}
              src={art(`tree-${st}.png`)}
              alt="A fallen tree across the trail"
              draggable={false}
            />
          ))}
        {version === 'rockslide' && (
          <>
            {/* rocks-4 is the whole pile, rocks-0 the pebbles left once it's cleared. */}
            <img
              className={`${ui.sprite} ${styles.rocks}`}
              src={art(`rocks-${done ? 0 : 4 - st}.png`)}
              alt="A rockslide on the trail"
              draggable={false}
            />
            {game.lastSwing && game.lastSwing.quality !== 'miss' && since < 0.5 && (
              <img
                key={game.swings}
                className={`${ui.sprite} ${styles.chips}`}
                src={art('rock-chips.png')}
                alt=""
                draggable={false}
              />
            )}
          </>
        )}
        {version === 'river' && (
          <>
            <span
              className={styles.water}
              style={{
                top: waterTop(game),
                backgroundColor: g(5),
                backgroundImage: `url(${art('water-surface.png')})`,
              }}
            />
            {game.lastSwing && game.lastSwing.quality !== 'miss' && since < 0.6 && (
              <img
                key={game.swings}
                className={`${ui.sprite} ${styles.splash}`}
                src={art('splash.png')}
                alt=""
                draggable={false}
              />
            )}
          </>
        )}
        {version === 'animals' && (
          <>
            {CROWD.map((a, k) => {
              const gone = k >= animalsLeft(game);
              return (
                <img
                  key={k}
                  className={`${ui.sprite} ${styles.animal}`}
                  data-gone={gone ? (a.x + a.w / 2 < 160 ? 'left' : 'right') : undefined}
                  src={art(`animal-${a.kind}.png`)}
                  alt=""
                  draggable={false}
                  style={{ left: a.x, top: a.y, width: a.w, height: a.h }}
                />
              );
            })}
            <svg className={styles.sky} viewBox="0 0 320 240" aria-hidden="true">
              {/* The solid circle under the ring, then the ring (G7 with light edges). */}
              {!done && game.phase !== 'out' && (
                <circle cx={game.ring.x} cy={game.ring.y} r={circleRadius(game)} fill={g(2)} />
              )}
              <circle
                cx={game.ring.x}
                cy={game.ring.y}
                r={B.animals.ring.r}
                fill="none"
                stroke={g(7)}
                strokeOpacity={0.9}
                strokeWidth={B.animals.thickness[tier]}
              />
              {[-1, 1].map((k) => (
                <circle
                  key={k}
                  cx={game.ring.x}
                  cy={game.ring.y}
                  r={B.animals.ring.r + (k * B.animals.thickness[tier]) / 2}
                  fill="none"
                  stroke={g(9)}
                  strokeWidth={0.5}
                />
              ))}
              {still$ && (
                <circle
                  cx={game.ring.x}
                  cy={game.ring.y}
                  r={circleRadius(game) + 1.5}
                  fill="none"
                  stroke={g(9)}
                  strokeWidth={0.75}
                  strokeDasharray="2 1.5"
                />
              )}
            </svg>
            {/* The waves, from the leaning whistle's chamber toward the ring. */}
            {whistle?.lean && game.lastSwing?.ring && since < 0.5 && (
              <img
                className={`${ui.sprite} ${styles.waves}`}
                src={art('whistle-waves.png')}
                alt=""
                draggable={false}
                style={(() => {
                  const c = W.chamber[whistle.lean];
                  const cx = W.x + c.x + whistle.dx;
                  const cy = W.y + c.y + whistle.dy;
                  const r = game.lastSwing.ring;
                  const turn = (Math.atan2(r.y - cy, r.x - cx) * 180) / Math.PI + 135;
                  return {
                    left: cx - WAVES_FROM.x,
                    top: cy - WAVES_FROM.y,
                    transformOrigin: `${WAVES_FROM.x}px ${WAVES_FROM.y}px`,
                    transform: `rotate(${turn}deg)`,
                  };
                })()}
              />
            )}
          </>
        )}

        {/* The tool, swinging by itself, washed with the active hiker's color.
            The axe is on the marker's side and slides down out of view
            between an edge and the middle; the whistle leans toward the ring. */}
        {!done && (
          <span
            className={version === 'animals' ? styles.whistle : styles.tool}
            data-side={side}
            style={
              whistle
                ? { transform: `translate(${whistle.dx}px, ${whistle.dy}px)` }
                : {
                    transform: `translateY(${(1 - pose.up) * 170}px)${side === 'left' ? ' scaleX(-1)' : ''}`,
                  }
            }
          >
            <img
              className={ui.sprite}
              src={washes[washKey(toolFile, color)] ?? art(`${toolFrame}.png`)}
              alt=""
              draggable={false}
            />
          </span>
        )}
        {chopHit && game.lastSwing?.quality !== 'miss' && (
          <img
            key={game.swings}
            className={`${ui.sprite} ${styles.treeChips}`}
            data-side={side}
            src={art('rock-chips.png')}
            alt=""
            draggable={false}
          />
        )}

        {/* The timing control. */}
        {(version === 'chop' || version === 'river') && (
          <div className={`${ui.box} ${styles.strip}`}>
            <span className={styles.track}>
              {version === 'chop' ? (
                <>
                  <span
                    className={styles.zone}
                    style={{ left: 0, width: `${B.chop.zone[tier] * 100}%` }}
                  />
                  <span
                    className={styles.zone}
                    style={{ right: 0, width: `${B.chop.zone[tier] * 100}%` }}
                  />
                </>
              ) : (
                game.spots.map((sp, k) =>
                  sp.hit ? null : (
                    <span
                      key={`${k}-${sp.at}`}
                      className={styles.zone}
                      data-spot
                      style={{
                        left: `${(sp.at - B.river.spot[tier] / 2) * 100}%`,
                        width: `${B.river.spot[tier] * 100}%`,
                      }}
                    />
                  ),
                )
              )}
              <span
                className={styles.marker}
                data-frozen={still$ || undefined}
                style={{ left: `${markerAt(game) * 100}%` }}
              />
            </span>
          </div>
        )}
        {version === 'rockslide' && (
          <>
            <div className={`${ui.box} ${styles.power}`}>
              <span className={styles.powerTrack}>
                <span
                  className={styles.powerZone}
                  style={{
                    bottom: `${(game.zone - B.rockslide.zone[tier] / 2) * 100}%`,
                    height: `${B.rockslide.zone[tier] * 100}%`,
                  }}
                />
                <span
                  className={styles.powerFill}
                  data-frozen={still$ || undefined}
                  style={{ height: `${powerAt(game) * 100}%`, background: color }}
                />
              </span>
            </div>
            <span className={`${ui.text} ${styles.hold}`}>HOLD</span>
          </>
        )}

        {/* Words over the scene. */}
        {pop && (
          <span key={`p${game.swings}`} className={hud.pop} style={{ left: 160, top: 96 }}>
            {pop}
          </span>
        )}
        {showQuality && game.lastSwing && since < 0.8 && (
          <span
            key={`q${game.swings}`}
            className={`${hud.pop} ${styles.quality}`}
            style={{ left: 200, top: 120 }}
          >
            +{Math.round(game.lastSwing.work)}
          </span>
        )}
        {done && (
          <span className={`${hud.pop} ${styles.big}`} style={{ left: 160, top: 80 }}>
            {version === 'chop' ? 'TIMBER!' : 'CLEARED!'}
          </span>
        )}
        {game.phase === 'out' && (
          <span className={`${hud.pop} ${styles.big}`} style={{ left: 160, top: 80 }}>
            OUT OF ENERGY
          </span>
        )}

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>{info.hud}</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>{info.work.toUpperCase()}</span>
          <span className={hud.bar}>
            <span style={{ width: `${(1 - game.work / game.total) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* The energy bar: each hiker's chunk, in line order. */}
        <div className={`${ui.box} ${hud.panel}`}>
          <span className={styles.energyWord}>ENERGY</span>
          <span className={styles.chunks}>
            {game.order.map((id, k) => {
              const left = game.chunks[k] ?? 0;
              const out = left <= 0;
              return (
                <span
                  key={id}
                  className={styles.chunk}
                  data-active={(k === game.active && running) || undefined}
                >
                  <span
                    className={styles.chunkFill}
                    style={{ width: `${(left / B.chunk) * 100}%`, background: byId(id).color }}
                  />
                  <span className={styles.chunkName} data-out={out || undefined}>
                    {byId(id).name.toUpperCase()}
                    {out ? ' · OUT' : ''}
                  </span>
                </span>
              );
            })}
          </span>
        </div>
      </div>
    </PixelScreen>
  );
}
