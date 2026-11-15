/**
 * The station's counter, Shop tab (docs/mockups/Station.dc.html):
 * - row 1: the "Drag here to sell" slot, the item cards, the station special
 *   (an animated gold border) and the Taxi Service, each with a parchment
 *   price tag that dims when the party can't afford it;
 * - row 2: blueprints as blueprint-paper squares in their type's color, then
 *   resource bundles;
 * - both rows scroll sideways together, with one dark-wood bar (drag, wheel
 *   or swipe), and the brass Party Caps plaque stays put at the right.
 * Mystery cards (Rocco's Random Resale) show only their tier until bought,
 * then turn over.
 */
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import type { GameState, ItemOffer, StationSpecialId } from '../../engine';
import { mergeHandlers } from '../app/mergeHandlers';
import { useDrag, useDrop, type DropTarget } from '../drag/drag';
import { canPickUpOffer } from '../drag/dropRules';
import { Icon } from '../icons/Icon';
import { ItemCard } from '../items/ItemCard';
import { Previewable } from '../preview/Previewable';
import { TYPE_ICON, TYPE_LOOK } from '../items/itemLook';
import styles from './Counter.module.css';
import { SPECIAL_LOOK, bundleName } from './stationLook';
import room from './StationScreen.module.css';

const NUMERAL = ['', 'I', 'II', 'III', 'IV'];

