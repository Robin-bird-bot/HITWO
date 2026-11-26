/**
 * Crossing on the GPS (docs/design/17-minigames-lanes.md, section 1;
 * mockups 1-road-crossing.png, 2-river-crossing-mix.png and
 * 3-critter-crossing.png), in scene units (320 × 240): Frogger, top-down.
 * The start (grass) at the bottom with the hikers waiting, the lanes, and
 * the goal (grass) at the top with a TRAIL sign. One hiker crosses at a
 * time; each press, tap or swipe hops one tile.
 */
import { useEffect, useRef, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  crossingHiker,
  hikerAt,
  hop,
  newCrossing,
  result,
  tick,
  turtleState,
  VERSIONS,
  type CrossingVersion,
  type Lane,
  type Thing,
} from '../../../minigames/crossing/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { art as dodgeArt } from '../dodge/parts/drawTypes';
import { useTinted } from '../dodge/tint';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './Lanes.module.css';
import { useLaneInput } from './useLaneInput';
import { slowerShare } from '../../../minigames/popups/common';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';

const C = BALANCE.minigames.crossing;
const FIXED = 1 / 120;
const art = (f: string) => asset(`minigames/crossing/${f}`);

/** Each thing's height (the art's), to sit it in its row. */
const HEIGHT: Readonly<Record<string, number>> = {
  car: 16,
  truck: 16,
  rv: 18,
  logger: 18,
  deer: 26,
  turkey: 20,
  raccoon: 14,
  rabbit: 12,
};

const STATE_WORD = {
  waiting: 'WAITING',
  crossing: 'CROSSING',
  across: 'ACROSS',
  out: 'OUT',
} as const;

const num = (v: unknown): 'auto' | number => (typeof v === 'number' ? v : 'auto');

