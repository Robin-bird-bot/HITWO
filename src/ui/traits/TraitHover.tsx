/**
 * A trait badge's hover window (docs/mockups/TraitBadges.dc.html): the name,
 * the type, what it does, and its status right now as a colored line.
 */
import type { CSSProperties } from 'react';
import { badgeColors, type BadgeInfo } from './badges';
import styles from './TraitHover.module.css';

export function TraitHover({ badge }: { badge: BadgeInfo }) {
  const colors = badgeColors(badge);
  const vars = { '--ring': colors.ring, '--fill': colors.fill } as CSSProperties;
  return (
    <div className={styles.hover} style={vars}>
      <div className={styles.head}>
        <span className={styles.name}>{badge.name.toUpperCase()}</span>
        <span className={styles.kind}>{badge.kindWord.toUpperCase()}</span>
      </div>
      <span className={styles.text}>{badge.text}</span>
      {badge.status && (
        <span className={styles.status} data-tone={badge.status.tone}>
          {badge.status.text}
        </span>
      )}
      {badge.state === 'ready' && <span className={styles.hint}>Tap it to use it.</span>}
    </div>
  );
}
