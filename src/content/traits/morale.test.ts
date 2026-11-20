import { describe, expect, it } from 'vitest';
import {
  fireAction,
  fireChallengeResult,
  fireCraft,
  fireHook,
  fireSitByFire,
} from '../../engine/effects';
import { makeItem } from '../../engine/items/make';
import { changeStat } from '../../engine/stats';
import {
  END,
  fixtureGame,
  fixtureHiker,
  hiker,
  place,
  run,
  toNight,
} from '../../engine/test/fixtures';
import type { HikerSetup } from '../../engine/newGame';
import type { Action, Family, GameState } from '../../engine/types';

type Who = 'ash' | 'birch' | 'cedar' | 'dot';

/** Ash, Birch, Cedar and Dot (with these traits and families) on tile L at Morale 5. */
function party(
  traits: Partial<Record<Who, string[]>>,
  families: Partial<Record<Who, Family>> = {},
) {
  const s = fixtureGame({
    hikers: (['ash', 'birch', 'cedar', 'dot'] as const).map((id): HikerSetup => ({
      ...fixtureHiker(id, traits[id]),
      family: families[id] ?? 'human',
    })),
  });
  for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'L', { morale: 5 });
  return s;
}

const morale = (s: GameState, id: Who = 'ash') => hiker(s, id).stats.morale;
/** Runs one hiker's start-of-day traits, and returns their Morale change. */
function startOfDay(s: GameState, id: Who = 'ash'): number {
  const before = morale(s, id);
  fireHook(s, hiker(s, id), 'onStartOfDay');
  return morale(s, id) - before;
}
/** Puts the others somewhere else, leaving these on L with Ash. */
const onlyWith = (s: GameState, ...keep: Who[]) => {
  for (const id of ['birch', 'cedar', 'dot'] as Who[]) if (!keep.includes(id)) place(s, id, 'C');
};
const lastWhy = (s: GameState) => {
  const e = s.log.findLast((x) => x.kind === 'stat' && x.stat === 'morale');
  return e?.kind === 'stat' ? e.why : undefined;
};

describe('start of day: company', () => {
  it('Extrinsic: −1 alone, +1 with someone, with why in the log', () => {
    const s = party({ ash: ['extrinsic'] });
    expect(startOfDay(s)).toBe(1);
    onlyWith(s);
    expect(startOfDay(s)).toBe(-1);
    expect(lastWhy(s)).toBe('alone right now');
  });

  it('Intrinsic: +1 alone, −1 with 2 or more others, nothing with one', () => {
    const s = party({ ash: ['intrinsic'] });
    expect(startOfDay(s)).toBe(-1);
    onlyWith(s, 'birch');
    expect(startOfDay(s)).toBe(0);
    onlyWith(s);
    expect(startOfDay(s)).toBe(1);
  });

  it('Zen: ±2', () => {
    const s = party({ ash: ['zen'] });
    expect(startOfDay(s)).toBe(-2);
    onlyWith(s);
    expect(startOfDay(s)).toBe(2);
  });

  it('Extrovert: +1 with 2 or more others, −1 alone', () => {
    const s = party({ ash: ['extrovert'] });
    expect(startOfDay(s)).toBe(1);
    onlyWith(s);
    expect(startOfDay(s)).toBe(-1);
  });

  it('Close Company: +1 with exactly one other, −1 in a crowd', () => {
    const s = party({ ash: ['closeCompany'] });
    expect(startOfDay(s)).toBe(-1);
    onlyWith(s, 'birch');
    expect(startOfDay(s)).toBe(1);
  });

  it('Chatty: −1 alone at the start of the day; by the fire, everyone gains', () => {
    const s = party({ ash: ['chatty'] });
    expect(startOfDay(s)).toBe(0);
    fireSitByFire(s, hiker(s, 'ash'));
    expect(['ash', 'birch', 'cedar', 'dot'].map((id) => morale(s, id as Who))).toEqual([
      6, 6, 6, 6,
    ]);
    onlyWith(s);
    expect(startOfDay(s)).toBe(-1);
  });

  it('Proud Mentor: −1 alone at the start of the day', () => {
    const s = party({ ash: ['proudMentor'] });
    expect(startOfDay(s)).toBe(0);
    onlyWith(s);
    expect(startOfDay(s)).toBe(-1);
  });
});

describe('start of day: comparing Morale', () => {
  it('Caring: Morale becomes the lowest among the others here', () => {
    const s = party({ ash: ['caring'] });
    place(s, 'birch', 'L', { morale: 8 });
    place(s, 'cedar', 'L', { morale: 3 });
    expect(startOfDay(s)).toBe(-2);
    expect(morale(s)).toBe(3);
    place(s, 'cedar', 'L', { morale: 9 });
    place(s, 'dot', 'L', { morale: 7 });
    expect(startOfDay(s)).toBe(4);
  });

  it('Center of Attention: +1 with the most Morale here (ties count), −1 otherwise', () => {
    const s = party({ ash: ['centerOfAttention'] });
    expect(startOfDay(s)).toBe(1); // everyone at 5: a tie
    place(s, 'birch', 'L', { morale: 9 });
    expect(startOfDay(s)).toBe(-1);
    onlyWith(s);
    expect(startOfDay(s)).toBe(0);
  });
});

