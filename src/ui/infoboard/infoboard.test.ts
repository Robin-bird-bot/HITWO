/**
 * The Trail Infoboard's window (docs/design/25-challenges-on-the-map.md,
 * section 2): a poster for each pool card, face up or face down, the
 * tooltip's words, where the posters hang, and the tip boxes.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { CARDS } from '../../content';
import { createGame } from '../../engine/newGame';
import { boardOf } from '../../engine/challenges/infoboard';
import { fixtureHiker, run } from '../../engine/test/fixtures';
import type { GameState } from '../../engine';
import { InfoboardWindow } from './InfoboardWindow';
import { posterOf, prepareWords, spotsFor } from './posters';

const IB = BALANCE.challenges.infoboard;
const game = (seed = 6): GameState => {
  const s = createGame({
    seed,
    hikers: ['finn', 'mom'].map((id) => fixtureHiker(id)),
    startingResources: false,
  });
  s.caps = 20;
  return s;
};
const render = (s: GameState) =>
  renderToStaticMarkup(
    createElement(InfoboardWindow, {
      state: s,
      dispatch: () => true,
      onClose: () => {},
      onShow: () => {},
    }),
  );

describe('the Trail Infoboard window', () => {
  it('shows the biome’s name, a poster for each pool card and the purse', () => {
    const s = game();
    const html = render(s);
    expect(html).toContain('MEADOW TRAILHEAD');
    const pool = s.section.pool ?? [];
    expect(html.match(/data-up="true"/g)).toHaveLength(boardOf(s).faceUp.length);
    expect(html.match(/data-down="true"/g)?.length ?? 0).toBe(
      pool.length - boardOf(s).faceUp.length,
    );
    expect(html).toContain(`${IB.pinCaps} CAP TO PIN`);
    expect(html).toContain('PIN ONE MORE');
    expect(html).toContain('WHERE IS IT?');
    expect(html).toContain(`>${s.caps}<`);
  });

  it('PIN ONE MORE shows ALL POSTED once every poster is up', () => {
    let s = game();
    const pool = s.section.pool ?? [];
    while (boardOf(s).faceUp.length < pool.length) s = run(s, { type: 'infoboardPin' });
    const html = render(s);
    expect(html).toContain('ALL POSTED');
    expect(html).not.toContain('data-down="true"');
  });

  it('a poster names its kind and tier; a minigame lists what Prepare takes', () => {
    const s = game();
    for (const id of s.section.pool ?? []) {
      const p = posterOf(s, id)!;
      const card = CARDS[id]!;
      expect(p.name).toBe(card.name);
      expect(p.tier).toMatch(/^TIER [IV]+(–[IV]+)?$/);
      expect(p.kind).toBe(card.kind === 'challenge' && card.minigame ? 'MINIGAME' : 'COST CARD');
      if (p.kind === 'MINIGAME') expect(p.description).not.toBe('');
      expect(p.description).not.toMatch(/\[|\{/);
      expect(p.takes).not.toMatch(/\[|\{/);
      if (p.kind === 'COST CARD') expect(p.takes).not.toBe('');
    }
  });

  it('Prepare words name categories, not every resource in them', () => {
    const bees = CARDS['bee-attack'];
    if (bees?.kind !== 'challenge') throw new Error('no bee-attack');
    const words = prepareWords(bees, 1).split(', ');
    expect(words).toContain('Food');
    expect(new Set(words).size).toBe(words.length);
  });

  it('posters hang on the cork, clear of the printed map', () => {
    for (let n = 1; n <= 12; n++) {
      const spots = spotsFor(n);
      expect(spots).toHaveLength(n);
      for (const s of spots) {
        const w = 156 * s.scale;
        const h = 214 * s.scale;
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + w).toBeLessThanOrEqual(1084);
        expect(s.y + h).toBeLessThanOrEqual(556);
        // The map is at x 372–752, y 24–424.
        expect(s.x + w <= 372 || s.x >= 752).toBe(true);
      }
    }
  });
});
