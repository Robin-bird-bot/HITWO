/**
 * The challenge pop-up's working state, before Continue: what's been handed
 * into which space, which space is selected, and each section's status.
 * Pure functions of the game state, so they're easy to test. The engine
 * checks the finished answer again when it's dispatched.
 *
 * - Each section (the party, or one hiker) pays with one of the card's
 *   options; handing something into another option's space starts over there.
 * - Filling a space moves the selection on to the next empty one.
 * - A section passes when an option is filled exactly; it fails when its ✗ is
 *   pressed, or when nothing on the tile could pay it.
 */
import { ITEMS, RESOURCES } from '../../content';
import {
  amount,
  challengeHikers,
  foodCarried,
  challengeSections,
  giftCount,
  giftFits,
  notBuiltYet,
  openCardDef,
  optionShortfall,
  requirementNeed,
  resourceFits,
  scaledRange,
  type Action,
  type CardRolls,
  type ChallengeDef,
  type Effect,
  type GameState,
  type Gift,
  type Hiker,
  type HikerId,
  type OpenChallenge,
  type Requirement,
  type ResourceId,
  type StatName,
} from '../../engine';
import { CONDITIONS } from '../../content/conditions';
import { NODE_NAME } from '../map/looks';
import { rangeText } from './cardText';

export interface SectionDraft {
  /** The hiker this section judges; none for the whole party. */
  hikerId?: HikerId;
  /** The option being filled. */
  option?: number;
  gifts: Gift[];
  /** ✗ was pressed: take the penalty. */
  skipped?: true;
}

/** The selected space: section, option and requirement. */
export interface Target {
  section: number;
  option: number;
  req: number;
}

export interface Draft {
  sections: SectionDraft[];
  target?: Target;
}

/** Something in a pack that could be handed in. */
export type Source =
  | { kind: 'resource'; from: HikerId; resource: ResourceId }
  | { kind: 'item'; from: HikerId; uid: string }
  | { kind: 'stat'; from: HikerId; stat: StatName }
  | { kind: 'caps' };

const STAT_WORD: Record<StatName, string> = {
  energy: 'ENERGY',
  appetite: 'APPETITE',
  morale: 'MORALE',
};

const payable = (card: ChallengeDef, option: number) =>
  !!card.cost[option] && !card.cost[option]?.some(notBuiltYet);

/** The draft a fresh pop-up starts with: every section empty, the first space selected. */
export function startDraft(state: GameState, open: OpenChallenge): Draft {
  const sections = challengeSections(state, open).map((s) => ({ ...s, gifts: [] }));
  const draft: Draft = { sections };
  const target = nextTarget(state, open, draft, 0);
  return target ? { ...draft, target } : draft;
}

/** How many have gone into one space. */
export function filledCount(draft: Draft, section: number, option: number, req: number): number {
  const s = draft.sections[section];
  if (!s || s.option !== option) return 0;
  return s.gifts.filter((g) => g.req === req).reduce((n, g) => n + giftCount(g), 0);
}

export function spaceNeed(state: GameState, open: OpenChallenge, draft: Draft, t: Target): number {
  const req = openCardDef(open)?.cost[t.option]?.[t.req];
  if (!req) return 0;
  return requirementNeed(state, open, req, draft.sections[t.section]?.hikerId);
}

/**
 * The first space from this section on that still needs something, trying
 * first the options the tile could actually pay.
 */
function nextTarget(
  state: GameState,
  open: OpenChallenge,
  draft: Draft,
  fromSection: number,
): Target | undefined {
  const card = openCardDef(open);
  if (!card) return undefined;
  for (let section = fromSection; section < draft.sections.length; section++) {
    const s = draft.sections[section];
    if (!s || s.skipped || sectionMet(state, open, draft, section) !== undefined) continue;
    const all = s.option !== undefined ? [s.option] : card.cost.map((_, i) => i);
    const can = (o: number) => couldPay(state, open, o, s.hikerId);
    const options = [...all.filter(can), ...all.filter((o) => !can(o))];
    for (const option of options) {
      if (!payable(card, option)) continue;
      const reqs = card.cost[option] ?? [];
      for (let req = 0; req < reqs.length; req++) {
        const t = { section, option, req };
        if (filledCount(draft, section, option, req) < spaceNeed(state, open, draft, t)) return t;
      }
    }
  }
  return undefined;
}

