import { BALANCE } from '../../config/balance';
import { CARDS } from '../../content/challenges';
import { CONDITIONS } from '../../content/conditions';
import { pickForTile } from '../challenges/pick';
import { openCard, revealCardOn } from '../challenges/reveal';
import { findableItems } from '../../content';
import { addCondition, removeCondition } from '../conditions';
import { STATE_FROM, changeWeather, setNodeState } from '../weather';
import { revealWonder, wonderTile } from '../wonders/wonders';
import { NIGHT_CREATURE_BY_ID } from '../../content/nightEvents';
import { runNightEvent } from '../night/nightEvents';
import { enterTile } from './common';
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
    case 'addCondition': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      // Allergies takes a node: this tile's first one, or Forest.
      const here = state.section.tiles[hiker.tileId]?.nodes
        .map((n) => n.type)
        .find((t): t is NodeType => t !== 'caps');
      const node = CONDITIONS[op.conditionId]?.takesNode ? (here ?? 'forest') : undefined;
      addCondition(state, hiker, op.conditionId, op.remaining, op.unit, 'the debug panel', {
        ...(node ? { node } : {}),
      });
      break;
    }
    case 'clearConditions': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      // Ending each one properly gives back what Sleepy and the like took.
      for (const c of [...hiker.conditions]) removeCondition(state, hiker, c.id);
      pushEvent(state, { kind: 'debug', note: `Cleared ${hiker.name}'s conditions` });
      break;
    }
    case 'openChallenge': {
      const card = CARDS[op.cardId];
      const here = state.hikers.filter((h) => h.tileId === op.tileId && h.status !== 'abandoned');
      if (!card || !here.length) return;
      delete state.challenge;
      const tier = card.tier;
      openCard(
        state,
        card,
        op.tileId,
        here.map((h) => h.id),
        { tier, scale: 1 },
      );
      pushEvent(state, { kind: 'debug', note: `Opened ${card.name}` });
      break;
    }
    case 'revealCard':
      revealCardOn(state, op.tileId, 'the debug panel');
      break;
    case 'revealWonder': {
      const tile = wonderTile(state);
      if (tile) revealWonder(state, tile.id, 'the debug panel');
      break;
    }
    case 'gatherAt': {
      const tile = state.section.tiles[op.tileId];
      if (!tile) return;
      for (const h of state.hikers) if (h.status !== 'abandoned') h.tileId = op.tileId;
      enterTile(state, op.tileId);
      if (tile.wonder) revealWonder(state, op.tileId, 'the debug panel');
      pushEvent(state, { kind: 'debug', note: `Put everyone on ${op.tileId}` });
      break;
    }
    case 'openSpace': {
      const tile = state.section.tiles[op.tileId];
      const here = state.hikers.filter((h) => h.tileId === op.tileId && h.status !== 'abandoned');
      if (!tile || !here.length) return;
      const picked = pickForTile(state, state.rng, { ...tile, special: op.space }, here);
      const card = picked && CARDS[picked.cardId];
      if (!picked || !card) return;
      delete state.challenge;
      openCard(
        state,
        card,
        op.tileId,
        here.map((h) => h.id),
        {
          ...picked,
          challengeSpace: op.space === 'challenge',
        },
      );
      pushEvent(state, { kind: 'debug', note: `Opened a ${op.space} space` });
      break;
    }
    case 'showRolls':
      if (op.on) state.debugRolls = true;
      else delete state.debugRolls;
      break;
    case 'setTier':
      state.section.tier = op.tier;
      pushEvent(state, { kind: 'debug', note: `Section tier ${op.tier}` });
      break;
    case 'setSnowy':
      if (op.on) state.snowy = true;
      else delete state.snowy;
      pushEvent(state, { kind: 'debug', note: `Snowy section ${op.on ? 'on' : 'off'}` });
      break;
    case 'setWeather':
      if (op.weather !== state.weather.today) changeWeather(state, op.weather);
      if (op.hold) state.weather.hold = true;
      else delete state.weather.hold;
      pushEvent(state, {
        kind: 'debug',
        note: `Weather: ${op.weather}${op.hold ? ', holding' : ''}`,
      });
      break;
    case 'skipGraceDay':
      state.weather.since = state.day - 1;
      pushEvent(state, { kind: 'debug', note: 'Skipped the weather’s grace day' });
      break;
    case 'nodeState': {
      const node = state.section.tiles[op.tileId]?.nodes.find(
        (n) => !n.weather && n.type === STATE_FROM[op.state],
      );
      if (!node) return;
      setNodeState(node, op.state);
      pushEvent(state, { kind: 'nodesChanged', state: op.state, tiles: [op.tileId] });
      break;
    }
    case 'wearClothes': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const slot = (['body', 'feet', 'gear'] as const).find((s) => !hiker?.inventory.equipped[s]);
      const clothes =
        findableItems('clothes').find((i) => i.slot === slot) ?? findableItems('clothes')[0];
      if (!hiker || !slot || !clothes) return;
      hiker.inventory.equipped[slot] = { uid: `debug-${state.nextEventId}`, itemId: clothes.id };
      pushEvent(state, { kind: 'debug', note: `${hiker.name} put on ${clothes.name}` });
      break;
    }
    case 'forceNight': {
      const next = {
        ...(op.tier ? { tier: op.tier } : {}),
        ...(op.creatureId ? { creatureId: op.creatureId } : {}),
        ...(op.hit ? { hit: op.hit } : {}),
      };
      if (Object.keys(next).length) state.debugNight = next;
      else delete state.debugNight;
      const creature = op.creatureId ? NIGHT_CREATURE_BY_ID[op.creatureId]?.name : undefined;
      const hiker = op.hit ? state.hikers.find((h) => h.id === op.hit)?.name : undefined;
      const parts = [
        op.tier && !creature ? `Tier ${op.tier}` : '',
        creature ?? '',
        hiker ? `hits ${hiker}` : '',
      ].filter(Boolean);
      pushEvent(state, {
        kind: 'debug',
        note: parts.length
          ? `Tonight’s night event: ${parts.join(', ')}`
          : 'Night event: back to random',
      });
      break;
    }
    case 'runNight':
      runNightEvent(state);
      break;
    case 'setChallenges':
      if (op.on) delete state.noChallenges;
      else state.noChallenges = true;
      pushEvent(state, { kind: 'debug', note: `Challenges ${op.on ? 'on' : 'off'}` });
      break;
    case 'setAbundance': {
      for (const [node, value] of Object.entries(op.abundance) as [NodeType, number][]) {
        state.abundance[node] = Math.min(BALANCE.abundance.max, Math.max(0, Math.round(value)));
      }
      pushEvent(state, { kind: 'debug', note: 'Set Abundance' });
      break;
    }
  }
}
