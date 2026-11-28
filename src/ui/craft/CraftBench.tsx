/**
 * The craft tab (35-ui-overhaul.md, section 6): a workbench on top, the
 * resources in the middle, and the recipe book underneath.
 *
 * - **Click a recipe** and it fills itself: the resources fly from the tray
 *   into the slots one by one, each clack a step higher (`craft.slot`);
 *   missing ones show as ghost slots (`craft.ghost`). When the bench is full,
 *   Craft pulses (`craft.ready`). Auto-fill spends spare resources first (the
 *   engine's `autoPay`).
 * - **Or fill it by hand** by clicking resources; the bench names the recipe
 *   it matches, Minecraft style. Clicking a slot takes that resource back;
 *   Clear empties the bench (`craft.clear`).
 * - **Stars** on recipes (the book) and resources (the tray) mark favorites.
 * - **Crafting:** the resources hop into the middle, three hammer hits with
 *   sparks and a shake (`act.craft.<type>`), then the craft goes through: a
 *   blueprint's card comes out (CraftWindow's Made), a basic recipe deals its
 *   cards (the pick step, as before).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/engine';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import {
  autoPay,
  craftCost,
  craftPool,
  craftRecipe,
  fitsPart,
  spaceParts,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
  type ItemTypeName,
  type NodeType,
  type PaidSlot,
  type ResourceId,
} from '../../engine';
import { colorOfHiker } from '../app/hikerLook';
import { useReducedMotion } from '../app/useReducedMotion';
import { Icon } from '../icons/Icon';
import { TYPE_ICON, TYPE_LOOK } from '../items/itemLook';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { burst } from '../scavenge/brush';
import { matchBench } from './bench';
import { RecipeBook } from './RecipeBook';
import styles from './CraftBench.module.css';

const C = BALANCE.ui.overhaul.craft;
const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];

interface Target {
  key: string;
  type: ItemTypeName;
  blueprint?: string;
}

const wait = (ms: number) => new Promise((done) => window.setTimeout(done, ms));

export function CraftBench({
  state,
  hiker,
  onCraft,
  onDispatch,
}: {
  state: GameState;
  hiker: Hiker;
  /** The craft itself (CraftWindow follows what it made). */
  onCraft(action: Action): void;
  /** Stars (saved with the hike). */
  onDispatch(action: Action): void;
}) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const benchRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
  // Each slot: a resource (where from), or null for a ghost (one the party is missing).
  const [bench, setBench] = useState<(PaidSlot | null)[]>([]);
  const [landed, setLanded] = useState(0);
  const [busy, setBusy] = useState<'fill' | 'craft' | null>(null);
  const [node, setNode] = useState<NodeType | null>(null);
  const [hits, setHits] = useState(0);
  const run = useRef(0);

  const pool = craftPool(state, hiker);
  const used = (from: string, id: ResourceId) =>
    bench.filter((s) => s?.from === from && s.resource === id).length;
  const left = (from: string, id: ResourceId) =>
    (pool.find((h) => h.id === from)?.inventory.resources[id] ?? 0) - used(from, id);

  // What the bench makes now.
  const filled = bench.filter((s): s is PaidSlot => !!s);
  const ghosts = bench.length - filled.length;
  const match =
    !ghosts && landed >= bench.length ? matchBench(state, hiker, filled, target?.key) : null;
  const def = match?.craftable.blueprint ? ITEMS[match.craftable.blueprint] : undefined;
  const needsNode = !!def?.madeWithNode;
  const action: Action | null = match
    ? {
        type: 'craft',
        hikerId: hiker.id,
        itemType: match.craftable.type,
        ...(match.craftable.blueprint ? { blueprint: match.craftable.blueprint } : {}),
        slots: match.ordered,
        ...(node ? { node } : {}),
      }
    : null;
  const reason = action ? validateAction(state, action) : null;
  const ready = !!action && !reason && (!needsNode || !!node) && !busy;

  // Ready: two small notes.
  const readyKey = ready ? match?.craftable.key : null;
  useEffect(() => {
    if (readyKey) sfx('craft.ready');
  }, [readyKey]);

  /** A resource image flies from the tray to a slot. */
  const fly = (src: string, from: Element | null, to: Element | null) => {
    const box = root.current;
    if (!box || !from || !to || reduced) return;
    const b = box.getBoundingClientRect();
    const scale = b.width / box.offsetWidth || 1;
    const f = from.getBoundingClientRect();
    const t = to.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = src;
    img.className = styles.fly ?? '';
    const x0 = (f.left + f.width / 2 - b.left) / scale - 22;
    const y0 = (f.top + f.height / 2 - b.top) / scale - 22;
    const dx = (t.left + t.width / 2 - f.left - f.width / 2) / scale;
    const dy = (t.top + t.height / 2 - f.top - f.height / 2) / scale;
    img.style.left = `${x0}px`;
    img.style.top = `${y0}px`;
    box.appendChild(img);
    const anim = img.animate(
      [
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 60}px) scale(1.25)`, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(1.05)` },
      ],
      { duration: C.flyMs, easing: 'cubic-bezier(.4,0,.6,1)' },
    );
    anim.onfinish = () => img.remove();
  };

  /** Click a recipe: clear the bench, then fill it from the tray, one by one. */
  const fill = async (t: Target) => {
    if (busy) return;
    const me = ++run.current;
    const recipe = craftRecipe(state, hiker, t.type, t.blueprint);
    if (!recipe) return;
    setBusy('fill');
    if (bench.length) {
      sfx('craft.clear');
      setBench([]);
      await wait(reduced ? 0 : 160);
    }
    const plan = autoPay(state, hiker, recipe);
    setTarget(t);
    setNode(null);
    setBench(plan);
    setLanded(0);
    for (let i = 0; i < plan.length; i++) {
      if (run.current !== me) return;
      const s = plan[i];
      const chip = s ? root.current?.querySelector(`[data-chip="${s.from}:${s.resource}"]`) : null;
      const slot = root.current?.querySelector(`[data-slot="${i}"]`) ?? null;
      if (s) fly(ASSETS.resources[s.resource] ?? '', chip ?? null, slot);
      await wait(reduced ? 0 : C.fillGapMs);
      const k = i;
      window.setTimeout(
        () => {
          if (run.current !== me) return;
          setLanded((n) => Math.max(n, k + 1));
          if (s) sfx('craft.slot', { rate: 1 + 0.06 * k });
          else sfx('craft.ghost');
        },
        reduced ? 0 : C.flyMs - C.fillGapMs,
      );
    }
    await wait(reduced ? 0 : C.flyMs);
    if (run.current === me) {
      setLanded(plan.length);
      setBusy(null);
    }
  };

  /** Click a resource: into the first ghost it fits, or onto the end. */
  const add = (from: string, id: ResourceId) => {
    if (busy || left(from, id) <= 0) {
      sfx('ui.error');
      return;
    }
    const recipe = target ? craftRecipe(state, hiker, target.type, target.blueprint) : undefined;
    const parts = recipe ? spaceParts(recipe) : [];
    let at = bench.findIndex((s, i) => !s && !!recipe && fitsPart(recipe[parts[i] ?? 0]!, id));
    const next = [...bench];
    if (at < 0) {
      if (bench.length >= C.maxSlots) {
        sfx('ui.error');
        return;
      }
      // Filling by hand past the recipe: it's the bench's own now.
      if (!bench.some((s) => !s)) setTarget(null);
      at = next.length;
      next.push(null);
    }
    next[at] = { from, resource: id };
    setBench(next);
    setLanded(next.length);
    fly(
      ASSETS.resources[id] ?? '',
      root.current?.querySelector(`[data-chip="${from}:${id}"]`) ?? null,
      root.current?.querySelector(`[data-slot="${at}"]`) ?? null,
    );
    sfx('craft.slot', { rate: 1 + 0.06 * at });
  };

  /** Click a slot: that resource goes back (a ghost again, when a recipe is picked). */
  const takeBack = (i: number) => {
    if (busy || !bench[i]) return;
    const next = [...bench];
    if (target) next[i] = null;
    else next.splice(i, 1);
    setBench(next);
    setLanded(next.length);
  };

  const clear = () => {
    if (busy) return;
    run.current += 1;
    sfx('craft.clear');
    setBench([]);
    setTarget(null);
    setNode(null);
    setLanded(0);
  };

  /** Craft: the resources hop in, three hammer hits, then it's made. */
  const craft = async () => {
    if (!ready || !action || !match) return;
    setBusy('craft');
    sfx(`act.craft.${match.craftable.type}`);
    if (!reduced) {
      for (let k = 0; k < 3; k++) {
        await wait(k ? C.hammerGapMs : C.hopMs);
        setHits((n) => n + 1);
        const box = root.current;
        const b = benchRef.current;
        if (box && b) {
          const r = box.getBoundingClientRect();
          const s = b.getBoundingClientRect();
          const scale = r.width / box.offsetWidth || 1;
          burst(
            box,
            (s.left - r.left) / scale + Math.min(360, bench.length * 36),
            (s.top - r.top) / scale + 64,
            ['#ffd27a', '#ff9e45', '#fff3c4'],
            14,
            70,
            60,
          );
        }
      }
      await wait(C.hammerGapMs);
    }
    setBench([]);
    setTarget(null);
    setLanded(0);
    setBusy(null);
    onCraft(action);
  };

  const shown = Math.max(bench.length, C.slotsShown);
  const crafter = hiker.name;
  const energy = craftCost(state, hiker);
  return (
    <div ref={root} className={styles.craft}>
      <div
        ref={benchRef}
        className={styles.bench}
        data-hammering={busy === 'craft' || undefined}
        data-hit={hits % 2}
        style={{ backgroundImage: `url(${ASSETS.ui.workbench})` }}
      >
        <div className={styles.slots} data-crafting={busy === 'craft' || undefined}>
          {Array.from({ length: shown }, (_, i) => {
            const s = bench[i];
            const inBench = i < bench.length && i < landed;
            const ghost = inBench && !s;
            const part = target
              ? craftRecipe(state, hiker, target.type, target.blueprint)
              : undefined;
            const ghostRes = ghost ? part?.[spaceParts(part)[i] ?? 0]?.ids?.[0] : undefined;
            return (
              <button
                key={i}
                type="button"
                data-slot={i}
                className={styles.slot}
                data-ghost={ghost || undefined}
                data-full={(inBench && !!s) || undefined}
                data-sound="none"
                disabled={!inBench || !s || !!busy}
                aria-label={
                  inBench && s
                    ? `${resourceName(s.resource)} (click to take it back)`
                    : ghost
                      ? `Missing: ${ghostRes ? resourceName(ghostRes) : 'a resource'}`
                      : 'Empty slot'
                }
                onClick={() => takeBack(i)}
              >
                {inBench && s ? (
                  <img src={ASSETS.resources[s.resource]} alt="" />
                ) : ghost ? (
                  ghostRes ? (
                    <img src={ASSETS.resources[ghostRes]} alt="" />
                  ) : (
                    <span className={styles.q}>?</span>
                  )
                ) : null}
              </button>
            );
          })}
        </div>
        <svg className={styles.arrow} viewBox="0 0 46 40" aria-hidden="true">
          <path
            d="M2 20h36M26 6l14 14-14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className={styles.result} aria-label="What the bench makes">
          {match ? (
            def ? (
              <img src={ASSETS.itemArt(def.art ?? def.id)} alt={def.name} />
            ) : (
              <span
                className={styles.typeCard}
                style={{ '--tc': TYPE_LOOK[match.craftable.type].accent } as CSSProperties}
              >
                <Icon name={TYPE_ICON[match.craftable.type]} size={40} color="#fff" />
                <span>{TYPE_LOOK[match.craftable.type].label.toUpperCase()}</span>
              </span>
            )
          ) : (
            <span className={styles.q}>?</span>
          )}
        </div>
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.go}
            data-ready={ready || undefined}
            disabled={!ready}
            data-sound="none"
            onClick={() => void craft()}
          >
            {match ? 'CRAFT' : ghosts ? `MISSING ${ghosts}` : 'CRAFT'}
          </button>
          <button
            type="button"
            className={styles.clear}
            disabled={!bench.length || !!busy}
            data-sound="none"
            onClick={clear}
          >
            Clear
          </button>
          <small className={styles.cost}>
            {energy ? `−${energy} Energy` : 'No Energy'} · {crafter}’s action
          </small>
        </div>
        <p className={styles.info} role="status">
          {match ? (
            <>
              <b>
                {(def?.name ?? `${TYPE_LOOK[match.craftable.type].label} · basic`).toUpperCase()}
              </b>{' '}
              · {def ? 'blueprint · you get exactly this' : 'basic recipe · pick 1 of a deal'}
              {reason ? ` · ${reason}` : ''}
            </>
          ) : ghosts && target ? (
            <>Missing {ghosts}: find them, or someone here can chip in.</>
          ) : bench.length ? (
            'No recipe matches yet. Keep adding, or pick a recipe below.'
          ) : (
            'Pick a recipe in the book, or click resources to fill the bench yourself.'
          )}
        </p>
        {needsNode && (
          <div className={styles.nodes} role="radiogroup" aria-label="Made with which node">
            {NODES.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={node === n}
                className={styles.node}
                onClick={() => setNode(n)}
              >
                <img src={NODE_IMAGE[n]} alt="" width={18} height={21} />
                {NODE_NAME[n]}
              </button>
            ))}
          </div>
        )}
      </div>

      <Tray state={state} hiker={hiker} left={left} onAdd={add} onDispatch={onDispatch} />

      <div className={styles.bookWrap}>
        <RecipeBook
          state={state}
          hiker={hiker}
          picked={target?.key ?? null}
          onPick={(row) => void fill(row)}
          onDispatch={onDispatch}
        />
      </div>
    </div>
  );
}

