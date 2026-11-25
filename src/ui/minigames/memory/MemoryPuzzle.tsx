/**
 * Memory Puzzle on the GPS (docs/design/13-minigames-puzzles-2.md, section
 * 2; mockups 3-memory-preview.png to 5-memory-tier-3.png), in scene units
 * (320 × 240). Cards are 22 × 26 at 1.5×.
 *
 * Every card shows for the preview, then they flip over; from Tier II some
 * swap places (sliding, with a line between them). Flip a card by tap or
 * click (or the arrow keys and Space). A match stays up with a dark frame;
 * a miss shows a red frame, then flips back. The side panel shows the clock
 * (a bar and the time, with "+5 S" or "−2 S" beside it when a match or a
 * miss changes it; mockup 9-memory-clock.png) and each hiker's sets left.
 */
import { useEffect, useRef, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  clockRuns,
  flip,
  newMemory,
  nextSwap,
  previewDone,
  resolveMiss,
  result,
  setsLeft,
  tick,
} from '../../../minigames/memory/logic';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import ui from '../gpsUi.module.css';
import panel from '../panel.module.css';
import { snackKey, useSnackTints } from './tintSnack';
import styles from './MemoryPuzzle.module.css';

const ME = BALANCE.minigames.memory;
const CARD = { w: 33, h: 39, gap: 5 } as const;
const art = (f: string) => asset(`minigames/memory/${f}`);
const FIXED = 1 / 60;
const num = (v: unknown): 'auto' | number => (typeof v === 'number' ? v : 'auto');

