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

const GROUP_WORD = {
  move: 'MOVE',
  scavenge: 'SCAVENGE',
  tend: 'TEND',
  sleep: 'SLEEP',
  watch: 'KEEP WATCH',
} as const;

interface GroupConfirmProps {
  kind: keyof typeof GROUP_WORD;
  /** The hikers' names, in turn order. */
  names: string[];
  /** Move: the tile, once it's picked (until then, it asks for one). */
  where?: string;
  onGo(): void;
  onCancel(): void;
}

/** Multi-select (Nov 14 update): one action for the group, each hiker in turn. */
export function GroupConfirm({ kind, names, where, onGo, onCancel }: GroupConfirmProps) {
  const goRef = useRef<HTMLButtonElement>(null);
  const ready = kind !== 'move' || !!where;
  useEffect(() => {
    goRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, ready]);

  return (
    <div className={styles.box}>
      <span className={styles.kicker}>
        {GROUP_WORD[kind]} · {names.length} HIKERS
      </span>
      <span className={styles.text}>
        {kind === 'move' && !where
          ? 'Pick a tile on the map (or drag one of them there).'
          : `${kind === 'move' ? `To ${where}. ` : ''}One after another: ${names.join(', then ')}.${
              kind === 'move' ? ' Each pays their own way.' : ''
            }`}
      </span>
      <div className={styles.buttons}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        {ready && (
          <button ref={goRef} type="button" className={styles.confirm} onClick={onGo}>
            Go
          </button>
        )}
      </div>
    </div>
  );
}

/** A grouped move: this hiker couldn't reach the tile, so they pick their own, or skip. */
export function GroupOwnTile({ name, onSkip }: { name: string; onSkip(): void }) {
  return (
    <div className={styles.box}>
      <span className={styles.kicker}>{name.toUpperCase()}’S TURN</span>
      <span className={styles.text}>
        {name} can’t reach that tile. Pick another tile for {name}, or skip.
      </span>
      <div className={styles.buttons}>
        <button type="button" className={styles.cancel} onClick={onSkip}>
          Skip {name}
        </button>
      </div>
    </div>
  );
}
