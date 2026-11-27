/**
 * The challenge pop-up and its demo (docs/design/20-challenge-popup.md,
 * section 8): the bars and lives show the tier's value and every change
 * (a bar as a share of the most it can be); a filled slot's badge says
 * what it does; filling SKIP IT turns Start into SKIP IT; the demo plays the game with
 * the current Prepare settings, as a still frame with reduced motion or
 * when skipped, and it never reports a result of its own to the flow.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GUN_BEAR_ATTACK, testChallenge } from '../../content/minigameChallenges';
import { DODGE } from '../../minigames/catalog';
import { minigameHiker } from '../../minigames/hikers';
import { POPUPS } from '../../minigames/popups';
import { applyPrepare, cardsFor, slotsFor, type Fills, type Packs } from '../../minigames/prepare';
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
  challenge: typeof GUN_BEAR_ATTACK,
  settings: Record<string, string | number>,
  fills: Fills,
) {
  const popup = POPUPS[challenge.minigame]!;
  const base = { ...settings, ...(challenge.settings ?? {}), tier: challenge.tier };
  const cards = cardsFor([...popup.options(base), ...(challenge.options ?? [])], base, IDS.length);
  const slots = slotsFor(cards);
  const prepared = applyPrepare(base, slots, fills);
  const skip = slots.some((s) => fills[s.key]?.effect === 'skip');
  return renderToStaticMarkup(
    createElement(ChallengePopup, {
      challenge,
      info: DODGE,
      popup,
      base,
      settings: prepared,
      hikers: HIKERS,
      cards,
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
  it('shows How to play with its red phrase and rule lines, the controls, the bars, the lives and the cards', () => {
    const html = popupHtml(testChallenge(DODGE, 3), { animal: 'bees', tier: 3 }, {});
    expect(html).toContain('HOW TO PLAY');
    expect(html).toContain('<b>Each sting costs a heart.</b>');
    expect(html).toContain('A hiker who loses every heart is out.');
    expect(html).toContain('TIER III AND UP');
    expect(html).toContain('CONTROLS');
    expect(html).toContain('ATTACK SPEED');
    expect(html).toContain('BEES PER WAVE');
    expect(html).toContain('FOOD');
    expect(html).toContain('×1 MEAT, FISH OR MUSHROOM');
    expect(html).toContain('SMOKY FIRE');
    expect(html).toContain('×2 FOREST RESOURCES');
    expect(html).toContain('>START<');
    expect(html).not.toContain('SKIP IT');
  });

  it('a Prepare change shows on its bar as a share of the most, a badge says what each slot does, and a new heart pops in', () => {
    const fills: Fills = {
      'lives+slower:0': {
        hiker: 'finn',
        thing: { kind: 'resource', id: 'meat' },
        effect: 'slower',
      },
      'lives+slower:1': {
        hiker: 'finn',
        thing: { kind: 'resource', id: 'meat' },
        effect: 'lives',
        target: 'mom',
      },
    };
    const html = popupHtml(testChallenge(DODGE, 2), { animal: 'bees', tier: 2 }, fills);
    // Attack speed 5/10 at Tier II, one slower: 4/10, the tenth between them cut.
    expect(html).toContain('4/10');
    expect(html).toContain('−1');
    expect(html).toMatch(/cut[^"]*" style="left:40%;width:10%"/);
    expect(html.match(/data-new="true"/g)).toHaveLength(1);
    expect(html).toContain('SLOW');
    expect(html).toContain('♥ MOM');
  });

  it('Bear Country: filling SKIP IT turns Start into SKIP IT', () => {
    const before = popupHtml(GUN_BEAR_ATTACK, {}, {});
    expect(before).toContain('SKIP IT');
    expect(before).toContain('>START<');
    const fills: Fills = {
      'skip:0': { hiker: 'mom', thing: { kind: 'item', id: 'bearSpray' }, effect: 'skip' },
    };
    const after = popupHtml(GUN_BEAR_ATTACK, {}, fills);
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
