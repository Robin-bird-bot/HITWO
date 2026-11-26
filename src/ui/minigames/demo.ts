/**
 * Demo mode (docs/design/20-challenge-popup.md, section 2): in the pop-up,
 * the GPS runs the real game with a bot giving the inputs. A screen in demo
 * mode ignores the player (no keys, no clicks) and lets its game's bot act
 * through the screen's own handlers, so what you see is what you'll get.
 *
 * Each game's bot (`bot.ts` next to its logic) is a pure decide function:
 * it looks at the game now, its own memory and its own seeded randomness,
 * and returns what to do now, or nothing. Bots pace themselves through
 * their memory (the next time they'll act), and go wrong now and then.
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import { seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';

/** Whether the screen is a demo the bot plays. */
export const DemoContext = createContext(false);

export const useDemoMode = (): boolean => useContext(DemoContext);

/** A bot's memory between frames (what it's following, when it acts next). */
export type BotMemory = Record<string, unknown>;

/** A game's bot: what to do now with the game as it is, or null. */
export type DemoBot<S, A> = (game: S, mem: BotMemory, rng: RngState, time: number) => A | null;

let botSeed = 1;

/**
 * Runs a bot while `on`: every frame it looks at the latest game and, when
 * it decides something, does it through `act` (the screen's own handler).
 * `time` is seconds since the bot started.
 */
export function useDemoBot<S, A>(
  on: boolean,
  game: S,
  bot: DemoBot<S, A>,
  act: (a: A) => void,
): void {
  const gameRef = useRef(game);
  const actRef = useRef(act);
  const botRef = useRef(bot);
  useEffect(() => {
    gameRef.current = game;
    actRef.current = act;
    botRef.current = bot;
  });
  useEffect(() => {
    if (!on) return;
    const mem: BotMemory = {};
    const rng = seedRng((botSeed = (botSeed * 48271) % 2147483647));
    const start = performance.now();
    let frame = requestAnimationFrame(function loop(now) {
      const a = botRef.current(gameRef.current, mem, rng, (now - start) / 1000);
      if (a !== null && a !== undefined) actRef.current(a);
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [on]);
}
