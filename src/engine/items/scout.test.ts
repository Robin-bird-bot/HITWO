import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { lineBetween } from '../map';
import { seedRng } from '../rng';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import { generateSection } from '../trail/generate';
import type { Action, GameState } from '../types';
import { makeItem } from './make';

/** Puts a tool in Ash's bag; returns its uid. */
function tool(s: GameState, itemId: string): string {
  const item = makeItem(s, itemId, { quality: 3 });
  hiker(s, 'ash').inventory.bag.push(item);
  return item.uid;
}

const use = (itemUid: string, choice?: string): Action => ({
  type: 'useItem',
  hikerId: 'ash',
  itemUid,
  targetId: 'ash',
  ...(choice ? { choice } : {}),
});

/** Challenges on, everyone on the trailhead. */
const game = (seed = 3) => fixtureGame({ seed, challenges: true });

describe('CHALLENGE_SHARE', () => {
  const was = BALANCE.challenges.share.meadow;
  afterEach(() => {
    BALANCE.challenges.share.meadow = was;
  });

  it('at 1, every tile keeps its card and the trail is the same', () => {
    const a = generateSection(seedRng(9), { biome: 'meadow', tier: 1 });
    expect(Object.values(a.tiles).some((t) => t.quiet)).toBe(false);
  });

  it('below 1, only that share of plain tiles holds a card; special spaces and Wonders keep theirs', () => {
    BALANCE.challenges.share.meadow = 0.5;
    const s = generateSection(seedRng(9), { biome: 'meadow', tier: 1 });
    const tiles = Object.values(s.tiles);
    const plain = tiles.filter((t) => t.kind === 'normal' && !t.special && !t.wonder);
    const quiet = tiles.filter((t) => t.quiet);
    expect(quiet.length).toBe(Math.round(plain.length / 2));
    expect(quiet.every((t) => !t.special && !t.wonder)).toBe(true);
  });

  it('a quiet tile opens nothing when someone lands there', () => {
    let s = game();
    s.section.tiles.L!.quiet = true;
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(s.challenge).toBeUndefined();
  });
});

describe('scanning', () => {
  it('Scanner: a tile connected by a line holds a card or not', () => {
    let s = game();
    s.section.tiles.L!.quiet = true;
    s = run(s, use(tool(s, 'scanner'), 'M'), use(tool(s, 'scanner'), 'L'));
    expect(s.section.tiles.M?.scan).toEqual({ has: true });
    expect(s.section.tiles.L?.scan).toEqual({ has: false });
    expect(validateAction(s, use(tool(s, 'scanner'), 'C'))).toBe(
      'Pick a tile connected to this one by a line.',
    );
  });

  it('Security Camera: the kind and tier, and that card opens on landing', () => {
    let s = game();
    s = run(s, use(tool(s, 'securityCamera'), 'M'));
    const scan = s.section.tiles.M?.scan;
    expect(scan?.has).toBe(true);
    expect(['challenge', 'opportunity', 'trial']).toContain(scan?.kind);
    expect(scan?.tier).toBe(1);
    const picked = s.section.tiles.M?.revealedCard;
    expect(picked?.hidden).toBe(true);
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(s.challenge?.cardId).toBe(picked?.cardId);
  });

  it('Radar Scanner and Minesweeper: the tiles around, counted', () => {
    let s = game();
    s = run(s, use(tool(s, 'minesweeper')));
    const event = s.log.findLast((e) => e.kind === 'scouted');
    expect(event?.kind === 'scouted' && event.tileIds.length).toBeGreaterThan(0);
    const counts = event?.kind === 'scouted' ? event.counts : undefined;
    const total = (counts?.challenge ?? 0) + (counts?.opportunity ?? 0) + (counts?.trial ?? 0);
    expect(total).toBe(event?.kind === 'scouted' ? event.tileIds.length : -1);

    let t = game();
    t = run(t, use(tool(t, 'radarScanner')));
    const swept = t.log.findLast((e) => e.kind === 'scouted');
    for (const id of swept?.kind === 'scouted' ? swept.tileIds : []) {
      expect(t.section.tiles[id]?.scan?.has).toBe(true);
    }
  });

  it('Linescan: a row, counted', () => {
    let s = game();
    s = run(s, use(tool(s, 'linescan'), 'M'));
    const event = s.log.findLast((e) => e.kind === 'scouted');
    expect(event).toMatchObject({ row: 1 });
    expect(event?.kind === 'scouted' && [...event.tileIds].sort()).toEqual(['L', 'M', 'R']);
  });
});

describe('looking and revealing', () => {
  it('Binoculars show the card on the map; a Camera shows the nodes too', () => {
    let s = game();
    s.section.tiles.M!.nodes = [{ type: 'river', revealed: false }];
    s = run(s, use(tool(s, 'binoculars'), 'L'), use(tool(s, 'camera'), 'M'));
    expect(s.section.tiles.L?.revealedCard?.hidden).toBeUndefined();
    expect(s.section.tiles.L?.revealedCard?.cardId).toBeTruthy();
    expect(s.section.tiles.M?.nodes[0]?.revealed).toBe(true);
    expect(validateAction(s, use(tool(s, 'binoculars'), 'L'))).toBe('Its card is already showing.');
  });

  it('a Telescope reaches any tile nobody has been to, and shows a picked card', () => {
    let s = game();
    s = run(s, use(tool(s, 'securityCamera'), 'M'));
    place(s, 'ash', 'L');
    s.section.tiles.L!.visited = true;
    s = run(s, use(tool(s, 'telescope'), 'R'), use(tool(s, 'telescope'), 'M'));
    expect(s.section.tiles.M?.revealedCard?.hidden).toBeUndefined();
    expect(validateAction(s, use(tool(s, 'telescope'), 'L'))).toBe('Pick a tile on the trail.');
  });
});

describe('changing the trail', () => {
  it('Paver: a line one step better; Paved stays Paved', () => {
    let s = game();
    s = run(s, use(tool(s, 'paver'), 'M'));
    expect(lineBetween(s.section, 'T', 'M')?.kind).toBe('normal');
    expect(validateAction(s, use(tool(s, 'paver'), 'R'))).toBe('That line is already Paved.');
  });

  it('Trampoline: hop beside, no line needed, no Appetite, no action', () => {
    let s = fixtureGame();
    s = run(s, use(tool(s, 'trampoline'), 'R'));
    expect(hiker(s, 'ash')).toMatchObject({ tileId: 'R', acted: false });
    expect(hiker(s, 'ash').stats.appetite).toBe(10);
  });

  it('Fire Flower: the card there is gone', () => {
    let s = game();
    s = run(s, use(tool(s, 'fireFlower'), 'L'));
    expect(s.section.tiles.L?.quiet).toBe(true);
    s = run(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(s.challenge).toBeUndefined();
  });

  it('Poo Bag: a tier lower, not below Tier I', () => {
    let s = game();
    expect(validateAction(s, use(tool(s, 'pooBag'), 'L'))).toBe(
      'The challenge there is already Tier I.',
    );
    s.section.tier = 2;
    s = run(s, use(tool(s, 'pooBag'), 'L'));
    expect(s.section.tiles.L?.tierBonus).toBe(-1);
  });

  it('nothing to do on a tile someone has been to', () => {
    const s = game();
    s.section.tiles.L!.visited = true;
    expect(validateAction(s, use(tool(s, 'scanner'), 'L'))).toBe('Someone has already been there.');
  });
});
