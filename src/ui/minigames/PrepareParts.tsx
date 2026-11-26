/**
 * The pop-up's Prepare pieces, version 3 (docs/design/20-challenge-popup.md,
 * sections 3 and 4; mockups/challenge-popup/prototype.html): a slot (empty,
 * with ghost icons and a turning, breathing outline in the colors of who
 * can fill it; filled, in the owner's color with an × and a badge saying
 * what it does), the panel that picks a thing, then what it does, then who
 * gets it, a solid bar, and a hiker's hearts.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { BALANCE } from '../../config/balance';
import {
  costText,
  expand,
  thingName,
  type Fill,
  type Option,
  type Slot,
  type Tile,
} from '../../minigames/prepare';
import type { Bar } from '../../minigames/popups';
import type { MinigameHiker } from '../../minigames/types';
import { useReducedMotion } from '../app/useReducedMotion';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { clockText, ringOf, thingArt, tileLine } from './prepareLook';
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

/**
 * One slot. Hover peeks at the inventory; a click (or Enter) opens it to
 * pick; × empties it. A filled slot has a badge saying what it does.
 */
export function PrepSlot({
  slot,
  fill,
  who,
  owner,
  badge,
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
  /** What it does: "♥ ELLIE" on her color, or "SLOW". */
  badge?: { text: string; color?: string | undefined } | undefined;
  open: boolean;
  onPeek(el: HTMLElement | null): void;
  onOpen(el: HTMLElement): void;
  onEmpty(): void;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const things = expand(slot.card.accepts);
  const many = things.length > 1;
  // The ghost icon fades from one thing to the next every [1.3 s].
  useEffect(() => {
    if (!many || fill || reduced) return;
    const id = window.setInterval(() => setPhase((p) => p + 1), PR.ghostCycleSec * 1000);
    return () => window.clearInterval(id);
  }, [many, fill, reduced]);
  const ref = useRef<HTMLButtonElement>(null);
  const label = fill
    ? `${slot.card.title}: ${thingName(fill.thing)}${badge ? `, ${badge.text}` : ''}. Press to change.`
    : `${slot.card.title}: takes ${costText(slot.card).toLowerCase()}. Press to pick.`;
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
            '--turn': `${PR.ringTurnSec}s`,
            '--breathe': `${PR.ringBreatheSec}s`,
            '--low': PR.ringBreatheLow,
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
            things.map((t, i) => (
              <ThingPic
                key={`${t.kind}:${t.id}`}
                thing={t}
                className={`${styles.ghost} ${i === phase % things.length ? styles.ghostOn : ''}`}
              />
            ))}
          {fill && <ThingPic thing={fill.thing} className={styles.full} />}
          {!fill && slot.card.need > 1 && <span className={styles.need}>×{slot.card.need}</span>}
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
      {fill && badge && (
        <span
          className={styles.badge}
          style={badge.color ? { background: badge.color, color: '#1d2918' } : undefined}
        >
          {badge.text}
        </span>
      )}
    </span>
  );
}

/** Where the panel's pointer goes (the slot's middle, window px), and the window's edges. */
export interface PanelAt {
  x: number;
  top: number;
  minX: number;
  maxX: number;
}

