/**
 * Getting a section's land onto the screen (Phase 10.5, section 8):
 *
 * - In a Web Worker with OffscreenCanvas where there is one; otherwise on the
 *   main thread, behind a short "Drawing the map…" overlay.
 * - Only the current section's land is kept; the previous one's images are
 *   let go when the next section's land is asked for.
 * - If it fails, or takes more than 6 s, that section uses the classic map:
 *   it's logged, and the screen shows a toast.
 * - The time it took is kept for the debug panel.
 *
 * Nothing is saved: the land comes from the run seed, the section and its
 * tiles, so a reload makes the same one.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { MAP_STYLE } from '../../../config/mapStyle';
import { generate, type LandResult } from './generate';
import type { LandInput } from './land/model';

export type LandStatus =
  | { status: 'idle' }
  | { status: 'drawing'; onMain: boolean }
  | { status: 'ready'; result: LandResult }
  | { status: 'failed'; error: string };

export interface LandRequest {
  key: string;
  input: LandInput;
  scale: number;
}

const IDLE: LandStatus = { status: 'idle' };
const statuses = new Map<string, LandStatus>();
const listeners = new Set<() => void>();
let currentKey: string | undefined;
/** Debug: the next request fails on purpose (the fallback test). */
let failNext = false;
/** The last generation's time, for the debug panel. */
let lastTimings: LandResult['timings'] | undefined;

function set(key: string, status: LandStatus) {
  statuses.set(key, status);
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const landStatus = (key: string | undefined): LandStatus =>
  (key && statuses.get(key)) || IDLE;

export const lastLandTimings = () => lastTimings;

export function failNextLand(): void {
  failNext = true;
}

// ── The worker ───────────────────────────────────────────────────────────────

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { resolve(r: LandResult): void; reject(e: Error): void }>();

function workerSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    'transferToImageBitmap' in OffscreenCanvas.prototype
  );
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (!workerSupported()) return (worker = null);
  try {
    worker = new Worker(new URL('./landWorker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as { id: number; ok: boolean; result?: LandResult; error?: string };
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok && msg.result) p.resolve(msg.result);
      else p.reject(new Error(msg.error ?? 'The land worker failed'));
    });
    worker.addEventListener('error', (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'The land worker failed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    });
  } catch {
    worker = null;
  }
  return worker;
}

/** Stops the worker (stuck, or busy with land nobody wants now); a new one starts on the next request. */
function restartWorker(why: string) {
  worker?.terminate();
  worker = undefined;
  for (const p of pending.values()) p.reject(new Error(why));
  pending.clear();
}

/** The request being made right now (one at a time: a newer one replaces it). */
let inFlight: string | undefined;

function viaWorker(w: Worker, req: LandRequest, fail: boolean): Promise<LandResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, key: req.key, input: req.input, scale: req.scale, fail });
  });
}

async function onMain(req: LandRequest, fail: boolean): Promise<LandResult> {
  // Let the "Drawing the map…" overlay show before the work starts.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  if (fail) throw new Error('Asked to fail (debug)');
  const g = await generate(req.key, req.input, req.scale);
  return { ...g.result, painted: g.painted, sketch: g.sketch };
}

function release(status: LandStatus | undefined) {
  if (status?.status !== 'ready') return;
  for (const img of [status.result.painted, status.result.sketch]) {
    if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
  }
}

/** Asks for a section's land; does nothing if it's already ready, drawing or failed. */
export function requestLand(req: LandRequest): void {
  if (statuses.has(req.key)) return;
  // Only the current section's land is kept.
  if (currentKey && currentKey !== req.key) {
    release(statuses.get(currentKey));
    statuses.delete(currentKey);
  }
  currentKey = req.key;
  // One at a time: land for an older request is no longer wanted.
  if (inFlight && inFlight !== req.key) restartWorker('Replaced by newer land');
  inFlight = req.key;
  const fail = failNext;
  failNext = false;
  const w = getWorker();
  set(req.key, { status: 'drawing', onMain: !w });
  const started = performance.now();
  const work = w ? viaWorker(w, req, fail) : onMain(req, fail);
  const giveUp = MAP_STYLE.budget.giveUpSeconds * 1000;
  // The 6 s only count while the page is on screen: a background tab runs slowly on purpose.
  let timer: ReturnType<typeof setInterval> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    let spent = 0;
    let last = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      if (typeof document === 'undefined' || !document.hidden) spent += now - last;
      last = now;
      if (spent < giveUp) return;
      clearInterval(timer);
      reject(new Error(`Took over ${MAP_STYLE.budget.giveUpSeconds} s`));
      if (w) restartWorker('Too slow');
    }, 250);
  });
  Promise.race([work, timeout])
    .then((result) => {
      lastTimings = result.timings;
      const ms = performance.now() - started;
      console.info(
        `Illustrated map: ${ms.toFixed(0)} ms (land ${result.timings.land.toFixed(0)}, features ${result.timings.features.toFixed(0)}, paint ${result.timings.paint.toFixed(0)})${w ? ' in a worker' : ' on the main thread'}.`,
      );
      if (statuses.has(req.key)) set(req.key, { status: 'ready', result });
      else release({ status: 'ready', result });
    })
    .catch((err: unknown) => {
      // Replaced by a newer request: not a failure, nobody is waiting for it.
      if (currentKey !== req.key) return;
      const error = err instanceof Error ? err.message : String(err);
      console.warn(`Illustrated map failed for this section; using the classic map. ${error}`);
      set(req.key, { status: 'failed', error });
    })
    .finally(() => {
      clearInterval(timer);
      if (inFlight === req.key) inFlight = undefined;
    });
}

/** Forgets a land (debug: draw it again). */
export function forgetLand(key: string): void {
  release(statuses.get(key));
  statuses.delete(key);
  if (currentKey === key) currentKey = undefined;
  for (const l of listeners) l();
}

/** A section's land for the screen: asked for when needed, followed as it changes. */
export function useLand(req: LandRequest | null): LandStatus {
  const key = req?.key;
  const status = useSyncExternalStore(
    subscribe,
    () => landStatus(key),
    () => IDLE,
  );
  useEffect(() => {
    if (req) requestLand(req);
    // The request object changes every render; its key says what it asks for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, status.status]);
  return status;
}
