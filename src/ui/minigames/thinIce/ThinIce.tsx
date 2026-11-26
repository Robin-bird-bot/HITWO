/**
 * Thin Ice, the crossing, on the GPS (docs/design/23-minigames-final.md,
 * section 7; mockup 46-thin-ice-crossing.png), in scene units (320 × 240):
 * the far shore above the ice and the near shore below it, with each
 * near-shore square's number; the crossing hiker's token on the ice; each
 * finished hiker's path drawn in their color over the cracked squares; and
 * the hiker's picks on the right.
 *
 * - Tap a near-shore square to stand there.
 * - Tap a square next to you to step onto it, or one 2 away to test it with
 *   the ice pick. From the first ice row, tap the far shore to cross.
 * - Right-click or long-press flags a square (free).
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';
import { thinIceBot, type ThinIceAction } from '../../../minigames/thinIce/bot';
import {
  canPick,
  canStep,
  count,
  cross,
  crossing,
  newThinIce,
  pick,
  posOf,
  result,
  shoreCount,
  stand,
  step,
  tick,
  toggleFlag,
} from '../../../minigames/thinIce/logic';
import { turnWord } from '../../../minigames/quick/turns';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { HikerToken } from '../HikerToken';
import { PixelScreen } from '../PixelScreen';
import { clock, pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useReportOnce } from '../quick/useQuick';
import styles from './ThinIce.module.css';

const T = BALANCE.minigames.thinIce;
const art = (f: string) => asset(`minigames/thin-ice/${f}`);

export function ThinIce({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const [game, setGame] = useState(() =>
    newThinIce(
      {
        tier,
        picks: typeof settings.picks === 'number' ? settings.picks : 'auto',
        timeSec: typeof settings.time === 'number' ? settings.time : 'off',
        // Prepare (23-minigames-final.md, section 10): +1 pick, TEST THE ICE and the Hiking Stick.
        extraPicks: perHikerCounts(settings, 'prep.picks'),
        marked: prepNumber(settings, 'prep.testIce'),
        stick: prepNumber(settings, 'prep.stick') > 0,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const demo = useDemoMode();
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const press = useRef<{ cell: number; timer: number; flagged: boolean } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const colorOf = (id: string) => byId(id)?.color ?? '#d3dfaf';
  const who = crossing(game);
  const showHoles = pickOf(settings, 'showHoles') === 'on';

  // The board: shores above and below the ice, on the left; the picks panel on the right.
  const cell = Math.min(16, Math.floor(156 / (game.rows + 2)), Math.floor(170 / game.cols));
  const width = game.cols * cell;
  const left = 12 + Math.floor((196 - width) / 2);
  const shoreH = cell;
  const top = 26 + Math.floor((166 - (game.rows * cell + 2 * shoreH)) / 2);
  const iceTop = top + shoreH;
  const nearTop = iceTop + game.rows * cell;
  const at = (c: number) => ({
    x: left + posOf(game, c).col * cell,
    y: iceTop + posOf(game, c).row * cell,
  });

  const act = (a: ThinIceAction) => {
    const before = game;
    const out =
      a.kind === 'stand'
        ? stand(before, a.col)
        : a.kind === 'step'
          ? step(before, a.cell)
          : a.kind === 'pick'
            ? pick(before, a.cell)
            : cross(before);
    if (out === before) return;
    if (out.fell.length > before.fell.length) playSound('miss');
    else if (out.last && out.last !== before.last && out.last.kind === 'across') playSound('ready');
    else playSound('pop');
    setGame(out);
  };
  useDemoBot(demo && running, game, thinIceBot, act);

  const tapCell = (c: number) => {
    if (canStep(game, c)) act({ kind: 'step', cell: c });
    else if (canPick(game, c)) act({ kind: 'pick', cell: c });
  };
  const flag = (c: number) => running && setGame((s) => toggleFlag(s, c));
  const onDown = (e: ReactPointerEvent, c: number) => {
    if (!running || demo || e.button === 2) return;
    const timer = window.setTimeout(() => {
      if (press.current?.cell === c) {
        press.current.flagged = true;
        flag(c);
      }
    }, T.longPressSec * 1000);
    press.current = { cell: c, timer, flagged: false };
  };
  const onUp = (c: number) => {
    const p = press.current;
    press.current = null;
    if (!p || p.cell !== c) return;
    window.clearTimeout(p.timer);
    if (!p.flagged) tapCell(c);
  };

  const last = game.last && game.time - game.last.at < 1.4 ? game.last : null;
  const across = game.turns.order.filter((id) => game.turns.done[id] === true);
  const word = (id: string) => {
    if (game.fell.includes(id)) return 'FELL IN';
    if (game.timedOut.includes(id)) return 'OUT OF TIME';
    if (game.turns.done[id]) return 'ACROSS';
    const w = turnWord(game.turns, id);
    return w === 'NOW' ? 'CROSSING' : w;
  };

  return (
    <PixelScreen measure={!still}>
      <div className={q.play} onContextMenu={(e) => e.preventDefault()}>
        {/* The far shore: hikers who made it wait here. Tap it from the first ice row to cross. */}
        <button
          type="button"
          className={styles.shore}
          data-goal={(game.at?.row === 0 && running) || undefined}
          style={{ left, top, width, height: shoreH }}
          onClick={() => !demo && act({ kind: 'cross' })}
          disabled={still}
          aria-label="The far shore"
        >
          <span className={ui.text}>FAR SHORE</span>
        </button>
        {across.map((id, k) => (
          <HikerToken
            key={id}
            hiker={byId(id)!}
            size={Math.min(10, cell - 4)}
            state="safe"
            className={styles.token}
            style={{ left: left + 4 + k * (cell - 2), top: top + 2 }}
          />
        ))}

        {/* The ice. */}
        {game.holes.map((hole, c) => {
          const p = at(c);
          const seen = game.seen[c];
          const cracked = game.cracked[c];
          const n = seen && !hole ? count(game, c) : 0;
          const file =
            seen && hole ? 'hole.png' : cracked ? 'cracked.png' : seen ? 'open.png' : 'ice.png';
          const stepOk = canStep(game, c);
          const pickOk = !stepOk && canPick(game, c);
          return (
            <button
              key={c}
              type="button"
              className={styles.cell}
              data-step={(stepOk && !demo) || undefined}
              data-pick={(pickOk && !demo) || undefined}
              data-hover={(hover === c && (stepOk || pickOk)) || undefined}
              style={{ left: p.x, top: p.y, width: cell, height: cell }}
              onPointerDown={(e) => onDown(e, c)}
              onPointerUp={() => onUp(c)}
              onPointerEnter={() => setHover(c)}
              onPointerLeave={() => {
                setHover(null);
                if (press.current) window.clearTimeout(press.current.timer);
                press.current = null;
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!demo) flag(c);
              }}
              disabled={still}
              aria-label={
                seen && hole
                  ? 'Open water'
                  : cracked
                    ? `Cracked, ${n} around`
                    : seen
                      ? `${n || 'No'} holes around`
                      : game.flags[c]
                        ? 'Flagged'
                        : 'Ice'
              }
            >
              <img className={ui.sprite} src={art(file)} alt="" draggable={false} />
              {game.flags[c] && !seen && (
                <img
                  className={`${ui.sprite} ${styles.mark}`}
                  src={art('flag.png')}
                  alt=""
                  draggable={false}
                />
              )}
              {showHoles && hole && !seen && <span className={styles.secret} />}
              {n > 0 && (
                <span className={styles.number} style={{ fontSize: cell * 0.42 }}>
                  {n}
                </span>
              )}
            </button>
          );
        })}

        {/* Each finished hiker's path, in their color. */}
        <svg className={styles.paths} viewBox="0 0 320 240" aria-hidden="true">
          {Object.entries(game.paths).map(([id, path]) =>
            path.length > 1 ? (
              <polyline
                key={id}
                points={path.map((c) => `${at(c).x + cell / 2},${at(c).y + cell / 2}`).join(' ')}
                fill="none"
                stroke={colorOf(id)}
                strokeWidth={1.2}
                strokeLinejoin="round"
                opacity={0.85}
              />
            ) : null,
          )}
        </svg>

        {/* The near shore: each square's number counts the holes touching it in the first ice row. */}
        <div className={styles.near} style={{ left, top: nearTop, width, height: shoreH }}>
          {Array.from({ length: game.cols }, (_, col) => (
            <button
              key={col}
              type="button"
              className={styles.shoreCell}
              data-step={(!game.at && running && !demo) || undefined}
              style={{ left: col * cell, width: cell, height: shoreH }}
              onClick={() => !demo && act({ kind: 'stand', col })}
              disabled={still}
              aria-label={`Near shore: ${shoreCount(game, col)} holes ahead`}
            >
              <img className={ui.sprite} src={art('shore.png')} alt="" draggable={false} />
              <span className={styles.number} style={{ fontSize: cell * 0.42 }}>
                {shoreCount(game, col)}
              </span>
            </button>
          ))}
        </div>

        {/* The crossing hiker. */}
        {who && game.at && byId(who) && (
          <HikerToken
            hiker={byId(who)!}
            size={Math.min(10, cell - 4)}
            state="current"
            className={styles.token}
            style={{
              left: left + game.at.col * cell + (cell - Math.min(10, cell - 4)) / 2,
              top:
                (game.at.row === game.rows ? nearTop : iceTop + game.at.row * cell) +
                (cell - Math.min(10, cell - 4)) / 2,
            }}
          />
        )}
        {last && last.cell !== undefined && last.kind !== 'pick' && (
          <span
            className={q.word}
            style={{ left: at(last.cell).x + cell / 2, top: at(last.cell).y - 4 }}
          >
            {last.kind === 'fell' ? 'SPLASH!' : 'CRACK!'}
          </span>
        )}

        {/* The crossing hiker's picks, and the key. */}
        <div className={`${ui.box} ${styles.side}`}>
          <span className={styles.sideName}>
            {who ? (byId(who)?.name ?? who).toUpperCase() : ''}
          </span>
          <span className={ui.muted}>PICKS</span>
          <span className={styles.picks}>
            {Array.from({ length: Math.max(0, game.picksLeft) }, (_, k) => (
              <img
                key={k}
                className={ui.sprite}
                src={art('ice-pick.png')}
                alt=""
                draggable={false}
              />
            ))}
            {game.picksLeft <= 0 && <span className={ui.muted}>NONE</span>}
          </span>
          {game.timeLeft !== null && (
            <span className={styles.time} data-low={game.timeLeft <= 10 || undefined}>
              {clock(Math.ceil(game.timeLeft))}
            </span>
          )}
          <span className={ui.muted}>CRACKED ICE</span>
          <img
            className={`${ui.sprite} ${styles.key}`}
            src={art('cracked.png')}
            alt=""
            draggable={false}
          />
          <span className={styles.keyText}>CAN’T BE USED</span>
        </div>

        <p className={`${ui.muted} ${q.hint}`}>
          {!game.at
            ? 'TAP THE NEAR SHORE TO STAND THERE. ITS NUMBER COUNTS THE HOLES AHEAD.'
            : game.at.row === 0
              ? 'TAP THE FAR SHORE TO CROSS.'
              : 'STEP NEXT TO YOU, OR USE A PICK TO TEST A SQUARE 2 AWAY.'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>THIN ICE</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            ACROSS {across.length} OF {game.turns.order.length}
          </span>
          <span className={hud.bar}>
            <span
              style={{ width: `${(across.length / Math.max(1, game.turns.order.length)) * 100}%` }}
            />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar hikers={hikers} word={word} active={game.over ? undefined : who} />
      </div>
    </PixelScreen>
  );
}
