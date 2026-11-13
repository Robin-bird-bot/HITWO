/**
 * #mockup-crafting (dev, or the live site with ?debug): the Craft window, for
 * Wyatt to approve before crafting is built (Phase 8 step 6). Nothing here is
 * wired to the game: sample hikers and resources, with the real item data,
 * cards, icons and styles.
 *
 * It shows:
 * - the Craft window, opened from the Craft action: a tab for each type with
 *   its basic recipe, the crafter's blueprints, the resources on the tile
 *   (pooled), which resources a recipe would take, and the tier;
 * - the pick step: 3 face-down cards that flip, then take one (Quality shown);
 * - teaching a blueprint to a hiker on the tile, for Morale;
 * - Simple mode (fewer words) and the window at phone-landscape size.
 */
import { useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import { characterFor } from '../../content/characters';
import { RESOURCES } from '../../content/resources';
import type { ItemType, NodeType, Recipe, RecipePart, ResourceId } from '../../engine';
import { Backdrop } from '../backdrop/Backdrop';
import { Icon } from '../icons/Icon';
import { ItemCard } from '../items/ItemCard';
import { TYPE_LOOK } from '../items/itemLook';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { ItemBack } from '../scavenge/ItemBack';
import { Stage } from '../stage/Stage';
import styles from './CraftingMockup.module.css';

// ── Sample data ─────────────────────────────────────────────────────────────

interface SampleHiker {
  id: string;
  name: string;
  morale: number;
  resources: Partial<Record<ResourceId, number>>;
  /** Blueprints this hiker knows. */
  knows: string[];
}

/** Hiker 1 crafts; Hiker 2 is on the same tile. */
const HIKERS: SampleHiker[] = [
  {
    id: 'hiker-1',
    name: 'Hiker 1',
    morale: 8,
    resources: { wood: 2, moss: 1, fish: 1, shell: 1, fur: 1 },
    knows: ['shovel', 'woodcuttingAxe', 'swissArmyKnife', 'pajamas', 'trailMix', 'tent'],
  },
  {
    id: 'hiker-2',
    name: 'Hiker 2',
    morale: 6,
    resources: { stone: 2, metal: 2, flint: 1, fur: 2, meat: 2, mushroom: 1 },
    knows: ['tent'],
  },
];
const CRAFTER = HIKERS[0] as SampleHiker;
/** The crafter's tier for every type (the workbench raises it in Phase 9). */
const CRAFT_TIER = 1;

const TYPES: ItemType[] = ['tool', 'clothes', 'food', 'shelter', 'trinket'];
const TYPE_ICON: Record<ItemType, 'hammer' | 'shirt' | 'utensils' | 'tent' | 'sparkles'> = {
  tool: 'hammer',
  clothes: 'shirt',
  food: 'utensils',
  shelter: 'tent',
  trinket: 'sparkles',
};

/** The basic recipes (03-items.md, "Basic recipes"), at Tier 1. */
const BASIC: Record<ItemType, { recipe: Recipe; words: string }> = {
  tool: {
    recipe: [
      { n: 2, ids: ['metal', 'wood'] },
      { n: 3, nodes: ['mountain', 'forest'] },
    ],
    words: '2 Metal or Wood, plus 3 Mountain or Forest resources (any mix).',
  },
  clothes: {
    recipe: [
      { n: 2, ids: ['fur', 'moss'] },
      { n: 3, nodes: ['wildlife', 'forest'] },
    ],
    words: '2 Fur or Moss, plus 3 Wildlife or Forest resources (any mix).',
  },
  food: {
    recipe: [
      { n: 2, ids: ['fish', 'meat', 'mushroom'] },
      { n: 2, nodes: ['forest', 'river'] },
    ],
    words: '2 Fish, Meat or Mushroom, plus 2 Forest or River resources (any mix).',
  },
  shelter: {
    recipe: [
      { n: 3, ids: ['wood', 'stone'] },
      { n: 3, any: true },
    ],
    words: '3 Wood or Stone, plus 3 resources of any kind.',
  },
  trinket: {
    // A new 5 is picked after every trinket.
    recipe: ['shell', 'flint', 'moss', 'meat', 'clay'].map((id) => ({
      n: 1,
      ids: [id as ResourceId],
    })),
    words: '5 different resources, picked at random. A new 5 after every trinket.',
  },
};

type Dealt = { itemId: string; quality?: 1 | 2 | 3 | 4 | 5 };

/** What the 3 face-down cards turn out to be (one is a Tier II: the 10% chance). */
const DEALT: Record<ItemType, Dealt[]> = {
  tool: [
    { itemId: 'trowel', quality: 4 },
    { itemId: 'wheelbarrow', quality: 2 },
    { itemId: 'fishingRod', quality: 3 },
  ],
  clothes: [
    { itemId: 'plainShirt', quality: 3 },
    { itemId: 'flannel', quality: 4 },
    { itemId: 'rainJacket', quality: 2 },
  ],
  food: [
    { itemId: 'pelmeni', quality: 3 },
    { itemId: 'khachapuri', quality: 5 },
    { itemId: 'trailMix', quality: 1 },
  ],
  shelter: [{ itemId: 'hammock' }, { itemId: 'cabin' }, { itemId: 'tent' }],
  trinket: [{ itemId: 'postcard' }, { itemId: 'wallet' }, { itemId: 'textbook' }],
};

const TEACH_COST: Record<number, number> = { 1: 4, 2: 6, 3: 8 };

// ── Paying: which resources fill a recipe ───────────────────────────────────

interface Filled {
  id: ResourceId | null;
  from: string | null;
}

const nodeOf = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.node;
const resName = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.name ?? id;

/**
 * Fills each part of a recipe from the pool: the crafter's own resources
 * first, then the others on the tile. A key part ("2 Metal or Wood") takes 2
 * of the same one: the crafter's own if they have enough, else whichever the
 * tile has more of.
 */
function fill(recipe: Recipe, hikers: SampleHiker[]): Filled[][] {
  const left = hikers.map((h) => ({ id: h.id, res: { ...h.resources } }));
  const total = (id: ResourceId) => left.reduce((n, h) => n + (h.res[id] ?? 0), 0);
  const own = (id: ResourceId) => left[0]?.res[id] ?? 0;
  const takeOne = (ok: (id: ResourceId) => boolean): Filled => {
    for (const h of left) {
      const ids = (Object.keys(h.res) as ResourceId[])
        .filter((id) => ok(id) && (h.res[id] ?? 0) > 0)
        .sort((a, b) => (h.res[b] ?? 0) - (h.res[a] ?? 0));
      const id = ids[0];
      if (id) {
        h.res[id] = (h.res[id] ?? 0) - 1;
        return { id, from: h.id };
      }
    }
    return { id: null, from: null };
  };
  return recipe.map((part) => {
    if (part.ids) {
      // The crafter's own key resource first, then whichever the tile has more of.
      const enough = part.ids.filter((id) => total(id) >= part.n);
      const best = [...(enough.length ? enough : part.ids)].sort(
        (a, b) => Math.min(own(b), part.n) - Math.min(own(a), part.n) || total(b) - total(a),
      )[0];
      return Array.from({ length: part.n }, () => takeOne((id) => id === best));
    }
    const ok = (id: ResourceId) => part.any || (part.nodes ?? []).includes(nodeOf(id) as NodeType);
    return Array.from({ length: part.n }, () => takeOne(ok));
  });
}

/** "2 METAL OR WOOD", "3 MOUNTAIN · FOREST", "2 ANY". */
function partLabel(part: RecipePart): string {
  if (part.ids) return `${part.n} ${part.ids.map(resName).join(' or ')}`.toUpperCase();
  if (part.any) return `${part.n} ANY`;
  return `${part.n} ${(part.nodes ?? []).map((n) => NODE_NAME[n]).join(' · ')}`.toUpperCase();
}

const missingOf = (slots: Filled[][]) => slots.flat().filter((s) => !s.id).length;

/** What each hiker pays: { 'hiker-1': { wood: 2 } }. */
function paidBy(slots: Filled[][]): Record<string, Partial<Record<ResourceId, number>>> {
  const out: Record<string, Partial<Record<ResourceId, number>>> = {};
  for (const s of slots.flat()) {
    if (!s.id || !s.from) continue;
    const mine = (out[s.from] ??= {});
    mine[s.id] = (mine[s.id] ?? 0) + 1;
  }
  return out;
}

// ── The page ────────────────────────────────────────────────────────────────

type View = 'craft' | 'pick' | 'teach';

export function CraftingMockup() {
  const [view, setView] = useState<View>('craft');
  const [simple, setSimple] = useState(false);
  const [phone, setPhone] = useState(false);

  const scene = <Scene view={view} simple={simple} onView={setView} />;
  return (
    <Stage>
      <div className={styles.page}>
        <header className={styles.bar}>
          <h1 className={styles.title}>CRAFTING · A MOCKUP TO APPROVE</h1>
          <nav className={styles.views} aria-label="Mockup views">
            {(
              [
                ['craft', 'Craft'],
                ['pick', 'Pick a card'],
                ['teach', 'Teach'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={styles.view}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
            <span className={styles.gap} />
            <button
              type="button"
              className={styles.view}
              aria-pressed={simple}
              onClick={() => setSimple((s) => !s)}
            >
              Simple mode
            </button>
            <button
              type="button"
              className={styles.view}
              aria-pressed={phone}
              onClick={() => setPhone((p) => !p)}
            >
              Phone size
            </button>
          </nav>
        </header>
        {phone ? (
          <div className={styles.phoneWrap}>
            <div className={styles.phone}>
              <div className={styles.phoneScreen}>{scene}</div>
            </div>
            <p className={styles.phoneNote}>
              The whole game screen shrunk to fit a phone held sideways (844 × 390), the way every
              window in the game shrinks today: to about 40%, so a 44 px button ends up about 17 px.
              A real phone layout would be its own piece of work.
            </p>
          </div>
        ) : (
          <div className={styles.sceneWrap}>{scene}</div>
        )}
      </div>
    </Stage>
  );
}

/** The game behind, dimmed, with the window over it and Wyatt's questions beside it. */
function Scene({ view, simple, onView }: { view: View; simple: boolean; onView(v: View): void }) {
  return (
    <div className={styles.scene}>
      <Backdrop phase="afternoon" biome="meadow" />
      <div className={styles.dim} />
      <Notes />
      <CraftWindow view={view} simple={simple} onView={onView} />
    </div>
  );
}

function Notes() {
  return (
    <aside className={styles.notes}>
      <span className={styles.notesHead}>HOW IT WORKS</span>
      <ul>
        <li>Craft is a new action button. It uses the crafter’s action for the phase.</li>
        <li>
          The spaces fill themselves from the crafter’s resources first, then from others on the
          tile. Tap a space to swap what goes in.
        </li>
        <li>A basic recipe deals 3 face-down cards; each has a 10% chance to be a tier higher.</li>
        <li>Crafting an item teaches its blueprint. A blueprint makes exactly that item.</li>
        <li>Blueprints above the crafter’s tier stay locked until the workbench (Phase 9).</li>
      </ul>
    </aside>
  );
}

// ── The window ──────────────────────────────────────────────────────────────

function Face({ id, size }: { id: string; size: number }) {
  return (
    <img
      className={styles.face}
      src={ASSETS.portraits.placeholder}
      alt=""
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${characterFor(id).color}` }}
    />
  );
}

function CraftWindow({
  view,
  simple,
  onView,
}: {
  view: View;
  simple: boolean;
  onView(v: View): void;
}) {
  const [type, setType] = useState<ItemType>('tool');
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const look = TYPE_LOOK[type];
  const teaching = view === 'teach';

  return (
    <section
      className={styles.window}
      style={{ '--accent': look.accent } as CSSProperties}
      aria-label="Craft"
    >
      <header className={styles.head}>
        <h2 className={styles.windowTitle}>{teaching ? 'TEACH' : 'CRAFT'}</h2>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={!teaching}
            onClick={() => onView('craft')}
          >
            <Icon name="hammer" size={16} /> CRAFT
          </button>
          <button
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={teaching}
            onClick={() => onView('teach')}
          >
            <Icon name="book" size={16} /> TEACH
          </button>
        </div>
        <span className={styles.crafter}>
          <Face id={CRAFTER.id} size={34} />
          <span className={styles.crafterName}>{CRAFTER.name.toUpperCase()}</span>
        </span>
        <button type="button" className={styles.close} aria-label="Close">
          <Icon name="x" size={20} />
        </button>
      </header>
      <div className={styles.kindBar}>
        <span>
          {teaching
            ? 'BLUEPRINTS · A FREE ACTION, PAID IN MORALE'
            : `WORKBENCH · USES ${CRAFTER.name.toUpperCase()}’S ACTION`}
        </span>
        <span className={styles.kindRight}>
          <Icon name="users" size={15} /> 2 HIKERS ON THIS TILE
        </span>
      </div>

      {view === 'teach' ? (
        <TeachBody simple={simple} />
      ) : view === 'pick' ? (
        <PickBody key={type} simple={simple} type={type} />
      ) : (
        <CraftBody
          simple={simple}
          type={type}
          blueprint={blueprint}
          onType={(t) => {
            setType(t);
            setBlueprint(null);
          }}
          onBlueprint={setBlueprint}
          onCraft={() => onView('pick')}
        />
      )}
    </section>
  );
}

// ── Craft ───────────────────────────────────────────────────────────────────

function CraftBody({
  simple,
  type,
  blueprint,
  onType,
  onBlueprint,
  onCraft,
}: {
  simple: boolean;
  type: ItemType;
  blueprint: string | null;
  onType(t: ItemType): void;
  onBlueprint(id: string | null): void;
  onCraft(): void;
}) {
  const bp = blueprint ? ITEMS[blueprint] : undefined;
  const recipe = bp?.recipe ?? BASIC[type].recipe;
  const slots = fill(recipe, HIKERS);
  const missing = missingOf(slots);
  const paid = paidBy(slots);
  const known = CRAFTER.knows.filter((id) => ITEMS[id]?.type === type);
  const typeName = TYPE_LOOK[type].label;
  const plural = type === 'clothes' ? 'clothes' : `${typeName.toLowerCase()}s`;

  return (
    <>
      <div className={styles.body}>
        <nav className={styles.types} aria-label="Item types">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={styles.type}
              aria-pressed={t === type}
              style={{ '--type': TYPE_LOOK[t].accent } as CSSProperties}
              onClick={() => onType(t)}
            >
              <Icon name={TYPE_ICON[t]} size={20} />
              <span className={styles.typeName}>{TYPE_LOOK[t].label.toUpperCase()}</span>
              <span className={styles.typeTier}>TIER I</span>
            </button>
          ))}
        </nav>

        <div className={styles.main}>
          <div className={styles.recipeHead}>
            <span className={styles.label}>
              {bp
                ? `BLUEPRINT · EXACTLY A ${bp.name.toUpperCase()}`
                : `BASIC RECIPE · PICK 1 OF 3 ${plural.toUpperCase()}`}
            </span>
            <TierChips />
          </div>
          {!simple && (
            <p className={styles.words}>
              {bp
                ? `Costs more than the basic recipe, and makes exactly this item. ${recipeWords(recipe)}.`
                : BASIC[type].words}
            </p>
          )}

          <div className={styles.spaces}>
            {recipe.map((part, i) => (
              <div key={i} className={styles.part}>
                {i > 0 && <span className={styles.plus}>+</span>}
                <div className={styles.partBox}>
                  <div className={styles.partSlots}>
                    {(slots[i] ?? []).map((s, j) => (
                      <Slot key={j} filled={s} />
                    ))}
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
          {!simple && (
            <p className={styles.hint}>
              Filled from {CRAFTER.name}’s resources first, then {HIKERS[1]?.name}’s. Tap a space to
              swap what goes in.
            </p>
          )}

          <div className={styles.recipeHead}>
            <span className={styles.label}>
              {CRAFTER.name.toUpperCase()}’S {typeName.toUpperCase()} BLUEPRINTS · {known.length}
            </span>
            {bp && (
              <button type="button" className={styles.linkish} onClick={() => onBlueprint(null)}>
                Back to the basic recipe
              </button>
            )}
          </div>
          <div className={styles.blueprints}>
            {known.length === 0 && (
              <p className={styles.none}>
                {simple
                  ? 'None yet.'
                  : `None yet. Crafting a ${typeName.toLowerCase()} teaches its blueprint.`}
              </p>
            )}
            {known.map((id) => (
              <Blueprint
                key={id}
                itemId={id}
                selected={id === blueprint}
                simple={simple}
                onPick={() => onBlueprint(id === blueprint ? null : id)}
              />
            ))}
            {type === 'tool' && <PackRow simple={simple} />}
          </div>
        </div>

        <Pool paid={paid} simple={simple} />
      </div>

      <footer className={styles.foot}>
        <span className={styles.summary}>
          {missing > 0
            ? `Needs ${missing} more resource${missing === 1 ? '' : 's'} on this tile.`
            : simple
              ? `−${recipe.reduce((n, p) => n + p.n, 0)} resources`
              : payWords(paid)}
        </span>
        <button type="button" className={styles.go} disabled={missing > 0} onClick={onCraft}>
          {bp ? `CRAFT A ${bp.name.toUpperCase()}` : `CRAFT · PICK 1 OF 3`}
        </button>
      </footer>
    </>
  );
}

/** "Metal 2, Wood 2, any 2". */
function recipeWords(recipe: Recipe): string {
  return recipe
    .map((p) =>
      p.ids
        ? `${p.ids.map(resName).join(' or ')} ${p.n}`
        : p.any
          ? `any ${p.n}`
          : `${(p.nodes ?? []).map((n) => NODE_NAME[n]).join(' or ')} ${p.n}`,
    )
    .join(', ');
}

/** "Hiker 1 pays 2 Wood, 2 Moss, 1 Grass · Hiker 2 adds 1 Stone". */
function payWords(paid: ReturnType<typeof paidBy>): string {
  return HIKERS.filter((h) => paid[h.id])
    .map((h, i) => {
      const what = Object.entries(paid[h.id] ?? {})
        .map(([id, n]) => `${n} ${resName(id as ResourceId)}`)
        .join(', ');
      return `${h.name} ${i === 0 ? 'pays' : 'adds'} ${what}`;
    })
    .join(' · ');
}

function TierChips() {
  return (
    <span className={styles.tiers}>
      {[1, 2, 3].map((t) => (
        <span
          key={t}
          className={styles.tierChip}
          data-on={t === CRAFT_TIER}
          title={
            t === CRAFT_TIER
              ? `Crafting at Tier ${'I'.repeat(t)}`
              : `Tier ${'I'.repeat(t)}: unlocked at a ranger station’s workbench (Phase 9)`
          }
        >
          {t !== CRAFT_TIER && <Icon name="x" size={11} strokeWidth={3} />}
          TIER {'I'.repeat(t)}
        </span>
      ))}
    </span>
  );
}

function PartIcons({ part }: { part: RecipePart }) {
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

function Slot({ filled }: { filled: Filled }) {
  if (!filled.id) return <span className={styles.slot} data-empty />;
  return (
    <span className={styles.slot} title={`${resName(filled.id)}, from ${filled.from}`}>
      <img src={ASSETS.resources[filled.id]} alt={resName(filled.id)} width={40} height={40} />
      {filled.from && (
        <span
          className={styles.slotWho}
          style={{ background: characterFor(filled.from).color }}
          aria-hidden
        />
      )}
    </span>
  );
}

/** A blueprint, drawn on blue grid paper like the station mockup. */
function Blueprint({
  itemId,
  selected,
  simple,
  teach = false,
  onPick,
}: {
  itemId: string;
  selected: boolean;
  simple: boolean;
  /** On the Teach tab: any blueprint can be taught; it shows its Morale cost. */
  teach?: boolean;
  onPick(): void;
}) {
  const def = ITEMS[itemId];
  if (!def) return null;
  const locked = !teach && def.tier > CRAFT_TIER;
  const missing = def.recipe ? missingOf(fill(def.recipe, HIKERS)) : 0;
  const status = teach
    ? `TIER ${'I'.repeat(def.tier)} · ${TEACH_COST[def.tier] ?? 4} MORALE`
    : locked
      ? `TIER ${'I'.repeat(def.tier)} · LOCKED`
      : missing
        ? `NEEDS ${missing} MORE`
        : 'READY';
  return (
    <button
      type="button"
      className={styles.blueprint}
      aria-pressed={selected}
      disabled={locked}
      title={
        locked
          ? `${def.name}: a Tier ${'I'.repeat(def.tier)} blueprint. The workbench at a ranger station raises ${CRAFTER.name}’s tool tier (Phase 9).`
          : `${def.name}: ${def.recipe ? recipeWords(def.recipe) : ''}`
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
      {!simple && def.recipe && <span className={styles.bpRecipe}>{recipeWords(def.recipe)}</span>}
      <span
        className={styles.bpStatus}
        data-status={teach ? 'teach' : locked ? 'locked' : missing ? 'short' : 'ready'}
      >
        {status}
      </span>
    </button>
  );
}

/** Resource packs: always on the Tool tab, a way to swap 5 unwanted resources. */
function PackRow({ simple }: { simple: boolean }) {
  return (
    <div className={styles.packs}>
      <span className={styles.packsHead}>SWAP · RESOURCE PACKS</span>
      {!simple && (
        <span className={styles.packsWords}>
          5 of a node’s resources (any 5 for the Resource Pack) → a pack that gives 3–5 random ones
          back.
        </span>
      )}
      <span className={styles.packIcons}>
        {(['forest', 'river', 'wildlife', 'mountain'] as NodeType[]).map((n) => (
          <span key={n} className={styles.packIcon} title={`${NODE_NAME[n]} Pack`}>
            <img src={NODE_IMAGE[n]} alt="" width={22} height={25} />
          </span>
        ))}
        <span className={styles.packIcon} title="Resource Pack">
          <Icon name="sparkles" size={18} />
        </span>
      </span>
    </div>
  );
}

/** Everyone's resources on the tile, with what this recipe would take marked. */
function Pool({ paid, simple }: { paid: ReturnType<typeof paidBy>; simple: boolean }) {
  return (
    <aside className={styles.pool} aria-label="Resources on this tile">
      <span className={styles.label}>ON THIS TILE · POOLED</span>
      {HIKERS.map((h, i) => (
        <div key={h.id} className={styles.pack}>
          <span className={styles.packWho}>
            <Face id={h.id} size={26} />
            {h.name.toUpperCase()}
            {i === 0 && <span className={styles.crafts}>CRAFTS</span>}
          </span>
          <div className={styles.res}>
            {(Object.entries(h.resources) as [ResourceId, number][]).map(([id, n]) => {
              const used = paid[h.id]?.[id] ?? 0;
              return (
                <span key={id} className={styles.resTile} data-used={used > 0}>
                  <img src={ASSETS.resources[id]} alt={resName(id)} width={34} height={34} />
                  <span className={styles.resCount}>{n}</span>
                  {used > 0 && <span className={styles.resUsed}>−{used}</span>}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {!simple && (
        <p className={styles.poolNote}>
          Gold outlines are what the recipe takes. Each hiker’s own pack shows what they’ll have
          left.
        </p>
      )}
    </aside>
  );
}

// ── Pick ────────────────────────────────────────────────────────────────────

function PickBody({ simple, type }: { simple: boolean; type: ItemType }) {
  const [flipped, setFlipped] = useState<boolean[]>([false, false, false]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [taken, setTaken] = useState(false);
  const allUp = flipped.every(Boolean);
  const cards = DEALT[type];
  const pick = chosen !== null ? cards[chosen] : undefined;
  const plural = type === 'clothes' ? 'CLOTHES' : `${TYPE_LOOK[type].label.toUpperCase()}S`;
  const quality = (c: Dealt) => (c.quality ? ` · Quality ${c.quality}` : '');

  return (
    <>
      <div className={styles.pickBody}>
        <span className={styles.label}>PICK 1 OF 3 · TIER I {plural}</span>
        {!simple && (
          <p className={styles.words}>
            Tap a card to turn it over. Each one’s Quality was rolled with {CRAFTER.name}’s Luck,
            and any card can come up a tier higher.
          </p>
        )}
        <Odds simple={simple} />
        <div className={styles.cards}>
          {cards.map((c, i) => {
            const up = flipped[i];
            const higher = (ITEMS[c.itemId]?.tier ?? 1) > CRAFT_TIER;
            return (
              <button
                key={c.itemId}
                type="button"
                className={styles.card}
                data-up={up}
                aria-pressed={chosen === i}
                aria-label={up ? `${ITEMS[c.itemId]?.name}${quality(c)}` : 'Face down'}
                onClick={() => {
                  if (!up) setFlipped((f) => f.map((x, j) => (j === i ? true : x)));
                  else setChosen(i);
                }}
              >
                <span className={styles.flip}>
                  <span className={styles.back}>
                    <ItemBack type={type} width={220} />
                  </span>
                  <span className={styles.front}>
                    <ItemCard
                      itemId={c.itemId}
                      {...(c.quality ? { item: { quality: c.quality } } : {})}
                      width={220}
                    />
                  </span>
                </span>
                {up && higher && <span className={styles.higher}>A TIER HIGHER!</span>}
              </button>
            );
          })}
        </div>
        {taken && pick && (
          <p className={styles.learned}>
            <Icon name="book" size={16} /> {CRAFTER.name} took the {ITEMS[pick.itemId]?.name}
            {pick.quality ? ` (Quality ${pick.quality})` : ''} and learned its blueprint.
          </p>
        )}
      </div>
      <footer className={styles.foot}>
        <span className={styles.summary}>
          {!allUp
            ? 'Turn the cards over, one at a time or all at once.'
            : pick
              ? `${ITEMS[pick.itemId]?.name}${quality(pick)}`
              : 'Pick the one to keep.'}
        </span>
        {!allUp && (
          <button
            type="button"
            className={styles.second}
            onClick={() => setFlipped([true, true, true])}
          >
            Flip all
          </button>
        )}
        <button
          type="button"
          className={styles.go}
          disabled={!pick || taken}
          onClick={() => setTaken(true)}
        >
          {pick ? `TAKE THE ${(ITEMS[pick.itemId]?.name ?? '').toUpperCase()}` : 'PICK A CARD'}
        </button>
      </footer>
    </>
  );
}

/** The Quality odds with the crafter's Luck: a little bar of 5 diamonds. */
function Odds({ simple }: { simple: boolean }) {
  const odds = [7, 17, 40, 22, 14];
  return (
    <div className={styles.odds} aria-label="Quality odds">
      {!simple && <span className={styles.oddsWord}>LUCK +1 · QUALITY ODDS</span>}
      {odds.map((p, i) => (
        <span key={i} className={styles.odd}>
          <span className={styles.diamonds}>{'◆'.repeat(i + 1)}</span>
          <span className={styles.oddPct}>{p}%</span>
        </span>
      ))}
    </div>
  );
}

// ── Teach ───────────────────────────────────────────────────────────────────

function TeachBody({ simple }: { simple: boolean }) {
  const [bp, setBp] = useState('shovel');
  const [to, setTo] = useState<string | null>(null);
  const def = ITEMS[bp];
  const cost = TEACH_COST[def?.tier ?? 1] ?? 4;
  const student = HIKERS.find((h) => h.id === to);

  return (
    <>
      <div className={styles.teachBody}>
        <div className={styles.teachFrom}>
          <span className={styles.label}>{CRAFTER.name.toUpperCase()} KNOWS</span>
          <div className={styles.blueprints}>
            {CRAFTER.knows.map((id) => (
              <Blueprint
                key={id}
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
          <span className={styles.label}>TEACH THE {def?.name.toUpperCase()} TO</span>
          {!simple && (
            <p className={styles.words}>
              A hiker on this tile. Teaching costs the teacher Morale: 4 for Tier I, 6 for Tier II,
              8 for Tier III.
            </p>
          )}
          {HIKERS.slice(1).map((h) => {
            const knows = h.knows.includes(bp);
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
                  {knows
                    ? 'Already knows it'
                    : `Knows ${h.knows.length} blueprint${h.knows.length === 1 ? '' : 's'}`}
                </span>
              </button>
            );
          })}
          <div className={styles.cost}>
            <Icon name="heart" size={18} />
            <span>
              {CRAFTER.name}’s Morale {CRAFTER.morale} → <b>{CRAFTER.morale - cost}</b>
            </span>
          </div>
          {def && (
            <div className={styles.teachCard}>
              <ItemCard itemId={def.id} width={150} />
            </div>
          )}
        </div>
      </div>
      <footer className={styles.foot}>
        <span className={styles.summary}>
          {student
            ? `${student.name} learns the ${def?.name} blueprint · ${CRAFTER.name} −${cost} Morale`
            : 'Pick who to teach.'}
        </span>
        <button type="button" className={styles.go} disabled={!student}>
          TEACH · −{cost} MORALE
        </button>
      </footer>
    </>
  );
}
