/**
 * The bar audit (docs/design/26-fixes-and-wyatt-trees.md, section 1): a bar
 * that changes every frame is exactly its value on every frame (no
 * transition), and one that changes all at once slides to it.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { minigameHiker } from '../../minigames/hikers';
import { Bar } from './Bar';
import { PUZZLES } from './runners';

const HIKERS = ['finn', 'mom', 'ellie'].map((id) => minigameHiker(id));

/** The HUD bar's markup in a game's first frame (the first bar on the screen). */
function hudBar(gameId: string, settings: Record<string, string | number> = {}): string {
  const Game = PUZZLES[gameId];
  if (!Game) throw new Error(`no game ${gameId}`);
  const html = renderToStaticMarkup(
    createElement(Game, {
      settings: { tier: 2, ...settings },
      hikers: HIKERS,
      seed: 3,
      onDone: () => {},
      still: true,
    }),
  );
  const at = html.search(/<span class="[^"]*(?:bar|timeBar)[^"]*" style="[^"]*--bar-ease/);
  if (at < 0) throw new Error(`${gameId}: no bar`);
  return html.slice(at, html.indexOf('</span>', at));
}

describe('the shared bar', () => {
  it('a live bar is exactly its value, with no transition', () => {
    const html = renderToStaticMarkup(createElement(Bar, { value: 0.4231, live: true }));
    expect(html).toContain('data-live="true"');
    expect(html).toContain('width:42.31%');
  });

  it('an eased bar slides, and values outside 0 to 1 are clamped', () => {
    const eased = renderToStaticMarkup(createElement(Bar, { value: 0.5 }));
    expect(eased).not.toContain('data-live');
    expect(eased).toContain('--bar-ease:0.25s');
    expect(renderToStaticMarkup(createElement(Bar, { value: -2 }))).toContain('width:0%');
    expect(renderToStaticMarkup(createElement(Bar, { value: 7 }))).toContain('width:100%');
    expect(renderToStaticMarkup(createElement(Bar, { value: Number.NaN }))).toContain('width:0%');
  });

  it('every minigame bar goes through it (no bar of its own with the old transition)', () => {
    const sources = import.meta.glob<string>('./**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    const raw = Object.entries(sources)
      .filter(
        ([path, text]) =>
          !path.endsWith('/Bar.tsx') &&
          /<span\s+className=\{(hud\.bar|panel\.timeBar)\}/.test(text),
      )
      .map(([path]) => path);
    expect(raw).toEqual([]);
  });
});

describe('each game’s bar', () => {
  // Timers, the bridge's integrity and distances change every frame.
  it.each([
    ['sketchyBridge'],
    ['campCleanup'],
    ['packItUp'],
    ['whackoon'],
    ['fireflyCatch'],
    ['sizeUp'],
    ['sleepingBear'],
    ['train'],
    ['crossing'],
    ['rafting'],
    ['trails'],
    ['fallingRocks'],
    ['memory'],
  ])('%s: live', (id) => {
    expect(hudBar(id)).toContain('data-live="true"');
  });

  // Counts change all at once: a fly, a swat, a hiker across, a hold, a note, a swing.
  it.each([
    ['flyBlock'],
    ['flySwatter'],
    ['thinIce'],
    ['rockClimb'],
    ['birdsong'],
    ['trailBlocks'],
  ])('%s: eased', (id) => {
    expect(hudBar(id)).not.toContain('data-live');
  });

  it('a full bar starts full: the bridge’s integrity and a timer', () => {
    expect(hudBar('sketchyBridge')).toContain('width:100%');
    expect(hudBar('packItUp')).toContain('width:100%');
  });
});
