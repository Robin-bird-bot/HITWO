/**
 * Buying something off the counter (Phase 9): what it is, what it costs the
 * party, and who takes it (asked only when more than one hiker could). A
 * blueprint asks who learns it; the Taxi Service asks who comes back.
 * Spending caps can't be undone, so this is the confirm. Esc or Cancel closes.
 */
import { useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { findOffer, validateAction, type Action, type GameState } from '../../engine';
import { Icon } from '../icons/Icon';
import { ItemCard } from '../items/ItemCard';
import { MysteryBack, SpecialCard } from './Counter';
import { bundleName, SPECIAL_LOOK } from './stationLook';
import styles from './BuyDialog.module.css';

export function BuyDialog({
  state,
  offerId,
  onBuy,
  onClose,
}: {
  state: GameState;
  offerId: string;
  onBuy(action: Action): void;
  onClose(): void;
}) {
  const station = state.station;
  const rejoin = offerId === 'rejoin';
  const offer = station && !rejoin ? findOffer(station, offerId) : undefined;
  const price = rejoin ? BALANCE.station.rejoin.price : (offer?.price ?? 0);
  // Specials pick their line or tiles on Preview Next Trail (coming in step 5).
  const needsPreview = offer?.kind === 'special';

  const candidates = state.hikers.filter((h) =>
    rejoin ? h.status === 'abandoned' : h.status === 'checkedIn',
  );
  const choices = candidates.map((h) => {
    const action: Action = { type: 'buy', offerId, hikerId: h.id };
    return { hiker: h, action, reason: validateAction(state, action) };
  });
  const able = choices.filter((c) => !c.reason);
  const [chosen, setChosen] = useState<string | null>(
    able.length === 1 ? (able[0]?.hiker.id ?? null) : null,
  );
  const pick = choices.find((c) => c.hiker.id === chosen && !c.reason);

  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!station || (!rejoin && !offer)) return null;

  const what = rejoin
    ? 'the Taxi Service'
    : offer?.kind === 'item'
      ? offer.hidden
        ? 'a mystery item'
        : `the ${ITEMS[offer.item.itemId]?.name}`
      : offer?.kind === 'blueprint'
        ? offer.hidden
          ? 'a mystery blueprint'
          : `the ${ITEMS[offer.itemId]?.name} blueprint`
        : offer?.kind === 'bundle'
          ? bundleName(offer)
          : offer?.kind === 'special'
            ? `the ${SPECIAL_LOOK[offer.special].title}`
            : 'this';
  const question = rejoin
    ? 'Who comes back?'
    : offer?.kind === 'blueprint'
      ? 'Who learns it?'
      : 'Who takes it?';
  const short = state.caps < price;
  // Which picture to show.
  const picture = rejoin ? (
    <SpecialCard kind="rejoin" sold={false} />
  ) : offer?.kind === 'special' ? (
    <SpecialCard kind={offer.special} sold={false} />
  ) : offer?.kind === 'item' ? (
    offer.hidden ? (
      <MysteryBack tier={ITEMS[offer.item.itemId]?.tier ?? 1} what="ITEM" />
    ) : (
      <ItemCard itemId={offer.item.itemId} item={offer.item} width={200} />
    )
  ) : offer?.kind === 'bundle' && offer.item ? (
    <ItemCard itemId={offer.item.itemId} item={offer.item} width={200} />
  ) : null;

  return (
    <div
      className={styles.overlay}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={`Buy ${what}`}>
        <h2 className={styles.title}>BUY {what.toUpperCase()}?</h2>
        <div className={styles.body}>
          {picture && <div className={styles.picture}>{picture}</div>}
          <div className={styles.side}>
            <p className={styles.price}>
              <Icon name="acorn" size={18} color="#E9B44C" />
              {price} caps <span>· the party has {state.caps}</span>
            </p>
            {offer?.kind === 'blueprint' && !offer.hidden && (
              <p className={styles.note}>
                A blueprint is kept for good: its hiker can craft the {ITEMS[offer.itemId]?.name}{' '}
                from its own recipe.
              </p>
            )}
            {offer && 'hidden' in offer && offer.hidden && (
              <p className={styles.note}>It turns over once it’s bought. No peeking!</p>
            )}
            {rejoin && (
              <p className={styles.note}>
                They come back with {BALANCE.station.rejoin.injuries} injuries, low stats and an
                empty pack.
              </p>
            )}
            {needsPreview ? (
              <p className={styles.note}>
                Its pick happens on Preview Next Trail, which opens in a later update.
              </p>
            ) : choices.length === 0 ? (
              <p className={styles.note}>
                {rejoin ? 'Nobody has left the hike.' : 'Nobody here can take it.'}
              </p>
            ) : (
              <fieldset className={styles.who}>
                <legend>{question}</legend>
                {choices.map((c, i) => (
                  <button
                    key={c.hiker.id}
                    ref={i === choices.findIndex((x) => !x.reason) ? first : undefined}
                    type="button"
                    className={styles.hiker}
                    aria-pressed={chosen === c.hiker.id}
                    disabled={!!c.reason}
                    onClick={() => setChosen(c.hiker.id)}
                  >
                    <span>{c.hiker.name}</span>
                    {c.reason && <small>{whyNot(c.reason)}</small>}
                  </button>
                ))}
              </fieldset>
            )}
          </div>
        </div>
        <div className={styles.buttons}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            {needsPreview ? 'OK' : 'Cancel'}
          </button>
          {!needsPreview && (
            <button
              type="button"
              className={styles.buy}
              disabled={!pick || short}
              onClick={() => pick && onBuy(pick.action)}
            >
              {short ? `Needs ${price} caps` : `Buy for ${price} caps`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Ash's bag is full." → "Bag full", for the small line under a name. */
function whyNot(reason: string): string {
  if (/bag is full/.test(reason)) return 'Bag full';
  if (/already knows/.test(reason)) return 'Knows it';
  if (/room for/.test(reason)) return 'No room';
  if (/caps/.test(reason)) return 'Not enough caps';
  if (/Taxi Service has already/.test(reason)) return 'Used here';
  if (/can rejoin/.test(reason)) return 'No more this hike';
  return reason;
}
