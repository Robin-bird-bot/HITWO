/**
 * Trinkets (docs/design/03-items.md, "Trinkets"): no Quality, and only the
 * generic recipe (5 random different resources). Use trinkets are used up;
 * Keep trinkets work while carried.
 *
 * Phase 10.7 (09-hikers.md): trinkets no longer give or swap traits (those
 * are retired), and new ones wear out: their durability ticks down every
 * phase or each time they take effect, and at 0 they're thrown away.
 * TODO(wyatt): the older Keep trinkets (Postcard, Textbook) don't wear out. Using one is a free action, like a tool
 * (src/engine/actions/useItem.ts). The ones that touch traits and slots use
 * src/engine/traits/levelUp.ts; the XP ones go through src/engine/xp.ts.
 */
import { BALANCE } from '../../config/balance';
import type { ItemDef } from '../../engine/effects';
import { item } from './build';

const trinket = (def: Omit<Parameters<typeof item>[0], 'type'>): ItemDef =>
  item({ ...def, type: 'trinket' });

export const TRINKETS: readonly ItemDef[] = [
  trinket({
    id: 'diploma',
    name: 'Diploma',
    tier: 2,
    trinket: 'use',
    // BALANCE.items.diplomaXp is the doc's first guess (60–100% of a level).
    text: 'Gain a random large amount of XP.',
    use: { levelXp: true },
  }),
  trinket({
    id: 'cherishedPhoto',
    // Phase 10.7: trinkets no longer give or swap traits.
    enabled: false,
    retired: true,
    name: 'Cherished Photo',
    tier: 2,
    trinket: 'use',
    // TODO(wyatt): any tier and any class; it needs an empty slot that fits.
    text: 'Gain a random Trail or Utility trait.',
    use: { randomTrait: true },
  }),
  trinket({
    id: 'familyPhoto',
    // Phase 10.7: trinkets no longer give or swap traits.
    enabled: false,
    retired: true,
    name: 'Family Photo',
    tier: 3,
    trinket: 'use',
    // Not special or unique traits; the receiver needs an empty slot that fits.
    // TODO(wyatt): copied from any hiker still on the hike, to one on this tile.
    text: 'Copy a trait from one hiker to another.',
    use: { copyTrait: true },
  }),
  trinket({
    id: 'oldPhoto',
    // Phase 10.7: trinkets no longer give or swap traits.
    enabled: false,
    retired: true,
    name: 'Old Photo',
    tier: 2,
    trinket: 'use',
    // TODO(wyatt): the 3 come from any class; special and unique traits can't be swapped.
    text: 'Replace one of this hiker’s traits: pick 1 of 3 traits of the same type and rank.',
    use: { swapTrait: true },
  }),
  trinket({
    id: 'instructionManual',
    // Phase 10.7: trinkets no longer give or swap traits.
    enabled: false,
    retired: true,
    name: 'Instruction Manual',
    tier: 3,
    trinket: 'use',
    // TODO(wyatt): "multi-slot" as T/U, T/M or U/M (not W).
    text: 'Add a trait slot: Trail, Utility or multi-slot (your choice).',
    use: { addSlot: ['T', 'U', 'T/U', 'T/M', 'U/M'] },
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
    name: 'Postcard',
    tier: 1,
    trinket: 'keep',
    // BALANCE.items.postcardXp is the doc's first guess (+5 a checkpoint, +1 a challenge).
    text: 'More XP from checkpoints and challenges.',
    hooks: {
      xpForSource: ({ source }) =>
        source === 'checkpoint'
          ? BALANCE.items.postcardXp.checkpoint
          : source === 'challenge'
            ? BALANCE.items.postcardXp.challenge
            : 0,
    },
  }),
  trinket({
    id: 'textbook',
    name: 'Textbook',
    tier: 1,
    trinket: 'keep',
    text: '+1 XP from every scavenge and craft.',
    // Action XP, so the row rule still applies; once a scavenge, even with a second card.
    hooks: {
      xpForSource: ({ source, repeat }) =>
        (source === 'scavenge' && !repeat) || source === 'craft' ? BALANCE.items.textbookXp : 0,
    },
  }),
  // ── Phase 10.7: trinkets that work from the pack and wear out (names are placeholders) ──
  trinket({
    id: 'fieldNotebook',
    name: 'Field Notebook',
    tier: 2,
    trinket: 'keep',
    art: null,
    placeholder: true,
    lasts: BALANCE.items.fieldNotebook.durability,
    wear: 'effect',
    text: `Double XP from scavenging. Wears out after ${BALANCE.items.fieldNotebook.durability} times.`,
    // Each doubling wears it by 1.
    hooksAt: (_v, item) => ({
      modifyXp: (q) =>
        q.source === 'scavenge'
          ? { source: 'Field Notebook', percent: BALANCE.items.fieldNotebook.xpPercent }
          : undefined,
      onXpGained: (e, ctx) => {
        if (e.source === 'scavenge' && e.xp > 0)
          ctx.wearItem(ctx.self, item.uid, 1, 'Field Notebook');
      },
    }),
  }),
  trinket({
    id: 'meritBadge',
    name: 'Merit Badge',
    tier: 2,
    trinket: 'keep',
    art: null,
    placeholder: true,
    lasts: BALANCE.items.meritBadge.durability,
    wear: 'phase',
    text: `+${BALANCE.items.meritBadge.xp} XP each time this hiker passes a challenge. Wears out after ${BALANCE.items.meritBadge.durability} phases.`,
    hooks: {
      xpForSource: ({ source }) => (source === 'challenge' ? BALANCE.items.meritBadge.xp : 0),
    },
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
