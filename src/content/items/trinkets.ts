/**
 * Trinkets (docs/design/03-items.md, "Trinkets"): no Quality, and only the
 * generic recipe (5 random different resources). Use trinkets are used up;
 * Keep trinkets work while carried. Using one is a free action, like a tool
 * (src/engine/actions/useItem.ts). The ones that touch traits, slots or XP
 * wait on Phase 10, and say so when someone tries.
 */
import type { ItemDef } from '../../engine/effects';
import { item } from './build';

const PHASE_10 = 'It works once traits and levels arrive (Phase 10).';

const trinket = (def: Omit<Parameters<typeof item>[0], 'type'>): ItemDef =>
  item({ ...def, type: 'trinket' });

export const TRINKETS: readonly ItemDef[] = [
  trinket({
    id: 'diploma',
    notYet: PHASE_10,
    name: 'Diploma',
    tier: 2,
    trinket: 'use',
    // TODO(phase 10): XP. BALANCE.items.diplomaXp is the doc's first guess.
    text: 'Gain a random large amount of XP.',
  }),
  trinket({
    id: 'cherishedPhoto',
    notYet: PHASE_10,
    name: 'Cherished Photo',
    tier: 2,
    trinket: 'use',
    // TODO(phase 10): traits and slots.
    text: 'Gain a random Trail or Utility trait.',
  }),
  trinket({
    id: 'familyPhoto',
    notYet: PHASE_10,
    name: 'Family Photo',
    tier: 3,
    trinket: 'use',
    // TODO(phase 10): traits and slots.
    text: 'Copy a trait from one hiker to another.',
  }),
  trinket({
    id: 'oldPhoto',
    notYet: PHASE_10,
    name: 'Old Photo',
    tier: 2,
    trinket: 'use',
    // TODO(phase 10): traits.
    text: 'Replace one of this hiker’s traits: pick 1 of 3 traits of the same type and rank.',
  }),
  trinket({
    id: 'instructionManual',
    notYet: PHASE_10,
    name: 'Instruction Manual',
    tier: 3,
    trinket: 'use',
    // TODO(phase 10): slots.
    text: 'Add a trait slot: Trail, Utility or multi-slot (your choice).',
  }),
  trinket({
    id: 'wallet',
    name: 'Wallet',
    tier: 2,
    trinket: 'use',
    text: 'Permanently: +1 to all caps the party gains.',
    use: { target: 'self', capsBonus: true },
  }),
  trinket({
    id: 'postcard',
    notYet: PHASE_10,
    name: 'Postcard',
    tier: 1,
    trinket: 'keep',
    // TODO(phase 10): XP. BALANCE.items.postcardXp is the doc's first guess.
    text: 'More XP from checkpoints and challenges.',
  }),
  trinket({
    id: 'textbook',
    notYet: PHASE_10,
    name: 'Textbook',
    tier: 1,
    trinket: 'keep',
    // TODO(phase 10): XP.
    text: '+1 XP from every scavenge and craft.',
  }),
  trinket({
    id: 'energySerum',
    name: 'Energy Serum',
    tier: 3,
    trinket: 'use',
    text: 'Permanently +1 maximum Energy.',
    use: { maxStat: 'energy' },
  }),
  trinket({
    id: 'appetiteSerum',
    name: 'Appetite Serum',
    tier: 3,
    trinket: 'use',
    text: 'Permanently +1 maximum Appetite.',
    use: { maxStat: 'appetite' },
  }),
  trinket({
    id: 'moraleSerum',
    name: 'Morale Serum',
    tier: 3,
    trinket: 'use',
    text: 'Permanently +1 maximum Morale.',
    use: { maxStat: 'morale' },
  }),
  trinket({
    id: 'ring',
    name: 'Ring',
    tier: 2,
    trinket: 'use',
    art: null,
    // TODO(wyatt): which family, and for how many days.
    text: 'Changes a hiker’s family for a set number of days.',
    notYet: 'It works once Wyatt decides which family and for how long.',
  }),
];
