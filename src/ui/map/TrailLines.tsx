import type { Section } from '../../engine';
import { Icon } from '../icons/Icon';
import type { Bounds } from './mapLayout';
import { usePlacer } from './illustrated/geometryContext';
import { pathD, pathMiddle } from './illustrated/geometry';
import styles from './MapView.module.css';
import { LINE_LOOK, VISITED_LINE, walkedStrokes, type LineLook } from './looks';
import { MAP_STYLE, u } from '../../config/mapStyle';
import type { Bridge } from './illustrated/land/features';
import { pathStrokes } from './illustrated/pathLook';

/**
 * Dashed trail lines, styled by kind. Lines between two visited tiles turn
 * solid, in the party color of the first hiker who walked them (Phase 10.5).
 * The route view dims every line nobody has walked.
 */
export function TrailLines({
  section,
  bounds,
  from,
  reachable = [],
  colors = {},
  routes = false,
  illustrated = false,
  bridges = [],
}: {
  section: Section;
  bounds: Bounds;
  /** The selected hiker's tile, and the tiles they can move to: those lines glow gold. */
  from?: string | null;
  reachable?: string[];
  /** Each hiker's party color, for the lines they walked. */
  colors?: Readonly<Record<string, string>>;
  /** The route view: only walked lines stay bright. */
  routes?: boolean;
  /** The illustrated map's paths (Phase 10.5): gray until walked, and plank bridges. */
  illustrated?: boolean;
  bridges?: readonly Bridge[];
}) {
  const place = usePlacer(section);
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  return (
    <svg
      className={styles.lines}
      style={{ left: bounds.minX, top: bounds.minY, width: w, height: h }}
      viewBox={`${bounds.minX} ${bounds.minY} ${w} ${h}`}
      aria-hidden="true"
    >
      <g fill="none" strokeLinecap="round">
        {section.lines.map((line) => {
          const a = section.tiles[line.a];
          const b = section.tiles[line.b];
          if (!a || !b) return null;
          const d = pathD(place.path(line.id, a, b));
          const walker0 = line.walkedBy ? colors[line.walkedBy] : undefined;
          const reach =
            from &&
            ((line.a === from && reachable.includes(line.b)) ||
              (line.b === from && reachable.includes(line.a)));
          if (illustrated) {
            return (
              <g
                key={line.id}
                data-walked={walker0 ? line.walkedBy : undefined}
                opacity={routes && !walker0 ? MAP_STYLE.routes.unwalked : undefined}
              >
                {pathStrokes(line.kind, walker0, routes).map((s, i) => (
                  <path
                    key={i}
                    d={d}
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeOpacity={s.opacity}
                    strokeDasharray={s.dash}
                    strokeLinecap={s.cap}
                  />
                ))}
                {reach && (
                  <path
                    d={d}
                    stroke="#E9B44C"
                    strokeWidth={4}
                    strokeDasharray="9 7"
                    className={styles.reachLine}
                  />
                )}
              </g>
            );
          }
          const walked = a.visited && b.visited && line.kind !== 'paved';
          const walker = walker0;
          const strokes: LineLook['strokes'] = walker
            ? walkedStrokes(line.kind, walker)
            : walked
              ? [VISITED_LINE]
              : LINE_LOOK[line.kind].strokes;
          return (
            <g
              key={line.id}
              data-walked={walker ? line.walkedBy : undefined}
              opacity={routes && !walker ? MAP_STYLE.routes.unwalked : undefined}
            >
              <path d={d} stroke="#22322D" strokeOpacity={0.16} strokeWidth={12} />
              {strokes.map((s, i) => (
                <path
                  key={i}
                  d={d}
                  stroke={s.color}
                  strokeWidth={s.width}
                  strokeDasharray={s.dash}
                  strokeOpacity={s.opacity}
                />
              ))}
              {reach && (
                <path
                  d={d}
                  stroke="#E9B44C"
                  strokeWidth={4}
                  strokeDasharray="9 7"
                  className={styles.reachLine}
                />
              )}
            </g>
          );
        })}
      </g>
      {illustrated && bridges.map((b, i) => <BridgeMark key={i} bridge={b} />)}
    </svg>
  );
}

/** A small plank bridge where a path crosses water, turned to the path (gen11.py → bridge_svg). */
function BridgeMark({ bridge }: { bridge: Bridge }) {
  return (
    <g
      transform={`translate(${bridge.x} ${bridge.y}) rotate(${bridge.angle}) scale(${(u(1) * 0.8).toFixed(3)})`}
    >
      <rect
        x={-13}
        y={-7.5}
        width={26}
        height={15}
        rx={2}
        fill="#8A5A3C"
        stroke="#4A3A2E"
        strokeWidth={1.4}
      />
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={i}
          x1={-10 + i * 4}
          y1={-6.5}
          x2={-10 + i * 4}
          y2={6.5}
          stroke="#A8714A"
          strokeWidth={2}
        />
      ))}
      <line x1={-13} y1={-8.5} x2={13} y2={-8.5} stroke="#4A3A2E" strokeWidth={1.6} />
      <line x1={-13} y1={8.5} x2={13} y2={8.5} stroke="#4A3A2E" strokeWidth={1.6} />
    </g>
  );
}

/** The cost pill at the middle of each special line. */
export function LineBadges({ section }: { section: Section }) {
  const place = usePlacer(section);
  return (
    <>
      {section.lines.map((line) => {
        const look = LINE_LOOK[line.kind];
        const a = section.tiles[line.a];
        const b = section.tiles[line.b];
        if (!look.badge || !a || !b) return null;
        const mid = pathMiddle(place.path(line.id, a, b));
        return (
          <div
            key={line.id}
            className={styles.badge}
            title={look.tooltip}
            style={{
              left: mid.x,
              top: mid.y,
              background: look.badge.bg,
              color: look.badge.fg,
            }}
          >
            <Icon name={look.badge.icon} size={12} strokeWidth={2.5} />
            <span>{look.badge.text}</span>
          </div>
        );
      })}
    </>
  );
}
