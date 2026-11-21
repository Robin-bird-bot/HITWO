/**
 * The game screen (docs/mockups/Main.dc.html): the backdrop, the map and the
 * floating panels, laid out on the 1600×1000 stage.
 *
 * Moving: select a hiker, click a gold tile, check the cost preview, confirm.
 * Move All: pick who comes along, then a tile. Sleep: confirm under the grid.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import {
  hikersOnTile,
  hikersWhoHaventActed,
  atLastSection,
  isHikeOver,
  resourceCount,
  isAccomplished,
  isRevealed,
  isSheltered,
  statMax,
  STAT_NAMES,
  mapTargets,
  itemText,
  qualityOf,
  tilesAhead,
  validateAction,
  wonderTile,
  tendAmount,
  tendCost,
  type Action,
  type GameState,
  type Hiker,
  type HikerId,
  type EquipSlot,
  type TileId,
  type WeatherId,
} from '../../engine';
import { gameStore } from '../app/gameStore';
import { ITEMS } from '../../content';
import { useUiMode } from '../app/uiMode';
import { Backdrop } from '../backdrop/Backdrop';
import { TrailLog } from '../log/TrailLog';
import { MapControls } from '../map/MapControls';
import {
  clampCamera,
  CHECKPOINT_HEX,
  focusOn,
  HEX,
  lastRowOf,
  MAP_VIEW,
  mapBounds,
  scrollAbove,
  tileCenter,
  worldToStage,
  ZOOM,
  type Camera,
} from '../map/mapLayout';
import { MapView } from '../map/MapView';
import { SideRail } from '../map/SideRail';
import type { ActionId } from '../panels/hikerInfo';
import { PartyPanel } from '../panels/PartyPanel';
import { AbundanceCard, BiomeCard, DayBar, MenuButton, ObjectiveCard } from '../panels/TopBar';
import { setPanelCollapsed } from '../panels/panelState';
import { TurnPanel, type AbilityFocus, type StashPick } from '../panels/TurnPanel';
import { ChallengeResult } from '../challenge/ChallengeResult';
import { RevealedCard } from '../challenge/RevealedCard';
import { TrialChips } from '../challenge/TrialChips';
import { TrialDetails } from '../challenge/TrialWindow';
import { showsResult, type ResultToShow } from '../challenge/showsResult';
import { ChallengeWindow } from '../challenge/ChallengeWindow';
import { LevelUpWindow } from '../traits/LevelUpWindow';
import { OPEN_WONDER_EVENT, WonderWindow } from '../wonder/WonderWindow';
import { WeatherScreen } from '../weather/WeatherScreen';
import { HikeOverScreen } from '../hike/HikeOverScreen';
import { StationScreen } from '../station/StationScreen';
import { ScavengeWindow } from '../scavenge/ScavengeWindow';
import { TakeFly, type Fly } from '../scavenge/TakeFly';
import { tookLabel } from '../scavenge/tookWords';
import { CraftWindow, type CraftTab } from '../craft/CraftWindow';
import { TrailShopWindow } from '../trail/TrailShopWindow';
import { PreviewLayer } from '../preview/PreviewLayer';
import { DragLayer } from '../drag/DragLayer';
import type { DragPayload, DragState, DropTarget } from '../drag/drag';
import {
  canDragHiker,
  hikerDropTiles,
  mapDrop,
  portraitDrop,
  slotDrop,
  tileDrop,
} from '../drag/dropRules';
import { DropAsk, type DropAskProps } from '../drag/DropAsk';
import { ItemDropsContext, type ItemDrops } from '../drag/itemDrops';
import type { ScoutFx } from '../map/MapView';
import { usesAfter } from '../items/whatItDoes';
import { STAT_META, tileName } from '../panels/hikerInfo';
import { SimpleParty } from '../simple/SimpleParty';
import { BiomePill, CapsPill, DayPill, GoalPill } from '../simple/SimpleTop';
import { SimpleTurn } from '../simple/SimpleTurn';
import { Stage } from '../stage/Stage';
import { ConfirmDialog } from './ConfirmDialog';
import { MovePopover } from './MovePopover';
import { StashMenu } from './StashMenu';
import {
  bringChoices,
  bringOptions,
  movePreview,
  moveTargets,
  nextReadyHiker,
  popupAction,
  type MoveMode,
} from './movePlan';
import {
  GroupConfirm,
  GroupOwnTile,
  SleepConfirm,
  TacticalPick,
  TendConfirm,
  WatchConfirm,
} from './TurnExtras';
import {
  orderNumbers,
  startGroup,
  stepGroup,
  toggleInGroup,
  type GroupKind,
  type GroupRun,
  skipWords,
  groupMoveTargets,
} from './groupTurn';
import { NightEventWindow, type NightEventShown } from '../night/NightEventWindow';

const PHASE_WORD = { morning: 'morning', afternoon: 'afternoon', night: 'night' } as const;

/** How long scouting effects stay on the map. */
const FX_MS = 5500;

/** What the player is in the middle of doing. */
type Mode =
  | { kind: 'idle' }
  | { kind: 'moveAll'; bring: HikerId[] }
  | { kind: 'sleep' }
  | { kind: 'watch' }
  | { kind: 'tend' }
  /** A map tool waiting for its tile (a Scanner, a Paver…). */
  | { kind: 'tool'; itemUid: string };

