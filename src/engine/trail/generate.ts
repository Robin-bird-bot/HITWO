/**
 * Generates one section's trail: a tree of hex tiles from one trailhead,
 * branching out and rejoining at the checkpoint.
 *
 * Layout: a staggered hex grid. `col` counts half-tile steps, so tiles in a
 * row are 2 apart and a tile's neighbours in the next row are at col ± 1.
 * Every tile keeps at least one line down and one line up, so every tile is
 * reachable from the trailhead and can reach the checkpoint.
 */
import { BALANCE } from '../../config/balance';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY,
  MAX_CHALLENGES_IN_A_ROW,
  type DifficultyId,
} from '../../config/difficulty';
import { ENABLE_WONDERS, WONDERS } from '../../content/wonders';
import { int, pick, roll, shuffle, weightedPick, type Weighted } from '../rng';
import {
  LINE_KINDS,
  NODE_TYPES,
  SPECIAL_SPACES,
  type BiomeId,
  type Line,
  type NodeType,
  type RngState,
  type Section,
  type SideFeature,
  type Tile,
  type TileId,
  type TileNode,
} from '../types';

const cfg = BALANCE.trail;

/** The trailhead and checkpoint each have two hex neighbours, so the rows next to them hold at most 2. */
const EDGE_WIDTH = Math.min(2, cfg.maxWidth);

export interface SectionOptions {
  biome: BiomeId;
  tier: number;
  /**
   * Wonders already used this run, so each biome gets a new one (the station
   * passes them when it makes the next section).
   */
  usedWonders?: readonly string[];
  /** The difficulty: how many rows, and how many plain tiles hold a challenge (Phase 10.6). */
  difficulty?: DifficultyId;
}

/** How many middle rows a section has at this difficulty. */
export function middleRowsFor(difficulty: DifficultyId = DEFAULT_DIFFICULTY): number {
  return Math.max(1, Math.round(cfg.middleRows * DIFFICULTY[difficulty].sectionRows));
}

export const tileId = (row: number, col: number): TileId => `r${row}c${col}`;

function weightsOf<K extends string | number>(weights: Record<K, number>, keys: readonly K[]) {
  return keys.map((item): Weighted<K> => ({ item, weight: weights[item] }));
}

// ── Rows ───────────────────────────────────────────────────────────────────

interface RowSpan {
  /** Leftmost col. */
  start: number;
  width: number;
}

const colsOf = (span: RowSpan) => Array.from({ length: span.width }, (_, i) => span.start + 2 * i);
const centerOf = (span: RowSpan) => span.start + span.width - 1;

/** The cols in each row, from the trailhead (row 0) to the checkpoint. */
function layoutRows(rng: RngState, middleRows: number): number[][] {
  const rows: number[][] = [[0]];
  let span: RowSpan = EDGE_WIDTH === 2 ? { start: -1, width: 2 } : { start: 1, width: 1 };
  rows.push(colsOf(span));

  const w = cfg.widthChangeWeights;
  for (let r = 1; r < middleRows; r++) {
    const rowsAfter = middleRows - 1 - r;
    const center = centerOf(span);
    const towardCenter = (shift: number) =>
      Math.sign(center) === -Math.sign(shift) ? cfg.recenterWeight : 1;
    const options: Weighted<RowSpan>[] = [
      { item: { start: span.start - 1, width: span.width + 1 }, weight: w.grow },
      { item: { start: span.start - 1, width: span.width }, weight: w.same * towardCenter(-1) },
      { item: { start: span.start + 1, width: span.width }, weight: w.same * towardCenter(1) },
      { item: { start: span.start + 1, width: span.width - 1 }, weight: w.shrink },
    ].filter(
      ({ item }) =>
        item.width >= Math.min(cfg.minWidth, EDGE_WIDTH) &&
        item.width <= cfg.maxWidth &&
        // Must still be able to narrow to EDGE_WIDTH by the last middle row.
        item.width <= EDGE_WIDTH + rowsAfter &&
        (rowsAfter === 0 || item.width >= cfg.minWidth),
    );
    span = weightedPick(rng, options);
    rows.push(colsOf(span));
  }

  // The checkpoint sits above the last middle row.
  const last = colsOf(span);
  const checkpointCol =
    last.length === 2 ? centerOf(span) : (last[0] as number) + (centerOf(span) > 0 ? -1 : 1);
  rows.push([checkpointCol]);
  return rows;
}

// ── Lines ──────────────────────────────────────────────────────────────────