/** How much of a source is left after what's already been handed in. */
export function left(state: GameState, open: OpenChallenge, draft: Draft, source: Source): number {
  const gifts = draft.sections.flatMap((s) => s.gifts);
  const here = challengeHikers(state, open);
  if (source.kind === 'caps') {
    return state.caps - gifts.reduce((n, g) => n + (g.kind === 'caps' ? g.count : 0), 0);
  }
  const h = here.find((x) => x.id === source.from);
  if (!h) return 0;
  if (source.kind === 'item') {
    const inBag = h.inventory.bag.some((i) => i.uid === source.uid);
    return inBag && !gifts.some((g) => g.kind === 'item' && g.uid === source.uid) ? 1 : 0;
  }
  if (source.kind === 'resource') {
    const used = gifts.reduce(
      (n, g) =>
        n +
        (g.kind === 'resource' && g.from === h.id && g.resource === source.resource ? g.count : 0),
      0,
    );
    return (h.inventory.resources[source.resource] ?? 0) - used;
  }
  const used = gifts.reduce(
    (n, g) => n + (g.kind === 'stat' && g.from === h.id && g.stat === source.stat ? g.count : 0),
    0,
  );
  return h.stats[source.stat] - used;
}

const asGift = (source: Source, req: number): Gift =>
  source.kind === 'caps'
    ? { kind: 'caps', req, count: 1 }
    : source.kind === 'item'
      ? { kind: 'item', req, from: source.from, uid: source.uid }
      : source.kind === 'resource'
        ? { kind: 'resource', req, from: source.from, resource: source.resource, count: 1 }
        : { kind: 'stat', req, from: source.from, stat: source.stat, count: 1 };

/** Can this go into the selected space right now? */
export function canGive(
  state: GameState,
  open: OpenChallenge,
  draft: Draft,
  source: Source,
  t: Target | undefined = draft.target,
): boolean {
  const card = openCardDef(open);
  const req = t && card?.cost[t.option]?.[t.req];
  const section = t && draft.sections[t.section];
  if (!t || !req || !section || !payable(card, t.option)) return false;
  const gift = asGift(source, t.req);
  if (!giftFits(state, open, req, gift, section.hikerId)) return false;
  if (left(state, open, draft, source) < 1) return false;
  if (source.kind === 'stat' && source.stat === 'morale') {
    const h = challengeHikers(state, open).find((x) => x.id === source.from);
    if (!h || h.stats.morale <= 0) return false;
  }
  const mine = section.option === t.option ? section.gifts.filter((g) => g.req === t.req) : [];
  if (filledCount(draft, t.section, t.option, t.req) >= spaceNeed(state, open, draft, t)) {
    return false;
  }
  if (req.kind === 'resources' && req.same && source.kind === 'resource') {
    if (mine.some((g) => g.kind === 'resource' && g.resource !== source.resource)) return false;
  }
  if (req.kind === 'resources' && req.fromEach && source.kind !== 'caps') {
    if (mine.some((g) => g.kind !== 'caps' && g.from === source.from)) return false;
  }
  return true;
}

/** Hands one thing into the selected space, then selects the next empty one. */
export function give(state: GameState, open: OpenChallenge, draft: Draft, source: Source): Draft {
  const t = draft.target;
  if (!t || !canGive(state, open, draft, source)) return draft;
  const sections = draft.sections.map((s, i) => {
    if (i !== t.section) return s;
    const gifts = s.option === t.option ? [...s.gifts] : [];
    const gift = asGift(source, t.req);
    const same = gifts.findIndex(
      (g) =>
        g.req === t.req &&
        g.kind === gift.kind &&
        g.kind !== 'item' &&
        ('from' in g ? g.from : '') === ('from' in gift ? gift.from : '') &&
        (g.kind !== 'resource' || (gift.kind === 'resource' && g.resource === gift.resource)) &&
        (g.kind !== 'stat' || (gift.kind === 'stat' && g.stat === gift.stat)),
    );
    const existing = gifts[same];
    if (existing && existing.kind !== 'item')
      gifts[same] = { ...existing, count: existing.count + 1 };
    else gifts.push(gift);
    return { ...(s.hikerId ? { hikerId: s.hikerId } : {}), option: t.option, gifts };
  });
  const next: Draft = { sections, target: t };
  if (filledCount(next, t.section, t.option, t.req) < spaceNeed(state, open, next, t)) return next;
  const after = nextTarget(state, open, next, t.section);
  return after ? { ...next, target: after } : next;
}

