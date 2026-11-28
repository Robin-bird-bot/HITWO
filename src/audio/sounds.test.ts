import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { LINE_KINDS, RARITIES, type GameEvent, type GameEventBody } from '../engine';
import { fixtureGame, hiker } from '../engine/test/fixtures';
import { MINIGAME_SOUNDS, hookSound, muteSounds, onSound, playSound } from '../ui/minigames/sound';
import { bedFor, layersFor, oneShotsFor, type AmbienceScene } from './ambience';
import { footstepFor, panAt, stepMs } from './footsteps';
import { NIGHT_GROUP, NIGHT_SOUND, cuesFor } from './gameSounds';
import { revealCues } from './reveal';
import { known } from './testManifest';

let nextId = 1;
const ev = (body: GameEventBody): GameEvent =>
  ({ ...body, id: nextId++, day: 1, phase: 'morning' }) as GameEvent;
const ids = (cues: { id: string }[]) => cues.map((c) => c.id);

describe('the game’s sounds from its log (32-audio-system.md, section 6)', () => {
  const game = fixtureGame();

  it('plays a stat change once per action, not per point', () => {
    const cues = cuesFor(
      [
        ev({ kind: 'stat', hikerId: 'ash', stat: 'energy', from: 8, to: 7, cause: 'x' }),
        ev({ kind: 'stat', hikerId: 'birch', stat: 'energy', from: 8, to: 7, cause: 'x' }),
        ev({ kind: 'stat', hikerId: 'ash', stat: 'morale', from: 5, to: 6, cause: 'x' }),
      ],
      game,
      game,
    );
    expect(ids(cues)).toEqual(['stat.down', 'stat.moraleUp']);
  });

  it('plays a few resources at most, a moment apart', () => {
    const cues = cuesFor(
      [
        ev({
          kind: 'gained',
          resources: ['wood', 'stone', 'grass', 'clay', 'fur'],
          items: [],
          cause: 'x',
        }),
      ],
      game,
      game,
    );
    const res = cues.filter((c) => c.id.startsWith('res.'));
    expect(res).toHaveLength(BALANCE.audio.resources.max);
    expect(res.map((c) => c.delay ?? 0)).toEqual(
      res.map((_, i) => (i * BALANCE.audio.resources.gapMs) / 1000),
    );
    for (const c of res) expect(known(c.id), c.id).toBe(true);
  });

  it('plays stat.low only when a hiker drops into a low state', () => {
    const before = fixtureGame();
    const after = structuredClone(before);
    hiker(after, 'ash').stats.energy = BALANCE.thresholds.fatigued;
    expect(ids(cuesFor([], before, after))).toContain('stat.low');
    // Already Fatigued: not every time after.
    const lower = structuredClone(after);
    hiker(lower, 'ash').stats.energy = BALANCE.thresholds.fatigued - 1;
    expect(ids(cuesFor([], after, lower))).not.toContain('stat.low');
  });

  it('opens a night event with its group’s sting, then the creature', () => {
    for (const creature of Object.keys(NIGHT_GROUP)) {
      const cues = cuesFor(
        [ev({ kind: 'nightEvent', tier: 1, creatureId: creature, hits: [], safe: [], from: 0 })],
        game,
        game,
      );
      expect(cues[0]?.id).toBe(`night.${NIGHT_GROUP[creature]}`);
      expect(cues[1]).toEqual({
        id: NIGHT_SOUND[creature],
        delay: BALANCE.audio.night.creatureDelaySec,
      });
      for (const c of cues) expect(known(c.id), c.id).toBe(true);
    }
  });

  it('only names sounds that are in the manifest', () => {
    const bodies: GameEventBody[] = [
      { kind: 'phase', day: 2, phase: 'morning' },
      { kind: 'phase', day: 2, phase: 'afternoon' },
      { kind: 'phase', day: 2, phase: 'night' },
      ...(['rain', 'snow', 'wind', 'heatwave', 'clear'] as const).map((to): GameEventBody => ({
        kind: 'weatherChanged',
        from: 'clear',
        to,
        days: 1,
      })),
      { kind: 'injury', hikerId: 'ash', injuries: 1, cause: 'x' },
      { kind: 'learned', hikerId: 'ash', stepId: 'x', cost: 1, level: 4 },
      { kind: 'checkedIn', hikerIds: ['ash'], xp: 1 },
      { kind: 'summit' },
      { kind: 'hikeOver', day: 3 },
      { kind: 'sleep', hikerId: 'ash' },
      { kind: 'watch', hikerId: 'ash' },
      { kind: 'tend', hikerId: 'ash', from: 1, to: 2 },
      { kind: 'bought', price: 2 },
      { kind: 'sold', hikerId: 'ash', caps: 2 },
      { kind: 'infoboardPin', cardId: 'x', caps: 1 },
      { kind: 'challengeOpened', cardId: 'x', tileId: 't' },
    ];
    const cues = cuesFor(bodies.map(ev), game, game, 1);
    expect(cues.length).toBeGreaterThan(15);
    for (const c of cues) expect(known(c.id), c.id).toBe(true);
    expect(cues.some((c) => c.id.startsWith('motif.'))).toBe(false);
  });

  it('lets a moving token arrive before the tile’s sounds', () => {
    const cues = cuesFor(
      [ev({ kind: 'challengeOpened', cardId: 'x', tileId: 't' })],
      game,
      game,
      1,
    );
    expect(cues[0]).toEqual({ id: 'map.challengeLand', delay: 1 });
    expect(cues[1]?.delay).toBeCloseTo(1 + BALANCE.audio.challengeCardDelaySec);
  });
});

