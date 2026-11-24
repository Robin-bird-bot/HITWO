/**
 * The hikers a new game starts with. Swap these four placeholders for Wyatt's
 * real characters when they're ready: everything about a character (name,
 * family, slots, traits, portrait and party color) lives here.
 *
 * TODO(wyatt): placeholder starting four. Two Humans, a Dog and a Cat so the
 * family rules can be tested; traits are picked from the ones built so far,
 * and each has one class (Phase 10b brings the real roster).
 */
import type { HikerSetup } from '../engine/newGame';
import { TEST_HIKERS } from './testHikers';

export interface CharacterDef extends HikerSetup {
  /** Ring color for the portrait token, rail face and party card. */
  color: string;
  /** Which portrait to show (see ASSETS.portraits), or initials on a colored circle (test hikers). */
  portrait: 'placeholder' | 'initials';
  /** Test hikers: the letters on their circle. */
  initials?: string;
}

export const STARTING_PARTY: readonly CharacterDef[] = [
  {
    id: 'hiker-1',
    name: 'Hiker 1',
    classes: ['leader'],
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
    classes: ['hardy'],
    family: 'human',
    placeholder: true,
    color: '#EBC04A',
    portrait: 'placeholder',
    // TODO(wyatt): a placeholder Backpack, so the bag shows item-added slots.
    inventory: { equipped: { gear: { uid: 'hiker-2-backpack', itemId: 'backpack' } } },
    slots: [
      { type: 'T', traitId: 'stoic' },
      { type: 'U', traitId: null },
      { type: 'W', traitId: null },
    ],
  },
  {
    id: 'hiker-3',
    name: 'Hiker 3',
    classes: ['scavenger'],
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
    classes: ['scout'],
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

const BY_ID = new Map([...STARTING_PARTY, ...TEST_HIKERS].map((c) => [c.id, c]));

/**
 * A hiker's party color: the one they got from their spot when the run
 * started, or (for an old save's hikers) their character's.
 */
export function hikerColor(hiker: { id: string; color?: string } | undefined): string {
  return hiker?.color ?? characterFor(hiker?.id ?? '').color;
}

/** A hiker's character, for their color and portrait. Unknown ids get a neutral look. */
export function characterFor(
  hikerId: string,
): Pick<CharacterDef, 'color' | 'portrait' | 'initials'> {
  return BY_ID.get(hikerId) ?? { color: '#C9C2B2', portrait: 'placeholder' };
}
