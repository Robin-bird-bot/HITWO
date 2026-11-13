import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { validateAction } from './applyAction';
import { cardFits } from './challenges/pick';
import { CARDS } from '../content/challenges';
import { addStacks } from './conditions';
import { seedRng } from './rng';
import { scavengeSetup } from './scavenge/setup';
import { deserialize, serialize } from './save';
import { END, fixtureGame, hiker, place, run, toNight } from './test/fixtures';
import type { GameState, NodeType, WeatherId } from './types';
import {
  changeWeather,
  fillForecast,
  freshWeather,
  hikerEffectActive,
  setNodeState,
  weatherDaysLeft,
} from './weather';

const ash = (s: GameState) => hiker(s, 'ash');
const conditionsOf = (s: GameState, id: string) => hiker(s, id).conditions.map((c) => c.id);
const stacks = (s: GameState, id: string, cond: string) =>
  hiker(s, id).conditions.find((c) => c.id === cond)?.stacks ?? 0;

/** The fixture with today's weather set, held, and its grace day already over. */
function weathered(
  today: WeatherId,
  setup: (s: GameState) => void = () => {},
  seed = 1,
): GameState {
  const s = fixtureGame({ seed });
  s.rng = seedRng(seed);
  changeWeather(s, today);
  s.weather.since = s.day - 1;
  setup(s);
  return s;
}

/** Gives the fixture's middle tiles one node each of these types. */
function nodes(s: GameState, l: NodeType, m: NodeType, r: NodeType): void {
  s.section.tiles.L!.nodes = [{ type: l, revealed: true }];
  s.section.tiles.M!.nodes = [{ type: m, revealed: true }];
  s.section.tiles.R!.nodes = [{ type: r, revealed: true }];
}

describe('the schedule and forecast', () => {
  it('is the same for the same seed, starts Clear, and always shows 3 days ahead', () => {
    expect(freshWeather(7)).toEqual(freshWeather(7));
    const w = freshWeather(7);
    expect(w.today).toBe('clear');
    expect(w.ahead.length).toBeGreaterThanOrEqual(BALANCE.weather.forecastDays);
  });

  it('alternates: Clear for 2–4 days, then a weather for 2–3 days', () => {
    const w = freshWeather(3);
    const days: WeatherId[] = [w.today];
    while (days.length < 200) {
      days.push(w.ahead.shift()!);
      fillForecast(w);
    }
    const runs: { kind: WeatherId; n: number }[] = [];
    for (const d of days) {
      const last = runs.at(-1);
      if (last && last.kind === d) last.n += 1;
      else runs.push({ kind: d, n: 1 });
    }
    // Leave out the first and last runs, which the 200 days cut short.
    for (const [i, r] of runs.slice(1, -1).entries()) {
      if (r.kind === 'clear') expect(r.n).toBeGreaterThanOrEqual(2);
      else expect(r.n).toBeGreaterThanOrEqual(2);
      if (r.kind === 'clear') expect(r.n).toBeLessThanOrEqual(4);
      else expect(r.n).toBeLessThanOrEqual(3);
      // A weather is always followed by Clear.
      const next = runs[i + 2];
      if (next && r.kind !== 'clear') expect(next.kind).toBe('clear');
    }
    expect(new Set(days)).toEqual(new Set(['clear', 'rain', 'storm', 'snow', 'heatwave']));
  });

  it('changes at the start of a day, says how long, and loads back the same', () => {
    let s = fixtureGame({ weather: true });
    s.weather.ahead = ['rain', 'rain', 'clear'];
    s = run(toNight(s), END);
    expect(s.weather.today).toBe('rain');
    expect(s.weather.since).toBe(2);
    expect(weatherDaysLeft(s.weather)).toBe(2);
    expect(s.log.find((e) => e.kind === 'weatherChanged')).toMatchObject({
      from: 'clear',
      to: 'rain',
      days: 2,
    });
    expect(deserialize(serialize(s))).toEqual({ ok: true, state: s });
  });

  it('hiker effects wait out the first full day; node effects don’t', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    changeWeather(s, 'snow');
    expect(hikerEffectActive(s)).toBe(false);
    const afternoon = run(s, END);
    expect(conditionsOf(afternoon, 'ash')).toEqual([]);
    const tomorrow = run(toNight(s), END);
    expect(hikerEffectActive(tomorrow)).toBe(true);
    expect(stacks(tomorrow, 'ash', 'shivering')).toBeGreaterThan(0);
  });

  it('when the weather ends, nodes go back and Shivering and Burning end', () => {
    const s = weathered('rain', (g) => nodes(g, 'mountain', 'river', 'forest'));
    setNodeState(s.section.tiles.L!.nodes[0]!, 'flooded');
    setNodeState(s.section.tiles.M!.nodes[0]!, 'frozen');
    addStacks(s, ash(s), 'shivering', 2, 'test');
    addStacks(s, hiker(s, 'birch'), 'burning', 2, 'test');
    expect(s.section.tiles.L!.nodes[0]).toMatchObject({ type: 'river' });
    changeWeather(s, 'clear');
    expect(s.section.tiles.L!.nodes[0]).toEqual({ type: 'mountain', revealed: true });
    expect(s.section.tiles.M!.nodes[0]).toEqual({ type: 'river', revealed: true });
    expect(ash(s).conditions).toEqual([]);
    expect(hiker(s, 'birch').conditions).toEqual([]);
  });
});