/** Takes one unit of a gift back out of a section. */
export function takeBack(draft: Draft, section: number, gift: Gift): Draft {
  const sections = draft.sections.map((s, i) => {
    if (i !== section) return s;
    const at = s.gifts.indexOf(gift);
    if (at < 0) return s;
    const gifts = [...s.gifts];
    if (gift.kind !== 'item' && gift.count > 1) gifts[at] = { ...gift, count: gift.count - 1 };
    else gifts.splice(at, 1);
    return { ...s, gifts };
  });
  return { ...draft, sections };
}

/** Selects a space. Selecting another option's space keeps what's in the current one for now. */
export function select(draft: Draft, t: Target): Draft {
  const sections = draft.sections.map((s, i) =>
    i === t.section && s.skipped ? { ...s, skipped: undefined } : s,
  );
  return { sections: sections.map(stripUndefined), target: t };
}

function stripUndefined(s: SectionDraft): SectionDraft {
  const out: SectionDraft = { gifts: s.gifts };
  if (s.hikerId) out.hikerId = s.hikerId;
  if (s.option !== undefined) out.option = s.option;
  if (s.skipped) out.skipped = true;
  return out;
}

/** ✗: take the penalty. Whatever was handed in goes back. */
export function skip(draft: Draft, section: number): Draft {
  const sections = draft.sections.map((s, i) =>
    i === section
      ? { ...(s.hikerId ? { hikerId: s.hikerId } : {}), gifts: [], skipped: true as const }
      : s,
  );
  return { ...draft, sections };
}

/** ✓ after a ✗: try paying again. */
export function unskip(draft: Draft, section: number): Draft {
  return {
    ...draft,
    sections: draft.sections.map((s, i) =>
      i === section ? stripUndefined({ ...s, skipped: undefined }) : s,
    ),
  };
}

/** The option this section's gifts pay exactly (an option that needs nothing counts). */
export function sectionMet(
  state: GameState,
  open: OpenChallenge,
  draft: Draft,
  section: number,
): number | undefined {
  const s = draft.sections[section];
  const card = openCardDef(open);
  if (!s || !card || s.skipped) return undefined;
  for (let option = 0; option < card.cost.length; option++) {
    const gifts = s.option === option ? s.gifts : [];
    if (s.option !== undefined && s.option !== option && s.gifts.length) continue;
    if (!optionShortfall(state, open, option, gifts, s.hikerId)) return option;
  }
  return undefined;
}

/** Could what's on the tile ever pay this option for this section? */
export function couldPay(
  state: GameState,
  open: OpenChallenge,
  option: number,
  hikerId?: HikerId,
): boolean {
  const card = openCardDef(open);
  const reqs = card?.cost[option];
  if (!card || !reqs || reqs.some(notBuiltYet)) return false;
  const here = challengeHikers(state, open);
  return reqs.every((req) => {
    const need = requirementNeed(state, open, req, hikerId);
    return supply(state, open, req, here, hikerId) >= need;
  });
}

