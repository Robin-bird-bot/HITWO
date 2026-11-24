/**
 * The hiker selection screen (Phase 10b, docs/mockups/HikerSelect.png): the
 * screen for a new run.
 *
 * - **Top:** CHOOSE YOUR HIKERS, BACK, RANDOM (fills the empty spots) and
 *   START HIKE · N HIKERS (1 to 4).
 * - **Four spots** in the party colors. Drag a card onto one; dropping on a
 *   filled spot swaps, spot to spot swaps, and dragging out of the spots
 *   removes. × removes too.
 * - **The list:** every hiker's card, filtered by family and sorted
 *   (sorting.ts), under a ribbon per group. A click flips a card; Enter or a
 *   double-click adds it to the first empty spot. Cards in the party dim with
 *   IN PARTY; variants kept out by no cloning dim too, with who's in the way.
 * - Phase 10.7: locked hikers are silhouettes that can't be picked. A
 *   designed hiker in a spot shows their 3 starting traits: pick one (it can
 *   change until START). BY STARTING TRAIT lists each hiker once per start.
 */
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { PARTY_COLORS } from '../../content/partyColors';
import { ROSTER, ROSTER_BY_ID } from '../../content/roster';
import { useDeviceSetting } from '../app/deviceSetting';
import { useShowDifficulty } from '../debug/debugFlags';
import type { HikerSetup } from '../../engine/newGame';
import { useDrag, useDragState, useDrop } from '../drag/drag';
import { DragLayer } from '../drag/DragLayer';
import { cardFor } from '../hikers/cardData';
import { FitLine, HikerCard } from '../hikers/HikerCard';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { Icon } from '../icons/Icon';
import { PreviewLayer } from '../preview/PreviewLayer';
import { TraitBadge } from '../traits/TraitBadge';
import type { BadgeInfo } from '../traits/badges';
import type { CardTree } from '../hikers/cardData';
import styles from './HikerSelect.module.css';
import {
  add,
  blocker,
  canPlace,
  canStart,
  EMPTY_PARTY,
  fillRandom,
  members,
  needsStart,
  place,
  randomStarts,
  remove,
  spotOf,
  startingParty,
  startLabel,
  type Party,
  type Starts,
} from './selection';
import {
  cardKey,
  FILTERS,
  HIKER_SORT,
  sortHikers,
  SORTS,
  type FilterId,
  type HikerGroup,
  type Ribbon,
} from './sorting';

/** A list card: 160 × 224. */
const LIST_SCALE = 160 / 300;
/** The card under the pointer while dragging. */
const GHOST_SCALE = 0.6;

const nameOf = (id: string) => ROSTER_BY_ID.get(id)?.name ?? id;

export function HikerSelect({
  onStart,
  onBack,
}: {
  /** The run's hikers, in spot order, in their spot colors. */
  onStart(hikers: HikerSetup[]): void;
  onBack(): void;
}) {
  return (
    <PreviewLayer>
      <DragLayer>
        <SelectScreen onStart={onStart} onBack={onBack} />
      </DragLayer>
    </PreviewLayer>
  );
}

