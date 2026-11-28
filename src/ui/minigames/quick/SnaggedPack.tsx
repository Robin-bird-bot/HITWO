/**
 * Snagged Pack on the GPS (docs/design/30-quick-minigames.md, section 4;
 * mockup 63-snagged-pack-ropes.png), in scene units (320 × 240): the board
 * in the middle (square cells on a dark panel), pairs of colored sockets,
 * and the ropes drawn thick in their colors. PAIRS on the right ("PAIRS
 * 2/5"); the hiker's clock in the top bar.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { g } from '../../../minigames/greens';
import { prepNumber } from '../../../minigames/prepare';
import { current, playing, turnWord } from '../../../minigames/quick/turns';
import { snaggedPackBot, type SnaggedMove } from '../../../minigames/snaggedPack/bot';
import { xy } from '../../../minigames/snaggedPack/boards';
import {
  clearRope,
  dragTo,
  grab,
  joinedCount,
  newSnaggedPack,
  pairOf,
  release,
  result,
  ropeAt,
  showHint,
  socketAt,
  tick,
  type SnaggedState,
} from '../../../minigames/snaggedPack/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { Bar } from '../Bar';
import { useDemoBot, useDemoMode } from '../demo';
import { PixelScreen } from '../PixelScreen';
import { tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from './Quick.module.css';
import styles from './SnaggedPack.module.css';
import { Squares, TurnBar } from './TurnBar';
import { useFixedLoop, useReportOnce } from './useQuick';

/** The rope colors: the party's four, then four more, all easy to tell apart. */
const ROPES: readonly { color: string; name: string }[] = [
  { color: '#E2683C', name: 'ORANGE' },
  { color: '#4A8FD4', name: 'BLUE' },
  { color: '#EBC04A', name: 'YELLOW' },
  { color: '#A06CC9', name: 'PURPLE' },
  { color: '#6FBF5A', name: 'GREEN' },
  { color: '#3FB8B0', name: 'TEAL' },
  { color: '#E58FB5', name: 'PINK' },
  { color: '#F4F8DC', name: 'WHITE' },
];
const rope = (c: number) => ROPES[c % ROPES.length]!;

/** The board: its panel, and the grid inside it. */
const BOARD = { left: 84, top: 28, size: 152, pad: 4 };

function cellBox(s: SnaggedState, cell: number) {
  const pitch = (BOARD.size - BOARD.pad * 2) / s.size;
  const { x, y } = xy(s.size, cell);
  return {
    x: BOARD.left + BOARD.pad + pitch * x,
    y: BOARD.top + BOARD.pad + pitch * y,
    pitch,
    cx: BOARD.left + BOARD.pad + pitch * (x + 0.5),
    cy: BOARD.top + BOARD.pad + pitch * (y + 0.5),
  };
}

/** The cell under a scene point, or null off the board. */
function cellAt(s: SnaggedState, p: { x: number; y: number }): number | null {
  const pitch = (BOARD.size - BOARD.pad * 2) / s.size;
  const x = Math.floor((p.x - BOARD.left - BOARD.pad) / pitch);
  const y = Math.floor((p.y - BOARD.top - BOARD.pad) / pitch);
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return null;
  return y * s.size + x;
}

const line = (s: SnaggedState, cells: readonly number[]) =>
  cells.map((c) => `${cellBox(s, c).cx},${cellBox(s, c).cy}`).join(' ');

