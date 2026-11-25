/**
 * Challenge Passed / Challenge Failed (docs/design/16-challenge-end-screen.md;
 * mockups in docs/mockups/minigames/end-screens/): the end screen every
 * minigame shares, drawn in the 320 × 240 scene over the game's last frame.
 *
 * - **Failing:** red drips run down from the top until the screen is red,
 *   then the end screen wipes in from the top, leaving short dark drips
 *   hanging from its top edge.
 * - **Passing:** a clockwise clock wipe from 12 o'clock, with a thin light
 *   hand, like the scene changes in the old Star Wars movies.
 * - **Then:** the dark green screen, the big title flashing for a moment,
 *   the game and tier, a row per hiker (passed or failed, and what they
 *   pay), a line about the tile for passing challenges, and TAP TO CONTINUE,
 *   which only takes input a moment after the screen is in, so a late tap
 *   from the game doesn't skip it.
 * - **Reduced motion:** a short crossfade, and the title doesn't flash.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import {
  canContinue,
  endPassed,
  endRows,
  endTitle,
  endTransition,
  tileLine,
  titleShown,
  transitionSec,
  type TileThing,
} from '../../minigames/endScreen';
import { g, RED } from '../../minigames/greens';
import type { MinigameHiker, MinigameResult } from '../../minigames/types';
import { useReducedMotion } from '../app/useReducedMotion';
import { HikerToken } from './HikerToken';
import { PixelScreen } from './PixelScreen';
import styles from './EndScreen.module.css';

const E = BALANCE.minigames.endScreen;
const DARK_RED = '#8E2A24';

interface Drip {
  x: number;
  w: number;
  start: number;
  sec: number;
  /** The short drip left hanging from the end screen's top edge (0: none). */
  hang: number;
}

/** The drips, from the seed: side by side across the whole width, each with its own timing. */
function makeDrips(seed: number): Drip[] {
  const rng = seedRng(seed ^ 0x5eed);
  const span = (a: readonly [number, number]) => a[0] + nextFloat(rng) * (a[1] - a[0]);
  const out: Drip[] = [];
  for (let x = 0; x < 320;) {
    const w = Math.round(span(E.drips.width));
    const start = span(E.drips.startSec);
    // Each one reaches the bottom between 70% and all of the cover time.
    const end = E.drips.coverSec * (0.7 + 0.3 * nextFloat(rng));
    const hang = nextFloat(rng) < E.drips.hangShare ? Math.round(span(E.drips.hang)) : 0;
    out.push({ x, w, start, sec: Math.max(0.1, end - start), hang });
    x += w;
  }
  return out;
}

