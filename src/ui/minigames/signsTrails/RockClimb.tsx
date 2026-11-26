/**
 * Rock Climb on the GPS (docs/design/19-minigames-signs-trails.md, section
 * 4, and 22-minigame-revisions.md, section 2; mockups 35a to 35c), in scene
 * units (320 × 240): facing the wall, which scrolls down as the climber goes
 * up; holds with their tops in hikers' colors; the climber from behind, its
 * arms drawn in code. The hanging hand grips the hold in that hold's color;
 * the big free hand, in the active hiker's color and ringed, reaches along
 * the arrow, wiggling, and pulls in as the power builds. The arrow and the
 * power bar are in the active color too, and a label says whose hand it is.
 *
 * The camera slides up after a grab. A fall drops the climber off the
 * bottom of the screen, then a box says who fell and what it cost, then the
 * climber fades back in at the last hold. The top line is a ledge above the
 * last hold: the last jump has to carry the hand over it.
 *
 * Hold (click, tap or Space) to stop the arrow, let go to jump; during the
 * jump, tap a hold in the active hand's color.
 */
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { g } from '../../../minigames/greens';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';
import { rockClimbBot, type ClimbAction } from '../../../minigames/rockClimb/bot';
import {
  activeColor,
  activeHand,
  aimNow,
  fallDropSec,
  grab,
  grabClosest,
  handAt,
  hold,
  letGo,
  newRockClimb,
  onLastMove,
  powerNow,
  reachableHolds,
  result,
  tick,
  type RockClimbState,
} from '../../../minigames/rockClimb/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import { litKey, useLitArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './RockClimb.module.css';

const R = BALANCE.minigames.rockClimb;
const L = R.look;
const file = (f: string) => `minigames/rock-climb/${f}`;
const art = (f: string) => asset(file(f));
const HOLD = file('hold.png');
const GRIP = file('hand-grip.png');
const OPEN = file('hand-open.png');
/** A hold nobody can grab (a decoy when every party color is taken nearby). */
const NOBODY = '#8a8f80';
/** The arms: G2 inside a G0 outline (section 2.4). */
const ARM = g(2);
const ARM_EDGE = g(0);
/** The body art (26 × 30, from behind, no arms); each arm is two parts this long. */
const BODY = { w: 26, h: 30 };
const SEG = 11;
/** How far below the grip the hanging shoulder sits. */
const HANG = 15;

const easeOut = (u: number) => 1 - (1 - Math.max(0, Math.min(1, u))) ** 2;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** An arm from the shoulder to the hand, the elbow bent out to `side` (−1 left, 1 right) plus `wiggle`. */
function elbowOf(
  sh: { x: number; y: number },
  hand: { x: number; y: number },
  side: number,
  wiggle = 0,
) {
  const dx = hand.x - sh.x;
  const dy = hand.y - sh.y;
  const d = Math.hypot(dx, dy) || 1;
  const bend = Math.sqrt(Math.max(0, SEG * SEG - (d / 2) ** 2)) + wiggle;
  // The normal pointing to the arm's outer side.
  let nx = -dy / d;
  let ny = dx / d;
  if (nx * side < 0) [nx, ny] = [-nx, -ny];
  return { x: (sh.x + hand.x) / 2 + nx * bend, y: (sh.y + hand.y) / 2 + ny * bend };
}

