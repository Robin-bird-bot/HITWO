/**
 * The biome's challenge pool, placed when the section is made
 * (docs/design/25-challenges-on-the-map.md, section 1). The Trail Infoboard
 * and Game Sight need to know what each tile holds ahead of time.
 *
 * 1. Each challenge tile's tier is rolled as before (`rolledTier`: fixed by
 *    the run, the section and the tile). A Challenge space plays one higher.
 * 2. **The pool:** challenge tiles ÷ [2.5], rounded up, at least [3] and at
 *    most [7] cards: only cards whose nodes fit one of the section's
 *    challenge tiles and whose "From" tier is at most the highest tier
 *    there; snow-only cards only on a snowy section. Cost cards make up
 *    [40%, 30%, 25%] of it in the 1st, 2nd and 3rd biome (Claude's idea).
 * 3. **Placing:** every challenge tile gets a pool card that fits it,
 *    spread so each card gets a tile when the tiles allow (the most
 *    constrained tiles first, then the card with the fewest tiles). A tile
 *    no pool card fits gets a fitting card from outside, which joins the
 *    pool. Choice spaces get two different cards.
 * 4. **Stored on the tile,** hidden (`tile.revealedCard` with `hidden`):
 *    landing there opens it (its numbers rolled then), and scouting shows it.
 *
 * A minigame card's version (Trail Blocked!'s tree or rockslide) is picked
 * here too, by the tile. Gates nobody can know ahead (a Dog on the tile,
 * the afternoon) pass now and are checked on landing (see reveal.ts).
 *
 * Its own RNG (seeded by the run and the section), so placing never shifts
 * the run's other rolls.
 */
import { BALANCE } from '../../config/balance';
import { CARDS, CHALLENGES } from '../../content/challenges';
import { seedRng, shuffle } from '../rng';
import type { GameState, RngState, Tile } from '../types';
import { notPlayableYet, playable, tileTier, TOP_TIER } from './pick';
import type { ChallengeDef, Gate, MinigameVersion } from './types';

const PB = BALANCE.challenges.pool;

