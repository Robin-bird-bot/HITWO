/**
 * Sleeping Bear on the GPS (docs/design/14-minigames-trail-blocks.md,
 * section 3; mockups 5-sleeping-bear.png and 5b-sleeping-bear-awake.png), in
 * scene units (320 × 240), side view.
 *
 * Hold Space, the mouse button or a finger anywhere to walk; let go to
 * stop. The bear breathes with Zzz floating up, stirs with a "?", wakes with
 * a "!", and roars when he catches someone. Each hiker is drawn in their
 * color; the bottom bar shows WAITING, SNEAKING, ACROSS or CAUGHT.
 */
import { TIER_LABELS } from '../../../minigames/types';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  newSleepingBear,
  result,
  tick,
  type HikerStatus,
} from '../../../minigames/sleepingBear/logic';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import { tintKey, useTintedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './SleepingBear.module.css';
import { slowerShare } from '../../../minigames/popups/common';
import { prepNumber } from '../../../minigames/prepare';
import { sleepingBearBot } from '../../../minigames/sleepingBear/bot';
import { useDemoBot, useDemoMode } from '../demo';

const SB = BALANCE.minigames.sleepingBear;
const FIXED = 1 / 120;
const file = (f: string) => `minigames/sleeping-bear/${f}`;
const art = (f: string) => asset(file(f));
const HIKER_FILES = ['hiker-stand.png', 'hiker-walk-1.png', 'hiker-walk-2.png'].map(file);
/** Where a hiker's sprite stands: from the post (x) to the flag, at this height. */
const START_X = 8;
const WALK_Y = 157;

const WORD: Readonly<Record<HikerStatus, string>> = {
  waiting: 'WAITING',
  sneaking: 'SNEAKING',
  across: 'ACROSS',
  caught: 'CAUGHT',
  timeout: 'OUT OF TIME',
};

export function SleepingBear({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const fake = pickOf(settings, 'fakeOuts');
  const [game, setGame] = useState(() =>
    newSleepingBear(
      {
        tier,
        fakeOuts: fake === 'on' || fake === 'off' ? fake : 'auto',
        quiet: slowerShare(prepNumber(settings, 'prep.quiet')),
        extraSec: prepNumber(settings, 'prep.extraSec'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const holding = useRef(false);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const tints = useTintedArt(
    HIKER_FILES,
    hikers.map((h) => h.color),
  );
  const hikerArt = (k: number, color: string) =>
    tints[tintKey(HIKER_FILES[k]!, color)] ?? asset(HIKER_FILES[k]!);

  // The game loop: fixed steps, as fast as the screen draws.
  const running = !still && !game.over;
  const demo = useDemoMode();
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function loop(now) {
      spare = Math.min(0.25, spare + (now - last) / 1000);
      last = now;
      const steps = Math.floor(spare / FIXED);
      spare -= steps * FIXED;
      const hold = holding.current;
      if (steps > 0) {
        setGame((s) => {
          let out = s;
          for (let i = 0; i < steps && !out.over; i++) out = tick(out, FIXED, hold);
          return out;
        });
      }
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // The bear roars.
  const roaring = game.bear === 'roar';
  useEffect(() => {
    if (roaring && !still) playSound('hit');
  }, [roaring, still]);

  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 1600);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  // Hold Space (or a pointer anywhere) to walk (never in the demo).
  useEffect(() => {
    if (still || demo) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      holding.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      holding.current = false;
    };
    const blur = () => (holding.current = false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', blur);
    };
  }, [still, demo]);
  const onDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    holding.current = true;
  };
  const onUp = () => {
    holding.current = false;
  };

  const breath = Math.floor(game.time / 1.2) % 2 === 0 ? 'bear-sleep-1.png' : 'bear-sleep-2.png';
  const bearArt =
    game.bear === 'asleep'
      ? breath
      : game.bear === 'stir'
        ? 'bear-stir.png'
        : game.bear === 'awake'
          ? 'bear-awake.png'
          : 'bear-roar.png';
  const current = game.order[game.current];
  const step = game.moving ? 1 + (Math.floor(game.time / 0.15) % 2) : 0;
  const waiting = game.order.filter((id) => game.status[id] === 'waiting');
  const across = game.order.filter((id) => game.status[id] === 'across');
  const hint = game.over
    ? game.order.some((id) => game.status[id] === 'across')
      ? 'MADE IT PAST THE BEAR'
      : 'NOBODY GOT PAST'
    : game.bear === 'awake' || game.bear === 'roar'
      ? 'FREEZE!'
      : 'HOLD SPACE OR PRESS TO SNEAK';

  // The pop-up's demo: the bot holds and lets go.
  useDemoBot(demo && running, game, sleepingBearBot, (h) => {
    holding.current = h;
  });
  return (
    <PixelScreen measure={!still}>
      <div
        className={styles.play}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img className={`${ui.sprite} ${styles.bg}`} src={art('bg.png')} alt="" draggable={false} />

        {/* The bear. */}
        <img
          className={`${ui.sprite} ${styles.bear}`}
          src={art(bearArt)}
          alt={`The bear is ${game.bear === 'asleep' ? 'asleep' : game.bear === 'stir' ? 'stirring' : 'awake'}`}
          draggable={false}
        />
        {game.bear === 'asleep' && (
          <img
            className={`${ui.sprite} ${styles.zzz}`}
            src={art('zzz.png')}
            alt=""
            draggable={false}
          />
        )}
        {(game.bear === 'stir' || game.bear === 'awake') && (
          <span className={styles.mark} data-awake={game.bear === 'awake' || undefined}>
            {game.bear === 'stir' ? '?' : '!'}
          </span>
        )}
        {game.bear === 'roar' && <span className={`${hud.pop} ${styles.roar}`}>ROAR!</span>}

        {/* The hikers: waiting by the post, one sneaking, the rest past the flag. */}
        {waiting.map((id, k) => (
          <img
            key={id}
            className={`${ui.sprite} ${styles.hiker}`}
            src={hikerArt(0, byId(id).color)}
            alt=""
            draggable={false}
            style={{ left: Math.max(0, START_X - 2 - k * 6), top: WALK_Y }}
          />
        ))}
        {current && game.status[current] === 'sneaking' && (
          <img
            className={`${ui.sprite} ${styles.hiker}`}
            src={hikerArt(step, byId(current).color)}
            alt={`${byId(current).name} sneaking`}
            draggable={false}
            style={{ left: START_X + game.pos, top: WALK_Y }}
          />
        )}
        {across.map((id, k) => (
          <img
            key={id}
            className={`${ui.sprite} ${styles.hiker}`}
            src={hikerArt(0, byId(id).color)}
            alt=""
            draggable={false}
            style={{ left: START_X + SB.path + 6 + k * 7, top: WALK_Y }}
          />
        ))}
        <p className={`${ui.text} ${styles.hint}`} data-alert={hint === 'FREEZE!' || undefined}>
          {hint}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>SLEEPING BEAR</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>TIME</span>
          <Bar value={game.clock / game.total} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Each hiker and how they're doing. */}
        <div
          className={`${ui.box} ${hud.panel}`}
          style={{ justifyContent: 'space-around', padding: '0 6px' }}
        >
          {game.order.map((id) => (
            <span key={id} className={styles.who}>
              <img
                className={ui.sprite}
                src={hikerArt(0, byId(id).color)}
                alt=""
                draggable={false}
              />
              <span className={styles.whoWords}>
                <span>{byId(id).name.toUpperCase()}</span>
                <span
                  className={styles.status}
                  data-bad={['caught', 'timeout'].includes(game.status[id]!) || undefined}
                >
                  {WORD[game.status[id]!]}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </PixelScreen>
  );
}
