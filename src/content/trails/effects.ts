/**
 * What each Skill Trails step does (09-hikers.md, "The first 6 hikers" and
 * "Rules that need care"), by step id. Each one plugs into the engine's hook
 * points; the engine never checks for a step by name.
 */
import type { TraitDef } from '../../engine/effects';

export type StepEffect = Pick<TraitDef, 'hooks' | 'ability' | 'toggle'>;

export const STEP_EFFECTS: Readonly<Record<string, StepEffect>> = {};
