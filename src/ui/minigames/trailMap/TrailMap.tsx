/**
 * Trail Map on the GPS (docs/design/13-minigames-puzzles-2.md, section 1;
 * mockups 1-trail-map.png, 2-trail-map-hikers.png and 8-trail-map-signs.png),
 * in scene units (320 × 240). Tiles are the 16-px trail pieces at 2×
 * (smaller on a 7 × 7), and trail signs stand on some tiles from Tier II.
 *
 * - Tap or click a tile to turn it clockwise; right-click or Shift + click
 *   turns it back. The arrow keys move a cursor, and Space turns its tile.
 * - Tiles connected to a trailhead light up; a trail that reaches the exit
 *   gets footprints.
 * - A sign's post lights up when its tile is lit. Once every trailhead and
 *   every sign are connected at the same moment, everyone walks out
 *   together. The side panel counts the signs and hikers connected now.
 */
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  gateCell,
  lighting,
  newTrailMap,
  result,
  signsReached,
  timeUp,
  trailOrder,
  turn,
  type Gate,
} from '../../../minigames/trailMap/logic';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { useCountdown } from '../useCountdown';
import ui from '../gpsUi.module.css';
import panel from '../panel.module.css';
import styles from './TrailMap.module.css';
import { prepNumber } from '../../../minigames/prepare';
import { useDemoMode } from '../demo';

const T = BALANCE.minigames.trailMap;
const art = (f: string) => asset(`minigames/trail-map/${f}`);

const numberOr = <A extends string>(v: unknown, auto: A): A | number =>
  typeof v === 'number' ? v : auto;

