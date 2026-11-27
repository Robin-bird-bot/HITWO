/**
 * Whackoon on the GPS (docs/design/14-minigames-trail-blocks.md, section 4;
 * mockup 6-whackoon.png), in scene units (320 × 240): raccoons pop out of
 * ribbed trash cans at a campsite; click or tap one to whack it with the
 * mallet (the cursor: Wyatt's hammer, Nov 25). Everyone plays at once on one clock.
 *
 * - Each raccoon's bandit mask is in a hiker's color; the bottom bar shows
 *   each hiker's squares filling with whacks on their color, and DONE.
 * - A done hiker's raccoons still pop up: whacking one does nothing, and the
 *   mallet rests for a moment.
 * - Skunks are decoys: a whacked skunk sprays a fog over the cans and takes
 *   time off the clock.
 */
import { TIER_LABELS } from '../../../minigames/types';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { isDone, newWhackoon, result, tick, whack } from '../../../minigames/whackoon/logic';
import { HikerToken } from '../HikerToken';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import { tintKey, useTintedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './Whackoon.module.css';
import { slowerShare } from '../../../minigames/popups/common';
import { prepNumber } from '../../../minigames/prepare';
import { whackoonBot } from '../../../minigames/whackoon/bot';
import { useDemoBot, useDemoMode } from '../demo';

const W = BALANCE.minigames.whackoon;
const FIXED = 1 / 120;
const file = (f: string) => `minigames/whackoon/${f}`;
const art = (f: string) => asset(file(f));
/** The bandit masks, tinted in each hiker's color. */
const MASKS = ['raccoon-up-mask.png', 'raccoon-peek-mask.png', 'raccoon-bonk-mask.png'].map(file);
/** The cans' rows (their tops; the 36 × 44 cans sit 4 units higher than the old ones) and columns (their middles). */
const ROWS = [58, 106, 154];
const COLS: Readonly<Record<number, readonly number[]>> = {
  3: [95, 160, 225],
  4: [70, 130, 190, 250],
};

export function Whackoon({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const skunks = pickOf(settings, 'skunks');
  const [game, setGame] = useState(() =>
    newWhackoon(
      {
        tier,
        skunks: skunks === 'on' || skunks === 'off' ? skunks : 'auto',
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
        noSkunks: prepNumber(settings, 'prep.noSkunks') > 0,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const [mallet, setMallet] = useState<{ x: number; y: number; at: number } | null>(null);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const tints = useTintedArt(
    MASKS,
    hikers.map((h) => h.color),
  );
  const cols = COLS[game.cols] ?? COLS[3]!;
  const spot = (i: number) => ({ x: cols[i % game.cols]!, y: ROWS[Math.floor(i / game.cols)]! });

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

  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1600);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  /** The can under a scene point (its sprite, or the raccoon above it). */
  const canAt = (p: { x: number; y: number }) =>
    game.cans.findIndex((_, i) => {
      const c = spot(i);
      return p.x >= c.x - 20 && p.x <= c.x + 20 && p.y >= c.y - 14 && p.y <= c.y + 44;
    });

  const onDown = (e: ReactPointerEvent) => {
    if (!running) return;
    e.preventDefault();
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    setMallet({ x: p.x, y: p.y, at: game.time });
    const i = canAt(p);
    if (i < 0) return;
    const out = whack(game, i);
    if (out.outcome === 'bonk') playSound('pop');
    if (out.outcome === 'spray' || out.outcome === 'wasted') playSound('miss');
    setGame(out.state);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    setMallet((old) => ({ x: p.x, y: p.y, at: old?.at ?? -9 }));
  };

  const fogged = game.time < game.fogUntil;
  const swinging = mallet && game.time - mallet.at < W.mallet.swingSec;
  const resting = game.time < game.malletUntil;
  const done = game.order.filter((id) => isDone(game, id));
  const names = done.map((id) => byId(id).name.toUpperCase());
  const hint =
    game.over || !done.length
      ? null
      : done.length === 1
        ? `${names[0]} IS DONE. SKIP ${names[0]}’S RACCOONS.`
        : `${names.slice(0, -1).join(', ')} AND ${names.at(-1)} ARE DONE. SKIP THEIR RACCOONS.`;

  // The pop-up's demo: the bot whacks a can, as a click would.
  useDemoBot(demo && running, game, whackoonBot, (i) => {
    const out = whack(game, i);
    setGame(out.state);
  });
  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.play}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={() => setMallet(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img className={`${ui.sprite} ${styles.bg}`} src={art('bg.png')} alt="" draggable={false} />

        {/* The cans, and whatever's up in them. */}
        {game.cans.map((m, i) => {
          const c = spot(i);
          const peek = m && game.time - m.upAt < W.peekSec;
          const frame = !m
            ? null
            : m.kind === 'skunk'
              ? peek
                ? 'skunk-peek.png'
                : 'skunk-up.png'
              : m.bonkedAt !== undefined
                ? 'raccoon-bonk.png'
                : peek
                  ? 'raccoon-peek.png'
                  : 'raccoon-up.png';
          const color = m?.color ? byId(m.color)?.color : undefined;
          const mask = frame && color ? file(frame.replace('.png', '-mask.png')) : null;
          return (
            <span key={i}>
              {frame && (
                <img
                  className={`${ui.sprite} ${styles.critter}`}
                  data-peek={peek || undefined}
                  src={art(frame)}
                  alt={
                    m?.kind === 'skunk'
                      ? 'A skunk'
                      : m?.color
                        ? `A raccoon in ${byId(m.color)?.name}’s color`
                        : 'A raccoon'
                  }
                  draggable={false}
                  style={{ left: c.x - 18, top: c.y - 12 }}
                />
              )}
              {mask && color && tints[tintKey(mask, color)] && (
                <img
                  className={`${ui.sprite} ${styles.critter}`}
                  data-peek={peek || undefined}
                  src={tints[tintKey(mask, color)]}
                  alt=""
                  draggable={false}
                  style={{ left: c.x - 18, top: c.y - 12 }}
                />
              )}
              {m?.bonkedAt !== undefined && (
                <img
                  className={`${ui.sprite} ${styles.stars}`}
                  src={art('stars.png')}
                  alt=""
                  draggable={false}
                  style={{ left: c.x - 12, top: c.y - 18 }}
                />
              )}
              <img
                className={`${ui.sprite} ${styles.can}`}
                src={art(m ? 'can-open.png' : 'can.png')}
                alt=""
                draggable={false}
                style={{ left: c.x - 18, top: c.y }}
              />
            </span>
          );
        })}

        {/* The skunk's spray over the cans. */}
        {fogged && (
          <span className={styles.fog} aria-hidden="true">
            {[
              [60, 54],
              [150, 60],
              [200, 120],
              [80, 130],
              [140, 150],
            ].map(([x, y], k) => (
              <img
                key={k}
                className={ui.sprite}
                src={art('spray.png')}
                alt=""
                draggable={false}
                style={{ left: x, top: y }}
              />
            ))}
          </span>
        )}

        {hint && <p className={`${ui.text} ${styles.hint}`}>{hint}</p>}

        {/* The mallet (resting for a moment after a wasted whack). */}
        {mallet && running && (
          <img
            className={`${ui.sprite} ${styles.mallet}`}
            data-resting={resting || undefined}
            src={art(swinging ? 'mallet-whack.png' : 'mallet-ready.png')}
            alt=""
            draggable={false}
            style={{
              left: mallet.x - W.mallet.hotX,
              top: mallet.y - W.mallet.hotY,
              width: W.mallet.w,
              height: W.mallet.h,
            }}
          />
        )}

        {game.over && (
          <span className={`${hud.pop} ${styles.big}`} style={{ left: 160, top: 100 }}>
            {game.order.every((id) => isDone(game, id)) ? 'EVERYONE DONE!' : 'TIME’S UP'}
          </span>
        )}

        {/* The top HUD: the shared clock. */}
        <div className={`${ui.box} ${hud.name}`}>WHACKOON</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>TIME</span>
          <Bar value={game.timeLeft / game.clockSec} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Each hiker's squares, filled by whacks on their color. */}
        <div className={`${ui.box} ${hud.panel}`}>
          <span className={styles.hikers}>
            {game.order.map((id) => {
              const h = byId(id);
              const got = Math.min(game.target, game.whacks[id] ?? 0);
              return (
                <span key={id} className={styles.who}>
                  <HikerToken hiker={h} size={10} state={isDone(game, id) ? 'safe' : undefined} />
                  <span className={styles.whoWords}>
                    <span>
                      {h.name.toUpperCase()}
                      {isDone(game, id) && <span className={styles.doneWord}> DONE</span>}
                    </span>
                    <span className={styles.squares} aria-label={`${got} of ${game.target}`}>
                      {Array.from({ length: game.target }, (_, k) => (
                        <span
                          key={k}
                          style={k < got ? { background: h.color } : undefined}
                          data-on={k < got || undefined}
                        />
                      ))}
                    </span>
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