/** The panel's frame: above the slot, kept inside the window, with its pointer. */
function Panel({
  at,
  mode,
  label,
  onKeyDown,
  children,
}: {
  at: PanelAt;
  mode: string;
  label: string;
  onKeyDown(e: KeyboardEvent): void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 260, h: 140 });
  // Measure the panel as its content changes (each step), to keep it inside the window.
  useEffect(() => {
    const el = panel.current;
    if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h))
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [size.w, size.h, mode, label, children]);
  useEffect(() => {
    if (mode === 'peek') return;
    const first = panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    (first ?? panel.current)?.focus();
  }, [mode]);
  const half = size.w / 2;
  const x = Math.min(Math.max(at.x, at.minX + half), at.maxX - half);
  return (
    <div
      ref={panel}
      className={styles.inv}
      data-mode={mode}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      style={{ left: x, top: at.top - size.h - 14, '--arrow': `${at.x - x}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Arrow keys move between a panel's buttons; Esc closes it. */
function moveFocus(e: KeyboardEvent, onClose: () => void) {
  if (e.key === 'Escape') {
    e.preventDefault();
    onClose();
    return;
  }
  const step =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? -1
        : 0;
  if (!step) return;
  e.preventDefault();
  const buttons = [
    ...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)',
    ),
  ];
  if (!buttons.length) return;
  const k = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[(k + step + buttons.length) % buttons.length]!.focus();
}

/**
 * Step 1: the pop-up inventory (unchanged from version 2): one tile per
 * hiker stack of what the slot takes. Peeking only looks; after a click,
 * picking a tile goes on to the next step.
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
  at: PanelAt;
  byId(id: string): MinigameHiker | undefined;
  onPick(tile: Tile): void;
  onClose(): void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const words =
    hover !== null && tiles[hover] ? tileLine(tiles[hover]!, slot.card.need, byId) : null;
  return (
    <Panel
      at={at}
      mode={mode}
      label={`Pick ${costText(slot.card).toLowerCase()}`}
      onKeyDown={(e) => moveFocus(e, onClose)}
    >
      <div className={styles.invHead}>
        <span>
          <b>{costText(slot.card).replace(/^×\d+ /, '')}</b> ×{slot.card.need}
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
          const line = tileLine(t, slot.card.need, byId);
          return (
            <button
              key={`${t.hiker ?? 'none'}:${t.thing.kind}:${t.thing.id}`}
              type="button"
              className={styles.tile}
              data-dim={!t.ok || undefined}
              data-sel={sel || undefined}
              disabled={mode === 'pick' && !t.ok}
              tabIndex={mode === 'pick' ? 0 : -1}
              style={{ '--c': h?.color ?? '#555' } as CSSProperties}
              aria-label={`${line.main} ${line.more}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
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
        {words ? (
          <>
            {words.main} <i>{words.more}</i>
          </>
        ) : (
          <i>{mode === 'pick' ? 'HOVER A TILE' : ''}</i>
        )}
      </div>
    </Panel>
  );
}

/** Step 2: WHAT SHOULD IT DO? One button per effect; a used-up one is faded. */
export function WhatPanel({
  effects,
  open,
  from,
  at,
  onPick,
  onClose,
}: {
  effects: readonly Option[];
  /** Whether each effect still has a use left. */
  open(e: Option): boolean;
  /** "MEAT FROM FINN". */
  from: string;
  at: PanelAt;
  onPick(e: Option): void;
  onClose(): void;
}) {
  return (
    <Panel at={at} mode="what" label="What should it do?" onKeyDown={(e) => moveFocus(e, onClose)}>
      <div className={styles.invHead}>
        <span>
          <b>WHAT SHOULD IT DO?</b>
        </span>
        <span>{from}</span>
      </div>
      <div className={styles.choices}>
        {effects.map((e) => {
          const ok = open(e);
          return (
            <button
              key={e.id}
              type="button"
              className={styles.choice}
              disabled={!ok}
              onClick={() => onPick(e)}
            >
              {e.label}
              <small>
                {e.note}
                {ok ? '' : ' · used up'}
              </small>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/** Step 3: WHO GETS +1 HEART? One button per hiker; one who has the most already is faded. */
export function WhoPanel({
  effect,
  hikers,
  open,
  at,
  onPick,
  onClose,
}: {
  effect: Option;
  hikers: readonly MinigameHiker[];
  open(hikerId: string): boolean;
  at: PanelAt;
  onPick(hikerId: string): void;
  onClose(): void;
}) {
  return (
    <Panel
      at={at}
      mode="who"
      label={`Who gets ${effect.label}?`}
      onKeyDown={(e) => moveFocus(e, onClose)}
    >
      <div className={styles.invHead}>
        <span>
          <b>WHO GETS {effect.label}?</b>
        </span>
        <span>PICK A HIKER</span>
      </div>
      <div className={styles.whoGrid}>
        {hikers.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`${styles.choice} ${styles.whoChoice}`}
            disabled={!open(h.id)}
            onClick={() => onPick(h.id)}
          >
            <HikerPortrait
              hikerId={h.id}
              className={styles.whoPfp}
              style={{ borderColor: h.color } as CSSProperties}
            />
            {h.name.toUpperCase()}
          </button>
        ))}
      </div>
    </Panel>
  );
}

/**
 * A bar (section 3): a solid tan track with a deep brown fill to the value's
 * share of the most; Prepare's drop hatched green, its gain solid green.
 */
export function BarRow({ bar }: { bar: Bar }) {
  const fmt =
    bar.display ??
    ((v: number) =>
      bar.kind === 'level' ? `${v}/${bar.max}` : bar.kind === 'time' ? clockText(v) : `${v}`);
  const share = (v: number) => (Math.max(0, Math.min(bar.max, v)) / bar.max) * 100;
  const lo = share(Math.min(bar.value, bar.base));
  const hi = share(Math.max(bar.value, bar.base));
  const diff = Math.round((bar.value - bar.base) * 100) / 100;
  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{bar.label}</span>
      <span
        className={styles.track}
        role="img"
        aria-label={`${bar.label}: ${fmt(bar.value)}`}
        style={{ '--slide': `${PR.barSlideSec}s` } as CSSProperties}
      >
        <span className={styles.fill} style={{ width: `${lo}%` }} />
        <span
          className={styles.cut}
          style={{ left: `${lo}%`, width: bar.value < bar.base ? `${hi - lo}%` : '0%' }}
        />
        <span
          className={styles.add}
          style={{ left: `${lo}%`, width: bar.value > bar.base ? `${hi - lo}%` : '0%' }}
        />
      </span>
      <span className={styles.barValue}>
        {fmt(bar.value)}
        {diff !== 0 && (
          <span className={styles.delta}>
            {' '}
            {diff > 0 ? '+' : '−'}
            {Math.abs(diff)}
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
