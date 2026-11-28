/**
 * Wrong Turn on the GPS (docs/design/30-quick-minigames.md, section 2;
 * mockup 61-wrong-turn-compass.png), in scene units (320 × 240): a compass
 * in the middle with N, E, S and W and a mark every [10°], the notch (a
 * wedge at the bearing, as wide as counts), and the needle (red tip). The
 * BEARINGS list and HOLD TO LOCK on the right; A on the left and D on the
 * right, which are also the halves of the screen to tap.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { g, RED } from '../../../minigames/greens';
import { prepNumber } from '../../../minigames/prepare';
import { TIER_LABELS } from '../../../minigames/types';
import { wrongTurnBot } from '../../../minigames/wrongTurn/bot';
import {
  bearingNow,
  newWrongTurn,
  notchHidden,
  result,
  setTurn,
  tick,
  whoNow,
  type Turn,
  type WrongTurnState,
} from '../../../minigames/wrongTurn/logic';
import { Bar } from '../Bar';
import { useDemoBot, useDemoMode } from '../demo';
import { PixelScreen } from '../PixelScreen';
import { tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from './Quick.module.css';
import { Squares, TurnBar } from './TurnBar';
import styles from './WrongTurn.module.css';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';

const C = { x: 160, y: 110, r: 72 };

/** A point on the dial: `deg` clockwise from north, `r` from the middle. */
const onDial = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C.x + Math.sin(a) * r, y: C.y - Math.cos(a) * r };
};

/** A wedge of the dial from `r0` to `r1`, between two angles. */
function wedge(from: number, to: number, r0: number, r1: number): string {
  const [a, b, c, d] = [onDial(from, r1), onDial(to, r1), onDial(to, r0), onDial(from, r0)];
  return `M${a.x} ${a.y} A${r1} ${r1} 0 0 1 ${b.x} ${b.y} L${c.x} ${c.y} A${r0} ${r0} 0 0 0 ${d.x} ${d.y}Z`;
}

const three = (deg: number) => `${String(deg).padStart(3, '0')}°`;

function Compass({ game }: { game: WrongTurnState }) {
  const flashing = game.flash > 0 && game.lastLock;
  const shown = flashing ? game.bearings[game.lastLock!.index]! : bearingNow(game);
  const hidden = !flashing && notchHidden(game);
  const ticks = Array.from({ length: 36 }, (_, k) => k * 10);
  return (
    <svg className={styles.compass} viewBox="0 0 320 240" aria-hidden="true">
      <circle cx={C.x} cy={C.y} r={C.r + 4} fill={g(2)} />
      <circle cx={C.x} cy={C.y} r={C.r} fill={g(9)} />
      {ticks.map((d) => {
        const long = d % 30 === 0;
        const a = onDial(d, C.r - 1);
        const b = onDial(d, C.r - (d % 90 === 0 ? 9 : long ? 7 : 4));
        return (
          <line
            key={d}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={g(1)}
            strokeWidth={long ? 1 : 0.6}
          />
        );
      })}
      {(['N', 'E', 'S', 'W'] as const).map((w, k) => {
        const p = onDial(k * 90, C.r - 16);
        return (
          <text key={w} x={p.x} y={p.y} className={styles.point}>
            {w}
          </text>
        );
      })}
      {shown !== null && !hidden && (
        <g data-flash={flashing || undefined} className={styles.notch}>
          <path d={wedge(shown - game.notchDeg, shown + game.notchDeg, 14, C.r - 2)} fill={g(5)} />
          <path
            d={`M${onDial(shown, C.r + 2).x} ${onDial(shown, C.r + 2).y} L${onDial(shown - 4, C.r + 11).x} ${onDial(shown - 4, C.r + 11).y} L${onDial(shown + 4, C.r + 11).x} ${onDial(shown + 4, C.r + 11).y}Z`}
            fill={g(1)}
          />
        </g>
      )}
      {/* The needle: a red tip, a dark tail. */}
      <g transform={`rotate(${game.needle} ${C.x} ${C.y})`}>
        <path d={`M${C.x - 4} ${C.y} L${C.x} ${C.y - C.r + 12} L${C.x + 4} ${C.y}Z`} fill={RED} />
        <path d={`M${C.x - 4} ${C.y} L${C.x} ${C.y + 34} L${C.x + 4} ${C.y}Z`} fill={g(1)} />
      </g>
      <circle cx={C.x} cy={C.y} r={3.5} fill={g(5)} stroke={g(1)} strokeWidth={0.8} />
    </svg>
  );
}