describe('start of day: how the hiker is', () => {
  it('Foody: +1 well fed (8+), −1 hungry (5 or less)', () => {
    const s = party({ ash: ['foody'] });
    expect(startOfDay(s)).toBe(1);
    place(s, 'ash', 'L', { appetite: 6 });
    expect(startOfDay(s)).toBe(0);
    place(s, 'ash', 'L', { appetite: 5 });
    expect(startOfDay(s)).toBe(-1);
  });

  it('Dressed and Exhibitionist', () => {
    const s = party({ ash: ['dressed'], birch: ['exhibitionist'] });
    expect(startOfDay(s)).toBe(-1);
    expect(startOfDay(s, 'birch')).toBe(1);
    for (const id of ['ash', 'birch'] as Who[]) {
      hiker(s, id).inventory.equipped = {
        body: makeItem(s, 'plainShirt'),
        feet: makeItem(s, 'trailShoes'),
      };
    }
    expect(startOfDay(s)).toBe(1);
    expect(startOfDay(s, 'birch')).toBe(-1);
  });

  it('Location: +1 on its X node, −1 on its Y node', () => {
    const s = party({ ash: ['location:river/mountain'] });
    expect(startOfDay(s)).toBe(0); // Forest
    s.section.tiles.L!.nodes = [{ type: 'river', revealed: true }];
    expect(startOfDay(s)).toBe(1);
    s.section.tiles.L!.nodes = [{ type: 'mountain', revealed: true }];
    expect(startOfDay(s)).toBe(-1);
  });

  it('Fair-Weather: +1 clear, −1 in rain or snow', () => {
    const s = party({ ash: ['fairWeather'] });
    expect(startOfDay(s)).toBe(1);
    s.weather.today = 'snow';
    expect(startOfDay(s)).toBe(-1);
    s.weather.today = 'heatwave';
    expect(startOfDay(s)).toBe(0);
  });

  it('Alpha: +1 with more Humans than Dogs, −1 with more Dogs', () => {
    const s = party({ ash: ['alpha'] }, { birch: 'dog', cedar: 'dog', dot: 'plush' });
    // Ash and 2 Dogs (the Plush isn't a Dog).
    expect(startOfDay(s)).toBe(-1);
    onlyWith(s, 'birch', 'dot');
    expect(startOfDay(s)).toBe(0);
    onlyWith(s, 'dot');
    expect(startOfDay(s)).toBe(1);
  });
});

describe('start of day: the day before', () => {
  const nextMorning = (s: GameState) => run(toNight(s), END);

  it('Wanderlust: −1 after a day without moving; +1 for each new tile', () => {
    let s = party({ ash: ['wanderlust'] });
    s = nextMorning(s);
    expect(morale(s)).toBe(4);
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(morale(s)).toBe(5);
    expect(lastWhy(s)).toBe('a new tile');
    s = nextMorning(s);
    expect(morale(s)).toBe(5);
  });

  it('Thrill-Seeker: −1 after a day with no challenge; +1 for each pass', () => {
    let s = party({ ash: ['thrillSeekerMorale'] });
    s = nextMorning(s);
    expect(morale(s)).toBe(4);
    fireChallengeResult(s, 'L', { passed: true, hikerIds: ['ash', 'birch'] });
    expect(morale(s)).toBe(5);
    fireChallengeResult(s, 'L', { passed: true, hikerIds: ['birch'] });
    expect(morale(s)).toBe(5);
    hiker(s, 'ash').lastChallengeDay = s.day;
    s = nextMorning(s);
    expect(morale(s)).toBe(5);
  });

  it('Slow and Steady: +1 each phase on the same tile, −2 each move forward', () => {
    let s = party({ ash: ['slowAndSteady'] });
    s = run(s, END);
    expect(morale(s)).toBe(6);
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'C' });
    expect(morale(s)).toBe(4);
    s = run(s, END);
    expect(morale(s)).toBe(4); // it moved this phase
  });
});

