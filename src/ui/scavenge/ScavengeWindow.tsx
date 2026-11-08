/**
 * The scavenge window (docs/mockups/Scavenge.png, ScavengeMods.png): a light,
 * translucent overlay over the map. Cards are dealt face down; click one to
 * flip it (or Flip all), click a flipped card to pick it, then Take. Choice
 * cards open a row of chips to pick the exact resource or item.
 *
 * "Not now" closes it for free until a card has been flipped. After that a
 * card has to be taken. Enter takes the picked card; Esc is "Not now".
 */
import { useEffect, useState } from 'react';
import { SCAVENGE_CARDS } from '../../content';
import { characterFor } from '../../content/characters';
import { BALANCE } from '../../config/balance';
import { ASSETS } from '../../config/assets';
import {
  bonusTaken,
  cardGains,
  pickOptions,
  rerollAbility,
  scavengeCost,
  validateAction,
  type Action,
  type GameState,
  type ItemId,
  type ItemInstance,
  type NodeType,
  type ResourceId,
  type ScavengeBonus,
  type ScavengeCard,
} from '../../engine';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { useDraggable } from '../windows/useDraggable';
import { cardItemType, cardTitle, itemName, resourceName, resourcesTitle } from './cardLook';
import { ItemCard as CardFace } from '../items/ItemCard';
import { ScavCard } from './ScavCard';
import styles from './ScavengeWindow.module.css';

type TakeAction = Extract<Action, { type: 'scavengeTake' }>;

/** What a hiker just took, shown for a moment before the window closes. */
export interface TookCard {
  card: ScavengeCard;
  hikerName: string;
  resources: ResourceId[];
  caps: number;
  items: ItemId[];
  /** The items as they landed in the bag, with their Quality. */
  found?: ItemInstance[];
}

interface ScavengeWindowProps {
  state: GameState;
  simple: boolean;
  /** Set right after a card is taken: the window shows it, then closes. */
  took: TookCard | null;
  onFlip(cards: number[]): void;
  onCancel(): void;
  /** Gambler: reroll one flipped card. */
  onReroll(card: number): void;
  onTake(action: TakeAction): void;
  onClose(): void;
}

const CLOSE_AFTER_MS = 1600;

