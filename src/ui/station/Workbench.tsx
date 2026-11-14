/**
 * The station's Workbench tab (Phase 9; approved in #mockup-station-extras,
 * Wyatt, Nov 14), on the counter:
 * - who's crafting, and the item types with their tier one higher here;
 * - the basic recipe (or a blueprint's), paid from everyone's packs, with the
 *   Craft button. Crafting here is free: no action.
 * - the crafter's blueprints, with the visit's free ones marked FREE HERE
 *   (crafting one keeps it) and ones still above the Workbench's tier locked;
 * - everyone's resources, with what the recipe takes marked.
 * Then the 3 dealt cards, or what was made, on the counter. It shares the
 * Craft window's spaces, swap list, pick step and "made" view.
 */
import { useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import {
  autoPay,
  canUseBlueprint,
  craftPool,
  craftRecipe,
  craftTier,
  knowsBlueprint,
  ownCraftTier,
  spaceParts,
  validateAction,
  CRAFT_TYPES,
  type Action,
  type GameState,
  type Hiker,
  type ItemId,
  type ItemType,
  type NodeType,
  type PaidSlot,
} from '../../engine';
import { Face, Made, PartIcons, PickBody, Slot, Swap } from '../craft/CraftWindow';
import { partLabel, payWords, recipeWords, resName } from '../craft/craftWords';
import { Icon } from '../icons/Icon';
import { TYPE_ICON, TYPE_LOOK } from '../items/itemLook';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import styles from './Workbench.module.css';

const NUMERAL = ['', 'I', 'II', 'III', 'IV'];
const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];

export function Workbench({
  state,
  simple,
  onDispatch,
}: {
  state: GameState;
  simple: boolean;
  onDispatch(action: Action): boolean;
}) {
  const here = state.hikers.filter((h) => h.status === 'checkedIn');
  const [crafterId, setCrafterId] = useState(here[0]?.id ?? '');
  // After a craft: the log from here on says what was made.
  const [madeFrom, setMadeFrom] = useState<number | null>(null);
  const pending = state.crafting;
  const crafter = state.hikers.find((h) => h.id === (pending?.hikerId ?? crafterId));
  if (!crafter) return null;
  const made =
    madeFrom !== null ? state.log.find((e) => e.id >= madeFrom && e.kind === 'crafted') : undefined;

  const dispatch = (action: Action) => {
    const from = state.nextEventId;
    const ok = onDispatch(action);
    const makes = action.type === 'craftTake' || (action.type === 'craft' && !!action.blueprint);
    if (ok && makes) setMadeFrom(from);
  };

  if (made && made.kind === 'crafted') {
    const who = state.hikers.find((h) => h.id === made.hikerId) ?? crafter;
    return (
      <div className={styles.panelWide}>
        <Made
          itemId={made.itemId}
          {...(made.quality ? { quality: made.quality } : {})}
          learned={!!made.learned}
          hiker={who}
          cardWidth={140}
          onDone={() => setMadeFrom(null)}
        />
      </div>
    );
  }
  if (pending) {
    return (
      <div className={styles.panelWide}>
        <PickBody
          key={state.nextEventId}
          state={state}
          hiker={crafter}
          simple
          cardWidth={150}
          onTake={(index, node) =>
            dispatch({ type: 'craftTake', index, ...(node ? { node } : {}) })
          }
        />
      </div>
    );
  }
  return (
    <CraftHere
      key={crafter.id}
      state={state}
      crafter={crafter}
      here={here}
      simple={simple}
      onCrafter={setCrafterId}
      onCraft={dispatch}
    />
  );
}

