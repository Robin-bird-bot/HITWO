/**
 * A square scavenge card built from layers (docs/mockups/ScavCard.dc.html):
 * a blank backdrop, slowly turning rays, then the resource icons, the Game
 * Quotes glyph, the caps or an item back. Face down, it shows where it came
 * from: its node, or the caps or item back, with the pixel texture.
 */
import { SCAVENGE_CARDS } from '../../content';
import { ASSETS } from '../../config/assets';
import type { ScavengeCard } from '../../engine';
import {
  RARITY_LOOK,
  backLayers,
  backName,
  cardItemType,
  cardText,
  cardTitle,
  faceIcons,
  faceLayers,
  resourcesTitle,
} from './cardLook';
import { ItemBack } from './ItemBack';
import styles from './ScavCard.module.css';

/** Where 1, 2 or 3 resource icons sit, as fractions of the card: left, top, width. */
const LAYOUT: Record<number, [number, number, number][]> = {
  1: [[0.18, 0.16, 0.64]],
  2: [
    [0.06, 0.06, 0.54],
    [0.4, 0.4, 0.54],
  ],
  3: [
    [0.04, 0.05, 0.48],
    [0.5, 0.1, 0.46],
    [0.26, 0.47, 0.48],
  ],
};

export interface ScavCardProps {
  card: ScavengeCard;
  /** Card width and height in stage pixels. */
  size: number;
  faceUp: boolean;
  /** Under the card: name, line and rarity ('full', Informative), name and pips ('simple'), or nothing. */
  caption?: 'full' | 'simple' | 'none';
  /** The caption while face down (defaults to "TAP TO FLIP"). */
  backCaption?: string;
  selected?: boolean;
  dim?: boolean;
  /** Show what a Wild card turned out to be. */
  reveal?: boolean;
  onClick?(): void;
}

