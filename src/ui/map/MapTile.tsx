import { tileLabel } from '../../content/tileLabels';
import { ASSETS } from '../../config/assets';
import { isAccomplished, isRevealed, type Tile, type TileNode } from '../../engine';
import { CARDS, ITEMS } from '../../content';
import { WONDER_BY_ID } from '../../content/wonders';
import { Icon } from '../icons/Icon';
import { CHECKPOINT_HEX, HEX, type Point } from './mapLayout';
import styles from './MapView.module.css';
import {
  FEATURE_LOOK,
  NODE_IMAGE,
  NODE_NAME,
  SPECIAL_LOOK,
  TILE_LOOK,
  type TileLookName,
} from './looks';

interface MapTileProps {
  tile: Tile;
  at: Point;
  look: TileLookName;
  /** Edge color for the current tile (the selected hiker's color). */
  currentColor?: string;
  hikerCount: number;
  /** A connected tile the selected hiker can move to ('ok', gold ring) or can't ('blocked'). */
  reach?: 'ok' | 'blocked';
  onClick?(): void;
  /** Simple mode: the checkpoint's label shows only on hover. */
  checkpointLabelOnHover?: boolean;
  /** A Trial's tile (orange ring), Rocco's red tile, or a tile that just got easier (blue). */
  mark?: 'trial' | 'target' | 'easier' | undefined;
  /** A card revealed early here: its icon opens the card. */
  onRevealed?(): void;
  /** A Wonder found here: its icon opens the Wonder. */
  onWonder?(): void;
}