export function MemoryPuzzle({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const match = pickOf(settings, 'match');
  const swaps = pickOf(settings, 'swaps');
  const [game, setGame] = useState(() =>
    newMemory(
      {
        tier,
        match: match === 'pairs' || match === 'threes' ? match : 'auto',
        swaps: swaps === 'on' || swaps === 'off' ? swaps : 'auto',
        preview: num(settings.preview),
        time: num(settings.time),
        matchBonus: num(settings.matchBonus),
        missCost: num(settings.missCost),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const previewSec = game.previewSec;
  /** The swap sliding now (its two positions), shown with a line between them. */
  const [sliding, setSliding] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const tints = useSnackTints(
    game.sets.map((s) => ({ snack: s.snack, color: byId(s.hiker)?.color ?? '#d3dfaf' })),
  );

  // The preview, then the swaps, one at a time.
  useEffect(() => {
    if (still || game.phase !== 'preview') return;
    const id = window.setTimeout(() => setGame((s) => previewDone(s)), previewSec * 1000);
    return () => window.clearTimeout(id);
  }, [game.phase, still, previewSec]);
  useEffect(() => {
    if (still || game.phase !== 'swaps' || sliding) return;
    const id = window.setTimeout(() => {
      const out = nextSwap(game);
      setGame(out.state);
      setSliding(out.swapped ?? null);
    }, 80);
    return () => window.clearTimeout(id);
  }, [game, still, sliding]);
  useEffect(() => {
    if (!sliding) return;
    const id = window.setTimeout(() => setSliding(null), ME.swapSec * 1000);
    return () => window.clearTimeout(id);
  }, [sliding]);
  // A miss shows, then flips back.
  useEffect(() => {
    if (still || game.phase !== 'miss') return;
    const id = window.setTimeout(() => setGame((s) => resolveMiss(s)), ME.missShowSec * 1000);
    return () => window.clearTimeout(id);
  }, [game.phase, still]);

  // The clock: fixed steps, as fast as the screen draws, after the preview.
  const running = !still && clockRuns(game);
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function loop(now) {
      spare = Math.min(0.25, spare + (now - last) / 1000);
      last = now;
      const steps = Math.floor(spare / FIXED);
      spare -= steps * FIXED;
      if (steps > 0) setGame((s) => tick(s, steps * FIXED));
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);
  const left = game.timeLeft;
  const note =
    game.clockNote && game.elapsed - game.clockNote.at < ME.clockNoteSec ? game.clockNote : null;

  // The end: a moment to see it, then the results.
  useEffect(() => {
    if (game.phase !== 'over' || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1600);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  const flipAt = (pos: number) => {
    if (still || sliding) return;
    setGame((s) => flip(s, pos).state);
  };

  // The arrow keys move a cursor over the cards; Space (or Enter) flips.
  useEffect(() => {
    if (still) return;
    const onKey = (e: KeyboardEvent) => {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
        e.key
      ];
      if (d) {
        e.preventDefault();
        setCursor((c) => {
          if (c === null) return 0;
          const col = Math.max(0, Math.min(game.cols - 1, (c % game.cols) + d[0]!));
          const row = Math.max(0, Math.min(game.rows - 1, Math.floor(c / game.cols) + d[1]!));
          return row * game.cols + col;
        });
      } else if ((e.key === ' ' || e.key === 'Enter') && cursor !== null) {
        e.preventDefault();
        flipAt(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const gridW = game.cols * CARD.w + (game.cols - 1) * CARD.gap;
  const gridH = game.rows * CARD.h + (game.rows - 1) * CARD.gap;
  const gridLeft = 316 - gridW;
  const gridTop = Math.floor((240 - gridH) / 2);
  const spot = (pos: number) => ({
    x: gridLeft + (pos % game.cols) * (CARD.w + CARD.gap),
    y: gridTop + Math.floor(pos / game.cols) * (CARD.h + CARD.gap),
  });
  const posOf = new Map(game.cards.flatMap((id, pos) => (id === null ? [] : [[id, pos]])));
  const word = game.setSize === 3 ? 'sets' : 'pairs';
  const help =
    game.phase === 'preview'
      ? `Look! All cards show for ${previewSec} s, then flip over.`
      : game.phase === 'swaps' || sliding
        ? 'Watch: cards are swapping places.'
        : game.phase === 'miss'
          ? game.missSec > 0
            ? `Not a match: −${game.missSec} s.`
            : 'Not a match.'
          : game.phase === 'over'
            ? game.matched.every(Boolean)
              ? 'All matched!'
              : 'Out of time.'
            : `Each color is a hiker’s ${word}. A match adds time.${game.missSec > 0 ? ' A miss takes some away.' : ''}`;

  return (
    <PixelScreen measure={!still}>
      {/* The side panel. */}
      <div className={`${ui.box} ${panel.head}`}>MEMORY</div>
      <p className={`${ui.text} ${panel.lines}`} style={{ top: 28 }}>
        {help}
      </p>
      <p className={`${ui.muted} ${panel.label}`} style={{ top: 78 }}>
        TIME
      </p>
      <span className={panel.timeBar} style={{ top: 84 }}>
        <span style={{ width: `${Math.min(1, left / game.timeSec) * 100}%` }} />
      </span>
      <p
        className={`${ui.text} ${panel.timeText}`}
        style={{ top: 97 }}
        data-low={left <= 10 || undefined}
      >
        {clock(left)}
      </p>
      {note && (
        <span key={note.at} className={panel.note} style={{ top: 94 }} role="status">
          {note.sec > 0 ? `+${note.sec} S` : `−${-note.sec} S`}
        </span>
      )}
      <p className={`${ui.muted} ${panel.label}`} style={{ top: 114 }}>
        {word.toUpperCase()}
      </p>
      {game.order.map((id, k) => {
        const n = setsLeft(game, id);
        return (
          <span key={id} className={styles.who} style={{ top: 120 + k * 15 }}>
            <HikerToken
              hiker={byId(id)}
              size={11}
              state={n === 0 ? 'safe' : game.phase === 'over' ? 'out' : 'waiting'}
            />
            <span className={ui.text}>
              {byId(id).name} {n === 0 ? 'done' : `${n} left`}
            </span>
          </span>
        );
      })}

      {/* A swap: a line between the two cards as they slide. */}
      {sliding && (
        <svg className={styles.lines} viewBox="0 0 320 240" aria-hidden="true">
          {(() => {
            const a = spot(sliding[0]);
            const b = spot(sliding[1]);
            return (
              <line
                x1={a.x + CARD.w / 2}
                y1={a.y + CARD.h / 2}
                x2={b.x + CARD.w / 2}
                y2={b.y + CARD.h / 2}
              />
            );
          })()}
        </svg>
      )}

      {/* The cards: each keeps its place in the list, so a swap slides. */}
      {game.cardSet.map((set, id) => {
        const pos = posOf.get(id);
        if (pos === undefined) return null;
        const at = spot(pos);
        const s = game.sets[set]!;
        const color = byId(s.hiker)?.color ?? '#d3dfaf';
        const up = game.phase === 'preview' || game.matched[id] || game.up.includes(id) || still;
        const wrong = game.phase === 'miss' && game.up.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={styles.card}
            data-up={up || undefined}
            data-matched={game.matched[id] || undefined}
            data-wrong={wrong || undefined}
            data-cursor={pos === cursor || undefined}
            aria-label={up ? `${s.snack}, ${byId(s.hiker)?.name}` : 'Face-down card'}
            style={{ left: at.x, top: at.y, transitionDuration: `${ME.swapSec}s` }}
            onClick={() => {
              setCursor(null);
              flipAt(pos);
            }}
            disabled={still}
          >
            <img
              className={ui.sprite}
              src={art(up ? 'card-face.png' : 'card-back.png')}
              alt=""
              draggable={false}
            />
            {up && (
              <img
                className={`${ui.sprite} ${styles.snack}`}
                src={
                  tints[snackKey(s.snack, color)] ??
                  asset(`minigames/find-object/snacks/${s.snack}.png`)
                }
                alt=""
                draggable={false}
              />
            )}
          </button>
        );
      })}
    </PixelScreen>
  );
}
