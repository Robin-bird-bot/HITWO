/**
 * The menu for a resource or bag item the player clicked in the turn panel:
 * give it to a hiker on the same tile, (resources) return it to nature for
 * +1 Abundance, (medical items) use it on someone here, or (items) drop it for
 * good. Using and dropping ask a second time, since they can't be undone.
 * All free actions. Closes on click-away or Esc.
 */
import { useState } from 'react';
import { ITEMS } from '../../content';
import { CONDITIONS } from '../../content/conditions';
import { RESOURCES } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  bagSlots,
  hikersOnTile,
  negativeConditions,
  resourceCount,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { Popout } from '../panels/Popout';
import type { StashPick } from '../panels/TurnPanel';
import { whatItDoes } from '../items/whatItDoes';
import styles from './StashMenu.module.css';

interface StashMenuProps {
  state: GameState;
  hiker: Hiker;
  pick: StashPick;
  onDispatch(action: Action): void;
  onClose(): void;
}

const WIDTH = 260;

/** Using an item: who it's for, which condition (if it cures one you pick), then a confirm. */
type UseStep = { targetId: string; conditionId?: string; picking?: boolean };

export function StashMenu({ state, hiker, pick, onDispatch, onClose }: StashMenuProps) {
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [useStep, setUseStep] = useState<UseStep | null>(null);
  const others = hikersOnTile(state, hiker.tileId).filter(
    (h) => h.id !== hiker.id && h.status === 'active',
  );
  const resource = pick.kind === 'resource' ? RESOURCES.find((r) => r.id === pick.id) : undefined;
  const item =
    pick.kind === 'item' ? hiker.inventory.bag.find((i) => i.uid === pick.uid) : undefined;
  const count = resource ? (hiker.inventory.resources[resource.id] ?? 0) : 1;
  if ((!resource || count < 1) && !item) return null;

  const name = resource?.name ?? ITEMS[item?.itemId ?? '']?.name ?? 'Item';
  const usable = !!item && !!ITEMS[item.itemId]?.use && hiker.status === 'active';
  // A passed-out hiker can't act: others here can only take things from them.
  const out = hiker.status !== 'active';
  const roomFor = (h: Hiker) =>
    resource
      ? resourceCount(h) < BALANCE.inventory.resourceLimit
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
      <span className={styles.head} data-drag-handle>
        {resource && <img src={ASSETS.resources[resource.id]} alt="" width={28} height={28} />}
        {name.toUpperCase()}
        {resource && count > 1 && <span className={styles.count}>×{count}</span>}
      </span>

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

function UseSection({
  state,
  hiker,
  itemUid,
  name,
  step,
  setStep,
  onUse,
}: {
  state: GameState;
  hiker: Hiker;
  itemUid: string;
  name: string;
  step: UseStep | null;
  setStep(step: UseStep | null): void;
  onUse(action: Action): void;
}) {
  const item = hiker.inventory.bag.find((i) => i.uid === itemUid);
  const use = item && ITEMS[item.itemId]?.use;
  if (!use) return null;
  const action = (targetId: string, conditionId?: string): Action => ({
    type: 'useItem',
    hikerId: hiker.id,
    itemUid,
    targetId,
    ...(conditionId ? { conditionId } : {}),
  });
  const who = (h: Hiker) => (h.id === hiker.id ? `${h.name} (self)` : h.name);

  // Picking which condition to cure (Medicine, Medkit).
  const target = step && state.hikers.find((h) => h.id === step.targetId);
  if (step?.picking && target) {
    return (
      <div className={styles.confirm}>
        <span className={styles.none}>Which condition should the {name} cure?</span>
        {negativeConditions(target).map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.option}
            onClick={() => setStep({ targetId: target.id, conditionId: c.id })}
          >
            <Icon name="medical" size={16} />
            {CONDITIONS[c.id]?.name ?? c.id}
          </button>
        ))}
        <button type="button" className={styles.option} onClick={() => setStep(null)}>
          Back
        </button>
      </div>
    );
  }

  // The confirm: what it will do, and that the item is used up.
  if (step && target) {
    const words = whatItDoes(use, target, step.conditionId ?? onlyCondition(target, use));
    return (
      <div className={styles.confirm}>
        <span className={styles.none}>
          Use the {name} on {target.id === hiker.id ? 'yourself' : target.name}? {target.name}:{' '}
          {words.join(', ')}. The {name} {name.endsWith('s') ? 'are' : 'is'} used up.
        </span>
        <button
          type="button"
          className={`${styles.option} ${styles.useIt}`}
          onClick={() => onUse(action(target.id, step.conditionId))}
        >
          <Icon name="medical" size={16} />
          Yes, use it
        </button>
        <button type="button" className={styles.option} onClick={() => setStep(null)}>
          Keep it
        </button>
      </div>
    );
  }

  return (
    <>
      <span className={styles.label}>USE ON</span>
      {onTile(state, hiker).map((h) => {
        const conds = use.pickCondition ? negativeConditions(h) : [];
        const many = conds.length > 1;
        const reason = validateAction(state, action(h.id, many ? conds[0]?.id : undefined));
        const words = reason ? [] : whatItDoes(use, h, onlyCondition(h, use));
        return (
          <button
            key={h.id}
            type="button"
            className={`${styles.option} ${styles.tall}`}
            disabled={!!reason}
            title={reason ?? undefined}
            onClick={() => setStep({ targetId: h.id, ...(many ? { picking: true } : {}) })}
          >
            <Icon name="medical" size={16} />
            <span className={styles.useText}>
              {who(h)}
              <span className={styles.effect}>
                {reason
                  ? 'Nothing to cure'
                  : many
                    ? `Pick 1 of ${conds.length} conditions${words.length ? `, ${words.join(', ')}` : ''}`
                    : words.join(', ')}
              </span>
            </span>
          </button>
        );
      })}
    </>
  );
}

/** The one condition Medicine or a Medkit would cure, when there's no choice to make. */
function onlyCondition(h: Hiker, use: { pickCondition?: true }): string | undefined {
  if (!use.pickCondition) return undefined;
  const conds = negativeConditions(h);
  return conds.length === 1 ? conds[0]?.id : undefined;
}
