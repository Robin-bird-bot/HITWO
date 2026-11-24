/**
 * Bearrels (docs/design/10-minigames.md, "Bearrels"), played on the party
 * GPS's screen at 1280 × 720.
 *
 * Each round: pick a hiker, then a barrel, until everyone still in is placed,
 * then Ready. The bear pops up, the crosshair sweeps across the barrels and
 * settles on the one it picked, and it fires: anyone behind that barrel is
 * out (a red flash, a shake, the hikers tip over), or "Missed!". With 2
 * shots the second follows on a different barrel. The bear ducks, and the
 * next round starts with everyone where they were. After the last round, or
 * once everyone is out, a results card.
 *
 * Touch, mouse or keyboard (1–4, ← →, Enter or Space). Reduced motion: no
 * shake, a softer flash, and the crosshair jumps straight to its barrel.
 * Sounds are hooks only (./../sound.ts).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../../config/balance';
import {
  barrelLayout,
  canReady,
  endRound,
  fire,
  hitLine,
  keyAction,
  newGame,
  place,
  ready,
  result,
  resultLine,
  select,
  stillIn,
  type BearrelsState,
} from '../../../minigames/bearrels/logic';
import type { MinigameHiker, MinigameResult } from '../../../minigames/types';
import { useReducedMotion } from '../../app/useReducedMotion';
import { HikerPortrait } from '../../hikers/HikerPortrait';
import { playSound } from '../sound';
import { BearrelsScene, type BearPose, type SceneHiker } from './Scene';
import styles from './Bearrels.module.css';

const T = BALANCE.minigames.bearrels.timing;
const B = BALANCE.minigames.bearrels;

const PICK = 'Pick a hiker, then a barrel';
const MOVE = 'Move anyone, then Ready';

export interface BearrelsSettingsProps {
  barrels: number;
  rounds: number;
  shots: number;
}

export function BearrelsGame({
  settings,
  hikers,
  seed,
  onDone,
}: {
  settings: BearrelsSettingsProps;
  hikers: readonly MinigameHiker[];
  seed: number;
  /** Continue on the results card: who was safe and who was hit. */
  onDone(result: MinigameResult): void;
}) {
  const reduced = useReducedMotion();
  const ids = hikers.map((h) => h.id);
  const [round, setRound] = useState(0);
  const [game, setGame] = useState(() => newGame(settings, ids, seed));
  const barrels = barrelLayout(game.settings.barrels);
  const [bear, setBear] = useState<BearPose>('hidden');
  const [cross, setCross] = useState<number | null>(null);
  const [shaking, setShaking] = useState<number | null>(null);
  const [smoke, setSmoke] = useState<number | null>(null);
  /** Hikers tipping over from this shot, and hikers gone from the scene. */
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
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const name = (id: string) => hikers.find((h) => h.id === id)?.name ?? id;
  const sleep = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(alive.current), ms));

  /** The crosshair sweeps left to right, then back, slowing onto its barrel. */
  const sweep = (target: number) =>
    new Promise<boolean>((resolve) => {
      const xs = barrels.map((b) => b.x);
      const to = xs[target] ?? xs[0] ?? 640;
      if (reduced) {
        setCross(to);
        resolve(alive.current);
        return;
      }
      const first = xs[0] ?? to;
      const last = xs.at(-1) ?? to;
      const start = performance.now();
      let prev = first;
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      const step = (now: number) => {
        if (!alive.current) return resolve(false);
        const t = Math.min(1, (now - start) / T.sweepMs);
        const x =
          t < 0.55
            ? first + (last - first) * ease(t / 0.55)
            : last + (to - last) * (1 - (1 - (t - 0.55) / 0.45) ** 3);
        // A tick each time it passes a barrel.
        if (xs.some((c) => (prev - c) * (x - c) < 0)) playSound('tick');
        prev = x;
        setCross(x);
        if (t < 1) requestAnimationFrame(step);
        else resolve(true);
      };
      requestAnimationFrame(step);
    });

  /** The bear's turn: up, aim, fire (once or twice), duck; then the next round or the results. */
  const shoot = async (start: BearrelsState) => {
    setBusy(true);
    setHover(null);
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
        setFlash((n) => n + 1);
        if (!reduced) setShake(true);
        setPrompt({ text: hitLine(shot.hit.map(name)), bad: true });
        playSound('hit');
      } else {
        setSmoke(target);
        setPrompt({ text: 'Missed!' });
        playSound('miss');
      }
      if (!(await sleep(T.fireMs))) return;
      setBear('up');
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
    if (busy || game.phase !== 'placing' || !game.selected) return;
    setGame(place(game, barrel));
    playSound('place');
  };

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

  const playAgain = () => {
    const next = round + 1;
    setRound(next);
    setGame(newGame(settings, ids, seed + next * 7919));
    setBear('hidden');
    setCross(null);
    setTipped([]);
    setGone([]);
    setPrompt({ text: PICK });
    setResults(false);
    setKeys(false);
  };

  const scene: SceneHiker[] = game.hikers
    .filter((id) => game.placed[id] !== undefined && !gone.includes(id))
    .flatMap((id) => {
      const hiker = hikers.find((h) => h.id === id);
      return hiker
        ? [
            {
              hiker,
              barrel: game.placed[id]!,
              state: tipped.includes(id) ? ('hit' as const) : ('in' as const),
            },
          ]
        : [];
    });
  const placing = game.phase === 'placing' && !busy;
  const outline = placing && game.selected ? (hover ?? (keys ? game.highlight : null)) : null;
  const ended = result(game);

  return (
    <div className={styles.game} data-shake={shake || undefined}>
      <BearrelsScene
        barrels={barrels}
        hikers={scene}
        bear={bear}
        crosshair={cross}
        outline={outline}
        shaking={shaking}
        smoke={smoke}
        {...(placing && game.selected ? { onBarrel: placeAt, onHover: setHover } : {})}
      />

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

      <span className={`${styles.pill} ${styles.round}`}>
        ROUND {game.round} / {game.settings.rounds}
      </span>
      <span
        className={`${styles.pill} ${styles.prompt}`}
        data-bad={prompt.bad || undefined}
        role="status"
      >
        {prompt.text}
      </span>
      <span
        className={`${styles.pill} ${styles.shots}`}
        aria-label={`${game.settings.shots} shot${game.settings.shots === 1 ? '' : 's'} a round`}
      >
        {Array.from({ length: game.settings.shots }, (_, i) => (
          <svg key={i} width="26" height="26" viewBox="-100 -100 200 200" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="18" fill="none">
              <circle r="60" />
              <path d="M0 -96 v40 M0 56 v40 M-96 0 h40 M56 0 h40" />
            </g>
          </svg>
        ))}
      </span>

      <div className={styles.tokens} role="group" aria-label="Hikers">
        {hikers.map((h, i) => {
          const out = game.out[h.id] !== undefined;
          const at = game.placed[h.id];
          const chosen = placing && game.selected === h.id;
          return (
            <button
              key={h.id}
              type="button"
              className={styles.token}
              data-selected={chosen || undefined}
              data-out={out || undefined}
              disabled={out || !placing}
              style={{ '--c': h.color } as CSSProperties}
              aria-pressed={chosen}
              aria-label={`${i + 1}: ${h.name}${out ? ', out' : at !== undefined ? `, behind barrel ${at + 1}` : ''}`}
              onClick={() => setGame(select(game, h.id))}
            >
              <span className={styles.face}>
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
        disabled={!placing || !canReady(game)}
        onClick={pressReady}
      >
        READY
      </button>

      {results && (
        <div className={styles.results}>
          <div className={styles.card} role="dialog" aria-label="Results">
            <h3 className={styles.cardTitle}>{resultLine(ended)}</h3>
            {hikers.map((h) => {
              const hit = ended.hit.find((x) => x.hikerId === h.id);
              return (
                <div key={h.id} className={styles.row}>
                  <HikerPortrait
                    hikerId={h.id}
                    className={styles.rowPortrait}
                    style={{ boxShadow: `0 0 0 3px ${h.color}` }}
                  />
                  <span className={styles.rowName}>{h.name}</span>
                  <span className={styles.rowState} data-hit={!!hit || undefined}>
                    {hit ? `Hit in round ${hit.round}` : 'Safe'}
                  </span>
                </div>
              );
            })}
            <div className={styles.cardButtons}>
              <button
                type="button"
                className={styles.continue}
                onClick={() => onDone(ended)}
                autoFocus
              >
                Continue
              </button>
              <button type="button" className={styles.again} onClick={playAgain}>
                Play again
              </button>
            </div>
          </div>
        </div>
      )}
      <span className={styles.srOnly}>{stillIn(game).length} still in</span>
    </div>
  );
}
