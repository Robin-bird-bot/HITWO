/**
 * The trail map: tiles, lines, cost badges and hiker tokens on a camera you
 * can scroll (wheel or drag) and zoom (ctrl/pinch + wheel, or the buttons).
 */
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Hiker, HikerId, Section } from '../../engine';
import { characterFor } from '../../content/characters';
import { useStage } from '../stage/StageContext';
import { HikerTokens } from './HikerTokens';
import { MapTile } from './MapTile';
import {
  lastRowOf,
  panBy,
  tileCenter,
  worldTransform,
  zoomAt,
  type Bounds,
  type Camera,
} from './mapLayout';
import { tileLook } from './looks';
import styles from './MapView.module.css';
import { LineBadges, TrailLines } from './TrailLines';

interface MapViewProps {
  section: Section;
  hikers: Hiker[];
  /** Connected tiles for the selected hiker: reason null = can move there. */
  targets: { tileId: string; reason: string | null }[];
  onTileClick(tileId: string): void;
  /** Simple mode shows the checkpoint's label only on hover. */
  checkpointLabelOnHover?: boolean;
  /** Trial tiles: orange where one was revealed, red for Rocco's tile, blue for one just made easier. */
  marks?: Partial<Record<string, 'trial' | 'target' | 'easier'>>;
  /** A card revealed early: its tile's icon was tapped. */
  onRevealedClick?(tileId: string): void;
  /** A found Wonder: its tile's icon was tapped. */
  onWonderClick?(tileId: string): void;
  /** Scouting just happened: tiles swept, and maybe counts to show where. */
  fx?: ScoutFx[];
  selectedId: HikerId | null;
  onSelectHiker(id: HikerId): void;
  camera: Camera;
  setCamera: Dispatch<SetStateAction<Camera>>;
  bounds: Bounds;
}

/** A scouting tool at work, for a few seconds: tiles to sweep, and counts to fade away. */
export interface ScoutFx {
  key: number;
  sweep: string[];
  counts?: { challenge: number; opportunity: number; trial: number; at: string[] };
}

const COUNT_COLOR = { challenge: '#E5624A', opportunity: '#7FC29B', trial: '#CDA6EE' } as const;
/** The counts float this far above the tiles they're about, clear of the hiker tokens. */
const COUNT_LIFT = 84;

const DRAG_THRESHOLD = 5;

export function MapView({
  section,
  hikers,
  targets,
  onTileClick,
  checkpointLabelOnHover,
  marks,
  onRevealedClick,
  onWonderClick,
  fx = [],
  selectedId,
  onSelectHiker,
  camera,
  setCamera,
  bounds,
}: MapViewProps) {
  const fit = useStage();
  const viewportRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  // Latest values for the native listeners below.
  const live = useRef({ fit, bounds });
  useEffect(() => {
    live.current = { fit, bounds };
  });

  // Wheel scrolls; ctrl + wheel (and trackpad pinch) zooms around the pointer.
  // Attached natively so preventDefault stops the browser from zooming the page.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { fit: f, bounds: b } = live.current;
      const unit = e.deltaMode === 1 ? 32 : 1;
      if (e.ctrlKey || e.metaKey) {
        const anchor = { x: (e.clientX - f.left) / f.scale, y: (e.clientY - f.top) / f.scale };
        setCamera((c) => zoomAt(c, Math.exp(-e.deltaY * unit * 0.01), anchor, b));
      } else {
        setCamera((c) => panBy(c, (-e.deltaX * unit) / f.scale, (-e.deltaY * unit) / f.scale, b));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setCamera]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    draggedRef.current = false;
    let last = { x: e.clientX, y: e.clientY };
    const start = last;
    const move = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (!draggedRef.current && dist < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      const { fit: f, bounds: b } = live.current;
      const dx = (ev.clientX - last.x) / f.scale;
      const dy = (ev.clientY - last.y) / f.scale;
      last = { x: ev.clientX, y: ev.clientY };
      setCamera((c) => panBy(c, dx, dy, b));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const lastRow = lastRowOf(section);
  const selected = hikers.find((h) => h.id === selectedId);
  const currentTileId = selected?.tileId ?? null;
  const tiles = Object.values(section.tiles);
  const reachOf = (tileId: string) => {
    const target = targets.find((t) => t.tileId === tileId);
    return target ? (target.reason === null ? 'ok' : 'blocked') : undefined;
  };

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      onPointerDown={onPointerDown}
      onClickCapture={(e) => {
        // A drag shouldn't also count as a click on whatever it ended over.
        if (draggedRef.current) {
          e.stopPropagation();
          draggedRef.current = false;
        }
      }}
      aria-label="Trail map"
    >
      <div className={styles.world} style={{ transform: worldTransform(camera) }}>
        <TrailLines
          section={section}
          bounds={bounds}
          from={currentTileId}
          reachable={targets.filter((t) => t.reason === null).map((t) => t.tileId)}
        />
        {tiles.map((t) => (
          <MapTile
            key={t.id}
            tile={t}
            at={tileCenter(t, lastRow)}
            look={tileLook(section, t, currentTileId)}
            currentColor={selected ? characterFor(selected.id).color : undefined}
            hikerCount={hikers.filter((h) => h.tileId === t.id && h.status === 'active').length}
            reach={reachOf(t.id)}
            mark={marks?.[t.id]}
            onRevealed={onRevealedClick ? () => onRevealedClick(t.id) : undefined}
            onWonder={onWonderClick ? () => onWonderClick(t.id) : undefined}
            checkpointLabelOnHover={checkpointLabelOnHover}
            onClick={reachOf(t.id) ? () => onTileClick(t.id) : undefined}
          />
        ))}
        <LineBadges section={section} />
        <HikerTokens
          section={section}
          hikers={hikers}
          selectedId={selectedId}
          onSelect={onSelectHiker}
        />
        {/* Over the tokens, so the numbers are never hidden behind a hiker. */}
        {fx.map((f) => (
          <ScoutLayer key={f.key} fx={f} section={section} lastRow={lastRow} />
        ))}
      </div>
    </div>
  );
}

/** The sweep on each scanned tile, and the counts floating over where they were taken. */
function ScoutLayer({ fx, section, lastRow }: { fx: ScoutFx; section: Section; lastRow: number }) {
  const centers = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const t = section.tiles[id];
      return t ? [tileCenter(t, lastRow)] : [];
    });
  const at = fx.counts ? centers(fx.counts.at) : [];
  const mid = at.length
    ? {
        x: at.reduce((n, p) => n + p.x, 0) / at.length,
        y: at.reduce((n, p) => n + p.y, 0) / at.length,
      }
    : null;
  return (
    <>
      {centers(fx.sweep).map((p, i) => (
        <div key={i} className={styles.sweep} style={{ left: p.x, top: p.y }} />
      ))}
      {fx.counts && mid && (
        <div
          className={styles.counts}
          style={{ left: mid.x, top: mid.y - COUNT_LIFT }}
          role="status"
          aria-label={`${fx.counts.challenge} challenges, ${fx.counts.opportunity} opportunities, ${fx.counts.trial} Trials`}
        >
          {(['challenge', 'opportunity', 'trial'] as const).map((k) => (
            <span key={k} className={styles.count} style={{ color: COUNT_COLOR[k] }}>
              {fx.counts?.[k]}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
