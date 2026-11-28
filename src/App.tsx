import { useState } from 'react';
import { sfx } from './audio/engine';
import { useAmbience } from './audio/useAmbience';
import { DEFAULT_PARTY } from './content/roster';
import { TEST_HIKERS } from './content/testHikers';
import {
  createGame,
  isHikeOver,
  type HikerSetup,
  type LoadFailure,
  type NewGameOptions,
} from './engine';
import { autoPack } from './packing/logic';
import { seatsFor } from './packing/seats';
import { gameStore, useGame } from './ui/app/gameStore';
import { useHash } from './ui/app/useHash';
import { DebugItems } from './ui/debug/DebugItems';
import { DebugCards } from './ui/debug/DebugCards';
import { DebugChallenges } from './ui/debug/DebugChallenges';
import { ConditionsMockup } from './ui/mockup/ConditionsMockup';
import { CraftingMockup } from './ui/mockup/CraftingMockup';
import { StationExtrasMockup } from './ui/mockup/StationExtrasMockup';
import { HikerCardsMockup } from './ui/mockup/HikerCardsMockup';
import { HikerSelect, type Selection } from './ui/select/HikerSelect';
import { PackingBackdrop, PackingScreen } from './ui/packing/PackingScreen';
import { useSkipPacking } from './ui/debug/testingSettings';
import { DebugMap } from './ui/debug/DebugMap';
import { DebugPanel } from './ui/debug/DebugPanel';
import { SelectDebugPanel } from './ui/debug/SelectDebugPanel';
import { SelectBackground } from './ui/select/background/SelectBackground';
import { TestHikerPicker } from './ui/debug/DebugTraits';
import { debugEnabled } from './ui/debug/debugEnabled';
import { ConfirmDialog } from './ui/game/ConfirmDialog';
import { GameScreen } from './ui/game/GameScreen';
import { Stage } from './ui/stage/Stage';
import { describeSave } from './ui/title/describeSave';
import { TitleScreen } from './ui/title/TitleScreen';
import { MinigameTesting } from './ui/minigames/MinigameTesting';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

const NOTICES: Record<LoadFailure, string | null> = {
  empty: null,
  corrupt: 'Your saved hike couldn’t be read, so it can’t be continued. Start a new hike below.',
  tooNew: 'Your saved hike is from a newer version of the game. Reload the page to get it.',
  unsupported: 'This run is from an older version and can’t continue. Start a new hike below.',
};

export function App() {
  const hash = useHash();
  const game = useGame();
  const [screen, setScreen] = useState<'title' | 'select' | 'pack' | 'game' | 'minigames'>('title');
  /**
   * The party a new hike will start with, waiting for "replace my saved
   * hike?": packing first (hiker select), or straight in (the test hikers).
   */
  const [pending, setPending] = useState<{
    hikers: readonly HikerSetup[];
    then: 'pack' | 'start';
  } | null>(null);
  /** Hiker select's spots, kept while packing so Back returns to the same party. */
  const [selection, setSelection] = useState<Selection | null>(null);
  /** The packing screen's run (27-packing-screen.md): its seed and hikers. */
  const [packing, setPacking] = useState<{ seed: number; hikers: readonly HikerSetup[] } | null>(
    null,
  );
  const skipPacking = useSkipPacking();
  // The title's evening forest; the game screen sets its own.
  useAmbience(
    screen === 'title' ? { place: 'title' } : screen === 'game' && game ? null : { place: 'none' },
  );

  if (hash.startsWith('#debug-map')) return <DebugMap hash={hash} />;
  if (hash.startsWith('#debug-cards') && debugEnabled()) return <DebugCards />;
  if (hash.startsWith('#debug-items') && debugEnabled()) return <DebugItems />;
  if (hash.startsWith('#debug-challenges') && debugEnabled()) return <DebugChallenges />;
  if (hash.startsWith('#mockup-conditions') && debugEnabled()) return <ConditionsMockup />;
  if (hash.startsWith('#mockup-crafting') && debugEnabled()) return <CraftingMockup />;
  if (hash.startsWith('#mockup-station-extras') && debugEnabled()) return <StationExtrasMockup />;
  if (hash.startsWith('#mockup-hiker-cards') && debugEnabled()) return <HikerCardsMockup />;

  const startNew = (
    seed = randomSeed(),
    hikers: readonly HikerSetup[] = DEFAULT_PARTY,
    packed?: NewGameOptions['packed'],
  ) => {
    gameStore.newGame(createGame({ seed, hikers, ...(packed ? { packed } : {}) }));
    sfx('hike.start');
    setPending(null);
    setPacking(null);
    setSelection(null);
    setScreen('game');
  };
  /** Hiker select's Start: the party packs for the hike (Testing → Skip packing: at random). */
  const pack = (hikers: readonly HikerSetup[]) => {
    const seed = randomSeed();
    setPending(null);
    if (skipPacking) startNew(seed, hikers, autoPack({ seed, seats: seatsFor(seed, hikers) }));
    else {
      setPacking({ seed, hikers });
      setScreen('pack');
    }
  };
  /** First asks when it would replace a saved hike that isn't over. */
  const startAsking = (hikers: readonly HikerSetup[], then: 'pack' | 'start') => {
    if (game && !isHikeOver(game)) setPending({ hikers, then });
    else if (then === 'pack') pack(hikers);
    else startNew(randomSeed(), hikers);
  };
  const newHike = () => {
    setSelection(null);
    setScreen('select');
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
          onNewHike={newHike}
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
      onConfirm={() =>
        pending.then === 'pack' ? pack(pending.hikers) : startNew(randomSeed(), pending.hikers)
      }
    />
  );

  if (screen === 'select') {
    return (
      <>
        <Stage backdrop={<SelectBackground />}>
          <HikerSelect
            remembered={selection}
            onStart={(hikers, picked) => {
              setSelection(picked);
              startAsking(hikers, 'pack');
            }}
            onBack={() => setScreen('title')}
          />
          {replaceDialog}
        </Stage>
        {debugEnabled() && <SelectDebugPanel />}
      </>
    );
  }

  // Packing for the hike (Phase 10.9), between hiker select and the hike. Never saved.
  if (screen === 'pack' && packing) {
    return (
      <Stage backdrop={<PackingBackdrop />}>
        <PackingScreen
          key={packing.seed}
          seed={packing.seed}
          hikers={packing.hikers}
          onBack={() => {
            setPacking(null);
            setScreen('select');
          }}
          onTitle={() => {
            setPacking(null);
            setSelection(null);
            setScreen('title');
          }}
          onDone={(packed) => startNew(packing.seed, packing.hikers, packed)}
        />
      </Stage>
    );
  }

  // Minigame testing (Phase 10.8): its own screen, which never touches the saved hike.
  if (screen === 'minigames') {
    return (
      <Stage>
        <MinigameTesting onBack={() => setScreen('title')} />
      </Stage>
    );
  }

  const problem = gameStore.loadProblem;
  return (
    <Stage>
      <TitleScreen
        saved={game ? describeSave(game) : null}
        notice={!game && problem ? NOTICES[problem] : null}
        onContinue={() => setScreen('game')}
        onNewHike={newHike}
        onMinigames={() => setScreen('minigames')}
        {...(debugEnabled()
          ? {
              testPicker: (
                <TestHikerPicker onStart={(ids) => startAsking(testHikers(ids), 'start')} />
              ),
            }
          : {})}
      />
      {replaceDialog}
    </Stage>
  );
}
