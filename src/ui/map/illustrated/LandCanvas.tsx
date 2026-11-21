/**
 * The illustrated map's land on screen (Phase 10.5, sections 6 and 9): one
 * canvas in world space, under the paths and tiles, so it pans and zooms
 * with them.
 *
 * - The paint spreads from each revealed tile over the pencil sketch. A new
 *   reveal grows over 1.2 s (ease-out), several at once, redrawing only the
 *   part of the mask that changed; under reduced motion it just appears. On
 *   load the mask is rebuilt with no animation.
 * - Night, rain, storm, snow and heatwave are grades on the land, and the
 *   route view fades it.
 * - WebGL2 does the mixing and grading; without it, Canvas2D mixes the two
 *   images (no grades).
 */
import { useEffect, useRef } from 'react';
import { MAP_STYLE } from '../../../config/mapStyle';
import type { Section } from '../../../engine';
import type { MapGeometry } from './geometry';
import type { LandResult } from './generate';
import { createLandGl, type Grade, type LandGl } from './landGl';
import {
  easeOut,
  maskGrid,
  paintMask,
  revealedTiles,
  spotBox,
  type MaskGrid,
  type RevealSpot,
} from './land/mask';
import styles from './Illustrated.module.css';

export interface LandDebug {
  /** Paint everything, or nothing (to see the sketch). */
  reveal?: 'all' | 'none';
  /** Play a tile's reveal again (the time asks for it once). */
  replay?: { tileId: string; at: number };
  view?: 'land' | 'mask';
}

interface LandCanvasProps {
  result: LandResult;
  section: Section;
  geo: MapGeometry;
  runSeed: number;
  sectionIndex: number;
  grade: Omit<Grade, 'time'>;
  reduceMotion: boolean;
  debug?: LandDebug;
  /** The mask changed: how much paint shows at a world point, 0–1. */
  onMask?(paintAt: (x: number, y: number) => number): void;
}

const GROW_MS = MAP_STYLE.reveal.growSeconds * 1000;