describe('hiker effects (after the grace day)', () => {
  it('Drizzle: no clothes and no shelter makes a hiker Wet, then Soaked', () => {
    const s = weathered('rain', (g) => {
      place(g, 'ash', 'L');
      place(g, 'birch', 'R'); // the campsite is a shelter
    });
    const one = run(s, END);
    expect(conditionsOf(one, 'ash')).toEqual(['wet']);
    expect(conditionsOf(one, 'birch')).toEqual([]);
    const two = run(one, END);
    expect(conditionsOf(two, 'ash')).toContain('soaked');
  });

  it('Drizzle: clothes keep a hiker dry, and wear them', () => {
    let worn = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = weathered(
        'rain',
        (g) => {
          place(g, 'ash', 'L');
          ash(g).inventory.equipped.body = { uid: 'coat', itemId: 'tier3Clothes' };
        },
        seed,
      );
      const after = run(s, END);
      expect(conditionsOf(after, 'ash')).toEqual([]);
      // Tier III stand-in clothes: 10 days of durability at Quality 3.
      worn += 10 - (ash(after).inventory.equipped.body?.durability ?? 10);
    }
    expect(Math.abs(worn / 40 - BALANCE.weather.drizzleWear)).toBeLessThan(0.2);
  });

  it('Static Air: lightning strikes a hiker at full Energy: an injury, and Energy to half', () => {
    const s = weathered('storm', (g) => {
      place(g, 'ash', 'L', { energy: 10 });
      place(g, 'birch', 'L', { energy: 9 });
    });
    const after = run(s, END);
    expect(ash(after).injuries).toBe(1);
    expect(ash(after).stats.energy).toBe(5);
    expect(hiker(after, 'birch').injuries).toBe(0);
  });

  it('Sheer Cold: 3 Shivering, less clothes, company and shelter; below 0 warms up', () => {
    const s = weathered('snow', (g) => {
      place(g, 'ash', 'L');
      place(g, 'birch', 'M');
      place(g, 'cedar', 'M');
      place(g, 'dot', 'R'); // the campsite, with nobody else: 3 − 2 = 1
      hiker(g, 'birch').inventory.equipped.body = { uid: 'coat', itemId: 'tier3Clothes' };
      addStacks(g, hiker(g, 'cedar'), 'shivering', 2, 'earlier');
    });
    const after = run(s, END);
    expect(stacks(after, 'ash', 'shivering')).toBe(3); // alone, no clothes
    expect(stacks(after, 'birch', 'shivering')).toBe(1); // 3 − 1 coat − 1 hiker
    expect(stacks(after, 'cedar', 'shivering')).toBe(4); // 2 + (3 − 1 hiker)
    expect(stacks(after, 'dot', 'shivering')).toBe(1);
    // Ash is Frozen at 3.
    expect(validateAction(after, { type: 'move', hikerId: 'ash', toTileId: 'T' })).toMatch(
      /Frozen/,
    );

    // Bundled up with everyone in the shelter: 3 − 1 − 3 − 2 = −3, so it goes down.
    const warm = weathered('snow', (g) => {
      for (const id of ['ash', 'birch', 'cedar', 'dot']) place(g, id, 'R');
      ash(g).inventory.equipped.body = { uid: 'coat', itemId: 'tier3Clothes' };
      addStacks(g, ash(g), 'shivering', 2, 'earlier');
    });
    expect(stacks(run(warm, END), 'ash', 'shivering')).toBe(0);
  });

  it('Blistering Heat: 1 Burning for each clothing item and each hiker with them', () => {
    const s = weathered('heatwave', (g) => {
      place(g, 'ash', 'L');
      place(g, 'birch', 'M');
      place(g, 'cedar', 'M');
      hiker(g, 'birch').inventory.equipped.body = { uid: 'coat', itemId: 'tier3Clothes' };
    });
    const after = run(s, END);
    expect(stacks(after, 'ash', 'burning')).toBe(0);
    expect(stacks(after, 'birch', 'burning')).toBe(2);
    expect(stacks(after, 'cedar', 'burning')).toBe(1);
  });
});

