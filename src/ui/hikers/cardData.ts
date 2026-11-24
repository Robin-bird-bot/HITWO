/**
 * What a hiker card shows (Phase 10b, mockups/HikerCards.png), worked out
 * from the roster so it's easy to test:
 *
 * - **Front:** the name and "TITLE", the role tabs (main first), one badge
 *   per slot (an open slot is a dashed diamond), and the starting bag.
 * - **Back:** the same, with one row per slot spelling each trait out.
 *
 * Phase 10.7: a designed hiker's card shows their 3 trees' classes as tabs,
 * the 3 Tier 1 traits they can start with, and on the back the 3 trees with
 * their traits. Every other hiker is locked: a black silhouette, "Locked",
 * and nothing else.
 */
import { CLASS_COLORS, CLASS_NAMES } from '../../content/classes';
import { ITEMS } from '../../content/items';
import { ROSTER_BY_ID, type RosterHiker } from '../../content/roster';
import { TRAITS } from '../../content/traits';
import type { StartingBag } from '../../engine/newGame';
import type { TraitSlot } from '../../engine/types';
import { initials, kindWord, SLOT_WORD, type BadgeInfo } from '../traits/badges';
import { familyIcon, type FamilyIcon } from './portraitArt';
import { TREES_BY_HIKER, type HikerTrees } from '../../content/trails/trees';
import { stepText } from '../../content/trails/traits';
import { stepBadge } from '../trails/stepLook';

export interface CardRole {
  id: string;
  /** In capitals, as the banner shows it. */
  name: string;
  color: string;
}

export interface CardRow {
  /** None for an open slot. */
  traitId?: string;
  type?: 'T' | 'U' | 'M';
  name: string;
  text: string;
  /** Usable traits: a round icon and a USABLE tag. */
  usable: boolean;
  open: boolean;
}

export interface HikerCardData {
  id: string;
  name: string;
  /** For screen readers: "Finn, The Follower. Tank." */
  label: string;
  /** In capitals and quotes; none yet for Ben, Mindy and the variants. */
  title?: string;
  family: FamilyIcon;
  /** Variants show the star next to their family icon. */
  variant: boolean;
  roles: CardRole[];
  /** The main role's color: the STARTING BAG tab. */
  mainColor: string;
  badges: BadgeInfo[];
  rows: CardRow[];
  /** "Dog Food + 1 random Tier 1 blueprint". */
  bag: string;
  /** Locked (Phase 10.7): only the silhouette and "Locked" show. */
  locked: boolean;
  /** A designed hiker's 3 trees, for the back (Phase 10.7). */
  trees?: CardTree[];
}

export interface CardTree {
  id: string;
  /** "Leader Trail". */
  name: string;
  color: string;
  steps: { stepId: string; name: string; text: string; upgrade: boolean }[];
}