export function LandCanvas({
  result,
  section,
  geo,
  runSeed,
  sectionIndex,
  grade,
  reduceMotion,
  debug,
  onMask,
}: LandCanvasProps) {
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const flatCanvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ grade, debug, onMask, reduceMotion });
  const engine = useRef<{
    gl: LandGl | null;
    mask: MaskGrid;
    spots: Map<string, RevealSpot>;
    growth: Record<string, number>;
    starts: Record<string, number>;
    frame: number;
    draw(): void;
  } | null>(null);

  useEffect(() => {
    live.current = { grade, debug, onMask, reduceMotion };
  });

  const spotFor = (id: string): RevealSpot | undefined => {
    const t = section.tiles[id];
    const c = geo.centers[id];
    return t && c ? { id, x: c.x, y: c.y, trailhead: t.kind === 'trailhead' } : undefined;
  };
  const wantedFor = (d: LandDebug['reveal']): string[] => {
    if (d === 'none') return [];
    if (d === 'all') return Object.keys(section.tiles).sort();
    return revealedTiles(section);
  };
  const wanted = () => wantedFor(live.current.debug?.reveal);
  const wantedKey = wantedFor(debug?.reveal).join(',');

  // A new land: new textures and a mask rebuilt as it stands, with no animation.
  useEffect(() => {
    const W = Math.round(result.width * result.scale);
    const H = Math.round(result.height * result.scale);
    const mask = maskGrid(result, runSeed, sectionIndex);
    const spots = new Map<string, RevealSpot>();
    for (const id of wanted()) {
      const s = spotFor(id);
      if (s) spots.set(id, s);
    }
    paintMask(mask, [...spots.values()]);
    let gl: LandGl | null = null;
    const glc = glCanvas.current;
    if (glc) {
      glc.width = W;
      glc.height = H;
      try {
        gl = createLandGl(
          glc,
          result.painted as TexImageSource,
          result.sketch as TexImageSource,
          mask,
          result,
        );
      } catch (err) {
        console.warn('Illustrated map: no WebGL2, drawing without grades.', err);
        gl = null;
      }
    }
    const flat = flatCanvas.current;
    if (!gl && flat) {
      flat.width = W;
      flat.height = H;
    }
    const drawFlat = () => {
      const ctx = flat?.getContext('2d');
      if (!ctx || !flat) return;
      ctx.drawImage(result.sketch, 0, 0, W, H);
      const temp = document.createElement('canvas');
      temp.width = W;
      temp.height = H;
      const t = temp.getContext('2d');
      if (!t) return;
      t.drawImage(result.painted, 0, 0, W, H);
      const m = document.createElement('canvas');
      m.width = mask.w;
      m.height = mask.h;
      const mc = m.getContext('2d');
      if (!mc) return;
      const img = mc.createImageData(mask.w, mask.h);
      for (let i = 0; i < mask.alpha.length; i++) img.data[i * 4 + 3] = mask.alpha[i]!;
      mc.putImageData(img, 0, 0);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(m, 0, 0, mask.w * mask.cell * result.scale, mask.h * mask.cell * result.scale);
      ctx.drawImage(temp, 0, 0);
    };
    const e = {
      gl,
      mask,
      spots,
      growth: {} as Record<string, number>,
      starts: {} as Record<string, number>,
      frame: 0,
      draw() {
        const { grade: g, debug: d } = live.current;
        if (gl)
          gl.render({ ...g, time: performance.now() / 1000 }, d?.view === 'mask' ? 'mask' : 'land');
        else drawFlat();
      },
    };
    gl?.uploadMask(mask.alpha, mask.w, { x0: 0, y0: 0, x1: mask.w - 1, y1: mask.h - 1 });
    engine.current = e;
    e.draw();
    live.current.onMask?.((x, y) => paintAt(mask, x, y));
    return () => {
      cancelAnimationFrame(e.frame);
      gl?.dispose();
      engine.current = null;
    };
    // A new land (or style) starts over; the reveals below follow the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // New reveals: their discs grow in (or just appear under reduced motion).
  const replayAt = debug?.replay?.at;
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const ids = wanted();
    const now = performance.now();
    const grow: string[] = [];
    const replay = live.current.debug?.replay;
    for (const id of ids) {
      if (!e.spots.has(id) || (replay && replay.tileId === id && e.starts[id] !== replay.at)) {
        const s = spotFor(id);
        if (!s) continue;
        e.spots.set(id, s);
        grow.push(id);
        if (replay?.tileId === id) e.starts[id] = replay.at;
      }
    }
    // Taken away (the debug panel's "hide all"): repaint without them.
    let removed = false;
    for (const id of [...e.spots.keys()]) {
      if (!ids.includes(id)) {
        e.spots.delete(id);
        removed = true;
      }
    }
    const all = () => [...e.spots.values()];
    const full = { x0: 0, y0: 0, x1: e.mask.w - 1, y1: e.mask.h - 1 };
    const finish = () => {
      e.gl?.uploadMask(e.mask.alpha, e.mask.w, full);
      e.draw();
      live.current.onMask?.((x, y) => paintAt(e.mask, x, y));
    };
    if (removed) {
      paintMask(e.mask, all(), e.growth);
      finish();
    }
    if (!grow.length) return;
    if (live.current.reduceMotion) {
      for (const id of grow) e.growth[id] = 1;
      paintMask(e.mask, all(), e.growth);
      finish();
      return;
    }
    const began = Object.fromEntries(grow.map((id) => [id, now]));
    for (const id of grow) e.growth[id] = 0;
    const box = grow
      .map((id) => spotBox(e.mask, e.spots.get(id)!))
      .reduce((a, b) => ({
        x0: Math.min(a.x0, b.x0),
        y0: Math.min(a.y0, b.y0),
        x1: Math.max(a.x1, b.x1),
        y1: Math.max(a.y1, b.y1),
      }));
    cancelAnimationFrame(e.frame);
    const step = () => {
      const t = performance.now();
      let done = true;
      for (const id of grow) {
        const k = easeOut((t - (began[id] ?? t)) / GROW_MS);
        e.growth[id] = k;
        if (k < 1) done = false;
      }
      paintMask(e.mask, all(), e.growth, box);
      e.gl?.uploadMask(e.mask.alpha, e.mask.w, box);
      e.draw();
      // Names fade in as the paint reaches them, not after it has finished.
      live.current.onMask?.((x, y) => paintAt(e.mask, x, y));
      if (done) return;
      e.frame = requestAnimationFrame(step);
    };
    e.frame = requestAnimationFrame(step);
    // It follows the set of revealed tiles (and a replay), not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, replayAt, result]);

  // Grades and views: redraw; rain keeps moving unless motion is reduced.
  const gradeKey = JSON.stringify([grade, debug?.view]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.draw();
    if (!(grade.rain > 0) || reduceMotion || !e.gl) return;
    let frame = 0;
    let last = 0;
    const tick = (t: number) => {
      // About 30 frames a second is plenty for drifting rain.
      if (t - last > 33) {
        last = t;
        e.draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeKey, reduceMotion, result]);

  const style = {
    left: result.x0,
    top: result.y0,
    width: result.width,
    height: result.height,
  };
  return (
    <>
      <canvas ref={glCanvas} className={styles.land} style={style} aria-hidden="true" />
      <canvas ref={flatCanvas} className={styles.land} style={style} aria-hidden="true" />
    </>
  );
}

function paintAt(mask: MaskGrid, x: number, y: number): number {
  const gx = Math.round((x - mask.x0) / mask.cell);
  const gy = Math.round((y - mask.y0) / mask.cell);
  if (gx < 0 || gy < 0 || gx >= mask.w || gy >= mask.h) return 0;
  return mask.alpha[gy * mask.w + gx]! / 255;
}
