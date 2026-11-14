/**
 * Small hand-made trail and placeholder hikers for engine tests.
 *
 *   row 2                [C] checkpoint
 *                      /   |   \
 *   row 1   [L] ~muddy~ [M] ^rough^ [R] campsite
 *              \         |         /
 *             normal   steep    paved
 *                 \      |      /
 *   row 0               [T] trailhead
 *
 * T–L normal, T–M steep, T–R paved, L–M muddy, M–R rough, and L/M/R–C normal.
 */
import { applyAction } from '../applyAction';
import { createGame, type HikerSetup } from '../newGame';
import type { Action, GameState, Hiker, HikerId, Section, Stats, TileId } from '../types';

export function fixtureSection(): Section {
  const tile = (
    id: TileId,
    row: number,
    col: number,
    extra: Partial<Section['tiles'][string]> = {},
  ) => ({
    id,
    row,
    col,
    kind: 'normal' as const,
    special: null,
    nodes: [{ type: 'forest' as const, revealed: true }],
    ...extra,
  });
  return {
    biome: 'meadow',
    tier: 1,
    trailheadId: 'T',
    checkpointId: 'C',
    tiles: {
      T: tile('T', 0, 1, { kind: 'trailhead', nodes: [] }),
      L: tile('L', 1, 0),
      M: tile('M', 1, 1),
      R: tile('R', 1, 2, { special: 'campsite' }),
      C: tile('C', 2, 1, { kind: 'checkpoint', nodes: [] }),
    },
    lines: [
      { id: 'T-L', a: 'T', b: 'L', kind: 'normal' },
      { id: 'T-M', a: 'T', b: 'M', kind: 'steep' },
      { id: 'T-R', a: 'T', b: 'R', kind: 'paved' },
      { id: 'L-M', a: 'L', b: 'M', kind: 'muddy' },
      { id: 'M-R', a: 'M', b: 'R', kind: 'rough' },
      { id: 'L-C', a: 'L', b: 'C', kind: 'normal' },
      { id: 'M-C', a: 'M', b: 'C', kind: 'normal' },
      { id: 'R-C', a: 'R', b: 'C', kind: 'normal' },
    ],
  };
}

/** A placeholder hiker. Each trait gets its own wild (W) slot. */
export function fixtureHiker(id: HikerId, traits: string[] = []): HikerSetup {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    family: 'human',
    placeholder: true,
    slots: traits.map((traitId) => ({ type: 'W', traitId })),
  };
}

export interface FixtureOptions {
  seed?: number;
  hikers?: HikerSetup[];
  /** Landing on a new tile opens a challenge. Off unless a test is about challenges. */
  challenges?: boolean;
  /** The weather follows its schedule. Off (held at Clear) unless a test is about weather. */
  weather?: boolean;
  /** A night event at every camp. Off unless a test is about night events. */
  nightEvents?: boolean;
}

/** Four placeholder hikers on the trailhead, Day 1 Morning. */
export function fixtureGame({
  seed = 1,
  hikers,
  challenges = false,
  weather = false,
  nightEvents = false,
}: FixtureOptions = {}): GameState {
  const state = createGame({
    seed,
    section: fixtureSection(),
    hikers: hikers ?? ['ash', 'birch', 'cedar', 'dot'].map((id) => fixtureHiker(id)),
    startingResources: false,
  });
  if (!challenges) state.noChallenges = true;
  if (!weather) state.weather.hold = true;
  if (!nightEvents) state.noNightEvents = true;
  return state;
}

export function hiker(state: GameState, id: HikerId): Hiker {
  const h = state.hikers.find((x) => x.id === id);
  if (!h) throw new Error(`No hiker ${id} in fixture`);
  return h;
}

/** Test setup only: puts a hiker somewhere with given stats, bypassing the rules. */
export function place(state: GameState, id: HikerId, tileId: TileId, stats: Partial<Stats> = {}) {
  const h = hiker(state, id);
  h.tileId = tileId;
  Object.assign(h.stats, stats);
}

/** Applies actions in order. */
export function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce(applyAction, state);
}

export const END: Action = { type: 'endPhase' };

/** Ends phases until it's night (or the next night if already night). */
export function toNight(state: GameState): GameState {
  let s = run(state, END);
  while (s.phase !== 'night') s = run(s, END);
  return s;
}
