/**
 * Squirrel Theft on the GPS (docs/design/23-minigames-final.md, section 4;
 * mockups 43a-squirrel-theft-intro.png and 43b-squirrel-theft.png), in
 * scene units (320 × 240).
 *
 * - **The intro:** "SQUIRREL THEFT!" on a dark arcade screen, the thief
 *   running off with a pack, and "IT TOOK:" with what was stolen. A tap
 *   skips it.
 * - **The gallery:** trees with branches and three rows of cover. Squirrels
 *   (and from Tier III, bears) pop up; from Tier II some run along a
 *   branch. Tap or click a spot to throw a nut there from the hand at the
 *   bottom; it lands a moment later.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { testPack } from '../../../minigames/hikers';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';
import { turnWord } from '../../../minigames/quick/turns';
import { squirrelTheftBot, type SquirrelAction } from '../../../minigames/squirrelTheft/bot';
import {
  happyEnough,
  isUp,
  newSquirrelTheft,
  result,
  skipIntro,
  targetAt,
  thrower,
  throwNut,
  tick,
} from '../../../minigames/squirrelTheft/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useReportOnce } from '../quick/useQuick';
import styles from './SquirrelTheft.module.css';

const ST = BALANCE.minigames.squirrelTheft;
const art = (f: string) => asset(`minigames/squirrel-theft/${f}`);
/** The thrower's hand, at the bottom middle. */
const HAND = { x: 160, y: 192 };

