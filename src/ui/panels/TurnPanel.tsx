/**
 * The right panel: the selected hiker's turn (docs/mockups/Main.dc.html).
 * Actions, abilities, the current tile, equipped items, bag and resources.
 */
import { useState, type ReactNode } from 'react';
import { ITEMS, TRAITS } from '../../content';
import { RESOURCES } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  abilitiesFor,
  atLastSection,
  bagSlots,
  hikersOnTile,
  hikersWhoHaventActed,
  resourceCount,
  resourceLimit,
  validateAction,
  type Action,
  type EquipSlot,
  type GameState,
  type Hiker,
  type HikerId,
  type ItemInstance,
  type ResourceId,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { ItemCard as CardFace } from '../items/ItemCard';
import { useStage } from '../stage/StageContext';
import { FEATURE_LOOK, NODE_IMAGE, NODE_NAME, SPECIAL_LOOK } from '../map/looks';
import { actionStates, tileName, type ActionId, type ActionState } from './hikerInfo';
import { Panel } from './Panel';
import panel from './Panel.module.css';
import { BoostChips } from '../items/BoostChips';
import { itemVerbs } from '../items/whatItDoes';
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
  /** A box shown under the action grid instead of the message (Move All picker, Sleep confirm). */
  slot?: ReactNode;
  /** A resource or bag item was clicked: open its give / return menu. */
  onPick?(pick: StashPick): void;
  /** A free action (picking up or putting down a passed-out hiker). */
  onFree?(action: Action): void;
  /** Asks to confirm abandoning the hike for this hiker. */
  onAbandon?(id: HikerId): void;
  /** Opens the hiker's blueprints (the Craft window's Teach tab). */
  onBlueprints?(): void;
}

export function TurnPanel({
  state,
  hiker,
  onAction,
  onAbility,
  onEndPhase,
  note,
  slot,
  onPick,
  onFree,
  onAbandon,
  onBlueprints,
}: TurnPanelProps) {
  return (
    <Panel
      id="turn"
      movable
      as="aside"
      label="selected hiker's turn"
      style={{ left: 1240, top: 120, width: 344, height: 864 }}
      title={<span className={styles.heading}>{hiker.name.toUpperCase()}’S TURN</span>}
      aside={<span>{PHASE_NAME[state.phase]}</span>}
    >
      <div className={styles.scroll}>
        {hiker.status === 'active' ? (
          <>
            <ActionGrid state={state} hiker={hiker} onAction={onAction} note={note} slot={slot} />
            <Abilities state={state} hiker={hiker} onAbility={onAbility} />
          </>
        ) : (
          <OutCard state={state} hiker={hiker} {...(onAbandon ? { onAbandon } : {})} />
        )}
        {onFree && <CarryCard state={state} hiker={hiker} onFree={onFree} />}
        <TileCard state={state} hiker={hiker} />
        <Equipped hiker={hiker} {...(onPick ? { onPick } : {})} />
        <Bag state={state} hiker={hiker} onPick={onPick} />
        <Resources state={state} hiker={hiker} onPick={onPick} />
      </div>
      <Footer
        state={state}
        hiker={hiker}
        onEndPhase={onEndPhase}
        {...(onBlueprints ? { onBlueprints } : {})}
      />
    </Panel>
  );
}

function ActionGrid({
  state,
  hiker,
  onAction,
  note,
  slot,
}: {
  state: GameState;
  hiker: Hiker;
  onAction(id: ActionId): void;
  note?: string;
  slot?: ReactNode;
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
            aria-label={`${a.label}: ${a.status === 'ready' ? a.sub : a.reason}`}
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
      {slot ?? (
        <p
          id="action-reason"
          className={styles.reason}
          role="status"
          data-status={!note && explain?.status === 'status' ? 'status' : undefined}
        >
          {message}
        </p>
      )}
    </div>
  );
}

const TRAIT_COLOR = { T: '#F2B950', U: '#9CC3A8', M: '#CDA6EE' };
const PER = { day: 'DAY', phase: 'PHASE', biome: 'SECTION' };

