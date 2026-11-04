import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fitStage, STAGE_HEIGHT, STAGE_WIDTH, type StageFit } from './fitStage';
import { StageContext } from './StageContext';
import styles from './Stage.module.css';

/** Lays children out on the 1600×1000 stage, scaled to fit the window and centered. */
export function Stage({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<StageFit>(() => fitStage(window.innerWidth, window.innerHeight));

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setFit(fitStage(viewport.clientWidth, viewport.clientHeight));
    update();
    // Covers window resizes, rotation and phone browser bars showing or hiding.
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={viewportRef} className={styles.viewport}>
      <div
        className={styles.stage}
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})`,
        }}
      >
        <StageContext.Provider value={fit}>{children}</StageContext.Provider>
      </div>
    </div>
  );
}
