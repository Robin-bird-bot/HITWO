/**
 * Turns the engine's event log into short, plain sentences for the trail log.
 * A move and the stat costs that follow it become one line:
 * "Hiker 1 moved to Creek (−1 Appetite)."
 */
import { CARDS, CONDITIONS, ITEMS } from '../../content';
import { NIGHT_CREATURE_BY_ID } from '../../content/nightEvents';
import { WEATHERS } from '../../content/weather';
import { WONDER_BY_ID } from '../../content/wonders';
import {
  paidCause,
  type ChallengePaid,
  type GameEvent,
  type GameState,
  type HikerId,
  type NodeKind,
  type StatName,
} from '../../engine';
import { NODE_NAME } from '../map/looks';
import { cardText } from '../challenge/cardText';
import { tileName } from '../panels/hikerInfo';
import { resourceName, resourcesTitle } from '../scavenge/cardLook';
import { safeLines } from '../night/nightLines';

export interface LogLine {
  /** The event it describes. */
  id: number;
  /** One event that makes several lines (a night event) numbers them. */
  part?: number;
  text: string;
  tone:
    'move' | 'rest' | 'drain' | 'injury' | 'phase' | 'ability' | 'scavenge' | 'challenge' | 'debug';
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

/** "WOOD ×2 + MOSS" → "Wood ×2 + Moss". */
function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

type StatEvent = Extract<GameEvent, { kind: 'stat' }>;

const UNIT_WORD = { phases: 'phase', days: 'day', nights: 'night' } as const;

const REWARD_WORDS = { item: 'an item', lucky: 'Lucky for 1 day', doubleXp: 'double XP' } as const;

type RiskResult = NonNullable<Extract<GameEvent, { kind: 'challenge' }>['results'][number]['risk']>;

/** "was hit (24%)", "was safe (0%)", "lost 4", "was blown back 2 tiles". */
function riskWords(r: RiskResult): string {
  switch (r.kind) {
    case 'chance':
      return r.hit ? `was hit (${r.value}% chance)` : `was safe (${r.value}% chance)`;
    case 'threshold':
      return r.hit ? 'was over the line' : 'was safe';
    case 'loss':
      return r.hit ? `lost ${r.value}` : 'lost nothing';
    case 'chain':
      return r.hit ? `was blown back ${r.value} tile${r.value === 1 ? '' : 's'}` : 'held on';
  }
}

/** "1 food card", "Trail Mix and 2 Wood", "2 Energy". */
export function describePaid(paid: ChallengePaid): string {
  const parts: string[] = [];
  for (const id of paid.items) parts.push(`a ${ITEMS[id]?.name ?? id}`);
  if (paid.resources.length) parts.push(titleCase(resourcesTitle(paid.resources)));
  if (paid.caps) parts.push(`${paid.caps} cap${paid.caps === 1 ? '' : 's'}`);
  for (const [stat, n] of Object.entries(paid.stats) as [StatName, number][]) {
    parts.push(`${n} ${STAT_LABEL[stat]}`);
  }
  return parts.length ? listNames(parts) : 'nothing';
}

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

  // A night event's own sentences say what it did, so the losses it logged on
  // the way fold into it. Injuries from a stat hitting 0, and passing out, still show.
  const folded = new Set<number>();
  for (const e of events) {
    if (e.kind !== 'nightEvent') continue;
    const cause = NIGHT_CREATURE_BY_ID[e.creatureId]?.name;
    for (const d of events) {
      if (d.id < e.from || d.id >= e.id || d.kind === 'passedOut') continue;
      if (d.kind === 'injury' && d.cause !== cause) continue;
      folded.add(d.id);
    }
  }

