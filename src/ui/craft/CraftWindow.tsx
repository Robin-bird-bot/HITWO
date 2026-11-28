/**
 * The Craft window (Phase 8 step 7), as approved in #mockup-crafting:
 * - Craft: a tab per type with its basic recipe at the crafter's tier, their
 *   blueprints of that type (locked above their tier), and the spaces filled
 *   from the crafter's resources first, then the others on the tile. Tap a
 *   space to swap what goes in.
 * - The pick step: the cards a basic recipe dealt, face down; turn them over
 *   and take one. Its Quality shows.
 * - Teach: a blueprint, a hiker on the tile, and the teacher's Morale.
 * Opened from the Craft action (or the Blueprints button, on Teach). While a
 * basic craft waits for its pick, the window stays open on the pick step.
 */
import { useOpenSound } from '../../audio/uiSounds';
import { sfx } from '../../audio/engine';
import { useCraftingLook } from '../app/lookSettings';
import { CraftBench } from './CraftBench';
import { colorOfHiker } from '../app/hikerLook';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import {
  autoPay,
  craftPool,
  craftTier,
  paymentReason,
  spaceParts,
  teachCost,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
  type ItemId,
  type ItemTypeName,
  type NodeType,
  type PaidSlot,
  type Recipe,
  type RecipePart,
  type ResourceId,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { usePreview, withPreview } from '../preview/preview';
import { ItemCard } from '../items/ItemCard';
import { Previewable } from '../preview/Previewable';
import { TYPE_LOOK } from '../items/itemLook';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { ItemBack } from '../scavenge/ItemBack';
import { useDraggable } from '../windows/useDraggable';
import { fitCardRow, rowWidth } from '../layout/fitCardRow';
import styles from './CraftWindow.module.css';
import { recipeWords, resName } from './craftWords';
import { keyEnough, swapInto, swapOptions } from './craftSwap';
import type { DropProps } from '../drag/drag';
import { HikerPortrait } from '../hikers/HikerPortrait';

export type CraftTab = 'craft' | 'teach';

interface CraftWindowProps {
  state: GameState;
  hikerId: string;
  tab: CraftTab;
  simple: boolean;
  onTab(tab: CraftTab): void;
  /** Dispatches an action; true when it went through. */
  onDispatch(action: Action): boolean;
  onClose(): void;
}

const TYPE_ICON: Record<ItemTypeName, 'hammer' | 'shirt' | 'utensils' | 'tent' | 'sparkles'> = {
  tool: 'hammer',
  clothes: 'shirt',
  food: 'utensils',
  shelter: 'tent',
  trinket: 'sparkles',
};
const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];
const NUMERAL = ['', 'I', 'II', 'III', 'IV'];
const plural = (type: ItemTypeName) =>
  type === 'clothes'
    ? 'clothes'
    : type === 'food'
      ? 'food'
      : `${TYPE_LOOK[type].label.toLowerCase()}s`;

