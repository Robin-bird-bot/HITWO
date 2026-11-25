/**
 * Draws every part on one layer, using each kind's drawing (Wyatt's attacks,
 * Claude's ideas and the Woods Monster's).
 */
import { Fragment, type ReactNode } from 'react';
import type { Part } from '../../../../minigames/dodge/logic';
import { CLAUDES_DRAW } from './ClaudesIdeasParts';
import type { DrawCtx, Layer, PartDrawing } from './drawTypes';
import { MONSTER_DRAW } from './MonsterParts';
import { WYATT_DRAW } from './WyattParts';

const DRAW = { ...WYATT_DRAW, ...CLAUDES_DRAW, ...MONSTER_DRAW } as Record<
  Part['kind'],
  PartDrawing<Part>
>;

/**
 * Every part's drawing on a layer (only parts whose warning has started).
 * `warningsOnly` draws only parts still warning (before they start), for
 * drawing the box's warnings again above the dark.
 */
export function PartsLayer({
  parts,
  layer,
  ctx,
  warningsOnly = false,
}: {
  parts: readonly Part[];
  layer: Layer;
  ctx: DrawCtx;
  warningsOnly?: boolean;
}) {
  const out: ReactNode[] = [];
  for (const p of parts) {
    if (ctx.time < p.warnAt || (warningsOnly && ctx.time >= p.activeAt)) continue;
    const node = DRAW[p.kind]?.[layer]?.(p, ctx);
    if (node) out.push(<Fragment key={p.id}>{node}</Fragment>);
  }
  return <>{out}</>;
}
