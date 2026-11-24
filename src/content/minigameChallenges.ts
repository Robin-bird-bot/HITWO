/**
 * Challenges played as minigames (Phase 10.8, docs/design/10-minigames.md):
 * what the challenge pop-up shows. Bear Country is the first, played as
 * Bearrels. Hooking these into real challenges (Prepare, stakes, XP) comes
 * in a later step; for now the Minigame testing tab opens them.
 */
import { asset } from '../config/assets';

export interface MinigameChallenge {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  /** Who takes part ("WHOLE PARTY"), top right of the banner. */
  who: string;
  /** In italic, at the top of the right column. */
  flavor: string;
  /** Its poster (2:3), when Wyatt has painted one. */
  poster?: string;
  /** The minigame it plays (src/minigames/catalog.ts). */
  minigame: string;
  /** The game, as the pop-up shows it. */
  game: { name: string; line: string; chip?: string };
  /** Prepare options (effect and cost). TODO(wyatt): not built yet; the mockup's are placeholders. */
  prepare?: readonly { label: string; cost: string; placeholder?: true }[];
  /** What failing costs. Shown, not applied yet. */
  ifHit: readonly { who: 'each' | 'everyone'; label: string; value: string }[];
}

export const BEAR_COUNTRY: MinigameChallenge = {
  id: 'bearCountry',
  name: 'Bear Country',
  tier: 2,
  who: 'Whole party',
  flavor: '“Mama bear doesn’t like visitors.”',
  poster: asset('posters/bear-country.png'),
  minigame: 'bearrels',
  game: {
    name: 'Barrels',
    line: 'Hide behind a barrel. The bear shoots one each round.',
    chip: 'Harder in a group',
  },
  prepare: [
    { label: '+1 barrel', cost: '2 Wood', placeholder: true },
    { label: '−1 round', cost: '1 Bear Spray', placeholder: true },
    { label: 'Skip it', cost: '2 Bear Spray', placeholder: true },
  ],
  ifHit: [
    { who: 'each', label: 'Each hiker hit:', value: '1 Injury' },
    { who: 'everyone', label: 'Everyone hit:', value: 'party −1 Luck' },
  ],
};
