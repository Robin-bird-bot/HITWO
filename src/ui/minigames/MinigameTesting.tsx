/**
 * The Minigame testing tab (docs/design/10-minigames.md, section 5;
 * 11-minigames-puzzles.md, "Testing tab"; docs/mockups/minigames/8-testing-tab-reference.jpg),
 * from the main menu.
 *
 * - **Left:** every minigame. Bearrels and the four puzzle games play; the
 *   others are "coming soon".
 * - **Right:** the minigame's settings (Bearrels' art style, steppers and
 *   shot buttons; the puzzle games' Tier and overrides, where Auto uses the
 *   tier's value; hiker toggles), a preview, and Test it, which opens its
 *   pop-up in test mode (no Prepare), then the game on the turned party GPS.
 *   While playing Bearrels, the Style button and the S key switch the art
 *   style; the change is remembered here too.
 *
 * Settings are remembered on this device. Nothing touches the saved hike,
 * XP, stats or anything else in a run.
 */
import { useState, type CSSProperties } from 'react';
import {
  BEAR_COUNTRY,
  testChallenge,
  type MinigameChallenge,
} from '../../content/minigameChallenges';
import { emptyScene, type SceneModel } from '../../minigames/bearrels/scene';
import { toArtStyle } from '../../minigames/bearrels/styles';
import { MINIGAMES } from '../../minigames/catalog';
import { minigameHiker } from '../../minigames/hikers';
import type { MinigameInfo, MinigameSetting, MinigameSettings } from '../../minigames/types';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { MinigameIcon } from './MinigameIcon';
import { BearrelsScene, ScaledScreen } from './bearrels/Scene';
import { MinigameFlow } from './MinigameFlow';
import { PREVIEWS } from './runners';
import {
  browserStorage,
  readTestingSettings,
  TEST_HIKERS,
  writeTestingSettings,
} from './testingSettings';
import styles from './MinigameTesting.module.css';

/** The challenge a playable minigame opens in test mode: Bear Country for Bearrels; for the rest, a plain one with their name. */
function challengeFor(
  info: MinigameInfo,
  settings: MinigameSettings,
): MinigameChallenge | undefined {
  if (info.status !== 'ready') return undefined;
  if (info.id === 'bearrels') return BEAR_COUNTRY;
  const t = settings.tier;
  return testChallenge(info, t === 2 || t === 3 ? t : 1);
}

const picked = (s: MinigameSettings, id: string): readonly string[] => {
  const v = s[id];
  return Array.isArray(v) ? v : [];
};

export function MinigameTesting({ onBack }: { onBack(): void }) {
  const [activeId, setActiveId] = useState('bearrels');
  const active = MINIGAMES.find((m) => m.id === activeId) ?? MINIGAMES[0]!;
  const [settings, setSettings] = useState<MinigameSettings>(() =>
    readTestingSettings(browserStorage(), active.id),
  );
  const [testing, setTesting] = useState(false);
  const update = (next: MinigameSettings) => {
    setSettings(next);
    writeTestingSettings(browserStorage(), active.id, next);
  };
  const challenge = challengeFor(active, settings);
  const hikerIds = picked(settings, 'hikers');
  const hikers = hikerIds.map((id) => minigameHiker(id));

  return (
    <div className={styles.backdrop}>
      <section className={styles.window} aria-label="Minigame testing">
        <header className={styles.banner}>
          <button type="button" className={styles.back} onClick={onBack}>
            ← Main menu
          </button>
          <h1 className={styles.title}>MINIGAME TESTING</h1>
          <span className={styles.spacer} />
        </header>
        <div className={styles.body}>
          <nav className={styles.list} aria-label="Minigames">
            <span className={styles.label}>MINIGAMES</span>
            {MINIGAMES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.item}
                data-active={m.id === active.id || undefined}
                data-soon={m.status === 'soon' || undefined}
                disabled={m.status === 'soon'}
                aria-current={m.id === active.id || undefined}
                onClick={() => {
                  setActiveId(m.id);
                  setSettings(readTestingSettings(browserStorage(), m.id));
                }}
              >
                <MinigameIcon id={m.id} size={24} />
                <span className={styles.itemWords}>
                  <span className={styles.itemName}>{m.name}</span>
                  <span className={styles.itemSub}>
                    {m.baseGame}
                    {m.status === 'soon' ? ' · coming soon' : ''}
                  </span>
                </span>
              </button>
            ))}
          </nav>

          <div className={styles.detail}>
            <h2 className={styles.name}>{active.name}</h2>
            <p className={styles.description}>{active.description}</p>

            {active.settings
              .filter((s): s is Extract<MinigameSetting, { kind: 'style' }> => s.kind === 'style')
              .map((s) => (
                <StyleChoice key={s.id} setting={s} settings={settings} onChange={update} />
              ))}

            <div className={styles.settings}>
              {active.settings
                .filter(
                  (s) =>
                    s.kind === 'range' ||
                    s.kind === 'choice' ||
                    s.kind === 'pick' ||
                    s.kind === 'autoRange',
                )
                .map((s) => (
                  <Setting key={s.id} setting={s} settings={settings} onChange={update} />
                ))}
            </div>

            {active.settings
              .filter((s): s is Extract<MinigameSetting, { kind: 'hikers' }> => s.kind === 'hikers')
              .map((s) => (
                <HikerToggles key={s.id} setting={s} settings={settings} onChange={update} />
              ))}

            {challenge && (
              <>
                <span className={styles.label}>PREVIEW</span>
                <div className={styles.previewRow}>
                  <Preview info={active} settings={settings} />
                  <div className={styles.testBox}>
                    <p className={styles.testNote}>
                      Opens the {challenge.name} pop-up, then the game. Nothing is saved.
                    </p>
                    <button
                      type="button"
                      className={styles.test}
                      disabled={!challenge || hikers.length === 0}
                      onClick={() => setTesting(true)}
                    >
                      TEST IT
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      {testing && challenge && (
        <MinigameFlow
          challenge={challenge}
          hikers={hikers}
          settings={settings}
          testMode
          onBack={() => setTesting(false)}
          onSettingsChange={update}
        />
      )}
    </div>
  );
}

