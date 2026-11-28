/**
 * Tells the music where the game is (32-audio-system.md, section 5). Several
 * parts of the screen can claim it at once: the screen (title, packing…),
 * the hike (the trail, the station, the end), and a window over it (a
 * Wonder, a night event, a challenge). The highest layer wins, and the
 * newest claim within a layer. Null claims nothing.
 */
import { useEffect, useState } from 'react';
import type { MusicScene } from './music';
import { music } from './musicPlayer';

export const MUSIC_LAYER = { screen: 0, hike: 1, window: 2 } as const;

interface Claim {
  layer: number;
  scene: MusicScene;
  at: number;
}

const claims = new Map<number, Claim>();
let nextId = 1;
let clock = 0;

/** The claim that wins: the highest layer, then the newest. */
export function topClaim(all: Iterable<Claim>): MusicScene {
  let best: Claim | null = null;
  for (const c of all) {
    if (!best || c.layer > best.layer || (c.layer === best.layer && c.at > best.at)) best = c;
  }
  return best?.scene ?? { place: 'none' };
}

const settle = () => music.set(topClaim(claims.values()));

export function useMusic(scene: MusicScene | null, layer: number = MUSIC_LAYER.screen): void {
  const [id] = useState(() => nextId++);
  // The scene's parts as one key, so it changes only when one of them does.
  const key = scene ? JSON.stringify(scene) : null;
  useEffect(() => {
    if (!key) return;
    claims.set(id, { layer, scene: JSON.parse(key) as MusicScene, at: ++clock });
    settle();
    return () => {
      claims.delete(id);
      settle();
    };
  }, [id, key, layer]);
}
