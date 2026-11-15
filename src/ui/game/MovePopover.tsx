import { useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { ASSETS } from '../../config/assets';
import { characterFor } from '../../content/characters';
import type { Hiker, HikerId } from '../../engine';
import { Icon } from '../icons/Icon';
import { MAP_VIEW, type Point } from '../map/mapLayout';
import { STAT_META } from '../panels/hikerInfo';
import type { BringOption, MovePreview } from './movePlan';
import styles from './MovePopover.module.css';

const WIDTH = 300;

interface MovePopoverProps {
  /** Who's moving: their portrait heads the pop-up. */
  hiker: Hiker;
  /** The others on their tile, and whether each can come along to this tile. */
  choices: BringOption[];
  /** Open on the Move all list (the turn panel's Move All button). */
  startWithAll?: boolean;
  /** What the move would do: alone (null), or with these hikers. */
  previewFor(bring: HikerId[] | null): MovePreview | null;
  /** The tile's top and bottom centre, in stage pixels. */
  above: Point;
  below: Point;
  onGo(bring: HikerId[] | null): void;
  onCancel(): void;
}

/**
 * The pop-up by a tile, after dragging a hiker there or picking it (Nov 14
 * update): the hiker's portrait, then **Move** (alone) or **Move all**, which
 * lists the others on the tile who can come (all checked) and **Go**. It
 * shows what the move costs. Enter takes the gold button, Esc cancels. A
 * check-in that leaves someone behind starts on Cancel instead.
 */
export function MovePopover({
  hiker,
  choices,
  startWithAll = false,
  previewFor,
  above,
  below,
  onGo,
  onCancel,
}: MovePopoverProps) {
  const ready = choices.filter((c) => c.reason === null).map((c) => c.hiker.id);
  const [all, setAll] = useState(startWithAll && ready.length > 0);
  const [checked, setChecked] = useState<HikerId[]>(ready);
  const bring = all ? checked : null;
  const preview = previewFor(bring);
  const goRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const allowed = !!preview && preview.reason === null && (!all || checked.length > 0);
  const leavesSomeone = (preview?.checkIn?.leftBehind.length ?? 0) > 0;
  const go = () => allowed && onGo(bring);

  useEffect(() => {
    (leavesSomeone ? cancelRef : goRef).current?.focus();
  }, [leavesSomeone, all]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (!preview) return null;

  // Above the tile if there's room, otherwise below; never off the map area.
  const flip = above.y < 340;
  const left = Math.min(
    Math.max(above.x - WIDTH / 2, MAP_VIEW.x + 8),
    MAP_VIEW.x + MAP_VIEW.w - WIDTH - 8,
  );
  const position = flip ? { top: below.y + 14 } : { bottom: 1000 - above.y + 14 };
  const arrowLeft = Math.min(Math.max(above.x - left, 20), WIDTH - 20);
  const group = preview.rows.length > 1;
  const injured = preview.rows.filter((r) => r.injury);
  const checkIn = !!preview.checkIn;

  return (
    <div
      className={styles.popover}
      style={{ left, width: WIDTH, ...position }}
      role="dialog"
      aria-label={`${preview.title} to ${preview.where}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className={styles.arrow} data-flip={flip} style={{ left: arrowLeft - 7 }} />
      <div className={styles.head}>
        <img
          className={styles.portrait}
          src={ASSETS.portraits.placeholder}
          alt=""
          style={{ boxShadow: `0 0 0 3px ${characterFor(hiker.id).color}` }}
        />
        <span className={styles.headText}>
          <span className={styles.kicker}>
            {hiker.name.toUpperCase()} · {preview.title}
          </span>
          <span className={styles.where}>to {preview.where}</span>
        </span>
      </div>

      {all && (
        <ul className={styles.list} aria-label="Who comes along">
          {choices.map(({ hiker: h, reason }) => (
            <li key={h.id}>
              <label
                className={styles.check}
                data-off={reason !== null || undefined}
                title={reason ?? undefined}
              >
                <input
                  type="checkbox"
                  checked={checked.includes(h.id)}
                  disabled={reason !== null}
                  onChange={() =>
                    setChecked((c) =>
                      c.includes(h.id) ? c.filter((x) => x !== h.id) : [...c, h.id],
                    )
                  }
                />
                <img
                  src={ASSETS.portraits.placeholder}
                  alt=""
                  style={{ boxShadow: `0 0 0 2px ${characterFor(h.id).color}` }}
                />
                <span className={styles.checkName}>{h.name}</span>
                {reason !== null && <span className={styles.checkWhy}>{shortWhy(reason)}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}

      {preview.reason === null ? (
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
          {all && checked.length === 0 && (
            <span className={styles.note}>Check who comes, or go back to move alone.</span>
          )}
          {!all && choices.length > 0 && ready.length === 0 && (
            <span className={styles.note}>Move all: {whyNobody(choices)}</span>
          )}
        </>
      ) : (
        <span className={styles.reason}>{preview.reason}</span>
      )}

      <div className={styles.buttons}>
        <button
          ref={cancelRef}
          type="button"
          className={styles.cancel}
          onClick={all && !startWithAll ? () => setAll(false) : onCancel}
        >
          {preview.reason !== null ? 'OK' : all && !startWithAll ? 'Back' : 'Cancel'}
        </button>
        {!all && ready.length > 0 && preview.reason === null && (
          <button type="button" className={styles.cancel} onClick={() => setAll(true)}>
            Move all
          </button>
        )}
        {preview.reason === null && (
          <button
            ref={goRef}
            type="button"
            className={styles.confirm}
            disabled={!allowed}
            onClick={go}
          >
            {all ? 'Go' : checkIn ? 'Check in' : 'Move'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Why nobody on the tile can come along: their shared reason, or a plain line. */
function whyNobody(choices: BringOption[]): string {
  const reasons = [...new Set(choices.map((c) => c.reason))];
  return reasons.length === 1 && reasons[0] ? reasons[0] : 'nobody here can come along right now.';
}

/** "Birch has already acted this morning." → "Already acted", for the small line by a name. */
function shortWhy(reason: string): string {
  if (/already acted/.test(reason)) return 'Already acted';
  if (/^Hungry|^Famished/.test(reason)) return 'Too hungry';
  if (/^Exhausted|^Fatigued/.test(reason)) return 'Too tired';
  return reason.length > 24 ? 'Can’t come' : reason;
}
