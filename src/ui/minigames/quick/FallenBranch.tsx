/**
 * Fallen Branch on the GPS (docs/design/30-quick-minigames.md, section 3;
 * mockup 62-fallen-branch-saw.png), in scene units (320 × 240): the branch
 * seen end-on (rings, bark, its knots), the saw across it with a handle at
 * each end, and the cut growing down from the top. TEMPO above it runs from
 * TOO SLOW to TOO FAST, with the right tempo lit and a marker for the
 * rhythm now. A and D either side; the one to press next is lit.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BALANCE } from '../../../config/balance';
import { fallenBranchBot } from '../../../minigames/fallenBranch/bot';
import {
  knotNow,
  newFallenBranch,
  result,
  sawyer,
  shownTempo,
  stroke,
  tick,
  zoneNow,
  type SawKey,
} from '../../../minigames/fallenBranch/logic';
import { g } from '../../../minigames/greens';
import { prepNumber } from '../../../minigames/prepare';
import { TIER_LABELS } from '../../../minigames/types';
import { Bar } from '../Bar';
import { useDemoBot, useDemoMode } from '../demo';
import { PixelScreen } from '../PixelScreen';
import { tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './FallenBranch.module.css';
import q from './Quick.module.css';
import { Squares, TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';

const FB = BALANCE.minigames.fallenBranch;
const LOG = { x: 160, y: 128, r: 55 };
const TOP = LOG.y - LOG.r + 3;
const DEPTH = LOG.r * 2 - 6;
/** A swipe this far one way, then back, is a stroke (scene units). */
const SWIPE = 10;

/** Where a tempo sits on the TEMPO bar: 0 at TOO SLOW, 1 at TOO FAST. */
const along = (sec: number) =>
  Math.max(
    0,
    Math.min(1, (FB.tempoBar.slowest - sec) / (FB.tempoBar.slowest - FB.tempoBar.fastest)),
  );

