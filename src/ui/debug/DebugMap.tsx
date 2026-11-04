/**
 * Dev page for reviewing generated trails: /#debug-map?seed=123.
 * Plain SVG, no game state; the real map comes in Phase 3.
 */
import { useMemo } from 'react';
import { tileLabel } from '../../content/tileLabels';
import { ASSETS } from '../../config/assets';
import {
  checkSection,
  generateSection,
  LINE_KINDS,
  seedRng,
  SPECIAL_SPACES,
  type BiomeId,
  type Line,
  type LineKind,
  type NodeKind,
  type Section,
  type Tile,
  type TileNode,
} from '../../engine';
import { hashParams } from '../app/useHash';
import { Icon } from '../icons/Icon';
import { LINE_LOOK as MAP_LINE_LOOK, SPECIAL_LOOK } from '../map/looks';
import styles from './DebugMap.module.css';

const BIOMES: { id: BiomeId; name: string }[] = [
  { id: 'meadow', name: 'Meadow' },
  { id: 'temperateRainforest', name: 'Temperate Rainforest' },
  { id: 'alpine', name: 'Alpine' },
];

/** The debug map draws each line in one solid color: the kind's main stroke color. */
const lineColor = (kind: LineKind) => MAP_LINE_LOOK[kind].strokes[0]?.color ?? '#F7F1E4';

const NODE_IMAGE: Record<NodeKind, string> = { ...ASSETS.nodes, caps: ASSETS.icons.acornCaps };

// Geometry (SVG units): pointy-top hexes on a staggered grid, trailhead at the bottom.
const HEX_W = 96;
const HEX_H = 110;
const HALF_STEP = 62;
const ROW_STEP = 140;
const PAD = 80;

function hexPoints(cx: number, cy: number, w = HEX_W, h = HEX_H) {
  const x = w / 2;
  const y = h / 2;
  return [
    [cx, cy - y],
    [cx + x, cy - y / 2],
    [cx + x, cy + y / 2],
    [cx, cy + y],
    [cx - x, cy + y / 2],
    [cx - x, cy - y / 2],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

interface DebugParams {
  seed: number;
  biome: BiomeId;
  showHidden: boolean;
}

function readParams(hash: string): DebugParams {
  const p = hashParams(hash);
  const seed = Number.parseInt(p.get('seed') ?? '', 10);
  const biome = BIOMES.find((b) => b.id === p.get('biome'))?.id ?? 'meadow';
  return { seed: Number.isFinite(seed) ? seed : 1, biome, showHidden: p.get('hidden') === '1' };
}

function writeParams(next: DebugParams) {
  const p = new URLSearchParams({ seed: String(next.seed) });
  if (next.biome !== 'meadow') p.set('biome', next.biome);
  if (next.showHidden) p.set('hidden', '1');
  window.location.hash = `debug-map?${p.toString()}`;
}

export function DebugMap({ hash }: { hash: string }) {
  const params = readParams(hash);
  const { seed, biome, showHidden } = params;
  const section = useMemo(() => generateSection(seedRng(seed), { biome, tier: 1 }), [seed, biome]);
  const problems = useMemo(() => checkSection(section), [section]);
  const set = (patch: Partial<DebugParams>) => writeParams({ ...params, ...patch });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Trail debug</h1>
        <label className={styles.field}>
          Seed
          <input
            className={styles.seed}
            type="number"
            value={seed}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) set({ seed: n });
            }}
          />
        </label>
        <button type="button" className={styles.button} onClick={() => set({ seed: seed - 1 })}>
          ◀ Prev
        </button>
        <button type="button" className={styles.button} onClick={() => set({ seed: seed + 1 })}>
          Next ▶
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => set({ seed: Math.floor(Math.random() * 1_000_000) })}
        >
          Random
        </button>
        <label className={styles.field}>
          Biome
          <select
            className={styles.select}
            value={biome}
            onChange={(e) => set({ biome: e.target.value as BiomeId })}
          >
            {BIOMES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => set({ showHidden: e.target.checked })}
          />
          Show hidden nodes
        </label>
        <a className={styles.back} href="#">
          Title screen
        </a>
      </header>

      <main className={styles.body}>
        <TrailSvg section={section} seed={seed} showHidden={showHidden} />
        <Summary section={section} problems={problems} />
      </main>
    </div>
  );
}

