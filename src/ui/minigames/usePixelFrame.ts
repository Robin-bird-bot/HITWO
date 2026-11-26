/**
 * The whole-number pixel scale for a minigame's 320 × 240 scene: how wide
 * the game screen is drawn (in device pixels) decides it. Measured after it
 * mounts, again a few times while the GPS may still be turning, and
 * whenever the stage is rescaled.
 */
import { useEffect, useState, type RefObject } from 'react';
import { FILL, pixelFrame, type Frame } from '../../minigames/screen';
import { useStage } from '../stage/StageContext';

export function usePixelFrame(ref: RefObject<HTMLElement | null>, measure = true): Frame {
  const { scale } = useStage();
  const [frame, setFrame] = useState<Frame>(FILL);
  useEffect(() => {
    if (!measure) return;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const width = el.getBoundingClientRect().width * (window.devicePixelRatio || 1);
      const next = pixelFrame(width);
      setFrame((f) => (f.unit === next.unit && f.x === next.x && f.y === next.y ? f : next));
    };
    // Now, again a few times, and whenever a transition ends: games without
    // a Line up start while the GPS is still turning (it takes 700 ms).
    const timers = [0, 400, 900, 1600].map((ms) => setTimeout(update, ms));
    window.addEventListener('resize', update);
    window.addEventListener('transitionend', update, true);
    window.addEventListener('animationend', update, true);
    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener('resize', update);
      window.removeEventListener('transitionend', update, true);
      window.removeEventListener('animationend', update, true);
    };
  }, [ref, scale, measure]);
  return measure ? frame : FILL;
}