export function FallenBranch({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newFallenBranch(
      {
        tier,
        clockSec: typeof settings.clock === 'number' ? settings.clock : 'auto',
        shiftSec: typeof settings.shift === 'number' ? settings.shift : 'auto',
        extraSec: prepNumber(settings, 'prep.extraSec'),
        sharpen: prepNumber(settings, 'prep.sharpen'),
        wax: prepNumber(settings, 'prep.wax'),
        knife: prepNumber(settings, 'prep.knife'),
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

  const saw = (key: SawKey) => setGame((s) => stroke(s, key));
  useKeys(running && !demo, (key) => {
    if (key === 'a' || key === 'ArrowLeft') saw('a');
    else if (key === 'd' || key === 'ArrowRight') saw('d');
    else return false;
    return true;
  });
  useDemoBot(demo && running, game, fallenBranchBot, (k) => saw(k));

  // A sound for each stroke: a rasp for a cut, a clunk when it binds.
  const strokeAt = game.lastStroke?.at;
  const strokeKind = game.lastStroke?.kind;
  useEffect(() => {
    if (strokeAt === undefined || still) return;
    if (strokeKind === 'cut') playSound('tick');
    else if (strokeKind === 'bind') playSound('hit');
  }, [strokeAt, strokeKind, still]);

  // Swiping back and forth (or tapping a half) on a phone.
  const swipe = useRef<{ anchor: number; dir: SawKey | null; moved: boolean; x: number } | null>(
    null,
  );
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { x } = toScene(sceneRef.current, e.clientX, e.clientY);
    swipe.current = { anchor: x, dir: null, moved: false, x };
  };
  const onMove = (e: ReactPointerEvent) => {
    const sw = swipe.current;
    if (!sw) return;
    const { x } = toScene(sceneRef.current, e.clientX, e.clientY);
    const go = (key: SawKey) => {
      saw(key);
      sw.dir = key;
      sw.anchor = x;
      sw.moved = true;
    };
    if (sw.dir === 'd') {
      if (x > sw.anchor) sw.anchor = x;
      else if (sw.anchor - x >= SWIPE) go('a');
    } else if (sw.dir === 'a') {
      if (x < sw.anchor) sw.anchor = x;
      else if (x - sw.anchor >= SWIPE) go('d');
    } else if (x - sw.anchor >= SWIPE) go('d');
    else if (sw.anchor - x >= SWIPE) go('a');
  };
  const onUp = () => {
    const sw = swipe.current;
    swipe.current = null;
    if (sw && !sw.moved && running && !demo) saw(sw.x < 160 ? 'a' : 'd');
  };

  const who = sawyer(game);
  const [lo, hi] = zoneNow(game);
  const beat = shownTempo(game);
  const next: SawKey = game.lastKey === 'a' ? 'd' : 'a';
  const bound = game.time < game.boundUntil;
  const recent = game.lastStroke && game.time - game.lastStroke.at < 0.6 ? game.lastStroke : null;
  const swapped = game.shift > 0 && game.time - game.shiftAt < 0.8;
  const cutY = TOP + game.cut * DEPTH;
  const sawX = game.lastKey === 'a' ? -10 : game.lastKey === 'd' ? 10 : 0;
  const cutBy = (id: string) => (game.cutBy[id] ?? 0) > 0;
  const word = (id: string) => {
    if (game.over) return game.passed ? 'PASSED' : 'FAILED';
    if (id === who) return 'SAWING';
    return cutBy(id) ? 'CUT' : 'WAITING';
  };
  // Sawdust from the last few cuts.
  const dust = recent?.kind === 'cut' ? game.time - recent.at : null;

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
        <svg className={styles.scene} viewBox="0 0 320 240" aria-hidden="true">
          {/* The branch, end-on: bark, rings, its knots. */}
          <circle cx={LOG.x} cy={LOG.y} r={LOG.r} fill={g(3)} stroke={g(1)} strokeWidth={1.2} />
          <circle cx={LOG.x} cy={LOG.y} r={LOG.r - 5} fill={g(6)} />
          {[0.78, 0.6, 0.42, 0.25, 0.1].map((k) => (
            <circle
              key={k}
              cx={LOG.x}
              cy={LOG.y + 2}
              r={(LOG.r - 5) * k}
              fill="none"
              stroke={g(4)}
              strokeWidth={0.5}
            />
          ))}
          {game.knots.map((k) => (
            <ellipse
              key={k.at}
              cx={LOG.x + 4}
              cy={TOP + (k.at + k.span / 2) * DEPTH}
              rx={8}
              ry={(k.span * DEPTH) / 2}
              fill={g(3)}
              stroke={g(2)}
              strokeWidth={0.6}
            />
          ))}
          {/* The cut, down from the top. */}
          <rect x={LOG.x - 2} y={TOP - 2} width={4} height={cutY - TOP + 2} fill={g(8)} />
          {dust !== null &&
            [-14, -6, 4, 12].map((dx, k) => (
              <rect
                key={dx}
                x={LOG.x + dx + Math.sin(k * 7) * 2}
                y={cutY + 6 + dust * (30 + k * 8)}
                width={2}
                height={2}
                fill={g(9)}
              />
            ))}
        </svg>

        {/* The saw across the branch, a handle at each end; it shakes when it binds. */}
        <span
          className={styles.saw}
          data-bound={bound || undefined}
          style={{ top: cutY - 6, transform: `translateX(${sawX}px)` }}
        >
          <span className={styles.handle} />
          <span className={styles.blade} />
          <span className={styles.handle} />
        </span>

        {/* TEMPO: too slow on the left, too fast on the right, the right tempo lit. */}
        <div className={`${ui.box} ${styles.tempo}`}>
          <span className={styles.title}>TEMPO</span>
          <span className={styles.track}>
            <span
              className={styles.zone}
              style={{
                left: `${along(hi) * 100}%`,
                width: `${(along(lo) - along(hi)) * 100}%`,
              }}
            />
            {beat !== null && (
              <span className={styles.marker} style={{ left: `${along(beat) * 100}%` }} />
            )}
          </span>
          <span className={styles.ends}>
            <span>TOO SLOW</span>
            <span>TOO FAST</span>
          </span>
        </div>

        <span className={styles.keyA} data-next={(running && next === 'a') || undefined}>
          A
        </span>
        <span className={styles.keyD} data-next={(running && next === 'd') || undefined}>
          D
        </span>

        {knotNow(game) && !game.over && (
          <span className={`${ui.text} ${styles.note}`}>A KNOT AHEAD: SLOW DOWN</span>
        )}
        {recent && recent.kind !== 'cut' && recent.kind !== 'start' && (
          <span className={q.word} style={{ left: LOG.x, top: LOG.y - LOG.r - 6 }}>
            {recent.kind === 'bind' ? 'BINDS!' : recent.kind === 'slow' ? 'TOO SLOW' : 'SLIP'}
          </span>
        )}
        {swapped && who && (
          <span className={styles.swap} style={{ color: byId(who).color }}>
            SWAP! {byId(who).name.toUpperCase()}
          </span>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          ALTERNATE A AND D (OR SWIPE BACK AND FORTH) IN TIME. TOO FAST AND THE SAW BINDS; TOO SLOW,
          NO CUT.
        </p>

        <div className={`${ui.box} ${hud.name}`}>FALLEN BRANCH</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>{game.over ? 'CUT' : `CUT ${Math.ceil(game.timeLeft)}S`}</span>
          <Bar value={game.cut} />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : who}
          extra={(id) => (
            <Squares
              total={1}
              lit={cutBy(id) ? 1 : 0}
              label={cutBy(id) ? 'has cut' : 'not cut yet'}
              color={byId(id).color}
            />
          )}
        />
      </div>
    </PixelScreen>
  );
}