export function ScavengeWindow({
  state,
  simple,
  took,
  onFlip,
  onCancel,
  onReroll,
  onTake,
  onClose,
}: ScavengeWindowProps) {
  const open = state.scavenge;
  const [selected, setSelected] = useState<number | null>(null);
  const [picks, setPicks] = useState<ResourceId[]>([]);
  const [item, setItem] = useState<ItemId | null>(null);
  const [bonusesOpen, setBonusesOpen] = useState(false);
  // Copier: take the paid bonus resources too.
  const [paidBonus, setPaidBonus] = useState(false);
  const { ref: windowRef, windowProps, translate } = useDraggable<HTMLDivElement>('scavenge');

  const card = open && selected !== null ? open.cards[selected] : undefined;
  const offers = open?.bonusOffers ?? [];
  const paidCount = offers.filter((o) => o.appetiteEach > 0).reduce((n, o) => n + o.count, 0);
  const hasResources = !!card && cardGains(card, picks, item ?? undefined).resources.length > 0;
  const bonus = bonusTaken(offers, paidBonus ? paidCount : 0, hasResources);
  const reroll = rerollAbility(state);
  const take: TakeAction | null =
    open && selected !== null
      ? {
          type: 'scavengeTake',
          card: selected,
          ...(card?.pick ? { picks } : {}),
          ...(item ? { item } : {}),
          ...(paidBonus && paidCount ? { bonus: paidCount } : {}),
        }
      : null;
  const takeReason = take ? validateAction(state, take) : null;
  const canCancel = !!open && open.cards.every((c) => !c.flipped);

  // Enter takes the picked card; Esc is "Not now" while it's allowed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (took) {
        if (e.key === 'Enter' || e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'Escape' && canCancel) onCancel();
      if (e.key === 'Enter' && take && !takeReason) {
        e.preventDefault();
        onTake(take);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // Rebound each render, so it always sees the current card and picks.

  // After a card is taken, close on its own after a moment.
  useEffect(() => {
    if (!took) return;
    const t = setTimeout(onClose, CLOSE_AFTER_MS);
    return () => clearTimeout(t);
  }, [took, onClose]);

  useEffect(() => {
    windowRef.current?.focus();
  }, [windowRef]);

  const hiker = state.hikers.find((h) => h.id === open?.hikerId);
  const tile = open ? state.section.tiles[open.tileId] : undefined;
  const choose = (i: number) => {
    if (i === selected) return;
    setSelected(i);
    setPicks([]);
    setItem(null);
  };
  const flip = (i: number) => {
    onFlip([i]);
    if (selected === null) choose(i);
  };

  return (
    <div className={styles.overlay}>
      <div
        ref={windowRef}
        className={styles.window}
        role="dialog"
        aria-modal="true"
        aria-label="Scavenge"
        tabIndex={-1}
        style={{ translate }}
        {...windowProps}
      >
        <header className={styles.header} data-drag-handle>
          <h2 className={styles.title}>SCAVENGE</h2>
          <span className={styles.nodes}>
            {tile?.nodes.map((n, i) =>
              n.type === 'caps' ? (
                <img key={i} src={ASSETS.icons.acornCaps} alt="Cap node" width={24} height={24} />
              ) : (
                <img
                  key={i}
                  src={NODE_IMAGE[n.type]}
                  alt={`${NODE_NAME[n.type]} node`}
                  width={22}
                  height={25}
                />
              ),
            )}
          </span>
          <span className={styles.spacer} />
          {open && open.bonuses.length > 0 && (
            <Bonuses
              bonuses={open.bonuses}
              open={bonusesOpen}
              onToggle={() => setBonusesOpen((o) => !o)}
            />
          )}
          {hiker && open && (
            <span className={styles.hiker}>
              <img
                className={styles.portrait}
                src={ASSETS.portraits.placeholder}
                alt=""
                style={{ boxShadow: `0 0 0 2px ${characterFor(hiker.id).color}` }}
              />
              <span className={styles.hikerName}>{hiker.name.toUpperCase()}</span>
              <Icon name="utensils" size={14} />
              <span className={styles.change}>
                {hiker.stats.appetite} →{' '}
                <b>
                  {Math.max(0, hiker.stats.appetite - scavengeCost(state, hiker) - bonus.appetite)}
                </b>
              </span>
            </span>
          )}
        </header>

        {took ? (
          <Result took={took} simple={simple} onClose={onClose} />
        ) : open ? (
          <>
            <div className={styles.cards} data-count={open.cards.length}>
              {open.cards.map((c, i) => (
                <ScavCard
                  key={i}
                  card={c}
                  size={cardSize(open.cards.length)}
                  faceUp={c.flipped}
                  caption={simple ? 'simple' : 'full'}
                  selected={selected === i}
                  onClick={() => (c.flipped ? choose(i) : flip(i))}
                />
              ))}
            </div>

            {card?.pick && (
              <PickChips card={card} picks={picks} simple={simple} onPicks={setPicks} />
            )}
            {card?.items && SCAVENGE_CARDS[card.type].choiceItem && (
              <ItemChips card={card} item={item} onItem={setItem} />
            )}
            {paidCount > 0 && hasResources && (
              <div className={styles.chooser}>
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={paidBonus}
                  onClick={() => setPaidBonus((b) => !b)}
                >
                  <Icon name="plus" size={16} />
                  {paidCount} BONUS
                  <span className={styles.chipCost}>
                    −
                    {offers
                      .filter((o) => o.appetiteEach > 0)
                      .reduce((n, o) => n + o.count * o.appetiteEach, 0)}{' '}
                    Appetite
                  </span>
                </button>
              </div>
            )}

            <footer className={styles.footer}>
              <span className={styles.drain}>
                {!simple && card && <Drain state={state} card={card} />}
              </span>
              {take && takeReason && <span className={styles.reason}>{takeReason}</span>}
              {reroll && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!card?.flipped || reroll.usesLeft <= 0}
                  onClick={() => selected !== null && onReroll(selected)}
                  title={`${reroll.ability.label}: reroll the picked card`}
                >
                  <Icon name="dice" size={16} /> Reroll · {reroll.usesLeft}
                </button>
              )}
              {canCancel && (
                <button type="button" className={styles.secondary} onClick={onCancel}>
                  Not now
                </button>
              )}
              {open.cards.some((c) => !c.flipped) && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    const down = open.cards.flatMap((c, i) => (c.flipped ? [] : [i]));
                    onFlip(down);
                    if (selected === null && down[0] !== undefined) choose(down[0]);
                  }}
                >
                  Flip all
                </button>
              )}
              <button
                type="button"
                className={styles.take}
                disabled={!take || !!takeReason}
                onClick={() => take && !takeReason && onTake(take)}
              >
                {card
                  ? `${takeLabel(card, picks, item)}${bonus.count ? ` + ${bonus.count} BONUS` : ''}`
                  : 'PICK A CARD'}
              </button>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Cards shrink a little when a Dog or Forager gets extra ones. */
function cardSize(count: number): number {
  if (count <= 4) return 196;
  if (count === 5) return 166;
  return 140;
}

function takeLabel(card: ScavengeCard, picks: ResourceId[], item: ItemId | null): string {
  const gains = cardGains(card, picks, item ?? undefined);
  if (card.pick) return gains.resources.length ? `TAKE ${resourcesTitle(gains.resources)}` : 'TAKE';
  if (card.caps) return `TAKE ${card.caps} CAP${card.caps === 1 ? '' : 'S'}`;
  if (card.items) {
    const id = gains.items[0];
    return id ? `TAKE ${itemName(id).toUpperCase()}` : 'TAKE';
  }
  return `TAKE ${cardTitle(card)}`;
}

const TONE_ICON: Record<ScavengeBonus['tone'], IconName> = {
  luck: 'sparkles',
  bonus: 'star',
  warning: 'alert',
};

