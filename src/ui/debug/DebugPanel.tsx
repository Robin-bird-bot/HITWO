/**
 * The dev-only debug panel (CLAUDE.md "How to work"), toggled with the
 * backtick key. Always available with the dev server; on the live site only
 * when the address has ?debug.
 *
 * Tools: phases, revealing the map, resources and stats. Step 4 adds the seed.
 */
import { useEffect, useState } from 'react';
import { RESOURCES } from '../../content/resources';
import { PHASES, STAT_NAMES, type Action, type GameState, type Hiker } from '../../engine';
import { gameStore } from '../app/gameStore';
import styles from './DebugPanel.module.css';

const PHASE_NAMES = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' } as const;

export function DebugPanel({ state, onQuit }: { state: GameState; onQuit(): void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Backquote' && e.key !== '`') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  const run = (action: Action) => {
    const result = gameStore.dispatch(action);
    setMessage(result.ok ? '' : result.reason);
  };

  return (
    <aside className={styles.panel} aria-label="Debug panel">
      <header className={styles.header}>
        <span className={styles.title}>DEBUG</span>
        <span className={styles.meta}>
          Seed {state.seed} · Day {state.day} · {PHASE_NAMES[state.phase]}
        </span>
        <button type="button" className={styles.close} onClick={() => setOpen(false)}>
          Close
        </button>
      </header>

      <section className={styles.group}>
        <h3 className={styles.heading}>Phase</h3>
        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={() => run({ type: 'endPhase' })}>
            Next phase (normal rules)
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.note}>Skip to, without drains:</span>
          {PHASES.map((phase) => (
            <button
              key={phase}
              type="button"
              className={styles.button}
              aria-pressed={state.phase === phase}
              onClick={() => run({ type: 'debug', op: { kind: 'skipToPhase', phase } })}
            >
              {PHASE_NAMES[phase]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Map</h3>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => run({ type: 'debug', op: { kind: 'revealMap' } })}
          >
            Reveal map
          </button>
          <button type="button" className={styles.button} onClick={onQuit}>
            Back to title
          </button>
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Stats</h3>
        <StatsEditor hikers={state.hikers} onApply={run} />
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Inventory</h3>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              for (const h of state.hikers) {
                const resources: Record<string, number> = {};
                for (let i = 0; i < 5; i++) {
                  const r = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
                  if (r) resources[r.id] = (resources[r.id] ?? 0) + 1;
                }
                run({ type: 'debug', op: { kind: 'giveResources', hikerId: h.id, resources } });
              }
            }}
          >
            Give everyone 5 random resources
          </button>
        </div>
      </section>

      {message && <p className={styles.message}>{message}</p>}
      <p className={styles.hint}>Press ` (backtick) to hide.</p>
    </aside>
  );
}

const STAT_LABEL = { energy: 'Energy', appetite: 'Appetite', morale: 'Morale' } as const;

/** Set any hiker's stats and injuries directly (no injury rule), e.g. to test thresholds. */
function StatsEditor({ hikers, onApply }: { hikers: Hiker[]; onApply(action: Action): void }) {
  const [hikerId, setHikerId] = useState(hikers[0]?.id ?? '');
  const hiker = hikers.find((h) => h.id === hikerId);
  return hiker ? (
    <StatsForm key={`${hiker.id}-${JSON.stringify(hiker.stats)}-${hiker.injuries}`} hiker={hiker}>
      {(values, setValue) => (
        <>
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
            {[...STAT_NAMES, 'injuries' as const].map((key) => (
              <label key={key} className={styles.note}>
                {key === 'injuries' ? 'Injuries' : STAT_LABEL[key]}{' '}
                <input
                  className={styles.number}
                  type="number"
                  min={0}
                  max={key === 'injuries' ? 3 : 10}
                  value={values[key]}
                  onChange={(e) => setValue(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                onApply({
                  type: 'debug',
                  op: {
                    kind: 'setStats',
                    hikerId: hiker.id,
                    stats: {
                      energy: values.energy,
                      appetite: values.appetite,
                      morale: values.morale,
                    },
                    injuries: values.injuries,
                  },
                })
              }
            >
              Apply to {hiker.name}
            </button>
          </div>
        </>
      )}
    </StatsForm>
  ) : null;
}

type StatValues = Record<'energy' | 'appetite' | 'morale' | 'injuries', number>;

function StatsForm({
  hiker,
  children,
}: {
  hiker: Hiker;
  children(
    values: StatValues,
    set: (key: keyof StatValues, value: number) => void,
  ): React.ReactNode;
}) {
  const [values, setValues] = useState<StatValues>({ ...hiker.stats, injuries: hiker.injuries });
  return <>{children(values, (key, value) => setValues((v) => ({ ...v, [key]: value })))}</>;
}
