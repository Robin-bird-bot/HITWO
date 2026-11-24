/**
 * XP and levels (01-design-doc.md, "XP"; Wyatt, Nov 20). Every XP gain goes
 * through gainXp:
 *
 * - **Milestones** (a checkpoint, a challenge passed, an objective, a Wonder,
 *   a Diploma) always count.
 * - **Action XP** (crafting, a lucky scavenge draw, the fire) follows the row
 *   rule: it only counts on the hiker's first day on a row. Moving forward
 *   starts the new row at once; going back or sideways earns nothing new.
 * - Bonuses: first the ones for this kind of gain (Postcard, Textbook), then,
 *   if there's any XP, the ones for every gain (Thinking Cap, Linguist, and
 *   Mentor or Trainer on the tile): flat amounts, then percentages, rounded up.
 * - Then others hear of it (Wise, VR Headset). XP they pass on is plain: no
 *   bonuses, and it isn't passed on again.
 *
 * Party XP (Phase 10.7, 09-hikers.md): every hiker's XP fills one party bar.
 * Party levels need 20, 50, 90, 140, 200 and 270 XP in all, each 10 more than
 * the last (today's per-hiker curve, for now), and each one gives points to
 * spend on Skill Trails (src/engine/trails.ts). Hikers no longer level up on
 * their own.
 */
import { BALANCE } from '../config/balance';
import { effectContext, effectSourcesFor, queryContext, type XpModifier } from './effects';
import { pushEvent } from './log';
import type { GameState, Hiker, PartyXp, XpSource } from './types';

const X = BALANCE.xp;

/** Action XP follows the row rule; everything else is a milestone. */
export const ACTION_XP: readonly XpSource[] = ['craft', 'scavenge', 'fire'];

/** Total XP needed to reach a level (level 1: 20). Past the table, each level needs 10 more. */
export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  const table = X.levelAt;
  if (level <= table.length) return table[level - 1] ?? 0;
  let total = table[table.length - 1] ?? 0;
  let step = total - (table[table.length - 2] ?? 0);
  for (let l = table.length + 1; l <= level; l++) {
    step += X.stepGrowth;
    total += step;
  }
  return total;
}

