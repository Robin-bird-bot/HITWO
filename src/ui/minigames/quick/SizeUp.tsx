/**
 * Size Up on the GPS (docs/design/18-minigames-quick.md, section 3; mockups
 * 3-size-up.png and 4-size-up-reveal.png), in scene units (320 × 240):
 * FIELD GUIDE on the left (the sketch at its actual size) and ON THE TRAIL
 * on the right (the find, the wrong size and turned). Tap or hold the top
 * half to grow it and the bottom half to shrink it; lock in with Space,
 * Enter or LOCK IN.
 *
 * The finds are drawn at fractional sizes with pixelated rendering, not
 * snapped to scene units, so small steps still show.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { current, playing, turnWord } from '../../../minigames/quick/turns';
import {
  FINDS,
  isFind,
  lockIn,
  newSizeUp,
  offPercent,
  press,
  release,
  result,
  tick,
} from '../../../minigames/sizeUp/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import { outlineKey, useOutlinedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from './Quick.module.css';
import styles from './SizeUp.module.css';
import { Squares, TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';
import { prepNumber } from '../../../minigames/prepare';

const file = (f: string) => `minigames/size-up/${f}`;
const art = (f: string) => asset(file(f));
/** The two panels (left edges), their top, and their size. */
const GUIDE_X = 12;
const TRAIL_X = 168;
const PANEL_Y = 34;
const PANEL_W = 140;
const PANEL_H = 150;
const ART = 32;
const SLIDE_SEC = 0.45;

