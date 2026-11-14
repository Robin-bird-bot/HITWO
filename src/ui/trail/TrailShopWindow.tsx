/**
 * A trail tile's Merchant or Traveling Trader (Phase 9 step 6; approved in
 * #mockup-station-extras, Wyatt, Nov 14). Free for any active hiker on the
 * tile, at station prices.
 *
 * - Merchant: 3 cards. Click one to buy it; the buy dialog asks who takes it,
 *   as at a station. Each card sells once.
 * - Traveling Trader: their item for any 1 item of the type they want, from a
 *   bag or worn, from anyone on the tile. Pick yours, then the button names
 *   both items: that's the confirm. One trade.
 * Esc or the X closes it.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { characterFor } from '../../content/characters';
import { ITEMS } from '../../content';
import {
  tradeable,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
  type ItemInstance,
  type TileId,
  type TrailShop,
} from '../../engine';
import { useFocusOnOpen } from '../app/useFocusOnOpen';
import { Icon } from '../icons/Icon';
import { ItemCard } from '../items/ItemCard';
import { TYPE_ICON, TYPE_LOOK } from '../items/itemLook';
import { BuyDialog } from '../station/BuyDialog';
import { PriceTag } from '../station/Counter';
import counter from '../station/Counter.module.css';
import { bundleName } from '../station/stationLook';
import room from '../station/StationScreen.module.css';
import styles from './TrailShopWindow.module.css';

type Merchant = Extract<TrailShop, { kind: 'merchant' }>;
type Trader = Extract<TrailShop, { kind: 'trader' }>;

export function TrailShopWindow({
  state,
  tileId,
  onDispatch,
  onClose,
}: {
  state: GameState;
  tileId: TileId;
  /** True when the action went through. */
  onDispatch(action: Action): boolean;
  onClose(): void;
}) {
  const shop = state.section.tiles[tileId]?.shop;
  const [buying, setBuying] = useState<string | null>(null);
  const windowRef = useFocusOnOpen<HTMLElement>();

  useEffect(() => {
    // The buy dialog closes itself on Esc first.
    if (buying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buying, onClose]);

  if (!shop) return null;
  const merchant = shop.kind === 'merchant';
  const here = state.hikers.filter((h) => h.status === 'active' && h.tileId === tileId);

  return (
    <div
      className={styles.overlay}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={windowRef}
        tabIndex={-1}
        className={styles.window}
        role="dialog"
        aria-modal="true"
        aria-label={merchant ? 'Merchant' : 'Traveling Trader'}
      >
        <header className={`${styles.head} ${room.wood}`}>
          <span className={styles.keeperIcon}>
            <Icon name={merchant ? 'bag' : 'backpack'} size={30} color="#FCE9C4" />
          </span>
          <span className={styles.headText}>
            <h2>{merchant ? 'MERCHANT' : 'TRAVELING TRADER'}</h2>
            <small>
              {merchant
                ? 'By the trail · free to shop for anyone on this tile'
                : 'By the trail · one trade, free, for anyone on this tile'}
            </small>
          </span>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </header>
        {merchant ? (
          <MerchantBody state={state} shop={shop} onPick={setBuying} />
        ) : (
          <TraderBody state={state} shop={shop} here={here} onDispatch={onDispatch} />
        )}
      </section>

      {buying && (
        <BuyDialog
          state={state}
          offerId={buying}
          tileId={tileId}
          onBuy={(action) => {
            if (onDispatch(action)) setBuying(null);
          }}
          onClose={() => setBuying(null)}
        />
      )}
    </div>
  );
}

function MerchantBody({
  state,
  shop,
  onPick,
}: {
  state: GameState;
  shop: Merchant;
  onPick(offerId: string): void;
}) {
  return (
    <div className={styles.merchant}>
      {/* TODO(wyatt): the Merchant's lines (placeholder). */}
      <p className={styles.line}>“Good wares, fair prices. Same as any station, friend.”</p>
      <ul className={styles.offers} aria-label="For sale">
        {shop.offers.map((o) => {
          const def =
            ITEMS[o.kind === 'item' ? o.item.itemId : o.kind === 'blueprint' ? o.itemId : ''];
          const name =
            o.kind === 'item'
              ? `${def?.name}, Quality ${o.item.quality ?? 3}`
              : o.kind === 'blueprint'
                ? `${def?.name} blueprint`
                : bundleName(o);
          return (
            <li key={o.id} className={counter.offer} data-sold={o.sold || undefined}>
              <button
                type="button"
                className={counter.cardButton}
                disabled={!!o.sold}
                onClick={() => onPick(o.id)}
                aria-label={`${name}, ${o.sold ? 'sold' : `${o.price} caps`}`}
              >
                {o.kind === 'item' ? (
                  <ItemCard itemId={o.item.itemId} item={o.item} width={170} />
                ) : o.kind === 'blueprint' && def ? (
                  <div
                    className={styles.bigBp}
                    style={{ '--type': TYPE_LOOK[def.type].accent } as CSSProperties}
                  >
                    <Icon name={TYPE_ICON[def.type]} size={44} />
                    <span>{def.name.toUpperCase()}</span>
                    <em>BLUEPRINT</em>
                  </div>
                ) : o.kind === 'bundle' ? (
                  <div className={styles.bigBundle}>
                    <img src={ASSETS.resources[o.resource ?? '']} alt="" draggable={false} />
                    <span className={counter.count}>×{o.count}</span>
                  </div>
                ) : null}
                {o.sold && <span className={counter.sold}>SOLD</span>}
              </button>
              <PriceTag
                price={o.price}
                sold={!!o.sold}
                {...(state.caps < o.price ? { short: true as const } : {})}
              />
            </li>
          );
        })}
      </ul>
      <footer className={styles.foot}>
        <span className={`${styles.miniCaps} ${room.brass}`} aria-label={`${state.caps} caps`}>
          <Icon name="acorn" size={18} /> {state.caps}
        </span>
        <span className={styles.small}>
          {shop.offers.every((o) => o.sold)
            ? 'Sold out. Thanks, friend!'
            : 'Click a card to buy it. Buying asks who takes it, like a station.'}
        </span>
      </footer>
    </div>
  );
}

const WANTS_WORD = { tool: 'TOOL', clothes: 'CLOTHING', food: 'FOOD' } as const;

function TraderBody({
  state,
  shop,
  here,
  onDispatch,
}: {
  state: GameState;
  shop: Trader;
  here: Hiker[];
  onDispatch(action: Action): boolean;
}) {
  const theirs = ITEMS[shop.item.itemId];
  const mine = here.flatMap((h) => {
    const worn = new Set(Object.values(h.inventory.equipped).map((i) => i?.uid));
    return tradeable(state, h).map((item) => ({ hiker: h, item, worn: worn.has(item.uid) }));
  });
  const [chosen, setChosen] = useState<string | null>(mine[0]?.item.uid ?? null);
  const pick = mine.find((m) => m.item.uid === chosen);
  const action: Action | null = pick
    ? { type: 'trade', hikerId: pick.hiker.id, itemUid: pick.item.uid }
    : null;
  const reason = action ? validateAction(state, action) : undefined;
  const small = mine.length > 3;

  if (shop.traded) {
    const who = state.hikers.find((h) => h.id === shop.traded?.hikerId);
    return (
      <div className={styles.trader}>
        <div className={styles.theirs}>
          <span className={styles.kicker}>THEIR ITEM</span>
          <div className={styles.stamped}>
            <div className={styles.faded}>
              <ItemCard itemId={shop.item.itemId} item={shop.item} width={190} />
            </div>
            <span className={counter.sold}>TRADED</span>
          </div>
        </div>
        <div className={styles.yours}>
          <p className={styles.done}>
            {who?.name ?? 'Someone'} traded the {ITEMS[shop.traded.itemId]?.name} for the{' '}
            {theirs?.name}.
          </p>
          <p className={styles.small}>That was the Trader’s one trade. Safe travels!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.trader}>
      <div className={styles.theirs}>
        <span className={styles.kicker}>THEIR ITEM</span>
        <ItemCard itemId={shop.item.itemId} item={shop.item} width={190} />
      </div>
      <span className={styles.swap} aria-hidden="true">
        ⇄
      </span>
      <div className={styles.yours}>
        <span className={styles.kicker}>FOR ANY 1 {WANTS_WORD[shop.wants]} ITEM</span>
        {mine.length === 0 ? (
          <p className={styles.none}>
            Nobody here has {shop.wants === 'clothes' ? 'any clothes' : `a ${shop.wants} item`} to
            trade. Items in bags and worn ones both count.
          </p>
        ) : (
          <ul className={styles.mine} aria-label="Your items">
            {mine.map((m) => (
              <li key={m.item.uid}>
                <button
                  type="button"
                  className={styles.pickCard}
                  aria-pressed={chosen === m.item.uid}
                  aria-label={`${m.hiker.name}’s ${ITEMS[m.item.itemId]?.name}${m.worn ? ', worn' : ''}`}
                  onClick={() => setChosen(m.item.uid)}
                >
                  <ItemCard itemId={m.item.itemId} item={m.item} width={small ? 118 : 150} />
                  <Owner hiker={m.hiker} worn={m.worn} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {reason && <p className={styles.reason}>{reason}</p>}
        {pick && (
          <button
            type="button"
            className={styles.gold}
            disabled={!action || !!reason}
            onClick={() => action && onDispatch(action)}
          >
            TRADE THE {itemName(pick.item)} FOR THE {(theirs?.name ?? '').toUpperCase()}
          </button>
        )}
      </div>
    </div>
  );
}

const itemName = (item: ItemInstance) => (ITEMS[item.itemId]?.name ?? '').toUpperCase();

function Owner({ hiker, worn }: { hiker: Hiker; worn: boolean }) {
  return (
    <span className={styles.owner}>
      <img
        className={styles.face}
        src={ASSETS.portraits.placeholder}
        alt=""
        style={{ boxShadow: `0 0 0 2px ${characterFor(hiker.id).color}` }}
      />
      {hiker.name.toUpperCase()}
      {worn && <em>· WORN</em>}
    </span>
  );
}
