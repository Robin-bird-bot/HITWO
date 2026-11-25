/**
 * Remember the Path on the GPS (docs/design/11-minigames-puzzles.md, section 4;
 * docs/mockups/minigames/puzzles/6-remember-path-watch.png and 7-…-repeat.png),
 * in scene units (320 × 240). Tiles are 32 units (the 16-px forest tiles at 2×).
 *
 * **Watch:** the ranger appears on the start tile (outlined) and walks the
 * path, facing the way he goes and swapping frames as he steps; only his
 * last 2 tiles show footprints, the older one fainter. At the top he walks
 * off the edge.
 *
 * **Repeat:** the hiker's token starts on the start tile. Drag it along the
 * tiles, tap the next tile, or use the arrow keys. A right step lights the
 * tile with footprints; a wrong one flashes red with an X and costs a strike.
 * Each hiker, in line order, gets a new path and watches it first.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  BELOW,
  currentHiker,
  isNext,
  newRememberPath,
  nextHiker,
  result,
  sameTile,
  step,
  watched,
  type Tile,
} from '../../../minigames/rememberPath/logic';
import { HikerToken, type TokenState } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { toScene } from '../sceneCoords';
import { tierOf, type PuzzleRunProps } from '../puzzleProps';
import ui from '../gpsUi.module.css';
import styles from './RememberPath.module.css';

const R = BALANCE.minigames.rememberPath;
const TILE = 32;
const ROMAN = ['', 'I', 'II', 'III'];
const tileArt = (f: string) => asset(`minigames/forest-tiles/${f}`);
const ranger = (f: string) => asset(`minigames/remember-path/${f}`);

/** Which sprite the ranger shows, and whether it's mirrored, for a step and a frame. */
function rangerLook(
  from: Tile | undefined,
  to: Tile,
  frame: number,
): { file: string; mirror: boolean } {
  const dc = from ? to.c - from.c : 0;
  const dr = from ? to.r - from.r : -1;
  if (dc !== 0)
    return { file: frame % 2 ? 'ranger-side2.png' : 'ranger-side1.png', mirror: dc < 0 };
  return { file: dr > 0 ? 'ranger-down.png' : 'ranger-up.png', mirror: frame % 2 === 1 };
}

/**
 * The ranger's route in tile units (rows = the strip just below the grid):
 * from below the middle, along under the grid to the start tile's column,
 * up into it, along the path, and off the top edge.
 */
function rangerRoute(path: readonly Tile[], cols: number, rows: number): Tile[] {
  const start = path[0];
  if (!start) return [];
  const route: Tile[] = [{ c: (cols - 1) / 2, r: rows }];
  let c = route[0]!.c;
  while (c !== start.c) {
    c = start.c > c ? Math.floor(c) + 1 : Math.ceil(c) - 1;
    route.push({ c, r: rows });
  }
  route.push(...path, { c: path.at(-1)!.c, r: -1 });
  return route;
}

