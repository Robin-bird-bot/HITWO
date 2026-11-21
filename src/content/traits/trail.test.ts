import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../../engine/applyAction';
import { addCondition, hasCondition } from '../../engine/conditions';
import { moveAllCost, moveCost } from '../../engine/costs';
import { effectSourcesFor } from '../../engine/effects';
import { bagSlots } from '../../engine/inventory';
import { makeItem } from '../../engine/items/make';
import { safeFrom } from '../../engine/night/nightEvents';
import { addInjury } from '../../engine/stats';
import {
  END,
  fixtureGame,
  fixtureHiker,
  hiker,
  place,
  run,
  toNight,
} from '../../engine/test/fixtures';
import type { Action, GameState, Hiker } from '../../engine/types';

/** Ash, Birch, Cedar and Dot on the trailhead with these traits (each in a W slot). */
const party = (traits: Partial<Record<'ash' | 'birch' | 'cedar' | 'dot', string[]>>, seed = 1) =>
  fixtureGame({
    seed,
    hikers: (['ash', 'birch', 'cedar', 'dot'] as const).map((id) => fixtureHiker(id, traits[id])),
  });

const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const moveAll = (hikerId: string, toTileId: string, bring: string[]): Action => ({
  type: 'moveAll',
  hikerId,
  toTileId,
  bring,
});
const use = (hikerId: string, abilityId: string, choice?: string): Action => ({
  type: 'useAbility',
  hikerId,
  abilityId,
  ...(choice ? { choice } : {}),
});
const food = (s: GameState, id: string): string => {
  const item = makeItem(s, 'pelmeni', { quality: 3 }); // +1 Appetite a bite
  hiker(s, id).inventory.bag.push(item);
  return item.uid;
};
const eat = (s: GameState, id: string) =>
  run(s, { type: 'eat', hikerId: id, itemUid: food(s, id) });
const ready = (s: GameState, ...ids: string[]) => {
  for (const id of ids) hiker(s, id).acted = false;
  return s;
};

describe('Follower', () => {
  it('being moved with the group doesn’t use their action', () => {
    const s = run(party({ birch: ['follower'] }), moveAll('ash', 'L', ['birch', 'cedar']));
    expect(hiker(s, 'birch').acted).toBe(false);
    expect(hiker(s, 'cedar').acted).toBe(true);
  });
});

describe('Independent', () => {
  it('once a day, moving alone to a tile with no hikers costs 1 less', () => {
    let s = party({ ash: ['independent'] });
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(0);
    s = run(s, move('ash', 'L'));
    expect(hiker(s, 'ash').stats.appetite).toBe(10);
    // Used for today.
    place(s, 'ash', 'T');
    expect(moveCost(ready(s, 'ash'), 'ash', 'L')?.appetite).toBe(1);
  });

  it('not onto a tile with someone on it', () => {
    const s = party({ ash: ['independent'] });
    place(s, 'birch', 'L');
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(1);
  });
});

describe('Scout', () => {
  it('shows the nodes of the tiles around them', () => {
    let s = party({ ash: ['scout'] });
    for (const id of ['L', 'R']) for (const n of s.section.tiles[id]!.nodes) n.revealed = false;
    s = run(s, move('ash', 'M'));
    expect(s.section.tiles.L!.nodes.every((n) => n.revealed)).toBe(true);
    expect(s.section.tiles.R!.nodes.every((n) => n.revealed)).toBe(true);
  });
});

describe('Glutton and Human Food (the Dog name)', () => {
  it.each(['glutton', 'humanFood'])('%s: food gives 1 extra Appetite', (id) => {
    let s = party({ ash: [id] });
    place(s, 'ash', 'T', { appetite: 5 });
    s = eat(s, 'ash');
    expect(hiker(s, 'ash').stats.appetite).toBe(7);
  });
});

describe('item slots', () => {
  it('Strong +1, Mule +2, Short −1', () => {
    const s = party({ ash: ['strong'], birch: ['mule'], cedar: ['short'] });
    const base = bagSlots(s, hiker(s, 'dot')).total;
    expect(bagSlots(s, hiker(s, 'ash')).total).toBe(base + 1);
    expect(bagSlots(s, hiker(s, 'birch')).total).toBe(base + 2);
    expect(bagSlots(s, hiker(s, 'cedar')).total).toBe(base - 1);
  });
});

