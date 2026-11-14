import { useEffect, useRef } from 'react';
import { BALANCE } from '../../config/balance';
import { Icon } from '../icons/Icon';
import { MAP_VIEW, type Point } from '../map/mapLayout';
import { STAT_META } from '../panels/hikerInfo';
import type { MovePreview } from './movePlan';
import styles from './MovePopover.module.css';

const WIDTH = 280;

interface MovePopoverProps {
  preview: MovePreview;
  /** The tile's top and bottom centre, in stage pixels. */
  above: Point;
  below: Point;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * The cost preview by a tile, with Confirm and Cancel. Enter confirms, Esc
 * cancels. A check-in that leaves someone behind starts on Cancel instead.
 */
export function MovePopover({ preview, above, below, onConfirm, onCancel }: MovePopoverProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const allowed = preview.reason === null;
  const leavesSomeone = (preview.checkIn?.leftBehind.length ?? 0) > 0;

  useEffect(() => {
    (leavesSomeone ? cancelRef : confirmRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter' && allowed && document.activeElement === document.body)
        onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowed, leavesSomeone, onCancel, onConfirm]);

  // Above the tile if there's room, otherwise below; never off the map area.
  const flip = above.y < 300;
  const left = Math.min(
    Math.max(above.x - WIDTH / 2, MAP_VIEW.x + 8),
    MAP_VIEW.x + MAP_VIEW.w - WIDTH - 8,
  );
  const position = flip ? { top: below.y + 14 } : { bottom: 1000 - above.y + 14 };
  const arrowLeft = Math.min(Math.max(above.x - left, 20), WIDTH - 20);
  const group = preview.rows.length > 1;
  const injured = preview.rows.filter((r) => r.injury);

  return (
    <div
      className={styles.popover}
      style={{ left, width: WIDTH, ...position }}
      role="dialog"
      aria-label={`${preview.title} to ${preview.where}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className={styles.arrow} data-flip={flip} style={{ left: arrowLeft - 7 }} />
      <span className={styles.kicker}>{preview.title}</span>
      <span className={styles.where}>to {preview.where}</span>

      {allowed ? (
        <>
          <div className={styles.rows}>
            {preview.rows.map((row) => (
              <div key={row.hikerId} className={styles.row}>
                {group && <span className={styles.who}>{row.name}</span>}
                {row.changes.length === 0 ? (
                  <span className={styles.free}>No cost</span>
                ) : (
                  row.changes.map((c) => (
                    <span key={c.stat} className={styles.change}>
                      <Icon name={STAT_META[c.stat].icon} size={13} />
                      {STAT_META[c.stat].label}
                      <span className={styles.num}>{c.from}</span>
                      <span className={styles.arrowText}>→</span>
                      <span className={styles.to} data-zero={c.to === 0}>
                        {c.to}
                      </span>
                    </span>
                  ))
                )}
              </div>
            ))}
          </div>
          {preview.carrying.length > 0 && (
            <span className={styles.note}>
              Carrying {preview.carrying.join(' and ')}: {BALANCE.carry.appetite} extra Appetite
              {preview.carrying.length > 1 ? ' each' : ''}.
            </span>
          )}
          {preview.night && (
            <span className={styles.note}>Moving at night costs 1 extra Appetite.</span>
          )}
          {preview.reveals > 0 && (
            <span className={styles.note}>
              Reveals {preview.reveals} hidden node{preview.reveals === 1 ? '' : 's'}.
            </span>
          )}
          {preview.checkIn && (
            <span className={styles.note}>
              {group ? 'They check' : 'Checks'} in at the{' '}
              {preview.checkIn.summit ? 'summit' : 'checkpoint'}
              {preview.checkIn.last
                ? preview.checkIn.summit
                  ? '. Everyone’s in: the party reaches the summit and the hike ends.'
                  : '. Everyone’s in: the ranger station opens.'
                : ` and ${group ? 'wait' : 'waits'} there for the others, losing nothing.`}
            </span>
          )}
          {preview.checkIn && preview.checkIn.leftBehind.length > 0 && (
            <span className={styles.warning}>
              {preview.checkIn.leftBehind.join(' and ')}{' '}
              {preview.checkIn.leftBehind.length === 1 ? 'is' : 'are'} passed out on the trail and
              will be left behind: they abandon the hike.
            </span>
          )}
          {injured.length > 0 && (
            <span className={styles.warning}>
              {injured.map((r) => r.name).join(' and ')} will hit 0 and take an injury.
            </span>
          )}
        </>
      ) : (
        <span className={styles.reason}>{preview.reason}</span>
      )}

      <div className={styles.buttons}>
        <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel}>
          {allowed ? 'Cancel' : 'OK'}
        </button>
        {allowed && (
          <button ref={confirmRef} type="button" className={styles.confirm} onClick={onConfirm}>
            {preview.checkIn ? 'Check in' : group ? 'Lead the group' : 'Move'}
          </button>
        )}
      </div>
    </div>
  );
}
