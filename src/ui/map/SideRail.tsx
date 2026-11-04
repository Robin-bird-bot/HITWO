import { characterFor } from '../../content/characters';
import { ASSETS } from '../../config/assets';
import type { Hiker, Section } from '../../engine';
import { Icon } from '../icons/Icon';
import {
  focusOn,
  heightRatio,
  lastRowOf,
  tileCenter,
  visibleRange,
  type Bounds,
  type Camera,
} from './mapLayout';
import styles from './MapView.module.css';

/** The rail's track, in stage pixels (from Main.dc.html). */
const RAIL = { left: 1200, top: 204, height: 640 };
const TRACK = { top: 24, height: 548 };

interface SideRailProps {
  section: Section;
  hikers: Hiker[];
  camera: Camera;
  bounds: Bounds;
  onJump(cam: Camera): void;
}

/** A thin overview of the whole trail: where every hiker is, and what the map shows now. */
export function SideRail({ section, hikers, camera, bounds, onJump }: SideRailProps) {
  const lastRow = lastRowOf(section);
  const range = visibleRange(camera, bounds);
  const toTrack = (ratio: number) => TRACK.top + ratio * TRACK.height;

  // Hikers on the same row sit side by side on the rail.
  const perRow = new Map<number, number>();
  const faces = hikers
    .filter((h) => h.status !== 'abandoned')
    .map((h) => {
      const tile = section.tiles[h.tileId];
      if (!tile) return null;
      const center = tileCenter(tile, lastRow);
      const slot = perRow.get(tile.row) ?? 0;
      perRow.set(tile.row, slot + 1);
      return { h, center, top: toTrack(heightRatio(center.y, bounds)) - 11, left: 2 + slot * 6 };
    })
    .filter((f) => f !== null);

  return (
    <nav
      className={styles.rail}
      style={{ left: RAIL.left, top: RAIL.top, height: RAIL.height }}
      aria-label="Trail overview"
    >
      <div className={styles.railCheckpoint} title="Checkpoint">
        <Icon name="tower" size={14} color="#F7F1E4" strokeWidth={2.25} />
      </div>
      <button
        type="button"
        className={styles.railTrack}
        style={{ top: TRACK.top, height: TRACK.height }}
        aria-label="Scroll the map to this part of the trail"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientY - box.top) / box.height;
          const y = bounds.minY + ratio * (bounds.maxY - bounds.minY);
          onJump(focusOn({ x: camera.x, y }, camera.zoom, bounds));
        }}
      />
      <div
        className={styles.railView}
        style={{ top: toTrack(range.top), height: (range.bottom - range.top) * TRACK.height }}
      />
      {faces.map(({ h, center, top, left }) => (
        <button
          key={h.id}
          type="button"
          className={styles.railFace}
          style={{
            top,
            left,
            boxShadow: `0 0 0 2px ${characterFor(h.id).color}, 0 3px 6px rgba(0,0,0,0.3)`,
          }}
          aria-label={`Jump to ${h.name}`}
          title={`Jump to ${h.name}`}
          onClick={() => onJump(focusOn(center, camera.zoom, bounds))}
        >
          <img src={ASSETS.portraits.placeholder} alt="" draggable={false} />
        </button>
      ))}
      <div className={styles.railStart}>START</div>
    </nav>
  );
}
