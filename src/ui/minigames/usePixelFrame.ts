/**
 * The whole-number pixel scale for a minigame's 320 × 240 scene: how wide
 * the game screen is drawn (in device pixels) decides it. Measured after it
 * mounts (the GPS has finished turning by then), again a moment later, and
 * whenever the stage is rescaled.
 */
import { useEffect, useState, type RefObject } from 'react';
import { FILL, pixelFrame, type Frame } from '../../minigames/bearrels/styles';
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
    // Now, and again once the GPS has surely settled from its turn.
    const timers = [setTimeout(update, 0), setTimeout(update, 400)];
    window.addEventListener('resize', update);
    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener('resize', update);
    };
  }, [ref, scale, measure]);
  return measure ? frame : FILL;
}
