/**
 * Wonders (04-challenges.md, "Wonders"; Nov 6 update, 3).
 *
 * - Every section has one Wonder tile, with no nodes. It never draws a card.
 * - Revealing it (landing there, or an early reveal) picks 3 of its 5 goals,
 *   leaving out goals that need a later system, scales their numbers by
 *   biome, and rolls the 3 Tier III items for "pick 1 of 3".
 * - Goals are checked live by `wonderProgress`, against only the hikers on
 *   the tile. When all 3 are met, `accomplishWonder` gives each of those
 *   hikers the reward they picked, and the Wonder is done for good.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS, TIER_3_ITEMS, findableItems } from '../../content';
import { CONDITIONS, POSITIVE_CONDITIONS } from '../../content/conditions';
import { RESOURCE_BY_ID } from '../../content/resources';
import { WEATHERS } from '../../content/weather';
import { WONDER_BY_ID } from '../../content/wonders';
import { changeAbundance } from '../abundance';
import { revealCardOn } from '../challenges/reveal';
import { addCondition, removeCondition } from '../conditions';
import { bagSlots, resourceCount } from '../inventory';
import { pushEvent } from '../log';
import { hikersOnTile } from '../map';
import { pick, shuffle } from '../rng';
import { changeStat, statMax } from '../stats';
import { isExhausted, isFatigued } from '../thresholds';
import {
  NODE_TYPES,
  STAT_NAMES,
  type Action,
  type GameState,
  type Hiker,
  type HikerId,
  type Tile,
  type TileId,
} from '../types';
import type { GoalNumber, WonderDef, WonderGoalDef, WonderPick, WonderState } from './types';

type AccomplishAction = Extract<Action, { type: 'accomplishWonder' }>;

/** How many goals a revealed Wonder shows. */
export const GOALS_SHOWN = 3;

/** The tile holding this section's Wonder. */
export function wonderTile(state: GameState): Tile | undefined {
  return Object.values(state.section.tiles).find((t) => t.wonder);
}

export const isRevealed = (w: WonderState | undefined): boolean => !!w?.goals;
export const isAccomplished = (w: WonderState | undefined): boolean => !!w?.claimed;

/** Can this goal be picked yet? Goals waiting on a later system can't. */
export const goalPlayable = (g: WonderGoalDef): boolean =>
  !g.waitingOn && g.check.kind !== 'waiting';

/** A goal's number in a biome (0 = the first): later biomes ask for more (or, for "at most", less). */
export function scaledNumber(x: GoalNumber, biomeIndex: number): number {
  if (x.scales === false || biomeIndex <= 0) return x.base;
  const f = BALANCE.wonders.biomeScale ** biomeIndex;
  const down = x.compare === 'atMost' || x.compare === 'lessThan';
  return Math.max(0, Math.round(down ? x.base / f : x.base * f));
}

/**
 * Reveals the Wonder on a tile: picks its goals and Tier III items, and logs
 * it (the pop-up opens from that). `cause` is how, when nobody landed there.
 * Returns false if there's no hidden Wonder here.
 */
export function revealWonder(state: GameState, tileId: TileId, cause?: string): boolean {
  const w = state.section.tiles[tileId]?.wonder;
  const def = w && WONDER_BY_ID[w.id];
  if (!w || !def || isRevealed(w)) return false;
  const playable = def.goals.flatMap((g, index) => (goalPlayable(g) ? [{ g, index }] : []));
  const chosen = shuffle(state.rng, playable)
    .slice(0, GOALS_SHOWN)
    .sort((a, b) => a.index - b.index);
  w.goals = chosen.map(({ g, index }) =>
    g.x ? { index, x: scaledNumber(g.x, state.sectionIndex) } : { index },
  );
  w.tier3 = shuffle(state.rng, TIER_3_ITEMS).slice(0, 3);
  pushEvent(state, { kind: 'wonderRevealed', tileId, wonderId: w.id, ...(cause ? { cause } : {}) });
  return true;
}

// ── Goals ──────────────────────────────────────────────────────────────────

export interface GoalProgress {
  /** Index into the Wonder's 5 goals. */
  index: number;
  def: WonderGoalDef;
  /** The scaled number, if the goal has one. */
  x?: number;
  met: boolean;
  /** A short readout, like "7/6". */
  readout?: string;
  /** For goals about each hiker or one hiker: who meets it. */
  hikers?: { hikerId: HikerId; ok: boolean }[];
}

export interface WonderProgress {
  tileId: TileId;
  def: WonderDef;
  wonder: WonderState;
  /** The hikers on the tile who count (and who pick rewards). */
  here: Hiker[];
  goals: GoalProgress[];
  met: number;
  allMet: boolean;
  accomplished: boolean;
}

