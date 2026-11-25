/**
 * A challenge played as a minigame (docs/design/10-minigames.md, "The
 * pieces"): the pop-up, with the upright party GPS looping a preview; Start
 * turns the GPS sideways and zooms it in, and the game plays on its screen;
 * Continue on the results card turns it back, and the pop-up shows how it went.
 *
 * In test mode (the Minigame testing tab) the pop-up then offers Back to
 * testing and Play again, a Style button on the GPS (and the S key) switches
 * the art style mid-game, and nothing is saved anywhere but the tab's own
 * settings: the flow never touches the game store.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import type { MinigameChallenge } from '../../content/minigameChallenges';
import { MINIGAME_BY_ID } from '../../minigames/catalog';
import type { MinigameHiker, MinigameResult, MinigameSettings } from '../../minigames/types';
import { useStage } from '../stage/StageContext';
import { ChallengePopup } from './ChallengePopup';
import { gpsTurned, styleButtonSpot, type Rect } from './gpsLayout';
import { PartyGps } from './PartyGps';
import { PREVIEWS, RUNNERS } from './runners';
import styles from './MinigameFlow.module.css';

const G = BALANCE.minigames.gps;

type Stage = 'popup' | 'turning' | 'playing' | 'returning';

/** A fresh seed for each game (the screen's own randomness: test games aren't part of a run). */
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** An element's box inside the flow (stage pixels), from offsets, so the stage's scale doesn't matter. */
function boxInFlow(el: HTMLElement): Rect {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && !node.hasAttribute('data-flow-root')) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}

export function MinigameFlow({
  challenge,
  hikers,
  settings,
  testMode = false,
  onBack,
  onFinish,
  onSettingsChange,
}: {
  challenge: MinigameChallenge;
  hikers: readonly MinigameHiker[];
  settings: MinigameSettings;
  testMode?: boolean;
  /** Test mode: Back to testing. */
  onBack?(): void;
  /** A real challenge: Continue with the result (a later step). */
  onFinish?(result: MinigameResult): void;
  /** Test mode: the Style button or the S key changed the art style. */
  onSettingsChange?(next: MinigameSettings): void;
}) {
  const fit = useStage();
  const layout = gpsTurned(fit.scale < G.phoneBelowScale);
  const [stage, setStage] = useState<Stage>('popup');
  const [moved, setMoved] = useState(false);
  const [result, setResult] = useState<MinigameResult | undefined>(undefined);
  const [seed, setSeed] = useState(newSeed);
  const [slot, setSlot] = useState<Rect | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  // The pop-up's GPS slot is measured once: the stage never changes size.
  const slotRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setSlot(boxInFlow(el));
  }, []);

  const Run = RUNNERS[challenge.minigame];
  const Preview = PREVIEWS[challenge.minigame];
  const info = MINIGAME_BY_ID.get(challenge.minigame);
  const styleSetting = info?.settings.find((s) => s.kind === 'style');

  const start = () => {
    if (stage !== 'popup') return;
    setResult(undefined);
    setSeed(newSeed());
    setMoved(true);
    setStage('turning');
    later(G.turnMs, () => setStage('playing'));
  };
  const done = (r: MinigameResult) => {
    setResult(r);
    setStage('returning');
    later(G.returnMs, () => setStage('popup'));
  };

  /** Test mode: the next art style, redrawn in place and remembered. */
  const cycleStyle = useCallback(() => {
    if (!styleSetting || styleSetting.kind !== 'style') return;
    const ids = styleSetting.options.map((o) => o.id);
    const now = typeof settings[styleSetting.id] === 'string' ? settings[styleSetting.id] : '';
    const next = ids[(ids.indexOf(now as string) + 1) % ids.length] ?? styleSetting.default;
    onSettingsChange?.({ ...settings, [styleSetting.id]: next });
  }, [styleSetting, settings, onSettingsChange]);
  const canSwitch = testMode && stage === 'playing' && !!styleSetting && !!onSettingsChange;

  // The S key, while playing in test mode.
  useEffect(() => {
    if (!canSwitch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 's' || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      cycleStyle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSwitch, cycleStyle]);

  const styleName =
    styleSetting?.kind === 'style'
      ? styleSetting.options.find((o) => o.id === settings[styleSetting.id])?.label
      : undefined;
  const spot = styleButtonSpot(layout);
  const turned = stage === 'turning' || stage === 'playing';

  return (
    <div className={styles.flow} data-flow-root="" style={{ '--dim': G.dim } as CSSProperties}>
      <ChallengePopup
        challenge={challenge}
        hikers={hikers}
        testMode={testMode}
        result={stage === 'popup' ? result : undefined}
        dimmed={stage !== 'popup'}
        gpsSlotRef={slotRef}
        onStart={start}
        {...(onBack ? { onBack } : {})}
        onPlayAgain={start}
        onContinue={() => result && onFinish?.(result)}
      />
      {slot && (
        <PartyGps
          turned={turned}
          slot={slot}
          layout={layout}
          mode={stage === 'playing' ? 'game' : 'preview'}
          showContent={stage === 'popup' || stage === 'playing'}
          moved={moved}
          playing={stage === 'playing'}
          content={
            stage === 'playing' && Run ? (
              <Run key={seed} settings={settings} hikers={hikers} seed={seed} onDone={done} />
            ) : Preview ? (
              <Preview settings={settings} hikers={hikers} />
            ) : null
          }
        />
      )}
      {canSwitch && (
        <button
          type="button"
          className={styles.styleButton}
          style={{ left: spot.left, top: spot.top }}
          onClick={cycleStyle}
          aria-label={`Art style: ${styleName ?? ''}. Press to change (S).`}
        >
          <span className={styles.styleLabel}>STYLE · S</span>
          <span className={styles.styleName}>{styleName}</span>
        </button>
      )}
    </div>
  );
}
