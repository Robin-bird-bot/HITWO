import { rollTrailShop } from '../station/trail';
import { openLevelUpFor } from '../traits/levelUp';
import { addPartyXp, levelForXp } from '../xp';
import { hasLearned, learnStep, treesOf } from '../trails';
import { STATION_THEME_BY_ID } from '../../content/stations';
import { noteGone } from '../items/gone';
import { checkInArrivals } from '../station/checkIn';
import { rollStock } from '../station/stock';
import { fullCounters, makeItem, qualityOf } from '../items/make';
import { makePresent } from '../items/presents';
import { presentName } from '../../content/items/presents';
import { rollWishLists } from '../items/wishLists';
import { BALANCE } from '../../config/balance';
import { CARDS } from '../../content/challenges';
import { CONDITIONS } from '../../content/conditions';
import { pickForTile } from '../challenges/pick';
import { openCard, revealCardOn } from '../challenges/reveal';
import { ITEMS, findableItems } from '../../content';
import { addCondition, removeCondition } from '../conditions';
import { changeWeather } from '../weather';
import { craftableItems } from '../../content/items';
import { dealCards } from '../scavenge/deal';
import { scavengeSetup } from '../scavenge/setup';
import { revealWonder, wonderTile } from '../wonders/wonders';
import { NIGHT_CREATURE_BY_ID } from '../../content/nightEvents';
import { runNightEvent } from '../night/nightEvents';
import { enterTile } from './common';
import { passOut, wakeUp } from '../health';
import { resourceCount, resourceLimit } from '../inventory';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import type { DebugOp, GameState, ItemInstance, NodeType } from '../types';
import { canAddSlot } from '../traits/slots';
import { setDaily } from '../traits/daily';

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
      let room = resourceLimit(state, hiker) - resourceCount(hiker);
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
        hiker.injuries = Math.min(BALANCE.injuries.passOutAt, Math.max(0, op.injuries));
        const out = hiker.injuries >= BALANCE.injuries.passOutAt;
        if (out) passOut(state, hiker);
        else wakeUp(state, hiker, 'debug');
      }
      pushEvent(state, { kind: 'debug', note: `Set ${hiker.name}'s stats` });
      break;
    }
    case 'setTrait': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const slot = hiker?.slots[op.slot];
      if (!hiker || !slot) return;
      slot.traitId = op.traitId;
      delete slot.daily;
      if (op.setting && (op.setting.x || op.setting.y)) slot.setting = { ...op.setting };
      else delete slot.setting;
      pushEvent(state, { kind: 'debug', note: `Set ${hiker.name}'s slot ${op.slot + 1}` });
      break;
    }
    case 'addSlot': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker || !canAddSlot(hiker)) return;
      hiker.slots.push({ type: op.slotType, traitId: null });
      pushEvent(state, { kind: 'debug', note: `Gave ${hiker.name} a ${op.slotType} slot` });
      break;
    }
    case 'removeSlot': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker?.slots[op.slot]) return;
      hiker.slots.splice(op.slot, 1);
      pushEvent(state, { kind: 'debug', note: `Took slot ${op.slot + 1} from ${hiker.name}` });
      break;
    }
    case 'setXp': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      hiker.xp = Math.max(0, Math.floor(op.xp));
      if (op.level !== undefined) hiker.level = Math.max(0, Math.floor(op.level));
      // Levels the XP reaches past the hiker's level wait for the next camp step.
      const pending = Math.max(0, levelForXp(hiker.xp) - hiker.level);
      if (pending) hiker.pendingLevels = pending;
      else delete hiker.pendingLevels;
      pushEvent(state, {
        kind: 'debug',
        note: `Set ${hiker.name} to ${hiker.xp} XP, level ${hiker.level}${pending ? ` (${pending} to pick at camp)` : ''}`,
      });
      break;
    }
    // Skill Trails (Phase 10.7).
    case 'partyXp': {
      addPartyXp(state, Math.max(0, Math.floor(op.xp)));
      pushEvent(state, { kind: 'debug', note: `+${op.xp} party XP` });
      break;
    }
    case 'partyPoints': {
      const party = (state.party ??= { xp: 0, level: 0, points: 0 });
      party.points = Math.max(0, party.points + Math.floor(op.points));
      pushEvent(state, { kind: 'debug', note: `+${op.points} point${op.points === 1 ? '' : 's'}` });
      break;
    }
    case 'learnAll': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const trees = hiker && treesOf(hiker);
      if (!hiker || !trees) return;
      // Every step, in tree order, without points (a gift gives its things).
      for (const tree of trees.trees) {
        for (const step of tree.steps) {
          if (!hasLearned(hiker, step.id)) learnStep(state, hiker, step.id, { start: true });
        }
      }
      pushEvent(state, { kind: 'debug', note: `${hiker.name} learned every step` });
      break;
    }
    case 'setMoraleType': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      hiker.moraleType = op.moraleType;
      pushEvent(state, { kind: 'debug', note: `${hiker.name} is ${op.moraleType} now` });
      break;
    }
    case 'levelUpNow': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      // A level-up right now, in place of anything being picked.
      hiker.pendingLevels = (hiker.pendingLevels ?? 0) + 1;
      delete state.traitPick;
      openLevelUpFor(state, hiker, op.tier);
      pushEvent(state, {
        kind: 'debug',
        note: `Level-up for ${hiker.name} now, with Tier ${op.tier} options`,
      });
      break;
    }
    case 'refillUses': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      // Uses and once-a-while rules are counted in abilityUses; clearing it brings them all back.
      hiker.abilityUses = {};
      pushEvent(state, { kind: 'debug', note: `Refilled ${hiker.name}'s trait uses` });
      break;
    }
    case 'setDayParity': {
      if ((state.day % 2 === 1) !== op.odd) state.day += 1;
      pushEvent(state, {
        kind: 'debug',
        note: `Now day ${state.day} (${op.odd ? 'odd' : 'even'})`,
      });
      break;
    }
    case 'setDaily': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const slot = hiker?.slots[op.slot];
      if (!hiker || !slot?.traitId) return;
      setDaily(state, hiker, slot, op.pick);
      pushEvent(state, {
        kind: 'debug',
        note: `${hiker.name}'s slot ${op.slot + 1} is ${op.pick} today`,
      });
      break;
    }
    case 'edgeScavenge': {
      // The edge test: a scavenge with exactly this many cards, on any tile.
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      const setup = scavengeSetup(state, hiker);
      const nodes = setup.nodes.length
        ? setup.nodes
        : [{ type: 'forest' as const, revealed: true }];
      delete state.crafting;
      state.scavenge = {
        hikerId: hiker.id,
        tileId: hiker.tileId,
        cards: dealCards(state.rng, { ...setup, nodes, count: op.count }),
        luck: setup.luck,
        bonuses: setup.bonuses,
        rngBefore: [...state.rng] as typeof state.rng,
      };
      pushEvent(state, { kind: 'debug', note: `Edge test: a scavenge with ${op.count} cards` });
      break;
    }
    case 'edgeCraft': {
      // The edge test: a craft deal with this many cards.
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      const pool = craftableItems('tool', 1);
      delete state.scavenge;
      state.crafting = {
        hikerId: hiker.id,
        type: 'tool',
        options: Array.from({ length: op.count }, (_, i) => ({
          itemId: pool[i % Math.max(1, pool.length)]?.id ?? 'shovel',
          quality: 3 as const,
        })),
        paid: [],
      };
      pushEvent(state, { kind: 'debug', note: `Edge test: a craft deal with ${op.count} cards` });
      break;
    }
    case 'setDifficulty':
      state.difficulty = op.difficulty;
      pushEvent(state, {
        kind: 'debug',
        note: `Difficulty: ${op.difficulty} (from the next section)`,
      });
      break;
    case 'addShelter': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker || ITEMS[op.itemId]?.type !== 'shelter') return;
      const item = makeItem(state, op.itemId, { prefix: 'debug' });
      item.deploymentsLeft = Math.max(0, Math.round(op.deployments));
      hiker.inventory.bag.push(item);
      pushEvent(state, { kind: 'debug', note: `${ITEMS[op.itemId]?.name} for ${hiker.name}` });
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
    case 'nearCheckpoint': {
      const near = adjacentTileIds(state.section, state.section.checkpointId).find(
        (id) => state.section.tiles[id]?.kind === 'normal',
      );
      if (!near) return;
      for (const h of state.hikers) {
        if (h.status === 'active' || h.status === 'passedOut') h.tileId = near;
      }
      enterTile(state, near);
      pushEvent(state, { kind: 'debug', note: 'Put everyone one move from the checkpoint' });
      break;
    }
    case 'sectionIndex': {
      const biomes = BALANCE.run.biomes;
      state.sectionIndex = Math.max(0, Math.min(biomes.length - 1, op.index));
      state.section.biome = biomes[state.sectionIndex] ?? state.section.biome;
      pushEvent(state, { kind: 'debug', note: `Section ${state.sectionIndex + 1}` });
      break;
    }
    case 'nextStationTheme':
      state.debugNextTheme = op.themeId;
      pushEvent(state, { kind: 'debug', note: `Next station: ${op.themeId}` });
      break;
    case 'openStation': {
      if (state.station || state.summit) return;
      if (op.themeId) state.debugNextTheme = op.themeId;
      const checkpoint = state.section.checkpointId;
      const arriving = state.hikers.filter(
        (h) => h.status === 'active' || h.status === 'passedOut',
      );
      for (const h of arriving) h.tileId = checkpoint;
      enterTile(state, checkpoint);
      checkInArrivals(
        state,
        arriving.map((h) => h.id),
        checkpoint,
      );
      pushEvent(state, { kind: 'debug', note: 'Everyone checked in' });
      break;
    }
    case 'rerollStation': {
      const theme = state.station && STATION_THEME_BY_ID[state.station.themeId];
      if (!state.station || !theme) return;
      const fresh = rollStock(state, theme, state.station.checkpoint);
      // A visit with no special this time drops the old one.
      delete state.station.special;
      Object.assign(state.station, fresh);
      pushEvent(state, { kind: 'debug', note: 'Rerolled the station' });
      break;
    }
    case 'setFeature': {
      const tile = state.section.tiles[op.tileId];
      if (!tile || tile.kind !== 'normal') return;
      tile.feature = op.feature;
      delete tile.shop;
      if (state.hikers.some((h) => h.tileId === tile.id && h.status === 'active')) {
        rollTrailShop(state, tile);
      }
      pushEvent(state, { kind: 'debug', note: `A ${op.feature} on ${op.tileId}` });
      break;
    }
    case 'giveCaps':
      state.caps = Math.max(0, state.caps + op.caps);
      pushEvent(state, { kind: 'debug', note: `Gave the party ${op.caps} caps` });
      break;
    case 'noteGone': {
      if (!ITEMS[op.itemId]) return;
      for (let i = 0; i < (op.times ?? 1); i++) noteGone(state, op.itemId);
      pushEvent(state, { kind: 'debug', note: `${ITEMS[op.itemId]?.name} used up or lost` });
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
    case 'wearClothes': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const slot = (['body', 'feet', 'gear'] as const).find((s) => !hiker?.inventory.equipped[s]);
      const clothes =
        findableItems('clothes').find((i) => i.slot === slot) ?? findableItems('clothes')[0];
      if (!hiker || !slot || !clothes) return;
      hiker.inventory.equipped[slot] = makeItem(state, clothes.id, { prefix: 'debug', quality: 3 });
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
    case 'giveItem': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const item = ITEMS[op.itemId];
      if (!hiker || !item) return;
      hiker.inventory.bag.push(
        makeItem(state, item.id, {
          prefix: 'debug',
          ...(op.quality ? { quality: op.quality } : {}),
        }),
      );
      pushEvent(state, { kind: 'debug', note: `Gave ${hiker.name} ${item.name}` });
      break;
    }
    case 'setCraftTier': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      const tier = Math.max(1, Math.min(BALANCE.items.craft.maxTier, Math.round(op.tier)));
      hiker.craftTier = { ...hiker.craftTier, [op.itemType]: tier };
      pushEvent(state, {
        kind: 'debug',
        note: `${hiker.name} crafts ${op.itemType} at Tier ${tier}`,
      });
      break;
    }
    case 'givePresent': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      const colorway = Math.min(BALANCE.presents.colorways, Math.max(1, Math.round(op.colorway)));
      hiker.inventory.bag.push(makePresent(state, op.grade, { colorway, prefix: 'debug' }));
      pushEvent(state, { kind: 'debug', note: `Gave ${hiker.name} a ${presentName(op.grade)}` });
      break;
    }
    case 'setWishLists': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      hiker.wishLists = op.lists
        ? { small: [...op.lists.small], big: [...op.lists.big] }
        : rollWishLists(state.rng);
      pushEvent(state, {
        kind: 'debug',
        note: `${hiker.name}’s wish lists ${op.lists ? 'set' : 'rolled again'}`,
      });
      break;
    }
    case 'learnBlueprint': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      const item = ITEMS[op.itemId];
      if (!hiker || !item || (hiker.blueprints ?? []).includes(item.id)) return;
      hiker.blueprints = [...(hiker.blueprints ?? []), item.id];
      pushEvent(state, { kind: 'debug', note: `${hiker.name} learned the ${item.name} blueprint` });
      break;
    }
    case 'refillItems': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (!hiker) return;
      const refill = (i: ItemInstance) => {
        const def = ITEMS[i.itemId];
        if (def) Object.assign(i, fullCounters(def, qualityOf(i)));
      };
      hiker.inventory.bag.forEach(refill);
      for (const i of Object.values(hiker.inventory.equipped)) if (i) refill(i);
      pushEvent(state, { kind: 'debug', note: `Refilled ${hiker.name}’s items` });
      break;
    }
    case 'setCountdown': {
      const hiker = state.hikers.find((h) => h.id === op.hikerId);
      if (hiker?.status !== 'passedOut') return;
      hiker.countdown = Math.max(1, Math.round(op.nights));
      pushEvent(state, { kind: 'debug', note: `${hiker.name}’s countdown: ${hiker.countdown}` });
      break;
    }
    case 'setChallenges':
      if (op.on) delete state.noChallenges;
      else state.noChallenges = true;
      pushEvent(state, { kind: 'debug', note: `Challenges ${op.on ? 'on' : 'off'}` });
      break;
    case 'setAbundance': {
      state.abundance = Math.min(BALANCE.abundance.max, Math.max(0, Math.round(op.abundance)));
      pushEvent(state, { kind: 'debug', note: 'Set Abundance' });
      break;
    }
  }
}
