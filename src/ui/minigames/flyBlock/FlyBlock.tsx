/**
 * Fly Block on the GPS (docs/design/23-minigames-final.md, section 3;
 * mockup 42-fly-block.png), in scene units (320 × 240): a pie in the
 * middle of a ring of panels, lanes running out from each panel, flies
 * coming in along them, and the swatter on one panel, its flat head facing
 * out, with an arc in the active hiker's color.
 *
 * Move one panel per press of A/D or ←/→ (holding repeats), a swipe, or a
 * tap on the left or right half of the screen. D, → and a swipe right go
 * clockwise.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { flyBlockBot } from '../../../minigames/flyBlock/bot';
import {
  bitesLeft,
  blinking,
  move,
  newFlyBlock,
  result,
  swatting,
  tick,
  type Fly,
} from '../../../minigames/flyBlock/logic';
import { slowerShare } from '../../../minigames/popups/common';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';
import { turnWord } from '../../../minigames/quick/turns';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './FlyBlock.module.css';

const FB = BALANCE.minigames.flyBlock;
const art = (f: string) => asset(`minigames/fly-block/${f}`);
const swatterArt = (f: string) => asset(`minigames/fly-swatter/${f}`);
/** The middle of the ring, its radius, and how far a press must drag to count as a swipe. */
const MID = { x: 160, y: 108 };
const RING = 30;
const SWIPE = 14;
const HOLD_SEC = 0.25;

const laneAngle = (lane: number, panels: number) => -Math.PI / 2 + (2 * Math.PI * lane) / panels;
const at = (lane: number, panels: number, r: number) => {
  const a = laneAngle(lane, panels);
  return { x: MID.x + Math.cos(a) * r, y: MID.y + Math.sin(a) * r };
};

