/**
 * The hiker selection screen (Phase 10b, docs/mockups/HikerSelect.png): the
 * screen for a new run.
 *
 * - **Top:** CHOOSE YOUR HIKERS, BACK, RANDOM (fills the empty spots) and
 *   START HIKE · N HIKERS (1 to 4).
 * - **Four spots** in the party colors. Drag a card onto one; dropping on a
 *   filled spot swaps, spot to spot swaps, and dragging out of the spots
 *   removes. × removes too.
 * - **The list:** every hiker's card, filtered by family. A click flips a
 *   card; Enter or a double-click adds it to the first empty spot. Cards in
 *   the party dim with IN PARTY; variants kept out by no cloning dim too,
 *   with who's in the way.
 */
import { useState, type CSSProperties } from 'react';
import { PARTY_COLORS } from '../../content/partyColors';
import { ROSTER, ROSTER_BY_ID } from '../../content/roster';
import type { HikerSetup } from '../../engine/newGame';
import { useDrag, useDragState, useDrop } from '../drag/drag';
import { DragLayer } from '../drag/DragLayer';
import { cardFor } from '../hikers/cardData';
import { FitLine, HikerCard } from '../hikers/HikerCard';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { Icon } from '../icons/Icon';
import { PreviewLayer } from '../preview/PreviewLayer';
import { TraitBadge } from '../traits/TraitBadge';
import styles from './HikerSelect.module.css';
import {
  add,
  blocker,
  canPlace,
  canStart,
  EMPTY_PARTY,
  fillRandom,
  place,
  remove,
  spotOf,
  startingParty,
  startLabel,
  type Party,
} from './selection';

/** A list card: 160 × 224. */
const LIST_SCALE = 160 / 300;
/** The card under the pointer while dragging. */
const GHOST_SCALE = 0.6;

const FILTERS = [
  ['all', 'ALL'],
  ['human', 'HUMANS'],
  ['dog', 'DOGS'],
  ['cat', 'CATS'],
  ['plush', 'PLUSH'],
  ['variant', 'VARIANTS'],
] as const;
type Filter = (typeof FILTERS)[number][0];

const shown = (id: string, filter: Filter): boolean => {
  const h = ROSTER_BY_ID.get(id);
  if (!h || filter === 'all') return !!h;
  return filter === 'variant' ? !!h.variantOf : h.family === filter;
};

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
  const [filter, setFilter] = useState<Filter>('all');
  const drag = useDragState();
  const picking = drag?.payload.kind === 'pick' ? drag.payload : null;

  const spots = useDrop('spot', {
    accepts: (p, arg) => p.kind === 'pick' && canPlace(party, p.hikerId, Number(arg)),
    onDrop: (p, arg) => {
      if (p.kind === 'pick') setParty((q) => place(q, p.hikerId, Number(arg)));
    },
  });
  // Out of a spot and dropped anywhere else: out of the party.
  const away = useDrop('away', {
    accepts: (p) => p.kind === 'pick' && p.spot !== null,
    onDrop: (p) => {
      if (p.kind === 'pick') setParty((q) => remove(q, spotOf(q, p.hikerId)));
    },
  });
  const addHiker = (id: string) => setParty((q) => add(q, id));
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
          onClick={() => setParty((q) => fillRandom(q, Math.random))}
        >
          RANDOM
        </button>
        <button
          type="button"
          className={styles.start}
          disabled={!canStart(party)}
          onClick={() => onStart(startingParty(party))}
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
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.list} data-removing={removing || undefined}>
        <div className={styles.grid}>
          {ROSTER.filter((h) => shown(h.id, filter)).map((h) => (
            <ListCard
              key={h.id}
              hikerId={h.id}
              party={party}
              lifted={picking?.hikerId === h.id && picking.spot === null}
              onAdd={addHiker}
            />
          ))}
        </div>
      </div>
      {removing && <div className={styles.removeHint}>DROP TO REMOVE</div>}
    </div>
  );
}

/** The card under the pointer while dragging, tilted a little. */
function Ghost({ hikerId }: { hikerId: string }) {
  return (
    <div className={styles.ghost}>
      <HikerCard hikerId={hikerId} side="front" scale={GHOST_SCALE} />
    </div>
  );
}

function ListCard({
  hikerId,
  party,
  lifted,
  onAdd,
}: {
  hikerId: string;
  party: Party;
  /** Being dragged: a dashed outline stays in its place. */
  lifted: boolean;
  onAdd(id: string): void;
}) {
  const drag = useDrag({ kind: 'pick', hikerId, spot: null }, <Ghost hikerId={hikerId} />);
  const spot = spotOf(party, hikerId);
  const inWay = spot < 0 ? blocker(party, hikerId) : undefined;
  return (
    <div className={styles.cell}>
      <div
        className={styles.cellCard}
        data-dim={spot >= 0 || !!inWay || undefined}
        data-lifted={lifted || undefined}
      >
        <HikerCard
          hikerId={hikerId}
          scale={LIST_SCALE}
          onEnter={() => onAdd(hikerId)}
          rootProps={{ ...drag, onDoubleClick: () => onAdd(hikerId) }}
        />
      </div>
      {spot >= 0 && (
        <span className={styles.tag} style={{ background: PARTY_COLORS[spot] }}>
          IN PARTY
        </span>
      )}
      {inWay && <span className={styles.tag}>{nameOf(inWay).toUpperCase()} IS IN</span>}
      {lifted && <span className={styles.outline} />}
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
}: {
  index: number;
  hikerId: string | null;
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
          <div className={styles.spotBadges}>
            {data.badges.map((b) => (
              <span key={b.slot} className={styles.spotBadge} style={{ width: colW }}>
                <TraitBadge badge={b} size="card" showName as="span" />
              </span>
            ))}
          </div>
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
