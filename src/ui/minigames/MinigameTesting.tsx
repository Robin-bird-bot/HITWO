/**
 * The Minigame testing tab (docs/design/10-minigames.md, section 5;
 * 11-minigames-puzzles.md, "Testing tab"; docs/mockups/minigames/8-testing-tab-reference.jpg),
 * from the main menu.
 *
 * - **Left:** every minigame, by category; the ones not built yet are
 *   "coming soon".
 * - **Right:** the minigame's settings (Tier and overrides, where Auto uses
 *   the tier's value; hiker toggles), a preview, and Test it, which opens its
 *   pop-up in test mode, then the game on the turned party GPS. Dodge with
 *   Bear with a Gun opens as Bear Country.
 *
 * Settings are remembered on this device. Nothing touches the saved hike,
 * XP, stats or anything else in a run.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  BEAR_COUNTRY,
  testChallenge,
  type MinigameChallenge,
} from '../../content/minigameChallenges';
import { MINIGAMES, MINIGAMES_BY_CATEGORY } from '../../minigames/catalog';
import { minigameHiker, testPacks, type TestPacks } from '../../minigames/hikers';
import type {
  MinigameInfo,
  MinigameSetting,
  MinigameSettings,
  PickOption,
} from '../../minigames/types';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { MinigameIcon } from './MinigameIcon';
import { MinigameFlow } from './MinigameFlow';
import { PREVIEWS } from './runners';
import { ScaledScreen } from './ScaledScreen';
import { tierOf } from './puzzleProps';
import {
  browserStorage,
  readTestingSettings,
  TEST_HIKERS,
  writeTestingSettings,
} from './testingSettings';
import styles from './MinigameTesting.module.css';

/**
 * The challenge a playable minigame opens in test mode: Bear Country for
 * Dodge with Bear with a Gun (21-minigames-dodge-camp.md, section 0); for
 * the rest, a plain one with their name.
 */
function challengeFor(
  info: MinigameInfo,
  settings: MinigameSettings,
): MinigameChallenge | undefined {
  if (info.status !== 'ready') return undefined;
  if (info.id === 'dodge' && settings.animal === 'gunBear')
    return { ...BEAR_COUNTRY, tier: tierOf(settings) };
  return testChallenge(info, tierOf(settings));
}

/** The testing tab's Packs, remembered on this device. */
const PACKS_KEY = 'hike-in-the-woods/minigame-packs';
const PACK_SEED = 20261126;
const PACK_CHOICES: readonly { id: TestPacks; label: string }[] = [
  { id: 'madeUp', label: 'Made-up' },
  { id: 'empty', label: 'Empty' },
  { id: 'lots', label: 'Lots' },
];
function readPacks(): TestPacks {
  try {
    const v = window.localStorage.getItem(PACKS_KEY);
    return v === 'empty' || v === 'lots' ? v : 'madeUp';
  } catch {
    return 'madeUp';
  }
}

const picked = (s: MinigameSettings, id: string): readonly string[] => {
  const v = s[id];
  return Array.isArray(v) ? v : [];
};

