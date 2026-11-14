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
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import { characterFor } from '../../content/characters';
import {
  autoPay,
  craftPool,
  craftRecipe,
  craftSetup,
  craftTier,
  fitsPart,
  paymentReason,
  spaceParts,
  teachCost,
  validateAction,
  CRAFT_TYPES,
  type Action,
  type GameState,
  type Hiker,
  type ItemId,
  type ItemType,
  type NodeType,
  type PaidSlot,
  type Recipe,
  type RecipePart,
  type ResourceId,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { ItemCard } from '../items/ItemCard';
import { TYPE_LOOK } from '../items/itemLook';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { ItemBack } from '../scavenge/ItemBack';
import { useDraggable } from '../windows/useDraggable';
import styles from './CraftWindow.module.css';
import { partLabel, payWords, recipeWords, resName } from './craftWords';

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

const TYPE_ICON: Record<ItemType, 'hammer' | 'shirt' | 'utensils' | 'tent' | 'sparkles'> = {
  tool: 'hammer',
  clothes: 'shirt',
  food: 'utensils',
  shelter: 'tent',
  trinket: 'sparkles',
};
const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];
const NUMERAL = ['', 'I', 'II', 'III', 'IV'];
const plural = (type: ItemType) =>
  type === 'clothes'
    ? 'clothes'
    : type === 'food'
      ? 'food'
      : `${TYPE_LOOK[type].label.toLowerCase()}s`;

export function CraftWindow(props: CraftWindowProps) {
  const { state, hikerId, tab, simple, onTab, onClose } = props;
  const hiker = state.hikers.find((h) => h.id === hikerId);
  const pending = state.crafting?.hikerId === hikerId ? state.crafting : undefined;
  const [type, setType] = useState<ItemType>(pending?.type ?? 'tool');
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
        style={{ '--accent': TYPE_LOOK[type].accent, translate } as CSSProperties}
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

        {made && made.kind === 'crafted' ? (
          <Made
            itemId={made.itemId}
            quality={made.quality}
            learned={!!made.learned}
            hiker={hiker}
            onDone={onClose}
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
          <CraftBody
            state={state}
            hiker={hiker}
            simple={simple}
            type={type}
            onType={setType}
            onCraft={dispatch}
          />
        )}
      </section>
    </div>
  );
}

