import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import {
  barrelLayout,
  behind,
  canDrag,
  canReady,
  drop,
  endRound,
  fire,
  hikerSpots,
  hitLine,
  isOver,
  keyAction,
  newGame,
  place,
  ready,
  result,
  resultLine,
  select,
  stillIn,
  type BearrelsState,
} from './logic';

const B = BALANCE.minigames.bearrels;
const game = (over: Partial<{ barrels: number; rounds: number; shots: number }> = {}, seed = 1) =>
  newGame({ barrels: 3, rounds: 3, shots: 1, ...over }, ['finn', 'ellie', 'mom'], seed);

/** Places each hiker behind the given barrels (in token order). */
function placeAll(s: BearrelsState, barrels: number[]): BearrelsState {
  let out = s;
  s.hikers.forEach((h, i) => {
    out = place(select(out, h), barrels[i] ?? 0);
  });
  return out;
}

/** Fires every shot of the round and ends it. */
function shootRound(s: BearrelsState): BearrelsState {
  let out = ready(s);
  while (out.fired < out.targets.length) out = fire(out).state;
  return endRound(out);
}

describe('the barrel layout', () => {
  it.each([3, 4, 5, 6])(
    '%i barrels: evenly spaced from 150 to 1130, sized by the formula, apart',
    (n) => {
      const row = barrelLayout(n);
      expect(row).toHaveLength(n);
      expect(row[0]!.x).toBe(B.rowX[0]);
      expect(row.at(-1)!.x).toBe(B.rowX[1]);
      const step = (B.rowX[1] - B.rowX[0]) / (n - 1);
      const width = Math.min(B.maxBarrelWidth, step * B.widthShare);
      row.forEach((b, i) => {
        expect(b.x).toBeCloseTo(B.rowX[0] + step * i);
        expect(b.width).toBeCloseTo(width);
        expect(b.height).toBeCloseTo(width * B.heightRatio);
        expect(b.top).toBe(B.barrelTop);
        // No overlap with the next barrel (the UI is checked in styles.test.ts).
        const next = row[i + 1];
        if (next) expect(b.x + b.width / 2).toBeLessThan(next.x - next.width / 2);
      });
    },
  );

  it('a single barrel sits in the middle', () => {
    expect(barrelLayout(1)[0]).toMatchObject({ x: 640, width: B.maxBarrelWidth });
  });

  it('hikers behind a barrel: bigger alone, smaller together, centered, heads above the top', () => {
    const [b] = barrelLayout(3);
    const one = hikerSpots(b!, 1);
    const four = hikerSpots(b!, 4);
    expect(one[0]).toMatchObject({ x: b!.x, scale: B.hikerScale.one });
    expect(one[0]!.y).toBeCloseTo(b!.top - B.headAbove * B.hikerScale.one);
    expect(four.map((p) => p.scale)).toEqual(Array(4).fill(B.hikerScale.more));
    expect((four[0]!.x + four[3]!.x) / 2).toBeCloseTo(b!.x);
    // Six barrels are narrower, so hikers shrink with them.
    const [narrow] = barrelLayout(6);
    expect(hikerSpots(narrow!, 1)[0]!.scale).toBeLessThan(B.hikerScale.one);
  });
});

describe('placing', () => {
  it('pick a hiker, then a barrel; the next unplaced hiker is picked for you', () => {
    let s = game();
    expect(s.selected).toBe('finn');
    s = place(s, 2);
    expect(s.placed).toEqual({ finn: 2 });
    expect(s.selected).toBe('ellie');
    // A placed hiker can be picked again and moved.
    s = place(select(s, 'finn'), 0);
    expect(s.placed.finn).toBe(0);
    expect(s.selected).toBe('ellie');
  });

  it('several hikers can share a barrel', () => {
    const s = placeAll(game(), [1, 1, 1]);
    expect(behind(s, 1)).toEqual(['finn', 'ellie', 'mom']);
  });

  it('Ready stays off until every hiker still in is placed', () => {
    let s = game();
    expect(canReady(s)).toBe(false);
    s = place(s, 0);
    s = place(s, 1);
    expect(canReady(s)).toBe(false);
    s = place(s, 2);
    expect(canReady(s)).toBe(true);
  });
});

