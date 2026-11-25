/**
 * Find the Object on the GPS (docs/design/11-minigames-puzzles.md, section 3;
 * docs/mockups/minigames/puzzles/3- to 5-find-object-*.png, 11-…-dark-windy.png
 * and 12-…-round-card.png), in scene units (320 × 240).
 *
 * Each round opens with a card ("ROUND 2 OF 3", "FIND 4", the snacks), then
 * the field appears and the clock starts. Click or tap a target: it pops,
 * and a slot showing that same snack gets a check. A wrong click costs 2 s
 * (the snack flashes red, the clock shakes). When the round ends, each
 * target still unfound puts one hiker out from the back of the line; the
 * line shows who's at risk right now.
 *
 * Still, Windy (everything drifts and wraps around, with wind streaks), Dark
 * (a flashlight follows the pointer; on touch it follows the finger and a
 * tap picks what's under it), or Dark + windy.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  atRisk,
  click,
  isDark,
  isWindy,
  leftToFind,
  lightDiameter,
  newFindObject,
  nextRound,
  positionAt,
  result,
  SNACK_SIZE,
  tick,
  type Mode,
} from '../../../minigames/findObject/logic';
import { TIER_LABELS, type MinigameSettings } from '../../../minigames/types';
import { useReducedMotion } from '../../app/useReducedMotion';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import ui from '../gpsUi.module.css';
import styles from './FindObject.module.css';

const F = BALANCE.minigames.findObject;
const snack = (name: string) => asset(`minigames/find-object/snacks/${name}.png`);
const MODE_LINE: Record<Mode, string> = {
  still: 'Still',
  windy: 'Windy: everything drifts sideways',
  dark: 'Dark: a flashlight follows the pointer',
  darkWindy: 'Dark + windy',
};
const MODES: readonly Mode[] = ['still', 'windy', 'dark', 'darkWindy'];

/** A number setting, or "auto". */
const numberOr = (settings: MinigameSettings, id: string): 'auto' | number => {
  const v = settings[id];
  return typeof v === 'number' ? v : 'auto';
};

