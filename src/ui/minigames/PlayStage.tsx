/**
 * What the turned GPS plays (docs/design/11-minigames-puzzles.md, "Line up";
 * 16-challenge-end-screen.md): for a puzzle game with 2 or more hikers, Line
 * up first; then the game with the hikers in that order; then the shared end
 * screen (Challenge Passed or Challenge Failed). A tap there turns the GPS
 * back, and the pop-up shows how it went (with Play again in test mode).
 */
import { useEffect, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { endInfo } from '../../minigames/catalog';
import { needsLineUp } from '../../minigames/lineup';
import type {
  MinigameHiker,
  MinigameInfo,
  MinigameResult,
  MinigameSettings,
} from '../../minigames/types';
import { EndScreen } from './EndScreen';
import { LineUp } from './LineUp';
import { PUZZLES } from './runners';
import { mgSfx } from './sound';

export function PlayStage({
  info,
  settings,
  hikers,
  seed,
  onDone,
}: {
  info: MinigameInfo;
  settings: MinigameSettings;
  hikers: readonly MinigameHiker[];
  seed: number;
  onDone(result: MinigameResult): void;
}) {
  const lineUp = !!info.lineUp && needsLineUp(hikers.length);
  const [step, setStep] = useState<'lineup' | 'game'>(lineUp ? 'lineup' : 'game');
  const [order, setOrder] = useState<string[]>(() => hikers.map((h) => h.id));
  const [result, setResult] = useState<MinigameResult | null>(null);
  const end = endInfo(info, settings);

  // The game counts itself in as it comes up (after Line up): 3, 2, 1, GO.
  useEffect(() => {
    if (step !== 'game') return;
    const gap = BALANCE.audio.countGapSec;
    for (let k = 0; k < 3; k++) mgSfx('mg.count', k ? { delay: k * gap } : {});
    mgSfx('mg.go', { delay: 3 * gap });
  }, [step]);

  const Game = PUZZLES[info.id];
  if (!Game) return null;

  const ordered = order.flatMap((id) => hikers.filter((h) => h.id === id));
  if (step === 'lineup') {
    return (
      <LineUp
        hikers={hikers}
        initial={order}
        onGo={(next) => {
          setOrder(next);
          setStep('game');
        }}
      />
    );
  }
  return (
    <>
      <Game settings={settings} hikers={ordered} seed={seed} onDone={setResult} />
      {result && (
        <EndScreen
          result={result}
          hikers={ordered}
          subtitle={end.subtitle}
          thing={end.thing}
          seed={seed}
          onContinue={() => onDone(result)}
        />
      )}
    </>
  );
}
