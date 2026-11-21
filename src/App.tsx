import { useState } from 'react';
import { DEFAULT_PARTY } from './content/roster';
import { TEST_HIKERS } from './content/testHikers';
import { createGame, isHikeOver, type HikerSetup, type LoadFailure } from './engine';
import { gameStore, useGame } from './ui/app/gameStore';
import { useHash } from './ui/app/useHash';
import { DebugItems } from './ui/debug/DebugItems';
import { DebugCards } from './ui/debug/DebugCards';
import { DebugChallenges } from './ui/debug/DebugChallenges';
import { ConditionsMockup } from './ui/mockup/ConditionsMockup';
import { CraftingMockup } from './ui/mockup/CraftingMockup';
import { StationExtrasMockup } from './ui/mockup/StationExtrasMockup';
import { HikerCardsMockup } from './ui/mockup/HikerCardsMockup';
import { HikerSelect } from './ui/select/HikerSelect';
import { DebugMap } from './ui/debug/DebugMap';
import { DebugPanel } from './ui/debug/DebugPanel';
import { SelectDebugPanel } from './ui/debug/SelectDebugPanel';
import { TestHikerPicker } from './ui/debug/DebugTraits';
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
  const [screen, setScreen] = useState<'title' | 'select' | 'game'>('title');
  /** The party a new hike will start with, waiting for "replace my saved hike?". */
  const [pending, setPending] = useState<readonly HikerSetup[] | null>(null);

  if (hash.startsWith('#debug-map')) return <DebugMap hash={hash} />;
  if (hash.startsWith('#debug-cards') && debugEnabled()) return <DebugCards />;
  if (hash.startsWith('#debug-items') && debugEnabled()) return <DebugItems />;
  if (hash.startsWith('#debug-challenges') && debugEnabled()) return <DebugChallenges />;
  if (hash.startsWith('#mockup-conditions') && debugEnabled()) return <ConditionsMockup />;
  if (hash.startsWith('#mockup-crafting') && debugEnabled()) return <CraftingMockup />;
  if (hash.startsWith('#mockup-station-extras') && debugEnabled()) return <StationExtrasMockup />;
  if (hash.startsWith('#mockup-hiker-cards') && debugEnabled()) return <HikerCardsMockup />;

  const startNew = (seed = randomSeed(), hikers: readonly HikerSetup[] = DEFAULT_PARTY) => {
    gameStore.newGame(createGame({ seed, hikers }));
    setPending(null);
    setScreen('game');
  };
  /** Starts it, first asking when it would replace a saved hike that isn't over. */
  const startAsking = (hikers: readonly HikerSetup[]) => {
    if (game && !isHikeOver(game)) setPending(hikers);
    else startNew(randomSeed(), hikers);
  };
  /** Dev only: a hike with test hikers (Phase 10a). */
  const testHikers = (ids: string[]) =>
    ids.flatMap((id) => TEST_HIKERS.find((h) => h.id === id) ?? []);

  if (screen === 'game' && game) {
    return (
      <>
        <GameScreen
          key={game.seed}
          state={game}
          onQuit={() => setScreen('title')}
          onNewHike={() => setScreen('select')}
        />
        {debugEnabled() && (
          <DebugPanel
            state={game}
            onQuit={() => setScreen('title')}
            onNewGame={startNew}
            onNewTestHike={(ids) => startNew(randomSeed(), testHikers(ids))}
          />
        )}
      </>
    );
  }

  const replaceDialog = pending && game && (
    <ConfirmDialog
      title="Start a new hike?"
      message={`Your saved hike (${describeSave(game)}) will be replaced. This can’t be undone.`}
      confirmLabel="Start new hike"
      cancelLabel="Keep my hike"
      onCancel={() => setPending(null)}
      onConfirm={() => startNew(randomSeed(), pending)}
    />
  );

  if (screen === 'select') {
    return (
      <>
        <Stage>
          <HikerSelect onStart={startAsking} onBack={() => setScreen('title')} />
          {replaceDialog}
        </Stage>
        {debugEnabled() && <SelectDebugPanel />}
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
        onNewHike={() => setScreen('select')}
        {...(debugEnabled()
          ? {
              testPicker: <TestHikerPicker onStart={(ids) => startAsking(testHikers(ids))} />,
            }
          : {})}
      />
      {replaceDialog}
    </Stage>
  );
}
