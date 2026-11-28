/**
 * Incoming Bike! on the GPS (docs/design/30-quick-minigames.md, section 1;
 * mockups 59-incoming-bike-keys.png and 60-incoming-bike-swipe.png), in
 * scene units (320 × 240): a trail running down the screen, wide at the
 * bottom, trees either side, the hiker near the bottom, and bikes coming
 * down at them. Each bike shows a keycap (or, on a phone, a shape) in a ring
 * in the hiker's color that closes in. Placeholder shapes in the GPS greens
 * for now; the real art can come later.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BALANCE } from '../../../config/balance';
import { incomingBikeBot } from '../../../minigames/incomingBike/bot';
import {
  bikeAt,
  newIncomingBike,
  onTrail,
  press,
  result,
  ringLeft,
  tick,
  type Bike,
  type BikeInput,
} from '../../../minigames/incomingBike/logic';
import {
  matchShape,
  SHAPES,
  type Point,
  type ShapeId,
} from '../../../minigames/incomingBike/shapes';
import { g, RED } from '../../../minigames/greens';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';
import { current, playing, turnWord } from '../../../minigames/quick/turns';
import { TIER_LABELS } from '../../../minigames/types';
import { Bar } from '../Bar';
import { useDemoBot, useDemoMode } from '../demo';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './IncomingBike.module.css';
import q from './Quick.module.css';
import { Squares, TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';

const IB = BALANCE.minigames.incomingBike;

/** The trail: narrow at the top, wide at the bottom. */
const TRAIL = '148,22 172,22 231,195 89,195';
const TREES: readonly [number, number, number][] = [
  [40, 60, 10],
  [24, 110, 9],
  [60, 150, 14],
  [282, 80, 12],
  [300, 130, 10],
  [270, 168, 16],
];
const HIKER = { x: 160, y: 178 };

/** Keys or swipes: the setting, or (Auto) swipes on a touch screen. */
function inputFor(setting: string): BikeInput {
  if (setting === 'keys' || setting === 'swipe') return setting;
  const touch =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
  return touch ? 'swipe' : 'keys';
}

