/**
 * The pop-up's Prepare pieces (docs/design/20-challenge-popup.md, sections 3
 * and 4; mockups/challenge-popup/prototype.html): a slot (empty with its
 * ghost icons and the outline of who can fill it; filled with the owner's
 * color and an ×), the pop-up inventory, a bar, and a hiker's hearts.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { BALANCE } from '../../config/balance';
import type { Fill, Slot, Tile } from '../../minigames/prepare';
import type { Bar } from '../../minigames/popups';
import type { MinigameHiker } from '../../minigames/types';
import { useReducedMotion } from '../app/useReducedMotion';
import { acceptsLine, clockText, ringOf, thingArt, thingName, tileLine } from './prepareLook';
import styles from './ChallengePopup.module.css';

const PR = BALANCE.minigames.prepare;

/** A thing's picture, or its initials when it has no art yet. */
function ThingPic({
  thing,
  className = '',
}: {
  thing: Fill['thing'];
  className?: string | undefined;
}) {
  const art = thingArt(thing);
  if (art) return <img className={className} src={art} alt="" draggable={false} />;
  const initials = thingName(thing)
    .split(' ')
    .map((w) => w[0])
    .join('');
  return (
    <span className={`${className} ${styles.noArt}`} aria-hidden="true">
      {initials}
    </span>
  );
}

/** One Prepare slot. Hover peeks at the inventory; a click opens it to pick; × empties it. */
export function PrepSlot({
  slot,
  fill,
  who,
  owner,
  open,
  onPeek,
  onOpen,
  onEmpty,
}: {
  slot: Slot;
  fill?: Fill | undefined;
  /** The colors of the hikers who could fill it now. */
  who: readonly string[];
  /** The filled slot's owner's color. */
  owner?: string | undefined;
  open: boolean;
  onPeek(el: HTMLElement | null): void;
  onOpen(el: HTMLElement): void;
  onEmpty(): void;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const many = slot.row.accepts.length > 1;
  // The ghost icon fades from one thing to the next every [1.3 s].
  useEffect(() => {
    if (!many || fill || reduced) return;
    const id = window.setInterval(() => setPhase((p) => p + 1), PR.ghostCycleSec * 1000);
    return () => window.clearInterval(id);
  }, [many, fill, reduced]);
  const ref = useRef<HTMLButtonElement>(null);
  const label = fill
    ? `${slot.row.label}: ${thingName(fill.thing)}. Press to swap.`
    : `${slot.row.label}: takes ${acceptsLine(slot.row.accepts).toLowerCase()} ×${slot.row.need}. Press to pick.`;
  return (
    <span className={styles.slotWrap}>
      <button
        ref={ref}
        type="button"
        className={styles.slotRing}
        data-who={(!fill && who.length > 0) || undefined}
        data-filled={!!fill || undefined}
        data-open={open || undefined}
        style={
          {
            '--ring': ringOf(who),
            '--owner': owner,
          } as CSSProperties
        }
        aria-label={label}
        aria-haspopup="dialog"
        onMouseEnter={() => onPeek(ref.current)}
        onMouseLeave={() => onPeek(null)}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(e.currentTarget);
        }}
      >
        <span className={styles.slot}>
          {!fill &&
            slot.row.accepts.map((t, i) => (
              <ThingPic
                key={`${t.kind}:${t.id}`}
                thing={t}
                className={`${styles.ghost} ${i === phase % slot.row.accepts.length ? styles.ghostOn : ''}`}
              />
            ))}
          {fill && <ThingPic thing={fill.thing} className={styles.full} />}
          {!fill && slot.row.need > 1 && <span className={styles.need}>×{slot.row.need}</span>}
          {!fill && slot.row.tag && <span className={styles.tag}>{slot.row.tag}</span>}
        </span>
      </button>
      {fill && (
        <button
          type="button"
          className={styles.x}
          aria-label={`Take back ${thingName(fill.thing)}`}
          onClick={(e) => {
            e.stopPropagation();
            onEmpty();
          }}
        >
          x
        </button>
      )}
    </span>
  );
}

/**
 * The pop-up inventory (Zelda BotW style): one tile per hiker stack of what
 * the slot takes. Peeking only looks; picking (after a click) fills the
 * slot. Arrow keys move, Enter picks, Esc closes.
 */
