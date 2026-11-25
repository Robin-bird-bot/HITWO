/**
 * Dodge on the GPS (docs/design/12-minigames-dodge.md;
 * docs/mockups/minigames/dodge/1-bees.png to 3-hit-switch-joystick.png), in
 * scene units (320 × 240).
 *
 * - **Top:** the animal's name, a SURVIVE bar emptying as time runs down,
 *   and the tier.
 * - **The animal** above the box; **the box** below it, where the party's
 *   sprite (tinted in the active hiker's color) dodges.
 * - **Warnings:** "!" at the bees' entry points, or the half a sword swing
 *   will sweep, hatched.
 * - **Bottom:** each hiker with their hearts; the active one outlined, out
 *   ones greyed with a red slash; "NEXT SWITCH IN 2S".
 *
 * Controls: WASD or the arrow keys; a floating joystick where a finger (or
 * the mouse) goes down.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  beeAt,
  joystickVector,
  keysToVector,
  newDodge,
  nextInLine,
  result,
  step,
  swingAngle,
  swordPivot,
  switches,
  type Animal,
  type Point,
} from '../../../minigames/dodge/logic';
import type { MinigameSettings } from '../../../minigames/types';
import { useReducedMotion } from '../../app/useReducedMotion';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import ui from '../gpsUi.module.css';
import { useTinted } from './tint';
import styles from './Dodge.module.css';

const D = BALANCE.minigames.dodge;
const art = (f: string) => asset(`minigames/dodge/${f}`);
const ROMAN = ['', 'I', 'II', 'III'];
const NAMES: Record<Animal, string> = { bees: 'Bees', bear: 'Bear + sword' };
const FIXED = 1 / 120;

const numberOr = (settings: MinigameSettings, id: string): 'auto' | number => {
  const v = settings[id];
  return typeof v === 'number' ? v : 'auto';
};

export function Dodge({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const reduced = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const animal: Animal = pickOf(settings, 'animal') === 'bear' ? 'bear' : 'bees';
  const [game, setGame] = useState(() =>
    newDodge(
      {
        animal,
        tier: tierOf(settings),
        lives: numberOr(settings, 'lives'),
        lengthSec: numberOr(settings, 'length'),
        switchSec: numberOr(settings, 'switch'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const keys = useRef(new Set<string>());
  const stick = useRef<{ id: number; start: Point; now: Point; startScene: Point } | null>(null);
  const [joy, setJoy] = useState<{ base: Point; knob: Point } | null>(null);
  const reported = useRef(false);
  const tints = useTinted(hikers.map((h) => h.color));
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

  // The keyboard: WASD and the arrow keys, held down.
  useEffect(() => {
    if (still) return;
    const watched = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'w',
      'a',
      's',
      'd',
      'W',
      'A',
      'S',
      'D',
    ]);
    const down = (e: KeyboardEvent) => {
      if (!watched.has(e.key)) return;
      e.preventDefault();
      keys.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [still]);

  // The game loop: fixed steps, as fast as the screen draws.
  const running = !game.over && !still;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function loop(now) {
      spare = Math.min(0.25, spare + (now - last) / 1000);
      last = now;
      const s = stick.current;
      const input = s ? joystickVector(s.start, s.now).move : keysToVector(keys.current);
      // How many fixed steps are due, worked out here so the state update itself stays pure.
      const steps = Math.floor(spare / FIXED);
      spare -= steps * FIXED;
      if (steps > 0) {
        setGame((g) => {
          let out = g;
          for (let i = 0; i < steps && !out.over; i++) out = step(out, FIXED, input);
          return out;
        });
      }
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // The end: a moment to see it, then the results.
  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 900);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);

  // The floating joystick: where a finger (or the mouse) goes down, outside the HUD.
  const onDown = (e: ReactPointerEvent) => {
    if (still || stick.current) return;
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    if (p.y < 26 || p.y > 206) return;
    const client = { x: e.clientX, y: e.clientY };
    stick.current = { id: e.pointerId, start: client, now: client, startScene: p };
    setJoy({ base: p, knob: p });
  };
  const onMove = (e: ReactPointerEvent) => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    s.now = { x: e.clientX, y: e.clientY };
    const r = sceneRef.current?.getBoundingClientRect();
    const perPx = r && r.width ? 320 / r.width : 1;
    const v = joystickVector(s.start, s.now);
    setJoy({
      base: s.startScene,
      knob: {
        x: s.startScene.x + (v.knob.x - s.start.x) * perPx,
        y: s.startScene.y + (v.knob.y - s.start.y) * perPx,
      },
    });
  };
  const onUp = (e: ReactPointerEvent) => {
    if (stick.current?.id !== e.pointerId) return;
    stick.current = null;
    setJoy(null);
  };

  const box = game.box;
  const boxLeft = box.cx - box.w / 2;
  const boxTop = box.cy - box.h / 2;
  const left = Math.max(0, game.lengthSec - game.time);
  const next = nextInLine(game, game.active);
  const blinking = switches(game) && game.switchIn <= D.blinkSec && !game.over;
  const phase = Math.floor(game.time / 0.15) % 2 === 1;
  const color = byId(blinking && phase && next ? next : game.active)?.color ?? '#d3dfaf';
  const safe = game.safeFor > 0;
  const recentHit = game.lastHit && game.time - game.lastHit.at < 0.7 ? game.lastHit : null;
  const pivot = swordPivot(box);
  const beeFrame = Math.floor(game.time / D.bees.frameSec) % 2 === 0 ? 'bee-1.png' : 'bee-2.png';

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.play}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* The top HUD. */}
        <div className={`${ui.box} ${styles.name}`}>{NAMES[animal]}</div>
        <div className={`${ui.box} ${styles.survive}`}>
          <span>SURVIVE</span>
          <span className={styles.bar}>
            <span style={{ width: `${(left / game.lengthSec) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${styles.tier}`}>TIER {ROMAN[game.tier]}</div>

        {/* The animal. */}
        {animal === 'bees' ? (
          <>
            <img
              className={`${ui.sprite} ${styles.animal}`}
              src={art(beeFrame)}
              alt="A bee"
              draggable={false}
              style={{ left: 160 - 15, top: 36, width: 30, height: 21 }}
            />
            <span className={`${ui.muted} ${styles.bzz}`}>BZZ</span>
          </>
        ) : (
          <img
            className={`${ui.sprite} ${styles.animal}`}
            src={art('bear-head.png')}
            alt="A bear with a sword"
            draggable={false}
            style={{ left: 160 - 20, top: 28, width: 39, height: 34 }}
          />
        )}

        {/* The box: the bees fly in it, clipped to it. */}
        <div
          className={styles.box}
          style={{ left: boxLeft, top: boxTop, width: box.w, height: box.h }}
        >
          {game.attacks.map((a) => {
            if (a.kind === 'swing') {
              const warning = game.time >= a.warnAt && game.time < a.activeAt;
              return warning ? (
                <span
                  key={a.id}
                  className={styles.hatch}
                  style={{ left: a.side === 'left' ? 0 : box.w / 2, width: box.w / 2 }}
                >
                  <span className={styles.bang}>!</span>
                </span>
              ) : null;
            }
            if (game.time < a.activeAt || a.done) return null;
            const at = beeAt(a, game.time);
            const vx = a.vx;
            return (
              <img
                key={a.id}
                className={`${ui.sprite} ${styles.bee}`}
                src={art(beeFrame)}
                alt=""
                draggable={false}
                style={{
                  left: at.x - boxLeft - 5,
                  top: at.y - boxTop - 3.5,
                  transform: vx < 0 ? 'scaleX(-1)' : undefined,
                }}
              />
            );
          })}
          {/* The party's sprite, in the active hiker's color. */}
          <img
            className={`${ui.sprite} ${styles.person}`}
            data-safe={safe || undefined}
            src={tints[color] ?? art('person.png')}
            alt=""
            draggable={false}
            style={{ left: game.pos.x - boxLeft - 5, top: game.pos.y - boxTop - 6 }}
          />
          {recentHit && (
            <span
              className={styles.hitRing}
              data-soft={reduced || undefined}
              style={{ left: game.pos.x - boxLeft - 9, top: game.pos.y - boxTop - 9 }}
            />
          )}
        </div>
        {recentHit && (
          <span
            className={styles.hitText}
            style={{ left: game.pos.x + 10, top: game.pos.y - 10 }}
            role="status"
          >
            {byId(recentHit.hikerId).name.toUpperCase()} −1
          </span>
        )}

        {/* The bees' warnings, outside the box. */}
        {game.attacks.map((a) =>
          a.kind === 'bee' && game.time >= a.warnAt && game.time < a.activeAt ? (
            <span
              key={`w${a.id}`}
              className={styles.mark}
              style={{ left: a.mark.x - 3.5, top: a.mark.y - 3.5 }}
            >
              !
            </span>
          ) : null,
        )}

        {/* The sword, turning around its pivot above the box. */}
        {animal === 'bear' &&
          game.attacks.map((a) => {
            if (a.kind !== 'swing') return null;
            const angle = swingAngle(a, game.time);
            const shown = angle ?? (game.time >= a.warnAt && game.time < a.activeAt ? 0 : null);
            if (shown === null) return null;
            const deg = ((a.side === 'right' ? -shown : shown) * 180) / Math.PI;
            return (
              <span key={`s${a.id}`}>
                {/* A light trail: a few fading blades just behind it. */}
                {angle !== null &&
                  [0.12, 0.24, 0.36].map((back, k) => {
                    const a2 = Math.max(0, shown - back);
                    const d2 = ((a.side === 'right' ? -a2 : a2) * 180) / Math.PI;
                    return (
                      <img
                        key={back}
                        className={`${ui.sprite} ${styles.sword} ${styles.ghost}`}
                        src={art('sword.png')}
                        alt=""
                        draggable={false}
                        style={{
                          left: pivot.x - 6,
                          top: pivot.y - 12,
                          transform: `rotate(${d2}deg)`,
                          opacity: 0.35 - k * 0.1,
                        }}
                      />
                    );
                  })}
                <img
                  className={`${ui.sprite} ${styles.sword}`}
                  src={art('sword.png')}
                  alt=""
                  draggable={false}
                  style={{
                    left: pivot.x - 6,
                    top: pivot.y - 12,
                    transform: `rotate(${deg}deg)`,
                  }}
                />
              </span>
            );
          })}

        {/* The line of hikers. */}
        {switches(game) && !game.over && (
          <span className={`${ui.text} ${styles.next}`}>
            NEXT SWITCH IN {Math.ceil(game.switchIn)}S
          </span>
        )}
        <div className={`${ui.box} ${styles.line}`}>
          {hikers.map((h) => {
            const lives = game.lives[h.id] ?? 0;
            return (
              <span
                key={h.id}
                className={styles.slot}
                data-active={(h.id === game.active && !game.over) || undefined}
                data-out={lives === 0 || undefined}
              >
                <img
                  className={ui.sprite}
                  src={tints[h.color] ?? art('person.png')}
                  alt=""
                  draggable={false}
                />
                <span className={styles.slotName}>{h.name.toUpperCase()}</span>
                <span className={styles.hearts}>
                  {Array.from({ length: game.maxLives }, (_, i) => (
                    <span key={i} data-lit={i < lives || undefined}>
                      ♥
                    </span>
                  ))}
                </span>
                {lives === 0 && <span className={styles.slash} />}
              </span>
            );
          })}
        </div>

        {joy && (
          <span className={styles.joystick} style={{ left: joy.base.x - 14, top: joy.base.y - 14 }}>
            <span
              className={styles.knob}
              style={{
                left: joy.knob.x - joy.base.x + 14 - 5,
                top: joy.knob.y - joy.base.y + 14 - 5,
              }}
            />
          </span>
        )}
      </div>
    </PixelScreen>
  );
}