function compare(value: number, x: number, how: GoalNumber['compare']): boolean {
  switch (how) {
    case 'atLeast':
      return value >= x;
    case 'atMost':
      return value <= x;
    case 'moreThan':
      return value > x;
    case 'lessThan':
      return value < x;
  }
}

const carried = (h: Hiker, id: string) => h.inventory.resources[id] ?? 0;

function itemsOfType(h: Hiker, type: string): number {
  const all = [...h.inventory.bag, ...Object.values(h.inventory.equipped)];
  return all.filter((i) => i && ITEMS[i.itemId]?.type === type).length;
}

/** A hiker's level from their XP (Phase 10 does leveling up properly). */
export function levelOf(h: Hiker): number {
  const reached = BALANCE.xp.levelAt.filter((need) => h.xp >= need).length;
  return Math.max(h.level, reached);
}

function nodeOf(resource: string) {
  return RESOURCE_BY_ID.get(resource)?.node;
}

/** One goal against the hikers here. */
function checkGoal(
  state: GameState,
  def: WonderGoalDef,
  x: number | undefined,
  here: Hiker[],
): Omit<GoalProgress, 'index' | 'def' | 'x'> {
  const n = x ?? 0;
  const how = def.x?.compare ?? 'atLeast';
  const anyone = here.length > 0;
  const total = (value: number) => ({
    met: anyone && compare(value, n, how),
    readout: `${value}/${n}`,
  });
  /** A goal one hiker here must meet. A numbered one reads out the best so far. */
  const one = (score: (h: Hiker) => number, ok: (h: Hiker) => boolean) => {
    const hikers = here.map((h) => ({ hikerId: h.id, ok: ok(h) }));
    const best = here.reduce((m, h) => Math.max(m, score(h)), 0);
    const met = hikers.some((h) => h.ok);
    return x === undefined ? { met, hikers } : { met, readout: `${best}/${n}`, hikers };
  };
  /** A goal every hiker here must meet. */
  const each = (ok: (h: Hiker) => boolean) => {
    const hikers = here.map((h) => ({ hikerId: h.id, ok: ok(h) }));
    const good = hikers.filter((h) => h.ok).length;
    return { met: anyone && good === here.length, readout: `${good}/${here.length}`, hikers };
  };

  const c = def.check;
  switch (c.kind) {
    case 'carryAny':
      return total(
        here.reduce((s, h) => s + c.resources.reduce((t, r) => t + carried(h, r), 0), 0),
      );
    case 'carryTotal':
      return total(here.reduce((s, h) => s + resourceCount(h), 0));
    case 'oneCarriesOne': {
      const best = (h: Hiker) =>
        (c.resources ?? Object.keys(h.inventory.resources)).reduce(
          (m, r) => Math.max(m, carried(h, r)),
          0,
        );
      return one(best, (h) => compare(best(h), n, how));
    }
    case 'oneCarriesEachNode': {
      const least = (h: Hiker) =>
        Math.min(
          ...NODE_TYPES.map((node) =>
            Object.entries(h.inventory.resources).reduce(
              (t, [r, v]) => t + (nodeOf(r) === node ? (v ?? 0) : 0),
              0,
            ),
          ),
        );
      return one(least, (h) => least(h) >= n);
    }
    case 'eachCarries':
      return each((h) => compare(carried(h, c.resource), n, how));
    case 'conditions':
      return total(
        here.reduce(
          (s, h) => s + h.conditions.filter((k) => CONDITIONS[k.id]?.kind === c.which).length,
          0,
        ),
      );
    case 'statTotal':
      return total(here.reduce((s, h) => s + h.stats[c.stat], 0));
    case 'eachStat':
      return each((h) => compare(h.stats[c.stat], n, how));
    case 'sameStat': {
      const values = here.map((h) => h.stats[c.stat]);
      return {
        met: anyone && values.every((v) => v === values[0]),
        readout: values.join(' · ') || '—',
      };
    }
    case 'spread': {
      const low = here.filter((h) => h.stats[c.stat] <= c.low);
      const high = here.filter((h) => h.stats[c.stat] >= c.high);
      const met = low.some((l) => high.some((h) => h.id !== l.id));
      return {
        met,
        hikers: here.map((h) => ({
          hikerId: h.id,
          ok: h.stats[c.stat] <= c.low || h.stats[c.stat] >= c.high,
        })),
      };
    }
    case 'fullStats':
      return one(
        (h) => STAT_NAMES.filter((s) => h.stats[s] >= statMax(state, h, s)).length,
        (h) => STAT_NAMES.every((s) => h.stats[s] >= statMax(state, h, s)),
      );
    case 'noInjuries':
      return each((h) => h.injuries === 0);
    case 'caps':
      return { met: compare(state.caps, n, how), readout: `${state.caps}/${n}` };
    case 'abundance': {
      const value = state.abundance[c.node];
      return { met: compare(value, n, how), readout: `${value}/${n}` };
    }
    case 'itemsOfType':
      return total(here.reduce((s, h) => s + itemsOfType(h, c.type), 0));
    case 'counter': {
      const of = (h: Hiker) => state.counters[c.counter][h.id] ?? 0;
      return one(of, (h) => compare(of(h), n, how));
    }
    case 'sheltersPlaced': {
      const value = state.counters.sheltersPlaced[state.sectionIndex] ?? 0;
      return { met: compare(value, n, how), readout: `${value}/${n}` };
    }
    case 'hikersHere':
      return total(here.length);
    case 'level':
      return one(levelOf, (h) => compare(levelOf(h), n, how));
    case 'eachThreshold':
      return each((h) => c.states.some((s) => (s === 'fatigued' ? isFatigued(h) : isExhausted(h))));
    case 'oneHasCondition': {
      const has = (h: Hiker) => h.conditions.some((k) => c.conditions.includes(k.id));
      return one(
        (h) => (has(h) ? 1 : 0),
        (h) => has(h),
      );
    }
    case 'weatherActive': {
      const today = WEATHERS[state.weather.today];
      return { met: state.weather.today !== 'clear', readout: today.name.toUpperCase() };
    }
    case 'waiting':
      return { met: false };
  }
}

