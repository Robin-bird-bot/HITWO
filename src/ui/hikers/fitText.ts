/**
 * Text that shrinks to fit (hiker cards): a name or title to its band's width,
 * a back row's text to its row's height.
 *
 * Every element waiting to fit is handled in one pass after React's commit,
 * with all the reads and writes grouped, so a screen of 40 cards lays out a
 * few times instead of hundreds. Again once the fonts finish loading.
 */
import { useLayoutEffect, type RefObject } from 'react';

export interface FitJob {
  el: HTMLElement;
  /** `width`: fit the parent's width (minus `pad`); `height`: fit its own box. */
  mode: 'width' | 'height';
  /** The size to start from; its CSS size when not given. */
  base?: number;
  /** Never smaller than this (px). */
  min: number;
  /** Width mode: room kept free across the parent. */
  pad?: number;
}

const waiting = new Set<FitJob>();
const mounted = new Set<FitJob>();
let scheduled = false;

function schedule(job: FitJob) {
  waiting.add(job);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(run);
}

/** How much too big it is: 1 or less fits. */
function over(job: FitJob): number {
  const { el } = job;
  if (job.mode === 'width') {
    const room = (el.parentElement?.clientWidth ?? 0) - (job.pad ?? 0);
    return room > 0 ? el.scrollWidth / room : 1;
  }
  return el.clientHeight > 0 ? el.scrollHeight / (el.clientHeight + 0.5) : 1;
}

function run() {
  scheduled = false;
  const jobs = [...waiting].filter((j) => j.el.isConnected);
  waiting.clear();
  // Back to full size, all at once; then one read.
  for (const j of jobs) j.el.style.fontSize = j.base ? `${j.base}px` : '';
  const sized = jobs.map((j) => ({
    j,
    size: j.base ?? parseFloat(getComputedStyle(j.el).fontSize),
    over: over(j),
  }));
  const tooBig = sized.filter((s) => s.over > 1);
  // A width shrinks in step with the font; a block of lines about with its square.
  for (const s of tooBig) {
    const k = s.j.mode === 'width' ? 1 / s.over : 0.98 / Math.sqrt(s.over);
    s.size = Math.max(s.j.min, s.size * k);
    s.j.el.style.fontSize = `${s.size}px`;
  }
  // The few blocks still too tall step down until they fit.
  let left = tooBig.filter((s) => s.j.mode === 'height' && s.size > s.j.min && over(s.j) > 1);
  while (left.length) {
    for (const s of left) {
      s.size = Math.max(s.j.min, s.size - 0.25);
      s.j.el.style.fontSize = `${s.size}px`;
    }
    left = left.filter((s) => s.size > s.j.min && over(s.j) > 1);
  }
}

let fontsHooked = false;
function refitWhenFontsLoad() {
  if (fontsHooked || typeof document === 'undefined' || !document.fonts) return;
  fontsHooked = true;
  void document.fonts.ready.then(() => {
    for (const job of mounted) schedule(job);
  });
}

/** Fits the element in `ref` whenever `key` (its text) changes. */
export function useFit(
  ref: RefObject<HTMLElement | null>,
  key: string,
  { mode, base, min, pad }: Omit<FitJob, 'el'>,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const job: FitJob = { el, mode, min, ...(base ? { base } : {}), ...(pad ? { pad } : {}) };
    mounted.add(job);
    schedule(job);
    refitWhenFontsLoad();
    return () => {
      mounted.delete(job);
      waiting.delete(job);
    };
  }, [ref, key, mode, base, min, pad]);
}
