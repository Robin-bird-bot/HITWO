/**
 * The ranger station (Phase 9; docs/BUILD_PLAN.md "The station screen",
 * docs/mockups/Station.png and StationAhead.png): a full screen in a cozy
 * wood-and-parchment room, shown once everyone has checked in.
 *
 * - The shopkeeper talks: "What's selling?" (the market), "What's ahead?"
 *   (the next biome) and "Just looking".
 * - The Shop tab: the counter (see Counter.tsx) and every hiker's pack.
 *   Buying and selling both confirm with the price; giving between packs is
 *   free. A special (Cement Mixer, Scout Report) picks its line or tiles on
 *   Preview Next Trail, which is where it's bought.
 * - The Workbench tab (see Workbench.tsx): crafting one tier higher, free.
 * - Preview Next Trail (see PreviewTrail.tsx) and Rest & Go (with a confirm).
 * - Simple mode keeps the same room; Preview Next Trail sits in the talk.
 */
import { useState } from 'react';
import { ITEMS } from '../../content';
import { STATION_THEME_BY_ID } from '../../content/stations';
import {
  findOffer,
  resourceSellPrice,
  sellPrice,
  type Action,
  type BiomeId,
  type GameState,
} from '../../engine';
import { ConfirmDialog } from '../game/ConfirmDialog';
import { Icon } from '../icons/Icon';
import { resourceName } from '../scavenge/cardLook';
import { BuyDialog } from './BuyDialog';
import { Counter } from './Counter';
import { PreviewTrail, type PreviewMode } from './PreviewTrail';
import { Workbench } from './Workbench';
import type { DragSale } from './stationLook';
import { Packs, type SaleRequest } from './Packs';
import { KeeperArm, StationRoom } from './StationRoom';
import { aheadChips, marketChips, talkLine, type Talk, type TalkChip } from './stationTalk';
import counterStyles from './Counter.module.css';
import styles from './StationScreen.module.css';

const BIOME_NAME: Record<BiomeId, string> = {
  meadow: 'the Meadow',
  temperateRainforest: 'the Rainforest',
  alpine: 'the Alpine',
};