describe('Manager', () => {
  it('trades items, not resources, with hikers on the next tile', () => {
    const s = party({ ash: ['manager'] });
    place(s, 'birch', 'L');
    const item = makeItem(s, 'shovel');
    hiker(s, 'ash').inventory.bag.push(item);
    hiker(s, 'ash').inventory.resources = { wood: 1 };
    expect(
      validateAction(s, { type: 'give', fromId: 'ash', toId: 'birch', itemUid: item.uid }),
    ).toBeNull();
    expect(
      validateAction(s, { type: 'give', fromId: 'ash', toId: 'birch', resource: 'wood' }),
    ).toBe('Birch isn’t on this tile.');
    place(s, 'birch', 'C'); // two lines away
    expect(
      validateAction(s, { type: 'give', fromId: 'ash', toId: 'birch', itemUid: item.uid }),
    ).toBe('Birch isn’t on this tile.');
  });
});

describe('Prepared and Tactical', () => {
  it('Prepared shows a random tile’s card at the start of the biome', () => {
    const s = party({ ash: ['prepared'] });
    expect(s.log.some((e) => e.kind === 'revealedCard' && e.cause === 'Prepared')).toBe(true);
    const shown = Object.values(s.section.tiles).filter(
      (t) => t.revealedCard && !t.revealedCard.hidden,
    );
    expect(shown.length).toBe(1);
  });

  it('Tactical lets the player pick the tile, or skip', () => {
    let s = party({ ash: ['tactical'] });
    expect(s.tacticalPicks).toEqual(['ash']);
    expect(validateAction(s, { type: 'tactical', hikerId: 'ash', tileId: 'T' })).toBe(
      'Pick a tile nobody has reached.',
    );
    s = run(s, { type: 'tactical', hikerId: 'ash', tileId: 'M' });
    expect(s.section.tiles.M?.revealedCard).toBeDefined();
    expect(s.tacticalPicks).toBeUndefined();
    const skipped = run(party({ ash: ['tactical'] }), { type: 'tactical', hikerId: 'ash' });
    expect(skipped.tacticalPicks).toBeUndefined();
  });
});

describe('Short', () => {
  it('moving costs 1 less, alone or brought along', () => {
    const s = party({ birch: ['short'] });
    expect(moveCost(s, 'birch', 'L')?.appetite).toBe(0);
    // Ash pays 1 for their crossing and 1 for each hiker brought; Birch's is 1 less.
    expect(moveAllCost(s, 'ash', 'L', ['birch'])?.[0]?.cost.appetite).toBe(1);
  });
});

describe('Backtracker', () => {
  it('sideways or backward moves cost no Appetite', () => {
    const s = party({ ash: ['backtracker'] });
    place(s, 'ash', 'L');
    expect(moveCost(s, 'ash', 'M')?.appetite).toBe(0); // sideways (muddy, normally 2)
    expect(moveCost(s, 'ash', 'T')?.appetite).toBe(0); // back
    expect(moveCost(s, 'ash', 'C')?.appetite).toBe(1); // forward
  });
});

describe('Never Hungry', () => {
  it('a move sometimes costs no Appetite (25%), and food gives 1 less', () => {
    let free = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const s = run(party({ ash: ['neverHungry'] }, seed), move('ash', 'L'));
      if (hiker(s, 'ash').stats.appetite === 10) free += 1;
    }
    expect(free).toBeGreaterThan(8);
    expect(free).toBeLessThan(35);
    let s = party({ ash: ['neverHungry'] });
    place(s, 'ash', 'T', { appetite: 5 });
    s = eat(s, 'ash');
    expect(hiker(s, 'ash').stats.appetite).toBe(5);
  });
});

describe('Puller and Leash Puller', () => {
  it.each(['puller', 'leashPuller'])(
    '%s: the group move costs 1 Energy instead of Appetite',
    (id) => {
      const s = party({ ash: [id] });
      const mover = moveAllCost(s, 'ash', 'L', ['birch', 'cedar'])?.[0];
      expect(mover?.cost).toMatchObject({ appetite: 0, energy: BALANCE.traits.puller.energy });
    },
  );
});

describe('Prowler', () => {
  it('moving alone at night costs no extra Appetite', () => {
    const s = toNight(party({ ash: ['prowler'] }));
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(1);
    expect(moveCost(s, 'birch', 'L')?.appetite).toBe(2);
  });
});

describe('Susceptible and Transparent', () => {
  const sourceNames = (s: GameState, h: Hiker) => effectSourcesFor(s, h).map((x) => x.name);

  it('a Susceptible hiker has the positive conditions of others on the tile', () => {
    const s = party({ ash: ['susceptible'] });
    addCondition(s, hiker(s, 'birch'), 'lucky', 1, 'days', 'test');
    addCondition(s, hiker(s, 'birch'), 'sleepy', 1, 'days', 'test');
    expect(sourceNames(s, hiker(s, 'ash'))).toContain('Lucky (from Birch)');
    expect(sourceNames(s, hiker(s, 'ash'))).not.toContain('Sleepy (from Birch)');
    place(s, 'ash', 'L');
    expect(sourceNames(s, hiker(s, 'ash'))).not.toContain('Lucky (from Birch)');
  });

  it('a Transparent hiker’s positive conditions are everyone’s on the tile', () => {
    const s = party({ ash: ['transparent'] });
    addCondition(s, hiker(s, 'ash'), 'lucky', 1, 'days', 'test');
    expect(sourceNames(s, hiker(s, 'birch'))).toContain('Lucky (from Ash)');
  });
});

