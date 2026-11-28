import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { MINIGAMES } from '../minigames/catalog';
import {
  barSeconds,
  chooseMusic,
  dbToGain,
  hurryRate,
  loopSeconds,
  minigamePieces,
  nextBarLine,
  parseMusicManifest,
  planMusic,
  weatherEffects,
  type MusicManifest,
} from './music';
import { topClaim } from './useMusic';

const M = BALANCE.audio.music;

/** A fake piece: 120 bpm in 4, 8 bars (2 s a bar, a 16 s loop). */
const FAKE: MusicManifest = parseMusicManifest({
  pieces: {
    meadow: {
      bpm: 120,
      beatsPerBar: 4,
      bars: 8,
      versions: { day: 'meadow-day', night: 'meadow-night', rain: 'meadow-rain' },
    },
    station: { bpm: 90, beatsPerBar: 3, bars: 16, versions: { main: 'station' } },
    quickDraw: { bpm: 140, beatsPerBar: 4, bars: 16, versions: { main: 'quick-draw' } },
    runForIt: { bpm: 160, beatsPerBar: 4, bars: 16, versions: { main: 'run-for-it' } },
    packing: {
      bpm: 100,
      beatsPerBar: 4,
      bars: 8,
      versions: { trailmate: 'rag-trailmate', cabinet: 'rag-cabinet' },
    },
    broken: { bpm: 0, beatsPerBar: 4, bars: 8, versions: { day: 'x' } },
    empty: { bpm: 100, beatsPerBar: 4, bars: 8, versions: {} },
  },
});

