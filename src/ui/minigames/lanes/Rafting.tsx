/**
 * Rafting on the GPS (docs/design/17-minigames-lanes.md, section 3; mockup
 * 6-rafting.png), in scene units (320 × 240): the river runs up the middle
 * between grassy banks, scrolling down at the current pace; the party's
 * raft (each hiker's token on it) sits in the bottom third and slides
 * between lanes. Rocks come down the lanes; rapids speed it up for the rest
 * of the run. A bar on the right fills toward the dock, which slides in at
 * the top at the end.
 */
import { useEffect, useRef, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  livesLeft,
  newRafting,
  raftAt,
  result,
  slide,
  speedUp,
  tick,
} from '../../../minigames/rafting/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './Lanes.module.css';
import { useLaneInput } from './useLaneInput';
import { slowerShare } from '../../../minigames/popups/common';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';

const R = BALANCE.minigames.rafting;
const FIXED = 1 / 120;
const art = (f: string) => asset(`minigames/rafting/${f}`);
const ROCK = { s: [16, 15], m: [22, 19], l: [30, 23] } as const;

export function Rafting({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newRafting(
      {
        tier,
        distance: typeof settings.distance === 'number' ? settings.distance : 'auto',
        extraLives: perHikerCounts(settings, 'prep.lives'),
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
        sturdy: prepNumber(settings, 'prep.sturdy') > 0,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

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

  const hitAt = game.lastHit?.at;
  useEffect(() => {
    if (hitAt !== undefined && !still) playSound('hit');
  }, [hitAt, still]);

  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  const [riverL, riverR] = R.river;
  const laneW = (riverR - riverL) / game.lanes;
  const laneX = (lane: number) => riverL + (lane + 0.5) * laneW;
  const raftX = laneX(raftAt(game));
  const input = useLaneInput({
    enabled: running,
    sceneRef,
    axes: 'horizontal',
    anchor: () => ({ x: 160, y: R.raftY }),
    onDir: (d) => setGame((s) => slide(s, d === 'left' ? -1 : 1)),
  });

  const water = Math.floor(game.time / 0.5) % 2 === 0 ? 'tile-water-1.png' : 'tile-water-2.png';
  const scroll = game.traveled % 16;
  const screenY = (at: number) => R.raftY - (at - game.traveled);
  const toDock = game.distance - game.traveled;
  const alive = livesLeft(game);
  const safe = game.safeFor > 0;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.play}
        onPointerDown={input.onPointerDown}
        onPointerUp={input.onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The banks and the river, scrolling down as the raft goes up. */}
        <span
          className={styles.thing}
          style={{
            left: 0,
            top: 0,
            width: 320,
            height: 240,
            backgroundImage: `url(${art('tile-bank.png')})`,
            backgroundSize: '16px 16px',
            backgroundPositionY: `${scroll}px`,
            imageRendering: 'pixelated',
          }}
        />
        <span
          className={styles.thing}
          style={{
            left: riverL,
            top: 0,
            width: riverR - riverL,
            height: 240,
            backgroundImage: `url(${art(water)})`,
            backgroundSize: '16px 16px',
            backgroundPositionY: `${scroll}px`,
            imageRendering: 'pixelated',
          }}
        />

        {/* The dock, sliding in at the top at the end. */}
        {toDock < 240 && (
          <img
            className={`${ui.sprite} ${styles.thing}`}
            src={art('dock.png')}
            alt="The dock"
            draggable={false}
            style={{ left: 100, top: R.raftY - toDock - 30, width: 120, height: 22 }}
          />
        )}

        {/* Rocks and rapids coming down. */}
        {game.things.map((th, k) => {
          const y = screenY(th.at);
          if (y < -30 || y > 250) return null;
          const x = th.lanes === 2 ? riverL + (th.lane + 1) * laneW : laneX(th.lane);
          const [w, h] = th.kind === 'rapids' ? [30, 22] : ROCK[th.size ?? 'm'];
          const scale = th.lanes === 2 ? 2 : 1;
          return (
            <img
              key={k}
              className={`${ui.sprite} ${styles.thing}`}
              src={art(th.kind === 'rapids' ? 'rapids.png' : `rock-${th.size ?? 'm'}.png`)}
              alt=""
              draggable={false}
              style={{
                left: x - (w * scale) / 2,
                top: y - (h * scale) / 2,
                width: w * scale,
                height: h * scale,
              }}
            />
          );
        })}

        {/* The raft, with each hiker still in on it. */}
        <span
          className={styles.thing}
          data-safe={safe || undefined}
          style={{
            left: raftX - 17,
            top: R.raftY - 12,
            width: 34,
            height: 24,
            opacity: safe && Math.floor(game.time / 0.1) % 2 ? 0.5 : 1,
          }}
        >
          <img
            className={ui.sprite}
            src={art('raft.png')}
            alt="The raft"
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: 34, height: 24 }}
          />
          {alive.map((id, k) => (
            <HikerToken
              key={id}
              hiker={byId(id)}
              size={7}
              className={styles.token}
              style={{ left: 17 - (alive.length * 8) / 2 + k * 8, top: 8.5 }}
            />
          ))}
        </span>

        {/* How far to the dock. */}
        <span className={styles.progress} aria-label="How far to the dock">
          <span style={{ height: `${Math.min(1, game.traveled / game.distance) * 100}%` }} />
        </span>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>RAFTING</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>DOCK</span>
          <span className={hud.bar}>
            <span style={{ width: `${Math.min(1, game.traveled / game.distance) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Lives (one per hiker; lost ones crossed out) and the speed. */}
        <div className={`${ui.box} ${hud.panel}`}>
          <span className={styles.lives}>
            <span>LIVES</span>
            {game.order.map((id) => (
              <span key={id} className={game.lost.includes(id) ? styles.lost : undefined}>
                <HikerToken
                  hiker={byId(id)}
                  size={10}
                  state={game.lost.includes(id) ? 'out' : 'waiting'}
                />
              </span>
            ))}
          </span>
          <span className={styles.speed}>
            SPEED ×{speedUp(game).toFixed(2)}
            {speedUp(game) > 1 ? ' · RAPIDS: FASTER FOR THE REST' : ''}
          </span>
        </div>
      </div>
    </PixelScreen>
  );
}
