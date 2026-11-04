/**
 * The cards along the top of the game screen (docs/mockups/Main.dc.html):
 * biome, day and phase with weather, the objective, and Abundance with caps.
 */
import { useState } from 'react';
import { ASSETS } from '../../config/assets';
import { NODE_TYPES, PHASES, type BiomeId, type GameState, type Phase } from '../../engine';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { NODE_NAME } from '../map/looks';
import { Panel } from './Panel';
import { usePanelCollapsed } from './panelState';
import panel from './Panel.module.css';
import styles from './TopBar.module.css';

const BIOME_NAME: Record<BiomeId, string> = {
  meadow: 'Meadow',
  temperateRainforest: 'Temperate Rainforest',
  alpine: 'Alpine',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const SECTIONS = 3;

export function BiomeCard({ state }: { state: GameState }) {
  const { biome, tier } = state.section;
  return (
    <Panel
      id="biome"
      label="biome card"
      className={styles.biomeCard}
      style={{ left: 16, top: 16, width: 288 }}
      title={<span className={styles.kicker}>HIKE IN THE WOODS</span>}
    >
      <div className={styles.biomeRow}>
        <span className={styles.biome}>{BIOME_NAME[biome].toUpperCase()}</span>
        <div className={styles.dashes} aria-hidden="true">
          {Array.from({ length: SECTIONS }, (_, i) => (
            <span key={i} data-done={i <= state.sectionIndex} />
          ))}
        </div>
      </div>
      <span className={styles.small}>
        Section {state.sectionIndex + 1} of {SECTIONS} · Tier {ROMAN[tier - 1] ?? tier}
      </span>
    </Panel>
  );
}

const PHASE_LOOK: Record<Phase, { label: string; icon: IconName }> = {
  morning: { label: 'MORNING', icon: 'sunrise' },
  afternoon: { label: 'AFTERNOON', icon: 'sun' },
  night: { label: 'NIGHT', icon: 'moon' },
};

// Placeholder weather until Phase 6 brings real weather and forecasts.
const FORECAST: IconName[] = ['sun', 'cloud', 'rain'];

export function DayBar({ state }: { state: GameState }) {
  // The bar is one row, so shrinking it keeps just the day and the current phase.
  const [collapsed] = usePanelCollapsed('day');
  const phases = collapsed ? PHASES.filter((p) => p === state.phase) : PHASES;
  return (
    <Panel
      id="day"
      label="day and weather"
      style={{ left: 470, top: 16, width: collapsed ? 'auto' : 580 }}
      className={styles.dayBar}
      title={
        <>
          <span className={styles.day}>DAY {state.day}</span>
          <div className={styles.phases}>
            {phases.map((p) => (
              <div
                key={p}
                className={styles.phase}
                data-current={p === state.phase}
                aria-current={p === state.phase ? 'step' : undefined}
              >
                <Icon name={PHASE_LOOK[p].icon} size={15} />
                <span>{PHASE_LOOK[p].label}</span>
              </div>
            ))}
          </div>
          {!collapsed && (
            <>
              <span className={styles.divider} />
              <div className={styles.weather} title="Weather arrives in Phase 6 (placeholder)">
                <Icon name="sun" size={20} color="#F2C978" />
                <div className={styles.weatherText}>
                  <span className={styles.weatherName}>Clear skies</span>
                  <span className={styles.small}>Placeholder</span>
                </div>
              </div>
              <span className={styles.divider} />
              <div
                className={styles.forecast}
                title="3-day forecast arrives in Phase 6 (placeholder)"
              >
                {FORECAST.map((icon, i) => (
                  <div key={i} className={styles.forecastDay}>
                    <Icon name={icon} size={15} color="#C9C2B2" />
                    <span>D{state.day + i + 1}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      }
    />
  );
}

export function ObjectiveCard() {
  return (
    <Panel
      id="objective"
      label="objective"
      style={{ left: 1004, top: 84, width: 220 }}
      title={<span className={panel.label}>OBJECTIVE</span>}
      aside={<span className={styles.tierTag}>SOON</span>}
    >
      <span className={styles.objectiveName}>PARTY GOAL</span>
      <span className={styles.objectiveText}>
        Each section you’ll pick one party goal here. Objectives arrive in Phase 12.
      </span>
    </Panel>
  );
}

/** Placeholder Abundance until Phase 4 adds the meters to the game. */
const PLACEHOLDER_ABUNDANCE = 0.75;

export function AbundanceCard({ state }: { state: GameState }) {
  return (
    <Panel
      id="abundance"
      label="Abundance and caps"
      style={{ left: 1240, top: 16, width: 280 }}
      title={<span className={panel.label}>ABUNDANCE</span>}
      aside={
        <span className={styles.caps} title="Acorn caps: the party purse">
          <Icon name="acorn" size={16} color="#D9A86A" />
          <span className={styles.capsCount}>{state.caps}</span>
          <span>caps</span>
        </span>
      }
    >
      <div className={styles.meters} title="Abundance arrives in Phase 4 (placeholder meters)">
        {NODE_TYPES.map((n) => (
          <div
            key={n}
            className={styles.meter}
            aria-label={`${NODE_NAME[n]} Abundance (placeholder)`}
          >
            <img src={ASSETS.nodes[n]} alt="" width={20} height={23} />
            <div className={styles.track}>
              <div style={{ width: `${PLACEHOLDER_ABUNDANCE * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function MenuButton({ onTitle }: { onTitle(): void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.menuWrap}>
      <button
        type="button"
        className={styles.menu}
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="menu" size={22} />
      </button>
      {open && (
        <div className={styles.menuList} role="menu">
          <button type="button" role="menuitem" className={styles.menuItem} onClick={onTitle}>
            Title screen
          </button>
          <span className={styles.small}>Your hike is saved after every action.</span>
        </div>
      )}
    </div>
  );
}