/** An open slot on a card: filled on a level-up. */
const OPEN = { name: 'Open slot', text: 'Filled on a level-up.' } as const;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A starting bag in words: "Leash", "2 Dog Food", "Dog Food + 1 random Tier 1 blueprint". */
export function bagWords(bag: StartingBag): string {
  const counts = new Map<string, number>();
  for (const id of bag.items ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  const parts = [...counts].map(([id, n]) => {
    const name = ITEMS[id]?.name ?? id;
    return n === 1 ? name : `${n} ${name}`;
  });
  // The holiday hikers' Presents.
  if (bag.presents) parts.push(bag.presents === 1 ? 'Present' : `${bag.presents} Presents`);
  const bp = bag.blueprints;
  if (bp && bp.count > 0) {
    const kind = bp.type ? `${bp.type} blueprint` : 'blueprint';
    parts.push(`${bp.count} random Tier ${bp.tier} ${plural(bp.count, kind).replace(/^\d+ /, '')}`);
  }
  return parts.join(' + ');
}

/** A slot's trait as the card spells it: its setting filled in ("River Finder"). */
function slotTrait(slot: TraitSlot) {
  const def = slot.traitId ? TRAITS[slot.traitId] : undefined;
  if (!def) return undefined;
  const setting = slot.setting;
  const set = setting?.x !== undefined ? setting : undefined;
  return {
    def,
    name: (set && def.nameWith?.(set)) || def.name,
    text: (set && def.textWith?.(set)) || def.text,
  };
}

/** A locked hiker's card: nothing but the silhouette and the word. */
function lockedCard(hiker: RosterHiker): HikerCardData {
  return {
    id: hiker.id,
    name: 'Locked',
    label: 'A locked hiker.',
    family: familyIcon(hiker),
    variant: false,
    roles: [],
    mainColor: CLASS_COLORS.jack,
    badges: [],
    rows: [],
    bag: '',
    locked: true,
  };
}

/** A designed hiker's card: tree classes, Tier 1 badges, and the trees on the back. */
function trailCard(hiker: RosterHiker, trees: HikerTrees): HikerCardData {
  const roles = trees.trees.map((t) => ({
    id: t.cls,
    name: CLASS_NAMES[t.cls].toUpperCase(),
    color: CLASS_COLORS[t.cls],
  }));
  const roleWords = trees.trees.map((t) => CLASS_NAMES[t.cls]).join(', ');
  return {
    id: hiker.id,
    name: hiker.name,
    label: `${hiker.name}${hiker.title ? `, ${hiker.title}` : ''}. ${roleWords}.`,
    ...(hiker.title ? { title: `"${hiker.title.toUpperCase().replace(/’/g, "'")}"` } : {}),
    family: familyIcon(hiker),
    variant: !!hiker.variantOf,
    roles,
    mainColor: roles[0]?.color ?? CLASS_COLORS.jack,
    badges: trees.trees.map((t, i) => stepBadge(t.steps[0].id, i)),
    rows: [],
    bag: bagWords(hiker.startingBag),
    locked: false,
    trees: trees.trees.map((t) => ({
      id: t.id,
      name: t.name,
      color: CLASS_COLORS[t.cls],
      steps: t.steps.map((step) => ({
        stepId: step.id,
        name: step.name,
        text: stepText(step),
        upgrade: step.step === 'upgrade',
      })),
    })),
  };
}

export function hikerCardData(hiker: RosterHiker): HikerCardData {
  if (hiker.locked) return lockedCard(hiker);
  const trees = TREES_BY_HIKER.get(hiker.id);
  if (trees) return trailCard(hiker, trees);
  const roles = (hiker.classes ?? []).map((id) => ({
    id,
    name: CLASS_NAMES[id].toUpperCase(),
    color: CLASS_COLORS[id],
  }));
  const badges: BadgeInfo[] = [];
  const rows: CardRow[] = [];
  hiker.slots.forEach((slot, i) => {
    const t = slotTrait(slot);
    if (!t) {
      badges.push({
        slot: i,
        slotType: slot.type,
        name: OPEN.name,
        kindWord: `${SLOT_WORD[slot.type]} slot`,
        text: OPEN.text,
        shape: 'empty',
        state: 'empty',
        initials: '',
      });
      rows.push({ name: OPEN.name, text: OPEN.text, usable: false, open: true });
      return;
    }
    const usable = !!t.def.ability;
    badges.push({
      slot: i,
      slotType: slot.type,
      traitId: t.def.id,
      name: t.name,
      type: t.def.type,
      kindWord: kindWord(t.def),
      text: t.text,
      shape: usable ? 'circle' : 'diamond',
      state: 'on',
      initials: initials(t.name),
    });
    rows.push({
      traitId: t.def.id,
      type: t.def.type,
      name: t.name,
      text: t.text,
      usable,
      open: false,
    });
  });
  const roleWords = (hiker.classes ?? []).map((id) => CLASS_NAMES[id]).join(' and ');
  return {
    id: hiker.id,
    name: hiker.name,
    label: `${hiker.name}${hiker.title ? `, ${hiker.title}` : ''}.${roleWords ? ` ${roleWords}.` : ''}`,
    ...(hiker.title ? { title: `"${hiker.title.toUpperCase().replace(/’/g, "'")}"` } : {}),
    family: familyIcon(hiker),
    variant: !!hiker.variantOf,
    roles,
    mainColor: roles[0]?.color ?? CLASS_COLORS.jack,
    badges,
    rows,
    bag: bagWords(hiker.startingBag),
    locked: false,
  };
}

const cache = new Map<string, HikerCardData>();

/** A roster hiker's card, by id (the roster never changes during a session). */
export function cardFor(hikerId: string): HikerCardData | undefined {
  const hit = cache.get(hikerId);
  if (hit) return hit;
  const hiker = ROSTER_BY_ID.get(hikerId);
  if (!hiker) return undefined;
  const data = hikerCardData(hiker);
  cache.set(hikerId, data);
  return data;
}

const startCache = new Map<string, HikerCardData>();

/**
 * A BY STARTING TRAIT card (Phase 10.7): the hiker with one start, so it
 * shows that tree's class alone and the one trait it starts with.
 */
export function cardForStart(hikerId: string, start: string): HikerCardData | undefined {
  const key = `${hikerId}:${start}`;
  const hit = startCache.get(key);
  if (hit) return hit;
  const data = cardFor(hikerId);
  const at = data?.trees?.findIndex((t) => t.id === start) ?? -1;
  if (!data || at < 0) return data;
  const role = data.roles[at];
  const badge = data.badges[at];
  const card: HikerCardData = {
    ...data,
    roles: role ? [role] : [],
    mainColor: role?.color ?? data.mainColor,
    badges: badge ? [{ ...badge, slot: 0 }] : [],
  };
  startCache.set(key, card);
  return card;
}
