/**
 * Trait warnings (Nov 20 update, section 4): what Morale traits are about to
 * do, worked out once, here, by running their own hooks on a copy of the
 * game. The badges, the portrait tags and the checks before acting all read
 * these numbers; no rule is written twice.
 *
 * - **Start of day:** tomorrow morning's Morale traits, as if everyone stays
 *   put: the day moves on and the weather turns, then each hiker's Morale
 *   traits run their start-of-day rule.
 * - **An action:** the action on a copy. The Morale traits change right away
 *   (Bossy, Misophonia), and tomorrow morning's forecast after it (moving
 *   away can leave an Extrinsic hiker alone).
 * - **Working now:** a non-Morale trait with a condition says whether it
 *   holds (the `workingNow` hook, from the same check its effect uses).
 */
import { TRAIT_LIST, TRAITS } from '../../content/traits';
import { applyAction, validateAction } from '../applyAction';
import {
  effectContext,
  effectSourcesFor,
  queryContext,
  traitHooks,
  workingTrait,
} from '../effects';
import type { Action, GameState, Hiker, HikerId } from '../types';
import { advanceWeather } from '../weather';

/** One trait's part of a hiker's Morale change. */
export interface MoralePart {
  /** The trait, as the log names it. */
  trait: string;
  delta: number;
  /** A few words on why ("alone right now"). */
  why?: string;
}

/** A hiker's Morale change from traits, and the parts it's made of. */
export interface MoraleForecast {
  delta: number;
  parts: MoralePart[];
}

export type MoraleForecasts = Partial<Record<HikerId, MoraleForecast>>;

/** Every trait's name, to tell a trait's Morale change from anything else's. */
const TRAIT_NAMES = new Set(TRAIT_LIST.map((t) => t.name));

/** Is this log cause one of the hiker's traits (by name, or as it's named today)? */
function isTraitCause(state: GameState, hiker: Hiker | undefined, cause: string): boolean {
  if (TRAIT_NAMES.has(cause)) return true;
  return !!hiker?.slots.some((s) => workingTrait(state, s)?.name === cause);
}

/** The Morale changes traits made in `state`'s log from event `fromId` on, by hiker. */
function traitMorale(state: GameState, fromId: number): MoraleForecasts {
  const out: MoraleForecasts = {};
  for (const e of state.log) {
    if (e.id < fromId || e.kind !== 'stat' || e.stat !== 'morale') continue;
    const hiker = state.hikers.find((h) => h.id === e.hikerId);
    if (!isTraitCause(state, hiker, e.cause)) continue;
    const f = (out[e.hikerId] ??= { delta: 0, parts: [] });
    const delta = e.to - e.from;
    f.delta += delta;
    f.parts.push({ trait: e.cause, delta, ...(e.why ? { why: e.why } : {}) });
  }
  return out;
}

/** The start-of-day hooks of a hiker's Morale traits. */
function moraleTraitSources(state: GameState, hiker: Hiker) {
  return effectSourcesFor(state, hiker).filter((s) => {
    if (s.kind !== 'trait') return false;
    const id = s.id.replace(/^trait:/, '');
    return TRAITS[id]?.type === 'M';
  });
}

const dayCache = new WeakMap<GameState, MoraleForecasts>();

/**
 * Tomorrow morning's Morale traits, if everyone stays where they are now.
 * Cached per state: states never change once made.
 */
export function forecastStartOfDay(state: GameState): MoraleForecasts {
  const hit = dayCache.get(state);
  if (hit) return hit;
  const copy = structuredClone(state);
  // The next morning, as the camp step leaves it for the traits.
  copy.day += 1;
  copy.phase = 'morning';
  advanceWeather(copy);
  const from = copy.nextEventId;
  for (const h of copy.hikers) {
    if (h.status !== 'active') continue;
    const ctx = effectContext(copy, h);
    for (const s of moraleTraitSources(copy, h)) s.hooks.onStartOfDay?.(ctx);
  }
  const out = traitMorale(copy, from);
  dayCache.set(state, out);
  return out;
}

/** What an action would make Morale traits do: right away, and tomorrow morning after it. */
export interface ActionForecast {
  now: MoraleForecasts;
  tomorrow: MoraleForecasts;
  /** The game after the action (for what's working then). */
  state: GameState;
}

/** The forecast for an action, or undefined if it isn't allowed. */
export function forecastAction(state: GameState, action: Action): ActionForecast | undefined {
  if (validateAction(state, action)) return undefined;
  const after = applyAction(state, action);
  return {
    now: traitMorale(after, state.nextEventId),
    tomorrow: forecastStartOfDay(after),
    state: after,
  };
}

/** A hiker about to lose Morale through a trait, and why. */
export interface MoraleLoss {
  hikerId: HikerId;
  when: 'now' | 'tomorrow';
  delta: number;
  parts: MoralePart[];
}

/** The losses in a forecast: everyone whose traits take Morale. */
export function lossesIn(forecasts: MoraleForecasts, when: MoraleLoss['when']): MoraleLoss[] {
  return Object.entries(forecasts).flatMap(([hikerId, f]) =>
    f && f.delta < 0
      ? [{ hikerId, when, delta: f.delta, parts: f.parts.filter((p) => p.delta < 0) }]
      : [],
  );
}

/**
 * What an action would cost in Morale through traits: losses right away, and
 * hikers who'd lose more tomorrow morning than they would without it.
 */
export function actionLosses(state: GameState, action: Action): MoraleLoss[] {
  const f = forecastAction(state, action);
  if (!f) return [];
  const before = forecastStartOfDay(state);
  const tomorrow = lossesIn(f.tomorrow, 'tomorrow').filter(
    (l) => l.delta < (before[l.hikerId]?.delta ?? 0),
  );
  return [...lossesIn(f.now, 'now'), ...tomorrow];
}

/**
 * Is the trait in this slot working right now? Undefined for one that's
 * always working, or has nothing to say (most of them).
 */
export function workingNow(state: GameState, hiker: Hiker, slotIndex: number): boolean | undefined {
  const slot = hiker.slots[slotIndex];
  const trait = slot && workingTrait(state, slot);
  if (!trait) return undefined;
  const hook = traitHooks(trait.runs, trait.setting).workingNow;
  return hook ? hook(queryContext(state, hiker)) : undefined;
}
