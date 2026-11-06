/**
 * Trials (04-challenges.md, "Trials"; BUILD_PLAN Phase 5): do something before
 * a deadline instead of paying.
 *
 * - "Got it" starts one: it covers the hikers on the tile when it was revealed.
 * - At the end of every phase each Trial's goal is checked. Meeting it early
 *   ends it; reaching the deadline applies the penalty to whoever missed.
 * - Some goals are about things that happen, not where hikers stand: reaching
 *   Rocco's tile, scavenging his resource, sleeping near The Grim Sleeper,
 *   gathering for the ranger. Those are noted as they happen.
 * - Rocco Raccoon's rewards stack by how quickly each hiker made it (within 1,
 *   2 or 3 days); on day 4 there's nothing either way.
 *
 * Goals are data (TrialGoal); nothing here names a Trial.
 */
import { CARDS } from '../../content/challenges';
import { RESOURCES } from '../../content/resources';
import { isSheltered } from '../actions/sleep';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import { pick } from '../rng';
import {
  PHASES,
  type ActiveTrial,
  type GameState,
  type Hiker,
  type HikerId,
  type OpenChallenge,
  type ResourceId,
  type TileId,
} from '../types';
import { applyEffects, type EffectRun } from './applyEffects';
import { openNext } from './reveal';
import { amount } from './rolls';
import type { Deadline, TrialDef } from './types';

const PHASES_PER_DAY = PHASES.length;

/** The phase number since the hike started (Day 1 Morning is 0). */
export function phaseIndex(state: Pick<GameState, 'day' | 'phase'>): number {
  return (state.day - 1) * PHASES_PER_DAY + PHASES.indexOf(state.phase);
}

const trialDef = (cardId: string): TrialDef | undefined => {
  const card = CARDS[cardId];
  return card?.kind === 'trial' ? card : undefined;
};

/**
 * The phase a Trial is judged at the end of. A phase count starts with the
 * next phase: "within 2 phases" gives the next 2 full phases.
 *
 * TODO(wyatt): "by night" and "before the next morning" are both checked at the
 * end of the night, before camp, so a Trial revealed in the afternoon still
 * gives the hikers the night (they've usually just used their action).
 */
export function deadlineOf(
  state: GameState,
  deadline: Deadline,
  open: Pick<OpenChallenge, 'rolls'>,
): number {
  const now = phaseIndex(state);
  const ctx = { rolls: open.rolls, onTile: [] };
  if ('phases' in deadline) return now + amount(deadline.phases, ctx);
  if ('days' in deadline) return now + amount(deadline.days, ctx) * PHASES_PER_DAY;
  if (deadline.until === 'endOfNextPhase') return now + 1;
  // Tonight: the night of the current day.
  return (state.day - 1) * PHASES_PER_DAY + PHASES.indexOf('night');
}

/** How long a Trial has left, for the chip and the pop-up: "LAST PHASE", "2 MORE PHASES", "3 DAYS LEFT". */
export function timeLeft(state: GameState, trial: Pick<ActiveTrial, 'endsAt'>): string {
  const n = trial.endsAt - phaseIndex(state);
  if (n <= 0) return 'LAST PHASE';
  if (n >= PHASES_PER_DAY * 2) return `${Math.ceil(n / PHASES_PER_DAY)} DAYS LEFT`;
  return `${n} MORE ${n === 1 ? 'PHASE' : 'PHASES'}`;
}

// ── Starting ────────────────────────────────────────────────────────────────

/** A Trial's targets, picked when it's revealed: Rocco's red tile, or a resource. */
export function pickTrialTargets(
  state: GameState,
  card: TrialDef,
  tileId: TileId,
): OpenChallenge['trial'] {
  const goal = card.goal.kind;
  if (goal === 'roccoReach') {
    const occupied = new Set(state.hikers.map((h) => h.tileId));
    const tiles = Object.values(state.section.tiles).filter(
      (t) => t.kind === 'normal' && !occupied.has(t.id) && t.id !== tileId,
    );
    return tiles.length ? { targetTile: pick(state.rng, tiles).id } : {};
  }
  if (goal === 'roccoScavenge' || goal === 'rangerRequest') {
    return { resource: pick(state.rng, RESOURCES).id };
  }
  return undefined;
}

