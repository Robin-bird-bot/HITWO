/**
 * Camp Cleanup's demo bot (docs/design/20-challenge-popup.md, section 7):
 * at each new cell it finds the shortest way (breadth-first) to the nearest
 * piece of trash still needed, around the walls, obstacles and the line,
 * and turns onto it. About [15%] of the time it wanders: a random way
 * that's clear for now (and, rarely, any way at all, so it still crashes
 * now and then). Nov 26 evening: with the smaller grids and more obstacles,
 * a random turn straight into something crashed it far too often.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { bagsOf, OPPOSITE, room, STEP, type CampCleanupState, type Dir } from './logic';

const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];

export function campCleanupBot(
  s: CampCleanupState,
  mem: Record<string, unknown>,
  rng: RngState,
): Dir | null {
  if (s.over || (s.phase !== 'run' && s.phase !== 'wait')) return null;
  const head = s.snake[0];
  if (!head) return null;
  const at = `${head.x},${head.y},${s.phase}`;
  if (mem.at === at) return null;
  mem.at = at;
  const heading = s.queue.at(-1) ?? s.dir;
  const ways = DIRS.filter((d) => s.phase === 'wait' || d !== OPPOSITE[heading]);
  const blocked = new Set<string>();
  for (const g of s.snake.slice(0, -1)) blocked.add(`${g.x},${g.y}`);
  for (const o of s.obstacles)
    for (let i = 0; i < o.w; i++)
      for (let j = 0; j < o.h; j++) blocked.add(`${o.x + i},${o.y + j}`);
  const clear = (d: Dir) => {
    const x = head.x + STEP[d].x;
    const y = head.y + STEP[d].y;
    return x >= 0 && y >= 0 && x < s.cols && y < s.rows && !blocked.has(`${x},${y}`);
  };
  if (nextFloat(rng) < 0.15) {
    const safe = ways.filter(clear);
    const from = safe.length && nextFloat(rng) > 0.1 ? safe : ways;
    return from[Math.floor(nextFloat(rng) * from.length)] ?? null;
  }
  const wanted = s.trash.filter((t) => bagsOf(s, t.owner) < s.quota);
  const goals = new Set((wanted.length ? wanted : s.trash).map((t) => `${t.x},${t.y}`));
  // Breadth-first from each first step.
  const seen = new Set<string>([`${head.x},${head.y}`]);
  const queue: { x: number; y: number; first: Dir }[] = [];
  for (const d of ways) {
    const x = head.x + STEP[d].x;
    const y = head.y + STEP[d].y;
    const k = `${x},${y}`;
    if (x < 0 || y < 0 || x >= s.cols || y >= s.rows || blocked.has(k)) continue;
    seen.add(k);
    queue.push({ x, y, first: d });
  }
  // A first step that leaves less room than the line is long is a trap: avoid it when there's another.
  const roomOf = new Map(
    queue.map((c) => [c.first, room(s, { x: c.x, y: c.y }, blocked)] as const),
  );
  const roomy = (d: Dir) => (roomOf.get(d) ?? 0) >= s.snake.length;
  const anyRoomy = queue.some((c) => roomy(c.first));
  const go = (d: Dir) => (d === heading && s.phase === 'run' ? null : d);
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    if (goals.has(`${c.x},${c.y}`) && (roomy(c.first) || !anyRoomy)) return go(c.first);
    for (const d of DIRS) {
      const x = c.x + STEP[d].x;
      const y = c.y + STEP[d].y;
      const k = `${x},${y}`;
      if (x < 0 || y < 0 || x >= s.cols || y >= s.rows || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push({ x, y, first: c.first });
    }
  }
  // Nothing reachable: the way with the most room.
  const open = [...roomOf.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return open ? go(open) : null;
}
