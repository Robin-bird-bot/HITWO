import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLASS_COLORS } from '../../content/classes';
import { ROSTER } from '../../content/roster';
import { CLASS_IDS } from '../../engine/types';
import { bagWords, cardFor, type HikerCardData } from './cardData';
import { HikerCard } from './HikerCard';

const card = (id: string): HikerCardData => {
  const c = cardFor(id);
  if (!c) throw new Error(`no card for ${id}`);
  return c;
};

describe('role colors', () => {
  it('every role has the color from the plan', () => {
    expect(CLASS_COLORS).toEqual({
      tank: '#DC3B44',
      hardy: '#E27A2B',
      scavenger: '#93A33A',
      crafter: '#3A7752',
      scout: '#3E8FC9',
      support: '#F0AB35',
      jack: '#5F7487',
      entertainer: '#D675EF',
      moneymaker: '#1FA39A',
    });
    expect(Object.keys(CLASS_COLORS).sort()).toEqual([...CLASS_IDS].sort());
  });
});

describe('the front', () => {
  it('Finn: name, title in capitals and quotes, one role, three badges', () => {
    const finn = card('finn');
    expect(finn.name).toBe('Finn');
    expect(finn.title).toBe('"THE FOLLOWER"');
    expect(finn.roles).toEqual([{ id: 'tank', name: 'TANK', color: '#DC3B44' }]);
    expect(finn.mainColor).toBe('#DC3B44');
    expect(finn.family).toBe('dog');
    expect(finn.variant).toBe(false);
    expect(finn.badges.map((b) => [b.name, b.type, b.shape])).toEqual([
      ['Leash Puller', 'T', 'diamond'],
      ['Follower', 'T', 'diamond'],
      ['Extrovert', 'M', 'diamond'],
    ]);
  });

  it('two roles get split tabs, main on the left', () => {
    expect(card('ellie').roles.map((r) => [r.name, r.color])).toEqual([
      ['SUPPORT', '#F0AB35'],
      ['ENTERTAINER', '#D675EF'],
    ]);
    expect(card('ellie').mainColor).toBe('#F0AB35');
  });

  it('a usable trait is a circle; the rest are diamonds', () => {
    const wyatt = card('wyatt');
    const ruleChanger = wyatt.badges.find((b) => b.traitId === 'ruleChanger');
    expect(ruleChanger?.shape).toBe('circle');
    expect(wyatt.rows.find((r) => r.traitId === 'ruleChanger')?.usable).toBe(true);
  });

  it('an open slot is OPEN, filled on a level-up', () => {
    const brutus = card('brutus');
    const open = brutus.badges.find((b) => b.shape === 'empty');
    expect(open).toMatchObject({
      name: 'Open slot',
      kindWord: 'Trail or Utility slot',
      text: 'Filled on a level-up.',
    });
    expect(brutus.rows.filter((r) => r.open)).toEqual([
      { name: 'Open slot', text: 'Filled on a level-up.', usable: false, open: true },
    ]);
  });

  it('a trait with a setting is named with it', () => {
    const sherman = card('grandpaSherman');
    expect(sherman.rows.at(-1)?.name).toBe('Location (River / Mountain)');
    expect(sherman.rows.at(-1)?.text).toContain('River');
  });

  it('no title yet: no title line (Ben, Mindy and the variants)', () => {
    expect(card('ben').title).toBeUndefined();
    expect(card('followerFinn').title).toBeUndefined();
    expect(card('followerFinn').variant).toBe(true);
    expect(card('bossGracie').family).toBe('duo');
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
    expect(card('muffin').bag).toBe('1 random Tier 1 tool blueprint');
    expect(card('ellieDevourer').bag).toBe('2 Dog Food');
    expect(card('plannerWink').bag).toBe('Tent + Binoculars + Scanner');
    expect(bagWords({})).toBe('');
  });
});

describe('every hiker', () => {
  it('has a card with a badge and a row for each slot, roles and a bag', () => {
    for (const h of ROSTER) {
      const c = card(h.id);
      expect(c.badges, h.id).toHaveLength(h.slots.length);
      expect(c.rows, h.id).toHaveLength(h.slots.length);
      expect(c.roles.length, h.id).toBeGreaterThan(0);
      expect(c.bag, h.id).not.toBe('');
      for (const row of c.rows) {
        expect(row.text, `${h.id} ${row.name}`).not.toMatch(/undefined|\[X\]|\[Y\]|\[Node\]/);
      }
    }
  });
});

describe('the card', () => {
  const html = (props: Parameters<typeof HikerCard>[0]) =>
    renderToStaticMarkup(createElement(HikerCard, props));

  it('the front: name, title, roles, badges with names, the STARTING BAG tab', () => {
    const out = html({ hikerId: 'finn' });
    expect(out).toContain('FINN');
    expect(out).toContain('&quot;THE FOLLOWER&quot;');
    expect(out).toContain('TANK');
    expect(out).toContain('LEASH PULLER');
    expect(out).toContain('STARTING BAG');
    expect(out).toContain('aria-pressed="false"');
  });

  it('the back: every trait spelled out, USABLE tags, open slots and the bag bar', () => {
    const wyatt = html({ hikerId: 'wyatt', side: 'back' });
    expect(wyatt).toContain('USABLE');
    expect(wyatt).toContain('RAIN JACKET');
    const brutus = html({ hikerId: 'brutus', side: 'back' });
    expect(brutus).toContain('OPEN SLOT');
    expect(brutus).toContain('Filled on a level-up.');
    expect(brutus).not.toContain('STARTING BAG');
  });

  it('starts turned over when asked, and draws nothing for an unknown hiker', () => {
    expect(html({ hikerId: 'finn', defaultFlipped: true })).toContain('aria-pressed="true"');
    expect(html({ hikerId: 'nobody' })).toBe('');
  });
});
