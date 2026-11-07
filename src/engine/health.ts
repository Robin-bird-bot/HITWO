/**
 * Passing out, waking and abandoning (01-design-doc.md, "Passing out,
 * abandoning, rejoining"):
 *
 * - The 3rd injury passes a hiker out. They can't act, and a countdown starts.
 * - It drops at each camp step where no active hiker shares their tile. At 0
 *   the hiker abandons the hike and leaves the party, taking what they carry.
 * - Curing an injury below 3 wakes them (a medical item, a card's cure).
 * - When no hiker is active, the hike is over.
 */
import { BALANCE } from '../config/balance';
import { pushEvent } from './log';
import { hikersOnTile } from './map';
import type { GameState, Hiker } from './types';

/**
 * Ends any carry this hiker is part of, as carrier or carried. `dropped` logs
 * it (the carrier passed out, or a card moved one of them); waking or
 * leaving the hike ends it quietly.
 */
export function endCarry(state: GameState, hiker: Hiker, how?: 'dropped'): void {
  const carrier = hiker.carrying ? hiker : state.hikers.find((h) => h.carrying === hiker.id);
  const carriedId = carrier?.carrying;
  if (!carrier || !carriedId) return;
  delete carrier.carrying;
  if (how) pushEvent(state, { kind: 'carry', carrierId: carrier.id, hikerId: carriedId, how });
}

/** The hiker passes out: they can't act, and their countdown starts full. */
export function passOut(state: GameState, hiker: Hiker): void {
  if (hiker.status !== 'active') return;
  // A carrier who passes out drops whoever they were carrying.
  if (hiker.carrying) endCarry(state, hiker, 'dropped');
  hiker.status = 'passedOut';
  hiker.countdown = BALANCE.passOut.countdownNights;
  pushEvent(state, { kind: 'passedOut', hikerId: hiker.id, countdown: hiker.countdown });
}

/**
 * A passed-out hiker comes to. TODO(wyatt): if they hadn't acted this phase
 * before passing out, they can still act now.
 */
export function wakeUp(state: GameState, hiker: Hiker, cause: string): void {
  if (hiker.status !== 'passedOut') return;
  hiker.status = 'active';
  delete hiker.countdown;
  endCarry(state, hiker);
  pushEvent(state, { kind: 'woke', hikerId: hiker.id, cause });
}

/** The hiker leaves the party for good. What they carry leaves with them. */
export function abandonHike(state: GameState, hiker: Hiker, why: 'countdown' | 'choice'): void {
  if (hiker.status === 'abandoned' || hiker.status === 'checkedIn') return;
  endCarry(state, hiker);
  hiker.status = 'abandoned';
  delete hiker.countdown;
  delete hiker.watching;
  pushEvent(state, { kind: 'abandoned', hikerId: hiker.id, why });
}

/** The camp step: each passed-out hiker with no active hiker beside them counts down. */
export function countdownAtCamp(state: GameState): void {
  for (const h of state.hikers) {
    if (h.status !== 'passedOut') continue;
    if (hikersOnTile(state, h.tileId).length > 0) continue;
    const left = Math.max(0, (h.countdown ?? BALANCE.passOut.countdownNights) - 1);
    h.countdown = left;
    pushEvent(state, { kind: 'countdown', hikerId: h.id, left });
    if (left === 0) abandonHike(state, h, 'countdown');
  }
}

/** No hiker can act any more: everyone has passed out or abandoned. */
export function isHikeOver(state: GameState): boolean {
  return !state.hikers.some((h) => h.status === 'active');
}