function supply(
  state: GameState,
  open: OpenChallenge,
  req: Requirement,
  here: readonly Hiker[],
  hikerId?: HikerId,
): number {
  const units = (h: Hiker, fits: (id: ResourceId) => boolean) =>
    Object.entries(h.inventory.resources).reduce((n, [id, c]) => n + (fits(id) ? (c ?? 0) : 0), 0);
  switch (req.kind) {
    case 'resources': {
      const fits = (id: ResourceId) => resourceFits(req.filter, id, open);
      if (req.fromEach) return here.filter((h) => units(h, fits) > 0).length;
      if (req.same) {
        return Math.max(
          0,
          ...RESOURCES.map((r) =>
            here.reduce((n, h) => n + (fits(r.id) ? (h.inventory.resources[r.id] ?? 0) : 0), 0),
          ),
        );
      }
      return here.reduce((n, h) => n + units(h, fits), 0);
    }
    case 'carryLimit': {
      const h = here.find((x) => x.id === hikerId);
      return h ? units(h, () => true) : 0;
    }
    case 'items':
      return here.reduce(
        (n, h) =>
          n +
          h.inventory.bag.filter((i) => {
            const type = ITEMS[i.itemId]?.type;
            return !!type && (!req.itemTypes || req.itemTypes.includes(type));
          }).length,
        0,
      );
    case 'caps':
      return state.caps;
    case 'stat':
      return here.reduce(
        (n, h) =>
          n +
          req.stats.reduce(
            (m, stat) => m + (stat === 'morale' && h.stats.morale <= 0 ? 0 : h.stats[stat]),
            0,
          ),
        0,
      );
    case 'durability':
    case 'toolUse':
      return 0;
  }
}

export type Decision = 'pay' | 'fail' | undefined;

export interface SectionStatus {
  decision: Decision;
  /** The option it pays, when it passes. */
  option?: number;
  /** Nothing on the tile could pay it. */
  impossible: boolean;
  /** How many more the option being filled needs. */
  missing: number;
}

export function sectionStatus(
  state: GameState,
  open: OpenChallenge,
  draft: Draft,
  section: number,
): SectionStatus {
  const s = draft.sections[section];
  const card = openCardDef(open);
  if (!s || !card) return { decision: undefined, impossible: true, missing: 0 };
  const met = sectionMet(state, open, draft, section);
  const impossible = !card.cost.some((_, o) => couldPay(state, open, o, s.hikerId));
  const picked = draft.target?.section === section ? draft.target.option : undefined;
  const option = s.option ?? picked ?? card.cost.findIndex((_, o) => payable(card, o));
  const reqs = card.cost[option] ?? [];
  const missing = reqs.reduce((n, _, req) => {
    const t = { section, option, req };
    return (
      n + Math.max(0, spaceNeed(state, open, draft, t) - filledCount(draft, section, option, req))
    );
  }, 0);
  const decision: Decision = s.skipped
    ? 'fail'
    : met !== undefined
      ? 'pay'
      : impossible
        ? 'fail'
        : undefined;
  return { decision, ...(met !== undefined ? { option: met } : {}), impossible, missing };
}

/** The finished answer, once every section is decided. */
export function toAction(
  state: GameState,
  open: OpenChallenge,
  draft: Draft,
): Extract<Action, { type: 'resolveChallenge' }> | undefined {
  const sections = [];
  for (const [i, s] of draft.sections.entries()) {
    const status = sectionStatus(state, open, draft, i);
    if (!status.decision) return undefined;
    const who = s.hikerId ? { hikerId: s.hikerId } : {};
    if (status.decision === 'fail') sections.push({ ...who, pay: false, gifts: [] });
    else {
      const gifts = s.option === status.option ? s.gifts : [];
      sections.push({ ...who, pay: true, option: status.option ?? 0, gifts });
    }
  }
  return { type: 'resolveChallenge', sections };
}

// ── Words ───────────────────────────────────────────────────────────────────

const names = (ids: readonly string[]) =>
  ids.map((id) => (RESOURCES.find((r) => r.id === id)?.name ?? id).toUpperCase()).join(' · ');

/** "FISH · MEAT · MUSHROOM", "FOOD CARD", "ENERGY". */
export function reqLabel(req: Requirement, open: OpenChallenge): string {
  switch (req.kind) {
    case 'resources': {
      const f = req.filter;
      const what = f?.randomOf
        ? names(open.rolls.options ?? [])
        : f?.ids
          ? names(f.ids)
          : f?.nodes
            ? f.nodes.map((n) => NODE_NAME[n].toUpperCase()).join(' · ')
            : 'ANY RESOURCE';
      if (req.fromEach) return `${what} FROM EACH`;
      return req.same ? `${what} (ALL THE SAME)` : what;
    }
    case 'items':
      return req.itemTypes
        ? `${req.itemTypes.map((t) => t.toUpperCase()).join(' OR ')} CARD`
        : 'ANY ITEM';
    case 'caps':
      return 'CAPS';
    case 'stat':
      return req.stats.map((s) => STAT_WORD[s]).join(' · ');
    case 'durability':
      return 'CLOTHING DURABILITY';
    case 'toolUse':
      return 'A TOOL USE';
    case 'carryLimit':
      return `CARRY ${req.max} OR FEWER`;
  }
}

