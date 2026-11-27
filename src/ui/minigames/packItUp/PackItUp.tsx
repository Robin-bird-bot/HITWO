/**
 * Pack It Up on the GPS (docs/design/23-minigames-final.md, section 8;
 * mockup 47-pack-it-up.png), in scene units (320 × 240): the torn pack on
 * the left (torn cells dark, with a crack), the gear still to pack in a
 * tray on the right. Each piece is drawn as its cells with its gear
 * picture.
 *
 * Drag a piece into the pack (it snaps to the grid); drag it back out to
 * take it back. Turn it with R, a right-click, or the TURN button (it
 * turns the piece picked last).
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { packItUpBot, type PackAction } from '../../../minigames/packItUp/bot';
import {
  fits,
  newPackItUp,
  packer,
  place,
  result,
  takeOut,
  tick,
  turn,
  turned,
  type Piece,
} from '../../../minigames/packItUp/logic';
import { prepNumber } from '../../../minigames/prepare';
import { turnWord } from '../../../minigames/quick/turns';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './PackItUp.module.css';

const art = (f: string) => asset(`minigames/pack-it-up/${f}.png`);
/** The tray on the right, and a tray cell's size. */
const TRAY = { x: 172, y: 30, w: 140, h: 158 };
/** A tray cell's size: bigger when there are fewer pieces left (three to a row). */
const trayCell = (n: number) => (n <= 6 ? 10 : n <= 9 ? 8 : 7);

