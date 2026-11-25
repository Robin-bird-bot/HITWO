/**
 * Find the Path on the GPS (docs/design/11-minigames-puzzles.md, section 5;
 * docs/mockups/minigames/puzzles/8-find-the-path.png and 9-…-fog.png), in
 * scene units (320 × 240). Tiles are 32 units (the 16-px forest tiles at 2×).
 *
 * The hiker at the front of the line walks out from the trailhead. The
 * tiles they can pick (up, left, right) get a light outline: tap one, drag
 * the token onto it, or use ← ↑ →. A right tile becomes trail and the trail
 * line draws on to it; a wrong one becomes thick trees and costs a try (and
 * may reveal another tile, with a "!"). Out of tries: back of the line, or
 * out once the group's attempts are gone. Without fog, each turn starts by
 * walking the known trail; in fog only the last 2 picks stay visible.
 */
import { useEffect, useRef, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  choices,
  currentHiker,
  isVisible,
  key,
  knownTrailEnd,
  newFindPath,
  pick,
  result,
  type Tile,
} from '../../../minigames/findPath/logic';
import { g } from '../../../minigames/greens';
import { useReducedMotion } from '../../app/useReducedMotion';
import { HikerToken, type TokenState } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { toScene } from '../sceneCoords';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import ui from '../gpsUi.module.css';
import styles from './FindPath.module.css';

const P = BALANCE.minigames.findPath;
const TILE = 32;
const ROMAN = ['', 'I', 'II', 'III'];
const tileArt = (f: string) => asset(`minigames/forest-tiles/${f}`);
const same = (a: Tile, b: Tile) => a.c === b.c && a.r === b.r;