/** Resource ids to show as faint icons in an empty space (up to 3). */
export function reqIcons(req: Requirement, open: OpenChallenge): ResourceId[] {
  if (req.kind !== 'resources') return [];
  const f = req.filter;
  if (f?.randomOf) return (open.rolls.options ?? []).slice(0, 3);
  if (f?.ids) return f.ids.slice(0, 3);
  if (f?.nodes) {
    return RESOURCES.filter((r) => f.nodes?.includes(r.node))
      .slice(0, 3)
      .map((r) => r.id);
  }
  return [];
}

const UNIT = { phases: 'PHASE', days: 'DAY', nights: 'NIGHT' } as const;

/**
 * A short name for what failing costs, for the status line: "1 INJURY",
 * "60%: STRAINED 2 DAYS". With a hiker, a Y shows as their own number.
 */
export function penaltyTag(card: ChallengeDef, rolls: CardRolls, hiker?: Hiker): string {
  const e = card.penalty.find((p) => !p.onlyIf || rolls.includes[p.onlyIf]);
  if (!e) return 'NO PENALTY';
  const n = (a: Parameters<typeof amount>[0]) => {
    if (typeof a === 'string' && card.rolls?.[a]?.roll === 'y' && !hiker) {
      const def = card.rolls[a];
      return def ? rangeText(scaledRange(def, 1)) : '?';
    }
    return String(amount(a, { rolls, onTile: [], foodCarried, ...(hiker ? { hiker } : {}) }));
  };
  const chance = (p: Effect) =>
    typeof p.chance === 'number' ? `${Math.round(p.chance * 100)}%: ` : '';
  switch (e.op) {
    case 'injury':
      return `${chance(e)}1 INJURY`;
    case 'condition': {
      const len = n(e.duration);
      const unit = `${UNIT[e.unit]}${len === '1' ? '' : 'S'}`;
      return `${chance(e)}${(CONDITIONS[e.id]?.name ?? e.id).toUpperCase()} ${len} ${unit}`;
    }
    case 'stat':
      return `${chance(e)}${e.lose ? '−' : '+'}${n(e.delta)} ${STAT_WORD[e.stat]}`;
    case 'xp':
      return `${chance(e)}${e.lose ? '−' : '+'}${n(e.delta)} XP`;
    case 'loseResources':
      return `LOSES ${n(e.count)} RESOURCES`;
    case 'move':
      return 'MOVED BACK';
    default:
      return 'THE PENALTY';
  }
}

/** What a passing section paid, for its status line: "TRAIL MIX", "3 RESOURCES", "2 ENERGY". */
export function paidLabel(gifts: readonly Gift[], state: GameState, open: OpenChallenge): string {
  if (!gifts.length) return 'NOTHING TO SPEND';
  const here = challengeHikers(state, open);
  const parts: string[] = [];
  const items = gifts.filter((g) => g.kind === 'item');
  if (items.length === 1 && items[0]?.kind === 'item') {
    const g = items[0];
    const item = here.find((h) => h.id === g.from)?.inventory.bag.find((i) => i.uid === g.uid);
    parts.push((ITEMS[item?.itemId ?? '']?.name ?? 'AN ITEM').toUpperCase());
  } else if (items.length) parts.push(`${items.length} CARDS`);
  const res = gifts.reduce((n, g) => n + (g.kind === 'resource' ? g.count : 0), 0);
  if (res) parts.push(`${res} ${res === 1 ? 'RESOURCE' : 'RESOURCES'}`);
  const caps = gifts.reduce((n, g) => n + (g.kind === 'caps' ? g.count : 0), 0);
  if (caps) parts.push(`${caps} CAPS`);
  for (const stat of ['energy', 'appetite', 'morale'] as const) {
    const pts = gifts.reduce((n, g) => n + (g.kind === 'stat' && g.stat === stat ? g.count : 0), 0);
    if (pts) parts.push(`${pts} ${STAT_WORD[stat]}`);
  }
  return parts.join(' + ');
}