export function Counter({
  state,
  flipped,
  onPick,
  sellDrop,
}: {
  state: GameState;
  /** The offer that was just bought face-down: it turns over. */
  flipped: string | null;
  onPick(offerId: string): void;
  /** The sell slot: a pack card dragged onto it (Nov 14 update). */
  sellDrop: DropTarget;
}) {
  const station = state.station;
  const scroller = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 1 });

  // The wooden bar mirrors the rows' scroll.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const sync = () => {
      const width = el.clientWidth / Math.max(el.scrollWidth, 1);
      const room = Math.max(el.scrollWidth - el.clientWidth, 1);
      setThumb({
        width: Math.min(1, width),
        left: (el.scrollLeft / room) * (1 - Math.min(1, width)),
      });
    };
    sync();
    el.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [station?.items.length]);

  if (!station) return null;
  const caps = state.caps;
  const short = (price: number) => (caps < price ? true : undefined);

  // A mouse wheel scrolls the rows sideways.
  const onWheel = (e: React.WheelEvent) => {
    const el = scroller.current;
    if (!el || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    el.scrollLeft += e.deltaY;
  };
  // Click or drag along the bar.
  const onBar = (e: PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (!el) return;
    const bar = e.currentTarget.getBoundingClientRect();
    const go = (x: number) => {
      const t = Math.min(1, Math.max(0, (x - bar.left) / bar.width));
      el.scrollLeft = t * (el.scrollWidth - el.clientWidth);
    };
    go(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => go(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const rejoinGone = !!station.rejoined;
  return (
    <div className={styles.counter}>
      <div className={styles.shelf} aria-hidden="true" />
      <div ref={scroller} id="station-rows" className={styles.scroller} onWheel={onWheel}>
        <div className={styles.rows}>
          <ul className={styles.row1} aria-label="For sale">
            <li className={styles.offer}>
              <SellSlot target={sellDrop} />
            </li>
            {station.items.map((o) => (
              <li key={o.id} className={styles.offer} data-sold={o.sold || undefined}>
                <OfferButton
                  state={state}
                  offerId={o.id}
                  ghost={
                    o.hidden ? (
                      <MysteryBack tier={ITEMS[o.item.itemId]?.tier ?? 1} what="ITEM" />
                    ) : (
                      <ItemCard itemId={o.item.itemId} item={o.item} width={110} />
                    )
                  }
                  className={styles.cardButton}
                  disabled={!!o.sold}
                  onPick={() => onPick(o.id)}
                  aria-label={offerLabel(o)}
                >
                  <Previewable
                    className={flipped === o.id ? styles.flipIn : styles.cardWrap}
                    content={
                      o.hidden ? null : { kind: 'item', itemId: o.item.itemId, item: o.item }
                    }
                  >
                    {o.hidden ? (
                      <MysteryBack tier={ITEMS[o.item.itemId]?.tier ?? 1} what="ITEM" />
                    ) : (
                      <ItemCard itemId={o.item.itemId} item={o.item} width={150} />
                    )}
                  </Previewable>
                  {o.sold && <span className={styles.sold}>SOLD</span>}
                </OfferButton>
                <PriceTag price={o.price} sold={!!o.sold} short={short(o.price)} />
              </li>
            ))}
            {station.special && (
              <li className={styles.offer} data-sold={station.special.sold || undefined}>
                <SpecialCard
                  kind={station.special.special}
                  sold={!!station.special.sold}
                  onPick={() => onPick('special')}
                />
                <PriceTag
                  price={station.special.price}
                  sold={!!station.special.sold}
                  short={short(station.special.price)}
                />
              </li>
            )}
            <li className={styles.offer} data-sold={rejoinGone || undefined}>
              <SpecialCard kind="rejoin" sold={rejoinGone} onPick={() => onPick('rejoin')} />
              <PriceTag
                price={BALANCE.station.rejoin.price}
                sold={rejoinGone}
                short={short(BALANCE.station.rejoin.price)}
              />
            </li>
          </ul>

          <div className={styles.row2}>
            <span className={styles.shelfLabel}>BLUEPRINTS</span>
            {station.blueprints.map((b) => {
              const def = ITEMS[b.itemId];
              const type = def?.type ?? 'tool';
              return (
                <OfferButton
                  key={b.id}
                  state={state}
                  offerId={b.id}
                  ghost={<BlueprintGhost name={b.hidden ? '???' : (def?.name ?? '')} />}
                  className={styles.small}
                  data-sold={b.sold || undefined}
                  disabled={!!b.sold}
                  onPick={() => onPick(b.id)}
                  aria-label={
                    b.hidden
                      ? `Mystery blueprint, ${b.price} caps`
                      : `${def?.name} blueprint, ${b.sold ? 'sold' : `${b.price} caps`}`
                  }
                >
                  <Previewable
                    className={styles.blueprint}
                    style={
                      {
                        '--type': b.hidden ? '#A8743F' : TYPE_LOOK[type].accent,
                      } as React.CSSProperties
                    }
                    content={b.hidden ? null : { kind: 'item', itemId: b.itemId, unrolled: true }}
                  >
                    <Icon name={b.hidden ? 'help' : TYPE_ICON[type]} size={24} />
                    <span className={styles.blueprintName}>
                      {b.hidden ? '???' : (def?.name ?? '').toUpperCase()}
                    </span>
                  </Previewable>
                  <SmallPrice price={b.price} sold={!!b.sold} short={short(b.price)} />
                </OfferButton>
              );
            })}
            <span className={styles.divider} aria-hidden="true" />
            <span className={styles.shelfLabel}>RESOURCES</span>
            {station.bundles.map((b) => (
              <OfferButton
                key={b.id}
                state={state}
                offerId={b.id}
                ghost={
                  <img
                    className={styles.bundleGhost}
                    src={
                      b.item
                        ? ASSETS.itemArt(ITEMS[b.item.itemId]?.art ?? '')
                        : ASSETS.resources[b.resource ?? '']
                    }
                    alt=""
                  />
                }
                className={styles.small}
                data-sold={b.sold || undefined}
                disabled={!!b.sold}
                onPick={() => onPick(b.id)}
                aria-label={`${bundleName(b)}, ${b.sold ? 'sold' : `${b.price} caps`}`}
              >
                <Previewable
                  className={styles.bundle}
                  content={b.item ? { kind: 'item', itemId: b.item.itemId, item: b.item } : null}
                >
                  <img
                    src={
                      b.item
                        ? ASSETS.itemArt(ITEMS[b.item.itemId]?.art ?? '')
                        : ASSETS.resources[b.resource ?? '']
                    }
                    alt=""
                    draggable={false}
                  />
                  {!b.item && <span className={styles.count}>×{b.count}</span>}
                </Previewable>
                <SmallPrice price={b.price} sold={!!b.sold} short={short(b.price)} />
              </OfferButton>
            ))}
          </div>
        </div>
      </div>
      <div className={`${styles.caps} ${room.brass}`} aria-live="polite">
        <span className={styles.capsLabel}>PARTY CAPS</span>
        <span className={styles.capsValue}>
          <Icon name="acorn" size={26} />
          {caps}
        </span>
      </div>
      <div
        className={styles.bar}
        role="scrollbar"
        aria-controls="station-rows"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(thumb.left * 100)}
        onPointerDown={onBar}
      >
        <div
          className={styles.thumb}
          style={{ left: `${thumb.left * 100}%`, width: `${thumb.width * 100}%` }}
        />
      </div>
    </div>
  );
}

function offerLabel(o: ItemOffer): string {
  const def = ITEMS[o.item.itemId];
  const tier = NUMERAL[def?.tier ?? 1];
  if (o.hidden) return `Mystery item, Tier ${tier}, ${o.price} caps`;
  const q = o.item.quality ? `, Quality ${o.item.quality}` : '';
  return `${def?.name}${q}, ${o.sold ? 'sold' : `${o.price} caps`}`;
}

/** A parchment price tag (the Merchant's cards use it too). */
export function PriceTag({ price, sold, short }: { price: number; sold: boolean; short?: true }) {
  return (
    <span className={styles.tag} data-short={sold ? true : short}>
      {sold ? (
        'SOLD'
      ) : (
        <>
          <Icon name="acorn" size={13} />
          {price}
        </>
      )}
    </span>
  );
}

function SmallPrice({ price, sold, short }: { price: number; sold: boolean; short?: true }) {
  return (
    <span className={styles.smallPrice} data-short={sold ? true : short}>
      {sold ? (
        'SOLD'
      ) : (
        <>
          <Icon name="acorn" size={11} />
          {price}
        </>
      )}
    </span>
  );
}

/** A face-down card: only its tier shows (Rocco's Random Resale). */
export function MysteryBack({ tier, what }: { tier: number; what: string }) {
  return (
    <div className={styles.mystery}>
      <div
        className={styles.mysteryTexture}
        style={{ backgroundImage: `url(${ASSETS.textures.halftone})` }}
      />
      <span className={styles.mysteryMark}>?</span>
      <span className={styles.mysteryTier}>
        MYSTERY {what} · TIER {NUMERAL[tier]}
      </span>
    </div>
  );
}

/** A shared special or the Taxi Service, with its animated gold border. */
export function SpecialCard({
  kind,
  sold,
  onPick,
}: {
  kind: StationSpecialId | 'rejoin';
  sold: boolean;
  onPick?(): void;
}) {
  const look = SPECIAL_LOOK[kind];
  const face = (
    <div className={styles.special}>
      <div className={styles.goldShift} />
      <img className={styles.specialFront} src={ASSETS.itemCards.front} alt="" draggable={false} />
      <div className={styles.specialIcon}>
        <Icon name={look.icon} size={54} color="#FFF3DA" strokeWidth={1.75} />
      </div>
      <div className={styles.specialText}>
        <span className={styles.specialName}>{look.name}</span>
        <span className={styles.specialKind}>STATION SPECIAL</span>
        <span className={styles.specialDesc}>{look.desc}</span>
      </div>
    </div>
  );
  if (!onPick) return face;
  return (
    <button
      type="button"
      className={styles.cardButton}
      disabled={sold}
      onClick={onPick}
      aria-label={`${look.name}: ${look.desc}${sold ? ' (used)' : ''}`}
    >
      {face}
      {sold && <span className={styles.sold}>{kind === 'rejoin' ? 'USED' : 'SOLD'}</span>}
    </button>
  );
}

/** The sell slot: drop a pack card or resource here to see what it sells for. */
/** Drop a pack card or resource here to sell it (with a confirm). */
function SellSlot({ target }: { target: DropTarget }) {
  const drop = useDrop('sell', target);
  return (
    <div className={styles.sellSlot} {...drop.props()}>
      <Icon name="acorn" size={34} color="#E9B44C" />
      <span className={styles.sellTitle}>DRAG HERE TO SELL</span>
      <span className={styles.sellHint}>You’ll see the price before it sells</span>
    </div>
  );
}

/**
 * A counter card, a button that's also a drag source (Nov 14 update): drag
 * it onto a hiker's pack to buy it. One the party can't afford won't lift,
 * and shakes a little instead.
 */
function OfferButton({
  state,
  offerId,
  ghost,
  onPick,
  children,
  ...rest
}: {
  state: GameState;
  offerId: string;
  ghost: ReactNode;
  onPick(): void;
  children: ReactNode;
} & ComponentProps<'button'>) {
  const [shake, setShake] = useState(false);
  const can = canPickUpOffer(state, offerId);
  const drag = useDrag(can ? { kind: 'offer', offerId } : null, ghost);
  const nudge = () => {
    if (can || rest.disabled) return;
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  };
  return (
    <button
      type="button"
      {...rest}
      data-shake={shake || undefined}
      {...mergeHandlers({ onClick: onPick, onPointerDown: nudge }, drag)}
    >
      {children}
    </button>
  );
}

/** What follows the pointer while a blueprint is dragged. */
function BlueprintGhost({ name }: { name: string }) {
  return (
    <div className={styles.blueprint} style={{ '--type': '#A8743F' } as React.CSSProperties}>
      <Icon name="hammer" size={24} />
      <span className={styles.blueprintName}>{name.toUpperCase()}</span>
    </div>
  );
}
