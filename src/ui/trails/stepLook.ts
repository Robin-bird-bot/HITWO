/**
 * How a Skill Trails step looks (docs/mockups/skill-trails/skill-trails-legend.jpg):
 * its class color, its badge shape (diamond always on or a gift, circle
 * usable, rounded square a toggle), an upgrade's II or III tag, and the
 * class glyph when it has no icon file yet. Pure, so it's easy to test.
 */
import { CLASS_COLORS } from '../../content/classes';
import { STEPS, type TrailStep, type Tree } from '../../content/trails/trees';
import { stepText } from '../../content/trails/traits';
import type { ClassId } from '../../engine';
import type { BadgeInfo } from '../traits/badges';
import { traitIconUrl } from '../traits/traitIcons';

export type StepShape = 'diamond' | 'circle' | 'square';

export interface StepLook {
  step: TrailStep;
  tree: Tree;
  cls: ClassId;
  color: string;
  /** A darker shade of the color, for the middle of the badge. */
  fill: string;
  shape: StepShape;
  /** An upgrade's tag: II or III (how many versions of the trait it is). */
  tag?: 'II' | 'III';
  /** No icon file yet: draw this class's glyph instead. */
  glyph?: ClassId;
  /** "New trait" or "Upgrade". */
  stepWord: string;
}

/** A hex color mixed toward black: `k` of the color is kept. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** How many versions of its trait a step is: Leash Puller III is 3, Singer II is 2. */
export function versionOf(stepId: string): number {
  let n = 1;
  let id = STEPS.get(stepId)?.step.upgrades;
  for (; id && n < 5; n++) id = STEPS.get(id)?.step.upgrades;
  return n;
}

export const SHAPE: Readonly<Record<TrailStep['kind'], StepShape>> = {
  passive: 'diamond',
  grant: 'diamond',
  usable: 'circle',
  toggle: 'square',
};

export function stepLook(stepId: string): StepLook | undefined {
  const found = STEPS.get(stepId);
  if (!found) return undefined;
  const { step, tree } = found;
  const color = CLASS_COLORS[tree.cls];
  const version = versionOf(stepId);
  return {
    step,
    tree,
    cls: tree.cls,
    color,
    fill: shade(color, 0.42),
    shape: SHAPE[step.kind],
    ...(version >= 2 ? { tag: version >= 3 ? ('III' as const) : ('II' as const) } : {}),
    ...(traitIconUrl(stepId) ? {} : { glyph: tree.cls }),
    stepWord: step.step === 'upgrade' ? 'Upgrade' : 'New trait',
  };
}

/** A step's badge, as the trait badges draw it (the hover window, the shape, the color). */
export function stepBadge(stepId: string, slot = 0, more: Partial<BadgeInfo> = {}): BadgeInfo {
  const look = stepLook(stepId);
  const step = look?.step;
  return {
    slot,
    slotType: 'trail',
    traitId: stepId,
    name: step?.name ?? stepId,
    kindWord: look ? look.tree.name : 'Skill Trails',
    text: step ? stepText(step) : '',
    shape: look?.shape ?? 'diamond',
    state: 'on',
    initials: '',
    ...(look
      ? {
          color: look.color,
          ...(look.tag ? { tag: look.tag } : {}),
          ...(look.glyph ? { glyph: look.glyph } : {}),
        }
      : {}),
    ...more,
  };
}
