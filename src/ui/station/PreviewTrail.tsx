/**
 * Preview Next Trail (Phase 9; approved in #mockup-station-extras, Wyatt,
 * Nov 14): the next biome's map as seen from its Trailhead (its shape, special
 * spaces and the nodes already showing), over the station.
 *
 * - Just looking: from the Preview Next Trail button (or the talk, in Simple
 *   mode). A Cement Mixer or Scout Report already bought shows here.
 * - Cement Mixer: every line that can be paved gets a gold button; pick one,
 *   then pay.
 * - Scout Report: pick up to 3 tiles, then pay. Their cards show when the
 *   party arrives.
 * Drag or scroll to look around; pinch, ctrl + wheel or the buttons zoom. Esc
 * goes back to the station.
 */
import { useEffect, useState } from 'react';
import { BALANCE } from '../../config/balance';
import {
  validateAction,
  type Action,
  type GameState,
  type LineKind,
  type StationSpecialId,
} from '../../engine';
import { useFocusOnOpen } from '../app/useFocusOnOpen';
import { Icon } from '../icons/Icon';
import {
  clampCamera,
  lastRowOf,
  mapBounds,
  MAP_VIEW,
  tileCenter,
  zoomAt,
  ZOOM,
  type Camera,
} from '../map/mapLayout';
import { MapView } from '../map/MapView';
import { SPECIAL_LOOK } from './stationLook';
import { aheadChips } from './stationTalk';
import room from './StationScreen.module.css';
import styles from './PreviewTrail.module.css';

export type PreviewMode = 'look' | StationSpecialId;

/** What paving makes of each line kind (as the Paver does). */
const PAVES: Partial<Record<LineKind, string>> = {
  steep: 'normal',
  muddy: 'normal',
  rough: 'normal',
  normal: 'Paved',
};

const BIOME_NAME = {
  meadow: 'THE MEADOW',
  temperateRainforest: 'THE TEMPERATE RAINFOREST',
  alpine: 'THE ALPINE',
} as const;
const NUMERAL = ['', 'I', 'II', 'III', 'IV'];