export function SnaggedPack({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newSnaggedPack(
      {
        tier,
        clockSec: typeof settings.clock === 'number' ? settings.clock : 'auto',
        extraSec: prepNumber(settings, 'prep.extraSec'),
        sorted: prepNumber(settings, 'prep.sorted'),
        hints: prepNumber(settings, 'prep.hint'),
        fewer: prepNumber(settings, 'prep.fewer'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  const demo = useDemoMode();
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);

  const act = (m: SnaggedMove) =>
    setGame((s) =>
      m.kind === 'grab'
        ? grab(s, m.cell)
        : m.kind === 'drag'
          ? dragTo(s, m.cell)
          : m.kind === 'release'
            ? release(s)
            : clearRope(s, m.color),
    );
  useDemoBot(demo && running, game, snaggedPackBot, act);

  // A rope joins: a click.
  const joinAt = game.lastJoin?.at;
  useEffect(() => {
    if (joinAt !== undefined && !still) playSound('pop');
  }, [joinAt, still]);

  // A LUCKY CHARM's hint waits for a socket to be tapped.
  const [hintArmed, setHintArmed] = useState(false);
  const press = useRef<{ cell: number; moved: boolean; onRope: number | null } | null>(null);
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo || !playing(game.turns)) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const cell = cellAt(game, toScene(sceneRef.current, e.clientX, e.clientY));
    if (cell === null) return;
    const socket = socketAt(game, cell);
    if (hintArmed && socket) {
      setHintArmed(false);
      setGame((s) => showHint(s, socket.color));
      return;
    }
    press.current = { cell, moved: false, onRope: socket ? null : ropeAt(game, cell) };
    setGame((s) => grab(s, cell));
  };
  const onMove = (e: ReactPointerEvent) => {
    const pr = press.current;
    if (!pr) return;
    const cell = cellAt(game, toScene(sceneRef.current, e.clientX, e.clientY));
    if (cell === null || cell === pr.cell) return;
    pr.cell = cell;
    pr.moved = true;
    setGame((s) => dragTo(s, cell));
  };
  const onUp = () => {
    const pr = press.current;
    press.current = null;
    if (!pr) return;
    // A tap on a rope clears it.
    const tapped = !pr.moved && pr.onRope !== null ? pr.onRope : null;
    setGame((s) => (tapped !== null ? clearRope(release(s), tapped) : release(s)));
  };

  const who = current(game.turns);
  const onTurn = playing(game.turns);
  const word = (id: string) => {
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'UNTANGLING' : w;
  };
  const dragging = game.drag !== null ? rope(game.drag) : null;
  const cells = Array.from({ length: game.size * game.size }, (_, k) => k);
  const hint = game.hint ? pairOf(game, game.hint.color) : undefined;
  const thick = cellBox(game, 0).pitch * 0.32;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg className={styles.board} viewBox="0 0 320 240" aria-hidden="true">
          <rect
            x={BOARD.left}
            y={BOARD.top}
            width={BOARD.size}
            height={BOARD.size}
            rx={3}
            fill={g(1)}
            stroke={g(0)}
            strokeWidth={1}
          />
          {cells.map((c) => {
            const b = cellBox(game, c);
            return (
              <rect
                key={c}
                x={b.x + 1}
                y={b.y + 1}
                width={b.pitch - 2}
                height={b.pitch - 2}
                rx={1.5}
                fill={g(7)}
              />
            );
          })}
          {onTurn && (
            <>
              {Object.entries(game.ropes).map(([c, r]) => (
                <polyline
                  key={c}
                  points={line(game, r)}
                  className={styles.rope}
                  stroke={rope(Number(c)).color}
                  strokeWidth={thick}
                />
              ))}
              {hint && (
                <polyline
                  points={line(game, hint.path)}
                  className={styles.hint}
                  stroke={rope(hint.color).color}
                  strokeWidth={thick * 0.5}
                />
              )}
              {game.board.pairs.flatMap((p) =>
                [p.a, p.b].map((cell) => {
                  const b = cellBox(game, cell);
                  return (
                    <g key={cell}>
                      <circle
                        cx={b.cx}
                        cy={b.cy}
                        r={b.pitch * 0.34}
                        fill={rope(p.color).color}
                        stroke={g(0)}
                        strokeWidth={0.8}
                      />
                      <circle cx={b.cx} cy={b.cy} r={b.pitch * 0.13} fill={g(0)} />
                    </g>
                  );
                }),
              )}
            </>
          )}
        </svg>

        <div className={`${ui.box} ${styles.pairs}`}>
          PAIRS {joinedCount(game)}/{game.board.pairs.length}
        </div>
        {game.hints > 0 && onTurn && (
          <button
            type="button"
            className={`${ui.button} ${styles.hintButton}`}
            disabled={game.hintsLeft <= 0 || hintArmed || demo}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHintArmed(true)}
          >
            {hintArmed ? 'TAP A SOCKET' : `HINT (${game.hintsLeft})`}
          </button>
        )}

        {dragging && (
          <span className={`${ui.text} ${styles.note}`}>
            DRAGGING {dragging.name}: NO CROSSING OTHER ROPES
          </span>
        )}
        {!onTurn && !game.over && who && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(who).name.toUpperCase()}, YOUR TURN
          </span>
        )}
        <p className={`${ui.muted} ${q.hint}`}>
          DRAG A ROPE FROM A SOCKET TO ITS MATCH. ROPES CAN’T CROSS. EACH HIKER UNTANGLES THEIR OWN
          PACK.
        </p>

        <div className={`${ui.box} ${hud.name}`}>SNAGGED PACK</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            {who && !game.over
              ? `${byId(who).name.toUpperCase()} ${Math.ceil(game.timeLeft)}S`
              : 'TIME'}
          </span>
          <Bar value={game.timeLeft / game.clockSec} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : who}
          extra={(id) => (
            <Squares
              total={1}
              lit={game.turns.done[id] ? 1 : 0}
              label={game.turns.done[id] ? 'untangled' : 'not yet'}
              color={byId(id).color}
            />
          )}
        />
      </div>
    </PixelScreen>
  );
}