export function Abilities({
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
              {ability.scavengeReroll ? (
                <span className={styles.muted}>{used ? 'Used' : 'When scavenging'}</span>
              ) : used ? (
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

/**
 * A hiker who can't act: passed out (the countdown, how to help, and
 * Abandon), checked in at the checkpoint, or gone from the hike.
 */
export function OutCard({
  state,
  hiker,
  onAbandon,
}: {
  state: GameState;
  hiker: Hiker;
  onAbandon?(id: HikerId): void;
}) {
  if (hiker.status === 'abandoned') {
    return (
      <div className={styles.block}>
        <p className={styles.outText}>{hiker.name} left the hike.</p>
      </div>
    );
  }
  if (hiker.status === 'checkedIn') {
    const out = state.hikers.filter((h) => h.status === 'active' || h.status === 'passedOut');
    return (
      <div className={styles.block}>
        <div className={styles.out} data-tone="in">
          <span className={styles.outKicker}>
            <Icon name="tower" size={14} />
            CHECKED IN
          </span>
          <span className={styles.outText}>
            {hiker.name} waits at the {atLastSection(state) ? 'summit' : 'checkpoint'}, losing
            nothing.{' '}
            {out.length
              ? `Still on the trail: ${out.map((h) => h.name).join(', ')}.`
              : 'Everyone is in.'}
          </span>
        </div>
      </div>
    );
  }
  if (hiker.status !== 'passedOut') return null;
  const nights = hiker.countdown ?? BALANCE.passOut.countdownNights;
  const carrier = state.hikers.find((h) => h.carrying === hiker.id);
  const company = hikersOnTile(state, hiker.tileId);
  const things = hiker.inventory.bag.length + resourceCount(hiker);
  return (
    <div className={styles.block}>
      <div className={styles.out}>
        <span className={styles.outKicker}>
          <Icon name="medical" size={14} solid />
          PASSED OUT · {nights} NIGHT{nights === 1 ? '' : 'S'}
        </span>
        <span className={styles.outText}>
          {company.length
            ? `${carrier ? `${carrier.name} is carrying them` : `${company.map((h) => h.name).join(' and ')} ${company.length === 1 ? 'is' : 'are'} with them`}, so the countdown waits.`
            : `Alone, ${hiker.name} abandons the hike in ${nights} night${nights === 1 ? '' : 's'}.`}{' '}
          A medical item from a hiker on this tile wakes them, or someone can carry them.
        </span>
        {company.length > 0 && things > 0 && (
          <span className={styles.small}>Others here can take things from their pack below.</span>
        )}
      </div>
      {onAbandon && (
        <button type="button" className={styles.abandon} onClick={() => onAbandon(hiker.id)}>
          Abandon {hiker.name}…
        </button>
      )}
    </div>
  );
}

/**
 * Carrying (a free action): who this hiker carries, with Put down, or a
 * passed-out hiker on their tile, with Pick up.
 */
export function CarryCard({
  state,
  hiker,
  onFree,
}: {
  state: GameState;
  hiker: Hiker;
  onFree(action: Action): void;
}) {
  if (hiker.status !== 'active') return null;
  const carried = hiker.carrying ? state.hikers.find((h) => h.id === hiker.carrying) : undefined;
  const down = state.hikers.filter(
    (h) => h.status === 'passedOut' && h.tileId === hiker.tileId && h.id !== carried?.id,
  );
  if (!carried && !down.length) return null;
  const extra = `+${BALANCE.carry.appetite} Appetite on every move`;
  return (
    <div className={styles.block}>
      <span className={panel.label}>CARRY</span>
      {carried && (
        <div className={styles.ability} style={CARRY_LOOK}>
          <div className={styles.abilityHead}>
            <Icon name="users" size={18} color={CARRY_COLOR} />
            <div className={styles.abilityText}>
              <span className={styles.abilityName} style={{ color: CARRY_COLOR }}>
                CARRYING {carried.name.toUpperCase()}
              </span>
              <span className={styles.small}>{extra}. Putting them down is free.</span>
            </div>
            <button
              type="button"
              className={styles.use}
              style={{ background: CARRY_COLOR }}
              onClick={() => onFree({ type: 'putDown', carrierId: hiker.id })}
            >
              PUT DOWN
            </button>
          </div>
        </div>
      )}
      {down.map((h) => {
        const action: Action = { type: 'pickUp', carrierId: hiker.id, hikerId: h.id };
        const reason = validateAction(state, action);
        return (
          <div key={h.id} className={styles.ability} style={CARRY_LOOK} data-used={!!reason}>
            <div className={styles.abilityHead}>
              <Icon name="medical" size={18} color={CARRY_COLOR} />
              <div className={styles.abilityText}>
                <span className={styles.abilityName} style={{ color: CARRY_COLOR }}>
                  {h.name.toUpperCase()} HAS PASSED OUT
                </span>
                <span className={styles.small}>{reason ?? `Carry them along: ${extra}.`}</span>
              </div>
              {!reason && (
                <button
                  type="button"
                  className={styles.use}
                  style={{ background: CARRY_COLOR }}
                  onClick={() => onFree(action)}
                >
                  PICK UP
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CARRY_COLOR = '#E9B44C';
const CARRY_LOOK = { borderColor: `${CARRY_COLOR}59`, background: `${CARRY_COLOR}1A` };

export function TileCard({ state, hiker }: { state: GameState; hiker: Hiker }) {
  const tile = state.section.tiles[hiker.tileId];
  if (!tile) return null;
  const others = hikersOnTile(state, tile.id).filter((h) => h.id !== hiker.id);
  // At the checkpoint, the company is whoever has checked in.
  const waiting = state.hikers.filter(
    (h) => h.id !== hiker.id && h.tileId === tile.id && h.status === 'checkedIn',
  );
  const company = others.length
    ? `With ${others.map((h) => h.name).join(', ')} · resources pooled`
    : waiting.length
      ? `${waiting.map((h) => h.name).join(', ')} checked in here`
      : 'Alone here';
  const special = tile.special ? SPECIAL_LOOK[tile.special].name : null;
  return (
    <>
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
              <span
                key={i}
                className={styles.nodeQ}
                title={n.revealed ? 'Cap node' : 'Unknown node'}
              >
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
            title={`${FEATURE_LOOK[tile.feature].name}: arrives in Phase 9`}
          >
            <Icon name={FEATURE_LOOK[tile.feature].icon} size={14} strokeWidth={2.25} />
            {tile.feature === 'merchant' ? 'Merchant' : 'Trader'}
          </button>
        )}
      </div>
      <BoostChips state={state} hiker={hiker} />
    </>
  );
}

const EQUIP: { slot: EquipSlot; label: string; icon: 'shirt' | 'boot' | 'backpack' }[] = [
  { slot: 'body', label: 'Body', icon: 'shirt' },
  { slot: 'feet', label: 'Feet', icon: 'boot' },
  { slot: 'gear', label: 'Gear', icon: 'backpack' },
];

/** `compact` (Simple mode): short labels with counts, and no helper text. */
interface InventoryProps {
  compact?: boolean;
  /** Clicking a resource or bag item opens its give / return menu. */
  onPick?(pick: StashPick): void;
}

export function Equipped({ hiker, compact, onPick }: { hiker: Hiker } & InventoryProps) {
  const worn = EQUIP.filter(({ slot }) => hiker.inventory.equipped[slot]).length;
  const stageTop = useStageTop();
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <span className={panel.label}>EQUIPPED</span>
        {compact && (
          <span className={styles.count}>
            {worn}/{EQUIP.length}
          </span>
        )}
      </div>
      <div className={styles.row}>
        {EQUIP.map(({ slot, label, icon }) => {
          const item = hiker.inventory.equipped[slot];
          return item ? (
            <ItemCard
              key={slot}
              item={item}
              size="large"
              worn
              {...(onPick
                ? {
                    onClick: (e: React.MouseEvent<HTMLElement>) =>
                      onPick({ kind: 'equipped', slot, top: stageTop(e.currentTarget) }),
                  }
                : {})}
            />
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

/** A card in the bag or an equipment slot: the compact real card, a button when it opens a menu. */
function ItemCard({
  item,
  size,
  worn = false,
  onClick,
}: {
  item: ItemInstance;
  size: 'large' | 'small';
  /** Clothes being worn: the menu takes them off. */
  worn?: boolean;
  onClick?(e: React.MouseEvent<HTMLElement>): void;
}) {
  const def = ITEMS[item.itemId];
  const name = def?.name ?? item.itemId;
  const what = worn ? 'take off' : itemVerbs(item.itemId);
  const face = (
    <CardFace itemId={item.itemId} item={item} width={size === 'large' ? 64 : 46} compact />
  );
  if (!onClick) {
    return (
      <div className={styles.itemCard} data-size={size}>
        {face}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={styles.itemCard}
      data-size={size}
      onClick={onClick}
      aria-label={`${name}: ${what}`}
    >
      {face}
    </button>
  );
}

/** A resource or bag item the player clicked, and where (stage pixels) to open its menu. */
export type StashPick =
  | { kind: 'resource'; id: ResourceId; top: number }
  | { kind: 'item'; uid: string; top: number }
  | { kind: 'equipped'; slot: EquipSlot; top: number };

/** The clicked element's top, in stage pixels. */
function useStageTop() {
  const fit = useStage();
  return (el: HTMLElement) => (el.getBoundingClientRect().top - fit.top) / fit.scale;
}

export function Bag({
  state,
  hiker,
  compact,
  onPick,
}: { state: GameState; hiker: Hiker } & InventoryProps) {
  const stageTop = useStageTop();
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
          {extra && !compact ? ` · ${extra.toUpperCase()}` : ''}
        </span>
      </div>
      <div className={`${styles.row} ${styles.bagRow}`} data-wrap={slots.total > 6}>
        {cells.map((cell, i) => {
          const item = items[i];
          if (item) {
            return (
              <ItemCard
                key={i}
                item={item}
                size={size}
                {...(onPick
                  ? {
                      onClick: (e: React.MouseEvent<HTMLElement>) =>
                        onPick({ kind: 'item', uid: item.uid, top: stageTop(e.currentTarget) }),
                    }
                  : {})}
              />
            );
          }
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

export function Resources({
  state,
  hiker,
  compact,
  onPick,
}: { state: GameState; hiker: Hiker } & InventoryProps) {
  const held = RESOURCES.filter((r) => (hiker.inventory.resources[r.id] ?? 0) > 0);
  const stageTop = useStageTop();
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <span className={panel.label}>RESOURCES</span>
        <span className={styles.count}>
          {resourceCount(hiker)}/{resourceLimit(state, hiker)}
        </span>
      </div>
      {held.length === 0 ? (
        <span className={styles.muted}>
          {compact ? 'None' : 'None yet. Scavenge to find some.'}
        </span>
      ) : (
        <div className={styles.resources}>
          {held.map((r) => {
            const icon = ASSETS.resources[r.id];
            const n = hiker.inventory.resources[r.id] ?? 0;
            const content = (
              <>
                {icon ? (
                  <img src={icon} alt={r.name} />
                ) : (
                  <span className={styles.noArt}>{r.name}</span>
                )}
                <span className={styles.badge}>{n}</span>
              </>
            );
            return onPick ? (
              <button
                key={r.id}
                type="button"
                className={styles.resource}
                title={`${r.name} ×${n}`}
                aria-label={`${r.name} ×${n}: give or return`}
                onClick={(e) =>
                  onPick({ kind: 'resource', id: r.id, top: stageTop(e.currentTarget) })
                }
              >
                {content}
              </button>
            ) : (
              <div key={r.id} className={styles.resource} title={`${r.name} ×${n}`}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function endSub(state: GameState): string {
  const waiting = hikersWhoHaventActed(state);
  return waiting.length === 0
    ? 'Everyone has acted'
    : waiting.length === 1
      ? `${waiting[0]?.name} hasn’t acted`
      : `${waiting.length} hikers haven’t acted`;
}

/** The End phase button: the phase's name, and who still has their action. */
export function EndButton({ state, onEndPhase }: { state: GameState; onEndPhase(): void }) {
  const sub = endSub(state);
  return (
    <button
      type="button"
      className={styles.end}
      onClick={onEndPhase}
      aria-label={`End the ${state.phase}. ${sub}.`}
    >
      <span className={styles.endLabel}>END {PHASE_NAME[state.phase].toUpperCase()}</span>
      <span className={styles.endSub}>{sub}</span>
    </button>
  );
}

function Footer({
  state,
  hiker,
  onEndPhase,
  onBlueprints,
}: {
  state: GameState;
  hiker: Hiker;
  onEndPhase(): void;
  onBlueprints?(): void;
}) {
  const n = hiker.blueprints?.length ?? 0;
  return (
    <div className={styles.footer}>
      <button
        type="button"
        className={styles.blueprints}
        data-ready={!!onBlueprints}
        onClick={onBlueprints}
        title={`${hiker.name}’s blueprints: teach one to a hiker on this tile`}
      >
        <Icon name="book" size={18} />
        Blueprints{n ? ` · ${n}` : ''}
      </button>
      <EndButton state={state} onEndPhase={onEndPhase} />
    </div>
  );
}
