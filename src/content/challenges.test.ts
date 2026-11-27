import { describe, expect, it } from 'vitest';
import doc04 from '../../docs/design/04-challenges.md?raw';
import doc24 from '../../docs/design/24-challenges-reset.md?raw';
import type { Amount, CardDef, ChallengeDef, Effect, TextPart } from '../engine/challenges/types';
import { MINIGAME_BY_ID } from '../minigames/catalog';
import { CARDS, CHALLENGES, OPPORTUNITIES, TRIALS, slug } from './challenges';
import { CONDITIONS } from './conditions';
import { MINIGAME_CHALLENGES } from './minigameChallenges';

/** File names in a folder, from Vite's glob (keys only: nothing is loaded). */
const fileNames = (glob: Record<string, unknown>) =>
  Object.keys(glob).map((path) => path.slice(path.lastIndexOf('/') + 1));
const MASTERS = fileNames(import.meta.glob('/assets/challenges/*.jpg'));
const COPIES = fileNames(import.meta.glob('/public/assets/challenges/*.jpg'));
const WONDER_ART = fileNames(import.meta.glob('/assets/wonders/*.jpg'));
const PUBLIC_WONDER_ART = fileNames(import.meta.glob('/public/assets/wonders/*.jpg'));
const OPPORTUNITY_ART = fileNames(import.meta.glob('/assets/opportunities/*.jpg'));
const PUBLIC_OPPORTUNITY_ART = fileNames(import.meta.glob('/public/assets/opportunities/*.jpg'));

const TIER_WORD: Record<string, number> = { I: 1, II: 2, III: 3 };
const NODE_WORD: Record<string, string> = {
  Forest: 'forest',
  River: 'river',
  Wildlife: 'wildlife',
  Mountain: 'mountain',
};

/** The rows of 24-challenges-reset.md, section 4: minigame tables and the cost cards. */
function listRows() {
  const rows: {
    name: string;
    cost: boolean;
    nodes: string[] | 'any';
    snow: boolean;
    from: number;
    art: string[];
  }[] = [];
  const section = doc24.slice(doc24.indexOf('## 4. The challenge list'), doc24.indexOf('## 5.'));
  let cost = false;
  for (const line of section.split('\n')) {
    if (line.startsWith('### ')) cost = line.startsWith('### Cost cards');
    if (!line.startsWith('| ') || line.startsWith('| ---') || line.startsWith('| Challenge'))
      continue;
    const cells = line.split('|').map((c) => c.trim());
    const nodeCell = cells[cost ? 3 : 3] ?? '';
    const from = cells[cost ? 4 : 4] ?? '';
    const art = cells.at(-2) ?? '';
    rows.push({
      name: cells[1] ?? '',
      cost,
      nodes: nodeCell.startsWith('Any')
        ? 'any'
        : nodeCell
            .replace(/\(.*\)/, '')
            .split(',')
            .map((w) => NODE_WORD[w.trim()] ?? w.trim()),
      snow: /snow only/.test(nodeCell) || /snow only/.test(cells[2] ?? ''),
      from: TIER_WORD[from] ?? 0,
      art:
        art === 'none yet'
          ? []
          : art
              .replace(/\(.*\)/, '')
              .split(',')
              .map((a) => a.trim()),
    });
  }
  return rows;
}

