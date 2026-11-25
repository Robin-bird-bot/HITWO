/**
 * Line up (docs/design/11-minigames-puzzles.md, "Line up";
 * docs/mockups/minigames/puzzles/1-line-up.png): before a game with 2 or more
 * hikers, the player sets the order. Numbered cards, front to back:
 * - drag a card to a new place;
 * - or tap one card, then another, to swap them;
 * - or pick a card and move it with ← →.
 * Then Go (or Enter). The front of the line goes first and takes the most risk.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BALANCE } from '../../config/balance';
import { moveTo, swap } from '../../minigames/lineup';
import type { MinigameHiker } from '../../minigames/types';
import { HikerToken } from './HikerToken';
import { PixelScreen } from './PixelScreen';
import { toScene } from './sceneCoords';
import ui from './gpsUi.module.css';
import styles from './LineUp.module.css';

const CARD = { w: 47, h: 72, gap: 13, top: 78 };
const DRAG_PX = BALANCE.minigames.bearrels.drag.startPx;

export function LineUp({
  hikers,
  initial,
  onGo,
}: {
  hikers: readonly MinigameHiker[];
  /** The order to start from (the last one, after Play again). */
  initial?: readonly string[];
  onGo(order: string[]): void;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>(() =>
    initial && initial.length === hikers.length ? [...initial] : hikers.map((h) => h.id),
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    from: number;
    pointerId: number;
    sx: number;
    sy: number;
    x: number;
    moving: boolean;
  } | null>(null);
  const n = order.length;
  const pitch = CARD.w + CARD.gap;
  const left0 = (320 - (n * CARD.w + (n - 1) * CARD.gap)) / 2;
  const slotOf = (x: number) =>
    Math.max(0, Math.min(n - 1, Math.round((x - left0 - CARD.w / 2) / pitch)));
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

  // While a card is pressed: drag it once it moves far enough, drop it in its new place.
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const far = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > DRAG_PX;
      if (!drag.moving && !far) return;
      setDrag({ ...drag, moving: true, x: toScene(sceneRef.current, e.clientX, e.clientY).x });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      setDrag(null);
      if (drag.moving) {
        setOrder(moveTo(order, drag.from, slotOf(drag.x)));
        setPicked(null);
        return;
      }
      // A tap: pick this card, or swap it with the one picked.
      if (picked === null) setPicked(drag.from);
      else if (picked === drag.from) setPicked(null);
      else {
        setOrder(swap(order, picked, drag.from));
        setPicked(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  // The keyboard: ← → move the picked card, Enter is Go.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onGo(order);
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && picked !== null) {
        e.preventDefault();
        const to = Math.max(0, Math.min(n - 1, picked + (e.key === 'ArrowLeft' ? -1 : 1)));
        setOrder(moveTo(order, picked, to));
        setPicked(to);
      } else if (/^[1-4]$/.test(e.key) && Number(e.key) <= n) {
        setPicked(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const press = (i: number, e: ReactPointerEvent) => {
    if (e.button > 0) return;
    setDrag({
      from: i,
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      x: left0 + i * pitch + CARD.w / 2,
      moving: false,
    });
  };

  // While dragging, the others make room where the card would land.
  const dragging = drag?.moving ? drag : null;
  const shown = dragging ? moveTo(order, dragging.from, slotOf(dragging.x)) : order;

  return (
    <PixelScreen ref={sceneRef}>
      <div className={`${ui.box} ${styles.title}`}>LINE UP</div>
      <p className={`${ui.text} ${styles.ask}`}>Who goes first? Drag to reorder.</p>
      <p className={`${ui.muted} ${styles.why}`}>The front of the line takes the most risk.</p>

      {shown.map((id, slot) => {
        const isDragged = dragging && order[dragging.from] === id;
        const x = isDragged ? dragging.x - CARD.w / 2 : left0 + slot * pitch;
        const i = order.indexOf(id);
        return (
          <div
            key={id}
            className={styles.card}
            data-picked={(!dragging && picked === i) || undefined}
            data-dragging={isDragged || undefined}
            role="button"
            tabIndex={0}
            aria-label={`${slot + 1}: ${byId(id).name}`}
            style={{ left: x, top: CARD.top, width: CARD.w, height: CARD.h }}
            onPointerDown={(e) => press(i, e)}
          >
            <span className={`${ui.text} ${styles.number}`}>{slot + 1}</span>
            <HikerToken hiker={byId(id)} size={26} />
            <span className={`${ui.text} ${styles.name}`}>{byId(id).name}</span>
          </div>
        );
      })}
      {Array.from({ length: n - 1 }, (_, k) => (
        <span
          key={k}
          className={`${ui.muted} ${styles.chevron}`}
          style={{
            left: left0 + (k + 1) * pitch - CARD.gap / 2 - 2,
            top: CARD.top + CARD.h / 2 - 3,
          }}
          aria-hidden="true"
        >
          ›
        </span>
      ))}

      <span className={styles.rule} aria-hidden="true" />
      <p className={`${ui.muted} ${styles.frontBack}`}>Front &lt;----------- Back</p>

      <button type="button" className={`${ui.button} ${styles.go}`} onClick={() => onGo(order)}>
        GO
      </button>
    </PixelScreen>
  );
}