/** What abandoning the hike means for this hiker: they go for good, with everything they carry. */
function abandonMessage(state: GameState, h: Hiker): string {
  const items = h.inventory.bag.length + Object.keys(h.inventory.equipped).length;
  const resources = resourceCount(h);
  const carried = [
    items ? `${items} item${items === 1 ? '' : 's'}` : '',
    resources ? `${resources} resource${resources === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const others = hikersOnTile(state, h.tileId).some((o) => o.id !== h.id);
  const take = carried.length
    ? ` They take everything they carry (${carried.join(' and ')}).${
        !others
          ? ''
          : h.status === 'passedOut'
            ? ' Others on their tile can take things first.'
            : ' They can give things to someone on their tile first.'
      }`
    : '';
  return `${h.name} leaves the party for good.${take} This can’t be undone.`;
}

/** What submitting to an injury does for this hiker: the injury, the stats it lifts, passing out. */
function injureMessage(h: Hiker): string {
  const { passOutAt, raiseStatsBelowTo: line } = BALANCE.injuries;
  const n = h.injuries + 1;
  const low = STAT_NAMES.filter((s) => h.stats[s] < line).map((s) => STAT_META[s].label);
  const lifts = low.length
    ? `${listNames(low)} rise${low.length === 1 ? 's' : ''} to ${line}.`
    : '';
  const out = n >= passOutAt ? ` It’s their ${ordinal(n)} injury: they pass out.` : '';
  return `${h.name} takes an injury (${n} of ${passOutAt}). ${lifts}${out} This can’t be undone.`;
}

const ordinal = (n: number) =>
  n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : `${n}th`;

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function GameScreen({
  state,
  onQuit,
  onNewHike,
}: {
  state: GameState;
  onQuit(): void;
  /** Starts a new hike straight away (from the hike over screen). */
  onNewHike?(): void;
}) {
  const { section, hikers } = state;
  const uiMode = useUiMode();
  const simple = uiMode === 'simple';
  // Simple mode starts with the trail log shrunk.
  useEffect(() => {
    if (simple) setPanelCollapsed('log', true);
  }, [simple]);
  const bounds = useMemo(() => mapBounds(section), [section]);
  // Start on the first hiker who still has their action (useful after Continue).
  const [selectedId, setSelectedId] = useState<HikerId | null>(
    () =>
      (
        hikers.find((h) => h.status === 'active' && !h.acted) ??
        hikers.find((h) => h.status === 'active')
      )?.id ?? null,
  );
  const selected = hikers.find((h) => h.id === selectedId) ?? hikers[0];
  const [note, setNote] = useState<string | undefined>();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [pendingTile, setPendingTile] = useState<TileId | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  // A hiker the player asked to abandon the hike, waiting on the confirm.
  const [confirmAbandon, setConfirmAbandon] = useState<HikerId | null>(null);
  /** Submit to injury (Wyatt, Nov 14), waiting for a yes. */
  const [confirmInjure, setConfirmInjure] = useState<HikerId | null>(null);
  // The card just taken, shown for a moment before the scavenge window closes.
  /** Kept scavenge cards on their way into a pack (Nov 14 update). */
  const [flies, setFlies] = useState<Fly[]>([]);
  // A map tool's tile, waiting for the player to say yes.
  const [toolTile, setToolTile] = useState<TileId | null>(null);
  // Scouting just done: the map plays its sweep and numbers for a few seconds.
  const [fx, setFx] = useState<ScoutFx[]>([]);
  useEffect(() => {
    if (!fx.length) return;
    const t = setTimeout(() => setFx([]), FX_MS);
    return () => clearTimeout(t);
  }, [fx]);
  // The Craft window: whose, and on which tab.
  const [craftOpen, setCraftOpen] = useState<{ hikerId: string; tab: CraftTab } | null>(null);
  /** The tile whose Merchant or Traveling Trader is open. */
  const [shopTile, setShopTile] = useState<TileId | null>(null);
  /** A drag in progress (Nov 14 update): a hiker being dragged to a tile. */
  const [drag, setDrag] = useState<DragState | null>(null);
  /** A drop that asks first (eat, feed, place, use a map tool), where it was dropped. */
  const [ask, setAsk] = useState<Omit<DropAskProps, 'onCancel'> | null>(null);
  // ── Multi-select (Nov 14 update) ──
  /** Hikers picked for one action each, in turn order (two or more, or none). */
  const [group, setGroup] = useState<HikerId[]>([]);
  /** The Select toggle (for touch): taps pick hikers for the group. */
  const [picking, setPicking] = useState(false);
  /** The group's action, waiting for Go (and, for a move, a tile). */
  const [groupAsk, setGroupAsk] = useState<{ kind: GroupKind; tileId?: TileId } | null>(null);
  /** A group action going through its hikers one by one. */
  const [run, setRun] = useState<GroupRun | null>(null);
  /** Who the group's action skipped, and why: stays up until the next pick. */
  const [skipNote, setSkipNote] = useState<string | undefined>();
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  // The resource or item whose give / return menu is open.
  const [stash, setStash] = useState<StashPick | null>(null);
  // After a Risk roll, a Challenge space or an opportunity: what happened.
  const [result, setResult] = useState<ResultToShow | null>(null);
  // A Trial in progress whose details are open (from its chip).
  const [trialOpen, setTrialOpen] = useState<string | null>(null);
  // Trial tiles on the map: orange where it was revealed, red for Rocco's tile.
  // A card revealed early whose small pop-up is open (from its tile's icon).
  const [revealedOpen, setRevealedOpen] = useState<TileId | null>(null);
  // The Wonder pop-up: opened when a Wonder is found or a hiker arrives at it,
  // and from its map icon.
  const [wonderOpen, setWonderOpen] = useWonderOpener(state);
  // The weather change screen, when the weather changes (including back to Clear).
  const [weatherShown, setWeatherShown] = useWeatherChange(state);
  // The night event window, when something hit the party at camp.
  const [nightShown, setNightShown] = useNightEvent(state);
  // Predator Bait: tiles that just got easier, shown in blue until a few seconds
  // after the pop-up closes (Wyatt, Nov 6).
  const easier = useEasierTiles(state, !!state.challenge || !!result);
  const marks: Partial<Record<string, 'trial' | 'target' | 'easier'>> = Object.fromEntries(
    (state.trials ?? []).flatMap((t) => [
      [t.tileId, 'trial' as const],
      ...(t.targetTile ? [[t.targetTile, 'target' as const] as const] : []),
    ]),
  );
  for (const id of easier) marks[id] = 'easier';

  const lastRow = lastRowOf(section);
  const centerOf = (tileId: string | undefined) => {
    const tile = tileId ? section.tiles[tileId] : undefined;
    return tile ? tileCenter(tile, lastRow) : { x: 0, y: 0 };
  };
  const [rawCamera, setCamera] = useState<Camera>(() =>
    focusOn(centerOf(selected?.tileId), ZOOM.default, bounds),
  );
  // A new section (after a station): start on the party at its Trailhead.
  const [cameraSection, setCameraSection] = useState(state.sectionIndex);
  if (state.sectionIndex !== cameraSection) {
    setCameraSection(state.sectionIndex);
    setCamera(focusOn(centerOf(selected?.tileId ?? section.trailheadId), ZOOM.default, bounds));
  }
  // Keep the camera inside the map even if the map changes under it.
  const camera = clampCamera(rawCamera, bounds);
  // When the pop-up closes, bring a tile that just got easier into view if none is.
  const easierKey = easier.join(',');
  const [pannedFor, setPannedFor] = useState('');
  if (!state.challenge && !result && easierKey && easierKey !== pannedFor) {
    setPannedFor(easierKey);
    const inView = (id: TileId) => {
      const p = worldToStage(camera, centerOf(id));
      return (
        p.x > MAP_VIEW.x + HEX.w / 2 &&
        p.x < MAP_VIEW.x + MAP_VIEW.w - HEX.w / 2 &&
        p.y > 120 &&
        p.y < MAP_VIEW.h - 120
      );
    };
    const first = easier[0];
    if (first && !easier.some(inView)) setCamera(focusOn(centerOf(first), camera.zoom, bounds));
  }

  const reset = () => {
    setMode({ kind: 'idle' });
    setPendingTile(null);
    setToolTile(null);
    setStash(null);
  };

  /** A portrait or token clicked: select them, or (with `add`) put them in or out of the group. */
  // A usable trait's badge was tapped: pick that hiker and open the Abilities panel at it.
  const [abilityFocus, setAbilityFocus] = useState<AbilityFocus | null>(null);
  const useTrait = (id: HikerId, abilityId: string) => {
    pickHiker(id);
    setPanelCollapsed('turn', false);
    setAbilityFocus((f) => ({ hikerId: id, abilityId, at: (f?.at ?? 0) + 1 }));
  };
  const focusAbility =
    abilityFocus && abilityFocus.hikerId === selected?.id ? abilityFocus : undefined;

  const pickHiker = (id: HikerId, add = false) => {
    setSkipNote(undefined);
    if (!add) {
      if (group.length) setGroup([]);
      setGroupAsk(null);
      select(id);
      return;
    }
    const next = toggleInGroup(group, selected?.id ?? null, id);
    setGroup(next);
    setGroupAsk(null);
    setPendingTile(null);
    if (next.length && selected && !next.includes(selected.id)) setSelectedId(next[0] ?? id);
    setNote(
      next.length > 1
        ? 'Pick an action: each of them does it on their own, in this order.'
        : undefined,
    );
  };
  const clearGroup = () => {
    setGroup([]);
    setPicking(false);
    setGroupAsk(null);
  };

  const select = (id: HikerId) => {
    setSelectedId(id);
    setNote(undefined);
    reset();
  };

  /** Applies an action; after a hiker uses their phase, the next ready hiker is selected. */
  const dispatch = (action: Action): boolean => {
    // The scavenger, for a take (the selection can differ after a reload mid-draw).
    const actorId =
      action.type === 'scavengeTake'
        ? state.scavenge?.hikerId
        : 'hikerId' in action
          ? action.hikerId
          : selected?.id;
    const before = state.nextEventId;
    const result = gameStore.dispatch(action);
    if (!result.ok) {
      setNote(result.reason);
      return false;
    }
    setNote(undefined);
    reset();
    // Scouting tools: sweep the tiles they looked at, or float their counts.
    const after = gameStore.getState();
    const scouted = (after?.log ?? []).filter((e) => e.id >= before && e.kind === 'scouted');
    if (scouted.length) {
      setFx(
        scouted.flatMap((e) => {
          if (e.kind !== 'scouted') return [];
          const tile = after?.hikers.find((h) => h.id === e.hikerId)?.tileId;
          return [
            e.counts
              ? {
                  key: e.id,
                  sweep: [],
                  counts: { ...e.counts, at: e.row !== undefined ? e.tileIds : tile ? [tile] : [] },
                }
              : { key: e.id, sweep: e.tileIds },
          ];
        }),
      );
    }
    const usedPhase =
      action.type === 'move' ||
      action.type === 'moveAll' ||
      action.type === 'sleep' ||
      action.type === 'keepWatch' ||
      action.type === 'tend' ||
      action.type === 'craft' ||
      action.type === 'scavengeTake';
    // A free move (Jogging Shoes, Motivated…) leaves the hiker their action: stay on them.
    const actedNow = gameStore.getState()?.hikers.find((h) => h.id === actorId)?.acted;
    if (usedPhase && actorId && actedNow) {
      const next = nextReadyHiker(gameStore.getState() ?? state, actorId);
      if (next) setSelectedId(next.id);
      else setNote('Everyone has acted. End the phase when you’re ready.');
    }
    if (action.type === 'abandon' || action.type === 'endPhase') {
      const after = gameStore.getState();
      const first = after?.hikers.find((h) => h.status === 'active');
      if (first) setSelectedId(first.id);
    }
    return true;
  };

  /** Finishes a challenge; a random outcome then shows what happened. */
  const resolveChallenge = (action: Extract<Action, { type: 'resolveChallenge' }>) => {
    const open = state.challenge;
    if (!dispatch(action) || !open) return false;
    const event = gameStore.getState()?.log.findLast((e) => e.kind === 'challenge');
    if (event?.kind === 'challenge' && showsResult(state, event, open.special === 'challenge')) {
      setResult({ cardId: open.cardId, fromId: event.id });
    }
    return true;
  };

  /**
   * Takes a scavenge card. No result window (Nov 14 update): the card slides
   * from where it lay into the hiker's pack, and a small label floats up there.
   */
  const takeCard = (action: Extract<Action, { type: 'scavengeTake' }>) => {
    const open = state.scavenge;
    const card = open?.cards[action.card];
    // Where the card lies now, before the window closes.
    const at = document.querySelector(`[data-scav-card="${action.card}"]`)?.getBoundingClientRect();
    if (!dispatch(action) || !card || !open) return;
    const event = gameStore.getState()?.log.findLast((e) => e.kind === 'scavenge');
    if (event?.kind !== 'scavenge') return;
    setFlies((f) => [
      ...f,
      {
        key: event.id,
        hikerId: open.hikerId,
        // A Wild or Choice card shows what it turned out to be.
        card: { ...card, resources: event.resources },
        label: tookLabel(event),
        from: at ? { x: at.x, y: at.y, width: at.width, height: at.height } : null,
        into: event.items?.length ? 'bag' : 'resources',
      },
    ]);
  };

  /**
   * One step of a running group action (multi-select): the next hiker acts,
   * or picks their own tile, or the group is done. It waits while a window is
   * open (a challenge, a scavenge), so each hiker goes on their own.
   */
  const advanceRun = () => {
    const r = runRef.current;
    const s = gameStore.getState();
    if (!r || !s) return;
    const nameOfHiker = (id: HikerId) => s.hikers.find((h) => h.id === id)?.name ?? id;
    if (r.own) {
      // Waiting for this hiker to pick their own tile (or Skip).
      const h = s.hikers.find((x) => x.id === r.own);
      if (h && h.status === 'active' && !h.acted) return;
      setRun({ ...r, own: undefined });
      return;
    }
    const step = stepGroup(s, r);
    if (step.kind === 'wait') return;
    const skipped = skipWords(step.skipped, nameOfHiker);
    if (skipped) setSkipNote((n) => (n ? `${n} ${skipped}` : skipped));
    if (step.kind === 'act') {
      setRun(step.run);
      const who = 'hikerId' in step.action ? step.action.hikerId : undefined;
      if (who) setSelectedId(who);
      dispatch(step.action);
    } else if (step.kind === 'own') {
      setRun(step.run);
      if (step.run.own) select(step.run.own);
    } else {
      setRun(null);
    }
  };
  const advanceRunRef = useRef(advanceRun);
  useEffect(() => {
    advanceRunRef.current = advanceRun;
  });
  // The group's next hiker goes a moment after the last, once nothing is open.
  const groupBusy =
    !!result || !!nightShown || !!weatherShown || !!pendingTile || !!ask || !!stash || !!wonderOpen;
  useEffect(() => {
    if (!run || groupBusy) return;
    const t = window.setTimeout(() => advanceRunRef.current(), BALANCE.ui.groupStepMs);
    return () => window.clearTimeout(t);
  }, [run, state, groupBusy]);
  // Esc, with nothing else open, lets go of the group.
  useEffect(() => {
    if (!group.length && !picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || pendingTile || groupAsk) return;
      setGroup([]);
      setPicking(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [group.length, picking, pendingTile, groupAsk]);

  const moveMode: MoveMode =
    mode.kind === 'moveAll' ? { kind: 'moveAll', bring: mode.bring } : { kind: 'move' };
  useEffect(() => {
    if (mode.kind !== 'tool') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || toolTile) return;
      setMode({ kind: 'idle' });
      setNote(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode.kind, toolTile]);

  // A map tool picks from its own tiles; otherwise the rings show where a move can go.
  const toolItem =
    mode.kind === 'tool' ? selected?.inventory.bag.find((i) => i.uid === mode.itemUid) : undefined;
  const toolMap = toolItem ? ITEMS[toolItem.itemId]?.use?.map : undefined;
  const toolAction = (tileId: TileId): Action | null =>
    selected && toolItem
      ? {
          type: 'useItem',
          hikerId: selected.id,
          itemUid: toolItem.uid,
          targetId: selected.id,
          choice: tileId,
        }
      : null;
  // Tactical: a hiker picks a tile ahead to see, before anything else (Phase 10a).
  const tacticalId = state.tacticalPicks?.[0];
  const tactical = tacticalId ? hikers.find((h) => h.id === tacticalId) : undefined;
  const targets = tactical
    ? tilesAhead(state).map((tileId) => ({ tileId, reason: null }))
    : selected && toolMap
      ? mapTargets(state, selected, toolMap).map((tileId) => {
          const a = toolAction(tileId);
          return { tileId, reason: a ? validateAction(state, a) : 'Nothing to use.' };
        })
      : group.length > 1 && groupAsk?.kind === 'move'
        ? groupMoveTargets(state, group)
        : selected && selected.status === 'active' && mode.kind !== 'sleep' && mode.kind !== 'watch'
          ? moveTargets(state, selected, moveMode)
          : [];
  // Dragging a hiker: the tiles they can be dropped on.
  const draggedId = drag?.payload.kind === 'hiker' ? drag.payload.hikerId : null;
  // A grouped hiker carries the group: anywhere one of them can go.
  const groupDrag = !!draggedId && group.length > 1 && group.includes(draggedId);
  const dropTiles = useMemo(
    () =>
      !draggedId
        ? null
        : groupDrag
          ? new Set(
              groupMoveTargets(state, group)
                .filter((t) => t.reason === null)
                .map((t) => t.tileId),
            )
          : hikerDropTiles(state, draggedId),
    [state, draggedId, groupDrag, group],
  );
  const onDragChange = (d: DragState | null) => {
    setDrag(d);
    // Picking up a hiker selects them, so their rings and costs show.
    if (d?.payload.kind === 'hiker' && d.payload.hikerId !== selectedId) {
      select(d.payload.hikerId);
    } else if (d) setPendingTile(null);
  };
  // ── Dragging pack things (Nov 14 update) ──
  const packItem = (p: DragPayload) =>
    p.kind === 'item'
      ? hikers.find((h) => h.id === p.hikerId)?.inventory.bag.find((i) => i.uid === p.itemUid)
      : undefined;
  const describe = (p: DragPayload) => {
    const item = packItem(p);
    const def = item ? ITEMS[item.itemId] : undefined;
    return {
      name: def?.name ?? 'item',
      text: item && def ? itemText(def, qualityOf(item), item.node) : undefined,
    };
  };
  const nameOf = (id: HikerId) => hikers.find((h) => h.id === id)?.name ?? 'them';
  /** An option that closes the question and does its actions in turn (stopping if one fails). */
  const choose = (label: string, actions: Action[]) => ({
    label,
    onChoose: () => {
      setAsk(null);
      for (const a of actions) if (!dispatch(a)) break;
    },
  });
  const portraitTarget: DropTarget = {
    accepts: (p, id) => !!id && !!portraitDrop(state, p, id),
    onDrop: (p, id, at) => {
      const d = id ? portraitDrop(state, p, id) : null;
      if (!d || !id) return;
      const { name, text } = describe(p);
      if (d.kind === 'give') dispatch(d.action);
      else if (d.kind === 'eat') {
        setAsk({ at, title: `Eat the ${name}?`, text, options: [choose('Eat', [d.action])] });
      } else {
        const to = nameOf(id);
        setAsk({
          at,
          title: `The ${name}, for ${to}`,
          text: d.eat ? `Give it to ${to}, or ${to} eats it now.` : `Give it to ${to}.`,
          options: [
            choose('Give', [d.give]),
            ...(d.eat ? [choose(`${to} eats it`, [d.give, d.eat])] : []),
          ],
        });
      }
    },
  };
  const slotTarget: DropTarget = {
    accepts: (p, slot) => !!slot && !!slotDrop(state, p, slot as EquipSlot),
    onDrop: (p, slot) => {
      const a = slot ? slotDrop(state, p, slot as EquipSlot) : null;
      if (a) dispatch(a);
    },
  };
  const itemDrag = {
    tile: {
      accepts: (p, tileId) => !!tileId && !!tileDrop(state, p, tileId),
      onDrop: (p, tileId, at) => {
        const d = tileId ? tileDrop(state, p, tileId) : null;
        const item = packItem(p);
        if (!d || !tileId || !item) return;
        const { name, text } = describe(p);
        const where = section.tiles[tileId] ? tileName(section.tiles[tileId]) : 'that tile';
        setAsk(
          d.kind === 'place'
            ? {
                at,
                title: `Place the ${name} here?`,
                text,
                options: [choose('Place it', [d.action])],
              }
            : {
                at,
                title: `Use the ${name}?`,
                text: `On ${where}. ${usesAfter(item, name)}`,
                options: [choose('Use it', [d.action])],
              },
        );
      },
    } satisfies DropTarget,
    // A tool with no tile to pick: its menu opens on its Use step.
    // TODO(wyatt): first guess (rather than using it at once).
    map: {
      accepts: (p) => mapDrop(state, p),
      onDrop: (p, _arg, at) => {
        if (p.kind === 'item') setStash({ kind: 'item', uid: p.itemUid, top: at.y });
      },
    } satisfies DropTarget,
  };
  const itemDrops: ItemDrops = {
    packs: !state.challenge && !state.scavenge && !state.station && mode.kind !== 'tool',
    slot: slotTarget,
    portrait: portraitTarget,
  };

  const hikerDrag = {
    canDrag: (h: Hiker) =>
      !state.challenge && !state.scavenge && mode.kind !== 'tool' && canDragHiker(h),
    accepts: (hikerId: HikerId, tileId: TileId) =>
      hikerId === draggedId && !!dropTiles?.has(tileId),
    onDrop: (hikerId: HikerId, tileId: TileId) => {
      // A grouped hiker dragged to a tile: the whole group goes there, in turn.
      if (group.length > 1 && group.includes(hikerId)) {
        setGroupAsk({ kind: 'move', tileId });
        return;
      }
      setSelectedId(hikerId);
      setMode({ kind: 'idle' });
      setPendingTile(tileId);
    },
    costOn: (hikerId: HikerId, tileId: TileId) => {
      if (groupDrag) return `${group.length} hikers · each pays their own way`;
      const h = hikers.find((x) => x.id === hikerId);
      const row = h ? movePreview(state, h, { kind: 'move' }, tileId)?.rows[0] : undefined;
      const parts = (row?.changes ?? []).map((c) => `−${c.from - c.to} ${STAT_META[c.stat].label}`);
      return parts.length ? parts.join(' · ') : 'No cost';
    },
  };

  const onAction = (id: ActionId) => {
    setPendingTile(null);
    setSkipNote(undefined);
    if (!selected) return;
    // A group: one action, each hiker in turn (Move All and Craft stay one hiker's).
    if (
      group.length > 1 &&
      (id === 'move' || id === 'scavenge' || id === 'tend' || id === 'sleep' || id === 'watch')
    ) {
      setMode({ kind: 'idle' });
      setGroupAsk({ kind: id });
      setNote(undefined);
      return;
    }
    if (id === 'move') {
      setMode({ kind: 'idle' });
      setNote('Click a tile with a gold ring to move there.');
    } else if (id === 'moveAll') {
      const ready = bringOptions(state, selected).filter((o) => o.reason === null);
      setMode({ kind: 'moveAll', bring: ready.map((o) => o.hiker.id) });
      setNote('Click a tile with a gold ring, then check who comes along.');
    } else if (id === 'sleep') {
      setMode({ kind: 'sleep' });
      setNote(undefined);
    } else if (id === 'watch') {
      setMode({ kind: 'watch' });
      setNote(undefined);
    } else if (id === 'tend') {
      setMode({ kind: 'tend' });
      setNote(undefined);
    } else if (id === 'scavenge') {
      setMode({ kind: 'idle' });
      dispatch({ type: 'scavenge', hikerId: selected.id });
    } else if (id === 'craft') {
      setMode({ kind: 'idle' });
      setCraftOpen({ hikerId: selected.id, tab: 'craft' });
    }
  };
  const openBlueprints = () => selected && setCraftOpen({ hikerId: selected.id, tab: 'teach' });
  // A basic craft waiting for its pick keeps the window open on its crafter.
  const crafter = state.crafting?.hikerId ?? craftOpen?.hikerId;

  const onAbility = (abilityId: string, choice?: string) =>
    selected &&
    dispatch({
      type: 'useAbility',
      hikerId: selected.id,
      abilityId,
      ...(choice ? { choice } : {}),
    });

  const waiting = hikersWhoHaventActed(state);
  const abandoning = confirmAbandon ? hikers.find((h) => h.id === confirmAbandon) : undefined;
  const injuring = confirmInjure ? hikers.find((h) => h.id === confirmInjure) : undefined;
  const endPhase = () => (waiting.length ? setConfirmEnd(true) : dispatch({ type: 'endPhase' }));
  const phaseWord = PHASE_WORD[state.phase];

  // Who a group action skipped stays up beside any newer message.
  const turnNote = [skipNote, note].filter(Boolean).join(' ') || undefined;

  // The box under the action grid, when Move All or Sleep is in progress.
  let slot = null;
  const nameOfId = (id: HikerId) => hikers.find((h) => h.id === id)?.name ?? id;
  if (tactical) {
    slot = (
      <TacticalPick
        name={tactical.name}
        onSkip={() => dispatch({ type: 'tactical', hikerId: tactical.id })}
      />
    );
  } else if (groupAsk && group.length > 1) {
    const tile = groupAsk.tileId ? section.tiles[groupAsk.tileId] : undefined;
    slot = (
      <GroupConfirm
        kind={groupAsk.kind}
        names={group.map(nameOfId)}
        {...(tile ? { where: tileName(tile) } : {})}
        onCancel={() => setGroupAsk(null)}
        onGo={() => {
          const started = startGroup(state, group, groupAsk.kind, groupAsk.tileId);
          clearGroup();
          setRun(started.run);
          setNote(undefined);
          setSkipNote(skipWords(started.skipped, nameOfId) || undefined);
        }}
      />
    );
  } else if (run?.own) {
    const own = run.own;
    slot = (
      <GroupOwnTile
        name={nameOfId(own)}
        onSkip={() => {
          setRun({ ...run, own: undefined });
          setNote(undefined);
        }}
      />
    );
  }
  if (slot) {
    // The group's box takes the slot.
  } else if (selected && mode.kind === 'sleep') {
    const gain = isSheltered(state, selected)
      ? BALANCE.sleep.shelteredEnergy
      : BALANCE.sleep.energy;
    const from = selected.stats.energy;
    slot = (
      <SleepConfirm
        name={selected.name}
        gain={gain}
        from={from}
        to={Math.min(statMax(state, selected, 'energy'), from + gain)}
        onCancel={reset}
        onConfirm={() => dispatch({ type: 'sleep', hikerId: selected.id })}
      />
    );
  }

  if (selected && mode.kind === 'watch') {
    slot = (
      <WatchConfirm
        name={selected.name}
        others={hikersOnTile(state, selected.tileId)
          .filter((h) => h.id !== selected.id)
          .map((h) => h.name)}
        noSleep={BALANCE.night.noSleepEnergy}
        onCancel={reset}
        onConfirm={() => dispatch({ type: 'keepWatch', hikerId: selected.id })}
      />
    );
  }

  if (selected && mode.kind === 'tend') {
    const from = state.abundance;
    slot = (
      <TendConfirm
        name={selected.name}
        from={from}
        to={Math.min(BALANCE.abundance.max, from + tendAmount(state, selected))}
        appetite={tendCost(state, selected)}
        onCancel={reset}
        onConfirm={() => dispatch({ type: 'tend', hikerId: selected.id })}
      />
    );
  }

  // Where the move preview points: the top and bottom of the chosen tile.
  const pending = pendingTile ? section.tiles[pendingTile] : undefined;
  const pendingCenter = pending ? tileCenter(pending, lastRow) : null;
  const halfH = (pending?.kind === 'checkpoint' ? CHECKPOINT_HEX.h : HEX.h) / 2;

  return (
    <Stage>
      <PreviewLayer>
        <DragLayer onDragChange={onDragChange}>
          <ItemDropsContext.Provider value={itemDrops}>
            <Backdrop
              phase={state.phase}
              biome={section.biome}
              scrollY={scrollAbove(camera, bounds)}
            />
            <MapView
              section={section}
              hikers={hikers}
              targets={targets}
              checkpoint={{ number: state.sectionIndex + 1, summit: atLastSection(state) }}
              reachLabel={
                tactical
                  ? 'See this tile'
                  : toolMap && toolItem
                    ? `Use the ${ITEMS[toolItem.itemId]?.name ?? 'tool'} here`
                    : undefined
              }
              onTileClick={(tileId) =>
                tactical
                  ? dispatch({ type: 'tactical', hikerId: tactical.id, tileId })
                  : toolMap
                    ? setToolTile(tileId)
                    : group.length > 1 && groupAsk?.kind === 'move'
                      ? setGroupAsk({ kind: 'move', tileId })
                      : setPendingTile(tileId)
              }
              onEmptyClick={() => group.length && clearGroup()}
              order={orderNumbers(group)}
              fx={fx}
              checkpointLabelOnHover={simple}
              marks={marks}
              onRevealedClick={setRevealedOpen}
              onWonderClick={setWonderOpen}
              selectedId={selected?.id ?? null}
              onSelectHiker={pickHiker}
              camera={camera}
              setCamera={setCamera}
              bounds={bounds}
              hikerDrag={hikerDrag}
              itemDrag={itemDrag}
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

            {simple ? (
              <>
                <BiomePill state={state} />
                <DayPill state={state} />
                <GoalPill />
                <CapsPill state={state} />
                <MenuButton onTitle={onQuit} />
                <SimpleParty
                  state={state}
                  selectedId={selected?.id ?? null}
                  onSelect={pickHiker}
                  order={orderNumbers(group)}
                  picking={picking}
                  onPicking={(on) => {
                    setPicking(on);
                    if (!on && group.length < 2) clearGroup();
                  }}
                  onAbandon={setConfirmAbandon}
                  onInjure={setConfirmInjure}
                  onUseTrait={useTrait}
                />
                {selected && (
                  <SimpleTurn
                    focusAbility={focusAbility}
                    state={state}
                    hiker={selected}
                    note={turnNote}
                    slot={slot}
                    activeAction={
                      mode.kind === 'moveAll' ||
                      mode.kind === 'sleep' ||
                      mode.kind === 'watch' ||
                      mode.kind === 'tend'
                        ? mode.kind
                        : null
                    }
                    onAction={onAction}
                    onAbility={onAbility}
                    onEndPhase={endPhase}
                    onPick={setStash}
                    onFree={dispatch}
                    onAbandon={setConfirmAbandon}
                    onBlueprints={openBlueprints}
                    onFeature={() => setShopTile(selected.tileId)}
                    group={group}
                  />
                )}
              </>
            ) : (
              <>
                <BiomeCard state={state} />
                <DayBar state={state} />
                <ObjectiveCard />
                <AbundanceCard state={state} />
                <MenuButton onTitle={onQuit} />
                <PartyPanel
                  state={state}
                  selectedId={selected?.id ?? null}
                  onSelect={pickHiker}
                  order={orderNumbers(group)}
                  picking={picking}
                  onPicking={(on) => {
                    setPicking(on);
                    if (!on && group.length < 2) clearGroup();
                  }}
                  onAbandon={setConfirmAbandon}
                  onInjure={setConfirmInjure}
                  onUseTrait={useTrait}
                />
                {selected && (
                  <TurnPanel
                    focusAbility={focusAbility}
                    state={state}
                    hiker={selected}
                    note={turnNote}
                    slot={slot}
                    onAction={onAction}
                    onAbility={onAbility}
                    onEndPhase={endPhase}
                    onPick={setStash}
                    onFree={dispatch}
                    onAbandon={setConfirmAbandon}
                    onBlueprints={openBlueprints}
                    onFeature={() => setShopTile(selected.tileId)}
                    group={group}
                  />
                )}
              </>
            )}
            <TrailLog state={state} />

            {selected && pendingTile && pendingCenter && (
              <MovePopover
                key={`${selected.id}-${pendingTile}-${mode.kind}`}
                hiker={selected}
                choices={bringChoices(state, selected, pendingTile)}
                startWithAll={mode.kind === 'moveAll'}
                previewFor={(bring) =>
                  movePreview(
                    state,
                    selected,
                    bring ? { kind: 'moveAll', bring } : { kind: 'move' },
                    pendingTile,
                  )
                }
                above={worldToStage(camera, { x: pendingCenter.x, y: pendingCenter.y - halfH })}
                below={worldToStage(camera, { x: pendingCenter.x, y: pendingCenter.y + halfH })}
                onCancel={() => setPendingTile(null)}
                onGo={(bring) => dispatch(popupAction(selected, pendingTile, bring))}
              />
            )}

            {stash && selected && (
              <StashMenu
                state={state}
                hiker={selected}
                pick={stash}
                onDispatch={dispatch}
                onClose={() => setStash(null)}
                onMapTool={(itemUid) => {
                  const name =
                    ITEMS[selected.inventory.bag.find((i) => i.uid === itemUid)?.itemId ?? '']
                      ?.name;
                  setStash(null);
                  setPendingTile(null);
                  setMode({ kind: 'tool', itemUid });
                  setNote(
                    `Click a tile with a gold ring to use the ${name ?? 'tool'}. Esc to stop.`,
                  );
                }}
              />
            )}

            {flies.map((f) => (
              <TakeFly
                key={f.key}
                fly={f}
                onDone={() => setFlies((all) => all.filter((x) => x.key !== f.key))}
              />
            ))}
            {state.scavenge && (
              <ScavengeWindow
                state={state}
                simple={simple}
                onFlip={(cards) => dispatch({ type: 'scavengeFlip', cards })}
                onCancel={() => dispatch({ type: 'scavengeCancel' })}
                onReroll={(card) => dispatch({ type: 'scavengeReroll', card })}
                onTake={takeCard}
              />
            )}

            {/* At a station, its Workbench crafts instead. */}
            {crafter && !state.challenge && !state.station && (
              <CraftWindow
                key={crafter}
                state={state}
                hikerId={crafter}
                tab={craftOpen?.tab ?? 'craft'}
                simple={simple}
                onTab={(tab) => setCraftOpen({ hikerId: crafter, tab })}
                onDispatch={dispatch}
                onClose={() => setCraftOpen(null)}
              />
            )}

            {shopTile && !state.challenge && !state.scavenge && !result && !state.station && (
              <TrailShopWindow
                state={state}
                tileId={shopTile}
                onDispatch={dispatch}
                onClose={() => setShopTile(null)}
              />
            )}

            {state.challenge && (
              <ChallengeWindow
                state={state}
                simple={simple}
                onResolve={resolveChallenge}
                onChoose={(cardId) => dispatch({ type: 'chooseChallenge', cardId })}
                onAccept={() => dispatch({ type: 'acceptTrial' })}
                onPress={(action) => dispatch(action)}
              />
            )}
            <TrialChips
              state={state}
              style={simple ? { left: 768, top: 112, translate: '-50% 0' } : { left: 470, top: 84 }}
              onOpen={setTrialOpen}
            />
            {trialOpen && !state.challenge && (
              <TrialDetails state={state} uid={trialOpen} onClose={() => setTrialOpen(null)} />
            )}
            {result && (
              <ChallengeResult state={state} result={result} onClose={() => setResult(null)} />
            )}
            {revealedOpen && !state.challenge && (
              <RevealedCard
                state={state}
                tileId={revealedOpen}
                onClose={() => setRevealedOpen(null)}
              />
            )}
            {nightShown && (
              <NightEventWindow
                key={nightShown.id}
                state={state}
                event={nightShown}
                onClose={() => setNightShown(null)}
              />
            )}
            {weatherShown && (
              <WeatherScreen
                weather={weatherShown.weather}
                days={weatherShown.days}
                onReady={() => setWeatherShown(null)}
              />
            )}
            {/* A level-up (or an Old Photo) waits for the night and the weather to be read. */}
            {state.traitPick && !nightShown && !weatherShown && (
              <LevelUpWindow
                // A new pick (the next level-up) starts fresh.
                key={`${state.traitPick.hikerId}-${state.traitPick.source}-${state.traitPick.level ?? state.traitPick.slot}`}
                state={state}
                onPick={(option, replaceSlot) =>
                  dispatch({
                    type: 'pickTrait',
                    option,
                    ...(replaceSlot !== undefined ? { replaceSlot } : {}),
                  })
                }
              />
            )}
            {wonderOpen && !state.challenge && !state.scavenge && !result && (
              <WonderWindow
                state={state}
                tileId={wonderOpen}
                onClose={() => setWonderOpen(null)}
                onAccomplish={(action) => dispatch(action)}
              />
            )}

            {state.station && !isHikeOver(state) && (
              <StationScreen state={state} simple={simple} onDispatch={dispatch} />
            )}

            {isHikeOver(state) && (
              <HikeOverScreen
                state={state}
                onTitle={onQuit}
                {...(onNewHike ? { onNewHike } : {})}
              />
            )}

            {toolTile && toolItem && (
              <ConfirmDialog
                title={`Use the ${ITEMS[toolItem.itemId]?.name ?? 'tool'}?`}
                message={`On ${
                  section.tiles[toolTile] ? tileName(section.tiles[toolTile]) : 'that tile'
                }. ${usesAfter(toolItem, ITEMS[toolItem.itemId]?.name ?? 'tool')}`}
                confirmLabel="Yes, use it"
                cancelLabel="Not now"
                onCancel={() => setToolTile(null)}
                onConfirm={() => {
                  const a = toolAction(toolTile);
                  setToolTile(null);
                  if (a) dispatch(a);
                }}
              />
            )}
            {injuring && (
              <ConfirmDialog
                title={`Submit ${injuring.name} to an injury?`}
                message={injureMessage(injuring)}
                confirmLabel="Take the injury"
                cancelLabel="Not now"
                focusCancel
                onCancel={() => setConfirmInjure(null)}
                onConfirm={() => {
                  setConfirmInjure(null);
                  dispatch({ type: 'submitToInjury', hikerId: injuring.id });
                }}
              />
            )}
            {abandoning && (
              <ConfirmDialog
                title={`Abandon the hike for ${abandoning.name}?`}
                message={abandonMessage(state, abandoning)}
                confirmLabel="Abandon"
                cancelLabel={`Keep ${abandoning.name}`}
                focusCancel
                onCancel={() => setConfirmAbandon(null)}
                onConfirm={() => {
                  setConfirmAbandon(null);
                  dispatch({ type: 'abandon', hikerId: abandoning.id });
                }}
              />
            )}

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
            {ask && <DropAsk {...ask} onCancel={() => setAsk(null)} />}
          </ItemDropsContext.Provider>
        </DragLayer>
      </PreviewLayer>
    </Stage>
  );
}

/** The newest weather change not yet seen (not one from before a reload). */
function useWeatherChange(state: GameState) {
  const [shown, setShown] = useState<{ weather: WeatherId; days: number } | null>(null);
  const [seen, setSeen] = useState(() => state.nextEventId);
  if (state.nextEventId !== seen) {
    setSeen(state.nextEventId);
    const change = state.log.findLast((e) => e.id >= seen && e.kind === 'weatherChanged');
    if (change?.kind === 'weatherChanged') setShown({ weather: change.to, days: change.days });
  }
  return [shown, setShown] as const;
}

/** The newest night event that hit someone, not yet seen (not one from before a reload). */
function useNightEvent(state: GameState) {
  const [shown, setShown] = useState<NightEventShown | null>(null);
  const [seen, setSeen] = useState(() => state.nextEventId);
  if (state.nextEventId !== seen) {
    setSeen(state.nextEventId);
    const night = state.log.findLast((e) => e.id >= seen && e.kind === 'nightEvent');
    if (night?.kind === 'nightEvent' && night.hits.length) setShown(night);
  }
  return [shown, setShown] as const;
}

/**
 * Which Wonder's pop-up is open. It opens by itself when a Wonder is found
 * (landing there or an early reveal) and when a hiker arrives at one that
 * isn't accomplished yet; the debug panel can open it too. If a challenge is
 * open, it waits behind it.
 */
function useWonderOpener(state: GameState) {
  const [open, setOpen] = useState<TileId | null>(null);
  const [seen, setSeen] = useState(() => state.nextEventId);
  if (state.nextEventId !== seen) {
    setSeen(state.nextEventId);
    for (const e of state.log) {
      if (e.id < seen) continue;
      const to = e.kind === 'move' || e.kind === 'moved' ? e.to : undefined;
      const w = to ? state.section.tiles[to]?.wonder : undefined;
      if (e.kind === 'wonderRevealed') setOpen(e.tileId);
      else if (to && isRevealed(w) && !isAccomplished(w)) setOpen(to);
    }
  }
  useEffect(() => {
    const onOpen = () => {
      const tile = gameStore.getState() && wonderTile(gameStore.getState()!);
      if (tile && isRevealed(tile.wonder)) setOpen(tile.id);
    };
    window.addEventListener(OPEN_WONDER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WONDER_EVENT, onOpen);
  }, []);
  return [open, setOpen] as const;
}

/** How long a tile Predator Bait made easier stays blue after its pop-up closes. */
const EASIER_SHOWS_MS = 5000;

/**
 * Tiles Predator Bait just made easier: collected from the log as they happen,
 * and cleared a few seconds after the pop-up (and its results) close.
 */
function useEasierTiles(state: GameState, busy: boolean): TileId[] {
  // Each tile's net change from the presses so far: −1 easier, +1 harder.
  const [shift, setShift] = useState<Record<TileId, number>>({});
  const [seen, setSeen] = useState(() => state.nextEventId);
  const newest = state.nextEventId;
  if (newest !== seen) {
    const fresh = state.log.filter((e) => e.id >= seen && e.kind === 'pressed' && e.easier);
    setSeen(newest);
    if (fresh.length) {
      setShift((was) => {
        const next = { ...was };
        for (const e of fresh) {
          if (e.kind !== 'pressed') continue;
          if (e.easier) next[e.easier] = (next[e.easier] ?? 0) - 1;
          if (e.harder) next[e.harder] = (next[e.harder] ?? 0) + 1;
        }
        return next;
      });
    }
  }
  // Only tiles that ended up easier get the blue ring.
  const tiles = Object.entries(shift)
    .filter(([, n]) => n < 0)
    .map(([id]) => id);
  const any = Object.keys(shift).length > 0;
  useEffect(() => {
    if (busy || !any) return;
    const timer = setTimeout(() => setShift({}), EASIER_SHOWS_MS);
    return () => clearTimeout(timer);
  }, [busy, any]);
  return tiles;
}