export function SizeUp({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const findPick = pickOf(settings, 'find');
  const [game, setGame] = useState(() =>
    newSizeUp(
      {
        tier,
        find: isFind(findPick) ? findPick : 'random',
        timeSec: typeof settings.time === 'number' ? settings.time : 'auto',
        passBonus: prepNumber(settings, 'prep.pass'),
        extraSec: prepNumber(settings, 'prep.extraSec'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const outlines = useOutlinedArt(
    FINDS.map((f) => file(`object-${f.id}.png`)),
    hikers.map((h) => h.color),
  );

  const who = current(game.turns);
  const onTurn = playing(game.turns);
  const color = who ? byId(who).color : '#d3dfaf';
  const live = pickOf(settings, 'live') === 'on';

  const grow = (dir: 'grow' | 'shrink') => {
    const out = press(game, dir);
    if (out !== game) {
      playSound('tick');
      setGame(out);
    }
  };
  const lock = () => {
    const out = lockIn(game);
    if (out === game) return;
    playSound(out.locked?.passed ? 'pop' : 'miss');
    setGame(out);
  };
  useKeys(
    running,
    (key) => {
      if (key === 'ArrowUp' || key === 'w') grow('grow');
      else if (key === 'ArrowDown' || key === 's') grow('shrink');
      else if (key === ' ' || key === 'Enter') lock();
      else return false;
      return true;
    },
    (key) => {
      if (['ArrowUp', 'w', 'ArrowDown', 's'].includes(key)) setGame(release);
    },
  );

  const onDown = (e: ReactPointerEvent) => {
    if (!running) return;
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    if (p.x < TRAIL_X || p.x > TRAIL_X + PANEL_W || p.y < PANEL_Y || p.y > PANEL_Y + PANEL_H)
      return;
    e.preventDefault();
    grow(p.y < PANEL_Y + PANEL_H / 2 ? 'grow' : 'shrink');
  };
  const onUp = () => setGame(release);

  const find = FINDS.find((f) => f.id === game.find)!;
  const sketch = ART * game.sketchScale;
  const size = sketch * game.ratio;
  const guideMid = { x: GUIDE_X + PANEL_W / 2, y: PANEL_Y + 70 };
  const trailMid = { x: TRAIL_X + PANEL_W / 2, y: PANEL_Y + PANEL_H / 2 };

  // The reveal: the outline slides over the sketch, upright, at the size locked in.
  const reveal = game.locked;
  const slide = reveal ? Math.min(1, (game.time - reveal.at) / SLIDE_SEC) : 0;
  const outline = outlines[outlineKey(file(`object-${game.find}.png`), color)];
  const revealSize = reveal ? sketch * reveal.ratio : 0;
  const revealMid = {
    x: trailMid.x + (guideMid.x - trailMid.x) * slide,
    y: trailMid.y + (guideMid.y - trailMid.y) * slide,
  };

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className={styles.backdrop} />
        <p className={`${ui.text} ${styles.label}`} style={{ left: GUIDE_X + PANEL_W / 2 }}>
          FIELD GUIDE
        </p>
        <p className={`${ui.text} ${styles.label}`} style={{ left: TRAIL_X + PANEL_W / 2 }}>
          ON THE TRAIL
        </p>

        {/* The field guide: the sketch at its actual size. */}
        <img
          className={`${ui.sprite} ${styles.panel}`}
          src={art('guide-page.png')}
          alt=""
          draggable={false}
          style={{ left: GUIDE_X, top: PANEL_Y }}
        />
        {onTurn || reveal ? (
          <img
            className={`${ui.sprite} ${q.thing}`}
            src={art(`object-${game.find}-sketch.png`)}
            alt={`${find.name}, actual size`}
            draggable={false}
            style={{
              left: guideMid.x - sketch / 2,
              top: guideMid.y - sketch / 2,
              width: sketch,
              height: sketch,
            }}
          />
        ) : null}
        <p className={`${ui.text} ${styles.caption}`} style={{ left: guideMid.x }}>
          {find.name.toUpperCase()}, ACTUAL SIZE
        </p>

        {/* On the trail: the find, and the two halves to tap. */}
        <span
          className={styles.trail}
          style={{
            left: TRAIL_X,
            top: PANEL_Y,
            width: PANEL_W,
            height: PANEL_H,
            backgroundImage: `url(${art('ground.png')})`,
          }}
        >
          {onTurn && !reveal && (
            <img
              className={`${ui.sprite} ${styles.find}`}
              src={art(`object-${game.find}.png`)}
              alt={`A ${find.name.toLowerCase()} on the trail`}
              draggable={false}
              style={{
                left: PANEL_W / 2 - size / 2,
                top: PANEL_H / 2 - size / 2,
                width: size,
                height: size,
                transform: `rotate(${game.angle}deg) scaleX(${game.mirrored ? -1 : 1})`,
              }}
            />
          )}
        </span>
        <span className={styles.half} style={{ left: TRAIL_X + 2, top: PANEL_Y + 2 }}>
          <span className={`${ui.text} ${styles.halfHint}`} style={{ top: 5 }}>
            + TAP TOP HALF TO GROW
          </span>
        </span>
        <span className={styles.half} style={{ left: TRAIL_X + 2, top: PANEL_Y + PANEL_H / 2 + 1 }}>
          <span className={`${ui.text} ${styles.halfHint}`} style={{ bottom: 5 }}>
            − TAP BOTTOM HALF TO SHRINK
          </span>
        </span>
        {live && onTurn && !reveal && (
          <span className={`${ui.box} ${styles.live}`}>{offPercent(game.ratio)}% OFF</span>
        )}

        {/* The reveal: the outline over the sketch, and how far off. */}
        {reveal && outline && (
          <img
            className={`${ui.sprite} ${q.thing}`}
            src={outline}
            alt=""
            draggable={false}
            style={{
              left: revealMid.x - revealSize / 2,
              top: revealMid.y - revealSize / 2,
              width: revealSize,
              height: revealSize,
            }}
          />
        )}
        {reveal && slide >= 1 && (
          <span
            className={`${ui.box} ${styles.verdict}`}
            data-passed={reveal.passed || undefined}
            style={{ left: guideMid.x }}
          >
            {reveal.off}% OFF · {reveal.passed ? 'PASSED' : 'FAILED'}
          </span>
        )}

        <button
          type="button"
          className={`${ui.button} ${q.button} ${styles.lock}`}
          disabled={!onTurn || !!reveal || still}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={lock}
        >
          LOCK IN
        </button>
        {!onTurn && !game.over && who && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(who).name.toUpperCase()}, YOUR TURN
          </span>
        )}
        <p className={`${ui.muted} ${q.hint}`}>MAKE THEM THE SAME SIZE BEFORE TIME RUNS OUT</p>

        {/* The top HUD: this hiker's time. */}
        <div className={`${ui.box} ${hud.name}`}>SIZE UP</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>TIME</span>
          <Bar value={game.timeLeft / game.timeSec} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={(id) => turnWord(game.turns, id)}
          active={game.over ? undefined : who}
          extra={(id) => <Squares total={1} lit={id in game.turns.done ? 1 : 0} label="One try" />}
        />
      </div>
    </PixelScreen>
  );
}