export function validateAccept(state: GameState): string | undefined {
  const open = state.challenge;
  if (!open || !trialDef(open.cardId)) return 'There’s no Trial to start.';
  return undefined;
}

/** "Got it": the Trial starts counting down. */
export function applyAccept(state: GameState): void {
  const open = state.challenge;
  const card = open && trialDef(open.cardId);
  if (!open || !card) throw new Error('applyAccept: no Trial open');
  const covered = state.hikers.filter((h) => open.hikerIds.includes(h.id));
  const tile = state.section.tiles[open.tileId];
  const trial: ActiveTrial = {
    uid: `trial-${state.nextEventId}`,
    cardId: card.id,
    tileId: open.tileId,
    hikers: covered.map((h) => h.id),
    rolls: open.rolls,
    startedAt: phaseIndex(state),
    endsAt: deadlineOf(state, card.deadline, open),
    row: tile?.row ?? 0,
    startRows: Object.fromEntries(
      covered.map((h) => [h.id, state.section.tiles[h.tileId]?.row ?? 0]),
    ),
    done: [],
    penalized: [],
    ...(open.trial?.targetTile ? { targetTile: open.trial.targetTile } : {}),
    ...(open.trial?.resource ? { resource: open.trial.resource } : {}),
    ...(card.goal.kind === 'rangerRequest' ? { gathered: {} } : {}),
  };
  state.trials = [...(state.trials ?? []), trial];
  pushEvent(state, {
    kind: 'trial',
    cardId: card.id,
    outcome: 'started',
    hikerIds: trial.hikers,
  });
  delete state.challenge;
  openNext(state);
}

// ── Checking ────────────────────────────────────────────────────────────────

/** Hikers who can still take part (not abandoned). */
const present = (state: GameState) => state.hikers.filter((h) => h.status !== 'abandoned');

function coveredHikers(state: GameState, trial: ActiveTrial): Hiker[] {
  return present(state).filter((h) => trial.hikers.includes(h.id));
}

function hasNode(state: GameState, tileId: TileId, node: string): boolean {
  return !!state.section.tiles[tileId]?.nodes.some((n) => n.type === node);
}

/**
 * Who's met their part of the goal right now. For goals about the whole party,
 * everyone or no one has.
 */
function metNow(state: GameState, trial: ActiveTrial, card: TrialDef, h: Hiker): boolean {
  const goal = card.goal;
  const tile = state.section.tiles[h.tileId];
  switch (goal.kind) {
    case 'leaveTile':
      return h.tileId !== trial.tileId || (goal.who === 'dogs' && h.family !== 'dog');
    case 'leaveRow':
      return (tile?.row ?? 0) !== trial.row;
    case 'offNode':
      return !hasNode(state, h.tileId, goal.node);
    case 'endOnNode':
      return hasNode(state, h.tileId, goal.node);
    case 'reachShelterOrNode':
      return (
        isSheltered(state, h) || tile?.special === 'campsite' || hasNode(state, h.tileId, goal.node)
      );
    case 'underShelter':
      return isSheltered(state, h);
    case 'rowForward':
      return (tile?.row ?? 0) > (trial.startRows[h.id] ?? 0);
    case 'energyTogether': {
      const here = present(state).filter((x) => x.tileId === h.tileId);
      return here.reduce((n, x) => n + x.stats.energy, 0) >= goal.atLeast;
    }
    case 'together': {
      const tiles = new Set(present(state).map((x) => x.tileId));
      return tiles.size === 1;
    }
    case 'apart':
      return present(state).filter((x) => x.tileId === h.tileId).length === 1;
    case 'abundance':
      return state.abundance[goal.node] >= amount(goal.atLeast, { rolls: trial.rolls, onTile: [] });
    default:
      // Judged as things happen (Rocco, sleeping, acting) or at the deadline.
      return trial.done.includes(h.id);
  }
}

