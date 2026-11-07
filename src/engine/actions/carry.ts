/**
 * Carrying a passed-out hiker (Wyatt, Nov 7): an active hiker on the same tile
 * picks them up (a free action). From then on the carried hiker travels with
 * the carrier on every move, and each move costs the carrier +1 Appetite
 * (src/engine/costs.ts). Putting them down is free, at any time.
 *
 * A carry ends when the carried hiker wakes or abandons, the carrier passes
 * out or abandons, or a card moves either of them (src/engine/health.ts).
 */
import { immovable } from '../challenges/applyEffects';
import { pushEvent } from '../log';
import type { Action, GameState, Hiker, HikerId } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type PickUpAction = Extract<Action, { type: 'pickUp' }>;
type PutDownAction = Extract<Action, { type: 'putDown' }>;

/** Who is carrying this hiker, if anyone. */
export function carrierOf(state: GameState, hikerId: HikerId): Hiker | undefined {
  return state.hikers.find((h) => h.carrying === hikerId);
}

/** The hiker this hiker is carrying, if any. */
export function carriedBy(state: GameState, carrier: Hiker): Hiker | undefined {
  return carrier.carrying ? state.hikers.find((h) => h.id === carrier.carrying) : undefined;
}

/**
 * Why these movers can't go, because of who they carry: a Frozen hiker can't
 * be moved (TODO(wyatt): so they can't be carried while Frozen).
 */
export function carryMoveReason(state: GameState, movers: readonly Hiker[]): string | undefined {
  for (const m of movers) {
    const carried = carriedBy(state, m);
    if (carried && immovable(carried)) {
      return `${carried.name} can’t be moved right now. Put them down first.`;
    }
  }
  return undefined;
}

/** After movers arrive somewhere: whoever they carry arrives too. Returns those hikers. */
export function bringCarried(state: GameState, movers: readonly Hiker[], from: string): Hiker[] {
  const carried: Hiker[] = [];
  for (const m of movers) {
    const c = carriedBy(state, m);
    if (!c) continue;
    c.cameFrom = from;
    c.tileId = m.tileId;
    carried.push(c);
  }
  return carried;
}

export function validatePickUp(state: GameState, action: PickUpAction): string | undefined {
  const carrier = findHiker(state, action.carrierId);
  const reason = notActiveReason(carrier);
  if (reason || !carrier) return reason;
  const hiker = findHiker(state, action.hikerId);
  if (!hiker || hiker.status !== 'passedOut') return 'Only a passed-out hiker can be carried.';
  if (hiker.tileId !== carrier.tileId) return `${hiker.name} isn’t on this tile.`;
  const now = carriedBy(state, carrier);
  if (now) return `${carrier.name} is already carrying ${now.name}. Put them down first.`;
  const other = carrierOf(state, hiker.id);
  if (other) return `${other.name} is already carrying ${hiker.name}.`;
  if (immovable(hiker)) return `${hiker.name} can’t be moved right now.`;
  return undefined;
}

export function applyPickUp(state: GameState, action: PickUpAction): void {
  const carrier = mustFindHiker(state, action.carrierId);
  carrier.carrying = action.hikerId;
  pushEvent(state, {
    kind: 'carry',
    carrierId: carrier.id,
    hikerId: action.hikerId,
    how: 'pickedUp',
  });
}

export function validatePutDown(state: GameState, action: PutDownAction): string | undefined {
  const carrier = findHiker(state, action.carrierId);
  if (!carrier) return 'That hiker isn’t in the party.';
  if (!carrier.carrying) return `${carrier.name} isn’t carrying anyone.`;
  return undefined;
}

export function applyPutDown(state: GameState, action: PutDownAction): void {
  const carrier = mustFindHiker(state, action.carrierId);
  const hikerId = carrier.carrying;
  if (!hikerId) return;
  delete carrier.carrying;
  pushEvent(state, { kind: 'carry', carrierId: carrier.id, hikerId, how: 'putDown' });
}
