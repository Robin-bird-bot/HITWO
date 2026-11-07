import { useState } from 'react';
import type { GameState } from '../../engine';
import { Panel } from '../panels/Panel';
import { usePanelCollapsed } from '../panels/panelState';
import panel from '../panels/Panel.module.css';
import { describeLog } from './describeLog';
import styles from './TrailLog.module.css';

/** The last few things that happened, in plain words. Collapsible, with a "N new" count. */
export function TrailLog({ state }: { state: GameState }) {
  const [collapsed] = usePanelCollapsed('log');
  const lines = describeLog(state);
  const newest = lines.at(-1)?.id ?? 0;
  const [seen, setSeen] = useState(newest);

  // While the log is open, everything in it counts as read. (Updating state
  // during render like this is React's pattern for state derived from props.)
  if (!collapsed && seen !== newest) setSeen(newest);

  const unread = lines.filter((l) => l.id > seen).length;
  return (
    <Panel
      id="log"
      movable
      label="trail log"
      style={{ left: 320, bottom: 16, width: collapsed ? 220 : 440, maxHeight: 320 }}
      title={
        <span className={panel.label}>
          TRAIL LOG{collapsed && unread ? ` · ${unread} NEW` : ''}
        </span>
      }
    >
      <ol className={styles.list} aria-live="polite">
        {lines.length === 0 && <li className={styles.empty}>Nothing yet. The hike begins!</li>}
        {lines.map((l) => (
          <li key={`${l.id}-${l.part ?? 0}`} className={styles.line} data-tone={l.tone}>
            {l.text}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
