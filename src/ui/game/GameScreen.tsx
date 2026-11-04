/**
 * The game screen (docs/mockups/Main.dc.html): the backdrop, the map and the
 * floating panels, laid out on the 1600×1000 stage.
 */
import { useMemo, useState } from 'react';
import { hikersWhoHaventActed, type Action, type GameState, type HikerId } from '../../engine';
import { gameStore } from '../app/gameStore';
import { Backdrop } from '../backdrop/Backdrop';
import { TrailLog } from '../log/TrailLog';
import { MapControls } from '../map/MapControls';
import {
  clampCamera,
  focusOn,
  lastRowOf,
  mapBounds,
  scrollAbove,
  tileCenter,
  ZOOM,
  type Camera,
} from '../map/mapLayout';
import { MapView } from '../map/MapView';
import { SideRail } from '../map/SideRail';
import type { ActionId } from '../panels/hikerInfo';
import { PartyPanel } from '../panels/PartyPanel';
import { AbundanceCard, BiomeCard, DayBar, MenuButton, ObjectiveCard } from '../panels/TopBar';
import { TurnPanel } from '../panels/TurnPanel';
import { Stage } from '../stage/Stage';
import { ConfirmDialog } from './ConfirmDialog';

const PHASE_WORD = { morning: 'morning', afternoon: 'afternoon', night: 'night' } as const;

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function GameScreen({ state, onQuit }: { state: GameState; onQuit(): void }) {
  const { section, hikers } = state;
  const bounds = useMemo(() => mapBounds(section), [section]);
  const [selectedId, setSelectedId] = useState<HikerId | null>(
    () => hikers.find((h) => h.status === 'active')?.id ?? null,
  );
  const selected = hikers.find((h) => h.id === selectedId) ?? hikers[0];
  const [note, setNote] = useState<string | undefined>();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const centerOf = (tileId: string | undefined) => {
    const tile = tileId ? section.tiles[tileId] : undefined;
    return tile ? tileCenter(tile, lastRowOf(section)) : { x: 0, y: 0 };
  };
  const [rawCamera, setCamera] = useState<Camera>(() =>
    focusOn(centerOf(selected?.tileId), ZOOM.default, bounds),
  );
  // Keep the camera inside the map even if the map changes under it.
  const camera = clampCamera(rawCamera, bounds);

  const dispatch = (action: Action) => {
    const result = gameStore.dispatch(action);
    setNote(result.ok ? undefined : result.reason);
  };
  const select = (id: HikerId) => {
    setSelectedId(id);
    setNote(undefined);
  };
  const onAction = (id: ActionId) => {
    // Moving and sleeping are wired up in Phase 3, step 3.
    setNote(id === 'sleep' ? 'Sleeping works in step 3.' : 'Moving works in step 3.');
  };

  const waiting = hikersWhoHaventActed(state);
  const endPhase = () => (waiting.length ? setConfirmEnd(true) : dispatch({ type: 'endPhase' }));
  const phaseWord = PHASE_WORD[state.phase];

  return (
    <Stage>
      <Backdrop phase={state.phase} biome={section.biome} scrollY={scrollAbove(camera, bounds)} />
      <MapView
        section={section}
        hikers={hikers}
        selectedId={selected?.id ?? null}
        onSelectHiker={select}
        camera={camera}
        setCamera={setCamera}
        bounds={bounds}
      />
      <SideRail
        section={section}
        hikers={hikers}
        camera={camera}
        bounds={bounds}
        onJump={setCamera}
      />
      <MapControls
        camera={camera}
        bounds={bounds}
        onCamera={setCamera}
        onCenter={() => setCamera(focusOn(centerOf(selected?.tileId), camera.zoom, bounds))}
      />

      <BiomeCard state={state} />
      <DayBar state={state} />
      <ObjectiveCard />
      <AbundanceCard state={state} />
      <MenuButton onTitle={onQuit} />
      <PartyPanel state={state} selectedId={selected?.id ?? null} onSelect={select} />
      {selected && (
        <TurnPanel
          state={state}
          hiker={selected}
          note={note}
          onAction={onAction}
          onAbility={(abilityId, choice) =>
            dispatch({
              type: 'useAbility',
              hikerId: selected.id,
              abilityId,
              ...(choice ? { choice } : {}),
            })
          }
          onEndPhase={endPhase}
        />
      )}
      <TrailLog state={state} />

      {confirmEnd && (
        <ConfirmDialog
          title={`End the ${phaseWord}?`}
          message={`${
            waiting.length === hikers.filter((h) => h.status === 'active').length
              ? 'Nobody has'
              : `${listNames(waiting.map((h) => h.name))} ${waiting.length === 1 ? 'hasn’t' : 'haven’t'}`
          } acted yet. End the ${phaseWord} anyway?`}
          confirmLabel={`End ${phaseWord}`}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            dispatch({ type: 'endPhase' });
          }}
        />
      )}
    </Stage>
  );
}
