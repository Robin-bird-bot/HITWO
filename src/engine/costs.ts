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
import { computeCost, type CostKey, type Role } from './effects';
import { lineBetween } from './map';
import type { GameState, Hiker, HikerId, Line, StatAmounts, TileId } from './types';

export interface HikerCost {
  hikerId: HikerId;
  cost: StatAmounts;
}

function crossingCost(
  state: GameState,
  hiker: Hiker,
  actor: Hiker,
  line: Line,
  role: Role,
): StatAmounts {
  const extra = BALANCE.lines.extra[line.kind];
  const night = state.phase === 'night' ? BALANCE.night.moveExtraAppetite : 0;
  // A brought hiker's base crossing is paid by the mover as the group cost.
  const base = role === 'actor' ? BALANCE.lines.baseAppetite[line.kind] : 0;
  const q = (key: CostKey) => ({
    key,
    actorId: actor.id,
    subjectId: hiker.id,
    role,
    phase: state.phase,
    line,
  });
  const carry = hiker.carrying
    ? computeCost(state, [hiker], q('move.carry'), BALANCE.carry.appetite)
    : 0;
  return {
    appetite:
      computeCost(state, [hiker], q('move.appetite'), base + (extra.appetite ?? 0) + night) + carry,
    energy: computeCost(state, [hiker], q('move.energy'), extra.energy ?? 0),
    morale: computeCost(state, [hiker], q('move.morale'), extra.morale ?? 0),
  };
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
  return crossingCost(state, hiker, hiker, line, 'actor');
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

  const own = crossingCost(state, mover, mover, line, 'actor');
  let group = 0;
  for (const b of brought) {
    group += computeCost(
      state,
      [mover, b],
      {
        key: 'moveAll.perHiker',
        actorId: mover.id,
        subjectId: b.id,
        role: 'brought',
        phase: state.phase,
        line,
      },
      BALANCE.moveAll.perHikerAppetite,
    );
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
    },
    own.appetite + group,
  );

  return [
    { hikerId: mover.id, cost: { ...own, appetite: moverAppetite } },
    ...brought.map((b) => ({
      hikerId: b.id,
      cost: crossingCost(state, b, mover, line, 'brought'),
    })),
  ];
}
