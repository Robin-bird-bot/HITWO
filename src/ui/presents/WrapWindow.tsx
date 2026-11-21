/**
 * Grammy Clause's crafting window (Gift Wrapper; holiday hikers): only the
 * four Present recipes, never blueprints or other items.
 *
 * - **3 of one resource** and **5 of one type** make a plain Present. The
 *   player picks which resource or type; the one there's most of comes first.
 * - **Small wish list** (3 resources) makes a Tier 2+ Present and **big wish
 *   list** (5) a Tier 3 one. Each shows its resources' icons.
 * - The spaces fill from her own resources first, then the others on the tile,
 *   like any craft. Both wish lists change after every Present.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { presentName } from '../../content/items/presents';
import { RESOURCES } from '../../content/resources';
import {
  craftPool,
  presentRecipe,
  RECIPE_GRADE,
  sameResourceChoices,
  sameTypeChoices,
  validateAction,
  wrapSlots,
  type Action,
  type GameState,
  type Hiker,
  type NodeType,
  type PresentRecipe,
  type ResourceId,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { ItemCard } from '../items/ItemCard';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { useDraggable } from '../windows/useDraggable';
import { Face } from '../craft/CraftWindow';
import craft from '../craft/CraftWindow.module.css';
import styles from './WrapWindow.module.css';

const P = BALANCE.presents;
const resName = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.name ?? id;

const RECIPES: readonly { id: PresentRecipe; name: string; what: string }[] = [
  { id: 'sameResource', name: 'SAME RESOURCE', what: `${P.sameResource} of one resource` },
  { id: 'sameType', name: 'SAME TYPE', what: `${P.sameType} resources of one type, any mix` },
  { id: 'smallWish', name: 'SMALL WISH LIST', what: `These ${P.smallWishList} resources` },
  { id: 'bigWish', name: 'BIG WISH LIST', what: `These ${P.bigWishList} resources` },
];

interface WrapWindowProps {
  state: GameState;
  hikerId: string;
  /** Dispatches an action; true when it went through. */
  onDispatch(action: Action): boolean;
  onClose(): void;
}

export function WrapWindow({ state, hikerId, onDispatch, onClose }: WrapWindowProps) {
  const hiker = state.hikers.find((h) => h.id === hikerId);
  const { ref, windowProps, translate } = useDraggable<HTMLDivElement>('craft');
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!hiker) return null;

  return (
    <div className={craft.overlay}>
      <section
        ref={ref}
        className={craft.window}
        style={{ '--accent': '#F2867A', translate } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label="Wrap a Present"
        tabIndex={-1}
        {...windowProps}
      >
        <header className={craft.head} data-drag-handle>
          <h2 className={craft.windowTitle}>CRAFT</h2>
          <span className={craft.crafter}>
            <Face id={hiker.id} size={34} />
            <span className={craft.crafterName}>{hiker.name.toUpperCase()}</span>
          </span>
          <button type="button" className={craft.close} aria-label="Close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </header>
        <WrapBody state={state} hiker={hiker} onDispatch={onDispatch} onDone={onClose} />
      </section>
    </div>
  );
}

/** The recipes (or the Present just wrapped). The station's Workbench shows this too. */
export function WrapBody({
  state,
  hiker,
  onDispatch,
  onDone,
  compact = false,
}: {
  state: GameState;
  hiker: Hiker;
  onDispatch(action: Action): boolean;
  onDone(): void;
  /** The station's Workbench: smaller rows, no header bar. */
  compact?: boolean;
}) {
  const free = !!state.station && hiker.status === 'checkedIn';
  // After wrapping: the log from here on says what was made.
  const [madeFrom, setMadeFrom] = useState<number | null>(null);
  const made =
    madeFrom !== null
      ? state.log.find((e) => e.id >= madeFrom && e.kind === 'wrapped' && e.hikerId === hiker.id)
      : undefined;
  const wrap = (action: Action) => {
    const from = state.nextEventId;
    if (onDispatch(action)) setMadeFrom(from);
  };

  return (
    <>
      {!compact && (
        <div className={craft.kindBar}>
          <span>
            PRESENTS ONLY ·{' '}
            {free ? 'FREE AT THE WORKBENCH' : `USES ${hiker.name.toUpperCase()}’S ACTION`}
          </span>
          <span className={craft.kindRight}>
            <Icon name="users" size={15} /> {craftPool(state, hiker).length} ON THIS TILE
          </span>
        </div>
      )}
      {made && made.kind === 'wrapped' ? (
        <Wrapped
          state={state}
          hiker={hiker}
          compact={compact}
          onDone={compact ? () => setMadeFrom(null) : onDone}
          onMore={() => setMadeFrom(null)}
        />
      ) : (
        <div className={styles.list} data-compact={compact || undefined}>
          {!compact && (
            <p className={styles.lead}>
              Plain Presents are cheap. The wish lists make the good ones, and both lists change
              after every Present.
            </p>
          )}
          {RECIPES.map((r) => (
            <RecipeRow key={r.id} state={state} hiker={hiker} recipe={r} onWrap={wrap} />
          ))}
        </div>
      )}
    </>
  );
}

