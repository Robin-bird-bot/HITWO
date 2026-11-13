/**
 * The menu for a resource or bag item the player clicked in the turn panel:
 * eat it or put it on, give it to a hiker on the same tile (anywhere, with a
 * Walkie-Talkie), (resources) return it to nature for +1 Abundance, (tools)
 * use it, or (items) drop it for good. Eating, using and dropping ask a second
 * time, since they can't be undone. All free actions. Closes on click-away or
 * Esc.
 */
import { useState } from 'react';
import { ITEMS } from '../../content';
import { CONDITIONS } from '../../content/conditions';
import { RESOURCES } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  bagSlots,
  biteAppetite,
  clothesOf,
  fullDurability,
  hikersOnTile,
  itemText,
  mapTargets,
  negativeConditions,
  nodeChoices,
  qualityOf,
  resourceChoices,
  resourceCount,
  resourceLimit,
  statMax,
  tradesAnywhere,
  choiceOfUse,
  targetOfUse,
  validateAction,
  type Action,
  type EquipSlot,
  type GameState,
  type Hiker,
  type StatName,
  type UseChoice,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { tileName } from '../panels/hikerInfo';
import { Popout } from '../panels/Popout';
import type { StashPick } from '../panels/TurnPanel';
import { usesAfter, whatItDoes } from '../items/whatItDoes';
import { ItemCard as CardFace } from '../items/ItemCard';
import styles from './StashMenu.module.css';

interface StashMenuProps {
  state: GameState;
  hiker: Hiker;
  pick: StashPick;
  onDispatch(action: Action): void;
  onClose(): void;
  /** A map tool: pick its tile on the map. */
  onMapTool?(itemUid: string): void;
}

const WIDTH = 260;

/** Using an item: who it's for, what to pick (a condition, a stat…), then a confirm. */
type UseStep = { targetId: string; value?: string; picking?: UseChoice };

export function StashMenu(props: StashMenuProps) {
  return props.pick.kind === 'equipped' ? (
    <WornMenu {...props} slot={props.pick.slot} top={props.pick.top} />
  ) : (
    <PackMenu {...props} />
  );
}

/** Clothes a hiker has on: take them off (or, for a passed-out hiker, someone here takes them). */
function WornMenu({
  state,
  hiker,
  slot,
  top,
  onDispatch,
  onClose,
}: StashMenuProps & { slot: EquipSlot; top: number }) {
  const item = hiker.inventory.equipped[slot];
  if (!item) return null;
  const name = ITEMS[item.itemId]?.name ?? 'Clothes';
  const act = (action: Action) => {
    onDispatch(action);
    onClose();
  };
  const choices: { label: string; action: Action }[] =
    hiker.status === 'active'
      ? [{ label: 'Take off', action: { type: 'takeOff', hikerId: hiker.id, slot } }]
      : hikersOnTile(state, hiker.tileId)
          .filter((h) => h.id !== hiker.id)
          .map((h) => ({
            label: `${h.name} takes it off`,
            action: { type: 'takeOff', hikerId: hiker.id, slot, toId: h.id },
          }));
  return (
    <Popout
      label={`${name}: take off`}
      dragId="inventory"
      className={styles.menu}
      style={{
        left: 1240 - WIDTH - 12,
        top: Math.max(16, Math.min(top - 20, 1000 - 280)),
        width: WIDTH,
      }}
      onClose={onClose}
    >
      <div className={styles.preview}>
        <CardFace itemId={item.itemId} item={item} width={180} />
      </div>
      <span className={styles.head} data-drag-handle>
        {name.toUpperCase()}
      </span>
      {choices.length === 0 && (
        <span className={styles.none}>No one is here to take it off them.</span>
      )}
      {choices.map((c) => {
        const reason = validateAction(state, c.action);
        return (
          <button
            key={c.label}
            type="button"
            className={styles.option}
            disabled={!!reason}
            title={reason ?? undefined}
            onClick={() => act(c.action)}
          >
            <Icon name="shirt" size={16} />
            {c.label}
            {reason && (
              <span className={styles.full}>{reason.includes('full') ? 'Bag full' : ''}</span>
            )}
          </button>
        );
      })}
    </Popout>
  );
}

