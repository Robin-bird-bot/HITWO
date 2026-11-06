/**
 * Simple mode's turn panel: only the actions the selected hiker can take
 * right now, as big buttons; abilities only when there are some; the tile;
 * and the same Equipped, Bag and Resources slot grids as Informative mode,
 * with short labels and counts. Fewer words, not fewer visuals.
 */
import { useState, type ReactNode } from 'react';
import { abilitiesFor, type GameState, type Hiker } from '../../engine';
import { Icon } from '../icons/Icon';
import { nothingToDoReason, simpleActions, type ActionId } from '../panels/hikerInfo';
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
  const actions = simpleActions(state, hiker);
  // Why a red action is stopped, after tapping it.
  // Shown only while that action is still red for this hiker.
  const [why, setWhy] = useState<{ hikerId: string; action: ActionId } | null>(null);
  const whyText =
    why?.hikerId === hiker.id
      ? actions.find((a) => a.id === why.action && a.status === 'status')?.reason
      : undefined;
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
            (actions.length ? (
              <div className={styles.actions}>
                {actions.map((a) => {
                  const red = a.status === 'status';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.action}
                      data-status={a.status}
                      aria-pressed={red ? undefined : activeAction === a.id}
                      aria-disabled={red || undefined}
                      title={red ? a.reason : undefined}
                      onClick={() =>
                        red ? setWhy({ hikerId: hiker.id, action: a.id }) : onAction(a.id)
                      }
                    >
                      <Icon name={a.icon} size={22} />
                      {a.label.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.nothing}>{nothingToDoReason(state, hiker)}</p>
            ))}
          {!slot && whyText && <p className={styles.why}>{whyText}</p>}
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
