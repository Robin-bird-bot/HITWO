/**
 * Every Skill Trails step as a trait (Phase 10.7), so the engine's hook
 * points read them like any other trait. The step id is the trait id. What
 * each one does is in ./effects.ts.
 *
 * Old traits that are now trees keep their icons (Leash Puller, Copydog,
 * Singer, Dog Mom, Short, Rule Changer, Rain Lover and the rest); Wanderlust
 * is now Experienced Traveler. A step with no icon yet shows a placeholder:
 * its badge shape in the class color with the class glyph.
 */
import type { TraitDef } from '../../engine/effects';
import { CLASS_AREA } from '../classes';
import { STEP_EFFECTS } from './effects';
import { STEPS } from './trees';

/**
 * Icon files reused from the old traits, by the step that starts each chain
 * (an upgrade uses its chain's). Steps not listed have no icon yet.
 */
const ICONS: Readonly<Record<string, string>> = {
  'finn-leader-t1': 'puller',
  'finn-follower-t1': 'follower',
  'finn-scavenger-t1': 'copydog',
  'ellie-entertainer-t1': 'singer',
  'ellie-entertainer-t2': 'loud',
  'mom-support-t1': 'dog-mom',
  'mom-merchant-t1': 'mba',
  'mom-trekker-t1': 'wanderlust',
  'gdog-chef-t2': 'artisan-cook',
  'gdog-chef-t3': 'master-cook',
  'gdog-tailor-t2': 'artisan-tailor',
  'gdog-tailor-t3': 'master-tailor',
  'gdog-trekker-t1': 'short',
  'wink-leader-t3': 'just-around-the-next-corner',
  'wink-architect-t2': 'artisan-architect',
  'wink-architect-t3': 'master-architect',
  'wyatt-naturalist-t1': 'rain-lover',
  'wyatt-daredevil-t1': 'rule-changer',
};

/** A step's icon: its own, or the one its chain started with. */
export function stepIcon(stepId: string): string | undefined {
  let id: string | undefined = stepId;
  for (let guard = 0; id && guard < 5; guard++) {
    const own = ICONS[id];
    if (own) return own;
    id = STEPS.get(id)?.step.upgrades;
  }
  return undefined;
}

/** "On: … Off: …" for a toggle, else its text. */
export function stepText(step: { text?: string; on?: string; off?: string }): string {
  return step.on !== undefined
    ? `On: ${step.on} Off: ${step.off ?? 'Nothing.'}`
    : (step.text ?? '');
}

/** A placeholder file name nothing is on disk for: the UI draws the class glyph instead. */
const NO_ICON = 'trail-placeholder';

export const TREE_TRAITS: readonly TraitDef[] = [...STEPS.values()].map(({ step, tree, hiker }) => {
  const area = CLASS_AREA[tree.cls];
  return {
    id: step.id,
    name: step.name,
    type: area === 'movement' ? 'T' : 'U',
    tier: step.tier,
    text: stepText(step),
    kind: 'unique',
    owners: [hiker.hikerId],
    area,
    icon: stepIcon(step.id) ?? NO_ICON,
    ...STEP_EFFECTS[step.id],
  } satisfies TraitDef;
});