export function MapTile({
  tile,
  at,
  look,
  currentColor,
  hikerCount,
  reach,
  onClick,
  checkpointLabelOnHover,
  mark,
  onRevealed,
  onWonder,
}: MapTileProps) {
  if (tile.kind === 'checkpoint') {
    return (
      <CheckpointTile
        at={at}
        hikerCount={hikerCount}
        reach={reach}
        onClick={onClick}
        labelOnHover={checkpointLabelOnHover}
      />
    );
  }

  const colors = TILE_LOOK[look];
  const edge = look === 'current' && currentColor ? currentColor : colors.edge;
  const special = tile.special ? SPECIAL_LOOK[tile.special] : null;
  // The special icon sits in the centre until a hiker has landed here, then moves to the corner.
  const specialCentered = special && !tile.visited;
  const allKnown = tile.nodes.length > 0 && tile.nodes.every((n) => n.revealed);
  const label = tile.kind === 'trailhead' ? 'START' : allKnown ? tileLabel(tile.nodes) : null;
  // A hidden Wonder shows unknown node badges, like any tile nobody has reached.
  const wonder = tile.wonder;
  const wonderName = wonder && isRevealed(wonder) ? WONDER_BY_ID[wonder.id]?.name : undefined;
  const wonderDone = isAccomplished(wonder);
  const nodes: TileNode[] =
    wonder && !wonderName
      ? Array.from({ length: wonder.decoys }, () => ({ type: 'forest', revealed: false }))
      : tile.nodes;

  const describe = wonderName
    ? `Wonder: ${wonderName}${wonderDone ? ' (accomplished)' : ''}`
    : describeTile({ ...tile, nodes }, label);
  return (
    <div
      className={styles.tile}
      style={{ left: at.x - HEX.w / 2, top: at.y - HEX.h / 2, width: HEX.w, height: HEX.h }}
      title={describe}
      data-reach={reach}
      {...clickable(onClick, reach === 'ok' ? `Move here: ${describe}` : describe)}
    >
      {mark && <div className={`${styles.hex} ${styles.markRing}`} data-mark={mark} />}
      {reach === 'ok' && <div className={`${styles.hex} ${styles.reachRing}`} />}
      <div className={styles.hex} style={{ inset: 0, background: edge }} />
      <div className={styles.hex} style={{ inset: 5, background: colors.fill }} />

      {specialCentered && (
        <div className={styles.special} style={{ opacity: look === 'fog' ? 0.8 : 1 }}>
          <div className={styles.specialIcon} style={{ background: special.bg, color: special.fg }}>
            {tile.special === 'narrowPath' ? (
              <span className={styles.capacity}>{tile.narrowCapacity}</span>
            ) : (
              <Icon name={special.icon} size={22} />
            )}
          </div>
          <span className={styles.specialName} style={{ color: colors.text }}>
            {special.name}
          </span>
        </div>
      )}

      {wonderName && (
        <div className={styles.special}>
          <div className={styles.wonderEmblem} data-done={wonderDone}>
            <Icon name="sparkles" size={24} strokeWidth={2.25} />
          </div>
          <span className={styles.specialName} style={{ color: colors.text }}>
            {wonderName}
          </span>
        </div>
      )}

      {!specialCentered && !wonderName && label && (
        <div className={styles.label} style={{ color: colors.text }}>
          {label}
        </div>
      )}

      {special && !specialCentered && (
        <div
          className={styles.corner}
          style={{ right: -4, background: special.bg, color: special.fg }}
          title={special.name}
        >
          {tile.special === 'narrowPath' ? (
            <span className={styles.cornerNumber}>{tile.narrowCapacity}</span>
          ) : (
            <Icon name={special.icon} size={14} strokeWidth={2.5} />
          )}
        </div>
      )}

      {tile.feature && (
        <div
          className={styles.corner}
          style={{ left: -4, background: '#E9B44C', color: '#1D2220' }}
          title={FEATURE_LOOK[tile.feature].name}
        >
          <Icon name={FEATURE_LOOK[tile.feature].icon} size={14} strokeWidth={2.25} />
        </div>
      )}

      {tile.shelters?.length ? (
        <div className={styles.shelter} title={shelterWords(tile)}>
          <Icon name="tent" size={13} strokeWidth={2.5} />
          <span className={styles.shelterNights}>
            {Math.max(...tile.shelters.map((s) => s.nightsLeft))}
          </span>
        </div>
      ) : null}

      {tile.revealedCard && !tile.visited && (
        <RevealedIcon cardId={tile.revealedCard.cardId} onOpen={onRevealed} />
      )}

      {wonderName && (
        <button
          type="button"
          className={styles.revealed}
          data-kind={wonderDone ? 'wonderDone' : 'wonder'}
          title={`${wonderName}: tap to open the Wonder`}
          aria-label={`Wonder here: ${wonderName}. Open it`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onWonder?.();
          }}
        >
          <Icon name="sparkles" size={18} strokeWidth={2.5} />
        </button>
      )}

      <div className={styles.nodes}>
        {nodes.map((n, i) => (
          <NodeBadge key={i} node={n} hiddenBg={colors.hiddenBg} />
        ))}
      </div>
    </div>
  );
}

const NODE_STATE_LABEL = { flooded: 'Flooded', frozen: 'Frozen', fire: 'Fire' } as const;

/** What a weather-changed node is called on the map, and what it does. */
const NODE_STATE_WORDS = {
  flooded: 'Flooded node: counts as River until the rain ends',
  frozen: 'Frozen node: gives nothing until the snow ends',
  fire: 'Fire node: gives nothing, +1 Luck to the other nodes here',
} as const;

function NodeBadge({ node, hiddenBg }: { node: TileNode; hiddenBg: string }) {
  const changed = node.weather?.state;
  const name = changed
    ? NODE_STATE_WORDS[changed]
    : `${NODE_NAME[node.type]} node${node.bounty ? ' (Bounty)' : ''}`;
  return (
    <div className={styles.node} title={node.revealed ? name : 'Unknown node'}>
      {node.revealed && node.bounty && <div className={styles.bounty} />}
      {!node.revealed ? (
        <div className={styles.nodeHidden} style={{ background: hiddenBg }}>
          ?
        </div>
      ) : changed ? (
        <img
          className={`${styles.nodeImg} ${styles.nodeState}`}
          src={ASSETS.nodeStates[changed]}
          alt={name}
          draggable={false}
        />
      ) : node.type === 'caps' ? (
        <div className={styles.nodeCaps}>
          <img src={ASSETS.icons.acornCaps} alt={name} draggable={false} />
        </div>
      ) : (
        <img className={styles.nodeImg} src={NODE_IMAGE[node.type]} alt={name} draggable={false} />
      )}
    </div>
  );
}

