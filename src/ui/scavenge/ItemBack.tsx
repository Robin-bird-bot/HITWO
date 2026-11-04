/**
 * A small item card back (docs/ASSETS.md, "Item card layers", Back): the
 * type's gradient, its rays, the pixel texture and the white type icon. Used
 * on Item find and Choice item scavenge cards.
 */
import type { CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import type { ItemType } from '../../engine';
import { ITEM_TYPE_COLORS } from './cardLook';
import styles from './ScavCard.module.css';

export function ItemBack({
  type,
  width,
  style,
}: {
  type: ItemType;
  width: number;
  style?: CSSProperties;
}) {
  const colors = ITEM_TYPE_COLORS[type];
  return (
    <div
      className={styles.itemBack}
      style={{
        width,
        height: Math.round((width * 7) / 5),
        borderRadius: Math.max(4, Math.round(width * 0.06)),
        background: `linear-gradient(155deg, ${colors.join(', ')})`,
        ...style,
      }}
    >
      <img className={styles.itemRays} src={ASSETS.itemCards.rays[type]} alt="" draggable={false} />
      <div
        className={styles.itemTexture}
        style={{ backgroundImage: `url(${ASSETS.textures.halftone})` }}
      />
      <img
        className={styles.itemIcon}
        src={ASSETS.itemCards.typeIcons[type]}
        alt=""
        draggable={false}
      />
    </div>
  );
}
