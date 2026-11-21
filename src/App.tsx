import { useState } from 'react';
import { DEFAULT_PARTY } from './content/roster';
import { TEST_HIKERS } from './content/testHikers';
import { createGame, type HikerSetup, type LoadFailure } from './engine';
import { gameStore, useGame } from './ui/app/gameStore';
import { useHash } from './ui/app/useHash';
import { DebugItems } from './ui/debug/DebugItems';
import { DebugCards } from './ui/debug/DebugCards';
import { DebugChallenges } from './ui/debug/DebugChallenges';
import { ConditionsMockup } from './ui/mockup/ConditionsMockup';
import { CraftingMockup } from './ui/mockup/CraftingMockup';
import { StationExtrasMockup } from './ui/mockup/StationExtrasMockup';
import { DebugMap } from './ui/debug/DebugMap';
import { DebugPanel } from './ui/debug/DebugPanel';
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
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [confirmNew, setConfirmNew] = useState(false);
  /** Dev only: the test hikers a confirmed new hike starts with. */
  const [testParty, setTestParty] = useState<string[] | null>(null);

  if (hash.startsWith('#debug-map')) return <DebugMap hash={hash} />;
  if (hash.startsWith('#debug-cards') && debugEnabled()) return <DebugCards />;
  if (hash.startsWith('#debug-items') && debugEnabled()) return <DebugItems />;
  if (hash.startsWith('#debug-challenges') && debugEnabled()) return <DebugChallenges />;
  if (hash.startsWith('#mockup-conditions') && debugEnabled()) return <ConditionsMockup />;
  if (hash.startsWith('#mockup-crafting') && debugEnabled()) return <CraftingMockup />;
  if (hash.startsWith('#mockup-station-extras') && debugEnabled()) return <StationExtrasMockup />;

  const startNew = (seed = randomSeed(), hikers: readonly HikerSetup[] = DEFAULT_PARTY) => {
    gameStore.newGame(createGame({ seed, hikers }));
    setConfirmNew(false);
    setTestParty(null);
    setScreen('game');
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
          onNewHike={() => startNew()}
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

  const problem = gameStore.loadProblem;
  return (
    <Stage>
      <TitleScreen
        saved={game ? describeSave(game) : null}
        notice={!game && problem ? NOTICES[problem] : null}
        onContinue={() => setScreen('game')}
        onNewHike={() => (game ? setConfirmNew(true) : startNew())}
        {...(debugEnabled()
          ? {
              testPicker: (
                <TestHikerPicker
                  onStart={(ids) =>
                    game
                      ? (setTestParty(ids), setConfirmNew(true))
                      : startNew(randomSeed(), testHikers(ids))
                  }
                />
              ),
            }
          : {})}
      />
      {confirmNew && game && (
        <ConfirmDialog
          title="Start a new hike?"
          message={`Your saved hike (${describeSave(game)}) will be replaced. This can’t be undone.`}
          confirmLabel="Start new hike"
          cancelLabel="Keep my hike"
          onCancel={() => {
            setConfirmNew(false);
            setTestParty(null);
          }}
          onConfirm={() =>
            startNew(randomSeed(), testParty ? testHikers(testParty) : DEFAULT_PARTY)
          }
        />
      )}
    </Stage>
  );
}
