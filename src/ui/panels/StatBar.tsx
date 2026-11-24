import { BALANCE } from '../../config/balance';
import { Icon } from '../icons/Icon';
import { BAR_LEVELS, barColor, barLevel, STAT_META, type BarStat } from './hikerInfo';
import styles from './StatBar.module.css';

interface StatBarProps {
  /** A stat, or a Plush hiker's Stuffing. */
  stat: BarStat;
  value: number;
  /** Simple mode: the number at the end of the bar. */
  showNumber?: boolean;
  /** Tick marks at each threshold (both modes; Simple ticks Energy and Appetite). */
  ticks?: boolean;
  /** Thicker bar, for Simple mode's cards. */
  size?: 'slim' | 'regular';
  /** The hiker's maximum, when a Wonder raised it above 10. */
  max?: number;
  /**
   * The Morale bar's forecast (Phase 10.7): what the morale type gives at the
   * end of this phase. Up: the next pip glows green. Down: the last pip
   * empties to a red outline. Unknown: a small "?" at the end.
   */
  forecast?: 1 | -1 | 0 | 'unknown' | undefined;
}

/** An Energy, Appetite, Morale or Stuffing bar: amber at a threshold, red with a gentle pulse when critical. */
export function StatBar({
  stat,
  value,
  showNumber,
  ticks,
  size = 'slim',
  max = BALANCE.stats.max,
  forecast,
}: StatBarProps) {
  const level = barLevel(stat, value);
  const coming =
    forecast === 1
      ? ' Going up 1 at the end of this phase.'
      : forecast === -1
        ? ' Going down 1 at the end of this phase.'
        : forecast === 'unknown'
          ? ' Depends on what this hiker does this phase.'
          : '';
  const label = `${STAT_META[stat].label} ${value}/${max}.${coming}`;
  const unit = 100 / max;
  const losing = forecast === -1 && value > 0;
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
            width: `${Math.min(100, ((losing ? value - 1 : value) / max) * 100)}%`,
            background: barColor(stat, value),
          }}
        />
        {forecast === 1 && value < max && (
          <span className={styles.gain} style={{ left: `${value * unit}%`, width: `${unit}%` }} />
        )}
        {losing && (
          <span
            className={styles.loss}
            style={{ left: `${(value - 1) * unit}%`, width: `${unit}%` }}
          />
        )}
        {ticks &&
          [BAR_LEVELS[stat].low, BAR_LEVELS[stat].critical].map((t) => (
            <span key={t} className={styles.tick} style={{ left: `${(t / max) * 100}%` }} />
          ))}
      </div>
      {forecast === 'unknown' && <span className={styles.unknown}>?</span>}
      {showNumber && (
        <span className={styles.number} data-level={level}>
          {value}
        </span>
      )}
    </div>
  );
}
