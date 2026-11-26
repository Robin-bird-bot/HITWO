/**
 * Train! on the GPS (docs/design/17-minigames-lanes.md, section 2; mockups
 * 4-train.png and 5-train-fog.png), in scene units (320 × 240): tracks
 * across the screen, the party's sprite in the middle hopping up and down,
 * and trains warned by a flashing headlight and a "!" at the edge they come
 * from. With fog (Tiers IV and V), the far side is hidden: the warnings show
 * through, dimmed, and trains only appear as they come out of it.
 */
import { useEffect, useRef, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { g } from '../../../minigames/greens';
import {
  hop,
  newTrain,
  result,
  spriteAt,
  tick,
  trainSpan,
  type Train as TrainT,
} from '../../../minigames/train/logic';
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
import { trainBot } from '../../../minigames/train/bot';
import { useDemoBot, useDemoMode } from '../demo';

const T = BALANCE.minigames.train;
const FIXED = 1 / 120;
const art = (f: string) => asset(`minigames/train/${f}`);
const num = (v: unknown): 'auto' | number => (typeof v === 'number' ? v : 'auto');

export function Train({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const fogPick = pickOf(settings, 'fog');
  const [game, setGame] = useState(() =>
    newTrain(
      {
        tier,
        lives: num(settings.lives),
        surviveSec: num(settings.survive),
        fog: fogPick === 'on' || fogPick === 'off' ? fogPick : 'auto',
        extraLives: perHikerCounts(settings, 'prep.lives'),
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
        brighter: prepNumber(settings, 'prep.brighter'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const reported = useRef(false);
  const tints = useTinted(hikers.map((h) => h.color));
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

  const running = !still && !game.over;
  const demo = useDemoMode();
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

  // The tracks, centered between the HUDs.
  const trackY = (k: number) => 112 - ((game.tracks - 1) * T.trackGap) / 2 + k * T.trackGap;
  const at = spriteAt(game);
  const input = useLaneInput({
    enabled: running && !demo,
    sceneRef,
    axes: 'vertical',
    anchor: () => ({ x: 160, y: trackY(at) }),
    onDir: (d) => setGame((s) => hop(s, d === 'up' ? -1 : 1)),
  });

  const flashOn = Math.floor(game.time / 0.12) % 2 === 0;
  const both = tier >= T.bothSidesFrom;
  const fogW = 320 * T.fogShare;

  const drawTrain = (tr: TrainT) => {
    const span = trainSpan(tr, game.time);
    if (!span || span.right < -4 || span.left > 324) return null;
    const pieces = ['engine', ...tr.cars];
    return (
      <span
        key={tr.id}
        className={`${styles.thing} ${tr.dir > 0 ? styles.flip : ''}`}
        style={{ left: span.left, top: trackY(tr.track) - 22, width: tr.length, height: 28 }}
      >
        {pieces.map((p, i) => (
          <img
            key={i}
            className={ui.sprite}
            src={art(`train-${p}.png`)}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: i === 0 ? 0 : T.engineLength + (i - 1) * T.carLength,
              top: 0,
              width: i === 0 ? T.engineLength : T.carLength,
              height: 28,
            }}
          />
        ))}
      </span>
    );
  };

  const warnings = game.trains.filter((tr) => game.time >= tr.warnAt && game.time < tr.enterAt);
  const who = game.active;
  const color = byId(who)?.color ?? '#d3dfaf';
  const left = Math.max(0, game.lengthSec - game.time);

  // The pop-up's demo: the bot hops through the same handler.
  useDemoBot(demo && running, game, trainBot, (dir) => setGame((s) => hop(s, dir)));
  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.play}
        onPointerDown={input.onPointerDown}
        onPointerUp={input.onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The tracks. */}
        {Array.from({ length: game.tracks }, (_, k) => (
          <span
            key={k}
            className={styles.row}
            style={{ top: trackY(k) - 8, backgroundImage: `url(${art('tile-rail.png')})` }}
          />
        ))}

        {/* Trains, then the sprite. */}
        {game.trains.map(drawTrain)}
        <img
          className={`${ui.sprite} ${styles.hiker}`}
          data-hop={game.hop ? '' : undefined}
          data-safe={game.safeFor > 0 || undefined}
          src={tints[color] ?? dodgeArt('person.png')}
          alt=""
          draggable={false}
          style={{ left: 155, top: trackY(at) - 11 }}
        />

        {/* Fog over the far side(s) trains come from. */}
        {game.fog && (
          <>
            <span
              className={styles.fog}
              style={{
                right: 0,
                width: fogW,
                background: `linear-gradient(90deg, transparent, ${g(8)}e6 45%, ${g(8)}f5)`,
              }}
            />
            {both && (
              <span
                className={styles.fog}
                style={{
                  left: 0,
                  width: fogW,
                  background: `linear-gradient(270deg, transparent, ${g(8)}e6 45%, ${g(8)}f5)`,
                }}
              />
            )}
          </>
        )}

        {/* Warnings: the headlight flashing at the edge it comes from, and a "!" (dimmed in fog). */}
        {warnings.map((tr) => {
          const x = tr.dir < 0 ? 296 : 0;
          const dim = game.fog ? 0.55 : 1;
          return (
            <span key={`w${tr.id}`}>
              {flashOn && (
                <img
                  className={`${ui.sprite} ${styles.thing}`}
                  src={art('headlight.png')}
                  alt=""
                  draggable={false}
                  style={{
                    left: x,
                    top: trackY(tr.track) - 18,
                    width: 24,
                    height: 24,
                    opacity: dim,
                  }}
                />
              )}
              <span
                className={`${ui.text} ${styles.mark}`}
                style={{
                  left: tr.dir < 0 ? 284 : 29,
                  top: trackY(tr.track) - 24,
                  opacity: dim,
                }}
              >
                !
              </span>
            </span>
          );
        })}

        <p className={`${ui.muted} ${styles.hint}`}>
          UP / DOWN: ARROWS, W S, TAP ABOVE OR BELOW, OR SWIPE
          {game.fog ? ' · FOG: TRAINS APPEAR LATE' : ''}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>TRAIN!</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>SURVIVE</span>
          <span className={hud.bar}>
            <span style={{ width: `${(left / game.lengthSec) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Each hiker with their hearts; the active one outlined. */}
        <div className={`${ui.box} ${hud.panel}`}>
          <span className={styles.slots}>
            {game.order.map((id) => {
              const lives = game.lives[id] ?? 0;
              return (
                <span
                  key={id}
                  className={styles.slot}
                  data-active={(id === who && running) || undefined}
                  data-out={lives === 0 || undefined}
                >
                  <img
                    className={ui.sprite}
                    src={tints[byId(id).color] ?? dodgeArt('person.png')}
                    alt=""
                    draggable={false}
                  />
                  <span className={styles.slotName}>{byId(id).name.toUpperCase()}</span>
                  <span className={styles.hearts}>
                    {Array.from({ length: game.startLives[id] ?? game.maxLives }, (_, i) => (
                      <span key={i} data-lit={i < lives || undefined}>
                        ♥
                      </span>
                    ))}
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
