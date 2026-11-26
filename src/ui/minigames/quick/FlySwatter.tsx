/**
 * Fly Swatter on the GPS (docs/design/18-minigames-quick.md, section 5;
 * mockup 8-fly-swatter.png), in scene units (320 × 240): a picnic blanket;
 * circles in the active hiker's color shrink where flies will land, each fly
 * coming in on a dotted trail. Bee circles have a dashed light outline. The
 * cursor is a fly swatter. Tap, click or press Space with the pointer over a
 * circle.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  flyAt,
  newFlySwatter,
  radiusAt,
  result,
  tapAt,
  tick,
} from '../../../minigames/flySwatter/logic';
import { current, playing, turnWord } from '../../../minigames/quick/turns';
import { TIER_LABELS } from '../../../minigames/types';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import styles from './FlySwatter.module.css';
import q from './Quick.module.css';
import { Squares, TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';

const FS = BALANCE.minigames.flySwatter;
const art = (f: string) => asset(`minigames/fly-swatter/${f}`);
/** The swatter's hot spot: the middle of its mesh. */
const HOT = { x: 17, y: 15 };

export function FlySwatter({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const beesPick = pickOf(settings, 'bees');
  const [game, setGame] = useState(() =>
    newFlySwatter(
      {
        tier,
        bees: beesPick === 'on' || beesPick === 'off' ? beesPick : 'auto',
        strikes: typeof settings.strikes === 'number' ? settings.strikes : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [swatAt, setSwatAt] = useState(-9);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);

  const who = current(game.turns);
  const onTurn = playing(game.turns);
  const color = who ? byId(who).color : '#d3dfaf';

  const swat = (x: number, y: number) => {
    setSwatAt(game.time);
    const out = tapAt(game, x, y);
    if (out === game) return;
    const last = out.events.at(-1);
    playSound(last?.kind === 'swat' ? 'pop' : 'hit');
    setGame(out);
  };
  const onDown = (e: ReactPointerEvent) => {
    if (!running) return;
    e.preventDefault();
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    setPointer(p);
    swat(p.x, p.y);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    setPointer(toScene(sceneRef.current, e.clientX, e.clientY));
  };
  useKeys(running, (key) => {
    if (key !== ' ' || !pointer) return false;
    swat(pointer.x, pointer.y);
    return true;
  });

  const frame = Math.floor(game.time / FS.frameSec) % 2 === 0 ? 1 : 2;
  const fresh = (sec: number) => game.events.filter((e) => game.time - e.at < sec);
  const stung = fresh(FS.shakeSec).some((e) => e.kind === 'sting');
  const shake = stung ? Math.sin(game.time * 90) * 1.5 : 0;
  const swatting = game.time - swatAt < FS.swatSec;
  const strikesLeft = (id: string) =>
    Math.max(
      0,
      game.strikesAllowed -
        (id === who && !game.over ? game.strikes : (game.record[id]?.strikes ?? 0)),
    );
  const hint =
    game.beeShare > 0
      ? 'TAP EACH CIRCLE BEFORE THE FLY LANDS. LEAVE THE BEES ALONE.'
      : 'TAP EACH CIRCLE BEFORE THE FLY LANDS.';

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={`${q.play} ${styles.play}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={() => setPointer(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className={styles.shake} style={{ transform: `translateX(${shake}px)` }}>
          <img className={`${ui.sprite} ${q.bg}`} src={art('bg.png')} alt="" draggable={false} />

          {/* The circles, their flies and bees, and the dotted trails. */}
          {onTurn && (
            <svg className={styles.trails} viewBox="0 0 320 240" aria-hidden="true">
              {game.circles.map((c) => {
                const f = flyAt(game, c);
                return (
                  <line
                    key={c.id}
                    x1={c.fromX}
                    y1={c.fromY}
                    x2={f.x}
                    y2={f.y}
                    stroke="#d3dfaf"
                    strokeWidth={0.75}
                    strokeDasharray="1.5 2.5"
                    opacity={0.7}
                  />
                );
              })}
            </svg>
          )}
          {onTurn &&
            game.circles.map((c) => {
              const r = radiusAt(game, c);
              return (
                <span
                  key={c.id}
                  className={c.bee ? styles.bee : styles.circle}
                  style={{
                    left: c.x - r,
                    top: c.y - r,
                    width: r * 2,
                    height: r * 2,
                    ...(c.bee ? {} : { borderColor: color }),
                  }}
                >
                  {!c.bee && <span className={styles.dot} />}
                </span>
              );
            })}
          {onTurn &&
            game.circles.map((c) => {
              const f = flyAt(game, c);
              const [w, h] = c.bee ? [16, 14] : [14, 12];
              return (
                <img
                  key={`f${c.id}`}
                  className={`${ui.sprite} ${q.thing}`}
                  src={art(`${c.bee ? 'bee' : 'fly'}-${frame}.png`)}
                  alt=""
                  draggable={false}
                  style={{ left: f.x - w / 2, top: f.y - h / 2, width: w, height: h }}
                />
              );
            })}

          {/* Splats, landed flies and stings. */}
          {fresh(FS.splatSec).map((e, k) =>
            e.kind === 'swat' ? (
              <img
                key={k}
                className={`${ui.sprite} ${q.thing}`}
                src={art('splat.png')}
                alt=""
                draggable={false}
                style={{ left: e.x - 8, top: e.y - 7, width: 16, height: 14 }}
              />
            ) : e.kind === 'land' ? (
              <span key={k}>
                <img
                  className={`${ui.sprite} ${q.thing}`}
                  src={art('fly-1.png')}
                  alt=""
                  draggable={false}
                  style={{ left: e.x - 7, top: e.y - 6, width: 14, height: 12 }}
                />
                <span className={q.word} style={{ left: e.x, top: e.y - 12 }}>
                  LANDED
                </span>
              </span>
            ) : e.kind === 'sting' ? (
              <span
                key={k}
                className={q.word}
                style={{ left: e.x, top: e.y - 10, color: '#e5624a' }}
              >
                OUCH!
              </span>
            ) : e.kind === 'stray' ? (
              <span key={k} className={q.word} style={{ left: e.x, top: e.y - 8 }}>
                MISS
              </span>
            ) : null,
          )}
        </div>

        {!onTurn && !game.over && who && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(who).name.toUpperCase()}, YOUR TURN
          </span>
        )}
        <p className={`${ui.muted} ${q.hint}`}>{hint}</p>

        {/* The swatter (the cursor). */}
        {pointer && running && (
          <img
            className={`${ui.sprite} ${styles.swatter}`}
            src={art(swatting ? 'swatter-swat.png' : 'swatter-ready.png')}
            alt=""
            draggable={false}
            style={{ left: pointer.x - HOT.x, top: pointer.y - HOT.y }}
          />
        )}

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>FLY SWATTER</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            SWATS {game.swats}/{game.flies}
          </span>
          <span className={hud.bar}>
            <span style={{ width: `${(game.swats / game.flies) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={(id) => turnWord(game.turns, id)}
          active={game.over ? undefined : who}
          extra={(id) => (
            <Squares
              total={game.strikesAllowed}
              lit={strikesLeft(id)}
              label={`${strikesLeft(id)} strikes left`}
            />
          )}
        />
      </div>
    </PixelScreen>
  );
}