/**
 * A − / + stepper; a row of number buttons (Shots per round: 1 or 2; Tier:
 * I, II, III); or a row of named buttons (the overrides: Auto, On, Off…).
 */
function Setting({
  setting: s,
  settings,
  onChange,
}: {
  setting: MinigameSetting;
  settings: MinigameSettings;
  onChange(next: MinigameSettings): void;
}) {
  if (s.kind === 'hikers' || s.kind === 'style') return null;
  const given = settings[s.id];
  if (s.kind === 'autoRange') {
    // Auto, then min to max: − below the minimum goes back to Auto.
    const step = s.step ?? 1;
    const auto = typeof given !== 'number';
    const value = auto ? null : given;
    const set = (v: number | 'auto') => onChange({ ...settings, [s.id]: v });
    return (
      <div className={styles.setting}>
        <span className={styles.label}>{s.label.toUpperCase()}</span>
        <div className={styles.stepper} role="group" aria-label={s.label}>
          <button
            type="button"
            aria-label={`Less ${s.label.toLowerCase()}`}
            disabled={auto}
            onClick={() => set(value === null || value - step < s.min ? 'auto' : value - step)}
          >
            −
          </button>
          <span aria-live="polite" data-auto={auto || undefined}>
            {auto ? 'AUTO' : value}
          </span>
          <button
            type="button"
            aria-label={`More ${s.label.toLowerCase()}`}
            disabled={value !== null && value >= s.max}
            onClick={() => set(value === null ? s.min : Math.min(s.max, value + step))}
          >
            +
          </button>
        </div>
        <span className={styles.hint}>{s.hint}</span>
      </div>
    );
  }
  if (s.kind === 'pick') {
    const value = typeof given === 'string' ? given : s.default;
    return (
      <div className={styles.setting}>
        <span className={styles.label}>{s.label.toUpperCase()}</span>
        <div className={`${styles.choice} ${styles.pick}`} role="radiogroup" aria-label={s.label}>
          {s.options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={value === o.id}
              data-on={value === o.id || undefined}
              onClick={() => onChange({ ...settings, [s.id]: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
        {s.hint && <span className={styles.hint}>{s.hint}</span>}
      </div>
    );
  }
  const value = typeof given === 'number' ? given : s.default;
  const set = (n: number) => onChange({ ...settings, [s.id]: n });
  return (
    <div className={styles.setting}>
      <span className={styles.label}>{s.label.toUpperCase()}</span>
      {s.kind === 'range' ? (
        <div className={styles.stepper} role="group" aria-label={s.label}>
          <button
            type="button"
            aria-label={`Fewer ${s.label.toLowerCase()}`}
            disabled={value <= s.min}
            onClick={() => set(value - 1)}
          >
            −
          </button>
          <span aria-live="polite">{value}</span>
          <button
            type="button"
            aria-label={`More ${s.label.toLowerCase()}`}
            disabled={value >= s.max}
            onClick={() => set(value + 1)}
          >
            +
          </button>
        </div>
      ) : (
        <div className={styles.choice} role="radiogroup" aria-label={s.label}>
          {s.options.map((o, i) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={value === o}
              data-on={value === o || undefined}
              onClick={() => set(o)}
            >
              {s.labels?.[i] ?? o}
            </button>
          ))}
        </div>
      )}
      <span className={styles.hint}>{s.hint}</span>
    </div>
  );
}

/** The art style: a row of named buttons, above the other settings. */
function StyleChoice({
  setting: s,
  settings,
  onChange,
}: {
  setting: Extract<MinigameSetting, { kind: 'style' }>;
  settings: MinigameSettings;
  onChange(next: MinigameSettings): void;
}) {
  const value = typeof settings[s.id] === 'string' ? settings[s.id] : s.default;
  return (
    <div className={`${styles.setting} ${styles.styleSetting}`}>
      <span className={styles.label}>{s.label.toUpperCase()}</span>
      <div
        className={`${styles.choice} ${styles.styleChoice}`}
        role="radiogroup"
        aria-label={s.label}
      >
        {s.options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            data-on={value === o.id || undefined}
            onClick={() => onChange({ ...settings, [s.id]: o.id })}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Portrait toggles for the playable hikers: up to 4, unpicked ones dimmed. */
function HikerToggles({
  setting: s,
  settings,
  onChange,
}: {
  setting: Extract<MinigameSetting, { kind: 'hikers' }>;
  settings: MinigameSettings;
  onChange(next: MinigameSettings): void;
}) {
  const on = picked(settings, s.id);
  const toggle = (id: string) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    if (next.length < s.min || next.length > s.max) return;
    // Kept in the tab's order, so tokens line up the same way each time.
    onChange({ ...settings, [s.id]: TEST_HIKERS.filter((x) => next.includes(x)) });
  };
  return (
    <div className={styles.hikersBlock}>
      <span className={styles.label}>
        HIKERS · PICK {s.min} TO {s.max}
      </span>
      <div className={styles.hikers}>
        {TEST_HIKERS.map((id) => {
          const h = minigameHiker(id);
          const isOn = on.includes(id);
          return (
            <button
              key={id}
              type="button"
              className={styles.hiker}
              data-on={isOn || undefined}
              aria-pressed={isOn}
              disabled={!isOn && on.length >= s.max}
              style={{ '--c': h.color } as CSSProperties}
              onClick={() => toggle(id)}
            >
              <HikerPortrait hikerId={id} className={styles.portrait} />
              <span className={styles.hikerName}>{h.name}</span>
              <span className={styles.dot} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className={styles.note}>The ring color is the hiker’s color in the game.</p>
    </div>
  );
}

/** How wide the preview is drawn (4:3). */
const PREVIEW_WIDTH = 296;

/**
 * A small picture of the game: Bearrels' scene in the chosen style, with the
 * barrels and the picked hikers behind them; a still frame of a puzzle game.
 */
function Preview({ info, settings }: { info: MinigameInfo; settings: MinigameSettings }) {
  const ids = picked(settings, 'hikers');
  const Still = PREVIEWS[info.id];
  if (info.id !== 'bearrels') {
    return (
      <div className={styles.preview} aria-label={`${info.name} preview`} role="img">
        <ScaledScreen width={PREVIEW_WIDTH}>
          {Still && <Still settings={settings} hikers={ids.map((id) => minigameHiker(id))} />}
        </ScaledScreen>
      </div>
    );
  }
  const n = typeof settings.barrels === 'number' ? settings.barrels : 3;
  const rounds = typeof settings.rounds === 'number' ? settings.rounds : 3;
  const model: SceneModel = {
    ...emptyScene(n),
    hikers: ids.map((id, i) => ({ hiker: minigameHiker(id), barrel: i % n, state: 'in' })),
    outline: Math.min(n - 1, ids.length),
  };
  return (
    <div className={styles.preview} aria-label={`${info.name} preview: ${n} barrels`} role="img">
      <ScaledScreen width={PREVIEW_WIDTH}>
        <BearrelsScene style={toArtStyle(settings.style)} model={model} />
      </ScaledScreen>
      <span className={styles.previewPill}>
        R {1}/{rounds}
      </span>
    </div>
  );
}
