import { describe, expect, it } from 'vitest';
import { CARDS } from '../../content';
import type { CardDef, CardRolls } from '../../engine';
import { cardText, rangeText } from './cardText';

const card = (id: string): CardDef => {
  const c = CARDS[id];
  if (!c) throw new Error(id);
  return c;
};
const costOf = (c: CardDef) => (c.kind === 'trial' ? c.goalText : c.costText);

describe('card text', () => {
  it('shows ranges before anything is rolled', () => {
    const steep = card('steep-trail');
    expect(cardText(steep, steep.penaltyText)).toMatch(/Strained for \d+–\d+ days/);
  });

  it('fills in X for the card, and each hiker’s own Y', () => {
    const party = card('split-path');
    const rolls: CardRolls = {
      x: { morale: 3, energy: 4 },
      y: { ash: { days: 2 } },
      includes: {},
      luck: 0,
    };
    expect(cardText(party, costOf(party), { rolls })).toBe(
      'Spend 3 Morale or 4 Energy across the party.',
    );
    expect(cardText(party, party.penaltyText, { rolls, hikerId: 'ash' })).toMatch(/for 2 days/);
    // On the card itself (no hiker), a Y stays a range.
    expect(cardText(party, party.penaltyText, { rolls })).toMatch(/for \d+–\d+ days/);
  });

  it('shows a "(25%)" part only when it came up', () => {
    const eagle = card('toupee-eagle');
    const base: CardRolls = { x: { blind: 30 }, y: {}, includes: {}, luck: 0 };
    expect(cardText(eagle, eagle.penaltyText, { rolls: base })).not.toMatch(/Blind/);
    const included = { ...base, includes: { blind: true } };
    expect(cardText(eagle, eagle.penaltyText, { rolls: included })).toMatch(
      /Also a 30% chance to become Blind/,
    );
    expect(cardText(eagle, eagle.penaltyText)).toMatch(/\(25%: Also a/);
  });

  it('scales ranges one tier up', () => {
    const steep = card('steep-trail');
    const days = steep.rolls?.days?.range ?? [0, 0];
    const up = rangeText([Math.round(days[0] * 1.5), Math.round(days[1] * 1.5)]);
    expect(cardText(steep, steep.penaltyText, { scale: 1.5 })).toContain(up);
  });

  it('never shows [brackets] or a {name} left unfilled, on any card', () => {
    for (const c of Object.values(CARDS)) {
      const parts = [...costOf(c), ...c.penaltyText, ...(c.rewardText ?? [])];
      const text = cardText(c, parts);
      expect(text, c.name).not.toMatch(/[[\]{}]/);
    }
  });
});