export function StationScreen({
  state,
  simple,
  onDispatch,
}: {
  state: GameState;
  simple: boolean;
  /** True when the action went through. */
  onDispatch(action: Action): boolean;
}) {
  const [talk, setTalk] = useState<Talk | null>('greet');
  const [buying, setBuying] = useState<string | null>(null);
  const [selling, setSelling] = useState<SaleRequest | null>(null);
  const [resting, setResting] = useState(false);
  const [flipped, setFlipped] = useState<string | null>(null);
  const [tab, setTab] = useState<'shop' | 'workbench'>('shop');
  const [preview, setPreview] = useState<PreviewMode | null>(null);

  const station = state.station;
  if (!station) return null;
  const theme = STATION_THEME_BY_ID[station.themeId];
  const nextBiome = BIOME_NAME[station.next.biome];
  // A craft waiting for its pick keeps the Workbench open.
  const shown = state.crafting ? 'workbench' : tab;

  // A counter card: a special picks on the map; the rest buy here.
  const pick = (offerId: string) => {
    const special = offerId === 'special' ? station.special : undefined;
    if (special && !special.sold) setPreview(special.special);
    else setBuying(offerId);
  };

  const buy = (action: Action) => {
    if (action.type !== 'buy') return;
    const offer = findOffer(station, action.offerId);
    const wasHidden = !!offer && 'hidden' in offer && !!offer.hidden;
    if (onDispatch(action)) {
      setBuying(null);
      // A mystery card turns over.
      if (wasHidden) setFlipped(action.offerId);
    }
  };

  // A drag onto the sell slot sells a whole resource stack (the menu can sell fewer).
  const fromDrag = (sale: DragSale) =>
    setSelling(
      sale.resource
        ? {
            hikerId: sale.hikerId,
            resource: sale.resource,
            count:
              state.hikers.find((h) => h.id === sale.hikerId)?.inventory.resources[sale.resource] ??
              1,
          }
        : { hikerId: sale.hikerId, ...(sale.itemUid ? { itemUid: sale.itemUid } : {}) },
    );

  return (
    <section className={styles.screen} aria-label={`${theme.name}, a ranger station`}>
      <StationRoom theme={theme} checkpoint={station.checkpoint} />

      {talk ? (
        <TalkBubble
          state={state}
          talk={talk}
          name={theme.shopkeeper.name}
          simple={simple}
          onTalk={setTalk}
          onPreview={() => setPreview('look')}
        />
      ) : (
        <button
          type="button"
          className={`${styles.option} ${styles.talkAgain}`}
          onClick={() => setTalk('greet')}
        >
          <Icon name="sign" size={14} />
          TALK TO {theme.shopkeeper.name.toUpperCase()}
        </button>
      )}

      <button
        type="button"
        className={`${styles.restGo} ${styles.brass}`}
        onClick={() => setResting(true)}
      >
        REST & GO
        <small>Free night, then {nextBiome}</small>
      </button>
      {!simple && (
        <button
          type="button"
          className={`${styles.preview} ${styles.wood}`}
          onClick={() => setPreview('look')}
        >
          <Icon name="eye" size={18} color="#F0C76A" />
          PREVIEW NEXT TRAIL
        </button>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Station">
        <button
          type="button"
          role="tab"
          aria-selected={shown === 'shop'}
          className={styles.tab}
          disabled={!!state.crafting}
          onClick={() => setTab('shop')}
        >
          <Icon name="bag" size={16} />
          SHOP
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={shown === 'workbench'}
          className={styles.tab}
          onClick={() => setTab('workbench')}
        >
          <Icon name="hammer" size={16} />
          WORKBENCH
        </button>
      </div>

      {shown === 'shop' ? (
        <Counter state={state} flipped={flipped} onPick={pick} onSell={fromDrag} />
      ) : (
        <div className={counterStyles.counter}>
          <Workbench state={state} simple={simple} onDispatch={onDispatch} />
        </div>
      )}
      <KeeperArm theme={theme} />
      <Packs state={state} onSell={setSelling} onDispatch={onDispatch} />

      {buying && (
        <BuyDialog state={state} offerId={buying} onBuy={buy} onClose={() => setBuying(null)} />
      )}
      {selling && (
        <SellConfirm
          state={state}
          sale={selling}
          onSell={(action) => {
            onDispatch(action);
            setSelling(null);
          }}
          onCancel={() => setSelling(null)}
        />
      )}
      {preview && (
        <PreviewTrail
          state={state}
          mode={preview}
          onBuy={onDispatch}
          onClose={() => setPreview(null)}
        />
      )}
      {resting && (
        <ConfirmDialog
          title="Rest and go on?"
          message={`Everyone sleeps here for free, losing nothing, then heads into ${nextBiome} in the morning. You can’t come back to this station.`}
          confirmLabel="Rest & go"
          cancelLabel="Stay a while"
          onConfirm={() => {
            setResting(false);
            onDispatch({ type: 'restAndGo' });
          }}
          onCancel={() => setResting(false)}
        />
      )}
    </section>
  );
}

/** The shopkeeper's speech bubble, with its three options. */
function TalkBubble({
  state,
  talk,
  name,
  simple,
  onTalk,
  onPreview,
}: {
  state: GameState;
  talk: Talk;
  name: string;
  simple: boolean;
  onTalk(talk: Talk | null): void;
  onPreview(): void;
}) {
  const chips: TalkChip[] =
    talk === 'selling' ? marketChips(state) : talk === 'ahead' ? aheadChips(state) : [];
  return (
    <div className={styles.talk} role="group" aria-label={`${name} says`}>
      <span className={styles.talkWho}>{name.toUpperCase()}</span>
      <p className={styles.talkLine} aria-live="polite">
        {talkLine(state, talk)}
      </p>
      {chips.length > 0 && (
        <ul className={styles.chips}>
          {chips.map((c) => (
            <li key={c.key} className={styles.chip} data-tone={c.tone} title={c.label}>
              {c.img ? (
                <img src={c.img} alt={c.label} />
              ) : (
                c.icon && <Icon name={c.icon} size={18} />
              )}
              {c.text}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.options}>
        <button
          type="button"
          className={styles.option}
          aria-pressed={talk === 'selling'}
          onClick={() => onTalk('selling')}
        >
          <Icon name="acorn" size={14} />
          WHAT’S SELLING?
        </button>
        <button
          type="button"
          className={styles.option}
          aria-pressed={talk === 'ahead'}
          onClick={() => onTalk('ahead')}
        >
          <Icon name="sign" size={14} />
          WHAT’S AHEAD?
        </button>
        <button type="button" className={styles.option} onClick={() => onTalk(null)}>
          <Icon name="x" size={14} />
          JUST LOOKING
        </button>
        {simple && talk === 'ahead' && (
          <button type="button" className={styles.option} onClick={onPreview}>
            <Icon name="eye" size={14} />
            PREVIEW THE TRAIL
          </button>
        )}
      </div>
    </div>
  );
}

/** Selling: the price first, since it can't be undone. */
function SellConfirm({
  state,
  sale,
  onSell,
  onCancel,
}: {
  state: GameState;
  sale: SaleRequest;
  onSell(action: Action): void;
  onCancel(): void;
}) {
  const hiker = state.hikers.find((h) => h.id === sale.hikerId);
  if (!hiker) return null;
  if (sale.itemUid) {
    const item = hiker.inventory.bag.find((i) => i.uid === sale.itemUid);
    if (!item) return null;
    const price = sellPrice(item);
    const name = ITEMS[item.itemId]?.name ?? 'item';
    return (
      <ConfirmDialog
        title={`Sell the ${name}?`}
        message={`The shop pays ${price} cap${price === 1 ? '' : 's'}. Once it’s sold, it’s gone.`}
        confirmLabel={`Sell for ${price}`}
        cancelLabel="Keep it"
        onConfirm={() => onSell({ type: 'sell', hikerId: hiker.id, itemUid: item.uid })}
        onCancel={onCancel}
      />
    );
  }
  const r = sale.resource;
  const count = sale.count ?? 1;
  if (!r) return null;
  const price = resourceSellPrice(state, r, count);
  const name = resourceName(r);
  if (price < 1) {
    return (
      <ConfirmDialog
        title={`${name} sells for ×½ here`}
        message={`One ${name} is worth less than a cap at this station. Sell two together, or keep it.`}
        confirmLabel="OK"
        cancelLabel="Keep it"
        onConfirm={onCancel}
        onCancel={onCancel}
      />
    );
  }
  return (
    <ConfirmDialog
      title={`Sell ${count} ${name}?`}
      message={`The shop pays ${price} cap${price === 1 ? '' : 's'}. Once they’re sold, they’re gone.`}
      confirmLabel={`Sell for ${price}`}
      cancelLabel="Keep them"
      onConfirm={() => onSell({ type: 'sell', hikerId: hiker.id, resource: r, count })}
      onCancel={onCancel}
    />
  );
}