export function CraftWindow(props: CraftWindowProps) {
  useOpenSound();
  const { state, hikerId, tab, simple, onTab, onClose } = props;
  const hiker = state.hikers.find((h) => h.id === hikerId);
  const pending = state.crafting?.hikerId === hikerId ? state.crafting : undefined;
  const type: ItemTypeName = pending?.type ?? 'tool';
  // The Crafting look (35-ui-overhaul.md, section 1): Paper, or the TrailMate handheld.
  const look = useCraftingLook();
  // After a craft: the log events from here on say what was made.
  const [madeFrom, setMadeFrom] = useState<number | null>(null);
  const { ref, windowProps, translate } = useDraggable<HTMLDivElement>('craft');

  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, onClose]);

  if (!hiker) return null;
  const made =
    madeFrom !== null
      ? state.log.find((e) => e.id >= madeFrom && e.kind === 'crafted' && e.hikerId === hikerId)
      : undefined;
  const teaching = tab === 'teach' && !pending && !made;
  // Taking a card, or crafting from a blueprint, makes the item: show it.
  const dispatch = (action: Action) => {
    const from = state.nextEventId;
    const ok = props.onDispatch(action);
    const makes = action.type === 'craftTake' || (action.type === 'craft' && !!action.blueprint);
    if (ok && makes) setMadeFrom(from);
  };

  return (
    <div className={styles.overlay}>
      <section
        ref={ref}
        className={styles.window}
        data-edge-window="Craft"
        style={{ '--accent': TYPE_LOOK[type].accent, translate } as CSSProperties}
        data-look={look}
        role="dialog"
        aria-modal="true"
        aria-label={teaching ? 'Teach a blueprint' : 'Craft'}
        tabIndex={-1}
        {...windowProps}
      >
        <header className={styles.head} data-drag-handle>
          <h2 className={styles.windowTitle}>{teaching ? 'TEACH' : 'CRAFT'}</h2>
          {!pending && !made && (
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                className={styles.tab}
                aria-selected={!teaching}
                onClick={() => onTab('craft')}
              >
                <Icon name="hammer" size={16} /> CRAFT
              </button>
              <button
                type="button"
                role="tab"
                className={styles.tab}
                aria-selected={teaching}
                onClick={() => onTab('teach')}
              >
                <Icon name="book" size={16} /> TEACH
              </button>
            </div>
          )}
          <span className={styles.crafter}>
            <Face id={hiker.id} size={34} />
            <span className={styles.crafterName}>{hiker.name.toUpperCase()}</span>
          </span>
          {!pending && (
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <Icon name="x" size={20} />
            </button>
          )}
        </header>
        {(teaching || pending || made) && (
          <div className={styles.kindBar}>
            <span>
              {teaching
                ? 'BLUEPRINTS · A FREE ACTION, PAID IN MORALE'
                : `CRAFTING · USES ${hiker.name.toUpperCase()}’S ACTION`}
            </span>
            <span className={styles.kindRight}>
              <Icon name="users" size={15} /> {craftPool(state, hiker).length} ON THIS TILE
            </span>
          </div>
        )}

        {made && made.kind === 'crafted' ? (
          <Made
            itemId={made.itemId}
            quality={made.quality}
            learned={!!made.learned}
            hiker={hiker}
            onDone={onClose}
            fresh
          />
        ) : pending ? (
          <PickBody
            key={state.nextEventId}
            state={state}
            hiker={hiker}
            simple={simple}
            onTake={(index, node) =>
              dispatch({ type: 'craftTake', index, ...(node ? { node } : {}) })
            }
          />
        ) : teaching ? (
          <TeachBody state={state} hiker={hiker} simple={simple} onTeach={props.onDispatch} />
        ) : (
          <CraftBench
            state={state}
            hiker={hiker}
            onCraft={dispatch}
            onDispatch={props.onDispatch}
          />
        )}
      </section>
    </div>
  );
}

