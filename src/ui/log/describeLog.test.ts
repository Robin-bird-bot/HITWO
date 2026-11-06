import { describe, expect, it } from 'vitest';
import { STARTING_PARTY } from '../../content/characters';
import { applyAction, createGame, type Action, type GameState } from '../../engine';
import { fixtureGame, place, run, toNight } from '../../engine/test/fixtures';
import { gainResources } from '../../engine/effects';
import { describeLog, signed } from './describeLog';

const texts = (s: GameState) => describeLog(s, 50).map((l) => l.text);

describe('trail log sentences', () => {
  it('count stats down with a real minus sign', () => {
    expect(signed(-1, 'appetite')).toBe('−1 Appetite');
    expect(signed(2, 'energy')).toBe('+2 Energy');
  });

  it('say what a scavenge found, with its cost', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const open = run(s, { type: 'scavenge', hikerId: 'ash' });
    if (!open.scavenge) throw new Error('no deal');
    open.scavenge.cards[0] = {
      type: 'x2',
      rarity: 'uncommon',
      node: 'forest',
      resources: ['wood', 'wood'],
      flipped: true,
    };
    const after = run(open, { type: 'scavengeTake', card: 0 });
    expect(texts(after)).toEqual(['Ash scavenged Wood ×2 (−1 Appetite).']);
  });

  it('describe tending, giving and returning', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    s.abundance.forest = 3;
    s.hikers[0]!.inventory.resources = { wood: 2 };
    const after = run(
      s,
      { type: 'tend', hikerId: 'ash', node: 'forest' },
      { type: 'give', fromId: 'ash', toId: 'birch', resource: 'wood' },
      { type: 'returnToNature', hikerId: 'ash', resource: 'wood' },
    );
    expect(texts(after)).toEqual([
      'Ash tended the Forest (Forest Abundance 3 → 5, −1 Energy).',
      'Ash gave Wood to Birch.',
      'Ash returned Wood to nature (+1 Forest).',
    ]);
  });

  it('fold a move and its costs into one line', () => {
    const s = run(fixtureGame(), { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(texts(s)).toEqual(['Ash moved to Trail tile (−1 Appetite, −1 Energy).']);
  });

  it('describe leading the group', () => {
    const s = run(fixtureGame(), {
      type: 'moveAll',
      hikerId: 'ash',
      toTileId: 'L',
      bring: ['birch', 'cedar'],
    });
    expect(texts(s)).toEqual(['Ash led Birch and Cedar to Trail tile (−3 Appetite).']);
  });

  it('give each hiker one line for the night’s drains, then the new day', () => {
    let s = fixtureGame();
    for (const a of [
      { type: 'endPhase' },
      { type: 'endPhase' },
      { type: 'sleep', hikerId: 'ash' },
      { type: 'endPhase' },
    ] as Action[]) {
      s = applyAction(s, a);
    }
    const lines = texts(s);
    expect(lines).toContain('Ash slept.');
    expect(lines).toContain('Birch: −2 Energy (no sleep), −1 Appetite (end of day).');
    expect(lines).toContain('Ash: −1 Appetite (end of day).');
    expect(lines.at(-1)).toBe('Day 2 · Morning');
  });

  it('explain injuries', () => {
    // Ash goes without sleep at Energy 1: −2 takes Energy to 0.
    const s0 = fixtureGame();
    place(s0, 'ash', 'L', { energy: 1 });
    const s = run(toNight(s0), { type: 'endPhase' });
    expect(texts(s)).toContain(
      'Ash took an injury (energy hit 0): 1 of 3. Stats below 5 rise to 5.',
    );
  });

  it('describe abilities with their effect', () => {
    const game = createGame({ seed: 1, hikers: STARTING_PARTY });
    const s = applyAction(game, {
      type: 'useAbility',
      hikerId: 'hiker-2',
      abilityId: 'stoic',
      choice: 'energy',
    });
    expect(texts(s)).toEqual(['Hiker 2 used Stoic (−2 Morale).']);
  });

  it('describe a challenge, folding in what was paid, then its penalties (Phase 5)', () => {
    const s = fixtureGame({ challenges: true });
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    let g = run(s, {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'steep-trail', tileId: 'L' },
    });
    // Birch fails; find a seed where the 60% chance makes Birch Strained.
    for (let seed = 1; seed < 50; seed++) {
      const tryIt = run(
        { ...g, rng: fixtureGame({ seed }).rng },
        {
          type: 'resolveChallenge',
          sections: [
            {
              hikerId: 'ash',
              pay: true,
              option: 0,
              gifts: [{ kind: 'stat', req: 0, from: 'ash', stat: 'energy', count: 2 }],
            },
            { hikerId: 'birch', pay: false, gifts: [] },
          ],
        },
      );
      if (tryIt.hikers.some((h) => h.conditions.length)) {
        g = tryIt;
        break;
      }
    }
    const days = g.log.find((e) => e.kind === 'condition');
    expect(texts(g).slice(-2)).toEqual([
      'Steep Trail: Ash paid 2 Energy · Birch failed.',
      `Birch is Strained for ${days?.kind === 'condition' ? days.remaining : '?'} day${days?.kind === 'condition' && days.remaining === 1 ? '' : 's'} (Steep Trail).`,
    ]);
  });

  it('describe a Risk roll and a hiker swept away (Phase 5)', () => {
    const s = fixtureGame({ challenges: true });
    place(s, 'ash', 'L');
    s.hikers.find((h) => h.id === 'ash')!.inventory.resources = { wood: 10, stone: 2 };
    const open = run(s, {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'dangerous-current', tileId: 'L' },
    });
    const g = run(open, {
      type: 'resolveChallenge',
      sections: [{ hikerId: 'ash', pay: true, gifts: [] }],
    });
    const lines = texts(g);
    expect(lines).toContain('Dangerous Current: Ash was over the line.');
    expect(lines.some((l) => /^Ash was swept to .+ \(Dangerous Current\)\.$/.test(l))).toBe(true);
  });

  it('describe what an opportunity gave', () => {
    const s = fixtureGame({ challenges: true });
    place(s, 'ash', 'L');
    s.hikers.find((h) => h.id === 'ash')!.inventory.resources = { wood: 2 };
    const g = run(
      s,
      { type: 'debug', op: { kind: 'openChallenge', cardId: 'hikers-exchange', tileId: 'L' } },
      {
        type: 'resolveChallenge',
        sections: [
          {
            pay: true,
            gifts: [{ kind: 'resource', req: 0, from: 'ash', resource: 'wood', count: 2 }],
          },
        ],
      },
    );
    const lines = texts(g);
    expect(lines).toContain('Hikers Exchange: the party spent Wood ×2.');
    expect(lines.filter((l) => /^Ash got .+ \(Hikers Exchange\)\.$/.test(l))).toHaveLength(2);
  });

  it('describe a Trial starting and running out (Phase 5)', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const g = run(
      s,
      { type: 'debug', op: { kind: 'openChallenge', cardId: 'train', tileId: 'L' } },
      { type: 'acceptTrial' },
      { type: 'endPhase' },
      { type: 'endPhase' },
    );
    const lines = texts(g);
    expect(lines).toContain(
      'Trial: Train!! Every hiker leaves this tile by the end of the next phase.',
    );
    expect(lines).toContain('Train!!: time’s up for Ash.');
  });

  it('describe button presses and early reveals', () => {
    const s = fixtureGame({ challenges: true });
    place(s, 'ash', 'L');
    const g = run(
      s,
      { type: 'debug', op: { kind: 'openChallenge', cardId: 'old-firewatch-tower', tileId: 'L' } },
      { type: 'pressButton', button: 'climb', hikerId: 'ash', choice: 'M' },
    );
    const lines = texts(g);
    expect(
      lines.some((l) => /^M?.+’s card is known now: .+ \(Old Firewatch Tower\)\.$/.test(l)),
    ).toBe(true);
    expect(lines.some((l) => /^Old Firewatch Tower: Ash revealed a tile/.test(l))).toBe(true);
  });

  it('say who took part in a pick card, and what didn’t fit in a full pack', () => {
    const berries = run(fixtureGame({ challenges: true }), {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'mysterious-berries', tileId: 'T' },
    });
    const ids = berries.hikers.filter((h) => h.tileId === 'T').map((h) => h.id);
    const done = run(berries, {
      type: 'resolveChallenge',
      sections: ids.map((id, i) => ({ hikerId: id, pay: i === 0, gifts: [] })),
    });
    const line = texts(done).find((l) => l.startsWith('Mysterious Berries:'));
    expect(line).toMatch(/took part/);
    expect(line).toMatch(/sat out/);

    // A gain with no room left says so.
    const full = fixtureGame();
    const ash = full.hikers.find((h) => h.id === 'ash')!;
    ash.inventory.resources = { wood: 10 };
    gainResources(full, ash, ['stone', 'clay'], 'Snake Slots');
    expect(texts(full)).toContain('Ash’s pack is full: 2 resources left behind (Snake Slots).');
    ash.inventory.resources = { wood: 9 };
    gainResources(full, ash, ['stone', 'clay'], 'Snake Slots');
    expect(texts(full)).toContain('Ash got Stone, and 1 resource didn’t fit (Snake Slots).');
  });

  it('describe finding and accomplishing a Wonder', () => {
    const s = fixtureGame();
    s.section.tiles.M!.nodes = [];
    s.section.tiles.M!.wonder = { id: 'swiss-alps', decoys: 2 };
    let g = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(texts(g)).toContain('Found a Wonder: Swiss Alps!');
    g.section.tiles.M!.wonder!.goals = [{ index: 3, x: 1 }];
    g = run(g, { type: 'accomplishWonder', tileId: 'M', picks: { ash: { reward: 2 } } });
    expect(texts(g)).toContain('Swiss Alps accomplished! Ash took Lots of XP.');
  });

  it('keep only the most recent lines', () => {
    let s = fixtureGame();
    for (let i = 0; i < 9; i++) s = applyAction(s, { type: 'endPhase' });
    expect(describeLog(s, 3)).toHaveLength(3);
  });
});
