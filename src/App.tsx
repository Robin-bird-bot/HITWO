import { useState } from 'react';
import { STARTING_PARTY } from './content/characters';
import { createGame } from './engine';
import { gameStore, useGame } from './ui/app/gameStore';
import { useHash } from './ui/app/useHash';
import { DebugMap } from './ui/debug/DebugMap';
import { DebugPanel } from './ui/debug/DebugPanel';
import { debugEnabled } from './ui/debug/debugEnabled';
import { GameScreen } from './ui/game/GameScreen';
import { Stage } from './ui/stage/Stage';
import { TitleScreen } from './ui/title/TitleScreen';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export function App() {
  const hash = useHash();
  const game = useGame();
  const [screen, setScreen] = useState<'title' | 'game'>('title');

  if (hash.startsWith('#debug-map')) return <DebugMap hash={hash} />;

  if (screen === 'game' && game) {
    return (
      <>
        <GameScreen key={game.seed} state={game} onQuit={() => setScreen('title')} />
        {debugEnabled() && <DebugPanel state={game} onQuit={() => setScreen('title')} />}
      </>
    );
  }

  return (
    <Stage>
      <TitleScreen
        onNewHike={() => {
          gameStore.newGame(createGame({ seed: randomSeed(), hikers: STARTING_PARTY }));
          setScreen('game');
        }}
      />
    </Stage>
  );
}