describe('the challenge list matches docs/design/24-challenges-reset.md (Nov 26 evening)', () => {
  const rows = listRows();

  it('has 45 minigame challenges and 22 cost cards, and nothing else', () => {
    expect(rows.filter((r) => !r.cost)).toHaveLength(45);
    expect(rows.filter((r) => r.cost)).toHaveLength(22);
    expect(CHALLENGES).toHaveLength(67);
    expect(MINIGAME_CHALLENGES).toHaveLength(45);
    expect(CHALLENGES.map((c) => c.id).sort()).toEqual(rows.map((r) => slug(r.name)).sort());
    // No risk cards for now (Wyatt).
    expect(CHALLENGES.some((c) => c.risk)).toBe(false);
  });

  it.each(listRows().map((r) => [r.name, r] as const))('%s', (_, row) => {
    const card = CARDS[slug(row.name)] as ChallengeDef;
    expect(card?.kind).toBe('challenge');
    expect(card.name).toBe(row.name.replace(/'/g, '’'));
    expect(card.tier).toBe(row.from);
    expect(!!card.minigame).toBe(!row.cost);
    if (row.nodes === 'any') expect(card.nodes).toBe('any');
    else expect([...(card.nodes as readonly string[])].sort()).toEqual([...row.nodes].sort());
    expect((card.gates ?? []).includes('snow')).toBe(row.snow);
    // Art for now: the first file named; none yet means a plain panel.
    expect(card.art).toBe(row.art.length > 0);
    if (row.art.length) expect(card.artFile ?? card.id).toBe(row.art[0]);
    // Failing always costs something (the minigames whose game takes it are the exception).
    if (!card.minigame?.keepsPays) expect(card.penalty.length).toBeGreaterThan(0);
    expect(card.backup).toBe(true);
    if (card.minigame)
      expect(MINIGAME_BY_ID.get(card.minigame.game), card.minigame.game).toBeDefined();
  });

  it('has the picture for every card with art (old pictures stay for later)', () => {
    for (const c of Object.values(CARDS)) {
      if (!c.art || c.kind === 'opportunity') continue;
      expect(MASTERS, c.id).toContain(`${c.artFile ?? c.id}.jpg`);
    }
    for (const c of MINIGAME_CHALLENGES) {
      for (const v of c.minigame?.versions ?? []) {
        if (v.artFile) expect(MASTERS, `${c.id}: ${v.artFile}`).toContain(`${v.artFile}.jpg`);
      }
    }
  });

  it('has the shrunk copy of every picture in public/assets', () => {
    expect([...COPIES].sort()).toEqual([...MASTERS].sort());
    expect([...PUBLIC_OPPORTUNITY_ART].sort()).toEqual([...OPPORTUNITY_ART].sort());
    expect([...PUBLIC_WONDER_ART].sort()).toEqual([...WONDER_ART].sort());
  });
});

describe('opportunities, Wonders and Trials still match docs/design/04-challenges.md', () => {
  /** Rows of 04's Wonders, Opportunities and Trials tables. */
  function docRows() {
    const out: { name: string; table: 'trials' | 'wonders' | 'opportunities' }[] = [];
    let table: 'trials' | 'wonders' | 'opportunities' | null = null;
    for (const line of doc04.split('\n')) {
      if (line.startsWith('## ')) table = null;
      if (line.startsWith('## Trials')) table = 'trials';
      if (line.startsWith('## Wonders')) table = 'wonders';
      if (line.startsWith('## Opportunities')) table = 'opportunities';
      if (!table || !line.startsWith('| ') || line.startsWith('| ---')) continue;
      const name = line.split('|')[1]?.trim() ?? '';
      if (['Trial', 'Wonder', 'Opportunity'].includes(name)) continue;
      out.push({ name, table });
    }
    return out;
  }

  it('has 25 Trials, 7 Wonders and 17 opportunities, each with its picture', () => {
    const rows = docRows();
    expect(TRIALS).toHaveLength(25);
    expect(rows.filter((r) => r.table === 'trials')).toHaveLength(25);
    const wonders = rows.filter((r) => r.table === 'wonders').map((r) => `${slug(r.name)}.jpg`);
    const opportunities = rows
      .filter((r) => r.table === 'opportunities')
      .map((r) => `${slug(r.name)}.jpg`);
    expect(wonders).toHaveLength(7);
    expect(opportunities).toHaveLength(17);
    expect([...WONDER_ART].sort()).toEqual([...wonders].sort());
    expect([...OPPORTUNITY_ART].sort()).toEqual([...opportunities].sort());
    expect(OPPORTUNITIES.map((o) => `${o.id}.jpg`).sort()).toEqual([...opportunities].sort());
    // Trials that share a name with a new card keep "-trial" on their id (and their art).
    for (const t of TRIALS) expect(t.artFile ?? t.id).toBe(slug(t.name));
  });
});

describe('every card is wired up', () => {
  const cards = Object.values(CARDS);

  const amountNames = (a: Amount | undefined): string[] => {
    if (a === undefined || typeof a === 'number') return [];
    if (typeof a === 'string') return a === 'risk' ? [] : [a];
    return amountNames(a.base);
  };

  const effectNames = (e: Effect): string[] => {
    const out: string[] = [];
    for (const key of ['duration', 'delta', 'count'] as const) {
      out.push(...amountNames((e as Record<string, Amount | undefined>)[key]));
    }
    if (typeof e.chance === 'string') out.push(e.chance);
    if (e.op === 'loseEachResource' && typeof e.chance === 'string') out.push(e.chance);
    if (e.op === 'condition' && e.then) out.push(...amountNames(e.then.duration));
    return out;
  };

  function namesUsed(card: CardDef): string[] {
    const effects: Effect[] = [...card.penalty, ...(card.reward ?? [])];
    if (card.kind === 'trial') {
      for (const r of card.stagedRewards ?? []) effects.push(...r.effects);
      if ('phases' in card.deadline) effects.push({ op: 'xp', delta: card.deadline.phases });
      if ('days' in card.deadline) effects.push({ op: 'xp', delta: card.deadline.days });
      if (card.goal.kind === 'abundanceRise') effects.push({ op: 'xp', delta: card.goal.by });
      if (card.goal.kind === 'rangerRequest') effects.push({ op: 'xp', delta: card.goal.pay });
    } else {
      for (const option of card.cost) {
        for (const req of option) {
          if ('count' in req) effects.push({ op: 'xp', delta: req.count });
          if (req.kind === 'resources' && req.filter?.randomOf) {
            effects.push({ op: 'xp', delta: req.filter.randomOf });
          }
        }
      }
      if (card.risk) effects.push(...card.risk.outcome);
      const m = card.risk?.measure;
      if (m?.kind === 'threshold') effects.push({ op: 'xp', delta: m.carriedAtLeast });
      if (m?.kind === 'loss') effects.push({ op: 'xp', delta: m.base });
      if (m?.kind === 'chance') {
        for (const p of m.perCarried ?? [])
          if (typeof p.points === 'string') effects.push({ op: 'xp', delta: p.points });
      }
    }
    return effects.flatMap(effectNames);
  }

  const textNames = (parts: readonly TextPart[] = []) =>
    parts.flatMap((p) =>
      [...(typeof p === 'string' ? p : p.text).matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ''),
    );

  it.each(cards.map((c) => [c.name, c] as const))('%s', (_, card) => {
    const rolls = Object.keys(card.rolls ?? {});
    for (const name of namesUsed(card)) expect(rolls, `${card.name} uses ${name}`).toContain(name);
    const texts =
      card.kind === 'trial'
        ? [...card.goalText, ...card.penaltyText, ...(card.rewardText ?? [])]
        : [...card.costText, ...card.penaltyText, ...(card.rewardText ?? [])];
    for (const name of textNames(texts))
      expect(rolls, `${card.name} shows {${name}}`).toContain(name);
    for (const e of [
      ...card.penalty,
      ...(card.reward ?? []),
      ...(card.kind !== 'trial' ? (card.risk?.outcome ?? []) : []),
    ]) {
      if (e.op === 'condition') {
        expect(CONDITIONS[e.id], `${card.name}: ${e.id}`).toBeDefined();
        if (e.then) expect(CONDITIONS[e.then.id]).toBeDefined();
      }
      if (e.onlyIf) expect(Object.keys(card.includes ?? {})).toContain(e.onlyIf);
    }
  });

  it('has unique ids', () => {
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
