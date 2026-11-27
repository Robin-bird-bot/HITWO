/**
 * Difficulty and challenge density (Phase 10.6, docs/design/08-overhaul-plan.md).
 */
import { describe, expect, it } from 'vitest';
import { DIFFICULTY, DIFFICULTY_IDS, MAX_CHALLENGES_IN_A_ROW } from '../../config/difficulty';
import { STARTING_PARTY } from '../../content/characters';
import { pickForTile } from '../challenges/pick';
import { CARDS } from '../../content/challenges';
import { applyAction } from '../applyAction';
import { createGame } from '../newGame';
import { openStation } from '../station/stock';
import { seedRng } from '../rng';
import type { Section, Tile } from '../types';
import { generateSection, longestRun, middleRowsFor } from './generate';

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);

const middleTiles = (s: Section) => Object.values(s.tiles).filter((t) => t.kind === 'normal');
const plainOf = (s: Section) => middleTiles(s).filter((t) => !t.special);
const isChallengeTile = (t: Tile) => !t.special && !t.quiet && !t.opportunity;

describe('challenge density', () => {
  for (const id of DIFFICULTY_IDS) {
    const d = DIFFICULTY[id];
    it(`${d.name}: round(${d.challengeShare} × plain tiles) challenges, then ${d.opportunitiesPerSection} opportunities`, () => {
      for (const seed of SEEDS) {
        const s = generateSection(seedRng(seed), { biome: 'meadow', tier: 1, difficulty: id });
        const plain = plainOf(s);
        const challenges = plain.filter(isChallengeTile);
        const opportunities = plain.filter((t) => t.opportunity);
        expect(challenges.length).toBe(Math.round(d.challengeShare * plain.length));
        expect(opportunities.length).toBe(
          Math.min(d.opportunitiesPerSection, plain.length - challenges.length),
        );
        // Every other plain tile is quiet; special spaces keep working as before.
        expect(plain.filter((t) => t.quiet).length).toBe(
          plain.length - challenges.length - opportunities.length,
        );
        for (const t of middleTiles(s).filter((t) => t.special)) {
          expect(t.quiet).toBeUndefined();
          expect(t.opportunity).toBeUndefined();
        }
      }
    });
  }

  it('about half the plain tiles hold a challenge at every difficulty, and none an opportunity (29, section 5)', () => {
    for (const id of DIFFICULTY_IDS) {
      expect(DIFFICULTY[id]).toMatchObject({ challengeShare: 0.5, opportunitiesPerSection: 0 });
      for (const seed of SEEDS) {
        const s = generateSection(seedRng(seed), { biome: 'meadow', tier: 1, difficulty: id });
        const plain = plainOf(s);
        const share = plain.filter(isChallengeTile).length / plain.length;
        expect(Math.abs(share - 0.5), `${id} ${seed}`).toBeLessThanOrEqual(
          0.5 / plain.length + 1e-9,
        );
        expect(plain.some((t) => t.opportunity)).toBe(false);
      }
    }
  });

  it('sections get longer on harder settings', () => {
    expect(middleRowsFor('easy')).toBeLessThan(middleRowsFor('medium'));
    expect(middleRowsFor('hard')).toBeGreaterThan(middleRowsFor('medium'));
    for (const id of DIFFICULTY_IDS) {
      const s = generateSection(seedRng(5), { biome: 'meadow', tier: 1, difficulty: id });
      const lastRow = Math.max(...Object.values(s.tiles).map((t) => t.row));
      expect(lastRow - 1).toBe(middleRowsFor(id));
    }
  });

  it(`spreads challenges out: on Medium, no more than ${MAX_CHALLENGES_IN_A_ROW} in a row along a path`, () => {
    for (const seed of SEEDS) {
      const s = generateSection(seedRng(seed), { biome: 'meadow', tier: 1, difficulty: 'medium' });
      const ids = new Set(
        plainOf(s)
          .filter(isChallengeTile)
          .map((t) => t.id),
      );
      expect(longestRun(ids, s.lines, middleTiles(s))).toBeLessThanOrEqual(MAX_CHALLENGES_IN_A_ROW);
    }
  });

  it('a plain tile draws what was placed there: an opportunity tile only opportunities, a challenge tile a challenge', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const game = createGame({ seed, hikers: STARTING_PARTY });
      for (const t of plainOf(game.section)) {
        if (t.quiet) continue;
        const picked = pickForTile(game, seedRng(seed + 1), t, []);
        if (!picked) continue;
        const kind = CARDS[picked.cardId]?.kind;
        if (t.opportunity) expect(kind).toBe('opportunity');
        else expect(kind).not.toBe('trial');
      }
    }
  });
});

describe('the debug panel’s difficulty switch', () => {
  it('applies to the next section made, not the one being walked', () => {
    let game = createGame({ seed: 77, hikers: STARTING_PARTY });
    const before = JSON.stringify(game.section);
    game = applyAction(game, { type: 'debug', op: { kind: 'setDifficulty', difficulty: 'hard' } });
    expect(JSON.stringify(game.section)).toBe(before);
    const next = openStation(game).next;
    const lastRow = Math.max(...Object.values(next.tiles).map((t) => t.row));
    expect(lastRow - 1).toBe(middleRowsFor('hard'));
  });
});

describe('removed for now (Phase 10.6)', () => {
  it('no Wonders or Trials over 50 seeded runs', () => {
    for (let i = 0; i < 50; i++) {
      const seed = i * 104729 + 11;
      const game = createGame({ seed, hikers: STARTING_PARTY });
      const tiles = Object.values(game.section.tiles);
      expect(tiles.some((t) => t.wonder)).toBe(false);
      for (const t of tiles) {
        const picked = pickForTile(game, seedRng(seed + 2), t, []);
        const ids = picked ? [picked.cardId, picked.alternative].filter(Boolean) : [];
        for (const id of ids) expect(CARDS[id as string]?.kind).not.toBe('trial');
      }
    }
  });
});
