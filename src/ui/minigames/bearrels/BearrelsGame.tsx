/**
 * Bearrels (docs/design/10-minigames.md, "Bearrels"), played on the turned
 * party GPS's 4:3 screen (1280 × 960), in either version of the GPS greens.
 *
 * Each round: drag each hiker to a barrel (or tap a hiker, then a barrel),
 * until everyone still in is placed, then Ready. The bear pops up, the
 * crosshair sweeps across the barrels and settles on the one it picked, and
 * it fires: anyone behind that barrel is out (a red flash, a shake, the
 * hikers tip over), or "Missed!". With 2 shots the second follows on a
 * different barrel. The bear ducks, and the next round starts with everyone
 * where they were. After the last round, or once everyone is out, the shared
 * end screen (the play stage shows it).
 *
 * The version only changes how the scene is drawn (./Scene.tsx): switching it
 * mid-round keeps every hiker's barrel, the round and who is out.
 *
 * Mouse, touch or keyboard (1–4, ← →, Enter or Space). Reduced motion: no
 * shake, a softer flash, and the crosshair jumps straight to its barrel.
 * Sounds are hooks only (../sound.ts).
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { BALANCE } from '../../../config/balance';
import {
  behind,
  canDrag,
  canReady,
  drop,
  endRound,
  fire,
  hitLine,
  keyAction,
  newGame,
  place,
  ready,
  result,
  select,
  stillIn,
  type BearrelsState,
} from '../../../minigames/bearrels/logic';
import { sceneHikers, type BearPose, type SceneModel } from '../../../minigames/bearrels/scene';
import {
  barrelAt,
  frameFor,
  GAME,
  hikerCenters,
  UI,
  type ArtStyle,
} from '../../../minigames/bearrels/styles';
import type { MinigameHiker, MinigameResult } from '../../../minigames/types';
import { useReducedMotion } from '../../app/useReducedMotion';
import { HikerPortrait } from '../../hikers/HikerPortrait';
import { playSound } from '../sound';
import { usePixelFrame } from '../usePixelFrame';
import { BearrelsScene } from './Scene';
import styles from './Bearrels.module.css';

const T = BALANCE.minigames.bearrels.timing;
const B = BALANCE.minigames.bearrels;
const D = B.drag;

const PICK = 'Drag a hiker to a barrel';
const MOVE = 'Move anyone, then Ready';

export interface BearrelsSettingsProps {
  barrels: number;
  rounds: number;
  shots: number;
}

/** A press on a hiker (their token, or them behind a barrel): a drag once it moves far enough. */
interface Press {
  id: string;
  from: 'token' | 'scene';
  pointerId: number;
  /** Where it started, in screen pixels. */
  sx: number;
  sy: number;
  dragging: boolean;
  /** Where the pointer is on the game screen (1280 × 960), and the barrel under it. */
  x: number;
  y: number;
  over: number | null;
}

/** A portrait dropped on nothing, flying back where it came from. */
interface FlyBack {
  id: string;
  x: number;
  y: number;
  to: { x: number; y: number };
  go: boolean;
}

/** Two frames from now: after the browser has drawn what was just set. */
const afterPaint = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