describe('drag-and-drop', () => {
  it('dropping a hiker on a barrel hides them there; the next one not placed is picked', () => {
    const s = drop(game(), 'ellie', 2);
    expect(s.placed).toEqual({ ellie: 2 });
    expect(s.selected).toBe('finn');
    expect(s.highlight).toBe(2);
    // A placed hiker can be dragged to another barrel.
    expect(drop(s, 'ellie', 0).placed.ellie).toBe(0);
  });

  it('dropping anywhere else changes nothing: they go back', () => {
    const s = placeAll(game(), [0, 1, 2]);
    expect(drop(s, 'mom', null)).toBe(s);
    expect(drop(game(), 'finn', null)).toEqual(game());
    // Not a barrel in this game.
    expect(drop(s, 'mom', 5)).toBe(s);
  });

  it('no dragging while the bear is up, or a hiker who is out', () => {
    const placed = placeAll(game(), [1, 1, 0]);
    expect(canDrag(placed, 'finn')).toBe(true);
    const shooting = ready(placed);
    expect(canDrag(shooting, 'finn')).toBe(false);
    expect(drop(shooting, 'finn', 2)).toBe(shooting);
    const after = endRound(fire({ ...shooting, targets: [1] }).state);
    expect(canDrag(after, 'finn')).toBe(false);
    expect(canDrag(after, 'mom')).toBe(true);
    expect(drop(after, 'finn', 2).placed.finn).toBe(1);
    expect(canDrag(after, 'cody')).toBe(false);
  });

  it('tap, then tap still works alongside it', () => {
    let s = drop(game(), 'finn', 1);
    s = place(select(s, 'ellie'), 0);
    s = place(s, 2);
    expect(s.placed).toEqual({ finn: 1, ellie: 0, mom: 2 });
    expect(canReady(s)).toBe(true);
  });
});

describe('shooting', () => {
  it('the bear picks its barrels at Ready; with 2 shots never the same barrel twice', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const s = ready(placeAll(game({ barrels: 3, shots: 2 }, seed), [0, 1, 2]));
      expect(s.targets).toHaveLength(2);
      expect(new Set(s.targets).size).toBe(2);
      for (const t of s.targets) seen.add(t);
    }
    // Every barrel can be shot.
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('a hit takes out everyone behind that barrel, for the rest of the game', () => {
    let s = ready(placeAll(game(), [1, 1, 0]));
    s = { ...s, targets: [1] };
    const shot = fire(s);
    expect(shot.hit).toEqual(['finn', 'ellie']);
    expect(shot.state.out).toEqual({ finn: 1, ellie: 1 });
    s = endRound(shot.state);
    expect(stillIn(s)).toEqual(['mom']);
    // Out hikers can't be picked or placed.
    expect(select(s, 'finn').selected).toBeUndefined();
    const tried = place({ ...s, selected: 'finn' }, 2);
    expect(tried.placed.finn).toBe(1);
  });

  it('an empty barrel: nobody is hit', () => {
    const s = { ...ready(placeAll(game(), [0, 0, 0])), targets: [2] };
    expect(fire(s).hit).toEqual([]);
  });

  it('later rounds: hikers stay where they were, so Ready is lit at once', () => {
    let s = placeAll(game(), [0, 1, 2]);
    s = endRound(fire({ ...ready(s), targets: [2] }).state);
    expect(s.round).toBe(2);
    expect(s.placed).toMatchObject({ finn: 0, ellie: 1 });
    expect(canReady(s)).toBe(true);
    expect(s.selected).toBeUndefined();
  });

  it('the game ends after the last round, or as soon as everyone is out', () => {
    // Everyone behind one barrel, and the bear hits it: over in round 1 of 3.
    let s = placeAll(game({ rounds: 3 }), [0, 0, 0]);
    s = endRound(fire({ ...ready(s), targets: [0] }).state);
    expect(s.phase).toBe('over');
    expect(isOver(s)).toBe(true);
    expect(result(s)).toEqual({
      wording: 'safe-hit',
      safe: [],
      hit: [
        { hikerId: 'finn', round: 1 },
        { hikerId: 'ellie', round: 1 },
        { hikerId: 'mom', round: 1 },
      ],
    });
    // Nobody hit: it runs every round.
    let t = placeAll(game({ rounds: 2 }), [0, 0, 0]);
    t = endRound(fire({ ...ready(t), targets: [1] }).state);
    expect(t.phase).toBe('placing');
    t = endRound(fire({ ...ready(t), targets: [2] }).state);
    expect(t.phase).toBe('over');
    expect(resultLine(result(t))).toBe('3 safe, 0 hit');
  });

  it('the result says who was hit in which round', () => {
    let s = placeAll(game({ rounds: 3 }), [0, 1, 2]);
    s = endRound(fire({ ...ready(s), targets: [1] }).state);
    s = endRound(fire({ ...ready(s), targets: [2] }).state);
    s = endRound(fire({ ...ready(s), targets: [1] }).state);
    expect(result(s)).toEqual({
      wording: 'safe-hit',
      safe: ['finn'],
      hit: [
        { hikerId: 'ellie', round: 1 },
        { hikerId: 'mom', round: 2 },
      ],
    });
    expect(resultLine(result(s))).toBe('1 safe, 2 hit');
  });

  it('the prompt for who was hit', () => {
    expect(hitLine(['Finn'])).toBe('Finn was hit!');
    expect(hitLine(['Ellie', 'Mom'])).toBe('Ellie and Mom were hit!');
    expect(hitLine(['Finn', 'Ellie', 'Mom'])).toBe('Finn, Ellie and Mom were hit!');
  });
});

