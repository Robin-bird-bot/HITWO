/**
 * A minigame's clock: seconds left out of `total`, ticking while `running`,
 * calling `onUp` once when it reaches 0. No clock (`total` null) never runs
 * out. A new `resetKey` starts it over (a new round).
 */
import { useEffect, useRef, useState } from 'react';

export function useCountdown(
  total: number | null,
  running: boolean,
  onUp: () => void,
  resetKey: string | number = 0,
): number | null {
  const [clock, setClock] = useState({ key: resetKey, elapsed: 0 });
  const elapsed = clock.key === resetKey ? clock.elapsed : 0;
  const up = useRef(onUp);
  const firedFor = useRef<string | number | null>(null);
  useEffect(() => {
    up.current = onUp;
  });
  useEffect(() => {
    if (!running || total === null) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setClock((c) => ({ key: resetKey, elapsed: (c.key === resetKey ? c.elapsed : 0) + dt }));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, total, resetKey]);
  useEffect(() => {
    if (total !== null && running && elapsed >= total && firedFor.current !== resetKey) {
      firedFor.current = resetKey;
      up.current();
    }
  }, [elapsed, total, running, resetKey]);
  return total === null ? null : Math.max(0, total - elapsed);
}
