/**
 * The night event (docs/design/05-nights-and-weather.md, "How a night works"),
 * first thing in the camp step:
 *
 * 1. Pick a tier, by the biome's odds, and one creature from it.
 * 2. Roll for each exposed hiker. A hiker is safe on a tile with a shelter, or
 *    where anyone kept watch.
 * 3. For each hiker hit, pick one of the tier's outcomes that can apply, and
 *    apply it through the effect engine.
 * 4. Log a 'nightEvent' with a line and a chip for each hiker hit. The window
 *    only shows when someone was hit.
 *
 * A hiker chased onto a tile nobody had reached opens its challenge in the
 * morning (the tile waits in the challenge queue).
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { CONDITIONS } from '../../content/conditions';
import {
  NIGHT_CREATURE_BY_ID,
  NIGHT_CREATURES,
  NIGHT_OUTCOMES,
  type NightCreature,
  type NightNeed,
  type NightOutcome,
  type NightTier,
} from '../../content/nightEvents';
import { isWatched } from '../actions/watch';
import {
  applyEffects,
  behindTiles,
  equippedClothes,
  foodCarried,
  immovable,
  onMap,
  type EffectResult,
} from '../challenges/applyEffects';
import { rollValue } from '../challenges/rolls';
import type { Effect } from '../challenges/types';
import { resourceCount } from '../inventory';
import { pushEvent } from '../log';
import { hikersOnTile, isSheltered } from '../map';
import { nextFloat, pick, roll } from '../rng';
import { nightSafeItem, nightShield } from '../effects';
import type {
  CardRolls,
  GameEvent,
  GameState,
  Hiker,
  HikerId,
  NightHit,
  NightSafe,
} from '../types';

const N = BALANCE.nightEvents;

/** This biome's odds for Tier 1, 2 and 3 (the last biome's for any after it). */
export function tierOdds(sectionIndex: number): readonly [number, number, number] {
  const odds = N.tierOdds;
  return odds[Math.min(Math.max(0, sectionIndex), odds.length - 1)] ?? [1, 0, 0];
}

export function pickTier(state: GameState): NightTier {
  const [t1, t2] = tierOdds(state.sectionIndex);
  const u = nextFloat(state.rng);
  if (u < t1) return 1;
  if (u < t1 + t2) return 2;
  return 3;
}

/** Other active hikers on the same tile (none means alone). */
const company = (state: GameState, h: Hiker) =>
  hikersOnTile(state, h.tileId).filter((o) => o.id !== h.id);

/** An exposed hiker's chance to be hit tonight. */
export function hitChance(state: GameState, h: Hiker): number {
  const c = N.chance;
  const others = company(state, h).length;
  let p = c.base * (others === 0 ? c.alone : c.perOther ** others);
  const low = [...c.lowMorale]
    .sort((a, b) => a.atMost - b.atMost)
    .find((m) => h.stats.morale <= m.atMost);
  if (low) p += low.add;
  // A Disco Harness on the tile makes everyone there less likely to be hit.
  p *= 1 - nightShield(state, h) / 100;
  return Math.min(1, p);
}

/**
 * Why a hiker is safe tonight: someone keeps watch on their tile, a shelter,
 * a Camping Lamp on or next to it, or their own Bear Spray.
 */
export function safeFrom(state: GameState, h: Hiker): Omit<NightSafe, 'hikerId'> | undefined {
  if (isWatched(state, h.tileId)) {
    const by = hikersOnTile(state, h.tileId).find((o) => o.watching);
    return { why: 'watch', ...(by ? { by: by.id } : {}) };
  }
  if (isSheltered(state, h)) return { why: 'shelter' };
  if (state.section.tiles[h.tileId]?.lampTonight) return { why: 'lamp' };
  const item = nightSafeItem(state, h);
  if (item) return { why: 'item', item };
  return undefined;
}

