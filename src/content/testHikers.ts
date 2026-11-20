/**
 * Test hikers (Nov 20 update, section 7): dev-only placeholder hikers with no
 * art, each exercising a group of traits. They're drawn as a colored circle
 * with initials, and never appear in the real roster (Phase 10b). Every set
 * here is a starting setup; the debug panel can change any of it.
 */
import type { CharacterDef } from './characters';

const test = (
  def: Omit<CharacterDef, 'placeholder' | 'portrait' | 'test'> & { initials: string },
): CharacterDef => ({ ...def, placeholder: true, test: true, portrait: 'initials' });

export const TEST_HIKERS: readonly CharacterDef[] = [
  test({
    id: 'test-tank',
    name: 'Test Tank',
    initials: 'TK',
    color: '#E2683C',
    family: 'human',
    classes: ['tank'],
    slots: [
      { type: 'T', traitId: 'leader' },
      { type: 'T', traitId: 'puller' },
      { type: 'T/U', traitId: 'trespasser' },
      { type: 'M', traitId: 'bossy' },
    ],
  }),
  test({
    id: 'test-hardy',
    name: 'Test Hardy',
    initials: 'HD',
    color: '#C9503C',
    family: 'human',
    classes: ['hardy'],
    slots: [
      { type: 'T', traitId: 'stoic' },
      { type: 'T', traitId: 'hardy' },
      { type: 'T/U', traitId: 'secondWind' },
      { type: 'M', traitId: 'thrillSeekerMorale' },
    ],
  }),
  test({
    id: 'test-scavenger',
    name: 'Test Scavenger',
    initials: 'SV',
    color: '#4A8FD4',
    family: 'dog',
    classes: ['scavenger'],
    slots: [
      { type: 'U', traitId: 'forager' },
      { type: 'U', traitId: 'copydog' },
      { type: 'U', traitId: 'finder', setting: { x: 'river' } },
      { type: 'M', traitId: 'foody' },
    ],
  }),
  test({
    id: 'test-crafter',
    name: 'Test Crafter',
    initials: 'CR',
    color: '#7FC29B',
    family: 'human',
    classes: ['crafter'],
    slots: [
      { type: 'U', traitId: 'handy' },
      { type: 'U', traitId: 'focused' },
      { type: 'U', traitId: 'artisanCook' },
      { type: 'M', traitId: 'zen' },
    ],
  }),
  test({
    id: 'test-scout',
    name: 'Test Scout',
    initials: 'SC',
    color: '#EBC04A',
    family: 'human',
    classes: ['scout'],
    slots: [
      { type: 'T', traitId: 'scout' },
      { type: 'T', traitId: 'fast' },
      { type: 'T', traitId: 'prepared' },
      { type: 'M', traitId: 'wanderlust' },
    ],
  }),
  test({
    id: 'test-support',
    name: 'Test Support',
    initials: 'SP',
    color: '#5FB3A8',
    family: 'human',
    classes: ['support'],
    slots: [
      { type: 'T', traitId: 'supportive' },
      { type: 'U', traitId: 'therapist' },
      { type: 'U', traitId: 'wise' },
      { type: 'M', traitId: 'extrinsic' },
    ],
  }),
  test({
    id: 'test-moneymaker',
    name: 'Test Moneymaker',
    initials: 'MM',
    color: '#D9A441',
    family: 'human',
    classes: ['moneymaker'],
    slots: [
      { type: 'U', traitId: 'charismatic' },
      { type: 'U', traitId: 'frugal' },
      { type: 'U', traitId: 'mba' },
      { type: 'M', traitId: 'fairWeather' },
    ],
  }),
  test({
    id: 'test-cat',
    name: 'Test Cat',
    initials: 'CT',
    color: '#A06CC9',
    family: 'cat',
    classes: ['tank', 'support'],
    slots: [
      { type: 'T', traitId: 'leader' },
      { type: 'U', traitId: 'mouser' },
      { type: 'M', traitId: 'aloof' },
    ],
  }),
  test({
    id: 'test-plush',
    name: 'Test Plush',
    initials: 'PL',
    color: '#E58FB0',
    family: 'plush',
    classes: ['scout'],
    slots: [
      { type: 'T', traitId: 'shifty' },
      { type: 'T', traitId: 'nightShifty' },
      { type: 'M', traitId: 'intrinsic' },
    ],
  }),
  test({
    id: 'test-duo',
    name: 'Test Duo',
    initials: 'DU',
    color: '#8C7A5B',
    family: 'dog',
    classes: ['support', 'scavenger'],
    duo: ['Boss', 'Gracie'],
    slots: [
      { type: 'T', traitId: 'herder' },
      { type: 'U', traitId: 'fetch' },
      { type: 'tag', traitId: 'bossGracie' },
      { type: 'M', traitId: 'loyal' },
    ],
  }),
  test({
    id: 'test-wild',
    name: 'Test Wild',
    initials: 'WD',
    color: '#9C9585',
    family: 'human',
    classes: ['jack'],
    slots: Array.from({ length: 6 }, () => ({ type: 'W' as const, traitId: null })),
  }),
];
