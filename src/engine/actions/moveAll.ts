import { ownerLeft } from '../items/shelters';
import { opensOnArrival, revealTile } from '../challenges/reveal';
import { noteArrival } from '../challenges/trials';
import { moveAllCost } from '../costs';
import {
  bringReach,
  broughtWaivers,
  canActReason,
  effectSourcesFor,
  fireMove,
  keepsActionWhenBrought,
  queryContext,
  hikerHas,
  waivesForGroup,
} from '../effects';
import { pushEvent } from '../log';
import { checkInArrivals } from '../station/checkIn';
import { lineBetween, tileDistance } from '../map';
import type { Action, GameState } from '../types';
import { bringCarried, carryMoveReason } from './carry';
import {
  enterTile,
  findHiker,
  moraleCostReason,
  mustFindHiker,
  payCost,
  phaseActionReason,
  tileEntryReason,
  spendAction,
} from './common';

type MoveAllAction = Extract<Action, { type: 'moveAll' }>;

export function validateMoveAll(state: GameState, action: MoveAllAction): string | undefined {
  const mover = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, mover, action);
  if (reason || !mover) return reason;
  if (!state.section.tiles[action.toTileId]) return 'That tile isn’t on the map.';
  if (!lineBetween(state.section, mover.tileId, action.toTileId)) {
    return 'That tile isn’t connected to this one.';
  }
  const entry = tileEntryReason(state, action.toTileId);
  if (entry) return entry;
  if (action.bring.length === 0) return 'Pick at least one hiker to bring along.';
  if (new Set(action.bring).size !== action.bring.length) return 'Each hiker can come along once.';

  for (const id of action.bring) {
    const b = findHiker(state, id);
    if (!b) return 'That hiker isn’t in the party.';
    if (b.id === mover.id) return `${mover.name} is already moving.`;
    if (b.status !== 'active') return `${b.name} can’t come along right now.`;
    // Sherpa: hikers on tiles next to the mover's can come along too.
    if (
      b.tileId !== mover.tileId &&
      tileDistance(state.section, b.tileId, mover.tileId) > bringReach(state, mover)
    ) {
      return `${b.name} isn’t on this tile.`;
    }
    // Tank Butt: the leader can bring hikers who've already acted.
    if (b.acted && !hikerHas(state, mover, 'bringsActed')) {
      return `${b.name} has already acted this ${state.phase}.`;
    }
    const blocked = canActReason(state, b, { action, role: 'brought', phase: state.phase });
    if (blocked) return `${b.name} can’t come along. ${blocked}`;
  }
  const group = [mover, ...action.bring.flatMap((id) => findHiker(state, id) ?? [])];
  const carry = carryMoveReason(state, group);
  if (carry) return carry;
  // Rough lines cost each crosser Morale; nobody at 0 Morale can pay it.
  for (const { hikerId, cost } of moveAllCost(state, mover.id, action.toTileId, action.bring) ??
    []) {
    const h = findHiker(state, hikerId);
    const why = h && moraleCostReason(h, cost.morale);
    if (why) return why;
  }
  return undefined;
}

