/**
 * What the level-up screen shows (Phase 10b, mockups/LevelUp.png), worked out
 * from the game so it's easy to test:
 *
 * - **Option cards:** each trait (or NEW SLOT) on offer, in its type's
 *   colors, with a tag naming where it came from: one of the hiker's roles,
 *   or WILD CARD · ANY CLASS.
 * - **Targets:** while an option is held, which of the hiker's slots it can
 *   go in (REPLACE a trait, or an EMPTY slot) and which it can't. A NEW SLOT
 *   only goes on the + spot.
 * - **The pick:** one option placed in one slot, sent on CONFIRM.
 */
import { CLASS_COLORS, CLASS_NAMES } from '../../content/classes';
import { TRAITS } from '../../content/traits';
import {
  canAddSlot,
  optionSource,
  validateAction,
  type Action,
  type GameState,
  type Hiker,
  type SlotType,
  type TraitOption,
  type TraitPick,
} from '../../engine';
import { BADGE_COLORS, initials, kindWord, SLOT_WORD, type BadgeInfo } from '../traits/badges';

/** A NEW SLOT card, and the + spot it's dropped on. */
export const NEW_SLOT = 'new';
export type SlotTarget = number | typeof NEW_SLOT;

/** One option placed in one slot (or a new slot on the + spot). */
export interface Placement {
  option: number;
  slot: SlotTarget;
}

/** While an option is held: a trait to REPLACE, an EMPTY slot, or no. */
export type Fit = 'replace' | 'empty' | 'no';

export interface OptionCardView {
  /** The top strip. */
  name: string;
  ring: string;
  fill: string;
  /** "TRAIL · USABLE", "MORALE", "TRAIL OR UTILITY". */
  typeLine: string;
  text: string;
  badge: BadgeInfo;
  /** The tag at the bottom: a role in its color, or WILD CARD · ANY CLASS. */
  source?: { label: string; color: string };
}

const TYPE_WORD = { T: 'TRAIL', U: 'UTILITY', M: 'MORALE' } as const;
/** A wild card's tag. */
export const ANY_CLASS = { label: 'WILD CARD · ANY CLASS', color: '#5F6B8A' } as const;
/** A new slot that holds more than one type. */
const MIXED = { ring: '#C9C2B2', fill: '#4A4F5C' } as const;

/** A single-type slot's colors; a mixed or Wild slot is grey. */
export function slotColors(type: SlotType): { ring: string; fill: string } {
  return type === 'T' || type === 'U' || type === 'M' ? BADGE_COLORS[type] : MIXED;
}

/** An offered trait as a badge (diamond, or a circle when it's usable). */
export function optionBadge(option: TraitOption, slot: number, slotType: SlotType): BadgeInfo {
  if (option.kind === 'slot') {
    return {
      slot,
      slotType: option.slot,
      name: 'New slot',
      kindWord: `${SLOT_WORD[option.slot]} slot`,
      text: 'An empty slot for a trait you pick later.',
      shape: 'empty',
      state: 'empty',
      initials: '',
    };
  }
  const def = TRAITS[option.traitId];
  const setting = option.setting;
  const name = (def && setting && def.nameWith?.(setting)) || def?.name || option.traitId;
  return {
    slot,
    slotType,
    traitId: option.traitId,
    name,
    ...(def ? { type: def.type, kindWord: kindWord(def) } : { kindWord: '' }),
    text: (def && setting && def.textWith?.(setting)) || def?.text || '',
    shape: def?.ability ? 'circle' : 'diamond',
    state: 'on',
    initials: initials(name),
  };
}

export function optionCard(hiker: Hiker, option: TraitOption): OptionCardView {
  if (option.kind === 'slot') {
    return {
      name: 'NEW SLOT',
      ...slotColors(option.slot),
      typeLine: SLOT_WORD[option.slot].toUpperCase(),
      text: 'An empty slot for a trait you pick later.',
      badge: optionBadge(option, -1, option.slot),
    };
  }
  const def = TRAITS[option.traitId];
  const badge = optionBadge(option, -1, 'W');
  if (!def) {
    return { name: badge.name.toUpperCase(), ...MIXED, typeLine: '', text: badge.text, badge };
  }
  const from = optionSource(hiker, def);
  const source =
    from === 'any'
      ? ANY_CLASS
      : from
        ? { label: CLASS_NAMES[from].toUpperCase(), color: CLASS_COLORS[from] }
        : undefined;
  return {
    name: badge.name.toUpperCase(),
    ...BADGE_COLORS[def.type],
    typeLine: `${TYPE_WORD[def.type]}${def.ability ? ' · USABLE' : ''}`,
    text: badge.text,
    badge,
    ...(source ? { source } : {}),
  };
}

/** The action CONFIRM sends for a placement. */
export function pickAction(placement: Placement): Action {
  return placement.slot === NEW_SLOT
    ? { type: 'pickTrait', option: placement.option }
    : { type: 'pickTrait', option: placement.option, replaceSlot: placement.slot };
}

/**
 * Where option `index` can go: an answer for each of the hiker's slots, and
 * whether the + spot takes it. An Old Photo's trait only goes in its slot.
 */
export function targetsFor(
  state: GameState,
  open: TraitPick,
  hiker: Hiker,
  index: number,
): { slots: Fit[]; plus: boolean } {
  const option = open.options[index];
  if (!option) return { slots: hiker.slots.map(() => 'no'), plus: false };
  if (option.kind === 'slot') {
    return { slots: hiker.slots.map(() => 'no'), plus: canAddSlot(hiker) };
  }
  const slots = hiker.slots.map((slot, i): Fit => {
    if (open.slot !== undefined && i !== open.slot) return 'no';
    const ok = validateAction(state, { type: 'pickTrait', option: index, replaceSlot: i }) === null;
    if (!ok) return 'no';
    return slot.traitId ? 'replace' : 'empty';
  });
  return { slots, plus: false };
}

/** Whether a placement is allowed. */
export function canPlace(
  state: GameState,
  open: TraitPick,
  hiker: Hiker,
  placement: Placement,
): boolean {
  const t = targetsFor(state, open, hiker, placement.option);
  return placement.slot === NEW_SLOT ? t.plus : (t.slots[placement.slot] ?? 'no') !== 'no';
}

/** Does the offer hold a NEW SLOT (so the + spot shows)? */
export const offersSlot = (open: TraitPick, hiker: Hiker): boolean =>
  canAddSlot(hiker) && open.options.some((o) => o.kind === 'slot');

/** The XP bar: this level's XP so far and needed, from the totals table. */
export function xpBar(
  xp: number,
  level: number,
  xpForLevel: (level: number) => number,
): { have: number; need: number } {
  const from = xpForLevel(level - 1);
  const need = Math.max(1, xpForLevel(level) - from);
  return { have: Math.min(need, Math.max(0, xp - from)), need };
}

/**
 * Card scale so up to 6 fit in a row: full size while they fit in the row's
 * width, smaller after that.
 */
export function cardScale(count: number, { width = 1440, card = 240, gap = 24 } = {}): number {
  if (count <= 1) return 1;
  return Math.min(1, (width - (count - 1) * gap) / (count * card));
}
