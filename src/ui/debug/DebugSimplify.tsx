/**
 * The debug panel's Phase 10.6 tools: the difficulty (for the next section
 * made), any of the 9 foods at a chosen Quality, any shelter with chosen
 * deployments, Show whole map, and the food stat for tuning ("one scavenge
 * plus one craft feeds about 3 actions"). Forcing a weather, Wind included,
 * is in the Conditions section's weather row.
 */
import { useState } from 'react';
import { DIFFICULTY, DIFFICULTY_IDS, DEFAULT_DIFFICULTY } from '../../config/difficulty';
import { ITEMS } from '../../content';
import { FOODS_ON } from '../../content/items/food';
import { shelterDeployments, type Action, type GameState } from '../../engine';
import { WHOLE_MAP_SETTING, useWholeMap } from '../map/mapStyleSetting';
import styles from './DebugPanel.module.css';

const SHELTERS = Object.values(ITEMS).filter((d) => d.type === 'shelter');

export function SimplifyTools({
  state,
  onApply,
}: {
  state: GameState;
  onApply(action: Action): void;
}) {
  const hikers = state.hikers.filter((h) => h.status !== 'abandoned');
  const [hikerId, setHikerId] = useState(hikers[0]?.id ?? '');
  const [food, setFood] = useState(FOODS_ON[0] ?? 'trailMix');
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [shelter, setShelter] = useState(SHELTERS[0]?.id ?? 'tent');
  const [deployments, setDeployments] = useState(() =>
    shelterDeployments(SHELTERS[0]?.id ?? 'tent'),
  );
  const wholeMap = useWholeMap();
  const current = state.difficulty ?? DEFAULT_DIFFICULTY;
  const fed = state.counters.foodCrafted;
  const who = (
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
  );
  return (
    <section className={styles.group}>
      <h3 className={styles.heading}>Simplify (Phase 10.6)</h3>
      <div className={styles.row}>
        <span className={styles.note}>Difficulty, from the next section:</span>
        {DIFFICULTY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.button}
            aria-pressed={current === id}
            onClick={() =>
              onApply({ type: 'debug', op: { kind: 'setDifficulty', difficulty: id } })
            }
          >
            {DIFFICULTY[id].name}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        {who}
        <select
          className={styles.button}
          value={food}
          onChange={(e) => setFood(e.target.value)}
          aria-label="Food"
        >
          {FOODS_ON.map((id) => (
            <option key={id} value={id}>
              {ITEMS[id]?.name ?? id}
            </option>
          ))}
        </select>
        <select
          className={styles.button}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
          aria-label="Quality"
        >
          {[1, 2, 3, 4, 5].map((q) => (
            <option key={q} value={q}>
              Quality {q}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            onApply({ type: 'debug', op: { kind: 'giveItem', hikerId, itemId: food, quality } })
          }
        >
          Give food
        </button>
      </div>
      <div className={styles.row}>
        {who}
        <select
          className={styles.button}
          value={shelter}
          onChange={(e) => {
            setShelter(e.target.value);
            setDeployments(shelterDeployments(e.target.value));
          }}
          aria-label="Shelter"
        >
          {SHELTERS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <label className={styles.note}>
          Deployments{' '}
          <input
            className={styles.seed}
            type="number"
            min={0}
            max={9}
            value={deployments}
            onChange={(e) => setDeployments(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            onApply({
              type: 'debug',
              op: { kind: 'addShelter', hikerId, itemId: shelter, deployments },
            })
          }
        >
          Give shelter
        </button>
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={wholeMap}
          onClick={() => WHOLE_MAP_SETTING.set(wholeMap ? 'off' : 'on')}
        >
          Show whole map
        </button>
        <span className={styles.note}>
          {fed?.count
            ? `Food crafted: ${fed.count}, about ${(fed.appetite / fed.count).toFixed(1)} Appetite each over all its bites`
            : 'No food crafted yet this run.'}
        </span>
      </div>
    </section>
  );
}
