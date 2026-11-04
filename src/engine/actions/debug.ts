import { BALANCE } from '../../config/balance';
import { resourceCount } from '../inventory';
import { pushEvent } from '../log';
import type { DebugOp, GameState, NodeType } from '../types';

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
    case 'setStats': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      const { min, max } = BALANCE.stats;
      for (const [stat, value] of Object.entries(op.stats)) {
        if (typeof value === 'number') {
          hiker.stats[stat as keyof typeof hiker.stats] = Math.min(max, Math.max(min, value));
        }
      }
      if (op.injuries !== undefined) {
        hiker.injuries = Math.max(0, op.injuries);
        const out = hiker.injuries >= BALANCE.injuries.passOutAt;
        if (out && hiker.status === 'active') hiker.status = 'passedOut';
        if (!out && hiker.status === 'passedOut') hiker.status = 'active';
      }
      pushEvent(state, { kind: 'debug', note: `Set ${hiker.name}'s stats` });
      break;
    }
    case 'setTrait': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const slot = hiker?.slots[op.slot];
      if (!hiker || !slot) return;
      slot.traitId = op.traitId;
      pushEvent(state, { kind: 'debug', note: `Set ${hiker.name}'s slot ${op.slot + 1}` });
      break;
    }
    case 'nextDeal': {
      if (op.types.length) state.debugDeal = [...op.types];
      else delete state.debugDeal;
      pushEvent(state, { kind: 'debug', note: `Next deal: ${op.types.join(', ') || 'random'}` });
      break;
    }
    case 'setAbundance': {
      for (const [node, value] of Object.entries(op.abundance) as [NodeType, number][]) {
        state.abundance[node] = Math.min(BALANCE.abundance.max, Math.max(0, Math.round(value)));
      }
      pushEvent(state, { kind: 'debug', note: 'Set Abundance' });
      break;
    }
  }
}