function makeLines(rng: RngState, rows: number[][]): Line[] {
  const lines: { a: TileId; b: TileId }[] = [];
  const add = (a: TileId, b: TileId) => lines.push({ a, b });

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] as number[];
    const isMiddle = r > 0 && r < rows.length - 1;

    // Sideways lines between neighbours in the same row.
    if (isMiddle) {
      for (let i = 0; i + 1 < row.length; i++) {
        if (roll(rng, cfg.sidewaysLineChance)) {
          add(tileId(r, row[i] as number), tileId(r, row[i + 1] as number));
        }
      }
    }

    // Lines up to the next row.
    const next = rows[r + 1];
    if (!next) continue;
    const candidates: [number, number][] = [];
    for (const a of row) for (const b of next) if (Math.abs(a - b) === 1) candidates.push([a, b]);
    const kept = candidates.filter(() => roll(rng, cfg.keepUpLineChance));
    // Every tile keeps a line up, and every tile in the next row keeps a line down.
    for (const a of row) {
      if (!kept.some(([x]) => x === a))
        kept.push(
          pickFrom(
            rng,
            candidates.filter(([x]) => x === a),
          ),
        );
    }
    for (const b of next) {
      if (!kept.some(([, y]) => y === b))
        kept.push(
          pickFrom(
            rng,
            candidates.filter(([, y]) => y === b),
          ),
        );
    }
    kept.sort(([a1, b1], [a2, b2]) => a1 - a2 || b1 - b2);
    for (const [a, b] of kept) add(tileId(r, a), tileId(r + 1, b));
  }

  const kindWeights = weightsOf(cfg.lineKindWeights, LINE_KINDS);
  return lines.map(({ a, b }) => ({ id: `${a}~${b}`, a, b, kind: weightedPick(rng, kindWeights) }));
}

function pickFrom<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('generateSection: a tile has no possible line');
  return items[int(rng, 0, items.length - 1)] as T;
}

// ── Tiles ──────────────────────────────────────────────────────────────────

function makeNodes(rng: RngState, biome: BiomeId): TileNode[] {
  const count = weightedPick(rng, weightsOf(cfg.nodeCountWeights, [1, 2, 3] as const));
  const typeWeights = BALANCE.biomes.nodeWeights[biome];
  const nodes: TileNode[] = [];
  const counts: Partial<Record<NodeType, number>> = {};

  for (let i = 0; i < count; i++) {
    const revealed = roll(rng, cfg.nodeRevealedChance);
    // The first node is always a resource node, and a tile has at most one Cap node.
    const canBeCap = i > 0 && !nodes.some((n) => n.type === 'caps');
    if (roll(rng, cfg.capNodeChance) && canBeCap) {
      nodes.push({ type: 'caps', revealed });
      continue;
    }
    const allowed = NODE_TYPES.filter((t) => (counts[t] ?? 0) < cfg.maxSameNode);
    const type = weightedPick(rng, weightsOf(typeWeights, allowed));
    counts[type] = (counts[type] ?? 0) + 1;
    const bounty = roll(rng, cfg.bountyChance);
    nodes.push(bounty ? { type, revealed, bounty: true } : { type, revealed });
  }
  return nodes;
}

function decorate(rng: RngState, tile: Tile, biome: BiomeId): void {
  tile.nodes = makeNodes(rng, biome);
  if (roll(rng, cfg.specialChance)) {
    tile.special = weightedPick(rng, weightsOf(cfg.specialWeights, SPECIAL_SPACES));
    if (tile.special === 'narrowPath') {
      tile.narrowCapacity = int(rng, cfg.narrowCapacity.min, cfg.narrowCapacity.max);
    }
  }
}

function addSideFeatures(rng: RngState, middle: Tile[]): void {
  const features: SideFeature[] = ['merchant', 'trader'];
  for (const feature of features) {
    const { chance, maxPerSection } = cfg.sideFeatures[feature];
    let placed = 0;
    for (const tile of shuffle(rng, middle)) {
      if (placed >= maxPerSection) break;
      if (tile.special || tile.feature) continue;
      if (roll(rng, chance)) {
        tile.feature = feature;
        placed += 1;
      }
    }
  }
}

/**
 * One Wonder per biome (Nov 6 update, 3a), at a random middle tile without a
 * special space or side feature. Its tile has no nodes, but shows as many
 * hidden node badges as an ordinary tile until it's revealed.
 */
