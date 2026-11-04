import { useState } from 'react';
import { STARTING_PARTY } from './content/characters';
import { createGame, type LoadFailure } from './engine';
import { gameStore, useGame } from './ui/app/gameStore';
import { useHash } from './ui/app/useHash';
import { DebugMap } from './ui/debug/DebugMap';
import { DebugPanel } from './ui/debug/DebugPanel';
import { debugEnabled } from './ui/debug/debugEnabled';
import { ConfirmDialog } from './ui/game/ConfirmDialog';
import { GameScreen } from './ui/game/GameScreen';
import { Stage } from './ui/stage/Stage';
import { describeSave } from './ui/title/describeSave';
import { TitleScreen } from './ui/title/TitleScreen';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

const NOTICES: Record<LoadFailure, string | null> = {
  empty: null,
  corrupt: 'Your saved hike couldn’t be read, so it can’t be continued. Start a new hike below.',
  tooNew: 'Your saved hike is from a newer version of the game. Reload the page to get it.',
  unsupported:
    'Your saved hike is from an older version of the game that can’t be loaded any more.',
};

export function App() {
  const hash = useHash();
  const game = useGame();
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [confirmNew, setConfirmNew] = useState(false);

  if (hash.startsWith('#debug-map')) return <DebugMap hash={hash} />;

  const startNew = (seed = randomSeed()) => {
    gameStore.newGame(createGame({ seed, hikers: STARTING_PARTY }));
    setConfirmNew(false);
    setScreen('game');
  };

  if (screen === 'game' && game) {
    return (
      <>
        <GameScreen key={game.seed} state={game} onQuit={() => setScreen('title')} />
        {debugEnabled() && (
          <DebugPanel state={game} onQuit={() => setScreen('title')} onNewGame={startNew} />
        )}
      </>
    );
  }

  const problem = gameStore.loadProblem;
  return (
    <Stage>
      <TitleScreen
        saved={game ? describeSave(game) : null}
        notice={!game && problem ? NOTICES[problem] : null}
        onContinue={() => setScreen('game')}
        onNewHike={() => (game ? setConfirmNew(true) : startNew())}
      />
      {confirmNew && game && (
        <ConfirmDialog
          title="Start a new hike?"
          message={`Your saved hike (${describeSave(game)}) will be replaced. This can’t be undone.`}
          confirmLabel="Start new hike"
          cancelLabel="Keep my hike"
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => startNew()}
        />
      )}
    </Stage>
  );
}
