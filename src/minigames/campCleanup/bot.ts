/**
 * Camp Cleanup's demo bot (docs/design/20-challenge-popup.md, section 7):
 * at each new cell it finds the shortest way (breadth-first) to the nearest
 * piece of trash still needed, around the walls, obstacles and the line,
 * and turns onto it. About [15%] of the time it turns a random way instead,
 * so it crashes now and then.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { bagsOf, OPPOSITE, STEP, type CampCleanupState, type Dir } from './logic';

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
  if (nextFloat(rng) < 0.15) return ways[Math.floor(nextFloat(rng) * ways.length)] ?? null;
  const blocked = new Set<string>();
  for (const g of s.snake.slice(0, -1)) blocked.add(`${g.x},${g.y}`);
  for (const o of s.obstacles)
    for (let i = 0; i < o.w; i++)
      for (let j = 0; j < o.h; j++) blocked.add(`${o.x + i},${o.y + j}`);
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
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    if (goals.has(`${c.x},${c.y}`))
      return c.first === heading && s.phase === 'run' ? null : c.first;
    for (const d of DIRS) {
      const x = c.x + STEP[d].x;
      const y = c.y + STEP[d].y;
      const k = `${x},${y}`;
      if (x < 0 || y < 0 || x >= s.cols || y >= s.rows || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push({ x, y, first: c.first });
    }
  }
  // Nothing reachable: any open way.
  const open = queue[0]?.first;
  return open && (open !== heading || s.phase === 'wait') ? open : null;
}