export function ScavCard({
  card,
  size: S,
  faceUp,
  caption = 'full',
  backCaption = 'TAP TO FLIP',
  selected,
  dim,
  reveal,
  onClick,
}: ScavCardProps) {
  const def = SCAVENGE_CARDS[card.type];
  const revealed = reveal && !!def.glyph && !!card.resources?.length;
  const title = revealed ? resourcesTitle(card.resources ?? []) : cardTitle(card);
  const rarity = RARITY_LOOK[card.rarity];
  const label = faceUp
    ? `${title}: ${cardText(card)}. ${rarity.name}.`
    : `Face-down card from ${backName(card)}. Flip it.`;

  const Tag = onClick ? 'button' : 'div';
  return (
    <div className={styles.wrap} style={{ width: S + 20, opacity: dim ? 0.45 : 1 }}>
      <Tag
        {...(onClick ? { type: 'button' as const, onClick } : {})}
        className={styles.card}
        style={{ width: S, height: S }}
        data-selected={selected ? 'true' : undefined}
        aria-label={label}
        aria-pressed={onClick && faceUp ? !!selected : undefined}
      >
        <div className={styles.flipper} data-face-up={faceUp}>
          <div className={`${styles.face} ${styles.front}`}>
            <Front card={card} size={S} revealed={!!revealed} />
          </div>
          <div className={`${styles.face} ${styles.back}`}>
            <Back card={card} size={S} />
          </div>
        </div>
      </Tag>
      {caption !== 'none' && (
        <div className={styles.caption}>
          <span className={styles.name} data-selected={selected ? 'true' : undefined}>
            {faceUp ? title : backCaption}
          </span>
          {faceUp && caption === 'full' && <span className={styles.text}>{cardText(card)}</span>}
          {faceUp && (
            <span className={styles.rarity} title={rarity.name}>
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className={styles.pip}
                  style={{ background: i < rarity.pips ? rarity.color : undefined }}
                />
              ))}
              {caption === 'full' && <span style={{ color: rarity.color }}>{rarity.name}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Rays({
  src,
  size,
  opacity,
  spin,
}: {
  src: string;
  size: number;
  opacity: number;
  spin: boolean;
}) {
  const ray = Math.round(size * 1.45);
  const off = Math.round((size - ray) / 2);
  return (
    <img
      className={styles.rays}
      data-spin={spin}
      src={src}
      alt=""
      draggable={false}
      style={{ left: off, top: off, width: ray, height: ray, opacity }}
    />
  );
}

function Front({
  card,
  size: S,
  revealed,
}: {
  card: ScavengeCard;
  size: number;
  revealed: boolean;
}) {
  const def = SCAVENGE_CARDS[card.type];
  const layers = faceLayers(card);
  const resources = card.resources ?? [];
  const icons = revealed
    ? (def.mult ? resources.slice(0, 1) : resources).map((id) => ASSETS.resources[id] ?? '')
    : faceIcons(card);
  const lay = LAYOUT[Math.min(icons.length, 3)] ?? [];
  const itemType = cardItemType(card);
  const glyph = !revealed ? def.glyph : undefined;
  const badge = Math.max(12, Math.round(S * 0.085));

  return (
    <>
      <img className={styles.fill} src={layers.bg} alt="" draggable={false} />
      {layers.bg2 && (
        <img
          className={`${styles.fill} ${styles.diagonal}`}
          src={layers.bg2}
          alt=""
          draggable={false}
        />
      )}
      <Rays src={layers.rays} size={S} opacity={layers.rayOpacity} spin />

      {icons.slice(0, 3).map((src, i) => {
        const [l, t, w] = lay[i] ?? [0, 0, 0];
        return (
          <img
            key={i}
            className={styles.icon}
            src={src}
            alt=""
            draggable={false}
            style={{
              left: Math.round(l * S),
              top: Math.round(t * S),
              width: Math.round(w * S),
              height: Math.round(w * S),
            }}
          />
        );
      })}

      {glyph && (
        <div
          className={styles.glyph}
          style={{
            fontSize: Math.round(S * (glyph.length > 1 ? 0.46 : 0.56)),
            letterSpacing: Math.round(S * (glyph.length > 1 ? -0.02 : 0)),
          }}
        >
          {glyph}
        </div>
      )}

      {card.type === 'caps' && (
        <img
          className={styles.icon}
          src={ASSETS.icons.acornCaps}
          alt=""
          draggable={false}
          style={{
            left: Math.round(S * 0.17),
            top: Math.round(S * 0.14),
            width: Math.round(S * 0.66),
            height: Math.round(S * 0.66),
          }}
        />
      )}

      {itemType && !def.choiceItem && (
        <ItemBack
          type={itemType}
          width={Math.round(S * 0.5)}
          style={{
            position: 'absolute',
            left: Math.round(S * 0.25),
            top: Math.round(S * 0.15),
            transform: 'rotate(-6deg)',
          }}
        />
      )}
      {itemType && def.choiceItem && <Fan type={itemType} size={S} />}

      <div className={styles.border} />
      {def.mult && (
        <span className={styles.badge} style={{ right: 8, top: 8, fontSize: badge }}>
          ×{def.mult}
        </span>
      )}
      {card.type === 'caps' && card.caps !== undefined && (
        <span className={styles.badge} style={{ right: 8, bottom: 8, fontSize: badge }}>
          +{card.caps}
        </span>
      )}
      {def.choiceItem && (
        <span
          className={styles.corner}
          style={{
            width: Math.round(S * 0.2),
            height: Math.round(S * 0.2),
            fontSize: Math.round(S * 0.13),
          }}
        >
          !
        </span>
      )}
    </>
  );
}

/** Choice item cards: three item backs fanned out. */
function Fan({ type, size: S }: { type: Parameters<typeof ItemBack>[0]['type']; size: number }) {
  const w = Math.round(S * 0.34);
  const rot = [-14, 0, 14];
  return (
    <>
      {rot.map((r, i) => (
        <ItemBack
          key={i}
          type={type}
          width={w}
          style={{
            position: 'absolute',
            left: Math.round(S / 2 - w / 2 + (i - 1) * w * 0.62),
            top: Math.round(S * 0.24),
            transform: `rotate(${r}deg)`,
            transformOrigin: '50% 90%',
          }}
        />
      ))}
    </>
  );
}

function Back({ card, size: S }: { card: ScavengeCard; size: number }) {
  const back = backLayers(card);
  const hexW = Math.round(S * 0.46);
  const hexH = Math.round(hexW * 1.15);
  return (
    <>
      <img className={styles.fill} src={back.bg} alt="" draggable={false} />
      <Rays src={back.rays} size={S} opacity={back.rayOpacity} spin={false} />
      <div className={styles.shade} />
      <div
        className={styles.texture}
        style={{ backgroundImage: `url(${ASSETS.textures.halftone})` }}
      />
      {back.fullIcon ? (
        <img className={`${styles.fill} ${styles.hex}`} src={back.icon} alt="" draggable={false} />
      ) : (
        <img
          className={`${styles.icon} ${styles.hex}`}
          src={back.icon}
          alt=""
          draggable={false}
          style={{
            left: Math.round((S - hexW) / 2),
            top: Math.round((S - hexH) / 2),
            width: hexW,
            height: hexH,
          }}
        />
      )}
      <div className={styles.border} />
    </>
  );
}
