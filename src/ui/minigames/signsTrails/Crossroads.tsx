/**
 * Crossroads on the GPS (docs/design/19-minigames-signs-trails.md, section
 * 3; mockups 18-crossroads-arrows.png, 18b-crossroads-wrong.png and
 * 19-crossroads-walk.png), in scene units (320 × 240):
 * - **The arrow screen:** REMEMBER THE WAY, the arrows in a row (2×, in
 *   G9), each on a dark tile with its step under it, and READY. After a
 *   wrong turn, the steps that hiker got right are in their color, with a
 *   line saying where they went wrong.
 * - **Walking:** four trails meeting in the woods, seen from above; the
 *   hiker's icon in the middle, footprints on the way they came. An arrow
 *   key or WASD, a tap on that side's trail, or a swipe.
 */
import { useEffect, useRef, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  choose,
  current,
  missedLine,
  newCrossroads,
  ready,
  result,
  tick,
  type Dir,
} from '../../../minigames/crossroads/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { art as dodgeArt } from '../dodge/parts/drawTypes';
import { useTinted } from '../dodge/tint';
import { useLaneInput } from '../lanes/useLaneInput';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { mgSfx, playSound } from '../sound';
import { litKey, useLitArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './Crossroads.module.css';
import { prepNumber } from '../../../minigames/prepare';

const C = BALANCE.minigames.crossroads;
const file = (f: string) => `minigames/crossroads/${f}`;
const art = (f: string) => asset(file(f));
const ARROW = file('arrow.png');
const TURN: Readonly<Record<Dir, number>> = { up: 0, right: 90, down: 180, left: 270 };
const STEP: Readonly<Record<Dir, { x: number; y: number }>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
/** The middle of the crossing, where the hiker stands. */
const MID = { x: 160, y: 100 };

export function Crossroads({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newCrossroads(
      {
        tier,
        arrows: Math.max(
          2,
          (typeof settings.arrows === 'number' ? settings.arrows : C.arrows[tier]) -
            prepNumber(settings, 'prep.fewerArrows'),
        ),
        studySec: typeof settings.study === 'number' ? settings.study : null,
        newPerHiker: pickOf(settings, 'newArrows') === 'on',
        turnSec: typeof settings.turn === 'number' ? settings.turn : null,
        markers: prepNumber(settings, 'prep.marker'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const tints = useTinted(hikers.map((h) => h.color));
  const lit = useLitArt(
    [ARROW],
    hikers.map((h) => h.color),
  );

  const go = (d: Dir) => {
    const out = choose(game, d);
    if (out === game) return;
    // A step, a bump (the way you came), or a wrong turn.
    if (out.phase === 'step') mgSfx('mg.point');
    else playSound(out.phase === 'walk' ? 'hit' : 'miss');
    setGame(out);
  };
  const input = useLaneInput({
    enabled: running && game.phase === 'walk',
    sceneRef,
    anchor: () => MID,
    onDir: go,
  });
  useKeys(running && game.phase === 'study', (key) => {
    if (key !== ' ' && key !== 'Enter') return false;
    setGame(ready);
    return true;
  });

  const who = current(game);
  const color = who ? byId(who).color : '#d3dfaf';
  const since = game.time - game.phaseAt;
  const studying = game.phase === 'study';
  // Each arrow of the row shows with a blip, higher for each.
  const studyFor = studying && !still ? game.at : null;
  const rowLength = Math.min(game.arrows.length, game.count);
  useEffect(() => {
    if (studyFor === null) return;
    for (let k = 0; k < rowLength; k++) {
      mgSfx('crossroads.arrow', { version: Math.min(3, k), delay: k * BALANCE.audio.arrowGapSec });
    }
  }, [studyFor, rowLength]);
  const missedBy = game.missed ? byId(game.missed.by) : null;

  // The icon walking out of this crossing, then into the next from the other side.
  let icon = { x: MID.x, y: MID.y };
  if (game.phase === 'step' && game.moving) {
    const v = STEP[game.moving];
    const reach = 70;
    icon =
      since < C.walkOutSec
        ? {
            x: MID.x + v.x * reach * (since / C.walkOutSec),
            y: MID.y + v.y * reach * (since / C.walkOutSec),
          }
        : {
            x: MID.x - v.x * reach * (1 - (since - C.walkOutSec) / C.walkInSec),
            y: MID.y - v.y * reach * (1 - (since - C.walkOutSec) / C.walkInSec),
          };
  }
  const bumped = game.bump && game.time - game.bump.at < C.bumpSec ? STEP[game.bump.dir] : null;
  if (bumped) icon = { x: icon.x + bumped.x * 3, y: icon.y + bumped.y * 3 };
  const back = STEP[game.cameFrom];
  const word = (id: string) =>
    game.status[id] === 'passed'
      ? 'PASSED'
      : game.status[id] === 'failed'
        ? 'FAILED'
        : id === who && !game.over
          ? 'NOW'
          : 'WAITING';
  const n = game.arrows.length;
  const tile = Math.min(26, (264 - (n - 1) * 6) / n);

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={input.onPointerDown}
        onPointerUp={input.onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          className={`${ui.sprite} ${q.bg}`}
          src={art(game.phase === 'made' ? 'clearing.png' : 'crossroads.png')}
          alt=""
          draggable={false}
        />

        {/* Walking: footprints the way they came, and the hiker. */}
        {!studying && game.phase !== 'done' && (
          <>
            {game.phase === 'walk' &&
              [0, 1, 2].map((k) => (
                <span
                  key={k}
                  className={styles.print}
                  style={{
                    left:
                      MID.x + back.x * (16 + k * 12) - 1.5 + (k % 2 ? 2 : -2) * Math.abs(back.y),
                    top: MID.y + back.y * (16 + k * 12) - 1.5 + (k % 2 ? 2 : -2) * Math.abs(back.x),
                  }}
                />
              ))}
            {/* TRAIL MARKER: this crossing shows its arrow. */}
            {game.phase === 'walk' && game.marked.includes(game.step) && (
              <img
                className={`${ui.sprite} ${styles.marker}`}
                src={art('arrow.png')}
                alt={`Trail marker: ${game.arrows[game.step]}`}
                draggable={false}
                style={{
                  left: MID.x + 14,
                  top: MID.y - 30,
                  transform: `rotate(${TURN[game.arrows[game.step]!]}deg)`,
                }}
              />
            )}
            <img
              className={`${ui.sprite} ${styles.hiker}`}
              src={tints[color] ?? dodgeArt('person.png')}
              alt=""
              draggable={false}
              style={{ left: icon.x - 5, top: icon.y - 6 }}
            />
            {game.phase === 'made' && who && (
              <span className={`${ui.box} ${q.handoff}`}>
                {byId(who).name.toUpperCase()} MADE IT
              </span>
            )}
          </>
        )}

        {/* The arrow screen. */}
        {studying && (
          <>
            <span className={styles.dim} />
            <div className={`${ui.box} ${styles.box}`}>
              <span className={styles.title}>REMEMBER THE WAY</span>
              <span className={styles.arrows}>
                {game.arrows.map((d, k) => {
                  const done = game.missed && k < game.missed.right && missedBy;
                  const src = done
                    ? (lit[litKey(ARROW, missedBy.color)] ?? art('arrow.png'))
                    : art('arrow.png');
                  return (
                    <span key={k} className={styles.cell}>
                      <span className={styles.tile} style={{ width: tile, height: tile }}>
                        <img
                          className={ui.sprite}
                          src={src}
                          alt={d}
                          draggable={false}
                          style={{
                            width: tile * 0.92,
                            height: tile * 0.92,
                            transform: `rotate(${TURN[d]}deg)`,
                          }}
                        />
                      </span>
                      <span className={styles.n}>{k + 1}</span>
                    </span>
                  );
                })}
              </span>
              {game.missed && missedBy && (
                <span className={styles.missed} style={{ color: missedBy.color }}>
                  {missedLine(game.missed, missedBy.name)}
                </span>
              )}
            </div>
            <button
              type="button"
              className={`${ui.button} ${styles.ready}`}
              disabled={still}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setGame(ready)}
            >
              READY
            </button>
            {who && (
              <p className={`${ui.text} ${styles.whoNext}`}>
                {byId(who).name.toUpperCase()}, YOU’RE UP.
              </p>
            )}
          </>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          {studying
            ? 'REMEMBER THE ARROWS, THEN WALK THEM.'
            : 'ARROWS OR WASD · TAP THE TRAIL OR SWIPE THE WAY TO GO'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>CROSSROADS</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            {studying ? 'STUDY' : `STEP ${Math.min(game.count, game.step + 1)}/${game.count}`}
          </span>
          <Bar
            value={
              studying
                ? game.studySec
                  ? 1 - since / game.studySec
                  : 1
                : game.turnSec && game.phase === 'walk'
                  ? 1 - since / game.turnSec
                  : game.step / game.count
            }
            live={(studying && !!game.studySec) || (!!game.turnSec && game.phase === 'walk')}
          />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar hikers={hikers} word={word} active={game.over ? undefined : who} />
      </div>
    </PixelScreen>
  );
}
