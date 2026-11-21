/**
 * Hiker tokens on the map: a round portrait ringed in the hiker's color, with
 * small marks for conditions and Frozen.
 *
 * - Passed out (docs/mockups/Kit.dc.html): the portrait lies on its side,
 *   faded, with a red medical badge. Left alone, a pill counts the nights
 *   until they abandon the hike.
 * - Carried: a small token riding on their carrier's, not a spot of its own.
 * - A hiker who can move can be dragged by their token (Nov 14 update): the
 *   press doesn't pan the map, and a tap still selects.
 */
import { Fragment, type ComponentProps, type ReactNode } from 'react';
import { hikerColor } from '../../content/characters';
import { BALANCE } from '../../config/balance';
import { immovable, type Hiker, type HikerId, type Section } from '../../engine';
import { conditionCounts } from '../conditions/hikerConditions';
import { TONE_LOOK } from '../conditions/conditionLook';
import { Icon } from '../icons/Icon';
import { useDrag } from '../drag/drag';
import { lastRowOf, tileCenter } from './mapLayout';
import styles from './MapView.module.css';
import { HikerPortrait } from '../hikers/HikerPortrait';

/** Where tokens sit on a tile when several hikers share it. */
const SPREAD: Record<number, [number, number][]> = {
  1: [[0, -8]],
  2: [
    [-22, -10],
    [24, -8],
  ],
  3: [
    [-24, -16],
    [24, -16],
    [0, 16],
  ],
  4: [
    [-22, -22],
    [22, -22],
    [-22, 16],
    [22, 16],
  ],
};

/** A carried hiker's token: this size, on the carrier's top outer corner. */
const CARRIED_SIZE = 28;

interface HikerTokensProps {
  section: Section;
  hikers: Hiker[];
  selectedId: HikerId | null;
  /** `add`: Shift- or Ctrl-click: add to (or take out of) the group (Nov 14 update). */
  onSelect(id: HikerId, add?: boolean): void;
  /** Multi-select: each grouped hiker's turn-order number, as a badge on the token. */
  order?: Partial<Record<HikerId, number>>;
  /**
   * A tile the selected hiker can move to (or a tool can pick): a click on a
   * token there picks the tile, so hikers standing on it (checked in at the
   * checkpoint, say) don't get in the way.
   */
  pickTile?: { tileIds: ReadonlySet<string>; onPick(tileId: string): void };
  /** Which hikers can be picked up and dragged to another tile. */
  canDrag?(hiker: Hiker): boolean;
}