describe('Supportive', () => {
  it('once a day, takes a negative condition from someone on the tile', () => {
    let s = party({ ash: ['supportive'] });
    addCondition(s, hiker(s, 'birch'), 'nauseous', 2, 'days', 'test');
    s = run(s, use('ash', 'supportive', 'birch|nauseous'));
    expect(hasCondition(hiker(s, 'birch'), 'nauseous')).toBe(false);
    expect(hiker(s, 'ash').conditions).toMatchObject([{ id: 'nauseous', remaining: 2 }]);
    addCondition(s, hiker(s, 'cedar'), 'bored', 1, 'days', 'test');
    expect(validateAction(s, use('ash', 'supportive', 'cedar|bored'))).toBe(
      'Supportive is used up today.',
    );
  });
});

describe('Trailer', () => {
  it('moving to a tile with a hiker on it costs no Appetite', () => {
    const s = party({ ash: ['trailer'] });
    place(s, 'birch', 'M');
    expect(moveCost(s, 'ash', 'M')?.appetite).toBe(0);
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(1);
  });
});

describe('Fast', () => {
  it('the first move each day doesn’t use the action, for 1 extra Appetite', () => {
    let s = party({ ash: ['fast'] });
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(2);
    s = run(s, move('ash', 'L'));
    expect(hiker(s, 'ash').acted).toBe(false);
    expect(hiker(s, 'ash').stats.appetite).toBe(8);
    s = run(s, move('ash', 'C'));
    expect(hiker(s, 'ash').acted).toBe(true);
    expect(hiker(s, 'ash').stats.appetite).toBe(7);
  });
});

describe('Hardy', () => {
  it('once a phase, 2 Morale shortens a condition by 1', () => {
    let s = party({ ash: ['hardy'] });
    addCondition(s, hiker(s, 'ash'), 'bored', 2, 'days', 'test');
    s = run(s, use('ash', 'hardy', 'bored'));
    expect(hiker(s, 'ash').conditions).toMatchObject([{ id: 'bored', remaining: 1 }]);
    expect(validateAction(s, use('ash', 'hardy', 'bored'))).toBe('Hardy is used up this phase.');
    s = run(s, END, use('ash', 'hardy', 'bored'));
    expect(hasCondition(hiker(s, 'ash'), 'bored')).toBe(false);
  });

  it('needs 2 Morale', () => {
    const s = party({ ash: ['hardy'] });
    addCondition(s, hiker(s, 'ash'), 'nauseous', 2, 'days', 'test');
    place(s, 'ash', 'T', { morale: 1 });
    expect(validateAction(s, use('ash', 'hardy', 'nauseous'))).toBe('Needs 2 Morale.');
  });
});

describe('Shrug Off', () => {
  it('the first injury each biome is prevented', () => {
    const s = party({ ash: ['shrugOff'] });
    addInjury(s, hiker(s, 'ash'), 'a fall');
    expect(hiker(s, 'ash').injuries).toBe(0);
    addInjury(s, hiker(s, 'ash'), 'a fall');
    expect(hiker(s, 'ash').injuries).toBe(1);
    s.sectionIndex += 1;
    addInjury(s, hiker(s, 'ash'), 'a fall');
    expect(hiker(s, 'ash').injuries).toBe(1);
  });
});

describe('Lookout', () => {
  it('Keep Watch also protects hikers on adjacent tiles', () => {
    let s = toNight(party({ ash: ['lookout'] }));
    place(s, 'birch', 'L');
    place(s, 'cedar', 'C');
    s = run(s, { type: 'keepWatch', hikerId: 'ash' });
    expect(safeFrom(s, hiker(s, 'birch'))).toEqual({ why: 'watch', by: 'ash' });
    expect(safeFrom(s, hiker(s, 'cedar'))?.why).not.toBe('watch');
  });
});

describe('Trespasser', () => {
  it('once per biome: no challenges trigger for them that day', () => {
    let s = fixtureGame({
      challenges: true,
      hikers: [fixtureHiker('ash', ['trespasser']), fixtureHiker('birch')],
    });
    s = run(s, use('ash', 'trespasser'), move('ash', 'L'));
    expect(s.challenge).toBeUndefined();
    expect(validateAction(s, use('ash', 'trespasser'))).toBe('Trespasser is used up this biome.');
  });

  it('moved with the group, they aren’t part of the challenge', () => {
    let s = fixtureGame({
      challenges: true,
      hikers: [fixtureHiker('ash', ['trespasser']), fixtureHiker('birch')],
    });
    s = run(s, use('ash', 'trespasser'), moveAll('birch', 'M', ['ash']));
    expect(s.challenge?.hikerIds).toEqual(['birch']);
  });
});