export function SquirrelTheft({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const bearsPick = pickOf(settings, 'bears');
  const [game, setGame] = useState(() =>
    newSquirrelTheft(
      {
        tier,
        packs: Object.fromEntries(hikers.map((h) => [h.id, h.pack ?? testPack(seed, h.id)])),
        stolen: typeof settings.stolen === 'number' ? settings.stolen : 'auto',
        bears: bearsPick === 'on' || bearsPick === 'off' ? bearsPick : 'auto',
        // Prepare (23-minigames-final.md, section 10).
        extraNuts: perHikerCounts(settings, 'prep.nuts'),
        baitSec: prepNumber(settings, 'prep.bait') > 0 ? ST.baitSec : 0,
        noBears: prepNumber(settings, 'prep.bearSpray') > 0,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const demo = useDemoMode();
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const sceneRef = useRef<HTMLDivElement>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const who = thrower(game);
  const color = who ? (byId(who)?.color ?? '#d3dfaf') : '#d3dfaf';

  const act = (a: SquirrelAction) => {
    if (a.kind === 'skip') setGame((s) => skipIntro(s));
    else {
      playSound('tick');
      setGame((s) => throwNut(s, a.to));
    }
  };
  useDemoBot(demo && running, game, squirrelTheftBot, act);
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    e.preventDefault();
    if (game.phase === 'intro') return act({ kind: 'skip' });
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    if (p.y < 24 || p.y > 194) return;
    act({ kind: 'throw', to: p });
  };

  const last = game.last && game.time - game.last.at < 0.7 ? game.last : null;
  const lineShare = Math.min(1, game.line / Math.max(1, game.nutsAll));
  const ended = game.phase === 'end';
  const word = (id: string) => {
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'THROWING' : w;
  };

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={`${q.play} ${styles.play}`}
        onPointerDown={onDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {game.phase === 'intro' ? (
          /* The intro: the thief runs off with a pack. */
          <div className={styles.intro}>
            <span className={`${ui.text} ${styles.title}`}>SQUIRREL THEFT!</span>
            <img
              className={`${ui.sprite} ${styles.thief}`}
              src={art('thief.png')}
              alt="A squirrel running off with a pack"
              draggable={false}
              style={{ left: 140 - Math.min(1, game.time / ST.introSec) * 30 }}
            />
            <span className={`${ui.muted} ${styles.took}`}>IT TOOK:</span>
            <span className={styles.stolen}>
              {game.stolen.map((x, k) => (
                <img
                  key={k}
                  className={ui.sprite}
                  src={asset(`resources-green/${x.id}.png`)}
                  alt={x.id}
                  draggable={false}
                />
              ))}
              {!game.stolen.length && <span className={ui.muted}>NOTHING</span>}
            </span>
          </div>
        ) : (
          <>
            <img
              className={`${ui.sprite} ${styles.bg}`}
              src={art('bg.png')}
              alt=""
              draggable={false}
            />
            {game.targets.map((t) => {
              if (!isUp(t, game.time)) return null;
              const p = targetAt(t, game.time);
              const bear = t.kind === 'bear';
              const w = bear ? 30 : 22;
              const h = bear ? 22 : 18;
              return (
                <img
                  key={t.id}
                  className={`${ui.sprite} ${styles.target}`}
                  src={art(
                    bear
                      ? 'bear.png'
                      : t.fedAt !== undefined
                        ? 'squirrel-happy.png'
                        : 'squirrel.png',
                  )}
                  alt=""
                  draggable={false}
                  style={{
                    left: p.x - w / 2,
                    top: p.y - h / 2,
                    width: w,
                    height: h,
                    transform: t.run && t.run.x1 < t.run.x0 ? 'scaleX(-1)' : undefined,
                  }}
                />
              );
            })}
            {/* Nuts in flight, on an arc from the hand. */}
            {game.nuts.map((n) => {
              const u = Math.min(1, (game.time - n.thrownAt) / (n.landAt - n.thrownAt));
              const x = HAND.x + (n.to.x - HAND.x) * u;
              const y = HAND.y + (n.to.y - HAND.y) * u - Math.sin(Math.PI * u) * 30;
              return (
                <img
                  key={n.id}
                  className={`${ui.sprite} ${styles.nut}`}
                  src={art('nut.png')}
                  alt=""
                  draggable={false}
                  style={{ left: x - 3.5, top: y - 4 }}
                />
              );
            })}
            {last && (
              <span className={q.word} style={{ left: last.x, top: last.y - 12 }}>
                {last.kind === 'fed' ? '+1' : last.kind === 'bear' ? `−${ST.bear.cost}` : ''}
              </span>
            )}
            {/* The thrower's hand, in their color. */}
            {who && !ended && (
              <span className={styles.hand} style={{ left: HAND.x - 6, top: HAND.y - 6 }}>
                <span className={styles.sleeve} style={{ background: color }} />
                <img className={ui.sprite} src={art('nut.png')} alt="" draggable={false} />
              </span>
            )}
            {ended && (
              <span className={`${ui.box} ${q.handoff}`}>
                {happyEnough(game) ? 'THEY’RE HAPPY! YOU GOT IT BACK.' : 'THEY KEPT IT.'}
              </span>
            )}
          </>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          {game.phase === 'intro'
            ? 'THROW NUTS TO MAKE THE SQUIRRELS HAPPY, AND THEY’LL GIVE IT BACK.'
            : 'TAP A SQUIRREL TO THROW. NUTS TAKE A MOMENT TO LAND: AIM WHERE THEY’LL BE.'}
        </p>

        {/* The top HUD: the HAPPY bar and its line. */}
        <div className={`${ui.box} ${hud.name}`}>SQUIRREL THEFT</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>HAPPY</span>
          <Bar value={game.happy / Math.max(1, game.nutsAll)}>
            <i className={styles.line} style={{ left: `${lineShare * 100}%` }} />
          </Bar>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over || game.phase === 'intro' ? undefined : who}
          extra={(id) => (
            <span className={styles.nuts} aria-label={`${game.nutsLeft[id] ?? 0} nuts`}>
              {Array.from({ length: Math.max(0, game.nutsLeft[id] ?? 0) }, (_, k) => (
                <img key={k} className={ui.sprite} src={art('nut.png')} alt="" draggable={false} />
              ))}
            </span>
          )}
        />
      </div>
    </PixelScreen>
  );
}