function placeWonder(rng: RngState, middle: Tile[], used: readonly string[]): void {
  const spots = middle.filter((t) => !t.special && !t.feature);
  if (!spots.length || !WONDERS.length) return;
  const tile = pick(rng, spots);
  const fresh = WONDERS.filter((w) => !used.includes(w.id));
  const wonder = pick(rng, fresh.length ? fresh : WONDERS);
  const decoys = weightedPick(rng, weightsOf(cfg.nodeCountWeights, [1, 2, 3] as const));
  tile.nodes = [];
  tile.wonder = { id: wonder.id, decoys };
}

// ── Section ────────────────────────────────────────────────────────────────

/**
 * What each plain tile holds (Phase 10.6). Plain tiles are every middle tile
 * without a special space. `round(challengeShare × plain)` of them get a
 * challenge, placed so no path from the trailhead up has more than
 * MAX_CHALLENGES_IN_A_ROW in a row, if that can be avoided. Then
 * `opportunitiesPerSection` of the rest get an opportunity, and every other
 * plain tile is quiet: only scavenging. Special spaces keep working as before.
 */
function placeCards(rng: RngState, middle: Tile[], lines: Line[], difficulty: DifficultyId): void {
  const d = DIFFICULTY[difficulty];
  const plain = middle.filter((t) => !t.special && !t.wonder);
  const want = Math.round(Math.max(0, Math.min(1, d.challengeShare)) * plain.length);
  const order = shuffle(rng, plain);
  const ids = new Set<TileId>();
  const skipped: Tile[] = [];
  for (const t of order) {
    if (ids.size >= want) break;
    ids.add(t.id);
    if (longestRun(ids, lines, middle) > MAX_CHALLENGES_IN_A_ROW) {
      ids.delete(t.id);
      skipped.push(t);
    }
  }
  // Can't be avoided: fill up with the ones that make a long run.
  for (const t of skipped) {
    if (ids.size >= want) break;
    ids.add(t.id);
  }
  const rest = shuffle(
    rng,
    plain.filter((t) => !ids.has(t.id)),
  );
  const opportunities = Math.min(d.opportunitiesPerSection, rest.length);
  rest.forEach((t, i) => {
    if (i < opportunities) t.opportunity = true;
    else t.quiet = true;
  });
}

/**
 * The longest run of challenge tiles in a row along a path that only goes up
 * or sideways (the way from the trailhead to the checkpoint).
 */
export function longestRun(
  ids: ReadonlySet<TileId>,
  lines: readonly Line[],
  tiles: readonly Tile[],
): number {
  const row = new Map(tiles.map((t) => [t.id, t.row]));
  const next = new Map<TileId, TileId[]>();
  const link = (from: TileId, to: TileId) => {
    if (!ids.has(from) || !ids.has(to)) return;
    const ra = row.get(from);
    const rb = row.get(to);
    if (ra === undefined || rb === undefined || rb < ra) return;
    next.set(from, [...(next.get(from) ?? []), to]);
  };
  for (const l of lines) {
    link(l.a, l.b);
    link(l.b, l.a);
  }
  let best = 0;
  const seen = new Set<TileId>();
  const walk = (id: TileId, length: number) => {
    best = Math.max(best, length);
    for (const n of next.get(id) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      walk(n, length + 1);
      seen.delete(n);
    }
  };
  for (const id of ids) {
    seen.add(id);
    walk(id, 1);
    seen.delete(id);
  }
  return best;
}

export function generateSection(
  rng: RngState,
  { biome, tier, usedWonders = [], difficulty = DEFAULT_DIFFICULTY }: SectionOptions,
): Section {
  const rows = layoutRows(rng, middleRowsFor(difficulty));
  const lastRow = rows.length - 1;
  const tiles: Record<TileId, Tile> = {};
  const middle: Tile[] = [];

  rows.forEach((cols, row) => {
    for (const col of cols) {
      const kind = row === 0 ? 'trailhead' : row === lastRow ? 'checkpoint' : 'normal';
      const tile: Tile = { id: tileId(row, col), row, col, kind, special: null, nodes: [] };
      tiles[tile.id] = tile;
      if (kind === 'normal') middle.push(tile);
    }
  });

  const lines = makeLines(rng, rows);
  for (const tile of middle) decorate(rng, tile, biome);
  addSideFeatures(rng, middle);
  // Wonders are switched off for now (Phase 10.6).
  if (ENABLE_WONDERS) placeWonder(rng, middle, usedWonders);
  placeCards(rng, middle, lines, difficulty);

  return {
    biome,
    tier,
    tiles,
    lines,
    trailheadId: tileId(0, 0),
    checkpointId: tileId(lastRow, (rows[lastRow] as number[])[0] as number),
  };
}