function meets(state: GameState, h: Hiker, need: NightNeed): boolean {
  switch (need.kind) {
    case 'caps':
      return state.caps > 0;
    case 'resources':
      return resourceCount(h) > 0;
    case 'items':
      return h.inventory.bag.length > 0;
    case 'clothes':
      return equippedClothes(h).length > 0;
    case 'food':
      return foodCarried(h) > 0;
    case 'xp':
      return h.xp > 0;
    case 'stat':
      return need.stats.some((s) => h.stats[s] > 0);
    case 'farItem':
      return (
        h.inventory.bag.length > 0 &&
        state.hikers.some((o) => o.tileId !== h.tileId && onMap(o) && o.inventory.bag.length > 0)
      );
    case 'behind':
      return !immovable(h) && behindTiles(state, h.tileId).length > 0;
    case 'weak': {
      if (!need.stats.some((s) => h.stats[s] <= need.atMost)) return false;
      const others = company(state, h).length;
      if (need.alone && others > 0) return false;
      return need.maxOnTile === undefined || others + 1 <= need.maxOnTile;
    }
  }
}

/** Can this outcome apply to this hiker right now? */
export function canApply(state: GameState, h: Hiker, outcome: NightOutcome): boolean {
  return (outcome.needs ?? []).every((n) => meets(state, h, n));
}

const UNIT_WORD = { days: 'day', phases: 'phase', nights: 'night', weather: 'weather' } as const;
const timeText = (n: number, unit: keyof typeof UNIT_WORD) =>
  `${n} ${UNIT_WORD[unit]}${n === 1 ? '' : 's'}`;

const STAT_ORDER = ['energy', 'appetite', 'morale'] as const;
const STAT_WORD = { energy: 'Energy', appetite: 'Appetite', morale: 'Morale' } as const;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Fills a line's {words}; an unknown word stays as it is. */
export function fillLine(template: string, words: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => words[key] ?? all);
}

const flatRoll = (state: GameState, range: readonly [number, number]) =>
  rollValue(state.rng, { roll: 'y', range }, 0);

/** Applies one outcome to a hiker: its effects, and the line and chip that say what happened. */
function applyOutcome(
  state: GameState,
  creature: NightCreature,
  outcome: NightOutcome,
  h: Hiker,
): { hit: NightHit; entered: EffectResult['entered'] } {
  const x = outcome.x ? flatRoll(state, outcome.x) : 0;
  const rolls: CardRolls = { x: { X: x }, y: {}, includes: {}, luck: 0 };
  let effects: readonly Effect[] = outcome.effects ?? [];
  if (outcome.oneOf?.length) {
    const c = pick(state.rng, outcome.oneOf);
    const time = typeof c.time === 'number' ? c.time : flatRoll(state, c.time);
    effects = [{ op: 'condition', id: c.id, duration: time, unit: c.unit }];
  }

  const xpBefore = h.xp;
  const injuriesBefore = h.injuries;
  const since = state.nextEventId;
  const result = applyEffects(
    state,
    {
      card: { name: creature.name },
      tileId: h.tileId,
      targets: [h],
      onTile: hikersOnTile(state, h.tileId),
      rolls,
    },
    effects,
  );

  // The condition the hiker actually got (Wet on Wet makes Soaked).
  const got = state.log.findLast(
    (e): e is Extract<GameEvent, { kind: 'condition' }> =>
      e.id >= since && e.kind === 'condition' && e.hikerId === h.id,
  );
  const touched = result.touched;
  const shown =
    outcome.counts === 'resources'
      ? touched.resources
      : outcome.counts === 'caps'
        ? touched.caps
        : outcome.counts === 'items'
          ? touched.items.length
          : outcome.counts === 'xp'
            ? xpBefore - h.xp
            : x;
  const itemName = (i: number) => {
    const id = touched.items[i];
    return (id && ITEMS[id]?.name) ?? 'something';
  };
  const other = touched.other && state.hikers.find((o) => o.id === touched.other);
  // What was really lost: the creature's own stat changes (a stat at 0, Refreshed or
  // Full can take less than the roll), and any injury (which lifts low stats again).
  const lost = STAT_ORDER.flatMap((stat) => {
    let d = 0;
    for (const e of state.log) {
      if (e.id < since || e.kind !== 'stat' || e.hikerId !== h.id) continue;
      if (e.stat === stat && e.cause === creature.name) d += e.from - e.to;
    }
    return d > 0 ? [`−${d} ${STAT_WORD[stat]}`] : [];
  });
  const hurt = h.injuries - injuriesBefore;
  if (hurt > 0) lost.push(`+${hurt} injur${hurt === 1 ? 'y' : 'ies'}`);
  const words: Record<string, string> = {
    Creature: capitalize(creature.called),
    creature: creature.called,
    hiker: h.name,
    X: String(shown),
    s: shown === 1 ? '' : 's',
    item: itemName(0),
    item2: itemName(1),
    other: other ? other.name : 'another hiker',
    stats: lost.length ? lost.join(', ') : 'Nothing lost',
    ...(got
      ? {
          Condition: CONDITIONS[got.condition]?.name ?? got.condition,
          time: timeText(got.remaining, got.unit),
        }
      : {}),
  };
  const line =
    (got && creature.lines?.[`${outcome.id}:${got.condition}`]) ??
    creature.lines?.[outcome.id] ??
    outcome.line;
  return {
    hit: {
      hikerId: h.id,
      outcomeId: outcome.id,
      text: fillLine(line, words),
      chip: fillLine(outcome.chip, words),
    },
    entered: result.entered,
  };
}

