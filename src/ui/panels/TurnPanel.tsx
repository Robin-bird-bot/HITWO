/**
 * The right panel: the selected hiker's turn (docs/mockups/Main.dc.html).
 * Actions, abilities, the current tile, equipped items, bag and resources.
 */
import { useState } from 'react';
import { ITEMS, TRAITS } from '../../content';
import { RESOURCES } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  abilitiesFor,
  bagSlots,
  hikersOnTile,
  hikersWhoHaventActed,
  resourceCount,
  type EquipSlot,
  type GameState,
  type Hiker,
  type ItemInstance,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { FEATURE_LOOK, NODE_IMAGE, NODE_NAME, SPECIAL_LOOK } from '../map/looks';
import { actionStates, tileName, type ActionId, type ActionState } from './hikerInfo';
import { Panel } from './Panel';
import panel from './Panel.module.css';
import styles from './TurnPanel.module.css';

const PHASE_NAME = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' } as const;

interface TurnPanelProps {
  state: GameState;
  hiker: Hiker;
  /** A ready action was picked. */
  onAction(id: ActionId): void;
  /** Use an ability, with the chosen option. */
  onAbility(abilityId: string, choice?: string): void;
  onEndPhase(): void;
  /** A short message to show under the action grid (a reason or a hint). */
  note?: string;
}

export function TurnPanel({ state, hiker, onAction, onAbility, onEndPhase, note }: TurnPanelProps) {
  return (
    <Panel
      id="turn"
      as="aside"
      label="selected hiker's turn"
      style={{ left: 1240, top: 120, width: 344, height: 864 }}
      title={<span className={styles.heading}>{hiker.name.toUpperCase()}’S TURN</span>}
      aside={<span>{PHASE_NAME[state.phase]}</span>}
    >
      <div className={styles.scroll}>
        <ActionGrid state={state} hiker={hiker} onAction={onAction} note={note} />
        <Abilities state={state} hiker={hiker} onAbility={onAbility} />
        <TileCard state={state} hiker={hiker} />
        <Equipped hiker={hiker} />
        <Bag state={state} hiker={hiker} />
        <Resources hiker={hiker} />
      </div>
      <Footer state={state} onEndPhase={onEndPhase} />
    </Panel>
  );
}

function ActionGrid({
  state,
  hiker,
  onAction,
  note,
}: {
  state: GameState;
  hiker: Hiker;
  onAction(id: ActionId): void;
  note?: string;
}) {
  const actions = actionStates(state, hiker);
  const [explain, setExplain] = useState<ActionState | null>(null);
  const message =
    note ?? explain?.reason ?? 'Pick an action. Greyed-out ones say why when you point at them.';

  return (
    <div className={styles.block}>
      <div className={styles.grid} onMouseLeave={() => setExplain(null)}>
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={styles.action}
            data-status={a.status}
            aria-disabled={a.status !== 'ready'}
            aria-describedby="action-reason"
            onMouseEnter={() => setExplain(a)}
            onFocus={() => setExplain(a)}
            onClick={() => (a.status === 'ready' ? onAction(a.id) : setExplain(a))}
          >
            <Icon name={a.icon} size={18} />
            <span className={styles.actionLabel}>{a.label.toUpperCase()}</span>
            <span className={styles.actionSub}>{a.sub}</span>
          </button>
        ))}
      </div>
      <p id="action-reason" className={styles.reason} role="status">
        {message}
      </p>
    </div>
  );
}

const TRAIT_COLOR = { T: '#F2B950', U: '#9CC3A8', M: '#CDA6EE' };
const PER = { day: 'DAY', phase: 'PHASE', biome: 'SECTION' };

