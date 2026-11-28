/**
 * Snagged Pack's demo bot (docs/design/30-quick-minigames.md, section 4): it
 * joins pairs with a simple solver (the shortest free path, the pair with the
 * fewest ways out first), slowly, and starts the wrong way now and then.
 * When no pair has a free path, it clears a rope and tries again.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { playing } from '../quick/turns';
import { neighbors } from './boards';
import { joined, ropeAt, socketAt, type SnaggedState } from './logic';

const BOT = BALANCE.minigames.snaggedPack.bot;

export type SnaggedMove =
  | { kind: 'grab'; cell: number }
  | { kind: 'drag'; cell: number }
  | { kind: 'release' }
  | { kind: 'clear'; color: number };

/** Whether a rope of `color` could go into a cell (empty, its own rope, or its own socket). */
function open(s: SnaggedState, color: number, cell: number): boolean {
  const socket = socketAt(s, cell);
  if (socket) return socket.color === color;
  const rope = ropeAt(s, cell);
  return rope === null || rope === color;
}

/** The shortest free path from one socket of a color to the other, or null. */
export function freePath(s: SnaggedState, color: number): number[] | null {
  const p = s.board.pairs.find((x) => x.color === color);
  if (!p) return null;
  const from = new Map<number, number>([[p.a, -1]]);
  const queue = [p.a];
  while (queue.length) {
    const c = queue.shift()!;
    if (c === p.b) break;
    for (const n of neighbors(s.size, c)) {
      if (from.has(n) || !open(s, color, n)) continue;
      from.set(n, c);
      queue.push(n);
    }
  }
  if (!from.has(p.b)) return null;
  const path = [p.b];
  while (path[0] !== p.a) path.unshift(from.get(path[0]!)!);
  return path;
}

export function snaggedPackBot(
  s: SnaggedState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): SnaggedMove | null {
  if (s.over || !playing(s.turns)) {
    mem.plan = null;
    return null;
  }
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  const plan = mem.plan as { cells: number[]; at: number } | null | undefined;
  if (plan) {
    mem.next = time + BOT.cellSec;
    if (plan.at === 0) {
      plan.at = 1;
      return { kind: 'grab', cell: plan.cells[0]! };
    }
    if (plan.at < plan.cells.length && s.drag !== null) {
      return { kind: 'drag', cell: plan.cells[plan.at++]! };
    }
    mem.plan = null;
    mem.next = time + BOT.thinkSec[0] + nextFloat(rng) * (BOT.thinkSec[1] - BOT.thinkSec[0]);
    return { kind: 'release' };
  }
  // The next rope: the pair with the fewest ways out that has a free path.
  const todo = s.board.pairs
    .filter((p) => !joined(s, p.color))
    .map((p) => ({
      p,
      path: freePath(s, p.color),
      ways: [p.a, p.b].flatMap((c) => neighbors(s.size, c)).filter((c) => open(s, p.color, c))
        .length,
    }))
    .filter((x) => x.path)
    .sort((x, y) => x.ways - y.ways || x.path!.length - y.path!.length);
  const next = todo[0];
  if (!next) {
    // Stuck: clear a rope and think again.
    const ropes = s.board.pairs.filter((p) => s.ropes[p.color]);
    mem.next = time + BOT.thinkSec[0];
    const pick = ropes[Math.floor(nextFloat(rng) * ropes.length)];
    return pick ? { kind: 'clear', color: pick.color } : null;
  }
  const cells = [...next.path!];
  // Now and then it starts the wrong way, and backs up.
  const wrong = neighbors(s.size, cells[0]!).find(
    (c) => c !== cells[1] && open(s, next.p.color, c) && !socketAt(s, c),
  );
  if (wrong !== undefined && nextFloat(rng) < BOT.wrongChance) cells.splice(1, 0, wrong, cells[0]!);
  mem.plan = { cells, at: 0 };
  return null;
}
