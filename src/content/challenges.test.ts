import { describe, expect, it } from 'vitest';
import doc from '../../docs/design/04-challenges.md?raw';
import type { Amount, CardDef, Effect, TextPart } from '../engine/challenges/types';
import { CARDS, CHALLENGES, TRIALS, slug } from './challenges';
import { CONDITIONS } from './conditions';

type Table = 'challenges' | 'trials' | 'wonders' | 'opportunities';

/** Rows of the doc's tables, by section: name, whether it has art, and the tier. */
function docRows() {
  const rows: { name: string; art: boolean; tier: number; table: Table }[] = [];
  let tier = 0;
  let table: Table = 'challenges';
  for (const line of doc.split('\n')) {
    const heading = line.match(/^### Tier (I+)$/);
    if (heading) tier = heading[1]?.length ?? 0;
    if (line.startsWith('## Trials')) table = 'trials';
    if (line.startsWith('## Wonders')) table = 'wonders';
    if (line.startsWith('## Opportunities')) table = 'opportunities';
    if (!line.startsWith('| ') || line.startsWith('| ---')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const name = cells[1] ?? '';
    if (['Challenge', 'Trial', 'Wonder', 'Opportunity'].includes(name)) continue;
    const art = cells[2] !== '—';
    const rowTier = table === 'trials' ? (cells[4]?.length ?? 0) : tier;
    rows.push({ name, art, tier: rowTier, table });
  }
  return rows;
}

/** File names in a folder, from Vite's glob (keys only: nothing is loaded). */
const fileNames = (glob: Record<string, unknown>) =>
  Object.keys(glob).map((path) => path.slice(path.lastIndexOf('/') + 1));
const MASTERS = fileNames(import.meta.glob('/assets/challenges/*.jpg'));
const COPIES = fileNames(import.meta.glob('/public/assets/challenges/*.jpg'));
const WONDER_ART = fileNames(import.meta.glob('/assets/wonders/*.jpg'));
const PUBLIC_WONDER_ART = fileNames(import.meta.glob('/public/assets/wonders/*.jpg'));
const OPPORTUNITY_ART = fileNames(import.meta.glob('/assets/opportunities/*.jpg'));
const PUBLIC_OPPORTUNITY_ART = fileNames(import.meta.glob('/public/assets/opportunities/*.jpg'));

const TIER_WORD = { I: 1, II: 2, III: 3 } as const;

describe('challenge content matches docs/design/04-challenges.md', () => {
  const rows = docRows();
  const cardRows = rows.filter((r) => r.table === 'challenges' || r.table === 'trials');

  it('has every challenge and Trial, with its tier and art', () => {
    expect(cardRows).toHaveLength(96);
    for (const row of cardRows) {
      const card = CARDS[slug(row.name)];
      expect(card, row.name).toBeDefined();
      expect(card?.name).toBe(row.name.replace(/'/g, '’'));
      expect(card?.kind === 'trial').toBe(row.table === 'trials');
      expect(card?.tier, row.name).toBe(row.tier || TIER_WORD.I);
      expect(card?.art, row.name).toBe(row.art);
    }
  });

  it('counts 36 + 22 + 13 challenges and 25 Trials (Nov 6: Firewatch and Lost Pup cut)', () => {
    expect(CHALLENGES.filter((c) => c.tier === 1)).toHaveLength(36);
    expect(CHALLENGES.filter((c) => c.tier === 2)).toHaveLength(22);
    expect(CHALLENGES.filter((c) => c.tier === 3)).toHaveLength(13);
    expect(TRIALS).toHaveLength(25);
    for (const gone of ['bone-collector', 'firewatch', 'lost-pup'])
      expect(CARDS[gone]).toBeUndefined();
  });

  it('lists 7 Wonders and 17 opportunities, each with its picture', () => {
    const wonders = rows.filter((r) => r.table === 'wonders').map((r) => `${slug(r.name)}.jpg`);
    const opportunities = rows
      .filter((r) => r.table === 'opportunities')
      .map((r) => `${slug(r.name)}.jpg`);
    expect(wonders).toHaveLength(7);
    expect(opportunities).toHaveLength(17);
    expect([...WONDER_ART].sort()).toEqual([...wonders].sort());
    expect([...OPPORTUNITY_ART].sort()).toEqual([...opportunities].sort());
  });

  it('has a picture for every challenge and Trial, and no stray pictures', () => {
    const withArt = Object.values(CARDS)
      .filter((c) => c.art && c.kind !== 'opportunity')
      .map((c) => `${c.id}.jpg`);
    expect([...MASTERS].sort()).toEqual(withArt.sort());
  });

  it('has the shrunk copy of every picture in public/assets', () => {
    expect([...COPIES].sort()).toEqual([...MASTERS].sort());
    expect([...PUBLIC_OPPORTUNITY_ART].sort()).toEqual([...OPPORTUNITY_ART].sort());
    expect([...PUBLIC_WONDER_ART].sort()).toEqual([...WONDER_ART].sort());
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