/** One arm: an outline under the arm, both as two straight parts. */
function Arm({
  sh,
  el,
  hand,
}: {
  sh: { x: number; y: number };
  el: { x: number; y: number };
  hand: { x: number; y: number };
}) {
  const pts = `${sh.x},${sh.y} ${el.x},${el.y} ${hand.x},${hand.y}`;
  return (
    <>
      <polyline
        points={pts}
        fill="none"
        stroke={ARM_EDGE}
        strokeWidth={L.arm + L.armOutline * 2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={ARM}
        strokeWidth={L.arm}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </>
  );
}

export function RockClimb({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const grabTries = pickOf(settings, 'tries');
  const [game, setGame] = useState(() =>
    newRockClimb(
      {
        tier,
        holds: typeof settings.holds === 'number' ? settings.holds : 'auto',
        // No timer unless the testing tab sets one (22-minigame-revisions.md, section 2.1).
        timeSec: typeof settings.time === 'number' ? settings.time : 'auto',
        tries: grabTries === 'one' || grabTries === 'any' ? grabTries : 'auto',
        triesEach: typeof settings.triesEach === 'number' ? settings.triesEach : 'auto',
        // Prepare (20-challenge-popup.md, section 7): chalk, the harness and +1 try.
        extraReach: prepNumber(settings, 'prep.chalk'),
        harness: prepNumber(settings, 'prep.harness') > 0,
        extraTries: perHikerCounts(settings, 'prep.tries'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const colorOf = (id: string | null) => (id ? (byId(id)?.color ?? NOBODY) : NOBODY);
  const nameOf = (id: string) => (byId(id)?.name ?? id).toUpperCase();
  const running = !still && !game.over;
  const demo = useDemoMode();
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const lit = useLitArt([HOLD, GRIP, OPEN], [...hikers.map((h) => h.color), NOBODY]);
  const litArt = (f: string, c: string) => lit[litKey(f, c)] ?? asset(f);

  // The camera: it slides up over [0.5 s] after a grab, and stays put through a jump or a fall.
  const sinceGrab = game.lastGrab ? game.time - game.lastGrab.at : Infinity;
  const camH =
    game.phase === 'top'
      ? game.topH - 40
      : game.lastGrab && sinceGrab < L.cameraSec && game.phase !== 'fall'
        ? game.lastGrab.fromH + (game.at.h - game.lastGrab.fromH) * easeOut(sinceGrab / L.cameraSec)
        : game.at.h;
  const screenY = (h: number) => R.handY - (h - camH);

  const press = () => {
    if (game.phase === 'aim') setGame(hold);
  };
  const release = () => {
    if (game.phase === 'power') setGame(letGo);
  };
  /** A grab queued (or taken at once): a sound when the hand takes hold. */
  const queue = (out: RockClimbState) => {
    if (out === game) return;
    if (out.phase === 'aim') playSound('pop');
    setGame(out);
  };
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    e.preventDefault();
    if (game.phase !== 'jump') return press();
    // A tap during the jump: the hold under it (within [16] units), else the closest the jump passes.
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    const target = game.holds
      .map((h) => ({ h, d: Math.hypot(h.x - p.x, screenY(h.h) - p.y) }))
      .filter((x) => x.d <= R.tapTolerance)
      .sort((a, b) => a.d - b.d)[0];
    queue(target ? grab(game, target.h.id) : grabClosest(game));
  };
  useKeys(
    running,
    (key) => {
      if (key !== ' ') return false;
      if (game.phase === 'jump') queue(grabClosest(game));
      else press();
      return true;
    },
    (key) => key === ' ' && release(),
  );
  // The pop-up's demo: the bot aims, jumps and grabs through the same handlers.
  useDemoBot(demo && running, game, rockClimbBot, (a: ClimbAction) => {
    if (a.kind === 'press') press();
    else if (a.kind === 'release') release();
    else queue(grab(game, a.hold));
  });

  const active = activeColor(game);
  const activeC = colorOf(active);
  const leaping = game.phase === 'jump';
  const falling = game.phase === 'fall';
  const aiming = game.phase === 'aim' || game.phase === 'power';
  const showReach = pickOf(settings, 'reach') !== 'off';
  const power = powerNow(game);
  const aimDeg = aimNow(game);

  // ── The climber ──────────────────────────────────────────────────────────
  // Which hand is free (the active one): the other grips the hold.
  const free = activeHand(game) === 'left' ? -1 : 1;
  const gripColor =
    game.pathAt >= 0 ? colorOf(game.holds[game.path[game.pathAt]!]?.color ?? null) : NOBODY;
  const fall = game.lastFall;
  const sinceFall = falling ? game.time - game.phaseAt : 0;
  const backFrom = fallDropSec + R.fall.boxSec;

  /** The climber: body, both arms and hands, from where the gripping (or leading) hand is. */
  const climber = (() => {
    if (falling && fall) {
      if (sinceFall < fallDropSec) {
        // Dropping with gravity, arms up, turning a little, off the bottom of the screen.
        const drop = 0.5 * R.fall.gravity * sinceFall ** 2;
        const turn = (R.fall.turnDeg * sinceFall) / fallDropSec;
        return pose({ x: fall.hand.x, y: screenY(fall.hand.h) + drop }, 'fall', turn, 1);
      }
      if (sinceFall < backFrom) return null;
      // Back at the last hold, fading in.
      const u = (sinceFall - backFrom) / R.fall.backSec;
      return pose({ x: game.at.x, y: screenY(game.at.h) }, 'hang', 0, Math.min(1, u));
    }
    if (game.phase === 'top') {
      // On up past the line, landing standing on the ledge.
      const u = easeOut((game.time - game.phaseAt) / (R.topSec * 0.5));
      const from = screenY(game.at.h);
      const to = screenY(game.topH) - BODY.h;
      return pose({ x: game.at.x, y: from + (to - from) * u }, 'stand', 0, 1);
    }
    if (leaping) {
      const h = handAt(game);
      return pose({ x: h.x, y: screenY(h.h) }, 'leap', 0, 1);
    }
    return pose({ x: game.at.x, y: screenY(game.at.h) }, 'hang', 0, 1);
  })();

  function pose(
    at: { x: number; y: number },
    kind: 'hang' | 'leap' | 'fall' | 'stand',
    turn: number,
    opacity: number,
  ) {
    // The body under the leading (or gripping) hand.
    const lead = kind === 'leap' ? free : -free;
    const shoulderY = kind === 'stand' ? at.y + L.shoulder[1] : at.y + HANG;
    const bodyX =
      kind === 'stand' ? at.x : kind === 'fall' ? at.x : at.x - lead * (L.shoulder[0] - 2);
    const top = shoulderY - L.shoulder[1];
    const shL = { x: bodyX - L.shoulder[0], y: shoulderY };
    const shR = { x: bodyX + L.shoulder[0], y: shoulderY };
    const shOf = (side: number) => (side < 0 ? shL : shR);
    let gripHand: { x: number; y: number } | null = null;
    let openHand: { x: number; y: number };
    let otherHand: { x: number; y: number };
    if (kind === 'hang') {
      gripHand = { x: at.x, y: at.y };
      // The free hand reaches along the arrow (catching up over [0.08 s]), pulling in with power.
      const lagged = aimNow({ ...game, time: Math.max(game.phaseAt, game.time - L.catchSec) });
      const a = rad(aiming ? (game.phase === 'aim' ? lagged : aimDeg) : 90);
      const reach = L.handReach - L.pullIn * power;
      const sh = shOf(free);
      openHand = { x: sh.x + Math.cos(a) * reach, y: sh.y - Math.sin(a) * reach };
      otherHand = gripHand;
    } else if (kind === 'leap') {
      // Leading with the free hand; the other trails below.
      openHand = { x: at.x, y: at.y };
      const sh = shOf(-free);
      otherHand = { x: sh.x - free * 6, y: sh.y + 10 };
    } else if (kind === 'fall') {
      openHand = { x: shOf(free).x + free * 6, y: shoulderY - 16 };
      otherHand = { x: shOf(-free).x - free * 6, y: shoulderY - 16 };
    } else {
      // Standing on the ledge, arms up.
      openHand = { x: shOf(free).x + free * 4, y: shoulderY - 18 };
      otherHand = { x: shOf(-free).x - free * 4, y: shoulderY - 18 };
    }
    const wiggle =
      kind === 'hang' ? L.wiggle * Math.sin(2 * Math.PI * L.wigglePerSec * game.time) : 0;
    const freeSh = shOf(free);
    const otherSh = shOf(-free);
    const freeEl = elbowOf(freeSh, openHand, free, wiggle);
    const otherEl = elbowOf(otherSh, otherHand, -free);
    const ringed = kind === 'hang' && aiming;
    return {
      opacity,
      turn,
      origin: { x: bodyX, y: top + BODY.h / 2 },
      body: { left: bodyX - BODY.w / 2, top },
      arms: [
        { sh: otherSh, el: otherEl, hand: otherHand },
        { sh: freeSh, el: freeEl, hand: openHand },
      ],
      grip: gripHand,
      open: openHand,
      other: kind === 'hang' ? null : otherHand,
      ringed,
    };
  }

  const recolor = game.recolor;
  const holdColor = (id: number, color: string | null) => {
    if (!recolor || !recolor.ids.includes(id)) return colorOf(color);
    if (game.time < recolor.at) return colorOf(recolor.from);
    if (game.time < recolor.at + R.blinkSec)
      return Math.floor((game.time - recolor.at) / 0.1) % 2 === 0
        ? colorOf(recolor.from)
        : colorOf(color);
    return colorOf(color);
  };

  // The fall's box: who fell and what it cost, or who's out, or the Harness.
  const fallBox =
    falling && fall && sinceFall >= fallDropSec && sinceFall < backFrom
      ? fall.free
        ? { title: `${nameOf(fall.by)} FELL · THE HARNESS HELD`, line: 'NO TRY LOST' }
        : fall.out
          ? { title: `${nameOf(fall.by)} IS OUT`, line: `−${R.fallEnergy} ENERGY` }
          : {
              title: `${nameOf(fall.by)} FELL · ${game.triesLeft[fall.by] ?? 0} ${
                game.triesLeft[fall.by] === 1 ? 'TRY' : 'TRIES'
              } LEFT`,
              line: `−${R.fallEnergy} ENERGY`,
            }
      : null;

  const topY = screenY(game.topH);
  const lastMove = onLastMove(game) && game.phase !== 'top';
  const handOwner = falling && fall ? fall.by : active;
  const baseTries = typeof settings.triesEach === 'number' ? settings.triesEach : R.tries;
  const extraTries = perHikerCounts(settings, 'prep.tries');
  const turnWord = (id: string) =>
    game.out.includes(id) ? 'OUT' : id === handOwner ? 'NOW' : 'TRIES';

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={`${q.play} ${styles.play}`}
        onPointerDown={onDown}
        onPointerUp={() => !demo && release()}
        onPointerCancel={() => !demo && release()}
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
        {/* The top: a ledge above the line, glowing in the last move's color. */}
        {topY > -10 && (
          <>
            <span className={styles.ledge} style={{ top: topY - 60 }} />
            <span
              className={styles.topLine}
              data-glow={lastMove || undefined}
              style={{ top: topY - 1, '--glow': colorOf(game.topColor) } as CSSProperties}
            />
            <span className={`${ui.text} ${styles.topWord}`} style={{ top: topY - 14 }}>
              THE TOP
            </span>
          </>
        )}

        {/* The holds. */}
        {game.holds.map((h) => {
          const y = screenY(h.h);
          if (y < 10 || y > 205) return null;
          return (
            <img
              key={h.id}
              className={`${ui.sprite} ${styles.hold}`}
              data-grabbed={
                game.lastGrab?.hold === h.id && game.time - game.lastGrab.at < 0.3 ? '' : undefined
              }
              src={litArt(HOLD, holdColor(h.id, h.color))}
              alt=""
              draggable={false}
              style={{ left: h.x - 8, top: y - 6 }}
            />
          );
        })}

        {/* The aim: the light half circle of ticks, then the arrow's dots and head in the active color. */}
        {aiming && (
          <svg className={styles.aim} viewBox="0 0 320 240" aria-hidden="true">
            {Array.from({ length: 11 }, (_, k) => {
              const a = rad(k * 18);
              return (
                <rect
                  key={k}
                  x={game.at.x + Math.cos(a) * 30 - 0.75}
                  y={screenY(game.at.h) - Math.sin(a) * 30 - 0.75}
                  width={1.5}
                  height={1.5}
                  fill="#d3dfaf"
                  opacity={0.7}
                />
              );
            })}
            {[10, 14, 18, 22, 26, 30].map((d) => (
              <rect
                key={d}
                x={game.at.x + Math.cos(rad(aimDeg)) * d - 1}
                y={screenY(game.at.h) - Math.sin(rad(aimDeg)) * d - 1}
                width={2}
                height={2}
                fill={activeC}
              />
            ))}
            {(() => {
              const a = rad(aimDeg);
              const tip = {
                x: game.at.x + Math.cos(a) * 40,
                y: screenY(game.at.h) - Math.sin(a) * 40,
              };
              const back = {
                x: game.at.x + Math.cos(a) * 33,
                y: screenY(game.at.h) - Math.sin(a) * 33,
              };
              const n = { x: Math.sin(a) * 4, y: Math.cos(a) * 4 };
              return (
                <polygon
                  points={`${tip.x},${tip.y} ${back.x + n.x},${back.y + n.y} ${back.x - n.x},${back.y - n.y}`}
                  fill={activeC}
                  stroke={ARM_EDGE}
                  strokeWidth={0.75}
                  strokeLinejoin="round"
                />
              );
            })()}
          </svg>
        )}

        {/* While jumping: the reach around the hand, soft rings on the holds the jump can reach, and the queued one. */}
        {leaping && showReach && !onLastMove(game) && (
          <>
            <span
              className={styles.reach}
              style={{
                left: handAt(game).x - game.reach,
                top: screenY(handAt(game).h) - game.reach,
                width: game.reach * 2,
                height: game.reach * 2,
                borderColor: activeC,
              }}
            />
            {reachableHolds(game).map((h) => (
              <span
                key={h.id}
                className={styles.ring}
                style={{ left: h.x - 11, top: screenY(h.h) - 9, borderColor: activeC }}
              />
            ))}
          </>
        )}
        {leaping && game.jump?.queued != null && game.holds[game.jump.queued] && (
          <span
            className={`${ui.text} ${styles.queued}`}
            style={{
              left: game.holds[game.jump.queued]!.x,
              top: screenY(game.holds[game.jump.queued]!.h) - 16,
            }}
          >
            GRAB QUEUED
          </span>
        )}

        {/* The climber: body, arms drawn in code, the gripping hand and the big free hand. */}
        {climber && (
          <span
            className={styles.climber}
            style={{
              opacity: climber.opacity,
              transformOrigin: `${climber.origin.x}px ${climber.origin.y}px`,
              transform: climber.turn ? `rotate(${climber.turn}deg)` : undefined,
            }}
          >
            <img
              className={`${ui.sprite} ${styles.body}`}
              src={art('climber-body.png')}
              alt=""
              draggable={false}
              style={{ left: climber.body.left, top: climber.body.top }}
            />
            <svg className={styles.arms} viewBox="0 0 320 240" aria-hidden="true">
              {climber.arms.map((a, k) => (
                <Arm key={k} sh={a.sh} el={a.el} hand={a.hand} />
              ))}
            </svg>
            {climber.grip && (
              <img
                className={`${ui.sprite} ${styles.grip}`}
                src={litArt(GRIP, gripColor)}
                alt=""
                draggable={false}
                style={{ left: climber.grip.x - 6, top: climber.grip.y - 6 }}
              />
            )}
            {climber.other && (
              <img
                className={`${ui.sprite} ${styles.grip}`}
                src={litArt(GRIP, gripColor)}
                alt=""
                draggable={false}
                style={{ left: climber.other.x - 6, top: climber.other.y - 5 }}
              />
            )}
            <img
              className={`${ui.sprite} ${styles.open}`}
              src={litArt(OPEN, falling && fall ? colorOf(fall.by) : activeC)}
              alt=""
              draggable={false}
              style={{ left: climber.open.x - 7, top: climber.open.y - 7 }}
            />
            {climber.ringed && (
              <span
                className={styles.handRing}
                style={{
                  left: climber.open.x - L.ring[0],
                  top: climber.open.y - L.ring[0],
                  width: L.ring[0] * 2,
                  height: L.ring[0] * 2,
                  borderWidth: L.ring[1],
                  borderColor: activeC,
                }}
              />
            )}
          </span>
        )}

        {fallBox && (
          <span className={`${ui.box} ${styles.fallBox}`}>
            <span>{fallBox.title}</span>
            <span className={styles.fallLine}>{fallBox.line}</span>
          </span>
        )}
        {game.phase === 'top' && (
          <span className={`${ui.box} ${styles.fallBox}`}>
            <span>OVER THE TOP!</span>
          </span>
        )}

        {/* Whose hand it is. */}
        {handOwner && !game.over && (
          <span className={`${ui.box} ${styles.handLabel}`}>
            <span>{nameOf(handOwner)}’S HAND</span>
            <span className={styles.handDot} style={{ background: colorOf(handOwner) }} />
          </span>
        )}
        {game.timeSec > 0 && (
          <span className={`${ui.text} ${styles.time}`}>TIME {Math.ceil(game.timeLeft)} S</span>
        )}

        {/* The power meter, filling in the active color. */}
        <span className={styles.meter}>
          <span style={{ height: `${power * 100}%`, background: activeC }} />
        </span>
        <span className={`${ui.text} ${styles.meterLabel}`}>POWER</span>

        <p className={`${ui.muted} ${q.hint}`}>
          {lastMove && aiming
            ? 'LAST JUMP: FLY UP PAST THE TOP LINE'
            : leaping && !onLastMove(game)
              ? `GRAB A HOLD IN ${active ? nameOf(active) : ''}’S COLOR`
              : 'HOLD TO STOP THE ARROW, LET GO AT THE RIGHT POWER'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>ROCK CLIMB</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>HEIGHT</span>
          <span className={hud.bar}>
            <span
              style={{
                width: `${(game.phase === 'top' ? 1 : (game.pathAt + 1) / (game.path.length + 1)) * 100}%`,
              }}
            />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        {/* Each hiker's tries, as pips in their color. */}
        <TurnBar
          hikers={hikers}
          word={turnWord}
          active={game.over ? undefined : (handOwner ?? undefined)}
          extra={(id) => {
            const left = game.triesLeft[id] ?? 0;
            const total = Math.max(left, baseTries + (extraTries[id] ?? 0));
            return (
              <span className={styles.pips} aria-label={`${left} tries left`}>
                {Array.from({ length: total }, (_, k) => (
                  <span
                    key={k}
                    style={k < left ? { background: colorOf(id) } : undefined}
                    data-on={k < left || undefined}
                  />
                ))}
              </span>
            );
          }}
        />
      </div>
    </PixelScreen>
  );
}
