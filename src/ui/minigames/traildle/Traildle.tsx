/**
 * Traildle on the GPS (docs/design/11-minigames-puzzles.md, section 2;
 * docs/mockups/minigames/puzzles/2-traildle.png), in scene units (320 × 240).
 *
 * - **Top:** the pair, the guess count, and the timer on Tiers II and III.
 * - **Boards:** one per hiker in the pair, listing past guesses as small
 *   signs with their marks (solid dark: right spot; dashed light: wrong
 *   spot; grey crossed out: not in the code). A solved board shows FOUND.
 * - **The guess:** wooden signs with an up arrow above and a down arrow below.
 * - **The digit strip:** 0 to 9, split in half with two boards, showing
 *   what's known about each digit; Enter and Back.
 *
 * Input, all together: the arrows; typing or tapping a key (fills the
 * selected sign and moves on); a digit typed while pointing at a sign;
 * clicking a sign; ← →; Backspace; Enter.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { asset } from '../../../config/assets';
import { g } from '../../../minigames/greens';
import {
  canSubmit,
  digitKnowledge,
  newTraildle,
  nextPair,
  result,
  submit,
  tick,
  type Board,
  type Knowledge,
  type Mark,
} from '../../../minigames/traildle/logic';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import ui from '../gpsUi.module.css';
import styles from './Traildle.module.css';

const art = (f: string) => asset(`minigames/traildle/${f}`);

const KEY_FILL: Record<Knowledge, string> = {
  unknown: g(7),
  absent: g(5),
  present: g(9),
  right: g(1),
};

const possessive = (name: string) => `${name.toUpperCase()}${name.endsWith('s') ? '’' : '’S'} CODE`;

export function Traildle({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const signsSetting = pickOf(settings, 'signs');
  const timer = pickOf(settings, 'timer');
  const [game, setGame] = useState(() =>
    newTraildle(
      {
        tier: tierOf(settings),
        signs: signsSetting === 'auto' ? 'auto' : Number(signsSetting),
        timer: timer === 'on' || timer === 'off' ? timer : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const [cur, setCur] = useState<(number | null)[]>(() => Array(game.signs).fill(null));
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const playing = game.phase === 'playing' && !still;
  const timed = game.timeLeft !== null;

  // The pair's clock.
  useEffect(() => {
    if (!playing || !timed) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      setGame((g0) => tick(g0, (now - last) / 1000));
      last = now;
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, timed]);

  const put = (i: number, digit: number | null, moveOn: boolean) => {
    setCur((c) => c.map((d, k) => (k === i ? digit : d)));
    if (moveOn) setSel(Math.min(game.signs - 1, i + 1));
  };
  const nudge = (i: number, by: 1 | -1) => {
    setSel(i);
    setCur((c) => c.map((d, k) => (k === i ? (d === null ? 0 : (d + by + 10) % 10) : d)));
  };
  const typeDigit = (digit: number) => {
    const i = hover ?? sel;
    put(i, digit, true);
  };
  const back = () => {
    if (cur[sel] !== null) put(sel, null, false);
    else if (sel > 0) {
      setSel(sel - 1);
      put(sel - 1, null, false);
    }
  };
  const enter = () => {
    if (!canSubmit(game, cur)) return;
    const next = submit(game, cur);
    setGame(next);
    setCur(Array(next.signs).fill(null));
    setSel(0);
  };
  const goOn = () => {
    const next = nextPair(game);
    if (next.phase === 'over') {
      onDone(result(next));
      return;
    }
    setGame(next);
    setCur(Array(next.signs).fill(null));
    setSel(0);
  };

  // The keyboard: digits, ← →, Backspace, Enter.
  useEffect(() => {
    if (still) return;
    const onKey = (e: KeyboardEvent) => {
      if (game.phase === 'pairDone' && e.key === 'Enter') {
        e.preventDefault();
        goOn();
        return;
      }
      if (game.phase !== 'playing') return;
      if (/^[0-9]$/.test(e.key)) typeDigit(Number(e.key));
      else if (e.key === 'ArrowLeft') setSel(Math.max(0, sel - 1));
      else if (e.key === 'ArrowRight') setSel(Math.min(game.signs - 1, sel + 1));
      else if (e.key === 'ArrowUp') nudge(sel, 1);
      else if (e.key === 'ArrowDown') nudge(sel, -1);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') enter();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const two = game.boards.length > 1;
  const knowledge = game.boards.map(digitKnowledge);
  const guessNo = Math.min(game.guessCount + 1, game.guessesAllowed);
  const signPitch = 28;
  const signsLeft = (320 - (game.signs * signPitch - 4)) / 2;

  return (
    <PixelScreen measure={!still}>
      <div className={`${ui.box} ${styles.top}`} style={{ left: 6, width: 64 }}>
        PAIR {game.pairIndex + 1}/{game.pairs.length}
      </div>
      <div className={`${ui.box} ${styles.top}`} style={{ left: 112, width: 95 }}>
        GUESS {guessNo} OF {game.guessesAllowed}
      </div>
      {game.timeLeft !== null && (
        <div
          className={`${ui.box} ${styles.top}`}
          data-low={(game.timeLeft <= 10 && playing) || undefined}
          style={{ left: 250, width: 64 }}
        >
          {clock(game.timeLeft)}
        </div>
      )}

      {game.boards.map((b, i) => (
        <BoardView
          key={b.hikerId}
          board={b}
          hiker={byId(b.hikerId)}
          left={two ? (i === 0 ? 8 : 164) : 86}
          signs={game.signs}
          rows={game.guessesAllowed}
          reveal={game.phase !== 'playing'}
        />
      ))}

      {/* The guess: big signs, an arrow above and below each. */}
      {cur.map((d, i) => {
        const x = signsLeft + i * signPitch;
        return (
          <div key={i} className={styles.signSlot} style={{ left: x }}>
            <button
              type="button"
              className={styles.arrow}
              aria-label={`Sign ${i + 1} up`}
              onClick={() => nudge(i, 1)}
              disabled={!playing}
            >
              <img className={ui.sprite} src={art('arrow-up.png')} alt="" draggable={false} />
            </button>
            <button
              type="button"
              className={styles.sign}
              data-selected={(playing && sel === i) || undefined}
              aria-label={`Sign ${i + 1}: ${d ?? 'blank'}`}
              onClick={() => setSel(i)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              disabled={!playing}
            >
              <img className={ui.sprite} src={art('sign.png')} alt="" draggable={false} />
              <span className={styles.signDigit}>{d ?? ''}</span>
            </button>
            <button
              type="button"
              className={styles.arrow}
              aria-label={`Sign ${i + 1} down`}
              onClick={() => nudge(i, -1)}
              disabled={!playing}
            >
              <img className={ui.sprite} src={art('arrow-down.png')} alt="" draggable={false} />
            </button>
          </div>
        );
      })}

      {/* The digit strip: what's known about each digit, split for two boards. */}
      {Array.from({ length: 10 }, (_, digit) => {
        const left = KEY_FILL[knowledge[0]?.[digit] ?? 'unknown'];
        const right = two ? KEY_FILL[knowledge[1]?.[digit] ?? 'unknown'] : left;
        const dark = (k?: Knowledge) => k === 'right' || k === 'absent';
        return (
          <button
            key={digit}
            type="button"
            className={styles.key}
            style={
              {
                left: 22 + digit * 25,
                background: `linear-gradient(to right, ${left} 50%, ${right} 50%)`,
                color:
                  dark(knowledge[0]?.[digit]) && (!two || dark(knowledge[1]?.[digit]))
                    ? g(9)
                    : g(1),
              } as CSSProperties
            }
            onClick={() => typeDigit(digit)}
            disabled={!playing}
            aria-label={`${digit}`}
          >
            {digit}
          </button>
        );
      })}
      <button
        type="button"
        className={`${ui.button} ${styles.side}`}
        style={{ top: 191 }}
        onClick={enter}
        disabled={!playing || !canSubmit(game, cur)}
      >
        ENTER
      </button>
      <button
        type="button"
        className={`${ui.button} ${styles.side}`}
        style={{ top: 211 }}
        onClick={back}
        disabled={!playing}
      >
        ‹ BACK
      </button>
      <p className={`${ui.muted} ${styles.legend}`} style={{ top: 214 }}>
        Tap a digit, type, or use the arrows. Enter checks.
      </p>
      <p className={`${ui.muted} ${styles.legend} ${styles.small}`} style={{ top: 224 }}>
        Solid = right spot · Dashed = wrong spot · Crossed = not in code
      </p>

      {game.phase === 'pairDone' && (
        <div className={styles.done} role="status">
          <div className={`${ui.box} ${styles.doneCard}`}>
            {game.boards.map((b) => (
              <span key={b.hikerId} className={styles.doneRow}>
                <HikerToken hiker={byId(b.hikerId)} size={10} state={b.solved ? 'safe' : 'out'} />
                {byId(b.hikerId).name}: {b.solved ? 'FOUND' : `NOT FOUND (${b.code.join('')})`}
              </span>
            ))}
            <button
              type="button"
              className={`${ui.button} ${styles.next}`}
              onClick={goOn}
              autoFocus
            >
              {game.pairIndex + 1 < game.pairs.length ? 'NEXT PAIR' : 'SEE RESULTS'}
            </button>
          </div>
        </div>
      )}
    </PixelScreen>
  );
}

