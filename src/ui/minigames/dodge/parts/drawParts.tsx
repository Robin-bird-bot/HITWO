/**
 * Draws every part on one layer, using each kind's drawing (Wyatt's attacks,
 * Claude's ideas, the Woods Monster's, Bear with a Gun's and the Ants').
 */
import { Fragment, type ReactNode } from 'react';
import type { Part } from '../../../../minigames/dodge/logic';
import { ANT_DRAW } from './AntParts';
import { CLAUDES_DRAW } from './ClaudesIdeasParts';
import type { DrawCtx, Layer, PartDrawing } from './drawTypes';
import { GUN_DRAW } from './GunParts';
import { MONSTER_DRAW } from './MonsterParts';
import { WYATT_DRAW } from './WyattParts';

const DRAW = {
  ...WYATT_DRAW,
  ...CLAUDES_DRAW,
  ...MONSTER_DRAW,
  ...GUN_DRAW,
  ...ANT_DRAW,
} satisfies { [K in Part['kind']]: unknown } as Record<Part['kind'], PartDrawing<Part>>;

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