export function PackItUp({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const sizePick = pickOf(settings, 'pack');
  const size = /^\d+x\d+$/.test(sizePick)
    ? (sizePick.split('x').map(Number) as [number, number])
    : 'auto';
  const [game, setGame] = useState(() =>
    newPackItUp(
      {
        tier,
        size,
        spare: typeof settings.spare === 'number' ? settings.spare : 'auto',
        // Prepare (23-minigames-final.md, section 10).
        extraSec: prepNumber(settings, 'prep.extraSec'),
        extraSpare: prepNumber(settings, 'prep.backpack'),
        mended: prepNumber(settings, 'prep.mend'),
        sack: prepNumber(settings, 'prep.sack') > 0,
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
  const [drag, setDrag] = useState<{
    id: number;
    dx: number;
    dy: number;
    x: number;
    y: number;
  } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const who = packer(game);

  // The pack: cells as big as fit on the left.
  const cell = Math.min(18, Math.floor(118 / game.cols), Math.floor(130 / game.rows));
  const gridW = game.cols * cell;
  const gridH = game.rows * cell;
  const gridX = 18 + Math.floor((140 - gridW) / 2);
  const gridY = 30 + Math.floor((150 - gridH) / 2);

  const act = (a: PackAction) => {
    if (a.kind === 'turn') setGame((s) => turn(s, a.id));
    else
      setGame((s) => {
        const out = place(s, a.id, a.at);
        if (out !== s) playSound('place');
        return out;
      });
  };
  useDemoBot(demo && running, game, packItUpBot, act);
  const turnPiece = (id: number | null) => id !== null && running && setGame((s) => turn(s, id));
  useKeys(running, (key) => {
    if (key !== 'r') return false;
    turnPiece(drag?.id ?? picked);
    return true;
  });

  // The tray's slots: the pieces still out, two to a row.
  const out = game.pieces.filter((p) => p.at === null && p.id !== game.sacked);
  const slotOf = (k: number) => ({
    x: TRAY.x + 8 + (k % 3) * (trayCell(out.length) * 4 + 6),
    y: TRAY.y + 14 + Math.floor(k / 3) * (trayCell(out.length) * 4 + 6),
  });

  const scene = (e: ReactPointerEvent) => toScene(sceneRef.current, e.clientX, e.clientY);
  const startDrag = (e: ReactPointerEvent, p: Piece, grabCol: number, grabRow: number) => {
    if (!running || demo) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 2) return turnPiece(p.id);
    const pt = scene(e);
    setPicked(p.id);
    setDrag({ id: p.id, dx: grabCol, dy: grabRow, x: pt.x, y: pt.y });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const pt = scene(e);
    setDrag({ ...drag, x: pt.x, y: pt.y });
  };
  const onUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    const at = {
      col: Math.round((d.x - gridX) / cell - d.dx - 0.5),
      row: Math.round((d.y - gridY) / cell - d.dy - 0.5),
    };
    const overPack =
      d.x >= gridX - cell &&
      d.x <= gridX + gridW + cell &&
      d.y >= gridY - cell &&
      d.y <= gridY + gridH + cell;
    setGame((s) => {
      if (overPack && fits(s, d.id, at)) {
        playSound('place');
        return place(s, d.id, at);
      }
      return overPack ? s : takeOut(s, d.id);
    });
  };

  const drawPiece = (p: Piece, x: number, y: number, size: number, grab: boolean) => {
    const cells = turned(p.cells, p.rot);
    const w = Math.max(...cells.map((c) => c.col)) + 1;
    const h = Math.max(...cells.map((c) => c.row)) + 1;
    return (
      <span
        key={p.id}
        className={styles.piece}
        data-picked={(picked === p.id && !demo) || undefined}
        style={{ left: x, top: y, width: w * size, height: h * size }}
      >
        {cells.map((c, k) => (
          <span
            key={k}
            className={styles.cell}
            style={{ left: c.col * size, top: c.row * size, width: size, height: size }}
            onPointerDown={grab ? (e) => startDrag(e, p, c.col, c.row) : undefined}
            onContextMenu={(e) => e.preventDefault()}
          />
        ))}
        <img className={`${ui.sprite} ${styles.gear}`} src={art(p.gear)} alt="" draggable={false} />
      </span>
    );
  };

  const word = (id: string) => {
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'PACKING' : w === 'DONE' || w === 'PASSED' ? 'PACKED' : w;
  };

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The pack. */}
        <span
          className={styles.pack}
          style={{ left: gridX - 8, top: gridY - 16, width: gridW + 16, height: gridH + 24 }}
        />
        {game.torn.map((torn, i) => {
          const c = i % game.cols;
          const r = Math.floor(i / game.cols);
          return (
            <span
              key={i}
              className={styles.slot}
              data-torn={torn || undefined}
              style={{ left: gridX + c * cell, top: gridY + r * cell, width: cell, height: cell }}
            />
          );
        })}
        {game.pieces
          .filter((p) => p.at && p.id !== drag?.id)
          .map((p) => drawPiece(p, gridX + p.at!.col * cell, gridY + p.at!.row * cell, cell, true))}
        <span
          className={`${ui.text} ${styles.note}`}
          style={{ left: gridX - 8, top: gridY + gridH + 12, width: gridW + 16 }}
        >
          TORN SPOTS CAN’T HOLD ANYTHING
        </span>

        {/* The tray. */}
        <div
          className={`${ui.box} ${styles.tray}`}
          style={{ left: TRAY.x, top: TRAY.y, width: TRAY.w, height: TRAY.h }}
        >
          <span className={styles.trayTitle}>STILL TO PACK</span>
        </div>
        {out
          .filter((p) => p.id !== drag?.id)
          .map((p, k) => drawPiece(p, slotOf(k).x, slotOf(k).y, trayCell(out.length), true))}
        <button
          type="button"
          className={`${ui.button} ${styles.turn}`}
          onClick={() => turnPiece(picked)}
          disabled={!running || demo || picked === null}
        >
          TURN (R)
        </button>
        {game.sacked !== null && (
          <span className={`${ui.muted} ${styles.sack}`}>THE BIGGEST PIECE IS IN THE SACK</span>
        )}

        {/* The piece being dragged, at the pack's cell size. */}
        {drag &&
          (() => {
            const p = game.pieces.find((x) => x.id === drag.id);
            if (!p) return null;
            return drawPiece(
              p,
              drag.x - (drag.dx + 0.5) * cell,
              drag.y - (drag.dy + 0.5) * cell,
              cell,
              false,
            );
          })()}

        <p className={`${ui.muted} ${q.hint}`}>
          DRAG GEAR INTO THE PACK. EVERYTHING HAS TO FIT BEFORE TIME RUNS OUT.
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>PACK IT UP</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>TIME {clock(Math.ceil(game.timeLeft))}</span>
          <Bar value={game.timeLeft / game.timeSec} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar hikers={hikers} word={word} active={game.over ? undefined : who} />
      </div>
    </PixelScreen>
  );
}
