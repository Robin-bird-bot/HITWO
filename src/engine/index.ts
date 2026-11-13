/**
 * The rules engine: pure TypeScript with no React, no DOM and no Math.random
 * (ESLint enforces this).
 *
 * - The whole game is one serializable GameState, and every change goes
 *   through applyAction(state, action).
 * - All randomness comes from the seeded RNG stored in the state.
 * - Every tunable number comes from src/config/balance.ts.
 * - Traits, conditions and items plug in through hooks (see effects.ts).
 *
 * See CLAUDE.md, "Architecture rules".
 */
export * from './types';
export { applyAction, validateAction, InvalidActionError } from './applyAction';
export { createGame, type HikerSetup, type NewGameOptions } from './newGame';
export { hikersWhoHaventActed } from './dayLoop';
export { moveCost, moveAllCost, type HikerCost } from './costs';
export { abilitiesFor, type AvailableAbility, type TraitDef } from './effects';
export {
  isExhausted,
  isFamished,
  isFatigued,
  isHungry,
  thresholdStates,
  type ThresholdState,
} from './thresholds';
export { adjacentTileIds, hikersOnTile, isAlone, lineBetween } from './map';
export { isSheltered } from './actions/sleep';
export { SAVE_VERSION, serialize, deserialize, type LoadResult, type LoadFailure } from './save';
export { generateSection, type SectionOptions } from './trail/generate';
export { checkSection } from './trail/check';
export { seedRng } from './rng';
export { bagSlots, resourceCount, resourceLimit, type BagSlots, type ItemSlots } from './inventory';
export type { ItemDef, ItemType, ItemUse, FamilyDef, AbilityDef } from './effects';
export {
  clothesOf,
  negativeConditions,
  nodeChoices,
  resourceChoices,
  choiceOfUse,
  targetOfUse,
  type UseChoice,
} from './actions/useItem';
export { biteAppetite } from './actions/eat';
export { tradesAnywhere } from './effects';
export {
  QUALITIES,
  hasQuality,
  qualityScale,
  valueAt,
  type Quality,
  type QualityValues,
} from './items/quality';
export { itemText } from './items/text';
export { recipeSize, type Recipe, type RecipePart } from './items/recipe';
export {
  fullCounters,
  fullDurability,
  makeItem,
  qualityOdds,
  qualityOf,
  rollQuality,
  withDefaults,
} from './items/make';
export { isHikeOver } from './health';
export { canDeal, dealCard, dealCards, type DealInput } from './scavenge/deal';
export { clampLuck, moraleLuck, rarityOdds } from './scavenge/rarity';
export { scavengeCost, scavengeSetup } from './scavenge/setup';
export { bonusTaken, cardGains, pickOptions, rerollAbility, rerollsLeft } from './actions/scavenge';
export { isLow } from './abundance';
export { tendAmount, tendCost, tendableNodes } from './actions/tend';
export { blockedByStatus, withoutStatus } from './status';
export { amount, rollCard, scaledRange, notBuiltYet, type CardRolls } from './challenges/rolls';
export { notPlayableYet, pickForTile, type Picked } from './challenges/pick';
export { hasCondition } from './conditions';
export type * from './challenges/types';
export {
  challengeHikers,
  challengeSections,
  giftCount,
  giftFits,
  harnessFor,
  openCardDef,
  optionShortfall,
  paidCause,
  requirementNeed,
  resourceFits,
} from './challenges/resolve';
export { foodCarried } from './challenges/applyEffects';
export { riskReading, riskSpendFits, type RiskReading } from './challenges/risk';
export { deadlineOf, phaseIndex, timeLeft } from './challenges/trials';
export { pressKey, pressesLeft, revealableFrom, unrevealedTiles } from './challenges/buttons';
export { immovable } from './challenges/applyEffects';
export { revealCardOn } from './challenges/reveal';
export { statMax } from './stats';
export type * from './wonders/types';
export {
  GOALS_SHOWN,
  isAccomplished,
  isRevealed,
  levelOf,
  pickProblem,
  scaledNumber,
  wonderProgress,
  wonderTile,
  type GoalProgress,
  type WonderProgress,
} from './wonders/wonders';
export { hikerEffectActive, nodeCounts, nodeGives, weatherDaysLeft } from './weather';
export { overBag } from './actions/give';
export {
  autoPay,
  basicRecipe,
  craftPool,
  craftRecipe,
  craftSetup,
  craftTier,
  fitsPart,
  knowsBlueprint,
  paymentReason,
  spaceParts,
  CRAFT_TYPES,
  type CraftSetup,
} from './items/craft';
export { craftOpenReason, teachCost } from './actions/craft';
export type { CraftModifier } from './effects';
