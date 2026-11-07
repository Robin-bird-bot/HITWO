import { Fragment } from 'react';
import { characterFor } from '../../content/characters';
import { ASSETS } from '../../config/assets';
import { immovable, type Hiker, type HikerId, type Section } from '../../engine';
import { conditionCounts } from '../conditions/hikerConditions';
import { TONE_LOOK } from '../conditions/conditionLook';
import { Icon } from '../icons/Icon';
import { lastRowOf, tileCenter } from './mapLayout';
import styles from './MapView.module.css';

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

interface HikerTokensProps {
  section: Section;
  hikers: Hiker[];
  selectedId: HikerId | null;
  onSelect(id: HikerId): void;
}

export function HikerTokens({ section, hikers, selectedId, onSelect }: HikerTokensProps) {
  const lastRow = lastRowOf(section);
  const byTile = new Map<string, Hiker[]>();
  for (const h of hikers) {
    if (h.status === 'abandoned') continue;
    byTile.set(h.tileId, [...(byTile.get(h.tileId) ?? []), h]);
  }

  return (
    <>
      {[...byTile.entries()].flatMap(([tileId, group]) => {
        const tile = section.tiles[tileId];
        if (!tile) return [];
        const c = tileCenter(tile, lastRow);
        const spread = SPREAD[Math.min(group.length, 4)] ?? SPREAD[4] ?? [];
        return group.map((h, i) => {
          const [dx, dy] = spread[i % spread.length] ?? [0, 0];
          const selected = h.id === selectedId;
          const size = selected ? 48 : 40;
          const color = characterFor(h.id).color;
          const out = h.status !== 'active';
          const { bad, good } = conditionCounts(h);
          const stuck = immovable(h);
          const left = c.x + dx - size / 2;
          const top = c.y + dy - size / 2;
          const marks = [
            bad > 0 ? `${bad} bad condition${bad === 1 ? '' : 's'}` : '',
            good > 0 ? `${good} good condition${good === 1 ? '' : 's'}` : '',
            stuck ? 'can’t move' : '',
          ].filter(Boolean);
          return (
            <Fragment key={h.id}>
              <button
                type="button"
                className={styles.token}
                aria-label={`${h.name}${selected ? ' (selected)' : ''}${marks.length ? `: ${marks.join(', ')}` : ''}`}
                aria-pressed={selected}
                title={h.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(h.id);
                }}
                style={{
                  left,
                  top,
                  width: size,
                  height: size,
                  zIndex: selected ? 3 : 2,
                  opacity: h.acted || out ? 0.6 : 1,
                  filter: h.acted || out ? 'grayscale(1)' : 'none',
                  boxShadow: selected
                    ? `0 0 0 3px ${color}, 0 0 0 6px #F7F1E4, 0 10px 16px rgba(0,0,0,0.3)`
                    : `0 0 0 3px ${color}, 0 6px 10px rgba(0,0,0,0.25)`,
                }}
              >
                <img src={ASSETS.portraits.placeholder} alt="" draggable={false} />
                {stuck && (
                  <span className={styles.tokenFrozen} aria-hidden="true">
                    <Icon name="snowflake" size={Math.round(size * 0.6)} strokeWidth={2.5} />
                  </span>
                )}
              </button>
              {(bad > 0 || good > 0) && (
                <span
                  className={styles.tokenMarks}
                  aria-hidden="true"
                  style={{ left: left + size - 12, top: top + size - 14, zIndex: selected ? 4 : 3 }}
                >
                  {bad > 0 && <span style={{ background: TONE_LOOK.negative.ring }}>{bad}</span>}
                  {good > 0 && <span style={{ background: TONE_LOOK.positive.ring }}>{good}</span>}
                </span>
              )}
            </Fragment>
          );
        });
      })}
    </>
  );
}
