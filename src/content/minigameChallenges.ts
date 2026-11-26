/**
 * Challenges played as minigames (Phase 10.8, docs/design/10-minigames.md):
 * what the challenge pop-up shows. Bear Country is the first, played as
 * Dodge with Bear with a Gun at Tier III (Nov 26: Bearrels is gone).
 * Hooking these into real challenges (stakes, XP) comes in a later step;
 * for now the Minigame testing tab opens them.
 */
import { asset } from '../config/assets';
import { item, type Option } from '../minigames/prepare';
import type { Tier } from '../minigames/types';

export interface MinigameChallenge {
  id: string;
  name: string;
  /** I to V (the minigames' tiers, 15-challenge-tiers.md). */
  tier: Tier;
  /** Who takes part ("WHOLE PARTY"), top right of the banner. */
  who: string;
  /** In italic, under the poster (none for a test challenge). */
  flavor: string;
  /** Its poster (2:3), when Wyatt has painted one. */
  poster?: string;
  /** The minigame it plays (src/minigames/catalog.ts), and the settings it plays with. */
  minigame: string;
  settings?: Readonly<Record<string, string | number>>;
  /** The game, as the pop-up shows it. */
  game: { name: string; line: string; chip?: string };
  /**
   * Prepare options the challenge adds to its game's (20-challenge-popup.md,
   * section 4.7): Bear Country's SKIP IT. They join the game's cost cards.
   */
  options?: readonly Option[];
  /** What failing costs. Shown, not applied yet (none for a test challenge). */
  ifHit: readonly { who: 'each' | 'everyone'; label: string; value: string }[];
}

/**
 * The pop-up for a minigame in the testing tab when it has no challenge of
 * its own yet (11-minigames-puzzles.md, "Testing tab"): the game's name in
 * the banner, the tier picked, an empty poster frame, no flavor and no stakes.
 */
export function testChallenge(
  game: { id: string; name: string; baseGame: string; description: string },
  tier: Tier,
): MinigameChallenge {
  return {
    id: `test-${game.id}`,
    name: game.name,
    tier,
    who: 'Whole party',
    flavor: '',
    minigame: game.id,
    game: { name: game.name, line: game.description },
    ifHit: [],
  };
}

export const BEAR_COUNTRY: MinigameChallenge = {
  id: 'bearCountry',
  name: 'Bear Country',
  tier: 3,
  who: 'Whole party',
  flavor: '“Mama bear doesn’t like visitors.”',
  poster: asset('posters/bear-country.png'),
  minigame: 'dodge',
  settings: { animal: 'gunBear' },
  game: {
    name: 'Bear with a Gun',
    line: 'Dodge the bear’s shots and traps. Hikers take turns.',
  },
  // Bear Country also offers SKIP IT: Bear Spray ×2 (20-challenge-popup.md, section 7).
  options: [
    {
      id: 'skip',
      title: 'SKIP IT',
      color: 'red',
      accepts: item('bearSpray'),
      need: 2,
      label: 'SKIP IT',
      short: 'SKIP',
      note: 'get past without playing',
      max: 1,
      param: 'prep.skip',
      step: 1,
      skip: true,
    },
  ],
  ifHit: [
    { who: 'each', label: 'Each hiker hit:', value: '1 Injury' },
    { who: 'everyone', label: 'Everyone hit:', value: 'party −1 Luck' },
  ],
};
