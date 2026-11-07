/**
 * The night event window (docs/mockups/NightEvent.dc.html): a small side
 * window beside the right-hand panel. It doesn't dim or blur the map, it can
 * be shrunk with − and moved by its ribbon, and OK closes it.
 *
 * From the top: the midnight-blue ribbon, the creature's art and name, one
 * line for each hiker hit (portrait, sentence, result chip), and who was safe.
 */
import { useEffect, useRef, useState } from 'react';
import { ASSETS } from '../../config/assets';
import { characterFor } from '../../content/characters';
import { NIGHT_CREATURE_BY_ID } from '../../content/nightEvents';
import type { GameEvent, GameState } from '../../engine';
import { Icon } from '../icons/Icon';
import { useDraggable } from '../windows/useDraggable';
import { safeLines } from './nightLines';
import styles from './NightEventWindow.module.css';

export type NightEventShown = Extract<GameEvent, { kind: 'nightEvent' }>;

export function NightEventWindow({
  state,
  event,
  onClose,
}: {
  state: GameState;
  event: NightEventShown;
  onClose(): void;
}) {
  const [small, setSmall] = useState(false);
  const ok = useRef<HTMLButtonElement>(null);
  const { ref, windowProps, translate } = useDraggable<HTMLElement>('nightEvent');
  useEffect(() => ok.current?.focus({ preventScroll: true }), []);
  const creature = NIGHT_CREATURE_BY_ID[event.creatureId];
  const name = creature?.name ?? event.creatureId;
  const hikerName = (id: string) => state.hikers.find((h) => h.id === id)?.name ?? id;

  return (
    <aside
      ref={ref}
      className={styles.window}
      style={{ translate }}
      role="dialog"
      aria-label={`Night event: ${name}`}
      data-small={small}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      {...windowProps}
    >
      <header
        className={styles.ribbon}
        data-drag-handle=""
        title="Drag to move. Double-click to put it back."
      >
        <Icon name="moon" size={15} strokeWidth={2.5} />
        <span className={styles.kicker}>NIGHT EVENT</span>
        <span className={styles.day}>DAY {event.day}</span>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setSmall((s) => !s)}
          aria-expanded={!small}
          aria-label={small ? 'Show the night event' : 'Shrink the night event'}
          title={small ? 'Show' : 'Shrink'}
        >
          {small ? '+' : '−'}
        </button>
      </header>
      {!small && (
        <>
          <div className={styles.banner}>
            <img src={ASSETS.nightEvent(event.creatureId)} alt="" draggable={false} />
            <span className={styles.fade} />
            <h2 className={styles.name}>{name.toUpperCase()}</h2>
          </div>
          <div className={styles.body}>
            {event.hits.map((hit) => (
              <div key={hit.hikerId} className={styles.row}>
                <img
                  className={styles.portrait}
                  src={ASSETS.portraits.placeholder}
                  alt=""
                  draggable={false}
                  style={{ boxShadow: `0 0 0 2px ${characterFor(hit.hikerId).color}` }}
                />
                <div className={styles.words}>
                  <span className={styles.line}>{hit.text}</span>
                  <span className={styles.chip}>{hit.chip}</span>
                </div>
              </div>
            ))}
            {safeLines(event.safe, hikerName).map((s) => (
              <p key={s.text} className={styles.safe}>
                <Icon name={s.why === 'watch' ? 'eye' : 'tent'} size={13} strokeWidth={2} />
                {s.text}
              </p>
            ))}
            <button ref={ok} type="button" className={styles.ok} onClick={onClose}>
              OK
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
