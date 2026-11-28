import { useState } from 'react';
import { sfx } from './audio/engine';
import { useAmbience } from './audio/useAmbience';
import { useMusic } from './audio/useMusic';
import { usePackingLook } from './ui/packing/packingSettings';
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
import { LoadingScreen } from './ui/loading/LoadingScreen';
import { Spotlight } from './ui/transition/Spotlight';
import { spotlight } from './ui/transition/transition';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

const NOTICES: Record<LoadFailure, string | null> = {
  empty: null,
  corrupt: 'Your saved hike couldn’t be read, so it can’t be continued. Start a new hike below.',
  tooNew: 'Your saved hike is from a newer version of the game. Reload the page to get it.',
  unsupported: 'This run is from an older version and can’t continue. Start a new hike below.',
};

/** Every full-screen change goes through the spotlight (35-ui-overhaul.md, section 10). */
const go = (change: () => void) => {
  spotlight({ change });
};

export function App() {
  return (
    <>
      <Screens />
      <Spotlight />
    </>
  );
}

function Screens() {
  const hash = useHash();
  const game = useGame();
  const [screen, setScreen] = useState<
    'title' | 'select' | 'pack' | 'loading' | 'game' | 'minigames'
  >('title');
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
  const packingLook = usePackingLook();
  // The title's evening forest; the game screen sets its own; loading plays
  // where the party is going (at half, 35-ui-overhaul.md, section 9).
  useAmbience(
    screen === 'title'
      ? { place: 'title' }
      : screen === 'loading' && game
        ? { place: 'trail', biome: game.section.biome, night: game.phase === 'night' }
        : screen === 'game' && game
          ? null
          : { place: 'none' },
  );

  // The screen's music (32-audio-system.md, section 5); the hike and minigames set their own.
  useMusic(
    screen === 'title'
      ? { place: 'title' }
      : screen === 'select'
        ? { place: 'select' }
        : screen === 'pack'
          ? { place: 'packing', look: packingLook }
          : screen === 'loading'
            ? { place: 'loading' }
            : null,
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
    // Packing → loading → the map.
    go(() => {
      setPacking(null);
      setSelection(null);
      setScreen('loading');
    });
  };
  /** Hiker select's Start: the party packs for the hike (Testing → Skip packing: at random). */
  const pack = (hikers: readonly HikerSetup[]) => {
    const seed = randomSeed();
    setPending(null);
    if (skipPacking) startNew(seed, hikers, autoPack({ seed, seats: seatsFor(seed, hikers) }));
    else {
      go(() => {
        setPacking({ seed, hikers });
        setScreen('pack');
      });
    }
  };
  /** First asks when it would replace a saved hike that isn't over. */
  const startAsking = (hikers: readonly HikerSetup[], then: 'pack' | 'start') => {
    if (game && !isHikeOver(game)) setPending({ hikers, then });
    else if (then === 'pack') pack(hikers);
    else startNew(randomSeed(), hikers);
  };
  const newHike = () =>
    go(() => {
      setSelection(null);
      setScreen('select');
    });
  const toTitle = () => go(() => setScreen('title'));
  /** Dev only: a hike with test hikers (Phase 10a). */
  const testHikers = (ids: string[]) =>
    ids.flatMap((id) => TEST_HIKERS.find((h) => h.id === id) ?? []);

  if (screen === 'game' && game) {
    return (
      <>
        <GameScreen key={game.seed} state={game} onQuit={toTitle} onNewHike={newHike} />
        {debugEnabled() && (
          <DebugPanel
            state={game}
            onQuit={toTitle}
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
            onBack={toTitle}
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
          onBack={() =>
            go(() => {
              setPacking(null);
              setScreen('select');
            })
          }
          onTitle={() =>
            go(() => {
              setPacking(null);
              setSelection(null);
              setScreen('title');
            })
          }
          onDone={(packed) => startNew(packing.seed, packing.hikers, packed)}
        />
      </Stage>
    );
  }

  // Minigame testing (Phase 10.8): its own screen, which never touches the saved hike.
  if (screen === 'minigames') {
    return (
      <Stage>
        <MinigameTesting onBack={toTitle} />
      </Stage>
    );
  }

  // Loading the biome before the map (Continue, or a new hike after packing).
  if (screen === 'loading' && game) {
    return (
      <Stage>
        <LoadingScreen biome={game.section.biome} onDone={() => go(() => setScreen('game'))} />
      </Stage>
    );
  }

  const problem = gameStore.loadProblem;
  return (
    <Stage>
      <TitleScreen
        saved={game ? `${describeSave(game)} · ${partyWords(game)}` : null}
        notice={!game && problem ? NOTICES[problem] : null}
        onContinue={() => {
          // A finished hike opens straight onto its end; one still going loads first.
          if (game) go(() => setScreen(isHikeOver(game) ? 'game' : 'loading'));
        }}
        onNewHike={newHike}
        onMinigames={() => go(() => setScreen('minigames'))}
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

/** "4 hikers", for the title's Continue. */
function partyWords(game: { hikers: readonly { status: string }[] }): string {
  const n = game.hikers.filter((h) => h.status !== 'abandoned').length;
  return `${n} hiker${n === 1 ? '' : 's'}`;
}
