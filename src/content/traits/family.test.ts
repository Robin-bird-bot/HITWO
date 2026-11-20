import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../../engine/applyAction';
import { moveAllCost } from '../../engine/costs';
import { abilitiesFor } from '../../engine/effects';
import { makeItem } from '../../engine/items/make';
import { canApply } from '../../engine/night/nightEvents';
import { scavengeSetup } from '../../engine/scavenge/setup';
import { familyCanHave } from '../../engine/traits/slots';
import { fixtureGame, fixtureHiker, hiker, place, run } from '../../engine/test/fixtures';
import type { HikerSetup } from '../../engine/newGame';
import type { Action, Family, GameState } from '../../engine/types';
import type { NightOutcome } from '../nightEvents';
import { TRAITS } from './index';

type Who = 'ash' | 'birch' | 'cedar' | 'dot';
interface Setup {
  traits?: string[];
  family?: Family;
}

/** Ash, Birch, Cedar and Dot on the trailhead, each with a family and traits. */
function party(who: Partial<Record<Who, Setup>>, seed = 1): GameState {
  const hikers: HikerSetup[] = (['ash', 'birch', 'cedar', 'dot'] as const).map((id) => ({
    ...fixtureHiker(id, who[id]?.traits),
    family: who[id]?.family ?? 'human',
  }));
  return fixtureGame({ seed, hikers });
}

const use = (hikerId: string, abilityId: string, choice?: string): Action => ({
  type: 'useAbility',
  hikerId,
  abilityId,
  ...(choice ? { choice } : {}),
});
/** What the hiker leading a Move All from T to L pays in Appetite. */
const leaderPays = (s: GameState, moverId: string, bring: string[]) =>
  moveAllCost(s, moverId, 'L', bring)?.[0]?.cost.appetite;
const PER = BALANCE.moveAll.perHikerAppetite;

describe('Lap Pet', () => {
  it('being moved with the group by a Human costs nothing extra', () => {
    const plain = party({ birch: { family: 'dog' } });
    const lap = party({ birch: { family: 'dog', traits: ['lapPet'] } });
    expect(leaderPays(lap, 'ash', ['birch'])).toBe(leaderPays(plain, 'ash', ['birch'])! - PER);
  });

  it('not when a Dog moves the group', () => {
    const plain = party({ ash: { family: 'dog' }, birch: { family: 'dog' } });
    const lap = party({ ash: { family: 'dog' }, birch: { family: 'dog', traits: ['lapPet'] } });
    expect(leaderPays(lap, 'ash', ['birch'])).toBe(leaderPays(plain, 'ash', ['birch']));
  });
});

describe('Pet Sitter and Herder', () => {
  it('Pet Sitter: Pets this hiker brings cost nothing extra; Humans still do', () => {
    const plain = party({ birch: { family: 'dog' } });
    const sitter = party({ ash: { traits: ['petSitter'] }, birch: { family: 'dog' } });
    expect(leaderPays(sitter, 'ash', ['birch'])).toBe(leaderPays(plain, 'ash', ['birch'])! - PER);
    expect(leaderPays(sitter, 'ash', ['cedar'])).toBe(leaderPays(plain, 'ash', ['cedar']));
  });

  it('Herder: Humans this Dog brings cost nothing extra; Dogs still do', () => {
    const plain = party({ ash: { family: 'dog' }, cedar: { family: 'dog' } });
    const herder = party({ ash: { family: 'dog', traits: ['herder'] }, cedar: { family: 'dog' } });
    expect(leaderPays(herder, 'ash', ['birch'])).toBe(leaderPays(plain, 'ash', ['birch'])! - PER);
    expect(leaderPays(herder, 'ash', ['cedar'])).toBe(leaderPays(plain, 'ash', ['cedar']));
  });
});

describe('Dog Whisperer', () => {
  it('Dogs on the tile get 1 more card to choose from; others don’t', () => {
    const s = party({ ash: { traits: ['dogWhisperer'] }, birch: { family: 'dog' } });
    const count = (id: string) => scavengeSetup(s, hiker(s, id)).count;
    place(s, 'ash', 'M');
    const dog = count('birch');
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    expect(count('birch')).toBe(dog + BALANCE.traits.dogWhisperer.cards);
    expect(count('cedar')).toBe(BALANCE.scavenge.cards);
  });
});

describe('Fetch', () => {
  /** Ash (a Dog with Fetch) on L; Birch on the trailhead (adjacent), Cedar on M. */
  function fetching() {
    const s = party({ ash: { family: 'dog', traits: ['fetch'] } });
    place(s, 'ash', 'L');
    place(s, 'cedar', 'L');
    hiker(s, 'birch').inventory.resources.wood = 2;
    hiker(s, 'cedar').inventory.resources.stone = 1;
    hiker(s, 'birch').inventory.bag.push(makeItem(s, 'pelmeni', { quality: 3 }));
    return s;
  }
  const choices = (s: GameState) =>
    abilitiesFor(s, hiker(s, 'ash'))
      .find((a) => a.ability.id === 'fetch')
      ?.choices?.map((c) => c.id) ?? [];

  it('takes 1 resource from a hiker on an adjacent tile, as a free action', () => {
    let s = fetching();
    // Birch is next door; Cedar is on the same tile, so not a fetch. Items aren't offered.
    expect(choices(s)).toEqual(['birch|r|wood']);
    s = run(s, use('ash', 'fetch', 'birch|r|wood'));
    expect(hiker(s, 'ash').inventory.resources.wood).toBe(1);
    expect(hiker(s, 'birch').inventory.resources.wood).toBe(1);
    expect(hiker(s, 'ash').acted).toBe(false);
  });

  it('once per day', () => {
    const s = run(fetching(), use('ash', 'fetch', 'birch|r|wood'));
    expect(validateAction(s, use('ash', 'fetch', 'birch|r|wood'))).not.toBeNull();
  });
});

describe('who can have family traits', () => {
  it('only the families named; a Plush isn’t a real Dog or Cat', () => {
    const can = (id: string) =>
      (['human', 'dog', 'cat', 'plush'] as const).filter((f) => familyCanHave(TRAITS[id]!, f));
    expect(can('lapPet')).toEqual(['dog', 'cat']);
    expect(can('petSitter')).toEqual(['human']);
    expect(can('herder')).toEqual(['dog']);
    expect(can('fetch')).toEqual(['dog']);
    expect(can('mouser')).toEqual(['cat']);
    expect(can('dogWhisperer')).toEqual(['human']);
    expect(can('trainer')).toEqual(['human']);
  });
});

describe('Mouser', () => {
  const takesResources = {
    id: 't',
    line: '',
    chip: '',
    needs: [{ kind: 'resources' }],
  } as NightOutcome;
  const takesFood = { id: 't', line: '', chip: '', needs: [{ kind: 'food' }] } as NightOutcome;

  it('night events that take food or resources skip hikers on the Cat’s tile', () => {
    const s = party({ ash: { family: 'cat', traits: ['mouser'] } });
    hiker(s, 'birch').inventory.resources.wood = 2;
    hiker(s, 'birch').inventory.bag.push(makeItem(s, 'pelmeni', { quality: 3 }));
    expect(canApply(s, hiker(s, 'birch'), takesResources)).toBe(false);
    expect(canApply(s, hiker(s, 'birch'), takesFood)).toBe(false);
    place(s, 'birch', 'L');
    expect(canApply(s, hiker(s, 'birch'), takesResources)).toBe(true);
    expect(canApply(s, hiker(s, 'birch'), takesFood)).toBe(true);
  });
});
