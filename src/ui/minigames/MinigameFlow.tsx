/**
 * A challenge played as a minigame (docs/design/10-minigames.md, "The
 * pieces"): the pop-up, then Start lifts the party GPS and the game plays on
 * its screen, then Continue on the results card lowers the GPS and the pop-up
 * shows how it went. In test mode (the Minigame testing tab) the pop-up then
 * offers Back to testing and Play again, and nothing is saved anywhere: the
 * flow never touches the game store.
 */
import { useCallback, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import type { MinigameChallenge } from '../../content/minigameChallenges';
import type { MinigameHiker, MinigameResult, MinigameSettings } from '../../minigames/types';
import { ChallengePopup } from './ChallengePopup';
import { PartyGps } from './PartyGps';
import { RUNNERS } from './runners';

type Stage = 'popup' | 'playing' | 'lowering';

/** A fresh seed for each game (the screen's own randomness: test games aren't part of a run). */
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function MinigameFlow({
  challenge,
  hikers,
  settings,
  testMode = false,
  onBack,
  onFinish,
}: {
  challenge: MinigameChallenge;
  hikers: readonly MinigameHiker[];
  settings: MinigameSettings;
  testMode?: boolean;
  /** Test mode: Back to testing. */
  onBack?(): void;
  /** A real challenge: Continue with the result (a later step). */
  onFinish?(result: MinigameResult): void;
}) {
  const [stage, setStage] = useState<Stage>('popup');
  const [result, setResult] = useState<MinigameResult | undefined>(undefined);
  const [seed, setSeed] = useState(newSeed);
  const Run = RUNNERS[challenge.minigame];
  const start = () => {
    setResult(undefined);
    setSeed(newSeed());
    setStage('playing');
  };
  const lowered = useCallback(() => setStage('popup'), []);
  return (
    <div
      style={
        { position: 'absolute', inset: 0, '--dim': BALANCE.minigames.gps.dim } as CSSProperties
      }
    >
      <ChallengePopup
        challenge={challenge}
        hikers={hikers}
        testMode={testMode}
        result={stage === 'popup' ? result : undefined}
        dimmed={stage !== 'popup'}
        onStart={start}
        {...(onBack ? { onBack } : {})}
        onPlayAgain={start}
        onContinue={() => result && onFinish?.(result)}
      />
      {stage !== 'popup' && Run && (
        <PartyGps up={stage === 'playing'} onLowered={lowered}>
          <Run
            key={seed}
            settings={settings}
            hikers={hikers}
            seed={seed}
            onDone={(r) => {
              setResult(r);
              setStage('lowering');
            }}
          />
        </PartyGps>
      )}
    </div>
  );
}
