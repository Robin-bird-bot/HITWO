/**
 * Small boxes shown under the action grid: who's coming along for Move All,
 * the Sleep confirm, and which node to Tend.
 */
import { useEffect, useRef } from 'react';
import type { HikerId, NodeType } from '../../engine';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
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

interface TendPickerProps {
  /** The tile's nodes with their meters. */
  nodes: { node: NodeType; from: number; to: number; full: boolean }[];
  gain: number;
  onTend(node: NodeType): void;
  onCancel(): void;
}

/** Tend: pick which node on this tile to restore. */
export function TendPicker({ nodes, gain, onTend, onCancel }: TendPickerProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const firstOpen = nodes.findIndex((n) => !n.full);
  return (
    <div className={styles.box}>
      <span className={styles.kicker}>TEND · +{gain} ABUNDANCE</span>
      <div className={styles.list}>
        {nodes.map(({ node, from, to, full }, i) => {
          return (
            <button
              key={node}
              ref={i === firstOpen ? firstRef : undefined}
              type="button"
              className={styles.node}
              disabled={full}
              onClick={() => onTend(node)}
            >
              <img src={NODE_IMAGE[node]} alt="" width={22} height={25} />
              <span className={styles.name}>{NODE_NAME[node]}</span>
              <span className={styles.meter}>
                {full ? (
                  'Full'
                ) : (
                  <>
                    {from} → <b>{to}</b>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
