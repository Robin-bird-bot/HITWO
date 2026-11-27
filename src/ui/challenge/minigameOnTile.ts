/**
 * A minigame challenge on a tile (docs/design/25-challenges-on-the-map.md,
 * section 3.1): what the challenge pop-up shows for the open challenge, the
 * hikers who play it (with their real packs), and the action the result
 * becomes.
 *
 * - **Banner:** the challenge's name and tier; on the right, the hikers on
 *   the tile.
 * - **Poster:** Wyatt's painted poster when there is one, otherwise its art
 *   for now (the challenge picture, cropped to 2:3 by the frame).
 * - **IF YOU FAIL:** the punishment, with its numbers rolled.
 */
import { asset } from '../../config/assets';
import {
  CHALLENGE_OPTIONS,
  POSTERS,
  type MinigameChallenge,
} from '../../content/minigameChallenges';
import {
  challengeHikers,
  type GameState,
  type MinigameOutcome,
  type OpenChallenge,
  type PrepSpend,
} from '../../engine';
import {
  minigameSettings,
  openMinigameCard,
  prepPack,
  versionOf,
} from '../../engine/challenges/minigame';
import { MINIGAME_BY_ID } from '../../minigames/catalog';
import type { Spent } from '../../minigames/prepare';
import type { MinigameHiker, MinigameResult, Tier } from '../../minigames/types';
import { minigameHiker } from '../../minigames/hikers';
import { cardText } from './cardText';

/** The open challenge as the pop-up shows it, or undefined if it isn't a minigame. */
export function popupFor(state: GameState, open: OpenChallenge): MinigameChallenge | undefined {
  const card = openMinigameCard(open);
  if (!card?.minigame) return undefined;
  const game = MINIGAME_BY_ID.get(card.minigame.game);
  const tier = Math.max(1, Math.min(5, open.shownTier ?? open.tier)) as Tier;
  const art = versionOf(card, open.version)?.artFile ?? card.artFile ?? card.id;
  const poster = POSTERS[card.id] ?? (card.art ? asset(`challenges/${art}.jpg`) : undefined);
  const here = challengeHikers(state, open);
  const fail = cardText(card, card.penaltyText, { rolls: open.rolls, at: tier }).replace(
    /^If (failed|caught):\s*/i,
    '',
  );
  return {
    id: card.id,
    name: card.name,
    tier,
    who: here.map((h) => h.name).join(', '),
    flavor: card.descriptionPlaceholder ? '' : card.description,
    ...(poster ? { poster } : {}),
    minigame: card.minigame.game,
    settings: minigameSettings(card, open),
    game: { name: game?.name ?? card.name, line: game?.description ?? '' },
    ...(CHALLENGE_OPTIONS[card.id] ? { options: CHALLENGE_OPTIONS[card.id] } : {}),
    ifHit: [
      {
        who: 'each',
        label: 'Each hiker who fails:',
        value: fail.charAt(0).toUpperCase() + fail.slice(1),
      },
    ],
  };
}

/** The hikers on the tile as the game draws them, with their real packs for Prepare. */
export function minigameHikersFor(state: GameState, open: OpenChallenge): MinigameHiker[] {
  return challengeHikers(state, open).map((h) => {
    const pack = prepPack(h);
    const look = minigameHiker(h.characterId ?? h.id, h.color);
    return {
      id: h.id,
      name: h.name,
      color: look.color,
      art: look.art,
      pack: pack.resources,
      items: pack.items,
    };
  });
}

/** What Prepare spent, as the engine takes it. */
export const spendsOf = (spent: readonly Spent[]): PrepSpend[] =>
  spent.map((s) => ({
    hiker: s.hiker,
    kind: s.thing.kind === 'item' ? 'item' : 'resource',
    id: s.thing.id,
    count: s.count,
  }));

/** How the game went, as the engine takes it (SKIP IT: everyone passes). */
export function outcomeOf(result: MinigameResult, skipped: boolean): MinigameOutcome {
  if (skipped) return { passed: [], skipped: true };
  return {
    passed: [...result.safe],
    ...(result.pays ? { pays: result.pays } : {}),
  };
}