export function BearrelsGame({
  settings,
  style,
  hikers,
  seed,
  onDone,
}: {
  settings: BearrelsSettingsProps;
  style: ArtStyle;
  hikers: readonly MinigameHiker[];
  seed: number;
  /** It's over: who was safe and who was hit (the end screen comes next). */
  onDone(result: MinigameResult): void;
}) {
  const reduced = useReducedMotion();
  const ids = hikers.map((h) => h.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const tokenRefs = useRef(new Map<string, HTMLElement>());
  const frame = usePixelFrame(rootRef);
  const [game, setGame] = useState(() => newGame(settings, ids, seed));
  const n = game.settings.barrels;
  const [bear, setBear] = useState<BearPose>('hidden');
  /** The crosshair, as a place along the barrel row (a barrel index, in between while sweeping). */
  const [cross, setCross] = useState<number | null>(null);
  const [shaking, setShaking] = useState<number | null>(null);
  const [smoke, setSmoke] = useState<number | null>(null);
  /** Hikers tipping over from this round's shots, and hikers gone from the scene. */
  const [tipped, setTipped] = useState<string[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<{ text: string; bad?: boolean }>({ text: PICK });
  const [flash, setFlash] = useState(0);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  /** The keyboard was used: its highlight shows on the barrels. */
  const [keys, setKeys] = useState(false);
  const [press, setPress] = useState<Press | null>(null);
  const [fly, setFly] = useState<FlyBack | null>(null);
  const [arriving, setArriving] = useState<SceneModel['arriving']>(null);
  /** A click that ends a drag isn't a tap. */
  const ignoreClick = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const name = (id: string) => hikers.find((h) => h.id === id)?.name ?? id;
  const sleep = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(alive.current), ms));
  const placing = game.phase === 'placing' && !busy;

  /** The crosshair sweeps along the row and back, slowing onto its barrel. */
  const sweep = (target: number) =>
    new Promise<boolean>((resolve) => {
      if (reduced) {
        setCross(target);
        resolve(alive.current);
        return;
      }
      const last = n - 1;
      const start = performance.now();
      let prev = 0;
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      const step = (now: number) => {
        if (!alive.current) return resolve(false);
        const t = Math.min(1, (now - start) / T.sweepMs);
        const at =
          t < 0.55
            ? last * ease(t / 0.55)
            : last + (target - last) * (1 - (1 - (t - 0.55) / 0.45) ** 3);
        // A tick each time it passes a barrel.
        if (Math.round(prev) !== Math.round(at)) playSound('tick');
        prev = at;
        setCross(at);
        if (t < 1) requestAnimationFrame(step);
        else resolve(true);
      };
      requestAnimationFrame(step);
    });

  /** The bear's turn: up, aim, fire (once or twice), duck; then the next round or the results. */
  const shoot = async (start: BearrelsState) => {
    setBusy(true);
    setHover(null);
    setPress(null);
    setPrompt({ text: 'Here it comes…' });
    playSound('ready');
    setBear('up');
    playSound('bearUp');
    if (!(await sleep(T.bearUpMs))) return;
    let s = start;
    const hitThisRound: string[] = [];
    for (let k = 0; k < s.targets.length; k++) {
      const target = s.targets[k]!;
      if (k > 0) setPrompt({ text: 'Again…' });
      if (!(await sweep(target))) return;
      if (!(await sleep(T.holdMs))) return;
      setBear('fire');
      playSound('pop');
      const shot = fire(s);
      s = shot.state;
      setGame(s);
      if (shot.hit.length) {
        hitThisRound.push(...shot.hit);
        setShaking(target);
        setTipped((t) => [...t, ...shot.hit]);
        setFlash((f) => f + 1);
        if (!reduced) setShake(true);
        setPrompt({ text: hitLine(shot.hit.map(name)), bad: true });
        playSound('hit');
      } else {
        setSmoke(target);
        setPrompt({ text: 'Missed!' });
        playSound('miss');
      }
      if (!(await sleep(T.muzzleMs))) return;
      setBear('up');
      if (!(await sleep(Math.max(0, T.fireMs - T.muzzleMs)))) return;
      setShake(false);
      setShaking(null);
      setSmoke(null);
      if (k < s.targets.length - 1 && !(await sleep(T.secondShotMs))) return;
    }
    if (!(await sleep(T.betweenRoundsMs))) return;
    // The bear ducks; hikers who were hit fade out.
    setCross(null);
    setBear('hidden');
    setGone((g) => [...g, ...hitThisRound]);
    setTipped([]);
    if (!(await sleep(T.duckMs))) return;
    s = endRound(s);
    setGame(s);
    setBusy(false);
    if (s.phase === 'over') {
      setResults(true);
      onDone(result(s));
      return;
    }
    setPrompt({ text: MOVE });
  };

  const pressReady = () => {
    if (busy || !canReady(game)) return;
    const next = ready(game);
    setGame(next);
    void shoot(next);
  };

  const placeAt = (barrel: number) => {
    if (ignoreClick.current || busy || game.phase !== 'placing' || !game.selected) return;
    setGame(place(game, barrel));
    playSound('place');
  };

  // ── Drag-and-drop ──

  /** A point on the screen, on the game screen (1280 × 960). */
  const toGame = (clientX: number, clientY: number) => {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: ((clientX - r.left) / r.width) * GAME.width,
      y: ((clientY - r.top) / r.height) * GAME.height,
    };
  };

  const startPress = (id: string, from: Press['from'], e: ReactPointerEvent) => {
    if (!placing || !canDrag(game, id) || e.button > 0) return;
    setPress({
      id,
      from,
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      dragging: false,
      ...toGame(e.clientX, e.clientY),
      over: null,
    });
  };

  /** Where a hiker's portrait goes back to: their token, or their spot behind a barrel. */
  const home = (p: Press): { x: number; y: number } => {
    const at = game.placed[p.id];
    if (p.from === 'scene' && at !== undefined) {
      const group = behind(game, at);
      const spot = hikerCenters(style, n, at, group.length, frameFor(style, frame))[
        group.indexOf(p.id)
      ];
      if (spot) return spot;
    }
    const r = tokenRefs.current.get(p.id)?.getBoundingClientRect();
    return r ? toGame(r.left + r.width / 2, r.top + r.height / 2) : { x: p.x, y: p.y };
  };

  // While pressing: follow the pointer anywhere on the page, then drop.
  useEffect(() => {
    if (!press) return;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== press.pointerId) return;
      if (!press.dragging && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) <= D.startPx) {
        return;
      }
      e.preventDefault();
      const p = toGame(e.clientX, e.clientY);
      setPress({ ...press, dragging: true, ...p, over: barrelAt(n, p, frameFor(style, frame)) });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== press.pointerId) return;
      setPress(null);
      if (!press.dragging) return;
      ignoreClick.current = true;
      setTimeout(() => {
        ignoreClick.current = false;
      }, 0);
      const p = toGame(e.clientX, e.clientY);
      const over = barrelAt(n, p, frameFor(style, frame));
      if (over !== null && canDrag(game, press.id)) {
        setGame(drop(game, press.id, over));
        playSound('place');
        // Drawn where it was let go, then it slides into place.
        setArriving({ id: press.id, ...p });
        afterPaint(() => setArriving(null));
        return;
      }
      setFly({ id: press.id, ...p, to: home(press), go: false });
      afterPaint(() => setFly((f) => (f ? { ...f, go: true } : f)));
      setTimeout(() => setFly(null), D.flyBackMs + 40);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === press.pointerId) setPress(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  });

  // The keyboard: 1–4, ← →, Enter or Space.
  useEffect(() => {
    if (busy || results || game.phase !== 'placing') return;
    const onKey = (e: KeyboardEvent) => {
      if (!/^[1-4]$/.test(e.key) && !['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
        return;
      }
      e.preventDefault();
      setKeys(true);
      const move = keyAction(game, e.key);
      if (move.pressedReady) {
        setGame(move.state);
        void shoot(move.state);
        return;
      }
      if (move.placed) playSound('place');
      setGame(move.state);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dragging = press?.dragging ? press : null;
  const lifted = dragging?.id ?? fly?.id ?? null;
  const model: SceneModel = {
    barrels: n,
    hikers: sceneHikers(game, hikers, { tipped, gone, lifted }),
    bear,
    crosshair: cross,
    outline: dragging
      ? dragging.over
      : placing && game.selected
        ? (hover ?? (keys ? game.highlight : null))
        : null,
    shaking,
    smoke,
    arriving,
  };
  const ghost = dragging
    ? { id: dragging.id, x: dragging.x, y: dragging.y, flying: false }
    : fly
      ? { id: fly.id, ...(fly.go ? fly.to : { x: fly.x, y: fly.y }), flying: true }
      : null;
  const ghostHiker = ghost ? hikers.find((h) => h.id === ghost.id) : undefined;
  const tokenBar = UI.tokens;
  const pill = { top: UI.pills.top, height: UI.pills.height };

  return (
    <div ref={rootRef} className={styles.game} data-shake={shake || undefined}>
      <div className={styles.scene}>
        <BearrelsScene
          style={style}
          model={model}
          frame={frame}
          {...(placing
            ? {
                onBarrel: placeAt,
                onHover: setHover,
                onHikerDown: (id: string, e: ReactPointerEvent) => startPress(id, 'scene', e),
              }
            : {})}
        />
      </div>

      {flash > 0 && (
        <div
          key={flash}
          className={styles.flash}
          data-soft={reduced || undefined}
          style={
            {
              '--flash': reduced ? B.softFlash : B.flash,
              '--in': `${T.flashInMs}ms`,
              '--out': `${T.flashOutMs}ms`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      )}

      <span className={`${styles.pill} ${styles.round}`} style={pill}>
        R {game.round}/{game.settings.rounds}
      </span>
      <span
        className={`${styles.pill} ${styles.prompt}`}
        style={pill}
        data-bad={prompt.bad || undefined}
        role="status"
      >
        {prompt.text.toUpperCase()}
      </span>
      <span
        className={`${styles.pill} ${styles.shots}`}
        style={pill}
        aria-label={`${game.settings.shots} shot${game.settings.shots === 1 ? '' : 's'} a round`}
      >
        <span className={styles.shotsWord}>SHOTS</span>
        {Array.from({ length: game.settings.shots }, (_, i) => (
          <svg key={i} width="26" height="26" viewBox="-100 -100 200 200" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="18" fill="none">
              <circle r="60" />
              <path d="M0 -96 v40 M0 56 v40 M-96 0 h40 M56 0 h40" />
            </g>
          </svg>
        ))}
      </span>

      <div
        className={styles.tokens}
        role="group"
        aria-label="Hikers"
        style={{
          left: tokenBar.left,
          bottom: tokenBar.bottom,
          height: tokenBar.height,
          gap: tokenBar.gap,
          padding: `0 ${tokenBar.pad}px`,
        }}
      >
        {hikers.map((h, i) => {
          const out = game.out[h.id] !== undefined;
          const at = game.placed[h.id];
          const chosen = placing && game.selected === h.id;
          return (
            <button
              key={h.id}
              ref={(el) => {
                if (el) tokenRefs.current.set(h.id, el);
                else tokenRefs.current.delete(h.id);
              }}
              type="button"
              className={styles.token}
              data-selected={(chosen && lifted !== h.id) || undefined}
              data-lifted={lifted === h.id || undefined}
              data-out={out || undefined}
              disabled={out || !placing}
              style={{ '--c': h.color, width: tokenBar.width } as CSSProperties}
              aria-pressed={chosen}
              aria-label={`${i + 1}: ${h.name}${out ? ', out' : at !== undefined ? `, behind barrel ${at + 1}` : ''}`}
              onPointerDown={(e) => startPress(h.id, 'token', e)}
              onClick={() => {
                if (!ignoreClick.current) setGame(select(game, h.id));
              }}
            >
              <span className={styles.face} style={{ width: tokenBar.face, height: tokenBar.face }}>
                <HikerPortrait hikerId={h.id} className={styles.portrait} />
                {out && <span className={styles.x} aria-hidden="true" />}
                {!out && at !== undefined && <span className={styles.badge}>{at + 1}</span>}
              </span>
              <span className={styles.tokenName}>{h.name}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={styles.ready}
        style={{
          right: UI.ready.right,
          bottom: UI.ready.bottom,
          width: UI.ready.width,
          height: UI.ready.height,
        }}
        disabled={!placing || !canReady(game)}
        onClick={pressReady}
      >
        READY
      </button>

      {ghost && ghostHiker && (
        <div
          className={styles.ghost}
          data-flying={ghost.flying || undefined}
          style={
            {
              transform: `translate(${ghost.x}px, ${ghost.y}px)`,
              '--c': ghostHiker.color,
              '--fly-ms': `${D.flyBackMs}ms`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <span className={styles.ghostFace}>
            <HikerPortrait hikerId={ghostHiker.id} className={styles.portrait} />
          </span>
        </div>
      )}

      <span className={styles.srOnly}>{stillIn(game).length} still in</span>
    </div>
  );
}
