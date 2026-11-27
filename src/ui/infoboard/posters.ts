/**
 * What the Trail Infoboard shows (docs/design/25-challenges-on-the-map.md,
 * section 2): a poster for each pool card, its tooltip, where the posters
 * hang, and the small hex maps (the printed one and the "found" card).
 */
import { asset, cardArt } from '../../config/assets';
import { CARDS, ITEMS } from '../../content';
import { POSTERS } from '../../content/minigameChallenges';
import { CATEGORY_BY_ID, RESOURCE_BY_ID, type CategoryId } from '../../content/resources';
import {
  adjacentTileIds,
  type GameState,
  type ResourceId,
  type Section,
  type TileId,
} from '../../engine';
import { tilesLeft } from '../../engine/challenges/infoboard';
import { minigameSettings } from '../../engine/challenges/minigame';
import { placedTier } from '../../engine/challenges/pool';
import type { ChallengeDef } from '../../engine/challenges/types';
import { MINIGAME_BY_ID } from '../../minigames/catalog';
import { POPUPS } from '../../minigames/popups';
import type { Thing } from '../../minigames/prepare';
import { cardText } from '../challenge/cardText';
import { NODE_NAME } from '../map/looks';
import { lastRowOf, tileCenter } from '../map/mapLayout';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export interface Poster {
  id: string;
  name: string;
  kind: 'MINIGAME' | 'COST CARD';
  /** "TIER II", or "TIER I–II" when its tiles differ. */
  tier: string;
  art?: string;
  /** The tooltip: its description (a minigame's game while it's a placeholder; none for a cost card). */
  description: string;
  /** Minigame: the game's name. */
  game?: string;
  /** Minigame: what its Prepare cards take. Cost card: what it takes. */
  takes: string;
  /** Tiles nobody has reached that still hold it (0: ALL FOUND). */
  left: number;
}

/** The tiers its tiles play at (a Challenge space plays one up), lowest first. */
function tiersOf(state: GameState, card: ChallengeDef): number[] {
  const tiers = Object.values(state.section.tiles)
    .filter((t) => t.revealedCard?.cardId === card.id || t.revealedCard?.alternative === card.id)
    .map((t) => placedTier(state, t));
  return [...new Set(tiers.length ? tiers : [card.tier])].sort((a, b) => a - b);
}

/** A Prepare thing's name: "Food", "Clay", "Camping Lamp", "Forest". */
function thingName(t: Thing): string {
  if (t.kind === 'category') return CATEGORY_BY_ID.get(t.id as CategoryId)?.name ?? t.id;
  if (t.kind === 'resource') return RESOURCE_BY_ID.get(t.id as ResourceId)?.name ?? t.id;
  if (t.kind === 'item') return ITEMS[t.id]?.name ?? t.id;
  return NODE_NAME[t.id as keyof typeof NODE_NAME] ?? t.id;
}

/** What a minigame's Prepare cards take at this tier: "Food, Fiber, Fire". */
export function prepareWords(card: ChallengeDef, tier: number): string {
  const game = card.minigame?.game;
  const popup = game ? POPUPS[game] : undefined;
  if (!popup) return '';
  const settings = minigameSettings(card, { tier: 1, shownTier: tier });
  const names = popup
    .options(settings)
    .filter((o) => !o.onlyIf || o.onlyIf(settings))
    .flatMap((o) => o.accepts.map(thingName));
  return [...new Set(names)].join(', ');
}

export function posterOf(state: GameState, cardId: string): Poster | undefined {
  const card = CARDS[cardId];
  if (!card || card.kind !== 'challenge') return undefined;
  const tiers = tiersOf(state, card);
  const lo = tiers[0] ?? card.tier;
  const hi = tiers.at(-1) ?? lo;
  const tier = `TIER ${ROMAN[lo - 1]}${hi > lo ? `–${ROMAN[hi - 1]}` : ''}`;
  const art = POSTERS[card.id] ?? (card.art ? cardArt(card) : undefined);
  const game = card.minigame ? MINIGAME_BY_ID.get(card.minigame.game) : undefined;
  const pays = card.minigame ? '' : cardText(card, card.costText, { at: lo });
  // While the description is a placeholder: a minigame says what its game is;
  // a cost card's PAYS WITH line already says it all.
  const description = card.descriptionPlaceholder ? (game?.description ?? '') : card.description;
  return {
    id: card.id,
    name: card.name,
    kind: card.minigame ? 'MINIGAME' : 'COST CARD',
    tier,
    ...(art ? { art } : {}),
    description,
    ...(card.minigame ? { game: game?.name ?? card.name } : {}),
    takes: card.minigame ? prepareWords(card, lo) : pays,
    left: tilesLeft(state, card.id).length,
  };
}