/** Goals about the whole party (everyone together, everyone apart, a meter). */
const PARTY_GOALS = new Set(['together', 'apart', 'abundance']);
/** Goals judged only at the deadline, never ended early. */
const DEADLINE_ONLY = new Set(['skipAction', 'noSleepNear', 'rangerRequest']);
/** Goals met by doing something once ("reach a tile…", "end a phase on…"); the rest are about where hikers are now. */
const ONCE = new Set(['endOnNode', 'reachShelterOrNode']);
/** Goals met as things happen (Rocco). */
const BY_EVENT = new Set(['roccoReach', 'roccoScavenge']);

/** At the end of every phase: check each Trial, end the ones that are met or out of time. */
export function checkTrials(state: GameState): void {
  if (!state.trials?.length) return;
  const now = phaseIndex(state);
  const keep: ActiveTrial[] = [];
  for (const trial of state.trials) {
    const card = trialDef(trial.cardId);
    if (!card) continue;
    const goal = card.goal.kind;
    const people = PARTY_GOALS.has(goal) ? present(state) : coveredHikers(state, trial);
    const lastPhase = now >= trial.endsAt;

    if (DEADLINE_ONLY.has(goal)) {
      if (lastPhase) finish(state, trial, card, people, []);
      else keep.push(trial);
      continue;
    }

    // Who has met the goal: as it happened (Rocco), ever (ONCE), or right now.
    if (ONCE.has(goal)) {
      for (const h of people) {
        if (!trial.done.includes(h.id) && metNow(state, trial, card, h)) trial.done.push(h.id);
      }
    }
    const met =
      BY_EVENT.has(goal) || ONCE.has(goal)
        ? people.filter((h) => trial.done.includes(h.id))
        : people.filter((h) => metNow(state, trial, card, h));

    if (people.length > 0 && met.length === people.length) {
      pushEvent(state, { kind: 'trial', cardId: card.id, outcome: 'passed' });
      if (card.reward?.length) apply(state, trial, card, people, card.reward);
      continue;
    }
    if (!lastPhase) {
      keep.push(trial);
      continue;
    }
    finish(state, trial, card, people, met);
  }
  if (keep.length) state.trials = keep;
  else delete state.trials;
}

function apply(
  state: GameState,
  trial: ActiveTrial,
  card: TrialDef,
  targets: Hiker[],
  effects: EffectRun['card']['penalty'],
): void {
  if (!targets.length) return;
  applyEffects(
    state,
    { card, tileId: trial.tileId, targets, onTile: targets, rolls: trial.rolls },
    effects,
  );
}

/** The deadline: the penalty for whoever missed it, or the ranger's payment. */
function finish(
  state: GameState,
  trial: ActiveTrial,
  card: TrialDef,
  people: Hiker[],
  met: Hiker[],
): void {
  const goal = card.goal;
  if (goal.kind === 'rangerRequest') {
    payRanger(state, trial, card, people);
    return;
  }
  if (goal.kind === 'skipAction') {
    // Jogger: whoever acted in the phase after it started.
    endWith(
      state,
      trial,
      card,
      people.filter((h) => h.acted),
    );
    return;
  }
  if (goal.kind === 'noSleepNear') {
    // The Grim Sleeper!: sleepers were penalized as they slept.
    pushEvent(state, { kind: 'trial', cardId: card.id, outcome: 'ended' });
    return;
  }
  let missed = people.filter((h) => !met.includes(h));
  if (goal.kind === 'leaveTile' && goal.who === 'dogs') {
    // Incoming Bike: if a Dog is still here, every hiker here pays.
    missed = missed.length ? present(state).filter((h) => h.tileId === trial.tileId) : [];
  }
  if (goal.kind === 'apart') {
    missed = people.filter((h) => !metNow(state, trial, card, h));
  }
  endWith(state, trial, card, missed);
}

function endWith(state: GameState, trial: ActiveTrial, card: TrialDef, missed: Hiker[]): void {
  if (!missed.length) {
    pushEvent(state, { kind: 'trial', cardId: card.id, outcome: 'passed' });
    return;
  }
  pushEvent(state, {
    kind: 'trial',
    cardId: card.id,
    outcome: 'failed',
    hikerIds: missed.map((h) => h.id),
  });
  // A party-wide meter (Overfished): the penalty happens once.
  apply(state, trial, card, missed, card.penalty);
}

