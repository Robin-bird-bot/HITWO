/**
 * The trail map: tiles, lines, cost badges and hiker tokens on a camera you
 * can scroll (wheel or drag) and zoom (ctrl/pinch + wheel, or the buttons).
 */
import { useEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Hiker, HikerId, Section, Tile } from '../../engine';
import { hikerColor } from '../../content/characters';
import { useStage } from '../stage/StageContext';
import { useDragPointer, useDragState, useDrop, type DropTarget } from '../drag/drag';
import { NO_DROP } from '../drag/itemDrops';
import { HikerTokens } from './HikerTokens';
import { MapTile } from './MapTile';
import {
  HEX,
  lastRowOf,
  panBy,
  stageToWorld,
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
  /** What clicking a target does, for screen readers: "Move here" unless a tool is picking. */
  reachLabel?: string;
  /** This section's checkpoint: its number, and whether it's the summit. */
  checkpoint?: { number: number; summit: boolean };
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
  /** Extra things in map space, over the tokens (Preview Next Trail's line picks). */
  overlay?: ReactNode;
  selectedId: HikerId | null;
  /** `add`: Shift- or Ctrl-click a token: add to (or take out of) the group. */
  onSelectHiker(id: HikerId, add?: boolean): void;
  /** Multi-select (Nov 14 update): each grouped hiker's turn-order number. */
  order?: Partial<Record<HikerId, number>>;
  /** A click on the map away from any tile or token (clears the group). */
  onEmptyClick?(): void;
  camera: Camera;
  setCamera: Dispatch<SetStateAction<Camera>>;
  bounds: Bounds;
  /**
   * Dragging hikers to move them (Nov 14 update): who can be picked up, which
   * tiles take them, what dropping does, and the cost to show on the tile
   * under the pointer.
   */
  hikerDrag?: {
    canDrag(hiker: Hiker): boolean;
    accepts(hikerId: HikerId, tileId: string): boolean;
    onDrop(hikerId: HikerId, tileId: string): void;
    costOn?(hikerId: HikerId, tileId: string): string;
  };
  /**
   * Dragging pack things onto the map (Nov 14 update): a tile (a map tool's
   * target, or a shelter's own tile), or anywhere (a tool with no tile).
   */
  itemDrag?: { tile: DropTarget; map: DropTarget };
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
  reachLabel,
  checkpoint,
  onTileClick,
  checkpointLabelOnHover,
  marks,
  onRevealedClick,
  onWonderClick,
  fx = [],
  overlay,
  selectedId,
  onSelectHiker,
  camera,
  setCamera,
  bounds,
  hikerDrag,
  itemDrag,
  order,
  onEmptyClick,
}: MapViewProps) {
  const fit = useStage();
  const drag = useDragState();
  const dragged = drag?.payload.kind === 'hiker' ? drag.payload.hikerId : null;
  const tileDrop = useDrop('tile', {
    accepts: (p, arg) =>
      p.kind === 'hiker'
        ? !!hikerDrag && !!arg && hikerDrag.accepts(p.hikerId, arg)
        : !!itemDrag && itemDrag.tile.accepts(p, arg),
    onDrop: (p, arg, at) => {
      if (p.kind === 'hiker') {
        if (hikerDrag && arg) hikerDrag.onDrop(p.hikerId, arg);
      } else itemDrag?.tile.onDrop(p, arg, at);
    },
  });
  const mapDrop = useDrop('map', itemDrag?.map ?? NO_DROP);
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
  const checkpointInfo = {
    number: checkpoint?.number ?? 1,
    summit: checkpoint?.summit ?? false,
    checkedIn: hikers.filter((h) => h.status === 'checkedIn').length,
    total: hikers.filter((h) => h.status !== 'abandoned').length,
  };
  const reachOf = (tileId: string) => {
    const target = targets.find((t) => t.tileId === tileId);
    return target ? (target.reason === null ? 'ok' : 'blocked') : undefined;
  };

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      data-dragging={dragged ? 'hiker' : undefined}
      {...(itemDrag ? mapDrop.props() : {})}
      onPointerDown={onPointerDown}
      onClickCapture={(e) => {
        // A drag shouldn't also count as a click on whatever it ended over.
        if (draggedRef.current) {
          e.stopPropagation();
          draggedRef.current = false;
        }
      }}
      onClick={(e) => {
        // Empty map: the viewport itself, or the world layer behind the tiles.
        if (e.target === e.currentTarget || e.target === e.currentTarget.firstElementChild) {
          onEmptyClick?.();
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
            currentColor={selected ? hikerColor(selected) : undefined}
            reach={reachOf(t.id)}
            reachLabel={reachLabel}
            checkpoint={checkpointInfo}
            mark={marks?.[t.id]}
            onRevealed={onRevealedClick ? () => onRevealedClick(t.id) : undefined}
            onWonder={onWonderClick ? () => onWonderClick(t.id) : undefined}
            checkpointLabelOnHover={checkpointLabelOnHover}
            onClick={reachOf(t.id) ? () => onTileClick(t.id) : undefined}
            {...(hikerDrag || itemDrag ? { drop: tileDrop.props(t.id) } : {})}
          />
        ))}
        <LineBadges section={section} />
        <HikerTokens
          section={section}
          hikers={hikers}
          selectedId={selectedId}
          onSelect={onSelectHiker}
          pickTile={{
            tileIds: new Set(targets.filter((t) => t.reason === null).map((t) => t.tileId)),
            onPick: onTileClick,
          }}
          {...(hikerDrag ? { canDrag: hikerDrag.canDrag } : {})}
          {...(order ? { order } : {})}
        />
        {overlay}
        {dragged && (
          <DragArrow
            from={tileOf(section, hikers.find((h) => h.id === dragged)?.tileId)}
            lastRow={lastRow}
            camera={camera}
          />
        )}
        {dragged && hikerDrag?.costOn && drag?.hover?.id === 'tile' && drag.hover.arg && (
          <CostChip
            at={tileOf(section, drag.hover.arg)}
            lastRow={lastRow}
            text={hikerDrag.costOn(dragged, drag.hover.arg)}
          />
        )}
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

const tileOf = (section: Section, id: string | undefined) => (id ? section.tiles[id] : undefined);

/** While a hiker is dragged: an arrow from their tile to the pointer, in map space. */
function DragArrow({
  from,
  lastRow,
  camera,
}: {
  from: Tile | undefined;
  lastRow: number;
  camera: Camera;
}) {
  const fit = useStage();
  const at = useDragPointer();
  if (!from || !at) return null;
  const a = tileCenter(from, lastRow);
  const b = stageToWorld(camera, {
    x: (at.x - fit.left) / fit.scale,
    y: (at.y - fit.top) / fit.scale,
  });
  // Stop short of the pointer, so the head sits just under the ghost.
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 30) return null;
  const k = (len - 24) / len;
  const end = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  return (
    <svg className={styles.dragArrow} width="1" height="1" aria-hidden="true">
      <defs>
        <marker
          id="drag-head"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#F2B950" />
        </marker>
      </defs>
      <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} markerEnd="url(#drag-head)" />
    </svg>
  );
}

/** The move's cost, on the tile under a dragged hiker. */
function CostChip({ at, lastRow, text }: { at: Tile | undefined; lastRow: number; text: string }) {
  if (!at) return null;
  const c = tileCenter(at, lastRow);
  return (
    <div className={styles.costChip} style={{ left: c.x, top: c.y + HEX.h / 2 - 10 }} role="status">
      {text}
    </div>
  );
}
