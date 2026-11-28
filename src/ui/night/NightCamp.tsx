/**
 * The night camp recap (35-ui-overhaul.md, section 7; the prototype's
 * `nightCamp`): when the night ends, the map dims to a night tint with a
 * campfire glow on the party's tile and fireflies, and a paper tag lists
 * TONIGHT AT CAMP: the XP since the last recap, one line at a time, then the
 * total. The party bar fills, and each level reached stamps PARTY LEVEL N!
 * with rays and confetti. Then SPEND POINTS (when there are any) and LATER,
 * or CONTINUE. A click or a key skips to the end first.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/engine';
import { BALANCE } from '../../config/balance';
import { partyOf, treesOf, xpForLevel, type GameState } from '../../engine';
import { useReducedMotion } from '../app/useReducedMotion';
import { Icon } from '../icons/Icon';
import { BIOME_NAMES } from '../title/describeSave';
import { levelFill } from '../trails/partyProgress';
import { barTicks, campTimeline, recapPlan, type CampStep } from './campRecap';
import styles from './NightCamp.module.css';

const C = BALANCE.ui.overhaul.camp;
const ROMAN = ['', 'I', 'II', 'III'];
const CONFETTI = ['#E9B44C', '#9466C4', '#fff3c4', '#E2683C', '#4A8FD4'];

/** A steady scatter (the same each time), 0–1. */
const scatter = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function NightCamp({
  state,
  glow,
  onSeen,
  onSpend,
  onDone,
}: {
  state: GameState;
  /** Where the campfire glows, in stage pixels: the party's tile. */
  glow: { x: number; y: number } | null;
  /** The recap played to its end: the party bar as it is now is the one to show. */
  onSeen(): void;
  onSpend(): void;
  onDone(): void;
}) {
  const reduced = useReducedMotion();
  // What tonight shows is fixed when it opens.
  const [plan] = useState(() => recapPlan(state));
  const ticks = useMemo(() => barTicks(plan), [plan]);
  const steps = useMemo(() => campTimeline(plan, ticks, { reduced }), [plan, ticks, reduced]);
  const [upTo, setUpTo] = useState(-1);
  const upToRef = useRef(-1);
  const last = steps.length - 1;

  useEffect(() => {
    const play = (step: CampStep) => {
      if (!step.sound) return;
      const { id, rate, volume } = step.sound;
      sfx(id, { ...(rate ? { rate } : {}), ...(volume ? { volume } : {}) });
    };
    const timers = steps.map((step, i) =>
      setTimeout(() => {
        if (i <= upToRef.current) return;
        upToRef.current = i;
        play(step);
        setUpTo(i);
      }, step.at),
    );
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  // A click or a key skips to the end (a level-up it passes still plays its jingle).
  const skip = () => {
    if (upToRef.current >= last) return false;
    const passed = steps.slice(upToRef.current + 1).some((s) => s.kind === 'levelUp');
    upToRef.current = last;
    setUpTo(last);
    if (passed) sfx('levelUp');
    return true;
  };
  const skipRef = useRef(skip);
  useEffect(() => {
    skipRef.current = skip;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (skipRef.current()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Where the recap is now.
  const applied = steps.slice(0, upTo + 1);
  const lines = applied.filter((s) => s.kind === 'line').length;
  const totalShown = applied.some((s) => s.kind === 'total');
  const tickAt = applied.findLast((s) => s.kind === 'tick');
  const tick = tickAt?.kind === 'tick' ? ticks[tickAt.index] : undefined;
  const levelAt = applied.findLast((s) => s.kind === 'levelUp');
  const leveled = levelAt?.kind === 'levelUp' ? levelAt.level : undefined;
  const chips = applied.some((s) => s.kind === 'chips');
  const done = upTo >= last;

  // Each level-up shakes the tag.
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (leveled === undefined || reduced) return;
    cardRef.current?.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: 'translate(-5px, 3px)' },
        { transform: 'translate(4px, -2px)' },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 280 },
    );
  }, [leveled, reduced]);

  const seen = useRef(false);
  useEffect(() => {
    if (!done || seen.current) return;
    seen.current = true;
    onSeen();
  }, [done, onSeen]);

  const level = tick?.level ?? leveled ?? plan.from.level;
  const xp = tick?.xp ?? plan.from.xp;
  // Before a level-up's hold ends, the bar stays full.
  const full = !!leveled && (!tick || tick.level < leveled);
  const fill = full ? 1 : levelFill(xp, level);
  const shownLevel = leveled ?? level;
  const into = xp - xpForLevel(level);
  const size = xpForLevel(level + 1) - xpForLevel(level);

  const points = partyOf(state).points;
  const canSpend = points > 0 && state.hikers.some((h) => h.status !== 'abandoned' && !!treesOf(h));
  const biome = BIOME_NAMES[state.section.biome].toUpperCase();

  const flies = useMemo(
    () =>
      Array.from({ length: C.fireflies }, (_, i) => ({
        left: 330 + scatter(i, 1) * 950,
        top: 130 + scatter(i, 2) * 780,
        fx: (scatter(i, 3) - 0.5) * 120,
        fy: (scatter(i, 4) - 0.5) * 100,
        delay: -scatter(i, 5) * 6,
        duration: 4 + scatter(i, 6) * 4,
      })),
    [],
  );

  return (
    <div
      className={styles.camp}
      style={
        {
          '--cx': `${glow?.x ?? 800}px`,
          '--cy': `${glow?.y ?? 500}px`,
        } as CSSProperties
      }
      onPointerDown={() => skip()}
      data-sound="none"
    >
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.flies} aria-hidden="true">
        {flies.map((f, i) => (
          <i
            key={i}
            style={
              {
                left: f.left,
                top: f.top,
                '--fx': `${f.fx}px`,
                '--fy': `${f.fy}px`,
                animationDelay: `${f.delay}s`,
                animationDuration: `${f.duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <section ref={cardRef} className={styles.card} role="dialog" aria-label="Tonight at camp">
        {leveled !== undefined && <div className={styles.rays} aria-hidden="true" />}
        {leveled !== undefined && (
          <div key={leveled} className={styles.stamp} role="status">
            PARTY LEVEL {leveled}!
          </div>
        )}
        <header className={styles.top}>
          <span className={styles.label}>TONIGHT AT CAMP</span>
          <span className={styles.label}>
            DAY {state.day} · {biome}
          </span>
        </header>

        <div className={styles.rows}>
          {plan.lines.slice(0, lines).map((l) => (
            <div key={l.key} className={styles.row}>
              <Icon name={l.icon} size={17} />
              <span>{l.text}</span>
              <b data-lost={l.xp < 0 || undefined}>
                {l.xp < 0 ? '−' : '+'}
                {Math.abs(l.xp)}
              </b>
            </div>
          ))}
          {totalShown && !plan.lines.length && <p className={styles.quiet}>No XP today.</p>}
          {totalShown && (
            <div className={`${styles.row} ${styles.total}`}>
              <span />
              <span className={styles.label}>TODAY</span>
              <b>
                {plan.total < 0 ? '−' : '+'}
                {Math.abs(plan.total)} XP
              </b>
            </div>
          )}
        </div>

        <div className={styles.xp}>
          <div className={styles.level} data-pop={leveled ?? undefined} key={shownLevel}>
            <span>PARTY LV</span>
            <b>{shownLevel}</b>
            {leveled !== undefined && !reduced && <Confetti />}
          </div>
          <div className={styles.bar} data-flash={full || undefined}>
            <i style={{ width: `${fill * 100}%` }} />
            <span>
              {full ? size : Math.max(0, into)} / {size} XP
            </span>
          </div>
        </div>

        <div className={styles.chips}>
          {chips && plan.points > 0 && (
            <span className={styles.chip} data-tone="pos">
              <Icon name="star" size={14} />+{plan.points} point{plan.points === 1 ? '' : 's'} to
              spend
            </span>
          )}
          {chips &&
            plan.opened.map((tier) => (
              <span key={tier} className={styles.chip}>
                <Icon name="sparkles" size={14} />
                Tier {ROMAN[tier]} steps are open
              </span>
            ))}
        </div>

        <div className={styles.buttons} data-on={done || undefined}>
          {done && (
            <>
              <button type="button" className={styles.btn} data-sound="cancel" onClick={onDone}>
                {canSpend ? 'LATER' : 'CONTINUE'}
              </button>
              {canSpend && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.go}`}
                  data-sound="confirm"
                  autoFocus
                  onClick={onSpend}
                >
                  SPEND POINTS
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** A burst of confetti from the level badge. */
function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const angle = scatter(i, 7) * Math.PI * 2;
        const far = 90 + scatter(i, 8) * 160;
        return {
          dx: Math.cos(angle) * far,
          dy: Math.sin(angle) * far - 60,
          spin: (scatter(i, 9) - 0.5) * 720,
          color: CONFETTI[i % CONFETTI.length]!,
        };
      }),
    [],
  );
  return (
    <span className={styles.confetti} aria-hidden="true">
      {bits.map((b, i) => (
        <i
          key={i}
          style={
            {
              background: b.color,
              '--dx': `${b.dx}px`,
              '--dy': `${b.dy}px`,
              '--spin': `${b.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
