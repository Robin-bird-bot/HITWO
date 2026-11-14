/**
 * #mockup-station-extras (dev, or the live site with ?debug): the station's
 * Workbench tab, Preview Next Trail, and the trail's Merchant and Traveling
 * Trader, for Wyatt to approve before they're built (Phase 9 step 4). Nothing
 * here changes a game: it's a sample hike at Bea-R-E-I's station, set up by the
 * engine, drawn with the real room, packs, map, cards and styles.
 *
 * Views:
 * - Workbench: type tabs with the tier one higher, the basic recipe paid from
 *   everyone's packs, blueprints (the visit's free ones marked), the pool.
 * - Pick: the 3 face-down cards on the counter, turning over.
 * - Cement Mixer and Scout Report: Preview Next Trail, picking a line or tiles.
 * - Merchant and Trader: the windows a trail tile's side feature opens.
 */
import { useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import { characterFor, STARTING_PARTY } from '../../content/characters';
import { RESOURCES } from '../../content/resources';
import { STATION_THEME_BY_ID } from '../../content/stations';
import {
  applyAction,
  autoPay,
  craftRecipe,
  createGame,
  type GameState,
  type ItemType,
  type Recipe,
  type RecipePart,
} from '../../engine';
import { Backdrop } from '../backdrop/Backdrop';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { ItemCard } from '../items/ItemCard';
import { TYPE_LOOK } from '../items/itemLook';
import {
  clampCamera,
  lastRowOf,
  mapBounds,
  MAP_VIEW,
  tileCenter,
  type Camera,
} from '../map/mapLayout';
import { MapView } from '../map/MapView';
import { ItemBack } from '../scavenge/ItemBack';
import { Stage } from '../stage/Stage';
import counter from '../station/Counter.module.css';
import { Packs } from '../station/Packs';
import { KeeperArm, StationRoom } from '../station/StationRoom';
import room from '../station/StationScreen.module.css';
import { aheadChips } from '../station/stationTalk';
import styles from './StationExtrasMockup.module.css';

type View = 'workbench' | 'pick' | 'mixer' | 'scout' | 'merchant' | 'trader';

const VIEWS: readonly [View, string][] = [
  ['workbench', 'Workbench'],
  ['pick', 'Pick a card'],
  ['mixer', 'Cement Mixer'],
  ['scout', 'Scout Report'],
  ['merchant', 'Merchant'],
  ['trader', 'Trader'],
];

const NOTES: Record<View, string[]> = {
  workbench: [
    'The Workbench is a tab on the counter, beside the Shop.',
    'Everyone crafts one tier higher here (Tier I hikers make Tier II), and it costs no action.',
    'Every pack is shared: recipes pay from the crafter first, then everyone else.',
    'The visit’s 3 free blueprints are marked FREE HERE. Craft one to keep it; the rest leave with the station.',
    'Blueprints still above the Workbench’s tier show a lock.',
  ],
  pick: [
    'A basic recipe deals 3 face-down cards on the counter, like the Craft window.',
    'Turn them over one at a time or all at once, then take one.',
    'Quality rolls with the crafter’s Luck, as it does on the trail.',
  ],
  mixer: [
    'Preview Next Trail opens the next biome’s map as seen from its Trailhead: its shape, special spaces and the nodes already showing.',
    'Buying the Cement Mixer opens it to pick a line: each line that can be paved gets a gold button.',
    'Steep, Muddy and Rough lines become normal; a normal line becomes Paved.',
    'Drag to look around, as on the trail.',
  ],
  scout: [
    'The Scout Report picks up to 3 tiles on the next biome’s map.',
    'Their challenges show on the map as soon as the party arrives.',
    'Click a picked tile again to put it back.',
  ],
  merchant: [
    'A trail tile’s Merchant side feature opens this window, free, for anyone standing there.',
    'Their 3 cards are rolled the first time someone stands on the tile, at the same prices and Quality as a station.',
    'Buying asks who takes it, like the station.',
    'No art yet: an icon stands in for the Merchant.',
  ],
  trader: [
    'The Traveling Trader swaps one item type for their item, here any 1 clothing item for their Tier II food.',
    'Pick whose item goes: anyone standing on the tile.',
    'No art yet: an icon stands in for the Trader.',
  ],
};

/** A sample hike: everyone checked in at Bea-R-E-I's station, with some blueprints and caps. */
function sampleState(): GameState {
  const s = applyAction(createGame({ seed: 21, hikers: STARTING_PARTY }), {
    type: 'debug',
    op: { kind: 'openStation', themeId: 'bearEI' },
  });
  s.caps = 23;
  const [a, b, c] = s.hikers;
  if (a) {
    a.blueprints = ['tent', 'trailMix', 'medkit'];
    a.inventory.resources = { ...a.inventory.resources, wood: 3, metal: 1 };
  }
  if (b) b.inventory.resources = { ...b.inventory.resources, stone: 2, flint: 1 };
  if (c) c.inventory.resources = { ...c.inventory.resources, moss: 1, mushroom: 1 };
  return s;
}

export function StationExtrasMockup() {
  const [view, setView] = useState<View>('workbench');
  const [notes, setNotes] = useState(true);
  const [state] = useState(sampleState);
  return (
    <Stage>
      <div className={styles.page}>
        <header className={styles.bar}>
          <h1 className={styles.title}>STATION EXTRAS · A MOCKUP TO APPROVE</h1>
          <nav className={styles.views} aria-label="Mockup views">
            {VIEWS.map(([id, label]) => (
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
              aria-pressed={notes}
              onClick={() => setNotes((n) => !n)}
            >
              Notes
            </button>
          </nav>
        </header>
        <div className={styles.sceneWrap}>
          <div className={styles.scene}>
            {view === 'workbench' || view === 'pick' ? (
              <WorkbenchScene state={state} pick={view === 'pick'} />
            ) : view === 'mixer' || view === 'scout' ? (
              <PreviewScene state={state} mode={view} />
            ) : (
              <TrailScene kind={view} />
            )}
            {notes && (
              <aside className={styles.notes} data-view={view}>
                <span className={styles.notesHead}>HOW IT WORKS</span>
                <ul>
                  {NOTES[view].map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </div>
      </div>
    </Stage>
  );
}

// ── The Workbench tab ───────────────────────────────────────────────────────

const TYPES: ItemType[] = ['tool', 'clothes', 'food', 'shelter', 'trinket'];
const TYPE_ICON: Record<ItemType, IconName> = {
  tool: 'hammer',
  clothes: 'shirt',
  food: 'utensils',
  shelter: 'tent',
  trinket: 'sparkles',
};
const NUMERAL = ['', 'I', 'II', 'III', 'IV'];
const resName = (id: string) => RESOURCES.find((r) => r.id === id)?.name ?? id;

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

function WorkbenchScene({ state, pick }: { state: GameState; pick: boolean }) {
  const theme = STATION_THEME_BY_ID[state.station?.themeId ?? 'bearEI'];
  return (
    <div className={room.screen} style={{ position: 'absolute' }}>
      <StationRoom theme={theme} checkpoint={state.station?.checkpoint ?? 1} />
      <div className={room.talk}>
        <span className={room.talkWho}>{theme.shopkeeper.name.toUpperCase()}</span>
        <p className={room.talkLine}>
          The workbench is all yours, fellow hoomhen. Tools, glue, hoomhen hands. Normal stuff.
        </p>
      </div>
      <button type="button" className={`${room.restGo} ${room.brass}`}>
        REST & GO
        <small>Free night, then the Rainforest</small>
      </button>
      <button type="button" className={`${room.preview} ${room.wood}`}>
        <Icon name="eye" size={18} color="#F0C76A" />
        PREVIEW NEXT TRAIL
      </button>
      <div className={room.tabs}>
        <button type="button" className={room.tab} aria-selected="false">
          <Icon name="bag" size={16} />
          SHOP
        </button>
        <button type="button" className={room.tab} aria-selected="true">
          <Icon name="hammer" size={16} />
          WORKBENCH
        </button>
      </div>
      <div className={counter.counter}>{pick ? <PickCounter /> : <Workbench state={state} />}</div>
      <KeeperArm theme={theme} />
      <Packs state={state} onSell={() => {}} onDispatch={() => {}} />
    </div>
  );
}

function Workbench({ state }: { state: GameState }) {
  const [type, setType] = useState<ItemType>('tool');
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const crafter = state.hikers[0];
  if (!crafter || !state.station) return null;
  const recipe = craftRecipe(state, crafter, type, blueprint ?? undefined) ?? [];
  const paid = autoPay(state, crafter, recipe);
  const temp = state.station.tempBlueprints;
  const known = crafter.blueprints ?? [];
  const def = blueprint ? ITEMS[blueprint] : undefined;
  return (
    <>
      <ul className={styles.wbTypes}>
        {TYPES.map((t) => (
          <li key={t}>
            <button
              type="button"
              className={styles.wbType}
              aria-pressed={t === type && !blueprint}
              onClick={() => {
                setType(t);
                setBlueprint(null);
              }}
            >
              <Icon name={TYPE_ICON[t]} size={20} />
              <span>{TYPE_LOOK[t].label.toUpperCase()}</span>
              <small>
                TIER I <Icon name="chevronUp" size={12} /> II
              </small>
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.wbMain}>
        <span className={styles.kicker}>
          {def
            ? `BLUEPRINT · ${def.name.toUpperCase()}`
            : `BASIC RECIPE · TIER II ${TYPE_LOOK[type].label.toUpperCase()}`}
        </span>
        <p className={styles.small}>
          {def
            ? `Makes exactly the ${def.name}. ${temp.includes(def.id) && !known.includes(def.id) ? 'A free blueprint this visit: craft it to keep it.' : ''}`
            : 'At the Workbench everyone crafts one tier higher. 3 cards are dealt; pick 1.'}
        </p>
        <RecipeRow recipe={recipe} paid={paid} />
        <p className={styles.words}>{recipeWords(recipe)}</p>
        <div className={styles.wbActions}>
          <button type="button" className={styles.gold}>
            {def ? `CRAFT THE ${def.name.toUpperCase()}` : 'CRAFT · PICK 1 OF 3'}
          </button>
          <span className={styles.small}>Free here: it uses no action.</span>
        </div>
        <span className={styles.kicker} style={{ marginTop: 6 }}>
          BLUEPRINTS
        </span>
        <div className={styles.bpRow}>
          {[...temp, ...known.filter((id) => !temp.includes(id))].map((id) => {
            const d = ITEMS[id];
            if (!d) return null;
            const free = temp.includes(id) && !known.includes(id);
            const locked = d.tier > 2;
            return (
              <button
                key={id}
                type="button"
                className={styles.bp}
                data-free={free || undefined}
                data-locked={locked || undefined}
                aria-pressed={blueprint === id}
                onClick={() => {
                  if (locked) return;
                  setBlueprint(id);
                  setType(d.type);
                }}
                style={{ '--type': TYPE_LOOK[d.type].accent } as CSSProperties}
              >
                <Icon name={locked ? 'shield' : TYPE_ICON[d.type]} size={22} />
                <span>{d.name.toUpperCase()}</span>
                <em>
                  {free ? 'FREE HERE' : locked ? `TIER ${NUMERAL[d.tier]} · LOCKED` : 'KNOWN'}
                </em>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.wbPool}>
        <span className={styles.kicker}>EVERYONE’S RESOURCES</span>
        <p className={styles.small}>
          At the station every pack is shared. Gold ones pay for this recipe.
        </p>
        <ul className={styles.poolList}>
          {state.hikers
            .filter((h) => h.status === 'checkedIn')
            .map((h) => {
              const paying = paid.filter((p) => p && p.from === h.id);
              return (
                <li key={h.id} className={styles.poolRow}>
                  <Face id={h.id} size={26} />
                  <span className={styles.poolName}>{h.name.toUpperCase()}</span>
                  <span className={styles.poolRes}>
                    {Object.entries(h.inventory.resources).map(([id, n]) => {
                      const used = paying.filter((p) => p?.resource === id).length;
                      return (
                        <span key={id} className={styles.res} data-used={used > 0 || undefined}>
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
      </div>
    </>
  );
}

function RecipeRow({ recipe, paid }: { recipe: Recipe; paid: ReturnType<typeof autoPay> }) {
  let i = 0;
  return (
    <div className={styles.recipe}>
      {recipe.map((part, p) => (
        <span key={p} className={styles.part}>
          {p > 0 && <span className={styles.plus}>+</span>}
          {Array.from({ length: part.n }, () => {
            const slot = paid[i++];
            return (
              <span key={i} className={styles.space} data-empty={!slot || undefined}>
                {slot ? (
                  <>
                    <img src={ASSETS.resources[slot.resource]} alt={resName(slot.resource)} />
                    <Face id={slot.from} size={16} />
                  </>
                ) : (
                  <Icon name="help" size={18} />
                )}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

function partWords(part: RecipePart): string {
  if (part.ids) return `${part.n} ${part.ids.map(resName).join(' or ')}`;
  if (part.nodes) {
    const nodes = part.nodes.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(' or ');
    return `${part.n} ${nodes} resources (any mix)`;
  }
  return `${part.n} of any kind`;
}

const recipeWords = (recipe: Recipe) => recipe.map(partWords).join(', plus ') + '.';

/** The pick step, on the counter: 3 dealt cards, two turned over. */
function PickCounter() {
  const [taken, setTaken] = useState(1);
  const cards = [
    { itemId: 'walkieTalkie', quality: 4 as const },
    { itemId: 'bandages', quality: 3 as const },
  ];
  return (
    <div className={styles.pick}>
      <span className={styles.kicker}>PICK 1 OF 3 · TIER II TOOLS · FROM THE WORKBENCH</span>
      <div className={styles.pickRow}>
        {cards.map((c, i) => (
          <button
            key={c.itemId}
            type="button"
            className={styles.pickCard}
            aria-pressed={taken === i}
            onClick={() => setTaken(i)}
          >
            <ItemCard itemId={c.itemId} quality={c.quality} width={170} />
            <span className={styles.small}>Quality {c.quality}</span>
          </button>
        ))}
        <button type="button" className={styles.pickCard}>
          <ItemBack type="tool" width={170} />
          <span className={styles.small}>Turn it over</span>
        </button>
      </div>
      <div className={styles.wbActions}>
        <button type="button" className={styles.ghost}>
          TURN ALL OVER
        </button>
        <button type="button" className={styles.gold}>
          TAKE THE {ITEMS[cards[taken]?.itemId ?? '']?.name.toUpperCase()}
        </button>
      </div>
    </div>
  );
}

// ── Preview Next Trail ──────────────────────────────────────────────────────

/** Paving: what each line kind becomes (as the Paver does). */
const PAVES: Record<string, string> = {
  steep: 'normal',
  muddy: 'normal',
  rough: 'normal',
  normal: 'Paved',
};

function PreviewScene({ state, mode }: { state: GameState; mode: 'mixer' | 'scout' }) {
  const next = state.station?.next;
  const theme = STATION_THEME_BY_ID[state.station?.themeId ?? 'bearEI'];
  const bounds = next ? mapBounds(next) : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const [camera, setCamera] = useState<Camera>(() => {
    const fit = Math.min(
      MAP_VIEW.w / (bounds.maxX - bounds.minX),
      MAP_VIEW.h / (bounds.maxY - bounds.minY),
    );
    return clampCamera(
      { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY, zoom: Math.max(0.62, fit) },
      bounds,
    );
  });
  const [line, setLine] = useState<string | null>(null);
  const [tiles, setTiles] = useState<string[]>([]);
  if (!next) return null;
  const lastRow = lastRowOf(next);
  const hikers = state.hikers.map((h) => ({
    ...h,
    tileId: next.trailheadId,
    status: 'active' as const,
  }));
  const scoutable = Object.values(next.tiles).filter((t) => t.kind === 'normal');
  const picked = line ? next.lines.find((l) => l.id === line) : undefined;

  const overlay =
    mode === 'mixer'
      ? next.lines.map((l) => {
          const a = next.tiles[l.a];
          const b = next.tiles[l.b];
          if (!a || !b) return null;
          const pa = tileCenter(a, lastRow);
          const pb = tileCenter(b, lastRow);
          const can = !!PAVES[l.kind];
          return (
            <button
              key={l.id}
              type="button"
              className={styles.linePick}
              data-can={can || undefined}
              aria-pressed={line === l.id}
              disabled={!can}
              title={can ? `A ${l.kind} line: becomes ${PAVES[l.kind]}` : 'Already Paved'}
              style={{ left: (pa.x + pb.x) / 2, top: (pa.y + pb.y) / 2 }}
              onClick={() => setLine(l.id)}
            >
              <Icon name="road" size={18} />
            </button>
          );
        })
      : null;

  return (
    <div className={room.screen} style={{ position: 'absolute' }}>
      <StationRoom theme={theme} checkpoint={state.station?.checkpoint ?? 1} />
      <div className={styles.previewDim} />
      <MapView
        section={next}
        hikers={hikers}
        targets={mode === 'scout' ? scoutable.map((t) => ({ tileId: t.id, reason: null })) : []}
        reachLabel="Scout this tile"
        checkpoint={{ number: 2, summit: false }}
        onTileClick={(id) =>
          setTiles((ts) =>
            ts.includes(id) ? ts.filter((x) => x !== id) : ts.length < 3 ? [...ts, id] : ts,
          )
        }
        marks={Object.fromEntries(tiles.map((id) => [id, 'target' as const]))}
        overlay={overlay}
        selectedId={null}
        onSelectHiker={() => {}}
        camera={camera}
        setCamera={setCamera}
        bounds={bounds}
      />
      <aside className={styles.pvLeft}>
        <span className={styles.pvTitle}>PREVIEW NEXT TRAIL</span>
        <span className={styles.kicker}>THE TEMPERATE RAINFOREST · TIER II</span>
        <p className={styles.small}>
          What the party can see from the Trailhead: the trail’s shape, its special spaces and the
          nodes already showing.
        </p>
        <div className={styles.special}>
          <span className={styles.specialName}>
            <Icon name={mode === 'mixer' ? 'road' : 'eye'} size={18} />
            {mode === 'mixer' ? 'CEMENT MIXER' : 'SCOUT REPORT'}
          </span>
          <p>
            {mode === 'mixer'
              ? 'Pick one line to pave. Steep, Muddy and Rough lines become normal; a normal line becomes Paved.'
              : 'Pick up to 3 tiles. Their challenges show on the map when the party arrives.'}
          </p>
          <p className={styles.pickedLine}>
            {mode === 'mixer'
              ? picked
                ? `Picked: a ${picked.kind} line, becoming ${PAVES[picked.kind]}.`
                : 'Nothing picked yet: click a gold road button.'
              : `${tiles.length} of 3 tiles picked.`}
          </p>
        </div>
        <div className={styles.pvButtons}>
          <button
            type="button"
            className={styles.gold}
            disabled={mode === 'mixer' ? !picked : !tiles.length}
          >
            {mode === 'mixer' ? 'PAVE IT · 6 CAPS' : 'SCOUT THEM · 6 CAPS'}
          </button>
          <button type="button" className={styles.ghost}>
            BACK TO THE STATION
          </button>
        </div>
      </aside>
      <aside className={styles.pvRight}>
        <span className={styles.kicker}>WHAT’S AHEAD</span>
        <ul className={room.chips}>
          {aheadChips(state).map((c) => (
            <li key={c.key} className={room.chip} data-tone={c.tone}>
              {c.icon && <Icon name={c.icon} size={16} />}
              {c.text}
            </li>
          ))}
        </ul>
        <span className={styles.kicker} style={{ marginTop: 8 }}>
          LINES
        </span>
        <ul className={styles.legend}>
          <li>
            <b>Paved</b> the mover pays nothing extra
          </li>
          <li>
            <b>Normal</b> the usual cost
          </li>
          <li>
            <b>Steep</b> 1 extra Energy
          </li>
          <li>
            <b>Muddy</b> 1 extra Appetite
          </li>
          <li>
            <b>Rough</b> 1 extra Morale
          </li>
        </ul>
      </aside>
    </div>
  );
}

// ── The trail's Merchant and Traveling Trader ───────────────────────────────

function TrailScene({ kind }: { kind: 'merchant' | 'trader' }) {
  const [chosen, setChosen] = useState(0);
  const mine = [
    { owner: 'hiker-2', itemId: 'flannel', quality: 3 as const },
    { owner: 'hiker-3', itemId: 'rainJacket', quality: 4 as const },
  ];
  return (
    <div className={styles.trail}>
      <Backdrop phase="afternoon" biome="meadow" />
      <div className={styles.trailDim} />
      <section
        className={styles.window}
        aria-label={kind === 'merchant' ? 'Merchant' : 'Traveling Trader'}
      >
        <header className={`${styles.windowHead} ${room.wood}`}>
          <span className={styles.keeperIcon}>
            <Icon name={kind === 'merchant' ? 'bag' : 'backpack'} size={30} color="#FCE9C4" />
          </span>
          <span>
            <h2>{kind === 'merchant' ? 'MERCHANT' : 'TRAVELING TRADER'}</h2>
            <small>
              {kind === 'merchant'
                ? 'By the trail · free to shop for anyone on this tile'
                : 'By the trail · one trade, free, for anyone on this tile'}
            </small>
          </span>
          <button type="button" className={styles.close} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        {kind === 'merchant' ? (
          <div className={styles.merchant}>
            <p className={styles.line}>“Good wares, fair prices. Same as any station, friend.”</p>
            <div className={styles.offers}>
              <div className={counter.offer}>
                <ItemCard itemId="trailMix" quality={4} width={170} />
                <span className={counter.tag}>
                  <Icon name="acorn" size={13} />5
                </span>
              </div>
              <div className={counter.offer}>
                <div
                  className={styles.bigBp}
                  style={{ '--type': TYPE_LOOK.tool.accent } as CSSProperties}
                >
                  <Icon name="hammer" size={44} />
                  <span>SHOVEL</span>
                  <em>BLUEPRINT</em>
                </div>
                <span className={counter.tag}>
                  <Icon name="acorn" size={13} />6
                </span>
              </div>
              <div className={counter.offer}>
                <div className={styles.bigBundle}>
                  <img src={ASSETS.resources.metal} alt="Metal" />
                  <span className={counter.count}>×3</span>
                </div>
                <span className={counter.tag}>
                  <Icon name="acorn" size={13} />4
                </span>
              </div>
            </div>
            <footer className={styles.windowFoot}>
              <span className={`${styles.miniCaps} ${room.brass}`}>
                <Icon name="acorn" size={18} /> 23
              </span>
              <span className={styles.small}>
                Click a card to buy it. Buying asks who takes it, like a station.
              </span>
            </footer>
          </div>
        ) : (
          <div className={styles.trader}>
            <div className={styles.theirs}>
              <span className={styles.kicker}>THEIR ITEM</span>
              <ItemCard itemId="khachapuri" quality={3} width={190} />
            </div>
            <span className={styles.swap} aria-hidden="true">
              ⇄
            </span>
            <div className={styles.yours}>
              <span className={styles.kicker}>FOR ANY 1 CLOTHING ITEM</span>
              <div className={styles.mine}>
                {mine.map((m, i) => (
                  <button
                    key={m.itemId}
                    type="button"
                    className={styles.pickCard}
                    aria-pressed={chosen === i}
                    onClick={() => setChosen(i)}
                  >
                    <ItemCard itemId={m.itemId} quality={m.quality} width={150} />
                    <span className={styles.owner}>
                      <Face id={m.owner} size={18} />
                      {m.owner === 'hiker-2' ? 'HIKER 2' : 'HIKER 3'}
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" className={styles.gold}>
                TRADE THE {ITEMS[mine[chosen]?.itemId ?? '']?.name.toUpperCase()} FOR THE KHACHAPURI
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
