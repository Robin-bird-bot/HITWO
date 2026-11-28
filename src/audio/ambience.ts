/**
 * Ambience (32-audio-system.md, section 4):
 *
 * - **The bed:** `amb.<biome>.<day|night>` loops all the time on the map,
 *   crossfading slowly when night falls and when morning comes. The title
 *   has its own (`amb.title`), and the Ranger Station replaces the bed with
 *   `amb.station`.
 * - **Layers**, each fading in and out: the weather (rain, wind, snow, or
 *   heat by day only), the river (the selected hiker's tile has a River
 *   node), and the fire (at night on a campsite, and under the camp recap).
 * - **One-shots** now and then at random, panned and at random levels:
 *   birds and twigs by day, owls at night, a far wolf on Alpine nights,
 *   thunder in the rain.
 *
 * Minigames duck it; windows over the map leave it alone.
 */
import { BALANCE } from '../config/balance';
import type { BiomeId, WeatherId } from '../engine';
import { audio, loop, sfx, type LoopHandle } from './engine';

const AMB = BALANCE.audio.ambience;

export type AmbiencePlace = 'none' | 'title' | 'trail' | 'station';

export interface AmbienceScene {
  place: AmbiencePlace;
  biome?: BiomeId;
  night?: boolean;
  weather?: WeatherId;
  /** The selected hiker stands on a tile with a River node. */
  river?: boolean;
  /** A fire is going: night on a campsite, or the camp recap. */
  fire?: boolean;
}

const BIOME_KEY: Record<BiomeId, 'meadow' | 'rainforest' | 'alpine'> = {
  meadow: 'meadow',
  temperateRainforest: 'rainforest',
  alpine: 'alpine',
};

/** The loop under everything, or none. */
export function bedFor(scene: AmbienceScene): string | null {
  if (scene.place === 'title') return 'amb.title';
  if (scene.place === 'station') return 'amb.station';
  if (scene.place !== 'trail' || !scene.biome) return null;
  return `amb.${BIOME_KEY[scene.biome]}.${scene.night ? 'night' : 'day'}`;
}

/** The loops on top of the bed. */
export function layersFor(scene: AmbienceScene): string[] {
  if (scene.place !== 'trail') return [];
  const out: string[] = [];
  const w = scene.weather;
  if (w === 'rain') out.push('amb.rain');
  if (w === 'wind') out.push('amb.wind');
  if (w === 'snow') out.push('amb.snow');
  if (w === 'heatwave' && !scene.night) out.push('amb.heat');
  if (scene.river) out.push('amb.river');
  if (scene.fire && scene.night) out.push('amb.fire');
  return out;
}

/** A one-shot that comes now and then: every `min` to `max` seconds, one of `ids`. */
export interface OneShotRule {
  key: string;
  min: number;
  max: number;
  ids: readonly string[];
}

/** The one-shots for this scene (the table in section 4). */
export function oneShotsFor(scene: AmbienceScene): OneShotRule[] {
  if (scene.place !== 'trail' || !scene.biome) return [];
  const biome = BIOME_KEY[scene.biome];
  const rules: OneShotRule[] = [];
  if (!scene.night) {
    const [min, max] = AMB.dayEvery[biome];
    const ids =
      biome === 'rainforest'
        ? ['amb.bird', 'amb.woodpecker', 'amb.frog', 'amb.twig']
        : ['amb.bird', 'amb.twig'];
    rules.push({ key: `day.${biome}`, min, max, ids });
  } else {
    const [min, max] = AMB.nightEvery;
    const ids =
      biome === 'rainforest' ? ['amb.owl', 'amb.twig', 'amb.frog'] : ['amb.owl', 'amb.twig'];
    rules.push({ key: `night.${biome}`, min, max, ids });
    if (biome === 'alpine') {
      const [wMin, wMax] = AMB.wolfEvery;
      rules.push({ key: 'wolf', min: wMin, max: wMax, ids: ['amb.wolfFar'] });
    }
  }
  if (scene.weather === 'rain') {
    const [min, max] = AMB.thunderEvery;
    rules.push({ key: 'thunder', min, max, ids: ['weather.thunder'] });
  }
  return rules;
}

/** One line for the debug panel's Sound tab. */
export function describeScene(scene: AmbienceScene): string {
  const bed = bedFor(scene);
  if (!bed) return 'off';
  const layers = layersFor(scene);
  return layers.length ? `${bed} + ${layers.join(', ')}` : bed;
}

const between = (min: number, max: number) => min + Math.random() * (max - min);

class AmbienceDirector {
  private scene: AmbienceScene = { place: 'none' };
  private bed: { id: string; handle: LoopHandle } | null = null;
  private layers = new Map<string, LoopHandle>();
  private timers = new Map<string, number>();

  set(scene: AmbienceScene): void {
    const was = this.scene;
    this.scene = scene;

    const bed = bedFor(scene);
    if (bed !== (this.bed?.id ?? null)) {
      // Day to night (or back) on the same trail is the slow crossfade.
      const fade =
        was.place === 'trail' && scene.place === 'trail' && was.biome === scene.biome
          ? AMB.bedFadeSec
          : AMB.placeFadeSec;
      this.bed?.handle.fadeOut(fade);
      this.bed = bed ? { id: bed, handle: loop(bed, { fadeIn: fade }) } : null;
    }

    const layers = new Set(layersFor(scene));
    for (const [id, handle] of this.layers) {
      if (!layers.has(id)) {
        handle.fadeOut(AMB.layerFadeSec);
        this.layers.delete(id);
      }
    }
    for (const id of layers) {
      if (!this.layers.has(id)) this.layers.set(id, loop(id, { fadeIn: AMB.layerFadeSec }));
    }

    const rules = oneShotsFor(scene);
    const keys = new Set(rules.map((r) => r.key));
    for (const [key, t] of this.timers) {
      if (!keys.has(key)) {
        window.clearTimeout(t);
        this.timers.delete(key);
      }
    }
    for (const rule of rules) if (!this.timers.has(rule.key)) this.schedule(rule);

    audio.setInfo('ambience', describeScene(scene));
  }

  private schedule(rule: OneShotRule): void {
    const t = window.setTimeout(
      () => {
        this.timers.delete(rule.key);
        const id = rule.ids[Math.floor(Math.random() * rule.ids.length)];
        if (id) {
          sfx(id, {
            pan: between(-AMB.pan, AMB.pan),
            volume: between(AMB.volume[0], AMB.volume[1]),
          });
        }
        if (oneShotsFor(this.scene).some((r) => r.key === rule.key)) this.schedule(rule);
      },
      between(rule.min, rule.max) * 1000,
    );
    this.timers.set(rule.key, t);
  }
}

/** The game's one ambience. Screens tell it where the party is. */
export const ambience = new AmbienceDirector();
