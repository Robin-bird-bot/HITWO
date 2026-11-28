/**
 * The recipe book (35-ui-overhaul.md, section 6): every cost up front, like
 * Catan's building costs. Tabs: Starred, Tools, Clothes, Food, Shelters and
 * Trinkets (`book.page`).
 *
 * - A type's left page has its basic recipes, Tier I to III, with the tiers
 *   above the crafter's faded; the right page has the blueprints this hiker
 *   knows.
 * - Each row: a star, an icon, the name and what it does, then the cost as
 *   small cards (dashed red where the party is missing one), ending READY or
 *   NEEDS 2.
 * - The Starred tab lists the starred recipes, ready ones first, then the
 *   starred resources with the node they come from.
 *
 * Read-only from the scavenge window's Looking for: rows can't be picked
 * there, but stars still work.
 */
import { useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/engine';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import { RESOURCES } from '../../content/resources';
import {
  autoPay,
  basicKey,
  blueprintKey,
  craftRecipe,
  craftTier,
  itemText,
  spaceParts,
  CRAFT_TYPES,
  type Action,
  type GameState,
  type Hiker,
  type ItemTypeName,
  type Recipe,
} from '../../engine';
import type { RecipePart } from '../../engine/items/recipe';
import { Icon } from '../icons/Icon';
import { TYPE_ICON, TYPE_LOOK } from '../items/itemLook';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { recipeOf } from '../scavenge/needed';
import styles from './RecipeBook.module.css';

export type BookTab = 'starred' | ItemTypeName;

const TAB_NAME: Record<ItemTypeName, string> = {
  tool: 'TOOLS',
  clothes: 'CLOTHES',
  food: 'FOOD',
  shelter: 'SHELTERS',
  trinket: 'TRINKETS',
};
const TIERS = [1, 2, 3] as const;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** A row's recipe: how it's paid now (null spaces: missing), and whether it can be made. */
interface Row {
  key: string;
  name: string;
  sub: string;
  type: ItemTypeName;
  blueprint?: string;
  parts: Recipe;
  paid: readonly boolean[];
  /** locked: above the crafter's tier; past: below it (they craft a higher tier now). */
  state: 'open' | 'locked' | 'past';
}

const resourceName = (id: string) => RESOURCES.find((r) => r.id === id)?.name ?? id;

function partWords(part: RecipePart | undefined): string {
  if (!part) return '';
  if (part.ids) return part.ids.map(resourceName).join(' or ');
  if (part.nodes?.length) return `Any ${part.nodes.map((n) => NODE_NAME[n]).join(' or ')}`;
  return 'Any resource';
}

/** A recipe in words: "3 Grass, 1 Fur, 2 any". */
function recipeWords(parts: Recipe): string {
  return parts.map((p) => `${p.n} ${partWords(p)}`).join(', ');
}

function rowFor(state: GameState, hiker: Hiker, key: string): Row | null {
  const r = recipeOf(state, hiker, key);
  if (!r) return null;
  const [kind, a, b] = key.split(':');
  const type = (kind === 'bp' ? ITEMS[a ?? '']?.type : a) as ItemTypeName;
  const tier = craftTier(state, hiker, type);
  const own = kind === 'basic' ? Number(b) : (ITEMS[a ?? '']?.tier ?? 1);
  // A starred blueprint this hiker doesn't know can't be made (yet).
  const known = kind !== 'bp' || (hiker.blueprints ?? []).includes(a ?? '');
  const rowState =
    kind === 'basic'
      ? own > tier
        ? 'locked'
        : own < tier
          ? 'past'
          : 'open'
      : !known || own > tier
        ? 'locked'
        : 'open';
  const parts =
    kind === 'basic' && rowState === 'open'
      ? (craftRecipe(state, hiker, type) ?? r.parts)
      : r.parts;
  const paid = autoPay(state, hiker, parts).map((s) => !!s);
  const def = kind === 'bp' ? ITEMS[a ?? ''] : undefined;
  return {
    key,
    name: r.name,
    sub: !known
      ? `${hiker.name} doesn’t know this blueprint yet`
      : rowState === 'locked'
        ? `Unlocks at crafter Tier ${ROMAN[own - 1]}`
        : rowState === 'past'
          ? `${r.name.split(' · ')[0]} at Tier ${ROMAN[tier - 1]} now`
          : def
            ? itemText(def)
            : recipeWords(parts),
    type,
    ...(def ? { blueprint: def.id } : {}),
    parts,
    paid,
    state: rowState,
  };
}

export function RecipeBook({
  state,
  hiker,
  readOnly = false,
  picked,
  onPick,
  onDispatch,
}: {
  state: GameState;
  hiker: Hiker;
  readOnly?: boolean;
  /** The row the bench is making. */
  picked?: string | null;
  onPick?(row: { key: string; type: ItemTypeName; blueprint?: string }): void;
  /** Stars go through the game (they're saved with the hike). */
  onDispatch(action: Action): void;
}) {
  const [tab, setTab] = useState<BookTab>(state.starred?.recipes.length ? 'starred' : 'tool');
  const starredRecipes = state.starred?.recipes ?? [];
  const starredResources = state.starred?.resources ?? [];
  const star = (what: 'recipe' | 'resource', id: string, on: boolean) => {
    sfx(on ? 'ui.star' : 'ui.unstar');
    onDispatch({ type: 'star', what, id, on });
  };
  const turn = (t: BookTab) => {
    if (t === tab) return;
    sfx('book.page');
    setTab(t);
  };

  const left: Row[] =
    tab === 'starred'
      ? starredRecipes
          .flatMap((k) => rowFor(state, hiker, k) ?? [])
          .sort((a, b) => missing(a) - missing(b))
      : TIERS.flatMap((t) => rowFor(state, hiker, basicKey(tab, t)) ?? []);
  const right: Row[] =
    tab === 'starred'
      ? []
      : (hiker.blueprints ?? [])
          .filter((id) => ITEMS[id]?.type === tab)
          .flatMap((id) => rowFor(state, hiker, blueprintKey(id)) ?? []);
  const tier = tab === 'starred' ? 0 : craftTier(state, hiker, tab);

  const row = (r: Row) => {
    const miss = missing(r);
    const canPick = !readOnly && r.state === 'open' && !!onPick;
    return (
      <div
        key={r.key}
        className={styles.row}
        data-state={r.state}
        data-picked={picked === r.key || undefined}
        style={{ '--tc': TYPE_LOOK[r.type].accent } as CSSProperties}
      >
        <button
          type="button"
          className={styles.star}
          aria-pressed={starredRecipes.includes(r.key)}
          aria-label={`${starredRecipes.includes(r.key) ? 'Unstar' : 'Star'} ${r.name}`}
          data-sound="none"
          onClick={() => star('recipe', r.key, !starredRecipes.includes(r.key))}
        >
          <Icon name="star" size={18} strokeWidth={2} solid={starredRecipes.includes(r.key)} />
        </button>
        <button
          type="button"
          className={styles.pick}
          disabled={!canPick}
          aria-label={`${r.name}: ${r.state === 'locked' ? 'locked' : miss ? `needs ${miss}` : 'ready'}. ${
            canPick ? 'Fill the bench' : ''
          }`}
          onClick={() =>
            canPick &&
            onPick?.({
              key: r.key,
              type: r.type,
              ...(r.blueprint ? { blueprint: r.blueprint } : {}),
            })
          }
        >
          <span className={styles.icon} data-basic={!r.blueprint || undefined}>
            {r.blueprint ? (
              <img src={ASSETS.itemArt(ITEMS[r.blueprint]?.art ?? r.blueprint)} alt="" />
            ) : (
              <Icon name={TYPE_ICON[r.type]} size={20} color="#fff" />
            )}
          </span>
          <span className={styles.words}>
            <span className={styles.name}>{r.blueprint ? r.name : r.name.toUpperCase()}</span>
            <small>{r.sub}</small>
            {r.state !== 'locked' && <Tokens parts={r.parts} paid={r.paid} />}
          </span>
          <span className={styles.status} data-ok={r.state === 'open' && !miss ? true : undefined}>
            {r.state === 'locked'
              ? 'LOCKED'
              : r.state === 'past'
                ? ''
                : miss
                  ? `NEEDS ${miss}`
                  : '✓ READY'}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className={styles.book} data-read-only={readOnly || undefined}>
      <div className={styles.tabs} role="tablist" aria-label="Recipe book">
        {(['starred', ...CRAFT_TYPES] as BookTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === t}
            data-sound="none"
            style={{ '--tc': t === 'starred' ? '#C98D16' : TYPE_LOOK[t].accent } as CSSProperties}
            onClick={() => turn(t)}
          >
            <Icon name={t === 'starred' ? 'star' : TYPE_ICON[t]} size={14} strokeWidth={2.5} />
            {t === 'starred' ? 'STARRED' : TAB_NAME[t]}
          </button>
        ))}
      </div>
      {tab !== 'starred' && !readOnly && (
        <div className={styles.tiers} aria-label={`Crafter tier ${ROMAN[tier - 1]}`}>
          {TIERS.map((t) => (
            <span key={t} data-on={t <= tier || undefined}>
              TIER {ROMAN[t - 1]}
            </span>
          ))}
        </div>
      )}
      <div className={styles.pages}>
        <div className={styles.page}>
          {tab === 'starred' ? (
            <>
              <h5>
                STARRED RECIPES <span>ready first</span>
              </h5>
              {left.length ? (
                left.map(row)
              ) : (
                <p className={styles.empty}>
                  Star a recipe with ☆ to keep it here and on the scavenge screen.
                </p>
              )}
            </>
          ) : (
            <>
              <h5>
                BASIC RECIPES <span>pick 1 of a deal</span>
              </h5>
              {left.map(row)}
            </>
          )}
        </div>
        <div className={styles.page}>
          {tab === 'starred' ? (
            <>
              <h5>
                STARRED RESOURCES <span>where to find them</span>
              </h5>
              {starredResources.length ? (
                starredResources.map((id) => {
                  const res = RESOURCES.find((r) => r.id === id);
                  if (!res) return null;
                  return (
                    <div key={id} className={styles.row}>
                      <button
                        type="button"
                        className={styles.star}
                        aria-pressed
                        aria-label={`Unstar ${res.name}`}
                        data-sound="none"
                        onClick={() => star('resource', id, false)}
                      >
                        <Icon name="star" size={18} strokeWidth={2} solid />
                      </button>
                      <span className={styles.pick}>
                        <span className={styles.icon}>
                          <img src={ASSETS.resources[id]} alt="" />
                        </span>
                        <span className={styles.words}>
                          <span className={styles.name}>{res.name}</span>
                          <small>
                            {NODE_NAME[res.node]} nodes · {hiker.name} has{' '}
                            {hiker.inventory.resources[id] ?? 0}
                          </small>
                        </span>
                        <img
                          className={styles.node}
                          src={NODE_IMAGE[res.node]}
                          alt={NODE_NAME[res.node]}
                        />
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className={styles.empty}>
                  Star resources in the tray to save them from auto-fill and spot them while
                  scavenging.
                </p>
              )}
            </>
          ) : (
            <>
              <h5>
                BLUEPRINTS <span>you get exactly this</span>
              </h5>
              {right.length ? (
                right.map(row)
              ) : (
                <p className={styles.empty}>
                  No {TAB_NAME[tab].toLowerCase()} blueprints yet. Find them while scavenging, or
                  have someone teach you.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {readOnly && <span className={styles.readOnly}>Read only while scavenging</span>}
    </div>
  );
}

const missing = (r: Row) => r.paid.filter((p) => !p).length;

/** The cost as small cards: filled where the party has it, dashed red where it's missing. */
export function Tokens({ parts, paid }: { parts: Recipe; paid: readonly boolean[] }) {
  const spaces = spaceParts(parts);
  return (
    <span className={styles.tokens}>
      {spaces.map((p, k) => {
        const part = parts[p];
        const id = part?.ids?.[0];
        return (
          <span
            key={k}
            className={styles.token}
            data-missing={!paid[k] || undefined}
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
  );
}
