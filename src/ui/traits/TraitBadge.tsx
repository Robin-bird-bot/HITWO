/**
 * One trait badge (docs/mockups/TraitBadges.dc.html): a diamond for an
 * always-on trait, a circle for a usable one, a faint outline for an empty
 * slot. The ring is the type's color and the middle a darker shade, with
 * Wyatt's icon in the ring color, filling the shape (initials for a trait
 * with no icon file yet). A ready
 * trait glows slowly; a used one is grey; one only usable during something
 * has a tab naming it. Hover a moment (or long-press) for its window.
 */
import type { CSSProperties, MouseEvent } from 'react';
import type { SlotType } from '../../engine';
import { usePreview, withPreview } from '../preview/preview';
import { BADGE_COLORS, badgeColors, WARNING_FILL, type BadgeInfo } from './badges';
import styles from './TraitBadge.module.css';
import { traitIconUrl } from './traitIcons';

/** An empty slot's outline: its type's color, or a blend for a mixed slot. */
const SLOT_OUTLINE: Record<SlotType, string> = {
  T: BADGE_COLORS.T.ring,
  U: BADGE_COLORS.U.ring,
  M: BADGE_COLORS.M.ring,
  'T/U': `linear-gradient(90deg, ${BADGE_COLORS.T.ring} 50%, ${BADGE_COLORS.U.ring} 50%)`,
  'T/M': `linear-gradient(90deg, ${BADGE_COLORS.T.ring} 50%, ${BADGE_COLORS.M.ring} 50%)`,
  'U/M': `linear-gradient(90deg, ${BADGE_COLORS.U.ring} 50%, ${BADGE_COLORS.M.ring} 50%)`,
  W: `linear-gradient(90deg, ${BADGE_COLORS.T.ring} 33%, ${BADGE_COLORS.U.ring} 33% 66%, ${BADGE_COLORS.M.ring} 66%)`,
  tag: '#E9B44C',
};

/** The icon: Wyatt's art as a mask in the ring color, else the trait's initials. */
function BadgeIcon({ badge }: { badge: BadgeInfo }) {
  const src = badge.traitId ? traitIconUrl(badge.traitId) : undefined;
  if (src) {
    const url = `url(${src})`;
    return (
      <span
        className={styles.icon}
        style={{ maskImage: url, WebkitMaskImage: url, backgroundColor: 'var(--ring)' }}
      />
    );
  }
  return <span className={styles.initials}>{badge.initials}</span>;
}

export function TraitBadge({
  badge,
  size = 'small',
  showName = false,
  showTab = false,
  as = 'button',
  onUse,
}: {
  badge: BadgeInfo;
  /** Small in the hiker panel's row; large in the Abilities panel. */
  size?: 'small' | 'large';
  /** The name in small text under the icon (Informative view). */
  showName?: boolean;
  /** The tab under a usable badge: uses left as dots, or what it's only usable during. */
  showTab?: boolean;
  /** A span inside something that's already a button (Simple mode's hiker card). */
  as?: 'button' | 'span';
  /** A usable badge was tapped: open the Abilities panel at it. */
  onUse?(abilityId: string): void;
}) {
  const colors = badgeColors(badge);
  const usable = badge.shape === 'circle';
  // Always-on badges open their window on a click too; usable ones open the Abilities panel.
  const preview = usePreview({ kind: 'trait', badge }, { clickOpens: !usable || !onUse });
  // Trait warnings: a green or red middle for Morale about to change.
  const fill = badge.morale
    ? badge.morale.delta > 0
      ? WARNING_FILL.gain
      : WARNING_FILL.loss
    : colors.fill;
  const vars = { '--ring': colors.ring, '--fill': fill } as CSSProperties;
  const label = `${badge.name}: ${badge.kindWord}. ${badge.text}${badge.status ? ` ${badge.status.text}` : ''}`;
  const own = {
    // A tap is the badge's own: it doesn't also pick the hiker card it sits on.
    onClick: (e: MouseEvent<Element>) => {
      e.stopPropagation();
      if (usable && onUse && badge.abilityId) onUse(badge.abilityId);
    },
  };
  const handlers = withPreview(own, preview);
  const body = (
    <>
      <span
        className={styles.shape}
        data-shape={badge.shape}
        data-state={badge.state}
        data-idle={badge.working === false || undefined}
      >
        {badge.shape === 'empty' ? (
          <span className={styles.outline} style={{ background: SLOT_OUTLINE[badge.slotType] }} />
        ) : (
          <span className={styles.face}>
            <BadgeIcon badge={badge} />
          </span>
        )}
        {badge.morale && (
          <span className={styles.bubble} data-tone={badge.morale.delta > 0 ? 'gain' : 'loss'}>
            {badge.morale.delta > 0 ? '+' : '−'}
            {Math.abs(badge.morale.delta)}
          </span>
        )}
        {showTab && usable && (badge.during || badge.usesMax) && (
          <span className={styles.tab}>
            {badge.during ??
              Array.from({ length: Math.min(badge.usesMax ?? 0, 4) }, (_, i) => (
                <span key={i} className={styles.pip} data-on={i < (badge.usesLeft ?? 0)} />
              ))}
          </span>
        )}
      </span>
      {showName && (
        <span className={styles.name} style={{ color: badge.type ? colors.ring : '#6F6A60' }}>
          {badge.shape === 'empty' ? 'EMPTY' : badge.name.toUpperCase()}
        </span>
      )}
    </>
  );
  const common = {
    className: styles.badge,
    'data-size': size,
    style: vars,
    'aria-label': label,
    ...handlers,
  };
  return as === 'button' ? (
    <button type="button" {...common}>
      {body}
    </button>
  ) : (
    <span {...common}>{body}</span>
  );
}

/** A hiker's badges in a row. */
export function TraitBadgeRow({
  badges,
  showNames = false,
  as = 'button',
  onUse,
}: {
  badges: readonly BadgeInfo[];
  showNames?: boolean;
  as?: 'button' | 'span';
  onUse?(abilityId: string): void;
}) {
  if (!badges.length) return null;
  return (
    <span className={styles.row} data-names={showNames || undefined}>
      {badges.map((b) => (
        <TraitBadge
          key={b.slot}
          badge={b}
          showName={showNames}
          as={as}
          {...(onUse ? { onUse } : {})}
        />
      ))}
    </span>
  );
}
