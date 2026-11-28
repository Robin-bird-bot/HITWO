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
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { RESOURCES } from '../../content/resources';
import { useScavengeReveal } from '../app/lookSettings';
import { useReducedMotion } from '../app/useReducedMotion';
import { PosterScene } from './PosterScene';
import { brushBits, burst, clearedShare, paintCover, seedOf, uncovers } from './brush';
import { starredRecipes, wantedRibbon } from './needed';
import { RecipeBook } from '../craft/RecipeBook';
import type { RecipePart } from '../../engine/items/recipe';
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
  RARITIES,
  type Action,
  type GameState,
  type Hiker,
  type NodeType,
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
import { fitCardRow } from '../layout/fitCardRow';
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
  /** The scavenge just ended with a take: the cards left over fall away as the window goes. */
  leaving?: boolean;
  /** Stars from the read-only recipe book (saved with the hike). */
  onDispatch?(action: Action): void;
}

export function ScavengeWindow({
  state,
  simple,
  onFlip,
  onCancel,
  onReroll,
  onTake,
  leaving = false,
  onDispatch,
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
  // The brush reveal (35-ui-overhaul.md, section 5), a setting: covers to brush away.
  const brush = useScavengeReveal() === 'brush';
  const reduced = useReducedMotion();
  const groundRef = useRef<HTMLDivElement>(null);
  const covers = useRef(new Map<number, CoverHandle>());
  // Looking for's recipe book, read only (35-ui-overhaul.md, section 5).
  const [bookOpen, setBookOpen] = useState(false);

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

  const nodes = [
    ...new Set(
      tile?.nodes.flatMap((n) => (n.type === 'caps' || !n.revealed ? [] : [n.type])) ?? [],
    ),
  ].slice(0, 2);
  const seed = seedOf(open?.tileId ?? '');
  const ground =
    nodes.length > 1
      ? `linear-gradient(100deg, ${GROUND[nodes[0]!]} 45%, ${GROUND[nodes[1]!]} 55%)`
      : GROUND[nodes[0] ?? 'forest'];
  const anyDown = !!open?.cards.some((c) => !c.flipped && !c.taken);
  const message = !open
    ? ''
    : selected !== null
      ? 'Take it, or pick another card.'
      : anyDown
        ? `${brush ? 'Drag across a card to brush it clear.' : 'Click a card to flip it.'}${
            canCancel ? ' Not now is free until you look.' : ''
          }`
        : 'Pick one card to keep.';
  const flipAll = async () => {
    if (!open) return;
    const down = open.cards.flatMap((c, i) => (c.flipped || c.taken ? [] : [i]));
    if (selected === null && down[0] !== undefined) choose(down[0]);
    if (brush) {
      for (const i of down) {
        await covers.current.get(i)?.brushAll();
        await wait(reduced ? 0 : BALANCE.audio.flipGapSec * 1000);
      }
      return;
    }
    onFlip(down);
  };

  return (
    <div className={styles.overlay} data-leaving={leaving || undefined}>
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
        <header className={styles.poster} data-drag-handle>
          {nodes.map((n, i) => (
            <div key={n} className={styles.art} data-second={i > 0 || undefined}>
              <PosterScene node={n} seed={seed + i} />
            </div>
          ))}
          <div className={styles.posterTitle}>
            <small>SCAVENGE</small>
            <h2 className={styles.title}>
              {nodes.length ? nodes.map((n) => NODE_NAME[n].toUpperCase()).join(' + ') : 'TRAIL'}
            </h2>
          </div>
          <div className={styles.who}>
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
          </div>
        </header>

        {open ? (
          <div ref={groundRef} className={styles.ground} style={{ background: ground }}>
            <div className={styles.table}>
              <div
                className={styles.cards}
                data-count={open.cards.length}
                data-picking={selected !== null || undefined}
              >
                {open.cards.map((c, i) => {
                  const size = cardSize(open.cards.length);
                  const ribbon =
                    c.flipped && hiker && !c.empty
                      ? wantedRibbon(state, hiker, c.resources ?? [])
                      : null;
                  return (
                    <DealtCard
                      key={i}
                      index={i}
                      seed={seed}
                      reduced={reduced}
                      leaving={leaving}
                      picked={selected === i}
                      ribbon={ribbon}
                      flipped={c.flipped}
                      rarity={c.rarity}
                      layer={groundRef}
                    >
                      {c.taken ? (
                        <div className={styles.taken} aria-label="Taken">
                          <ScavCard
                            card={c}
                            size={size}
                            faceUp
                            caption={simple ? 'simple' : 'full'}
                            selected={false}
                            onClick={() => undefined}
                          />
                          <span className={styles.takenLabel}>TAKEN</span>
                        </div>
                      ) : brush && !c.flipped ? (
                        <Covered
                          ref={(h) => {
                            if (h) covers.current.set(i, h);
                            else covers.current.delete(i);
                          }}
                          card={c}
                          size={size}
                          layer={groundRef}
                          reduced={reduced}
                          onUncover={() => flip(i)}
                        />
                      ) : (
                        <TableCard
                          index={i}
                          card={c}
                          size={size}
                          faceUp={c.flipped}
                          caption={simple ? 'simple' : 'full'}
                          selected={selected === i}
                          dim={selected !== null && selected !== i}
                          onClick={() => (c.flipped ? choose(i) : flip(i))}
                        />
                      )}
                    </DealtCard>
                  );
                })}
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
            </div>

            {hiker && (
              <LookingFor
                state={state}
                hiker={hiker}
                onBook={() => {
                  sfx('book.page');
                  setBookOpen(true);
                }}
              />
            )}
            {hiker && bookOpen && (
              <div className={styles.bookOverlay}>
                <RecipeBook
                  state={state}
                  hiker={hiker}
                  readOnly
                  onDispatch={(a) => onDispatch?.(a)}
                />
                <button
                  type="button"
                  className={styles.bookClose}
                  aria-label="Close the recipe book"
                  data-sound="ui.cancel"
                  onClick={() => setBookOpen(false)}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            )}

            <footer className={styles.footer}>
              <span className={styles.message} role="status">
                {take && takeReason ? (
                  takeReason
                ) : canFinish ? (
                  `Sack: keep ${keepMore} more card${keepMore === 1 ? '' : 's'}, or Done.`
                ) : (
                  <>
                    {message}
                    {!simple && card && <Drain state={state} card={card} />}
                  </>
                )}
              </span>
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
              {anyDown && (
                <button type="button" className={styles.secondary} onClick={() => void flipAll()}>
                  {brush ? 'Brush all' : 'Flip all'}
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
          </div>
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
const CARD = 176;
const CARD_GAP = 18;
const ROW_ROOM = 800;

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

/** The table under the cards, in the node's color (the prototype's `NODE_LOOK`). */
const GROUND: Record<NodeType, string> = {
  forest: '#2f5443',
  river: '#284a66',
  wildlife: '#6c5233',
  mountain: '#55524c',
};

const RARITY_COLOR: Record<ScavengeCard['rarity'], string> = {
  common: '#9c9585',
  uncommon: '#4fa477',
  rare: '#e0a631',
  veryRare: '#a97bd8',
  legendary: '#ee7a45',
  mythic: '#4ec3dd',
};

const wait = (ms: number) => new Promise((done) => window.setTimeout(done, ms));

/**
 * A card dealt onto the table (35-ui-overhaul.md, section 5): it slides in
 * from above, one after another, and lands with a small tilt and height of
 * its own (seeded by the tile, so the table looks the same on a reload).
 * Flipping pops it, and Rare and up burst confetti in the rarity's color; a
 * card a starred recipe needs gets its NEEDED ribbon (`card.wanted`). The
 * picked card lifts; when the window goes after a take, the rest fall away.
 */
function DealtCard({
  index,
  seed,
  reduced,
  leaving,
  picked,
  ribbon,
  flipped,
  rarity,
  layer,
  children,
}: {
  index: number;
  seed: number;
  reduced: boolean;
  leaving: boolean;
  picked: boolean;
  ribbon: string | null;
  flipped: boolean;
  rarity: ScavengeCard['rarity'];
  layer: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const D = BALANCE.ui.overhaul.deal;
  const ref = useRef<HTMLDivElement>(null);
  const [dealt, setDealt] = useState(reduced);
  const r = rngOf(seed + index * 7919);
  const tilt = (r() * 2 - 1) * D.tiltDeg;
  const lift = (r() * 2 - 1) * D.heightPx;
  const fall = r() * 100 - 50;
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setDealt(true), 60 + index * BALANCE.audio.dealGapSec * 1000);
    return () => window.clearTimeout(t);
  }, [index, reduced]);
  // A flip: the pop, and confetti for Rare and up.
  const was = useRef(flipped);
  useEffect(() => {
    if (!flipped || was.current) {
      was.current = flipped;
      return;
    }
    was.current = flipped;
    const el = ref.current;
    const box = layer.current;
    if (reduced || !el || !box) return;
    el.animate([{ scale: '1' }, { scale: '1.1', offset: 0.4 }, { scale: '1' }], {
      duration: D.popMs,
      easing: 'cubic-bezier(.3,1.5,.5,1)',
    });
    const step = RARITIES.indexOf(rarity);
    if (step >= 2) {
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const scale = b.width / box.offsetWidth || 1;
      burst(
        box,
        (a.left + a.width / 2 - b.left) / scale,
        (a.top + a.height / 2 - b.top) / scale,
        [RARITY_COLOR[rarity], '#fff6dc', '#E9B44C'],
        10 + step * 6,
        110 + step * 15,
      );
    }
  }, [flipped, rarity, reduced, layer, D.popMs]);
  // The ribbon a moment after the flip, with its ping.
  const [ribbonOn, setRibbonOn] = useState(false);
  useEffect(() => {
    if (!ribbon) return;
    const t = window.setTimeout(
      () => {
        setRibbonOn(true);
        sfx('card.wanted');
      },
      reduced ? 0 : D.ribbonMs,
    );
    return () => window.clearTimeout(t);
  }, [ribbon, reduced, D.ribbonMs]);
  const placed = `translate(0, ${lift - (picked ? 18 : 0)}px) rotate(${picked ? 0 : tilt}deg) scale(${picked ? 1.05 : 1})`;
  return (
    <div
      ref={ref}
      className={styles.dealt}
      data-leaving={(leaving && !picked) || undefined}
      style={{
        transform: leaving
          ? picked
            ? placed
            : `translate(0, 760px) rotate(${fall}deg)`
          : dealt
            ? placed
            : 'translate(0, -620px) rotate(-28deg) scale(0.85)',
        // The taken card flies off to the hiker (TakeFly); the rest fall away.
        opacity: leaving ? 0 : 1,
      }}
    >
      {ribbon && (
        <div className={styles.ribbon} data-on={ribbonOn || undefined}>
          ★ {ribbon}
        </div>
      )}
      {children}
    </div>
  );
}

/** Brushes a card's cover away (for Brush all). */
interface CoverHandle {
  brushAll(): Promise<void>;
}

/**
 * The brush reveal: the card under its node's cover. Drag across it to
 * brush it away (a click brushes a patch); once half of it is clear, the rest
 * blows away and the card turns face up, with its chimes.
 */
const Covered = forwardRef<
  CoverHandle,
  {
    card: ScavengeCard;
    size: number;
    layer: RefObject<HTMLDivElement | null>;
    reduced: boolean;
    onUncover(): void;
  }
>(function Covered({ card, size, layer, reduced, onUncover }, ref) {
  const B = BALANCE.ui.overhaul.brush;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const node = card.node ?? 'any';
  const sound = `scav.brush.${card.node ?? 'forest'}`;
  const [gone, setGone] = useState(false);
  const state = useRef({
    down: false,
    last: null as [number, number] | null,
    strokes: 0,
    sound: 0,
    done: false,
  });
  useEffect(() => {
    const c = canvasRef.current;
    if (c) paintCover(c, node);
  }, [node]);

  const uncover = () => {
    const s = state.current;
    if (s.done) return;
    s.done = true;
    setGone(true);
    sfx('scav.uncover');
    const c = canvasRef.current;
    const box = layer.current;
    if (c && box && !reduced) {
      const a = c.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const scale = b.width / box.offsetWidth || 1;
      burst(
        box,
        (a.left + a.width / 2 - b.left) / scale,
        (a.top + a.height / 2 - b.top) / scale,
        COVER_DUST[node] ?? COVER_DUST.any,
        22,
        120,
        160,
      );
    }
    onUncover();
  };
  const check = () => {
    const c = canvasRef.current;
    if (c && uncovers(clearedShare(c))) uncover();
  };
  const at = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * e.currentTarget.width) / r.width,
      ((e.clientY - r.top) * e.currentTarget.height) / r.height,
    ];
  };
  const erase = (p: [number, number], client: { x: number; y: number }) => {
    const c = canvasRef.current;
    const x = c?.getContext('2d');
    const s = state.current;
    if (!c || !x || s.done) return;
    x.globalCompositeOperation = 'destination-out';
    x.lineCap = 'round';
    x.lineWidth = B.brushPx;
    x.beginPath();
    x.moveTo(...(s.last ?? p));
    x.lineTo(...p);
    x.stroke();
    s.last = p;
    const now = performance.now();
    if (now - s.sound > B.soundMs) {
      s.sound = now;
      sfx(sound, { volume: 0.7 });
      const box = layer.current;
      if (box && !reduced) {
        const b = box.getBoundingClientRect();
        const scale = b.width / box.offsetWidth || 1;
        brushBits(box, (client.x - b.left) / scale, (client.y - b.top) / scale, node);
      }
    }
    s.strokes += 1;
    if (s.strokes % 5 === 0) check();
  };

  useImperativeHandle(ref, () => ({
    async brushAll() {
      const c = canvasRef.current;
      const x = c?.getContext('2d');
      if (!c || !x || state.current.done) return;
      x.globalCompositeOperation = 'destination-out';
      x.lineWidth = B.brushPx * 1.1;
      x.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        x.beginPath();
        x.moveTo(20, 30 + k * 52);
        x.lineTo(c.width - 20, 50 + k * 52);
        x.stroke();
        if (k % 2 === 0) sfx(sound, { volume: 0.6 });
        if (!reduced) await wait(40);
      }
      uncover();
    },
  }));

  return (
    <div className={styles.covered} style={{ width: size, height: size }}>
      <div aria-hidden={!gone || undefined}>
        {/* No caption under a cover: it would say what's beneath. */}
        <ScavCard card={card} size={size} faceUp caption="none" selected={false} />
      </div>
      <canvas
        ref={canvasRef}
        className={styles.cover}
        data-gone={gone || undefined}
        data-glow={RARITIES.indexOf(card.rarity) >= 2 || undefined}
        style={{ width: size, height: size, '--rarc': RARITY_COLOR[card.rarity] } as CSSProperties}
        width={B.canvasPx}
        height={B.canvasPx}
        role="button"
        aria-label={`Covered card from ${card.node ? NODE_NAME[card.node] : 'any node'}. Drag across it to brush it clear.`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void (ref && 'current' in ref ? ref.current?.brushAll() : undefined);
          }
        }}
        onPointerDown={(e) => {
          state.current.down = true;
          state.current.last = null;
          e.currentTarget.setPointerCapture(e.pointerId);
          erase(at(e), { x: e.clientX, y: e.clientY });
          e.stopPropagation();
        }}
        onPointerMove={(e) => {
          if (state.current.down) erase(at(e), { x: e.clientX, y: e.clientY });
        }}
        onPointerUp={() => {
          state.current.down = false;
          state.current.last = null;
          check();
        }}
        onPointerCancel={() => {
          state.current.down = false;
          state.current.last = null;
        }}
      />
    </div>
  );
});

