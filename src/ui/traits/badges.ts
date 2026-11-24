/**
 * Trait badges (docs/mockups/TraitBadges.dc.html): what each of a hiker's
 * slots shows. Pure, so it's easy to test.
 *
 * - A **diamond** for an always-on trait (every Morale trait among them), a
 *   **circle** for a usable one (it has an ability), and a faint outline for
 *   an empty slot.
 * - A usable trait is **ready** (uses left), **used** (back next phase, day
 *   or biome) or only usable **during** something (Gambler, in a scavenge).
 * - The hover window shows the name, the type, what it does, and a status
 *   line when there's something to say right now.
 */
import {
  abilitiesFor,
  dailyPickName,
  workingTrait,
  type GameState,
  type Hiker,
  type SlotType,
  type TraitDef,
  type ClassId,
  toggleOn,
  workingNow,
} from '../../engine';
import type { ForecastView } from './forecastView';
import { shade, stepBadge } from '../trails/stepLook';

export type BadgeState = 'on' | 'ready' | 'used' | 'during' | 'empty';
export type BadgeShape = 'diamond' | 'circle' | 'square' | 'empty';

export interface BadgeStatus {
  text: string;
  /** Ready to use, used up, a Morale gain or loss coming, or just something to know. */
  tone: 'ready' | 'used' | 'gain' | 'loss' | 'info';
}

export interface BadgeInfo {
  slot: number;
  slotType: SlotType;
  /** The trait in the slot; none for an empty slot. */
  traitId?: string;
  /** Its name as it works today ("River Finder", "Quirky (Focused)"). */
  name: string;
  /** Trail, Utility or Morale: the ring's color. An empty slot has none. */
  type?: TraitDef['type'];
  /** "Trail · Tier II", "Morale", "Utility · Special". */
  kindWord: string;
  text: string;
  shape: BadgeShape;
  state: BadgeState;
  /** A usable trait's uses left and per period, when it has a set number. */
  usesLeft?: number;
  usesMax?: number;
  /** What it can only be used during, as the badge's tab ("SCAVENGE"). */
  during?: string;
  abilityId?: string;
  status?: BadgeStatus;
  /** The stand-in icon for a trait with no icon file yet: its initials. */
  initials: string;
  /** Trait warnings: the Morale this Morale trait is about to give or take. */
  morale?: { delta: number; when: 'now' | 'tomorrow' };
  /** Trait warnings: whether this trait's condition holds right now (Focused: alone). */
  working?: boolean;
  /** Skill Trails (Phase 10.7): the class color, in place of the type's. */
  color?: string;
  /** An upgrade's tag: II or III. */
  tag?: 'II' | 'III';
  /** No icon file yet: the class glyph in place of initials. */
  glyph?: ClassId;
  /** A toggle (a rounded square): filled when on, outlined when off. */
  toggle?: { on: boolean; canSwitch: boolean };
}

const TYPE_WORD = { T: 'Trail', U: 'Utility', M: 'Morale' } as const;
const NUMERAL = { 1: 'I', 2: 'II', 3: 'III' } as const;
/** A slot's type in words ("Trail or Utility"). */
export const SLOT_WORD: Readonly<Record<SlotType, string>> = {
  T: 'Trail',
  U: 'Utility',
  M: 'Morale',
  'T/U': 'Trail or Utility',
  'T/M': 'Trail or Morale',
  'U/M': 'Utility or Morale',
  W: 'Wild',
  tag: 'Tag Team',
  trail: 'Skill Trails',
};
const THIS = { phase: 'this phase', day: 'today', biome: 'this biome' } as const;
const BACK = { phase: 'next phase', day: 'tomorrow', biome: 'in the next biome' } as const;

/** "Trail · Tier II", "Morale", "Utility · Special". */
export function kindWord(def: TraitDef): string {
  const type = TYPE_WORD[def.type];
  if (def.kind === 'special') return `${type} · Special`;
  if (def.kind === 'unique') return `${type} · Unique`;
  return def.tier ? `${type} · Tier ${NUMERAL[def.tier]}` : type;
}