describe('footsteps', () => {
  it('follows the line for people, and snow while it snows', () => {
    const surface = Object.fromEntries(
      LINE_KINDS.map((k) => [k, footstepFor(k, 'human', false).id]),
    );
    expect(surface).toEqual({
      normal: 'foot.dirt',
      paved: 'foot.paved',
      steep: 'foot.steep',
      muddy: 'foot.mud',
      rough: 'foot.gravel',
    });
    for (const k of LINE_KINDS) expect(footstepFor(k, 'human', true).id).toBe('foot.snow');
  });

  it('pads for dogs (claws on paved and rough), softer for cats, fwumps for plush', () => {
    expect(footstepFor('normal', 'dog', false).id).toBe('foot.paw');
    expect(footstepFor('paved', 'dog', false).id).toBe('foot.pawHard');
    expect(footstepFor('rough', 'dog', true).id).toBe('foot.pawHard');
    expect(footstepFor('paved', 'cat', false)).toEqual({
      id: 'foot.paw',
      volume: BALANCE.audio.footsteps.catVolume,
    });
    for (const k of LINE_KINDS) expect(footstepFor(k, 'plush', true).id).toBe('foot.plush');
    for (const k of LINE_KINDS) {
      for (const f of ['human', 'dog', 'cat', 'plush'] as const) {
        expect(known(footstepFor(k, f, false).id)).toBe(true);
      }
    }
  });

  it('steps at each family’s pace, panned across the screen', () => {
    const F = BALANCE.audio.footsteps;
    expect(stepMs('human')).toBe(F.stepMs.people);
    expect(stepMs('dog')).toBe(F.stepMs.paws);
    expect(stepMs('cat')).toBe(F.stepMs.paws);
    expect(stepMs('plush')).toBe(F.stepMs.plush);
    expect(panAt(0)).toBeCloseTo(-F.pan);
    expect(panAt(0.5)).toBeCloseTo(0);
    expect(panAt(1)).toBeCloseTo(F.pan);
  });
});

