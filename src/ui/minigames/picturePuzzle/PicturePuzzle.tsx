/**
 * Picture Puzzle on the GPS (docs/design/13-minigames-puzzles-2.md, section
 * 3; mockups 6-picture-puzzle.png and 10-picture-photos.png), in scene
 * units (320 × 240). Pictures are Wyatt's photos, 120 × 120, cut into 4 × 4
 * (30-unit), 5 × 5 (24-unit) or 6 × 6 (20-unit) pieces.
 *
 * - Drag the top piece of a pile onto any cell, or tap it and then tap a
 *   cell. Pieces in a grid can be dragged to another cell (they swap) or
 *   back onto any pile.
 * - Two hikers: two pictures side by side, one shared tray. With more,
 *   the next pair plays after.
 * - Tier I: a piece in its own spot clicks and locks, and a thumbnail of
 *   the finished picture shows. A finished picture glows and locks.
 * - The first time a piece lands in its own spot, the clock gains time and
 *   "+2 S" shows over it.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  isPictureName,
  move,
  newPicturePuzzle,
  nextRound,
  pieceAt,
  playing,
  result,
  tick,
  type PicturePuzzleState,
  type Spot,
} from '../../../minigames/picturePuzzle/logic';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { mgSfx } from '../sound';
import ui from '../gpsUi.module.css';
import styles from './PicturePuzzle.module.css';
import { prepNumber } from '../../../minigames/prepare';

const PP = BALANCE.minigames.picturePuzzle;
const PICTURE = 120;
const pictureArt = (name: string) => asset(`minigames/picture-puzzle/picture-${name}.png`);
const FIXED = 1 / 60;

/** Where things are on the screen for a round: each grid's top-left, and each pile. */
function layout(s: PicturePuzzleState) {
  const two = s.grids.length === 2;
  const grids = two
    ? [
        { x: 34, y: 28 },
        { x: 166, y: 28 },
      ]
    : [{ x: 100, y: 28 }];
  const piece = PICTURE / s.grid;
  const trayTop = 164;
  const slot = 312 / s.piles.length;
  const piles = s.piles.map((_, k) => ({
    x: 4 + slot * k + (slot - piece - 10) / 2,
    y: trayTop + 18 + (30 - piece) / 2,
  }));
  return { grids, piles, piece, trayTop };
}

