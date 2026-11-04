import { BALANCE } from '../../config/balance';
import { resourceCount } from '../inventory';
import { pushEvent } from '../log';
import type { DebugOp, GameState } from '../types';

/** Dev tools for the debug panel. They bypass the rules on purpose, and say so in the log. */
export function applyDebug(state: GameState, op: DebugOp): void {
  switch (op.kind) {
    case 'skipToPhase':
      state.phase = op.phase;
      for (const h of state.hikers) h.acted = false;
      pushEvent(state, { kind: 'debug', note: `Skipped to ${op.phase}` });
      break;
    case 'revealMap':
      for (const tile of Object.values(state.section.tiles)) {
        for (const node of tile.nodes) node.revealed = true;
      }
      pushEvent(state, { kind: 'debug', note: 'Revealed the map' });
      break;
    case 'giveResources': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      let room = BALANCE.inventory.resourceLimit - resourceCount(hiker);
      for (const [id, n] of Object.entries(op.resources)) {
        const add = Math.min(room, Math.max(0, n ?? 0));
        if (add <= 0) continue;
        hiker.inventory.resources[id] = (hiker.inventory.resources[id] ?? 0) + add;
        room -= add;
      }
      pushEvent(state, { kind: 'debug', note: `Gave ${hiker.name} resources` });
      break;
    }
  }
}
