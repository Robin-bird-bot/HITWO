/**
 * The Proper Way (Phase 10.7, 09-hikers.md): tools in that hiker's pack have
 * 1 more use. The extra use is counted in the tool's uses and marked on it;
 * when the tool leaves the pack (given, traded, sold), the mark and the use
 * come off. Checked after every action, so it follows the tools wherever
 * they go.
 */
import { ITEMS } from '../../content/items';
import { BALANCE } from '../../config/balance';
import { hikerHas } from '../effects';
import { pushEvent } from '../log';
import type { GameState, Hiker, ItemInstance } from '../types';
import { noteGone } from './gone';
import { fullCounters, qualityOf } from './make';
import { removeItem } from './wear';

const EXTRA = BALANCE.trails.properWay.uses;

const carried = (h: Hiker): ItemInstance[] => [
  ...h.inventory.bag,
  ...Object.values(h.inventory.equipped).filter((i): i is ItemInstance => !!i),
];

export function syncExtraUses(state: GameState): void {
  for (const h of state.hikers) {
    const proper = h.status !== 'abandoned' && hikerHas(state, h, 'extraToolUse');
    for (const item of carried(h)) {
      const def = ITEMS[item.itemId];
      if (def?.type !== 'tool' || !!item.extraUse === proper) continue;
      const uses = item.usesLeft ?? fullCounters(def, qualityOf(item)).usesLeft ?? 1;
      if (proper) {
        item.usesLeft = uses + EXTRA;
        item.extraUse = true;
        continue;
      }
      // It left the pack: the extra use is lost.
      delete item.extraUse;
      item.usesLeft = Math.max(0, uses - EXTRA);
      if (item.usesLeft > 0) continue;
      removeItem(h, item.uid);
      noteGone(state, item.itemId);
      pushEvent(state, {
        kind: 'itemGone',
        hikerId: h.id,
        itemId: item.itemId,
        why: 'used',
        cause: 'The Proper Way',
      });
    }
  }
}
