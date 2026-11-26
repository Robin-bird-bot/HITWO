/**
 * Rock Climb on the GPS (docs/design/19-minigames-signs-trails.md, section
 * 4; mockups 20-rock-climb-aim.png and 21-rock-climb-leap.png), in scene
 * units (320 × 240): facing the wall, which scrolls down as the climber goes
 * up; holds with their tops in hikers' colors; the climber from behind,
 * each hand in its color; the arrow swinging over the climber's head and
 * the power meter on the right.
 *
 * Hold (click, tap or Space) to stop the arrow, let go to jump; during the
 * jump, tap a hold in the active hand's color.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { RED } from '../../../minigames/greens';
import {
  activeColor,
  activeHand,
  aimNow,
  grab,
  handAt,
  hold,
  letGo,
  newRockClimb,
  powerNow,
  result,
  tick,
} from '../../../minigames/rockClimb/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import { litKey, useLitArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './RockClimb.module.css';

const R = BALANCE.minigames.rockClimb;
const file = (f: string) => `minigames/rock-climb/${f}`;
const art = (f: string) => asset(file(f));
const HOLD = file('hold.png');
/** A hold nobody can grab (a decoy when every party color is taken nearby). */
const NOBODY = '#8a8f80';
/** Where the climber's hand dots are (top-left of each 4 × 4 dot) in the hang and leap frames. */
const HANDS = {
  hang: [
    { x: 1, y: 0 },
    { x: 21, y: 0 },
  ],
  leap: [
    { x: 5, y: 0 },
    { x: 18, y: 0 },
  ],
};

