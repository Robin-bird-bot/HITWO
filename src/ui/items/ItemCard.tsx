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
 *
 * Unrolled (Nov 14 update): an item whose Quality isn't rolled yet (a
 * blueprint, a Choice pick, an item named in text) reads its values as
 * ranges across Qualities 1–5 ("2–4 bites"), with Quality "?".
 *
 * A Present (holiday hikers) shows its own wrapping, no tier numeral and no
 * Quality; a Tier 2+ or Tier 3 one has a small tag where the numeral sits.
 */
import type { CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import { GRADE_TAG, presentArt } from '../../content/items/presents';
import {
  counterRange,
  fullCounters,
  hasQuality,
  itemRangeText,
  itemText,
  qualityOf,
  rangeWords,
  type ItemInstance,
  type Quality,
} from '../../engine';
import { DRINK_LOOK, SLOT_NAME, TIER_LOOK, TYPE_LOOK } from './itemLook';
import styles from './ItemCard.module.css';

type Counters = Pick<
  ItemInstance,
  | 'quality'
  | 'usesLeft'
  | 'bitesLeft'
  | 'durability'
  | 'deploymentsLeft'
  | 'node'
  | 'colorway'
  | 'grade'
>;

export interface ItemCardProps {
  itemId: string;
  /** The instance: its Quality and what's left. Without one, Quality 3 and full. */
  item?: Counters;
  /** Shown instead of the instance's Quality (the debug gallery). */
  quality?: Quality;
  width: number;
  /** The bag's small slots: art, tier and counter only. */
  compact?: boolean;
  /** Quality not rolled yet: values as ranges across Qualities 1–5. */
  unrolled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Long effect text (a range preview, say) shrinks a little so the Quality and
 * counter row stays on the card: full size up to FIT_CHARS characters.
 */
const FIT_CHARS = 120;
const textFit = (text: string) =>
  text.length <= FIT_CHARS ? 1 : Math.max(0.7, Math.sqrt(FIT_CHARS / text.length));

/** What's left and the most there can be, for the counter. */
function counter(itemId: string, item: Counters | undefined, quality: Quality | undefined) {
  const def = ITEMS[itemId];
  if (!def) return { left: 0, max: 0 };
  // Shelters (Phase 10.6): the times it can still be set up.
  if (def.type === 'shelter') {
    const max = def.deployments ?? 0;
    return { left: Math.min(max, item?.deploymentsLeft ?? max), max };
  }
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
  unrolled: unrolledProp = false,
  className,
  style,
}: ItemCardProps) {
  const def = ITEMS[itemId];
  if (!def) return null;
  const look = def.drink ? DRINK_LOOK : TYPE_LOOK[def.type];
  // An item with a fixed Quality (or none) has nothing left to roll.
  const unrolled = unrolledProp && hasQuality(def) && !def.fixedQuality;
  const quality = hasQuality(def)
    ? unrolled
      ? undefined
      : (shown ?? qualityOf({ itemId, ...(item ?? {}) }))
    : undefined;
  const H = Math.round(W * 1.4);
  const k = W / 300;
  const isPresent = def.type === 'present';
  // A Present has no tier: a Tier 2+ or Tier 3 one shows a small tag there instead.
  const tier = isPresent ? null : TIER_LOOK[def.tier];
  const gradeTag = isPresent ? GRADE_TAG[item?.grade ?? 'plain'] : null;
  const artName = isPresent ? presentArt(item) : def.art;
  const range = unrolled ? counterRange(def) : undefined;
  const { left, max } = range
    ? { left: range.min, max: range.max }
    : counter(itemId, item, quality);
  const effect = unrolled ? itemRangeText(def, item?.node) : itemText(def, quality, item?.node);

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
          // Unrolled: the pips a better Quality might add are dashed.
          boxShadow: on
            ? 'none'
            : `inset 0 0 0 ${Math.max(1, 1.5 * k)}px rgba(255,255,255,${range ? 0.6 : 0.35})`,
          ...(range && !on ? { opacity: 0.7 } : {}),
        }}
      />
    );
  });

  const label = `${def.name}${gradeTag ? `, ${gradeTag}` : !isPresent && def.tier > 1 ? `, Tier ${def.tier}` : ''}${
    unrolled ? ', Quality not rolled yet' : quality ? `, Quality ${quality}` : ''
  }${
    look.count && max
      ? range
        ? `, ${look.count.toLowerCase()} ${rangeWords(range)}`
        : `, ${look.count.toLowerCase()} ${left} of ${max}`
      : ''
  }`;

  return (
    <div
      className={`${styles.card} ${className ?? ''}`}
      style={{ width: W, height: H, borderRadius: Math.round(W * 0.075), ...style }}
      role="img"
      aria-label={label}
      title={compact ? `${def.name}: ${effect}` : undefined}
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
      {artName ? (
        <img
          className={styles.art}
          src={ASSETS.itemArt(artName)}
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
      {gradeTag && (
        <span
          className={styles.gradeTag}
          aria-hidden="true"
          style={{
            top: Math.round(H * 0.03),
            fontSize: Math.max(compact ? 6 : 7, Math.round(W * 0.055)),
            padding: `${Math.max(1, Math.round(2 * k))}px ${Math.max(3, Math.round(8 * k))}px`,
            borderRadius: Math.max(3, Math.round(6 * k)),
          }}
        >
          {gradeTag}
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
          <span
            className={styles.effect}
            style={{ fontSize: Math.max(8, Math.round(14.5 * k * textFit(effect))) }}
          >
            {effect}
          </span>
          <span className={styles.spacer} />
          <div className={styles.bottom}>
            {unrolled ? (
              <div className={styles.meter} style={{ gap: Math.max(1, Math.round(3 * k)) }}>
                <span className={styles.tiny} style={{ fontSize: Math.max(6, Math.round(10 * k)) }}>
                  QUALITY ?
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
                        background: 'rgba(233,180,76,0.35)',
                      }}
                    />
                  ))}
                </span>
              </div>
            ) : quality ? (
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
            ) : isPresent ? (
              // No Quality pips on a Present: what's inside is rolled when it's opened.
              <span />
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
                  {look.count}{' '}
                  {range
                    ? rangeWords(range)
                    : def.type === 'shelter'
                      ? `${left} LEFT`
                      : `${left}/${max}`}
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