describe('right away: what the hiker does', () => {
  const act = (s: GameState, kind: Parameters<typeof fireAction>[2]['kind'], extra = {}) =>
    fireAction(s, hiker(s, 'ash'), { kind, role: 'actor', tileId: 'L', ...extra });

  it('Action (crafting / scavenging)', () => {
    const s = party({ ash: ['action:craft/scavenge'] });
    act(s, 'craft');
    expect(morale(s)).toBe(6);
    act(s, 'scavenge');
    act(s, 'scavenge');
    expect(morale(s)).toBe(4);
    act(s, 'tend');
    expect(morale(s)).toBe(4);
  });

  it('Action through a real scavenge', () => {
    let s = party({ ash: ['action:craft/scavenge'] });
    s = run(s, { type: 'scavenge', hikerId: 'ash' });
    s = run(s, { type: 'scavengeFlip', cards: [0] }, { type: 'scavengeTake', card: 0 });
    expect(morale(s)).toBe(4);
  });

  it('Traveler (Tend): +1 each move, −1 each Tend', () => {
    let s = party({ ash: ['traveler:tend'] });
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(morale(s)).toBe(6);
    act(s, 'tend');
    expect(morale(s)).toBe(5);
  });

  it('Conservationist (Forest): +1 Tending a Forest tile, −1 scavenging a Forest node', () => {
    const s = party({ ash: ['conservationist:forest'] });
    act(s, 'tend');
    expect(morale(s)).toBe(6);
    act(s, 'scavenge', { node: 'forest' });
    act(s, 'scavenge', { node: 'river' });
    expect(morale(s)).toBe(5);
  });

  it('Simple Pleasures: +1 eating or sleeping, −1 crafting', () => {
    const s = party({ ash: ['simplePleasures'] });
    act(s, 'eat');
    act(s, 'sleep');
    expect(morale(s)).toBe(7);
    act(s, 'craft');
    expect(morale(s)).toBe(6);
  });

  it('Bossy: +1 leading the group, −1 being moved by someone else', () => {
    const lead = run(party({ ash: ['bossy'] }), {
      type: 'moveAll',
      hikerId: 'ash',
      toTileId: 'M',
      bring: ['birch'],
    } as Action);
    expect(morale(lead)).toBe(6);
    const led = run(party({ ash: ['bossy'] }), {
      type: 'moveAll',
      hikerId: 'birch',
      toTileId: 'M',
      bring: ['ash'],
    } as Action);
    expect(morale(led)).toBe(4);
  });
});

describe('right away: others on the tile', () => {
  it('Soccer Mom: +1 for each pass here, −1 for each fail', () => {
    const s = party({ ash: ['soccerMom'] });
    fireChallengeResult(s, 'L', { passed: true, hikerIds: ['birch'] });
    fireChallengeResult(s, 'L', { passed: true, hikerIds: ['cedar'] });
    expect(morale(s)).toBe(7);
    fireChallengeResult(s, 'L', { passed: false, hikerIds: ['dot'] });
    expect(morale(s)).toBe(6);
    fireChallengeResult(s, 'M', { passed: true, hikerIds: ['dot'] });
    expect(morale(s)).toBe(6);
  });

  it('Misophonia: −1 when someone else eats here, +2 crafting food', () => {
    let s = party({ ash: ['misophonia'] });
    const food = makeItem(s, 'pelmeni');
    hiker(s, 'birch').inventory.bag.push(food);
    s = run(s, { type: 'eat', hikerId: 'birch', itemUid: food.uid });
    expect(morale(s)).toBe(4);
    fireCraft(s, hiker(s, 'ash'), 'pelmeni', 'food');
    expect(morale(s)).toBe(6);
  });
});

describe('every Morale gain', () => {
  it('Rain Lover: 1 larger in rain or snow', () => {
    const s = party({ ash: ['rainLover'] });
    changeStat(s, hiker(s, 'ash'), 'morale', 1, 'test');
    expect(morale(s)).toBe(6);
    s.weather.today = 'rain';
    changeStat(s, hiker(s, 'ash'), 'morale', 1, 'test');
    expect(morale(s)).toBe(8);
    changeStat(s, hiker(s, 'ash'), 'morale', -1, 'test');
    expect(morale(s)).toBe(7);
  });

  it('Show Girl: Humans on her tile get 1 more from every gain', () => {
    const s = party({ ash: ['showGirl'] }, { cedar: 'dog' });
    changeStat(s, hiker(s, 'birch'), 'morale', 1, 'test');
    changeStat(s, hiker(s, 'cedar'), 'morale', 1, 'test');
    changeStat(s, hiker(s, 'ash'), 'morale', 1, 'test');
    expect([morale(s, 'birch'), morale(s, 'cedar'), morale(s)]).toEqual([7, 6, 7]);
    place(s, 'dot', 'M', { morale: 5 });
    changeStat(s, hiker(s, 'dot'), 'morale', 1, 'test');
    expect(morale(s, 'dot')).toBe(6);
  });
});

describe('family Morale traits', () => {
  it('Dog Lover, Cat Person, Loyal, Pack Animal and Aloof', () => {
    const s = party(
      { ash: ['dogLover', 'catPerson'], birch: ['loyal', 'packAnimal'], cedar: ['aloof'] },
      { birch: 'dog', cedar: 'cat', dot: 'plush' },
    );
    // Ash: a Dog (+1) and a Cat (+1). Birch: a Human (+1), no other Dog (−1). Cedar: a Dog (−1).
    expect(startOfDay(s)).toBe(2);
    expect(startOfDay(s, 'birch')).toBe(0);
    expect(startOfDay(s, 'cedar')).toBe(-1);
    // A Plush isn't a Dog.
    onlyWith(s, 'dot');
    expect(startOfDay(s)).toBe(-2);
  });
});
