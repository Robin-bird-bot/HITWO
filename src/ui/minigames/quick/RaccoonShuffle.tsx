/**
 * Raccoon Shuffle on the GPS (docs/design/18-minigames-quick.md, section 6;
 * mockups 9-raccoon-shuffle-show.png, 10-raccoon-shuffle-swap.png and
 * 11-raccoon-shuffle-night.png), in scene units (320 × 240): Whackoon's
 * ribbed cans in a row at a trailhead. The raccoons hold up cards with what
 * they'd steal from this hiker (the game's own resource icons, or energy);
 * the empty bins say EMPTY. Then the bins swap places (one arcs over, the
 * other slides under), and the hiker picks one: a tap or click, or Left and
 * Right then Space.
 *
 * At night it's dark except a circle of light around the pointer (where the
 * finger last touched on phones; the selected bin with keys).
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ASSETS, asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { RESOURCES } from '../../../content/resources';
import { testPack } from '../../../minigames/hikers';
import { current, playing, turnWord } from '../../../minigames/quick/turns';
import {
  binAt,
  binX,
  newRaccoonShuffle,
  pickBin,
  result,
  select,
  swapProgress,
  tick,
  type Bin,
  type Card,
} from '../../../minigames/raccoonShuffle/logic';
import { TIER_LABELS } from '../../../minigames/types';
import { Icon } from '../../icons/Icon';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from './Quick.module.css';
import styles from './RaccoonShuffle.module.css';
import { TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';

const RS = BALANCE.minigames.raccoonShuffle;
const art = (f: string) => asset(`minigames/raccoon-shuffle/${f}`);
const can = (f: string) => asset(`minigames/whackoon/${f}`);
/** The can (36 × 44) stands on the line; the raccoon sits in its top; the card is held up above. */
const CAN_W = 36;
const CAN_H = 44;
const RESOURCE_NAME = new Map(RESOURCES.map((r) => [r.id, r.name]));

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const resourceName = (id: string) => RESOURCE_NAME.get(id) ?? id;

