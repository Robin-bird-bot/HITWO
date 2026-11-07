/**
 * Simple mode's top of the screen: small pills instead of cards. Details
 * (weather, the goal) open when clicked and close on click-away.
 */
import { useRef, useState } from 'react';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { NODE_TYPES, PHASES, type BiomeId, type GameState, type Phase } from '../../engine';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { NODE_NAME } from '../map/looks';
import { Popout } from '../panels/Popout';
import { WEATHER_COLOR, WEATHER_ICON, weatherNote } from '../weather/weatherLook';
import { WEATHERS } from '../../content/weather';
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

/** "DAY 2" with the three phase icons, and the weather as an icon you can click. */
export function DayPill({ state }: { state: GameState }) {
  const [weatherOpen, setWeatherOpen] = useState(false);
  const today = WEATHERS[state.weather.today];
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
          aria-label={`Weather: ${today.title.toLowerCase()}. Show the forecast`}
          aria-expanded={weatherOpen}
          onClick={() => setWeatherOpen((o) => !o)}
        >
          <Icon
            name={WEATHER_ICON[state.weather.today]}
            size={18}
            color={WEATHER_COLOR[state.weather.today]}
          />
        </button>
      </div>
      {weatherOpen && (
        <Popout
          label="Weather"
          dragId="weather"
          className={styles.popout}
          style={{ left: 768 - 130, top: 112, width: 260 }}
          ignore={[buttonRef]}
          onClose={() => setWeatherOpen(false)}
        >
          <span className={styles.infoTitle} data-drag-handle>
            {today.title.toUpperCase()}
          </span>
          <span className={styles.info}>{weatherNote(state)}.</span>
          {[today.hiker, today.node].map(
            (e) =>
              e && (
                <span key={e.name} className={styles.info}>
                  <b>{e.name}:</b> {e.text}
                </span>
              ),
          )}
          <div className={styles.forecast} aria-label="The next 3 days">
            {state.weather.ahead.slice(0, 3).map((w, i) => (
              <div key={i} className={styles.forecastDay} title={WEATHERS[w].title}>
                <Icon name={WEATHER_ICON[w]} size={16} color={WEATHER_COLOR[w]} />
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
          dragId="goal"
          className={styles.popout}
          style={{ left: 768 - 140, top: 110, width: 280 }}
          ignore={[buttonRef]}
          onClose={() => setOpen(false)}
        >
          <span className={styles.infoTitle} data-drag-handle>
            PARTY GOAL
          </span>
          <span className={styles.info}>
            Each section you’ll pick one party goal, shown here with its progress. Objectives arrive
            in Phase 12.
          </span>
        </Popout>
      )}
    </>
  );
}

/** Caps, plus a warning on any node whose Abundance is running low. */
export function CapsPill({ state }: { state: GameState }) {
  const low = NODE_TYPES.filter((n) => state.abundance[n] <= BALANCE.abundance.lowAt);
  return (
    <div className={styles.pill} style={{ right: 80, top: 16 }} title="Acorn caps: the party purse">
      {low.map((n) => (
        <span
          key={n}
          className={styles.lowNode}
          title={`${NODE_NAME[n]} Abundance is low (${state.abundance[n]}/${BALANCE.abundance.max})`}
        >
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
