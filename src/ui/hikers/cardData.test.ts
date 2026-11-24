import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLASS_COLORS } from '../../content/classes';
import { ROSTER } from '../../content/roster';
import { CLASS_IDS } from '../../engine/types';
import { bagWords, cardFor, hikerCardData, type HikerCardData } from './cardData';
import { HikerCard } from './HikerCard';

const card = (id: string): HikerCardData => {
  const c = cardFor(id);
  if (!c) throw new Error(`no card for ${id}`);
  return c;
};

describe('class colors', () => {
  it('every class has the color from 09-hikers.md', () => {
    expect(CLASS_COLORS).toEqual({
      leader: '#DC3B44',
      follower: '#E8806A',
      scout: '#3E8FC9',
      trekker: '#B0473A',
      scavenger: '#93A33A',
      crafter: '#3A7752',
      chef: '#6E8F2E',
      smith: '#A0703A',
      tailor: '#2C7C86',
      architect: '#6E7A3E',
      packer: '#8A6A3E',
      naturalist: '#4E9A7A',
      merchant: '#1FA39A',
      support: '#F0AB35',
      entertainer: '#D675EF',
      hardy: '#E27A2B',
      watcher: '#4A5FA8',
      daredevil: '#B23A48',
      jack: '#5F7487',
    });
    expect(Object.keys(CLASS_COLORS).sort()).toEqual([...CLASS_IDS].sort());
  });
});

describe('the front', () => {
  it('Finn: name, title, his 3 trees’ classes, and the 3 traits he can start with', () => {
    const finn = card('finn');
    expect(finn.name).toBe('Finn');
    expect(finn.title).toBe('"THE FOLLOWER"');
    expect(finn.roles.map((r) => [r.name, r.color])).toEqual([
      ['LEADER', '#DC3B44'],
      ['FOLLOWER', '#E8806A'],
      ['SCAVENGER', '#93A33A'],
    ]);
    expect(finn.mainColor).toBe('#DC3B44');
    expect(finn.family).toBe('dog');
    expect(finn.locked).toBe(false);
    // A toggle is a square, the rest diamonds, each in its class color.
    expect(finn.badges.map((b) => [b.name, b.shape, b.color])).toEqual([
      ['Leash Puller', 'square', '#DC3B44'],
      ['Whatcha Up To?', 'diamond', '#E8806A'],
      ['Copydog', 'diamond', '#93A33A'],
    ]);
  });

  it('a usable trait is a circle', () => {
    expect(card('wyatt').badges.find((b) => b.name === 'Rule Changer')?.shape).toBe('circle');
    expect(card('ellie').badges.find((b) => b.name === 'Singer')?.shape).toBe('circle');
  });

  it('the back lists the 3 trees with their 3 traits each', () => {
    const ellie = card('ellie');
    expect(ellie.trees?.map((t) => t.name)).toEqual([
      'Chef Path',
      'Scavenger Path',
      'Entertainer Loop',
    ]);
    expect(ellie.trees?.[2]?.steps.map((s) => [s.name, s.upgrade])).toEqual([
      ['Singer', false],
      ['Loud', false],
      ['Singer II', true],
    ]);
  });

  it('a locked hiker shows nothing but “Locked”', () => {
    const cody = card('cody');
    expect(cody).toMatchObject({ name: 'Locked', locked: true, roles: [], badges: [], bag: '' });
    expect(cody.title).toBeUndefined();
  });

  it('the old cards (for the locked hikers’ later trees): an open slot, a setting', () => {
    const unlocked = (id: string) => {
      const h = ROSTER.find((x) => x.id === id)!;
      const rest = { ...h };
      delete rest.locked;
      return hikerCardData(rest);
    };
    expect(unlocked('brutus').badges.find((b) => b.shape === 'empty')).toMatchObject({
      name: 'Open slot',
      kindWord: 'Trail or Utility slot',
    });
    expect(unlocked('grandpaSherman').rows.at(-1)?.name).toBe('Location (River / Mountain)');
  });

  it('titles use a plain apostrophe, for the pixel font', () => {
    expect(card('mom').title).toBe(`"DOESN'T LIKE PHOTOS"`);
  });
});

describe('the starting bag in words', () => {
  it('items, counts and random blueprints', () => {
    expect(card('finn').bag).toBe('Leash');
    expect(card('ellie').bag).toBe('Mystery Meat');
    expect(card('mom').bag).toBe('Dog Food + 1 random Tier 1 blueprint');
    expect(card('gdog').bag).toBe('2 random Tier 1 food blueprints');
    expect(bagWords({ items: ['dogFood', 'dogFood'] })).toBe('2 Dog Food');
    expect(bagWords({ presents: 2 })).toBe('2 Presents');
    expect(bagWords({})).toBe('');
  });
});

describe('every hiker', () => {
  it('a designed hiker has 3 classes, 3 badges and 3 trees; everyone else is locked', () => {
    for (const h of ROSTER) {
      const c = card(h.id);
      if (h.locked) {
        expect(c.locked, h.id).toBe(true);
        continue;
      }
      expect(c.roles, h.id).toHaveLength(3);
      expect(c.badges, h.id).toHaveLength(3);
      expect(c.trees, h.id).toHaveLength(3);
      for (const t of c.trees ?? []) {
        for (const step of t.steps) expect(step.text, `${h.id} ${step.name}`).not.toMatch(/\[|\]/);
      }
    }
  });
});

describe('the card', () => {
  const html = (props: Parameters<typeof HikerCard>[0]) =>
    renderToStaticMarkup(createElement(HikerCard, props));

  it('the front: name, title, class tabs, starting traits with names, the STARTING BAG tab', () => {
    const out = html({ hikerId: 'finn' });
    expect(out).toContain('FINN');
    expect(out).toContain('&quot;THE FOLLOWER&quot;');
    expect(out).toContain('LEADER');
    expect(out).toContain('LEASH PULLER');
    expect(out).toContain('STARTING BAG');
    expect(out).toContain('aria-pressed="false"');
  });

  it('the back: the 3 trees and the bag bar', () => {
    const wyatt = html({ hikerId: 'wyatt', side: 'back' });
    expect(wyatt).toContain('Naturalist Path');
    expect(wyatt).toContain('Rule Changer III');
    expect(wyatt).toContain('RAIN JACKET');
  });

  it('a locked card: no button, no name, no back', () => {
    const out = html({ hikerId: 'cody' });
    expect(out).toContain('LOCKED');
    expect(out).not.toContain('role="button"');
    expect(out).not.toContain('CODY');
    expect(out).not.toContain('STARTING BAG');
  });

  it('starts turned over when asked, and draws nothing for an unknown hiker', () => {
    expect(html({ hikerId: 'finn', defaultFlipped: true })).toContain('aria-pressed="true"');
    expect(html({ hikerId: 'nobody' })).toBe('');
  });
});
