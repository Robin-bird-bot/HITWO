import { describe, expect, it } from 'vitest';
import doc from '../../docs/design/04-challenges.md?raw';
import type { Amount, CardDef, Effect, TextPart } from '../engine/challenges/types';
import { CARDS, CHALLENGES, OPPORTUNITIES, TRIALS, slug } from './challenges';
import { CONDITIONS } from './conditions';

/** Rows of the doc's tables: name, art, then the tier for Trials. */
function docRows() {
  const rows: { name: string; art: boolean; tier: number; trial: boolean }[] = [];
  let tier = 0;
  let trials = false;
  for (const line of doc.split('\n')) {
    const heading = line.match(/^### Tier (I+)$/);
    if (heading) tier = heading[1]?.length ?? 0;
    if (line.startsWith('## Trials')) trials = true;
    if (!line.startsWith('| ') || line.startsWith('| ---')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const name = cells[1] ?? '';
    if (name === 'Challenge' || name === 'Trial') continue;
    const art = cells[2] !== '—';
    const rowTier = trials ? (cells[4]?.length ?? 0) : tier;
    rows.push({ name, art, tier: rowTier, trial: trials });
  }
  return rows;
}

/** File names in a folder, from Vite's glob (keys only: nothing is loaded). */
const fileNames = (glob: Record<string, unknown>) =>
  Object.keys(glob).map((path) => path.slice(path.lastIndexOf('/') + 1));
const MASTERS = fileNames(import.meta.glob('/assets/challenges/*.jpg'));
const COPIES = fileNames(import.meta.glob('/public/assets/challenges/*.jpg'));

const TIER_WORD = { I: 1, II: 2, III: 3 } as const;

describe('challenge content matches docs/design/04-challenges.md', () => {
  const rows = docRows();

  it('has every challenge and Trial, with its tier and art', () => {
    expect(rows).toHaveLength(98);
    for (const row of rows) {
      const card = CARDS[slug(row.name)];
      expect(card, row.name).toBeDefined();
      expect(card?.name).toBe(row.name.replace(/'/g, '’'));
      expect(card?.kind === 'trial').toBe(row.trial);
      expect(card?.tier, row.name).toBe(row.tier || TIER_WORD.I);
      expect(card?.art, row.name).toBe(row.art);
    }
  });

  it('counts 36 + 22 + 13 challenges and 27 Trials, plus placeholder opportunities', () => {
    expect(CHALLENGES.filter((c) => c.tier === 1)).toHaveLength(36);
    expect(CHALLENGES.filter((c) => c.tier === 2)).toHaveLength(22);
    expect(CHALLENGES.filter((c) => c.tier === 3)).toHaveLength(13);
    expect(TRIALS).toHaveLength(27);
    expect(OPPORTUNITIES.every((o) => o.placeholder)).toBe(true);
  });

  it('has a picture for every card marked with art, and no stray pictures', () => {
    const files = [...MASTERS];
    const withArt = Object.values(CARDS)
      .filter((c) => c.art)
      .map((c) => `${c.id}.jpg`);
    expect(files.sort()).toEqual(withArt.sort());
  });

  it('has the shrunk copy of every picture in public/assets/challenges', () => {
    expect(MASTERS.length).toBe(51);
    expect([...COPIES].sort()).toEqual([...MASTERS].sort());
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
      if (card.goal.kind === 'abundance') effects.push({ op: 'xp', delta: card.goal.atLeast });
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
