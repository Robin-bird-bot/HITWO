/**
 * The right panel: the selected hiker's turn (docs/mockups/Main.dc.html).
 * Actions, abilities, the current tile, equipped items, bag and resources.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ITEMS } from '../../content';
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
import { usePreview } from '../preview/preview';
import { mergeHandlers } from '../app/mergeHandlers';
import { useDrag, useDrop, type DropProps } from '../drag/drag';
import { NO_DROP, useItemDrops } from '../drag/itemDrops';
import { useStage } from '../stage/StageContext';
import { FEATURE_LOOK, NODE_IMAGE, NODE_NAME, SPECIAL_LOOK } from '../map/looks';
import { groupActionStates, tileName, type ActionId, type ActionState } from './hikerInfo';
import { Panel } from './Panel';
import panel from './Panel.module.css';
import { BoostChips } from '../items/BoostChips';
import { itemVerbs } from '../items/whatItDoes';
import { badgeColors, traitBadges } from '../traits/badges';
import { TraitBadge } from '../traits/TraitBadge';
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
  /** Opens the Merchant or Traveling Trader on the hiker's tile. */
  onFeature?(): void;
  /** The hikers picked together (multi-select), in turn order. */
  group?: readonly HikerId[];
  /** A tapped usable badge: the Abilities panel opens at it. */
  focusAbility?: AbilityFocus | undefined;
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
  onFeature,
  group,
  focusAbility,
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
            <ActionGrid
              state={state}
              hiker={hiker}
              onAction={onAction}
              note={note}
              slot={slot}
              {...(group ? { group } : {})}
            />
            <Abilities
              key={focusAbility?.at ?? 0}
              state={state}
              hiker={hiker}
              onAbility={onAbility}
              focus={focusAbility}
            />
          </>
        ) : (
          <OutCard state={state} hiker={hiker} {...(onAbandon ? { onAbandon } : {})} />
        )}
        {onFree && <CarryCard state={state} hiker={hiker} onFree={onFree} />}
        <TileCard
          state={state}
          hiker={hiker}
          {...(onFeature ? { onFeature } : {})}
          {...(onFree ? { onFree } : {})}
        />
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
  group,
}: {
  state: GameState;
  hiker: Hiker;
  onAction(id: ActionId): void;
  note?: string;
  slot?: ReactNode;
  group?: readonly HikerId[];
}) {
  const actions = groupActionStates(state, hiker, group);
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

/** A usable badge was tapped: the Abilities panel opens at that ability. */
export interface AbilityFocus {
  hikerId: HikerId;
  abilityId: string;
  /** Counts up with each tap, so tapping the same badge again shows it again. */
  at: number;
}

/**
 * The Abilities panel (docs/mockups/TraitBadges.dc.html): only usable
 * traits, each with its badge, what it does and USE. One only usable during
 * something says so in place of the button; a used one says when it's back.
 * Mount it with `key={focus?.at}` so a tapped badge opens it fresh.
 */
export function Abilities({
  state,
  hiker,
  onAbility,
  focus,
}: {
  state: GameState;
  hiker: Hiker;
  onAbility(abilityId: string, choice?: string): void;
  /** The ability a tapped badge points at: scrolled to, lit up, its choices open. */
  focus?: AbilityFocus | undefined;
}) {
  const abilities = abilitiesFor(state, hiker);
  const badges = traitBadges(state, hiker).filter((b) => b.shape === 'circle');
  const focused = focus?.hikerId === hiker.id ? focus.abilityId : undefined;
  const hasChoices = (id: string | undefined) =>
    !!id && !!abilities.find((a) => a.ability.id === id)?.choices;
  const [choosing, setChoosing] = useState<string | null>(
    hasChoices(focused) ? (focused ?? null) : null,
  );
  /** An ability that picks resources after its choice (Spare Parts): what's picked so far. */
  const [picking, setPicking] = useState<{ id: string; base: string; picked: string[] } | null>(
    null,
  );
  const rows = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!focused) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    rows.current[focused]?.scrollIntoView({
      block: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [focused, focus?.at]);

  return (
    <div className={styles.block}>
      <span className={panel.label}>ABILITIES</span>
      {badges.length === 0 && <span className={styles.muted}>No usable traits.</span>}
      {badges.map((badge) => {
        const available = abilities.find((a) => a.ability.id === badge.abilityId);
        if (!available || !badge.abilityId) return null;
        const { ability, choices } = available;
        const id = badge.abilityId;
        const color = badgeColors(badge).ring;
        const used = badge.state === 'used';
        return (
          <div
            key={id}
            ref={(el) => {
              rows.current[id] = el;
            }}
            className={styles.ability}
            data-used={used}
            data-focus={focused === id || undefined}
            style={used ? undefined : { borderColor: `${color}59`, background: `${color}14` }}
          >
            <div className={styles.abilityHead}>
              <TraitBadge badge={badge} size="large" showTab as="span" />
              <div className={styles.abilityText}>
                <span className={styles.abilityName} style={{ color }}>
                  {badge.name.toUpperCase()} ·{' '}
                  {Number.isFinite(ability.limit.uses)
                    ? `${ability.limit.uses}/${PER[ability.limit.per]}`
                    : 'ANY TIME'}
                </span>
                <span className={styles.small}>{badge.text}</span>
                {(used || badge.state === 'during') && badge.status && (
                  <span className={styles.muted}>{badge.status.text}</span>
                )}
              </div>
              {badge.state === 'ready' && (
                <button
                  type="button"
                  className={styles.use}
                  style={{ background: color }}
                  aria-expanded={choices ? choosing === id : undefined}
                  onClick={() =>
                    choices ? setChoosing(choosing === id ? null : id) : onAbility(id)
                  }
                >
                  USE
                </button>
              )}
            </div>
            {choosing === id && choices && badge.state === 'ready' && picking?.id !== id && (
              <div className={styles.choices}>
                {choices.length === 0 && (
                  <span className={styles.muted}>Nothing to use it on right now.</span>
                )}
                {choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.choice}
                    onClick={() => {
                      if (ability.resourcePick) {
                        setPicking({ id, base: c.id, picked: [] });
                        return;
                      }
                      setChoosing(null);
                      onAbility(id, c.id);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {picking?.id === id && ability.resourcePick && badge.state === 'ready' && (
              <ResourcePick
                count={ability.resourcePick}
                picked={picking.picked}
                onPick={(picked) => setPicking({ ...picking, picked })}
                onBack={() => setPicking(null)}
                onDone={() => {
                  setPicking(null);
                  setChoosing(null);
                  onAbility(id, `${picking.base}|${picking.picked.join(',')}`);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const PER = { day: 'DAY', phase: 'PHASE', biome: 'BIOME' };

/**
 * Picking resources for an ability (Spare Parts): any of the 16, repeats
 * allowed. Tap a resource to add it, tap a picked one to take it back.
 */
function ResourcePick({
  count,
  picked,
  onPick,
  onBack,
  onDone,
}: {
  count: number;
  picked: string[];
  onPick(picked: string[]): void;
  onBack(): void;
  onDone(): void;
}) {
  const name = (id: string) => RESOURCES.find((r) => r.id === id)?.name ?? id;
  return (
    <div className={styles.resourcePick}>
      <span className={styles.small}>
        Pick {count} resources ({picked.length}/{count}):
      </span>
      <div className={styles.pickedRow}>
        {Array.from({ length: count }, (_, i) => {
          const id = picked[i];
          return id ? (
            <button
              key={i}
              type="button"
              className={styles.pickedOne}
              aria-label={`Take back ${name(id)}`}
              title={`Take back ${name(id)}`}
              onClick={() => onPick(picked.filter((_, k) => k !== i))}
            >
              <img src={ASSETS.resources[id]} alt="" width={26} height={26} />
            </button>
          ) : (
            <span key={i} className={styles.pickedOne} data-empty />
          );
        })}
      </div>
      <div className={styles.resourceGrid}>
        {RESOURCES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={styles.resourceButton}
            disabled={picked.length >= count}
            aria-label={`Add ${r.name}`}
            title={r.name}
            onClick={() => onPick([...picked, r.id])}
          >
            <img src={ASSETS.resources[r.id]} alt="" width={26} height={26} />
          </button>
        ))}
      </div>
      <div className={styles.choices}>
        <button type="button" className={styles.choice} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className={styles.choice}
          disabled={picked.length !== count}
          onClick={onDone}
        >
          Take apart
        </button>
      </div>
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

export function TileCard({
  state,
  hiker,
  onFeature,
  onFree,
}: {
  state: GameState;
  hiker: Hiker;
  /** Opens the tile's Merchant or Traveling Trader. */
  onFeature?(): void;
  /** Free actions here: a bite of someone's camp meal, packing up a shelter. */
  onFree?(action: Action): void;
}) {
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
            disabled={!onFeature || !tile.shop || hiker.status !== 'active'}
            title={
              hiker.status === 'active'
                ? `Visit the ${FEATURE_LOOK[tile.feature].name} (free)`
                : `Only an active hiker can visit the ${FEATURE_LOOK[tile.feature].name}`
            }
            onClick={onFeature}
          >
            <Icon name={FEATURE_LOOK[tile.feature].icon} size={14} strokeWidth={2.25} />
            {tile.feature === 'merchant' ? 'Merchant' : 'Trader'}
          </button>
        )}
      </div>
      <BoostChips state={state} hiker={hiker} />
      {onFree && <CampMeals state={state} hiker={hiker} onFree={onFree} />}
    </>
  );
}

/**
 * Camp meals on this tile (Rotisserie Chicken, Phase 10.6): another hiker's,
 * which this hiker can eat a bite of without trading. Eating asks first.
 */
function CampMeals({
  state,
  hiker,
  onFree,
}: {
  state: GameState;
  hiker: Hiker;
  onFree(action: Action): void;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  if (hiker.status !== 'active') return null;
  const meals = hikersOnTile(state, hiker.tileId)
    .filter((h) => h.id !== hiker.id)
    .flatMap((owner) =>
      owner.inventory.bag.filter((i) => ITEMS[i.itemId]?.campMeal).map((item) => ({ owner, item })),
    );
  if (!meals.length) return null;
  return (
    <div className={styles.campMeals}>
      {meals.map(({ owner, item }) => {
        const def = ITEMS[item.itemId];
        const action: Action = {
          type: 'eat',
          hikerId: hiker.id,
          itemUid: item.uid,
          fromHikerId: owner.id,
        };
        const reason = validateAction(state, action);
        const bites = item.bitesLeft ?? 1;
        const label = `${owner.name}’s ${def?.name ?? 'meal'}`;
        return (
          <div key={item.uid} className={styles.campMeal}>
            <Icon name="utensils" size={15} color="#E9B44C" />
            <span className={styles.small}>
              <b>CAMP MEAL</b> · {label} · {bites} bite{bites === 1 ? '' : 's'}
            </span>
            {asking === item.uid ? (
              <>
                <button
                  type="button"
                  className={styles.feature}
                  onClick={() => {
                    setAsking(null);
                    onFree(action);
                  }}
                >
                  Eat a bite
                </button>
                <button type="button" className={styles.feature} onClick={() => setAsking(null)}>
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.feature}
                disabled={!!reason}
                title={reason ?? `${hiker.name} eats a bite of ${label}`}
                onClick={() => setAsking(item.uid)}
              >
                Eat
              </button>
            )}
          </div>
        );
      })}
    </div>
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
  // Clothes dragged from the bag go on their own slot (Nov 14 update).
  const drops = useItemDrops();
  const slotDrop = useDrop('slot', drops.slot ?? NO_DROP);
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
              drop={slotDrop.props(slot)}
              worn
              {...(onPick
                ? {
                    onClick: (e: React.MouseEvent<HTMLElement>) =>
                      onPick({ kind: 'equipped', slot, top: stageTop(e.currentTarget) }),
                  }
                : {})}
            />
          ) : (
            <div
              key={slot}
              className={styles.empty}
              data-size="large"
              title={`${label}: empty`}
              {...slotDrop.props(slot)}
            >
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
  dragFrom,
  drop,
  onClick,
}: {
  item: ItemInstance;
  size: 'large' | 'small';
  /** Clothes being worn: the menu takes them off. */
  worn?: boolean;
  /** Whose bag it's in, when it can be dragged (Nov 14 update). */
  dragFrom?: HikerId;
  /** A worn slot: a drop spot for clothes. */
  drop?: DropProps;
  onClick?(e: React.MouseEvent<HTMLElement>): void;
}) {
  const def = ITEMS[item.itemId];
  const name = def?.name ?? item.itemId;
  const what = worn ? 'take off' : itemVerbs(item.itemId);
  // Hover or long-press: the full card (Nov 14 update).
  const preview = usePreview({ kind: 'item', itemId: item.itemId, item });
  const face = (
    <CardFace itemId={item.itemId} item={item} width={size === 'large' ? 64 : 46} compact />
  );
  const drag = useDrag(
    dragFrom ? { kind: 'item', hikerId: dragFrom, itemUid: item.uid } : null,
    <CardFace itemId={item.itemId} item={item} width={64} compact />,
  );
  if (!onClick) {
    return (
      <div className={styles.itemCard} data-size={size} {...preview} {...drop}>
        {face}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={styles.itemCard}
      data-size={size}
      {...mergeHandlers({ onClick }, preview, drag)}
      {...drop}
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
  const dragFrom = useItemDrops().packs && hiker.status === 'active' ? hiker.id : undefined;
  const items = hiker.inventory.bag;
  const extra = slots.fromItems.map((i) => `${i.count} from ${i.name}`).join(', ');
  const cells: { kind: 'base' | 'item'; from?: string }[] = [
    ...Array.from({ length: slots.base }, () => ({ kind: 'base' as const })),
    ...slots.fromItems.flatMap((i) =>
      Array.from({ length: i.count }, () => ({ kind: 'item' as const, from: i.name })),
    ),
  ];
  return (
    <div className={styles.block} data-pack-of={hiker.id} data-pack="bag">
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
                {...(dragFrom ? { dragFrom } : {})}
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
  const dragFrom = useItemDrops().packs && hiker.status === 'active' ? hiker.id : undefined;
  return (
    <div className={styles.block} data-pack-of={hiker.id} data-pack="resources">
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
              <ResourceButton
                key={r.id}
                hikerId={dragFrom}
                resource={r.id}
                title={`${r.name} ×${n}`}
                aria-label={`${r.name} ×${n}: give or return`}
                onClick={(e) =>
                  onPick({ kind: 'resource', id: r.id, top: stageTop(e.currentTarget) })
                }
              >
                {content}
              </ResourceButton>
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

/** A resource in the pack: a menu on click, and a drag source (Nov 14 update). */
function ResourceButton({
  hikerId,
  resource,
  children,
  ...rest
}: {
  hikerId: HikerId | undefined;
  resource: ResourceId;
  children: ReactNode;
} & React.ComponentProps<'button'>) {
  const drag = useDrag(
    hikerId ? { kind: 'resource', hikerId, resource } : null,
    <img src={ASSETS.resources[resource]} alt="" width={44} height={44} />,
  );
  return (
    <button type="button" className={styles.resource} {...rest} {...drag}>
      {children}
    </button>
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