export function EndScreen({
  result,
  hikers,
  subtitle,
  thing,
  seed,
  onContinue,
}: {
  result: MinigameResult;
  /** In line order. */
  hikers: readonly MinigameHiker[];
  /** "CHOP TREE · TIER II". */
  subtitle: string;
  /** What stands on the tile, for passing challenges ("THE BEAR STAYS ON THE TILE"). */
  thing: TileThing;
  seed: number;
  onContinue(): void;
}) {
  const reduced = useReducedMotion();
  const passed = endPassed(result);
  const drips = useMemo(() => makeDrips(seed), [seed]);
  const tr = endTransition(result, reduced);
  const inSec = transitionSec(tr);
  const doneSec = inSec + Math.max(E.flash.forSec, E.inputAfterSec);

  // The clock: seconds since the game ended, until everything has played.
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let frame = requestAnimationFrame(function loop(now) {
      const sec = (now - t0) / 1000;
      setT(sec);
      if (sec < doneSec) frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [doneSec]);

  const ready = canContinue(t, tr);
  const left = useRef(false);
  const go = () => {
    if (!ready || left.current) return;
    left.current = true;
    onContinue();
  };
  // Space or Enter continues too.
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (left.current) return;
      left.current = true;
      onContinue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, onContinue]);

  const titleOn = titleShown(t, tr);

  // How the screen comes in.
  let screenStyle: CSSProperties;
  if (tr === 'fade') {
    screenStyle = { opacity: Math.min(1, t / E.fadeSec) };
  } else if (tr === 'wipe') {
    const turn = Math.min(1, t / E.wipeSec) * 360;
    const mask = `conic-gradient(from 0deg at 50% 50%, #000 ${turn}deg, transparent ${turn}deg)`;
    screenStyle = turn >= 360 ? {} : { maskImage: mask, WebkitMaskImage: mask };
  } else {
    const wipe = Math.max(0, Math.min(1, (t - E.drips.coverSec) / E.drips.wipeSec));
    screenStyle = wipe >= 1 ? {} : { clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)` };
  }
  const wiping = tr === 'wipe' && t < E.wipeSec;
  const dripping = tr === 'drips' && t < inSec;

  const rows = endRows(
    result,
    hikers.map((h) => h.id),
  );
  const tile = tileLine(result, thing);
  const rowsTop = E.rowsTop;
  const lastRow = rowsTop + (rows.length - 1) * E.rowGap;
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

  return (
    <PixelScreen transparent className={styles.overlay}>
      <div
        className={styles.hit}
        onPointerDown={go}
        role="button"
        tabIndex={-1}
        aria-label={ready ? 'Tap to continue' : undefined}
      >
        {/* Failing: the drips running down over the game. */}
        {dripping && (
          <span className={styles.drips} aria-hidden="true">
            {drips.map((d, k) => {
              const u = Math.max(0, Math.min(1, (t - d.start) / d.sec));
              const h = (240 + d.w) * u * u;
              return h > 0 ? (
                <span
                  key={k}
                  className={styles.drip}
                  style={{ left: d.x, width: d.w + 0.5, height: h, background: RED }}
                />
              ) : null;
            })}
          </span>
        )}

        {/* The end screen. */}
        <div
          className={styles.screen}
          style={{ ...screenStyle, background: g(1) }}
          role="status"
          aria-label={endTitle(result)}
        >
          {tr === 'drips' && (
            <span className={styles.hanging} aria-hidden="true">
              {drips.map((d, k) =>
                d.hang ? (
                  <span
                    key={k}
                    className={styles.drip}
                    style={{ left: d.x, width: d.w, height: d.hang, background: DARK_RED }}
                  />
                ) : null,
              )}
            </span>
          )}
          <p
            className={styles.title}
            style={{
              top: E.titleY,
              fontSize: E.titleSize,
              color: passed ? g(9) : RED,
              textShadow: `1.5px 1.5px 0 ${g(0)}`,
              visibility: titleOn ? 'visible' : 'hidden',
            }}
          >
            {endTitle(result)}
          </p>
          <p className={styles.subtitle} style={{ top: E.titleY + 22, color: g(7) }}>
            {subtitle}
          </p>
          {rows.map((r, k) => {
            const h = byId(r.id);
            return (
              <span key={r.id} className={styles.row} style={{ top: rowsTop + k * E.rowGap }}>
                <HikerToken hiker={h} size={13} className={styles.token} />
                <span className={styles.name} style={{ color: g(9) }}>
                  {h.name.toUpperCase()}
                </span>
                <span className={styles.state} style={{ color: r.passed ? g(9) : RED }}>
                  {r.passed ? 'PASSED' : 'FAILED'}
                </span>
                {r.cost && (
                  <span className={styles.cost} style={{ color: g(7) }}>
                    {r.cost}
                  </span>
                )}
              </span>
            );
          })}
          {tile && (
            <p
              className={styles.line}
              style={{ top: Math.max(E.tileY, lastRow + 20), color: g(7) }}
            >
              {tile}
            </p>
          )}
          <p className={styles.line} style={{ top: E.tapY, color: g(6), opacity: ready ? 1 : 0 }}>
            TAP TO CONTINUE
          </p>
        </div>

        {/* Passing: the clock wipe's hand. */}
        {wiping && (
          <span
            className={styles.hand}
            style={{
              background: g(9),
              transform: `rotate(${Math.min(1, t / E.wipeSec) * 360}deg)`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </PixelScreen>
  );
}