export function Crossing({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const picked = pickOf(settings, 'version');
  const version: CrossingVersion = VERSIONS.some((v) => v.id === picked)
    ? (picked as CrossingVersion)
    : 'road';
  const [game, setGame] = useState(() =>
    newCrossing(
      {
        version,
        tier,
        lives: num(settings.lives),
        attemptSec: num(settings.time),
        extraLives: perHikerCounts(settings, 'prep.lives'),
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const reported = useRef(false);
  const tints = useTinted(hikers.map((h) => h.color));
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const info = VERSIONS.find((v) => v.id === game.version) ?? VERSIONS[0]!;

  const running = !still && !game.over;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function loop(now) {
      spare = Math.min(0.25, spare + (now - last) / 1000);
      last = now;
      const steps = Math.floor(spare / FIXED);
      spare -= steps * FIXED;
      if (steps > 0) {
        setGame((s) => {
          let out = s;
          for (let i = 0; i < steps && !out.over; i++) out = tick(out, FIXED);
          return out;
        });
      }
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // A hit's sound.
  const hitAt = game.lastHit?.at;
  useEffect(() => {
    if (hitAt !== undefined && !still) playSound('hit');
  }, [hitAt, still]);

  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1200);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  // The board, centered between the top HUD and the hint line.
  const rowsPx = game.rows * C.row;
  const top = Math.round(112 - rowsPx / 2);
  const rowY = (row: number) => top + (game.rows - 1 - row) * C.row;
  const at = hikerAt(game);
  const input = useLaneInput({
    enabled: running,
    sceneRef,
    anchor: () => ({ x: at.x, y: rowY(at.row) + 8 }),
    onDir: (d) => setGame((s) => hop(s, d)),
  });

  const water = Math.floor(game.time / 0.5) % 2 === 0 ? 'tile-water-1.png' : 'tile-water-2.png';
  const rowTile = (lane: Lane | undefined, k: number) => {
    if (!lane) return 'tile-grass.png';
    if (lane.kind === 'river') return water;
    if (lane.kind === 'bank') return 'tile-bank.png';
    if (lane.kind === 'critter') return 'tile-grass.png';
    return game.lanes[k - 1]?.kind === 'road' ? 'tile-road-line.png' : 'tile-road.png';
  };
  const walking = Math.floor(game.time / 0.2) % 2 === 0 ? 1 : 2;

  const drawThing = (lane: Lane, th: Thing, y: number, key: string) => {
    const flip = lane.dir < 0 ? styles.flip : '';
    if (th.kind === 'log' || th.kind === 'turtles') {
      const n = th.pieces ?? 1;
      return Array.from({ length: n }, (_, i) => {
        const file =
          th.kind === 'turtles'
            ? `turtle-${turtleState(th, game.time)}.png`
            : i === 0
              ? 'log-left.png'
              : i === n - 1
                ? 'log-right.png'
                : 'log-mid.png';
        return (
          <img
            key={`${key}-${i}`}
            className={`${ui.sprite} ${styles.thing}`}
            src={art(file)}
            alt=""
            draggable={false}
            style={{ left: th.x + i * 16, top: y + 1, width: 16, height: 14 }}
          />
        );
      });
    }
    const h = HEIGHT[th.kind] ?? 16;
    const critter = lane.kind === 'critter';
    const file = critter
      ? `critter-${th.kind}-${th.stopUntil ? 1 : walking}.png`
      : `vehicle-${th.kind}.png`;
    return (
      <img
        key={key}
        className={`${ui.sprite} ${styles.thing} ${flip}`}
        src={art(file)}
        alt=""
        draggable={false}
        style={{ left: th.x, top: critter ? y + 15 - h : y + (16 - h) / 2, width: th.w, height: h }}
      />
    );
  };

  const who = crossingHiker(game);
  const waiting = game.line.filter((id) => game.status[id] === 'waiting');
  const across = game.order.filter((id) => game.status[id] === 'across');
  const recentHit = game.lastHit && game.time - game.lastHit.at < 0.6 ? game.lastHit : null;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.play}
        onPointerDown={input.onPointerDown}
        onPointerUp={input.onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The rows: the start, the lanes, the goal. */}
        {Array.from({ length: game.rows }, (_, row) => (
          <span
            key={row}
            className={styles.row}
            style={{
              top: rowY(row),
              backgroundImage: `url(${art(rowTile(game.lanes[row - 1], row - 1))})`,
            }}
          />
        ))}
        <span
          className={`${ui.text} ${styles.sign}`}
          style={{ left: 160, top: rowY(game.rows - 1) - 6 }}
        >
          TRAIL
        </span>

        {/* What's in the lanes. */}
        {game.lanes.map((lane, k) =>
          lane.things.map((th, j) => drawThing(lane, th, rowY(k + 1), `${k}-${j}`)),
        )}

        {/* The hikers: waiting at the start, across at the goal, and the one crossing. */}
        {waiting.map((id, k) => (
          <img
            key={id}
            className={`${ui.sprite} ${styles.hiker}`}
            src={tints[byId(id).color] ?? dodgeArt('person.png')}
            alt=""
            draggable={false}
            style={{ left: 6 + k * 12, top: rowY(0) + 2 }}
          />
        ))}
        {across.map((id, k) => (
          <img
            key={id}
            className={`${ui.sprite} ${styles.hiker}`}
            src={tints[byId(id).color] ?? dodgeArt('person.png')}
            alt=""
            draggable={false}
            style={{ left: 304 - k * 12, top: rowY(game.rows - 1) + 2 }}
          />
        ))}
        {who && (
          <img
            className={`${ui.sprite} ${styles.hiker}`}
            data-hop={game.hop ? '' : undefined}
            src={tints[byId(who).color] ?? dodgeArt('person.png')}
            alt={`${byId(who).name} crossing`}
            draggable={false}
            style={{ left: at.x - 5, top: rowY(at.row) + 2 }}
          />
        )}
        {recentHit && (
          <span className={hud.pop} style={{ left: 160, top: 100, color: '#c8423a' }}>
            {recentHit.why === 'water'
              ? 'SPLASH!'
              : recentHit.why === 'time'
                ? 'TOO SLOW'
                : 'OUCH!'}
          </span>
        )}
        <p className={`${ui.muted} ${styles.hint}`}>
          ARROWS OR WASD TO HOP · TAP OR SWIPE THE WAY TO GO
        </p>

        {/* The top HUD: who's crossing, and their time. */}
        <div className={`${ui.box} ${hud.name}`}>{info.hud}</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            {who ? `${byId(who).name.toUpperCase()} ${Math.ceil(game.attemptLeft)}S` : 'DONE'}
          </span>
          <span className={hud.bar}>
            <span
              style={{ width: `${(Math.max(0, game.attemptLeft) / game.attemptSec) * 100}%` }}
            />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Each hiker: lives, and how they're doing. */}
        <div className={`${ui.box} ${hud.panel}`}>
          <span className={styles.slots}>
            {game.order.map((id) => (
              <span
                key={id}
                className={styles.slot}
                data-active={(id === who && running) || undefined}
                data-out={game.status[id] === 'out' || undefined}
              >
                <img
                  className={ui.sprite}
                  src={tints[byId(id).color] ?? dodgeArt('person.png')}
                  alt=""
                  draggable={false}
                />
                <span className={styles.slotName}>
                  {byId(id).name.toUpperCase()}{' '}
                  <span className={styles.hearts}>
                    {Array.from({ length: game.startLives[id] ?? game.maxLives }, (_, i) => (
                      <span key={i} data-lit={i < (game.lives[id] ?? 0) || undefined}>
                        ♥
                      </span>
                    ))}
                  </span>
                </span>
                <span className={styles.slotState}>{STATE_WORD[game.status[id]!]}</span>
              </span>
            ))}
          </span>
        </div>
      </div>
    </PixelScreen>
  );
}
