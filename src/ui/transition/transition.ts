/**
 * The spotlight (35-ui-overhaul.md, section 10): every full-screen change
 * closes the screen to a circle around the click (or the thing that
 * matters), holds, closes to black, makes the change, then opens from the
 * middle of the next screen (or the thing that matters there). Checking in
 * at a station opens onto its doors, which then swing open. Reduced motion:
 * a short fade instead.
 *
 * One overlay (`Spotlight.tsx`) draws it; this runs it. Points are window
 * pixels; `stageToClient` turns a stage point (a tile's middle) into one.
 */
import { sfx } from '../../audio/engine';
import { BALANCE } from '../../config/balance';
import { STAGE_WIDTH } from '../stage/fitStage';

const S = BALANCE.ui.overhaul.spotlight;

export interface Point {
  x: number;
  y: number;
}

export interface SpotlightRequest {
  /** Where it closes (window px): the last click when left out, else the middle. */
  from?: Point | null;
  /** The change, made while the screen is black. It may wait (the next screen loading). */
  change(): void | Promise<void>;
  /** Where it opens on the next screen, asked after the change: the middle when left out. */
  to?: () => Point | null;
  /** Checking in: it opens onto the station's doors, which then swing open. */
  doors?: { sign: string };
}

export type SpotStep =
  | { kind: 'iris'; r0: number; r1: number; ms: number; ease: 'in' | 'out'; sound?: string }
  | { kind: 'fade'; to: 0 | 1; ms: number }
  | { kind: 'wait'; ms: number }
  | { kind: 'change' }
  | { kind: 'doors'; waitMs: number; ms: number; sound: string };

/** The steps of one spotlight, `cover` being a radius that shows the whole screen. */
export function spotlightSteps({
  cover,
  reduced = false,
  doors = false,
}: {
  cover: number;
  reduced?: boolean;
  doors?: boolean;
}): SpotStep[] {
  if (reduced) {
    return [
      { kind: 'fade', to: 1, ms: S.fadeMs },
      { kind: 'change' },
      { kind: 'fade', to: 0, ms: S.fadeMs },
    ];
  }
  return [
    { kind: 'iris', r0: cover, r1: S.minR, ms: S.closeMs, ease: 'in', sound: 'trans.irisIn' },
    { kind: 'wait', ms: S.holdMs },
    { kind: 'iris', r0: S.minR, r1: 0, ms: S.blackMs, ease: 'in' },
    { kind: 'change' },
    { kind: 'wait', ms: S.gapMs },
    { kind: 'iris', r0: 0, r1: cover, ms: S.openMs, ease: 'out', sound: 'trans.irisOut' },
    ...(doors
      ? [{ kind: 'doors' as const, waitMs: S.doorWaitMs, ms: S.doorMs, sound: 'trans.door' }]
      : []),
  ];
}

/** How long a spotlight takes, change aside (ms). */
export const spotlightMs = (steps: readonly SpotStep[]): number =>
  steps.reduce(
    (n, s) => n + (s.kind === 'change' ? 0 : s.kind === 'doors' ? s.waitMs + s.ms : s.ms),
    0,
  );

/** A radius from this point that reaches every corner of a w × h screen. */
export function coverRadius(p: Point, w: number, h: number): number {
  const dx = Math.max(p.x, w - p.x);
  const dy = Math.max(p.y, h - p.y);
  return Math.ceil(Math.hypot(dx, dy)) + 2;
}

export const ease = {
  in: (t: number) => t * t * t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
};

/** What the overlay draws. */
export interface SpotlightView {
  active: boolean;
  /** The circle's middle and radius (window px), or a fade's darkness (0–1). */
  x: number;
  y: number;
  r: number;
  fade: number | null;
  doors: { sign: string; open: boolean; rect: DOMRect | null } | null;
}

