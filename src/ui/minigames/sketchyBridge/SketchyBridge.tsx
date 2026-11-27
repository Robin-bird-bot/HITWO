/**
 * Sketchy Bridge on the GPS (docs/design/23-minigames-final.md, section 1;
 * mockup 40-sketchy-bridge.png), in scene units (320 × 240): a side view of
 * a rope bridge across a gorge. Hikers waiting stand on the left cliff,
 * those across on the right; the one crossing walks while their icon is in
 * the zone, and wobbles when it isn't. Planks crack and fall as the bridge
 * weakens. The balance bar is on the right.
 *
 * Hold (Space, the mouse button, or a finger anywhere) to raise the zone;
 * let go and it falls.
 */
import { useMemo, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { seedRng, shuffle } from '../../../engine/rng';
import { prepNumber } from '../../../minigames/prepare';
import { turnWord } from '../../../minigames/quick/turns';
import { sketchyBridgeBot } from '../../../minigames/sketchyBridge/bot';
import {
  fallenPlanks,
  inZone,
  newSketchyBridge,
  onBridge,
  result,
  setHolding,
  tick,
} from '../../../minigames/sketchyBridge/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { HikerToken } from '../HikerToken';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { tintKey, useTintedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './SketchyBridge.module.css';

const B = BALANCE.minigames.sketchyBridge;
const art = (f: string) => asset(`minigames/sketchy-bridge/${f}`);
const HIKER_FILES = ['hiker-stand.png', 'hiker-walk-1.png', 'hiker-walk-2.png'].map(
  (f) => `minigames/sleeping-bear/${f}`,
);
/** The gorge art's top on screen, and the bridge from cliff to cliff (scene units). */
const BG_TOP = 22;
const DECK = { x0: 52, x1: 266, y: BG_TOP + 70, sag: 16 };
const ROPE_SAG = 12;
const PLANK_W = 9;
const PLANKS = Math.floor((DECK.x1 - DECK.x0) / PLANK_W);
/** The balance bar on the right. */
const BAR = { x: 298, top: 30, w: 16 };

/** The deck's height at x: a gentle sag between the cliffs. */
const deckY = (x: number, sag = DECK.sag) => {
  const u = (x - DECK.x0) / (DECK.x1 - DECK.x0);
  return DECK.y + sag * 4 * u * (1 - u);
};

export function SketchyBridge({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newSketchyBridge(
      {
        tier,
        integrity: typeof settings.bridge === 'number' ? settings.bridge : 'auto',
        // Prepare (23-minigames-final.md, section 10).
        patch: prepNumber(settings, 'prep.patch'),
        extraZone: prepNumber(settings, 'prep.zone'),
        // FOOD: slower sway (24-challenges-reset.md, section 5).
        lessSway: prepNumber(settings, 'prep.slower') * B.foodSway,
        harness: prepNumber(settings, 'prep.harness') > 0,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const demo = useDemoMode();
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const tints = useTintedArt(
    HIKER_FILES,
    hikers.map((h) => h.color),
  );
  const hikerArt = (k: number, color: string) =>
    tints[tintKey(HIKER_FILES[k]!, color)] ?? asset(HIKER_FILES[k]!);
  // The order planks fall in (fixed for the run).
  const fallOrder = useMemo(
    () =>
      shuffle(
        seedRng(seed + 17),
        Array.from({ length: PLANKS }, (_, k) => k),
      ),
    [seed],
  );

  const hold = (on: boolean) => running && setGame((s) => setHolding(s, on));
  useKeys(
    running,
    (key) => {
      if (key !== ' ') return false;
      hold(true);
      return true;
    },
    (key) => key === ' ' && hold(false),
  );
  useDemoBot(demo && running, game, sketchyBridgeBot, (on) => setGame((s) => setHolding(s, on)));

  const who = onBridge(game);
  const inside = inZone(game);
  const fallen = fallenPlanks(game);
  const gone = new Set(fallOrder.slice(0, fallen));
  const cracking = new Set(fallOrder.slice(fallen, fallen + 2));
  const flapping = !!game.gust && game.time < game.gust.pushAt;
  const sway = !inside && who ? Math.sin(game.time * 14) * 1.2 : 0;
  const ropeShake = flapping ? Math.sin(game.time * 40) * 2 : 0;
  const broke = game.integrity <= 0;
  const across = game.turns.order.filter((id) => game.turns.done[id] === true);
  const waiting = game.turns.order.filter((id) => game.turns.done[id] === undefined && id !== who);
  const frame = (t: number) => (inside && who ? 1 + (Math.floor(t * 6) % 2) : 0);
  const showTarget = pickOf(settings, 'showTarget') === 'on';

  // The crossing hiker on the deck (falling once it breaks).
  const walkX = DECK.x0 + 4 + (game.walked / game.crossSec) * (DECK.x1 - DECK.x0 - 18);
  const walkerY = deckY(walkX + 5) - 13 + sway;

  const barBottom = BAR.top + B.barH;
  const word = (id: string) => {
    if (id === game.brokeOn) return 'FELL';
    if (broke && game.turns.done[id] === undefined) return 'STAYED BACK';
    if (game.turns.done[id]) return 'ACROSS';
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'CROSSING' : w;
  };

  return (
    <PixelScreen measure={!still}>
      <div
        className={`${q.play} ${styles.play}`}
        onPointerDown={(e) => {
          if (demo || !running) return;
          e.preventDefault();
          hold(true);
        }}
        onPointerUp={() => !demo && hold(false)}
        onPointerCancel={() => !demo && hold(false)}
        onPointerLeave={() => !demo && hold(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          className={`${ui.sprite} ${styles.bg}`}
          src={art('gorge.png')}
          alt=""
          draggable={false}
        />

        {/* The ropes and hangers (drawn in code), shaking when the wind flaps them. */}
        <svg className={styles.ropes} viewBox="0 0 320 240" aria-hidden="true">
          <path
            d={`M${DECK.x0 - 3} ${DECK.y - 20} Q160 ${DECK.y - 20 + ROPE_SAG * 2 + ropeShake} ${DECK.x1 + 3} ${DECK.y - 20}`}
            fill="none"
            stroke="#1d2918"
            strokeWidth={0.9}
          />
          <path
            d={`M${DECK.x0} ${DECK.y} Q160 ${DECK.y + DECK.sag * 2 + ropeShake + (broke ? 60 : 0)} ${DECK.x1} ${DECK.y}`}
            fill="none"
            stroke="#1d2918"
            strokeWidth={0.9}
          />
          {Array.from({ length: 9 }, (_, k) => {
            const x = DECK.x0 + ((k + 1) * (DECK.x1 - DECK.x0)) / 10;
            const u = (x - DECK.x0) / (DECK.x1 - DECK.x0);
            const top = DECK.y - 20 + (ROPE_SAG + ropeShake / 2) * 4 * u * (1 - u);
            return (
              <line
                key={k}
                x1={x}
                y1={top}
                x2={x}
                y2={deckY(x)}
                stroke="#3c4e2f"
                strokeWidth={0.5}
              />
            );
          })}
        </svg>
        {/* The planks: fallen ones are gone; the next to go are cracked. */}
        {Array.from({ length: PLANKS }, (_, k) => {
          if (gone.has(k) || broke) return null;
          const x = DECK.x0 + k * PLANK_W;
          return (
            <img
              key={k}
              className={`${ui.sprite} ${styles.plank}`}
              src={art(cracking.has(k) ? 'plank-cracked.png' : 'plank.png')}
              alt=""
              draggable={false}
              style={{ left: x, top: deckY(x + PLANK_W / 2) - 1 + sway / 2 }}
            />
          );
        })}
        <img
          className={`${ui.sprite} ${styles.post}`}
          src={art('post.png')}
          alt=""
          draggable={false}
          style={{ left: DECK.x0 - 6, top: DECK.y - 22 }}
        />
        <img
          className={`${ui.sprite} ${styles.post}`}
          src={art('post.png')}
          alt=""
          draggable={false}
          style={{ left: DECK.x1, top: DECK.y - 22 }}
        />

        {/* Hikers: waiting on the left cliff, across on the right. */}
        {waiting.map((id, k) => (
          <img
            key={id}
            className={`${ui.sprite} ${styles.hiker}`}
            src={hikerArt(0, byId(id)?.color ?? '#d3dfaf')}
            alt=""
            draggable={false}
            style={{ left: 34 - k * 12, top: DECK.y - 13 }}
          />
        ))}
        {across.map((id, k) => (
          <img
            key={id}
            className={`${ui.sprite} ${styles.hiker}`}
            src={hikerArt(0, byId(id)?.color ?? '#d3dfaf')}
            alt=""
            draggable={false}
            style={{ left: DECK.x1 + 8 + k * 12, top: DECK.y - 13 }}
          />
        ))}
        {who && byId(who) && (
          <img
            className={`${ui.sprite} ${styles.hiker}`}
            data-falling={broke || undefined}
            src={hikerArt(frame(game.time), byId(who)!.color)}
            alt=""
            draggable={false}
            style={{ left: walkX, top: walkerY }}
          />
        )}
        {!inside && who && !broke && (
          <span className={q.word} style={{ left: walkX + 5, top: walkerY - 6 }}>
            !
          </span>
        )}
        {flapping && (
          <span className={q.word} style={{ left: 160, top: DECK.y - 34 }}>
            WIND!
          </span>
        )}
        {broke && (
          <span className={`${ui.box} ${q.handoff}`}>
            SNAP! {game.brokeOn ? `${(byId(game.brokeOn)?.name ?? '').toUpperCase()} FELL` : ''}
          </span>
        )}

        {/* The balance bar: the zone (yours) and the hiker's icon. */}
        <span
          className={styles.bar}
          style={{ left: BAR.x, top: BAR.top, width: BAR.w, height: B.barH }}
        >
          <span
            className={styles.zone}
            data-in={inside || undefined}
            style={{ bottom: game.zoneY, height: game.zoneH }}
          />
          {showTarget && <span className={styles.target} style={{ bottom: game.target - 0.5 }} />}
        </span>
        {who && byId(who) && (
          <HikerToken
            hiker={byId(who)!}
            size={10}
            state="current"
            className={styles.icon}
            style={{ left: BAR.x + BAR.w / 2 - 5, top: barBottom - game.iconY - 5 }}
          />
        )}
        <span
          className={`${ui.text} ${styles.barLabel}`}
          style={{ left: BAR.x - 2, top: barBottom + 3 }}
        >
          HOLD
        </span>

        <p className={`${ui.muted} ${q.hint}`}>
          HOLD TO RAISE THE ZONE.{' '}
          {who ? `${(byId(who)?.name ?? '').toUpperCase()} WALKS` : 'YOU WALK'} WHILE IN IT. OUTSIDE
          IT, THE BRIDGE WEAKENS.
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>SKETCHY BRIDGE</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>BRIDGE</span>
          <Bar value={game.integrity / game.full} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar hikers={hikers} word={word} active={game.over ? undefined : who} />
      </div>
    </PixelScreen>
  );
}