function PackMenu({ state, hiker, pick, onDispatch, onClose, onMapTool }: StashMenuProps) {
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [useStep, setUseStep] = useState<UseStep | null>(null);
  // A passed-out hiker can't act: others here can only take things from them.
  const out = hiker.status !== 'active';
  // A Walkie-Talkie (either hiker's) reaches anyone on the trail.
  const others = state.hikers.filter(
    (h) =>
      h.id !== hiker.id &&
      h.status === 'active' &&
      (h.tileId === hiker.tileId ||
        (!out && (tradesAnywhere(state, hiker) || tradesAnywhere(state, h)))),
  );
  const resource = pick.kind === 'resource' ? RESOURCES.find((r) => r.id === pick.id) : undefined;
  const item =
    pick.kind === 'item' ? hiker.inventory.bag.find((i) => i.uid === pick.uid) : undefined;
  const count = resource ? (hiker.inventory.resources[resource.id] ?? 0) : 1;
  if ((!resource || count < 1) && !item) return null;

  const name = resource?.name ?? ITEMS[item?.itemId ?? '']?.name ?? 'Item';
  const usable = !!item && !!ITEMS[item.itemId]?.use && hiker.status === 'active';
  const roomFor = (h: Hiker) =>
    resource
      ? resourceCount(h) < resourceLimit(state, h)
      : h.inventory.bag.length < bagSlots(state, h).total;
  const act = (action: Action) => {
    onDispatch(action);
    onClose();
  };

  return (
    <Popout
      label={`${name}: ${out ? 'take it' : `give${resource ? ' or return' : ' or drop'}`}`}
      dragId="inventory"
      className={styles.menu}
      style={{
        left: 1240 - WIDTH - 12,
        // A usable item lists everyone here, so it needs more room below.
        top: Math.max(16, Math.min(pick.top - 20, 1000 - (usable ? 520 : 300))),
        width: WIDTH,
      }}
      onClose={onClose}
    >
      {item && (
        // The whole card, beside the menu, so its effect and Quality are easy to read.
        <div className={styles.preview}>
          <CardFace itemId={item.itemId} item={item} width={180} />
        </div>
      )}
      <span className={styles.head} data-drag-handle>
        {resource && <img src={ASSETS.resources[resource.id]} alt="" width={28} height={28} />}
        {name.toUpperCase()}
        {resource && count > 1 && <span className={styles.count}>×{count}</span>}
      </span>

      {item && !out && !useStep && (
        <>
          <EatSection state={state} hiker={hiker} itemUid={item.uid} name={name} onEat={act} />
          <PutOn state={state} hiker={hiker} itemUid={item.uid} onPutOn={act} />
          <PlaceSection state={state} hiker={hiker} itemUid={item.uid} name={name} onPlace={act} />
          {ITEMS[item.itemId]?.notYet && (
            <span className={styles.none}>{ITEMS[item.itemId]?.notYet}</span>
          )}
        </>
      )}

      {item && hiker.inventory.bag.length > bagSlots(state, hiker).total && (
        <span className={styles.over}>
          {hiker.name} has more items than fit (Weak). Give one away or drop one.
        </span>
      )}
      {others.length === 0 && (
        <span className={styles.none}>
          {out ? 'No one is here to take it.' : 'No one else is here to give it to.'}
        </span>
      )}
      {others.map((h) => {
        const room = roomFor(h);
        return (
          <button
            key={h.id}
            type="button"
            className={styles.option}
            disabled={!room}
            onClick={() =>
              act(
                resource
                  ? { type: 'give', fromId: hiker.id, toId: h.id, resource: resource.id }
                  : { type: 'give', fromId: hiker.id, toId: h.id, itemUid: item?.uid ?? '' },
              )
            }
          >
            <Icon name="user" size={16} />
            {out ? `${h.name} takes it` : `Give to ${h.name}`}
            {h.tileId !== hiker.tileId && <span className={styles.gain}>by Walkie-Talkie</span>}
            {!room && <span className={styles.full}>{resource ? 'Full' : 'Bag full'}</span>}
          </button>
        );
      })}

      {resource && !out && (
        <button
          type="button"
          className={styles.option}
          onClick={() => act({ type: 'returnToNature', hikerId: hiker.id, resource: resource.id })}
        >
          <Icon name="sprout" size={16} />
          Return to nature
          <span className={styles.gain}>
            +{BALANCE.abundance.returnToNature}
            <img
              src={NODE_IMAGE[resource.node]}
              alt={NODE_NAME[resource.node]}
              width={16}
              height={18}
            />
          </span>
        </button>
      )}

      {item && usable && (
        <UseSection
          state={state}
          hiker={hiker}
          itemUid={item.uid}
          name={name}
          step={useStep}
          setStep={setUseStep}
          onUse={act}
          {...(onMapTool ? { onMapTool } : {})}
        />
      )}

      {item &&
        !useStep &&
        !out &&
        (confirmDrop ? (
          <div className={styles.confirm}>
            <span className={styles.none}>Drop the {name} for good? It can’t be undone.</span>
            <button
              type="button"
              className={`${styles.option} ${styles.danger}`}
              onClick={() => act({ type: 'dropItem', hikerId: hiker.id, itemUid: item.uid })}
            >
              <Icon name="x" size={16} />
              Yes, drop it
            </button>
            <button type="button" className={styles.option} onClick={() => setConfirmDrop(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" className={styles.option} onClick={() => setConfirmDrop(true)}>
            <Icon name="x" size={16} />
            Drop it
          </button>
        ))}
    </Popout>
  );
}

/** The hikers here who can be helped: everyone on the tile, passed out included. */
function onTile(state: GameState, hiker: Hiker): Hiker[] {
  return state.hikers.filter(
    (h) => h.tileId === hiker.tileId && (h.status === 'active' || h.status === 'passedOut'),
  );
}

const STAT_NAME: Record<StatName, string> = {
  appetite: 'Appetite',
  energy: 'Energy',
  morale: 'Morale',
};

interface PickOption {
  value: string;
  label: string;
  image?: string;
}

/** What the player can pick for this use on this hiker (a condition, a stat, a node…). */
function pickOptions(state: GameState, user: Hiker, target: Hiker, kind: UseChoice): PickOption[] {
  switch (kind) {
    case 'condition':
      return negativeConditions(target).map((c) => ({
        value: c.id,
        label: CONDITIONS[c.id]?.name ?? c.id,
      }));
    case 'stat':
      return (['appetite', 'energy', 'morale'] as const).map((stat) => ({
        value: stat,
        label: `${STAT_NAME[stat]} ${target.stats[stat]}/${statMax(state, target, stat)}`,
      }));
    case 'clothes':
      return clothesOf(target).map((c) => {
        const def = ITEMS[c.itemId];
        const full = def ? fullDurability(def, qualityOf(c)) : 0;
        return {
          value: c.uid,
          label: `${def?.name ?? 'Clothes'} ${c.durability ?? full}/${full}`,
        };
      });
    case 'node':
      return nodeChoices(state, user).map((n) => ({
        value: n,
        label: NODE_NAME[n],
        image: NODE_IMAGE[n],
      }));
    case 'tile':
      // Map tools pick on the map itself. TODO(phase 8): the map-pick mode (step 8).
      return [];
    case 'resource':
      return resourceChoices(state, user).map((r) => ({
        value: r,
        label: RESOURCES.find((x) => x.id === r)?.name ?? r,
        image: ASSETS.resources[r],
      }));
  }
}

const PICK_QUESTION: Record<UseChoice, string> = {
  condition: 'Which condition should it cure?',
  stat: 'Which stat should it fill?',
  clothes: 'Which clothing item?',
  node: 'Which node should it add?',
  resource: 'Which resource?',
  tile: 'Which tile?',
};

/** Using a tool: who it's for, anything to pick, then a confirm (it can't be undone). */
function UseSection({
  state,
  hiker,
  itemUid,
  name,
  step,
  setStep,
  onUse,
  onMapTool,
}: {
  state: GameState;
  hiker: Hiker;
  itemUid: string;
  name: string;
  step: UseStep | null;
  setStep(step: UseStep | null): void;
  onUse(action: Action): void;
  onMapTool?(itemUid: string): void;
}) {
  const item = hiker.inventory.bag.find((i) => i.uid === itemUid);
  const use = item && ITEMS[item.itemId]?.use;
  if (!item || !use) return null;
  const kind = choiceOfUse(use);
  // A map tool: the tile is picked on the map, with its own confirm there.
  if (kind === 'tile' && use.map) {
    const tiles = mapTargets(state, hiker, use.map);
    const reasons = tiles.map((tileId) =>
      validateAction(state, {
        type: 'useItem',
        hikerId: hiker.id,
        itemUid,
        targetId: hiker.id,
        choice: tileId,
      }),
    );
    const ready = reasons.some((r) => r === null);
    const why = ready ? null : (reasons.find(Boolean) ?? 'There’s nowhere to use it from here.');
    return (
      <button
        type="button"
        className={`${styles.option} ${styles.tall}`}
        disabled={!ready || !onMapTool}
        title={why ?? undefined}
        onClick={() => onMapTool?.(itemUid)}
      >
        <Icon name="crosshair" size={16} />
        <span className={styles.useText}>
          Pick a tile on the map
          <span className={styles.effect}>
            {why ?? itemText(ITEMS[item.itemId]!, qualityOf(item))}
          </span>
        </span>
      </button>
    );
  }
  const mode = targetOfUse(use);
  const icon =
    use.injuries || use.cures || use.pickCondition || use.allNegative ? 'medical' : 'sparkles';
  const action = (targetId: string, value?: string): Action => ({
    type: 'useItem',
    hikerId: hiker.id,
    itemUid,
    targetId,
    ...(value !== undefined
      ? kind === 'condition'
        ? { conditionId: value }
        : { choice: value }
      : {}),
  });
  /** The picks that work for this hiker, or none when there's nothing to pick. */
  const workingPicks = (h: Hiker) => {
    const all = kind ? pickOptions(state, hiker, h, kind) : [];
    return all.filter((o) => !validateAction(state, action(h.id, o.value)));
  };
  /** Why using it on this hiker wouldn't work, if it wouldn't. */
  const reasonFor = (h: Hiker): string | null => {
    const all = kind ? pickOptions(state, hiker, h, kind) : [];
    if (!all.length) return validateAction(state, action(h.id));
    if (workingPicks(h).length) return null;
    return validateAction(state, action(h.id, all[0]?.value));
  };
  const begin = (h: Hiker) => {
    const picks = workingPicks(h);
    if (kind && picks.length > 1) setStep({ targetId: h.id, picking: kind });
    else setStep({ targetId: h.id, ...(picks[0] ? { value: picks[0].value } : {}) });
  };

  const target = step && state.hikers.find((h) => h.id === step.targetId);

  // Picking a condition, stat, clothing item, node or resource.
  if (step?.picking && target) {
    return (
      <div className={styles.confirm}>
        <span className={styles.none}>{PICK_QUESTION[step.picking]}</span>
        {pickOptions(state, hiker, target, step.picking).map((o) => {
          const reason = validateAction(state, action(target.id, o.value));
          return (
            <button
              key={o.value}
              type="button"
              className={styles.option}
              disabled={!!reason}
              title={reason ?? undefined}
              onClick={() => setStep({ targetId: target.id, value: o.value })}
            >
              {o.image ? (
                <img src={o.image} alt="" width={20} height={20} />
              ) : (
                <Icon name={icon} size={16} />
              )}
              {o.label}
            </button>
          );
        })}
        <button type="button" className={styles.option} onClick={() => setStep(null)}>
          Back
        </button>
      </div>
    );
  }

  // The confirm: what it will do, and how many uses are left after.
  if (step && target) {
    const picked = kind === 'condition' ? { conditionId: step.value } : { choice: step.value };
    const words = whatItDoes(state, item, target, picked);
    const onWhom =
      mode === 'tile' ? ' for everyone here' : target.id === hiker.id ? '' : ` on ${target.name}`;
    return (
      <div className={styles.confirm}>
        <span className={styles.none}>
          Use the {name}
          {onWhom}? {capitalize(words.join(', '))}. {usesAfter(item, name)}
        </span>
        <button
          type="button"
          className={`${styles.option} ${styles.useIt}`}
          onClick={() => onUse(action(target.id, step.value))}
        >
          <Icon name={icon} size={16} />
          Yes, use it
        </button>
        <button type="button" className={styles.option} onClick={() => setStep(null)}>
          Keep it
        </button>
      </div>
    );
  }

  // For the user or the whole tile: one button.
  if (mode !== 'hiker') {
    const reason = reasonFor(hiker);
    const words = reason ? [] : whatItDoes(state, item, hiker);
    return (
      <button
        type="button"
        className={`${styles.option} ${styles.tall}`}
        disabled={!!reason}
        title={reason ?? undefined}
        onClick={() => begin(hiker)}
      >
        <Icon name={icon} size={16} />
        <span className={styles.useText}>
          {mode === 'tile' ? 'Use for everyone here' : `Use the ${name}`}
          <span className={styles.effect}>
            {reason ?? (kind ? '' : capitalize(words.join(', ')))}
          </span>
        </span>
      </button>
    );
  }

  return (
    <>
      <span className={styles.label}>USE ON</span>
      {onTile(state, hiker).map((h) => {
        const reason = reasonFor(h);
        const picks = reason ? [] : workingPicks(h);
        const many = !!kind && picks.length > 1;
        const words = reason
          ? []
          : whatItDoes(
              state,
              item,
              h,
              kind === 'condition' ? { conditionId: picks[0]?.value } : { choice: picks[0]?.value },
            );
        return (
          <button
            key={h.id}
            type="button"
            className={`${styles.option} ${styles.tall}`}
            disabled={!!reason}
            title={reason ?? undefined}
            onClick={() => begin(h)}
          >
            <Icon name={icon} size={16} />
            <span className={styles.useText}>
              {h.id === hiker.id ? `${h.name} (self)` : h.name}
              <span className={styles.effect}>
                {reason
                  ? 'Wouldn’t help right now'
                  : many
                    ? `Pick 1 of ${picks.length}`
                    : capitalize(words.join(', '))}
              </span>
            </span>
          </button>
        );
      })}
    </>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Food: eat a bite (asks first, since it can't be undone). */
function EatSection({
  state,
  hiker,
  itemUid,
  name,
  onEat,
}: {
  state: GameState;
  hiker: Hiker;
  itemUid: string;
  name: string;
  onEat(action: Action): void;
}) {
  const [asking, setAsking] = useState(false);
  const item = hiker.inventory.bag.find((i) => i.uid === itemUid);
  if (!item || ITEMS[item.itemId]?.type !== 'food') return null;
  const action: Action = { type: 'eat', hikerId: hiker.id, itemUid };
  const reason = validateAction(state, action);
  const bites = item.bitesLeft ?? 1;
  const after = bites - 1;
  const mod = biteAppetite(item, 0);
  const note =
    mod !== 0 ? `This card gives ${Math.abs(mod)} ${mod > 0 ? 'more' : 'less'} Appetite.` : '';

  if (asking) {
    return (
      <div className={styles.confirm}>
        <span className={styles.none}>
          {hiker.name} eats {bites > 1 ? `a bite of the ${name}` : `the ${name}`}?{' '}
          {after > 0 ? `${after} bite${after === 1 ? '' : 's'} left after.` : 'That finishes it.'}
        </span>
        <button
          type="button"
          className={`${styles.option} ${styles.useIt}`}
          onClick={() => onEat(action)}
        >
          <Icon name="utensils" size={16} />
          Yes, eat it
        </button>
        <button type="button" className={styles.option} onClick={() => setAsking(false)}>
          Not now
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.option} ${styles.tall}`}
      disabled={!!reason}
      title={reason ?? undefined}
      onClick={() => setAsking(true)}
    >
      <Icon name="utensils" size={16} />
      <span className={styles.useText}>
        {bites > 1 ? `Eat a bite (${bites} left)` : 'Eat it'}
        {(reason || note) && <span className={styles.effect}>{reason ?? note}</span>}
      </span>
    </button>
  );
}

/** A shelter: place it on this tile (asks first, since it can't be picked up again). */
function PlaceSection({
  state,
  hiker,
  itemUid,
  name,
  onPlace,
}: {
  state: GameState;
  hiker: Hiker;
  itemUid: string;
  name: string;
  onPlace(action: Action): void;
}) {
  const [asking, setAsking] = useState(false);
  const item = hiker.inventory.bag.find((i) => i.uid === itemUid);
  const def = item && ITEMS[item.itemId];
  if (!item || def?.type !== 'shelter') return null;
  const action: Action = { type: 'placeShelter', hikerId: hiker.id, itemUid };
  const reason = validateAction(state, action);
  const nights = def.nights ?? 1;
  const lasts = `${nights} night${nights === 1 ? '' : 's'}`;
  const tile = state.section.tiles[hiker.tileId];
  const where = tile ? tileName(tile) : 'this tile';

  if (asking) {
    return (
      <div className={styles.confirm}>
        <span className={styles.none}>
          Place the {name} on {where}? It stays there for {lasts}, then it’s gone.
        </span>
        <button
          type="button"
          className={`${styles.option} ${styles.useIt}`}
          onClick={() => onPlace(action)}
        >
          <Icon name="tent" size={16} />
          Yes, place it
        </button>
        <button type="button" className={styles.option} onClick={() => setAsking(false)}>
          Not now
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.option} ${styles.tall}`}
      disabled={!!reason}
      title={reason ?? undefined}
      onClick={() => setAsking(true)}
    >
      <Icon name="tent" size={16} />
      <span className={styles.useText}>
        Place here
        <span className={styles.effect}>{reason ?? `Lasts ${lasts}`}</span>
      </span>
    </button>
  );
}

/** Clothes in the bag: put them on (swapping out whatever is in that slot). */
function PutOn({
  state,
  hiker,
  itemUid,
  onPutOn,
}: {
  state: GameState;
  hiker: Hiker;
  itemUid: string;
  onPutOn(action: Action): void;
}) {
  const item = hiker.inventory.bag.find((i) => i.uid === itemUid);
  const def = item && ITEMS[item.itemId];
  if (def?.type !== 'clothes' || !def.slot) return null;
  const old = hiker.inventory.equipped[def.slot];
  const action: Action = { type: 'putOn', hikerId: hiker.id, itemUid };
  const reason = validateAction(state, action);
  return (
    <button
      type="button"
      className={styles.option}
      disabled={!!reason}
      title={reason ?? undefined}
      onClick={() => onPutOn(action)}
    >
      <Icon name="shirt" size={16} />
      {old ? `Put on (for the ${ITEMS[old.itemId]?.name ?? 'old one'})` : 'Put on'}
    </button>
  );
}
