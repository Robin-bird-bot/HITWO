/**
 * A minigame challenge played from a tile (docs/design/25-challenges-on-the-map.md,
 * section 3). The pop-up and the game run in the UI; when the end screen's
 * Continue is pressed, the UI sends one action with how it went and what
 * Prepare spent, and the engine:
 *
 * 1. checks and spends the Prepare fills, all or nothing (resources come out
 *    of the givers' packs; an item loses a use, and is gone at none);
 * 2. applies the game's own costs when the card keeps them (Rock Climb's
 *    Energy for each fall, what Raccoon Shuffle and Squirrel Theft stole);
 * 3. gives each hiker who passed XP (passXpPerTier × the card's tier, as cards do);
 * 4. gives each hiker who failed the challenge's punishment, with the backup
 *    rule (passing challenges send them back first: their punishment starts
 *    with going back). The hiker the game hurt (Sketchy Bridge's breaker)
 *    takes the card's `hurt` instead.
 * 5. A passing challenge nobody got past stays face up on the tile; any
 *    other is done, and the tile is clear.
 *
 * SKIP IT (Gun Bear Attack!) passes everyone without playing.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { CARDS } from '../../content/challenges';
import { RESOURCES } from '../../content/resources';
import { countChallenge } from '../counters';
import { fireChallengeResult, fireMinigameOpen } from '../effects';
import { earnFreeMove } from '../items/freeMoves';
import { usesLeftOf } from '../items/make';
import { loseUses } from '../items/wear';
import { pushEvent } from '../log';
import { changeStat } from '../stats';
import { gainXp } from '../xp';
import type { GameState, Hiker, HikerId, OpenChallenge, ResourceId } from '../types';
import { applyEffects, type EffectResult } from './applyEffects';
import { backupFor, challengeHikers } from './resolve';
import { openNext, revealTile } from './reveal';
import type { ChallengeDef, MinigameVersion } from './types';

/** What a game's own result says (src/minigames/types.ts, MinigameResult), as the engine needs it. */
export interface MinigameOutcome {
  /** The hikers who passed. */
  passed: HikerId[];
  /** The game's own costs, by hiker (energy, random resources, stolen resources, conditions). */
  pays?: Record<
    HikerId,
    { energy?: number; resources?: number; stolen?: string[]; conditions?: string[] }
  >;
  /** SKIP IT: everyone passes without playing. */
  skipped?: true;
}

/** One thing Prepare took: a resource (count of them) or an item's use (count of them). */
export interface PrepSpend {
  hiker: HikerId;
  kind: 'resource' | 'item';
  id: string;
  count: number;
}

export interface ResolveMinigameAction {
  type: 'resolveMinigameChallenge';
  outcome: MinigameOutcome;
  spent: PrepSpend[];
}

/** The open challenge's card, if it's a minigame challenge. */
export function openMinigameCard(open: OpenChallenge | undefined): ChallengeDef | undefined {
  const card = open && CARDS[open.cardId];
  return card?.kind === 'challenge' && card.minigame ? card : undefined;
}

/** A minigame card's version on a tile (or its first, or none): its settings and art. */
export function versionOf(
  card: ChallengeDef,
  version: number | undefined,
): MinigameVersion | undefined {
  const versions = card.minigame?.versions;
  if (!versions?.length) return undefined;
  return versions[version ?? 0] ?? versions[0];
}

/** The game's settings for this open challenge: the card's, its version's, and the tile's tier. */
export function minigameSettings(
  card: ChallengeDef,
  open: Pick<OpenChallenge, 'version' | 'shownTier' | 'tier'>,
): Record<string, string | number> {
  return {
    ...(card.minigame?.settings ?? {}),
    ...(versionOf(card, open.version)?.settings ?? {}),
    tier: open.shownTier ?? open.tier,
  };
}

/** A hiker's pack for Prepare: their resources, and their bag's items with uses. */
export function prepPack(h: Hiker): {
  resources: Partial<Record<string, number>>;
  items: { uid: string; itemId: string; usesLeft?: number }[];
} {
  return {
    resources: { ...h.inventory.resources },
    items: h.inventory.bag.map((i) => {
      const uses = ITEMS[i.itemId]?.uses !== undefined;
      return { uid: i.uid, itemId: i.itemId, ...(uses ? { usesLeft: usesLeftOf(i) } : {}) };
    }),
  };
}

export function validateResolveMinigame(
  state: GameState,
  action: ResolveMinigameAction,
): string | undefined {
  const open = state.challenge;
  const card = openMinigameCard(open);
  if (!open || !card) return 'There’s no minigame challenge open.';
  const here = challengeHikers(state, open);
  const ids = new Set(here.map((h) => h.id));
  if (action.outcome.passed.some((id) => !ids.has(id))) return 'Only hikers here can pass it.';
  // Prepare: all or nothing; the givers have to have it all.
  const need = new Map<string, number>();
  for (const s of action.spent) {
    if (!ids.has(s.hiker)) return 'Only hikers on this tile can spend for Prepare.';
    if (!Number.isInteger(s.count) || s.count < 1) return 'Spend things one at a time.';
    const key = `${s.hiker}|${s.kind}|${s.id}`;
    need.set(key, (need.get(key) ?? 0) + s.count);
  }
  for (const [key, n] of need) {
    const [who, kind, id] = key.split('|') as [HikerId, 'resource' | 'item', string];
    const h = here.find((x) => x.id === who)!;
    if (kind === 'resource') {
      if ((h.inventory.resources[id as ResourceId] ?? 0) < n) {
        const name = RESOURCES.find((r) => r.id === id)?.name ?? id;
        return `${h.name} doesn’t have ${n} ${name}.`;
      }
    } else if (h.inventory.bag.filter((i) => i.itemId === id).length < 1) {
      return `${h.name} doesn’t have that item.`;
    }
  }
  return undefined;
}

