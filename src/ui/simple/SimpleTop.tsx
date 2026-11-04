/**
 * Simple mode's top of the screen: small pills instead of cards. Details
 * (weather, the goal) open when clicked and close on click-away.
 */
import { useRef, useState } from 'react';
import { ASSETS } from '../../config/assets';
import {
  NODE_TYPES,
  PHASES,
  type BiomeId,
  type GameState,
  type NodeType,
  type Phase,
} from '../../engine';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { NODE_NAME } from '../map/looks';
import { Popout } from '../panels/Popout';
import styles from './Simple.module.css';

const BIOME: Record<BiomeId, string> = {
  meadow: 'MEADOW',
  temperateRainforest: 'RAINFOREST',
  alpine: 'ALPINE',
};
const SECTIONS = 3;

/** "MEADOW · 1/3" */
export function BiomePill({ state }: { state: GameState }) {
  return (
    <div
      className={styles.pill}
      style={{ left: 16, top: 16 }}
      title={`Section ${state.sectionIndex + 1} of ${SECTIONS} · Tier ${state.section.tier}`}
    >
      {BIOME[state.section.biome]} · {state.sectionIndex + 1}/{SECTIONS}
    </div>
  );
}

const PHASE_ICON: Record<Phase, { icon: IconName; name: string }> = {
  morning: { icon: 'sunrise', name: 'Morning' },
  afternoon: { icon: 'sun', name: 'Afternoon' },
  night: { icon: 'moon', name: 'Night' },
};

// Placeholder weather until Phase 6.
const FORECAST: IconName[] = ['sun', 'cloud', 'rain'];
const FORECAST_NAME: Record<string, string> = { sun: 'Clear', cloud: 'Cloudy', rain: 'Rain' };

/** "DAY 2" with the three phase icons, and the weather as an icon you can click. */
export function DayPill({ state }: { state: GameState }) {
  const [weatherOpen, setWeatherOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div
        className={`${styles.pill} ${styles.centered}`}
        style={{ left: 768, top: 16 }}
        aria-label={`Day ${state.day}, ${PHASE_ICON[state.phase].name}`}
      >
        <span className={styles.day}>DAY {state.day}</span>
        {PHASES.map((p) => (
          <span
            key={p}
            className={styles.phaseIcon}
            data-current={p === state.phase}
            title={PHASE_ICON[p].name}
            aria-current={p === state.phase ? 'step' : undefined}
          >
            <Icon name={PHASE_ICON[p].icon} size={16} />
          </span>
        ))}
        <span className={styles.divider} />
        <button
          ref={buttonRef}
          type="button"
          className={styles.weatherButton}
          aria-label="Weather: clear skies. Show the forecast"
          aria-expanded={weatherOpen}
          onClick={() => setWeatherOpen((o) => !o)}
        >
          <Icon name="sun" size={18} color="#F2C978" />
        </button>
      </div>
      {weatherOpen && (
        <Popout
          label="Weather"
          className={styles.popout}
          style={{ left: 768 - 130, top: 68, width: 260 }}
          ignore={[buttonRef]}
          onClose={() => setWeatherOpen(false)}
        >
          <span className={styles.infoTitle}>CLEAR SKIES</span>
          <span className={styles.info}>
            No weather effects today. (Placeholder: weather arrives in Phase 6.)
          </span>
          <div className={styles.forecast}>
            {FORECAST.map((icon, i) => (
              <div key={i} className={styles.forecastDay} title={FORECAST_NAME[icon]}>
                <Icon name={icon} size={16} color="#C9C2B2" />
                <span>D{state.day + i + 1}</span>
              </div>
            ))}
          </div>
        </Popout>
      )}
    </>
  );
}

/** A small "GOAL" pill under the day; the party goal opens when clicked. */
export function GoalPill() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div
        className={`${styles.pill} ${styles.centered} ${styles.goal}`}
        style={{ left: 768, top: 68 }}
      >
        <button
          ref={buttonRef}
          type="button"
          className={styles.pillButton}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="star" size={13} color="#CDA6EE" />
          GOAL · SOON
        </button>
      </div>
      {open && (
        <Popout
          label="Party goal"
          className={styles.popout}
          style={{ left: 768 - 140, top: 110, width: 280 }}
          ignore={[buttonRef]}
          onClose={() => setOpen(false)}
        >
          <span className={styles.infoTitle}>PARTY GOAL</span>
          <span className={styles.info}>
            Each section you’ll pick one party goal, shown here with its progress. Objectives arrive
            in Phase 12.
          </span>
        </Popout>
      )}
    </>
  );
}

/** Below this share of full, a node's Abundance shows as a warning. TODO(wyatt): Phase 4 sets it. */
const LOW_ABUNDANCE = 0.4;
// Placeholder Abundance until Phase 4 adds the meters to the game.
const PLACEHOLDER_ABUNDANCE: Record<NodeType, number> = {
  forest: 0.75,
  river: 0.75,
  wildlife: 0.75,
  mountain: 0.75,
};

/** Caps, plus a warning on any node whose Abundance is running low. */
export function CapsPill({ state }: { state: GameState }) {
  const low = NODE_TYPES.filter((n) => PLACEHOLDER_ABUNDANCE[n] <= LOW_ABUNDANCE);
  return (
    <div className={styles.pill} style={{ right: 80, top: 16 }} title="Acorn caps: the party purse">
      {low.map((n) => (
        <span key={n} className={styles.lowNode} title={`${NODE_NAME[n]} Abundance is low`}>
          <img
            src={ASSETS.nodes[n]}
            alt={`${NODE_NAME[n]} Abundance is low`}
            width={20}
            height={23}
          />
          <span aria-hidden="true">!</span>
        </span>
      ))}
      <Icon name="acorn" size={18} color="#D9A86A" />
      <span className={styles.capsCount}>{state.caps}</span>
    </div>
  );
}