/** The level this much XP reaches. */
export function levelForXp(xp: number): number {
  let level = 0;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

/** The level a hiker reached in the old system (before Phase 10.7). */
export const levelReached = (h: Hiker): number => h.level + (h.pendingLevels ?? 0);

/** The party's bar: XP, the level reached and the points not spent yet. */
export const partyOf = (state: Readonly<GameState>): PartyXp =>
  state.party ?? { xp: 0, level: 0, points: 0 };

/**
 * Adds XP to the party bar. Each level it reaches gives its points at once,
 * with a "Party level 3! +1 point" event.
 */
export function addPartyXp(state: GameState, xp: number): void {
  const party = (state.party ??= { xp: 0, level: 0, points: 0 });
  party.xp += Math.max(0, xp);
  const reached = levelForXp(party.xp);
  while (party.level < reached) {
    party.level += 1;
    const points = BALANCE.trails.pointsPerLevel;
    party.points += points;
    pushEvent(state, { kind: 'partyLevel', level: party.level, points });
  }
}

/** Where a hiker is for the row rule: a new section or a row further on starts today. */
export function noteXpRow(state: GameState, h: Hiker): void {
  if (h.status === 'abandoned') return;
  const row = state.section.tiles[h.tileId]?.row;
  if (row === undefined) return;
  const r = h.xpRow;
  if (!r || r.section !== state.sectionIndex || row > r.row) {
    h.xpRow = { section: state.sectionIndex, row, day: state.day };
  }
}

/** Notes every hiker's row. Runs after every action, so a move forward starts its row at once. */
export function noteXpRows(state: GameState): void {
  for (const h of state.hikers) noteXpRow(state, h);
}

/** Can this hiker earn action XP where they are now: their furthest row, on the day they got there? */
export function onXpRow(state: GameState, h: Hiker): boolean {
  const r = h.xpRow;
  const row = state.section.tiles[h.tileId]?.row;
  return !!r && r.section === state.sectionIndex && r.row === row && r.day === state.day;
}

export interface XpOptions {
  /** A second card in the same scavenge (Gambler): "every scavenge" bonuses count once. */
  repeat?: boolean;
  /** The caller's own log line already says the XP: only log it when a bonus changed it. */
  quiet?: boolean;
}

/** Others on the hiker's tile, checked-in ones too (everyone at a checkpoint is together). */
export const xpCompany = (state: GameState, h: Hiker): Hiker[] =>
  state.hikers.filter(
    (o) =>
      o.id !== h.id && o.tileId === h.tileId && (o.status === 'active' || o.status === 'checkedIn'),
  );
const company = xpCompany;

/** XP with every bonus that applies, before it's added. */
function withBonuses(
  state: GameState,
  hiker: Hiker,
  base: number,
  source: XpSource,
  repeat: boolean,
): number {
  if (source === 'shared' || source === 'debug') return base;
  const ctx = queryContext(state, hiker);
  const own = effectSourcesFor(state, hiker);
  const q = { source, amount: base, ...(repeat ? { repeat: true as const } : {}) };
  let xp = base;
  for (const s of own) xp += s.hooks.xpForSource?.(q, ctx) ?? 0;
  if (xp <= 0) return 0;
  const mods: XpModifier[] = [];
  const each = { ...q, amount: xp };
  for (const s of own) {
    const m = s.hooks.modifyXp?.(each, ctx);
    if (m) mods.push(m);
  }
  for (const other of company(state, hiker)) {
    const octx = queryContext(state, other);
    for (const s of effectSourcesFor(state, other)) {
      const m = s.hooks.modifyTileXp?.(each, hiker, octx);
      if (m) mods.push(m);
    }
  }
  const flat = mods.reduce((n, m) => n + (m.flat ?? 0), 0);
  const percent = mods.reduce((n, m) => n + (m.percent ?? 0), 0);
  // Gains round in the player's favor.
  return Math.max(0, Math.ceil((xp + flat) * (1 + percent / 100)));
}

/**
 * A hiker gains XP (see the top of this file). Returns what they gained,
 * which goes into the party bar.
 */
export function gainXp(
  state: GameState,
  hiker: Hiker,
  base: number,
  source: XpSource,
  cause: string,
  { repeat = false, quiet = false }: XpOptions = {},
): number {
  if (hiker.status === 'abandoned') return 0;
  noteXpRow(state, hiker);
  if (ACTION_XP.includes(source) && !onXpRow(state, hiker)) {
    if (base > 0) pushEvent(state, { kind: 'xp', hikerId: hiker.id, xp: 0, cause, none: 'row' });
    return 0;
  }
  const xp = withBonuses(state, hiker, base, source, repeat);
  if (xp <= 0) return 0;
  hiker.xp += xp;
  if (!quiet || xp !== base) pushEvent(state, { kind: 'xp', hikerId: hiker.id, xp, cause });
  // It all goes into the party bar.
  addPartyXp(state, xp);

  // Others hear of it (Wise passes some on; a VR Headset picks some up).
  if (source !== 'shared' && source !== 'debug') {
    const ctx = effectContext(state, hiker);
    for (const s of effectSourcesFor(state, hiker)) s.hooks.onXpGained?.({ xp, source }, ctx);
    for (const other of company(state, hiker)) {
      const octx = effectContext(state, other);
      for (const s of effectSourcesFor(state, other)) {
        s.hooks.onTileXpGained?.({ hikerId: hiker.id, xp }, octx);
      }
    }
  }
  return xp;
}

/** Takes XP away from the party bar (a night event, a card). Levels already reached stay. */
export function loseXp(state: GameState, hiker: Hiker, n: number): number {
  const party = partyOf(state);
  const lost = Math.min(party.xp, Math.max(0, n));
  if (state.party) state.party.xp -= lost;
  hiker.xp = Math.max(0, hiker.xp - lost);
  return lost;
}