export function HikerTokens({
  section,
  hikers,
  selectedId,
  onSelect,
  pickTile,
  canDrag,
  order = {},
}: HikerTokensProps) {
  const lastRow = lastRowOf(section);
  const onMap = hikers.filter((h) => h.status !== 'abandoned');
  // A carried hiker rides on their carrier's token instead of taking a spot.
  const carrierOf = new Map<HikerId, Hiker>();
  for (const h of onMap) {
    const c = h.carrying && onMap.find((x) => x.id === h.carrying);
    if (c && c.tileId === h.tileId) carrierOf.set(c.id, h);
  }
  const byTile = new Map<string, Hiker[]>();
  for (const h of onMap) {
    if (carrierOf.has(h.id)) continue;
    byTile.set(h.tileId, [...(byTile.get(h.tileId) ?? []), h]);
  }
  // Someone active beside a passed-out hiker pauses their countdown.
  const company = (h: Hiker) =>
    onMap.some((o) => o.id !== h.id && o.status === 'active' && o.tileId === h.tileId);

  const token = (h: Hiker, left: number, top: number, size: number, riding?: Hiker) => {
    const selected = h.id === selectedId;
    const color = hikerColor(h);
    const passedOut = h.status === 'passedOut';
    const faded = h.acted || h.status !== 'active';
    const { bad, good } = conditionCounts(h);
    const stuck = immovable(h);
    const alone = passedOut && !company(h);
    const nights = h.countdown ?? BALANCE.passOut.countdownNights;
    const marks = [
      passedOut ? 'passed out' : '',
      riding ? `carried by ${riding.name}` : '',
      alone ? `alone: abandons the hike in ${nights} night${nights === 1 ? '' : 's'}` : '',
      bad > 0 ? `${bad} bad condition${bad === 1 ? '' : 's'}` : '',
      good > 0 ? `${good} good condition${good === 1 ? '' : 's'}` : '',
      stuck ? 'can’t move' : '',
    ].filter(Boolean);
    const z = selected ? 3 : riding ? 4 : 2;
    const small = size < 36;
    return (
      <Fragment key={h.id}>
        <TokenButton
          hiker={h}
          draggable={!riding && !!canDrag?.(h)}
          className={styles.token}
          aria-label={`${h.name}${selected ? ' (selected)' : ''}${marks.length ? `: ${marks.join(', ')}` : ''}`}
          aria-pressed={selected}
          title={h.name}
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey || e.ctrlKey || e.metaKey) onSelect(h.id, true);
            else if (pickTile?.tileIds.has(h.tileId)) pickTile.onPick(h.tileId);
            else onSelect(h.id);
          }}
          style={{
            left,
            top,
            width: size,
            height: size,
            zIndex: z,
            opacity: faded && !passedOut ? 0.6 : 1,
            filter: passedOut ? 'saturate(0.4)' : faded ? 'grayscale(1)' : 'none',
            boxShadow: selected
              ? `0 0 0 3px ${color}, 0 0 0 6px #F7F1E4, 0 10px 16px rgba(0,0,0,0.3)`
              : `0 0 0 ${small ? 2 : 3}px ${color}, 0 6px 10px rgba(0,0,0,0.25)`,
          }}
        >
          <HikerPortrait
            hikerId={h.id}
            className={styles.tokenFace}
            style={passedOut ? { transform: 'rotate(80deg)' } : undefined}
          />
          {stuck && (
            <span className={styles.tokenFrozen} aria-hidden="true">
              <Icon name="snowflake" size={Math.round(size * 0.6)} strokeWidth={2.5} />
            </span>
          )}
        </TokenButton>
        {order[h.id] !== undefined && (
          <span
            className={styles.tokenTurn}
            aria-hidden="true"
            style={{ left: left - 8, top: top - 8, zIndex: z + 2 }}
          >
            {order[h.id]}
          </span>
        )}
        {passedOut && (
          <span
            className={styles.tokenOut}
            aria-hidden="true"
            style={{
              left: left + size - (small ? 12 : 14),
              top: top + size - (small ? 12 : 14),
              zIndex: z + 1,
              width: small ? 16 : 20,
              height: small ? 16 : 20,
            }}
          >
            <Icon name="medical" size={small ? 9 : 11} solid color="#1D2220" />
          </span>
        )}
        {alone && (
          <span
            className={styles.tokenCountdown}
            aria-hidden="true"
            style={{ left: left + size - 10, top: top - 8, zIndex: z + 1 }}
          >
            <Icon name="moon" size={10} strokeWidth={2.5} />
            {nights}
          </span>
        )}
        {(bad > 0 || good > 0) && !small && (
          <span
            className={styles.tokenMarks}
            aria-hidden="true"
            style={{
              // A passed-out hiker's badge has the corner, so the marks move left.
              left: passedOut ? left - 6 : left + size - 12,
              top: top + size - 14,
              zIndex: z + 1,
            }}
          >
            {bad > 0 && <span style={{ background: TONE_LOOK.negative.ring }}>{bad}</span>}
            {good > 0 && <span style={{ background: TONE_LOOK.positive.ring }}>{good}</span>}
          </span>
        )}
      </Fragment>
    );
  };

  return (
    <>
      {[...byTile.entries()].flatMap(([tileId, group]) => {
        const tile = section.tiles[tileId];
        if (!tile) return [];
        const c = tileCenter(tile, lastRow);
        const spread = SPREAD[Math.min(group.length, 4)] ?? SPREAD[4] ?? [];
        return group.flatMap((h, i) => {
          const [dx, dy] = spread[i % spread.length] ?? [0, 0];
          const size = h.id === selectedId ? 48 : 40;
          const left = c.x + dx - size / 2;
          const top = c.y + dy - size / 2;
          const carried = h.carrying ? onMap.find((x) => x.id === h.carrying) : undefined;
          const rider =
            carried && carrierOf.get(carried.id) === h
              ? token(
                  carried,
                  // On the carrier's outer side, so it doesn't cover a neighbour.
                  dx < 0 ? left - CARRIED_SIZE * 0.45 : left + size - CARRIED_SIZE * 0.55,
                  top - CARRIED_SIZE * 0.45,
                  carried.id === selectedId ? CARRIED_SIZE + 6 : CARRIED_SIZE,
                  h,
                )
              : null;
          return [token(h, left, top, size), rider];
        });
      })}
    </>
  );
}

/** A token's button: a drag source when its hiker can move. */
function TokenButton({
  hiker,
  draggable,
  children,
  ...rest
}: { hiker: Hiker; draggable: boolean; children: ReactNode } & ComponentProps<'button'>) {
  const drag = useDrag(
    draggable ? { kind: 'hiker', hikerId: hiker.id } : null,
    <TokenGhost hiker={hiker} />,
    { stop: true },
  );
  return (
    <button type="button" {...rest} {...drag}>
      {children}
    </button>
  );
}

/** What follows the pointer while a hiker is dragged: their portrait. */
function TokenGhost({ hiker }: { hiker: Hiker }) {
  return (
    <HikerPortrait
      hikerId={hiker.id}
      className={styles.tokenGhost}
      style={{ boxShadow: `0 0 0 3px ${hikerColor(hiker)}` }}
    />
  );
}
