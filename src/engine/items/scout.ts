/**
 * Map tools (03-items.md, the Moving and Challenges tools; Phase 8 step 8).
 * "Adjacent" is the glossary's: connected to the hiker's tile by a line.
 * TODO(wyatt): "around you" (Minesweeper, Radar Scanner) and the Trampoline's
 * "next to you" read as every tile touching the hiker's on the grid.
 *
 * - Scanner, Radar Scanner: a red ! on tiles that hold a card.
 * - Security Camera: also its kind and tier (the card is picked now, not shown).
 * - Minesweeper, Linescan: how many of each kind, as numbers that fade away.
 * - Binoculars, Telescope: Look at the card (like Old Firewatch Tower).
 * - Camera, Drone Camera: Reveal it, and the tile's nodes too.
 * - Paver: a line from this tile one step better.
 * - Trampoline: hop to a tile beside this one, line or not, for no Appetite.
 * - Fire Flower: the card on an adjacent tile is gone.
 * - Poo Bag: the card on an adjacent tile drops a tier.
 */
import { ITEMS } from '../../content/items';
import { bringCarried, carryMoveReason } from '../actions/carry';
import { enterTile, tileEntryReason } from '../actions/common';
import { noteArrival } from '../challenges/trials';
import { peekTile, revealCardOn, revealTile, triggers } from '../challenges/reveal';
import { tileTier } from '../challenges/pick';
import type { ItemUse } from '../effects';
import { pushEvent } from '../log';
import { checkInArrivals } from '../station/checkIn';
import { adjacentTileIds, besideTileIds, lineBetween } from '../map';
import type { GameState, Hiker, ItemId, LineKind, Tile, TileId } from '../types';

type MapUse = NonNullable<ItemUse['map']>;

const tileWord = (t: Tile) => (t.special ? 'that space' : 'that tile');

/** The tiles a map tool can pick right now. */
export function mapTargets(state: GameState, hiker: Hiker, map: MapUse): TileId[] {
  const tiles = Object.values(state.section.tiles);
  switch (map.pick) {
    case 'adjacent':
      return adjacentTileIds(state.section, hiker.tileId);
    case 'beside':
      return besideTileIds(state.section, hiker.tileId);
    case 'any':
      return tiles.filter((t) => !t.visited && t.kind === 'normal').map((t) => t.id);
    case 'row':
      return tiles.filter((t) => t.kind === 'normal').map((t) => t.id);
    default:
      return [];
  }
}

/** Unvisited trail tiles around the hiker, on the grid. */
const around = (state: GameState, hiker: Hiker) =>
  besideTileIds(state.section, hiker.tileId).filter((id) => {
    const t = state.section.tiles[id];
    return !!t && !t.visited && t.kind === 'normal';
  });

/** Unvisited trail tiles in a row. */
const inRow = (state: GameState, row: number) =>
  Object.values(state.section.tiles)
    .filter((t) => t.row === row && !t.visited && t.kind === 'normal')
    .map((t) => t.id);

/** What a line becomes when paved: Steep, Muddy and Rough become normal, and normal becomes Paved. */
const PAVED: Partial<Record<LineKind, LineKind>> = {
  steep: 'normal',
  muddy: 'normal',
  rough: 'normal',
  normal: 'paved',
};

/** Why this map tool can't be used this way right now, if it can't. */
export function mapUseReason(
  state: GameState,
  hiker: Hiker,
  map: MapUse,
  choice: string | undefined,
): string | undefined {
  if (map.pick) {
    if (!choice) return 'Pick a tile on the map.';
    if (!mapTargets(state, hiker, map).includes(choice)) {
      return map.pick === 'adjacent'
        ? 'Pick a tile connected to this one by a line.'
        : map.pick === 'beside'
          ? 'Pick a tile right next to this one.'
          : 'Pick a tile on the trail.';
    }
  }
  const tile = choice ? state.section.tiles[choice] : undefined;
  switch (map.does) {
    case 'scan':
    case 'kind':
    case 'look':
    case 'reveal':
    case 'remove':
    case 'lower':
      if (!tile) return 'Pick a tile on the map.';
      if (tile.visited) return 'Someone has already been there.';
      if (tile.kind !== 'normal') return 'Nothing to find there.';
      if (
        (map.does === 'look' || map.does === 'reveal') &&
        tile.revealedCard &&
        !tile.revealedCard.hidden
      ) {
        return 'Its card is already showing.';
      }
      if ((map.does === 'remove' || map.does === 'lower') && tile.scan?.has === false) {
        return `There’s no challenge on ${tileWord(tile)}.`;
      }
      if (map.does === 'lower') {
        const effective = tileTier(state, tile) + (tile.special === 'challenge' ? 1 : 0);
        if (effective <= 1) return 'The challenge there is already Tier I.';
      }
      return undefined;
    case 'scanAround':
    case 'countAround':
      return around(state, hiker).length ? undefined : 'Every tile around here has been reached.';
    case 'countRow':
      if (!tile) return 'Pick a row on the map.';
      return inRow(state, tile.row).length ? undefined : 'Every tile in that row has been reached.';
    case 'pave': {
      const line = choice ? lineBetween(state.section, hiker.tileId, choice) : undefined;
      if (!line) return 'Pick a tile this one has a line to.';
      return PAVED[line.kind] ? undefined : 'That line is already Paved.';
    }
    case 'hop': {
      if (!tile) return 'Pick a tile next to this one.';
      return tileEntryReason(state, tile.id) ?? carryMoveReason(state, [hiker]);
    }
  }
}