const resourceName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/** The crafter's pack and the resources pooled on the tile, with a dot for whose. */
function Tray({
  state,
  hiker,
  left,
  onAdd,
  onDispatch,
}: {
  state: GameState;
  hiker: Hiker;
  left(from: string, id: ResourceId): number;
  onAdd(from: string, id: ResourceId): void;
  onDispatch(action: Action): void;
}) {
  const pool = craftPool(state, hiker);
  const starred = state.starred?.resources ?? [];
  const chips = (h: Hiker, own: boolean) =>
    (Object.keys(h.inventory.resources) as ResourceId[])
      .filter((id) => (h.inventory.resources[id] ?? 0) > 0)
      .map((id) => {
        const n = left(h.id, id);
        const on = starred.includes(id);
        return (
          <span key={`${h.id}:${id}`} className={styles.chipWrap}>
            <button
              type="button"
              className={styles.chip}
              data-chip={`${h.id}:${id}`}
              data-zero={n <= 0 || undefined}
              data-sound="none"
              title={`${resourceName(id)}${own ? '' : ` (${h.name}’s)`}`}
              aria-label={`${resourceName(id)} ×${n}${own ? '' : `, ${h.name}’s`}. Put one on the bench.`}
              onClick={() => onAdd(h.id, id)}
            >
              <img src={ASSETS.resources[id]} alt="" />
              <b>{n}</b>
              {!own && <span className={styles.own} style={{ background: colorOfHiker(h.id) }} />}
            </button>
            <button
              type="button"
              className={styles.chipStar}
              aria-pressed={on}
              aria-label={`${on ? 'Unstar' : 'Star'} ${resourceName(id)}`}
              data-sound="none"
              onClick={() => {
                sfx(on ? 'ui.unstar' : 'ui.star');
                onDispatch({ type: 'star', what: 'resource', id, on: !on });
              }}
            >
              <Icon name="star" size={12} strokeWidth={2.4} solid={on} />
            </button>
          </span>
        );
      });
  const others = pool.filter((h) => h.id !== hiker.id);
  return (
    <div className={styles.tray}>
      <div className={styles.group}>
        <span className={styles.label}>{hiker.name.toUpperCase()}’S PACK</span>
        <div className={styles.row}>
          {chips(hiker, true)}
          {!Object.values(hiker.inventory.resources).some((n) => (n ?? 0) > 0) && (
            <span className={styles.hint}>No resources.</span>
          )}
        </div>
      </div>
      {others.length > 0 && (
        <div className={styles.group}>
          <span className={styles.label}>ON THIS TILE · POOLED</span>
          <div className={styles.row}>{others.flatMap((h) => chips(h, false))}</div>
        </div>
      )}
      <div className={styles.group} data-tip>
        <span className={styles.label}>TIP</span>
        <span className={styles.hint}>
          Click a recipe to fill the bench, or click resources to fill it yourself. ★ marks what to
          save and look for.
        </span>
      </div>
    </div>
  );
}