/** The acorn-cap icon, on the purse and the tip boxes' plates. */
export const CAP_ICON = asset('icons/acorn-caps.png');

/**
 * Where each poster hangs on the cork (x, y, turn), around the map in the
 * middle: the prototype's six spots, then two columns on each side for up
 * to eight, then smaller posters in three columns.
 */
export function spotsFor(n: number): { x: number; y: number; r: number; scale: number }[] {
  const PROTOTYPE: [number, number, number][] = [
    [30, 22, -3],
    [198, 34, 2.5],
    [112, 268, -1.5],
    [772, 30, 2],
    [924, 20, -2.5],
    [846, 262, 1.5],
  ];
  if (n <= 6) {
    // Fill the sides evenly: left, right, left…
    const order = [0, 3, 1, 4, 2, 5];
    const used = order.slice(0, n).sort((a, b) => a - b);
    return used.map((i) => {
      const [x, y, r] = PROTOTYPE[i]!;
      return { x, y, r, scale: 1 };
    });
  }
  const cols = n <= 8 ? 2 : 3;
  const rows = Math.ceil(n / (cols * 2));
  const scale = Math.min(1, cols === 2 ? 1 : 0.72, 2.3 / rows);
  const w = 156 * scale;
  const h = 214 * scale;
  const turns = [-3, 2.5, -1.5, 2, -2.5, 1.5, -1, 3];
  const spots: { x: number; y: number; r: number; scale: number }[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2;
    const k = Math.floor(i / 2);
    const col = k % cols;
    const row = Math.floor(k / cols);
    const left = side === 0 ? 20 : 764;
    const room = side === 0 ? 340 : 310;
    const gap = (room - cols * w) / Math.max(1, cols - 1);
    spots.push({
      x: Math.round(left + col * (w + gap)),
      y: Math.round(18 + row * (h + 24) + (col % 2) * 12),
      r: turns[i % turns.length]!,
      scale,
    });
  }
  return spots;
}

/** Steps along the trail from the trailhead to this tile. */
export function stepsTo(section: Section, tileId: TileId): number {
  const seen = new Set<TileId>([section.trailheadId]);
  let ring: TileId[] = [section.trailheadId];
  for (let steps = 0; ring.length; steps++) {
    if (ring.includes(tileId)) return steps;
    const next: TileId[] = [];
    for (const id of ring) {
      for (const n of adjacentTileIds(section, id)) {
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    ring = next;
  }
  return 0;
}

export interface MiniTile {
  id: TileId;
  x: number;
  y: number;
  kind: 'trailhead' | 'normal' | 'checkpoint';
  /** Somebody reached it, or its card shows. */
  seen: boolean;
}

/**
 * The section's tiles fitted into a box (w × h): centers, the hex radius, and
 * the trail between neighbors.
 */
export function miniMap(
  section: Section,
  w: number,
  h: number,
  pad = 24,
): { tiles: MiniTile[]; r: number; lines: [MiniTile, MiniTile][] } {
  const last = lastRowOf(section);
  const raw = Object.values(section.tiles).map((t) => ({ t, p: tileCenter(t, last) }));
  const xs = raw.map((c) => c.p.x);
  const ys = raw.map((c) => c.p.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const k = Math.min(
    (w - pad * 2) / Math.max(1, maxX - minX),
    (h - pad * 2) / Math.max(1, maxY - minY),
  );
  const ox = (w - (maxX - minX) * k) / 2;
  const oy = (h - (maxY - minY) * k) / 2;
  const tiles: MiniTile[] = raw.map(({ t, p }) => ({
    id: t.id,
    x: ox + (p.x - minX) * k,
    y: oy + (p.y - minY) * k,
    kind: t.kind,
    seen: !!t.visited || (!!t.revealedCard && !t.revealedCard.hidden),
  }));
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const lines: [MiniTile, MiniTile][] = [];
  for (const t of tiles) {
    for (const n of adjacentTileIds(section, t.id)) {
      const o = byId.get(n);
      if (o && t.id < o.id) lines.push([t, o]);
    }
  }
  // A hex a little smaller than the step between rows.
  return { tiles, r: Math.max(6, Math.min(34, 0.42 * 152 * k)), lines };
}

/** A pointy-top hex's corners, for an SVG polygon. */
export function hexPoints(x: number, y: number, r: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(x + r * 0.88 * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(' ');
}
