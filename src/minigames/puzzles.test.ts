/**
 * The four puzzle minigames and Line up (docs/design/11-minigames-puzzles.md,
 * section 6). Pure, seeded rules: every game reports Passed or Failed for
 * every hiker.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import * as FO from './findObject/logic';
import * as FP from './findPath/logic';
import { moveTo, needsLineUp, swap } from './lineup';
import * as RP from './rememberPath/logic';
import * as TR from './traildle/logic';

const B = BALANCE.minigames;
const FOUR = ['finn', 'ellie', 'mom', 'wyatt'];
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 3);

describe('Line up', () => {
  it('drag a card to a new place, or tap two to swap them; skipped with 1 hiker', () => {
    expect(moveTo(FOUR, 0, 2)).toEqual(['ellie', 'mom', 'finn', 'wyatt']);
    expect(moveTo(FOUR, 3, 0)).toEqual(['wyatt', 'finn', 'ellie', 'mom']);
    expect(swap(FOUR, 0, 3)).toEqual(['wyatt', 'ellie', 'mom', 'finn']);
    expect(swap(FOUR, 1, 1)).toEqual(FOUR);
    expect(needsLineUp(1)).toBe(false);
    expect(needsLineUp(2)).toBe(true);
  });

  it('every game gets the order', () => {
    const order = ['mom', 'finn', 'ellie'];
    expect(TR.newTraildle({ tier: 1, signs: 'auto', timer: 'auto' }, order, 1).order).toEqual(
      order,
    );
    expect(FO.newFindObject({ tier: 1, mode: 'auto' }, order, 1).order).toEqual(order);
    expect(RP.newRememberPath(1, order, 1).order).toEqual(order);
    expect(FP.newFindPath({ tier: 1, fog: 'auto' }, order, 1).line).toEqual(order);
  });
});

describe('Traildle', () => {
  const opts = (tier: TR.Tier, extra: Partial<TR.TraildleOptions> = {}): TR.TraildleOptions => ({
    tier,
    signs: 'auto',
    timer: 'auto',
    ...extra,
  });

  it('marks follow Wordle’s rule on codes with repeats', () => {
    expect(TR.marks([4, 4, 7], [4, 7, 4])).toEqual(['right', 'wrong', 'wrong']);
    expect(TR.marks([1, 2, 3], [3, 3, 3])).toEqual(['none', 'none', 'right']);
    expect(TR.marks([4, 4, 1], [7, 4, 4])).toEqual(['none', 'right', 'wrong']);
    expect(TR.marks([1, 2, 3, 4], [4, 3, 2, 1])).toEqual(['wrong', 'wrong', 'wrong', 'wrong']);
  });

  it('no repeated digits on Tier I; signs and guesses by tier', () => {
    for (const seed of SEEDS) {
      const s = TR.newTraildle(opts(1), FOUR, seed);
      expect(s.signs).toBeGreaterThanOrEqual(3);
      expect(s.signs).toBeLessThanOrEqual(4);
      for (const b of s.boards) expect(new Set(b.code).size).toBe(b.code.length);
      expect(s.guessesAllowed).toBe(B.traildle.tiers[1].guesses + B.traildle.twoCodeExtraGuesses);
      expect(s.timeLeft).toBeNull();
    }
    const t3 = TR.newTraildle(opts(3), ['finn'], 5);
    expect(t3.signs).toBeGreaterThanOrEqual(7);
    expect(t3.guessesAllowed).toBe(B.traildle.tiers[3].guesses);
    expect(t3.timeLeft).toBe(B.traildle.tiers[3].timerSec);
    // Overrides: an exact sign count, and the timer on or off.
    expect(TR.newTraildle(opts(2, { signs: 3 }), FOUR, 1).signs).toBe(3);
    expect(TR.newTraildle(opts(1, { timer: 'on' }), FOUR, 1).timeLeft).toBe(B.traildle.timerOnSec);
    expect(TR.newTraildle(opts(3, { timer: 'off' }), FOUR, 1).timeLeft).toBeNull();
  });

  it('pairs: 4 hikers make 2 + 2, 3 hikers make 2 + 1', () => {
    expect(TR.pairsOf(FOUR)).toEqual([
      ['finn', 'ellie'],
      ['mom', 'wyatt'],
    ]);
    expect(TR.pairsOf(['finn', 'ellie', 'mom'])).toEqual([['finn', 'ellie'], ['mom']]);
  });

  it('every guess goes into both boards; a solved board locks and passes', () => {
    let s = TR.newTraildle(opts(1, { signs: 3 }), ['finn', 'ellie'], 9);
    const finn = s.boards[0]!.code;
    s = TR.submit(s, finn);
    expect(s.boards[0]!.solved).toBe(true);
    expect(s.boards[1]!.rows).toHaveLength(1);
    // The next guess only goes to Ellie's board.
    s = TR.submit(s, [0, 0, 0]);
    expect(s.boards[0]!.rows).toHaveLength(1);
    expect(s.boards[1]!.rows).toHaveLength(2);
    s = TR.submit(s, s.boards[1]!.code);
    expect(s.phase).toBe('pairDone');
    expect(s.results).toEqual({ finn: 'passed', ellie: 'passed' });
  });

  it('a guess must fill every sign; running out of guesses fails the unsolved boards', () => {
    let s = TR.newTraildle(opts(1, { signs: 3 }), ['finn'], 2);
    expect(TR.canSubmit(s, [1, null, 2])).toBe(false);
    expect(TR.submit(s, [1, 2])).toBe(s);
    const wrong = s.boards[0]!.code.map((d) => (d + 1) % 10);
    for (let i = 0; i < s.guessesAllowed; i++) s = TR.submit(s, wrong);
    expect(s.phase).toBe('pairDone');
    expect(s.results).toEqual({ finn: 'failed' });
    s = TR.nextPair(s);
    expect(s.phase).toBe('over');
    expect(TR.result(s)).toMatchObject({
      safe: [],
      hit: [{ hikerId: 'finn' }],
      wording: 'passed-failed',
    });
  });

  it('the timer fails every unsolved board in that pair, then the next pair starts with new codes', () => {
    let s = TR.newTraildle(opts(2), FOUR, 4);
    s = TR.submit(s, s.boards[0]!.code);
    const old = s.boards.map((b) => b.code.join(''));
    s = TR.tick(s, 1000);
    expect(s.results).toEqual({ finn: 'passed', ellie: 'failed' });
    s = TR.nextPair(s);
    expect(s.boards.map((b) => b.hikerId)).toEqual(['mom', 'wyatt']);
    expect(s.boards.map((b) => b.code.join(''))).not.toEqual(old);
  });

  it('the digit strip: right beats in the code, which beats not in the code', () => {
    const board: TR.Board = { hikerId: 'finn', code: [1, 4, 2], rows: [], solved: false };
    board.rows.push({ guess: [4, 4, 3], marks: TR.marks(board.code, [4, 4, 3]) });
    const k = TR.digitKnowledge(board);
    expect(k[4]).toBe('right');
    expect(k[3]).toBe('absent');
    expect(k[1]).toBe('unknown');
  });
});

describe('Find the Object', () => {
  it('targets: one per hiker, all the same on Tier I, a mix of 2 from Tier II; never a distractor', () => {
    for (const seed of SEEDS) {
      const one = FO.newFindObject({ tier: 1, mode: 'auto' }, FOUR, seed);
      expect(one.targets).toHaveLength(4);
      expect(new Set(one.targets).size).toBe(1);
      const two = FO.newFindObject({ tier: 2, mode: 'auto' }, FOUR, seed);
      expect(new Set(two.targets).size).toBe(2);
      for (const s of [one, two]) {
        for (const item of s.items.filter((i) => !i.target)) {
          expect(s.targets).not.toContain(item.snack);
        }
        expect(s.items.filter((i) => i.target)).toHaveLength(4);
      }
    }
    const s = FO.newFindObject({ tier: 1, mode: 'auto' }, FOUR, 1);
    expect(s.items).toHaveLength(
      4 + B.findObject.tiers[1].distractors + 3 * B.findObject.extraDistractorsPerHiker,
    );
    expect(s.timeTotal).toBe(B.findObject.timeSec + 3 * B.findObject.extraSecPerTarget);
  });

  it('modes by tier, and the testing override', () => {
    expect(FO.newFindObject({ tier: 1, mode: 'auto' }, FOUR, 1).mode).toBe('still');
    expect(FO.newFindObject({ tier: 2, mode: 'auto' }, FOUR, 1).mode).toBe('windy');
    expect(FO.newFindObject({ tier: 3, mode: 'auto' }, FOUR, 1).mode).toBe('dark');
    expect(FO.newFindObject({ tier: 1, mode: 'dark' }, FOUR, 1).mode).toBe('dark');
  });

  it('Tier I: nothing overlaps, and everything keeps off the edges', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const s = FO.newFindObject({ tier: 1, mode: 'auto' }, FOUR, seed);
      for (const [i, a] of s.items.entries()) {
        expect(a.x).toBeGreaterThanOrEqual(B.findObject.edgeMargin);
        expect(a.x + FO.SNACK_SIZE).toBeLessThanOrEqual(320 - B.findObject.edgeMargin + 1);
        for (const b of s.items.slice(i + 1)) {
          const apart =
            Math.abs(a.x - b.x) >= FO.SNACK_SIZE - 1 || Math.abs(a.y - b.y) >= FO.SNACK_SIZE - 1;
          expect(apart).toBe(true);
        }
      }
    }
  });

  const middle = (s: FO.FindObjectState, i: number, t = 0) => {
    const at = FO.positionAt(s, s.items[i]!, t);
    return { x: at.x + 8, y: at.y + 8 };
  };

  it('with k of n targets found, exactly the first k in line pass', () => {
    let s = FO.newFindObject({ tier: 1, mode: 'auto' }, FOUR, 3);
    const targets = s.items.flatMap((it, i) => (it.target ? [i] : []));
    for (const i of targets.slice(0, 2)) s = FO.click(s, middle(s, i), 0).state;
    s = FO.tick(s, 999);
    expect(s.over).toBe(true);
    expect(FO.result(s)).toMatchObject({ safe: ['finn', 'ellie'], wording: 'passed-failed' });
    expect(FO.result(s).hit.map((h) => h.hikerId)).toEqual(['mom', 'wyatt']);
  });

  it('a wrong click takes 2 s; finding every target ends it with everyone safe', () => {
    let s = FO.newFindObject({ tier: 1, mode: 'auto' }, ['finn', 'ellie'], 8);
    const wrong = s.items.findIndex((it) => !it.target);
    const click = FO.click(s, middle(s, wrong), 0);
    expect(click.outcome).toBe('wrong');
    expect(click.state.timeLeft).toBe(s.timeLeft - B.findObject.wrongClickSec);
    s = click.state;
    for (const [i, it] of s.items.entries()) if (it.target) s = FO.click(s, middle(s, i), 0).state;
    expect(s.over).toBe(true);
    expect(FO.result(s).safe).toEqual(['finn', 'ellie']);
  });

  it('Windy: snacks drift and come back in on the other side', () => {
    const s = { ...FO.newFindObject({ tier: 2, mode: 'auto' }, FOUR, 2), wind: 1 as const };
    const item = { ...s.items[0]!, x: 310 };
    const later = FO.positionAt(s, item, 2);
    expect(later.x).toBeLessThan(310);
    expect(later.x).toBeGreaterThanOrEqual(-FO.SNACK_SIZE);
    for (let t = 0; t < 60; t += 0.7) {
      const p = FO.positionAt(s, s.items[3]!, t);
      expect(p.x).toBeGreaterThanOrEqual(-FO.SNACK_SIZE);
      expect(p.x).toBeLessThan(320);
    }
  });

  it('Dark: only things inside the light can be seen and picked', () => {
    const s = FO.newFindObject({ tier: 3, mode: 'auto' }, FOUR, 6);
    const i = s.items.findIndex((it) => it.target);
    const at = middle(s, i);
    expect(FO.inLight(s.items[i]!, at)).toBe(true);
    expect(FO.itemAt(s, at, 0, at)).toBe(i);
    // The light somewhere else: nothing to pick there.
    const far = { x: at.x > 160 ? 20 : 300, y: at.y };
    expect(FO.inLight(s.items[i]!, far)).toBe(false);
    expect(FO.itemAt(s, at, 0, far)).toBeNull();
    expect(FO.click(s, at, 0, far).outcome).toBe('none');
  });
});

describe('Remember the Path', () => {
  it('every path starts on the bottom row, ends on the top row, touches it only at the end, and never repeats a tile', () => {
    for (const tier of [1, 2, 3] as const) {
      const t = B.rememberPath.tiers[tier];
      for (const seed of SEEDS) {
        const s = RP.newRememberPath(tier, FOUR, seed);
        const p = s.path;
        expect(p[0]!.r).toBe(t.rows - 1);
        expect(p.at(-1)!.r).toBe(0);
        expect(p.filter((x) => x.r === 0)).toHaveLength(1);
        expect(new Set(p.map((x) => `${x.c},${x.r}`)).size).toBe(p.length);
        expect(p.length).toBeGreaterThanOrEqual(t.length[0]);
        expect(p.length).toBeLessThanOrEqual(t.length[1]);
        p.slice(1).forEach((x, i) => expect(RP.nextTo(p[i]!, x)).toBe(true));
      }
    }
  });

  it('strikes by tier: 3, 2, 1; a tap that isn’t next to the token costs nothing', () => {
    for (const tier of [1, 2, 3] as const) {
      let s = RP.watched(RP.newRememberPath(tier, FOUR, 11));
      expect(s.strikesLeft).toBe(B.rememberPath.tiers[tier].strikes);
      const start = s.path[0]!;
      const far = { c: start.c, r: start.r - 3 };
      expect(RP.step(s, far).outcome).toBe('ignored');
      // A wrong neighbor: a strike.
      const next = s.path[1]!;
      const wrong = [
        { c: start.c - 1, r: start.r },
        { c: start.c + 1, r: start.r },
        { c: start.c, r: start.r - 1 },
      ].find((t) => t.c >= 0 && t.c < s.cols && !RP.sameTile(t, next))!;
      const hit = RP.step(s, wrong);
      expect(hit.outcome).toBe('wrong');
      s = hit.state;
      expect(s.strikesLeft).toBe(B.rememberPath.tiers[tier].strikes - 1);
      if (tier === 3) expect(hit.failed).toBe(true);
    }
  });

  it('walking the whole path passes; each hiker gets a new path; the result lists everyone', () => {
    let s = RP.newRememberPath(1, ['finn', 'ellie'], 21);
    const first = s.path.map((t) => `${t.c},${t.r}`).join(' ');
    s = RP.watched(s);
    let last: ReturnType<typeof RP.step> | undefined;
    for (const t of s.path.slice(1)) {
      last = RP.step(s, t);
      s = last.state;
    }
    expect(last?.passed).toBe(true);
    s = RP.nextHiker(s);
    expect(RP.currentHiker(s)).toBe('ellie');
    expect(s.phase).toBe('watch');
    expect(s.path.map((t) => `${t.c},${t.r}`).join(' ')).not.toBe(first);
    s = RP.nextHiker(s);
    expect(s.phase).toBe('over');
    expect(RP.result(s)).toMatchObject({ safe: ['finn'], hit: [{ hikerId: 'ellie' }] });
  });
});

describe('Find the Path', () => {
  it('trails start on the bottom row, end on the top, never go down or repeat a tile', () => {
    for (const tier of [1, 2, 3] as const) {
      for (const seed of SEEDS) {
        const s = FP.newFindPath({ tier, fog: 'auto' }, FOUR, seed);
        const t = s.trail;
        expect(t[0]!.r).toBe(s.rows - 1);
        expect(t.at(-1)!.r).toBe(0);
        expect(new Set(t.map(FP.key)).size).toBe(t.length);
        t.slice(1).forEach((x, i) => {
          const p = t[i]!;
          expect(x.r).toBeLessThanOrEqual(p.r);
          expect(Math.abs(x.c - p.c) + Math.abs(x.r - p.r)).toBe(1);
        });
      }
    }
  });

  it('down is never offered, and known trees can’t be picked', () => {
    let s = FP.newFindPath({ tier: 2, fog: 'off' }, FOUR, 3);
    const at = s.trail[0]!;
    for (const c of FP.choices(s)) expect(c.r).toBeLessThanOrEqual(at.r);
    const wrong = FP.choices(s).find((c) => FP.key(c) !== FP.key(s.trail[1]!))!;
    s = FP.pick(s, wrong).state;
    expect(s.known[FP.key(wrong)]).toBe('trees');
    expect(FP.choices(s).some((c) => FP.key(c) === FP.key(wrong))).toBe(false);
    expect(FP.pick(s, wrong).outcome).toBe('ignored');
  });

  /**
   * Picks wrong tiles until the current hiker runs out of tries. A spot has
   * at most two wrong tiles (one of up, left and right is the trail), so
   * when none is left the hiker steps on along the trail first.
   */
  function runOut(s: FP.FindPathState): FP.FindPathState {
    const who = FP.currentHiker(s);
    let guard = 0;
    while (FP.currentHiker(s) === who && !s.over && guard++ < 40) {
      const next = s.trail[s.pos + 1]!;
      const wrong = FP.choices(s).find((c) => FP.key(c) !== FP.key(next));
      s = FP.pick(s, wrong ?? next).state;
    }
    return s;
  }

  it('running out of tries sends the hiker to the back of the line and costs 1 attempt', () => {
    let s = FP.newFindPath({ tier: 3, fog: 'off' }, ['finn', 'ellie'], 5);
    const attempts = s.attempts;
    expect(attempts).toBe(BALANCE.minigames.findPath.attempts + 1);
    s = runOut(s);
    expect(s.line).toEqual(['ellie', 'finn']);
    expect(s.attempts).toBe(attempts - 1);
    expect(s.tries).toBe(BALANCE.minigames.findPath.triesPerTurn);
  });

  it('with no attempts left, running out means out', () => {
    let s = FP.newFindPath({ tier: 3, fog: 'off' }, ['finn', 'ellie'], 5);
    s = { ...s, attempts: 0 };
    s = runOut(s);
    expect(s.results.finn).toBe('failed');
    expect(s.line).toEqual(['ellie']);
  });

  it('the first hiker through gets the Energy; without fog the rest walk the known trail through', () => {
    let s = FP.newFindPath({ tier: 1, fog: 'off' }, ['mom', 'finn', 'ellie'], 8);
    while (FP.currentHiker(s) === 'mom') s = FP.pick(s, s.trail[s.pos + 1]!).state;
    expect(s.results).toEqual({ mom: 'passed', finn: 'passed', ellie: 'passed' });
    expect(s.energy).toBe('mom');
    expect(s.over).toBe(true);
    expect(FP.result(s)).toMatchObject({ energy: 'mom', wording: 'passed-failed' });
  });

  it('fog: faded trail tiles are free and faded trees cost a try', () => {
    let s = FP.newFindPath({ tier: 3, fog: 'auto' }, ['finn', 'ellie'], 13);
    expect(s.fog).toBe(true);
    // Finn finds two trail tiles, then runs into trees until he runs out.
    s = FP.pick(s, s.trail[1]!).state;
    s = FP.pick(s, s.trail[2]!).state;
    const tree = FP.choices(s).find((c) => FP.key(c) !== FP.key(s.trail[3]!))!;
    s = runOut(s);
    expect(FP.currentHiker(s)).toBe('ellie');
    expect(s.pos).toBe(0);
    // Ellie retraces from memory: the faded trail tile costs nothing.
    expect(FP.isVisible(s, s.trail[1]!)).toBe(false);
    const tries = s.tries;
    s = FP.pick(s, s.trail[1]!).state;
    expect(s.tries).toBe(tries);
    s = FP.pick(s, s.trail[2]!).state;
    // The faded tree is offered again, and costs a try.
    if (!FP.isVisible(s, tree) && FP.choices(s).some((c) => FP.key(c) === FP.key(tree))) {
      const before = s.tries;
      s = FP.pick(s, tree).state;
      expect(s.tries).toBe(before - 1);
    }
  });
});
