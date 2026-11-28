/**
 * Plays the game's sounds after every action (`gameSounds.ts`): the events
 * written since the last look, with the game as it was just before. Nothing
 * plays for what happened before the screen opened (a reload, Continue).
 */
import { useEffect, useRef } from 'react';
import { BALANCE } from '../config/balance';
import type { GameState } from '../engine';
import { sfx } from './engine';
import { cuesFor } from './gameSounds';

export function useGameSounds(state: GameState): void {
  const before = useRef<GameState | null>(null);
  const seen = useRef(state.nextEventId);
  useEffect(() => {
    const was = before.current;
    before.current = state;
    const from = seen.current;
    seen.current = state.nextEventId;
    if (!was || state.nextEventId <= from) return;
    const events = state.log.filter((e) => e.id >= from);
    for (const c of cuesFor(events, was, state, BALANCE.audio.walkSec)) {
      sfx(c.id, {
        ...(c.delay ? { delay: c.delay } : {}),
        ...(c.volume !== undefined ? { volume: c.volume } : {}),
        ...(c.version !== undefined ? { version: c.version } : {}),
      });
    }
  }, [state]);
}
