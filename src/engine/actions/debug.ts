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
  }
}
