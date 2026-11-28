/**
 * The quick games' bottom bar (docs/design/18-minigames-quick.md, "Turns";
 * mockups in docs/mockups/minigames/quick-games/): each hiker's token, name
 * and state (NOW, WAITING, DONE, then PASSED or FAILED), and their squares
 * or jar. The active hiker's slot has a light frame. Scene units.
 */
import type { ReactNode } from 'react';
import type { MinigameHiker } from '../../../minigames/types';
import { HikerToken } from '../HikerToken';
import { useHikerResults, useTurnSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './Quick.module.css';

export function TurnBar({
  hikers,
  word,
  active,
  lead,
  extra,
}: {
  /** In line order. */
  hikers: readonly MinigameHiker[];
  /** What the slot says under the name. */
  word(id: string): string;
  /** The hiker playing now (framed). */
  active?: string;
  /** Drawn in place of the token (Firefly Catch's jar). */
  lead?(id: string): ReactNode;
  /** Their squares, on the right of the slot. */
  extra?(id: string): ReactNode;
}) {
  // The next hiker's turn, and each hiker's part passing or failing.
  useTurnSound(active);
  useHikerResults(
    Object.fromEntries(
      hikers.map((h) => {
        const w = word(h.id);
        return [h.id, w === 'PASSED' ? 'passed' : w === 'FAILED' ? 'failed' : null];
      }),
    ),
  );
  return (
    <div className={`${ui.box} ${hud.panel}`}>
      <span className={styles.slots}>
        {hikers.map((h) => {
          const w = word(h.id);
          return (
            <span
              key={h.id}
              className={styles.slot}
              data-active={h.id === active || undefined}
              data-failed={w === 'FAILED' || undefined}
            >
              {lead ? (
                lead(h.id)
              ) : (
                <HikerToken hiker={h} size={10} state={w === 'FAILED' ? 'out' : undefined} />
              )}
              <span className={styles.slotWords}>
                <span className={styles.slotName}>{h.name.toUpperCase()}</span>
                <span className={styles.slotState}>{w}</span>
              </span>
              {extra && <span className={styles.slotExtra}>{extra(h.id)}</span>}
            </span>
          );
        })}
      </span>
    </div>
  );
}

/**
 * A row of squares: `lit` of `total` light (tries left, strikes left, a try
 * used), in the hiker's `color` when given (Incoming Bike!'s bikes dodged).
 */
export function Squares({
  total,
  lit,
  label,
  color,
}: {
  total: number;
  lit: number;
  label: string;
  color?: string;
}) {
  return (
    <span className={styles.squares} aria-label={label}>
      {Array.from({ length: total }, (_, k) => (
        <span
          key={k}
          data-on={k < lit || undefined}
          style={k < lit && color ? { background: color } : undefined}
        />
      ))}
    </span>
  );
}
