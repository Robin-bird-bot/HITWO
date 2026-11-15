/**
 * The biome's one Abundance bar (Nov 14 update), in place of the four node
 * meters. Simple mode shows just the bar; Informative mode adds the number.
 * Hover (or focus) for the Empty-card chance.
 */
import { BALANCE } from '../../config/balance';
import { abundanceColor, abundanceTip } from './abundanceLook';
import styles from './AbundanceBar.module.css';

export function AbundanceBar({
  level,
  showNumber,
  width,
}: {
  level: number;
  showNumber: boolean;
  /** The bar's width in stage pixels (it fills its space without one). */
  width?: number;
}) {
  const tip = abundanceTip(level);
  const color = abundanceColor(level);
  return (
    <span
      className={styles.bar}
      role="meter"
      tabIndex={0}
      aria-label="Abundance"
      aria-valuemin={0}
      aria-valuemax={BALANCE.abundance.max}
      aria-valuenow={level}
      aria-valuetext={tip}
      title={tip}
      style={width ? { width } : undefined}
    >
      <span className={styles.track}>
        <span
          className={styles.fill}
          style={{ width: `${(level / BALANCE.abundance.max) * 100}%`, background: color }}
        />
      </span>
      {showNumber && (
        <span className={styles.value} style={{ color }}>
          {level}
        </span>
      )}
    </span>
  );
}
