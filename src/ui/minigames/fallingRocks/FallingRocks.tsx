/**
 * Falling Rocks on the GPS (docs/design/23-minigames-final.md, section 2;
 * mockup 41-falling-rocks.png), in scene units (320 × 240): a side view of
 * a ledge trail across a mountainside, with two overhangs. Dust at the top
 * marks where a rock will fall, and its shadow grows on the trail until it
 * lands. Boulders rumble at an edge ("<<<"), then roll the whole trail.
 *
 * Hold → or D (or the right half of the screen) to walk; ← or A (or the
 * left half) to back up; let go to stop.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { fallingRocksBot } from '../../../minigames/fallingRocks/bot';
import {
  boulderX,
  halfOf,
  newFallingRocks,
  result,
  setDir,
  shadowGrowth,
  tick,
  underOverhang,
  walker,
  type Rock,
} from '../../../minigames/fallingRocks/logic';
import { slowerShare } from '../../../minigames/popups/common';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';
import { turnWord } from '../../../minigames/quick/turns';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { tintKey, useTintedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './FallingRocks.module.css';

const F = BALANCE.minigames.fallingRocks;
const art = (f: string) => asset(`minigames/falling-rocks/${f}`);
const HIKER_FILES = ['hiker-stand.png', 'hiker-walk-1.png', 'hiker-walk-2.png'].map(
  (f) => `minigames/sleeping-bear/${f}`,
);
/** The slope art's top on screen; the trail's left end and the hikers' feet on it. */
const BG_TOP = 22;
const TRAIL_X = 10;
const FEET = BG_TOP + 118;
const ROCK_ART = {
  s: { file: 'rock-s.png', w: 15, h: 12 },
  m: { file: 'rock-m.png', w: 24, h: 19 },
  l: { file: 'rock-l.png', w: 36, h: 28 },
};