function Abilities({
  state,
  hiker,
  onAbility,
}: {
  state: GameState;
  hiker: Hiker;
  onAbility(abilityId: string, choice?: string): void;
}) {
  const abilities = abilitiesFor(state, hiker);
  const [choosing, setChoosing] = useState<string | null>(null);
  return (
    <div className={styles.block}>
      <span className={panel.label}>ABILITIES</span>
      {abilities.length === 0 && <span className={styles.muted}>No active traits.</span>}
      {abilities.map(({ ability, usesLeft }) => {
        const trait = Object.values(TRAITS).find((t) => t.ability?.id === ability.id);
        const color = trait ? TRAIT_COLOR[trait.type] : '#C9C2B2';
        const used = usesLeft <= 0;
        return (
          <div
            key={ability.id}
            className={styles.ability}
            data-used={used}
            style={used ? undefined : { borderColor: `${color}59`, background: `${color}1A` }}
          >
            <div className={styles.abilityHead}>
              <span className={styles.hex} style={{ background: color }} />
              <div className={styles.abilityText}>
                <span className={styles.abilityName} style={{ color }}>
                  {ability.label.toUpperCase()} · {ability.limit.uses}/{PER[ability.limit.per]}
                </span>
                <span className={styles.small}>{trait?.text}</span>
              </div>
              {used ? (
                <span className={styles.muted}>Used</span>
              ) : (
                <button
                  type="button"
                  className={styles.use}
                  style={{ background: color }}
                  aria-expanded={choosing === ability.id}
                  onClick={() =>
                    ability.choices
                      ? setChoosing(choosing === ability.id ? null : ability.id)
                      : onAbility(ability.id)
                  }
                >
                  USE
                </button>
              )}
            </div>
            {choosing === ability.id && ability.choices && (
              <div className={styles.choices}>
                {ability.choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.choice}
                    onClick={() => {
                      setChoosing(null);
                      onAbility(ability.id, c.id);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TileCard({ state, hiker }: { state: GameState; hiker: Hiker }) {
  const tile = state.section.tiles[hiker.tileId];
  if (!tile) return null;
  const others = hikersOnTile(state, tile.id).filter((h) => h.id !== hiker.id);
  const company = others.length
    ? `With ${others.map((h) => h.name).join(', ')} · resources pooled`
    : 'Alone here';
  const special = tile.special ? SPECIAL_LOOK[tile.special].name : null;
  return (
    <div className={styles.tile}>
      <div className={styles.tileNodes}>
        {tile.nodes.length === 0 && <Icon name="footprints" size={22} color="#C9C2B2" />}
        {tile.nodes.map((n, i) =>
          n.revealed && n.type !== 'caps' ? (
            <img
              key={i}
              src={NODE_IMAGE[n.type]}
              alt={`${NODE_NAME[n.type]} node`}
              width={24}
              height={28}
            />
          ) : (
            <span key={i} className={styles.nodeQ} title={n.revealed ? 'Cap node' : 'Unknown node'}>
              {n.revealed ? 'C' : '?'}
            </span>
          ),
        )}
      </div>
      <div className={styles.tileText}>
        <span className={styles.tileName}>{tileName(tile).toUpperCase()}</span>
        <span className={styles.small}>
          {special && tileName(tile) !== special ? `${special} · ${company}` : company}
        </span>
      </div>
      {tile.feature && (
        <button
          type="button"
          className={styles.feature}
          aria-disabled="true"
          title={`${FEATURE_LOOK[tile.feature].name}: arrives in Phase 8`}
        >
          <Icon name={FEATURE_LOOK[tile.feature].icon} size={14} strokeWidth={2.25} />
          {tile.feature === 'merchant' ? 'Merchant' : 'Trader'}
        </button>
      )}
    </div>
  );
}

const EQUIP: { slot: EquipSlot; label: string; icon: 'shirt' | 'boot' | 'backpack' }[] = [
  { slot: 'body', label: 'Body', icon: 'shirt' },
  { slot: 'feet', label: 'Feet', icon: 'boot' },
  { slot: 'gear', label: 'Gear', icon: 'backpack' },
];

function Equipped({ hiker }: { hiker: Hiker }) {
  return (
    <div className={styles.block}>
      <span className={panel.label}>EQUIPPED</span>
      <div className={styles.row}>
        {EQUIP.map(({ slot, label, icon }) => {
          const item = hiker.inventory.equipped[slot];
          return item ? (
            <ItemCard key={slot} item={item} size="large" />
          ) : (
            <div key={slot} className={styles.empty} data-size="large" title={`${label}: empty`}>
              <Icon name={icon} size={18} color="#6F6A60" />
              <span>{label.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A stand-in item card (Phase 9 builds the real layered cards). */
function ItemCard({ item, size }: { item: ItemInstance; size: 'large' | 'small' }) {
  const def = ITEMS[item.itemId];
  return (
    <div
      className={styles.itemCard}
      data-size={size}
      title={def ? `${def.name}: ${def.text}` : item.itemId}
      style={{ backgroundImage: `url(${ASSETS.itemCards.clothesGradient})` }}
    >
      <img src={ASSETS.itemCards.clothesIcon} alt="" />
      <span>{(def?.name ?? item.itemId).toUpperCase()}</span>
    </div>
  );
}

function Bag({ state, hiker }: { state: GameState; hiker: Hiker }) {
  const slots = bagSlots(state, hiker);
  const size = slots.total <= 4 ? 'large' : 'small';
  const items = hiker.inventory.bag;
  const extra = slots.fromItems.map((i) => `${i.count} from ${i.name}`).join(', ');
  const cells: { kind: 'base' | 'item'; from?: string }[] = [
    ...Array.from({ length: slots.base }, () => ({ kind: 'base' as const })),
    ...slots.fromItems.flatMap((i) =>
      Array.from({ length: i.count }, () => ({ kind: 'item' as const, from: i.name })),
    ),
  ];
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <span className={panel.label}>BAG</span>
        <span className={styles.count}>
          {items.length}/{slots.total}
          {extra ? ` · ${extra.toUpperCase()}` : ''}
        </span>
      </div>
      <div className={styles.row} data-wrap={slots.total > 6}>
        {cells.map((cell, i) => {
          const item = items[i];
          if (item) return <ItemCard key={i} item={item} size={size} />;
          return (
            <div
              key={i}
              className={styles.empty}
              data-size={size}
              data-from-item={cell.kind === 'item'}
              title={cell.kind === 'item' ? `Extra slot from the ${cell.from}` : 'Empty bag slot'}
            >
              {cell.kind === 'item' && (
                <span className={styles.slotBadge}>
                  <Icon name="backpack" size={11} color="#1D2220" strokeWidth={2.5} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Resources({ hiker }: { hiker: Hiker }) {
  const held = RESOURCES.filter((r) => (hiker.inventory.resources[r.id] ?? 0) > 0);
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <span className={panel.label}>RESOURCES</span>
        <span className={styles.count}>
          {resourceCount(hiker)}/{BALANCE.inventory.resourceLimit}
        </span>
      </div>
      {held.length === 0 ? (
        <span className={styles.muted}>None yet. Scavenging arrives in Phase 4.</span>
      ) : (
        <div className={styles.resources}>
          {held.map((r) => {
            const icon = ASSETS.resources[r.id];
            const n = hiker.inventory.resources[r.id] ?? 0;
            return (
              <div key={r.id} className={styles.resource} title={`${r.name} ×${n}`}>
                {icon ? (
                  <img src={icon} alt={r.name} />
                ) : (
                  <span className={styles.noArt}>{r.name}</span>
                )}
                <span className={styles.badge}>{n}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Footer({ state, onEndPhase }: { state: GameState; onEndPhase(): void }) {
  const waiting = hikersWhoHaventActed(state);
  const sub =
    waiting.length === 0
      ? 'Everyone has acted'
      : waiting.length === 1
        ? `${waiting[0]?.name} hasn’t acted`
        : `${waiting.length} hikers haven’t acted`;
  return (
    <div className={styles.footer}>
      <button
        type="button"
        className={styles.blueprints}
        aria-disabled="true"
        title="Blueprints arrive in Phase 9"
      >
        <Icon name="book" size={18} />
        Blueprints
      </button>
      <button type="button" className={styles.end} onClick={onEndPhase}>
        <span className={styles.endLabel}>END {PHASE_NAME[state.phase].toUpperCase()}</span>
        <span className={styles.endSub}>{sub}</span>
      </button>
    </div>
  );
}
