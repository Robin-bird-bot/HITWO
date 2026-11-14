/**
 * Small boxes shown under the action grid: who's coming along for Move All,
 * and the Sleep, Keep Watch and Tend confirms.
 */
import { useEffect, useRef } from 'react';
import type { HikerId } from '../../engine';
import type { BringOption } from './movePlan';
import styles from './TurnExtras.module.css';

interface MoveAllPickerProps {
  options: BringOption[];
  bring: HikerId[];
  onToggle(id: HikerId): void;
  onCancel(): void;
}

export function MoveAllPicker({ options, bring, onToggle, onCancel }: MoveAllPickerProps) {
  const count = bring.length;
  return (
    <div className={styles.box}>
      <span className={styles.kicker}>MOVE ALL · WHO’S COMING?</span>
      <div className={styles.list}>
        {options.map(({ hiker, reason }) => (
          <label key={hiker.id} className={styles.option} data-disabled={reason !== null}>
            <input
              type="checkbox"
              checked={bring.includes(hiker.id)}
              disabled={reason !== null}
              onChange={() => onToggle(hiker.id)}
            />
            <span className={styles.name}>{hiker.name}</span>
            {reason && <span className={styles.why}>{reason}</span>}
          </label>
        ))}
      </div>
      <span className={styles.hint}>
        {count === 0
          ? 'Tick at least one hiker to bring along.'
          : `Each hiker you bring costs you 1 more Appetite. Now click a gold tile.`}
      </span>
      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

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