function payRanger(state: GameState, trial: ActiveTrial, card: TrialDef, people: Hiker[]): void {
  const id = trial.resource;
  const pay =
    card.goal.kind === 'rangerRequest'
      ? amount(card.goal.pay, { rolls: trial.rolls, onTile: [] })
      : 0;
  let taken = 0;
  for (const h of people) {
    if (!id) continue;
    const n = Math.min(trial.gathered?.[h.id] ?? 0, h.inventory.resources[id] ?? 0);
    if (!n) continue;
    const left = (h.inventory.resources[id] ?? 0) - n;
    if (left > 0) h.inventory.resources[id] = left;
    else delete h.inventory.resources[id];
    taken += n;
  }
  state.caps += taken * pay;
  pushEvent(state, {
    kind: 'trial',
    cardId: card.id,
    outcome: 'paid',
    taken,
    caps: taken * pay,
  });
}

// ── Things that happen ──────────────────────────────────────────────────────

/** Hikers arrived on a tile: Rocco's Running Trial pays whoever reaches his red tile. */
export function noteArrival(state: GameState, hikerIds: readonly HikerId[], tileId: TileId): void {
  for (const trial of state.trials ?? []) {
    const card = trialDef(trial.cardId);
    if (card?.goal.kind !== 'roccoReach' || trial.targetTile !== tileId) continue;
    for (const id of hikerIds) roccoReward(state, trial, card, id);
  }
}

/** A hiker scavenged: Rocco's Resource Trial, and Ranger's Request's tally. */
export function noteScavenged(
  state: GameState,
  hiker: Hiker,
  resources: readonly ResourceId[],
): void {
  for (const trial of state.trials ?? []) {
    const card = trialDef(trial.cardId);
    if (!card || !trial.resource || !resources.includes(trial.resource)) continue;
    if (card.goal.kind === 'roccoScavenge') roccoReward(state, trial, card, hiker.id);
    if (card.goal.kind === 'rangerRequest' && trial.hikers.includes(hiker.id)) {
      const n = resources.filter((r) => r === trial.resource).length;
      trial.gathered = { ...trial.gathered, [hiker.id]: (trial.gathered?.[hiker.id] ?? 0) + n };
    }
  }
}

/** A hiker slept: The Grim Sleeper! punishes sleeping on its tile or next to it. */
export function noteSleep(state: GameState, hiker: Hiker): void {
  for (const trial of state.trials ?? []) {
    const card = trialDef(trial.cardId);
    if (card?.goal.kind !== 'noSleepNear' || trial.penalized.includes(hiker.id)) continue;
    const near = [trial.tileId, ...adjacentTileIds(state.section, trial.tileId)];
    if (!near.includes(hiker.tileId)) continue;
    trial.penalized.push(hiker.id);
    pushEvent(state, { kind: 'trial', cardId: card.id, outcome: 'failed', hikerIds: [hiker.id] });
    apply(state, trial, card, [hiker], card.penalty);
  }
}

/** Rocco's stacking rewards: everything for the stages this hiker made it within. */
function roccoReward(state: GameState, trial: ActiveTrial, card: TrialDef, hikerId: HikerId): void {
  const h = state.hikers.find((x) => x.id === hikerId);
  if (!h || !trial.hikers.includes(hikerId) || trial.done.includes(hikerId)) return;
  trial.done.push(hikerId);
  const elapsed = phaseIndex(state) - trial.startedAt;
  const days = Math.max(1, Math.ceil(elapsed / PHASES_PER_DAY));
  pushEvent(state, {
    kind: 'trial',
    cardId: card.id,
    outcome: 'reached',
    hikerIds: [hikerId],
    days,
  });
  for (const stage of card.stagedRewards ?? []) {
    if (elapsed <= stage.withinDays * PHASES_PER_DAY) apply(state, trial, card, [h], stage.effects);
  }
}
