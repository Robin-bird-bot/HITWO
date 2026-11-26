/**
 * Camp Cleanup on the GPS (docs/design/21-minigames-dodge-camp.md, section 4;
 * mockups 30-camp-cleanup.png and 30b-camp-cleanup-crash.png), in scene
 * units (320 × 240): the campsite grid, the line of hikers and their bags,
 * the trash in each hiker's color, the obstacles, and a bottom bar with each
 * hiker's bags out of the quota.
 *
 * Turning: the arrow keys or WASD, a swipe, or a tap on a side of the head.
 */
import { useEffect, useRef, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  bagsOf,
  newCampCleanup,
  result,
  STEP,
  tick,
  turn,
  type CampCleanupOptions,
  type CampCleanupState,
  type Dir,
} from '../../../minigames/campCleanup/logic';
import { TIER_LABELS, type MinigameSettings } from '../../../minigames/types';
import { useTinted } from '../dodge/tint';
import { useLaneInput } from '../lanes/useLaneInput';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import { litKey, useLitArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useReportOnce } from '../quick/useQuick';
import styles from './CampCleanup.module.css';
import { slowerShare } from '../../../minigames/popups/common';
import { prepNumber } from '../../../minigames/prepare';
import { campCleanupBot } from '../../../minigames/campCleanup/bot';
import { useDemoBot, useDemoMode } from '../demo';

const C = BALANCE.minigames.campCleanup;
const file = (f: string) => `minigames/camp-cleanup/${f}`;
const LIT = [
  'trash-can.png',
  'trash-bottle.png',
  'trash-wrapper.png',
  'trash-core.png',
  'bag.png',
].map(file);
const num = (v: unknown): number | 'auto' => (typeof v === 'number' ? v : 'auto');

/** The game's options from the testing tab's settings (and, later, Prepare). */
function campOptions(settings: MinigameSettings): CampCleanupOptions {
  const obstacles = pickOf(settings, 'obstacles');
  return {
    tier: tierOf(settings),
    timeSec: num(settings.time),
    quota: num(settings.bags),
    speed: num(settings.speed),
    obstacles: obstacles === 'on' || obstacles === 'off' ? obstacles : 'auto',
    // Prepare (20-challenge-popup.md, section 7).
    extraSec: prepNumber(settings, 'prep.extraSec'),
    slower: slowerShare(prepNumber(settings, 'prep.slower')),
    fewerBags: prepNumber(settings, 'prep.fewerBags'),
    fewerObstacles: prepNumber(settings, 'prep.fewerObstacles'),
  };
}

/** Where a cell's top-left is in scene units. */
const cellX = (x: number) => C.at.x + x * C.cell;
const cellY = (y: number) => C.at.y + y * C.cell;

/** The little triangle pointing a way out of the head. */
const ARROW: Readonly<Record<Dir, string>> = {
  up: '0,4 2,0 4,4',
  down: '0,0 2,4 4,0',
  left: '4,0 0,2 4,4',
  right: '0,0 4,2 0,4',
};