/** "Finn", "Finn and Mom", "Finn, Mom and Ellie". */
const listNames = (names: readonly string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

export function FindObject({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const reduced = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const modeSetting = pickOf(settings, 'mode');
  const [game, setGame] = useState(() =>
    newFindObject(
      {
        tier: tierOf(settings),
        mode: (MODES as readonly string[]).includes(modeSetting) ? (modeSetting as Mode) : 'auto',
        rounds: numberOr(settings, 'rounds'),
        secPerTarget: numberOr(settings, 'secPerTarget'),
        extraSecPerRound: numberOr(settings, 'extraSec'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  /** The round's card, then the field: seconds since the round's clock started. */
  const [intro, setIntro] = useState(!still);
  const [t, setT] = useState(0);
  const [light, setLight] = useState<{ x: number; y: number }>({ x: 160, y: 120 });
  const [flash, setFlash] = useState<{ index: number; n: number } | null>(null);
  const [popped, setPopped] = useState<number[]>([]);
  const [shake, setShake] = useState(0);
  const press = useRef<{ x: number; y: number } | null>(null);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

  // The round's card, then the clock.
  useEffect(() => {
    if (!intro) return;
    const id = window.setTimeout(() => setIntro(false), F.introMs);
    return () => window.clearTimeout(id);
  }, [intro]);

  // The clock (and the wind): a frame loop while a round is on.
  const running = !intro && game.phase === 'playing' && !still;
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

  // A round ended: a moment to see who went out, then the next round's card.
  useEffect(() => {
    if (game.phase !== 'roundOver' || still) return;
    const id = window.setTimeout(() => {
      setGame((s) => nextRound(s));
      setT(0);
      setPopped([]);
      setFlash(null);
      setIntro(true);
    }, 1800);
    return () => window.clearTimeout(id);
  }, [game.phase, still]);

  // The end: a moment to see it, then the results.
  useEffect(() => {
    if (game.phase !== 'over' || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1800);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  const pickAt = (clientX: number, clientY: number) => {
    if (!running) return;
    const p = toScene(sceneRef.current, clientX, clientY);
    const out = click(game, p, t, isDark(game.mode) ? p : undefined);
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
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < F.light.tapPx) {
      pickAt(e.clientX, e.clientY);
    }
  };

  const dark = isDark(game.mode);
  const radius = lightDiameter(game.tier) / 2;
  const left = leftToFind(game);
  const risk = game.phase === 'playing' ? atRisk(game) : [];
  const inGame = game.line.length;
  const riskLine =
    left === 0
      ? 'All found'
      : `${left} left to find: ${risk.length === inGame ? `all ${inGame}` : risk.length} hiker${risk.length === 1 ? '' : 's'} at risk`;
  const showField = !intro && game.phase === 'playing';

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.field}
        data-mode={game.mode}
        data-dark={dark || undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {isWindy(game.mode) && showField && (
          <div className={styles.streaks} data-wind={game.wind} aria-hidden="true">
            {[40, 78, 112, 150, 188].map((y, i) => (
              <span key={y} style={{ top: y, animationDelay: `${-i * 1.3}s` }} />
            ))}
          </div>
        )}
        {showField &&
          game.items.map((item, i) => {
            const at = positionAt(game, item, t);
            const gone = item.found && (reduced || !popped.includes(i));
            if (gone) return null;
            return (
              <img
                key={`${game.round}-${i}`}
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
        {flash && showField && game.items[flash.index] && (
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
        {dark && showField && (
          <div
            className={styles.dark}
            style={{
              background: `radial-gradient(circle at ${light.x}px ${light.y}px, transparent ${radius - F.light.softEdge}px, rgba(29, 41, 24, 0.94) ${radius}px)`,
            }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* FIND: a slot per target, checked when that snack is found. */}
      <div className={`${ui.box} ${styles.find}`}>
        <span className={styles.findWord}>FIND</span>
        {game.targets.map((name, i) => (
          <span key={i} className={styles.slot} data-found={game.found[i] || undefined}>
            <img className={ui.sprite} src={snack(name)} alt={name} draggable={false} />
          </span>
        ))}
      </div>
      <div className={`${ui.box} ${styles.roundBox}`}>
        R {game.round}/{game.rounds}
      </div>
      <div
        key={shake}
        className={`${ui.box} ${styles.clock}`}
        data-shake={(shake > 0 && !reduced) || undefined}
        data-low={(game.timeLeft <= 3 && running) || undefined}
      >
        {clock(game.timeLeft)}
      </div>

      {/* The line, front first; the ones at risk right now are marked. */}
      <div className={`${ui.box} ${styles.line}`}>
        {game.order.map((id) => (
          <span key={id} className={styles.lineToken}>
            <HikerToken
              hiker={byId(id)}
              size={14}
              state={game.out[id] !== undefined ? 'out' : 'waiting'}
            />
            {risk.includes(id) && (
              <span className={styles.risk} aria-label="at risk">
                !
              </span>
            )}
          </span>
        ))}
      </div>
      {game.phase === 'playing' && !intro && (
        <p className={`${ui.muted} ${styles.note}`} style={{ bottom: 19 }}>
          {riskLine}
        </p>
      )}
      <p className={`${ui.muted} ${styles.note}`}>
        Each target left at the end puts one hiker out, from the back
      </p>
      <p className={`${ui.muted} ${styles.tier}`}>
        Tier {TIER_LABELS[game.tier]} · {MODE_LINE[game.mode]}
      </p>

      {intro && game.phase === 'playing' && (
        <div className={styles.intro} role="status">
          <div className={`${ui.box} ${styles.introCard}`}>
            <span className={styles.introTitle}>
              ROUND {game.round} OF {game.rounds}
            </span>
            <span className={styles.introFind}>FIND {game.targets.length}</span>
            <span className={styles.introSnacks}>
              {game.targets.map((name, i) => (
                <img key={i} className={ui.sprite} src={snack(name)} alt={name} draggable={false} />
              ))}
            </span>
            {game.round > 1 && <span className={styles.introSmall}>One more than last round</span>}
            <span className={styles.introSmall}>
              {listNames(game.line.map((id) => byId(id).name))}{' '}
              {game.line.length === 1 ? 'is' : 'are'} still in
            </span>
          </div>
        </div>
      )}
      {(game.phase === 'roundOver' || game.phase === 'over') && (
        <div className={styles.intro} role="status">
          <div className={`${ui.box} ${styles.introCard}`}>
            <span className={styles.introTitle}>
              {game.lost.length
                ? `${game.targets.length - game.found.filter(Boolean).length} missed`
                : 'All found'}
            </span>
            <span className={styles.introSmall}>
              {game.lost.length
                ? `${listNames(game.lost.map((id) => byId(id).name))} ${game.lost.length === 1 ? 'is' : 'are'} out`
                : 'Everyone stays in'}
            </span>
          </div>
        </div>
      )}
      <span
        className={styles.srOnly}
      >{`${game.found.filter(Boolean).length} of ${game.targets.length} found`}</span>
    </PixelScreen>
  );
}
