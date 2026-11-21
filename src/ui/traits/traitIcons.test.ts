import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TRAIT_LIST, TRAITS } from '../../content/traits';
import { HOLIDAY_TRAITS } from '../../content/traits/holiday';
import { iconFile, kebabName } from '../../content/traits/icons';
import { fixtureGame, fixtureHiker, hiker } from '../../engine/test/fixtures';
import { BADGE_COLORS, traitBadges, type BadgeInfo } from './badges';
import { TraitBadge } from './TraitBadge';
import { traitIconUrl } from './traitIcons';

/** The icon files in public/assets/traits/, without `.png`. */
const ON_DISK = Object.keys(import.meta.glob('/public/assets/traits/*.png')).map((p) =>
  p.slice(p.lastIndexOf('/') + 1, -'.png'.length),
);

describe('trait icon files', () => {
  /** The holiday hikers' traits: no art yet, so their badges show initials (holiday-hikers-2). */
  const AWAITING_ART = HOLIDAY_TRAITS.map((d) => d.id);

  it('every trait has an icon file, except the holiday traits still waiting for art', () => {
    const missing = TRAIT_LIST.filter((def) => !ON_DISK.includes(iconFile(def))).map((d) => d.id);
    expect(missing).toEqual(AWAITING_ART);
    for (const def of TRAIT_LIST) {
      if (!AWAITING_ART.includes(def.id)) expect(traitIconUrl(def.id)).toBeDefined();
    }
    // When Wyatt sends them, they're named after the trait.
    expect(iconFile(TRAITS.giftWrapper!)).toBe('gift-wrapper');
    expect(iconFile(TRAITS.downTheChimney!)).toBe('down-the-chimney');
    expect(iconFile(TRAITS.checkingItTwice!)).toBe('checking-it-twice');
    expect(iconFile(TRAITS.wreckTheHalls!)).toBe('wreck-the-halls');
  });

  it('every icon file belongs to a trait', () => {
    const used = new Set(TRAIT_LIST.map(iconFile));
    expect(ON_DISK.filter((f) => !used.has(f))).toEqual([]);
  });

  it('is the name in lowercase with dashes', () => {
    expect(kebabName('Dog Mom')).toBe('dog-mom');
    expect(kebabName('Just Around the Next Corner')).toBe('just-around-the-next-corner');
    expect(kebabName('[Node] Finder')).toBe('node-finder');
    expect(kebabName('MBA')).toBe('mba');
    expect(kebabName('Non-Non-Profit')).toBe('non-non-profit');
    expect(iconFile(TRAITS.dogMom!)).toBe('dog-mom');
  });

  it('shares or swaps the files the plan names', () => {
    const file = (id: string) => iconFile(TRAITS[id]!);
    expect(file('glutton')).toBe('glutton');
    expect(file('humanFood')).toBe('glutton');
    expect(file('puller')).toBe('puller');
    expect(file('leashPuller')).toBe('puller');
    expect(file('thumb')).toBe('node-thumb');
    expect(file('thrillSeeker')).toBe('thrill-seeker');
    expect(file('thrillSeekerMorale')).toBe('thrill-seeker-morale');
    expect(file('bossGracie')).toBe('tag-team');
  });

  it('a trait with no file (one added later) gets no icon, so the badge shows its initials', () => {
    expect(traitIconUrl('noSuchTrait')).toBeUndefined();
  });
});

describe('badge icon color', () => {
  const s = fixtureGame({ hikers: [fixtureHiker('ash', ['stoic', 'leader', 'extrovert'])] });
  const [stoic, leader, extrovert] = traitBadges(s, hiker(s, 'ash')) as [
    BadgeInfo,
    BadgeInfo,
    BadgeInfo,
  ];
  const html = (badge: BadgeInfo) => renderToStaticMarkup(createElement(TraitBadge, { badge }));

  it("draws the icon through a mask in the type's ring color", () => {
    for (const [badge, ring] of [
      [stoic, BADGE_COLORS.T.ring],
      [leader, BADGE_COLORS.T.ring],
      [extrovert, BADGE_COLORS.M.ring],
    ] as const) {
      const out = html(badge);
      expect(out).toContain(`--ring:${ring}`);
      expect(out).toMatch(/mask-image:url\([^)]*\/traits\/[a-z-]+\.png\)/);
    }
  });

  it('a used-up badge is grey', () => {
    expect(html({ ...stoic, state: 'used' })).toContain(`--ring:${BADGE_COLORS.used.ring}`);
    expect(BADGE_COLORS.used.ring).toBe('#6F6A60');
  });

  it('the icon is painted in the ring color', () => {
    expect(html(leader)).toContain('background-color:var(--ring)');
  });
});