/** Tonight's night event. Runs first in the camp step (or now, from the debug panel). */
export function runNightEvent(state: GameState): void {
  if (state.noNightEvents && !state.debugNight) return;
  const forced = state.debugNight;
  delete state.debugNight;
  const forcedCreature = forced?.creatureId ? NIGHT_CREATURE_BY_ID[forced.creatureId] : undefined;
  const tier = forcedCreature?.tier ?? forced?.tier ?? pickTier(state);
  const creature =
    forcedCreature ??
    pick(
      state.rng,
      NIGHT_CREATURES.filter((c) => c.tier === tier),
    );
  const from = state.nextEventId;

  // Who's exposed, and who's hit: rolled for everyone before anything happens.
  const safe: NightSafe[] = [];
  const hitIds: HikerId[] = [];
  // TODO(wyatt): passed-out hikers are on the map, so they can be hit too.
  for (const h of state.hikers.filter(onMap)) {
    const isSafe = safeFrom(state, h);
    if (isSafe) {
      safe.push({ hikerId: h.id, ...isSafe });
      continue;
    }
    if (forced?.hit === h.id || roll(state.rng, hitChance(state, h))) hitIds.push(h.id);
  }

  const hits: NightHit[] = [];
  for (const id of hitIds) {
    const h = state.hikers.find((x) => x.id === id);
    if (!h || !onMap(h)) continue;
    const options = NIGHT_OUTCOMES[tier].filter((o) => canApply(state, h, o));
    if (!options.length) continue;
    const { hit, entered } = applyOutcome(state, creature, pick(state.rng, options), h);
    hits.push(hit);
    // Chased onto a tile nobody had reached: its challenge opens in the morning.
    for (const e of entered) {
      state.challengeQueue = [
        ...(state.challengeQueue ?? []),
        { tileId: e.tileId, hikerIds: e.hikerIds },
      ];
    }
  }

  // A condition given at camp counts from tomorrow: this camp step's tick skips it,
  // so "Wet for 1 day" lasts through the next day.
  for (const e of state.log) {
    if (e.id < from || e.kind !== 'condition' || e.unit === 'phases') continue;
    const c = state.hikers
      .find((h) => h.id === e.hikerId)
      ?.conditions.find((x) => x.id === e.condition);
    if (c) c.fresh = true;
  }

  pushEvent(state, { kind: 'nightEvent', tier, creatureId: creature.id, hits, safe, from });
}
