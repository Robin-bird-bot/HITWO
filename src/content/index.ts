/**
 * Game content as typed data: traits, conditions, items, scavenge card types,
 * challenges, night events, objectives, biomes and characters.
 *
 * - Effects plug into engine hooks; they are never special cases in the engine.
 * - Anything made up for testing gets `placeholder: true`.
 * - Pure, like the engine: no React, no DOM, no Math.random. Content imports
 *   only engine *types*, so there is no runtime import cycle.
 *
 * See CLAUDE.md, "Architecture rules" 4 and 6.
 */
export { TRAITS } from './traits';
export { FAMILIES } from './families';
export { ITEMS, TIER_3_ITEMS, findableItems } from './items';
export { SCAVENGE_CARDS, SCAVENGE_CARD_ORDER, type ScavengeCardDef } from './scavengeCards';
export { CARDS, CHALLENGES, OPPORTUNITIES, TRIALS } from './challenges';
export { CONDITIONS, NEGATIVE_CONDITIONS, type ConditionDef } from './conditions';
export { RESOURCES } from './resources';
