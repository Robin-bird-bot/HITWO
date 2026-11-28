import { useEffect, useRef, type ReactNode } from 'react';
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
  /** A list under the message (who's about to lose Morale, and why). */
  lines?: readonly string[];
  /** Something under the buttons (a "Don't ask again" box). */
  extra?: ReactNode;
  /**
   * Pick one: a button each in place of the confirm button; picking one is
   * the yes (Rule Changer's 1 of 2 or 4).
   */
  options?: readonly { id: string; label: string }[];
  onOption?(id: string): void;
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
  lines,
  extra,
  options,
  onOption,
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
        {lines && lines.length > 0 && (
          <ul className={styles.lines}>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {options && options.length > 0 && (
          <div className={styles.options}>
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={styles.confirm}
                data-sound="ui.confirm"
                onClick={() => onOption?.(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <div className={styles.buttons}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            data-sound="ui.cancel"
          >
            {cancelLabel}
          </button>
          {!options?.length && (
            <button
              ref={confirmRef}
              type="button"
              className={styles.confirm}
              onClick={onConfirm}
              data-sound="ui.confirm"
            >
              {confirmLabel}
            </button>
          )}
        </div>
        {extra}
      </div>
    </div>
  );
}

/** "Don't ask again this run", under a trait warning's check. */
export function DontAskAgain({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label className={styles.quiet}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Don’t ask again this run
    </label>
  );
}
