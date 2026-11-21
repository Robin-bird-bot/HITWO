/**
 * Level-ups and trait picks (01-design-doc.md, "Leveling"; 02, "Trait rules";
 * 07-characters.md, "Classes"). Pure functions of the state and its seeded RNG.
 *
 * - **When:** a level reached waits for the camp step (Wyatt, Nov 20). At the
 *   start of the next day, one level-up opens at a time, for one hiker at a
 *   time, and everything else waits for it.
 * - **The offer:** levels 1–3 offer 3 traits of that tier; from level 4, one
 *   more option a level, all Tier III, up to 6. Options come from every type
 *   the hiker's slots can hold, filled or open, with Morale traits rarer.
 *   Trail and Utility options come from the hiker's classes, Jack traits and
 *   general traits, but [1] can come from any class. Only the family version
 *   that fits the hiker; special and unique traits only for their owners.
 * - **A new slot** is sometimes an option instead (never past 6): T and U most
 *   often, the mixed slots less, W least.
 * - **Taking a trait** puts it in an empty slot that fits, or in place of the
 *   trait in a fitting slot the player picks. Blueprints stay learned.
 *
 * Old Photo opens the same kind of pick: 3 traits for one slot.
 */
import { BALANCE } from '../../config/balance';
import { classesOf, isGeneral } from '../../content/classes';
import { TRAIT_LIST, TRAITS } from '../../content/traits';
import { TRAIT_ACTIONS } from '../../content/traits/build';
import { effectContext, effectSourcesFor, type TraitDef, type TraitSettingKind } from '../effects';
import { pushEvent } from '../log';
import { hikersOnTile } from '../map';
import { pick, roll, shuffle, weightedPick } from '../rng';
import type {
  GameState,
  Hiker,
  SlotType,
  TraitOption,
  RngState,
  TraitPick,
  TraitSetting,
} from '../types';
import { NODE_TYPES } from '../types';
import { rollDailyTraits } from './daily';
import { canAddSlot, familyCanHave, familyVersion, fitsSlot, typesFor } from './slots';

const L = BALANCE.levelUp;

/** How many options a level-up offers, and of which tier. */
export function offerShape(level: number): { count: number; tier: 1 | 2 | 3 } {
  const count = level <= 3 ? L.options : Math.min(L.maxOptions, level);
  const tier = Math.min(3, Math.max(1, level)) as 1 | 2 | 3;
  return { count, tier };
}

/** Puller and Leash Puller are one trait under two names. */
const sameTrait = (a: TraitDef, b: TraitDef) => a.id === b.id || (!!a.group && a.group === b.group);

/** Does the hiker already have this trait (or its family version)? */
export function hasTrait(hiker: Hiker, def: TraitDef): boolean {
  return hiker.slots.some((s) => {
    const other = s.traitId ? TRAITS[s.traitId] : undefined;
    return !!other && sameTrait(other, def);
  });
}

/**
 * Can this hiker ever have this trait? The family version that fits them,
 * a family trait for their family, a special or unique trait only if it's
 * theirs, and never a Duo's Tag Team (that has its own slot).
 */
export function canHaveTrait(hiker: Hiker, def: TraitDef): boolean {
  if (def.tagTeam || def.placeholder) return false;
  if (!familyCanHave(def, hiker.family)) return false;
  if (def.group && familyVersion(def, hiker.family).id !== def.id) return false;
  if (def.kind === 'special' || def.kind === 'unique') {
    return !!hiker.characterId && !!def.owners?.includes(hiker.characterId);
  }
  return true;
}

/** Is this Trail or Utility trait in one of the hiker's classes, Jack's, or general? */
export function inClass(hiker: Hiker, def: TraitDef): boolean {
  if (def.type === 'M' || isGeneral(def)) return true;
  const classes = classesOf(def);
  return classes.includes('jack') || classes.some((c) => hiker.classes.includes(c));
}

/** The trait types a hiker's slots can hold, filled or open. */
export function slotTypesHeld(hiker: Hiker): Set<TraitDef['type']> {
  return new Set(hiker.slots.flatMap((s) => typesFor(s.type)));
}

/**
 * The traits a level-up could offer this hiker at this tier. Morale, special
 * and unique traits have no tier: they can come up at any level.
 */
export function offerPool(
  hiker: Hiker,
  tier: 1 | 2 | 3,
  { anyClass = false }: { anyClass?: boolean } = {},
): TraitDef[] {
  const types = slotTypesHeld(hiker);
  return TRAIT_LIST.filter((def) => {
    if (!types.has(def.type) || hasTrait(hiker, def) || !canHaveTrait(hiker, def)) return false;
    if (def.tier !== null && def.tier !== tier) return false;
    return anyClass || inClass(hiker, def);
  });
}