function RecipeRow({
  state,
  hiker,
  recipe,
  onWrap,
}: {
  state: GameState;
  hiker: Hiker;
  recipe: (typeof RECIPES)[number];
  onWrap(action: Action): void;
}) {
  const resources = recipe.id === 'sameResource' ? sameResourceChoices(state, hiker) : [];
  const nodes = recipe.id === 'sameType' ? sameTypeChoices(state, hiker) : [];
  const [resource, setResource] = useState<ResourceId | undefined>(undefined);
  const [node, setNode] = useState<NodeType | undefined>(undefined);
  const pickedResource = resource && resources.includes(resource) ? resource : resources[0];
  const pickedNode = node && nodes.includes(node) ? node : nodes[0];
  const pick = {
    ...(pickedResource ? { resource: pickedResource } : {}),
    ...(pickedNode ? { node: pickedNode } : {}),
  };
  const made = presentRecipe(state, hiker, recipe.id, pick);
  const slots = made ? wrapSlots(state, hiker, made.parts) : [];
  const action: Action = { type: 'wrapPresent', hikerId: hiker.id, recipe: recipe.id, ...pick };
  const reason = validateAction(state, action);
  const grade = RECIPE_GRADE[recipe.id];
  const wish =
    recipe.id === 'smallWish'
      ? hiker.wishLists?.small
      : recipe.id === 'bigWish'
        ? hiker.wishLists?.big
        : undefined;

  return (
    <div className={styles.row} data-ready={!reason || undefined}>
      <div className={styles.what}>
        <span className={styles.name}>{recipe.name}</span>
        <span className={styles.makes} data-grade={grade}>
          {presentName(grade).toUpperCase()}
        </span>
        <span className={styles.small}>{recipe.what}</span>
      </div>

      <div className={styles.middle}>
        {/* The resource or type to use, for the plain recipes. */}
        {recipe.id === 'sameResource' && resources.length > 1 && (
          <div className={styles.choices} role="radiogroup" aria-label="Which resource">
            {resources.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === pickedResource}
                className={styles.choice}
                title={resName(id)}
                onClick={() => setResource(id)}
              >
                <img src={ASSETS.resources[id]} alt={resName(id)} width={26} height={26} />
              </button>
            ))}
          </div>
        )}
        {recipe.id === 'sameType' && nodes.length > 1 && (
          <div className={styles.choices} role="radiogroup" aria-label="Which type">
            {nodes.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === pickedNode}
                className={styles.choice}
                title={NODE_NAME[n]}
                onClick={() => setNode(n)}
              >
                <img src={NODE_IMAGE[n]} alt={NODE_NAME[n]} width={24} height={27} />
              </button>
            ))}
          </div>
        )}
        <div className={styles.spaces} aria-label="What it takes">
          {made
            ? slots.map((slot, i) => {
                const want = wishWant(wish, i) ?? slot?.resource;
                return (
                  <span key={i} className={styles.space} data-empty={!slot || undefined}>
                    {want && (
                      <img
                        src={ASSETS.resources[want]}
                        alt={resName(want)}
                        title={resName(want)}
                        width={30}
                        height={30}
                      />
                    )}
                    {slot && slot.from !== hiker.id && (
                      <span className={styles.giver}>
                        <Face id={slot.from} size={18} />
                      </span>
                    )}
                  </span>
                );
              })
            : Array.from(
                { length: recipe.id === 'sameType' ? P.sameType : P.sameResource },
                (_, i) => <span key={i} className={styles.space} data-empty />,
              )}
        </div>
        {reason && <span className={styles.why}>{reason}</span>}
      </div>

      <button
        type="button"
        className={styles.wrap}
        disabled={!!reason}
        title={reason ?? undefined}
        onClick={() => onWrap(action)}
      >
        <Icon name="package" size={18} /> WRAP
      </button>
    </div>
  );
}

/**
 * The resource a wish list's space wants, in the order the spaces are paid
 * (each different resource with its count, as the recipe groups them).
 */
function wishWant(wish: readonly ResourceId[] | undefined, i: number): ResourceId | undefined {
  if (!wish) return undefined;
  const order: ResourceId[] = [];
  const counts = new Map<ResourceId, number>();
  for (const id of wish) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) for (let k = 0; k < n; k++) order.push(id);
  return order[i];
}

/** The Present just wrapped, in its wrapping. */
function Wrapped({
  state,
  hiker,
  compact,
  onDone,
  onMore,
}: {
  state: GameState;
  hiker: Hiker;
  compact: boolean;
  onDone(): void;
  onMore(): void;
}) {
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    done.current?.focus();
  }, []);
  const present = [...hiker.inventory.bag].reverse().find((i) => i.itemId === 'present');
  const canMore = !!state.station && !compact;
  return (
    <>
      <div className={craft.made}>
        {present && <ItemCard itemId={present.itemId} item={present} width={compact ? 130 : 240} />}
        <p className={craft.madeWords}>
          {hiker.name} wrapped a {presentName(present?.grade)}. It’s in their pack, and both wish
          lists changed.
        </p>
      </div>
      <footer className={craft.foot}>
        <span className={craft.summary} />
        {canMore && (
          <button type="button" className={craft.second} onClick={onMore}>
            WRAP ANOTHER
          </button>
        )}
        <button ref={done} type="button" className={craft.go} onClick={onDone}>
          DONE
        </button>
      </footer>
    </>
  );
}