/** How a revealed Wonder stands right now, against the hikers on its tile. */
export function wonderProgress(state: GameState, tileId: TileId): WonderProgress | undefined {
  const wonder = state.section.tiles[tileId]?.wonder;
  const def = wonder && WONDER_BY_ID[wonder.id];
  if (!wonder || !def || !wonder.goals) return undefined;
  const here = hikersOnTile(state, tileId);
  const goals = wonder.goals.flatMap(({ index, x: stored }): GoalProgress[] => {
    const g = def.goals[index];
    if (!g) return [];
    const x = stored ?? (g.x ? scaledNumber(g.x, state.sectionIndex) : undefined);
    return [{ index, def: g, ...(x !== undefined ? { x } : {}), ...checkGoal(state, g, x, here) }];
  });
  const met = goals.filter((g) => g.met).length;
  return {
    tileId,
    def,
    wonder,
    here,
    goals,
    met,
    allMet: goals.length > 0 && met === goals.length,
    accomplished: isAccomplished(wonder),
  };
}

// ── Accomplishing ──────────────────────────────────────────────────────────

/** Free bag slots. */
function bagRoom(state: GameState, h: Hiker): number {
  return bagSlots(state, h).total - h.inventory.bag.length;
}

/** Why this hiker can't take this reward, if they can't (other hikers' picks aside). */
export function pickProblem(
  state: GameState,
  p: WonderProgress,
  h: Hiker,
  choice: WonderPick,
): string | undefined {
  const r = p.def.rewards[choice.reward];
  if (!r) return 'Pick one of the 3 rewards.';
  if (r.waitingOn || r.reward.kind === 'waiting') {
    return `${r.title} comes later (${r.waitingOn ?? 'a later phase'}).`;
  }
  switch (r.reward.kind) {
    case 'tier3':
      if (!choice.itemId || !p.wonder.tier3?.includes(choice.itemId)) {
        return 'Pick one of the 3 Tier III items.';
      }
      if (bagRoom(state, h) < 1) return `${h.name}’s bag is full.`;
      return undefined;
    case 'shelters':
      if (bagRoom(state, h) < r.reward.count) {
        return `${h.name} needs ${r.reward.count} free bag slots for this.`;
      }
      return undefined;
    case 'abundance':
      return choice.node && NODE_TYPES.includes(choice.node) ? undefined : 'Pick a node type.';
    default:
      return undefined;
  }
}

