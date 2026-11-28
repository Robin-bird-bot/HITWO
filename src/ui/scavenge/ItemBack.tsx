/**
 * An item card's back in the TrailMate style (docs/design/31-trailmate-item-cards.md,
 * section 3): a walkie-talkie's. The shell in the type's colors with a rubber
 * rim, grip ridges down both sides, four screws, the type's icon embossed big
 * as the logo, "TRAILMATE" and "TOOL · SUPPLY" embossed under it, and a
 * speaker grille. Shown wherever a card is face down (scavenge deals before
 * they flip, crafting choices). Sizes come from the width (the mock's is 220).
 */
import type { CSSProperties } from 'react';
import type { ItemType } from '../../engine';
import { deviceLook } from '../items/itemLook';
import styles from './ItemBack.module.css';

export function ItemBack({
  type,
  width,
  style,
}: {
  type: ItemType;
  width: number;
  style?: CSSProperties;
}) {
  const look = deviceLook({ type });
  const k = width / 220;
  const mask = look.icon
    ? `url("${look.icon}") ${look.kind === 'drink' ? 'center / contain' : '50% 40% / 125% 140%'} no-repeat`
    : undefined;
  const logo = mask ? ({ WebkitMask: mask, mask } as CSSProperties) : undefined;
  const nubs = [
    { right: -4 * k, top: 92 * k, height: 30 * k },
    { right: -4 * k, top: 128 * k, height: 30 * k },
    { left: -4 * k, top: 110 * k, height: 44 * k },
  ];
  const screws = [
    { left: 16 * k, top: 16 * k },
    { right: 16 * k, top: 16 * k },
    { left: 16 * k, bottom: 16 * k },
    { right: 16 * k, bottom: 16 * k },
  ];
  return (
    <div
      className={styles.back}
      style={
        {
          '--l': look.light,
          '--d': look.dark,
          '--k': k,
          width,
          height: Math.round(width * 1.4),
          borderRadius: 26 * k,
          ...style,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {nubs.map((n, i) => (
        <span key={i} className={styles.nub} style={{ ...n, width: 6 * k, borderRadius: 3 * k }} />
      ))}
      <span
        className={styles.speaker}
        style={{ bottom: 8 * k, width: 38 * k, height: 5 * k, marginLeft: -19 * k }}
      />
      <span
        className={styles.grip}
        style={{ left: 9 * k, top: 46 * k, bottom: 46 * k, width: 10 * k }}
      />
      <span
        className={styles.grip}
        style={{ right: 9 * k, top: 46 * k, bottom: 46 * k, width: 10 * k }}
      />
      {screws.map((s, i) => (
        <span key={i} className={styles.screw} style={{ ...s, width: 9 * k, height: 9 * k }} />
      ))}
      {logo && (
        <span
          className={styles.logo}
          style={{ top: 34 * k, width: 74 * k, height: 96 * k, marginLeft: -37 * k }}
        >
          <i className={styles.hi} style={logo} />
          <i className={styles.lo} style={logo} />
          <i className={styles.mid} style={logo} />
        </span>
      )}
      <span className={styles.word} style={{ top: 140 * k, fontSize: 12 * k }}>
        TRAILMATE
      </span>
      <span className={styles.kind} style={{ top: 158 * k, fontSize: 8 * k }}>
        {look.label.toUpperCase()} · SUPPLY
      </span>
      <span
        className={styles.grille}
        style={{
          left: 26 * k,
          right: 26 * k,
          top: 182 * k,
          bottom: 26 * k,
          borderRadius: 14 * k,
          padding: `${8 * k}px 0`,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} style={{ height: 9 * k, borderRadius: 5 * k }} />
        ))}
      </span>
    </div>
  );
}