export function applyMoveAll(state: GameState, action: MoveAllAction): void {
  const mover = mustFindHiker(state, action.hikerId);
  const line = lineBetween(state.section, mover.tileId, action.toTileId);
  const costs = moveAllCost(state, mover.id, action.toTileId, action.bring);
  if (!line || !costs) throw new Error('applyMoveAll: not adjacent');

  const from = mover.tileId;
  const target = state.section.tiles[action.toTileId];
  const firstHere = !target?.visited;
  // A card still waiting on a visited tile opens too (a Prepper went there alone).
  const opens = !!target && opensOnArrival(target);
  // A Move All paints the line in the mover's color, if nobody crossed it first (Phase 10.5).
  line.walkedBy ??= mover.id;
  const group = [mover, ...action.bring.map((id) => mustFindHiker(state, id))];
  // Lifted Boots: bringing exactly 1 hiker leaves them their action.
  const ctx = queryContext(state, mover);
  const keep = effectSourcesFor(state, mover).find((s) =>
    s.hooks.broughtKeepAction?.(action.bring.length, ctx),
  );
  // Leash Puller II and III (off), Experienced Traveler II: each brought hiker's own roll.
  const waivers = new Map(
    group.filter((h) => h !== mover).map((h) => [h.id, broughtWaivers(state, mover, h)] as const),
  );
  for (const h of group) {
    h.cameFrom = h.tileId;
    h.tileId = action.toTileId;
    // Their own trait can keep their action too (Follower).
    const keeps =
      h === mover
        ? undefined
        : (keep?.name ?? waivers.get(h.id)?.keepAction ?? keepsActionWhenBrought(state, h)?.name);
    if (keeps) {
      pushEvent(state, { kind: 'freeAction', hikerId: h.id, cause: keeps });
      continue;
    }
    spendAction(state, h);
  }
  // Whoever they carry comes along.
  const carried = bringCarried(state, group, from).map((c) => c.id);
  // Shelters any of them set up there pack themselves, if there's room (Phase 10.6).
  for (const h of group) ownerLeft(state, h, from);
  const revealed = enterTile(state, action.toTileId);
  pushEvent(state, {
    kind: 'move',
    hikerId: mover.id,
    from,
    to: action.toTileId,
    brought: [...action.bring],
    ...(carried.length ? { carried } : {}),
    ...(revealed.length ? { revealed } : {}),
  });
  // Just Around the Next Corner: each hiker's part of the move may cost no Appetite.
  // Rolled once they've arrived, since it depends on where they are.
  let freed = 0;
  // A brought hiker whose roll came up: their part of the move costs no Appetite.
  for (const c of costs) {
    const by = waivers.get(c.hikerId)?.appetite;
    if (!by || (c.share ?? 0) + c.cost.appetite <= 0) continue;
    freed += c.share ?? 0;
    c.share = 0;
    c.cost = { ...c.cost, appetite: 0 };
    pushEvent(state, {
      kind: 'trait',
      hikerId: c.hikerId,
      trait: by,
      text: `${mustFindHiker(state, c.hikerId).name}’s part of the move cost no Appetite.`,
    });
  }
  for (const c of costs) {
    const part = (c.share ?? 0) + (c.hikerId === mover.id ? 0 : c.cost.appetite);
    if (part <= 0) continue;
    const by = waivesForGroup(state, mover, c.hikerId);
    if (!by) continue;
    freed += c.share ?? 0;
    if (c.hikerId !== mover.id) c.cost = { ...c.cost, appetite: 0 };
    const who = mustFindHiker(state, c.hikerId);
    pushEvent(state, {
      kind: 'trait',
      hikerId: mover.id,
      trait: by,
      text: `${who.name}’s part of the move cost no Appetite.`,
    });
  }
  for (const { hikerId, cost } of costs) {
    const paid =
      hikerId === mover.id ? { ...cost, appetite: Math.max(0, cost.appetite - freed) } : cost;
    payCost(
      state,
      mustFindHiker(state, hikerId),
      paid,
      hikerId === mover.id ? 'Move All' : 'Moved with the group',
    );
  }
  for (const h of group) {
    fireMove(state, h, {
      from: h.cameFrom ?? from,
      to: action.toTileId,
      role: h === mover ? 'actor' : 'brought',
      line,
      via: 'moveAll',
      firstVisit: firstHere,
    });
  }
  const arrived = [...group.map((h) => h.id), ...carried];
  noteArrival(state, arrived, action.toTileId);
  checkInArrivals(state, arrived, action.toTileId);
  // The first hikers to land on a tile trigger its card.
  // The leader is remembered: Alpha Dog takes the harm of a challenge they lead the group into.
  if (opens) revealTile(state, action.toTileId, arrived, undefined, mover.id);
}
