/**
 * Weather (Phase 10.6): Clear, Rain, Snow, Wind and Heatwave, each tied to a
 * node. The only effect is on scavenging.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { WEATHERS, WEATHER_IDS } from '../content/weather';
import { RESOURCES } from '../content/resources';
import { seedRng } from './rng';
import { dealCards, weatherSwap, type DealInput } from './scavenge/deal';
import { scavengeSetup } from './scavenge/setup';
import { deserialize, serialize } from './save';
import { END, fixtureGame, hiker, run, toNight } from './test/fixtures';
import type { GameState, NodeType, ScavengeCard, WeatherId } from './types';
import { changeWeather, fillForecast, freshWeather, weatherDaysLeft } from './weather';

const NODE_OF: Record<Exclude<WeatherId, 'clear'>, NodeType> = {
  rain: 'river',
  snow: 'mountain',
  wind: 'forest',
  heatwave: 'wildlife',
};

function weathered(today: WeatherId, seed = 1): GameState {
  const s = fixtureGame({ seed });
  changeWeather(s, today);
  s.weather.hold = true;
  return s;
}

const nodeOf = (r: string) => RESOURCES.find((x) => x.id === r)?.node;

describe('the kinds', () => {
  it('are Clear, Rain, Snow, Wind and Heatwave: no Storm or Fog anywhere', () => {
    expect([...WEATHER_IDS].sort()).toEqual(['clear', 'heatwave', 'rain', 'snow', 'wind']);
    expect(BALANCE.weather.schedule.odds).not.toHaveProperty('storm');
    expect(BALANCE.weather.schedule.odds).not.toHaveProperty('fog');
  });

  it('each is tied to its node, and says so in one line', () => {
    for (const [id, node] of Object.entries(NODE_OF)) {
      expect(WEATHERS[id as WeatherId].node).toBe(node);
    }
    expect(WEATHERS.rain.line).toBe('Rain: more River resources.');
    expect(WEATHERS.clear.node).toBeUndefined();
  });
});

describe('the schedule and forecast', () => {
  it('is the same for the same seed, starts Clear, and always shows 3 days ahead', () => {
    const a = freshWeather(7);
    expect(a).toEqual(freshWeather(7));
    expect(a.today).toBe('clear');
    expect(a.ahead.length).toBeGreaterThanOrEqual(BALANCE.weather.forecastDays);
  });

  it('each weather lasts 1–3 days, drawn from the Meadow odds (never Snow yet)', () => {
    const w = freshWeather(3);
    w.ahead = [];
    const days: WeatherId[] = [];
    while (days.length < 3000) {
      fillForecast(w);
      days.push(...w.ahead.splice(0));
    }
    const share = (k: WeatherId) => days.filter((d) => d === k).length / days.length;
    expect(share('snow')).toBe(0);
    expect(share('clear')).toBeGreaterThan(0.3);
    expect(share('rain')).toBeGreaterThan(0.17);
    expect(share('wind')).toBeGreaterThan(0.12);
    expect(share('heatwave')).toBeGreaterThan(0.08);
  });

  it('changes at the start of a day, says how long, and loads back the same', () => {
    let s = fixtureGame({ weather: true });
    s.weather.ahead = ['rain', 'rain', 'clear'];
    s = run(toNight(s), END);
    expect(s.weather.today).toBe('rain');
    expect(weatherDaysLeft(s.weather)).toBe(2);
    expect(s.log.find((e) => e.kind === 'weatherChanged')).toMatchObject({
      from: 'clear',
      to: 'rain',
      days: 2,
    });
    expect(deserialize(serialize(s))).toEqual({ ok: true, state: s });
  });
});

describe('scavenging, the only effect', () => {
  it('on a tile with the weather’s node, its resources are likelier', () => {
    for (const [id, node] of Object.entries(NODE_OF)) {
      const s = weathered(id as WeatherId);
      s.section.tiles.L!.nodes = [
        { type: node, revealed: true },
        { type: node === 'river' ? 'forest' : 'river', revealed: true },
      ];
      s.hikers[0]!.tileId = 'L';
      const setup = scavengeSetup(s, s.hikers[0]!);
      expect(setup.nodeWeight?.[node]).toBe(BALANCE.weather.boost);
      expect(setup.bonuses.some((b) => b.source === WEATHERS[id as WeatherId].name)).toBe(true);
    }
    const clear = weathered('clear');
    expect(scavengeSetup(clear, clear.hikers[0]!).weatherSwap).toBeUndefined();
  });

  it('on any tile, some resource cards become the weather’s node’s, with the weather’s mark', () => {
    const input: DealInput = {
      nodes: [{ type: 'mountain', revealed: true }],
      abundance: 100,
      luck: 0,
      count: 4000,
      weatherSwap: { weather: 'rain', node: 'river', chance: BALANCE.weather.swapChance },
    };
    const cards = dealCards(seedRng(9), input);
    const swapped = cards.filter((c) => c.weather === 'rain');
    const share = swapped.length / cards.length;
    expect(share).toBeGreaterThan(BALANCE.weather.swapChance * 0.6);
    expect(share).toBeLessThan(BALANCE.weather.swapChance * 1.4);
    for (const c of swapped) {
      expect(c.node).toBe('river');
      for (const r of c.resources ?? []) expect(nodeOf(r)).toBe('river');
    }
  });

  it('never swaps caps or item cards', () => {
    const caps: ScavengeCard = {
      type: 'caps',
      rarity: 'common',
      node: null,
      caps: 2,
      flipped: false,
    };
    const swap = { weather: 'wind' as const, node: 'forest' as const, chance: 1 };
    expect(weatherSwap(seedRng(1), caps, swap)).toBe(caps);
  });
});

describe('no other effects', () => {
  it('a whole stormy-looking week gives nobody a condition and changes no node', () => {
    for (const id of WEATHER_IDS) {
      let s = weathered(id);
      const nodesBefore = JSON.stringify(Object.values(s.section.tiles).map((t) => t.nodes));
      for (let i = 0; i < 12; i++) s = run(s, END);
      expect(s.hikers.every((h) => h.conditions.length === 0)).toBe(true);
      expect(JSON.stringify(Object.values(s.section.tiles).map((t) => t.nodes))).toBe(nodesBefore);
      expect(hiker(s, 'ash').stats).toBeDefined();
    }
  });

  it('an old save’s Storm loads as Rain, and its changed nodes go back', () => {
    const s = fixtureGame();
    const old = JSON.parse(serialize(s)) as Record<string, unknown> & {
      weather: { today: string; ahead: string[] };
      section: { tiles: Record<string, { nodes: Record<string, unknown>[] }> };
    };
    old.saveVersion = 19;
    old.weather.today = 'storm';
    old.weather.ahead = ['storm', 'clear', 'rain'];
    old.section.tiles.L!.nodes = [
      { type: 'river', revealed: true, weather: { state: 'flooded', was: 'mountain' } },
    ];
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.weather.today).toBe('rain');
    expect(loaded.state.weather.ahead).toEqual(['rain', 'clear', 'rain']);
    expect(loaded.state.section.tiles.L!.nodes).toEqual([{ type: 'mountain', revealed: true }]);
  });
});