describe('node effects (from the start)', () => {
  /** How often a node changed over many seeds, in one phase. */
  function rate(today: WeatherId, type: NodeType, state: string): number {
    let changed = 0;
    const tries = 300;
    for (let seed = 1; seed <= tries; seed++) {
      const s = fixtureGame({ seed });
      s.rng = seedRng(seed);
      nodes(s, type, 'wildlife', 'wildlife');
      changeWeather(s, today);
      const after = run(s, END);
      if (after.section.tiles.L!.nodes[0]!.weather?.state === state) changed += 1;
    }
    return changed / tries;
  }

  it('Floods, Freezing and Forest Fires each catch about 15% of their nodes a phase', () => {
    const want = BALANCE.weather.nodeChance;
    expect(Math.abs(rate('rain', 'mountain', 'flooded') - want)).toBeLessThan(0.06);
    expect(Math.abs(rate('snow', 'river', 'frozen') - want)).toBeLessThan(0.06);
    expect(Math.abs(rate('heatwave', 'forest', 'fire') - want)).toBeLessThan(0.06);
  });

  it('a Flooded node counts as River; Frozen and Fire nodes give nothing', () => {
    const s = fixtureGame();
    nodes(s, 'mountain', 'river', 'forest');
    place(s, 'ash', 'L');
    setNodeState(s.section.tiles.L!.nodes[0]!, 'flooded');
    expect(scavengeSetup(s, ash(s)).nodes.map((n) => n.type)).toEqual(['river']);
    setNodeState(s.section.tiles.M!.nodes[0]!, 'frozen');
    place(s, 'ash', 'M');
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toMatch(/frozen or burned/);
  });

  it('a Fire node isn’t Forest for challenges, and gives the other nodes +1 Luck', () => {
    const s = fixtureGame();
    s.section.tiles.L!.nodes = [
      { type: 'forest', revealed: true },
      { type: 'river', revealed: true },
    ];
    place(s, 'ash', 'L');
    const before = scavengeSetup(s, ash(s)).luck;
    setNodeState(s.section.tiles.L!.nodes[0]!, 'fire');
    const after = scavengeSetup(s, ash(s));
    expect(after.luck).toBe(before + BALANCE.weather.fireLuck);
    expect(after.nodes.map((n) => n.type)).toEqual(['river']);
    // A Forest-only challenge no longer fits this tile.
    const forestOnly = Object.values(CARDS).find(
      (c) =>
        c.kind === 'challenge' &&
        !c.gates?.length &&
        c.nodes !== 'any' &&
        c.nodes.length === 1 &&
        c.nodes[0] === 'forest',
    );
    expect(forestOnly).toBeDefined();
    s.section.tiles.L!.nodes = [{ type: 'forest', revealed: true }];
    expect(cardFits(forestOnly!, s, s.section.tiles.L!, [ash(s)], forestOnly!.tier)).toBe(true);
    setNodeState(s.section.tiles.L!.nodes[0]!, 'fire');
    expect(cardFits(forestOnly!, s, s.section.tiles.L!, [ash(s)], forestOnly!.tier)).toBe(false);
  });

  it('fire spreads to connected Forest tiles, and burns whoever ends a phase on it', () => {
    let spread = 0;
    const tries = 200;
    for (let seed = 1; seed <= tries; seed++) {
      const s = weathered('clear', (g) => nodes(g, 'forest', 'forest', 'wildlife'), seed);
      // Fire on L only; M (Forest) is connected to it. Heatwave rolls new fires too.
      changeWeather(s, 'heatwave');
      setNodeState(s.section.tiles.L!.nodes[0]!, 'fire');
      place(s, 'ash', 'L');
      const after = run(s, END);
      if (after.section.tiles.M!.nodes[0]!.weather?.state === 'fire') spread += 1;
      if (seed === 1) expect(stacks(after, 'ash', 'burning')).toBeGreaterThanOrEqual(1);
    }
    // 15% to catch on its own, then 35% to spread: about 45% in all.
    const p = 1 - (1 - BALANCE.weather.nodeChance) * (1 - BALANCE.weather.fireSpread);
    expect(Math.abs(spread / tries - p)).toBeLessThan(0.08);
  });

  it('Thunder makes Wildlife cards much rarer while it storms', () => {
    const s = weathered('storm');
    place(s, 'ash', 'L');
    expect(scavengeSetup(s, ash(s)).nodeWeight?.wildlife).toBe(
      BALANCE.weather.thunderWildlifeWeight,
    );
    expect(scavengeSetup(s, ash(s)).bonuses.map((b) => b.source)).toContain('Thunder');
  });
});
