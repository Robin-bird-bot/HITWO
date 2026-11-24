/**
 * The hiker card (Phase 10b, docs/mockups/HikerCards.png): one component for
 * the selection screen, its spots and anywhere else a whole hiker shows.
 * Laid out at 300 × 420 and scaled as a whole.
 *
 * - **Front:** the portrait window, the name and "TITLE", the role tabs, the
 *   trait badges (hover or long-press one for its window) and the STARTING
 *   BAG tab (hover it for the bag).
 * - **Back:** a strip of the portrait, the name, the roles, one row per trait
 *   spelled out, then the starting bag.
 * - A click (or Space) turns it over. Hovering a turned card lifts it to the
 *   middle of the screen, larger; on a phone, a long-press does.
 */
import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { BALANCE } from '../../config/balance';
import { mergeHandlers } from '../app/mergeHandlers';
import { PreviewContext, usePreview, withPreview } from '../preview/preview';
import { BADGE_COLORS } from '../traits/badges';
import { TraitBadge } from '../traits/TraitBadge';
import { traitIconUrl } from '../traits/traitIcons';
import { cardFor, cardForStart, type CardRow, type CardTree, type HikerCardData } from './cardData';
import styles from './HikerCard.module.css';
import { useFit } from './fitText';
import { FamilyMark, HikerPortrait } from './HikerPortrait';

/** The card's own size; `scale` sizes it everywhere else. */
export const CARD_W = 300;
export const CARD_H = 420;

/** An open slot's row on the back. */
const OPEN_ROW = { ring: '#55524B', fill: '#3A3833' } as const;

export function HikerCard({
  hikerId,
  scale = 1,
  side,
  flipped: flippedProp,
  defaultFlipped = false,
  onFlip,
  onEnter,
  lift = true,
  className,
  rootProps,
  children,
  start,
}: {
  /** A roster id. */
  hikerId: string;
  scale?: number;
  /** Draw only this side, with nothing to click (the lifted card, galleries). */
  side?: 'front' | 'back';
  /** Turned over, when the parent keeps track; otherwise the card does. */
  flipped?: boolean;
  /** Starts turned over (when the card keeps track). */
  defaultFlipped?: boolean;
  onFlip?(flipped: boolean): void;
  /** Enter on the card (the selection screen adds it to the party); otherwise Enter flips it. */
  onEnter?(): void;
  /** Hovering the turned card lifts it to the middle. */
  lift?: boolean;
  className?: string | undefined;
  /** More props for the card (a drag source's handlers, data attributes). */
  rootProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>;
  /** Drawn over the card, unscaled (tags like IN PARTY). */
  children?: ReactNode;
  /** BY STARTING TRAIT (Phase 10.7): show only this tree's class and starting trait. */
  start?: string | undefined;
}) {
  const [own, setOwn] = useState(defaultFlipped);
  const flipped = side ? side === 'back' : (flippedProp ?? own);
  const data = start ? cardForStart(hikerId, start) : cardFor(hikerId);
  const preview = usePreview(!side && lift && flipped ? { kind: 'hiker', hikerId } : null);
  const liftSoon = useLiftSoon(hikerId);
  if (!data) return null;

  const box = { width: CARD_W * scale, height: CARD_H * scale };
  // A locked hiker (Phase 10.7): a silhouette and "Locked". Nothing to flip, hover or pick.
  if (data.locked) {
    return (
      <div
        className={className ? `${styles.card} ${className}` : styles.card}
        style={box}
        aria-label="Locked hiker"
        data-locked
      >
        <div className={styles.scaler} style={{ transform: `scale(${scale})` }}>
          <div className={styles.static}>
            <Locked data={data} />
          </div>
        </div>
        {children}
      </div>
    );
  }
  const inner = (
    <div className={styles.scaler} style={{ transform: `scale(${scale})` }}>
      {side ? (
        <div className={styles.static}>
          {side === 'front' ? <Front data={data} /> : <Back data={data} />}
        </div>
      ) : (
        <div
          className={styles.flipper}
          data-flipped={flipped || undefined}
          style={{ '--flip-ms': `${BALANCE.ui.cardFlipMs}ms` } as CSSProperties}
        >
          <div className={styles.front} aria-hidden={flipped || undefined}>
            <Front data={data} />
          </div>
          <div className={styles.back} aria-hidden={!flipped || undefined}>
            <Back data={data} />
          </div>
        </div>
      )}
    </div>
  );
  if (side) {
    return (
      <div className={className ? `${styles.card} ${className}` : styles.card} style={box}>
        {inner}
        {children}
      </div>
    );
  }

  const flip = () => {
    const next = !flipped;
    if (flippedProp === undefined) setOwn(next);
    onFlip?.(next);
    return next;
  };
  // Turned over with a mouse that stays on it: it lifts, as if just hovered.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const turned = flip();
    const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch';
    liftSoon(turned && lift && !touch ? e.currentTarget : null);
  };
  const handlers = withPreview(
    mergeHandlers<HTMLAttributes<HTMLDivElement>>(
      {
        onClick,
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === ' ' || (e.key === 'Enter' && !onEnter)) {
            e.preventDefault();
            flip();
          } else if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        },
      },
      rootProps ?? {},
    ),
    preview,
  );
  const label = `${data.label} ${flipped ? 'Showing the back.' : 'Click to turn it over.'}`;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={label}
      {...handlers}
      className={[styles.card, styles.live, className, rootProps?.className]
        .filter(Boolean)
        .join(' ')}
      style={{ ...box, ...rootProps?.style }}
    >
      {inner}
      {children}
    </div>
  );
}

