/**
 * Simple mode's turn panel: only the actions the selected hiker can take
 * right now, as big buttons; abilities only when there are some; the tile;
 * and one inventory row that opens the full inventory.
 */
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { ITEMS } from '../../content';
import { RESOURCES } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  abilitiesFor,
  bagSlots,
  resourceCount,
  type GameState,
  type Hiker,
  type ItemInstance,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { nothingToDoReason, readyActions, type ActionId } from '../panels/hikerInfo';
import { Panel } from '../panels/Panel';
import { Popout } from '../panels/Popout';
import { Abilities, Bag, EndButton, Equipped, Resources, TileCard } from '../panels/TurnPanel';
import { useStage } from '../stage/StageContext';
import styles from './Simple.module.css';

const PHASE_NAME = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' } as const;

interface SimpleTurnProps {
  state: GameState;
  hiker: Hiker;
  onAction(id: ActionId): void;
  onAbility(abilityId: string, choice?: string): void;
  onEndPhase(): void;
  note?: string;
  slot?: ReactNode;
  /** The action in progress, highlighted. */
  activeAction?: ActionId | null;
}

export function SimpleTurn({
  state,
  hiker,
  onAction,
  onAbility,
  onEndPhase,
  note,
  slot,
  activeAction,
}: SimpleTurnProps) {
  const ready = readyActions(state, hiker);
  const rowRef = useRef<HTMLButtonElement>(null);
  const [inventoryTop, setInventoryTop] = useState<number | null>(null);
  const hasAbilities = abilitiesFor(state, hiker).length > 0;

  return (
    <>
      <Panel
        id="turn"
        as="aside"
        label="selected hiker's turn"
        style={{ left: 1240, top: 72, width: 344, maxHeight: 832 }}
        title={<span className={styles.heading}>{hiker.name.toUpperCase()}’S TURN</span>}
        aside={<span>{PHASE_NAME[state.phase]}</span>}
      >
        {slot ??
          (ready.length ? (
            <div className={styles.actions}>
              {ready.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={styles.action}
                  aria-pressed={activeAction === a.id}
                  onClick={() => onAction(a.id)}
                >
                  <Icon name={a.icon} size={22} />
                  {a.label.toUpperCase()}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.nothing}>{nothingToDoReason(state, hiker)}</p>
          ))}
        {note && <p className={styles.note}>{note}</p>}
        {hasAbilities && <Abilities state={state} hiker={hiker} onAbility={onAbility} />}
        <TileCard state={state} hiker={hiker} />
        <InventoryRow
          state={state}
          hiker={hiker}
          rowRef={rowRef}
          open={inventoryTop !== null}
          onToggle={(top) => setInventoryTop(inventoryTop === null ? top : null)}
        />
      </Panel>
      {inventoryTop !== null && (
        <Popout
          label={`${hiker.name}'s inventory`}
          className={styles.popout}
          style={{ left: 1240 - 372, top: inventoryTop, width: 360 }}
          ignore={[rowRef]}
          onClose={() => setInventoryTop(null)}
        >
          <span className={styles.popoutName}>{hiker.name.toUpperCase()}’S INVENTORY</span>
          <Equipped hiker={hiker} />
          <Bag state={state} hiker={hiker} />
          <Resources hiker={hiker} />
        </Popout>
      )}
      <div className={styles.end}>
        <EndButton state={state} onEndPhase={onEndPhase} />
      </div>
    </>
  );
}

const MAX_ICONS = 9;

/** "Bag 3/4 · Resources 7/10" with small icons; clicking opens the full inventory. */
function InventoryRow({
  state,
  hiker,
  rowRef,
  open,
  onToggle,
}: {
  state: GameState;
  hiker: Hiker;
  rowRef: RefObject<HTMLButtonElement>;
  open: boolean;
  /** The row's top in stage pixels, to place the pop-out beside it. */
  onToggle(top: number): void;
}) {
  const fit = useStage();
  const slots = bagSlots(state, hiker);
  const items: ItemInstance[] = [
    ...Object.values(hiker.inventory.equipped).filter((i): i is ItemInstance => !!i),
    ...hiker.inventory.bag,
  ];
  const resources = RESOURCES.filter((r) => (hiker.inventory.resources[r.id] ?? 0) > 0);
  const icons = [
    ...items.map((item) => ({ key: item.uid, kind: 'item' as const, item })),
    ...resources.map((r) => ({ key: r.id, kind: 'resource' as const, r })),
  ];
  const shown = icons.slice(0, MAX_ICONS);
  const more = icons.length - shown.length;

  return (
    <button
      ref={rowRef}
      type="button"
      className={styles.inventory}
      aria-expanded={open}
      onClick={(e) => {
        const t = (e.currentTarget.getBoundingClientRect().top - fit.top) / fit.scale;
        onToggle(Math.max(16, Math.min(t - 200, 1000 - 560)));
      }}
    >
      <span className={styles.inventoryHead}>
        <span>
          BAG {hiker.inventory.bag.length}/{slots.total} · RESOURCES {resourceCount(hiker)}/
          {BALANCE.inventory.resourceLimit}
        </span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
      </span>
      <span className={styles.icons}>
        {shown.length === 0 && <span className={styles.muted}>Nothing yet.</span>}
        {shown.map((icon) =>
          icon.kind === 'item' ? (
            <span
              key={icon.key}
              className={styles.icon}
              data-item
              title={ITEMS[icon.item.itemId]?.name}
            >
              <img src={ASSETS.itemCards.clothesIcon} alt={ITEMS[icon.item.itemId]?.name ?? ''} />
            </span>
          ) : (
            <span key={icon.key} className={styles.icon} title={icon.r.name}>
              <img src={ASSETS.resources[icon.r.id]} alt={icon.r.name} />
              <span className={styles.count}>{hiker.inventory.resources[icon.r.id]}</span>
            </span>
          ),
        )}
        {more > 0 && <span className={styles.muted}>+{more}</span>}
      </span>
    </button>
  );
}
