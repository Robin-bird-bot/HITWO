/**
 * Birdsong (docs/design/23-minigames-final.md, sections 5 and 13): Tiers I
 * and II repeat the last song plus one note; Tier III and up make new
 * songs; a wrong note doesn't end the song; 3 strikes end that hiker's
 * game. And the notes crossing, turns, the end, Prepare, and the bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { birdsongBot } from './bot';
import {
  listenSec,
  newBirdsong,
  notesNow,
  pick,
  result,
  singer,
  tick,
  type BirdsongState,
} from './logic';

const BS = BALANCE.minigames.birdsong;
const DT = 1 / 60;
const THREE = ['finn', 'mom', 'ellie'];

/** On to the answer: past the hand-off and the listening. */
function toAnswer(s0: BirdsongState): BirdsongState {
  let s = s0;
  for (let k = 0; k < 60 * 60 && s.phase !== 'answer' && !s.over; k++) s = tick(s, DT);
  return s;
}
/** Sing the song back right, then on to the next round. */
function singRight(s0: BirdsongState): BirdsongState {
  let s = toAnswer(s0);
  for (const c of s.song) s = pick(s, c);
  for (let k = 0; k < 60 * 5 && s.phase === 'after'; k++) s = tick(s, DT);
  return s;
}

describe('songs', () => {
  it.each([1, 2] as const)('Tier %i: each song is the last one plus one note', (tier) => {
    let s = newBirdsong({ tier }, THREE, 3);
    expect(s.song).toHaveLength(BS.firstLength);
    while (!s.over) {
      const before = s.song;
      s = singRight(s);
      if (s.over) break;
      expect(s.song).toHaveLength(before.length + 1);
      expect(s.song.slice(0, before.length)).toEqual(before);
    }
    expect(s.round).toBe(BS.tiers[tier].longest - BS.firstLength + 1);
  });

  it.each([3, 4, 5] as const)('Tier %i: every round is a new song, one note longer', (tier) => {
    let changed = 0;
    for (let seed = 1; seed <= 10; seed++) {
      let s = newBirdsong({ tier }, THREE, seed);
      const before = s.song;
      s = singRight(s);
      expect(s.song).toHaveLength(before.length + 1);
      if (s.song.slice(0, before.length).join() !== before.join()) changed++;
    }
    expect(changed).toBeGreaterThan(5);
  });

  it('notes are colorless until they cross the middle', () => {
    let s = newBirdsong({ tier: 1 }, ['finn'], 1);
    for (let k = 0; k < 60 * 5 && s.phase !== 'listen'; k++) s = tick(s, DT);
    for (let k = 0; k < 60 * listenSec(s); k += 6) {
      for (const n of notesNow(s)) expect(n.lit).toBe(n.x >= BS.screenW / 2);
      s = tick(s, DT * 6);
    }
  });
});

describe('answering', () => {
  it('a wrong note is a strike, and the song goes on to its end', () => {
    let s = toAnswer(newBirdsong({ tier: 1 }, THREE, 2));
    const wrong = (s.song[0]! + 1) % s.colors;
    s = pick(s, wrong);
    expect(s.strikes.finn).toBe(1);
    expect(s.wrong).toEqual([0]);
    expect(s.phase).toBe('answer');
    s = pick(s, s.song[1]!);
    expect(s.phase).toBe('after');
    expect(s.out).toEqual([]);
  });

  it('3 strikes end that hiker’s game at once; play skips them after', () => {
    let s = toAnswer(newBirdsong({ tier: 3 }, ['finn', 'mom'], 5));
    s = { ...s, strikes: { finn: 2, mom: 0 } };
    s = pick(s, (s.song[0]! + 1) % s.colors);
    expect(s.out).toEqual(['finn']);
    expect(s.phase).toBe('after');
    // Mom sings every song from now on.
    for (let r = 0; r < 3 && !s.over; r++) {
      for (let k = 0; k < 60 * 5 && s.phase === 'after'; k++) s = tick(s, DT);
      expect(singer(s)).toBe('mom');
      s = singRight(s);
    }
  });

  it('everyone out ends it; hikers still in pass', () => {
    let s = toAnswer(newBirdsong({ tier: 1 }, ['finn'], 1));
    s = { ...s, strikes: { finn: 2 } };
    s = pick(s, (s.song[0]! + 1) % s.colors);
    for (let k = 0; k < 60 * 5 && !s.over; k++) s = tick(s, DT);
    expect(s.over).toBe(true);
    expect(result(s).safe).toEqual([]);
    let all = newBirdsong({ tier: 1 }, THREE, 4);
    while (!all.over) all = singRight(all);
    expect(result(all).safe).toEqual(THREE);
  });
});

describe('Prepare and the settings', () => {
  it('+1 strike for a hiker, slower notes, each song twice; colors and songs follow the settings', () => {
    const s = newBirdsong(
      { tier: 2, extraStrikes: { mom: 1 }, slower: 0.2, twice: true },
      THREE,
      1,
    );
    expect(s.strikeMax).toEqual({ finn: BS.strikes, mom: BS.strikes + 1, ellie: BS.strikes });
    expect(s.speed).toBeCloseTo(BS.tiers[2].speed * 0.8);
    expect(s.plays).toBe(2);
    expect(newBirdsong({ tier: 1, colors: 7 }, THREE, 1).colors).toBe(7);
    expect(newBirdsong({ tier: 1, songs: 'new' }, THREE, 1).mode).toBe('new');
    expect(newBirdsong({ tier: 5, songs: 'grow' }, THREE, 1).mode).toBe('grow');
  });
});

describe('the demo bot', () => {
  it('gets most notes right', () => {
    let right = 0;
    let all = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let s = newBirdsong({ tier: 3 }, THREE, seed);
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      for (let k = 0; k < 60 * 300 && !s.over; k++) {
        const c = birdsongBot(s, mem, rng, s.time);
        if (c !== null) {
          all++;
          if (s.song[s.answer.length] === c) right++;
          s = pick(s, c);
        }
        s = tick(s, DT);
      }
    }
    expect(right / all).toBeGreaterThan(0.8);
  });
});