export function validateAccomplish(state: GameState, action: AccomplishAction): string | undefined {
  const p = wonderProgress(state, action.tileId);
  if (!p) return 'There’s no Wonder found here.';
  if (p.accomplished) return `${p.def.name} is already accomplished.`;
  if (!p.here.length) return `Nobody is at ${p.def.name}.`;
  const left = p.goals.length - p.met;
  if (left > 0) return `${left} goal${left === 1 ? '' : 's'} left.`;
  for (const id of Object.keys(action.picks)) {
    if (!p.here.some((h) => h.id === id)) return 'Only hikers at the Wonder pick rewards.';
  }
  const takers = p.def.rewards.map(() => 0);
  const items = new Set<string>();
  for (const h of p.here) {
    const choice = action.picks[h.id];
    if (!choice) return `${h.name} hasn’t picked a reward.`;
    const why = pickProblem(state, p, h, choice);
    if (why) return why;
    takers[choice.reward] = (takers[choice.reward] ?? 0) + 1;
    if (choice.itemId && p.def.rewards[choice.reward]?.reward.kind === 'tier3') {
      if (items.has(choice.itemId)) {
        return `Two hikers can’t take the same ${ITEMS[choice.itemId]?.name ?? 'item'}.`;
      }
      items.add(choice.itemId);
    }
  }
  for (const [i, r] of p.def.rewards.entries()) {
    if (r.maxTakers !== undefined && (takers[i] ?? 0) > r.maxTakers) {
      return `At most ${r.maxTakers} hikers can pick ${r.title}.`;
    }
  }
  return undefined;
}

export function applyAccomplish(state: GameState, action: AccomplishAction): void {
  const p = wonderProgress(state, action.tileId);
  if (!p) throw new Error('applyAccomplish: no Wonder');
  const cause = p.def.name;
  for (const h of p.here) {
    const choice = action.picks[h.id];
    const r = choice && p.def.rewards[choice.reward];
    if (!choice || !r) continue;
    giveReward(state, h, r.reward, choice, cause, action.tileId);
  }
  p.wonder.claimed = structuredClone(action.picks);
  pushEvent(state, {
    kind: 'wonderAccomplished',
    tileId: action.tileId,
    wonderId: p.wonder.id,
    picks: structuredClone(action.picks),
  });
}

function giveItems(state: GameState, h: Hiker, itemIds: string[], cause: string): void {
  for (const itemId of itemIds) {
    h.inventory.bag.push({ uid: `wonder-${state.nextEventId}-${itemId}`, itemId });
  }
  if (itemIds.length) {
    pushEvent(state, { kind: 'gained', hikerId: h.id, resources: [], items: itemIds, cause });
  }
}

function giveReward(
  state: GameState,
  h: Hiker,
  reward: WonderDef['rewards'][number]['reward'],
  choice: WonderPick,
  cause: string,
  tileId: TileId,
): void {
  switch (reward.kind) {
    case 'xp':
      h.xp += BALANCE.wonders.lotOfXp;
      return;
    case 'caps': {
      const n = BALANCE.wonders.lotOfCaps;
      state.caps += n;
      pushEvent(state, { kind: 'gained', resources: [], items: [], caps: n, cause });
      return;
    }
    case 'tier3':
      if (choice.itemId) giveItems(state, h, [choice.itemId], cause);
      return;
    case 'shelters': {
      const shelters = findableItems('shelter');
      if (!shelters.length) return;
      const ids = Array.from({ length: reward.count }, () => pick(state.rng, shelters).id);
      giveItems(state, h, ids, cause);
      return;
    }
    case 'abundance':
      if (choice.node) changeAbundance(state, choice.node, reward.amount);
      return;
    case 'cureInjuries': {
      const healed = h.injuries;
      if (!healed) return;
      h.injuries = 0;
      if (h.status === 'passedOut') h.status = 'active';
      pushEvent(state, { kind: 'healed', hikerId: h.id, healed, injuries: 0, cause });
      return;
    }
    case 'revealBiome':
      for (const t of Object.values(state.section.tiles)) {
        if (t.id === tileId || t.kind !== 'normal' || t.visited || t.revealedCard || t.wonder) {
          continue;
        }
        revealCardOn(state, t.id, cause);
      }
      return;
    case 'energized':
      addCondition(state, h, 'energized', reward.days, 'days', cause);
      changeStat(state, h, 'energy', reward.energy, cause);
      return;
    case 'maxStat':
      h.maxBonus = {
        ...h.maxBonus,
        [reward.stat]: (h.maxBonus?.[reward.stat] ?? 0) + reward.amount,
      };
      return;
    case 'flipConditions': {
      const bad = h.conditions.filter((c) => CONDITIONS[c.id]?.kind === 'negative');
      for (const c of bad) {
        removeCondition(state, h, c.id);
        const fresh = POSITIVE_CONDITIONS.filter((id) => !h.conditions.some((k) => k.id === id));
        if (fresh.length)
          addCondition(state, h, pick(state.rng, fresh), reward.days, 'days', cause);
      }
      return;
    }
    case 'waiting':
      return;
  }
}