export function Face({ id, size }: { id: string; size: number }) {
  return (
    <img
      className={styles.face}
      src={ASSETS.portraits.placeholder}
      alt=""
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${characterFor(id).color}` }}
    />
  );
}

// ── Craft ───────────────────────────────────────────────────────────────────

function CraftBody({
  state,
  hiker,
  simple,
  type,
  onType,
  onCraft,
}: {
  state: GameState;
  hiker: Hiker;
  simple: boolean;
  type: ItemType;
  onType(t: ItemType): void;
  onCraft(action: Action): void;
}) {
  const [blueprint, setBlueprint] = useState<ItemId | null>(null);
  const [custom, setCustom] = useState<(PaidSlot | null)[] | null>(null);
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const [node, setNode] = useState<NodeType | null>(null);
  const reset = () => {
    setCustom(null);
    setSwapAt(null);
    setNode(null);
  };

  const bp = blueprint ? ITEMS[blueprint] : undefined;
  const recipe = craftRecipe(state, hiker, type, blueprint ?? undefined) ?? [];
  const slots = custom ?? autoPay(state, hiker, recipe);
  const parts = spaceParts(recipe);
  const complete = slots.every((s): s is PaidSlot => !!s);
  const action: Action = {
    type: 'craft',
    hikerId: hiker.id,
    itemType: type,
    ...(bp ? { blueprint: bp.id } : {}),
    ...(complete && custom ? { slots } : {}),
    ...(node ? { node } : {}),
  };
  const reason = validateAction(state, action);
  const setup = craftSetup(state, hiker, type);
  const tier = craftTier(state, hiker, type);
  const known = (hiker.blueprints ?? []).filter((id) => ITEMS[id]?.type === type);
  const needsNode = !!bp?.madeWithNode;

  return (
    <>
      <div className={styles.body}>
        <nav className={styles.types} aria-label="Item types">
          {CRAFT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={styles.type}
              aria-pressed={t === type}
              style={{ '--type': TYPE_LOOK[t].accent } as CSSProperties}
              onClick={() => {
                onType(t);
                setBlueprint(null);
                reset();
              }}
            >
              <Icon name={TYPE_ICON[t]} size={20} />
              <span className={styles.typeName}>{TYPE_LOOK[t].label.toUpperCase()}</span>
              <span className={styles.typeTier}>TIER {NUMERAL[craftTier(state, hiker, t)]}</span>
            </button>
          ))}
        </nav>

        <div className={styles.main}>
          <div className={styles.recipeHead}>
            <span className={styles.label}>
              {bp
                ? `BLUEPRINT · EXACTLY A ${bp.name.toUpperCase()}`
                : `BASIC RECIPE · PICK 1 OF ${setup.cards} ${plural(type).toUpperCase()}`}
            </span>
            <TierChips tier={tier} />
          </div>
          {!simple && (
            <p className={styles.words}>
              {bp
                ? `Costs more than the basic recipe, and makes exactly this item: ${recipeWords(recipe)}.`
                : basicWords(type, recipe)}
            </p>
          )}

          <div className={styles.spaces}>
            {recipe.map((part, i) => (
              <div key={i} className={styles.part}>
                {i > 0 && <span className={styles.plus}>+</span>}
                <div className={styles.partBox}>
                  <div className={styles.partSlots}>
                    {slots.map((s, k) =>
                      parts[k] === i ? (
                        <Slot
                          key={k}
                          filled={s}
                          open={swapAt === k}
                          onClick={() => setSwapAt(swapAt === k ? null : k)}
                        />
                      ) : null,
                    )}
                  </div>
                  <span className={styles.partLabel}>
                    <PartIcons part={part} />
                    {partLabel(part)}
                  </span>
                </div>
              </div>
            ))}
            {bp && (
              <div className={styles.makes}>
                <Icon name="chevronDown" size={20} />
                <ItemCard itemId={bp.id} width={96} />
              </div>
            )}
          </div>

          {swapAt !== null && (
            <Swap
              state={state}
              hiker={hiker}
              recipe={recipe}
              slots={slots}
              at={swapAt}
              onSlots={(next) => {
                setCustom(next);
                setSwapAt(null);
              }}
            />
          )}
          {!simple && swapAt === null && (
            <p className={styles.hint}>
              Filled from {hiker.name}’s resources first, then the others here. Tap a space to swap
              what goes in.
            </p>
          )}
          {needsNode && (
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
          {setup.mods.length > 0 && (
            <div className={styles.mods}>
              {setup.mods.map((m, i) => (
                <span key={i} className={styles.mod} data-tone={m.tone}>
                  {m.label}
                </span>
              ))}
            </div>
          )}

          <div className={styles.recipeHead} style={{ marginTop: 20 }}>
            <span className={styles.label}>
              {hiker.name.toUpperCase()}’S {TYPE_LOOK[type].label.toUpperCase()} BLUEPRINTS ·{' '}
              {known.length}
            </span>
            {bp && (
              <button
                type="button"
                className={styles.linkish}
                onClick={() => {
                  setBlueprint(null);
                  reset();
                }}
              >
                Back to the basic recipe
              </button>
            )}
          </div>
          <div className={styles.blueprints}>
            {known.length === 0 && (
              <p className={styles.none}>
                {simple
                  ? 'None yet.'
                  : `None yet. Crafting ${type === 'trinket' ? 'a trinket teaches nothing' : `an item teaches its blueprint`}.`}
              </p>
            )}
            {known.map((id) => (
              <Blueprint
                key={id}
                state={state}
                hiker={hiker}
                itemId={id}
                selected={id === blueprint}
                simple={simple}
                onPick={() => {
                  setBlueprint(id === blueprint ? null : id);
                  reset();
                }}
              />
            ))}
          </div>
        </div>

        <Pool state={state} hiker={hiker} slots={slots} simple={simple} />
      </div>

      <footer className={styles.foot}>
        <span className={`${styles.summary} ${reason ? styles.reason : ''}`}>
          {reason ?? (simple ? `−${slots.length} resources` : payWords(state, slots))}
        </span>
        <button
          type="button"
          className={styles.go}
          disabled={!!reason}
          onClick={() => onCraft(action)}
        >
          {bp ? `CRAFT A ${bp.name.toUpperCase()}` : `CRAFT · PICK 1 OF ${setup.cards}`}
        </button>
      </footer>
    </>
  );
}

function basicWords(type: ItemType, recipe: Recipe): string {
  if (type === 'trinket') {
    return `${recipe.length} different resources, picked at random: ${recipeWords(recipe)}. A new set after every trinket.`;
  }
  return `${recipeWords(recipe)}. The key resource is ${recipe[0]?.n ?? 2} of the same one.`;
}

function TierChips({ tier }: { tier: number }) {
  return (
    <span className={styles.tiers}>
      {[1, 2, 3].map((t) => (
        <span
          key={t}
          className={styles.tierChip}
          data-on={t === tier}
          title={
            t === tier
              ? `Crafting at Tier ${NUMERAL[t]}`
              : t > tier
                ? `Tier ${NUMERAL[t]}: a ranger station’s workbench raises it (Phase 9)`
                : `Tier ${NUMERAL[t]}`
          }
        >
          {t > tier && <Icon name="x" size={11} strokeWidth={3} />}
          TIER {NUMERAL[t]}
        </span>
      ))}
    </span>
  );
}

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
}: {
  filled: PaidSlot | null;
  open: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={`${styles.slot} ${styles.slotButton}`}
      data-empty={filled ? undefined : true}
      aria-pressed={open}
      aria-label={filled ? `${resName(filled.resource)}: tap to swap` : 'Empty: tap to fill'}
      onClick={onClick}
    >
      {filled && (
        <>
          <img src={ASSETS.resources[filled.resource]} alt="" width={40} height={40} />
          <span
            className={styles.slotWho}
            style={{ background: characterFor(filled.from).color }}
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
  const parts = spaceParts(recipe);
  const partIndex = parts[at] ?? 0;
  const part = recipe[partIndex];
  if (!part) return null;
  const key = !!part.ids && part.ids.length > 1;
  const pool = craftPool(state, hiker);
  /** How many of a hiker's resource the other spaces already use. */
  const usedElsewhere = (from: string, r: ResourceId, skip: (k: number) => boolean) =>
    slots.filter((s, k) => !skip(k) && s?.from === from && s.resource === r).length;

  const options: { from: Hiker; resource: ResourceId; left: number }[] = [];
  for (const h of pool) {
    for (const [r, n] of Object.entries(h.inventory.resources) as [ResourceId, number][]) {
      if (!fitsPart(part, r)) continue;
      const skip = key ? (k: number) => parts[k] === partIndex : (k: number) => k === at;
      const left = n - usedElsewhere(h.id, r, skip);
      if (left > 0) options.push({ from: h, resource: r, left });
    }
  }

  const choose = (from: string, resource: ResourceId) => {
    const next = [...slots];
    if (!key) {
      next[at] = { from, resource };
      onSlots(next);
      return;
    }
    // A key part: every space takes this resource, the chosen hiker's first, then the others'.
    const spaces = parts.flatMap((p, k) => (p === partIndex ? [k] : []));
    const givers = [from, ...pool.map((h) => h.id).filter((id) => id !== from)];
    const counts = new Map(
      givers.map((id) => [
        id,
        (pool.find((h) => h.id === id)?.inventory.resources[resource] ?? 0) -
          usedElsewhere(id, resource, (k) => parts[k] === partIndex),
      ]),
    );
    for (const k of spaces) {
      const giver = givers.find((id) => (counts.get(id) ?? 0) > 0);
      if (!giver) {
        next[k] = null;
        continue;
      }
      counts.set(giver, (counts.get(giver) ?? 0) - 1);
      next[k] = { from: giver, resource };
    }
    onSlots(next);
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
        const enough =
          !key || pool.reduce((n, h) => n + (h.inventory.resources[o.resource] ?? 0), 0) >= part.n;
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
  const def = ITEMS[itemId];
  if (!def) return null;
  const locked = !teach && def.tier > craftTier(state, hiker, def.type);
  const recipe = def.recipe;
  const missing = recipe ? autoPay(state, hiker, recipe).filter((s) => !s).length : 0;
  const payable = recipe
    ? !paymentReason(state, hiker, recipe, autoPay(state, hiker, recipe))
    : false;
  const status = teach
    ? `TIER ${NUMERAL[def.tier]} · ${teachCost(def.id)} MORALE`
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
      onClick={onPick}
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

/** Everyone's resources on the tile, with what the spaces take marked. */
function Pool({
  state,
  hiker,
  slots,
  simple,
}: {
  state: GameState;
  hiker: Hiker;
  slots: readonly (PaidSlot | null)[];
  simple: boolean;
}) {
  return (
    <aside className={styles.pool} aria-label="Resources on this tile">
      <span className={styles.label}>ON THIS TILE · POOLED</span>
      {craftPool(state, hiker).map((h, i) => {
        const res = Object.entries(h.inventory.resources) as [ResourceId, number][];
        return (
          <div key={h.id} className={styles.pack}>
            <span className={styles.packWho}>
              <Face id={h.id} size={26} />
              {h.name.toUpperCase()}
              {i === 0 && <span className={styles.crafts}>CRAFTS</span>}
            </span>
            <div className={styles.res}>
              {res.length === 0 && <span className={styles.none}>No resources</span>}
              {res.map(([id, n]) => {
                const used = slots.filter((s) => s?.from === h.id && s.resource === id).length;
                return (
                  <span
                    key={id}
                    className={styles.resTile}
                    data-used={used > 0}
                    title={resName(id)}
                  >
                    <img src={ASSETS.resources[id]} alt={resName(id)} width={34} height={34} />
                    <span className={styles.resCount}>{n}</span>
                    {used > 0 && <span className={styles.resUsed}>−{used}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      {!simple && (
        <p className={styles.poolNote}>
          Gold outlines are what the recipe takes. The little colored dot on each space says whose
          it is.
        </p>
      )}
    </aside>
  );
}

// ── Pick ────────────────────────────────────────────────────────────────────

export function PickBody({
  state,
  hiker,
  simple,
  onTake,
  cardWidth = 220,
}: {
  state: GameState;
  hiker: Hiker;
  simple: boolean;
  onTake(index: number, node?: NodeType): void;
  /** The cards' width (the station's Workbench uses smaller ones). */
  cardWidth?: number;
}) {
  const open = state.crafting;
  const cards = open?.options ?? [];
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
        <div className={styles.cards}>
          {cards.map((c, i) => {
            const up = flipped[i];
            const higher = (ITEMS[c.itemId]?.tier ?? 1) > tier;
            return (
              <button
                key={`${c.itemId}-${i}`}
                type="button"
                className={styles.card}
                style={{ width: cardWidth, height: Math.round((cardWidth * 7) / 5) }}
                data-up={up}
                aria-pressed={chosen === i}
                aria-label={
                  up
                    ? `${ITEMS[c.itemId]?.name ?? 'Item'}${quality(c.quality)}`
                    : 'Face down: turn it over'
                }
                onClick={() => {
                  if (!up) setFlipped((f) => f.map((x, j) => (j === i ? true : x)));
                  else {
                    setChosen(i);
                    setNode(null);
                  }
                }}
              >
                <span className={styles.flip}>
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
                </span>
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
}: {
  itemId: ItemId;
  quality?: number;
  learned: boolean;
  hiker: Hiker;
  onDone(): void;
  cardWidth?: number;
}) {
  const def = ITEMS[itemId];
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    done.current?.focus();
  }, []);
  return (
    <>
      <div className={styles.made}>
        <ItemCard
          itemId={itemId}
          {...(quality ? { item: { quality: quality as 1 | 2 | 3 | 4 | 5 } } : {})}
          width={cardWidth}
        />
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
  const cost = bp ? teachCost(bp) : 0;
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
              <ItemCard itemId={def.id} width={150} />
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