export function RememberPath({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState(() =>
    newRememberPath(
      tier,
      hikers.map((h) => h.id),
      seed,
    ),
  );
  /** The ranger's walk along his route (−1 before he appears; past the end, he's gone). */
  const [walk, setWalk] = useState(still ? 3 : -1);
  /** Below the grid: the column the hiker's token is under (the middle to start with). */
  const [belowCol, setBelowCol] = useState((game.cols - 1) / 2);
  const [wrong, setWrong] = useState<{ tile: Tile; n: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const who = currentHiker(game);
  const left = 312 - game.cols * TILE;
  const top = (240 - game.rows * TILE) / 2 + 4;
  const tileAt = (p: { x: number; y: number }): Tile | null => {
    const c = Math.floor((p.x - left) / TILE);
    const r = Math.floor((p.y - top) / TILE);
    return c >= 0 && c < game.cols && r >= 0 && r < game.rows ? { c, r } : null;
  };

  /**
   * The ranger's route: he appears below the grid's middle, walks along under
   * it to his column, steps up into the start tile, walks the path, and walks
   * off the top edge.
   */
  const route = rangerRoute(game.path, game.cols, game.rows);

  // Watch: the ranger walks his route one step at a time.
  const watching = game.phase === 'watch' && !still;
  const steps = route.length;
  useEffect(() => {
    if (!watching) return;
    const stepMs = R.tiers[tier].stepMs;
    let i = -1;
    const id = window.setInterval(() => {
      i += 1;
      setWalk(i);
      if (i > steps) {
        window.clearInterval(id);
        setGame((s) => watched(s));
      }
    }, stepMs);
    return () => window.clearInterval(id);
  }, [watching, game.path, steps, tier]);

  /** A hiker made it or is out: a moment to read it, then the next hiker (or the results). */
  const finishHiker = (text: string, after: typeof game) => {
    setMessage(text);
    window.setTimeout(() => {
      const next = nextHiker(after);
      setMessage(null);
      setWalk(-1);
      setBelowCol((next.cols - 1) / 2);
      setGame(next);
      if (next.phase === 'over') onDone(result(next));
    }, 900);
  };

  const tryStep = (tile: Tile) => {
    if (game.phase !== 'repeat' || message) return;
    const out = step(game, tile);
    if (out.outcome === 'ignored') return;
    setGame(out.state);
    const name = byId(who!).name.toUpperCase();
    if (out.outcome === 'wrong') {
      setWrong((w) => ({ tile, n: (w?.n ?? 0) + 1 }));
      window.setTimeout(
        () => setWrong((w) => (w && sameTile(w.tile, tile) ? null : w)),
        R.wrongFlashMs,
      );
    }
    if (out.passed) finishHiker(`${name} made it!`, out.state);
    if (out.failed) finishHiker(`${name} is out`, out.state);
  };

  // The arrow keys. Below the grid, ← → slide the token along under it and ↑ steps in.
  useEffect(() => {
    if (still) return;
    const onKey = (e: KeyboardEvent) => {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
        e.key
      ];
      if (!d || game.phase !== 'repeat') return;
      e.preventDefault();
      if (game.pos === BELOW) {
        if (d[0]) {
          const to = d[0] < 0 ? Math.ceil(belowCol) - 1 : Math.floor(belowCol) + 1;
          setBelowCol(Math.max(0, Math.min(game.cols - 1, to)));
        } else if (d[1]! < 0) tryStep({ c: Math.round(belowCol), r: game.rows - 1 });
        return;
      }
      const at = game.path[game.pos];
      if (at) tryStep({ c: at.c + d[0]!, r: at.r + d[1]! });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Dragging the token: each new tile it's pulled onto is a step.
  const onMove = (e: ReactPointerEvent) => {
    if (dragging !== e.pointerId) return;
    const tile = tileAt(toScene(sceneRef.current, e.clientX, e.clientY));
    if (tile && isNext(game, tile)) tryStep(tile);
  };
  const onTileUp = (tile: Tile) => {
    if (dragging === null) tryStep(tile);
  };

  const center = (t: Tile) => ({ x: left + t.c * TILE + TILE / 2, y: top + t.r * TILE + TILE / 2 });
  // The ranger: on his route, and gone once he has walked off the top.
  const rangerTile = walk >= 0 && walk < route.length ? route[walk] : route.at(-1);
  const look = rangerTile && rangerLook(route[walk - 1] ?? route[0], rangerTile, Math.max(0, walk));
  const prints =
    game.phase === 'watch' ? [walk - 1, walk - 2].filter((i) => i >= 0 && i < route.length) : [];
  const lit = game.phase === 'repeat' ? game.path.slice(0, game.pos + 1) : [];
  const at = game.path[game.pos];
  const done = (id: string): TokenState =>
    game.results[id] === 'passed'
      ? 'safe'
      : game.results[id] === 'failed'
        ? 'out'
        : id === who
          ? 'current'
          : 'waiting';

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      {/* The left panel. */}
      <div className={`${ui.box} ${styles.head}`}>
        {game.phase === 'repeat' ? 'YOUR TURN' : 'WATCH'}
      </div>
      {game.phase === 'repeat' ? (
        <>
          <p className={`${ui.text} ${styles.lines}`}>
            {game.pos === BELOW
              ? `${who ? byId(who).name : ''} starts below the grid. Step into the bottom-row tile where the ranger came in.`
              : 'Drag along the trail, or tap one tile at a time.'}
          </p>
          <p className={`${ui.text} ${styles.name}`}>{who ? byId(who).name : ''}</p>
          <span className={styles.strikes}>
            {Array.from({ length: R.tiers[tier].strikes }, (_, i) => (
              <span key={i} data-used={i >= game.strikesLeft || undefined} />
            ))}
          </span>
          <p className={`${ui.muted} ${styles.strikesWord}`}>Strikes left</p>
        </>
      ) : (
        <>
          <p className={`${ui.text} ${styles.lines}`}>
            The ranger comes in from below, walks the trail and walks off the top. Remember it.
          </p>
          <p className={`${ui.text} ${styles.tierLine}`}>
            Tier {ROMAN[tier]}
            <br />
            {game.cols} x {game.rows}, {game.path.length - 1} steps
          </p>
          {who && <div className={`${ui.box} ${styles.next}`}>NEXT: {byId(who).name}</div>}
        </>
      )}
      {message && (
        <div className={`${ui.box} ${styles.message}`} role="status">
          {message}
        </div>
      )}
      <div className={styles.line}>
        {game.order.map((id) => (
          <HikerToken key={id} hiker={byId(id)} size={15} state={done(id)} />
        ))}
      </div>

      {/* The grid. */}
      <p
        className={`${ui.muted} ${styles.topLabel}`}
        style={{ left, width: game.cols * TILE, top: top - 8 }}
      >
        Top row = the end
      </p>
      <div
        className={styles.grid}
        style={{ left, top, width: game.cols * TILE, height: game.rows * TILE }}
        onPointerMove={onMove}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        {Array.from({ length: game.rows }, (_, r) =>
          Array.from({ length: game.cols }, (_, c) => {
            const tile = { c, r };
            const isLit = lit.some((t) => sameTile(t, tile));
            return (
              <span
                key={`${c},${r}`}
                className={styles.tile}
                style={{ left: c * TILE, top: r * TILE }}
                onPointerUp={() => onTileUp(tile)}
              >
                <img
                  className={ui.sprite}
                  src={tileArt(isLit ? 'tile-lit.png' : 'tile-hidden.png')}
                  alt=""
                  draggable={false}
                />
                {isLit && !sameTile(tile, at ?? tile) && (
                  <img
                    className={`${ui.sprite} ${styles.print}`}
                    src={ranger('footprints.png')}
                    alt=""
                    draggable={false}
                  />
                )}
              </span>
            );
          }),
        )}
        {game.phase === 'repeat' &&
          game.pos === BELOW &&
          !message &&
          Array.from({ length: game.cols }, (_, c) => (
            <span
              key={`b${c}`}
              className={styles.startMark}
              style={{ left: c * TILE + 3, top: (game.rows - 1) * TILE + 3 }}
            />
          ))}
        {prints.map((i, k) => {
          const t = route[i]!;
          return (
            <img
              key={`p${i}`}
              className={`${ui.sprite} ${styles.print}`}
              src={ranger('footprints.png')}
              alt=""
              draggable={false}
              style={{ left: t.c * TILE + 8, top: t.r * TILE + 8, opacity: k === 0 ? 1 : 0.45 }}
            />
          );
        })}
        {wrong && (
          <span
            key={wrong.n}
            className={styles.wrong}
            style={{ left: wrong.tile.c * TILE, top: wrong.tile.r * TILE }}
            aria-hidden="true"
          >
            ✕
          </span>
        )}
      </div>

      {rangerTile && look && game.phase === 'watch' && walk >= 0 && (
        <img
          className={`${ui.sprite} ${styles.ranger}`}
          src={ranger(look.file)}
          alt="The ranger"
          draggable={false}
          style={
            {
              left: left + rangerTile.c * TILE,
              top: top + rangerTile.r * TILE,
              transform: look.mirror ? 'scaleX(-1)' : undefined,
              opacity: walk >= route.length - 1 ? 0 : 1,
              '--step-ms': `${R.tiers[tier].stepMs}ms`,
            } as CSSProperties
          }
        />
      )}
      {game.phase === 'repeat' && who && (at || game.pos === BELOW) && (
        <span
          className={styles.token}
          style={
            at
              ? { left: center(at).x - 10, top: center(at).y - 10 }
              : {
                  left: left + belowCol * TILE + TILE / 2 - 10,
                  top: top + game.rows * TILE + 6,
                }
          }
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
            setDragging(e.pointerId);
          }}
          onPointerUp={() => setDragging(null)}
        >
          <HikerToken hiker={byId(who)} size={20} state="current" />
        </span>
      )}
    </PixelScreen>
  );
}