/** Counts by kind of the cards on these tiles (picking them now, unseen, to know). */
function countKinds(state: GameState, tileIds: readonly TileId[]) {
  const counts = { challenge: 0, opportunity: 0, trial: 0 };
  for (const id of tileIds) {
    const seen = peekTile(state, id);
    if (seen.has && seen.kind) counts[seen.kind] += 1;
  }
  return counts;
}

/** Uses a map tool. Returns words for the log ("Forest node revealed"). */
export function applyMapUse(
  state: GameState,
  hiker: Hiker,
  itemId: ItemId,
  map: MapUse,
  choice: string | undefined,
): string | undefined {
  const tile = choice ? state.section.tiles[choice] : undefined;
  const scout = (tileIds: TileId[], counts?: ReturnType<typeof countKinds>, row?: number) =>
    pushEvent(state, {
      kind: 'scouted',
      hikerId: hiker.id,
      itemId,
      tileIds,
      ...(counts ? { counts } : {}),
      ...(row !== undefined ? { row } : {}),
    });

  switch (map.does) {
    case 'scan': {
      if (!tile) return undefined;
      tile.scan = { ...tile.scan, has: !state.noChallenges && triggers(state, tile.id) };
      scout([tile.id]);
      return tile.scan.has ? 'a challenge is there' : 'nothing there';
    }
    case 'scanAround': {
      const ids = around(state, hiker);
      for (const id of ids) {
        const t = state.section.tiles[id];
        if (t) t.scan = { ...t.scan, has: !state.noChallenges && triggers(state, id) };
      }
      scout(ids);
      const found = ids.filter((id) => state.section.tiles[id]?.scan?.has).length;
      return `${found} of ${ids.length} tiles around hold a challenge`;
    }
    case 'kind': {
      if (!tile) return undefined;
      const seen = peekTile(state, tile.id);
      tile.scan = seen;
      scout([tile.id]);
      return seen.has ? `a Tier ${'I'.repeat(seen.tier ?? 1)} ${seen.kind}` : 'nothing there';
    }
    case 'countAround': {
      const ids = around(state, hiker);
      const counts = countKinds(state, ids);
      scout(ids, counts);
      return countWords(counts);
    }
    case 'countRow': {
      if (!tile) return undefined;
      const ids = inRow(state, tile.row);
      const counts = countKinds(state, ids);
      scout(ids, counts, tile.row);
      return countWords(counts);
    }
    case 'look':
    case 'reveal': {
      if (!tile) return undefined;
      const shown = revealCardOn(state, tile.id, ITEMS[itemId]?.name ?? 'a scouting tool');
      if (!shown) tile.scan = { has: false };
      if (map.does === 'reveal') for (const n of tile.nodes) n.revealed = true;
      return shown ? undefined : 'nothing there';
    }
    case 'pave': {
      const line = choice ? lineBetween(state.section, hiker.tileId, choice) : undefined;
      const next = line && PAVED[line.kind];
      if (!line || !next) return undefined;
      const was = line.kind;
      line.kind = next;
      return `a ${was} line is now ${next}`;
    }
    case 'hop': {
      if (!tile) return undefined;
      const from = hiker.tileId;
      const firstHere = !tile.visited;
      hiker.cameFrom = from;
      hiker.tileId = tile.id;
      const carried = bringCarried(state, [hiker], from).map((c) => c.id);
      const revealed = enterTile(state, tile.id);
      pushEvent(state, {
        kind: 'move',
        hikerId: hiker.id,
        from,
        to: tile.id,
        brought: [],
        ...(carried.length ? { carried } : {}),
        ...(revealed.length ? { revealed } : {}),
      });
      noteArrival(state, [hiker.id, ...carried], tile.id);
      checkInArrivals(state, [hiker.id, ...carried], tile.id);
      if (firstHere) revealTile(state, tile.id, [hiker.id, ...carried]);
      return undefined;
    }
    case 'remove': {
      if (!tile) return undefined;
      tile.quiet = true;
      delete tile.revealedCard;
      tile.scan = { has: false };
      return 'the challenge there is gone';
    }
    case 'lower': {
      if (!tile) return undefined;
      tile.tierBonus = (tile.tierBonus ?? 0) - 1;
      // Its card was picked at the old tier: pick again, and show it again if it was showing.
      const wasShown = !!tile.revealedCard && !tile.revealedCard.hidden;
      const knewKind = tile.scan?.kind !== undefined;
      delete tile.revealedCard;
      if (wasShown) revealCardOn(state, tile.id, 'Poo Bag');
      else if (knewKind) tile.scan = peekTile(state, tile.id);
      return 'the challenge there is a tier lower';
    }
  }
}

/** "2 challenges, 1 opportunity, 0 Trials". */
function countWords(c: { challenge: number; opportunity: number; trial: number }): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    part(c.challenge, 'challenge', 'challenges'),
    part(c.opportunity, 'opportunity', 'opportunities'),
    part(c.trial, 'Trial', 'Trials'),
  ].join(', ');
}
