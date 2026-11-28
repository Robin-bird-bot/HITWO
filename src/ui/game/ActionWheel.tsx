/**
 * The action wheel (35-ui-overhaul.md, section 4): round paper buttons that
 * pop out in an arc over the selected hiker's token, one after another with
 * a small overshoot. Each has its cost on a badge. Pointing at one (or a
 * long-press on touch) shows its name, cost and what it does, or why it
 * can't be done now, in the paper bubble above; blocked ones are hatched and
 * faded, and pressing one shakes it and says why.
 *
 * Keys 1 to 6 press the buttons (Claude's idea); Esc closes it, as do a
 * click on the map and picking an action. Near the top of the screen it
 * opens below the token instead (Claude's idea). It follows the token as the
 * map pans or zooms: the screen places it from the camera every render.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { sfx } from '../../audio/engine';
import { BALANCE } from '../../config/balance';
import { useReducedMotion } from '../app/useReducedMotion';
import { Icon } from '../icons/Icon';
import { actionForKey, wheelOpensBelow, type WheelAction } from './wheel';
import styles from './ActionWheel.module.css';

const W = BALANCE.ui.overhaul.wheel;

interface ActionWheelProps {
  actions: readonly WheelAction[];
  /** The token's middle, in stage pixels. */
  at: { x: number; y: number };
  /** "WYATT’S TURN". */
  title: string;
  onPick(action: WheelAction): void;
  onClose(): void;
}

export function ActionWheel({ actions, at, title, onPick, onClose }: ActionWheelProps) {
  const reduced = useReducedMotion();
  const [out, setOut] = useState(reduced);
  const [hint, setHint] = useState<WheelAction | null>(null);
  const [shake, setShake] = useState<{ id: string; n: number } | null>(null);
  const picked = useRef(false);
  const below = wheelOpensBelow(at.y);

  // Pops open with its sound; closes with one, unless an action was picked.
  useEffect(() => {
    sfx('ui.wheelOpen');
    const frame = requestAnimationFrame(() => setOut(true));
    const opened = performance.now();
    return () => {
      cancelAnimationFrame(frame);
      if (!picked.current && performance.now() - opened > 100) sfx('ui.wheelClose');
    };
  }, []);

  const press = (a: WheelAction) => {
    if (!a.ready) {
      sfx('ui.error');
      setHint(a);
      setShake((s) => ({ id: a.id, n: (s?.n ?? 0) + 1 }));
      return;
    }
    picked.current = true;
    sfx('ui.confirm');
    onPick(a);
  };

  // Keys 1 to 6 press the buttons; Esc closes.
  const latest = useRef({ actions, press, onClose });
  useEffect(() => {
    latest.current = { actions, press, onClose };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        latest.current.onClose();
        return;
      }
      const a = actionForKey(latest.current.actions, e.key);
      if (!a) return;
      e.preventDefault();
      latest.current.press(a);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // A long-press shows the hint on touch, and that press doesn't act.
  const holding = useRef<{ timer: number; shown: boolean } | null>(null);
  const holdStart = (a: WheelAction, pointerType: string) => {
    if (pointerType === 'mouse') return;
    const h = { timer: 0, shown: false };
    h.timer = window.setTimeout(() => {
      h.shown = true;
      setHint(a);
    }, BALANCE.ui.longPressMs);
    holding.current = h;
  };
  const holdEnd = () => {
    if (holding.current) window.clearTimeout(holding.current.timer);
  };

  const n = actions.length;
  return (
    <div
      className={styles.wheel}
      style={{ left: at.x, top: at.y } as CSSProperties}
      data-below={below || undefined}
    >
      <Bubble below={below}>
        {hint ? (
          <>
            <b>
              {hint.label.toUpperCase()}
              {hint.ready && hint.cost ? ` · ${costWords(hint.cost)}` : ''}
            </b>
            <span>{hint.text}</span>
          </>
        ) : (
          <>
            <b>{title}</b>
            <span>Pick an action, or press 1 to {n}.</span>
          </>
        )}
      </Bubble>
      {actions.map((a, i) => {
        // A half circle above the token (left to right), or below it.
        const angle = n > 1 ? Math.PI + (i * Math.PI) / (n - 1) : (3 * Math.PI) / 2;
        const dx = Math.cos(angle) * W.radius;
        const dy = Math.sin(angle) * W.radius * (below ? -1 : 1) - (below ? -W.lift : W.lift);
        return (
          <button
            key={a.id}
            type="button"
            className={styles.button}
            data-ready={a.ready || undefined}
            data-shake={shake?.id === a.id ? shake.n % 2 : undefined}
            data-sound="none"
            aria-label={`${i + 1}. ${a.label}: ${a.text}`}
            aria-disabled={!a.ready || undefined}
            style={{
              transform: out
                ? `translate(${dx}px, ${dy}px) scale(1)`
                : 'translate(0, 0) scale(0.2)',
              opacity: out ? 1 : 0,
              transitionDelay: reduced ? '0ms' : `${i * W.staggerMs}ms`,
            }}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHint(a)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHint(null)}
            onFocus={() => setHint(a)}
            onPointerDown={(e) => holdStart(a, e.pointerType)}
            onPointerUp={holdEnd}
            onPointerCancel={holdEnd}
            onClick={(e) => {
              e.stopPropagation();
              if (holding.current?.shown) {
                holding.current = null;
                return;
              }
              press(a);
            }}
          >
            <Icon name={a.icon} size={24} strokeWidth={2.2} />
            {a.ready && a.cost && (
              <span className={styles.cost}>
                {a.cost.text}
                {a.cost.icon && <Icon name={a.cost.icon} size={10} strokeWidth={3} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const costWords = (c: NonNullable<WheelAction['cost']>) =>
  c.icon ? `${c.text} ${c.icon === 'zap' ? 'Energy' : 'Appetite'}` : c.text;

/** The paper bubble over (or under) the wheel. */
function Bubble({ below, children }: { below: boolean; children: ReactNode }) {
  return (
    <div className={styles.bubble} data-below={below || undefined} role="status">
      {children}
    </div>
  );
}

/**
 * A paper card beside the token for what an action needs next (Sleep's
 * check, the abilities), so it sits where the player is looking.
 */
export function WheelCard({
  at,
  children,
  label,
}: {
  at: { x: number; y: number };
  children: ReactNode;
  label: string;
}) {
  // Beside the token, on whichever side has room.
  const left = at.x > 1000;
  return (
    <div
      className={styles.card}
      data-left={left || undefined}
      style={{ left: at.x, top: Math.max(230, Math.min(at.y, 770)) }}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}