export function FallingRocks({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const bouldersPick = pickOf(settings, 'boulders');
  const [game, setGame] = useState(() =>
    newFallingRocks(
      {
        tier,
        lives: typeof settings.lives === 'number' ? settings.lives : 'auto',
        boulders: bouldersPick === 'on' || bouldersPick === 'off' ? bouldersPick : 'auto',
        // Prepare (23-minigames-final.md, section 10).
        extraLives: perHikerCounts(settings, 'prep.lives'),
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
        extraWarnSec: prepNumber(settings, 'prep.warn'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const demo = useDemoMode();
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const tints = useTintedArt(
    HIKER_FILES,
    hikers.map((h) => h.color),
  );
  const hikerArt = (k: number, color: string) =>
    tints[tintKey(HIKER_FILES[k]!, color)] ?? asset(HIKER_FILES[k]!);

  const walk = (dir: -1 | 0 | 1) => running && setGame((s) => setDir(s, dir));
  useKeys(
    running,
    (key) => {
      if (key === 'ArrowRight' || key === 'd') walk(1);
      else if (key === 'ArrowLeft' || key === 'a') walk(-1);
      else return false;
      return true;
    },
    (key) => {
      if (key === 'ArrowRight' || key === 'd' || key === 'ArrowLeft' || key === 'a') walk(0);
    },
  );
  useDemoBot(demo && running, game, fallingRocksBot, (d) => setGame((s) => setDir(s, d)));
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    e.preventDefault();
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    walk(p.x >= 160 ? 1 : -1);
  };

  const who = walker(game);
  const color = who ? (byId(who)?.color ?? '#d3dfaf') : '#d3dfaf';
  const hx = TRAIL_X + game.x;
  const blinking = game.time < game.safeUntil && Math.floor(game.time * 10) % 2 === 0;
  const frame = game.dir !== 0 ? 1 + (Math.floor(game.time * 6) % 2) : 0;
  const safe = underOverhang(game.x);
  const across = game.turns.order.filter((id) => game.turns.done[id] === true).length;
  const word = (id: string) => {
    if (game.out.includes(id)) return 'OUT';
    if (game.turns.done[id]) return 'ACROSS';
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'CROSSING' : w;
  };

  const drawRock = (r: Rock) => {
    const x = TRAIL_X + r.x;
    const half = halfOf(r.size);
    const a = ROCK_ART[r.size];
    const g = shadowGrowth(r, game.time);
    const since = game.time - r.landAt;
    const fallFrom = 0.65;
    // Falling in the last third of the warning, then bouncing off the ledge and away.
    const y =
      since >= 0
        ? FEET - a.h + since * 60 + since * since * 300
        : g > fallFrom
          ? 30 + ((g - fallFrom) / (1 - fallFrom)) ** 2 * (FEET - a.h - 30)
          : null;
    return (
      <span key={r.id}>
        {g < 0.7 && since < 0 && (
          <img
            className={`${ui.sprite} ${styles.dust}`}
            src={art('dust.png')}
            alt=""
            draggable={false}
            style={{ left: x - 11, top: 26 }}
          />
        )}
        {since < 0 && (
          <span
            className={styles.shadow}
            style={{ left: x - half * g, top: FEET - 1.5, width: 2 * half * g }}
          />
        )}
        {y !== null && (
          <img
            className={`${ui.sprite} ${styles.rock}`}
            src={art(a.file)}
            alt=""
            draggable={false}
            style={{
              left: x - a.w / 2 + (since > 0 ? since * 40 : 0),
              top: y,
              opacity: since > 0 ? Math.max(0, 1 - since / F.bounceSec) : 1,
            }}
          />
        )}
      </span>
    );
  };

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={onDown}
        onPointerUp={() => !demo && walk(0)}
        onPointerCancel={() => !demo && walk(0)}
        onPointerLeave={() => !demo && walk(0)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          className={`${ui.sprite} ${styles.bg}`}
          src={art('slope.png')}
          alt=""
          draggable={false}
        />
        {safe && who && (
          <span className={`${ui.text} ${styles.safe}`} style={{ left: hx }}>
            SAFE
          </span>
        )}

        {game.hazards.map((h) => {
          if (h.kind === 'rock') return drawRock(h);
          const bx = TRAIL_X + boulderX(h, game.time);
          const rolling = game.time >= h.rollAt;
          return (
            <span key={h.id}>
              {!rolling && (
                <span className={q.word} style={{ left: h.dir === 1 ? 24 : 296, top: FEET - 18 }}>
                  {h.dir === 1 ? '>>>' : '<<<'}
                </span>
              )}
              {rolling && (
                <img
                  className={`${ui.sprite} ${styles.rock}`}
                  src={art('rock-l.png')}
                  alt=""
                  draggable={false}
                  style={{
                    left: bx - 18,
                    top: FEET - 28,
                    transform: `rotate(${((game.time - h.rollAt) * h.speed * 3 * h.dir) % 360}deg)`,
                  }}
                />
              )}
            </span>
          );
        })}

        {who && (
          <img
            className={`${ui.sprite} ${styles.hiker}`}
            data-blink={blinking || undefined}
            src={hikerArt(frame, color)}
            alt=""
            draggable={false}
            style={{
              left: hx - 5,
              top: FEET - 13,
              transform: game.dir === -1 ? 'scaleX(-1)' : undefined,
            }}
          />
        )}
        {game.lastHit && game.time - game.lastHit.at < 0.8 && (
          <span className={q.word} style={{ left: TRAIL_X + game.lastHit.x, top: FEET - 22 }}>
            OW!
          </span>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          WALK OR STOP UNDER THE SHADOWS. OVERHANGS ARE SAFE FROM EVERYTHING, EVEN THE BOULDERS.
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>FALLING ROCKS</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            ACROSS {across} OF {game.turns.order.length}
          </span>
          <Bar value={game.x / F.length} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : who}
          extra={(id) => (
            <span className={styles.pips} aria-label={`${game.lives[id] ?? 0} lives`}>
              {Array.from({ length: Math.max(0, game.lives[id] ?? 0) }, (_, k) => (
                <span key={k} style={{ background: byId(id)?.color }} />
              ))}
            </span>
          )}
        />
      </div>
    </PixelScreen>
  );
}
