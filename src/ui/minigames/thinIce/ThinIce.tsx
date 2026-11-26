/**
 * Thin Ice on the GPS (docs/design/13-minigames-puzzles-2.md, section 4;
 * mockup 7-thin-ice.png), in scene units (320 × 240). Cells are the 12-px
 * ice tiles at 2× (smaller when a big grid needs it).
 *
 * - Tap or click to check a cell; the first check is always safe.
 * - Flag a hole: right-click, a long press, or the FLAG button (taps flag
 *   until it's pressed again). The arrow keys move a cursor, Space checks
 *   and F flags.
 * - Checking a hole: the hiker at the front of the line falls in ("SPLASH!")
 *   and the next one steps up.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { ICE_SIZES } from '../../../minigames/catalog';
import {
  check,
  count,
  front,
  holesLeft,
  newThinIce,
  result,
  timeUp,
  toggleFlag,
} from '../../../minigames/thinIce/logic';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import { useCountdown } from '../useCountdown';
import ui from '../gpsUi.module.css';
import panel from '../panel.module.css';
import styles from './ThinIce.module.css';
import { useDemoMode } from '../demo';

const TI = BALANCE.minigames.thinIce;
const art = (f: string) => asset(`minigames/thin-ice/${f}`);

export function ThinIce({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const demo = useDemoMode();
  const tier = tierOf(settings);
  const sizePick = pickOf(settings, 'grid');
  const size = ICE_SIZES.find(([c, r]) => `${c}x${r}` === sizePick);
  const [game, setGame] = useState(() =>
    newThinIce(
      {
        tier,
        size: size ?? 'auto',
        holesPerHiker:
          typeof settings.holesPerHiker === 'number' ? settings.holesPerHiker : TI.holesPerHiker,
        timer:
          settings.timer === 'off'
            ? 'off'
            : typeof settings.timer === 'number'
              ? settings.timer
              : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const [flagMode, setFlagMode] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [splash, setSplash] = useState<{ cell: number; n: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const press = useRef<{ cell: number; timer: number; flagged: boolean } | null>(null);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

  const cell = Math.min(24, Math.floor(228 / game.rows), Math.floor(230 / game.cols));
  const gridLeft = 316 - game.cols * cell;
  const gridTop = Math.floor((240 - game.rows * cell) / 2);
  const running = !still && !game.over;

  const left = useCountdown(game.timeSec, running, () => {
    setGame((s) => timeUp(s));
    setMessage('Time’s up');
  });

  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1600);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  const doCheck = (c: number) => {
    if (!running) return;
    const out = check(game, c);
    if (out.state === game) return;
    setGame(out.state);
    if (out.fell) {
      playSound('miss');
      setSplash((s) => ({ cell: c, n: (s?.n ?? 0) + 1 }));
      const next = front(out.state);
      setMessage(
        next
          ? `${byId(out.fell).name} fell in. ${byId(next).name} steps next.`
          : `${byId(out.fell).name} fell in.`,
      );
    } else if (out.state.won) {
      setMessage('The ice is mapped!');
    }
  };
  const doFlag = (c: number) => {
    if (!running) return;
    setGame((s) => toggleFlag(s, c));
  };

  // Tap to check (or flag, in flag mode); a long press flags.
  const onDown = (e: ReactPointerEvent, c: number) => {
    if (!running || e.button === 2) return;
    const timer = window.setTimeout(() => {
      if (press.current?.cell === c) {
        press.current.flagged = true;
        doFlag(c);
      }
    }, TI.longPressSec * 1000);
    press.current = { cell: c, timer, flagged: false };
  };
  const onUp = (c: number) => {
    const p = press.current;
    press.current = null;
    if (!p || p.cell !== c) return;
    window.clearTimeout(p.timer);
    if (p.flagged) return;
    setCursor(null);
    if (flagMode) doFlag(c);
    else doCheck(c);
  };
  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  // The arrow keys move a cursor; Space checks, F flags.
  useEffect(() => {
    if (demo) return;
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
        e.key
      ];
      if (d) {
        e.preventDefault();
        setCursor((c) => {
          if (c === null) return Math.floor(game.rows / 2) * game.cols + Math.floor(game.cols / 2);
          const col = Math.max(0, Math.min(game.cols - 1, (c % game.cols) + d[0]!));
          const row = Math.max(0, Math.min(game.rows - 1, Math.floor(c / game.cols) + d[1]!));
          return row * game.cols + col;
        });
      } else if ((e.key === ' ' || e.key === 'Enter') && cursor !== null) {
        e.preventDefault();
        doCheck(cursor);
      } else if ((e.key === 'f' || e.key === 'F') && cursor !== null) {
        e.preventDefault();
        doFlag(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const flags = game.flags.filter(Boolean).length;
  const next = front(game);

  return (
    <PixelScreen measure={!still}>
      {/* The left panel. */}
      <div className={`${ui.box} ${panel.head}`}>THIN ICE</div>
      {left !== null && (
        <div
          className={`${ui.box} ${panel.clock}`}
          style={{ top: 24, height: 14, fontSize: 6 }}
          data-low={left <= 10 || undefined}
        >
          {clock(left)}
        </div>
      )}
      <p className={`${ui.muted} ${panel.label}`} style={{ top: 44 }}>
        HOLES
      </p>
      <p className={`${ui.text} ${styles.holes}`}>
        {holesLeft(game)} {flags ? `(${flags} flagged)` : ''}
      </p>
      <p className={`${ui.muted} ${panel.label}`} style={{ top: 64 }}>
        THE LINE
      </p>
      {game.order.map((id, k) => (
        <span key={id} className={styles.who} style={{ top: 70 + k * 13 }}>
          <HikerToken
            hiker={byId(id)}
            size={10}
            state={
              game.fell.includes(id)
                ? 'out'
                : id === next && !game.over
                  ? 'current'
                  : game.won
                    ? 'safe'
                    : 'waiting'
            }
          />
          <span className={ui.text}>
            {byId(id).name}
            {id === next && !game.over ? ' <' : ''}
          </span>
        </span>
      ))}
      {message && (
        <div className={`${ui.box} ${panel.message}`} style={{ top: 128 }} role="status">
          {message}
        </div>
      )}
      <button
        type="button"
        className={`${ui.button} ${styles.flag}`}
        data-on={flagMode || undefined}
        aria-pressed={flagMode}
        onClick={() => setFlagMode((f) => !f)}
        disabled={!running}
      >
        {flagMode ? 'FLAGGING' : 'FLAG'}
      </button>
      <p className={`${ui.muted} ${styles.flagHint}`}>Or right-click / long-press</p>

      {/* The lake. */}
      <div
        className={styles.grid}
        style={{ left: gridLeft, top: gridTop, width: game.cols * cell, height: game.rows * cell }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerLeave={cancel}
      >
        {game.open.map((open, c) => {
          const hole = open && !!game.holes?.[c];
          const n = open && !hole ? count(game, c) : 0;
          const shown = hole ? 'hole.png' : open ? 'open.png' : 'ice.png';
          return (
            <button
              key={c}
              type="button"
              className={styles.cell}
              data-open={open || undefined}
              data-cursor={c === cursor || undefined}
              aria-label={
                hole
                  ? 'Hole'
                  : open
                    ? `${n || 'No'} holes around`
                    : game.flags[c]
                      ? 'Flagged'
                      : 'Ice'
              }
              style={{
                left: (c % game.cols) * cell,
                top: Math.floor(c / game.cols) * cell,
                width: cell,
                height: cell,
              }}
              onPointerDown={(e) => onDown(e, c)}
              onPointerUp={() => onUp(c)}
              onContextMenu={(e) => {
                e.preventDefault();
                cancel();
                doFlag(c);
              }}
              disabled={still}
            >
              <img className={ui.sprite} src={art(shown)} alt="" draggable={false} />
              {game.flags[c] && !open && (
                <img
                  className={`${ui.sprite} ${styles.flagMark}`}
                  src={art('flag.png')}
                  alt=""
                  draggable={false}
                />
              )}
              {n > 0 && (
                <span className={styles.number} style={{ fontSize: cell * 0.36 }}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
        {splash && (
          <span
            key={splash.n}
            className={`${ui.text} ${styles.splash}`}
            style={{
              left: (splash.cell % game.cols) * cell + cell / 2,
              top: Math.floor(splash.cell / game.cols) * cell - 2,
            }}
          >
            SPLASH!
          </span>
        )}
      </div>
    </PixelScreen>
  );
}