function CraftHere({
  state,
  crafter,
  here,
  simple,
  onCrafter,
  onCraft,
}: {
  state: GameState;
  crafter: Hiker;
  here: Hiker[];
  simple: boolean;
  onCrafter(id: string): void;
  onCraft(action: Action): void;
}) {
  const [type, setType] = useState<ItemType>('tool');
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
  const recipe = craftRecipe(state, crafter, type, blueprint ?? undefined) ?? [];
  const slots = custom ?? autoPay(state, crafter, recipe);
  const parts = spaceParts(recipe);
  const complete = slots.every((s): s is PaidSlot => !!s);
  const action: Action = {
    type: 'craft',
    hikerId: crafter.id,
    itemType: type,
    ...(bp ? { blueprint: bp.id } : {}),
    ...(complete && custom ? { slots } : {}),
    ...(node ? { node } : {}),
  };
  const reason = validateAction(state, action);
  const tier = craftTier(state, crafter, type);
  const temp = state.station?.tempBlueprints ?? [];
  const known = crafter.blueprints ?? [];
  const blueprints = [...temp.filter((id) => !known.includes(id)), ...known];

  return (
    <>
      <div className={styles.side}>
        <span className={styles.kicker}>WHO’S CRAFTING?</span>
        <div className={styles.crafters}>
          {here.map((h) => (
            <button
              key={h.id}
              type="button"
              className={styles.crafter}
              aria-pressed={h.id === crafter.id}
              aria-label={`${h.name} crafts`}
              title={h.name}
              onClick={() => onCrafter(h.id)}
            >
              <Face id={h.id} size={34} />
            </button>
          ))}
        </div>
        <ul className={styles.types}>
          {CRAFT_TYPES.map((t) => (
            <li key={t}>
              <button
                type="button"
                className={styles.type}
                aria-pressed={t === type && !bp}
                onClick={() => {
                  setType(t);
                  setBlueprint(null);
                  reset();
                }}
              >
                <Icon name={TYPE_ICON[t]} size={20} />
                <span>{TYPE_LOOK[t].label.toUpperCase()}</span>
                <small>
                  TIER {NUMERAL[ownCraftTier(crafter, t)]} <Icon name="chevronUp" size={12} />{' '}
                  {NUMERAL[craftTier(state, crafter, t)]}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.main} style={{ '--accent': TYPE_LOOK[type].accent } as CSSProperties}>
        <span className={styles.kicker}>
          {bp
            ? `BLUEPRINT · EXACTLY A ${bp.name.toUpperCase()}`
            : `BASIC RECIPE · TIER ${NUMERAL[tier]} ${TYPE_LOOK[type].label.toUpperCase()}`}
        </span>
        {!simple && (
          <p className={styles.small}>
            {bp
              ? temp.includes(bp.id) && !knowsBlueprint(crafter, bp.id)
                ? `A free blueprint this visit: craft the ${bp.name} to keep it.`
                : `Makes exactly the ${bp.name}.`
              : `At the Workbench everyone crafts one tier higher. 3 cards are dealt; pick 1.`}
          </p>
        )}
        <div className={styles.recipe}>
          {recipe.map((part, i) => (
            <div key={i} className={styles.part} title={partLabel(part)}>
              {i > 0 && <span className={styles.plus}>+</span>}
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
              <span className={styles.partIcons} aria-hidden="true">
                <PartIcons part={part} />
              </span>
            </div>
          ))}
        </div>
        {swapAt !== null ? (
          <div className={styles.swap}>
            <Swap
              state={state}
              hiker={crafter}
              recipe={recipe}
              slots={slots}
              at={swapAt}
              onSlots={(next) => {
                setCustom(next);
                setSwapAt(null);
              }}
            />
          </div>
        ) : (
          <p className={styles.words}>{recipeWords(recipe)}</p>
        )}
        {bp?.madeWithNode && (
          <div className={styles.nodes}>
            <span className={styles.kicker}>MADE FOR WHICH NODE?</span>
            {NODES.map((n) => (
              <button
                key={n}
                type="button"
                className={styles.node}
                aria-pressed={node === n}
                onClick={() => setNode(n)}
              >
                <img src={NODE_IMAGE[n]} alt="" width={20} height={23} />
                {NODE_NAME[n]}
              </button>
            ))}
          </div>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.go}
            disabled={!!reason}
            onClick={() => onCraft(action)}
          >
            {bp ? `CRAFT THE ${bp.name.toUpperCase()}` : 'CRAFT · PICK 1 OF 3'}
          </button>
          <span className={styles.small} data-reason={reason ? true : undefined}>
            {reason ?? `Free here: no action. ${payWords(state, slots)}.`}
          </span>
        </div>
        <span className={styles.kicker}>BLUEPRINTS · {blueprints.length}</span>
        <div className={styles.blueprints}>
          {blueprints.length === 0 && (
            <p className={styles.small}>None yet. Crafting an item teaches its blueprint.</p>
          )}
          {blueprints.map((id) => (
            <BlueprintSquare
              key={id}
              state={state}
              crafter={crafter}
              itemId={id}
              selected={id === blueprint}
              onPick={() => {
                const def = ITEMS[id];
                if (!def) return;
                setBlueprint(id === blueprint ? null : id);
                setType(def.type);
                reset();
              }}
            />
          ))}
        </div>
      </div>

      <aside className={styles.pool} aria-label="Everyone’s resources">
        <span className={styles.kicker}>EVERYONE’S RESOURCES</span>
        {!simple && (
          <p className={styles.small}>
            At the station every pack is shared. Gold ones pay for this recipe.
          </p>
        )}
        <ul className={styles.poolList}>
          {craftPool(state, crafter).map((h) => {
            const res = Object.entries(h.inventory.resources).filter(([, n]) => !!n);
            return (
              <li key={h.id} className={styles.poolRow}>
                <Face id={h.id} size={24} />
                <span className={styles.poolName}>{h.name.toUpperCase()}</span>
                <span className={styles.poolRes}>
                  {res.length === 0 && <span className={styles.small}>Nothing</span>}
                  {res.map(([id, n]) => {
                    const used = slots.filter((s) => s?.from === h.id && s.resource === id).length;
                    return (
                      <span
                        key={id}
                        className={styles.res}
                        data-used={used > 0 || undefined}
                        title={resName(id)}
                      >
                        <img src={ASSETS.resources[id]} alt={resName(id)} />
                        <b>{used ? `−${used}` : n}</b>
                      </span>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}

/** A blueprint on blue grid paper: free this visit, ready, short of resources, or locked. */
function BlueprintSquare({
  state,
  crafter,
  itemId,
  selected,
  onPick,
}: {
  state: GameState;
  crafter: Hiker;
  itemId: ItemId;
  selected: boolean;
  onPick(): void;
}) {
  const def = ITEMS[itemId];
  if (!def) return null;
  const tier = craftTier(state, crafter, def.type);
  const locked = def.tier > tier;
  const free = !knowsBlueprint(crafter, itemId) && canUseBlueprint(state, crafter, itemId);
  const missing = def.recipe ? autoPay(state, crafter, def.recipe).filter((s) => !s).length : 0;
  const status = locked
    ? `TIER ${NUMERAL[def.tier]} · LOCKED`
    : free
      ? 'FREE HERE'
      : missing
        ? `NEEDS ${missing} MORE`
        : 'READY';
  return (
    <button
      type="button"
      className={styles.bp}
      data-free={free || undefined}
      aria-pressed={selected}
      disabled={locked}
      title={
        locked
          ? `${def.name}: a Tier ${NUMERAL[def.tier]} blueprint, above the Workbench’s Tier ${NUMERAL[tier]}.`
          : `${def.name}${def.recipe ? `: ${recipeWords(def.recipe)}` : ''}`
      }
      style={{ '--type': TYPE_LOOK[def.type].accent } as CSSProperties}
      onClick={onPick}
    >
      <Icon name={locked ? 'shield' : TYPE_ICON[def.type]} size={22} />
      <span>{def.name.toUpperCase()}</span>
      <em>{status}</em>
    </button>
  );
}
