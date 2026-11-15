/**
 * Small boxes shown under the action grid: the Sleep, Keep Watch and Tend
 * confirms. (Who comes along for Move All is picked in the move pop-up.)
 */
import { useEffect, useRef } from 'react';
import styles from './TurnExtras.module.css';

interface SleepConfirmProps {
  name: string;
  gain: number;
  from: number;
  to: number;
  onConfirm(): void;
  onCancel(): void;
}

export function SleepConfirm({ name, gain, from, to, onConfirm, onCancel }: SleepConfirmProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className={styles.box}>
      <span className={styles.kicker}>SLEEP · +{gain} ENERGY</span>
      <span className={styles.text}>
        {name} sleeps for the night: Energy {from} → <b>{to}</b>. Sleeping also avoids the 2 Energy
        a night without sleep costs.
      </span>
      <div className={styles.buttons}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button ref={confirmRef} type="button" className={styles.confirm} onClick={onConfirm}>
          Sleep
        </button>
      </div>
    </div>
  );
}

interface WatchConfirmProps {
  name: string;
  /** Everyone else on the tile, who'll be safe too. */
  others: string[];
  /** What the night without sleep costs. */
  noSleep: number;
  onConfirm(): void;
  onCancel(): void;
}

/** Keep Watch: who it keeps safe, and that the watcher doesn't sleep. */
export function WatchConfirm({ name, others, noSleep, onConfirm, onCancel }: WatchConfirmProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // "Ash is", "Ash and Birch are", "Ash, Birch and Cedar are".
  const all = [name, ...others];
  const who =
    all.length === 1 ? `${name} is` : `${all.slice(0, -1).join(', ')} and ${all.at(-1)} are`;
  return (
    <div className={styles.box}>
      <span className={styles.kicker}>KEEP WATCH · SAFE TONIGHT</span>
      <span className={styles.text}>
        {name} keeps watch tonight. {who} safe from the night event. {name} won’t sleep, so the
        night costs {noSleep} Energy.
      </span>
      <div className={styles.buttons}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button ref={confirmRef} type="button" className={styles.confirm} onClick={onConfirm}>
          Keep Watch
        </button>
      </div>
    </div>
  );
}

interface TendConfirmProps {
  name: string;
  /** Abundance now, and after Tend. */
  from: number;
  to: number;
  /** Tend's Appetite cost. */
  appetite: number;
  onConfirm(): void;
  onCancel(): void;
}

/** Tend: raise the biome's Abundance, for 1 Appetite (Nov 14 update). */
export function TendConfirm({ name, from, to, appetite, onConfirm, onCancel }: TendConfirmProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className={styles.box}>
      <span className={styles.kicker}>
        TEND · +{to - from} ABUNDANCE · −{appetite} APPETITE
      </span>
      <span className={styles.text}>
        {name} tends the land: Abundance {from} → <b>{to}</b>.
      </span>
      <div className={styles.buttons}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button ref={confirmRef} type="button" className={styles.confirm} onClick={onConfirm}>
          Tend
        </button>
      </div>
    </div>
  );
}
