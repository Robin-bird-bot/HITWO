/**
 * A hiker's morale type on their name banner (Phase 10.7): its placeholder
 * symbol, and on hover its rule ("+1: 3 or more hikers on the tile. −1:
 * Alone."). Wyatt is painting the real symbols.
 */
import { MORALE_TYPES, moraleRule } from '../../content/moraleTypes';
import type { MoraleTypeId } from '../../engine';
import { useTooltip } from '../layout/Tooltip';
import { Glyph } from './classGlyphs';
import { MORALE_GLYPHS } from './glyphPaths';
import styles from './Trails.module.css';

export function MoraleTypeMark({ type, size = 14 }: { type: MoraleTypeId; size?: number }) {
  const def = MORALE_TYPES[type];
  const t = useTooltip(
    <>
      <span className={styles.tipName}>{def.name.toUpperCase()}</span>
      <span className={styles.tipText}>{moraleRule(def)}</span>
    </>,
    { className: styles.tip },
  );
  return (
    <>
      <span
        className={styles.moraleMark}
        aria-label={`${def.name}. ${moraleRule(def)}`}
        role="img"
        tabIndex={0}
        {...(t.inline ? { title: `${def.name}. ${moraleRule(def)}` } : t.anchor)}
      >
        <Glyph path={MORALE_GLYPHS[type]} size={size} color="#CDA6EE" strokeWidth={2} />
      </span>
      {t.tip}
    </>
  );
}
