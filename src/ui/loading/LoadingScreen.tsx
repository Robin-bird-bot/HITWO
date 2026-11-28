/**
 * The loading screens (35-ui-overhaul.md, section 9): entering the trail
 * after packing, Continue from the title, and a new biome. They load that
 * biome's backdrops, map art and ambience, stay at least [1.5 s] so they
 * don't flash, and leave once everything has loaded after that.
 *
 * Both looks share the TrailMate's GPS greens with faint scanlines, a tip
 * near the top every [3.4 s], a bar of [24] segments filled by the real
 * progress, and "LOADING THE MEADOW" under it.
 * - **The Runner** (the default): a hiker runs across a deep green floor and
 *   hops over trees, rocks, logs and bushes.
 * - **The Node wheel** (the setting): the four node badges circle each other
 *   over a topo map while trail photos fade through on either side.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { audio, sfx } from '../../audio/engine';
import { BALANCE } from '../../config/balance';
import { ASSETS } from '../../config/assets';
import { LOADING_TIPS } from '../../content/loadingTips';
import type { BiomeId } from '../../engine';
import { useLoadingLook } from '../app/lookSettings';
import { useReducedMotion } from '../app/useReducedMotion';
import { BIOME_NAMES } from '../title/describeSave';
import { preloadBiome } from './preload';
import {
  drawSprite,
  FLOOR,
  hopHeight,
  MID,
  obstaclesUp,
  spriteHeight,
  spriteWidth,
  startRunner,
  stepRunner,
} from './runner';
import styles from './LoadingScreen.module.css';

const L = BALANCE.ui.overhaul.loading;
const W = 1600;
const H = 1000;

export function LoadingScreen({ biome, onDone }: { biome: BiomeId; onDone(): void }) {
  const look = useLoadingLook();
  const [progress, setProgress] = useState(0);
  const [tip, setTip] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  // Load, and leave once loaded and the least time has passed.
  useEffect(() => {
    let live = true;
    const shown = new Promise((r) => setTimeout(r, L.minMs));
    const loaded = preloadBiome(biome, (p) => {
      if (live) setProgress(p);
    });
    Promise.all([shown, loaded]).then(() => {
      if (live) doneRef.current();
    });
    return () => {
      live = false;
    };
  }, [biome]);

  // The ambience waits at half while it loads.
  useEffect(() => {
    audio.duck('ambience', 'loading', L.ambience);
    return () => audio.duck('ambience', 'loading', 1);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % LOADING_TIPS.length), L.tipMs);
    return () => clearInterval(t);
  }, []);

  const filled = Math.min(L.segments, Math.floor(progress * L.segments));
  const name = BIOME_NAMES[biome].toUpperCase();

  return (
    <div
      className={styles.screen}
      data-look={look}
      role="status"
      aria-label={`Loading the ${BIOME_NAMES[biome]}`}
    >
      {look === 'runner' ? <Runner /> : <NodeWheel />}
      <div className={styles.scan} aria-hidden="true" />
      <p key={tip} className={styles.tip}>
        TIP · {LOADING_TIPS[tip]?.toUpperCase()}
      </p>
      <div className={styles.bar} aria-hidden="true">
        {Array.from({ length: L.segments }, (_, i) => (
          <i key={i} data-on={i < filled || undefined} />
        ))}
      </div>
      <p className={styles.label}>LOADING THE {name}</p>
    </div>
  );
}

/** The hiker running and hopping, drawn on a canvas each frame. */
function Runner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let state = startRunner();
    let last = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      // The floor, its grass edge, and faint hills.
      ctx.fillStyle = '#52653F';
      ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.fillStyle = MID;
      for (let i = 0; i < W; i += 10) {
        const tall = i % 30 ? 0 : 5;
        ctx.fillRect(i, FLOOR - tall, 5, 5 + tall);
      }
      ctx.fillRect(0, FLOOR + 10, W, 5);
      ctx.fillStyle = 'rgba(29, 41, 24, 0.12)';
      for (let i = 0; i < 5; i++) {
        const bx = i * 360 - 200;
        ctx.beginPath();
        ctx.moveTo(bx, FLOOR);
        ctx.lineTo(bx + 180, FLOOR - 210);
        ctx.lineTo(bx + 360, FLOOR);
        ctx.fill();
      }
      const up = obstaclesUp(state);
      if (up > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, FLOOR);
        ctx.clip();
        for (const o of state.obstacles) {
          drawSprite(ctx, o.kind, o.x - spriteWidth(o.kind) / 2, FLOOR - spriteHeight(o.kind) * up);
        }
        ctx.restore();
      }
      const frame = state.hop >= 0 ? 'jump' : Math.floor(now / 110) % 2 ? 'run1' : 'run2';
      drawSprite(
        ctx,
        frame,
        state.x - spriteWidth('run1') / 2,
        FLOOR - spriteHeight('run1') - hopHeight(state),
        state.dir < 0,
      );
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const step = stepRunner(state, dt);
      state = step.state;
      if (step.jumped) sfx('load.jump', { volume: 0.55 });
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    if (reduced) draw(performance.now());
    else raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  return <canvas ref={canvasRef} className={styles.canvas} width={W} height={H} />;
}

const NODES = ['forest', 'river', 'wildlife', 'mountain'] as const;
const PHOTOS: { node: (typeof NODES)[number]; caption: string }[] = [
  { node: 'forest', caption: 'Blue Pool' },
  { node: 'river', caption: 'Smith Rock' },
  { node: 'wildlife', caption: 'Elk Meadow' },
  { node: 'mountain', caption: 'Cone Peak' },
];

/** The node badges circling over a topo map, with trail photos fading through. */
function NodeWheel() {
  const reduced = useReducedMotion();
  const [photo, setPhoto] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhoto((p) => (p + 1) % PHOTOS.length), L.photoMs);
    return () => clearInterval(t);
  }, []);
  const topo = useMemo(() => `url("data:image/svg+xml;utf8,${encodeURIComponent(topoSvg())}")`, []);
  return (
    <div className={styles.wheel} style={{ backgroundImage: topo }}>
      {PHOTOS.map((p, i) => (
        <figure
          key={p.node}
          className={styles.photo}
          data-on={i === photo || undefined}
          data-side={i % 2 ? 'right' : 'left'}
          data-row={i < 2 ? 'high' : 'low'}
        >
          <span style={{ backgroundImage: `url(${ASSETS.scavenge.backdrops[p.node]})` }} />
          <figcaption>{p.caption}</figcaption>
        </figure>
      ))}
      <div className={styles.orbit} data-still={reduced || undefined}>
        {NODES.map((n, i) => (
          <img
            key={n}
            src={ASSETS.nodes[n]}
            alt=""
            style={{ '--i': i } as CSSProperties}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}

/** Contour rings, the prototype's `topo()`, the same each time. */
function topoSvg(): string {
  let seed = 12;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">';
  for (let k = 0; k < 4; k++) {
    const cx = r() * 800;
    const cy = r() * 500;
    for (let i = 1; i < 9; i++) {
      let d = '';
      for (let a = 0; a <= 6.3; a += 0.3) {
        const rr = i * 28 + Math.sin(a * 3 + k) * 8 + Math.sin(a * 5) * 4;
        d += `${a ? 'L' : 'M'}${(cx + Math.cos(a) * rr * 1.4).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
      }
      s += `<path d="${d}Z" fill="none" stroke="#b9a982" stroke-opacity=".45" stroke-width="1.5"/>`;
    }
  }
  return `${s}</svg>`;
}
