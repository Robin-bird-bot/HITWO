/**
 * Small helpers every attack uses: the warning time, and a part's common
 * fields.
 */
import { BALANCE } from '../../../config/balance';
import type { AttackCtx, PartBase } from '../types';

const D = BALANCE.minigames.dodge;

/** A warning: the attack's own time or the default, never under the minimum. */
export const warnFor = (sec: number = D.warnSec): number => Math.max(D.warnMinSec, sec);

/** A part's common fields: a new id, this round, and its warning and start. */
export const base = (ctx: AttackCtx, warnAt: number, activeAt: number): PartBase => ({
  id: ctx.nextId(),
  round: ctx.round,
  warnAt,
  activeAt,
});

/** Whether the game's level has reached a variant's first level. */
export const from = (ctx: AttackCtx, level: number): boolean => ctx.level >= level;