/**
 * Lifts a card that was just turned over, after the usual hover delay, if
 * the pointer is still on it. `null` cancels.
 */
function useLiftSoon(hikerId: string) {
  const previews = useContext(PreviewContext);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (el: HTMLElement | null) => {
    window.clearTimeout(timer.current);
    if (!el || !previews) return;
    timer.current = window.setTimeout(() => {
      if (el.isConnected && el.matches(':hover')) {
        previews.show({ kind: 'hiker', hikerId }, el, false);
      }
    }, BALANCE.ui.previewHoverMs);
  };
}

/** The name and title shrink to fit the band. */
export function FitLine({
  text,
  size,
  className,
}: {
  text: string;
  size: number;
  className: string | undefined;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useFit(ref, text, { mode: 'width', base: size, min: size * 0.4, pad: 24 });
  return (
    <span ref={ref} className={className} style={{ fontSize: size }}>
      {text}
    </span>
  );
}

function Roles({ data, top }: { data: HikerCardData; top: number }) {
  return (
    <div className={styles.roles} style={{ top }}>
      {data.roles.map((r) => (
        <span key={r.id} className={styles.role} style={{ background: r.color }}>
          {r.name}
        </span>
      ))}
    </div>
  );
}

function Front({ data }: { data: HikerCardData }) {
  const colW = Math.min(74, 280 / Math.max(1, data.badges.length));
  return (
    <>
      <div className={styles.window}>
        <HikerPortrait
          hikerId={data.id}
          view="window"
          aspect={CARD_W / 250}
          className={styles.portrait}
        />
        <FamilyMark icon={data.family} className={styles.family} />
        {data.variant && <FamilyMark icon="variant" className={styles.star} />}
      </div>
      <div className={styles.nameBand}>
        <FitLine text={data.name.toUpperCase()} size={30} className={styles.name} />
        {data.title && <FitLine text={data.title} size={19} className={styles.title} />}
      </div>
      <Roles data={data} top={302} />
      <div className={styles.badges}>
        {data.badges.map((b) => (
          <span key={b.slot} className={styles.badgeCol} style={{ width: colW }}>
            <TraitBadge badge={b} size="card" showName as="span" passClick />
          </span>
        ))}
      </div>
      <span className={styles.bagTab} style={{ background: data.mainColor }}>
        STARTING BAG
        <span className={styles.bagTip}>
          <span className={styles.bagTipHead}>STARTING BAG</span>
          <span className={styles.bagTipText}>{data.bag.toUpperCase()}</span>
        </span>
      </span>
    </>
  );
}

/** A locked hiker: the portrait as a black silhouette, and "LOCKED". */
function Locked({ data }: { data: HikerCardData }) {
  return (
    <>
      <div className={styles.window}>
        <HikerPortrait
          hikerId={data.id}
          view="window"
          aspect={CARD_W / 250}
          className={`${styles.portrait} ${styles.silhouette}`}
        />
      </div>
      <div className={styles.nameBand}>
        <span className={`${styles.name} ${styles.lockedName}`} style={{ fontSize: 30 }}>
          LOCKED
        </span>
      </div>
    </>
  );
}

/** A designed hiker's back (Phase 10.7): the 3 trees, each with its 3 traits' names. */
function TreesBack({ data, trees }: { data: HikerCardData; trees: readonly CardTree[] }) {
  return (
    <>
      <div className={styles.strip}>
        <HikerPortrait
          hikerId={data.id}
          view="strip"
          aspect={CARD_W / 84}
          className={styles.portrait}
        />
      </div>
      <div className={styles.nameBandBack}>
        <FitLine text={data.name.toUpperCase()} size={30} className={styles.nameBack} />
      </div>
      <Roles data={data} top={118} />
      <div className={styles.backBody}>
        <div className={styles.trees}>
          {trees.map((t) => (
            <div key={t.id} className={styles.tree} style={{ '--c': t.color } as CSSProperties}>
              <span className={styles.treeName}>{t.name}</span>
              {t.steps.map((step, i) => (
                <span key={step.stepId} className={styles.treeStep} title={step.text}>
                  <span className={styles.treeTier}>{['I', 'II', 'III'][i]}</span>
                  {step.name}
                  {step.upgrade && <span className={styles.treeUp}>▲</span>}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.bagBar}>{data.bag.toUpperCase()}</div>
      </div>
    </>
  );
}

function Back({ data }: { data: HikerCardData }) {
  if (data.trees) return <TreesBack data={data} trees={data.trees} />;
  const dense = data.rows.length >= 4;
  return (
    <>
      <div className={styles.strip}>
        <HikerPortrait
          hikerId={data.id}
          view="strip"
          aspect={CARD_W / 84}
          className={styles.portrait}
        />
      </div>
      <div className={styles.nameBandBack}>
        <FitLine text={data.name.toUpperCase()} size={30} className={styles.nameBack} />
      </div>
      <Roles data={data} top={118} />
      <div className={styles.backBody}>
        <div className={styles.rows} data-dense={dense || undefined}>
          {data.rows.map((row, i) => (
            <Row key={i} row={row} />
          ))}
        </div>
        <div className={styles.bagBar}>{data.bag.toUpperCase()}</div>
      </div>
    </>
  );
}

function Row({ row }: { row: CardRow }) {
  const colors = row.open || !row.type ? OPEN_ROW : BADGE_COLORS[row.type];
  const icon = row.traitId ? traitIconUrl(row.traitId) : undefined;
  const vars = { '--ring': colors.ring, '--fill': colors.fill } as CSSProperties;
  return (
    <div className={styles.row} style={vars}>
      <span className={styles.rowIcon} data-usable={row.usable || undefined}>
        {icon && (
          <span
            className={styles.rowIconArt}
            style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
          />
        )}
      </span>
      <span className={styles.rowWords}>
        <span className={styles.rowName}>
          <span>{row.name.toUpperCase()}</span>
          {row.usable && <span className={styles.rowTag}>USABLE</span>}
        </span>
        <FitBox text={row.text} className={styles.rowText} />
      </span>
    </div>
  );
}

/** The smallest a back row's text gets before it's cut off. */
const MIN_ROW_TEXT = 7;

/** A back row's text: its font shrinks until it fits the row (long trait texts, four rows). */
function FitBox({ text, className }: { text: string; className: string | undefined }) {
  const ref = useRef<HTMLSpanElement>(null);
  useFit(ref, text, { mode: 'height', min: MIN_ROW_TEXT });
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