export function CampCleanup({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const [game, setGame] = useState<CampCleanupState>(() =>
    newCampCleanup(
      campOptions(settings),
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const colors = hikers.map((h) => h.color);
  const lit = useLitArt(LIT, colors);
  const people = useTinted(colors);
  const running = !still && !game.over;
  const demo = useDemoMode();
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);

  // Sounds: a pickup pops, a crash hits.
  const pickAt = game.lastPickup?.at;
  const crashAt = game.lastCrash?.at;
  useEffect(() => {
    if (pickAt !== undefined && !still) playSound('pop');
  }, [pickAt, still]);
  useEffect(() => {
    if (crashAt !== undefined && !still) playSound('hit');
  }, [crashAt, still]);

  const head = game.snake[0];
  const input = useLaneInput({
    enabled: running && !demo,
    sceneRef,
    anchor: () =>
      head ? { x: cellX(head.x) + C.cell / 2, y: cellY(head.y) + C.cell / 2 } : { x: 160, y: 112 },
    onDir: (d) => setGame((s) => turn(s, d)),
  });

  const litArt = (f: string, color: string) => lit[litKey(file(f), color)] ?? asset(file(f));
  const colorOf = (id: string) => byId(id)?.color ?? '#d3dfaf';
  const done = (id: string) => bagsOf(game, id) >= game.quota;

  // The crash: the line blinks, the bags that fell tumble and fade.
  const sinceCrash = game.lastCrash ? game.time - game.lastCrash.at : Infinity;
  const blinking = game.phase === 'crash' && Math.floor(sinceCrash / 0.12) % 2 === 1;
  const tumble = Math.min(1, sinceCrash / (C.crashSec + 0.4));
  const lostWord = game.lastCrash && sinceCrash < 1.4 ? game.lastCrash.lost.length : 0;
  // While waiting after a crash: arrows on every open way out of the head.
  const openWays =
    game.phase === 'wait' && head
      ? (Object.keys(STEP) as Dir[]).filter((d) => {
          const x = head.x + STEP[d].x;
          const y = head.y + STEP[d].y;
          if (x < 0 || y < 0 || x >= game.cols || y >= game.rows) return false;
          if (game.snake.some((g) => g.x === x && g.y === y)) return false;
          return !game.obstacles.some(
            (o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h,
          );
        })
      : [];
  const ahead: Dir[] = game.phase === 'run' && head ? [game.queue[0] ?? game.dir] : openWays;
  const pickFresh =
    game.lastPickup && game.time - game.lastPickup.at < 0.6 ? game.lastPickup : null;

  // The pop-up's demo: the bot turns through the same handler.
  useDemoBot(demo && running, game, campCleanupBot, (d) => setGame((s) => turn(s, d)));
  return (
    <PixelScreen measure={!still}>
      <div
        ref={sceneRef}
        className={`${q.play} ${styles.play}`}
        onPointerDown={input.onPointerDown}
        onPointerUp={input.onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          className={`${ui.sprite} ${styles.ground}`}
          src={asset(file('ground.png'))}
          alt=""
          draggable={false}
          style={{ left: C.at.x, top: C.at.y }}
        />

        {game.obstacles.map((o, k) => (
          <img
            key={`o${k}`}
            className={`${ui.sprite} ${styles.thing}`}
            src={asset(file(`obstacle-${o.kind}.png`))}
            alt=""
            draggable={false}
            style={{ left: cellX(o.x), top: cellY(o.y), width: o.w * C.cell, height: o.h * C.cell }}
          />
        ))}

        {game.trash.map((t) => (
          <span
            key={`t${t.owner}`}
            className={styles.cellThing}
            style={{ left: cellX(t.x) + 1, top: cellY(t.y) + 1 }}
          >
            <img
              className={ui.sprite}
              src={litArt(`trash-${t.kind}.png`, colorOf(t.owner))}
              alt=""
              draggable={false}
            />
            {/* Once that hiker has their quota, a check mark. */}
            {done(t.owner) && (
              <svg className={styles.check} viewBox="0 0 5 5">
                <polyline points="0.8,2.6 2,3.8 4.2,1.2" />
              </svg>
            )}
          </span>
        ))}

        {/* The line: the hikers in dark squares, then their bags. */}
        {!blinking &&
          game.snake.map((g, k) =>
            g.kind === 'hiker' ? (
              <span
                key={`s${k}`}
                className={styles.hikerCell}
                style={{ left: cellX(g.x) + 0.5, top: cellY(g.y) + 0.5 }}
              >
                <img
                  className={ui.sprite}
                  src={people[colorOf(g.owner)] ?? asset('minigames/dodge/person.png')}
                  alt=""
                  draggable={false}
                />
              </span>
            ) : (
              <img
                key={`s${k}`}
                className={`${ui.sprite} ${styles.cellThing}`}
                src={litArt('bag.png', colorOf(g.owner))}
                alt=""
                draggable={false}
                style={{ left: cellX(g.x) + 1, top: cellY(g.y) + 1 }}
              />
            ),
          )}

        {/* The bags that fell off in the last crash, tumbling and fading. */}
        {game.lastCrash &&
          tumble < 1 &&
          game.lastCrash.lost.map((g, k) => (
            <img
              key={`l${k}`}
              className={`${ui.sprite} ${styles.cellThing}`}
              src={litArt('bag.png', colorOf(g.owner))}
              alt=""
              draggable={false}
              style={{
                left: cellX(g.x) + 1 + (k % 2 ? 1 : -1) * tumble * 4,
                top: cellY(g.y) + 1 - Math.sin(tumble * Math.PI) * 5 + tumble * 3,
                opacity: 1 - tumble,
                transform: `rotate(${(k % 2 ? 1 : -1) * tumble * 120}deg)`,
              }}
            />
          ))}

        {/* The red mark where the head hit. */}
        {head && game.phase === 'crash' && (
          <span
            className={styles.hit}
            style={
              game.dir === 'left' || game.dir === 'right'
                ? {
                    left: cellX(head.x) + (game.dir === 'right' ? C.cell : -1),
                    top: cellY(head.y) - 0.5,
                    width: 1,
                    height: C.cell + 1,
                  }
                : {
                    left: cellX(head.x) - 0.5,
                    top: cellY(head.y) + (game.dir === 'down' ? C.cell : -1),
                    width: C.cell + 1,
                    height: 1,
                  }
            }
          />
        )}

        {/* Which way the head is going (or, after a crash, the open ways). */}
        {head &&
          !game.over &&
          (game.phase !== 'wait' || Math.floor(game.time / 0.25) % 2 === 0) &&
          ahead.map((d) => (
            <svg
              key={d}
              className={styles.arrow}
              viewBox="0 0 4 4"
              style={{
                left: cellX(head.x) + C.cell / 2 - 2 + STEP[d].x * (C.cell * 0.5 + 3),
                top: cellY(head.y) + C.cell / 2 - 2 + STEP[d].y * (C.cell * 0.5 + 3),
              }}
            >
              <polygon points={ARROW[d]} />
            </svg>
          ))}

        {lostWord > 0 && head && (
          <span
            className={q.word}
            style={{
              left: cellX(head.x) + C.cell / 2,
              top: Math.max(34, cellY(head.y) - 8),
              fontSize: 4.5,
            }}
          >
            −{lostWord} {lostWord === 1 ? 'BAG' : 'BAGS'}
          </span>
        )}
        {pickFresh && (
          <span
            className={q.word}
            style={{
              left: cellX(pickFresh.x) + C.cell / 2,
              top: cellY(pickFresh.y) - 3 - (game.time - pickFresh.at) * 8,
              color: colorOf(pickFresh.owner),
              fontSize: 4.5,
            }}
          >
            +1
          </span>
        )}

        <p className={`${ui.muted} ${q.hint} ${styles.hint}`}>
          {game.phase === 'crash' || game.phase === 'wait'
            ? 'CRASH! BAGS FELL OFF THE END. PICK A WAY.'
            : 'STEER THE LINE. GRAB TRASH IN YOUR COLOR: EACH ONE ADDS A BAG BEHIND.'}
        </p>

        {/* The top HUD: the time left. */}
        <div className={`${ui.box} ${hud.name}`}>CAMP CLEANUP</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>{game.over ? 'DONE' : `TIME ${Math.ceil(game.timeLeft)}S`}</span>
          <span className={hud.bar}>
            <span style={{ width: `${(Math.max(0, game.timeLeft) / game.timeSec) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[game.tier]}</div>

        <TurnBar
          hikers={hikers}
          word={(id) => {
            const n = bagsOf(game, id);
            if (game.over) return n >= game.quota ? 'PASSED' : 'FAILED';
            return n >= game.quota ? 'DONE' : `${n} OF ${game.quota}`;
          }}
          extra={(id) => {
            const n = bagsOf(game, id);
            return (
              <span className={styles.bags} aria-label={`${n} of ${game.quota} bags`}>
                {Array.from(
                  { length: Math.max(game.quota, Math.min(n, game.quota + 3)) },
                  (_, k) => (
                    <span
                      key={k}
                      data-on={k < n || undefined}
                      data-extra={k >= game.quota || undefined}
                      style={k < n ? { background: colorOf(id) } : undefined}
                    />
                  ),
                )}
              </span>
            );
          }}
        />
      </div>
    </PixelScreen>
  );
}
