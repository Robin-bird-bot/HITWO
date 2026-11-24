/**
 * Morale types (docs/design/09-hikers.md, "Morale types"; Phase 10.7): each
 * hiker has one, checked at the end of every phase for +1, −1 or nothing.
 * They replace the Morale traits. Thresholds are in BALANCE.moraleTypes;
 * counts include the hiker. The rules run in src/engine/morale.ts.
 */
import { BALANCE } from '../config/balance';
import type { MoraleTypeId } from '../engine/types';

const M = BALANCE.moraleTypes;

export interface MoraleTypeDef {
  id: MoraleTypeId;
  name: string;
  /** When it gives +1, and −1, in a few words (the hover and the legend). */
  up: string;
  down: string;
}

export const MORALE_TYPES: Readonly<Record<MoraleTypeId, MoraleTypeDef>> = {
  extrovert: {
    id: 'extrovert',
    name: 'Extrovert',
    up: `${M.crowd} or more hikers on the tile`,
    down: 'Alone',
  },
  introvert: {
    id: 'introvert',
    name: 'Introvert',
    up: 'Alone',
    down: `${M.crowd} or more hikers on the tile`,
  },
  ambivert: {
    id: 'ambivert',
    name: 'Ambivert',
    up: `2 or ${M.bigGroup - 1} hikers on the tile`,
    down: `Alone, or ${M.bigGroup} or more`,
  },
  foody: {
    id: 'foody',
    name: 'Foody',
    up: `Appetite ${M.high} or more`,
    down: `Appetite ${M.low} or less`,
  },
  energetic: {
    id: 'energetic',
    name: 'Energetic',
    up: `Energy ${M.high} or more`,
    down: `Energy ${M.low} or less`,
  },
  wanderlust: { id: 'wanderlust', name: 'Wanderlust', up: 'Moved this phase', down: 'Didn’t move' },
  homebody: { id: 'homebody', name: 'Homebody', up: 'Didn’t move this phase', down: 'Moved' },
};

/** "+1: 3 or more hikers on the tile. −1: Alone." */
export const moraleRule = (def: MoraleTypeDef): string => `+1: ${def.up}. −1: ${def.down}.`;