function TrailSvg({
  section,
  seed,
  showHidden,
}: {
  section: Section;
  seed: number;
  showHidden: boolean;
}) {
  const tiles = Object.values(section.tiles);
  const minCol = Math.min(...tiles.map((t) => t.col));
  const maxCol = Math.max(...tiles.map((t) => t.col));
  const lastRow = Math.max(...tiles.map((t) => t.row));
  const width = (maxCol - minCol) * HALF_STEP + 2 * PAD + HEX_W;
  const height = lastRow * ROW_STEP + 2 * PAD + HEX_H / 2;
  const pos = (t: Tile) => ({
    x: PAD + HEX_W / 2 + (t.col - minCol) * HALF_STEP,
    y: PAD + HEX_H / 4 + (lastRow - t.row) * ROW_STEP,
  });

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Generated trail for seed ${seed}`}
    >
      {section.lines.map((line) => (
        <TrailLine key={line.id} line={line} section={section} pos={pos} />
      ))}
      {tiles.map((t) => (
        <TrailTile key={t.id} tile={t} at={pos(t)} showHidden={showHidden} />
      ))}
    </svg>
  );
}

function TrailLine({
  line,
  section,
  pos,
}: {
  line: Line;
  section: Section;
  pos: (t: Tile) => { x: number; y: number };
}) {
  const a = pos(section.tiles[line.a] as Tile);
  const b = pos(section.tiles[line.b] as Tile);
  const look = MAP_LINE_LOOK[line.kind];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <g>
      <title>{look.tooltip}</title>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={lineColor(line.kind)}
        strokeWidth={line.kind === 'normal' ? 5 : 7}
        strokeDasharray={line.kind === 'normal' ? '10 8' : undefined}
        strokeLinecap="round"
      />
      {look.badge && (
        <g color={look.badge.fg}>
          <rect x={mid.x - 25} y={mid.y - 11} width={50} height={22} rx={11} fill={look.badge.bg} />
          <Icon name={look.badge.icon} size={12} strokeWidth={2.5} x={mid.x - 19} y={mid.y - 6} />
          <text x={mid.x + 7} y={mid.y + 4} className={styles.badgeText} fill={look.badge.fg}>
            {look.badge.text}
          </text>
        </g>
      )}
    </g>
  );
}

function TrailTile({
  tile,
  at,
  showHidden,
}: {
  tile: Tile;
  at: { x: number; y: number };
  showHidden: boolean;
}) {
  const end = tile.kind !== 'normal';
  const fill =
    tile.kind === 'checkpoint' ? '#D9513C' : tile.kind === 'trailhead' ? '#E4D8BF' : '#C3D5C5';
  const allKnown = tile.nodes.every((n) => n.revealed);
  const label =
    tile.kind === 'trailhead'
      ? 'START'
      : tile.kind === 'checkpoint'
        ? 'CHECKPOINT'
        : allKnown || showHidden
          ? tileLabel(tile.nodes)?.toUpperCase()
          : undefined;
  const special = tile.special ? SPECIAL_LOOK[tile.special] : null;

  return (
    <g>
      <title>{tile.id}</title>
      <polygon points={hexPoints(at.x, at.y)} fill={fill} stroke="#F7F1E4" strokeWidth={4} />
      {special && (
        <g>
          <circle
            cx={at.x}
            cy={at.y - 22}
            r={17}
            fill={special.bg}
            stroke="#F7F1E4"
            strokeWidth={2}
          />
          {tile.special === 'narrowPath' ? (
            <text x={at.x} y={at.y - 16} className={styles.specialLetter}>
              {tile.narrowCapacity}
            </text>
          ) : (
            <Icon name={special.icon} size={18} color={special.fg} x={at.x - 9} y={at.y - 31} />
          )}
          <text x={at.x} y={at.y + 9} className={styles.tileText}>
            {special.name.toUpperCase()}
          </text>
        </g>
      )}
      {!special && label && (
        <text x={at.x} y={at.y - (end ? -4 : 8)} className={end ? styles.endText : styles.tileText}>
          {label}
        </text>
      )}
      {tile.feature && (
        <g>
          <title>{tile.feature === 'merchant' ? 'Merchant' : 'Traveling Trader'}</title>
          <circle
            cx={at.x - 40}
            cy={at.y - 34}
            r={13}
            fill="#E9B44C"
            stroke="#1D2220"
            strokeWidth={2}
          />
          <text x={at.x - 40} y={at.y - 29} className={styles.featureText}>
            {tile.feature === 'merchant' ? '$' : '⇄'}
          </text>
        </g>
      )}
      <NodeRow nodes={tile.nodes} x={at.x} y={at.y + 30} showHidden={showHidden} />
      <text x={at.x} y={at.y + HEX_H / 2 + 16} className={styles.idText}>
        {tile.id}
      </text>
    </g>
  );
}

function NodeRow({
  nodes,
  x,
  y,
  showHidden,
}: {
  nodes: TileNode[];
  x: number;
  y: number;
  showHidden: boolean;
}) {
  const size = 24;
  const gap = 4;
  const start = x - (nodes.length * size + (nodes.length - 1) * gap) / 2;
  return (
    <g>
      {nodes.map((n, i) => {
        const nx = start + i * (size + gap);
        const cx = nx + size / 2;
        const known = n.revealed || showHidden;
        return (
          <g key={i} opacity={!n.revealed && showHidden ? 0.55 : 1}>
            <title>{`${n.type}${n.bounty ? ' (Bounty)' : ''}${n.revealed ? '' : ' — hidden'}`}</title>
            {known ? (
              <image href={NODE_IMAGE[n.type]} x={nx} y={y - 14} width={size} height={size + 4} />
            ) : (
              <>
                <polygon points={hexPoints(cx, y, size - 2, size + 2)} fill="#5F7A70" />
                <text x={cx} y={y + 5} className={styles.hiddenText}>
                  ?
                </text>
              </>
            )}
            {n.bounty && (
              <polygon
                points={hexPoints(cx, y, size + 6, size + 10)}
                fill="none"
                stroke="#E9B44C"
                strokeWidth={3}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function Summary({ section, problems }: { section: Section; problems: string[] }) {
  const tiles = Object.values(section.tiles);
  const middle = tiles.filter((t) => t.kind === 'normal');
  const nodes = middle.flatMap((t) => t.nodes);
  const count = <T,>(items: T[], test: (x: T) => boolean) => items.filter(test).length;

  return (
    <aside className={styles.summary}>
      <h2 className={styles.heading}>Summary</h2>
      <dl className={styles.stats}>
        <dt>Tiles</dt>
        <dd>{middle.length} + trailhead + checkpoint</dd>
        <dt>Nodes</dt>
        <dd>
          {nodes.length} ({count(nodes, (n) => n.revealed)} revealed,{' '}
          {count(nodes, (n) => n.type === 'caps')} Cap, {count(nodes, (n) => !!n.bounty)} Bounty)
        </dd>
        <dt>Specials</dt>
        <dd>{count(middle, (t) => !!t.special)}</dd>
        <dt>Side features</dt>
        <dd>
          {count(middle, (t) => t.feature === 'merchant')} Merchant,{' '}
          {count(middle, (t) => t.feature === 'trader')} Trader
        </dd>
      </dl>

      <h3 className={styles.subheading}>Lines ({section.lines.length})</h3>
      <ul className={styles.legend}>
        {LINE_KINDS.map((kind) => (
          <li key={kind}>
            <span className={styles.swatch} style={{ background: lineColor(kind) }} />
            {MAP_LINE_LOOK[kind].tooltip} — {count(section.lines, (l) => l.kind === kind)}
          </li>
        ))}
      </ul>

      <h3 className={styles.subheading}>Special spaces</h3>
      <ul className={styles.legend}>
        {SPECIAL_SPACES.map((sp) => {
          const n = count(middle, (t) => t.special === sp);
          return n ? (
            <li key={sp}>
              <span className={styles.swatch} style={{ background: SPECIAL_LOOK[sp].bg }} />
              {SPECIAL_LOOK[sp].name} — {n}
            </li>
          ) : null;
        })}
      </ul>

      <h3 className={styles.subheading}>Checks</h3>
      {problems.length === 0 ? (
        <p className={styles.ok}>No problems found.</p>
      ) : (
        <ul className={styles.problems}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
