import type { CSSProperties, ReactNode } from 'react';
import { useDraggable } from '../windows/useDraggable';
import type { WindowId } from '../windows/windowLayout';
import { usePanelCollapsed, type PanelId } from './panelState';
import styles from './Panel.module.css';

interface PanelProps {
  id: PanelId;
  /** Left side of the header row (always visible). */
  title: ReactNode;
  /** Right side of the header row, before the − / + button. */
  aside?: ReactNode;
  /** Name used for the button's label, e.g. "party". */
  label: string;
  /** Position and size on the stage. Height applies only when open; use `bottom` to grow upward. */
  style: CSSProperties;
  className?: string;
  as?: 'section' | 'aside';
  /** Can be dragged by its header (party, turn panel, trail log). */
  movable?: boolean;
  children?: ReactNode;
}

/** A floating dark panel with a − button that shrinks it to its header (+ to restore). */
export function Panel({
  id,
  title,
  aside,
  label,
  style,
  className,
  as: Tag = 'section',
  movable,
  children,
}: PanelProps) {
  const [collapsed, toggle] = usePanelCollapsed(id);
  const { ref, windowProps, translate } = useDraggable<HTMLElement>(
    movable ? (id as WindowId) : undefined,
  );
  const { height, ...rest } = style;
  return (
    <Tag
      ref={ref}
      className={`${styles.panel} ${className ?? ''}`}
      style={{ ...rest, height: collapsed ? 'auto' : height, translate }}
      data-collapsed={collapsed}
      aria-label={label}
      {...windowProps}
    >
      <header
        className={styles.header}
        data-drag-handle={movable ? '' : undefined}
        title={movable ? 'Drag to move. Double-click to put it back.' : undefined}
      >
        <div className={styles.title}>{title}</div>
        {aside && <div className={styles.aside}>{aside}</div>}
        <button
          type="button"
          className={styles.toggle}
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Show ${label}` : `Shrink ${label}`}
          title={collapsed ? 'Show' : 'Shrink'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </header>
      {!collapsed && children}
    </Tag>
  );
}