describe('Stalker', () => {
  it('once a day, moving to a hiker’s tile is free and keeps the action', () => {
    let s = party({ ash: ['stalker'] });
    place(s, 'birch', 'L');
    s = run(s, move('ash', 'L'));
    expect(hiker(s, 'ash')).toMatchObject({ acted: false, stats: { appetite: 10 } });
    place(s, 'birch', 'C');
    s = run(s, move('ash', 'C'));
    expect(hiker(s, 'ash')).toMatchObject({ acted: true, stats: { appetite: 9 } });
  });
});

describe('Sneaker', () => {
  it('moving at night costs no Energy', () => {
    const s = toNight(party({ ash: ['sneaker'] }));
    expect(moveCost(s, 'ash', 'M')?.energy).toBe(0); // steep: +1 Energy
    expect(moveCost(s, 'birch', 'M')?.energy).toBe(1);
  });
});

describe('Photosynthesis', () => {
  it('a move sometimes restores 1 Energy', () => {
    let gained = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = party({ ash: ['photosynthesis'] }, seed);
      place(s, 'ash', 'T', { energy: 5 });
      if (hiker(run(s, move('ash', 'L')), 'ash').stats.energy === 6) gained += 1;
    }
    expect(gained).toBeGreaterThan(5);
    expect(gained).toBeLessThan(30);
  });
});

describe('Splitter', () => {
  it('when they eat, everyone else on the tile gains 1 Appetite', () => {
    let s = party({ ash: ['splitter'] });
    for (const id of ['birch', 'cedar']) place(s, id, 'T', { appetite: 5 });
    place(s, 'dot', 'L', { appetite: 5 });
    s = eat(s, 'ash');
    expect(hiker(s, 'birch').stats.appetite).toBe(6);
    expect(hiker(s, 'cedar').stats.appetite).toBe(6);
    expect(hiker(s, 'dot').stats.appetite).toBe(5);
  });
});

describe('Sherpa', () => {
  it('moving the group brings hikers from adjacent tiles too', () => {
    let s = party({ ash: ['sherpa'] });
    place(s, 'birch', 'L');
    place(s, 'cedar', 'C');
    expect(validateAction(s, moveAll('ash', 'M', ['birch']))).toBeNull();
    expect(validateAction(s, moveAll('ash', 'M', ['cedar']))).toBe('Cedar isn’t on this tile.');
    s = run(s, moveAll('ash', 'M', ['birch']));
    expect(hiker(s, 'birch')).toMatchObject({ tileId: 'M', cameFrom: 'L' });
    const plain = party({});
    place(plain, 'birch', 'L');
    expect(validateAction(plain, moveAll('ash', 'M', ['birch']))).toBe('Birch isn’t on this tile.');
  });
});

describe('Second Wind', () => {
  it('once a biome, becoming Exhausted refills Energy', () => {
    let s = party({ ash: ['secondWind'] });
    place(s, 'ash', 'T', { energy: 4 });
    s = run(s, { type: 'debug', op: { kind: 'setStats', hikerId: 'ash', stats: {} } });
    // A steep line costs 1 Energy: 4 → 3 is Exhausted.
    s = run(s, move('ash', 'M'));
    expect(hiker(s, 'ash').stats.energy).toBe(BALANCE.stats.max);
    place(s, 'ash', 'T', { energy: 4 });
    s = run(ready(s, 'ash'), move('ash', 'M'));
    expect(hiker(s, 'ash').stats.energy).toBe(3);
  });
});

describe('Carrier Pigeon', () => {
  it('sends to anyone anywhere, but nobody sends to it from afar', () => {
    const s = party({ ash: ['carrierPigeon'] });
    place(s, 'birch', 'C');
    hiker(s, 'ash').inventory.resources = { wood: 1 };
    hiker(s, 'birch').inventory.resources = { wood: 1 };
    expect(
      validateAction(s, { type: 'give', fromId: 'ash', toId: 'birch', resource: 'wood' }),
    ).toBeNull();
    expect(
      validateAction(s, { type: 'give', fromId: 'birch', toId: 'ash', resource: 'wood' }),
    ).toBe('Ash isn’t on this tile.');
  });
});

describe('Soldier’s March', () => {
  it('moving alone costs 1 less Appetite', () => {
    const s = party({ ash: ['soldiersMarch'] });
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(0);
    expect(moveAllCost(s, 'ash', 'L', ['birch'])?.[0]?.cost.appetite).toBe(2);
  });
});
