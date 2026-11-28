/**
 * Cracked Pots on the GPS (docs/design/24-challenges-reset.md, section 7;
 * mockup 55-cracked-pots.png), in scene units (320 × 240): each hiker's pot
 * on either side (its outline dotted where it goes), and the blanket of
 * shards in the middle. A pot pixel is one scene unit.
 *
 * The shards are cut from the pot pictures on a canvas once per round: each
 * keeps only its own pixels, with a dark edge. Until that's ready (or with
 * no canvas, in a still frame), a shard shows as a plain box.
 *
 * Drag a shard to its spot: it snaps in within [6] and locks; dropped
 * anywhere else it goes back to the blanket. No turning.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { crackedPotsBot, type CrackedDrop } from '../../../minigames/crackedPots/bot';
import {
  drop,
  newCrackedPots,
  placedOf,
  playing,
  result,
  tick,
  type CrackedPotsState,
  type Shard,
} from '../../../minigames/crackedPots/logic';
import { POT_MASKS } from '../../../minigames/crackedPots/masks';
import { prepNumber } from '../../../minigames/prepare';
import { TIER_LABELS } from '../../../minigames/types';
import { Bar } from '../Bar';
import { useDemoBot, useDemoMode } from '../demo';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { useClockTicks, useFrameSounds, type FrameSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useReportOnce } from '../quick/useQuick';
import styles from './CrackedPots.module.css';

const C = BALANCE.minigames.crackedPots;
const potFile = (k: number) => `minigames/cracked-pots/${POT_MASKS[k]!.file}`;
const EDGE = [29, 41, 24] as const;

/** The round's art: each shard cut out, each pot's dotted outline and crack lines. */
interface RoundArt {
  key: string;
  shards: Record<number, string>;
  outlines: string[];
  cracks: string[];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Each round's art, cut once (the last few rounds kept). */
const artCache = new Map<string, Promise<RoundArt | null>>();
function artFor(game: Pick<CrackedPotsState, 'pots' | 'shards'>, key: string) {
  let art = artCache.get(key);
  if (!art) {
    art = makeArt(game, key);
    artCache.set(key, art);
    for (const k of [...artCache.keys()].slice(0, -4)) artCache.delete(k);
  }
  return art;
}

/** Cuts the round's shards out of the pot pictures, and draws each pot's outline and cracks. */
async function makeArt(
  game: Pick<CrackedPotsState, 'pots' | 'shards'>,
  key: string,
): Promise<RoundArt | null> {
  if (typeof document === 'undefined') return null;
  const images = await Promise.all(game.pots.map((p) => loadImage(asset(potFile(p.image)))));
  const out: RoundArt = { key, shards: {}, outlines: [], cracks: [] };
  game.pots.forEach((pot, k) => {
    const img = images[k]!;
    const { width: w, height: h, map } = pot;
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    const fctx = full.getContext('2d');
    if (!fctx) return;
    fctx.drawImage(img, 0, 0);
    const pixels = fctx.getImageData(0, 0, w, h);
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= w || y >= h ? -1 : map[y * w + x]!;
    for (const shard of game.shards.filter((x) => x.pot === k)) {
      const c = document.createElement('canvas');
      c.width = shard.w;
      c.height = shard.h;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      const data = ctx.createImageData(shard.w, shard.h);
      for (let y = 0; y < shard.h; y++) {
        for (let x = 0; x < shard.w; x++) {
          const px = shard.x0 + x;
          const py = shard.y0 + y;
          if (at(px, py) !== shard.id) continue;
          const from = (py * w + px) * 4;
          const to = (y * shard.w + x) * 4;
          const edge = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => at(px + dx!, py + dy!) !== shard.id);
          data.data[to] = edge ? EDGE[0] : pixels.data[from]!;
          data.data[to + 1] = edge ? EDGE[1] : pixels.data[from + 1]!;
          data.data[to + 2] = edge ? EDGE[2] : pixels.data[from + 2]!;
          data.data[to + 3] = 255;
        }
      }
      ctx.putImageData(data, 0, 0);
      out.shards[shard.id] = c.toDataURL();
    }
    // The dotted outline (every other rim pixel) and the faint cracks between shards.
    const line = document.createElement('canvas');
    line.width = w;
    line.height = h;
    const crack = document.createElement('canvas');
    crack.width = w;
    crack.height = h;
    const lctx = line.getContext('2d');
    const cctx = crack.getContext('2d');
    if (!lctx || !cctx) return;
    lctx.fillStyle = 'rgb(29, 41, 24)';
    cctx.fillStyle = 'rgba(29, 41, 24, 0.35)';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const id = at(x, y);
        if (id < 0) continue;
        const near = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
        if (near.some((v) => v < 0) && (x + y) % 3 === 0) lctx.fillRect(x, y, 1, 1);
        else if (near.some((v) => v >= 0 && v !== id)) cctx.fillRect(x, y, 1, 1);
      }
    }
    out.outlines[k] = line.toDataURL();
    out.cracks[k] = crack.toDataURL();
  });
  return out;
}