export function WrongTurn({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newWrongTurn(
      {
        tier,
        clockSec: typeof settings.clock === 'number' ? settings.clock : 'auto',
        extraSec: prepNumber(settings, 'prep.extraSec'),
        cairns: prepNumber(settings, 'prep.cairn'),
        charm: prepNumber(settings, 'prep.charm'),
        map: prepNumber(settings, 'prep.map'),
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

  // A lock: a click.
  const lockAt = game.lastLock?.at;
  useEffect(() => {
    if (lockAt !== undefined && !still) playSound('pop');
  }, [lockAt, still]);

  const turn = (t: Turn) => setGame((s) => setTurn(s, t));
  const held = useRef<string | null>(null);
  useKeys(
    running && !demo,
    (key) => {
      const t: Turn | null =
        key === 'a' || key === 'ArrowLeft' ? -1 : key === 'd' || key === 'ArrowRight' ? 1 : null;
      if (t === null) return false;
      held.current = key;
      turn(t);
      return true;
    },
    (key) => {
      if (key === held.current) {
        held.current = null;
        turn(0);
      }
    },
  );
  useDemoBot(demo && running, game, wrongTurnBot, (t) => turn(t));

  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    turn(toScene(sceneRef.current, e.clientX, e.clientY).x < 160 ? -1 : 1);
  };
  const onUp = () => {
    if (!running || demo) return;
    turn(0);
  };

  const who = whoNow(game);
  const locked = (id: string) => game.whose.filter((w, k) => w === id && k < game.at).length;
  const mine = (id: string) => game.whose.filter((w) => w === id).length;
  const word = (id: string) => {
    if (game.over) return game.passed ? 'PASSED' : 'FAILED';
    if (id === who) return 'TURNING';
    return locked(id) >= mine(id) ? 'LOCKED' : 'WAITING';
  };
  const flashing = game.flash > 0;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Compass game={game} />
        {flashing && (
          <span className={q.word} style={{ left: C.x, top: C.y + 44 }}>
            LOCKED!
          </span>
        )}

        {/* The keys, which are also the halves to tap. */}
        <span className={styles.keyA}>
          <span className={styles.cap} data-on={game.turn === -1 || undefined}>
            A
          </span>
          <span className={`${ui.muted} ${styles.or}`}>OR TAP LEFT</span>
        </span>
        <span className={styles.keyD}>
          <span className={styles.cap} data-on={game.turn === 1 || undefined}>
            D
          </span>
          <span className={`${ui.muted} ${styles.or}`}>OR TAP RIGHT</span>
        </span>

        {/* BEARINGS, and HOLD TO LOCK. */}
        <div className={`${ui.box} ${styles.list}`}>
          <span className={styles.title}>BEARINGS</span>
          {game.bearings.map((b, k) => (
            <span key={k} className={styles.row} data-later={k > game.at || undefined}>
              <span>{three(b)}</span>
              <span className={styles.mark}>{k < game.at ? 'OK' : k === game.at ? '<' : ''}</span>
            </span>
          ))}
        </div>
        <div className={`${ui.box} ${styles.lock}`}>
          <span className={styles.title}>HOLD TO LOCK</span>
          <Bar value={game.hold / game.holdSec} live className={styles.lockBar} />
        </div>

        <p className={`${ui.muted} ${q.hint}`}>
          A / D (OR TAP A SIDE) TURNS THE NEEDLE; IT SWINGS AND SETTLES. EACH HIKER LOCKS ONE
          BEARING IN TURN.
        </p>

        <div className={`${ui.box} ${hud.name}`}>WRONG TURN</div>
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
              total={mine(id)}
              lit={locked(id)}
              label={`${locked(id)} of ${mine(id)} locked`}
              color={byId(id).color}
            />
          )}
        />
      </div>
    </PixelScreen>
  );
}