export function Face({ id, size }: { id: string; size: number }) {
  return (
    <HikerPortrait
      hikerId={id}
      className={styles.face}
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${colorOfHiker(id)}` }}
    />
  );
}

// ── Craft ───────────────────────────────────────────────────────────────────

export function PartIcons({ part }: { part: RecipePart }) {
  if (part.ids) {
    return (
      <>
        {part.ids.slice(0, 3).map((id) => (
          <img key={id} src={ASSETS.resources[id]} alt="" width={16} height={16} />
        ))}
      </>
    );
  }
  if (part.any) return <Icon name="sparkles" size={14} />;
  return (
    <>
      {(part.nodes ?? []).map((n) => (
        <img key={n} src={NODE_IMAGE[n]} alt="" width={14} height={16} />
      ))}
    </>
  );
}

export function Slot({
  filled,
  open,
  onClick,
  drop,
}: {
  filled: PaidSlot | null;
  open: boolean;
  onClick(): void;
  /** At the Workbench: a resource dragged from a pack can go here (Nov 14 update). */
  drop?: DropProps;
}) {
  return (
    <button
      type="button"
      className={`${styles.slot} ${styles.slotButton}`}
      data-empty={filled ? undefined : true}
      aria-pressed={open}
      aria-label={filled ? `${resName(filled.resource)}: tap to swap` : 'Empty: tap to fill'}
      onClick={onClick}
      {...drop}
    >
      {filled && (
        <>
          <img src={ASSETS.resources[filled.resource]} alt="" width={40} height={40} />
          <span
            className={styles.slotWho}
            style={{ background: colorOfHiker(filled.from) }}
            aria-hidden
          />
        </>
      )}
    </button>
  );
}

/**
 * What can go in one space: every resource on the tile that fits, by who has
 * it. A key part changes all its spaces at once, since they must match.
 */
export function Swap({
  state,
  hiker,
  recipe,
  slots,
  at,
  onSlots,
}: {
  state: GameState;
  hiker: Hiker;
  recipe: Recipe;
  slots: (PaidSlot | null)[];
  at: number;
  onSlots(next: (PaidSlot | null)[]): void;
}) {
  const part = recipe[spaceParts(recipe)[at] ?? 0];
  if (!part) return null;
  const key = !!part.ids && part.ids.length > 1;
  const options = swapOptions(state, hiker, recipe, slots, at);
  const choose = (from: string, resource: ResourceId) => {
    const next = swapInto(state, hiker, recipe, slots, at, from, resource);
    if (next) onSlots(next);
  };

  return (
    <div className={styles.swap}>
      <span className={styles.swapHead}>
        {key ? `ALL ${part.n} MUST MATCH · ` : ''}
        {options.length ? 'WHAT GOES IN THIS SPACE?' : 'NOTHING ON THIS TILE FITS THIS SPACE'}
      </span>
      {options.map((o) => {
        const current = slots[at];
        const on = current?.from === o.from.id && current.resource === o.resource;
        const enough = keyEnough(state, hiker, recipe, at, o.resource);
        return (
          <button
            key={`${o.from.id}:${o.resource}`}
            type="button"
            className={styles.chip}
            aria-pressed={on}
            disabled={!enough}
            title={enough ? undefined : `Not ${part.n} ${resName(o.resource)} on this tile`}
            onClick={() => choose(o.from.id, o.resource)}
          >
            <img src={ASSETS.resources[o.resource]} alt="" width={28} height={28} />
            {resName(o.resource)}
            <Face id={o.from.id} size={20} />
          </button>
        );
      })}
    </div>
  );
}

/** A blueprint, drawn on blue grid paper like the station mockup. */
function Blueprint({
  state,
  hiker,
  itemId,
  selected,
  simple,
  teach = false,
  onPick,
}: {
  state: GameState;
  hiker: Hiker;
  itemId: ItemId;
  selected: boolean;
  simple: boolean;
  /** On the Teach tab: any blueprint can be taught; it shows its Morale cost. */
  teach?: boolean;
  onPick(): void;
}) {
  const preview = usePreview({ kind: 'item', itemId, unrolled: true });
  const def = ITEMS[itemId];
  // Blueprints are for crafted items, never a Present.
  if (!def || def.type === 'present') return null;
  const locked = !teach && def.tier > craftTier(state, hiker, def.type);
  const recipe = def.recipe;
  const missing = recipe ? autoPay(state, hiker, recipe).filter((s) => !s).length : 0;
  const payable = recipe
    ? !paymentReason(state, hiker, recipe, autoPay(state, hiker, recipe))
    : false;
  const status = teach
    ? `TIER ${NUMERAL[def.tier]} · ${teachCost(state, hiker, def.id)} MORALE`
    : locked
      ? `TIER ${NUMERAL[def.tier]} · LOCKED`
      : missing
        ? `NEEDS ${missing} MORE`
        : payable
          ? 'READY'
          : 'CAN’T PAY';
  return (
    <button
      type="button"
      className={styles.blueprint}
      aria-pressed={selected}
      disabled={locked}
      title={
        locked
          ? `${def.name}: a Tier ${NUMERAL[def.tier]} blueprint. A ranger station’s workbench raises ${hiker.name}’s tier (Phase 9).`
          : `${def.name}${recipe ? `: ${recipeWords(recipe)}` : ''}`
      }
      {...withPreview({ onClick: onPick }, preview)}
    >
      <span className={styles.bpPaper}>
        {def.art ? (
          <img src={ASSETS.itemArt(def.art)} alt="" className={styles.bpArt} />
        ) : (
          <Icon name={TYPE_ICON[def.type]} size={34} />
        )}
        <span className={styles.bpName}>{def.name.toUpperCase()}</span>
      </span>
      {!simple && !teach && recipe && (
        <span className={styles.bpRecipe}>{recipeWords(recipe)}</span>
      )}
      <span
        className={styles.bpStatus}
        data-status={teach ? 'teach' : locked ? 'locked' : missing || !payable ? 'short' : 'ready'}
      >
        {status}
      </span>
    </button>
  );
}

// ── Pick ────────────────────────────────────────────────────────────────────

/** The gap between the dealt cards. */
const CARD_GAP = 36;

export function PickBody({
  state,
  hiker,
  simple,
  onTake,
  cardWidth: fullWidth = 220,
  room = 900,
}: {
  state: GameState;
  hiker: Hiker;
  simple: boolean;
  onTake(index: number, node?: NodeType): void;
  /** The cards' width (the station's Workbench uses smaller ones). */
  cardWidth?: number;
  /** The width the row of cards has (Phase 10.6: more cards shrink, then wrap). */
  room?: number;
}) {
  const open = state.crafting;
  const cards = open?.options ?? [];
  // Nothing cut off (Phase 10.6): extra cards shrink evenly to 80%, then wrap.
  const fit = fitCardRow(cards.length, fullWidth, CARD_GAP, room);
  const cardWidth = Math.floor(fullWidth * fit.scale);
  const [flipped, setFlipped] = useState<boolean[]>(() => cards.map(() => false));
  const [chosen, setChosen] = useState<number | null>(null);
  const [node, setNode] = useState<NodeType | null>(null);
  const flipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    flipRef.current?.focus();
  }, []);
  if (!open) return null;
  const allUp = flipped.every(Boolean);
  const pick = chosen !== null ? cards[chosen] : undefined;
  const pickDef = pick ? ITEMS[pick.itemId] : undefined;
  const needsNode = !!pickDef?.madeWithNode && !node;
  const tier = craftTier(state, hiker, open.type);
  const quality = (q?: number) => (q ? ` · Quality ${q}` : '');

  return (
    <>
      <div className={styles.pickBody}>
        <span className={styles.label}>
          PICK 1 OF {cards.length} · TIER {NUMERAL[tier]} {plural(open.type).toUpperCase()}
        </span>
        {!simple && (
          <p className={styles.words}>
            Tap a card to turn it over. Each one’s Quality was rolled with {hiker.name}’s Luck, and
            any card can come up a tier higher.
          </p>
        )}
        <div
          className={styles.cards}
          style={{ maxWidth: rowWidth(fit, fullWidth, CARD_GAP), gap: CARD_GAP }}
        >
          {cards.map((c, i) => {
            const up = flipped[i];
            const higher = (ITEMS[c.itemId]?.tier ?? 1) > tier;
            return (
              <button
                key={`${c.itemId}-${i}`}
                type="button"
                className={styles.card}
                data-edge-card=""
                data-sound="none"
                style={{ width: cardWidth, height: Math.round((cardWidth * 7) / 5) }}
                data-up={up}
                aria-pressed={chosen === i}
                aria-label={
                  up
                    ? `${ITEMS[c.itemId]?.name ?? 'Item'}${quality(c.quality)}`
                    : 'Face down: turn it over'
                }
                onClick={() => {
                  if (!up) {
                    setFlipped((f) => f.map((x, j) => (j === i ? true : x)));
                    // A card flips; Quality 4 and 5 shimmer (Claude's idea).
                    sfx('card.flip');
                    if ((c.quality ?? 0) >= 4) sfx('card.rare', { delay: 0.12 });
                  } else {
                    setChosen(i);
                    setNode(null);
                  }
                }}
              >
                <Previewable
                  className={styles.flip}
                  content={
                    up
                      ? {
                          kind: 'item',
                          itemId: c.itemId,
                          ...(c.quality ? { item: { quality: c.quality } } : {}),
                        }
                      : null
                  }
                >
                  <span className={styles.back}>
                    <ItemBack type={open.type} width={cardWidth} />
                  </span>
                  <span className={styles.front}>
                    <ItemCard
                      itemId={c.itemId}
                      {...(c.quality ? { item: { quality: c.quality } } : {})}
                      width={cardWidth}
                    />
                  </span>
                </Previewable>
                {up && higher && <span className={styles.higher}>A TIER HIGHER!</span>}
              </button>
            );
          })}
        </div>
        {pickDef?.madeWithNode && (
          <div className={styles.nodePick}>
            <span className={styles.label}>MADE FOR WHICH NODE?</span>
            {NODES.map((n) => (
              <button
                key={n}
                type="button"
                className={styles.chip}
                aria-pressed={node === n}
                onClick={() => setNode(n)}
              >
                <img src={NODE_IMAGE[n]} alt="" width={22} height={25} />
                {NODE_NAME[n]}
              </button>
            ))}
          </div>
        )}
      </div>
      <footer className={styles.foot}>
        <span className={styles.summary}>
          {!allUp
            ? 'Turn the cards over, one at a time or all at once.'
            : pick
              ? `${pickDef?.name ?? 'Item'}${quality(pick.quality)}${needsNode ? ' · pick its node' : ''}`
              : 'Pick the one to keep.'}
        </span>
        {!allUp && (
          <button
            ref={flipRef}
            type="button"
            className={styles.second}
            onClick={() => setFlipped(cards.map(() => true))}
          >
            Flip all
          </button>
        )}
        <button
          type="button"
          className={styles.go}
          disabled={chosen === null || needsNode}
          onClick={() => chosen !== null && onTake(chosen, node ?? undefined)}
        >
          {pickDef ? `TAKE THE ${pickDef.name.toUpperCase()}` : 'PICK A CARD'}
        </button>
      </footer>
    </>
  );
}

/** Just after crafting: the item, and whether a blueprint was learned. */
export function Made({
  itemId,
  quality,
  learned,
  hiker,
  onDone,
  cardWidth = 240,
  fresh = false,
}: {
  itemId: ItemId;
  quality?: number;
  learned: boolean;
  hiker: Hiker;
  onDone(): void;
  cardWidth?: number;
  /** Just made from a blueprint on the bench: it flips in with a NEW stamp. */
  fresh?: boolean;
}) {
  const def = ITEMS[itemId];
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    done.current?.focus();
  }, []);
  return (
    <>
      <div className={styles.made} data-fresh={fresh || undefined}>
        <div>
          <ItemCard
            itemId={itemId}
            {...(quality ? { item: { quality: quality as 1 | 2 | 3 | 4 | 5 } } : {})}
            width={cardWidth}
          />
          {fresh && <span className={styles.newStamp}>NEW</span>}
        </div>
        <p className={styles.madeWords}>
          {hiker.name} crafted a {def?.name ?? 'thing'}
          {quality ? ` (Quality ${quality})` : ''}. It’s in their bag.
        </p>
        {learned && (
          <p className={styles.learned}>
            <Icon name="book" size={16} /> {hiker.name} learned the {def?.name} blueprint.
          </p>
        )}
      </div>
      <footer className={styles.foot}>
        <span className={styles.summary} />
        <button ref={done} type="button" className={styles.go} onClick={onDone}>
          DONE
        </button>
      </footer>
    </>
  );
}

// ── Teach ───────────────────────────────────────────────────────────────────

function TeachBody({
  state,
  hiker,
  simple,
  onTeach,
}: {
  state: GameState;
  hiker: Hiker;
  simple: boolean;
  onTeach(action: Action): boolean;
}) {
  const known = hiker.blueprints ?? [];
  const [bp, setBp] = useState<ItemId | null>(known[0] ?? null);
  const [to, setTo] = useState<string | null>(null);
  const def = bp ? ITEMS[bp] : undefined;
  const cost = bp ? teachCost(state, hiker, bp) : 0;
  const students = craftPool(state, hiker).filter((h) => h.id !== hiker.id);
  const action: Action | null =
    bp && to ? { type: 'teach', hikerId: hiker.id, toId: to, itemId: bp } : null;
  const reason = action ? validateAction(state, action) : null;
  const student = state.hikers.find((h) => h.id === to);

  return (
    <>
      <div className={styles.teachBody}>
        <div className={styles.teachFrom}>
          <span className={styles.label}>{hiker.name.toUpperCase()} KNOWS</span>
          <div className={styles.blueprints}>
            {known.length === 0 && (
              <p className={styles.none}>
                {simple
                  ? 'No blueprints yet.'
                  : 'No blueprints yet. Crafting an item teaches its blueprint.'}
              </p>
            )}
            {known.map((id) => (
              <Blueprint
                key={id}
                state={state}
                hiker={hiker}
                itemId={id}
                selected={id === bp}
                simple
                teach
                onPick={() => {
                  setBp(id);
                  setTo(null);
                }}
              />
            ))}
          </div>
        </div>
        <div className={styles.teachTo}>
          <span className={styles.label}>
            {def ? `TEACH THE ${def.name.toUpperCase()} TO` : 'TEACH'}
          </span>
          {!simple && (
            <p className={styles.words}>
              A hiker on this tile. Teaching costs the teacher Morale: 4 for Tier I, 6 for Tier II,
              8 for Tier III.
            </p>
          )}
          {students.length === 0 && <p className={styles.none}>Nobody else is on this tile.</p>}
          {def &&
            students.map((h) => {
              const knows = (h.blueprints ?? []).includes(def.id);
              const n = h.blueprints?.length ?? 0;
              return (
                <button
                  key={h.id}
                  type="button"
                  className={styles.student}
                  aria-pressed={to === h.id}
                  disabled={knows}
                  onClick={() => setTo(h.id)}
                >
                  <Face id={h.id} size={40} />
                  <span className={styles.studentName}>{h.name.toUpperCase()}</span>
                  <span className={styles.studentNote}>
                    {knows ? 'Already knows it' : `Knows ${n} blueprint${n === 1 ? '' : 's'}`}
                  </span>
                </button>
              );
            })}
          {def && (
            <div className={styles.cost}>
              <Icon name="heart" size={18} />
              <span>
                {hiker.name}’s Morale {hiker.stats.morale} →{' '}
                <b>{Math.max(0, hiker.stats.morale - cost)}</b>
              </span>
            </div>
          )}
          {def && (
            <div className={styles.teachCard}>
              <Previewable content={{ kind: 'item', itemId: def.id, unrolled: true }}>
                <ItemCard itemId={def.id} width={150} unrolled />
              </Previewable>
            </div>
          )}
        </div>
      </div>
      <footer className={styles.foot}>
        <span className={`${styles.summary} ${reason ? styles.reason : ''}`}>
          {reason ??
            (student && def
              ? `${student.name} learns the ${def.name} blueprint · ${hiker.name} −${cost} Morale`
              : 'Pick a blueprint and who to teach.')}
        </span>
        <button
          type="button"
          className={styles.go}
          disabled={!action || !!reason}
          onClick={() => {
            if (action && onTeach(action)) setTo(null);
          }}
        >
          TEACH · −{cost} MORALE
        </button>
      </footer>
    </>
  );
}
