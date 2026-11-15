/**
 * Multi-select's small pieces (Nov 14 update), shared by both party panels:
 * the Select toggle (for touch: tap hikers to add them, in turn order) and
 * the numbered turn-order badge on a portrait.
 */
import type { ReactNode } from 'react';
import styles from './GroupBits.module.css';

export function SelectToggle({ on, onChange }: { on: boolean; onChange(on: boolean): void }) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={on}
      title="Pick several hikers to act one after another (or Shift-click them)"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    >
      {on ? 'Picking' : 'Select'}
    </button>
  );
}

/** A portrait with its turn-order number, when it's in the group. */
export function OrderBadge({ n, children }: { n?: number; children: ReactNode }) {
  return (
    <span className={styles.wrap}>
      {children}
      {n !== undefined && (
        <span className={styles.badge} aria-label={`Turn ${n}`}>
          {n}
        </span>
      )}
    </span>
  );
}
