/**
 * An item card's front (docs/mockups/ItemCard.dc.html, ItemCardAnatomy.dc.html):
 *
 * - the front background, with the item's art in its cloud window over the
 *   type's slowly turning rays;
 * - the tier numeral at the top (none for Tier I; II silver, III gold, IV
 *   prismatic);
 * - the title in Edit Undo, the type (and slot), and the effect in DM Sans,
 *   written with this card's Quality values;
 * - Quality diamonds, and the USES, DURABILITY, BITES or NIGHTS counter:
 *   filled pips are what's left.
 *
 * Every size comes from the card's width, like the mockup (k = width / 300).
 * A compact card (the bag's small slots) keeps the art, tier and counter.
 */
import type { CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import {
  fullCounters,
  hasQuality,
  itemText,
  qualityOf,
  type ItemInstance,
  type Quality,
} from '../../engine';
import { SLOT_NAME, TIER_LOOK, TYPE_LOOK } from './itemLook';
import styles from './ItemCard.module.css';

type Counters = Pick<ItemInstance, 'quality' | 'usesLeft' | 'bitesLeft' | 'durability'>;

export interface ItemCardProps {
  itemId: string;
  /** The instance: its Quality and what's left. Without one, Quality 3 and full. */
  item?: Counters;
  /** Shown instead of the instance's Quality (the debug gallery). */
  quality?: Quality;
  width: number;
  /** The bag's small slots: art, tier and counter only. */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** What's left and the most there can be, for the counter. */
function counter(itemId: string, item: Counters | undefined, quality: Quality | undefined) {
  const def = ITEMS[itemId];
  if (!def) return { left: 0, max: 0 };
  if (def.type === 'shelter') return { left: def.nights ?? 0, max: def.nights ?? 0 };
  const full = fullCounters(def, quality);
  const max = full.usesLeft ?? full.bitesLeft ?? full.durability ?? 0;
  const own = item?.usesLeft ?? item?.bitesLeft ?? item?.durability;
  return { left: Math.min(max, own ?? max), max };
}

export function ItemCard({
  itemId,
  item,
  quality: shown,
  width: W,
  compact = false,
  className,
  style,
}: ItemCardProps) {
  const def = ITEMS[itemId];
  if (!def) return null;
  const look = TYPE_LOOK[def.type];
  const quality = hasQuality(def) ? (shown ?? qualityOf({ itemId, ...(item ?? {}) })) : undefined;
  const H = Math.round(W * 1.4);
  const k = W / 300;
  const tier = TIER_LOOK[def.tier];
  const { left, max } = counter(itemId, item, quality);

  // The art window: the cloud area of the front background (upper ~55%).
  const art = compact
    ? { l: W * 0.06, t: H * 0.07, w: W * 0.88, h: H * 0.62 }
    : { l: W * 0.08, t: H * 0.09, w: W * 0.84, h: H * 0.46 };
  const raySize = art.w * 1.6;
  const artSize = Math.min(art.w, art.h) * 0.94;
  const pip = Math.max(compact ? 4 : 5, Math.round(12 * k));
  const bar = Math.max(3, Math.round((max > 8 ? 5 : 7) * k));
  const pipRow = Math.max(compact ? 5 : 6, Math.round(14 * k));

  const pips = Array.from({ length: max }, (_, i) => {
    const on = i < left;
    const shape = look.shape;
    const w = shape === 'bar' ? bar : pip;
    const h = shape === 'bar' ? pipRow : pip;
    return (
      <span
        key={i}
        className={styles.pip}
        style={{
          width: w,
          height: h,
          borderRadius: shape === 'circle' ? '50%' : shape === 'bar' ? 2 : 3,
          background: on ? look.accent : 'transparent',
          boxShadow: on ? 'none' : `inset 0 0 0 ${Math.max(1, 1.5 * k)}px rgba(255,255,255,0.35)`,
        }}
      />
    );
  });

  const label = `${def.name}${def.tier > 1 ? `, Tier ${def.tier}` : ''}${
    quality ? `, Quality ${quality}` : ''
  }${look.count && max ? `, ${look.count.toLowerCase()} ${left} of ${max}` : ''}`;

  return (
    <div
      className={`${styles.card} ${className ?? ''}`}
      style={{ width: W, height: H, borderRadius: Math.round(W * 0.075), ...style }}
      role="img"
      aria-label={label}
      title={compact ? `${def.name}: ${itemText(def, quality)}` : undefined}
    >
      <img className={styles.front} src={ASSETS.itemCards.front} alt="" draggable={false} />
      <div
        className={styles.window}
        style={{ left: art.l, top: art.t, width: art.w, height: art.h }}
        aria-hidden="true"
      >
        <img
          className={styles.rays}
          src={ASSETS.itemCards.rays[def.type]}
          alt=""
          draggable={false}
          style={{
            width: raySize,
            height: raySize,
            left: (art.w - raySize) / 2,
            top: (art.h - raySize) / 2,
          }}
        />
      </div>
      {def.art ? (
        <img
          className={styles.art}
          src={ASSETS.itemArt(def.art)}
          alt=""
          draggable={false}
          loading="lazy"
          style={{
            width: artSize,
            height: artSize,
            left: art.l + (art.w - artSize) / 2,
            top: art.t + (art.h - artSize) / 2,
          }}
        />
      ) : (
        <img
          className={styles.art}
          src={ASSETS.itemCards.typeIcons[def.type]}
          alt=""
          draggable={false}
          style={{ width: W * 0.62, height: H * 0.62, left: W * 0.19, top: H * 0.32 - H * 0.31 }}
        />
      )}
      {tier && (
        <span
          className={styles.tier}
          aria-hidden="true"
          style={{
            top: Math.round(H * 0.03),
            fontSize: Math.max(compact ? 7 : 8, Math.round(W * 0.1)),
            backgroundImage: tier.fill,
          }}
        >
          {tier.numeral}
        </span>
      )}
      {compact ? (
        max > 0 && (
          <span
            className={styles.compactPips}
            aria-hidden="true"
            style={{ bottom: Math.round(H * 0.06), gap: Math.max(1, Math.round(4 * k)) }}
          >
            {pips}
          </span>
        )
      ) : (
        <div
          className={styles.text}
          aria-hidden="true"
          style={{
            left: Math.round(W * 0.09),
            right: Math.round(W * 0.09),
            top: Math.round(H * 0.575),
            bottom: Math.round(H * 0.055),
            gap: Math.max(2, Math.round(4 * k)),
          }}
        >
          <span className={styles.name} style={{ fontSize: Math.max(10, Math.round(24 * k)) }}>
            {def.name}
          </span>
          <span
            className={styles.type}
            style={{ fontSize: Math.max(7, Math.round(12 * k)), color: look.accent }}
          >
            {look.label}
            {def.slot ? ` · ${SLOT_NAME[def.slot]}` : ''}
          </span>
          <span className={styles.effect} style={{ fontSize: Math.max(8, Math.round(14.5 * k)) }}>
            {itemText(def, quality)}
          </span>
          <span className={styles.spacer} />
          <div className={styles.bottom}>
            {quality ? (
              <div className={styles.meter} style={{ gap: Math.max(1, Math.round(3 * k)) }}>
                <span className={styles.tiny} style={{ fontSize: Math.max(6, Math.round(10 * k)) }}>
                  QUALITY
                </span>
                <span
                  className={styles.diamonds}
                  style={{ gap: Math.max(3, Math.round(7 * k)), height: pipRow }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={styles.diamond}
                      style={{
                        width: Math.max(4, Math.round(9 * k)),
                        height: Math.max(4, Math.round(9 * k)),
                        background: n <= quality ? '#E9B44C' : 'rgba(255,255,255,0.18)',
                      }}
                    />
                  ))}
                </span>
              </div>
            ) : (
              <span
                className={styles.noQuality}
                style={{ fontSize: Math.max(7, Math.round(12 * k)) }}
              >
                No quality
              </span>
            )}
            {look.count && max > 0 ? (
              <div
                className={`${styles.meter} ${styles.right}`}
                style={{ gap: Math.max(1, Math.round(3 * k)) }}
              >
                <span className={styles.tiny} style={{ fontSize: Math.max(6, Math.round(10 * k)) }}>
                  {look.count} {left}/{max}
                </span>
                <span
                  className={styles.pips}
                  style={{ gap: Math.max(2, Math.round(4 * k)), height: pipRow }}
                >
                  {pips}
                </span>
              </div>
            ) : def.trinket ? (
              <span className={styles.meta} style={{ fontSize: Math.max(7, Math.round(12 * k)) }}>
                {def.trinket === 'keep' ? 'KEEP' : 'USE'}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
