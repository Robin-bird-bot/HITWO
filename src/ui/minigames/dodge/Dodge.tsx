/**
 * Dodge on the GPS (docs/design/12-minigames-dodge.md; mockups
 * docs/mockups/minigames/dodge/1-bees.png to 9-stampede.png), in scene units
 * (320 × 240).
 *
 * - **Top:** the animal's name, a SURVIVE bar emptying as time runs down,
 *   and the tier.
 * - **The animal** above the box (in the Stampede, a row of heads with a
 *   frame on whoever is attacking); **the box** below it, where the party's
 *   sprite (tinted in the active hiker's color) dodges.
 * - **Attacks** are drawn in layers: warnings and shadows under the sprite,
 *   attacks over it, and "!" marks, arrows and squirrels outside the box.
 * - **Bottom:** each hiker with their hearts; the active one outlined, out
 *   ones greyed with a red slash; "NEXT SWITCH IN 2S".
 * - **Show hitboxes** (testing): every hit shape outlined.
 *
 * Controls: WASD or the arrow keys; a floating joystick where a finger (or
 * the mouse) goes down.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BALANCE } from '../../../config/balance';
import { ANIMALS, isAnimal } from '../../../minigames/dodge/animals';
import {
  effectiveBox,
  hitShapes,
  joystickVector,
  keysToVector,
  newDodge,
  nextInLine,
  result,
  step,
  switches,
  type AnimalId,
  type AttackId,
  type Point,
} from '../../../minigames/dodge/logic';
import type { MinigameSettings } from '../../../minigames/types';
import { useReducedMotion } from '../../app/useReducedMotion';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import ui from '../gpsUi.module.css';
import { Heads } from './Heads';
import { Hitboxes } from './Hitboxes';
import { PartsLayer } from './parts/drawParts';
import { art, type DrawCtx } from './parts/drawTypes';
import { useTinted } from './tint';
import styles from './Dodge.module.css';

const D = BALANCE.minigames.dodge;
const ROMAN = ['', 'I', 'II', 'III'];
const FIXED = 1 / 120;

const numberOr = (settings: MinigameSettings, id: string): 'auto' | number => {
  const v = settings[id];
  return typeof v === 'number' ? v : 'auto';
};

export function Dodge({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const reduced = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const chosen = pickOf(settings, 'animal');
  const animal: AnimalId = isAnimal(chosen) ? chosen : 'bees';
  const ideas = pickOf(settings, 'ideas') !== 'off';
  const showHitboxes = pickOf(settings, 'hitboxes') === 'on';
  const [game, setGame] = useState(() =>
    newDodge(
      {
        animal,
        tier: tierOf(settings),
        attack: (pickOf(settings, 'attack') || 'all') as AttackId | 'all',
        ideas,
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

  const box = effectiveBox(game);
  const boxLeft = box.cx - box.w / 2;
  const boxTop = box.cy - box.h / 2;
  const left = Math.max(0, game.lengthSec - game.time);
  const next = nextInLine(game, game.active);
  const blinking = switches(game) && game.switchIn <= D.blinkSec && !game.over;
  const phase = Math.floor(game.time / 0.15) % 2 === 1;
  const color = byId(blinking && phase && next ? next : game.active)?.color ?? '#d3dfaf';
  const safe = game.safeFor > 0;
  const recentHit = game.lastHit && game.time - game.lastHit.at < 0.7 ? game.lastHit : null;
  const beeFrame = Math.floor(game.time / D.bees.frameSec) % 2 === 0 ? 'bee-1.png' : 'bee-2.png';
  const ctx: DrawCtx = {
    time: game.time,
    box,
    left: boxLeft,
    right: boxLeft + box.w,
    top: boxTop,
    bottom: boxTop + box.h,
    beeFrame,
    reduced,
  };

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
        <div className={`${ui.box} ${styles.name}`}>{ANIMALS[animal].hud}</div>
        <div className={`${ui.box} ${styles.survive}`}>
          <span>SURVIVE</span>
          <span className={styles.bar}>
            <span style={{ width: `${(left / game.lengthSec) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${styles.tier}`}>TIER {ROMAN[game.tier]}</div>

        <Heads animal={animal} showing={game.showing} beeFrame={beeFrame} ideas={game.ideas} />

        {/* The box: everything inside it is clipped to it, drawn in scene units. */}
        <div
          className={styles.box}
          style={{ left: boxLeft, top: boxTop, width: box.w, height: box.h }}
        >
          <div className={styles.inside} style={{ left: -boxLeft, top: -boxTop }}>
            <svg className={styles.svg} viewBox="0 0 320 240" aria-hidden="true">
              <PartsLayer parts={game.parts} layer="svg" ctx={ctx} />
            </svg>
            <PartsLayer parts={game.parts} layer="under" ctx={ctx} />
            {/* The party's sprite, in the active hiker's color. */}
            <img
              className={`${ui.sprite} ${styles.person}`}
              data-safe={safe || undefined}
              src={tints[color] ?? art('person.png')}
              alt=""
              draggable={false}
              style={{ left: game.pos.x - 5, top: game.pos.y - 6 }}
            />
            {recentHit && (
              <span
                className={styles.hitRing}
                data-soft={reduced || undefined}
                style={{ left: game.pos.x - 9, top: game.pos.y - 9 }}
              />
            )}
            <PartsLayer parts={game.parts} layer="over" ctx={ctx} />
          </div>
        </div>
        <PartsLayer parts={game.parts} layer="outside" ctx={ctx} />
        {recentHit && (
          <span
            className={styles.hitText}
            style={{ left: game.pos.x + 10, top: game.pos.y - 10 }}
            role="status"
          >
            {byId(recentHit.hikerId).name.toUpperCase()} −1
          </span>
        )}
        {showHitboxes && <Hitboxes shapes={hitShapes(game)} sprite={game.pos} />}

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
