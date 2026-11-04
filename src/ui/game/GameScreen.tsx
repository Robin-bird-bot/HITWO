/**
 * The game screen (docs/mockups/Main.dc.html): the backdrop, the map and,
 * from step 2, the floating panels. Laid out on the 1600×1000 stage.
 */
import { useMemo, useState } from 'react';
import type { GameState, HikerId } from '../../engine';
import { Backdrop } from '../backdrop/Backdrop';
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
import { Stage } from '../stage/Stage';

export function GameScreen({ state }: { state: GameState }) {
  const { section, hikers } = state;
  const bounds = useMemo(() => mapBounds(section), [section]);
  const [selectedId, setSelectedId] = useState<HikerId | null>(
    () => hikers.find((h) => h.status === 'active')?.id ?? null,
  );
  const selected = hikers.find((h) => h.id === selectedId) ?? hikers[0];

  const centerOf = (tileId: string | undefined) => {
    const tile = tileId ? section.tiles[tileId] : undefined;
    return tile ? tileCenter(tile, lastRowOf(section)) : { x: 0, y: 0 };
  };
  const [rawCamera, setCamera] = useState<Camera>(() =>
    focusOn(centerOf(selected?.tileId), ZOOM.default, bounds),
  );
  // Keep the camera inside the map even if the map changes under it.
  const camera = clampCamera(rawCamera, bounds);

  return (
    <Stage>
      <Backdrop phase={state.phase} biome={section.biome} scrollY={scrollAbove(camera, bounds)} />
      <MapView
        section={section}
        hikers={hikers}
        selectedId={selected?.id ?? null}
        onSelectHiker={setSelectedId}
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
    </Stage>
  );
}
