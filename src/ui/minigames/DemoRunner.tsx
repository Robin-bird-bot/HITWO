/**
 * The pop-up's demo (docs/design/20-challenge-popup.md, section 2): the GPS
 * runs the real game in demo mode, a bot giving the inputs, with the
 * current Prepare choices. Nothing in it counts, and it makes no sound.
 *
 * - When a round ends, its last frame stays up [2.4 s], then a new round
 *   starts with a new seed. Long games are cut at [30 s].
 * - A change to Prepare starts a new round at once with the new settings.
 * - Reduced motion, or a filled SKIP IT: one still frame.
 * - Each round has its own seed (never the real run's): the version (night,
 *   fog) is pinned in the settings, so the demo shows the same one.
 */
import { useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import type { MinigameHiker, MinigameSettings } from '../../minigames/types';
import { useReducedMotion } from '../app/useReducedMotion';
import { DemoContext } from './demo';
import { PUZZLES } from './runners';
import { muteSounds } from './sound';

const DEMO = BALANCE.minigames.prepare.demo;

export function DemoRunner({
  gameId,
  settings,
  hikers,
  still = false,
}: {
  gameId: string;
  settings: MinigameSettings;
  hikers: readonly MinigameHiker[];
  /** A still frame (SKIP IT is filled). */
  still?: boolean;
}) {
  const reduced = useReducedMotion();
  const Game = PUZZLES[gameId];
  const [round, setRound] = useState(0);
  const settingsKey = JSON.stringify(settings);
  const next = useRef<number | null>(null);
  const frozen = reduced || still;

  // No sound while the demo is up.
  useEffect(() => muteSounds(), []);
  // Long games are cut: a new round after [30 s].
  useEffect(() => {
    if (frozen) return;
    const id = window.setTimeout(() => setRound((r) => r + 1), DEMO.cutSec * 1000);
    return () => window.clearTimeout(id);
  }, [round, settingsKey, frozen]);
  useEffect(
    () => () => {
      if (next.current !== null) window.clearTimeout(next.current);
    },
    [],
  );

  if (!Game) return null;
  const done = () => {
    if (next.current !== null) window.clearTimeout(next.current);
    next.current = window.setTimeout(() => {
      next.current = null;
      setRound((r) => r + 1);
    }, DEMO.resultSec * 1000);
  };
  return (
    <DemoContext.Provider value={!frozen}>
      <Game
        key={`${round}|${settingsKey}`}
        settings={settings}
        hikers={hikers}
        seed={7919 * (round + 1) + 17}
        onDone={done}
        still={frozen}
      />
    </DemoContext.Provider>
  );
}
