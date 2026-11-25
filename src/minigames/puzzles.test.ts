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
  const opts = (
    tier: FO.Tier,
    extra: Partial<FO.FindObjectOptions> = {},
  ): FO.FindObjectOptions => ({
    tier,
    mode: 'auto',
    ...extra,
  });
  const middle = (s: FO.FindObjectState, i: number, t = 0) => {
    const at = FO.positionAt(s, s.items[i]!, t);
    return { x: at.x + 8, y: at.y + 8 };
  };
  /** Finds n targets of the round (any kind). */
  const findSome = (s: FO.FindObjectState, n: number) => {
    let out = s;
    for (let k = 0; k < n; k++) {
      const i = out.items.findIndex((it) => it.target && !it.found);
      out = FO.click(out, middle(out, i), 0).state;
    }
    return out;
  };

  it('a found snack checks a slot showing that same snack: grapes, grapes, apple, the apple found first', () => {
    const s0 = FO.newFindObject(opts(2), ['finn', 'ellie', 'mom'], 3);
    // Set the round up as in the example, with one of each target on the field.
    const s: FO.FindObjectState = {
      ...s0,
      targets: ['grapes', 'grapes', 'apple'],
      found: [false, false, false],
      items: [
        { snack: 'grapes', x: 40, y: 60, target: true, found: false },
        { snack: 'grapes', x: 100, y: 60, target: true, found: false },
        { snack: 'apple', x: 160, y: 60, target: true, found: false },
      ],
    };
    const apple = FO.click(s, { x: 168, y: 68 }, 0);
    expect(apple.outcome).toBe('found');
    expect(apple.slot).toBe(2);
    expect(apple.state.found).toEqual([false, false, true]);
    const grapes = FO.click(apple.state, { x: 48, y: 68 }, 0);
    expect(grapes.state.found).toEqual([true, false, true]);
  });

  it('targets: one per hiker still in, one more each round; never a distractor', () => {
    for (const seed of SEEDS) {
      const one = FO.newFindObject(opts(1), FOUR, seed);
      expect(one.targets).toHaveLength(4);
      expect(new Set(one.targets).size).toBe(1);
      const two = FO.newFindObject(opts(2), FOUR, seed);
      expect(new Set(two.targets).size).toBe(2);
      for (const s of [one, two]) {
        for (const item of s.items.filter((i) => !i.target))
          expect(s.targets).not.toContain(item.snack);
        expect(s.items.filter((i) => i.target)).toHaveLength(4);
      }
    }
    // Round 2 asks for one more than round 1, with everyone still in.
    let s = FO.newFindObject(opts(1), ['finn', 'ellie', 'mom'], 5);
    expect(s.targets).toHaveLength(3);
    s = FO.nextRound(findSome(s, 3));
    expect(s.round).toBe(2);
    expect(s.targets).toHaveLength(4);
    expect(new Set(s.targets).size).toBeLessThanOrEqual(2);
    s = FO.nextRound(findSome(s, 4));
    expect(s.targets).toHaveLength(5);
    expect(FO.kindsFor(1, 1)).toBe(1);
    expect(FO.kindsFor(1, 2)).toBe(2);
    expect(FO.kindsFor(3, 3)).toBe(3);
  });

  it('each unfound target puts one hiker out, from the back of the line, and they stay out', () => {
    let s = FO.newFindObject(opts(1), FOUR, 3);
    s = findSome(s, 2);
    expect(FO.atRisk(s)).toEqual(['mom', 'wyatt']);
    s = FO.tick(s, 999);
    expect(s.phase).toBe('roundOver');
    expect(s.lost).toEqual(['mom', 'wyatt']);
    expect(s.line).toEqual(['finn', 'ellie']);
    s = FO.nextRound(s);
    // Round 2: the 2 still in, plus 1.
    expect(s.targets).toHaveLength(3);
    s = FO.tick(s, 999);
    // 3 unfound, 2 hikers: both out, and it's over.
    expect(s.phase).toBe('over');
    expect(FO.result(s)).toMatchObject({ safe: [], wording: 'passed-failed' });
    expect(s.out).toEqual({ mom: 1, wyatt: 1, finn: 2, ellie: 2 });
  });

  it('the game ends after the last round; hikers still in pass', () => {
    let s = FO.newFindObject(opts(1, { rounds: 2 }), ['finn', 'ellie'], 8);
    expect(s.rounds).toBe(2);
    s = FO.nextRound(findSome(s, 2));
    s = findSome(s, 2);
    s = FO.tick(s, 999);
    expect(s.phase).toBe('over');
    expect(FO.result(s).safe).toEqual(['finn']);
    expect(FO.result(s).hit.map((h) => h.hikerId)).toEqual(['ellie']);
  });

  it('a wrong click takes 2 s; the time settings change the clock', () => {
    const s = FO.newFindObject(opts(1), ['finn', 'ellie'], 8);
    expect(s.timeTotal).toBe(B.findObject.extraSecPerRound + B.findObject.secPerTarget * 2);
    const wrong = s.items.findIndex((it) => !it.target);
    const click = FO.click(s, middle(s, wrong), 0);
    expect(click.outcome).toBe('wrong');
    expect(click.state.timeLeft).toBe(s.timeLeft - B.findObject.wrongClickSec);
    const custom = FO.newFindObject(
      opts(1, { secPerTarget: 6, extraSecPerRound: 0 }),
      ['finn', 'ellie'],
      8,
    );
    expect(custom.timeTotal).toBe(12);
  });

  it('modes by tier (Tier III is Dark + windy), and the testing override', () => {
    expect(FO.newFindObject(opts(1), FOUR, 1).mode).toBe('still');
    expect(FO.newFindObject(opts(2), FOUR, 1).mode).toBe('windy');
    expect(FO.newFindObject(opts(3), FOUR, 1).mode).toBe('darkWindy');
    expect(FO.newFindObject(opts(1, { mode: 'dark' }), FOUR, 1).mode).toBe('dark');
  });

  it('Tier I: nothing overlaps, and everything keeps off the edges', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const s = FO.newFindObject(opts(1), FOUR, seed);
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

  it('the windy modes: snacks drift and come back in on the other side', () => {
    for (const mode of ['windy', 'darkWindy'] as const) {
      const s = { ...FO.newFindObject(opts(2, { mode }), FOUR, 2), wind: 1 as const };
      const item = { ...s.items[0]!, x: 310 };
      expect(FO.positionAt(s, item, 2).x).toBeLessThan(310);
      for (let t = 0; t < 60; t += 0.7) {
        const p = FO.positionAt(s, s.items[3]!, t);
        expect(p.x).toBeGreaterThanOrEqual(-FO.SNACK_SIZE);
        expect(p.x).toBeLessThan(320);
      }
    }
  });

  it('the dark modes: only things inside the light can be seen and picked; Dark + windy also drifts', () => {
    for (const mode of ['dark', 'darkWindy'] as const) {
      const s = FO.newFindObject(opts(3, { mode }), FOUR, 6);
      const i = s.items.findIndex((it) => it.target);
      const at = middle(s, i, 1);
      expect(FO.itemAt(s, at, 1, at)).toBe(i);
      const far = { x: at.x > 160 ? 20 : 300, y: at.y };
      expect(FO.itemAt(s, at, 1, far)).toBeNull();
      expect(FO.click(s, at, 1, far).outcome).toBe('none');
    }
    const dw = FO.newFindObject(opts(3), FOUR, 6);
    expect(FO.isDark(dw.mode) && FO.isWindy(dw.mode)).toBe(true);
    expect(FO.positionAt(dw, dw.items[0]!, 3)).not.toEqual({
      x: dw.items[0]!.x,
      y: dw.items[0]!.y,
    });
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
      s = RP.step(s, s.path[0]!).state;
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

  it('each hiker starts below the grid: every bottom-row tile is next to them, a wrong one is a strike, others are ignored', () => {
    let s = RP.watched(RP.newRememberPath(2, FOUR, 4));
    expect(s.pos).toBe(RP.BELOW);
    const start = s.path[0]!;
    expect(RP.step(s, { c: start.c, r: s.rows - 2 }).outcome).toBe('ignored');
    const wrong = { c: start.c === 0 ? 1 : 0, r: s.rows - 1 };
    const hit = RP.step(s, wrong);
    expect(hit.outcome).toBe('wrong');
    expect(hit.state.pos).toBe(RP.BELOW);
    expect(hit.state.strikesLeft).toBe(s.strikesLeft - 1);
    s = RP.step(hit.state, start).state;
    expect(s.pos).toBe(0);
  });

  it('walking the whole path passes; each hiker gets a new path; the result lists everyone', () => {
    let s = RP.newRememberPath(1, ['finn', 'ellie'], 21);
    const first = s.path.map((t) => `${t.c},${t.r}`).join(' ');
    s = RP.watched(s);
    let last: ReturnType<typeof RP.step> | undefined;
    for (const t of s.path) {
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
  const walkNext = (s: FP.FindPathState) => FP.pick(s, s.nextOf[FP.key(s.at)]!).state;

  it('trails start on the bottom row, end on the top, never go down or repeat a tile', () => {
    for (const tier of [1, 2, 3] as const) {
      for (const seed of SEEDS) {
        const s = FP.newFindPath({ tier, fog: 'auto' }, FOUR, seed);
        const t = s.trail;
        expect(t[0]!.r).toBe(s.rows - 1);
        expect(t.at(-1)!.r).toBe(0);
        expect(t.filter((x) => x.r === 0)).toHaveLength(1);
        expect(new Set(t.map(FP.key)).size).toBe(t.length);
        t.slice(1).forEach((x, i) => {
          const p = t[i]!;
          expect(x.r).toBeLessThanOrEqual(p.r);
          expect(Math.abs(x.c - p.c) + Math.abs(x.r - p.r)).toBe(1);
          expect(s.nextOf[FP.key(p)]).toEqual(x);
        });
      }
    }
  });

  it('down is never offered, and known trees can’t be picked', () => {
    let s = FP.newFindPath({ tier: 2, fog: 'off' }, FOUR, 3);
    for (const c of FP.choices(s)) expect(c.r).toBeLessThanOrEqual(s.at.r);
    const next = s.nextOf[FP.key(s.at)]!;
    const wrong = FP.choices(s).find((c) => FP.key(c) !== FP.key(next) && !FP.isTrail(s, c))!;
    s = FP.pick(s, wrong).state;
    expect(s.known[FP.key(wrong)]).toBe('trees');
    expect(FP.choices(s).some((c) => FP.key(c) === FP.key(wrong))).toBe(false);
    expect(FP.pick(s, wrong).outcome).toBe('ignored');
  });

  it('Wyatt’s trail: a later trail tile right above an earlier one is a wrong pick, but never trees', () => {
    // Left along the bottom row, up, then back right: (3,5) sits right above (3,6).
    const trail = [
      { c: 6, r: 6 },
      { c: 5, r: 6 },
      { c: 4, r: 6 },
      { c: 3, r: 6 },
      { c: 2, r: 6 },
      { c: 2, r: 5 },
      { c: 3, r: 5 },
      { c: 4, r: 5 },
      { c: 4, r: 4 },
      { c: 4, r: 3 },
      { c: 4, r: 2 },
      { c: 4, r: 1 },
      { c: 4, r: 0 },
    ];
    const base = FP.newFindPath({ tier: 3, fog: 'off' }, ['mom', 'finn'], 1);
    let s: FP.FindPathState = {
      ...base,
      trail,
      nextOf: FP.nextLookup(trail),
      known: { '6,6': 'trail' },
      uncoveredAt: { '6,6': 0 },
      at: trail[0]!,
      rng: [1, 2, 3, 4],
    };
    s = walkNext(walkNext(walkNext(s)));
    expect(s.at).toEqual({ c: 3, r: 6 });
    const out = FP.pick(s, { c: 3, r: 5 });
    expect(out.outcome).toBe('wrong');
    expect(out.state.known['3,5']).toBe('trail');
    expect(out.state.tries).toBe(s.tries - 1);
    // The trail can still be finished from there.
    s = out.state;
    while (!s.over && FP.currentHiker(s) === 'mom') s = walkNext(s);
    expect(s.results.mom).toBe('passed');
  });

  /**
   * Picks wrong tiles until the current hiker runs out of tries. A spot has
   * at most two wrong tiles, so when none is left the hiker steps on first.
   */
  function runOut(s: FP.FindPathState): FP.FindPathState {
    const who = FP.currentHiker(s);
    let guard = 0;
    while (FP.currentHiker(s) === who && !s.over && guard++ < 40) {
      const next = s.nextOf[FP.key(s.at)]!;
      const wrong = FP.choices(s).find((c) => FP.key(c) !== FP.key(next));
      s = FP.pick(s, wrong ?? next).state;
    }
    return s;
  }

  it('running out hides the trail, sends the hiker to the back of the line, and costs 1 attempt', () => {
    let s = FP.newFindPath({ tier: 3, fog: 'off' }, ['finn', 'ellie'], 5);
    const attempts = s.attempts;
    expect(attempts).toBe(BALANCE.minigames.findPath.attempts + 1);
    s = walkNext(s);
    const found = FP.key(s.at);
    s = runOut(s);
    expect(s.line).toEqual(['ellie', 'finn']);
    expect(s.attempts).toBe(attempts - 1);
    expect(s.tries).toBe(BALANCE.minigames.findPath.triesPerTurn);
    // The trail is hidden again (the trailhead stays); the trees stay; Ellie starts at the trailhead.
    expect(s.known[found]).toBeUndefined();
    expect(Object.values(s.known).filter((k) => k === 'trail')).toHaveLength(1);
    expect(Object.values(s.known).some((k) => k === 'trees')).toBe(true);
    expect(s.at).toEqual(s.trail[0]);
    expect(s.justHidden).toBe(true);
    // A hidden trail tile is still right, and free.
    const tries = s.tries;
    s = FP.pick(s, s.nextOf[FP.key(s.at)]!).state;
    expect(s.tries).toBe(tries);
    expect(s.known[FP.key(s.at)]).toBe('trail');
  });

  it('"Hide after a run-out: Everything" hides the trees too', () => {
    let s = FP.newFindPath({ tier: 3, fog: 'off', hide: 'everything' }, ['finn', 'ellie'], 5);
    s = runOut(s);
    expect(Object.keys(s.known)).toEqual([FP.key(s.trail[0]!)]);
  });

  it('with no attempts left, running out means out', () => {
    let s = FP.newFindPath({ tier: 3, fog: 'off' }, ['finn', 'ellie'], 5);
    s = { ...s, attempts: 0 };
    s = runOut(s);
    expect(s.results.finn).toBe('failed');
    expect(s.line).toEqual(['ellie']);
  });

  it('the first hiker through gets the Energy; the trail stays and the rest walk it through', () => {
    let s = FP.newFindPath({ tier: 1, fog: 'off' }, ['mom', 'finn', 'ellie'], 8);
    while (FP.currentHiker(s) === 'mom') s = walkNext(s);
    expect(s.results).toEqual({ mom: 'passed', finn: 'passed', ellie: 'passed' });
    expect(s.energy).toBe('mom');
    expect(s.over).toBe(true);
    expect(FP.result(s)).toMatchObject({ energy: 'mom', wording: 'passed-failed' });
  });

  it('fog: faded trail tiles are free and faded trees cost a try', () => {
    let s = FP.newFindPath({ tier: 3, fog: 'auto' }, ['finn', 'ellie'], 13);
    expect(s.fog).toBe(true);
    s = walkNext(walkNext(s));
    const third = s.nextOf[FP.key(s.at)]!;
    const tree = FP.choices(s).find((c) => FP.key(c) !== FP.key(third) && !FP.isTrail(s, c));
    if (tree) s = FP.pick(s, tree).state;
    s = FP.pick(
      s,
      FP.choices(s).find((c) => FP.key(c) === FP.key(third))!,
    ).state;
    s = walkNext(s);
    // Older picks have faded, but the game still knows them.
    if (tree) {
      expect(FP.isVisible(s, tree)).toBe(false);
      expect(s.known[FP.key(tree)]).toBe('trees');
    }
  });

  it('1,000 games on each grid, picking at random: every one can be finished, and the trail never shows as trees', () => {
    const problems: string[] = [];
    for (const tier of [1, 2, 3] as const) {
      for (let seed = 0; seed < 1000; seed++) {
        const fog = seed % 2 ? 'on' : 'off';
        const hide = seed % 3 === 0 ? 'everything' : 'trail';
        let s = FP.newFindPath({ tier, fog, hide }, FOUR.slice(0, 1 + (seed % 4)), seed);
        const trailKeys = s.trail.map(FP.key);
        // A small seeded picker, so the test is the same every time.
        let r = (seed * 2654435761) >>> 0;
        const rand = (n: number) => {
          r = (r * 1103515245 + 12345) >>> 0;
          return r % n;
        };
        let picks = 0;
        while (!s.over && picks < 2000) {
          const options = FP.choices(s);
          if (!options.length) {
            problems.push(`tier ${tier} seed ${seed}: stuck`);
            break;
          }
          const out = FP.pick(s, options[rand(options.length)]!);
          if (out.fixed) problems.push(`tier ${tier} seed ${seed}: self-check fixed a tile`);
          s = out.state;
          if (trailKeys.some((k) => s.known[k] === 'trees')) {
            problems.push(`tier ${tier} seed ${seed}: trail shown as trees`);
          }
          picks++;
        }
        if (!s.over) problems.push(`tier ${tier} seed ${seed}: never finished`);
        else if (Object.keys(s.results).length !== s.order.length) {
          problems.push(`tier ${tier} seed ${seed}: someone has no result`);
        }
      }
    }
    expect(problems).toEqual([]);
  }, 60000);
});
