/**
 * One scene model, two versions (gps-greens update): switching between
 * Detailed pixel and Drawn 2D mid-round keeps every hiker's barrel, the
 * round and who is out. The model never mentions the version, and both draw
 * the same hikers at the same barrels, with the grass over them.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  endRound,
  fire,
  newGame,
  place,
  ready,
  select,
  type BearrelsState,
} from '../../../minigames/bearrels/logic';
import { emptyScene, sceneHikers, type SceneModel } from '../../../minigames/bearrels/scene';
import { ART_STYLES, barrelBoxes, pixelFrame } from '../../../minigames/bearrels/styles';
import { minigameHiker } from '../../../minigames/hikers';
import { BearrelsScene } from './Scene';

const HIKERS = ['finn', 'ellie', 'mom', 'wyatt'].map((id) => minigameHiker(id));

/** Round 2 of a game in which the first shot hit Ellie, with the others spread out. */
function midGame(): BearrelsState {
  let s = newGame(
    { barrels: 4, rounds: 3, shots: 1 },
    HIKERS.map((h) => h.id),
    42,
  );
  // The bear's barrel doesn't depend on where anyone stands: find it first.
  const target = ready(HIKERS.reduce((g, h) => place(select(g, h.id), 0), s)).targets[0]!;
  const others = [0, 1, 2, 3].filter((b) => b !== target);
  s = place(select(s, 'ellie'), target);
  s = place(select(s, 'finn'), others[0]!);
  s = place(select(s, 'mom'), others[1]!);
  s = place(select(s, 'wyatt'), others[1]!);
  s = fire(ready(s)).state;
  return endRound(s);
}

/** Who each renderer draws behind which barrel. */
function drawn(html: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of html.matchAll(/data-hiker="([^"]+)"[^>]*?data-barrel="(\d+)"/g)) {
    out[m[1]!] = Number(m[2]);
  }
  return out;
}

describe('switching art styles mid-round', () => {
  it('keeps every hiker’s barrel, the round and who is out', () => {
    const game = midGame();
    const before = JSON.stringify(game);
    expect(game.round).toBe(2);
    expect(Object.keys(game.out)).toEqual(['ellie']);

    const model: SceneModel = {
      ...emptyScene(4),
      hikers: sceneHikers(game, HIKERS, { tipped: [], gone: ['ellie'] }),
      outline: 2,
    };
    const expected = Object.fromEntries(
      Object.entries(game.placed).filter(([id]) => game.out[id] === undefined),
    );
    for (const style of ART_STYLES.map((s) => s.id)) {
      for (const frame of [undefined, pixelFrame(2294)]) {
        const html = renderToStaticMarkup(
          <BearrelsScene style={style} model={model} {...(frame ? { frame } : {})} />,
        );
        expect(drawn(html), style).toEqual(expected);
        expect(html).not.toContain('data-hiker="ellie"');
      }
    }
    // Drawing changed nothing in the game.
    expect(JSON.stringify(game)).toBe(before);
  });

  it('draws the foreground grass after the hikers, so it covers them', () => {
    const game = midGame();
    const model: SceneModel = {
      ...emptyScene(4),
      hikers: sceneHikers(game, HIKERS, { tipped: [], gone: [] }),
    };
    for (const style of ART_STYLES.map((s) => s.id)) {
      const html = renderToStaticMarkup(<BearrelsScene style={style} model={model} />);
      const lastHiker = html.lastIndexOf('data-hiker=');
      expect(lastHiker).toBeGreaterThan(0);
      expect(html.indexOf('data-layer="foreground"')).toBeGreaterThan(lastHiker);
    }
  });

  it('the muzzle flash shows at the pose the crosshair calls for', () => {
    const at = (crosshair: number) =>
      renderToStaticMarkup(
        <BearrelsScene style="pixel" model={{ ...emptyScene(3), bear: 'fire', crosshair }} />,
      );
    expect(at(0)).toContain('data-muzzle="left"');
    expect(at(1)).toContain('data-muzzle="center"');
    expect(at(2)).toContain('data-muzzle="right"');
    expect(at(2)).toContain('scaleX(-1)');
  });

  it('every style draws its tap areas on the same barrels', () => {
    const model = emptyScene(5);
    for (const style of ART_STYLES.map((s) => s.id)) {
      const html = renderToStaticMarkup(
        <BearrelsScene style={style} model={model} onBarrel={() => {}} />,
      );
      const taps = [...html.matchAll(/data-barrel="(\d+)"/g)].map((m) => Number(m[1]));
      expect(taps, style).toEqual([0, 1, 2, 3, 4]);
      expect(barrelBoxes(5)).toHaveLength(5);
    }
  });
});
