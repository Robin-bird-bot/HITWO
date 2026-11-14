import { useEffect, useRef } from 'react';
import { useFocusOnOpen } from '../app/useFocusOnOpen';
import { useDraggable } from '../windows/useDraggable';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Start on the cancel button, so Enter keeps things as they are (abandoning a hiker). */
  focusCancel?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * A small confirm box over the game, for anything that can't be undone. Esc
 * cancels; Enter presses whichever button has focus (confirm, unless
 * `focusCancel`).
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep playing',
  focusCancel = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { ref, windowProps, translate } = useDraggable<HTMLDivElement>('confirm');
  // Focus comes back when it closes (the buttons below take it first).
  const backdrop = useFocusOnOpen<HTMLDivElement>();
  useEffect(() => {
    (focusCancel ? cancelRef : confirmRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, focusCancel]);

  return (
    <div ref={backdrop} tabIndex={-1} className={styles.backdrop} onClick={onCancel}>
      <div
        ref={ref}
        className={styles.dialog}
        style={{ translate }}
        {...windowProps}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className={styles.title} data-drag-handle>
          {title}
        </h2>
        <p id="confirm-message" className={styles.message}>
          {message}
        </p>
        <div className={styles.buttons}>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" className={styles.confirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
