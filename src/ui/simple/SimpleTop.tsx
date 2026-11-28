/**
 * Simple mode's top of the screen: small paper pills instead of cards.
 * Details (weather, the goal) open when clicked and close on click-away.
 * The biome pill went in the UI overhaul (35, section 2): the map's plaque
 * already says it.
 */
import { useRef, useState } from 'react';
import { PHASES, type GameState, type Phase } from '../../engine';
import { Icon } from '../icons/Icon';
import { AbundanceBar } from '../panels/AbundanceBar';
import type { IconName } from '../icons/paths';
import { Popout } from '../panels/Popout';
import { WEATHER_COLOR, WEATHER_ICON, weatherNote } from '../weather/weatherLook';
import { WEATHERS } from '../../content/weather';
import styles from './Simple.module.css';

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
          {[today].map(
            (e) =>
              e.node && (
                <span key={e.name} className={styles.info}>
                  {e.line}
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
            in a later update.
          </span>
        </Popout>
      )}
    </>
  );
}

/** The Abundance bar (just the bar in Simple mode), then the party's caps. */
export function CapsPill({ state }: { state: GameState }) {
  return (
    <div className={styles.pill} style={{ right: 80, top: 16 }}>
      <AbundanceBar level={state.abundance} showNumber={false} width={110} />
      <span className={styles.capsPart} title="Acorn caps: the party purse">
        <Icon name="acorn" size={18} color="#D9A86A" />
        <span className={styles.capsCount}>{state.caps}</span>
      </span>
    </div>
  );
}
