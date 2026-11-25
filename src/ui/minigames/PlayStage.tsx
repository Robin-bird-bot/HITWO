/**
 * What the turned GPS plays (docs/design/11-minigames-puzzles.md, "Line up"
 * and "Results"): for a puzzle game with 2 or more hikers, Line up first;
 * then the game with the hikers in that order; then the shared results card
 * ("2 passed, 1 failed"). Play again goes back to Line up, starting from the
 * last order. Bearrels plays its own rounds and results.
 */
import { useState } from 'react';
import { needsLineUp } from '../../minigames/lineup';
import type {
  MinigameHiker,
  MinigameInfo,
  MinigameResult,
  MinigameSettings,
} from '../../minigames/types';
import { LineUp } from './LineUp';
import { ResultsCard } from './ResultsCard';
import { PUZZLES, RUNNERS } from './runners';

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
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<MinigameResult | null>(null);

  const Own = RUNNERS[info.id];
  if (Own) return <Own settings={settings} hikers={hikers} seed={seed} onDone={onDone} />;
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
      <Game
        key={round}
        settings={settings}
        hikers={ordered}
        seed={seed + round * 7919}
        onDone={setResult}
      />
      {result && (
        <ResultsCard
          result={result}
          hikers={ordered}
          onContinue={() => onDone(result)}
          onPlayAgain={() => {
            setResult(null);
            setRound((r) => r + 1);
            setStep(lineUp ? 'lineup' : 'game');
          }}
        />
      )}
    </>
  );
}
