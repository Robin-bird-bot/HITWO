/**
 * Find the Object on the GPS (docs/design/11-minigames-puzzles.md, section 3;
 * docs/mockups/minigames/puzzles/3-find-object-still.png to 5-…-dark.png), in
 * scene units (320 × 240).
 *
 * A card names the targets for 1.5 s, then the field appears and the clock
 * starts. Click or tap a target: it pops, its FIND slot gets a check, and
 * the next hiker in line is safe. A wrong click costs 2 s (the snack flashes
 * red, the clock shakes). It ends when every target is found or time runs
 * out: the first k hikers in line pass.
 *
 * Still, Windy (everything drifts sideways and wraps around, with a small
 * bob and a few wind streaks) or Dark (a flashlight follows the pointer; on
 * touch it follows the finger, and a tap picks what's under it).
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  click,
  newFindObject,
  positionAt,
  result,
  SNACK_SIZE,
  tick,
  type Mode,
} from '../../../minigames/findObject/logic';
import { useReducedMotion } from '../../app/useReducedMotion';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { toScene } from '../sceneCoords';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import ui from '../gpsUi.module.css';
import styles from './FindObject.module.css';

const F = BALANCE.minigames.findObject;
const snack = (name: string) => asset(`minigames/find-object/snacks/${name}.png`);
const ROMAN = ['', 'I', 'II', 'III'];
const MODE_LINE: Record<Mode, string> = {
  still: 'Still',
  windy: 'Windy: everything drifts sideways',
  dark: 'Dark: a flashlight follows the pointer',
};

export function FindObject({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const reduced = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const modeSetting = pickOf(settings, 'mode');
  const [game, setGame] = useState(() =>
    newFindObject(
      {
        tier: tierOf(settings),
        mode:
          modeSetting === 'still' || modeSetting === 'windy' || modeSetting === 'dark'
            ? modeSetting
            : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  /** The intro card, then the field: seconds since the clock started. */
  const [intro, setIntro] = useState(!still);
  const [t, setT] = useState(0);
  const [light, setLight] = useState<{ x: number; y: number }>({ x: 160, y: 120 });
  const [flash, setFlash] = useState<{ index: number; n: number } | null>(null);
  const [popped, setPopped] = useState<number[]>([]);
  const [shake, setShake] = useState(0);
  const press = useRef<{ x: number; y: number } | null>(null);
  const reported = useRef(false);

  // The intro card, then the clock.
  useEffect(() => {
    if (!intro) return;
    const id = window.setTimeout(() => setIntro(false), F.introMs);
    return () => window.clearTimeout(id);
  }, [intro]);

  // The clock (and the wind): a frame loop while playing.
  const running = !intro && !game.over && !still;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const dt = (now - last) / 1000;
      last = now;
      setT((x) => x + dt);
      setGame((s) => tick(s, dt));
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // The end: a moment to see it, then the results.
  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 700);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  const pickAt = (clientX: number, clientY: number) => {
    if (!running) return;
    const p = toScene(sceneRef.current, clientX, clientY);
    const out = click(game, p, t, game.mode === 'dark' ? p : undefined);
    setGame(out.state);
    if (out.outcome === 'found' && out.index !== null) setPopped((list) => [...list, out.index!]);
    if (out.outcome === 'wrong' && out.index !== null) {
      setFlash((f) => ({ index: out.index!, n: (f?.n ?? 0) + 1 }));
      setShake((n) => n + 1);
    }
  };

  // Mouse: a click picks; the light follows the pointer. Touch: the light follows the finger; a tap picks.
  const onDown = (e: ReactPointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY };
    setLight(toScene(sceneRef.current, e.clientX, e.clientY));
  };
  const onMove = (e: ReactPointerEvent) =>
    setLight(toScene(sceneRef.current, e.clientX, e.clientY));
  const onUp = (e: ReactPointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < F.light.tapPx)
      pickAt(e.clientX, e.clientY);
  };

  const dark = game.mode === 'dark';
  const radius = F.light.diameter / 2;
  const kinds = [...new Set(game.targets)];

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.field}
        data-mode={game.mode}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {game.mode === 'windy' && !intro && (
          <div className={styles.streaks} data-wind={game.wind} aria-hidden="true">
            {[40, 78, 112, 150, 188].map((y, i) => (
              <span key={y} style={{ top: y, animationDelay: `${-i * 1.3}s` }} />
            ))}
          </div>
        )}
        {!intro &&
          game.items.map((item, i) => {
            const at = positionAt(game, item, t);
            const gone = item.found && (reduced || !popped.includes(i));
            if (gone) return null;
            return (
              <img
                key={i}
                className={`${ui.sprite} ${styles.snack}`}
                data-pop={item.found || undefined}
                src={snack(item.snack)}
                alt=""
                draggable={false}
                style={{ left: at.x, top: at.y, width: SNACK_SIZE, height: SNACK_SIZE }}
                onAnimationEnd={() => setPopped((list) => list.filter((x) => x !== i))}
              />
            );
          })}
        {flash && !intro && game.items[flash.index] && (
          <span
            key={flash.n}
            className={styles.wrong}
            data-soft={reduced || undefined}
            style={{
              left: positionAt(game, game.items[flash.index]!, t).x - 1,
              top: positionAt(game, game.items[flash.index]!, t).y - 1,
            }}
            aria-hidden="true"
          />
        )}
        {dark && !intro && (
          <div
            className={styles.dark}
            style={{
              background: `radial-gradient(circle at ${light.x}px ${light.y}px, transparent ${radius - F.light.softEdge}px, rgba(29, 41, 24, 0.94) ${radius}px)`,
            }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* FIND: a slot per target, checked as they're found. */}
      <div className={`${ui.box} ${styles.find}`}>
        <span className={styles.findWord}>FIND</span>
        {game.targets.map((name, i) => (
          <span key={i} className={styles.slot} data-found={i < game.found || undefined}>
            <img className={ui.sprite} src={snack(name)} alt={name} draggable={false} />
          </span>
        ))}
      </div>
      <div
        key={shake}
        className={`${ui.box} ${styles.clock}`}
        data-shake={(shake > 0 && !reduced) || undefined}
        data-low={(game.timeLeft <= 3 && running) || undefined}
      >
        {clock(game.timeLeft)}
      </div>

      {/* The line: each find keeps the next hiker safe. */}
      <div className={`${ui.box} ${styles.line}`}>
        {hikers.map((h, i) => (
          <HikerToken
            key={h.id}
            hiker={h}
            size={14}
            state={
              i < game.found ? 'safe' : game.over ? 'out' : i === game.found ? 'current' : 'waiting'
            }
          />
        ))}
      </div>
      <p className={`${ui.muted} ${styles.note}`}>In order: each find keeps the next hiker safe</p>
      <p className={`${ui.muted} ${styles.tier}`}>
        Tier {ROMAN[game.tier]} · {MODE_LINE[game.mode]}
      </p>

      {intro && (
        <div className={styles.intro} role="status">
          <div className={`${ui.box} ${styles.introCard}`}>
            <span>FIND</span>
            {kinds.map((name) => (
              <span key={name} className={styles.introKind}>
                {game.targets.filter((x) => x === name).length} ×
                <img className={ui.sprite} src={snack(name)} alt={name} draggable={false} />
              </span>
            ))}
          </div>
        </div>
      )}
      <span className={styles.srOnly}>{`${game.found} of ${game.targets.length} found`}</span>
    </PixelScreen>
  );
}