export function FindPath({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const reduced = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const fogSetting = pickOf(settings, 'fog');
  const [game, setGame] = useState(() =>
    newFindPath(
      {
        tier: tierOf(settings),
        fog: fogSetting === 'on' || fogSetting === 'off' ? fogSetting : 'auto',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  /** Where the token is drawn: it walks the known trail at the start of a turn. */
  const [shown, setShown] = useState(game.pos);
  const [bang, setBang] = useState<Tile | null>(null);
  const [energy, setEnergy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const walker = useRef<number | undefined>(undefined);
  const reported = useRef(false);
  const [startAttempts] = useState(game.attempts);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const who = currentHiker(game);
  const left = 312 - game.cols * TILE;
  const top = (240 - game.rows * TILE) / 2 + 4;
  const busy = shown !== game.pos || game.over || still;

  // The end: a moment to see it, then the results.
  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(() => {
      reported.current = true;
      onDone(result(game));
    }, 900);
    return () => window.clearTimeout(id);
  }, [game, still, onDone]);
  useEffect(() => () => window.clearInterval(walker.current), []);

  /** The token walks along the trail to a spot, a tile at a time. */
  const walkTo = (from: number, to: number) => {
    window.clearInterval(walker.current);
    if (reduced || from === to) {
      setShown(to);
      return;
    }
    let i = from;
    setShown(i);
    walker.current = window.setInterval(() => {
      i += i < to ? 1 : -1;
      setShown(i);
      if (i === to) window.clearInterval(walker.current);
    }, 120);
  };

  const tryPick = (tile: Tile) => {
    if (busy) return;
    const out = pick(game, tile);
    if (out.outcome === 'ignored') return;
    const next = out.state;
    setGame(next);
    if (next.revealed && next.revealed.pick === next.picks) {
      const t = next.revealed.tile;
      setBang(t);
      window.setTimeout(() => setBang((b) => (b && same(b, t) ? null : b)), P.revealMarkMs);
    }
    if (next.energy && !game.energy) {
      setEnergy(true);
      window.setTimeout(() => setEnergy(false), 1600);
    }
    // A new turn: the next hiker starts at the trailhead and walks the known trail.
    if (currentHiker(next) !== who || next.over) walkTo(0, next.pos);
    else setShown(next.pos);
  };

  // ← ↑ → pick the tile that way.
  useEffect(() => {
    if (still) return;
    const onKey = (e: KeyboardEvent) => {
      const d = { ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      const at = game.trail[game.pos];
      if (!d || !at) return;
      e.preventDefault();
      tryPick({ c: at.c + d[0]!, r: at.r + d[1]! });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tileAt = (clientX: number, clientY: number): Tile | null => {
    const p = toScene(sceneRef.current, clientX, clientY);
    const c = Math.floor((p.x - left) / TILE);
    const r = Math.floor((p.y - top) / TILE);
    return c >= 0 && c < game.cols && r >= 0 && r < game.rows ? { c, r } : null;
  };

  const open = busy ? [] : choices(game);
  const center = (t: Tile) => ({ x: t.c * TILE + TILE / 2, y: t.r * TILE + TILE / 2 });
  const at = game.trail[Math.min(shown, game.trail.length - 1)]!;
  const visible = (t: Tile) => isVisible(game, t);
  // The trail line: along the known trail from the trailhead; in fog, only to tiles still visible.
  const end = knownTrailEnd(game);
  const segments = game.trail.slice(1, end + 1).flatMap((b, i) => {
    const a = game.trail[i]!;
    return !game.fog || visible(b) ? [{ a, b, i }] : [];
  });
  const tokenState = (id: string): TokenState =>
    game.results[id] === 'passed'
      ? 'safe'
      : game.results[id] === 'failed'
        ? 'out'
        : id === who
          ? 'current'
          : 'waiting';
  const finished = game.order.filter((id) => !game.line.includes(id));
  const note = hikers.reduce((n, h) => n.replaceAll(h.id, h.name), game.note).toUpperCase();

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      {/* The left panel. */}
      <div className={`${ui.box} ${styles.head}`}>FIND THE PATH</div>
      {who && <p className={`${ui.text} ${styles.name}`}>{byId(who).name}</p>}
      <p className={`${ui.muted} ${styles.label}`} style={{ top: 43 }}>
        Tries
      </p>
      <span className={styles.dots} style={{ top: 40 }}>
        {Array.from({ length: P.triesPerTurn }, (_, i) => (
          <span key={i} data-used={i >= game.tries || undefined} />
        ))}
      </span>
      <p className={`${ui.muted} ${styles.label}`} style={{ top: 58 }}>
        Group attempts
      </p>
      <span className={styles.squares} style={{ top: 64 }}>
        {Array.from({ length: startAttempts }, (_, i) => (
          <span key={i} data-used={i >= game.attempts || undefined} />
        ))}
      </span>
      <p className={`${ui.muted} ${styles.label}`} style={{ top: 92 }}>
        The line
      </p>
      <div className={styles.line}>
        {[...game.line, ...finished].map((id) => (
          <span
            key={id}
            className={styles.lineRow}
            data-done={!game.line.includes(id) || undefined}
          >
            <HikerToken hiker={byId(id)} size={15} state={tokenState(id)} />
            <span className={ui.text} style={{ fontSize: 3.8 }}>
              {byId(id).name}
              {id === who ? ' ‹' : ''}
            </span>
          </span>
        ))}
      </div>
      {note && <p className={`${ui.text} ${styles.note}`}>{note}</p>}
      {game.fog && <div className={`${ui.box} ${styles.fogBox}`}>FOG: TIER {ROMAN[game.tier]}</div>}
      {energy && (
        <div className={`${ui.box} ${styles.energy}`} role="status">
          +{P.energy} ENERGY: {game.energy ? byId(game.energy).name : ''}
        </div>
      )}

      {/* The forest. */}
      <p
        className={`${ui.text} ${styles.rule}`}
        style={{ left, width: game.cols * TILE, top: top - 7 }}
      >
        The trail goes up, left or right. Never down.
      </p>
      <div
        className={styles.grid}
        style={{ left, top, width: game.cols * TILE, height: game.rows * TILE }}
        onPointerUp={(e) => {
          const tile = tileAt(e.clientX, e.clientY);
          setDragging(false);
          if (tile) tryPick(tile);
        }}
      >
        {Array.from({ length: game.rows }, (_, r) =>
          Array.from({ length: game.cols }, (_, c) => {
            const t = { c, r };
            const k = key(t);
            const shownAs = same(t, game.trail[0]!)
              ? 'tile-start.png'
              : game.known[k] && visible(t)
                ? game.known[k] === 'trail'
                  ? 'tile-trail.png'
                  : 'tile-trees.png'
                : 'tile-hidden.png';
            return (
              <img
                key={k}
                className={`${ui.sprite} ${styles.tile}`}
                src={tileArt(shownAs)}
                alt=""
                draggable={false}
                style={{ left: c * TILE, top: r * TILE }}
              />
            );
          }),
        )}
        <svg
          className={styles.lineSvg}
          viewBox={`0 0 ${game.cols * TILE} ${game.rows * TILE}`}
          aria-hidden="true"
        >
          {segments.map(({ a, b, i }) => (
            <line
              key={`${i}`}
              x1={center(a).x}
              y1={center(a).y}
              x2={center(b).x}
              y2={center(b).y}
              pathLength={1}
              className={styles.segment}
              style={{ stroke: g(3), animationDuration: `${P.lineDrawMs}ms` }}
            />
          ))}
        </svg>
        {game.fog && (
          <span
            className={styles.mist}
            style={{
              background: `radial-gradient(circle at ${center(at).x}px ${center(at).y}px, rgba(186, 201, 149, 0) 18px, rgba(186, 201, 149, 0.5) 80px)`,
            }}
            aria-hidden="true"
          />
        )}
        {open.map((t) => (
          <span
            key={key(t)}
            className={styles.choice}
            data-choice=""
            style={{ left: t.c * TILE + 2, top: t.r * TILE + 2 }}
          />
        ))}
        {bang && (
          <span
            className={styles.bang}
            style={{ left: bang.c * TILE + 24, top: bang.r * TILE + 2 }}
          >
            !
          </span>
        )}
        {who && (
          <span
            className={styles.token}
            data-dragging={dragging || undefined}
            style={{ left: center(at).x - 10, top: center(at).y - 10 }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
              setDragging(true);
            }}
          >
            <HikerToken hiker={byId(who)} size={20} state="current" />
          </span>
        )}
      </div>
    </PixelScreen>
  );
}