/** "Le" for Leader, "SW" for Second Wind, "RF" for River Finder: the placeholder icon. */
export function initials(name: string): string {
  const words = name
    .replace(/\(.*\)|\[.*?\]/g, '')
    .trim()
    .split(/[\s&-]+/)
    .filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  const w = words[0] ?? '?';
  return `${w[0]?.toUpperCase() ?? '?'}${w[1]?.toLowerCase() ?? ''}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A Morale trait's coming change, from the forecast: its total, when, and why. */
function moraleComing(
  view: ForecastView,
  hikerId: string,
  names: readonly string[],
): { delta: number; when: 'now' | 'tomorrow'; why?: string } | undefined {
  const mine = (when: 'now' | 'tomorrow') =>
    (view[when][hikerId]?.parts ?? []).filter((p) => names.includes(p.trait));
  const now = mine('now');
  const tomorrow = mine('tomorrow');
  const sum = (ps: typeof now) => ps.reduce((n, p) => n + p.delta, 0);
  const delta = sum(now) + sum(tomorrow);
  if (!delta) return undefined;
  const when = sum(now) ? 'now' : 'tomorrow';
  const why = (when === 'now' ? now : tomorrow).find((p) => p.why)?.why;
  return { delta, when, ...(why ? { why } : {}) };
}

/**
 * Every slot's badge, in slot order. With a forecast (trait warnings on),
 * Morale badges say what they're about to do and the others whether they're
 * working right now.
 */
export function traitBadges(state: GameState, hiker: Hiker, view?: ForecastView): BadgeInfo[] {
  const abilities = abilitiesFor(state, hiker);
  // The hiker as the forecast sees them (after an action being looked at).
  const later = view?.state.hikers.find((h) => h.id === hiker.id);
  return hiker.slots.map((slot, i): BadgeInfo => {
    const working = workingTrait(state, slot);
    if (!working) {
      return {
        slot: i,
        slotType: slot.type,
        name: 'Empty slot',
        kindWord: `${SLOT_WORD[slot.type]} slot`,
        text: slot.type === 'W' ? 'Any trait can go here.' : 'A trait of this type can go here.',
        shape: 'empty',
        state: 'empty',
        initials: '',
      };
    }
    const { def, runs } = working;
    const base: BadgeInfo =
      slot.type === 'trail'
        ? trailBase(state, hiker, def.id, i)
        : {
            slot: i,
            slotType: slot.type,
            traitId: def.id,
            name: working.name,
            type: def.type,
            kindWord: kindWord(def),
            text: working.text,
            shape: 'diamond',
            state: 'on',
            initials: initials(working.name),
          };
    // What it is today, for one that changes each morning (Nosework's node, Moody's mood).
    const today = slot.daily?.day === state.day ? slot.daily.pick : undefined;
    if (def.daily && def.daily !== 'trait' && today) {
      base.status = { text: `Today: ${dailyPickName(today)}.`, tone: 'info' };
    }
    // Waiting on a rule the game doesn't have yet (Sit by the Fire).
    const waits = runs.waitsOn ?? def.waitsOn;
    if (waits) base.status = { text: `Works once ${waits} is in the game.`, tone: 'info' };

    // Trait warnings: what a Morale trait is about to do, or whether another is working now.
    if (view && def.type === 'M') {
      const coming = moraleComing(view, hiker.id, [def.name, working.name]);
      if (coming) {
        const n = Math.abs(coming.delta);
        const verb = coming.delta > 0 ? 'gains' : 'loses';
        const when = coming.when === 'now' ? 'now' : 'tomorrow morning';
        base.morale = { delta: coming.delta, when: coming.when };
        base.status = {
          text: `${coming.why ? `${capitalize(coming.why)}: ` : ''}${verb} ${n} Morale ${when}.`,
          tone: coming.delta > 0 ? 'gain' : 'loss',
        };
      }
    } else if (view && later) {
      const works = workingNow(view.state, later, i);
      if (works !== undefined) {
        base.working = works;
        base.status ??= {
          text: works ? 'Working right now.' : 'Not working right now.',
          tone: 'info',
        };
      }
    }

    const ability = runs.ability;
    const available = ability && abilities.find((a) => a.ability.id === ability.id);
    if (!ability || !available) return base;
    const per = ability.limit.per;
    const finite = Number.isFinite(ability.limit.uses);
    const usable: BadgeInfo = {
      ...base,
      shape: base.shape === 'square' ? 'square' : 'circle',
      abilityId: ability.id,
      ...(finite ? { usesLeft: available.usesLeft, usesMax: ability.limit.uses } : {}),
    };
    if (finite && available.usesLeft <= 0) {
      return {
        ...usable,
        state: 'used',
        status: { text: `Used. Back ${BACK[per]}.`, tone: 'used' },
      };
    }
    if (ability.scavengeReroll) {
      return {
        ...usable,
        state: 'during',
        during: 'SCAVENGE',
        status: { text: 'Only during a scavenge.', tone: 'info' },
      };
    }
    return {
      ...usable,
      state: 'ready',
      status: {
        text: finite
          ? `Ready: ${plural(available.usesLeft, 'use')} ${THIS[per]}.`
          : 'Ready: use it any time.',
        tone: 'ready',
      },
    };
  });
}

/**
 * A Skill Trails trait's badge (Phase 10.7): its class color, shape, tag and
 * glyph, and for a toggle whether it's on and can be switched now.
 */
function trailBase(state: GameState, hiker: Hiker, traitId: string, slot: number): BadgeInfo {
  const base = stepBadge(traitId, slot);
  if (base.shape !== 'square') return base;
  const on = toggleOn(hiker, traitId);
  const canSwitch = hiker.status === 'active' && !blockingWindow(state);
  return {
    ...base,
    toggle: { on, canSwitch },
    status: {
      text: on ? 'On now. Click to switch it off.' : 'Off now. Click to switch it on.',
      tone: 'info',
    },
  };
}

/** Something open that a toggle waits for: a scavenge, a craft, a challenge, a pick. */
export const blockingWindow = (state: GameState): boolean =>
  !!(state.scavenge || state.crafting || state.challenge || state.presentPick || state.traitPick);

/** Ring and middle colors by type; grey for a used-up trait (the mockup's). */
export const BADGE_COLORS = {
  T: { ring: '#F2B950', fill: '#8A6320' },
  U: { ring: '#9CC3A8', fill: '#4C7759' },
  M: { ring: '#CDA6EE', fill: '#6B4C8F' },
  used: { ring: '#6F6A60', fill: '#3A3833' },
} as const;

/** Trait warnings: a Morale badge's middle before a gain or a loss (the mockup's). */
export const WARNING_FILL = { gain: '#3F8A57', loss: '#B4472F' } as const;

export const badgeColors = (b: BadgeInfo): { ring: string; fill: string } => {
  if (b.state === 'used') return BADGE_COLORS.used;
  if (b.color) return { ring: b.color, fill: shade(b.color, 0.42) };
  return b.type ? BADGE_COLORS[b.type] : BADGE_COLORS.used;
};
