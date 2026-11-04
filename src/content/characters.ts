/**
 * The hikers a new game starts with. Swap these four placeholders for Wyatt's
 * real characters when they're ready: everything about a character (name,
 * family, slots, traits, portrait and party color) lives here.
 *
 * TODO(wyatt): placeholder starting four. Two Humans, a Dog and a Cat so the
 * family rules can be tested; traits are picked from the ones built so far.
 */
import type { HikerSetup } from '../engine/newGame';

export interface CharacterDef extends HikerSetup {
  /** Ring color for the portrait token, rail face and party card. */
  color: string;
  /** Which portrait to show (see ASSETS.portraits). */
  portrait: 'placeholder';
}

export const STARTING_PARTY: readonly CharacterDef[] = [
  {
    id: 'hiker-1',
    name: 'Hiker 1',
    family: 'human',
    placeholder: true,
    color: '#E2683C',
    portrait: 'placeholder',
    slots: [
      { type: 'T', traitId: 'leader' },
      { type: 'U', traitId: null },
      { type: 'W', traitId: 'extrinsic' },
    ],
  },
  {
    id: 'hiker-2',
    name: 'Hiker 2',
    family: 'human',
    placeholder: true,
    color: '#EBC04A',
    portrait: 'placeholder',
    slots: [
      { type: 'T', traitId: 'stoic' },
      { type: 'U', traitId: null },
      { type: 'W', traitId: null },
    ],
  },
  {
    id: 'hiker-3',
    name: 'Hiker 3',
    family: 'dog',
    placeholder: true,
    color: '#4A8FD4',
    portrait: 'placeholder',
    slots: [
      { type: 'T', traitId: 'leader' },
      { type: 'U', traitId: null },
      { type: 'W', traitId: null },
    ],
  },
  {
    id: 'hiker-4',
    name: 'Hiker 4',
    family: 'cat',
    placeholder: true,
    color: '#A06CC9',
    portrait: 'placeholder',
    slots: [
      { type: 'T', traitId: 'stoic' },
      { type: 'U', traitId: null },
      { type: 'W', traitId: 'extrinsic' },
    ],
  },
];

const BY_ID = new Map(STARTING_PARTY.map((c) => [c.id, c]));

/** A hiker's character, for their color and portrait. Unknown ids get a neutral look. */
export function characterFor(hikerId: string): Pick<CharacterDef, 'color' | 'portrait'> {
  return BY_ID.get(hikerId) ?? { color: '#C9C2B2', portrait: 'placeholder' };
}
