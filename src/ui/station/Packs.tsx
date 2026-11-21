/**
 * Every hiker's pack below the counter (docs/mockups/Station.dc.html): their
 * bag and resources, shared while at the station.
 *
 * - Hover (or long-press on a phone) a bag card: the shared card preview,
 *   with what it sells for here.
 * - Click a bag card or resource: sell it (with a confirm) or give it to
 *   someone else here (free, and easy to give back).
 * - Drag one onto the counter's sell slot to sell it, with the same confirm,
 *   or a resource onto a Workbench space (the shared drag, Nov 14 update).
 * - Drag a counter card onto a pack to buy it for that hiker.
 */
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ASSETS } from '../../config/assets';
import { hikerColor } from '../../content/characters';
import { ITEMS } from '../../content';
import {
  bagSlots,
  marketMult,
  resourceSellPrice,
  saleCaps,
  sellPrice,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
  type ItemInstance,
  type ResourceId,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { ItemCard } from '../items/ItemCard';
import { Popout } from '../panels/Popout';
import { usePreview } from '../preview/preview';
import { mergeHandlers } from '../app/mergeHandlers';
import { useDrag, useDrop, type DropTarget } from '../drag/drag';
import { NO_DROP } from '../drag/itemDrops';
import { resourceName } from '../scavenge/cardLook';
import styles from './Counter.module.css';
import { HikerPortrait } from '../hikers/HikerPortrait';

/** What a sale would be, for the confirm. */
export interface SaleRequest {
  hikerId: string;
  itemUid?: string;
  resource?: ResourceId;
  count?: number;
}

type Open = { hikerId: string; itemUid?: string; resource?: ResourceId };

export function Packs({
  state,
  onSell,
  onDispatch,
  buyDrop,
}: {
  state: GameState;
  onSell(sale: SaleRequest): void;
  onDispatch(action: Action): void;
  /** A counter card dropped on a pack (its arg is the hiker's id). */
  buyDrop?: DropTarget;
}) {
  const [menu, setMenu] = useState<Open | null>(null);
  const pack = useDrop('pack', buyDrop ?? NO_DROP);

  const same = (a: Open | null, b: Open) =>
    !!a && a.hikerId === b.hikerId && a.itemUid === b.itemUid && a.resource === b.resource;
  const click = (open: Open) => setMenu(same(menu, open) ? null : open);

  return (
    <ul className={styles.packs} aria-label="Packs" style={{ zIndex: 5 }}>
      {state.hikers.map((h) => {
        const slots = bagSlots(state, h).total;
        const gone = h.status === 'abandoned';
        return (
          <li key={h.id} className={styles.pack} {...(gone ? {} : pack.props(h.id))}>
            <div className={styles.packHead}>
              <HikerPortrait
                hikerId={h.id}
                className={styles.packFace}
                style={{ boxShadow: `0 0 0 2px ${hikerColor(h)}` }}
              />
              <span className={styles.packName}>{h.name.toUpperCase()}</span>
              {!gone && (
                <span className={styles.packCount}>
                  BAG {h.inventory.bag.length}/{slots}
                </span>
              )}
            </div>
            {gone ? (
              <p className={styles.packNote}>
                Left the hike. The Taxi Service can bring {h.name} back.
              </p>
            ) : (
              <div className={styles.packBody}>
                <div className={styles.packBag}>
                  {Array.from({ length: slots }, (_, i) => {
                    const item = h.inventory.bag[i];
                    if (!item) return <span key={`empty-${i}`} className={styles.slot} />;
                    const open = { hikerId: h.id, itemUid: item.uid };
                    return (
                      <span key={item.uid} style={{ position: 'relative' }}>
                        <PackItem
                          item={item}
                          price={saleCaps(state, h, sellPrice(item))}
                          menuOpen={same(menu, open)}
                          onClick={() => click(open)}
                          hikerId={h.id}
                        />
                        {same(menu, open) && (
                          <ItemMenu
                            state={state}
                            hiker={h}
                            itemUid={item.uid}
                            onSell={onSell}
                            onDispatch={onDispatch}
                            onClose={() => setMenu(null)}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className={styles.packResources}>
                  {Object.entries(h.inventory.resources).map(([id, n]) => {
                    if (!n) return null;
                    const open = { hikerId: h.id, resource: id };
                    return (
                      <span key={id} style={{ position: 'relative' }}>
                        <PackResource
                          hikerId={h.id}
                          resource={id}
                          open={same(menu, open)}
                          aria-label={`${n} ${resourceName(id)}: sell or give`}
                          onClick={() => click(open)}
                        >
                          <img src={ASSETS.resources[id]} alt="" draggable={false} />
                          <span className={styles.count}>{n}</span>
                        </PackResource>
                        {same(menu, open) && (
                          <ResourceMenu
                            state={state}
                            hiker={h}
                            resource={id}
                            onSell={onSell}
                            onDispatch={onDispatch}
                            onClose={() => setMenu(null)}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Others at the station this could go to, and why not if it can't. */
function giveTargets(
  state: GameState,
  hiker: Hiker,
  thing: { itemUid?: string; resource?: string },
) {
  return state.hikers
    .filter((o) => o.id !== hiker.id && o.status === 'checkedIn')
    .map((o) => {
      const action: Action = { type: 'give', fromId: hiker.id, toId: o.id, ...thing };
      return { hiker: o, action, reason: validateAction(state, action) };
    });
}

function ItemMenu({
  state,
  hiker,
  itemUid,
  onSell,
  onDispatch,
  onClose,
}: {
  state: GameState;
  hiker: Hiker;
  itemUid: string;
  onSell(sale: SaleRequest): void;
  onDispatch(action: Action): void;
  onClose(): void;
}) {
  const item = hiker.inventory.bag.find((i) => i.uid === itemUid);
  if (!item) return null;
  const name = ITEMS[item.itemId]?.name ?? 'Item';
  const price = saleCaps(state, hiker, sellPrice(item));
  return (
    <Popout
      label={`${name}: sell or give`}
      onClose={onClose}
      focusFirst
      className={styles.menu}
      style={{ left: -100, bottom: 76 }}
    >
      <span className={styles.menuTitle}>{name.toUpperCase()}</span>
      <button
        type="button"
        className={styles.menuButton}
        data-main
        onClick={() => {
          onClose();
          onSell({ hikerId: hiker.id, itemUid });
        }}
      >
        <Icon name="acorn" size={16} />
        Sell for {price} cap{price === 1 ? '' : 's'}
      </button>
      {giveTargets(state, hiker, { itemUid }).map((t) => (
        <button
          key={t.hiker.id}
          type="button"
          className={styles.menuButton}
          disabled={!!t.reason}
          title={t.reason ?? undefined}
          onClick={() => {
            onClose();
            onDispatch(t.action);
          }}
        >
          <Icon name="user" size={16} />
          Give to {t.hiker.name}
        </button>
      ))}
      <p className={styles.menuNote}>You can also drag it onto the sell slot.</p>
    </Popout>
  );
}

function ResourceMenu({
  state,
  hiker,
  resource,
  onSell,
  onDispatch,
  onClose,
}: {
  state: GameState;
  hiker: Hiker;
  resource: ResourceId;
  onSell(sale: SaleRequest): void;
  onDispatch(action: Action): void;
  onClose(): void;
}) {
  const have = hiker.inventory.resources[resource] ?? 0;
  // Start on as many as make a cap (two ×½ ones), or 1.
  const [count, setCount] = useState(() =>
    Math.min(have, Math.max(1, Math.ceil(1 / marketMult(state, resource)))),
  );
  const base = resourceSellPrice(state, resource, count);
  // Under a cap can't be sold; otherwise the seller's traits add to it.
  const price = base < 1 ? base : saleCaps(state, hiker, base);
  const mult = marketMult(state, resource);
  const name = resourceName(resource);
  return (
    <Popout
      label={`${name}: sell or give`}
      onClose={onClose}
      focusFirst
      className={styles.menu}
      style={{ left: -110, bottom: 40 }}
    >
      <span className={styles.menuTitle}>
        {name.toUpperCase()} ×{have}
        {mult !== 1 && (mult > 1 ? ' · SELLS FOR ×2 HERE' : ' · SELLS FOR ×½ HERE')}
      </span>
      <div className={styles.stepper}>
        <button
          type="button"
          aria-label="One fewer"
          disabled={count <= 1}
          onClick={() => setCount(count - 1)}
        >
          <Icon name="minus" size={16} />
        </button>
        <span aria-live="polite">{count}</span>
        <button
          type="button"
          aria-label="One more"
          disabled={count >= have}
          onClick={() => setCount(count + 1)}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      <button
        type="button"
        className={styles.menuButton}
        data-main
        disabled={price < 1}
        onClick={() => {
          onClose();
          onSell({ hikerId: hiker.id, resource, count });
        }}
      >
        <Icon name="acorn" size={16} />
        {price < 1
          ? 'Worth less than a cap'
          : `Sell ${count} for ${price} cap${price === 1 ? '' : 's'}`}
      </button>
      {price < 1 && <p className={styles.menuNote}>Two of these together make a cap here.</p>}
      {giveTargets(state, hiker, { resource }).map((t) => (
        <button
          key={t.hiker.id}
          type="button"
          className={styles.menuButton}
          disabled={!!t.reason}
          title={t.reason ?? undefined}
          onClick={() => {
            onClose();
            onDispatch(t.action);
          }}
        >
          <Icon name="user" size={16} />
          Give 1 to {t.hiker.name}
        </button>
      ))}
    </Popout>
  );
}

/** A bag card in a pack: hover or long-press for the full card and its price here. */
function PackItem({
  item,
  price,
  hikerId,
  menuOpen,
  onClick,
}: {
  item: ItemInstance;
  /** What it sells for here, with the seller's traits (Charismatic, Non-Non-Profit). */
  price: number;
  hikerId: string;
  menuOpen: boolean;
  onClick(): void;
}) {
  const caps = `${price} cap${price === 1 ? '' : 's'}`;
  const preview = usePreview({
    kind: 'item',
    itemId: item.itemId,
    item,
    note: `Sells for ${caps} here`,
  });
  const drag = useDrag(
    { kind: 'item', hikerId, itemUid: item.uid },
    <ItemCard itemId={item.itemId} item={item} width={64} compact />,
  );
  return (
    <button
      type="button"
      className={styles.packItem}
      data-open={menuOpen || undefined}
      aria-label={`${ITEMS[item.itemId]?.name ?? 'Item'}: sell for ${caps}, or give`}
      {...mergeHandlers({ onClick }, preview, drag)}
    >
      <ItemCard itemId={item.itemId} item={item} width={46} compact />
    </button>
  );
}

/** A resource in a pack: a menu on click, and a drag source (to sell, or for the Workbench). */
function PackResource({
  hikerId,
  resource,
  open,
  children,
  ...rest
}: {
  hikerId: string;
  resource: ResourceId;
  open: boolean;
  children: ReactNode;
} & ComponentProps<'button'>) {
  const drag = useDrag(
    { kind: 'resource', hikerId, resource },
    <img src={ASSETS.resources[resource]} alt="" width={46} height={46} />,
  );
  return (
    <button
      type="button"
      className={styles.packRes}
      data-open={open || undefined}
      {...mergeHandlers(rest, drag)}
    >
      {children}
    </button>
  );
}
