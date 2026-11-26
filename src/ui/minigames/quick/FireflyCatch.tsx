/**
 * Firefly Catch on the GPS (docs/design/18-minigames-quick.md, section 2;
 * mockup 2-firefly-catch.png), in scene units (320 × 240): a night meadow,
 * the play box drawn as a thin light frame, the jar ring in the active
 * hiker's color, and the firefly. A catch flies down into the hiker's jar in
 * the bottom bar.
 */
import { useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { isDark, newFireflyCatch, result, tap, tick } from '../../../minigames/fireflyCatch/logic';
import { current, playing, turnWord } from '../../../minigames/quick/turns';
import { TIER_LABELS } from '../../../minigames/types';
import { PixelScreen } from '../PixelScreen';
import { tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './FireflyCatch.module.css';
import q from './Quick.module.css';
import { TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';

const F = BALANCE.minigames.fireflyCatch;
const BOX = F.box;
const art = (f: string) => asset(`minigames/firefly-catch/${f}`);

export function FireflyCatch({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newFireflyCatch(
      {
        tier,
        catches: typeof settings.catches === 'number' ? settings.catches : 'auto',
        timeSec: typeof settings.time === 'number' ? settings.time : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);

  const who = current(game.turns);
  const onTurn = playing(game.turns);
  const color = who ? byId(who).color : '#d3dfaf';

  const press = () => {
    const out = tap(game);
    if (out === game) return;
    playSound(out.lastCatch !== game.lastCatch ? 'pop' : 'miss');
    setGame(out);
  };
  useKeys(running, (key) => {
    if (key !== ' ' && key !== 'Enter') return false;
    press();
    return true;
  });

  const caughtBy = (id: string) =>
    id === who && !game.over ? game.caught : (game.record[id] ?? 0);
  // The last catch flying down to the jar (its slot's spot along the bottom bar).
  const toJar = game.lastCatch ? (game.time - game.lastCatch.at) / F.toJarSec : 1;
  const jarIndex = Math.max(0, game.turns.order.indexOf(game.lastCatch?.by ?? ''));
  const jarX = 5 + (310 / Math.max(1, hikers.length)) * (jarIndex + 0.5) - 32;
  const flying = game.lastCatch && toJar < 1 ? game.lastCatch : null;
  const missFresh = game.lastMiss && game.time - game.lastMiss.at < 0.6;
  const missSec = F.tiers[tier].missSec;

  return (
    <PixelScreen measure={!still}>
      <div
        className={q.play}
        onPointerDown={(e) => {
          if (!running) return;
          e.preventDefault();
          press();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img className={`${ui.sprite} ${q.bg}`} src={art('bg.png')} alt="" draggable={false} />
        <span
          className={styles.box}
          style={{
            left: BOX.left,
            top: BOX.top,
            width: BOX.right - BOX.left,
            height: BOX.bottom - BOX.top,
          }}
        />

        {onTurn && (
          <>
            {/* The jar ring, in the hiker's color. */}
            <span
              className={styles.ring}
              style={{
                left: game.ringAt.x - game.ring / 2,
                top: game.ringAt.y - game.ring / 2,
                width: game.ring,
                height: game.ring,
                borderColor: color,
              }}
            />
            <img
              className={`${ui.sprite} ${q.thing}`}
              src={art(isDark(game) ? 'firefly-dim.png' : 'firefly.png')}
              alt=""
              draggable={false}
              style={{ left: game.fly.x - 7.5, top: game.fly.y - 7.5, width: 15, height: 15 }}
            />
          </>
        )}

        {/* A caught firefly, flying down to the jar. */}
        {flying && (
          <img
            className={`${ui.sprite} ${q.thing}`}
            src={art('firefly.png')}
            alt=""
            draggable={false}
            style={{
              left: flying.x + (jarX + 9 - flying.x) * toJar - 5,
              top: flying.y + (218 - flying.y) * toJar - 5,
              width: 10,
              height: 10,
            }}
          />
        )}

        {missFresh && onTurn && (
          <span className={q.word} style={{ left: 160, top: 44 }}>
            {missSec > 0 ? `MISS −${missSec} S` : 'MISS'}
          </span>
        )}
        {!onTurn && !game.over && who && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(who).name.toUpperCase()}, YOUR TURN
          </span>
        )}
        <p className={`${ui.muted} ${q.hint}`}>TAP WHEN THE FIREFLY IS INSIDE THE JAR RING</p>

        {/* The top HUD: the hiker up and their time. */}
        <div className={`${ui.box} ${hud.name}`}>FIREFLY CATCH</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            {who && !game.over
              ? `${byId(who).name.toUpperCase()} ${Math.ceil(game.timeLeft)}S`
              : 'DONE'}
          </span>
          <span className={hud.bar}>
            <span style={{ width: `${(Math.max(0, game.timeLeft) / game.timeSec) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={(id) => turnWord(game.turns, id)}
          active={game.over ? undefined : who}
          lead={(id) => {
            const got = caughtBy(id);
            return (
              <img
                className={`${ui.sprite} ${styles.jar}`}
                src={art(`jar-${Math.min(3, got)}.png`)}
                alt={`${got} of ${game.catchesNeeded} caught`}
                draggable={false}
              />
            );
          }}
        />
      </div>
    </PixelScreen>
  );
}
