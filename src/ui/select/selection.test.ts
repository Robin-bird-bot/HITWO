import { describe, expect, it } from 'vitest';
import { PARTY_COLORS } from '../../content/partyColors';
import { baseOf, ROSTER } from '../../content/roster';
import { createGame } from '../../engine/newGame';
import { nextFloat, seedRng } from '../../engine/rng';
import {
  add,
  blocker,
  canPlace,
  canStart,
  EMPTY_PARTY,
  fillRandom,
  members,
  place,
  remove,
  randomStarts,
  startingParty,
  type Starts,
  startLabel,
  type Party,
} from './selection';

const party = (...ids: (string | null)[]): Party => [...ids, null, null, null, null].slice(0, 4);

describe('starting a hike', () => {
  const all: Starts = {
    finn: 'finn-leader',
    mom: 'mom-support',
    wyatt: 'wyatt-smith',
    ellie: 'ellie-chef',
  };

  it('works with 1, 2, 3 or 4 hikers, and not with none', () => {
    expect(canStart(EMPTY_PARTY, all)).toBe(false);
    expect(canStart(party('finn'), all)).toBe(true);
    expect(canStart(party('finn', 'mom'), all)).toBe(true);
    expect(canStart(party('finn', null, 'mom', 'wyatt'), all)).toBe(true);
    expect(canStart(party('finn', 'mom', 'wyatt', 'ellie'), all)).toBe(true);
  });

  it('Phase 10.7: every hiker needs a starting trait first; RANDOM picks one for those without', () => {
    expect(canStart(party('finn', 'mom'), { finn: 'finn-leader' })).toBe(false);
    const starts = randomStarts(party('finn', 'mom'), { finn: 'finn-scavenger' }, () => 0.99);
    expect(starts).toEqual({ finn: 'finn-scavenger', mom: 'mom-trekker' });
    expect(canStart(party('finn', 'mom'), starts)).toBe(true);
    const hikers = startingParty(party('finn', 'mom'), starts);
    expect(hikers.map((h) => h.start)).toEqual(['finn-scavenger', 'mom-trekker']);
    const game = createGame({ seed: 2, hikers });
    expect(game.hikers[0]?.trails?.learned).toEqual(['finn-scavenger-t1']);
  });

  it('locked hikers can’t be placed, and RANDOM never picks one', () => {
    expect(canPlace(EMPTY_PARTY, 'cody', 0)).toBe(false);
    expect(add(EMPTY_PARTY, 'cody')).toEqual(EMPTY_PARTY);
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seedRng(seed);
      const p = fillRandom(EMPTY_PARTY, () => nextFloat(rng));
      expect(members(p).every((id) => !ROSTER.find((h) => h.id === id)?.locked)).toBe(true);
    }
  });

  it('the run gets the hikers in spot order, each in their spot color, with their blueprints', () => {
    const hikers = startingParty(party(null, 'mom', null, 'finn'));
    expect(hikers.map((h) => [h.id, h.color])).toEqual([
      ['mom', PARTY_COLORS[1]],
      ['finn', PARTY_COLORS[3]],
    ]);
    const game = createGame({ seed: 7, hikers });
    expect(game.hikers.map((h) => [h.id, h.color])).toEqual([
      ['mom', PARTY_COLORS[1]],
      ['finn', PARTY_COLORS[3]],
    ]);
    // No starting items (29-core-loop.md, section 7); Mom's blueprint still comes along.
    expect(game.hikers.every((h) => h.inventory.bag.length === 0)).toBe(true);
    expect(game.hikers[0]?.blueprints).toHaveLength(1);
  });

  it('the button says how many', () => {
    expect(startLabel(EMPTY_PARTY)).toBe('START HIKE');
    expect(startLabel(party('finn'))).toBe('START HIKE · 1 HIKER');
    expect(startLabel(party('finn', null, 'mom'))).toBe('START HIKE · 2 HIKERS');
  });
});

describe('dropping on the spots', () => {
  it('on an empty spot, the hiker takes it', () => {
    expect(place(EMPTY_PARTY, 'finn', 2)).toEqual([null, null, 'finn', null]);
  });

  it('on a filled spot, they swap: the hiker who was there goes back to the list', () => {
    expect(place(party('finn', 'mom'), 'wyatt', 0)).toEqual(['wyatt', 'mom', null, null]);
  });

  it('spot to spot, the two swap; to an empty spot, it moves', () => {
    expect(place(party('finn', 'mom'), 'finn', 1)).toEqual(['mom', 'finn', null, null]);
    expect(place(party('finn', 'mom'), 'finn', 3)).toEqual([null, 'mom', null, 'finn']);
  });

  it('× (or dragging out of the spots) removes a hiker', () => {
    expect(remove(party('finn', 'mom'), 0)).toEqual([null, 'mom', null, null]);
    expect(remove(party('finn'), 2)).toEqual(['finn', null, null, null]);
  });

  it('Enter or a double-click adds to the first empty spot, once', () => {
    let p = add(party('finn', null, 'mom'), 'wyatt');
    expect(p).toEqual(['finn', 'wyatt', 'mom', null]);
    p = add(p, 'wyatt');
    expect(p).toEqual(['finn', 'wyatt', 'mom', null]);
    const full = party('finn', 'mom', 'wyatt', 'ellie');
    expect(add(full, 'gdog')).toBe(full);
  });
});

describe('no cloning', () => {
  it('a variant can’t join with its base hiker or another of their variants (and they’re locked)', () => {
    const withFinn = party('finn');
    expect(blocker(withFinn, 'followerFinn')).toBe('finn');
    expect(canPlace(withFinn, 'followerFinn', 1)).toBe(false);
    expect(add(withFinn, 'followerFinn')).toBe(withFinn);
    expect(blocker(party('agilityFinn'), 'followerFinn')).toBe('agilityFinn');
    expect(blocker(party('followerFinn'), 'finn')).toBe('followerFinn');
  });

  it('RANDOM fills the empty spots, keeps the picks, and never clones', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seedRng(seed);
      const p = fillRandom(party(null, 'finn'), () => nextFloat(rng));
      const ids = members(p);
      // Only 6 can be picked, so RANDOM fills from those.
      expect(ids).toHaveLength(4);
      expect(p[1]).toBe('finn');
      expect(new Set(ids.map(baseOf)).size).toBe(4);
    }
  });

  it('RANDOM leaves a full party alone', () => {
    const full = party('finn', 'mom', 'wyatt', 'ellie');
    expect(fillRandom(full, () => 0.5)).toEqual(full);
    expect(ROSTER.length).toBeGreaterThan(4);
  });
});
