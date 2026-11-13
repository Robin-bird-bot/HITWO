/**
 * Built-in family traits (docs/design/02-traits-and-conditions.md, "Families").
 * Always on, no slot. They plug into engine hooks like any trait.
 */
import { BALANCE } from '../config/balance';
import type { FamilyDef } from '../engine/effects';
import type { Family } from '../engine/types';

const FREE = { percent: -100 };

export const FAMILIES: Readonly<Record<Family, FamilyDef>> = {
  human: { name: 'Human', hooks: {} },

  // "+1 card to choose from when scavenging" (Wyatt, Nov 4). Crafts lower-quality items:
  // less Luck for Quality (BALANCE.items.craft.dogLuck).
  dog: {
    name: 'Dog',
    hooks: {
      modifyScavenge: () => ({
        source: 'Dog',
        label: 'Dog: 1 extra card to choose from',
        tone: 'bonus',
        cards: 1,
      }),
      modifyCraft: () => ({
        source: 'Dog',
        label: `Dog: ${BALANCE.items.craft.dogLuck} Luck for Quality`,
        tone: 'warning',
        luck: BALANCE.items.craft.dogLuck,
      }),
    },
  },

  // "Moving costs no Appetite, alone or with the group. −1 item slot."
  // With the group (Wyatt, Nov 3): a Cat's own crossing is free and bringing a Cat
  // along is free, but a Cat leading a Move All still pays for the others it brings.
  cat: {
    name: 'Cat',
    hooks: {
      modifyCost(q, ctx) {
        if (q.subjectId !== ctx.self.id) return undefined;
        if (q.key === 'move.appetite' || q.key === 'moveAll.perHiker') {
          return { source: 'Cat', ...FREE };
        }
        return undefined;
      },
      modifyCapacity(q) {
        return q.key === 'bag.slots' ? { source: 'Cat', flat: -1 } : undefined;
      },
    },
  },
};