export function CrackedPots({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const cracks = pickOf(settings, 'cracks');
  const [game, setGame] = useState(() =>
    newCrackedPots(
      {
        tier,
        shards: typeof settings.shards === 'number' ? settings.shards : 'auto',
        cracks: cracks === 'on' || cracks === 'off' ? cracks : 'auto',
        // Prepare (24-challenges-reset.md, section 7).
        extraSec: prepNumber(settings, 'prep.extraSec'),
        glued: prepNumber(settings, 'prep.glue'),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const ghost = prepNumber(settings, 'prep.ghost') > 0;
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
  const byId = (id: string) => hikers.find((h) => h.id === id);

  // The round's art, cut once per round (and kept while the round plays).
  const artKey = `${seed}:${game.round}`;
  const [art, setArt] = useState<RoundArt | null>(null);
  const { pots, shards } = game;
  useEffect(() => {
    let live = true;
    artFor({ pots, shards }, artKey)
      .then((a) => {
        if (live) setArt(a);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [artKey, pots, shards]);
  const ready = art?.key === artKey ? art : null;

  const act = (a: CrackedDrop) =>
    setGame((s) => {
      const out = drop(s, a.id, a.at);
      return out;
    });
  // A ceramic clink for each shard set down, and a ring when a pot is whole again.
  useFrameSounds(game, (a, b) => {
    const out: FrameSound[] = [];
    if (b.lastDrop && b.lastDrop !== a.lastDrop) {
      out.push('pots.shard');
      if (!b.lastDrop.snapped) out.push('mg.miss');
    }
    const whole = (s: CrackedPotsState) =>
      Object.values(s.results).filter((r) => r === 'passed').length;
    if (whole(b) > whole(a)) out.push('pots.whole');
    return out;
  });
  useClockTicks(game.timeLeft, running);
  useDemoBot(demo && running, game, crackedPotsBot, act);

  const scene = (e: ReactPointerEvent) => toScene(sceneRef.current, e.clientX, e.clientY);
  /** A press on a loose shard (found by its `data-shard`) picks it up. */
  const onDown = (e: ReactPointerEvent) => {
    if (!running || demo || game.phase !== 'play') return;
    const el = (e.target as HTMLElement).closest('[data-shard]');
    const id = Number(el?.getAttribute('data-shard'));
    const shard = game.shards.find((x) => x.id === id);
    if (!el || !shard || shard.placed) return;
    e.preventDefault();
    const p = scene(e);
    setDrag({ id: shard.id, dx: p.x - shard.at.x, dy: p.y - shard.at.y, x: p.x, y: p.y });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = scene(e);
    setDrag({ ...drag, x: p.x, y: p.y });
  };
  const onUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    act({ id: d.id, at: { x: d.x - d.dx, y: d.y - d.dy } });
  };

  const drawShard = (shard: Shard, x: number, y: number, lifted: boolean) => {
    const src = ready?.shards[shard.id];
    return (
      <span
        key={shard.id}
        className={styles.shard}
        data-placed={shard.placed || undefined}
        data-lifted={lifted || undefined}
        style={{ left: x, top: y, width: shard.w, height: shard.h }}
        data-shard={shard.id}
      >
        {src ? (
          <img className={ui.sprite} src={src} alt="" draggable={false} />
        ) : (
          <span className={styles.box} />
        )}
      </span>
    );
  };

  const who = playing(game);
  const word = (id: string) => {
    const r = game.results[id];
    if (r === 'passed') return 'PASSED';
    if (r === 'failed') return 'FAILED';
    if (who.includes(id)) return `${placedOf(game, id)} OF ${game.shardsPerPot} PLACED`;
    return 'WAITING';
  };
  const dragged = drag ? game.shards.find((x) => x.id === drag.id) : undefined;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={`${q.play} ${styles.play}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The pots: a ghost picture (CAMERA), the outline, Tier I's cracks, and the shards in. */}
        {game.pots.map((pot, k) => (
          <span key={`pot-${k}`}>
            <span
              className={styles.dot}
              style={{
                left: pot.origin.x + pot.width / 2 - 4,
                top: pot.origin.y - 12,
                background: byId(pot.owner)?.color,
              }}
            />
            {ghost && (
              <img
                className={`${ui.sprite} ${styles.ghost}`}
                src={asset(potFile(pot.image))}
                alt=""
                draggable={false}
                style={{
                  left: pot.origin.x,
                  top: pot.origin.y,
                  width: pot.width,
                  height: pot.height,
                }}
              />
            )}
            {ready?.outlines[k] && (
              <img
                className={`${ui.sprite} ${q.thing}`}
                src={ready.outlines[k]}
                alt=""
                draggable={false}
                style={{
                  left: pot.origin.x,
                  top: pot.origin.y,
                  width: pot.width,
                  height: pot.height,
                }}
              />
            )}
            {game.cracks && ready?.cracks[k] && (
              <img
                className={`${ui.sprite} ${q.thing}`}
                src={ready.cracks[k]}
                alt=""
                draggable={false}
                style={{
                  left: pot.origin.x,
                  top: pot.origin.y,
                  width: pot.width,
                  height: pot.height,
                }}
              />
            )}
            <span
              className={`${ui.text} ${styles.label}`}
              style={{
                left: pot.origin.x - 10,
                top: pot.origin.y + pot.height + 6,
                width: pot.width + 20,
              }}
            >
              {(byId(pot.owner)?.name ?? pot.owner).toUpperCase()}’S POT
              {pot.done ? ' · WHOLE!' : ''}
            </span>
          </span>
        ))}

        {/* The blanket. */}
        <span
          className={`${ui.text} ${styles.blanketTitle}`}
          style={{ left: C.blanket.left, width: C.blanket.right - C.blanket.left }}
        >
          THE SHARDS
        </span>
        <span
          className={styles.blanket}
          style={{
            left: C.blanket.left,
            top: C.blanket.top,
            width: C.blanket.right - C.blanket.left,
            height: C.blanket.bottom - C.blanket.top,
          }}
        />
        {game.shards.filter((x) => x.placed).map((x) => drawShard(x, x.home.x, x.home.y, false))}
        {game.shards
          .filter((x) => !x.placed && x.id !== drag?.id)
          .map((x) => drawShard(x, x.at.x, x.at.y, false))}
        {dragged && drag && drawShard(dragged, drag.x - drag.dx, drag.y - drag.dy, true)}

        {game.phase === 'between' && !game.over && game.rounds[game.round + 1] && (
          <span className={`${ui.box} ${q.handoff}`}>
            {game.rounds[game.round + 1]!.map((id) => (byId(id)?.name ?? id).toUpperCase()).join(
              ' & ',
            )}
            , YOUR POTS
          </span>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          PUT EACH SHARD BACK WHERE IT BROKE OFF. NO TURNING: THE SHAPES ARE THE PUZZLE.
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>CRACKED POTS</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>TIME</span>
          <Bar value={game.timeSec ? game.timeLeft / game.timeSec : 0} live />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : who[0]}
          extra={(id) => {
            const n = placedOf(game, id);
            if (!who.includes(id)) return null;
            return (
              <span className={styles.squares} aria-label={`${n} of ${game.shardsPerPot} placed`}>
                {Array.from({ length: game.shardsPerPot }, (_, k) => (
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
