/**
 * The edge test (Phase 10.6, part B; dev only): opens each window with the
 * most cards it can have, then checks that no card or tooltip goes outside
 * its window or the game screen. The stage is a fixed 1600 × 1000 scaled to
 * fit, so the same check holds at desktop and phone sizes.
 */
import { useState } from 'react';
import { CHALLENGES } from '../../content/challenges';
import { BALANCE } from '../../config/balance';
import type { Action, GameState } from '../../engine';
import { edgeCheck } from './edgeCheck';
import styles from './DebugPanel.module.css';

/** The most scavenge cards: 3, +1 each for a Dog, Dog Whisperer, Forager, Thumb and a Yurt; 1 spare. */
const MOST_SCAVENGE = 9;
/** The most craft cards: 3, +1 Handy, +2 Proficient. */
const MOST_CRAFT = BALANCE.items.craft.choices + 3;

export function EdgeTest({ state, onApply }: { state: GameState; onApply(action: Action): void }) {
  const [result, setResult] = useState<ReturnType<typeof edgeCheck> | null>(null);
  const hiker = state.hikers.find((h) => h.status === 'active') ?? state.hikers[0];
  if (!hiker) return null;
  const card = CHALLENGES.find((c) => c.tier === 1 && c.nodes === 'any') ?? CHALLENGES[0];
  const steps: { label: string; action: Action }[] = [
    {
      label: `Scavenge · ${MOST_SCAVENGE} cards`,
      action: {
        type: 'debug',
        op: { kind: 'edgeScavenge', hikerId: hiker.id, count: MOST_SCAVENGE },
      },
    },
    {
      label: `Craft · ${MOST_CRAFT} cards`,
      action: { type: 'debug', op: { kind: 'edgeCraft', hikerId: hiker.id, count: MOST_CRAFT } },
    },
    ...(card
      ? [
          {
            label: 'Challenge',
            action: {
              type: 'debug',
              op: { kind: 'openChallenge', cardId: card.id, tileId: hiker.tileId },
            } as Action,
          },
        ]
      : []),
    {
      label: 'Level-up (Tier 3)',
      action: { type: 'debug', op: { kind: 'levelUpNow', hikerId: hiker.id, tier: 3 } },
    },
  ];
  return (
    <section className={styles.group}>
      <h3 className={styles.heading}>Edge test</h3>
      <div className={styles.row}>
        {steps.map((s) => (
          <button
            key={s.label}
            type="button"
            className={styles.button}
            onClick={() => {
              setResult(null);
              onApply(s.action);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          title="Checks every card and tooltip on screen now (hover a badge first to test its tip)"
          onClick={() => setResult(edgeCheck())}
        >
          Check what’s open
        </button>
        {result && (
          <span className={styles.note}>
            {result.problems.length
              ? `${result.problems.length} cut off: ${result.problems.map((p) => `${p.where}: ${p.what}`).join('; ')}`
              : `All ${result.checked} cards and tooltips fit.`}
          </span>
        )}
      </div>
    </section>
  );
}