/** Spends what Prepare used: resources out of the pack; an item loses a use for each. */
function spendPrepare(
  state: GameState,
  here: readonly Hiker[],
  spent: readonly PrepSpend[],
  cause: string,
) {
  for (const s of spent) {
    const h = here.find((x) => x.id === s.hiker);
    if (!h) continue;
    if (s.kind === 'resource') {
      const id = s.id as ResourceId;
      const left = (h.inventory.resources[id] ?? 0) - s.count;
      if (left > 0) h.inventory.resources[id] = left;
      else delete h.inventory.resources[id];
      pushEvent(state, {
        kind: 'lost',
        hikerId: h.id,
        resources: Array.from({ length: s.count }, () => id),
        items: [],
        cause,
      });
      continue;
    }
    for (let k = 0; k < s.count; k++) {
      const item = h.inventory.bag.find((i) => i.itemId === s.id);
      if (item) loseUses(state, h, item, 1, cause);
    }
  }
}

/** The game's own costs, for a card that keeps them. */
function payGameCosts(
  state: GameState,
  h: Hiker,
  pay: NonNullable<MinigameOutcome['pays']>[HikerId] | undefined,
  cause: string,
) {
  if (!pay) return;
  if (pay.energy) changeStat(state, h, 'energy', -pay.energy, cause);
  const stolen = (pay.stolen ?? []).filter(
    (id) => (h.inventory.resources[id as ResourceId] ?? 0) > 0,
  );
  for (const id of stolen) {
    const r = id as ResourceId;
    const left = (h.inventory.resources[r] ?? 0) - 1;
    if (left > 0) h.inventory.resources[r] = left;
    else delete h.inventory.resources[r];
  }
  if (stolen.length)
    pushEvent(state, {
      kind: 'lost',
      hikerId: h.id,
      resources: stolen as ResourceId[],
      items: [],
      cause,
    });
}

export function applyResolveMinigame(state: GameState, action: ResolveMinigameAction): void {
  const open = state.challenge;
  const card = openMinigameCard(open);
  if (!open || !card) throw new Error('applyResolveMinigame: no minigame challenge open');
  const here = challengeHikers(state, open);
  const game = card.minigame!;
  const passed = (h: Hiker) => action.outcome.skipped || action.outcome.passed.includes(h.id);
  const xp = BALANCE.challenges.passXpPerTier * open.tier;
  const backup = backupFor(card, open);
  const pays = action.outcome.pays ?? {};
  // The hiker the game hurt (Sketchy Bridge: whoever broke it).
  const hurtOf = (h: Hiker) => !!game.hurt && (pays[h.id]?.conditions?.length ?? 0) > 0;

  pushEvent(state, {
    kind: 'challenge',
    cardId: card.id,
    tileId: open.tileId,
    party: false,
    results: here.map((h) => ({
      hikerId: h.id,
      passed: passed(h),
      ...(passed(h) && xp ? { xp } : {}),
    })),
  });

  spendPrepare(state, here, action.spent, `${card.name}: Prepare`);
  if (game.keepsPays && !action.outcome.skipped) {
    for (const h of here) payGameCosts(state, h, pays[h.id], card.name);
  }

  const entered: EffectResult['entered'] = [];
  for (const h of here) {
    h.lastChallengeDay = state.day;
    countChallenge(state, h.id, passed(h));
    if (passed(h)) {
      gainXp(state, h, xp, 'challenge', card.name);
      earnFreeMove(state, h, 'afterChallenge');
      continue;
    }
    const effects = hurtOf(h)
      ? [game.hurt!, card.penalty.filter((e) => e.op === 'move')].flat()
      : card.penalty;
    const r = applyEffects(
      state,
      {
        card,
        tileId: open.tileId,
        targets: [h],
        onTile: here,
        rolls: open.rolls,
        tier: open.shownTier ?? open.tier,
        ...(backup ? { backup } : {}),
      },
      effects,
    );
    entered.push(...r.entered);
  }
  const anyPassed = here.some(passed);
  fireChallengeResult(state, open.tileId, {
    passed: anyPassed,
    hikerIds: here.map((h) => h.id),
  });

  // A passing challenge nobody got past stays on the tile, face up.
  const tile = state.section.tiles[open.tileId];
  if (game.passing && !anyPassed && tile) {
    tile.revealedCard = {
      cardId: card.id,
      tier: open.tier,
      scale: open.scale,
      ...(open.shownTier ? { shownTier: open.shownTier } : {}),
      ...(open.version !== undefined ? { version: open.version } : {}),
    };
  }

  delete state.challenge;
  for (const e of entered) revealTile(state, e.tileId, e.hikerIds);
  openNext(state);
}

/**
 * A minigame challenge that just opened, not waiting on a Choice: a trait
 * may pass it for everyone without playing, as if they all passed (Minigame
 * Master; 26-fixes-and-wyatt-trees.md, section 5.2). Each opened challenge
 * is looked at once; passing it may open the next one queued.
 */
export function passIfMastered(state: GameState): void {
  for (let guard = 0; guard < 10; guard++) {
    const open = state.challenge;
    if (!open || open.alternative || open.looked || !openMinigameCard(open)) return;
    open.looked = true;
    const here = challengeHikers(state, open);
    if (!fireMinigameOpen(state, here, open.tileId)) return;
    applyResolveMinigame(state, {
      type: 'resolveMinigameChallenge',
      outcome: { passed: here.map((h) => h.id) },
      spent: [],
    });
  }
}