export function MinigameTesting({ onBack }: { onBack(): void }) {
  const [activeId, setActiveId] = useState('dodge');
  const active = MINIGAMES.find((m) => m.id === activeId) ?? MINIGAMES[0]!;
  const [settings, setSettings] = useState<MinigameSettings>(() =>
    readTestingSettings(browserStorage(), active.id),
  );
  const [testing, setTesting] = useState(false);
  // The chosen game stays in view in the scrolling list when the tab opens.
  const activeItem = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeItem.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  const update = (next: MinigameSettings) => {
    setSettings(next);
    writeTestingSettings(browserStorage(), active.id, next);
  };
  const challenge = challengeFor(active, settings);
  const hikerIds = picked(settings, 'hikers');
  // The testing tab's Packs (20-challenge-popup.md, section 1): what the test hikers carry.
  const [packs, setPacks] = useState<TestPacks>(readPacks);
  const choosePacks = (next: TestPacks) => {
    setPacks(next);
    try {
      window.localStorage.setItem(PACKS_KEY, next);
    } catch {
      // Remembering it is only a convenience.
    }
  };
  const hikers = hikerIds.map((id) => {
    const pack = testPacks(packs, PACK_SEED, id);
    return { ...minigameHiker(id), pack: pack.resources, items: pack.items };
  });

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
          {/* The games, grouped by category; the list scrolls when it doesn't all fit. */}
          <nav className={styles.list} aria-label="Minigames">
            <span className={styles.label}>MINIGAMES</span>
            <div className={styles.listScroll}>
              {MINIGAMES_BY_CATEGORY.map((c) => (
                <div key={c.id} className={styles.category} role="group" aria-label={c.name}>
                  <span className={styles.categoryName}>{c.name}</span>
                  {c.games.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={styles.item}
                      data-active={m.id === active.id || undefined}
                      data-soon={m.status === 'soon' || undefined}
                      disabled={m.status === 'soon'}
                      aria-current={m.id === active.id || undefined}
                      ref={m.id === active.id ? activeItem : undefined}
                      onClick={() => {
                        setActiveId(m.id);
                        setSettings(readTestingSettings(browserStorage(), m.id));
                      }}
                    >
                      <MinigameIcon id={m.id} size={22} />
                      <span className={styles.itemWords}>
                        <span className={styles.itemName}>{m.name}</span>
                        <span className={styles.itemSub}>
                          {m.baseGame}
                          {m.status === 'soon' ? ' · coming soon' : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className={styles.detail}>
            {/* The settings scroll when they don't all fit; the preview and Test it stay in view below. */}
            <div className={styles.scroll}>
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
                .filter(
                  (s): s is Extract<MinigameSetting, { kind: 'hikers' }> => s.kind === 'hikers',
                )
                .map((s) => (
                  <HikerToggles key={s.id} setting={s} settings={settings} onChange={update} />
                ))}
              {active.note?.(settings) && (
                <p className={styles.description} role="note">
                  {active.note(settings)}
                </p>
              )}
            </div>

            {challenge && (
              <>
                <span className={styles.label}>PREVIEW</span>
                <div className={styles.previewRow}>
                  <Preview info={active} settings={settings} />
                  <div className={styles.testBox}>
                    <p className={styles.testNote}>
                      Opens the {challenge.name} pop-up, then the game. Nothing is saved.
                    </p>
                    <span className={styles.label}>PACKS</span>
                    <div
                      className={`${styles.choice} ${styles.pick}`}
                      role="group"
                      aria-label="Packs"
                    >
                      {PACK_CHOICES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          data-on={packs === c.id || undefined}
                          aria-pressed={packs === c.id}
                          onClick={() => choosePacks(c.id)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
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
    // Auto, (Off,) then min to max: − below the minimum goes back to Off, then Auto.
    const step = s.step ?? 1;
    const off = !!s.off && given === 'off';
    const auto = typeof given !== 'number' && !off;
    const value = typeof given === 'number' ? given : null;
    const set = (v: number | 'auto' | 'off') => onChange({ ...settings, [s.id]: v });
    const less = (): number | 'auto' | 'off' => {
      if (off) return 'auto';
      if (value === null) return 'auto';
      if (value - step >= s.min) return value - step;
      return s.off ? 'off' : 'auto';
    };
    const more = (): number | 'off' => {
      if (auto && s.off) return 'off';
      if (value === null) return s.min;
      return Math.min(s.max, value + step);
    };
    return (
      <div className={styles.setting}>
        <span className={styles.label}>{s.label.toUpperCase()}</span>
        <div className={styles.stepper} role="group" aria-label={s.label}>
          <button
            type="button"
            aria-label={`Less ${s.label.toLowerCase()}`}
            disabled={auto}
            onClick={() => set(less())}
          >
            −
          </button>
          <span aria-live="polite" data-auto={auto || off || undefined}>
            {auto ? 'AUTO' : off ? 'OFF' : value}
          </span>
          <button
            type="button"
            aria-label={`More ${s.label.toLowerCase()}`}
            disabled={value !== null && value >= s.max}
            onClick={() => set(more())}
          >
            +
          </button>
        </div>
        <span className={styles.hint}>{s.hint}</span>
      </div>
    );
  }
  if (s.kind === 'pick') {
    // Options that follow other settings: a value not open right now shows (and plays) as the default.
    const options: readonly PickOption[] = s.optionsFor ? s.optionsFor(settings) : s.options;
    const wanted = typeof given === 'string' ? given : s.default;
    const value = options.some((o) => o.id === wanted && !o.disabled) ? wanted : s.default;
    if (s.menu) {
      return (
        <label className={styles.setting}>
          <span className={styles.label}>{s.label.toUpperCase()}</span>
          <select
            className={styles.menu}
            value={value}
            onChange={(e) => onChange({ ...settings, [s.id]: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          {s.hint && <span className={styles.hint}>{s.hint}</span>}
        </label>
      );
    }
    return (
      <div className={styles.setting}>
        <span className={styles.label}>{s.label.toUpperCase()}</span>
        <div className={`${styles.choice} ${styles.pick}`} role="radiogroup" aria-label={s.label}>
          {options.map((o) => (
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

/** A small picture of the game: a still frame of it. */
function Preview({ info, settings }: { info: MinigameInfo; settings: MinigameSettings }) {
  const ids = picked(settings, 'hikers');
  const Still = PREVIEWS[info.id];
  return (
    <div className={styles.preview} aria-label={`${info.name} preview`} role="img">
      <ScaledScreen width={PREVIEW_WIDTH}>
        {Still && <Still settings={settings} hikers={ids.map((id) => minigameHiker(id))} />}
      </ScaledScreen>
    </div>
  );
}