describe('the music player (32-audio-system.md, section 5)', () => {
  it('reads the manifest, leaving out incomplete pieces; the game’s is empty for now', () => {
    expect(Object.keys(FAKE.pieces).sort()).toEqual([
      'meadow',
      'packing',
      'quickDraw',
      'runForIt',
      'station',
    ]);
    const real = Object.values(
      import.meta.glob('../../public/assets/audio/music/manifest.json', {
        eager: true,
        import: 'default',
      }),
    )[0];
    expect(parseMusicManifest(real)).toEqual({ pieces: {} });
    expect(chooseMusic({ place: 'title' }, parseMusicManifest(real))).toBeNull();
  });

  it('starts every version of a piece together, the wanted one up and the rest silent', () => {
    const meadow = FAKE.pieces.meadow!;
    expect(barSeconds(meadow)).toBe(2);
    expect(loopSeconds(meadow)).toBe(16);
    const want = chooseMusic({ place: 'trail', biome: 'meadow' }, FAKE);
    expect(want).toEqual({ piece: 'meadow', version: 'day' });
    const plan = planMusic(null, want, FAKE, 5);
    expect(plan).toEqual({
      kind: 'start',
      piece: 'meadow',
      version: 'day',
      at: 5,
      volumes: { day: 1, night: 0, rain: 0 },
      fade: 0,
    });
  });

  it('changes version by volumes only: 8 s at dusk and dawn, 4 s for weather', () => {
    const playing = { piece: 'meadow', version: 'day', startedAt: 5 };
    const night = chooseMusic({ place: 'trail', biome: 'meadow', night: true }, FAKE);
    expect(planMusic(playing, night, FAKE, 31)).toEqual({
      kind: 'versions',
      volumes: { day: 0, night: 1, rain: 0 },
      fade: M.fade.dayNight,
    });
    const rain = chooseMusic(
      { place: 'trail', biome: 'meadow', night: true, weather: 'rain' },
      FAKE,
    );
    expect(rain?.version).toBe('rain');
    expect(planMusic({ ...playing, version: 'night' }, rain, FAKE, 31)).toMatchObject({
      kind: 'versions',
      fade: M.fade.weather,
    });
    // The same version: nothing to do.
    expect(planMusic(playing, { piece: 'meadow', version: 'day' }, FAKE, 31)).toEqual({
      kind: 'keep',
    });
  });

  it('starts a new piece on the next bar line, crossfading over 2 s', () => {
    const meadow = FAKE.pieces.meadow!;
    expect(nextBarLine(meadow, 5, 8.3)).toBe(9);
    expect(nextBarLine(meadow, 5, 9)).toBe(9);
    expect(nextBarLine(meadow, 5, 3)).toBe(5);
    const playing = { piece: 'meadow', version: 'day', startedAt: 5 };
    const station = chooseMusic({ place: 'station' }, FAKE);
    expect(planMusic(playing, station, FAKE, 8.3)).toMatchObject({
      kind: 'start',
      piece: 'station',
      at: 9,
      fade: M.fade.piece,
    });
    // Nothing for this place: it stops on the bar line too.
    expect(planMusic(playing, chooseMusic({ place: 'title' }, FAKE), FAKE, 8.3)).toEqual({
      kind: 'stop',
      at: 9,
      fade: M.fade.piece,
    });
  });

  it('picks versions and pieces with their fallbacks', () => {
    // No snow version: the time of day.
    expect(
      chooseMusic({ place: 'trail', biome: 'meadow', night: true, weather: 'snow' }, FAKE)?.version,
    ).toBe('night');
    expect(chooseMusic({ place: 'packing', look: 'cabinet' }, FAKE)?.version).toBe('cabinet');
    // Shell Game isn't made yet: Raccoon Shuffle plays its group's Quick Draw.
    expect(minigamePieces('raccoonShuffle')).toEqual(['shellGame', 'quickDraw']);
    expect(chooseMusic({ place: 'minigame', game: 'raccoonShuffle' }, FAKE)?.piece).toBe(
      'quickDraw',
    );
    expect(minigamePieces('dodge', true)).toEqual(['bigTrouble', 'runForIt']);
    expect(chooseMusic({ place: 'minigame', game: 'dodge', boss: true }, FAKE)?.piece).toBe(
      'runForIt',
    );
    expect(minigamePieces('traildle')).toEqual(['thinkingCap']);
    // Birdsong is listening: no music.
    expect(chooseMusic({ place: 'minigame', game: 'birdsong' }, FAKE)).toBeNull();
    // A biome with no piece yet is quiet.
    expect(chooseMusic({ place: 'trail', biome: 'alpine' }, FAKE)).toBeNull();
  });

  it('gives every minigame but Birdsong a piece', () => {
    const quiet = MINIGAMES.filter((m) => !minigamePieces(m.id).length).map((m) => m.id);
    expect(quiet).toEqual(['birdsong']);
  });

  it('sweeps in wind, wobbles in heat, and hurries in a clock’s last 10 s', () => {
    expect(weatherEffects('wind')).toEqual({ sweep: true, wobble: false });
    expect(weatherEffects('heatwave')).toEqual({ sweep: false, wobble: true });
    expect(weatherEffects('rain')).toEqual({ sweep: false, wobble: false });
    expect(hurryRate(12)).toBe(1);
    expect(hurryRate(M.hurry.lastSec)).toBe(M.hurry.rate);
    expect(hurryRate(3)).toBe(M.hurry.rate);
    expect(hurryRate(0)).toBe(1);
    expect(hurryRate(null)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
  });

  it('a window’s claim wins over the hike’s, and the newest within a layer', () => {
    expect(topClaim([])).toEqual({ place: 'none' });
    expect(
      topClaim([
        { layer: 1, scene: { place: 'trail', biome: 'meadow' }, at: 1 },
        { layer: 2, scene: { place: 'wonder' }, at: 0 },
        { layer: 0, scene: { place: 'title' }, at: 5 },
      ]),
    ).toEqual({ place: 'wonder' });
    expect(
      topClaim([
        { layer: 2, scene: { place: 'briefing' }, at: 1 },
        { layer: 2, scene: { place: 'minigame', game: 'dodge' }, at: 2 },
      ]),
    ).toEqual({ place: 'minigame', game: 'dodge' });
  });
});
