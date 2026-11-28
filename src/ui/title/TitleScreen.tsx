/**
 * The title screen (35-ui-overhaul.md, section 8; the prototype's `#title`):
 * a sunset forest from the backdrop layers, each drifting a little with the
 * pointer, a slowly turning sunburst and falling leaves. Wyatt's mint
 * lettering, grown over (logo 4), drops in with a thunk and a puff of
 * leaves. New Hike, Continue (with the saved hike's day, biome and party)
 * and Settings.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { sfx } from '../../audio/engine';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { useReducedMotion } from '../app/useReducedMotion';
import { SettingsWindow } from '../panels/TopBar';
import styles from './TitleScreen.module.css';

const T = BALANCE.ui.overhaul.title;

/** Back to front: the backdrop layers and how far down each sits (stage px). */
const LAYERS = [
  { src: ASSETS.land.blueMountains, top: 66, opacity: 0.85 },
  { src: ASSETS.land.greenRidge, top: 166, opacity: 1 },
  { src: ASSETS.land.pineForest, top: 266, opacity: 1 },
  { src: ASSETS.land.pineRow, top: 366, opacity: 1 },
];
const LEAF_COLORS = ['#d9a13a', '#c4622a', '#8aa64a', '#b8432c'];

/** A steady scatter (the same each time), 0–1. */
const scatter = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const LEAVES = Array.from({ length: T.leaves }, (_, i) => ({
  left: scatter(i, 1) * 1600,
  color: LEAF_COLORS[i % LEAF_COLORS.length]!,
  duration: 9 + scatter(i, 2) * 7,
  delay: -scatter(i, 3) * 16,
}));

const PUFF = Array.from({ length: 30 }, (_, i) => {
  const angle = Math.PI + scatter(i, 4) * Math.PI;
  const far = 80 + scatter(i, 5) * 200;
  return {
    dx: Math.cos(angle) * far,
    dy: Math.sin(angle) * far * 0.6,
    spin: (scatter(i, 6) - 0.5) * 540,
    color: LEAF_COLORS[i % LEAF_COLORS.length]!,
  };
});

interface TitleScreenProps {
  /** A line describing the saved hike ("Day 3 · Afternoon · Meadow · 4 hikers"), or null when there's none. */
  saved: string | null;
  /** A gentle note when a saved hike couldn't be read. */
  notice?: string | null;
  onContinue(): void;
  onNewHike(): void;
  /** The Minigame testing tab (Phase 10.8): always shown for now. */
  onMinigames?(): void;
  /** Dev only: a picker for a hike with test hikers (Phase 10a). */
  testPicker?: ReactNode;
}

export function TitleScreen({
  saved,
  notice,
  onContinue,
  onNewHike,
  onMinigames,
  testPicker,
}: TitleScreenProps) {
  const reduced = useReducedMotion();
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const [settings, setSettings] = useState(false);
  // The logo drops in a moment after the screen opens, with a thunk and a puff of leaves.
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    const t = setTimeout(
      () => {
        setDropped(true);
        sfx('title.logo');
      },
      reduced ? 0 : T.logoMs,
    );
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <main
      className={styles.scene}
      onPointerMove={(e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        setDrift({
          x: (e.clientX - r.left) / r.width - 0.5,
          y: (e.clientY - r.top) / r.height - 0.5,
        });
      }}
    >
      <div className={styles.rays} aria-hidden="true" />
      <div className={styles.sun} aria-hidden="true" />
      {LAYERS.map((l, i) => {
        const d = T.drift[i] ?? 0;
        return (
          <div
            key={l.src}
            className={styles.layer}
            aria-hidden="true"
            style={{
              top: l.top,
              opacity: l.opacity,
              backgroundImage: `url(${l.src})`,
              transform: `translate(${-drift.x * d}px, ${-drift.y * d * 0.4}px)`,
            }}
          />
        );
      })}
      <div
        className={styles.texture}
        style={{ backgroundImage: `url(${ASSETS.textures.halftone})` }}
        aria-hidden="true"
      />
      {!reduced &&
        LEAVES.map((l, i) => (
          <i
            key={i}
            className={styles.leaf}
            aria-hidden="true"
            style={{
              left: l.left,
              background: l.color,
              animationDuration: `${l.duration}s`,
              animationDelay: `${l.delay}s`,
            }}
          />
        ))}

      <h1 className={styles.logoWrap}>
        <img
          className={styles.logo}
          data-dropped={dropped || undefined}
          src={ASSETS.ui.logo}
          alt="Hike in the Woods Online!"
          draggable={false}
        />
        {dropped && !reduced && (
          <span className={styles.puff} aria-hidden="true">
            {PUFF.map((p, i) => (
              <i
                key={i}
                style={
                  {
                    background: p.color,
                    '--dx': `${p.dx}px`,
                    '--dy': `${p.dy}px`,
                    '--spin': `${p.spin}deg`,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        )}
      </h1>

      <nav className={styles.buttons} aria-label="Title">
        <button
          type="button"
          className={`${styles.button} ${styles.go}`}
          onClick={onNewHike}
          autoFocus={!saved}
          data-sound="title.start"
        >
          NEW HIKE
        </button>
        {saved && (
          <button
            type="button"
            className={styles.button}
            onClick={onContinue}
            autoFocus
            data-sound="title.start"
          >
            CONTINUE
            <small>{saved}</small>
          </button>
        )}
        <button type="button" className={styles.button} onClick={() => setSettings(true)}>
          SETTINGS
        </button>
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </nav>

      {(onMinigames || testPicker) && (
        <div className={styles.dev}>
          {onMinigames && (
            <button type="button" className={styles.plain} onClick={onMinigames}>
              Minigame testing
            </button>
          )}
          {testPicker && (
            <details className={styles.testPicker}>
              <summary>Test hike (dev only)</summary>
              {testPicker}
            </details>
          )}
        </div>
      )}

      <p className={styles.build}>
        BUILD {__BUILD_DATE__} {__BUILD_SHA__}
      </p>
      {settings && <SettingsWindow onClose={() => setSettings(false)} />}
    </main>
  );
}