/**
 * One trait from a pool: first its type (Trail and Utility alike, Morale less
 * often), then a trait of that type. Picking the type first keeps Morale rarer
 * even though there are more Morale traits than any class has.
 */
function pickFromPool(rng: RngState, pool: readonly TraitDef[]): TraitDef {
  const types = [...new Set(pool.map((d) => d.type))];
  const type = weightedPick(
    rng,
    types.map((t) => ({ item: t, weight: t === 'M' ? L.moraleWeight : 1 })),
  );
  return pick(
    rng,
    pool.filter((d) => d.type === type),
  );
}

/** A random setting for a trait that needs one (River Finder, Location: Forest/River). */
export function rollSetting(rng: RngState, kind: TraitSettingKind): TraitSetting {
  const two = <T extends string>(from: readonly T[]) => {
    const [x, y] = shuffle(rng, from);
    return { x: x as string, y: y as string };
  };
  switch (kind) {
    case 'node':
      return { x: pick(rng, NODE_TYPES) };
    case 'nodes':
      return two(NODE_TYPES);
    case 'action':
      return { x: pick(rng, TRAIT_ACTIONS) };
    default:
      return two(TRAIT_ACTIONS);
  }
}

/** A trait option, with a setting rolled if it needs one. */
function traitOption(rng: RngState, def: TraitDef): TraitOption {
  return {
    kind: 'trait',
    traitId: def.id,
    ...(def.setting ? { setting: rollSetting(rng, def.setting) } : {}),
  };
}

const SLOT_KINDS = Object.keys(L.slotWeights) as (keyof typeof L.slotWeights)[];

/** Rolls a level-up's options. `tier` overrides the level's own (the debug panel). */
export function rollOffer(
  state: GameState,
  hiker: Hiker,
  level: number,
  tier?: 1 | 2 | 3,
): TraitOption[] {
  const shape = offerShape(level);
  const t = tier ?? shape.tier;
  const out: TraitOption[] = [];
  const offered = new Set<string>();
  const slotsOffered = new Set<SlotType>();
  for (let i = 0; i < shape.count; i++) {
    // Sometimes a new slot instead (never past 6, and not the same type twice).
    if (canAddSlot(hiker) && roll(state.rng, L.slotChance)) {
      const kinds = SLOT_KINDS.filter((k) => !slotsOffered.has(k));
      if (kinds.length) {
        const slot = weightedPick(
          state.rng,
          kinds.map((k) => ({ item: k, weight: L.slotWeights[k] })),
        );
        slotsOffered.add(slot);
        out.push({ kind: 'slot', slot });
        continue;
      }
    }
    // The last [1] options can come from any class.
    const anyClass = i >= shape.count - L.anyClass;
    const fresh = (pool: TraitDef[]) => pool.filter((d) => !offered.has(d.id));
    let pool = fresh(offerPool(hiker, t, { anyClass }));
    if (!pool.length) pool = fresh(offerPool(hiker, t, { anyClass: true }));
    if (!pool.length) continue;
    const def = pickFromPool(state.rng, pool);
    offered.add(def.id);
    out.push(traitOption(state.rng, def));
  }
  return out;
}

/**
 * Opens the next level-up waiting, if nothing else is being picked: the first
 * hiker in party order with a level reached but not taken.
 */
export function openLevelUp(state: GameState): void {
  if (state.traitPick) return;
  const hiker = state.hikers.find((h) => h.status !== 'abandoned' && (h.pendingLevels ?? 0) > 0);
  if (hiker) openLevelUpFor(state, hiker);
}

/** Opens this hiker's next level-up. `tier` overrides the level's own (the debug panel). */
export function openLevelUpFor(state: GameState, hiker: Hiker, tier?: 1 | 2 | 3): void {
  const level = hiker.level + 1;
  const options = rollOffer(state, hiker, level, tier);
  if (options.length) {
    state.traitPick = { hikerId: hiker.id, source: 'levelUp', level, options };
    return;
  }
  // Nothing fits (every trait taken, 6 slots): the level still counts, and the next one opens.
  pushEvent(state, {
    kind: 'trait',
    hikerId: hiker.id,
    trait: 'Level-up',
    text: `${hiker.name} reached level ${level}, with no new trait that fits.`,
  });
  takeLevel(state, hiker);
  openLevelUp(state);
}

/** The empty slots a trait fits, narrowest first (a T slot before a T/U, a W last). */
export function emptySlotsFor(hiker: Hiker, def: TraitDef): number[] {
  return hiker.slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.traitId && fitsSlot(s.type, def))
    .sort((a, b) => typesFor(a.s.type).length - typesFor(b.s.type).length)
    .map(({ i }) => i);
}