/** What a keycap says. */
const KEY_LABEL: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/** A shape as a little drawing in a 12 × 12 box (a loop as a circle). */
function ShapeIcon({ id }: { id: ShapeId }) {
  if (id === 'loop') return <circle cx={6} cy={6} r={4} />;
  const step: Record<number, [number, number]> = {
    0: [1, 0],
    1: [1, 1],
    2: [0, 1],
    3: [-1, 1],
    4: [-1, 0],
    6: [0, -1],
    7: [1, -1],
  };
  const pts: [number, number][] = [[0, 0]];
  for (const d of SHAPES[id]) {
    const [x, y] = pts.at(-1)!;
    const [dx, dy] = step[d]!;
    pts.push([x + dx, y + dy]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const w = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const h = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const k = 8 / Math.max(w, h);
  const ox = 6 - ((Math.max(...xs) + Math.min(...xs)) / 2) * k;
  const oy = 6 - ((Math.max(...ys) + Math.min(...ys)) / 2) * k;
  return <polyline points={pts.map(([x, y]) => `${ox + x * k},${oy + y * k}`).join(' ')} />;
}

/** One sign on a bike: a keycap, or a shape card; dim once pressed; crossed out when it's not to be pressed. */
function Sign({ sign, done, crossed }: { sign: string; done: boolean; crossed: boolean }) {
  const shape = sign in SHAPES || sign === 'loop';
  return (
    <span className={styles.key} data-done={done || undefined}>
      {shape ? (
        <svg viewBox="0 0 12 12" className={styles.shape} aria-hidden="true">
          <ShapeIcon id={sign as ShapeId} />
        </svg>
      ) : (
        (KEY_LABEL[sign] ?? sign.toUpperCase())
      )}
      {crossed && <span className={styles.cross} />}
    </span>
  );
}

/** A bike and its rider, seen from the front, `scale` big. */
function Rider({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <svg
      className={styles.bike}
      viewBox="0 0 20 34"
      style={{ left: x - 10 * scale, top: y - 30 * scale, width: 20 * scale, height: 34 * scale }}
      aria-hidden="true"
    >
      <circle cx={10} cy={5} r={4} fill={g(4)} stroke={g(2)} strokeWidth={0.8} />
      <rect x={6.5} y={9} width={7} height={8} rx={2} fill={g(3)} />
      <rect x={1} y={16} width={18} height={1.6} fill={g(1)} />
      <ellipse cx={10} cy={25} rx={2.6} ry={6} fill="none" stroke={g(1)} strokeWidth={1.4} />
      <circle cx={10} cy={32.5} r={1.2} fill={g(1)} />
    </svg>
  );
}

export function IncomingBike({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [input] = useState(() => inputFor(pickOf(settings, 'input')));
  const [game, setGame] = useState(() =>
    newIncomingBike(
      {
        tier,
        input,
        hearts: typeof settings.hearts === 'number' ? settings.hearts : 'auto',
        food: prepNumber(settings, 'prep.slower'),
        extraHearts: perHikerCounts(settings, 'prep.lives'),
        bell: prepNumber(settings, 'prep.bell'),
        warnSec: prepNumber(settings, 'prep.warn'),
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

  const who = current(game.turns);
  const onTurn = playing(game.turns);
  const color = who ? byId(who).color : g(9);

  const send = (sign: string) => {
    const out = press(game, sign);
    if (out === game) return;
    playSound(out.lastHit !== game.lastHit ? 'hit' : 'pop');
    setGame(out);
  };
  useKeys(running && !demo && input === 'keys', (key) => {
    if (!game.signs.includes(key)) return false;
    send(key);
    return true;
  });
  useDemoBot(demo && running, game, incomingBikeBot, (sign) => send(sign));

  // Drawing a shape (swipes): the stroke in the hiker's color while it's drawn.
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const draw = useRef<Point[] | null>(null);
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo || input !== 'swipe') return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draw.current = [toScene(sceneRef.current, e.clientX, e.clientY)];
    setStroke(draw.current);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!draw.current) return;
    draw.current = [...draw.current, toScene(sceneRef.current, e.clientX, e.clientY)];
    setStroke(draw.current);
  };
  const onUp = () => {
    const pts = draw.current;
    draw.current = null;
    setStroke(null);
    if (!pts) return;
    const shape = matchShape(pts, game.signs as ShapeId[]);
    if (shape) send(shape);
  };

  // The hiker: a hop aside after a dodge, a wobble after a hit.
  const t = game.turnTime;
  const hop = game.lastHop && t - game.lastHop.at < 0.45 ? (t - game.lastHop.at) / 0.45 : null;
  const hopDir = game.lastHop
    ? game.lastHop.lane === 0
      ? game.dodged % 2
        ? 1
        : -1
      : -game.lastHop.lane
    : 1;
  const hit = game.lastHit && t - game.lastHit.at < IB.stumbleSec + 0.2;
  const hikerX =
    HIKER.x +
    (hop !== null ? hopDir * 24 * Math.sin(Math.PI * hop) : 0) +
    (hit ? Math.sin(t * 60) * 2 : 0);
  const hikerY = HIKER.y - (hop !== null ? 6 * Math.sin(Math.PI * hop) : 0);

  const heartsAll = who ? game.hearts + (game.extraHearts[who] ?? 0) : game.hearts;
  const past = game.spawned - onTrail(game).length;
  const dodgedBy = (id: string) =>
    id === who && !game.over ? game.dodged : (game.record[id] ?? 0);
  const word = (id: string) => {
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'DODGING' : w;
  };

  const drawBike = (b: Bike) => {
    const p = bikeAt(game, b);
    const scale = 0.4 + 0.6 * Math.min(1.3, p);
    const x = 160 + b.lane * (8 + 30 * Math.min(1.3, p));
    const y = 44 + p * 128;
    const live = !b.outcome;
    const side = b.lane < 0 ? -1 : 1;
    const kx = x + side * (14 + 10 * scale);
    const ky = y - 18 * scale;
    const r = 7 + 15 * ringLeft(game, b);
    const waiting = t < b.ringAt;
    return (
      <span key={b.id}>
        <Rider x={x} y={y} scale={scale} />
        {live && (
          <>
            <span
              className={styles.ring}
              data-waiting={waiting || undefined}
              style={{ left: kx - r, top: ky - r, width: r * 2, height: r * 2, borderColor: color }}
            />
            <span className={styles.signs} style={{ left: kx, top: ky }}>
              {b.signs.map((sign, k) => (
                <Sign key={k} sign={sign} done={k < b.done} crossed={b.crossed} />
              ))}
            </span>
          </>
        )}
        {b.how === 'duck' && game.turnTime - (b.endAt ?? 0) < 0.6 && (
          <span className={q.word} style={{ left: HIKER.x, top: 150 }}>
            DUCK!
          </span>
        )}
        {b.how === 'bell' && game.turnTime - (b.endAt ?? 0) < 0.6 && (
          <span className={q.word} style={{ left: HIKER.x, top: 150 }}>
            DING! A FREE ONE
          </span>
        )}
      </span>
    );
  };

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
        <svg className={styles.scene} viewBox="0 0 320 200" aria-hidden="true">
          <rect width={320} height={200} fill={g(7)} />
          <polygon points={TRAIL} fill={g(8)} />
          {TREES.map(([x, y, r]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={r}
              fill={g(5)}
              stroke={g(3)}
              strokeWidth={0.8}
            />
          ))}
        </svg>

        {onTurn && game.bikes.map(drawBike)}

        {who && !game.over && (
          <HikerToken
            hiker={byId(who)}
            size={18}
            state="current"
            className={styles.hiker}
            style={{ left: hikerX - 9, top: hikerY - 9 }}
          />
        )}
        {hit && onTurn && (
          <span className={q.word} style={{ left: HIKER.x, top: 156, color: RED }}>
            −1 HEART
          </span>
        )}

        {stroke && stroke.length > 1 && (
          <svg className={styles.stroke} viewBox="0 0 320 240" aria-hidden="true">
            <polyline points={stroke.map((p) => `${p.x},${p.y}`).join(' ')} stroke={color} />
          </svg>
        )}

        {!onTurn && !game.over && who && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(who).name.toUpperCase()}, YOUR TURN
          </span>
        )}
        <p className={`${ui.muted} ${q.hint}`}>
          {input === 'swipe'
            ? 'DRAW THE SHAPE ON A BIKE BEFORE ITS RING CLOSES, AND YOU HOP ASIDE. WRONG OR LATE: −1 HEART.'
            : 'PRESS THE KEY ON A BIKE BEFORE ITS RING CLOSES, AND YOU HOP ASIDE. WRONG OR LATE: −1 HEART.'}
        </p>

        {/* The hearts of the hiker up now, top right. */}
        {who && !game.over && (
          <span className={styles.hearts} aria-label={`${game.heartsLeft} hearts left`}>
            {Array.from({ length: heartsAll }, (_, k) => (
              <span key={k} data-on={k < game.heartsLeft || undefined} />
            ))}
          </span>
        )}

        <div className={`${ui.box} ${hud.name}`}>INCOMING BIKE!</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>BIKES</span>
          <Bar value={game.over ? 1 : past / game.bikesPer} />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : who}
          extra={(id) => (
            <Squares
              total={game.bikesPer}
              lit={dodgedBy(id)}
              label={`${dodgedBy(id)} of ${game.bikesPer} dodged`}
              color={byId(id).color}
            />
          )}
        />
      </div>
    </PixelScreen>
  );
}
