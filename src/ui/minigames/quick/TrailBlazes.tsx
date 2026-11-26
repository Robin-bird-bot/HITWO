/**
 * Trail Blazes on the GPS (docs/design/18-minigames-quick.md, section 1;
 * mockup 1-trail-blazes.png), in scene units (320 × 240): two trunks in the
 * deep woods, the left one scrolling up and the right one down, with an UP
 * and a DOWN sign beside them. The lit pair has a frame in the hiker's
 * color. Tap, click or press Space when they're level.
 */
import { useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { current, playing, turnWord } from '../../../minigames/quick/turns';
import { blazeY, newTrailBlazes, result, tap, tick } from '../../../minigames/trailBlazes/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from './Quick.module.css';
import styles from './TrailBlazes.module.css';
import { Squares, TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';
import { slowerShare } from '../../../minigames/popups/common';
import { prepNumber } from '../../../minigames/prepare';

const TB = BALANCE.minigames.trailBlazes;
const art = (f: string) => asset(`minigames/trail-blazes/${f}`);
const BLAZE_W = 16;
const BLAZE_H = 22;

export function TrailBlazes({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newTrailBlazes(
      {
        tier,
        mode: pickOf(settings, 'mode') === 'clock' ? 'clock' : 'tries',
        tries: typeof settings.tries === 'number' ? settings.tries : 'auto',
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
        brighter: prepNumber(settings, 'prep.brighter'),
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
  const color = who ? byId(who).color : '#d3dfaf';
  const onTurn = playing(game.turns);

  const press = () => {
    const out = tap(game);
    if (out === game) return;
    const matched = out.matched > game.matched || out.turns.done[who ?? ''] === true;
    playSound(matched ? 'pop' : 'miss');
    setGame(out);
  };
  useKeys(running, (key) => {
    if (key !== ' ' && key !== 'Enter') return false;
    press();
    return true;
  });

  /** Every blaze on a trunk that's on screen (index and center y). */
  const blazes = (side: 'l' | 'r') => {
    const off = side === 'l' ? game.offL : game.offR;
    const out: { i: number; y: number }[] = [];
    for (
      let i = Math.floor((-BLAZE_H - off) / TB.blazeGap);
      off + i * TB.blazeGap < 200 + BLAZE_H;
      i++
    ) {
      out.push({ i, y: off + i * TB.blazeGap });
    }
    return out;
  };
  const matchFresh = game.lastMatch && game.time - game.lastMatch.at < TB.matchLineSec;
  const missFresh = game.lastMiss && game.time - game.lastMiss.at < 0.6;

  const drawTrunk = (side: 'l' | 'r') => {
    const x = TB.trunkX[side === 'l' ? 0 : 1];
    const mid = x + TB.trunkW / 2;
    const gone = side === 'l' ? game.goneL : game.goneR;
    const off = side === 'l' ? game.offL : game.offR;
    const litIndex = game.lit ? (side === 'l' ? game.lit.l : game.lit.r) : null;
    const fading = matchFresh ? (side === 'l' ? game.lastMatch!.l : game.lastMatch!.r) : null;
    return (
      <span key={side}>
        <span
          className={styles.trunk}
          style={{
            left: x,
            width: TB.trunkW,
            backgroundImage: `url(${art('trunk.png')})`,
            backgroundPositionY: `${off % 64}px`,
          }}
        />
        {blazes(side).map(({ i, y }) => {
          const lit = i === litIndex && onTurn;
          if (gone.includes(i) && i !== fading) return null;
          return (
            <span key={i}>
              <img
                className={`${ui.sprite} ${q.thing}`}
                data-fade={i === fading || undefined}
                src={art(lit ? 'blaze-lit.png' : 'blaze.png')}
                alt=""
                draggable={false}
                style={{
                  left: mid - BLAZE_W / 2,
                  top: y - BLAZE_H / 2,
                  width: BLAZE_W,
                  height: BLAZE_H,
                  opacity:
                    i === fading ? 1 - (game.time - game.lastMatch!.at) / TB.matchLineSec : 1,
                }}
              />
              {lit && (
                <span
                  className={styles.frame}
                  style={{
                    left: mid - BLAZE_W / 2 - 2.5,
                    top: y - BLAZE_H / 2 - 2.5,
                    width: BLAZE_W + 5,
                    height: BLAZE_H + 5,
                    borderColor: color,
                  }}
                />
              )}
            </span>
          );
        })}
      </span>
    );
  };

  // The match's line, between the two blazes' centers.
  const line =
    matchFresh && game.lastMatch
      ? {
          x1: TB.trunkX[0] + TB.trunkW / 2,
          y1: blazeY(game, 'l', game.lastMatch.l),
          x2: TB.trunkX[1] + TB.trunkW / 2,
          y2: blazeY(game, 'r', game.lastMatch.r),
        }
      : null;

  const clock = game.mode === 'clock';
  const hint = clock
    ? `TAP WHEN THE TWO LIT BLAZES ARE LEVEL. A MISS COSTS ${TB.missCostSec} S.`
    : 'TAP WHEN THE TWO LIT BLAZES ARE LEVEL. SQUARES ARE TRIES LEFT.';

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
        {drawTrunk('l')}
        {drawTrunk('r')}
        {line && (
          <svg className={styles.line} viewBox="0 0 320 240" aria-hidden="true">
            <line {...line} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </svg>
        )}

        {/* The UP and DOWN signs. */}
        <span className={`${ui.text} ${styles.sign}`} style={{ left: 71, top: 92 }}>
          <svg viewBox="0 0 10 12" aria-hidden="true">
            <path d="M5 1 1 6h2.5v5h3V6H9z" fill="#1d2918" />
          </svg>
          UP
        </span>
        <span className={`${ui.text} ${styles.sign}`} style={{ left: 223, top: 92 }}>
          DOWN
          <svg viewBox="0 0 10 12" aria-hidden="true">
            <path d="M5 11 1 6h2.5V1h3v5H9z" fill="#1d2918" />
          </svg>
        </span>

        {missFresh && onTurn && (
          <span className={q.word} style={{ left: 160, top: 60 }}>
            {game.lastMiss!.why === 'passed' ? 'TOO LATE' : 'NOT LEVEL'}
          </span>
        )}
        {!onTurn && !game.over && who && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(who).name.toUpperCase()}, YOUR TURN
          </span>
        )}
        <p className={`${ui.muted} ${q.hint}`}>{hint}</p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>TRAIL BLAZES</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            PAIRS {game.matched}/{game.pairsNeeded}
            {clock ? ` · ${Math.ceil(Math.max(0, game.clockLeft))} S` : ''}
          </span>
          <span className={hud.bar}>
            <span
              style={{
                width: `${clock ? (Math.max(0, game.clockLeft) / game.clockSec) * 100 : (game.matched / game.pairsNeeded) * 100}%`,
              }}
            />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={(id) => turnWord(game.turns, id)}
          active={game.over ? undefined : who}
          extra={(id) => {
            const now = id === who && !game.over;
            const rec = game.record[id];
            if (clock) {
              const got = now ? game.matched : (rec?.matched ?? 0);
              return <Squares total={game.pairsNeeded} lit={got} label={`${got} pairs`} />;
            }
            const used = now ? game.misses : (rec?.misses ?? 0);
            const left = Math.max(0, game.tries - used);
            return <Squares total={game.tries} lit={left} label={`${left} tries left`} />;
          }}
        />
      </div>
    </PixelScreen>
  );
}
