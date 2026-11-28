/**
 * The scavenge window (docs/mockups/Scavenge.png, ScavengeMods.png): a light,
 * translucent overlay over the map. Cards are dealt face down; click one to
 * flip it (or Flip all), click a flipped card to pick it, then Take. Choice
 * cards open a row of chips to pick the exact resource or item.
 *
 * "Not now" closes it for free until a card has been flipped. After that a
 * card has to be taken. Enter takes the picked card; Esc is "Not now".
 *
 * A Sack keeps more cards: after the first take the window comes back with
 * that card marked Taken, for another take or Done.
 */
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/engine';
import { revealCues } from '../../audio/reveal';
import { SCAVENGE_CARDS } from '../../content';
import { hikerColor } from '../../content/characters';
import { BALANCE } from '../../config/balance';
import { ASSETS } from '../../config/assets';
import {
  bonusTaken,
  cardGains,
  pickOptions,
  rerollsLeft,
  scavengeCost,
  validateAction,
  type Action,
  type GameState,
  type ItemId,
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
import { ScavCard, type ScavCardProps } from './ScavCard';
import { usePreview, withPreview } from '../preview/preview';
import { fitCardRow, rowWidth } from '../layout/fitCardRow';
import styles from './ScavengeWindow.module.css';
import { HikerPortrait } from '../hikers/HikerPortrait';

type TakeAction = Extract<Action, { type: 'scavengeTake' }>;

interface ScavengeWindowProps {
  state: GameState;
  simple: boolean;
  onFlip(cards: number[]): void;
  onCancel(): void;
  /** Glasses or Gambler: reroll one flipped card. */
  onReroll(card: number): void;
  onTake(action: TakeAction): void;
}

export function ScavengeWindow({
  state,
  simple,
  onFlip,
  onCancel,
  onReroll,
  onTake,
}: ScavengeWindowProps) {
  const open = state.scavenge;
  const [picked, setSelected] = useState<number | null>(null);
  // A card already taken (with a Sack) isn't the picked one any more.
  const selected =
    picked !== null && open?.cards[picked] && !open.cards[picked].taken ? picked : null;
  // With a Sack, after the first take: how many more can be kept.
  const keepMore = open?.took ? (open.keeps ?? 0) - open.took + 1 : 0;
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
  const reroll = rerollsLeft(state);
  const take: TakeAction | null =
    open && selected !== null
      ? {
          type: 'scavengeTake',
          card: selected,
          ...(card?.pick && !card.empty ? { picks } : {}),
          ...(item ? { item } : {}),
          ...(paidBonus && paidCount ? { bonus: paidCount } : {}),
        }
      : null;
  const takeReason = take ? validateAction(state, take) : null;
  const canCancel = !!open && !open.took && open.cards.every((c) => !c.flipped);
  const canFinish = !!open?.took;

  // Enter takes the picked card; Esc is "Not now" while it's allowed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (canCancel || canFinish)) onCancel();
      if (e.key === 'Enter' && take && !takeReason) {
        e.preventDefault();
        onTake(take);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // Rebound each render, so it always sees the current card and picks.

  useEffect(() => {
    windowRef.current?.focus();
  }, [windowRef]);
  useScavengeSounds(open);

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
        data-edge-window="Scavenge"
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
              <HikerPortrait
                hikerId={hiker.id}
                className={styles.portrait}
                style={{ boxShadow: `0 0 0 2px ${hikerColor(hiker)}` }}
              />
              <span className={styles.hikerName}>{hiker.name.toUpperCase()}</span>
              {/* Work costs Energy (29-core-loop.md, section 1); Copier's bonus costs Appetite. */}
              <Icon name="zap" size={14} />
              <span className={styles.change}>
                {hiker.stats.energy} →{' '}
                <b>
                  {Math.max(
                    0,
                    hiker.stats.energy -
                      (open.took ? BALANCE.items.sackEnergy : scavengeCost(state, hiker)),
                  )}
                </b>
              </span>
              {bonus.appetite > 0 && (
                <>
                  <Icon name="utensils" size={14} />
                  <span className={styles.change}>
                    {hiker.stats.appetite} →{' '}
                    <b>{Math.max(0, hiker.stats.appetite - bonus.appetite)}</b>
                  </span>
                </>
              )}
            </span>
          )}
        </header>

        {open ? (
          <>
            <div
              className={styles.cards}
              data-count={open.cards.length}
              style={{ maxWidth: rowWidth(cardFit(open.cards.length), CARD + 20, CARD_GAP) }}
            >
              {open.cards.map((c, i) =>
                c.taken ? (
                  <div key={i} className={styles.taken} aria-label="Taken">
                    <ScavCard
                      card={c}
                      size={cardSize(open.cards.length)}
                      faceUp
                      caption={simple ? 'simple' : 'full'}
                      selected={false}
                      onClick={() => undefined}
                    />
                    <span className={styles.takenLabel}>TAKEN</span>
                  </div>
                ) : (
                  <TableCard
                    key={i}
                    index={i}
                    card={c}
                    size={cardSize(open.cards.length)}
                    faceUp={c.flipped}
                    caption={simple ? 'simple' : 'full'}
                    selected={selected === i}
                    onClick={() => (c.flipped ? choose(i) : flip(i))}
                  />
                ),
              )}
            </div>

            {card?.pick && !card.empty && (
              <PickChips card={card} picks={picks} simple={simple} onPicks={setPicks} />
            )}
            {card?.items && !card.empty && SCAVENGE_CARDS[card.type].choiceItem && (
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
              {canFinish && !takeReason && (
                <span className={styles.reason}>
                  Sack: keep {keepMore} more card{keepMore === 1 ? '' : 's'}, or Done.
                </span>
              )}
              {reroll && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!card?.flipped || reroll.left <= 0}
                  onClick={() => selected !== null && onReroll(selected)}
                  title={`${reroll.label}: reroll the picked card`}
                >
                  <Icon name="dice" size={16} /> Reroll · {reroll.left}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={onCancel}
                  data-sound="ui.cancel"
                >
                  Not now
                </button>
              )}
              {canFinish && (
                <button type="button" className={styles.secondary} onClick={onCancel}>
                  Done
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
                data-sound="card.take"
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

/**
 * The scavenge's sounds (32-audio-system.md, section 6): the node's rummage
 * and a deal per card as the window opens; each card's flip with its reveal
 * chimes; and, after a take, the cards left over sliding away.
 */
function useScavengeSounds(open: GameState['scavenge']) {
  const flipped = useRef<boolean[] | null>(null);
  // Once a card is face up, the window only closes after a take: the rest slide away.
  const took = useRef(false);
  useEffect(() => {
    took.current = !!open?.took || !!open?.cards.some((c) => c.flipped);
  });
  const node = open?.cards.find((c) => c.node)?.node ?? null;
  useEffect(() => {
    const at = performance.now();
    if (node) sfx(`act.scavenge.${node}`);
    sfx('ui.windowOpen');
    return () => {
      // React's development double mount isn't a close.
      if (performance.now() - at > 100) sfx(took.current ? 'card.discard' : 'ui.windowClose');
    };
  }, [node]);
  const count = open?.cards.length ?? 0;
  useEffect(() => {
    for (let i = 0; i < count; i++) sfx('card.deal', { delay: i * BALANCE.audio.dealGapSec });
  }, [count]);
  useEffect(() => {
    const now = open?.cards.map((c) => c.flipped) ?? [];
    const was = flipped.current;
    flipped.current = now;
    if (!was || !open) return;
    let k = 0;
    open.cards.forEach((c, i) => {
      if (!c.flipped || was[i]) return;
      for (const cue of revealCues(c.rarity, k * BALANCE.audio.flipGapSec)) {
        sfx(cue.id, cue.delay ? { delay: cue.delay } : {});
      }
      k += 1;
    });
  }, [open]);
}

/** A scavenge card's normal size, the gap between cards, and the room for the row (the window's inside). */
const CARD = 196;
const CARD_GAP = 18;
const ROW_ROOM = 916;

/**
 * Cards that don't fit (a Dog, a Forager, every bonus at once) shrink evenly
 * down to 80%, then wrap onto a second row (Phase 10.6): never clipped.
 */
const cardFit = (count: number) => fitCardRow(count, CARD + 20, CARD_GAP, ROW_ROOM);
function cardSize(count: number): number {
  return Math.floor(CARD * cardFit(count).scale);
}

function takeLabel(card: ScavengeCard, picks: ResourceId[], item: ItemId | null): string {
  const gains = cardGains(card, picks, item ?? undefined);
  if (card.empty) return 'TAKE EMPTY';
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

/** Informative mode: what taking the picked card does to the Abundance bar. */
function Drain({ state, card }: { state: GameState; card: ScavengeCard }) {
  if (!card.node) return null;
  const def = SCAVENGE_CARDS[card.type];
  const amount = def.drain + (card.bounty ? BALANCE.abundance.bountyExtraDrain : 0);
  const from = state.abundance;
  return (
    <>
      <span className={styles.drainRow}>
        <img src={NODE_IMAGE[card.node]} alt="" width={16} height={18} />
        Abundance {from} → <b>{Math.max(0, from - amount)}</b>
      </span>
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

/** A card on the table: once it's face up, hover or long-press shows it large. */
function TableCard(props: ScavCardProps) {
  const item = SCAVENGE_CARDS[props.card.type].itemCard ? props.card.items?.[0] : undefined;
  const q = props.card.itemQuality;
  const preview = usePreview(
    !props.faceUp
      ? null
      : item
        ? { kind: 'item', itemId: item, ...(q ? { item: { quality: q } } : {}) }
        : { kind: 'scavenge', card: props.card },
  );
  return <ScavCard {...props} preview={preview} />;
}

/** A Choice card's item: hover or long-press for the full card, Quality not rolled yet. */
function ItemChip({
  id,
  pressed,
  showFace,
  onItem,
}: {
  id: ItemId;
  pressed: boolean;
  showFace: boolean;
  onItem(id: ItemId): void;
}) {
  const preview = usePreview({ kind: 'item', itemId: id, unrolled: true });
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={pressed}
      {...withPreview({ onClick: () => onItem(id) }, preview)}
    >
      {showFace ? <CardFace itemId={id} width={26} compact /> : null}
      {itemName(id)}
    </button>
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
          <ItemChip key={id} id={id} pressed={item === id} showFace={!!type} onItem={onItem} />
        ))}
      </div>
    </div>
  );
}