/** The slots whose trait a new trait could replace. */
export function replaceableSlots(hiker: Hiker, def: TraitDef): number[] {
  return hiker.slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !!s.traitId && fitsSlot(s.type, def))
    .map(({ i }) => i);
}

type PickAction = { option: number; replaceSlot?: number };

/** Why this pick can't be taken, or undefined when it can. */
export function pickReason(state: GameState, action: PickAction): string | undefined {
  const open = state.traitPick;
  if (!open) return 'There’s nothing to pick right now.';
  const hiker = state.hikers.find((h) => h.id === open.hikerId);
  const option = open.options[action.option];
  if (!hiker || !option) return 'That isn’t one of the choices.';
  if (option.kind === 'slot') {
    return canAddSlot(hiker) ? undefined : `${hiker.name} already has 6 slots.`;
  }
  const def = TRAITS[option.traitId];
  if (!def) return 'That trait is gone.';
  // Old Photo: always the slot it was used on.
  if (open.slot !== undefined) return undefined;
  if (action.replaceSlot === undefined) {
    return emptySlotsFor(hiker, def).length
      ? undefined
      : `Pick which of ${hiker.name}’s traits ${def.name} replaces.`;
  }
  const slot = hiker.slots[action.replaceSlot];
  if (!slot || !fitsSlot(slot.type, def)) return `${def.name} doesn’t fit that slot.`;
  return undefined;
}

/** Puts a trait in a slot (in place of whatever was there) and logs it. */
export function placeTrait(
  state: GameState,
  hiker: Hiker,
  slotIndex: number,
  traitId: string,
  setting: TraitSetting | undefined,
  cause: string,
  level?: number,
): void {
  const slot = hiker.slots[slotIndex];
  if (!slot) return;
  const replaced = slot.traitId ?? undefined;
  slot.traitId = traitId;
  delete slot.daily;
  if (setting) slot.setting = { ...setting };
  else delete slot.setting;
  pushEvent(state, {
    kind: 'traitGained',
    hikerId: hiker.id,
    cause,
    traitId,
    ...(replaced ? { replaced } : {}),
    ...(level ? { level } : {}),
  });
  // A trait that changes daily gets today's pick now.
  rollDailyTraits(state);
}

/** Adds an empty slot (never past 6) and logs it. */
export function addTraitSlot(
  state: GameState,
  hiker: Hiker,
  slot: SlotType,
  cause: string,
  level?: number,
): void {
  if (!canAddSlot(hiker)) return;
  hiker.slots.push({ type: slot, traitId: null });
  pushEvent(state, {
    kind: 'traitGained',
    hikerId: hiker.id,
    cause,
    slot,
    ...(level ? { level } : {}),
  });
}

/** Takes the picked option, then opens the next level-up waiting. */
export function applyPick(state: GameState, action: PickAction): void {
  const open = state.traitPick;
  const hiker = open && state.hikers.find((h) => h.id === open.hikerId);
  const option = open?.options[action.option];
  if (!open || !hiker || !option) return;
  const levelUp = open.source === 'levelUp';
  const cause = levelUp ? 'Level-up' : 'Old Photo';
  const level = levelUp ? open.level : undefined;
  if (option.kind === 'slot') {
    addTraitSlot(state, hiker, option.slot, cause, level);
  } else {
    const def = TRAITS[option.traitId];
    const slot =
      open.slot ?? action.replaceSlot ?? (def ? emptySlotsFor(hiker, def)[0] : undefined);
    if (slot !== undefined) {
      placeTrait(state, hiker, slot, option.traitId, option.setting, cause, level);
    }
  }
  delete state.traitPick;
  if (levelUp) takeLevel(state, hiker);
  openLevelUp(state);
}

/** The level is taken: MBA's caps, and Proud Mentor on the tile hears of it. */
function takeLevel(state: GameState, hiker: Hiker): void {
  hiker.level += 1;
  hiker.pendingLevels = Math.max(0, (hiker.pendingLevels ?? 0) - 1);
  const ctx = effectContext(state, hiker);
  for (const s of effectSourcesFor(state, hiker)) s.hooks.onLevelUp?.({ level: hiker.level }, ctx);
  for (const other of hikersOnTile(state, hiker.tileId)) {
    if (other.id === hiker.id || other.status !== 'active') continue;
    const octx = effectContext(state, other);
    for (const s of effectSourcesFor(state, other)) {
      s.hooks.onTileLevelUp?.({ hikerId: hiker.id }, octx);
    }
  }
}

/** Special and unique traits stay with their owners: trinkets never hand them out. */
const ownedOnly = (def: TraitDef) => def.kind === 'special' || def.kind === 'unique';

