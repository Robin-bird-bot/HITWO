import { BALANCE } from '../../config/balance';
import type { StatName } from '../../engine';
import { Icon } from '../icons/Icon';
import { BAR_LEVELS, barColor, barLevel, STAT_META } from './hikerInfo';
import styles from './StatBar.module.css';

interface StatBarProps {
  stat: StatName;
  value: number;
  /** Simple mode: the number at the end of the bar. */
  showNumber?: boolean;
  /** Tick marks at each threshold (both modes; Simple ticks Energy and Appetite). */
  ticks?: boolean;
  /** Thicker bar, for Simple mode's cards. */
  size?: 'slim' | 'regular';
}

/** An Energy, Appetite or Morale bar: amber at a threshold, red with a gentle pulse when critical. */
export function StatBar({ stat, value, showNumber, ticks, size = 'slim' }: StatBarProps) {
  const max = BALANCE.stats.max;
  const level = barLevel(stat, value);
  const label = `${STAT_META[stat].label} ${value}/${max}`;
  return (
    <div className={styles.row} data-size={size} title={label} aria-label={label} role="img">
      <Icon
        name={STAT_META[stat].icon}
        size={size === 'regular' ? 14 : 12}
        color="#B9B2A3"
        strokeWidth={2.5}
      />
      <div className={styles.track}>
        <div
          className={styles.fill}
          data-level={level}
          style={{
            width: `${Math.min(100, (value / max) * 100)}%`,
            background: barColor(stat, value),
          }}
        />
        {ticks &&
          [BAR_LEVELS[stat].low, BAR_LEVELS[stat].critical].map((t) => (
            <span key={t} className={styles.tick} style={{ left: `${(t / max) * 100}%` }} />
          ))}
      </div>
      {showNumber && (
        <span className={styles.number} data-level={level}>
          {value}
        </span>
      )}
    </div>
  );
}
