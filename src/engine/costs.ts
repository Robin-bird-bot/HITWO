/**
 * What moving costs, per hiker. Validation, applying an action and the Phase 3
 * cost preview all use these, so the preview always matches what's charged.
 *
 * Move All (Wyatt, Nov 3): the mover pays their own crossing plus 1 Appetite
 * per hiker brought along. Every hiker who crosses also pays their own extras:
 * steep +1 Energy, muddy +1 Appetite, rough +1 Morale and night +1 Appetite.
 * A hiker carrying a passed-out hiker pays +1 Appetite on top (Phase 7).
 */
import { BALANCE } from '../config/balance';
import {
  computeCost,
  effectSourcesFor,
  pullsGroup,
  queryContext,
  type CostKey,
  type Role,
} from './effects';
import { freeMoveFor } from './items/freeMoves';
import { lineBetween } from './map';
import type { GameState, Hiker, HikerId, Line, StatAmounts, TileId } from './types';

export interface HikerCost {
  hikerId: HikerId;
  cost: StatAmounts;
  /**
   * Move All: the Appetite the mover pays for this hiker (their own crossing
   * for the mover, the per-hiker cost for the others), so a trait can make
   * one hiker's part free (Just Around the Next Corner).
   */
  share?: number;
}

interface Crossing {
  line: Line;
  from: TileId;
  to: TileId;
  via: 'move' | 'moveAll';
}

function crossingCost(
  state: GameState,
  hiker: Hiker,
  actor: Hiker,
  { line, from, to, via }: Crossing,
  role: Role,
): StatAmounts {
  const extra = BALANCE.lines.extra[line.kind];
  const night = state.phase === 'night' ? BALANCE.night.moveExtraAppetite : 0;
  // A brought hiker's base crossing is paid by the mover as the group cost.
  const base = role === 'actor' ? BALANCE.lines.baseAppetite[line.kind] : 0;
  const q = (key: CostKey, parts?: { base: number; line: number; night: number }) => ({
    key,
    actorId: actor.id,
    subjectId: hiker.id,
    role,
    phase: state.phase,
    line,
    via,
    fromTileId: from,
    toTileId: to,
    ...(parts ? { parts } : {}),
  });
  const carry = hiker.carrying
    ? computeCost(state, [hiker], q('move.carry'), BALANCE.carry.appetite)
    : 0;
  const appetite = { base, line: extra.appetite ?? 0, night };
  const energy = { base: 0, line: extra.energy ?? 0, night: 0 };
  const morale = { base: 0, line: extra.morale ?? 0, night: 0 };
  const sum = (p: { base: number; line: number; night: number }) => p.base + p.line + p.night;
  return {
    appetite: computeCost(state, [hiker], q('move.appetite', appetite), sum(appetite)) + carry,
    energy: computeCost(state, [hiker], q('move.energy', energy), sum(energy)),
    morale: computeCost(state, [hiker], q('move.morale', morale), sum(morale)),
  };
}

/** Trail Shoes: Energy pays for the move instead, when Appetite is lower than Energy. */
function withTrailShoes(state: GameState, hiker: Hiker, cost: StatAmounts): StatAmounts {
  if (!cost.appetite || hiker.stats.appetite >= hiker.stats.energy) return cost;
  const ctx = queryContext(state, hiker);
  const swap = effectSourcesFor(state, hiker).some((s) => s.hooks.moveWithEnergy?.(ctx));
  return swap ? { ...cost, appetite: 0, energy: cost.energy + cost.appetite } : cost;
}

function find(state: GameState, id: HikerId): Hiker | undefined {
  return state.hikers.find((h) => h.id === id);
}

/** What a hiker pays to move to an adjacent tile, or undefined if they can't get there. */
export function moveCost(
  state: GameState,
  hikerId: HikerId,
  toTileId: TileId,
): StatAmounts | undefined {
  const hiker = find(state, hikerId);
  const line = hiker && lineBetween(state.section, hiker.tileId, toTileId);
  if (!hiker || !line) return undefined;
  const cost = crossingCost(
    state,
    hiker,
    hiker,
    { line, from: hiker.tileId, to: toTileId, via: 'move' },
    'actor',
  );
  // A free move can cost less (Hiking Crocs, Work Boots, Stalker) or more (Fast).
  const free = freeMoveFor(state, hiker, toTileId);
  const appetite = Math.max(0, cost.appetite - (free?.discount ?? 0)) + (free?.extra ?? 0);
  return withTrailShoes(state, hiker, { ...cost, appetite });
}

/** What each hiker pays for a Move All: the mover first, then each brought hiker. */
export function moveAllCost(
  state: GameState,
  moverId: HikerId,
  toTileId: TileId,
  bring: readonly HikerId[],
): HikerCost[] | undefined {
  const mover = find(state, moverId);
  const line = mover && lineBetween(state.section, mover.tileId, toTileId);
  if (!mover || !line) return undefined;
  const brought = bring.map((id) => find(state, id)).filter((h): h is Hiker => !!h);
  const crossing: Crossing = { line, from: mover.tileId, to: toTileId, via: 'moveAll' };

  const own = crossingCost(state, mover, mover, crossing, 'actor');
  let group = 0;
  const shares = new Map<HikerId, number>();
  for (const b of brought) {
    const share = computeCost(
      state,
      [mover, b],
      {
        key: 'moveAll.perHiker',
        actorId: mover.id,
        subjectId: b.id,
        role: 'brought',
        phase: state.phase,
        line,
        via: 'moveAll',
      },
      BALANCE.moveAll.perHikerAppetite,
    );
    shares.set(b.id, share);
    group += share;
  }
  const moverAppetite = computeCost(
    state,
    [mover],
    {
      key: 'moveAll.appetite',
      actorId: mover.id,
      subjectId: mover.id,
      role: 'actor',
      phase: state.phase,
      line,
      via: 'moveAll',
    },
    own.appetite + group,
  );

  // Puller: the mover pays Energy instead of their Appetite for the group move.
  // TODO(wyatt): a flat 1 Energy in place of all of the mover's Appetite (the doc's open question).
  // Leash Puller (Phase 10.7): nobody in the group pays Appetite either.
  const pull = pullsGroup(state, mover);
  const moverCost = pull
    ? { ...own, appetite: 0, energy: own.energy + pull.energy }
    : withTrailShoes(state, mover, { ...own, appetite: moverAppetite });
  return [
    { hikerId: mover.id, cost: moverCost, share: pull ? 0 : own.appetite },
    ...brought.map((b) => {
      const cost = crossingCost(state, b, mover, crossing, 'brought');
      const free = pull?.everyone;
      return {
        hikerId: b.id,
        cost: free ? { ...cost, appetite: 0 } : withTrailShoes(state, b, cost),
        share: free ? 0 : (shares.get(b.id) ?? 0),
      };
    }),
  ];
}