export function RaccoonShuffle({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const nightPick = pickOf(settings, 'night');
  const [game, setGame] = useState(() =>
    newRaccoonShuffle(
      {
        tier,
        night: nightPick === 'on' || nightPick === 'off' ? nightPick : 'auto',
        // Test hikers carry nothing: the Packs setting gives them made-up packs (or none).
        packs: Object.fromEntries(
          hikers.map((h) => [
            h.id,
            h.pack ?? (pickOf(settings, 'packs') === 'empty' ? {} : testPack(seed, h.id)),
          ]),
        ),
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const [light, setLight] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [keysUsed, setKeysUsed] = useState(false);
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);

  const who = current(game.turns);
  const onTurn = playing(game.turns);
  const n = game.slots.length;
  const lineY = RS.binY;
  const canTop = lineY - CAN_H;
  const showEmpties = pickOf(settings, 'empties') === 'on';

  const choose = (slot: number) => {
    const out = pickBin(game, slot);
    if (out === game) return;
    playSound(binAt(out, slot).card ? 'hit' : 'pop');
    setGame(out);
  };
  /** The slot under a scene point (the can, or what's up in it). */
  const slotAt = (p: { x: number; y: number }) => {
    for (let k = 0; k < n; k++) {
      if (Math.abs(p.x - binX(k, n)) <= CAN_W / 2 && p.y >= canTop - 14 && p.y <= lineY) return k;
    }
    return -1;
  };
  const onDown = (e: ReactPointerEvent) => {
    if (!running) return;
    e.preventDefault();
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    setLight(p);
    setKeysUsed(false);
    const k = slotAt(p);
    if (k >= 0) choose(k);
  };
  const onMove = (e: ReactPointerEvent) => {
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    if (e.pointerType === 'mouse' || e.buttons) setLight(p);
    if (e.pointerType === 'mouse') {
      const k = slotAt(p);
      setHover(k >= 0 ? k : null);
    }
  };
  useKeys(running, (key) => {
    if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') {
      const out = select(game, key === 'ArrowLeft' || key === 'a' ? -1 : 1);
      setKeysUsed(true);
      setLight(null);
      setGame(out);
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      setKeysUsed(true);
      choose(game.selected);
      return true;
    }
    return false;
  });

  // Where each bin is now: its slot, or partway through a swap (one arcs over, the other slides under).
  const pairs = game.phase === 'shuffle' ? (game.steps[game.step] ?? []) : [];
  const p = swapProgress(game);
  const posOf = (binId: number) => {
    const slot = game.slots.indexOf(binId);
    for (const [a, b] of pairs) {
      if (slot === a)
        return {
          x: binX(a, n) + (binX(b, n) - binX(a, n)) * ease(p),
          lift: Math.sin(Math.PI * p) * RS.arc,
          over: true,
        };
      if (slot === b)
        return { x: binX(b, n) + (binX(a, n) - binX(b, n)) * ease(p), lift: 0, over: false };
    }
    return { x: binX(slot, n), lift: 0, over: false };
  };

  // What's open: every bin during the show (after the lids open, until they close), the picked one, then all.
  const since = game.time - game.phaseAt;
  const showOpen = game.phase === 'show' && onTurn && since > 0.2 && since < RS.showSec - 0.4;
  const isOpen = (slot: number) =>
    showOpen || game.phase === 'after' || (game.phase === 'open' && slot === game.picked);
  const pickedBin = game.picked !== null ? binAt(game, game.picked) : null;
  const flyOff =
    game.phase === 'open' ? Math.min(1, since / RS.pickedSec) : game.phase === 'after' ? 1 : 0;

  const drawCard = (card: Card, x: number, top: number, style?: React.CSSProperties) => (
    <span className={styles.card} style={{ left: x - 10, top, ...style }}>
      <img className={ui.sprite} src={art('card.png')} alt="" draggable={false} />
      <span className={styles.icon}>
        {card.kind === 'resource' ? (
          <img src={ASSETS.resources[card.id]} alt={resourceName(card.id)} draggable={false} />
        ) : (
          <Icon name="zap" size={10} color="#1d2918" strokeWidth={2.5} />
        )}
      </span>
      <span className={styles.stick} />
    </span>
  );

  const drawBin = (bin: Bin) => {
    const slot = game.slots.indexOf(bin.id);
    const { x, lift, over } = posOf(bin.id);
    const open = isOpen(slot);
    const picked = slot === game.picked && (game.phase === 'open' || game.phase === 'after');
    const lit =
      game.phase === 'pick' &&
      onTurn &&
      (hover === slot || (hover === null && keysUsed && game.selected === slot));
    const gone = picked && bin.card && flyOff >= 1;
    return (
      <span key={bin.id} className={styles.bin} style={{ zIndex: over ? 2 : 1 }}>
        {open && bin.card && (
          <>
            {!gone &&
              drawCard(
                bin.card,
                x,
                canTop - 40,
                picked
                  ? {
                      transform: `translate(${flyOff * 60}px, ${-flyOff * 50}px)`,
                      opacity: 1 - flyOff,
                    }
                  : undefined,
              )}
            <img
              className={`${ui.sprite} ${styles.raccoon}`}
              src={can('raccoon-up.png')}
              alt={
                bin.card.kind === 'resource'
                  ? `A raccoon holding ${resourceName(bin.card.id)}`
                  : 'A raccoon holding energy'
              }
              draggable={false}
              style={{ left: x - CAN_W / 2, top: canTop - 12 }}
            />
          </>
        )}
        {open && !bin.card && (
          <span className={`${ui.text} ${styles.empty}`} style={{ left: x - 15, top: canTop - 22 }}>
            <img className={ui.sprite} src={art('tag-empty.png')} alt="" draggable={false} />
            <span>EMPTY</span>
          </span>
        )}
        <img
          className={`${ui.sprite} ${styles.can}`}
          data-lit={lit || undefined}
          src={can(open ? 'can-open.png' : 'can.png')}
          alt=""
          draggable={false}
          style={{ left: x - CAN_W / 2, top: canTop - lift }}
        />
        {showEmpties && !bin.card && !open && (
          <span
            className={styles.mark}
            style={{ left: x - CAN_W / 2 - 1, top: canTop - lift - 1 }}
          />
        )}
      </span>
    );
  };

  // The light at night: the pointer, the last touch, or the selected bin.
  const lightAt = light ?? { x: binX(game.selected, n), y: canTop + 4 };
  const r = RS.light / 2;
  const word =
    game.phase === 'show'
      ? 'WATCH'
      : game.phase === 'shuffle'
        ? `SWAP ${Math.min(game.swapsTotal, game.swapsDone + pairs.length)}/${game.swapsTotal}`
        : game.phase === 'pick'
          ? 'PICK'
          : pickedBin?.card
            ? 'CAUGHT'
            : 'SAFE';
  const bar =
    game.phase === 'show'
      ? Math.max(0, 1 - since / RS.showSec)
      : game.phase === 'shuffle'
        ? (game.swapsDone + pairs.length * p) / game.swapsTotal
        : 1;
  const verdict =
    pickedBin && (game.phase === 'open' || game.phase === 'after')
      ? pickedBin.card
        ? pickedBin.card.kind === 'resource'
          ? `−1 ${resourceName(pickedBin.card.id).toUpperCase()}`
          : `−${RS.raccoonEnergy} ENERGY`
        : 'EMPTY! NOTHING TAKEN'
      : null;

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img className={`${ui.sprite} ${q.bg}`} src={art('bg.png')} alt="" draggable={false} />
        {onTurn &&
          [...game.bins]
            .sort((a, b) => Number(posOf(a.id).over) - Number(posOf(b.id).over))
            .map(drawBin)}

        {verdict && (
          <span
            className={`${ui.box} ${styles.verdict}`}
            data-bad={pickedBin?.card ? '' : undefined}
            style={{ left: 160 }}
          >
            {verdict}
          </span>
        )}

        {/* Night: dark except a circle of light. */}
        {game.night && (
          <span
            className={styles.night}
            style={{
              background: `radial-gradient(circle at ${lightAt.x}px ${lightAt.y - 22}px, rgba(10, 16, 8, 0) ${r - RS.lightEdge}px, rgba(10, 16, 8, ${RS.dark}) ${r}px)`,
            }}
          />
        )}

        {!onTurn && !game.over && who && (
          <span className={`${ui.box} ${q.handoff}`}>
            {byId(who).name.toUpperCase()}, YOUR TURN
          </span>
        )}
        <p className={`${ui.muted} ${q.hint}`}>
          EACH RACCOON SHOWS WHAT IT WOULD STEAL FROM YOU. FIND AN EMPTY BIN.
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>RACCOON SHUFFLE</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>{word}</span>
          <span className={hud.bar}>
            <span style={{ width: `${Math.min(1, bar) * 100}%` }} />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar
          hikers={hikers}
          word={(id) => turnWord(game.turns, id)}
          active={game.over ? undefined : who}
        />
      </div>
    </PixelScreen>
  );
}
