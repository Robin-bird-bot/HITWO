/**
 * Whackoon on the GPS (docs/design/14-minigames-trail-blocks.md, section 4;
 * mockups 6-whackoon.png and 7-whackoon-colors.png), in scene units
 * (320 × 240): raccoons pop out of trash cans at a campsite; click or tap
 * one to whack it with the frying pan (the cursor). Skunks are decoys: a
 * whacked skunk sprays a fog over the cans and takes time off the clock.
 *
 * - **Colors** (the default): each raccoon's bandit mask is in a hiker's
 *   color. The bottom bar shows each hiker's squares filling with whacks on
 *   their color, and DONE. A done hiker's raccoons still pop up: whacking
 *   one does nothing, and the pan rests for a moment.
 * - **Turns:** the top shows whose turn it is; the bottom bar shows the
 *   team's total against the target and each hiker's whacks.
 */
import { TIER_LABELS } from '../../../minigames/types';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  isDone,
  newWhackoon,
  result,
  tick,
  turnHiker,
  whack,
} from '../../../minigames/whackoon/logic';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import { tintKey, useTintedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './Whackoon.module.css';

const W = BALANCE.minigames.whackoon;
const FIXED = 1 / 120;
const file = (f: string) => `minigames/whackoon/${f}`;
const art = (f: string) => asset(file(f));
/** The bandit masks, tinted in each hiker's color (Colors mode). */
const MASKS = ['raccoon-up-mask.png', 'raccoon-peek-mask.png', 'raccoon-bonk-mask.png'].map(file);
/** The cans' rows (their tops) and columns (their middles), as in the design. */
const ROWS = [62, 110, 158];
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
        mode: pickOf(settings, 'mode') === 'turns' ? 'turns' : 'colors',
        skunks: skunks === 'on' || skunks === 'off' ? skunks : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number; at: number } | null>(null);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const colors = game.mode === 'colors';
  const tints = useTintedArt(
    colors ? MASKS : [],
    hikers.map((h) => h.color),
  );
  const cols = COLS[game.cols] ?? COLS[3]!;
  const spot = (i: number) => ({ x: cols[i % game.cols]!, y: ROWS[Math.floor(i / game.cols)]! });

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
      return p.x >= c.x - 20 && p.x <= c.x + 20 && p.y >= c.y - 14 && p.y <= c.y + 40;
    });

  const onDown = (e: ReactPointerEvent) => {
    if (!running) return;
    e.preventDefault();
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    setPan({ x: p.x, y: p.y, at: game.time });
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
    setPan((old) => ({ x: p.x, y: p.y, at: old?.at ?? -9 }));
  };

  const who = turnHiker(game);
  const fogged = game.time < game.fogUntil;
  const swinging = pan && game.time - pan.at < 0.15;
  const resting = game.time < game.panUntil;
  const done = colors ? game.order.filter((id) => isDone(game, id)) : [];
  const names = done.map((id) => byId(id).name.toUpperCase());
  const hint =
    !colors || game.over || !done.length
      ? null
      : done.length === 1
        ? `${names[0]} IS DONE. SKIP ${names[0]}’S RACCOONS.`
        : `${names.slice(0, -1).join(', ')} AND ${names.at(-1)} ARE DONE. SKIP THEIR RACCOONS.`;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.play}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={() => setPan(null)}
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

        {/* The frying pan (resting for a moment after a wasted whack). */}
        {pan && running && (
          <img
            className={`${ui.sprite} ${styles.pan}`}
            data-resting={resting || undefined}
            src={art(swinging ? 'pan-whack.png' : 'pan-ready.png')}
            alt=""
            draggable={false}
            style={{ left: pan.x - 18, top: pan.y - 26 }}
          />
        )}

        {game.over && (
          <span className={`${hud.pop} ${styles.big}`} style={{ left: 160, top: 100 }}>
            {colors
              ? game.order.every((id) => isDone(game, id))
                ? 'EVERYONE DONE!'
                : 'TIME’S UP'
              : game.team >= game.target
                ? 'TEAM DID IT!'
                : 'NOT ENOUGH'}
          </span>
        )}

        {/* The top HUD: the clock (Colors), or whose turn and its time (Turns). */}
        <div className={`${ui.box} ${hud.name}`}>WHACKOON</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            {colors
              ? 'TIME'
              : who
                ? `${byId(who).name.toUpperCase()} ${Math.ceil(game.turnLeft)}S`
                : 'DONE'}
          </span>
          <span className={hud.bar}>
            <span style={{ width: `${(Math.max(0, game.turnLeft) / game.clockSec) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Colors: each hiker's squares, filled by whacks on their color. */}
        {colors && (
          <div className={`${ui.box} ${hud.panel}`}>
            <span className={styles.hikers}>
              {game.order.map((id) => {
                const h = byId(id);
                const got = Math.min(game.colorTarget, game.whacks[id] ?? 0);
                return (
                  <span key={id} className={styles.who}>
                    <HikerToken hiker={h} size={10} state={isDone(game, id) ? 'safe' : undefined} />
                    <span className={styles.whoWords}>
                      <span>
                        {h.name.toUpperCase()}
                        {isDone(game, id) && <span className={styles.doneWord}> DONE</span>}
                      </span>
                      <span className={styles.squares} aria-label={`${got} of ${game.colorTarget}`}>
                        {Array.from({ length: game.colorTarget }, (_, k) => (
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
        )}

        {/* Turns: the team's total and each hiker's whacks. */}
        <div className={`${ui.box} ${hud.panel}`} style={colors ? { display: 'none' } : undefined}>
          <span className={styles.team}>
            <span>TEAM</span>
            <span className={styles.teamCount}>
              {game.team} / {game.target}
            </span>
          </span>
          <span className={styles.hikers}>
            {game.order.map((id, k) => (
              <span
                key={id}
                className={styles.who}
                data-active={(id === who && running) || undefined}
              >
                <HikerToken hiker={byId(id)} size={10} />
                <span className={styles.whoWords}>
                  <span>{byId(id).name.toUpperCase()}</span>
                  <span className={styles.whacked}>
                    {k > game.turn ? '-' : `${game.whacks[id] ?? 0} whacked`}
                  </span>
                </span>
              </span>
            ))}
          </span>
        </div>
      </div>
    </PixelScreen>
  );
}
