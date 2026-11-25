/**
 * Bearrels' preview on the upright GPS in the pop-up (docs/design/10-minigames.md,
 * "The party GPS": Preview). A short demo loops about every 6 s and can't be
 * played: a ghost finger drags a hiker to a barrel, the bear pops up, the
 * crosshair sweeps and it fires, a hit one time and a miss the next.
 *
 * It's the 4:3 scene with 4 barrels, cropped to the middle by the tall
 * screen, so the demo uses the two middle barrels. Drawn in the current art style.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../../config/balance';
import { emptyScene, type SceneModel } from '../../../minigames/bearrels/scene';
import { GAME, hikerCenters, type ArtStyle } from '../../../minigames/bearrels/styles';
import type { MinigameHiker } from '../../../minigames/types';
import { useReducedMotion } from '../../app/useReducedMotion';
import { HikerPortrait } from '../../hikers/HikerPortrait';
import { BearrelsScene } from './Scene';
import styles from './Bearrels.module.css';

const T = BALANCE.minigames.bearrels.timing;
const B = BALANCE.minigames.bearrels;
const LOOP_MS = BALANCE.minigames.gps.previewLoopMs;

/** The demo's barrels: the middle two show on the tall screen. */
const BARRELS = 4;
/** The bear always shoots the second barrel: the hiker hides there one loop (hit), next door the next (miss). */
const SHOT = 1;
/** The visible middle of the 1280-wide scene on a 3:4 screen. */
const CROP = { left: (GAME.width - (GAME.height * 3) / 4) / 2, width: (GAME.height * 3) / 4 };

export function BearrelsPreview({
  style,
  hikers,
}: {
  style: ArtStyle;
  hikers: readonly MinigameHiker[];
}) {
  const reduced = useReducedMotion();
  const hiker = hikers[0];
  const [scene, setScene] = useState<SceneModel>(() => emptyScene(BARRELS));
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(alive), ms));
    const animate = (ms: number, step: (t: number) => void) =>
      new Promise<boolean>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          if (!alive) return resolve(false);
          const t = Math.min(1, (now - start) / ms);
          step(t);
          if (t < 1) requestAnimationFrame(tick);
          else resolve(true);
        };
        requestAnimationFrame(tick);
      });
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

    const run = async () => {
      for (let loop = 0; alive; loop++) {
        const started = performance.now();
        if (!(await sleep(50))) return;
        setScene(emptyScene(BARRELS));
        setFinger(null);
        if (!(await sleep(400))) return;
        const target = loop % 2 === 0 ? SHOT : SHOT + 1;
        if (hiker) {
          // The ghost finger drags the hiker from the bottom up to the barrel, in an arc.
          const from = { x: GAME.width / 2, y: GAME.height - 70 };
          const to = hikerCenters(style, BARRELS, target, 1)[0] ?? from;
          const dragged = await animate(reduced ? 1 : 900, (t) => {
            const e = ease(t);
            setFinger({
              x: from.x + (to.x - from.x) * e,
              y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * e) * 120,
            });
          });
          if (!dragged) return;
          setFinger(null);
          setScene((s) => ({
            ...s,
            hikers: [{ hiker, barrel: target, state: 'in' }],
            arriving: { id: hiker.id, ...to },
          }));
          if (!(await sleep(40))) return;
          setScene((s) => ({ ...s, arriving: null }));
        }
        if (!(await sleep(500))) return;
        setScene((s) => ({ ...s, bear: 'up' }));
        if (!(await sleep(T.bearUpMs))) return;
        // The crosshair sweeps across the two barrels in view and settles.
        if (reduced) setScene((s) => ({ ...s, crosshair: SHOT }));
        else {
          const swept = await animate(T.sweepMs, (t) => {
            const at =
              t < 0.55 ? SHOT + ease(t / 0.55) : SHOT + 1 - (1 - (1 - (t - 0.55) / 0.45) ** 3);
            setScene((s) => ({ ...s, crosshair: at }));
          });
          if (!swept) return;
        }
        if (!(await sleep(T.holdMs))) return;
        const hit = !!hiker && target === SHOT;
        setScene((s) => ({
          ...s,
          bear: 'fire',
          ...(hit
            ? { shaking: SHOT, hikers: s.hikers.map((h) => ({ ...h, state: 'hit' as const })) }
            : { smoke: SHOT }),
        }));
        if (hit) {
          setFlash((f) => f + 1);
          if (!reduced) setShake(true);
        }
        if (!(await sleep(T.muzzleMs))) return;
        setScene((s) => ({ ...s, bear: 'up' }));
        if (!(await sleep(Math.max(0, T.fireMs - T.muzzleMs)))) return;
        setShake(false);
        setScene((s) => ({ ...s, shaking: null, smoke: null }));
        if (!(await sleep(500))) return;
        setScene((s) => ({
          ...s,
          bear: 'hidden',
          crosshair: null,
          hikers: s.hikers.filter((h) => h.state !== 'hit'),
        }));
        if (!(await sleep(Math.max(T.duckMs, LOOP_MS - (performance.now() - started))))) return;
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [style, hiker, reduced]);

  return (
    <div className={styles.preview} data-shake={shake || undefined} aria-hidden="true">
      <div className={styles.scene}>
        <BearrelsScene style={style} model={scene} />
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
        />
      )}
      {finger && hiker && (
        <div
          className={styles.ghost}
          style={
            {
              transform: `translate(${finger.x}px, ${finger.y}px)`,
              '--c': hiker.color,
            } as CSSProperties
          }
        >
          <span className={styles.ghostFace}>
            <HikerPortrait hikerId={hiker.id} className={styles.portrait} />
          </span>
          <span className={styles.finger} />
        </div>
      )}
      <span className={`${styles.pill} ${styles.previewPill}`} style={{ left: CROP.left + 22 }}>
        ▶ PREVIEW
      </span>
      <span
        className={`${styles.pill} ${styles.previewHint}`}
        style={{ left: CROP.left + CROP.width / 2 }}
      >
        Watch, then press Start
      </span>
    </div>
  );
}