export function PicturePuzzle({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const gridPick = pickOf(settings, 'grid');
  const thumbPick = pickOf(settings, 'thumbnail');
  const picturePick = pickOf(settings, 'picture');
  const [game, setGame] = useState(() =>
    newPicturePuzzle(
      {
        tier,
        grid: gridPick === '4' ? 4 : gridPick === '5' ? 5 : gridPick === '6' ? 6 : 'auto',
        secPerPiece: typeof settings.secPerPiece === 'number' ? settings.secPerPiece : 'auto',
        rightSpotSec: typeof settings.rightSpot === 'number' ? settings.rightSpot : 'auto',
        picture: isPictureName(picturePick) ? picturePick : 'random',
        extraSec: prepNumber(settings, 'prep.extraSec'),
        corners: prepNumber(settings, 'prep.corners') > 0,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  /** A piece picked up: from where, and (while dragging) where the pointer is. */
  const [held, setHeld] = useState<{
    from: Spot;
    pointer: number;
    at: { x: number; y: number };
    start: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<Spot | null>(null);
  const reported = useRef(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const L = layout(game);
  const who = playing(game);
  const thumbnails = thumbPick === 'on' || (thumbPick !== 'off' && tier <= PP.thumbnailUpTo);

  // The round's clock: fixed steps, as fast as the screen draws.
  const running = !still && game.phase === 'play';
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function loop(now) {
      spare = Math.min(0.25, spare + (now - last) / 1000);
      last = now;
      const steps = Math.floor(spare / FIXED);
      spare -= steps * FIXED;
      if (steps > 0) setGame((s) => tick(s, steps * FIXED));
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);
  const left = game.timeLeft;
  const note =
    game.bonusNote && game.elapsed - game.bonusNote.at < PP.bonusNoteSec ? game.bonusNote : null;

  // A round ended: a moment to see it, then the next pair (or the results).
  useEffect(() => {
    if (still || game.phase !== 'between') return;
    const id = window.setTimeout(() => {
      setSelected(null);
      setGame((s) => nextRound(s));
    }, 1800);
    return () => window.clearTimeout(id);
  }, [game.phase, game.round, still]);
  const passed = who.filter((id) => game.results[id] === 'passed').map((id) => byId(id).name);
  const message =
    game.phase !== 'between'
      ? null
      : passed.length === who.length
        ? `${passed.join(' and ')}: done!`
        : passed.length
          ? `${passed.join(' and ')} finished. Time’s up for the rest.`
          : 'Time’s up';

  useEffect(() => {
    if (game.phase !== 'over' || still || reported.current) return;
    reported.current = true;
    onDone(result(game));
  }, [game, still, onDone]);

  /** The spot under a scene point: a grid cell or a pile. */
  const spotAt = (p: { x: number; y: number }): Spot | null => {
    for (let picture = 0; picture < L.grids.length; picture++) {
      const g = L.grids[picture]!;
      const c = Math.floor((p.x - g.x) / L.piece);
      const r = Math.floor((p.y - g.y) / L.piece);
      if (c >= 0 && c < game.grid && r >= 0 && r < game.grid)
        return { kind: 'cell', picture, cell: r * game.grid + c };
    }
    for (let pile = 0; pile < L.piles.length; pile++) {
      const at = L.piles[pile]!;
      if (
        p.x >= at.x - 4 &&
        p.x <= at.x + L.piece + 10 &&
        p.y >= at.y - 4 &&
        p.y <= at.y + L.piece + 8
      )
        return { kind: 'pile', pile };
    }
    return null;
  };

  const doMove = (from: Spot, to: Spot) => {
    const next = move(game, from, to);
    if (next === game) return;
    const id = pieceAt(game, from);
    if (id !== null && next.locked[id] && !game.locked[id]) mgSfx('puzzle.snap');
    setGame(next);
  };

  const onDown = (e: ReactPointerEvent, from: Spot) => {
    if (!running || pieceAt(game, from) === null) return;
    const id = pieceAt(game, from)!;
    if (game.locked[id]) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const at = toScene(sceneRef.current, e.clientX, e.clientY);
    setHeld({ from, pointer: e.pointerId, at, start: at, moved: false });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!held || held.pointer !== e.pointerId) return;
    const at = toScene(sceneRef.current, e.clientX, e.clientY);
    const moved = held.moved || Math.hypot(at.x - held.start.x, at.y - held.start.y) > 3;
    setHeld({ ...held, at, moved });
  };
  const onUp = (e: ReactPointerEvent) => {
    if (held && held.pointer === e.pointerId) {
      const to = spotAt(toScene(sceneRef.current, e.clientX, e.clientY));
      if (held.moved) {
        if (to) doMove(held.from, to);
        setSelected(null);
      } else {
        // A tap: pick it up (or put it down where something else is selected).
        const same = selected && JSON.stringify(selected) === JSON.stringify(held.from);
        if (selected && !same) doMove(selected, held.from);
        setSelected(same || selected ? null : held.from);
      }
      setHeld(null);
      return;
    }
    // A tap on an empty cell or pile with a piece selected: put it there.
    if (selected && running) {
      const to = spotAt(toScene(sceneRef.current, e.clientX, e.clientY));
      if (to) doMove(selected, to);
      setSelected(null);
    }
  };

  const pieceStyle = (id: number, size: number) => {
    const p = game.pieces[id]!;
    const name = game.pictureOf[who[p.picture]!]!;
    const scale = size / L.piece;
    return {
      width: size,
      height: size,
      backgroundImage: `url(${pictureArt(name)})`,
      backgroundSize: `${PICTURE * scale}px ${PICTURE * scale}px`,
      backgroundPosition: `${-(p.cell % game.grid) * size}px ${-Math.floor(p.cell / game.grid) * size}px`,
    };
  };
  const isSel = (s: Spot) => selected !== null && JSON.stringify(selected) === JSON.stringify(s);
  const heldId = held?.moved ? pieceAt(game, held.from) : null;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={styles.play}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setHeld(null)}
      >
        <div className={`${ui.box} ${styles.clock}`} data-low={left <= 10 || undefined}>
          {clock(left)}
        </div>

        {/* Each hiker's picture. */}
        {game.grids.map((g, picture) => {
          const at = L.grids[picture]!;
          const hiker = byId(who[picture]!);
          return (
            <div key={picture}>
              <span className={styles.label} style={{ left: at.x, top: at.y - 11 }}>
                <HikerToken
                  hiker={hiker}
                  size={8}
                  state={game.done[picture] ? 'safe' : 'waiting'}
                />
                <span className={ui.text}>{hiker.name}’s picture</span>
                {thumbnails && (
                  <span
                    className={styles.thumb}
                    style={{ backgroundImage: `url(${pictureArt(game.pictureOf[hiker.id]!)})` }}
                    aria-label="The finished picture"
                  />
                )}
              </span>
              <div
                className={styles.grid}
                data-done={game.done[picture] || undefined}
                style={{ left: at.x, top: at.y, width: PICTURE, height: PICTURE }}
              >
                {g.map((id, cell) => {
                  const spot: Spot = { kind: 'cell', picture, cell };
                  const x = (cell % game.grid) * L.piece;
                  const y = Math.floor(cell / game.grid) * L.piece;
                  return (
                    <span
                      key={cell}
                      className={styles.cell}
                      data-selected={isSel(spot) || undefined}
                      style={{ left: x, top: y, width: L.piece, height: L.piece }}
                    >
                      {id !== null && id !== heldId && (
                        <span
                          className={styles.piece}
                          data-locked={game.locked[id] || undefined}
                          style={pieceStyle(id, L.piece)}
                          onPointerDown={(e) => onDown(e, spot)}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* The right-spot bonus, over its piece. */}
        {note && L.grids[note.picture] && (
          <span
            key={note.at}
            className={styles.bonus}
            role="status"
            style={{
              left: L.grids[note.picture]!.x + ((note.cell % game.grid) + 0.5) * L.piece,
              top: L.grids[note.picture]!.y + Math.floor(note.cell / game.grid) * L.piece,
            }}
          >
            +{note.sec} S
          </span>
        )}

        {/* The tray: piles where only the top piece shows. */}
        <div className={styles.tray} style={{ top: L.trayTop }}>
          <span className={`${ui.text} ${styles.trayWords}`}>
            {game.rightSpotSec > 0
              ? 'A piece in its right spot (the first time) adds time.'
              : game.grids.length === 2
                ? 'One tray for both pictures. Taking a piece shows the one under it.'
                : 'Taking a piece shows the one under it.'}
          </span>
        </div>
        {game.piles.map((pile, k) => {
          const at = L.piles[k]!;
          const spot: Spot = { kind: 'pile', pile: k };
          const top = pile.at(-1);
          const under = Math.min(3, Math.max(0, pile.length - 1));
          return (
            <span key={k} className={styles.pile} style={{ left: at.x, top: at.y }}>
              {Array.from({ length: under }, (_, d) => (
                <span
                  key={d}
                  className={styles.under}
                  style={{
                    left: (under - d) * 1.5,
                    top: (under - d) * 1.5,
                    width: L.piece,
                    height: L.piece,
                  }}
                />
              ))}
              {top !== undefined && top !== heldId ? (
                <span
                  className={styles.piece}
                  data-selected={isSel(spot) || undefined}
                  style={pieceStyle(top, L.piece)}
                  onPointerDown={(e) => onDown(e, spot)}
                />
              ) : (
                <span className={styles.empty} style={{ width: L.piece, height: L.piece }} />
              )}
              {pile.length > 0 && (
                <span className={`${ui.text} ${styles.count}`} style={{ left: L.piece + 7 }}>
                  x{pile.length}
                </span>
              )}
            </span>
          );
        })}

        {/* The piece being dragged. */}
        {held?.moved && heldId !== null && (
          <span
            className={`${styles.piece} ${styles.dragging}`}
            style={{
              ...pieceStyle(heldId, L.piece),
              left: held.at.x - L.piece / 2,
              top: held.at.y - L.piece / 2,
            }}
          />
        )}

        {message && (
          <div className={`${ui.box} ${styles.message}`} role="status">
            {message}
          </div>
        )}
      </div>
    </PixelScreen>
  );
}