export function FlyBlock({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const beesPick = pickOf(settings, 'bees');
  const [game, setGame] = useState(() =>
    newFlyBlock(
      {
        tier,
        panels: typeof settings.panels === 'number' ? settings.panels : 'auto',
        bees: beesPick === 'on' || beesPick === 'off' ? beesPick : 'auto',
        // Prepare (23-minigames-final.md, section 10).
        extraBites: perHikerCounts(settings, 'prep.bites'),
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
        fewer: prepNumber(settings, 'prep.smoke'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const demo = useDemoMode();
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const who = swatting(game);
  const color = who ? (byId(who)?.color ?? '#d3dfaf') : '#d3dfaf';

  // Holding a key or a press repeats every [0.12 s].
  const repeat = useRef<{ dir: 1 | -1; timer: number } | null>(null);
  const stop = () => {
    if (repeat.current) window.clearInterval(repeat.current.timer);
    repeat.current = null;
  };
  const step = (dir: 1 | -1) => running && setGame((s) => move(s, dir));
  const hold = (dir: 1 | -1) => {
    stop();
    step(dir);
    repeat.current = { dir, timer: window.setInterval(() => step(dir), FB.repeatSec * 1000) };
  };
  useEffect(() => stop, []);
  useKeys(
    running,
    (key) => {
      if (key === 'd' || key === 'ArrowRight') hold(1);
      else if (key === 'a' || key === 'ArrowLeft') hold(-1);
      else return false;
      return true;
    },
    (key) => {
      if (['d', 'a', 'ArrowRight', 'ArrowLeft'].includes(key)) stop();
    },
  );
  useDemoBot(demo && running, game, flyBlockBot, (d) => setGame((s) => move(s, d)));

  // A press: a tap moves toward its half; a drag sideways is a swipe; a long press repeats.
  const press = useRef<{ x: number; swiped: boolean; timer: number; dir: 1 | -1 } | null>(null);
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    e.preventDefault();
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    const dir: 1 | -1 = p.x >= 160 ? 1 : -1;
    const timer = window.setTimeout(() => {
      if (press.current && !press.current.swiped) {
        press.current.swiped = true;
        hold(dir);
      }
    }, HOLD_SEC * 1000);
    press.current = { x: p.x, swiped: false, timer, dir };
  };
  const onMove = (e: ReactPointerEvent) => {
    const pr = press.current;
    if (!pr) return;
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    if (Math.abs(p.x - pr.x) >= SWIPE) {
      step(p.x > pr.x ? 1 : -1);
      pr.x = p.x;
      pr.swiped = true;
      window.clearTimeout(pr.timer);
    }
  };
  const onUp = () => {
    const pr = press.current;
    press.current = null;
    stop();
    if (!pr) return;
    window.clearTimeout(pr.timer);
    if (!pr.swiped) step(pr.dir);
  };

  // A sound for what just happened at the ring.
  const lastAt = game.last?.at;
  const lastKind = game.last?.kind;
  useEffect(() => {
    if (lastAt === undefined || still) return;
    if (lastKind === 'swat' || lastKind === 'knock') playSound('pop');
    else if (lastKind === 'bite' || lastKind === 'sting') playSound('miss');
  }, [lastAt, lastKind, still]);

  const n = game.panels;
  const half = Math.PI / n;
  const arc = (r: number, a0: number, a1: number) =>
    `M${MID.x + Math.cos(a0) * r} ${MID.y + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${MID.x + Math.cos(a1) * r} ${MID.y + Math.sin(a1) * r}`;
  const frame = Math.floor(game.time * 10) % 2;
  const drawFly = (f: Fly) => {
    const p = at(f.lane, n, RING + 4 + f.dist);
    const file =
      f.kind === 'bee'
        ? swatterArt(`bee-${frame + 1}.png`)
        : f.kind === 'horse'
          ? art('horsefly.png')
          : swatterArt(`fly-${frame + 1}.png`);
    const size = f.kind === 'horse' ? [18, 16] : f.kind === 'bee' ? [16, 14] : [14, 12];
    return (
      <img
        key={f.id}
        className={`${ui.sprite} ${styles.fly}`}
        data-blink={blinking(f) || undefined}
        data-fast={f.kind === 'fast' || undefined}
        src={file}
        alt=""
        draggable={false}
        style={{
          left: p.x - size[0]! / 2,
          top: p.y - size[1]! / 2,
          width: size[0],
          height: size[1],
        }}
      />
    );
  };
  const swat = at(game.at, n, RING + 7);
  const recent = game.last && game.time - game.last.at < 0.6 ? game.last : null;
  const flyLeft = game.total - game.sent + game.flies.filter((f) => f.kind !== 'bee').length;
  const word = (id: string) => {
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'SWATTING' : w;
  };

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The lanes and the ring of panels (the swatter's lit in the hiker's color). */}
        <svg className={styles.field} viewBox="0 0 320 240" aria-hidden="true">
          {Array.from({ length: n }, (_, k) => {
            const a = at(k, n, RING);
            const b = at(k, n, 220);
            const e0 = laneAngle(k, n) + half;
            const p0 = { x: MID.x + Math.cos(e0) * RING, y: MID.y + Math.sin(e0) * RING };
            const p1 = { x: MID.x + Math.cos(e0) * 220, y: MID.y + Math.sin(e0) * 220 };
            return (
              <g key={k}>
                <line
                  x1={p0.x}
                  y1={p0.y}
                  x2={p1.x}
                  y2={p1.y}
                  stroke="#3c4e2f"
                  strokeWidth={0.5}
                  opacity={0.6}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#a0b37d"
                  strokeWidth={0.3}
                  strokeDasharray="1 3"
                  opacity={0.6}
                />
                <path
                  d={arc(RING, laneAngle(k, n) - half + 0.04, laneAngle(k, n) + half - 0.04)}
                  fill="none"
                  stroke={k === game.at ? color : '#d3dfaf'}
                  strokeWidth={k === game.at ? 3 : 2}
                  opacity={k === game.at ? 1 : 0.7}
                />
              </g>
            );
          })}
        </svg>
        <img
          className={`${ui.sprite} ${styles.pie}`}
          src={art('pie.png')}
          alt=""
          draggable={false}
          style={{ left: MID.x - 15, top: MID.y - 15 }}
        />
        {game.flies.map(drawFly)}
        {/* The swatter on its panel, its flat head facing out. */}
        <img
          className={`${ui.sprite} ${styles.swatter}`}
          src={art('swatter.png')}
          alt=""
          draggable={false}
          style={{
            left: swat.x - 9,
            top: swat.y - 7,
            transform: `rotate(${(laneAngle(game.at, n) * 180) / Math.PI + 90}deg)`,
          }}
        />
        {recent && (
          <span
            className={q.word}
            style={{
              left: recent.kind === 'bite' ? MID.x : at(recent.lane, n, RING + 22).x,
              top: recent.kind === 'bite' ? MID.y - 22 : at(recent.lane, n, RING + 22).y,
            }}
          >
            {recent.kind === 'swat'
              ? 'SWAT!'
              : recent.kind === 'knock'
                ? 'AGAIN!'
                : recent.kind === 'sting'
                  ? 'STING!'
                  : recent.kind === 'bite'
                    ? 'BITE!'
                    : ''}
          </span>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          A/D OR TAP A SIDE: MOVE ONE PANEL. BLOCK THE FLIES{game.bees ? '; LET THE BEES BY' : ''}.
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>FLY BLOCK</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>FLIES LEFT</span>
          <span className={hud.bar}>
            <span style={{ width: `${(flyLeft / game.total) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : who}
          extra={(id) => {
            const max = game.biteMax[id] ?? FB.bites;
            const left = id === who ? bitesLeft(game) : max;
            return (
              <span className={styles.pips} aria-label={`${left} bites left`}>
                {Array.from({ length: max }, (_, k) => (
                  <span key={k} style={k < left ? { background: byId(id)?.color } : undefined} />
                ))}
              </span>
            );
          }}
        />
      </div>
    </PixelScreen>
  );
}