describe('the keyboard', () => {
  it('1–4, ← → and Enter play a whole game', () => {
    let s = game({ barrels: 4, rounds: 2, shots: 2 }, 7);
    const press = (key: string) => {
      s = keyAction(s, key).state;
    };
    // Finn (picked first) to barrel 2.
    press('ArrowRight');
    press('ArrowRight');
    press('Enter');
    expect(s.placed.finn).toBe(2);
    expect(s.selected).toBe('ellie');
    // Ellie to barrel 3, Mom to barrel 1.
    press('ArrowRight');
    press('Enter');
    press('ArrowLeft');
    press('ArrowLeft');
    press('Enter');
    expect(s.placed).toEqual({ finn: 2, ellie: 3, mom: 1 });
    // 2 picks Ellie again (the highlight jumps to her barrel), ← moves it, Enter places her.
    press('2');
    expect(s.selected).toBe('ellie');
    expect(s.highlight).toBe(3);
    press('ArrowLeft');
    press('Enter');
    expect(s.placed.ellie).toBe(2);
    // Everyone is placed: Enter is Ready.
    const r = keyAction(s, 'Enter');
    expect(r.pressedReady).toBe(true);
    s = r.state;
    expect(s.phase).toBe('shooting');
    while (s.fired < s.targets.length) s = fire(s).state;
    s = endRound(s);
    if (s.phase === 'placing') {
      // Round 2: everyone left is still placed, so Space is Ready at once.
      expect(keyAction(s, ' ').pressedReady).toBe(true);
      s = shootRound(s);
    }
    expect(s.phase).toBe('over');
  });

  it('keys do nothing while the bear is up', () => {
    const s = ready(placeAll(game(), [0, 1, 2]));
    expect(keyAction(s, '1').state).toBe(s);
    expect(keyAction(s, 'Enter').state).toBe(s);
  });
});

describe('settings', () => {
  it('are kept in range', () => {
    const s = newGame(
      { barrels: 9, rounds: 0, shots: 5 },
      ['finn', 'finn', 'ellie', 'mom', 'wyatt', 'gdog'],
      1,
    );
    expect(s.settings).toEqual({ barrels: 6, rounds: 1, shots: 2 });
    expect(s.hikers).toEqual(['finn', 'ellie', 'mom', 'wyatt']);
  });
});
