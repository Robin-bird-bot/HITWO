/**
 * The dev-only debug panel (CLAUDE.md "How to work"), toggled with the
 * backtick key. Always available with the dev server; on the live site only
 * when the address has ?debug.
 *
 * Step 1 tools: phases and revealing the map. Step 4 adds the seed, stats and resources.
 */
import { useEffect, useState } from 'react';
import { PHASES, type Action, type GameState } from '../../engine';
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

      {message && <p className={styles.message}>{message}</p>}
      <p className={styles.hint}>Press ` (backtick) to hide.</p>
    </aside>
  );
}
