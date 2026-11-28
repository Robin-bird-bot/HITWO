/**
 * Spooky Ghost! on the GPS (docs/design/24-challenges-reset.md, section 6;
 * mockup 54-spooky-ghost.png), in scene units (320 × 240): a pitch-black
 * field but for the flashlight around the pointer. Inside the light: the
 * ground, the hikers' mittens (each tinted with its hiker's color, ringed),
 * and the ghosts, fading in and out, with a BOO wobble when the light finds
 * one. The screen's edges pulse red while sanity drains fast.
 *
 * Mouse: the light follows the pointer and a click taps. Touch: drag to
 * move the light; a tap picks.
 */
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { prepNumber } from '../../../minigames/prepare';
import { spookyGhostBot, type SpookyAction } from '../../../minigames/spookyGhost/bot';
import {
  ghostOpacity,
  isDone,
  lit,
  moveLight,
  newSpookyGhost,
  result,
  tap,
  tick,
} from '../../../minigames/spookyGhost/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { Bar } from '../Bar';
import { useDemoBot, useDemoMode } from '../demo';
import { PixelScreen } from '../PixelScreen';
import { tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { useFrameSounds, useMgLoop, type FrameSound } from '../sound';
import { tintKey, useTintedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useReportOnce } from '../quick/useQuick';
import styles from './SpookyGhost.module.css';

const G = BALANCE.minigames.spookyGhost;
const file = (f: string) => `minigames/spooky-ghost/${f}`;
const MITTEN = file('mitten.png');
const num = (v: unknown): number | 'auto' => (typeof v === 'number' ? v : 'auto');
/** A press that moves less than this (screen px) is a tap. */
const TAP_PX = 8;
/** The light's soft edge (scene units). */
const SOFT = 3;

export function SpookyGhost({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newSpookyGhost(
      {
        tier,
        finds: num(settings.finds),
        sanitySec: num(settings.sanity),
        ghosts: num(settings.ghosts),
        // Prepare (24-challenges-reset.md, section 6).
        slower: prepNumber(settings, 'prep.slower') * G.foodSlower,
        biggerLight: prepNumber(settings, 'prep.lantern') * G.lanternBigger,
        calmGhosts: prepNumber(settings, 'prep.charm') > 0,
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
  const press = useRef<{ x: number; y: number } | null>(null);
  const colors = hikers.map((h) => h.color);
  const tinted = useTintedArt([MITTEN], colors);
  const byId = (id: string) => hikers.find((h) => h.id === id);

  const doTap = (at: { x: number; y: number }) =>
    setGame((s) => {
      const out = tap(s, at);
      return out;
    });
  // The flashlight clicks on, ghosts wail as they float in, a mitten's chime, and a
  // heartbeat while sanity is low.
  useFrameSounds(game, (a, b) => {
    const out: FrameSound[] = [];
    if (a.time === 0 && b.time > 0) out.push('ghost.flashlight');
    if (b.nextGhostId > a.nextGhostId) out.push('ghost.wail');
    if (b.lastFind && b.lastFind !== a.lastFind) out.push('ghost.mitten');
    return out;
  });
  useMgLoop('ghost.heartbeat', running && game.sanity < game.sanitySec * BALANCE.audio.lowSanity);
  const act = (a: SpookyAction) =>
    a.kind === 'tap' ? doTap(a.at) : setGame((s) => moveLight(s, a.to));
  useDemoBot(demo && running, game, spookyGhostBot, act);

  const scene = (e: ReactPointerEvent) => toScene(sceneRef.current, e.clientX, e.clientY);
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    press.current = { x: e.clientX, y: e.clientY };
    const p = scene(e);
    setGame((s) => moveLight(s, p));
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!running || demo) return;
    const p = scene(e);
    setGame((s) => moveLight(s, p));
  };
  const onUp = (e: ReactPointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start || !running || demo) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_PX) doTap(scene(e));
  };

  const { light, lightR } = game;
  const mask = `radial-gradient(circle at ${light.x}px ${light.y}px, #000 ${lightR - SOFT}px, transparent ${lightR}px)`;
  const litStyle: CSSProperties = { maskImage: mask, WebkitMaskImage: mask };
  const frame = Math.floor(game.time / 0.4) % 2 === 0 ? 'ghost-1.png' : 'ghost-2.png';
  const fresh = game.lastFind && game.time - game.lastFind.at < 0.7 ? game.lastFind : null;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={`${q.play} ${styles.play}`}
        data-demo={demo || undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Only what's in the light shows. */}
        <div className={styles.lit} style={litStyle}>
          <span className={styles.ground} />
          {game.mittens.map((m) => {
            const color = byId(m.owner)?.color ?? '#d3dfaf';
            return (
              <span key={`${m.owner}-${m.at}`}>
                <span
                  className={styles.ring}
                  style={{ left: m.x - 9, top: m.y - 9, borderColor: color }}
                />
                <img
                  className={`${ui.sprite} ${q.thing}`}
                  src={tinted[tintKey(MITTEN, color)] ?? asset(MITTEN)}
                  alt=""
                  draggable={false}
                  style={{ left: m.x - 6, top: m.y - 6, width: 12, height: 12 }}
                />
              </span>
            );
          })}
          {game.ghosts.map((g) => {
            const opacity = ghostOpacity(g, game.time);
            if (opacity <= 0) return null;
            const boo = g.booAt !== null && game.time - g.booAt < G.booSec;
            return (
              <span key={g.id}>
                <img
                  className={`${ui.sprite} ${q.thing} ${styles.ghost}`}
                  data-boo={boo || undefined}
                  src={asset(file(frame))}
                  alt=""
                  draggable={false}
                  style={{ left: g.x - 10, top: g.y - 11, width: 20, height: 22, opacity }}
                />
                {boo && lit(game, g) && (
                  <span className={styles.boo} style={{ left: g.x + 9, top: g.y - 12 }}>
                    BOO
                  </span>
                )}
              </span>
            );
          })}
        </div>
        {/* The light's edge. */}
        {!game.over && (
          <span
            className={styles.beam}
            style={{
              left: light.x - lightR,
              top: light.y - lightR,
              width: lightR * 2,
              height: lightR * 2,
            }}
          />
        )}
        {fresh && (
          <span
            className={q.word}
            style={{
              left: fresh.x,
              top: fresh.y - 10 - (game.time - fresh.at) * 10,
              color: byId(fresh.owner)?.color,
              fontSize: 5,
            }}
          >
            FOUND!
          </span>
        )}
        {/* Sanity draining fast: the edges pulse red. */}
        {game.draining && !game.over && <span className={styles.pulse} aria-hidden="true" />}

        <p className={`${ui.muted} ${q.hint}`}>
          ONLY YOUR LIGHT SHOWS ANYTHING. KEEP IT OFF THE GHOSTS: THEY DRAIN YOUR SANITY.
        </p>

        {/* The top HUD: the party's sanity. */}
        <div className={`${ui.box} ${hud.name}`}>SPOOKY GHOST!</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>{game.over ? 'DONE' : 'SANITY'}</span>
          <Bar
            className={`${hud.bar} ${styles.sanity}`}
            value={game.sanity / game.sanitySec}
            live
          />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={(id) => {
            const n = game.found[id] ?? 0;
            if (game.over) return isDone(game, id) ? 'PASSED' : 'FAILED';
            return isDone(game, id) ? 'DONE' : `${n} OF ${game.need} FOUND`;
          }}
          extra={(id) => {
            const n = Math.min(game.need, game.found[id] ?? 0);
            return (
              <span className={styles.finds} aria-label={`${n} of ${game.need} found`}>
                {Array.from({ length: game.need }, (_, k) => (
                  <span key={k} style={k < n ? { background: byId(id)?.color } : undefined} />
                ))}
              </span>
            );
          }}
        />
      </div>
    </PixelScreen>
  );
}
