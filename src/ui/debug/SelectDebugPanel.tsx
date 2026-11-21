/**
 * The debug panel on the hiker selection screen (backtick), where there's no
 * hike yet: the hidden difficulty toggle for balancing.
 */
import { useDeviceSetting } from '../app/deviceSetting';
import { SHOW_DIFFICULTY } from './debugFlags';
import styles from './DebugPanel.module.css';
import { useBacktickToggle } from './useBacktickToggle';

export function SelectDebugPanel() {
  const [open, setOpen] = useBacktickToggle();
  const showing = useDeviceSetting(SHOW_DIFFICULTY) === 'on';
  if (!open) return null;
  return (
    <aside className={styles.panel} aria-label="Debug panel">
      <header className={styles.header}>
        <span className={styles.title}>DEBUG</span>
        <span className={styles.meta}>Hiker selection</span>
        <button type="button" className={styles.close} onClick={() => setOpen(false)}>
          Close
        </button>
      </header>
      <section className={styles.group}>
        <h3 className={styles.heading}>Hiker cards</h3>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            aria-pressed={showing}
            onClick={() => SHOW_DIFFICULTY.set(showing ? 'off' : 'on')}
          >
            Show hidden difficulty
          </button>
        </div>
      </section>
      <p className={styles.hint}>Press ` (backtick) to hide.</p>
    </aside>
  );
}
