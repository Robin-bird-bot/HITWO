/**
 * Simple mode's turn panel: only the actions the selected hiker can take
 * right now, as big buttons; abilities only when there are some; the tile;
 * and the same Equipped, Bag and Resources slot grids as Informative mode,
 * with short labels and counts. Fewer words, not fewer visuals.
 */
import type { ReactNode } from 'react';
import { abilitiesFor, type GameState, type Hiker } from '../../engine';
import { Icon } from '../icons/Icon';
import { nothingToDoReason, readyActions, type ActionId } from '../panels/hikerInfo';
import { Panel } from '../panels/Panel';
import {
  Abilities,
  Bag,
  EndButton,
  Equipped,
  Resources,
  TileCard,
  type StashPick,
} from '../panels/TurnPanel';
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
  /** A resource or bag item was clicked: open its give / return menu. */
  onPick?(pick: StashPick): void;
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
  onPick,
}: SimpleTurnProps) {
  const ready = readyActions(state, hiker);
  const hasAbilities = abilitiesFor(state, hiker).length > 0;

  return (
    <>
      <Panel
        id="turn"
        movable
        as="aside"
        label="selected hiker's turn"
        style={{ left: 1240, top: 72, width: 344, maxHeight: 832 }}
        title={<span className={styles.heading}>{hiker.name.toUpperCase()}’S TURN</span>}
        aside={<span>{PHASE_NAME[state.phase]}</span>}
      >
        <div className={styles.scroll}>
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
          <Equipped hiker={hiker} compact />
          <Bag state={state} hiker={hiker} compact onPick={onPick} />
          <Resources hiker={hiker} compact onPick={onPick} />
        </div>
      </Panel>
      <div className={styles.end}>
        <EndButton state={state} onEndPhase={onEndPhase} />
      </div>
    </>
  );
}