/** A small, steady hash (FNV-1a), to seed the section's placing. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The tiles that hold a challenge: plain challenge tiles, Choice and Challenge spaces. */
export function challengeTiles(state: GameState): Tile[] {
  return Object.values(state.section.tiles)
    .filter(
      (t) =>
        t.kind === 'normal' &&
        !t.quiet &&
        !t.opportunity &&
        !t.wonder &&
        !t.visited &&
        t.special !== 'opportunity' &&
        !(t.special && BALANCE.challenges.noCardOn.includes(t.special)),
    )
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** The tier a tile's challenge plays at (I to V): a Challenge space one higher. */
export function placedTier(state: GameState, tile: Tile): number {
  const base = tileTier(state, tile) + (tile.special === 'challenge' ? 1 : 0);
  return Math.max(1, Math.min(TOP_TIER, base));
}

/** Gates that can be checked ahead: snow. The rest (a Dog here, the afternoon) pass for now. */
function gateAhead(gate: Gate, state: GameState): boolean {
  return gate === 'snow' ? !!state.snowy : true;
}

const nodesFit = (card: ChallengeDef, tile: Tile) =>
  card.nodes === 'any' || tile.nodes.some((n) => n.type !== 'caps' && card.nodes.includes(n.type));

/** Can this card go on this tile (at its tier), as far as anyone can tell ahead? */
export function fitsTile(card: ChallengeDef, state: GameState, tile: Tile, tier: number): boolean {
  if (card.kind !== 'challenge' || notPlayableYet(card) || card.risk) return false;
  if (card.tier > tier) return false;
  if (!nodesFit(card, tile)) return false;
  return (card.gates ?? []).every((g) => gateAhead(g, state));
}

/** The cards that may be in a pool at all (the testing tool can keep it to minigames). */
function candidates(state: GameState): ChallengeDef[] {
  return CHALLENGES.filter((c) => !state.testing?.minigamesOnly || !!c.minigame);
}

/**
 * A minigame card's version on this tile: the versions that fit its nodes,
 * tier and snow; among node-specific ones, one at random; otherwise the
 * first that fits. Undefined for a card without versions.
 */
export function pickVersion(
  card: ChallengeDef,
  state: Pick<GameState, 'snowy'>,
  tile: Pick<Tile, 'nodes'>,
  tier: number,
  rng: RngState,
): number | undefined {
  const versions = card.minigame?.versions;
  if (!versions?.length) return undefined;
  const fits = (v: MinigameVersion) =>
    (!v.nodes || tile.nodes.some((n) => v.nodes!.includes(n.type as never))) &&
    (v.fromTier === undefined || tier >= v.fromTier) &&
    (v.upToTier === undefined || tier <= v.upToTier) &&
    (v.snow === undefined || v.snow === !!state.snowy);
  const ok = versions.map((v, i) => ({ v, i })).filter(({ v }) => fits(v));
  const byNode = ok.filter(({ v }) => v.nodes);
  if (byNode.length) return shuffle(rng, byNode)[0]!.i;
  return ok[0]?.i ?? 0;
}

/** Which biome of the run this is (0, 1 or 2), for the cost-card share. */
function biomeIndex(state: GameState): number {
  const at = BALANCE.run.biomes.indexOf(state.section.biome);
  return Math.max(0, Math.min(2, at >= 0 ? at : state.sectionIndex));
}

/**
 * Picks the section's pool and places it on its challenge tiles. Tiles that
 * already hold a card (scouted, or placed before) keep it.
 */
export function placePool(state: GameState): void {
  const rng = seedRng(hash(`${state.seed}|${state.sectionIndex}|pool`));
  const tiles = challengeTiles(state).filter((t) => !t.revealedCard);
  const tierOf = new Map(tiles.map((t) => [t.id, placedTier(state, t)]));
  const all = candidates(state);
  // Cards that fit at least one of the tiles, at its tier.
  const usable = all.filter((c) => tiles.some((t) => fitsTile(c, state, t, tierOf.get(t.id)!)));

  // Each card's tiles, and a matching of cards to tiles: a card joins the
  // pool only if every pool card can still have a tile of its own (it may
  // move a card already seated to another of that card's tiles).
  const fitsOf = (c: ChallengeDef) => tiles.filter((t) => fitsTile(c, state, t, tierOf.get(t.id)!));
  const holder = new Map<string, ChallengeDef>();
  const seat = (card: ChallengeDef, seen: Set<string>): boolean => {
    for (const t of fitsOf(card)) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const there = holder.get(t.id);
      if (!there || seat(there, seen)) {
        holder.set(t.id, card);
        return true;
      }
    }
    return false;
  };

  // The pool: a share of cost cards by biome, the rest minigames.
  const size = Math.max(PB.min, Math.min(PB.max, Math.ceil(tiles.length / PB.tilesPerCard)));
  const share = PB.costShare[biomeIndex(state)] ?? PB.costShare[PB.costShare.length - 1]!;
  const wantCost = state.testing?.minigamesOnly ? 0 : Math.round(size * share);
  const pool: ChallengeDef[] = [];
  const fill = (from: readonly ChallengeDef[], upTo: number) => {
    for (const c of shuffle(rng, from)) {
      if (pool.length >= upTo) return;
      if (!pool.includes(c) && seat(c, new Set())) pool.push(c);
    }
  };
  fill(
    usable.filter((c) => !c.minigame),
    wantCost,
  );
  fill(
    usable.filter((c) => !!c.minigame),
    size,
  );
  // Short of one kind: fill up from the other.
  fill(usable, size);
  const first = holder;

  // Then the other tiles: the most constrained first; each gets the fitting pool card with the fewest tiles.
  const count = new Map<string, number>(pool.map((c) => [c.id, 0]));
  for (const card of first.values()) count.set(card.id, 1);
  const fitting = (t: Tile, list: readonly ChallengeDef[]) =>
    list.filter((c) => fitsTile(c, state, t, tierOf.get(t.id)!));
  const order = shuffle(rng, tiles).sort(
    (a, b) => fitting(a, pool).length - fitting(b, pool).length,
  );
  const pickFor = (t: Tile, not?: string): ChallengeDef | undefined => {
    let options = fitting(t, pool).filter((c) => c.id !== not);
    if (!options.length) {
      // Nothing in the pool fits: a fitting card from outside joins it.
      const outside = shuffle(
        rng,
        fitting(t, all).filter((c) => c.id !== not),
      )[0];
      if (!outside) return undefined;
      pool.push(outside);
      count.set(outside.id, 0);
      options = [outside];
    }
    const least = Math.min(...options.map((c) => count.get(c.id) ?? 0));
    const card = shuffle(
      rng,
      options.filter((c) => (count.get(c.id) ?? 0) === least),
    )[0]!;
    count.set(card.id, (count.get(card.id) ?? 0) + 1);
    return card;
  };
  for (const t of order) {
    const card = first.get(t.id) ?? pickFor(t);
    if (!card) continue;
    const shown = tierOf.get(t.id)!;
    const { tier, scale } = playable(shown);
    const second = t.special === 'choice' ? pickFor(t, card.id) : undefined;
    const version = pickVersion(card, state, t, shown, rng);
    t.revealedCard = {
      cardId: card.id,
      tier,
      scale,
      shownTier: shown,
      ...(second ? { alternative: second.id } : {}),
      ...(version !== undefined ? { version } : {}),
      hidden: true,
    };
  }
  state.section.pool = pool.map((c) => c.id);
}

/** The section's pool cards (the Infoboard's posters), in order. */
export const poolCards = (state: GameState): ChallengeDef[] =>
  (state.section.pool ?? [])
    .map((id) => CARDS[id])
    .filter((c): c is ChallengeDef => !!c && c.kind === 'challenge');
