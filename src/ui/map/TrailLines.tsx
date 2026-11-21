import type { Section } from '../../engine';
import { Icon } from '../icons/Icon';
import { lastRowOf, tileCenter, type Bounds } from './mapLayout';
import styles from './MapView.module.css';
import { LINE_LOOK, VISITED_LINE, walkedStrokes, type LineLook } from './looks';
import { MAP_STYLE } from '../../config/mapStyle';

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
}) {
  const lastRow = lastRowOf(section);
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
          const p = tileCenter(a, lastRow);
          const q = tileCenter(b, lastRow);
          const d = `M${p.x} ${p.y} L${q.x} ${q.y}`;
          const walked = a.visited && b.visited && line.kind !== 'paved';
          const walker = line.walkedBy ? colors[line.walkedBy] : undefined;
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
              {from &&
                ((line.a === from && reachable.includes(line.b)) ||
                  (line.b === from && reachable.includes(line.a))) && (
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
    </svg>
  );
}

/** The cost pill at the middle of each special line. */
export function LineBadges({ section }: { section: Section }) {
  const lastRow = lastRowOf(section);
  return (
    <>
      {section.lines.map((line) => {
        const look = LINE_LOOK[line.kind];
        const a = section.tiles[line.a];
        const b = section.tiles[line.b];
        if (!look.badge || !a || !b) return null;
        const p = tileCenter(a, lastRow);
        const q = tileCenter(b, lastRow);
        return (
          <div
            key={line.id}
            className={styles.badge}
            title={look.tooltip}
            style={{
              left: (p.x + q.x) / 2,
              top: (p.y + q.y) / 2,
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
