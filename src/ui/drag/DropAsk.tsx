/**
 * A small question where something was dropped, for drops that can't be
 * undone (Nov 14 update): eat this, place this shelter, give it or have them
 * eat it. Esc, Cancel or a click elsewhere closes it without doing anything.
 */
import { useEffect, useRef } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';
import styles from './DropAsk.module.css';

export interface DropAskOption {
  label: string;
  onChoose(): void;
}

export interface DropAskProps {
  /** Where it was dropped, in stage pixels. */
  at: { x: number; y: number };
  title: string;
  text?: string;
  options: DropAskOption[];
  onCancel(): void;
}

const WIDTH = 280;

export function DropAsk({ at, title, text, options, onCancel }: DropAskProps) {
  const first = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onCancel();
    };
    window.addEventListener('keydown', onKey);
    const later = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(later);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onCancel]);

  // Just right of the drop point, kept on the stage.
  const left = Math.min(STAGE_WIDTH - WIDTH - 16, Math.max(16, at.x + 16));
  const top = Math.min(STAGE_HEIGHT - 200, Math.max(16, at.y - 40));
  return (
    <div
      ref={box}
      className={styles.ask}
      style={{ left, top, width: WIDTH }}
      role="dialog"
      aria-label={title}
    >
      <span className={styles.title}>{title}</span>
      {text && <span className={styles.text}>{text}</span>}
      <div className={styles.buttons}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        {options.map((o, i) => (
          <button
            key={o.label}
            ref={i === options.length - 1 ? first : undefined}
            type="button"
            className={styles.choose}
            onClick={o.onChoose}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
