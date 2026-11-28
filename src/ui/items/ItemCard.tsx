/**
 * An item card in the TrailMate style (docs/design/31-trailmate-item-cards.md;
 * mock: docs/mockups/item-cards/cards.html): each card is a little device.
 *
 * - **The shell** in the type's colors (a drink's own, section 4), with
 *   buttons on its sides and a speaker slot; a dark bezel and a green LCD
 *   screen with a grid, scanlines, a vignette and a glare.
 * - **The screen:** a dark strip with the type's icon and name (and the
 *   clothes slot, the tier chip from Tier II), the item's art in LCD greens
 *   inside corner brackets, the name in Edit Undo, the text in Pixelify Sans
 *   (it shrinks to fit: `cardFit.ts`), and the bottom row: Quality and its
 *   diamonds, and the counter word over "3/4".
 * - **The LEDs** under the screen count what's left: one per point of the
 *   full counter, lit for each one left (section 2). Unrolled (a preview, a
 *   blueprint, a Choice pick): lit for the least, rings up to the most, and
 *   "QUALITY ?". A spent one flickers twice and goes dark.
 * - **Tiers** (section 5): a silver trim and II chip at Tier II, gold at III,
 *   a shifting rainbow at IV.
 * - **Compact** (the bag, section 6): a small screen with the art and its LEDs.
 *
 * Every size comes from the card's width (the mock is 220 wide). A Present
 * keeps its wrapping: its picture in full color, its grade in the strip.
 */
import { useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { GRADE_TAG, presentArt } from '../../content/items/presents';
import {
  counterRange,
  hasQuality,
  itemRangeText,
  itemText,
  qualityOf,
  rangeWords,
  type Quality,
} from '../../engine';
import { useGreenArt } from '../packing/greenify';
import { counterOf, type Counters } from './cardCounter';
import { CARD, cardFit } from './cardFit';
import { deviceLook, SLOT_NAME, TIER_LOOK } from './itemLook';
import styles from './ItemCard.module.css';

export interface ItemCardProps {
  itemId: string;
  /** The instance: its Quality and what's left. Without one, Quality 3 and full. */
  item?: Counters;
  /** Shown instead of the instance's Quality (the debug gallery). */
  quality?: Quality;
  width: number;
  /** The bag's small slots: a small screen with the art and the LEDs. */
  compact?: boolean;
  /** Quality not rolled yet: values as ranges across Qualities 1–5. */
  unrolled?: boolean;
  className?: string;
  style?: CSSProperties;
}

const GREEN_PX = BALANCE.ui.itemCards.greenPx;

/** An icon picture as a mask, cropped to its drawing (the type icons sit on a 5:7 canvas). */
const maskOf = (url: string, tight: boolean): CSSProperties => {
  const mask = `url("${url}") ${tight ? 'center / contain' : '50% 40% / 125% 140%'} no-repeat`;
  return { WebkitMask: mask, mask };
};

/** One LED a point: lit for what's left, a ring for what an unrolled item might have, dark when spent. */
function Leds({
  max,
  lit,
  may,
  spent,
  size,
  gap,
  bottom,
}: {
  max: number;
  lit: number;
  may: number;
  spent: { from: number; to: number } | null;
  size: number;
  gap: number;
  bottom: number;
}) {
  if (max <= 0) return null;
  return (
    <span className={styles.leds} style={{ bottom, gap }} aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <i
          key={i}
          data-on={i < lit || undefined}
          data-may={(i >= lit && i < lit + may) || undefined}
          data-spent={(spent && i >= spent.from && i < spent.to) || undefined}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
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
  const look = def ? deviceLook(def) : null;
  const isPresent = def?.type === 'present';
  const artName = def ? (isPresent ? presentArt(item) : def.art) : undefined;
  const green = useGreenArt(artName && !isPresent ? ASSETS.itemArt(artName) : undefined, GREEN_PX);

  // An item with a fixed Quality (or none) has nothing left to roll.
  const unrolled = !!def && unrolledProp && hasQuality(def) && !def.fixedQuality;
  const quality =
    def && hasQuality(def)
      ? unrolled
        ? undefined
        : (shown ?? qualityOf({ itemId, ...(item ?? {}) }))
      : undefined;
  const range = def && unrolled ? counterRange(def) : undefined;
  const { left, max } = range
    ? { left: range.min, max: range.max }
    : counterOf(itemId, item, quality);

  // A use spent: the LEDs it took flicker twice and go dark (Claude's idea).
  const [seen, setSeen] = useState({ itemId, left });
  const [spent, setSpent] = useState<{ from: number; to: number } | null>(null);
  if (seen.itemId !== itemId || seen.left !== left) {
    setSpent(seen.itemId === itemId && left < seen.left ? { from: left, to: seen.left } : null);
    setSeen({ itemId, left });
  }

  if (!def || !look) return null;
  const effect = unrolled ? itemRangeText(def, item?.node) : itemText(def, quality, item?.node);
  const H = Math.round(W * 1.4);
  const tier = isPresent ? null : TIER_LOOK[def.tier];
  const gradeTag = isPresent ? GRADE_TAG[item?.grade ?? 'plain'] : null;
  const shell = {
    '--l': look.light,
    '--d': look.dark,
    '--a': look.bright,
  } as CSSProperties;

  const label = `${def.name}${gradeTag ? `, ${gradeTag}` : !isPresent && def.tier > 1 ? `, Tier ${def.tier}` : ''}${
    unrolled ? ', Quality not rolled yet' : quality ? `, Quality ${quality}` : ''
  }${
    look.count && max
      ? range
        ? `, ${look.count.toLowerCase()} ${rangeWords(range)}`
        : `, ${look.count.toLowerCase()} ${left} of ${max}`
      : ''
  }`;

  /** The art on the screen: green pixels, a full-color Present, or the type's icon until then. */
  const art = (size: number, top: number, left0: number) =>
    isPresent && artName ? (
      <img
        className={styles.present}
        src={ASSETS.itemArt(artName)}
        alt=""
        draggable={false}
        loading="lazy"
        style={{ width: size, height: size, top, left: left0 }}
      />
    ) : green ? (
      <img
        className={styles.art}
        src={green}
        alt=""
        draggable={false}
        style={{ width: size, height: size, top, left: left0 }}
      />
    ) : look.icon ? (
      <span
        className={styles.fallback}
        style={{
          width: size * 0.62,
          height: size * 0.62,
          top: top + size * 0.19,
          left: left0 + size * 0.19,
          ...maskOf(look.icon, look.kind === 'drink'),
        }}
      />
    ) : null;

  // ── Compact: the bag's small screen (48 × 58 in the mock; the slot's size here). ──
  if (compact) {
    const m = W / 48;
    // More than 6 shrink so 9 fit (31, section 6); Tier III clothes have up to 12 (smaller still).
    const led = max > 9 ? [2.5, 1, 4] : max > 6 ? [3.5, 1.5, 3.5] : [5, 2, 3];
    const artSize = 34 * m;
    const screenW = W - 12 * m;
    const screenH = H - 19 * m;
    return (
      <div
        className={`${styles.mini} ${className ?? ''}`}
        data-tier={tier ? def.tier : undefined}
        style={{ ...shell, width: W, height: H, borderRadius: 10 * m, ...style }}
        role="img"
        aria-label={label}
        title={`${def.name}: ${effect}`}
      >
        <div
          className={styles.face}
          style={{ left: 4 * m, right: 4 * m, top: 4 * m, bottom: 11 * m, borderRadius: 6 * m }}
        >
          <div className={styles.miniScreen} style={{ inset: 2 * m, borderRadius: 4 * m }}>
            {art(artSize, (screenH - artSize) / 2, (screenW - artSize) / 2)}
          </div>
        </div>
        <Leds
          max={max}
          lit={left}
          may={range ? range.max - range.min : 0}
          spent={spent}
          size={led[0]! * m}
          gap={led[1]! * m}
          bottom={led[2]! * m}
        />
      </div>
    );
  }

  // ── The full card (220 × 308 in the mock). ──
  const k = W / CARD.width;
  const fit = cardFit(def.name, effect);
  const brackets = { w: fit.art + 14, h: fit.art + 4 };
  const screenW = W - 34 * k;
  const nubs = [
    { left: -4 * k, top: 92 * k, height: 30 * k },
    { left: -4 * k, top: 128 * k, height: 30 * k },
    { right: -4 * k, top: 110 * k, height: 44 * k },
  ];
  return (
    <div
      className={`${styles.card} ${className ?? ''}`}
      data-tier={tier ? def.tier : undefined}
      style={
        {
          ...shell,
          '--k': k,
          width: W,
          height: H,
          borderRadius: 26 * k,
          ...style,
        } as CSSProperties
      }
      role="img"
      aria-label={label}
    >
      {nubs.map((n, i) => (
        <span key={i} className={styles.nub} style={{ ...n, width: 6 * k, borderRadius: 3 * k }} />
      ))}
      <span
        className={styles.speaker}
        style={{ top: 8 * k, width: 38 * k, height: 5 * k, marginLeft: -19 * k }}
      />
      <div
        className={styles.face}
        style={{ left: 10 * k, right: 10 * k, top: 19 * k, bottom: 28 * k, borderRadius: 18 * k }}
      >
        <div
          className={styles.screen}
          style={{ inset: 7 * k, borderRadius: 11 * k, backgroundSize: `${16 * k}px ${16 * k}px` }}
        >
          <div
            className={styles.strip}
            style={{
              left: 6 * k,
              right: 6 * k,
              top: 6 * k,
              height: 20 * k,
              gap: 6 * k,
              padding: `0 ${6 * k}px`,
              borderRadius: 4 * k,
              fontSize: 10 * k,
            }}
          >
            {look.icon && (
              <span
                className={styles.stripIcon}
                style={{
                  width: 12 * k,
                  height: 14 * k,
                  ...maskOf(look.icon, look.kind === 'drink'),
                }}
              />
            )}
            {look.label.toUpperCase()}
            {def.slot && <span className={styles.slot}>· {SLOT_NAME[def.slot].toUpperCase()}</span>}
            {tier && (
              <span
                className={styles.chip}
                style={{ backgroundImage: tier.fill, padding: `${1 * k}px ${5 * k}px` }}
              >
                {tier.numeral}
              </span>
            )}
            {gradeTag && (
              <span className={styles.chip} style={{ padding: `${1 * k}px ${5 * k}px` }}>
                {gradeTag}
              </span>
            )}
          </div>
          <div
            className={styles.brackets}
            style={{
              top: (CARD.artTop - 2) * k,
              left: (screenW - brackets.w * k) / 2,
              width: brackets.w * k,
              height: brackets.h * k,
            }}
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((i) => (
              <i key={i} style={{ width: 16 * k, height: 16 * k, borderWidth: 4 * k }} />
            ))}
          </div>
          {art(fit.art * k, CARD.artTop * k, (screenW - fit.art * k) / 2)}
          <div
            className={styles.name}
            style={{
              top: (CARD.nameTop - fit.lift) * k,
              left: 6 * k,
              right: 6 * k,
              fontSize: fit.nameSize * k,
            }}
          >
            {def.name.toUpperCase()}
          </div>
          <div
            className={styles.text}
            style={{
              top: (CARD.textTop - fit.lift) * k,
              left: 9 * k,
              right: 9 * k,
              fontSize: fit.textSize * k,
            }}
          >
            {effect}
          </div>
          <div
            className={styles.bottom}
            style={{ left: 8 * k, right: 8 * k, bottom: 7 * k, fontSize: 8 * k }}
          >
            <div>
              {unrolled || quality ? (
                <>
                  {unrolled ? 'QUALITY ?' : `QUALITY ${quality}`}
                  <div className={styles.diamonds} style={{ gap: 4 * k, marginTop: 3 * k }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i
                        key={n}
                        data-on={(!!quality && n <= quality) || undefined}
                        style={{ width: 6 * k, height: 6 * k }}
                      />
                    ))}
                  </div>
                </>
              ) : isPresent ? null : (
                'NO QUALITY'
              )}
            </div>
            {look.count && max > 0 ? (
              <div className={styles.count}>
                {look.count}
                <br />
                {range ? rangeWords(range) : `${left}/${max}`}
              </div>
            ) : def.trinket ? (
              <div className={styles.count}>{def.trinket === 'keep' ? 'KEEP' : 'USE'}</div>
            ) : null}
          </div>
        </div>
      </div>
      <Leds
        max={max}
        lit={left}
        may={range ? range.max - range.min : 0}
        spent={spent}
        size={8 * k}
        gap={4 * k}
        bottom={9 * k}
      />
    </div>
  );
}