export function TrailMap({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const demo = useDemoMode();
  const tier = tierOf(settings);
  // Prepare's +10 S on top of the tier's time (or the setting's).
  const extra = prepNumber(settings, 'prep.extraSec');
  const picked = settings.time === 'off' ? 'off' : numberOr(settings.time, 'auto');
  const time =
    picked === 'off' || extra === 0
      ? picked
      : (picked === 'auto' ? T.tiers[tier].timeSec : picked) + extra;
  const [game, setGame] = useState(() =>
    newTrailMap(
      {
        tier,
        size: numberOr(settings.grid, 'auto'),
        time,
        signs: numberOr(settings.signs, 'auto'),
        placed: prepNumber(settings, 'prep.place'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  /** Each tile's turn as drawn, counted on (so a turn always spins the short way). */
  const [spins, setSpins] = useState(() => game.tiles.map((t) => t.turn));
  const [cursor, setCursor] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Hikers walking their trail out: the tiles, and how far along they are. */
  const [walks, setWalks] = useState<Record<string, { route: number[]; step: number }>>({});
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;

  const n = game.size;
  const tile = Math.min(32, Math.floor(200 / n));
  const left = 96 + Math.floor((214 - n * tile) / 2);
  const top = Math.floor((240 - n * tile) / 2) + 2;
  const { lit, connected } = lighting(game);
  const reached = new Set(signsReached(game));
  const running = !game.over && !still;

  const left$ = useCountdown(game.timeSec, running, () => {
    setGame((s) => timeUp(s));
    setMessage('Time’s up');
  });

  // The end: a moment to see it, then the results.
  useEffect(() => {
    if (!game.over || still || reported.current) return;
    const id = window.setTimeout(
      () => {
        reported.current = true;
        onDone(result(game));
      },
      1400 + n * T.walkSecPerTile * 1000,
    );
    return () => window.clearTimeout(id);
  }, [game, still, onDone, n]);

  // Hikers walking out, a tile at a time.
  const walking = Object.values(walks).some((w) => w.step < w.route.length);
  useEffect(() => {
    if (!walking) return;
    const id = window.setInterval(
      () =>
        setWalks((ws) =>
          Object.fromEntries(
            Object.entries(ws).map(([k, w]) => [
              k,
              { ...w, step: Math.min(w.route.length, w.step + 1) },
            ]),
          ),
        ),
      T.walkSecPerTile * 1000,
    );
    return () => window.clearInterval(id);
  }, [walking]);

  const turnTile = (cell: number, dir: 1 | -1) => {
    if (!running || game.tiles[cell]?.locked) return;
    const next = turn(game, cell, dir);
    setSpins((sp) => sp.map((v, i) => (i === cell ? v + dir : v)));
    const newly = next.order.filter((id) => next.through[id] && !game.through[id]);
    if (newly.length) {
      setWalks((ws) => ({
        ...ws,
        ...Object.fromEntries(newly.map((id) => [id, { route: trailOrder(next, id), step: 0 }])),
      }));
      setMessage(newly.length > 1 ? 'Everyone’s through!' : `${byId(newly[0]!).name} made it!`);
    }
    setGame(next);
  };

  const onTile = (e: ReactMouseEvent, cell: number) => {
    e.preventDefault();
    setCursor(null);
    turnTile(cell, e.shiftKey ? -1 : 1);
  };

  // The arrow keys move a cursor; Space (or Enter) turns its tile, Shift turns it back.
  useEffect(() => {
    if (demo) return;
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
        e.key
      ];
      if (d) {
        e.preventDefault();
        setCursor((c) => {
          if (c === null) return Math.floor(n / 2) * n + Math.floor(n / 2);
          const col = Math.max(0, Math.min(n - 1, (c % n) + d[0]!));
          const row = Math.max(0, Math.min(n - 1, Math.floor(c / n) + d[1]!));
          return row * n + col;
        });
      } else if ((e.key === ' ' || e.key === 'Enter') && cursor !== null) {
        e.preventDefault();
        turnTile(cursor, e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Footprints along every trail that reaches the exit.
  const prints = new Set(
    game.order.filter((id) => connected.has(id)).flatMap((id) => trailOrder(game, id)),
  );

  /** Where a gate's marker sits: just outside the board, by its tile. */
  const gateSpot = (g: Gate, out = 10) => {
    const c = gateCell(g, n);
    const x = left + (c.c + 0.5) * tile;
    const y = top + (c.r + 0.5) * tile;
    const half = (n * tile) / 2;
    return {
      x: g.side === 'left' ? left - out : g.side === 'right' ? left + 2 * half + out : x,
      y: g.side === 'top' ? top - out : g.side === 'bottom' ? top + 2 * half + out : y,
    };
  };
  const exitSpot = gateSpot(game.exit, 5);
  const exitAngle = { top: 0, right: 90, bottom: 180, left: 270 }[game.exit.side];
  const exitLit = game.order.some((id) => connected.has(id));
  const center = (cell: number) => ({
    x: left + ((cell % n) + 0.5) * tile,
    y: top + (Math.floor(cell / n) + 0.5) * tile,
  });

  return (
    <PixelScreen measure={!still}>
      {/* The left panel. */}
      <div className={`${ui.box} ${panel.head}`}>TRAIL MAP</div>
      <p className={`${ui.text} ${panel.lines}`} style={{ top: 28 }}>
        Tap a tile to turn it. Connect {hikers.length > 1 ? 'every trailhead' : 'the trailhead'}
        {game.signs.length ? ' and every sign' : ''} to the exit
        {hikers.length > 1 || game.signs.length ? ', all at the same time.' : '.'}
      </p>
      {game.signs.length > 0 && (
        <p className={`${ui.text} ${panel.label}`} style={{ top: 82 }}>
          SIGNS {reached.size} / {game.signs.length}
        </p>
      )}
      <p className={`${ui.text} ${panel.label}`} style={{ top: game.signs.length ? 91 : 82 }}>
        HIKERS {game.order.filter((id) => connected.has(id)).length} / {game.order.length}
      </p>
      <div
        className={`${ui.box} ${panel.clock}`}
        style={{ top: 108 }}
        data-low={(left$ !== null && left$ <= 10) || undefined}
      >
        {left$ === null ? 'NO CLOCK' : clock(left$)}
      </div>
      {message && (
        <div className={`${ui.box} ${panel.message}`} style={{ top: 134 }} role="status">
          {message}
        </div>
      )}

      {/* The exit. */}
      <span
        className={styles.exitArrow}
        data-lit={exitLit || undefined}
        style={{ left: exitSpot.x - 5, top: exitSpot.y - 3, transform: `rotate(${exitAngle}deg)` }}
      />
      <span
        className={`${ui.text} ${styles.exitWord}`}
        style={{
          left: exitSpot.x + (game.exit.side === 'left' ? -22 : game.exit.side === 'right' ? 4 : 7),
          top: exitSpot.y + (game.exit.side === 'top' ? -4 : game.exit.side === 'bottom' ? 1 : -9),
        }}
      >
        EXIT
      </span>

      {/* The board. */}
      <div
        className={styles.board}
        style={{ left, top, width: n * tile, height: n * tile }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {game.tiles.map((t, cell) => (
          <button
            key={cell}
            type="button"
            className={styles.tile}
            data-locked={t.locked || undefined}
            data-cursor={cell === cursor || undefined}
            aria-label={`Tile ${cell + 1}${t.locked ? ', fixed' : ''}`}
            style={{
              left: (cell % n) * tile,
              top: Math.floor(cell / n) * tile,
              width: tile,
              height: tile,
            }}
            onClick={(e) => onTile(e, cell)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCursor(null);
              turnTile(cell, -1);
            }}
            disabled={still}
          >
            <img
              className={`${ui.sprite} ${styles.piece}`}
              src={art(`trail-${t.piece}${lit.has(cell) ? '-lit' : ''}.png`)}
              alt=""
              draggable={false}
              style={{
                transform: `rotate(${(spins[cell] ?? t.turn) * 90}deg)`,
                transitionDuration: `${T.turnSec}s`,
              }}
            />
            {game.signs.includes(cell) && (
              <img
                className={`${ui.sprite} ${styles.sign}`}
                src={art(reached.has(cell) ? 'trail-sign-lit.png' : 'trail-sign.png')}
                alt={reached.has(cell) ? 'A trail sign, reached' : 'A trail sign'}
                draggable={false}
              />
            )}
            {prints.has(cell) && (
              <span className={styles.print} aria-hidden="true">
                <span />
                <span />
              </span>
            )}
            {t.locked && <span className={styles.stake} aria-hidden="true" />}
          </button>
        ))}
      </div>

      {/* The trailheads, and hikers walking out. */}
      {game.order.map((id) => {
        const walk = walks[id];
        if (walk && walk.step < walk.route.length) {
          const at = center(walk.route[walk.step]!);
          return (
            <span key={id} className={styles.walker} style={{ left: at.x - 8, top: at.y - 8 }}>
              <HikerToken hiker={byId(id)} size={16} state="current" />
            </span>
          );
        }
        const spot = gateSpot(game.heads[id]!);
        return (
          <span key={id} className={styles.head} style={{ left: spot.x - 8, top: spot.y - 8 }}>
            <HikerToken
              hiker={byId(id)}
              size={16}
              state={game.through[id] ? 'safe' : game.over ? 'out' : 'waiting'}
            />
          </span>
        );
      })}
    </PixelScreen>
  );
}
