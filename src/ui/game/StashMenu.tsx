/**
 * The menu for a resource or bag item the player clicked in the turn panel:
 * give it to a hiker on the same tile, or (resources) return it to nature for
 * +1 Abundance. Both are free actions. Closes on click-away or Esc.
 */
import { ITEMS } from '../../content';
import { RESOURCES } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  bagSlots,
  hikersOnTile,
  resourceCount,
  type Action,
  type GameState,
  type Hiker,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { Popout } from '../panels/Popout';
import type { StashPick } from '../panels/TurnPanel';
import styles from './StashMenu.module.css';

interface StashMenuProps {
  state: GameState;
  hiker: Hiker;
  pick: StashPick;
  onDispatch(action: Action): void;
  onClose(): void;
}

const WIDTH = 260;

export function StashMenu({ state, hiker, pick, onDispatch, onClose }: StashMenuProps) {
  const others = hikersOnTile(state, hiker.tileId).filter(
    (h) => h.id !== hiker.id && h.status === 'active',
  );
  const resource = pick.kind === 'resource' ? RESOURCES.find((r) => r.id === pick.id) : undefined;
  const item =
    pick.kind === 'item' ? hiker.inventory.bag.find((i) => i.uid === pick.uid) : undefined;
  const count = resource ? (hiker.inventory.resources[resource.id] ?? 0) : 1;
  if ((!resource || count < 1) && !item) return null;

  const name = resource?.name ?? ITEMS[item?.itemId ?? '']?.name ?? 'Item';
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
      label={`${name}: give or return`}
      dragId="inventory"
      className={styles.menu}
      style={{
        left: 1240 - WIDTH - 12,
        top: Math.max(16, Math.min(pick.top - 20, 1000 - 300)),
        width: WIDTH,
      }}
      onClose={onClose}
    >
      <span className={styles.head} data-drag-handle>
        {resource && <img src={ASSETS.resources[resource.id]} alt="" width={28} height={28} />}
        {name.toUpperCase()}
        {resource && count > 1 && <span className={styles.count}>×{count}</span>}
      </span>

      {others.length === 0 && (
        <span className={styles.none}>No one else is here to give it to.</span>
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
            Give to {h.name}
            {!room && <span className={styles.full}>{resource ? 'Full' : 'Bag full'}</span>}
          </button>
        );
      })}

      {resource && (
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
    </Popout>
  );
}
