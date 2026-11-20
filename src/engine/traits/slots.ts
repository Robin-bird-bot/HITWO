/**
 * Trait slots (02-traits-and-conditions.md, "Trait rules"): what fits each
 * slot type, at most 6 slots a hiker, and no trait twice. Special and unique
 * traits take a slot like any other.
 */
import { BALANCE } from '../../config/balance';
import { TRAIT_LIST, TRAITS } from '../../content/traits';
import type { TraitDef } from '../effects';
import type { Family, Hiker, SlotType, TraitType } from '../types';

/** The trait types each slot type holds. A Tag Team slot holds only a Duo's Tag Team trait. */
const HOLDS: Readonly<Record<SlotType, readonly TraitType[]>> = {
  T: ['T'],
  U: ['U'],
  M: ['M'],
  'T/U': ['T', 'U'],
  'T/M': ['T', 'M'],
  'U/M': ['U', 'M'],
  W: ['T', 'U', 'M'],
  tag: [],
};

/** The trait types a slot type can hold. */
export const typesFor = (slot: SlotType): readonly TraitType[] => HOLDS[slot];

/** Does this trait fit a slot of this type? */
export function fitsSlot(slot: SlotType, def: TraitDef): boolean {
  if (slot === 'tag' || def.tagTeam) return slot === 'tag' && !!def.tagTeam;
  return HOLDS[slot].includes(def.type);
}

/** Puller and Leash Puller are the same trait under family names. */
const sameTrait = (a: TraitDef, b: TraitDef) => a.id === b.id || (!!a.group && a.group === b.group);

/**
 * Why this trait can't go in this slot, or null if it can: the slot's type,
 * and no trait twice (counting family versions as the same trait).
 */
export function slotReason(hiker: Hiker, index: number, def: TraitDef): string | null {
  const slot = hiker.slots[index];
  if (!slot) return 'There’s no such slot.';
  if (!fitsSlot(slot.type, def)) return `${def.name} doesn’t fit a ${slot.type} slot.`;
  const twice = hiker.slots.some((s, i) => {
    const other = i !== index && s.traitId ? TRAITS[s.traitId] : undefined;
    return !!other && sameTrait(other, def);
  });
  return twice ? `${hiker.name} already has ${def.name}.` : null;
}

/** Can the hiker take one more slot? At most `BALANCE.traits.maxSlots` (6). */
export const canAddSlot = (hiker: Hiker): boolean => hiker.slots.length < BALANCE.traits.maxSlots;

/**
 * The version of a trait for this family: Leash Puller for a Dog who'd get
 * Puller, Copycat for a Cat who'd get Copier. A trait with no family
 * versions is itself.
 */
export function familyVersion(def: TraitDef, family: Family): TraitDef {
  if (!def.group) return def;
  const versions = TRAIT_LIST.filter((t) => t.group === def.group);
  return versions.find((t) => t.who?.includes(family)) ?? versions.find((t) => !t.who) ?? def;
}

/** Can a hiker of this family have this trait at all (family traits and versions)? */
export const familyCanHave = (def: TraitDef, family: Family): boolean =>
  !def.who || def.who.includes(family);