/** One hiker's board: their name, past guesses with marks, and empty rows for the guesses left. */
function BoardView({
  board,
  hiker,
  left,
  signs,
  rows,
  reveal,
}: {
  board: Board;
  hiker: { id: string; name: string; color: string; art: string };
  left: number;
  signs: number;
  rows: number;
  reveal: boolean;
}) {
  // Small signs as big as fit: 148 × 110 board, under its 16-unit header.
  const cell = Math.min(13, Math.floor(100 / rows) - 1, Math.floor(130 / signs) - 3);
  const pitchX = cell + 3;
  const pitchY = cell + 1;
  const x0 = (148 - (signs * pitchX - 3)) / 2;
  return (
    <div className={styles.board} style={{ left }} data-solved={board.solved || undefined}>
      <span className={styles.boardHead}>
        <HikerToken hiker={hiker} size={10} state={board.solved ? 'safe' : 'waiting'} />
        <span className={ui.text} style={{ fontSize: 4.5 }}>
          {possessive(hiker.name)}
        </span>
      </span>
      {Array.from({ length: rows }, (_, r) => {
        const row = board.rows[r];
        return Array.from({ length: signs }, (_, c) => {
          const mark: Mark | undefined = row?.marks[c];
          return (
            <span
              key={`${r},${c}`}
              className={styles.cell}
              data-mark={mark ?? (row ? undefined : 'empty')}
              style={{
                left: x0 + c * pitchX,
                top: 17 + r * pitchY,
                width: cell,
                height: cell,
                fontSize: cell * 0.55,
              }}
            >
              {row ? row.guess[c] : ''}
            </span>
          );
        });
      })}
      {board.solved && <span className={`${ui.box} ${styles.found}`}>FOUND</span>}
      {reveal && !board.solved && (
        <span className={`${ui.box} ${styles.found}`} data-missed="">
          {board.code.join('')}
        </span>
      )}
    </div>
  );
}
