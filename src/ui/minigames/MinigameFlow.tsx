/**
 * A challenge played as a minigame (docs/design/10-minigames.md, "The
 * pieces"; 20-challenge-popup.md): the pop-up, with the upright party GPS
 * playing a demo; Start turns the GPS sideways and zooms it in, and the game
 * plays on its screen; Continue on the results card turns it back, and the
 * pop-up shows how it went.
 *
 * - **The run's seed** is picked when the pop-up opens, so its random
 *   version (night, fog) is known and pinned: the pop-up, the demo and the
 *   game all show the same one.
 * - **Prepare:** the fills live here. The demo and the game get the
 *   settings with Prepare on top. In a real challenge, Start notes what's
 *   in the slots, and Continue hands it to the game with the result: the
 *   engine spends it, all or nothing (25-challenges-on-the-map.md, section
 *   3). A filled SKIP IT passes everyone without playing.
 *
 * In test mode (the Minigame testing tab) the pop-up then offers Back to
 * testing and Play again, and nothing is saved anywhere but the tab's own
 * settings: the flow never touches the game store.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import type { MinigameChallenge } from '../../content/minigameChallenges';
import { MINIGAME_BY_ID } from '../../minigames/catalog';
import { passFailResult } from '../../minigames/lineup';
import { POPUPS } from '../../minigames/popups';
import {
  applyPrepare,
  cardsFor,
  effects,
  emptySlot,
  fillSlot,
  freeKeys,
  slotsFor,
  spend,
  type Fills,
  type Packs,
  type Spent,
} from '../../minigames/prepare';
import type { MinigameHiker, MinigameResult, MinigameSettings } from '../../minigames/types';
import { useStage } from '../stage/StageContext';
import { ChallengePopup } from './ChallengePopup';
import { DemoRunner } from './DemoRunner';
import { gpsTurned, type Rect } from './gpsLayout';
import { PartyGps } from './PartyGps';
import { PlayStage } from './PlayStage';
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
}: {
  challenge: MinigameChallenge;
  hikers: readonly MinigameHiker[];
  settings: MinigameSettings;
  testMode?: boolean;
  /** Test mode: Back to testing. */
  onBack?(): void;
  /** A real challenge: Continue with the result, what Prepare spent, and whether SKIP IT skipped it. */
  onFinish?(result: MinigameResult, spent: readonly Spent[], skipped: boolean): void;
}) {
  const fit = useStage();
  const layout = gpsTurned(fit.scale < G.phoneBelowScale);
  const [stage, setStage] = useState<Stage>('popup');
  const [moved, setMoved] = useState(false);
  const [result, setResult] = useState<MinigameResult | undefined>(undefined);
  const [seed, setSeed] = useState(newSeed);
  const [slot, setSlot] = useState<Rect | null>(null);
  const [fills, setFills] = useState<Fills>({});
  const timers = useRef<number[]>([]);
  const spentRef = useRef<readonly Spent[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  // The pop-up's GPS slot is measured once: the stage never changes size.
  const slotRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setSlot(boxInFlow(el));
  }, []);

  const info = MINIGAME_BY_ID.get(challenge.minigame);
  const popup = POPUPS[challenge.minigame];
  const ids = hikers.map((h) => h.id);
  // The settings: the tab's (or the challenge's), the challenge's tier, and this run's version.
  const base = useMemo(() => {
    const s: MinigameSettings = {
      ...settings,
      ...(challenge.settings ?? {}),
      tier: challenge.tier,
    };
    return { ...s, ...(popup?.version?.(s, seed) ?? {}) };
  }, [settings, challenge, popup, seed]);
  const idKey = ids.join(',');
  // The cost cards (section 4.1): the game's options and the challenge's own, grouped by cost.
  const cards = useMemo(
    () =>
      cardsFor(
        [...(popup?.options(base) ?? []), ...(challenge.options ?? [])],
        base,
        idKey.split(',').length,
      ),
    [popup, base, challenge, idKey],
  );
  const slots = useMemo(() => slotsFor(cards), [cards]);
  const packs: Packs = useMemo(
    () =>
      Object.fromEntries(
        hikers.map((h) => [h.id, { resources: h.pack ?? {}, items: h.items ?? [] }]),
      ),
    [hikers],
  );
  const prepared = useMemo(() => applyPrepare(base, slots, fills), [base, slots, fills]);
  const skip = effects(slots, fills).skip;

  const start = () => {
    if (stage !== 'popup') return;
    if (!testMode) {
      const free = freeKeys(fills, challenge.free?.count ?? 0);
      spentRef.current = spend(packs, slots, fills, free).spent;
    }
    if (skip) {
      // SKIP IT: everyone passes without playing.
      setResult(passFailResult(ids, () => true));
      return;
    }
    setResult(undefined);
    setMoved(true);
    setStage('turning');
    later(G.turnMs, () => setStage('playing'));
  };
  const done = (r: MinigameResult) => {
    setResult(r);
    setStage('returning');
    later(G.returnMs, () => {
      setStage('popup');
      // The next play is a new run: a new seed (and version).
      setSeed(newSeed());
    });
  };
  const playAgain = () => {
    setResult(undefined);
    if (skip) return;
    start();
  };

  const turned = stage === 'turning' || stage === 'playing';
  return (
    <div className={styles.flow} data-flow-root="" style={{ '--dim': G.dim } as CSSProperties}>
      <ChallengePopup
        challenge={challenge}
        info={info}
        popup={popup}
        base={base}
        settings={prepared}
        hikers={hikers}
        cards={cards}
        slots={slots}
        fills={fills}
        packs={packs}
        onFill={(key, tile, effect, target) => {
          const s = slots.find((x) => x.key === key);
          if (s) setFills((f) => fillSlot(f, s, tile, effect, ids, target));
        }}
        onEmpty={(key) => setFills((f) => emptySlot(f, key))}
        skip={skip}
        testMode={testMode}
        result={stage === 'popup' ? result : undefined}
        dimmed={stage !== 'popup'}
        gpsSlotRef={slotRef}
        onStart={start}
        {...(onBack ? { onBack } : {})}
        onPlayAgain={playAgain}
        onContinue={() => result && onFinish?.(result, spentRef.current, skip)}
      />
      {slot && (
        <PartyGps
          turned={turned}
          slot={slot}
          layout={layout}
          mode={stage === 'playing' ? 'game' : 'demo'}
          showContent={stage === 'popup' || stage === 'playing'}
          moved={moved}
          playing={stage === 'playing'}
          skipped={skip}
          content={
            stage === 'playing' && info ? (
              <PlayStage
                key={seed}
                info={info}
                settings={prepared}
                hikers={hikers}
                seed={seed}
                onDone={done}
              />
            ) : (
              <DemoRunner
                gameId={challenge.minigame}
                settings={prepared}
                hikers={hikers}
                still={skip}
              />
            )
          }
        />
      )}
    </div>
  );
}