export function PreviewTrail({
  state,
  mode,
  onBuy,
  onClose,
}: {
  state: GameState;
  mode: PreviewMode;
  /** True when the purchase went through. */
  onBuy(action: Action): boolean;
  onClose(): void;
}) {
  const station = state.station;
  const next = station?.next;
  const bounds = next ? mapBounds(next) : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  // Start at the bottom (the Trailhead), zoomed out to see as much as fits.
  const [camera, setCamera] = useState<Camera>(() => {
    const fit = Math.min(
      MAP_VIEW.w / (bounds.maxX - bounds.minX),
      MAP_VIEW.h / (bounds.maxY - bounds.minY),
    );
    return clampCamera(
      { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY, zoom: Math.max(0.62, fit) },
      bounds,
    );
  });
  const [line, setLine] = useState<string | null>(null);
  const [tiles, setTiles] = useState<string[]>([]);
  const panel = useFocusOnOpen<HTMLElement>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!station || !next) return null;
  const lastRow = lastRowOf(next);
  const picking = mode !== 'look';
  const price = station.special?.price ?? 0;
  const hikers = state.hikers
    .filter((h) => h.status === 'checkedIn')
    .map((h) => ({ ...h, tileId: next.trailheadId, status: 'active' as const }));
  // A Scout Report already bought: its tiles are marked.
  const scouted = mode === 'look' ? (station.scout ?? []) : tiles;

  const action: Action | null =
    mode === 'cementMixer' && line
      ? { type: 'buy', offerId: 'special', hikerId: hikers[0]?.id ?? '', pick: { lineId: line } }
      : mode === 'scoutReport' && tiles.length
        ? {
            type: 'buy',
            offerId: 'special',
            hikerId: hikers[0]?.id ?? '',
            pick: { tileIds: tiles },
          }
        : null;
  const reason = action ? validateAction(state, action) : null;
  const picked = line ? next.lines.find((l) => l.id === line) : undefined;

  const overlay =
    mode === 'cementMixer'
      ? next.lines.map((l) => {
          const a = next.tiles[l.a];
          const b = next.tiles[l.b];
          if (!a || !b) return null;
          const pa = tileCenter(a, lastRow);
          const pb = tileCenter(b, lastRow);
          const becomes = PAVES[l.kind];
          return (
            <button
              key={l.id}
              type="button"
              className={styles.linePick}
              data-can={becomes ? true : undefined}
              aria-pressed={line === l.id}
              disabled={!becomes}
              aria-label={
                becomes ? `Pave this ${l.kind} line: it becomes ${becomes}` : 'Already Paved'
              }
              title={becomes ? `A ${l.kind} line: becomes ${becomes}` : 'Already Paved'}
              style={{ left: (pa.x + pb.x) / 2, top: (pa.y + pb.y) / 2 }}
              onClick={() => setLine(l.id)}
            >
              <Icon name="road" size={18} />
            </button>
          );
        })
      : null;

  const zoom = (factor: number) =>
    setCamera((c) =>
      zoomAt(c, factor, { x: MAP_VIEW.x + MAP_VIEW.w / 2, y: MAP_VIEW.y + MAP_VIEW.h / 2 }, bounds),
    );

  return (
    <div className={styles.preview} role="dialog" aria-modal="true" aria-label="Preview next trail">
      <div className={styles.dim} aria-hidden="true" />
      <MapView
        section={next}
        hikers={hikers}
        targets={
          mode === 'scoutReport'
            ? Object.values(next.tiles)
                .filter((t) => t.kind === 'normal')
                .map((t) => ({ tileId: t.id, reason: null }))
            : []
        }
        reachLabel="Scout this tile"
        checkpoint={{
          number: station.checkpoint + 1,
          summit: station.checkpoint + 1 >= BALANCE.run.biomes.length,
        }}
        onTileClick={(id) =>
          setTiles((ts) =>
            ts.includes(id)
              ? ts.filter((x) => x !== id)
              : ts.length < BALANCE.station.scoutTiles
                ? [...ts, id]
                : ts,
          )
        }
        marks={Object.fromEntries(scouted.map((id) => [id, 'target' as const]))}
        overlay={overlay}
        selectedId={null}
        onSelectHiker={() => {}}
        camera={camera}
        setCamera={setCamera}
        bounds={bounds}
      />

      <aside ref={panel} tabIndex={-1} className={styles.left}>
        <h2 className={styles.title}>PREVIEW NEXT TRAIL</h2>
        <span className={styles.kicker}>
          {BIOME_NAME[next.biome]} · TIER {NUMERAL[next.tier]}
        </span>
        <p className={styles.small}>
          What the party can see from the Trailhead: the trail’s shape, its special spaces and the
          nodes already showing. Drag to look around.
        </p>
        {picking ? (
          <div className={styles.special}>
            <span className={styles.specialName}>
              <Icon name={SPECIAL_LOOK[mode].icon} size={18} />
              {SPECIAL_LOOK[mode].name}
            </span>
            <p>
              {mode === 'cementMixer'
                ? 'Pick one line to pave. Steep, Muddy and Rough lines become normal; a normal line becomes Paved.'
                : `Pick up to ${BALANCE.station.scoutTiles} tiles. Their challenges show on the map when the party arrives.`}
            </p>
            <p className={styles.picked} aria-live="polite">
              {mode === 'cementMixer'
                ? picked
                  ? `Picked: a ${picked.kind} line, becoming ${PAVES[picked.kind]}.`
                  : 'Nothing picked yet: click a gold road button.'
                : `${tiles.length} of ${BALANCE.station.scoutTiles} tiles picked.`}
            </p>
            {reason && <p className={styles.reason}>{reason}</p>}
          </div>
        ) : (
          station.special?.sold && (
            <div className={styles.special}>
              <span className={styles.specialName}>
                <Icon name={SPECIAL_LOOK[station.special.special].icon} size={18} />
                {SPECIAL_LOOK[station.special.special].name} · BOUGHT
              </span>
              <p>
                {station.special.special === 'cementMixer'
                  ? 'The paved line shows on the map.'
                  : 'The marked tiles show their challenges when the party arrives.'}
              </p>
            </div>
          )
        )}
        <div className={styles.buttons}>
          {picking && (
            <button
              type="button"
              className={styles.gold}
              disabled={!action || !!reason}
              onClick={() => {
                if (action && onBuy(action)) onClose();
              }}
            >
              {mode === 'cementMixer' ? 'PAVE IT' : 'SCOUT THEM'} · {price} CAPS
            </button>
          )}
          <button type="button" className={styles.ghost} onClick={onClose}>
            BACK TO THE STATION
          </button>
        </div>
      </aside>

      <aside className={styles.right}>
        <span className={styles.kicker}>WHAT’S AHEAD</span>
        <ul className={room.chips}>
          {aheadChips(state).map((c) => (
            <li key={c.key} className={room.chip} data-tone={c.tone} title={c.label}>
              {c.icon && <Icon name={c.icon} size={16} />}
              {c.text}
            </li>
          ))}
        </ul>
        <span className={styles.kicker}>LINES</span>
        <ul className={styles.legend}>
          <li>
            <b>Paved</b> the mover pays nothing extra
          </li>
          <li>
            <b>Normal</b> the usual cost
          </li>
          <li>
            <b>Steep</b> 1 extra Energy
          </li>
          <li>
            <b>Muddy</b> 1 extra Appetite
          </li>
          <li>
            <b>Rough</b> 1 extra Morale
          </li>
        </ul>
        <div className={styles.zoom}>
          <button
            type="button"
            className={styles.ghost}
            aria-label="Zoom in"
            onClick={() => zoom(ZOOM.step)}
          >
            <Icon name="plus" size={18} />
          </button>
          <button
            type="button"
            className={styles.ghost}
            aria-label="Zoom out"
            onClick={() => zoom(1 / ZOOM.step)}
          >
            <Icon name="minus" size={18} />
          </button>
        </div>
      </aside>
    </div>
  );
}