const IDLE: SpotlightView = { active: false, x: 0, y: 0, r: 0, fade: null, doors: null };
let view = IDLE;
const listeners = new Set<() => void>();
const set = (next: Partial<SpotlightView>) => {
  view = { ...view, ...next };
  listeners.forEach((l) => l());
};

export const spotlightView = {
  get: () => view,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** The stage's box on the window. */
function stageRect(): DOMRect | null {
  return document.querySelector('[data-stage]')?.getBoundingClientRect() ?? null;
}

/** A stage point (1600 × 1000) on the window. */
export function stageToClient(p: Point): Point {
  const rect = stageRect();
  if (!rect) return p;
  const scale = rect.width / STAGE_WIDTH;
  return { x: rect.left + p.x * scale, y: rect.top + p.y * scale };
}

const middle = (): Point => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

// The last click, so a change can close around it.
let lastClick: { p: Point; at: number } | null = null;
const CLICK_FRESH_MS = 1500;

/** Starts noting clicks (once). */
export function noteClicks(): () => void {
  const onDown = (e: PointerEvent) => {
    lastClick = { p: { x: e.clientX, y: e.clientY }, at: performance.now() };
  };
  window.addEventListener('pointerdown', onDown, true);
  return () => window.removeEventListener('pointerdown', onDown, true);
}

const recentClick = (): Point | null =>
  lastClick && performance.now() - lastClick.at < CLICK_FRESH_MS ? lastClick.p : null;

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** Animates a value; finishes on time even where frames don't come (a hidden tab). */
function tween(ms: number, onFrame: (t: number) => void): Promise<void> {
  return new Promise((done) => {
    const start = performance.now();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onFrame(1);
      done();
    };
    const frame = (now: number) => {
      if (finished) return;
      const t = Math.min(1, (now - start) / ms);
      if (t >= 1) finish();
      else {
        onFrame(t);
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
    setTimeout(finish, ms + 40);
  });
}

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

async function run(req: SpotlightRequest): Promise<void> {
  const from = req.from ?? recentClick() ?? middle();
  const cover = (p: Point) => coverRadius(p, window.innerWidth, window.innerHeight);
  const reduced = reducedMotion();
  const steps = spotlightSteps({ cover: cover(from), reduced, doors: !!req.doors });
  set({ active: true, x: from.x, y: from.y, r: cover(from), fade: reduced ? 0 : null });
  try {
    for (const step of steps) {
      if (step.kind === 'wait') await wait(step.ms);
      else if (step.kind === 'iris') {
        if (step.sound) sfx(step.sound);
        // Opening: from the middle of the next screen, or the thing that matters there.
        const r1 = step.ease === 'out' ? cover(view) : step.r1;
        await tween(step.ms, (t) => set({ r: step.r0 + (r1 - step.r0) * ease[step.ease](t) }));
      } else if (step.kind === 'fade') {
        const from0 = view.fade ?? 0;
        await tween(step.ms, (t) => set({ fade: from0 + (step.to - from0) * t }));
      } else if (step.kind === 'change') {
        await req.change();
        // Let the next screen draw before asking where its thing is.
        await wait(30);
        const to = req.to?.() ?? middle();
        set({
          x: to.x,
          y: to.y,
          ...(req.doors && !reduced
            ? { doors: { sign: req.doors.sign, open: false, rect: stageRect() } }
            : {}),
        });
      } else if (step.kind === 'doors') {
        await wait(step.waitMs);
        sfx(step.sound);
        set({ doors: view.doors && { ...view.doors, open: true } });
        await wait(step.ms);
      }
    }
  } finally {
    set(IDLE);
  }
}

let queue: Promise<void> = Promise.resolve();
let running = 0;

/** Runs a spotlight (one after another when asked again while one runs). */
export function spotlight(req: SpotlightRequest): Promise<void> {
  running += 1;
  queue = queue
    .then(() => run(req))
    .finally(() => {
      running -= 1;
    });
  return queue;
}

/** Is a spotlight running (or waiting)? */
export const spotlightBusy = () => running > 0;
