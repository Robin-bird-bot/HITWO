/**
 * Pack It Up (docs/design/23-minigames-final.md, sections 8 and 13): every
 * puzzle can be solved; pieces can't overlap or cover torn cells. And
 * turning, taking back, the spare cells, time, Prepare, and the bot.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import { packItUpBot } from './bot';
import {
  cellsAt,
  fits,
  newPackItUp,
  packed,
  packer,
  place,
  result,
  takeOut,
  tick,
  turn,
  type PackItUpState,
} from './logic';

const PU = BALANCE.minigames.packItUp;
const DT = 1 / 60;

const ready = (s: PackItUpState) => tick(s, BALANCE.minigames.quick.handoffSec + DT);

/** Packs everything at its cut spot and turn. */
function solve(s0: PackItUpState): PackItUpState {
  let s = s0;
  const first = packer(s);
  for (const p of [...s.pieces]) {
    if (p.id === s.sacked) continue;
    for (let k = 0; k < 4 && s.pieces.find((x) => x.id === p.id)!.rot !== p.homeRot; k++)
      s = turn(s, p.id);
    s = place(s, p.id, p.home);
    if (packer(s) !== first) break;
  }
  return s;
}

describe('the puzzle', () => {
  it.each(TIERS)(
    'Tier %i: every puzzle can be solved, with the tier’s torn and spare cells',
    (tier) => {
      for (let seed = 1; seed <= 25; seed++) {
        const s = ready(newPackItUp({ tier }, ['finn'], seed));
        const t = PU.tiers[tier];
        expect([s.cols, s.rows]).toEqual([t.cols, t.rows]);
        expect(s.torn.filter(Boolean)).toHaveLength(t.torn);
        const cells = s.pieces.reduce((n, p) => n + p.cells.length, 0);
        expect(cells).toBe(t.cols * t.rows - t.torn - t.spare);
        const most = tier >= PU.fiveFrom ? 5 : 4;
        for (const p of s.pieces) expect(p.cells.length).toBeLessThanOrEqual(most);
        const done = solve(s);
        expect(done.turns.done.finn).toBe(true);
      }
    },
  );

  it('pieces can’t overlap, cover a torn cell, or hang outside the pack', () => {
    for (let seed = 1; seed <= 15; seed++) {
      let s = ready(newPackItUp({ tier: 3 }, ['finn'], seed));
      const [a, b] = s.pieces;
      s = turn(s, a!.id);
      s = place(s, a!.id, { col: 0, row: 0 });
      const placed = s.pieces.find((x) => x.id === a!.id)!;
      if (placed.at) {
        // Another piece on top of it never fits.
        for (const c of cellsAt(placed, placed.at)) {
          expect(fits(s, b!.id, c)).toBe(
            cellsAt(b!, c).every(
              (x) => !cellsAt(placed, placed.at!).some((y) => y.col === x.col && y.row === x.row),
            ) && fits({ ...s, pieces: s.pieces.filter((x) => x.id !== a!.id) }, b!.id, c),
          );
        }
      }
      // No placement covers a torn cell or leaves the pack.
      for (const p of s.pieces) {
        for (let r = -1; r <= s.rows; r++)
          for (let c = -1; c <= s.cols; c++) {
            if (!fits(s, p.id, { col: c, row: r })) continue;
            for (const x of cellsAt(p, { col: c, row: r })) {
              expect(x.col >= 0 && x.row >= 0 && x.col < s.cols && x.row < s.rows).toBe(true);
              expect(s.torn[x.row * s.cols + x.col]).toBe(false);
            }
          }
      }
    }
  });

  it('a piece can be taken back out, and turned in place only if it still fits', () => {
    let s = ready(newPackItUp({ tier: 1 }, ['finn'], 3));
    const p = s.pieces[0]!;
    for (let k = 0; k < 4 && s.pieces[0]!.rot !== p.homeRot; k++) s = turn(s, p.id);
    s = place(s, p.id, p.home);
    expect(s.pieces[0]!.at).toEqual(p.home);
    s = takeOut(s, p.id);
    expect(s.pieces[0]!.at).toBeNull();
  });
});

describe('turns and time', () => {
  it('everything packed passes and the next hiker gets a new pack; time out fails with [1] energy', () => {
    let s = ready(newPackItUp({ tier: 2 }, ['finn', 'mom'], 4));
    const finnPieces = s.pieces.map((p) => p.id + ':' + p.cells.length).join();
    s = solve(s);
    expect(s.turns.done.finn).toBe(true);
    expect(packer(s)).toBe('mom');
    expect(s.pieces.every((p) => p.at === null)).toBe(true);
    expect(s.pieces.map((p) => p.id + ':' + p.cells.length).join()).not.toBe(finnPieces);
    s = ready(s);
    s = tick(s, s.timeSec + 0.1);
    expect(s.turns.done.mom).toBe(false);
    expect(s.leftOut.mom).toBeGreaterThan(0);
    const r = result(s);
    expect(r.safe).toEqual(['finn']);
    expect(r.pays?.mom).toEqual({ energy: BALANCE.minigames.quick.failEnergy });
  });

  it('Prepare: more time, a spare cell (Backpack), and the biggest piece in the sack', () => {
    const s = newPackItUp({ tier: 3, extraSec: 20, extraSpare: 1, sack: true }, ['finn'], 1);
    expect(s.timeSec).toBe(PU.tiers[3].timeSec + 20);
    const cells = s.pieces.reduce((n, p) => n + p.cells.length, 0);
    expect(cells).toBe(PU.tiers[3].cols * PU.tiers[3].rows - PU.tiers[3].torn - 1);
    const biggest = Math.max(...s.pieces.map((p) => p.cells.length));
    expect(s.pieces.find((p) => p.id === s.sacked)?.cells.length).toBe(biggest);
    // The sacked piece counts as packed.
    expect(
      packed({
        ...s,
        pieces: s.pieces.map((p) => (p.id === s.sacked ? p : { ...p, at: { col: 0, row: 0 } })),
      }),
    ).toBe(true);
  });
});

describe('the demo bot', () => {
  it('packs Tier I in time', () => {
    for (let seed = 1; seed <= 5; seed++) {
      let s = ready(newPackItUp({ tier: 1 }, ['finn'], seed));
      const mem: Record<string, unknown> = {};
      const rng = seedRng(seed);
      for (let k = 0; k < 60 * 70 && !s.over; k++) {
        const a = packItUpBot(s, mem, rng, s.time);
        if (a?.kind === 'turn') s = turn(s, a.id);
        else if (a) s = place(s, a.id, a.at);
        s = tick(s, DT);
      }
      expect(s.turns.done.finn).toBe(true);
    }
  });
});