  for (let i = 0; i < events.length;) {
    const e = events[i] as GameEvent;
    i += 1;
    if (folded.has(e.id)) continue;
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
      case 'scavenge': {
        const { taken, next } = takeStats(i, ['Scavenge']);
        i = next;
        const cost = costsOf(taken, e.hikerId);
        const found: string[] = [];
        if (e.resources.length) found.push(titleCase(resourcesTitle(e.resources)));
        if (e.caps) found.push(`${e.caps} acorn cap${e.caps === 1 ? '' : 's'}`);
        for (const id of e.items ?? []) found.push(`a ${ITEMS[id]?.name ?? id}`);
        const what = found.length ? listNames(found) : 'nothing';
        const left = e.left ? ` ${e.left} more didn’t fit.` : '';
        lines.push({
          id: e.id,
          text: e.dropped
            ? `${name(e.hikerId)} scavenged, but it slipped away (Butterfingers${cost ? `, ${cost}` : ''}).`
            : `${name(e.hikerId)} scavenged ${what}${cost ? ` (${cost})` : ''}.${left}`,
          tone: e.dropped ? 'drain' : 'scavenge',
        });
        break;
      }
      case 'tend': {
        const { taken, next } = takeStats(i, ['Tend']);
        i = next;
        const cost = costsOf(taken, e.hikerId);
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} tended the ${NODE_NAME[e.node]} (${NODE_NAME[e.node]} Abundance ${e.from} → ${e.to}${cost ? `, ${cost}` : ''}).`,
          tone: 'scavenge',
        });
        break;
      }
      case 'give': {
        const what = e.resource
          ? resourceName(e.resource)
          : `the ${ITEMS[e.itemId ?? '']?.name ?? 'item'}`;
        lines.push({
          id: e.id,
          text: `${name(e.fromId)} gave ${what} to ${name(e.toId)}.`,
          tone: 'scavenge',
        });
        break;
      }
      case 'returned':
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} returned ${resourceName(e.resource)} to nature (+1 ${NODE_NAME[e.node]}).`,
          tone: 'scavenge',
        });
        break;
      case 'recovered':
        lines.push({
          id: e.id,
          text: `Overnight, ${listNames(e.nodes.map((n) => NODE_NAME[n]))} Abundance recovered (+1).`,
          tone: 'rest',
        });
        break;
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
      case 'weatherChanged': {
        const to = WEATHERS[e.to];
        const days = `${e.days} day${e.days === 1 ? '' : 's'}`;
        const text =
          e.to === 'clear'
            ? `The ${WEATHERS[e.from].name.toLowerCase()} is over: clear skies.`
            : `${to.name} for the next ${days}: ${to.node?.name} now, ${to.hiker?.name} from tomorrow.`;
        lines.push({ id: e.id, text, tone: 'phase' });
        break;
      }
      case 'nodesChanged': {
        const tiles = [...e.tiles, ...(e.spread ?? [])]
          .map((id) => state.section.tiles[id])
          .filter((t) => !!t)
          .map((t) => tileName(t));
        const verb =
          e.state === 'flooded' ? 'flooded' : e.state === 'frozen' ? 'froze over' : 'caught fire';
        const where = listNames(tiles);
        const text = e.spread?.length
          ? `The fire spread to ${where}.`
          : `A node ${verb} on ${where}.`;
        lines.push({ id: e.id, text, tone: 'drain' });
        break;
      }
      case 'freeAction':
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)}’s action was free (${e.cause}).`,
          tone: 'rest',
        });
        break;
      case 'healed':
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} healed ${e.healed === 1 ? 'an injury' : `${e.healed} injuries`} (${e.cause}): ${e.injuries} of 3 left.`,
          tone: 'rest',
        });
        break;
      case 'passedOut':
        lines.push({ id: e.id, text: `${name(e.hikerId)} passed out!`, tone: 'injury' });
        break;
      case 'phase':
        lines.push({ id: e.id, text: `Day ${e.day} · ${PHASE_LABEL[e.phase]}`, tone: 'phase' });
        break;
      case 'challenge': {
        const card = CARDS[e.cardId]?.name ?? 'A challenge';
        // The stat costs it paid are already in this line.
        while (i < events.length) {
          const next = events[i];
          if (next?.kind !== 'stat' || next.cause !== paidCause(card)) break;
          i += 1;
        }
        const def = CARDS[e.cardId];
        const shown = def && def.kind !== 'trial' ? def : undefined;
        const deal = shown?.kind === 'opportunity';
        const picked = shown?.scope === 'select' || shown?.scope === 'one';
        const parts = e.results.map((r) => {
          const who = r.hikerId ? name(r.hikerId) : 'the party';
          const paid = r.paid ? describePaid(r.paid) : 'nothing';
          if (r.risk) {
            const spent = paid === 'nothing' ? '' : ` spent ${paid} and`;
            return `${who}${spent} ${riskWords(r.risk)}`;
          }
          if (picked) return r.passed ? `${who} took part` : `${who} sat out`;
          if (shown?.spendAny) return `${who} spent ${paid}`;
          if (deal) return r.passed ? `${who} took the deal` : `${who} skipped it`;
          if (!r.passed) return r.hikerId ? `${who} failed` : `${who} didn’t pay`;
          const reward = r.reward ? `, and won ${REWARD_WORDS[r.reward]}` : '';
          return `${paid === 'nothing' ? `${who} passed` : `${who} paid ${paid}`}${reward}`;
        });
        lines.push({
          id: e.id,
          text: `${card}: ${parts.length ? parts.join(' · ') : 'nobody here was affected'}.`,
          tone: 'challenge',
        });
        break;
      }
      case 'moved': {
        const tile = state.section.tiles[e.to];
        const where = tile ? tileName(tile) : 'a new tile';
        const verb = {
          swept: 'was swept to',
          back: 'went back to',
          blown: 'was blown back to',
          falseTrail: 'followed false trail markers to',
          tunnel: 'took the secret tunnel to',
          chased: 'was chased back to',
        }[e.how];
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} ${verb} ${where} (${e.cause}).`,
          tone: 'injury',
        });
        break;
      }
      case 'trial': {
        const card = CARDS[e.cardId];
        const trialName = card?.name ?? 'A Trial';
        const who = listNames((e.hikerIds ?? []).map(name));
        const text =
          e.outcome === 'started'
            ? `Trial: ${trialName}${/[.!?]$/.test(trialName) ? '' : '.'} ${card?.kind === 'trial' ? cardText(card, card.goalText) : ''}`
            : e.outcome === 'passed'
              ? `${trialName}: done in time.`
              : e.outcome === 'failed'
                ? `${trialName}: time’s up for ${who}.`
                : e.outcome === 'reached'
                  ? `${who} made it for ${trialName} on day ${e.days ?? 1}.`
                  : e.outcome === 'paid'
                    ? `${trialName}: the ranger took ${e.taken ?? 0} and paid ${e.caps ?? 0} caps.`
                    : `${trialName} is over.`;
        lines.push({ id: e.id, text: text.trim(), tone: 'challenge' });
        break;
      }
      case 'pressed': {
        const card = CARDS[e.cardId];
        const cardName = card?.name ?? 'An opportunity';
        const button =
          card && card.kind !== 'trial' ? card.buttons?.find((b) => b.id === e.button) : undefined;
        const who = e.hikerId ? name(e.hikerId) : 'The party';
        const text =
          button?.kind === 'slots'
            ? `${who} pulled and won ${e.note}`
            : button?.kind === 'buy'
              ? `the party ${e.note}${e.note.startsWith('paid') ? ' for a resource' : ''}`
              : button?.kind === 'revealConnected'
                ? `${who} ${e.note}`
                : e.note;
        lines.push({ id: e.id, text: `${cardName}: ${text}.`, tone: 'challenge' });
        break;
      }
      case 'revealedCard': {
        const tile = state.section.tiles[e.tileId];
        const where = tile ? tileName(tile) : 'A tile';
        lines.push({
          id: e.id,
          text: `${where}’s card is known now: ${CARDS[e.cardId]?.name ?? 'a challenge'} (${e.cause}).`,
          tone: 'challenge',
        });
        break;
      }
      case 'wonderRevealed': {
        const name = WONDER_BY_ID[e.wonderId]?.name ?? 'a Wonder';
        lines.push({
          id: e.id,
          text: `Found a Wonder: ${name}!${e.cause ? ` (${e.cause})` : ''}`,
          tone: 'challenge',
        });
        break;
      }
      case 'wonderAccomplished': {
        const def = WONDER_BY_ID[e.wonderId];
        const parts = Object.entries(e.picks).map(([id, pick]) => {
          const r = def?.rewards[pick.reward];
          const what = pick.itemId
            ? (ITEMS[pick.itemId]?.name ?? pick.itemId)
            : pick.node
              ? `+${r?.reward.kind === 'abundance' ? r.reward.amount : ''} ${NODE_NAME[pick.node]} Abundance`
              : (r?.title ?? 'a reward');
          return `${name(id)} took ${what}`;
        });
        lines.push({
          id: e.id,
          text: `${def?.name ?? 'The Wonder'} accomplished! ${parts.join(' · ')}.`,
          tone: 'challenge',
        });
        break;
      }
      case 'challengeChosen':
        lines.push({
          id: e.id,
          text: `The party chose ${CARDS[e.cardId]?.name ?? 'a challenge'} over ${CARDS[e.over]?.name ?? 'the other'}.`,
          tone: 'challenge',
        });
        break;
      case 'gained': {
        const what: string[] = [];
        for (const id of e.items) what.push(`a ${ITEMS[id]?.name ?? id}`);
        if (e.resources.length) what.push(titleCase(resourcesTitle(e.resources)));
        const left = e.noRoom ?? 0;
        const behind = `${left} resource${left === 1 ? '' : 's'}`;
        const text = !e.hikerId
          ? `The party purse got ${e.caps ?? 0} cap${e.caps === 1 ? '' : 's'} (${e.cause}).`
          : !what.length
            ? `${name(e.hikerId)}’s pack is full: ${behind} left behind (${e.cause}).`
            : left > 0
              ? `${name(e.hikerId)} got ${listNames(what)}, and ${behind} didn’t fit (${e.cause}).`
              : `${name(e.hikerId)} got ${listNames(what)} (${e.cause}).`;
        lines.push({ id: e.id, text, tone: what.length ? 'scavenge' : 'drain' });
        break;
      }
      case 'condition': {
        const def = CONDITIONS[e.condition];
        const called = def?.name ?? e.condition;
        const how =
          e.stacks !== undefined
            ? `${called} ×${e.stacks}`
            : e.unit === 'weather'
              ? `${called} until the weather ends`
              : `${called} for ${e.remaining} ${UNIT_WORD[e.unit]}${e.remaining === 1 ? '' : 's'}`;
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} is ${how} (${e.cause}).`,
          tone: def?.kind === 'positive' ? 'rest' : 'injury',
        });
        break;
      }
      case 'conditionEnded':
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} is no longer ${CONDITIONS[e.condition]?.name ?? e.condition}.`,
          tone: 'drain',
        });
        break;
      case 'lost': {
        const what: string[] = [];
        if (e.resources.length) what.push(titleCase(resourcesTitle(e.resources)));
        for (const id of e.items) what.push(`a ${ITEMS[id]?.name ?? id}`);
        lines.push({
          id: e.id,
          text: `${name(e.hikerId)} lost ${listNames(what)} (${e.cause}).`,
          tone: 'injury',
        });
        break;
      }
      case 'watch':
        lines.push({ id: e.id, text: `${name(e.hikerId)} kept watch.`, tone: 'rest' });
        break;
      case 'nightEvent': {
        // Nobody hit: nothing to say (the window doesn't show either).
        if (!e.hits.length) break;
        const called = NIGHT_CREATURE_BY_ID[e.creatureId]?.called ?? e.creatureId;
        lines.push({
          id: e.id,
          text: `Night event: ${called.charAt(0).toUpperCase()}${called.slice(1)} came to camp.`,
          tone: 'challenge',
        });
        let part = 0;
        for (const hit of e.hits) {
          part += 1;
          lines.push({ id: e.id, part, text: `${hit.text} (${hit.chip})`, tone: 'injury' });
        }
        for (const s of safeLines(e.safe, name)) {
          part += 1;
          lines.push({ id: e.id, part, text: s.text, tone: 'rest' });
        }
        break;
      }
      case 'debug':
        lines.push({ id: e.id, text: `Debug: ${e.note}.`, tone: 'debug' });
        break;
    }
  }
  return lines.slice(-limit);
}