describe('reveal chimes', () => {
  it('stacks a chime per rarity step after the flip', () => {
    expect(ids(revealCues('common'))).toEqual(['card.flip']);
    expect(ids(revealCues('rare'))).toEqual([
      'card.flip',
      'card.reveal.uncommon',
      'card.reveal.rare',
    ]);
    const mythic = revealCues('mythic');
    expect(ids(mythic)).toEqual([
      'card.flip',
      'card.reveal.uncommon',
      'card.reveal.rare',
      'card.reveal.veryRare',
      'card.reveal.legendary',
      'card.reveal.mythic',
    ]);
    const gap = BALANCE.audio.revealGapMs / 1000;
    expect(mythic.map((c) => c.delay ?? 0)).toEqual([0, gap, 2 * gap, 3 * gap, 4 * gap, 5 * gap]);
    for (const r of RARITIES) for (const c of revealCues(r)) expect(known(c.id)).toBe(true);
  });
});

describe('ambience (32-audio-system.md, section 4)', () => {
  const trail = (s: Partial<AmbienceScene>): AmbienceScene => ({
    place: 'trail',
    biome: 'meadow',
    ...s,
  });

  it('beds each biome by day and night, and the title and station', () => {
    expect(bedFor(trail({}))).toBe('amb.meadow.day');
    expect(bedFor(trail({ night: true }))).toBe('amb.meadow.night');
    expect(bedFor(trail({ biome: 'temperateRainforest' }))).toBe('amb.rainforest.day');
    expect(bedFor(trail({ biome: 'alpine', night: true }))).toBe('amb.alpine.night');
    expect(bedFor({ place: 'title' })).toBe('amb.title');
    expect(bedFor({ place: 'station', biome: 'meadow' })).toBe('amb.station');
    expect(bedFor({ place: 'none' })).toBeNull();
  });

  it('layers the weather (heat by day only), the river and the fire', () => {
    expect(layersFor(trail({ weather: 'rain' }))).toEqual(['amb.rain']);
    expect(layersFor(trail({ weather: 'heatwave' }))).toEqual(['amb.heat']);
    expect(layersFor(trail({ weather: 'heatwave', night: true }))).toEqual([]);
    expect(layersFor(trail({ river: true }))).toEqual(['amb.river']);
    expect(layersFor(trail({ river: false }))).toEqual([]);
    expect(layersFor(trail({ fire: true }))).toEqual([]);
    expect(layersFor(trail({ fire: true, night: true, weather: 'snow' }))).toEqual([
      'amb.snow',
      'amb.fire',
    ]);
    expect(layersFor({ place: 'station', weather: 'rain' })).toEqual([]);
  });

  it('scatters the right one-shots', () => {
    const keys = (s: AmbienceScene) => oneShotsFor(s).flatMap((r) => r.ids);
    expect(keys(trail({}))).toEqual(['amb.bird', 'amb.twig']);
    expect(keys(trail({ biome: 'temperateRainforest' }))).toContain('amb.woodpecker');
    expect(keys(trail({ night: true }))).toEqual(['amb.owl', 'amb.twig']);
    expect(keys(trail({ biome: 'alpine', night: true }))).toContain('amb.wolfFar');
    expect(keys(trail({ weather: 'rain' }))).toContain('weather.thunder');
    for (const s of [
      trail({ biome: 'temperateRainforest', night: true, weather: 'rain' }),
      trail({ biome: 'alpine', night: true, river: true, fire: true, weather: 'wind' }),
    ]) {
      for (const id of [bedFor(s)!, ...layersFor(s), ...keys(s)]) expect(known(id), id).toBe(true);
    }
  });
});

describe('minigame hooks', () => {
  it('maps every hook to a sound', () => {
    for (const s of MINIGAME_SOUNDS) expect(known(hookSound(s, 3).id), s).toBe(true);
    expect(hookSound('tick', 5)).toEqual({ id: 'mg.tick', version: 0 });
    expect(hookSound('tick', 1)).toEqual({ id: 'mg.tick', version: 4 });
    expect(hookSound('note', 6)).toEqual({ id: 'mg.note6' });
  });

  it('stays silent while the demo plays', () => {
    const heard: string[] = [];
    const stop = onSound((s) => heard.push(s));
    const unmute = muteSounds();
    playSound('pop');
    unmute();
    playSound('hit');
    stop();
    expect(heard).toEqual(['hit']);
  });
});
