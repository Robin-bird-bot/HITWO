/**
 * Checks that a section is a valid trail. Returns plain-language problems;
 * an empty list means the section is fine. Used by the generator tests and
 * shown on the debug map page.
 */
import { BALANCE } from '../../config/balance';
import { LINE_KINDS, NODE_TYPES, type Section, type Tile, type TileId } from '../types';

const cfg = BALANCE.trail;
const EDGE_WIDTH = Math.min(2, cfg.maxWidth);

export function checkSection(section: Section): string[] {
  const problems: string[] = [];
  const tiles = Object.values(section.tiles);
  const byId = section.tiles;

  for (const [key, t] of Object.entries(byId)) {
    if (t.id !== key) problems.push(`Tile stored as ${key} calls itself ${t.id}.`);
  }

  // ── One start, one end ──
  const heads = tiles.filter((t) => t.kind === 'trailhead');
  const checkpoints = tiles.filter((t) => t.kind === 'checkpoint');
  if (heads.length !== 1) problems.push(`Expected 1 trailhead, found ${heads.length}.`);
  if (checkpoints.length !== 1)
    problems.push(`Expected 1 checkpoint, found ${checkpoints.length}.`);
  const head = byId[section.trailheadId];
  const checkpoint = byId[section.checkpointId];
  if (head?.kind !== 'trailhead') problems.push('trailheadId doesn’t point at the trailhead.');
  if (checkpoint?.kind !== 'checkpoint')
    problems.push('checkpointId doesn’t point at the checkpoint.');
  const lastRow = Math.max(...tiles.map((t) => t.row));
  if (head && head.row !== 0) problems.push(`The trailhead is in row ${head.row}, not row 0.`);
  if (checkpoint && checkpoint.row !== lastRow)
    problems.push('The checkpoint isn’t in the top row.');

  // ── Rows ──
  const rows = new Map<number, Tile[]>();
  for (const t of tiles) rows.set(t.row, [...(rows.get(t.row) ?? []), t]);
  for (let r = 0; r <= lastRow; r++) {
    const row = (rows.get(r) ?? []).sort((a, b) => a.col - b.col);
    const isEnd = r === 0 || r === lastRow;
    const nextToEnd = r === 1 || r === lastRow - 1;
    const max = isEnd ? 1 : nextToEnd ? EDGE_WIDTH : cfg.maxWidth;
    const min = isEnd ? 1 : nextToEnd ? Math.min(cfg.minWidth, EDGE_WIDTH) : cfg.minWidth;
    if (row.length < min || row.length > max) {
      problems.push(`Row ${r} has ${row.length} tiles (allowed ${min}–${max}).`);
    }
    for (let i = 1; i < row.length; i++) {
      const gap = (row[i] as Tile).col - (row[i - 1] as Tile).col;
      if (gap !== 2) problems.push(`Row ${r} has a gap of ${gap} half-steps between tiles.`);
    }
  }
  const middleCount = tiles.length - 2;
  const maxMiddle =
    cfg.middleRows === 1 ? EDGE_WIDTH : (cfg.middleRows - 2) * cfg.maxWidth + 2 * EDGE_WIDTH;
  if (lastRow !== cfg.middleRows + 1) {
    problems.push(`Expected ${cfg.middleRows} middle rows, found ${lastRow - 1}.`);
  }
  if (middleCount > maxMiddle) problems.push(`Too many tiles: ${middleCount} (max ${maxMiddle}).`);

  // ── Lines ──
  const seen = new Set<string>();
  const neighbours = new Map<TileId, Tile[]>();
  for (const line of section.lines) {
    const a = byId[line.a];
    const b = byId[line.b];
    if (!a || !b) {
      problems.push(`Line ${line.id} joins a tile that doesn’t exist.`);
      continue;
    }
    const key = [line.a, line.b].sort().join('|');
    if (seen.has(key)) problems.push(`Tiles ${line.a} and ${line.b} are joined twice.`);
    seen.add(key);
    const dRow = Math.abs(a.row - b.row);
    const dCol = Math.abs(a.col - b.col);
    const ok = (dRow === 1 && dCol === 1) || (dRow === 0 && dCol === 2);
    if (!ok) problems.push(`Line ${line.id} joins tiles that aren’t neighbours.`);
    if (!LINE_KINDS.includes(line.kind))
      problems.push(`Line ${line.id} has unknown kind ${line.kind}.`);
    neighbours.set(a.id, [...(neighbours.get(a.id) ?? []), b]);
    neighbours.set(b.id, [...(neighbours.get(b.id) ?? []), a]);
  }

  for (const t of tiles) {
    const near = neighbours.get(t.id) ?? [];
    if (t.kind !== 'trailhead' && !near.some((n) => n.row === t.row - 1)) {
      problems.push(`Tile ${t.id} has no line down.`);
    }
    if (t.kind !== 'checkpoint' && !near.some((n) => n.row === t.row + 1)) {
      problems.push(`Tile ${t.id} has no line up (a dead end).`);
    }
  }

  if (head) {
    const reached = new Set<TileId>([head.id]);
    const queue = [head.id];
    while (queue.length) {
      const id = queue.shift() as TileId;
      for (const n of neighbours.get(id) ?? []) {
        if (!reached.has(n.id)) {
          reached.add(n.id);
          queue.push(n.id);
        }
      }
    }
    for (const t of tiles) if (!reached.has(t.id)) problems.push(`Tile ${t.id} can’t be reached.`);
  }

  // ── Nodes, specials and side features ──
  const featureCounts = { merchant: 0, trader: 0 };
  for (const t of tiles) {
    if (t.kind !== 'normal') {
      if (t.nodes.length) problems.push(`The ${t.kind} ${t.id} has nodes.`);
      if (t.special) problems.push(`The ${t.kind} ${t.id} is a special space.`);
      if (t.feature) problems.push(`The ${t.kind} ${t.id} has a ${t.feature}.`);
      continue;
    }
    if (t.nodes.length < 1 || t.nodes.length > 3) {
      problems.push(`Tile ${t.id} has ${t.nodes.length} nodes (allowed 1–3).`);
    }
    for (const type of NODE_TYPES) {
      const n = t.nodes.filter((x) => x.type === type).length;
      if (n > cfg.maxSameNode) problems.push(`Tile ${t.id} has ${n} ${type} nodes.`);
    }
    const caps = t.nodes.filter((x) => x.type === 'caps').length;
    if (caps > 1) problems.push(`Tile ${t.id} has ${caps} Cap nodes.`);
    if (t.nodes.length && caps === t.nodes.length)
      problems.push(`Tile ${t.id} has no resource node.`);
    if (t.nodes.some((x) => x.bounty && x.type === 'caps')) {
      problems.push(`Tile ${t.id} has a Bounty Cap node.`);
    }
    const narrow = t.special === 'narrowPath';
    const cap = t.narrowCapacity;
    if (
      narrow &&
      (cap === undefined || cap < cfg.narrowCapacity.min || cap > cfg.narrowCapacity.max)
    ) {
      problems.push(`Narrow Path ${t.id} has capacity ${cap ?? 'none'}.`);
    }
    if (!narrow && cap !== undefined)
      problems.push(`Tile ${t.id} has a capacity but isn’t a Narrow Path.`);
    if (t.feature) {
      featureCounts[t.feature] += 1;
      if (t.special) problems.push(`Tile ${t.id} has a ${t.feature} on a special space.`);
    }
  }
  for (const feature of ['merchant', 'trader'] as const) {
    const max = cfg.sideFeatures[feature].maxPerSection;
    if (featureCounts[feature] > max) {
      problems.push(`${featureCounts[feature]} ${feature}s in one section (max ${max}).`);
    }
  }

  return problems;
}
