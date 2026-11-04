/**
 * Turns the engine's event log into short, plain sentences for the trail log.
 * A move and the stat costs that follow it become one line:
 * "Hiker 1 moved to Creek (−1 Appetite)."
 */
import type { GameEvent, GameState, HikerId, NodeKind, StatName } from '../../engine';
import { NODE_NAME } from '../map/looks';
import { tileName } from '../panels/hikerInfo';

export interface LogLine {
  id: number;
  text: string;
  tone: 'move' | 'rest' | 'drain' | 'injury' | 'phase' | 'ability' | 'debug';
}

const STAT_LABEL: Record<StatName, string> = {
  energy: 'Energy',
  appetite: 'Appetite',
  morale: 'Morale',
};
const PHASE_LABEL = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' } as const;

/** "−1 Appetite", "+2 Energy". */
export function signed(delta: number, stat: StatName): string {
  return `${delta < 0 ? '−' : '+'}${Math.abs(delta)} ${STAT_LABEL[stat]}`;
}

/** "Forest ×2, River". */
export function describeNodes(kinds: NodeKind[]): string {
  const counts = new Map<NodeKind, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([k, n]) => `${NODE_NAME[k]}${k === 'caps' ? ' node' : ''}${n > 1 ? ` ×${n}` : ''}`)
    .join(', ');
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

type StatEvent = Extract<GameEvent, { kind: 'stat' }>;

export function describeLog(state: GameState, limit = 10): LogLine[] {
  const name = (id: HikerId) => state.hikers.find((h) => h.id === id)?.name ?? 'A hiker';
  const lines: LogLine[] = [];
  const events = state.log;

  // Stat changes straight after an event, with one of these causes, belong to it.
  const takeStats = (from: number, causes: string[]) => {
    const taken: StatEvent[] = [];
    let i = from;
    for (; i < events.length; i++) {
      const e = events[i];
      if (e?.kind !== 'stat' || !causes.includes(e.cause)) break;
      taken.push(e);
    }
    return { taken, next: i };
  };
  const costsOf = (stats: StatEvent[], hikerId: HikerId) =>
    stats
      .filter((s) => s.hikerId === hikerId)
      .map((s) => signed(s.to - s.from, s.stat))
      .join(', ');

  for (let i = 0; i < events.length;) {
    const e = events[i] as GameEvent;
    i += 1;
    switch (e.kind) {
      case 'move': {
        const { taken, next } = takeStats(i, ['Move', 'Move All', 'Moved with the group']);
        i = next;
        const tile = state.section.tiles[e.to];
        const where = tile ? tileName(tile) : 'a new tile';
        const own = costsOf(taken, e.hikerId);
        const cost = own ? ` (${own})` : '';
        const found = e.revealed?.length ? ` Revealed ${describeNodes(e.revealed)}.` : '';
        const text = e.brought.length
          ? `${name(e.hikerId)} led ${listNames(e.brought.map(name))} to ${where}${cost}.${found}`
          : `${name(e.hikerId)} moved to ${where}${cost}.${found}`;
        lines.push({ id: e.id, text, tone: 'move' });
        break;
      }
      case 'sleep': {
        const { taken, next } = takeStats(i, ['Sleep']);
        i = next;
        const gain = costsOf(taken, e.hikerId);
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} slept${gain ? ` (${gain})` : ''}.`,
          tone: 'rest',
        });
        break;
      }
      case 'ability': {
        const label = e.abilityId.charAt(0).toUpperCase() + e.abilityId.slice(1);
        const { taken, next } = takeStats(i, [label]);
        i = next;
        const change = costsOf(taken, e.hikerId);
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} used ${label}${change ? ` (${change})` : ''}.`,
          tone: 'ability',
        });
        break;
      }
      case 'stat': {
        if (e.cause === 'injury') break; // Folded into the injury line.
        const camp = ['No sleep', 'End of day'];
        if (camp.includes(e.cause)) {
          // One line per hiker for the night's drains.
          const parts = [e];
          while (i < events.length) {
            const next = events[i];
            if (next?.kind !== 'stat' || next.hikerId !== e.hikerId || !camp.includes(next.cause))
              break;
            parts.push(next);
            i += 1;
          }
          const text = parts
            .map((p) => `${signed(p.to - p.from, p.stat)} (${p.cause.toLowerCase()})`)
            .join(', ');
          lines.push({ id: e.id, text: `${name(e.hikerId)}: ${text}.`, tone: 'drain' });
          break;
        }
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)}: ${signed(e.to - e.from, e.stat)} (${e.cause}).`,
          tone: 'drain',
        });
        break;
      }
      case 'injury':
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} took an injury (${e.cause}): ${e.injuries} of 3. Stats below 5 rise to 5.`,
          tone: 'injury',
        });
        break;
      case 'passedOut':
        lines.push({ id: e.id, text: `${name(e.hikerId)} passed out!`, tone: 'injury' });
        break;
      case 'phase':
        lines.push({ id: e.id, text: `Day ${e.day} · ${PHASE_LABEL[e.phase]}`, tone: 'phase' });
        break;
      case 'debug':
        lines.push({ id: e.id, text: `Debug: ${e.note}.`, tone: 'debug' });
        break;
    }
  }
  return lines.slice(-limit);
}
