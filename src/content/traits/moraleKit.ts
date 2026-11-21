/**
 * Helpers for Morale traits. Each one is a rule that says how much Morale
 * the hiker gains or loses, and why in a few words ("alone right now"). The
 * trait's hook applies it, and the trait-warnings forecast (Phase 10a step
 * 8) runs the same hook on a copy of the game, so there's one copy of each rule.
 */
import type { EffectContext, Hooks, QueryContext } from '../../engine/effects';
import type { Family, Hiker } from '../../engine/types';

/** A Morale change and its reason, or nothing when the rule doesn't apply. */
export type MoraleRule = (ctx: QueryContext) => { delta: number; why: string } | undefined;

/** Applies a rule's change, with its reason in the log. */
export function applyRule(ctx: EffectContext, name: string, rule: MoraleRule): void {
  const r = rule(ctx);
  if (r && r.delta) ctx.changeStat(ctx.self, 'morale', r.delta, name, r.why);
}

/** A rule checked at the start of each day. */
export const atStartOfDay = (name: string, rule: MoraleRule): Hooks => ({
  onStartOfDay: (ctx) => applyRule(ctx, name, rule),
});

/** A Morale change right now, from a hook that reacts to something. */
export const moraleNow = (ctx: EffectContext, name: string, delta: number, why: string) =>
  ctx.changeStat(ctx.self, 'morale', delta, name, why);

/** Other hikers still hiking on this hiker's tile. */
export const others = (ctx: QueryContext): Hiker[] =>
  ctx.hikersOnTile(ctx.self.tileId).filter((h) => h.id !== ctx.self.id);

/** Others on the tile of a family. Plush hikers aren't Dogs (or any real pet). */
export const othersOf = (ctx: QueryContext, family: Family): Hiker[] =>
  others(ctx).filter((h) => h.family === family);

/** +1 when one thing holds, −1 when another does, each with its reason. */
export function plusMinus(
  plus: { when: boolean; why: string },
  minus: { when: boolean; why: string },
  amount = 1,
): { delta: number; why: string } | undefined {
  if (plus.when && !minus.when) return { delta: amount, why: plus.why };
  if (minus.when && !plus.when) return { delta: -amount, why: minus.why };
  return undefined;
}
