/**
 * The challenge pop-up and its demo (docs/design/20-challenge-popup.md,
 * section 8): the bars and lives show the tier's value and every change;
 * filling SKIP IT turns Start into SKIP IT; the demo plays the game with
 * the current Prepare settings, as a still frame with reduced motion or
 * when skipped, and it never reports a result of its own to the flow.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BEAR_COUNTRY, testChallenge } from '../../content/minigameChallenges';
import { DODGE } from '../../minigames/catalog';
import { minigameHiker } from '../../minigames/hikers';
import { POPUPS } from '../../minigames/popups';
import { applyPrepare, rowsFor, slotsFor, type Fills, type Packs } from '../../minigames/prepare';
import { ChallengePopup } from './ChallengePopup';
import { DemoRunner } from './DemoRunner';

const HIKERS = ['finn', 'mom', 'ellie'].map((id) => minigameHiker(id));
const IDS = HIKERS.map((h) => h.id);
const PACKS: Packs = {
  finn: { resources: { meat: 2 }, items: [] },
  mom: {
    resources: { fish: 1 },
    items: [
      { uid: 'a', itemId: 'bearSpray', usesLeft: 1 },
      { uid: 'b', itemId: 'bearSpray', usesLeft: 1 },
    ],
  },
  ellie: { resources: {}, items: [] },
};

function popupHtml(
  challenge: typeof BEAR_COUNTRY,
  settings: Record<string, string | number>,
  fills: Fills,
) {
  const popup = POPUPS[challenge.minigame]!;
  const base = { ...settings, ...(challenge.settings ?? {}), tier: challenge.tier };
  const slots = slotsFor(
    rowsFor([...popup.prepare(base), ...(challenge.prepareRows ?? [])], base),
    IDS,
  );
  const prepared = applyPrepare(base, slots, fills);
  const skip = slots.some((s) => s.row.skip && fills[s.key]);
  return renderToStaticMarkup(
    createElement(ChallengePopup, {
      challenge,
      info: DODGE,
      popup,
      base,
      settings: prepared,
      hikers: HIKERS,
      slots,
      fills,
      packs: PACKS,
      onFill: () => {},
      onEmpty: () => {},
      skip,
      testMode: true,
      onStart: () => {},
    }),
  );
}

describe('the pop-up', () => {
  it('shows How to play with its red phrase, the controls, the bars and the lives', () => {
    const html = popupHtml(testChallenge(DODGE, 2), { animal: 'bees', tier: 2 }, {});
    expect(html).toContain('HOW TO PLAY');
    expect(html).toContain('<b>Each sting costs a heart.</b>');
    expect(html).toContain('CONTROLS');
    expect(html).toContain('ATTACK SPEED');
    expect(html).toContain('BEES PER WAVE');
    expect(html).toContain('>START<');
    expect(html).not.toContain('SKIP IT');
  });

  it('a Prepare change shows in green on its bar, and a new heart pops in for that hiker', () => {
    const fills: Fills = {
      'slower:0': { hiker: 'finn', thing: { kind: 'resource', id: 'meat' } },
      'lives:mom': { hiker: 'finn', thing: { kind: 'resource', id: 'meat' } },
    };
    const html = popupHtml(testChallenge(DODGE, 2), { animal: 'bees', tier: 2 }, fills);
    expect(html).toContain('4/10');
    expect(html).toContain('−1');
    expect(html.match(/data-cut="true"/g)).toHaveLength(1);
    expect(html.match(/data-new="true"/g)).toHaveLength(1);
  });

  it('Bear Country: filling SKIP IT turns Start into SKIP IT', () => {
    const before = popupHtml(BEAR_COUNTRY, {}, {});
    expect(before).toContain('SKIP IT');
    expect(before).toContain('>START<');
    const fills: Fills = { 'skip:0': { hiker: 'mom', thing: { kind: 'item', id: 'bearSpray' } } };
    const after = popupHtml(BEAR_COUNTRY, {}, fills);
    expect(after).not.toContain('>START<');
    expect(after).toContain('>SKIP IT<');
  });
});

describe('the demo', () => {
  const hearts = (html: string) => (html.match(/♥/g) ?? []).length;

  it('plays the real game with the current Prepare settings (a heart added shows in the demo)', () => {
    const plain = renderToStaticMarkup(
      createElement(DemoRunner, {
        gameId: 'dodge',
        settings: { animal: 'bees', tier: 2 },
        hikers: HIKERS,
      }),
    );
    const prepared = renderToStaticMarkup(
      createElement(DemoRunner, {
        gameId: 'dodge',
        settings: { animal: 'bees', tier: 2, 'prep.lives': ['mom'] },
        hikers: HIKERS,
      }),
    );
    expect(hearts(prepared)).toBe(hearts(plain) + 1);
  });

  it('a skipped challenge shows a still frame of the game', () => {
    const html = renderToStaticMarkup(
      createElement(DemoRunner, {
        gameId: 'campCleanup',
        settings: { tier: 1 },
        hikers: HIKERS,
        still: true,
      }),
    );
    expect(html).toContain('CAMP CLEANUP');
  });
});
