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
export {
  abilitiesFor,
  abilityOptions,
  workingTrait,
  type AvailableAbility,
  type TraitDef,
  type WorkingTrait,
} from './effects';
export {
  canAddSlot,
  familyCanHave,
  familyVersion,
  fitsSlot,
  slotReason,
  typesFor,
} from './traits/slots';
export {
  copyChoices,
  emptySlotsFor,
  offerShape,
  optionSource,
  readCopy,
  replaceableSlots,
} from './traits/levelUp';
export { levelForXp, levelReached, onXpRow, partyOf, xpForLevel } from './xp';
export { moraleForecast, type MoraleForecast as MoraleTypeForecast } from './morale';
export {
  canSpendNow,
  hasLearned,
  heldTraits,
  holdsToggle,
  learnReason,
  levelCost,
  rootStep,
  SPEND_WHEN,
  stepCost,
  toggleOn,
  treesOf,
  unlockLevel,
} from './trails';
export { dailyPickName } from './traits/daily';
export {
  actionLosses,
  forecastAction,
  forecastStartOfDay,
  lossesIn,
  workingNow,
  type ActionForecast,
  type MoraleForecast,
  type MoraleForecasts,
  type MoraleLoss,
  type MoralePart,
} from './traits/forecast';
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
export { seedRng, nextFloat, shuffle } from './rng';
export {
  bagSlots,
  packingPicks,
  resourceCount,
  resourceLimit,
  type BagSlots,
  type ItemSlots,
} from './inventory';
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
export { counterRange, itemRangeText, itemText, rangeWords, valueRange } from './items/text';
export { recipeSize, type Recipe, type RecipePart } from './items/recipe';
export {
  durabilityLeft,
  maxDurabilityOf,
  usesLeftOf,
  fullCounters,
  fullDurability,
  makeItem,
  qualityOdds,
  qualityOf,
  rollQuality,
  withDefaults,
} from './items/make';
export { isHikeOver } from './health';
export {
  atLastSection,
  checkInPreview,
  isCheckpoint,
  type CheckInPreview,
} from './station/checkIn';
export {
  blueprintPrice,
  buyPrice,
  itemPrice,
  leftShare,
  marketMult,
  resourceSellPrice,
  saleCaps,
  sellPrice,
} from './station/prices';
export { stationItemCount, stationTheme } from './station/stock';
export { findOffer, rejoinReason } from './actions/station';
export { tradeable } from './station/trail';
export type { StationFocus, StationTheme, StationThemeId } from './station/types';
export { canDeal, dealCard, dealCards, isResourceCard, type DealInput } from './scavenge/deal';
export { clampLuck, moraleLuck, rarityOdds } from './scavenge/rarity';
export { scavengeCost, scavengeSetup } from './scavenge/setup';
export { bonusTaken, cardGains, pickOptions, rerollAbility, rerollsLeft } from './actions/scavenge';
export { emptyChance } from './abundance';
export { tendAmount, tendCost, tendableNodes } from './actions/tend';
export { blockedByStatus, withoutStatus } from './status';
export { amount, rangeAt, rollCard, scaledRange, type CardRolls } from './challenges/rolls';
export { notPlayableYet, pickForTile, type Picked } from './challenges/pick';
export { hasCondition } from './conditions';
export type * from './challenges/types';
export {
  challengeHikers,
  challengeSections,
  giftCount,
  giftFits,
  harnessFor,
  judgedIds,
  openCardDef,
  optionShortfall,
  paidCause,
  requirementNeed,
  resourceFits,
} from './challenges/resolve';
export { foodCarried } from './challenges/applyEffects';
export type { MinigameOutcome, PrepSpend } from './challenges/minigame';
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
export { weatherDaysLeft } from './weather';
export { canHandOver, overBag } from './actions/give';
export { tilesAhead } from './traits/reveal';
export { bringReach } from './effects';
export { tileDistance } from './map';
export {
  autoPay,
  basicRecipe,
  craftPool,
  craftRecipe,
  craftSetup,
  atWorkbench,
  canUseBlueprint,
  craftTier,
  fitsPart,
  knowsBlueprint,
  ownCraftTier,
  paymentReason,
  spaceParts,
  CRAFT_TYPES,
  type CraftSetup,
} from './items/craft';
export { craftOpenReason, teachCost } from './actions/craft';
export { keepsItemsReason, wrapsPresents } from './effects';
export {
  isPresent,
  presentRecipe,
  RECIPE_GRADE,
  sameResourceChoices,
  sameTypeChoices,
  wishParts,
  wrapSlots,
} from './items/presents';
export type { CraftModifier } from './effects';
export { mapTargets } from './items/scout';
export { deploymentsOf, shelterDeployments, shelterOn } from './items/shelters';
export { foodAppetiteEstimate } from './items/foodValue';