function SelectScreen({
  onStart,
  onBack,
}: {
  onStart(hikers: HikerSetup[]): void;
  onBack(): void;
}) {
  const [party, setParty] = useState<Party>(EMPTY_PARTY);
  const [starts, setStarts] = useState<Starts>({});
  /** A card from BY STARTING TRAIT brings its start along. */
  const withStart = (hikerId: string, start?: string) => {
    if (start) setStarts((s) => ({ ...s, [hikerId]: start }));
  };
  const [filter, setFilter] = useState<FilterId>('all');
  const sort = useDeviceSetting(HIKER_SORT);
  const groups = useMemo(() => sortHikers(ROSTER, sort, filter), [sort, filter]);
  const showDifficulty = useShowDifficulty();
  const listRef = useRef<HTMLDivElement>(null);
  /** A new filter or sort starts the list from the top. */
  const toTop = () => listRef.current?.scrollTo({ top: 0 });
  const drag = useDragState();
  const picking = drag?.payload.kind === 'pick' ? drag.payload : null;

  const spots = useDrop('spot', {
    accepts: (p, arg) => p.kind === 'pick' && canPlace(party, p.hikerId, Number(arg)),
    onDrop: (p, arg) => {
      if (p.kind !== 'pick') return;
      setParty((q) => place(q, p.hikerId, Number(arg)));
      withStart(p.hikerId, p.start);
    },
  });
  // Out of a spot and dropped anywhere else: out of the party.
  const away = useDrop('away', {
    accepts: (p) => p.kind === 'pick' && p.spot !== null,
    onDrop: (p) => {
      if (p.kind === 'pick') setParty((q) => remove(q, spotOf(q, p.hikerId)));
    },
  });
  const addHiker = (id: string, start?: string) => {
    setParty((q) => add(q, id));
    withStart(id, start);
  };
  const removing =
    picking?.spot !== null && picking?.spot !== undefined && drag?.hover?.id === 'away';

  return (
    <div className={styles.screen} {...away.props()}>
      <header className={styles.top}>
        <h1 className={styles.heading}>CHOOSE YOUR HIKERS</h1>
        <p className={styles.help}>
          Drag a card into a spot. Click a card to flip it, and hover a flipped card to lift it to
          the middle. Start with 1 to 4 hikers.
        </p>
      </header>
      <div className={styles.actions}>
        <button type="button" className={styles.back} onClick={onBack}>
          BACK
        </button>
        <button
          type="button"
          className={styles.random}
          disabled={!party.includes(null)}
          onClick={() => {
            const next = fillRandom(party, Math.random);
            setParty(next);
            setStarts((s) => randomStarts(next, s, Math.random));
          }}
        >
          RANDOM
        </button>
        <button
          type="button"
          className={styles.start}
          disabled={!canStart(party, starts)}
          title={
            members(party).some((id) => needsStart(id, starts))
              ? 'Pick a starting trait for each hiker first.'
              : undefined
          }
          onClick={() => onStart(startingParty(party, starts))}
        >
          {startLabel(party)}
        </button>
      </div>

      <div className={styles.spots}>
        {party.map((id, i) => (
          <Spot
            key={i}
            index={i}
            hikerId={id}
            dragging={!!picking}
            leaving={!!id && picking?.hikerId === id && picking.spot !== null}
            hovered={drag?.hover?.id === 'spot' && drag.hover.arg === String(i)}
            dropProps={spots.props(String(i))}
            onRemove={() => setParty((q) => remove(q, i))}
            start={id ? starts[id] : undefined}
            onPickStart={(tree) => id && setStarts((s) => ({ ...s, [id]: tree }))}
          />
        ))}
      </div>

      <div className={styles.listBar}>
        <span className={styles.listTitle}>HIKERS</span>
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={styles.chip}
            aria-pressed={filter === id}
            onClick={() => {
              setFilter(id);
              toTop();
            }}
          >
            {label}
          </button>
        ))}
        <div className={styles.sort}>
          <span className={styles.sortWord}>SORT</span>
          <div className={styles.sortOptions} role="group" aria-label="Sort">
            {SORTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={styles.sortOption}
                aria-pressed={sort === id}
                onClick={() => {
                  HIKER_SORT.set(id);
                  toTop();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={listRef} className={styles.list} data-removing={removing || undefined}>
        {groups.map((group) => (
          <Group
            key={group.key}
            group={group}
            party={party}
            starts={starts}
            lifted={picking?.spot === null ? picking : null}
            showDifficulty={showDifficulty}
            onAdd={addHiker}
          />
        ))}
      </div>
      {removing && <div className={styles.removeHint}>DROP TO REMOVE</div>}
    </div>
  );
}

/** The card under the pointer while dragging, tilted a little. */
function Ghost({ hikerId, start }: { hikerId: string; start?: string | undefined }) {
  return (
    <div className={styles.ghost}>
      <HikerCard hikerId={hikerId} start={start} side="front" scale={GHOST_SCALE} />
    </div>
  );
}

/** A ribbon across the list (none for DEFAULT), then the group's cards. */
function Group({
  group,
  party,
  starts,
  lifted,
  showDifficulty,
  onAdd,
}: {
  group: HikerGroup;
  party: Party;
  starts: Starts;
  /** The list card being dragged, if any. */
  lifted: { hikerId: string; copy?: string; start?: string } | null;
  showDifficulty: boolean;
  onAdd(id: string, start?: string): void;
}) {
  return (
    <section className={styles.group} aria-label={group.ribbon?.label ?? 'Hikers'}>
      {group.ribbon && <RibbonBar ribbon={group.ribbon} />}
      <div className={styles.grid}>
        {group.hikers.map((h) => (
          <ListCard
            key={cardKey(h)}
            hikerId={h.id}
            start={h.start}
            locked={!!h.locked}
            copy={group.key}
            party={party}
            starts={starts}
            lifted={
              lifted?.hikerId === h.id && lifted.copy === group.key && lifted.start === h.start
            }
            difficulty={showDifficulty ? h.difficulty : undefined}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  );
}

/** A colored bar with notched ends: the group's name and how many hikers. */
function RibbonBar({ ribbon }: { ribbon: Ribbon }) {
  return (
    <h2 className={styles.ribbon} style={{ background: ribbon.color }}>
      {ribbon.label}
      <span className={styles.ribbonCount}>{ribbon.count}</span>
    </h2>
  );
}

function ListCard({
  hikerId,
  start,
  locked,
  copy,
  party,
  starts,
  lifted,
  difficulty,
  onAdd,
}: {
  hikerId: string;
  /** BY STARTING TRAIT: the tree this card starts with. */
  start: string | undefined;
  /** Locked (Phase 10.7): a silhouette that can't be picked, flipped or dragged. */
  locked: boolean;
  /** Which group this copy is in (Mom shows in two families). */
  copy: string;
  party: Party;
  starts: Starts;
  /** Being dragged: a dashed outline stays in its place. */
  lifted: boolean;
  /** Debug only: the hidden difficulty, in the corner. */
  difficulty: number | undefined;
  onAdd(id: string, start?: string): void;
}) {
  const drag = useDrag(
    locked ? null : { kind: 'pick', hikerId, spot: null, copy, ...(start ? { start } : {}) },
    locked ? null : <Ghost hikerId={hikerId} start={start} />,
  );
  const spot = spotOf(party, hikerId);
  const inWay = spot < 0 && !locked ? blocker(party, hikerId) : undefined;
  // BY STARTING TRAIT: once the hiker is in, their other starts grey out.
  const otherStart = spot >= 0 && !!start && starts[hikerId] !== start;
  if (locked) {
    return (
      <div className={styles.cell}>
        <div className={styles.cellCard} data-locked>
          <HikerCard hikerId={hikerId} scale={LIST_SCALE} />
        </div>
        {difficulty !== undefined && (
          <span
            className={styles.difficulty}
            data-difficulty={difficulty}
            title="Hidden difficulty"
          >
            {difficulty}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={styles.cell}>
      <div
        className={styles.cellCard}
        data-dim={spot >= 0 || !!inWay || undefined}
        data-lifted={lifted || undefined}
      >
        <HikerCard
          hikerId={hikerId}
          start={start}
          scale={LIST_SCALE}
          onEnter={() => onAdd(hikerId, start)}
          rootProps={{ ...drag, onDoubleClick: () => onAdd(hikerId, start) }}
        />
      </div>
      {spot >= 0 && !otherStart && (
        <span className={styles.tag} style={{ background: PARTY_COLORS[spot] }}>
          IN PARTY
        </span>
      )}
      {inWay && <span className={styles.tag}>{nameOf(inWay).toUpperCase()} IS IN</span>}
      {lifted && <span className={styles.outline} />}
      {difficulty !== undefined && (
        <span className={styles.difficulty} data-difficulty={difficulty} title="Hidden difficulty">
          {difficulty}
        </span>
      )}
    </div>
  );
}

function Spot({
  index,
  hikerId,
  dragging,
  leaving,
  hovered,
  dropProps,
  onRemove,
  start,
  onPickStart,
}: {
  index: number;
  hikerId: string | null;
  /** The tree whose Tier 1 this hiker starts with (Phase 10.7). */
  start: string | undefined;
  onPickStart(tree: string): void;
  /** A card is being dragged: every spot glows. */
  dragging: boolean;
  /** This spot's hiker is the one being dragged. */
  leaving: boolean;
  hovered: boolean;
  dropProps: ReturnType<ReturnType<typeof useDrop>['props']>;
  onRemove(): void;
}) {
  const color = PARTY_COLORS[index] ?? '#E9B44C';
  const data = hikerId ? cardFor(hikerId) : undefined;
  const drag = useDrag(
    hikerId ? { kind: 'pick', hikerId, spot: index } : null,
    hikerId ? <Ghost hikerId={hikerId} /> : null,
  );
  const colW = data ? 330 / Math.max(1, data.badges.length) : 0;
  return (
    <div
      className={styles.spot}
      style={{ '--c': color } as CSSProperties}
      data-glow={dragging || undefined}
      data-full={!!data || undefined}
      data-leaving={leaving || undefined}
      aria-label={data ? `Hiker ${index + 1}: ${data.name}` : `Hiker ${index + 1}: empty`}
      {...dropProps}
      {...drag}
    >
      <span className={styles.spotTab}>HIKER {index + 1}</span>
      {data ? (
        <div className={styles.spotBody}>
          <div className={styles.spotPortrait}>
            <HikerPortrait
              hikerId={data.id}
              view="strip"
              aspect={360 / 204}
              className={styles.spotPicture}
            />
            {data.trees && !start && <span className={styles.pickHint}>PICK A STARTING TRAIT</span>}
            <span className={styles.bagChip}>
              <span className={styles.bagWord}>BAG</span>
              {data.bag.toUpperCase()}
            </span>
            <button
              type="button"
              className={styles.removeButton}
              aria-label={`Take ${data.name} out of the party`}
              title="Take out of the party"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onRemove}
            >
              <Icon name="x" size={14} strokeWidth={3} />
            </button>
          </div>
          <div className={styles.spotName}>
            <FitLine text={data.name.toUpperCase()} size={26} className={styles.spotNameText} />
            {data.title && <FitLine text={data.title} size={16} className={styles.spotTitleText} />}
          </div>
          <div className={styles.spotRoles}>
            {data.roles.map((r) => (
              <span key={r.id} style={{ background: r.color }}>
                {r.name}
              </span>
            ))}
          </div>
          {data.trees ? (
            <StartPicker
              trees={data.trees}
              badges={data.badges}
              start={start}
              colW={colW}
              onPick={onPickStart}
            />
          ) : (
            <div className={styles.spotBadges}>
              {data.badges.map((b) => (
                <span key={b.slot} className={styles.spotBadge} style={{ width: colW }}>
                  <TraitBadge badge={b} size="card" showName as="span" />
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.empty}>
          <span className={styles.plus}>
            <Icon name="plus" size={24} strokeWidth={2.6} />
          </span>
          DRAG A HIKER HERE
        </div>
      )}
      {hovered && <div className={styles.dropHere}>{data ? 'DROP TO SWAP' : 'DROP TO ADD'}</div>}
    </div>
  );
}

/**
 * A designed hiker's starting trait (Phase 10.7): their 3 trees' Tier 1
 * traits, one to pick. Until one is picked a gold hint says so; the pick can
 * change until the hike starts.
 */
function StartPicker({
  trees,
  badges,
  start,
  colW,
  onPick,
}: {
  trees: readonly CardTree[];
  badges: readonly BadgeInfo[];
  start: string | undefined;
  colW: number;
  onPick(tree: string): void;
}) {
  return (
    <div
      className={styles.spotBadges}
      data-picking={!start || undefined}
      role="radiogroup"
      aria-label="Starting trait"
    >
      {trees.map((t, i) => {
        const b = badges[i];
        if (!b) return null;
        const picked = start === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={picked}
            className={styles.startOption}
            data-picked={picked || undefined}
            data-other={(!!start && !picked) || undefined}
            style={{ width: colW }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPick(t.id);
            }}
          >
            <TraitBadge badge={b} size="card" showName as="span" passClick />
          </button>
        );
      })}
    </div>
  );
}
