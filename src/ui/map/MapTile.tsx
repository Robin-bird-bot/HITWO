import { tileLabel } from '../../content/tileLabels';
import { ASSETS } from '../../config/assets';
import type { Tile, TileNode } from '../../engine';
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
}

export function MapTile({
  tile,
  at,
  look,
  currentColor,
  hikerCount,
  reach,
  onClick,
}: MapTileProps) {
  if (tile.kind === 'checkpoint') {
    return <CheckpointTile at={at} hikerCount={hikerCount} reach={reach} onClick={onClick} />;
  }

  const colors = TILE_LOOK[look];
  const edge = look === 'current' && currentColor ? currentColor : colors.edge;
  const special = tile.special ? SPECIAL_LOOK[tile.special] : null;
  // The special icon sits in the centre until a hiker has landed here, then moves to the corner.
  const specialCentered = special && !tile.visited;
  const allKnown = tile.nodes.length > 0 && tile.nodes.every((n) => n.revealed);
  const label = tile.kind === 'trailhead' ? 'START' : allKnown ? tileLabel(tile.nodes) : null;

  const describe = describeTile(tile, label);
  return (
    <div
      className={styles.tile}
      style={{ left: at.x - HEX.w / 2, top: at.y - HEX.h / 2, width: HEX.w, height: HEX.h }}
      title={describe}
      data-reach={reach}
      {...clickable(onClick, reach === 'ok' ? `Move here: ${describe}` : describe)}
    >
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

      {!specialCentered && label && (
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

      <div className={styles.nodes}>
        {tile.nodes.map((n, i) => (
          <NodeBadge key={i} node={n} hiddenBg={colors.hiddenBg} />
        ))}
      </div>
    </div>
  );
}

function NodeBadge({ node, hiddenBg }: { node: TileNode; hiddenBg: string }) {
  const name = `${NODE_NAME[node.type]} node${node.bounty ? ' (Bounty)' : ''}`;
  return (
    <div className={styles.node} title={node.revealed ? name : 'Unknown node'}>
      {node.revealed && node.bounty && <div className={styles.bounty} />}
      {!node.revealed ? (
        <div className={styles.nodeHidden} style={{ background: hiddenBg }}>
          ?
        </div>
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
}: {
  at: Point;
  hikerCount: number;
  reach?: 'ok' | 'blocked';
  onClick?(): void;
}) {
  const { w, h } = CHECKPOINT_HEX;
  return (
    <>
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
    </>
  );
}

function describeTile(tile: Tile, label: string | null): string {
  if (tile.kind === 'trailhead') return 'Trailhead';
  const parts = [label ?? 'Trail tile'];
  if (tile.special) parts.push(SPECIAL_LOOK[tile.special].name);
  if (tile.feature) parts.push(FEATURE_LOOK[tile.feature].name);
  const known = tile.nodes.filter((n) => n.revealed).map((n) => NODE_NAME[n.type]);
  const hidden = tile.nodes.length - known.length;
  parts.push(
    `${tile.nodes.length} node${tile.nodes.length === 1 ? '' : 's'}` +
      (known.length ? `: ${known.join(', ')}` : '') +
      (hidden ? ` (${hidden} unknown)` : ''),
  );
  return parts.join(' · ');
}