export function Inventory({
  slot,
  tiles,
  mode,
  current,
  at,
  byId,
  onPick,
  onClose,
}: {
  slot: Slot;
  tiles: readonly Tile[];
  mode: 'peek' | 'pick';
  current?: Fill | undefined;
  /** Where its pointer goes (the slot's middle, window px), and how far it's kept from the edges. */
  at: { x: number; top: number; minX: number; maxX: number };
  byId(id: string): MinigameHiker | undefined;
  onPick(tile: Tile): void;
  onClose(): void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState(() =>
    Math.max(
      0,
      tiles.findIndex((t) => t.ok),
    ),
  );
  const panel = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 260, h: 140 });
  useEffect(() => {
    const el = panel.current;
    if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [tiles.length]);
  useEffect(() => {
    if (mode === 'pick') panel.current?.focus();
  }, [mode]);
  const half = size.w / 2;
  const x = Math.min(Math.max(at.x, at.minX + half), at.maxX - half);
  const shown = hover ?? (mode === 'pick' ? focus : null);
  const line = shown !== null && tiles[shown] ? tileLine(tiles[shown]!, slot.row.need, byId) : null;
  const pickable = tiles.map((t, i) => (t.ok ? i : -1)).filter((i) => i >= 0);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (mode !== 'pick') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = tiles[focus];
      if (t?.ok) onPick(t);
      return;
    }
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step || !pickable.length) return;
    e.preventDefault();
    const k = pickable.indexOf(focus);
    setFocus(pickable[(k + step + pickable.length) % pickable.length]!);
  };
  return (
    <div
      ref={panel}
      className={styles.inv}
      data-mode={mode}
      role="dialog"
      aria-label={`Pick ${acceptsLine(slot.row.accepts).toLowerCase()}`}
      tabIndex={-1}
      onKeyDown={onKey}
      onClick={(e) => e.stopPropagation()}
      style={{ left: x, top: at.top - size.h - 14, '--arrow': `${at.x - x}px` } as CSSProperties}
    >
      <div className={styles.invHead}>
        <span>
          <b>{acceptsLine(slot.row.accepts)}</b> ×{slot.row.need}
        </span>
        <span>{mode === 'pick' ? 'PICK ONE' : 'CLICK THE SLOT TO PICK'}</span>
      </div>
      <div className={styles.invGrid} style={{ '--n': Math.min(tiles.length, 5) } as CSSProperties}>
        {tiles.map((t, i) => {
          const h = t.hiker ? byId(t.hiker) : undefined;
          const sel =
            !!current &&
            current.hiker === t.hiker &&
            current.thing.id === t.thing.id &&
            current.thing.kind === t.thing.kind;
          return (
            <button
              key={`${t.hiker ?? 'none'}:${t.thing.kind}:${t.thing.id}`}
              type="button"
              className={styles.tile}
              data-dim={!t.ok || undefined}
              data-sel={sel || undefined}
              data-focus={(mode === 'pick' && i === focus) || undefined}
              style={{ '--c': h?.color ?? '#555' } as CSSProperties}
              tabIndex={-1}
              aria-disabled={!t.ok || mode !== 'pick'}
              aria-label={`${tileLine(t, slot.row.need, byId).main} ${tileLine(t, slot.row.need, byId).more}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (mode === 'pick' && t.ok) onPick(t);
              }}
            >
              <ThingPic thing={t.thing} className={styles.tileArt} />
              {h && (
                <>
                  <span className={styles.own} />
                  <span className={styles.ini}>{h.name[0]}</span>
                  <span className={styles.cnt}>×{t.free}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.foot}>
        {line ? (
          <>
            {line.main} <i>{line.more}</i>
          </>
        ) : (
          <i>{mode === 'pick' ? 'HOVER A TILE' : ''}</i>
        )}
      </div>
    </div>
  );
}

/** A bar (section 3): segments filled to the value; Prepare's change in green, hatched when it's less. */
export function BarRow({ bar }: { bar: Bar }) {
  const fmt =
    bar.display ??
    ((v: number) =>
      bar.kind === 'level' ? `${v}/${bar.max}` : bar.kind === 'time' ? clockText(v) : `${v}`);
  const per = bar.kind === 'time' ? (bar.per ?? 5) : 1;
  const value = Math.round(bar.value / per);
  const base = Math.round(bar.base / per);
  const diff = bar.kind === 'time' ? Math.round(bar.value - bar.base) : bar.value - bar.base;
  const step = Math.round(diff * 100) / 100;
  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{bar.label}</span>
      <span className={styles.segs} aria-hidden="true">
        {Array.from({ length: bar.max }, (_, i) => (
          <span
            key={i}
            className={styles.seg}
            data-on={i < Math.min(value, base) || undefined}
            data-cut={(i >= value && i < base) || undefined}
            data-add={(i >= base && i < value) || undefined}
          />
        ))}
      </span>
      <span className={styles.barValue}>
        {fmt(bar.value)}
        {step !== 0 && (
          <span className={styles.delta}>
            {' '}
            {step > 0 ? '+' : '−'}
            {Math.abs(step)}
            {bar.kind === 'time' ? 's' : ''}
          </span>
        )}
      </span>
    </div>
  );
}

const HEART = 'M1 0h2v1h1v1h1V1h1V0h2v1h1v3H8v1H7v1H6v1H5v1H4V7H3V6H2V5H1V4H0V1h1z';
const HEART_IN = 'M1 1h2v1h1v1h1V2h1V1h2v3H7v1H6v1H5v1H4V6H3V5H2V4H1z';

/** A pixel heart; a new one (from Prepare) pops in with a gold outline. */
export function Heart({ fresh = false }: { fresh?: boolean }) {
  return (
    <svg
      className={styles.heart}
      data-new={fresh || undefined}
      viewBox="0 0 9 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d={HEART} fill={fresh ? '#E9B44C' : '#2A2420'} />
      <path d={HEART_IN} fill="#C8423A" />
    </svg>
  );
}