/**
 * What Old Photo can turn a slot's trait into: the same type and tier, from
 * any class, that the hiker can have and doesn't. Special and unique traits
 * can't be swapped. TODO(wyatt): from any class.
 */
export function photoPool(hiker: Hiker, slotIndex: number): TraitDef[] {
  const now = TRAITS[hiker.slots[slotIndex]?.traitId ?? ''];
  if (!now || ownedOnly(now) || now.tagTeam) return [];
  return TRAIT_LIST.filter(
    (def) =>
      def.type === now.type &&
      def.tier === now.tier &&
      !ownedOnly(def) &&
      !hasTrait(hiker, def) &&
      canHaveTrait(hiker, def),
  );
}

/** Opens Old Photo's pick: 3 traits for one of the hiker's slots. */
export function openPhotoPick(state: GameState, hiker: Hiker, slotIndex: number): void {
  const options = shuffle(state.rng, photoPool(hiker, slotIndex))
    .slice(0, 3)
    .map((def) => traitOption(state.rng, def));
  const pickOpen: TraitPick = { hikerId: hiker.id, source: 'oldPhoto', slot: slotIndex, options };
  state.traitPick = pickOpen;
}

/**
 * What a Cherished Photo can give: a Trail or Utility trait of any tier, from
 * any class, that the hiker can have and has an empty slot for.
 * TODO(wyatt): any tier and any class.
 */
export function photoTraitPool(hiker: Hiker): TraitDef[] {
  return TRAIT_LIST.filter(
    (def) =>
      (def.type === 'T' || def.type === 'U') &&
      !ownedOnly(def) &&
      !hasTrait(hiker, def) &&
      canHaveTrait(hiker, def) &&
      emptySlotsFor(hiker, def).length > 0,
  );
}

/** Gives a random trait from the Cherished Photo's pool. Returns its id, if any. */
export function giveRandomTrait(state: GameState, hiker: Hiker, cause: string): string | undefined {
  const pool = photoTraitPool(hiker);
  if (!pool.length) return undefined;
  const def = pick(state.rng, pool);
  const option = traitOption(state.rng, def);
  const slot = emptySlotsFor(hiker, def)[0];
  if (slot === undefined || option.kind !== 'trait') return undefined;
  placeTrait(state, hiker, slot, def.id, option.setting, cause);
  return def.id;
}

/** "ash|2": a trait to copy, by the hiker who has it and its slot. */
export interface CopyChoice {
  from: Hiker;
  slot: number;
  /** The version the receiver gets (Copier becomes Copycat for a Cat). */
  def: TraitDef;
}

/** Reads a Family Photo pick ("ash|2"), if it names a trait. */
export function readCopy(state: GameState, choice: string | undefined): CopyChoice | undefined {
  const [fromId, slotText] = (choice ?? '').split('|');
  const from = state.hikers.find((h) => h.id === fromId);
  const slot = Number(slotText);
  const def = from && TRAITS[from.slots[slot]?.traitId ?? ''];
  return from && def ? { from, slot, def } : undefined;
}

/** Why this trait can't be copied to the receiver, or undefined when it can. */
export function copyReason(receiver: Hiker, copy: CopyChoice): string | undefined {
  if (copy.from.id === receiver.id) return `${receiver.name} already has it.`;
  if (copy.from.status === 'abandoned') return `${copy.from.name} has left the hike.`;
  if (ownedOnly(copy.def) || copy.def.tagTeam) return `${copy.def.name} can’t be copied.`;
  const version = familyVersion(copy.def, receiver.family);
  if (!canHaveTrait(receiver, version)) return `${receiver.name} can’t have ${version.name}.`;
  if (hasTrait(receiver, version)) return `${receiver.name} already has ${version.name}.`;
  if (!emptySlotsFor(receiver, version).length) {
    return `${receiver.name} has no empty slot for ${version.name}.`;
  }
  return undefined;
}

/** Every trait another hiker has that could be copied to the receiver, as picks ("ash|2"). */
export function copyChoices(state: GameState, receiver: Hiker): string[] {
  return state.hikers.flatMap((h) =>
    h.slots.flatMap((_s, i) => {
      const value = `${h.id}|${i}`;
      const copy = readCopy(state, value);
      return copy && !copyReason(receiver, copy) ? [value] : [];
    }),
  );
}

/** Copies a trait (its family version, with its setting) into the receiver's empty slot. */
export function copyTrait(
  state: GameState,
  receiver: Hiker,
  copy: CopyChoice,
  cause: string,
): void {
  const version = familyVersion(copy.def, receiver.family);
  const slot = emptySlotsFor(receiver, version)[0];
  if (slot === undefined) return;
  placeTrait(state, receiver, slot, version.id, copy.from.slots[copy.slot]?.setting, cause);
}
