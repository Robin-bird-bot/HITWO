/**
 * Draws every part on one layer, using each kind's drawing (Wyatt's attacks
 * and Claude's ideas).
 */
import { Fragment, type ReactNode } from 'react';
import type { Part } from '../../../../minigames/dodge/logic';
import { CLAUDES_DRAW } from './ClaudesIdeasParts';
import type { DrawCtx, PartDrawing } from './drawTypes';
import { WYATT_DRAW } from './WyattParts';

const DRAW = { ...WYATT_DRAW, ...CLAUDES_DRAW } as Record<Part['kind'], PartDrawing<Part>>;

/** Every part's drawing on a layer (only parts whose warning has started). */
export function PartsLayer({
  parts,
  layer,
  ctx,
}: {
  parts: readonly Part[];
  layer: 'svg' | 'under' | 'over' | 'outside';
  ctx: DrawCtx;
}) {
  const out: ReactNode[] = [];
  for (const p of parts) {
    if (ctx.time < p.warnAt) continue;
    const node = DRAW[p.kind]?.[layer]?.(p, ctx);
    if (node) out.push(<Fragment key={p.id}>{node}</Fragment>);
  }
  return <>{out}</>;
}