/** Makes a tile a keyboard-friendly button when it can be clicked. */
function clickable(onClick: (() => void) | undefined, label: string) {
  if (!onClick) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
  } as const;
}

function CheckpointTile({
  at,
  hikerCount,
  reach,
  onClick,
  labelOnHover,
}: {
  at: Point;
  hikerCount: number;
  reach?: 'ok' | 'blocked';
  onClick?(): void;
  labelOnHover?: boolean;
}) {
  const { w, h } = CHECKPOINT_HEX;
  return (
    <div className={styles.checkpointGroup} data-label={labelOnHover ? 'hover' : 'always'}>
      <div
        className={styles.tile}
        style={{ left: at.x - w / 2, top: at.y - h / 2, width: w, height: h }}
        title="Checkpoint: the ranger station"
        data-reach={reach}
        {...clickable(onClick, 'Checkpoint: the ranger station')}
      >
        <div className={styles.hex} style={{ inset: 0, background: '#F7F1E4' }} />
        <div className={`${styles.hex} ${styles.checkpointFill}`} style={{ inset: 6 }}>
          <Icon name="tower" size={46} color="#F7F1E4" />
        </div>
      </div>
      <div className={styles.checkpointCard} style={{ left: at.x - w / 2 - 184, top: at.y - 34 }}>
        <span className={styles.cardTitle}>CHECKPOINT 1</span>
        <span className={styles.cardText}>
          Ranger Station · {hikerCount > 0 ? `${hikerCount} here` : 'all 4 check in'}
        </span>
      </div>
    </div>
  );
}

/** "Tent, 2 nights left · Cabin, 5 nights left". */
function shelterWords(tile: Tile): string {
  return (tile.shelters ?? [])
    .map((s) => {
      const name = ITEMS[s.itemId]?.name ?? 'Shelter';
      return `${name}, ${s.nightsLeft} night${s.nightsLeft === 1 ? '' : 's'} left`;
    })
    .join(' · ');
}

function describeTile(tile: Tile, label: string | null): string {
  if (tile.kind === 'trailhead') return 'Trailhead';
  const parts = [label ?? 'Trail tile'];
  if (tile.special) parts.push(SPECIAL_LOOK[tile.special].name);
  if (tile.feature) parts.push(FEATURE_LOOK[tile.feature].name);
  if (tile.shelters?.length) parts.push(`Shelter: ${shelterWords(tile)}`);
  const known = tile.nodes
    .filter((n) => n.revealed)
    .map((n) => (n.weather ? NODE_STATE_LABEL[n.weather.state] : NODE_NAME[n.type]));
  const hidden = tile.nodes.length - known.length;
  parts.push(
    `${tile.nodes.length} node${tile.nodes.length === 1 ? '' : 's'}` +
      (known.length ? `: ${known.join(', ')}` : '') +
      (hidden ? ` (${hidden} unknown)` : ''),
  );
  return parts.join(' · ');
}

/** A card revealed early on this tile (Old Firewatch Tower): tap it to read the card. */
function RevealedIcon({ cardId, onOpen }: { cardId: string; onOpen: (() => void) | undefined }) {
  const card = CARDS[cardId];
  const kind = card?.kind ?? 'challenge';
  const name = card?.name ?? 'A card';
  return (
    <button
      type="button"
      className={styles.revealed}
      data-kind={kind}
      title={`${name}: tap to read it`}
      aria-label={`Revealed here: ${name}. Read the card`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
    >
      <Icon
        name={kind === 'opportunity' ? 'star' : kind === 'trial' ? 'sign' : 'alert'}
        size={17}
        strokeWidth={2.5}
      />
    </button>
  );
}
