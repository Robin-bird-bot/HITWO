/**
 * Minefield, the Dog Waste Zone, on the GPS (docs/design/23-minigames-final.md,
 * section 6; mockup 45-minefield.png; it was Thin Ice until Nov 26), in
 * scene units (320 × 240). Cells are the 12-px grass tiles at 2× (smaller
 * when a big grid needs it), in a fenced dog park.
 *
 * - Tap or click to mow a square; the first one is always safe.
 * - Bag a pile: right-click, a long press, or the BAG IT button (taps bag
 *   until it's pressed again). The arrow keys move a cursor, Space mows and
 *   F bags.
 * - Stepping in a pile: "EW!", the hiker at the front of the line is out,
 *   and the next one steps up.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { FIELD_SIZES } from '../../../minigames/catalog';
import {
  check,
  count,
  front,
  holesLeft,
  newMinefield,
  result,
  timeUp,
  toggleFlag,
} from '../../../minigames/minefield/logic';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { mgSfx } from '../sound';
import { useCountdown } from '../useCountdown';
import ui from '../gpsUi.module.css';
import panel from '../panel.module.css';
import styles from './Minefield.module.css';
import { useDemoMode } from '../demo';
import { prepNumber } from '../../../minigames/prepare';

const MF = BALANCE.minigames.minefield;
const art = (f: string) => asset(`minigames/minefield/${f}`);

export function Minefield({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const demo = useDemoMode();
  const tier = tierOf(settings);
  const sizePick = pickOf(settings, 'grid');
  const size = FIELD_SIZES.find(([c, r]) => `${c}x${r}` === sizePick);
  const [game, setGame] = useState(() =>
    newMinefield(
      {
        tier,
        size: size ?? 'auto',
        holesPerHiker:
          typeof settings.holesPerHiker === 'number' ? settings.holesPerHiker : MF.holesPerHiker,
        timer:
          settings.timer === 'off'
            ? 'off'
            : typeof settings.timer === 'number'
              ? settings.timer
              : 'auto',
        // Prepare (23-minigames-final.md, section 10): POO BAGS and SCANNER.
        preBags: prepNumber(settings, 'prep.bags'),
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

  // Room for the picket fence above and below the field.
  const cell = Math.min(24, Math.floor(228 / (game.rows + 2.4)), Math.floor(230 / game.cols));
  const fenceH = Math.round((cell * 14) / 12);
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
    // The dog sniffs a square; stepping in it squishes.
    mgSfx(out.fell ? 'minefield.squish' : 'minefield.sniff');
    if (out.fell) {
      setSplash((s) => ({ cell: c, n: (s?.n ?? 0) + 1 }));
      const next = front(out.state);
      setMessage(
        next
          ? `Ew! ${byId(out.fell).name} is out. ${byId(next).name} steps next.`
          : `Ew! ${byId(out.fell).name} is out.`,
      );
    } else if (out.state.won) {
      setMessage('All clear!');
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
    }, MF.longPressSec * 1000);
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
      <div className={`${ui.box} ${panel.head}`}>MINEFIELD</div>
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
        PILES
      </p>
      <p className={`${ui.text} ${styles.holes}`}>
        {holesLeft(game)} {flags ? `(${flags} bagged)` : ''}
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
        {flagMode ? 'BAGGING' : 'BAG IT'}
      </button>
      <p className={`${ui.muted} ${styles.flagHint}`}>Or right-click / long-press</p>

      {/* The picket fence above and below the field. */}
      {[gridTop - fenceH, gridTop + game.rows * cell].map((top) => (
        <span
          key={top}
          className={styles.fence}
          style={{
            left: gridLeft - cell / 2,
            top,
            width: (game.cols + 1) * cell,
            height: fenceH,
            backgroundImage: `url(${art('fence.png')})`,
            backgroundSize: `${cell}px ${fenceH}px`,
          }}
        />
      ))}

      {/* The field. */}
      <div
        className={styles.grid}
        style={{ left: gridLeft, top: gridTop, width: game.cols * cell, height: game.rows * cell }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerLeave={cancel}
      >
        {game.open.map((open, c) => {
          const hole = open && !!game.holes?.[c];
          const n = open && !hole ? count(game, c) : 0;
          const shown = hole ? 'poop.png' : open ? 'mown.png' : 'grass.png';
          return (
            <button
              key={c}
              type="button"
              className={styles.cell}
              data-open={open || undefined}
              data-cursor={c === cursor || undefined}
              aria-label={
                hole
                  ? 'A pile'
                  : open
                    ? `${n || 'No'} piles around`
                    : game.flags[c]
                      ? 'Bagged'
                      : 'Tall grass'
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
                  src={art('bag.png')}
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
            EW!
          </span>
        )}
      </div>
    </PixelScreen>
  );
}
