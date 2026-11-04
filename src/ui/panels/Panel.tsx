import type { CSSProperties, ReactNode } from 'react';
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
  children,
}: PanelProps) {
  const [collapsed, toggle] = usePanelCollapsed(id);
  const { height, ...rest } = style;
  return (
    <Tag
      className={`${styles.panel} ${className ?? ''}`}
      style={{ ...rest, height: collapsed ? 'auto' : height }}
      data-collapsed={collapsed}
      aria-label={label}
    >
      <header className={styles.header}>
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
