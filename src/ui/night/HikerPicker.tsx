/**
 * Who learns something new? (35-ui-overhaul.md, section 7; the prototype's
 * `openPicker`.) Every party hiker with skill trails is dealt in as a big
 * portrait card with their trails' progress and how many steps they can
 * learn now. Picking one opens Skill Trails on them. From the night camp
 * recap's SPEND POINTS, or the Party LV pill.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/engine';
import { useOpenSound } from '../../audio/uiSounds';
import { BALANCE } from '../../config/balance';
import { hikerColor } from '../../content/characters';
import { hasLearned, partyOf, treesOf, type GameState } from '../../engine';
import { useReducedMotion } from '../app/useReducedMotion';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { pointsWords } from '../trails/partyProgress';
import { stepsToLearn } from '../trails/trailsView';
import styles from './HikerPicker.module.css';

const GAP_MS = BALANCE.ui.overhaul.camp.dealGapMs;

export function HikerPicker({
  state,
  onPick,
  onClose,
}: {
  state: GameState;
  onPick(hikerId: string): void;
  onClose(): void;
}) {
  useOpenSound('ui.windowOpen');
  const reduced = useReducedMotion();
  const hikers = state.hikers.filter((h) => h.status !== 'abandoned' && !!treesOf(h));
  const points = partyOf(state).points;
  // By day the count says what they could learn tonight.
  const anyTime = state.phase !== 'night' && !state.station;

  // The cards are dealt in, one after another, once when the picker opens.
  const [dealt] = useState(() => (reduced ? Math.min(1, hikers.length) : hikers.length));
  useEffect(() => {
    const timers = Array.from({ length: dealt }, (_, i) =>
      setTimeout(() => sfx('card.deal'), i * GAP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [dealt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.picker} role="dialog" aria-label="Who learns something new?">
      <h2 className={styles.title}>WHO LEARNS SOMETHING NEW?</h2>
      <p className={styles.sub}>
        {points > 0
          ? `${pointsWords(points)}. Pick a hiker to open their skill trails.`
          : 'Pick a hiker to see their skill trails.'}
      </p>
      <div className={styles.cards}>
        {hikers.map((h, i) => {
          const can = stepsToLearn(state, h, anyTime);
          return (
            <button
              key={h.id}
              type="button"
              className={styles.card}
              data-sound="none"
              style={{ '--c': hikerColor(h), animationDelay: `${i * GAP_MS}ms` } as CSSProperties}
              aria-label={`${h.name}: ${can ? `${can} to learn` : 'nothing new yet'}`}
              onMouseEnter={() => sfx('card.hover', { volume: 0.5 })}
              onClick={() => {
                sfx('card.take');
                onPick(h.id);
              }}
            >
              <span className={styles.portrait}>
                <HikerPortrait hikerId={h.id} className={styles.face} />
              </span>
              <span className={styles.banner}>{h.name}</span>
              <span className={styles.trees}>
                {treesOf(h)!.trees.map((t) => (
                  <span key={t.id} className={styles.tree}>
                    <span>{t.name}</span>
                    <span className={styles.pips}>
                      {t.steps.map((step) => (
                        <i key={step.id} data-on={hasLearned(h, step.id) || undefined} />
                      ))}
                    </span>
                  </span>
                ))}
              </span>
              <span className={styles.can} data-none={!can || undefined}>
                {can ? `${can} STEP${can === 1 ? '' : 'S'} TO LEARN` : 'NOTHING NEW YET'}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.done} onClick={onClose}>
        DONE
      </button>
    </div>
  );
}
