/**
 * The debug panel's Phase 10.7 tools: party XP, points, every step for a
 * hiker, a hiker's morale type, and the two new trinkets.
 */
import { useState } from 'react';
import { MORALE_TYPES } from '../../content/moraleTypes';
import { MORALE_TYPE_IDS, partyOf, treesOf, type Action, type GameState } from '../../engine';
import styles from './DebugPanel.module.css';

export function TrailsTools({
  state,
  onApply,
}: {
  state: GameState;
  onApply(action: Action): void;
}) {
  const hikers = state.hikers.filter((h) => h.status !== 'abandoned');
  const [hikerId, setHikerId] = useState(hikers[0]?.id ?? '');
  const hiker = hikers.find((h) => h.id === hikerId);
  const party = partyOf(state);
  const debug = (op: Extract<Action, { type: 'debug' }>['op']) => onApply({ type: 'debug', op });
  return (
    <section className={styles.group}>
      <h3 className={styles.heading}>Skill Trails (Phase 10.7)</h3>
      <div className={styles.row}>
        <span className={styles.note}>
          Party LV {party.level} · {party.xp} XP · {party.points} point
          {party.points === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={() => debug({ kind: 'partyXp', xp: 100 })}
        >
          +100 party XP
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => debug({ kind: 'partyPoints', points: 1 })}
        >
          +1 point
        </button>
      </div>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={hikerId}
          onChange={(e) => setHikerId(e.target.value)}
          aria-label="Hiker"
        >
          {hikers.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.button}
          disabled={!hiker || !treesOf(hiker)}
          onClick={() => debug({ kind: 'learnAll', hikerId })}
        >
          Learn everything for this hiker
        </button>
        <select
          className={styles.button}
          value={hiker?.moraleType ?? ''}
          onChange={(e) =>
            debug({
              kind: 'setMoraleType',
              hikerId,
              moraleType: e.target.value as (typeof MORALE_TYPE_IDS)[number],
            })
          }
          aria-label="Morale type"
        >
          {!hiker?.moraleType && <option value="">No morale type</option>}
          {MORALE_TYPE_IDS.map((id) => (
            <option key={id} value={id}>
              {MORALE_TYPES[id].name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.row}>
        {['fieldNotebook', 'meritBadge'].map((itemId) => (
          <button
            key={itemId}
            type="button"
            className={styles.button}
            onClick={() => debug({ kind: 'giveItem', hikerId, itemId })}
          >
            Give {itemId === 'fieldNotebook' ? 'Field Notebook' : 'Merit Badge'}
          </button>
        ))}
      </div>
    </section>
  );
}
