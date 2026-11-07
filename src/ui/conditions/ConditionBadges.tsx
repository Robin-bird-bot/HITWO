/**
 * Condition badges (Phase 6, step 1 mockup).
 *
 * - Pill (Informative cards): icon, name and time left, so it reads without
 *   hovering. A stack count sits on its corner.
 * - Dot (Simple cards and tight spots): a bigger round icon with the time
 *   left (or the stacks) as a corner number.
 * - Row (the selected hiker's full list): badge, name, what it does, time.
 * - Every badge shows a one-line description on hover, keyboard focus or tap.
 */
import { Icon } from '../icons/Icon';
import { TONE_LOOK, type ConditionLook } from './conditionLook';
import styles from './ConditionBadges.module.css';

function Tip({ look }: { look: ConditionLook }) {
  return (
    <span className={styles.tip} role="tooltip">
      <span className={styles.tipName}>
        {look.name.toUpperCase()}
        {look.stacks !== undefined && ` ×${look.stacks}`}
      </span>
      <span className={styles.tipText}>{look.text}</span>
      {look.long && <span className={styles.tipTime}>{look.long}</span>}
    </span>
  );
}

const describe = (l: ConditionLook) =>
  `${l.name}${l.stacks !== undefined ? ` ×${l.stacks}` : ''}: ${l.text}${l.long ? ` (${l.long})` : ''}`;

export function ConditionPill({ look, open }: { look: ConditionLook; open?: boolean }) {
  const tone = TONE_LOOK[look.tone];
  return (
    <span
      className={styles.pill}
      data-tone={look.tone}
      data-open={open || undefined}
      tabIndex={0}
      aria-label={describe(look)}
      style={{ borderColor: tone.ring, background: tone.bg, color: tone.fg }}
    >
      <Icon name={look.icon} size={14} strokeWidth={2.5} solid={look.tone === 'injury'} />
      <span className={styles.pillName}>{look.name.toUpperCase()}</span>
      {look.short && <span className={styles.pillTime}>{look.short}</span>}
      {look.stacks !== undefined && <span className={styles.stack}>×{look.stacks}</span>}
      <Tip look={look} />
    </span>
  );
}

export function ConditionDot({
  look,
  size = 34,
  open,
}: {
  look: ConditionLook;
  size?: number;
  /** Mockup only: show the description without hovering. */
  open?: boolean;
}) {
  const tone = TONE_LOOK[look.tone];
  const corner = look.stacks !== undefined ? `×${look.stacks}` : look.short;
  return (
    <span
      className={styles.dot}
      data-tone={look.tone}
      data-open={open || undefined}
      tabIndex={0}
      aria-label={describe(look)}
      style={{
        width: size,
        height: size,
        borderColor: tone.ring,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      <Icon
        name={look.icon}
        size={Math.round(size * 0.52)}
        strokeWidth={2.4}
        solid={look.tone === 'injury'}
      />
      {corner && (
        <span className={styles.corner} data-stack={look.stacks !== undefined}>
          {corner}
        </span>
      )}
      <Tip look={look} />
    </span>
  );
}

export function ConditionRow({ look }: { look: ConditionLook }) {
  return (
    <div className={styles.row}>
      <ConditionDot look={{ ...look, short: undefined }} size={30} />
      <div className={styles.rowText}>
        <span className={styles.rowName}>
          {look.name.toUpperCase()}
          {look.stacks !== undefined && <span className={styles.rowStack}>×{look.stacks}</span>}
        </span>
        <span className={styles.rowEffect}>{look.text}</span>
      </div>
      {look.long && <span className={styles.rowTime}>{look.long}</span>}
    </div>
  );
}