function Bonuses({
  bonuses,
  open,
  onToggle,
}: {
  bonuses: ScavengeBonus[];
  open: boolean;
  onToggle(): void;
}) {
  return (
    <span className={styles.bonusWrap}>
      <button type="button" className={styles.pill} aria-expanded={open} onClick={onToggle}>
        <Icon name="sparkles" size={15} color="#E9B44C" />
        {bonuses.length} bonus{bonuses.length === 1 ? '' : 'es'}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={13} />
      </button>
      {open && (
        <ul className={styles.bonuses}>
          {bonuses.map((b, i) => (
            <li key={i} className={styles.bonus} data-tone={b.tone}>
              <Icon name={b.source === 'Dog' ? 'paw' : TONE_ICON[b.tone]} size={15} />
              {b.label}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Informative mode: what taking the picked card does to its node's meter. */
function Drain({ state, card }: { state: GameState; card: ScavengeCard }) {
  const def = SCAVENGE_CARDS[card.type];
  const rows: { node: NodeType; amount: number }[] = [];
  if (card.node) {
    rows.push({
      node: card.node,
      amount: def.drain + (card.bounty ? BALANCE.abundance.bountyExtraDrain : 0),
    });
  }
  if (card.node2) rows.push({ node: card.node2, amount: def.drain });
  return (
    <>
      {rows.map(({ node, amount }) => {
        const from = state.abundance[node];
        return (
          <span key={node} className={styles.drainRow}>
            <img src={NODE_IMAGE[node]} alt="" width={16} height={18} />
            {NODE_NAME[node]} Abundance {from} → <b>{Math.max(0, from - amount)}</b>
          </span>
        );
      })}
    </>
  );
}

/** Choice and "of the Wild" cards: pick the exact resources. */
function PickChips({
  card,
  picks,
  simple,
  onPicks,
}: {
  card: ScavengeCard;
  picks: ResourceId[];
  simple: boolean;
  onPicks(p: ResourceId[]): void;
}) {
  const pick = card.pick;
  if (!pick) return null;
  const options = pickOptions(pick.from);
  const where = pick.from === 'all' ? 'any' : NODE_NAME[pick.from];
  const prompt =
    pick.count === 1
      ? `Pick ${pick.from === 'all' ? 'any' : `a ${where}`} resource${pick.each > 1 ? `, get ${pick.each}` : ''}`
      : `Pick ${pick.count} resources, the same or different`;
  const add = (r: ResourceId) => {
    if (pick.count === 1) onPicks([r]);
    else if (picks.length < pick.count) onPicks([...picks, r]);
    else onPicks([...picks.slice(0, -1), r]);
  };
  return (
    <div className={styles.chooser} data-wide={options.length > 4}>
      {!simple && <span className={styles.prompt}>{prompt}</span>}
      <div className={styles.chips}>
        {options.map((r) => {
          const n = picks.filter((p) => p === r).length;
          return (
            <button
              key={r}
              type="button"
              className={styles.chip}
              aria-pressed={n > 0}
              onClick={() => add(r)}
            >
              <img src={ASSETS.resources[r]} alt="" />
              {resourceName(r)}
              {n > 1 && <span className={styles.chipCount}>×{n}</span>}
            </button>
          );
        })}
        {pick.count > 1 && picks.length > 0 && (
          <button type="button" className={styles.clear} onClick={() => onPicks([])}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/** Choice item cards: pick 1 of the items. */
function ItemChips({
  card,
  item,
  onItem,
}: {
  card: ScavengeCard;
  item: ItemId | null;
  onItem(id: ItemId): void;
}) {
  const type = cardItemType(card);
  return (
    <div className={styles.chooser}>
      <div className={styles.chips}>
        {(card.items ?? []).map((id) => (
          <button
            key={id}
            type="button"
            className={styles.chip}
            aria-pressed={item === id}
            onClick={() => onItem(id)}
          >
            {type ? <CardFace itemId={id} width={26} compact /> : null}
            {itemName(id)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Just after taking: the card (a Wild shows what it was) and what it gave. */
function Result({ took, simple, onClose }: { took: TookCard; simple: boolean; onClose(): void }) {
  const parts: string[] = [];
  if (took.resources.length) parts.push(resourcesTitle(took.resources));
  if (took.caps) parts.push(`${took.caps} CAP${took.caps === 1 ? '' : 'S'}`);
  for (const id of took.items) parts.push(itemName(id).toUpperCase());
  return (
    <button type="button" className={styles.result} onClick={onClose} aria-label="Close">
      <ScavCard card={took.card} size={196} faceUp reveal caption={simple ? 'simple' : 'full'} />
      {took.found?.map((item) => (
        <CardFace key={item.uid} itemId={item.itemId} item={item} width={196} />
      ))}
      <span className={styles.got}>
        <span className={styles.gotLabel}>{took.hikerName.toUpperCase()} GOT</span>
        <span className={styles.gotWhat}>
          {parts.length ? parts.join(' + ') : 'NOTHING (NO ROOM)'}
        </span>
      </span>
    </button>
  );
}