export function RockClimb({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const tries = pickOf(settings, 'tries');
  const [game, setGame] = useState(() =>
    newRockClimb(
      {
        tier,
        holds: typeof settings.holds === 'number' ? settings.holds : 'auto',
        timeSec: typeof settings.time === 'number' ? settings.time : 'auto',
        tries: tries === 'one' || tries === 'any' ? tries : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const colorOf = (id: string | null) => (id ? (byId(id)?.color ?? NOBODY) : NOBODY);
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const lit = useLitArt([HOLD], [...hikers.map((h) => h.color), NOBODY]);

  // The camera follows the hand: its height sits at scene y R.handY.
  const hand = handAt(game);
  const camH = game.phase === 'jump' ? hand.h : game.at.h;
  const screenY = (h: number) => R.handY - (h - camH);

  const press = () => {
    if (game.phase === 'aim') setGame(hold);
  };
  const release = () => {
    if (game.phase === 'power') setGame(letGo);
  };
  const onDown = (e: ReactPointerEvent) => {
    if (!running) return;
    e.preventDefault();
    if (game.phase !== 'jump') return press();
    // A tap during the jump: the nearest hold to it.
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    const target = game.holds
      .map((h) => ({ h, d: Math.hypot(h.x - p.x, screenY(h.h) - p.y) }))
      .filter((x) => x.d <= 12)
      .sort((a, b) => a.d - b.d)[0];
    if (!target) return;
    const out = grab(game, target.h.id);
    if (out === game) return;
    playSound(out.phase === 'aim' || out.phase === 'top' ? 'pop' : 'miss');
    setGame(out);
  };
  useKeys(
    running,
    (key) => {
      if (key !== ' ') return false;
      press();
      return true;
    },
    (key) => key === ' ' && release(),
  );

  const active = activeColor(game);
  const leaping = game.phase === 'jump';
  const frame = leaping ? 'leap' : 'hang';
  // The climber hangs from the hand: the active hand's dot sits on the hand point.
  const which = activeHand(game) === 'left' ? 0 : 1;
  const dot = HANDS[frame][which]!;
  const cx = hand.x - dot.x - 2;
  const cy = screenY(hand.h) - dot.y - 2;
  const lastColor = game.pathAt >= 0 ? game.holds[game.path[game.pathAt]!]!.color : null;
  const handColors = which === 0 ? [active, lastColor] : [lastColor, active];
  const aimDeg = aimNow(game);
  const aiming = game.phase === 'aim' || game.phase === 'power';
  const fellRecently = game.lastFall && game.time - game.lastFall.at < 0.8;
  // The hands bar: the moves from the last one made, the next ringed.
  const firstShown = Math.max(0, game.pathAt);
  const shown = game.path.slice(firstShown, firstShown + 9);

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={`${q.play} ${styles.play}`}
        onPointerDown={onDown}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The wall, scrolling down as the climber goes up. */}
        <span
          className={styles.wall}
          style={{
            backgroundImage: `url(${art('wall.png')})`,
            backgroundPositionY: `${camH % 240}px`,
          }}
        />
        {/* The ledge at the top. */}
        {(() => {
          const topH = game.holds[game.path.at(-1)!]?.h ?? 0;
          const y = screenY(topH + 26);
          return y > -10 && y < 200 ? <span className={styles.ledge} style={{ top: y }} /> : null;
        })()}

        {/* The holds. */}
        {game.holds.map((h) => {
          const y = screenY(h.h);
          if (y < 10 || y > 205) return null;
          const c = colorOf(h.color);
          return (
            <img
              key={h.id}
              className={`${ui.sprite} ${styles.hold}`}
              data-grabbed={
                game.lastGrab?.hold === h.id && game.time - game.lastGrab.at < 0.3 ? '' : undefined
              }
              src={lit[litKey(HOLD, c)] ?? art('hold.png')}
              alt=""
              draggable={false}
              style={{ left: h.x - 8, top: y - 6 }}
            />
          );
        })}

        {/* The aim: an arrow swinging over the top from the hand (and the arc it swings on). */}
        {aiming && (
          <>
            {Array.from({ length: 11 }, (_, k) => {
              const a = (k * 18 * Math.PI) / 180;
              return (
                <span
                  key={k}
                  className={styles.arcDot}
                  style={{
                    left: hand.x + Math.cos(a) * 30 - 0.75,
                    top: screenY(hand.h) - Math.sin(a) * 30 - 0.75,
                  }}
                />
              );
            })}
            <img
              className={`${ui.sprite} ${styles.arrow}`}
              src={art('aim-arrow.png')}
              alt=""
              draggable={false}
              style={{
                left: hand.x - 4.5,
                top: screenY(hand.h) - 26,
                transform: `rotate(${90 - aimDeg}deg)`,
              }}
            />
          </>
        )}

        {/* The climber, each hand in its color; the active hand ringed. */}
        <span className={styles.climber} style={{ left: cx, top: cy }}>
          <img className={ui.sprite} src={art(`climber-${frame}.png`)} alt="" draggable={false} />
          {HANDS[frame].map((d, k) => (
            <span
              key={k}
              className={styles.handDot}
              style={{ left: d.x, top: d.y, background: colorOf(handColors[k] ?? null) }}
            />
          ))}
        </span>
        <span
          className={styles.handRing}
          style={{ left: hand.x - 4.5, top: screenY(hand.h) - 4.5, borderColor: colorOf(active) }}
        />
        {fellRecently && (
          <span className={q.word} style={{ left: hand.x, top: screenY(hand.h) - 14, color: RED }}>
            SLIP!
          </span>
        )}
        {game.phase === 'top' && <span className={`${ui.box} ${q.handoff}`}>TOP OF THE WALL!</span>}

        {/* The power meter. */}
        <span className={styles.meter}>
          <span style={{ height: `${powerNow(game) * 100}%` }} />
        </span>
        <span className={`${ui.text} ${styles.meterLabel}`}>POWER</span>

        <p className={`${ui.muted} ${q.hint}`}>
          {leaping
            ? `GRAB A HOLD IN ${active ? byId(active).name.toUpperCase() : ''}’S COLOR`
            : 'HOLD TO STOP THE ARROW, LET GO AT THE RIGHT POWER'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>ROCK CLIMB</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>HEIGHT</span>
          <span className={hud.bar}>
            <span style={{ width: `${((game.pathAt + 1) / game.path.length) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Hands: the color sequence (the next one ringed, used ones crossed out), the time, and who fell. */}
        <div className={`${ui.box} ${hud.panel} ${styles.bar}`}>
          <span className={styles.handsLabel}>HANDS</span>
          <span className={styles.seq}>
            {shown.map((id, k) => {
              const i = firstShown + k;
              const h = game.holds[id]!;
              const who = h.color ? byId(h.color) : null;
              return (
                <span
                  key={i}
                  className={styles.seqDot}
                  data-next={i === game.pathAt + 1 || undefined}
                  data-used={i <= game.pathAt || undefined}
                >
                  {who ? <HikerToken hiker={who} size={9} /> : null}
                </span>
              );
            })}
          </span>
          <span className={styles.status}>
            <span>TIME {Math.ceil(game.timeLeft)} S</span>
            <span className={styles.fell}>
              FELL:{' '}
              {game.fell.length
                ? game.fell.map((id) => byId(id).name.toUpperCase()).join(', ')
                : 'NONE'}
            </span>
          </span>
        </div>
      </div>
    </PixelScreen>
  );
}