/** The dust when a cover blows away, by node. */
const COVER_DUST: Record<NodeType | 'any', readonly string[]> & { any: readonly string[] } = {
  forest: ['#6b8f3e', '#c46a2c', '#d9a441'],
  any: ['#6b8f3e', '#c46a2c'],
  river: ['#bfe3f5', '#8fb4d6', '#ffffff'],
  wildlife: ['#c8a85a', '#d9c07a', '#8d7a3e'],
  mountain: ['#a3a098', '#5f5d58', '#c2bdb1'],
};

/**
 * Looking for (35-ui-overhaul.md, section 5): the party's starred recipes
 * with what each still needs (filled: have it; dashed red: missing), and the
 * starred resources.
 */
function LookingFor({ state, hiker, onBook }: { state: GameState; hiker: Hiker; onBook(): void }) {
  const recipes = starredRecipes(state, hiker);
  const resources = (state.starred?.resources ?? []).filter((id): id is ResourceId =>
    RESOURCES.some((r) => r.id === id),
  );
  return (
    <aside className={styles.looking} aria-label="Looking for">
      <h3 className={styles.lookingTitle}>LOOKING FOR</h3>
      {recipes.length === 0 && resources.length === 0 && (
        <p className={styles.hint}>Star recipes and resources when crafting to see them here.</p>
      )}
      {recipes.map((r) => (
        <div key={r.key} className={styles.lookingRow}>
          <span className={styles.lookingName}>
            {r.name}
            <span data-ready={r.missing === 0 || undefined}>
              {r.missing ? `needs ${r.missing}` : '✓ ready'}
            </span>
          </span>
          <span className={styles.tokens}>
            {r.spaces.map((sp, k) => {
              const part = r.parts[sp.part];
              const id = part?.ids?.[0];
              return (
                <span
                  key={k}
                  className={styles.token}
                  data-missing={!sp.paid || undefined}
                  title={partWords(part)}
                >
                  {id ? (
                    <img src={ASSETS.resources[id]} alt="" />
                  ) : part?.nodes?.[0] ? (
                    <img src={NODE_IMAGE[part.nodes[0]]} alt="" />
                  ) : (
                    '?'
                  )}
                </span>
              );
            })}
          </span>
        </div>
      ))}
      {resources.length > 0 && (
        <div className={styles.lookingRow}>
          <span className={styles.lookingName}>Starred resources</span>
          <span className={styles.tokens}>
            {resources.map((id) => (
              <span key={id} className={styles.token} title={resourceName(id)}>
                <img src={ASSETS.resources[id]} alt={resourceName(id)} />
              </span>
            ))}
          </span>
        </div>
      )}
      <button type="button" className={styles.bookButton} onClick={onBook}>
        <Icon name="book" size={16} /> RECIPE BOOK
      </button>
    </aside>
  );
}

/** A recipe part in words, for its token's hint. */
function partWords(part: RecipePart | undefined): string {
  if (!part) return '';
  if (part.ids) return part.ids.map(resourceName).join(' or ');
  if (part.nodes?.length) return `Any ${part.nodes.map((n) => NODE_NAME[n]).join(' or ')}`;
  return 'Any resource';
}

/** The table's own small seeded random (for the cards' tilt), so a reload looks the same. */
function rngOf(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
