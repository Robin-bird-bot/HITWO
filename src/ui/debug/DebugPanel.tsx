/**
 * The dev-only debug panel (CLAUDE.md "How to work"), toggled with the
 * backtick key. Always available with the dev server; on the live site only
 * when the address has ?debug.
 *
 * Tools: a new game from a seed, phases, revealing the map, stats, resources,
 * traits, the next scavenge, Abundance and conditions.
 */
import { useEffect, useState } from 'react';
import { CARDS, CONDITIONS, SCAVENGE_CARDS, SCAVENGE_CARD_ORDER, TRAITS } from '../../content';
import { RESOURCES } from '../../content/resources';
import { BALANCE } from '../../config/balance';
import {
  NODE_TYPES,
  PHASES,
  adjacentTileIds,
  STAT_NAMES,
  type Action,
  type CardDef,
  type GameState,
  type Hiker,
  type NodeType,
  type ScavengeCardType,
} from '../../engine';
import { gameStore } from '../app/gameStore';
import styles from './DebugPanel.module.css';

const PHASE_NAMES = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' } as const;

interface DebugPanelProps {
  state: GameState;
  onQuit(): void;
  /** Starts a new game with this seed (the same seed always gives the same trail). */
  onNewGame(seed: number): void;
}

export function DebugPanel({ state, onQuit, onNewGame }: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [seed, setSeed] = useState(String(state.seed));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Backquote' && e.key !== '`') return;
      const target = e.target as HTMLElement | null;
      if (target instanceof Element && target.closest('input, textarea, select')) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  const run = (action: Action) => {
    const result = gameStore.dispatch(action);
    setMessage(result.ok ? '' : result.reason);
  };

  return (
    <aside className={styles.panel} aria-label="Debug panel">
      <header className={styles.header}>
        <span className={styles.title}>DEBUG</span>
        <span className={styles.meta}>
          Seed {state.seed} · Day {state.day} · {PHASE_NAMES[state.phase]}
        </span>
        <button type="button" className={styles.close} onClick={() => setOpen(false)}>
          Close
        </button>
      </header>

      <section className={styles.group}>
        <h3 className={styles.heading}>Game</h3>
        <div className={styles.row}>
          <label className={styles.note}>
            Seed{' '}
            <input
              className={styles.seed}
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              const n = Number.parseInt(seed, 10);
              if (Number.isFinite(n)) onNewGame(n);
              else setMessage('Type a whole number for the seed.');
            }}
          >
            New game with this seed
          </button>
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Phase</h3>
        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={() => run({ type: 'endPhase' })}>
            Next phase (normal rules)
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.note}>Skip to, without drains:</span>
          {PHASES.map((phase) => (
            <button
              key={phase}
              type="button"
              className={styles.button}
              aria-pressed={state.phase === phase}
              onClick={() => run({ type: 'debug', op: { kind: 'skipToPhase', phase } })}
            >
              {PHASE_NAMES[phase]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Map</h3>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => run({ type: 'debug', op: { kind: 'revealMap' } })}
          >
            Reveal map
          </button>
          <button type="button" className={styles.button} onClick={onQuit}>
            Back to title
          </button>
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Stats</h3>
        <StatsEditor hikers={state.hikers} onApply={run} />
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Inventory</h3>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              for (const h of state.hikers) {
                const resources: Record<string, number> = {};
                for (let i = 0; i < 5; i++) {
                  const r = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
                  if (r) resources[r.id] = (resources[r.id] ?? 0) + 1;
                }
                run({ type: 'debug', op: { kind: 'giveResources', hikerId: h.id, resources } });
              }
            }}
          >
            Give everyone 5 random resources
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              // One of every resource, split across the party, to check the art.
              const per = Math.ceil(RESOURCES.length / state.hikers.length);
              state.hikers.forEach((h, i) => {
                const resources = Object.fromEntries(
                  RESOURCES.slice(i * per, (i + 1) * per).map((r) => [r.id, 1]),
                );
                run({ type: 'debug', op: { kind: 'giveResources', hikerId: h.id, resources } });
              });
            }}
          >
            Give one of every resource
          </button>
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Traits</h3>
        <TraitEditor hikers={state.hikers} onApply={run} />
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Next scavenge</h3>
        <NextDeal state={state} onApply={run} />
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Abundance</h3>
        <AbundanceEditor
          key={JSON.stringify(state.abundance)}
          abundance={state.abundance}
          onApply={run}
        />
        <div className={styles.row}>
          <a className={styles.button} href="#debug-cards">
            Card gallery and odds
          </a>
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Conditions</h3>
        <ConditionEditor hikers={state.hikers} onApply={run} />
      </section>

      <section className={styles.group}>
        <h3 className={styles.heading}>Challenges</h3>
        <ChallengeTools state={state} onApply={run} />
        <div className={styles.row}>
          <a className={styles.button} href="#debug-challenges">
            Every challenge and Trial
          </a>
        </div>
      </section>

      {message && <p className={styles.message}>{message}</p>}
      <p className={styles.hint}>Press ` (backtick) to hide.</p>
    </aside>
  );
}

const STAT_LABEL = { energy: 'Energy', appetite: 'Appetite', morale: 'Morale' } as const;
const NODE_LABEL = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
} as const;

/** Put any trait (or nothing) in any of a hiker's slots, to try the traits out. */
function TraitEditor({ hikers, onApply }: { hikers: Hiker[]; onApply(action: Action): void }) {
  const [hikerId, setHikerId] = useState(hikers[0]?.id ?? '');
  const [slot, setSlot] = useState(0);
  const [traitId, setTraitId] = useState('forager');
  const hiker = hikers.find((h) => h.id === hikerId);
  const traits = Object.values(TRAITS).sort((a, b) => a.name.localeCompare(b.name));
  if (!hiker) return null;
  return (
    <div className={styles.row}>
      <select
        className={styles.button}
        value={hikerId}
        onChange={(e) => {
          setHikerId(e.target.value);
          setSlot(0);
        }}
        aria-label="Hiker"
      >
        {hikers.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <select
        className={styles.button}
        value={slot}
        onChange={(e) => setSlot(Number(e.target.value))}
        aria-label="Slot"
      >
        {hiker.slots.map((s, i) => (
          <option key={i} value={i}>
            Slot {i + 1} ({s.type}): {s.traitId ? (TRAITS[s.traitId]?.name ?? s.traitId) : 'empty'}
          </option>
        ))}
      </select>
      <select
        className={styles.button}
        value={traitId}
        onChange={(e) => setTraitId(e.target.value)}
        aria-label="Trait"
      >
        <option value="">(empty)</option>
        {traits.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.button}
        onClick={() =>
          onApply({
            type: 'debug',
            op: { kind: 'setTrait', hikerId: hiker.id, slot, traitId: traitId || null },
          })
        }
      >
        Set trait
      </button>
    </div>
  );
}

const ORDER = { challenge: 0, trial: 1, opportunity: 2 } as const;

/**
 * Open any challenge on a hiker's tile (for the hikers there), show the rolled
 * numbers in the pop-up, or switch challenges off to test other things.
 */
function ChallengeTools({ state, onApply }: { state: GameState; onApply(action: Action): void }) {
  const [hikerId, setHikerId] = useState(state.hikers[0]?.id ?? '');
  const [cardId, setCardId] = useState('flies');
  const hiker = state.hikers.find((h) => h.id === hikerId);
  // A connected tile nobody has landed on, whose card isn't known yet.
  const nextUnknown = hiker
    ? adjacentTileIds(state.section, hiker.tileId).find((id) => {
        const t = state.section.tiles[id];
        return t && t.kind === 'normal' && !t.visited && !t.revealedCard;
      })
    : undefined;
  const cards = Object.values(CARDS)
    .filter((c) => c.kind !== 'trial' || c.goal.kind !== 'off')
    .sort(
      (a, b) => ORDER[a.kind] - ORDER[b.kind] || a.tier - b.tier || a.name.localeCompare(b.name),
    );
  const label = (c: CardDef) =>
    c.kind === 'opportunity'
      ? `Opportunity · ${c.name}`
      : c.kind === 'trial'
        ? `Trial · ${c.name}`
        : `${tier[c.tier]} · ${c.name} (${c.risk ? 'risk' : c.scope === 'party' ? 'party' : 'each'})`;
  const openSpace = (space: 'choice' | 'challenge' | 'opportunity') =>
    hiker && onApply({ type: 'debug', op: { kind: 'openSpace', tileId: hiker.tileId, space } });
  const tier = { 1: 'I', 2: 'II', 3: 'III' } as const;
  return (
    <>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
          aria-label="Challenge"
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={hikerId}
          onChange={(e) => setHikerId(e.target.value)}
          aria-label="On this hiker’s tile"
        >
          {state.hikers.map((h) => (
            <option key={h.id} value={h.id}>
              On {h.name}’s tile
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.button}
          disabled={!hiker}
          onClick={() =>
            hiker &&
            onApply({
              type: 'debug',
              op: { kind: 'openChallenge', cardId, tileId: hiker.tileId },
            })
          }
        >
          Trigger a challenge here
        </button>
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          disabled={!nextUnknown}
          onClick={() =>
            nextUnknown &&
            onApply({ type: 'debug', op: { kind: 'revealCard', tileId: nextUnknown } })
          }
        >
          Reveal a card next to them
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.note}>Or a space here:</span>
        <button type="button" className={styles.button} onClick={() => openSpace('choice')}>
          Choice
        </button>
        <button type="button" className={styles.button} onClick={() => openSpace('challenge')}>
          Challenge
        </button>
        <button type="button" className={styles.button} onClick={() => openSpace('opportunity')}>
          Opportunity
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.note}>Section tier:</span>
        {([1, 2, 3] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={styles.button}
            aria-pressed={state.section.tier === t}
            onClick={() => onApply({ type: 'debug', op: { kind: 'setTier', tier: t } })}
          >
            {tier[t]}
          </button>
        ))}
        <button
          type="button"
          className={styles.button}
          aria-pressed={!!state.snowy}
          onClick={() => onApply({ type: 'debug', op: { kind: 'setSnowy', on: !state.snowy } })}
        >
          Snowy section
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.note}>Weather:</span>
        {(['clear', 'sunny', 'stormy'] as const).map((w) => (
          <button
            key={w}
            type="button"
            className={styles.button}
            aria-pressed={(state.weather ?? 'clear') === w}
            onClick={() => onApply({ type: 'debug', op: { kind: 'setWeather', weather: w } })}
          >
            {w.charAt(0).toUpperCase() + w.slice(1)}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={!!state.debugRolls}
          onClick={() =>
            onApply({ type: 'debug', op: { kind: 'showRolls', on: !state.debugRolls } })
          }
        >
          Show rolls
        </button>
        <button
          type="button"
          className={styles.button}
          aria-pressed={!state.noChallenges}
          onClick={() =>
            onApply({ type: 'debug', op: { kind: 'setChallenges', on: !!state.noChallenges } })
          }
        >
          Challenges {state.noChallenges ? 'off' : 'on'}
        </button>
      </div>
    </>
  );
}

/** Give a hiker any condition for a while, or clear them all. */
function ConditionEditor({ hikers, onApply }: { hikers: Hiker[]; onApply(action: Action): void }) {
  const [hikerId, setHikerId] = useState(hikers[0]?.id ?? '');
  const [conditionId, setConditionId] = useState('frozen');
  const [remaining, setRemaining] = useState(2);
  const [unit, setUnit] = useState<'phases' | 'days' | 'nights'>('phases');
  const conditions = Object.values(CONDITIONS).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={hikerId}
          onChange={(e) => setHikerId(e.target.value)}
          aria-label="Hiker"
        >
          {hikers.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          className={styles.button}
          value={conditionId}
          onChange={(e) => setConditionId(e.target.value)}
          aria-label="Condition"
        >
          {conditions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.kind === 'positive' ? '+' : '−'})
            </option>
          ))}
        </select>
      </div>
      <div className={styles.row}>
        <input
          className={styles.number}
          type="number"
          min={1}
          max={9}
          value={remaining}
          onChange={(e) => setRemaining(Math.max(1, Number(e.target.value) || 1))}
          aria-label="How long"
        />
        <select
          className={styles.button}
          value={unit}
          onChange={(e) => setUnit(e.target.value as typeof unit)}
          aria-label="Counted in"
        >
          <option value="phases">phases</option>
          <option value="days">days</option>
          <option value="nights">nights</option>
        </select>
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            onApply({
              type: 'debug',
              op: { kind: 'addCondition', hikerId, conditionId, remaining, unit },
            })
          }
        >
          Add
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => onApply({ type: 'debug', op: { kind: 'clearConditions', hikerId } })}
        >
          Clear all
        </button>
      </div>
    </>
  );
}

/** Make the next scavenge deal chosen card types first, to see rare cards on demand. */
function NextDeal({ state, onApply }: { state: GameState; onApply(action: Action): void }) {
  const [type, setType] = useState<ScavengeCardType>('choice');
  const queued = state.debugDeal ?? [];
  return (
    <>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={type}
          onChange={(e) => setType(e.target.value as ScavengeCardType)}
          aria-label="Card type"
        >
          {SCAVENGE_CARD_ORDER.map((t) => (
            <option key={t} value={t}>
              {SCAVENGE_CARDS[t].name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            onApply({ type: 'debug', op: { kind: 'nextDeal', types: [...queued, type] } })
          }
        >
          Add to next deal
        </button>
        {queued.length > 0 && (
          <button
            type="button"
            className={styles.button}
            onClick={() => onApply({ type: 'debug', op: { kind: 'nextDeal', types: [] } })}
          >
            Clear
          </button>
        )}
      </div>
      {queued.length > 0 && (
        <p className={styles.note}>
          Next deal starts with: {queued.map((t) => SCAVENGE_CARDS[t].name).join(', ')}
        </p>
      )}
    </>
  );
}

/** Set the four Abundance meters directly, e.g. to see low warnings. */
function AbundanceEditor({
  abundance,
  onApply,
}: {
  abundance: Record<NodeType, number>;
  onApply(action: Action): void;
}) {
  const [values, setValues] = useState(abundance);
  return (
    <>
      <div className={styles.row}>
        {NODE_TYPES.map((n) => (
          <label key={n} className={styles.note}>
            {NODE_LABEL[n]}{' '}
            <input
              className={styles.number}
              type="number"
              min={0}
              max={BALANCE.abundance.max}
              value={values[n]}
              onChange={(e) => setValues({ ...values, [n]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            onApply({ type: 'debug', op: { kind: 'setAbundance', abundance: values } })
          }
        >
          Set Abundance
        </button>
      </div>
    </>
  );
}

/** Set any hiker's stats and injuries directly (no injury rule), e.g. to test thresholds. */
function StatsEditor({ hikers, onApply }: { hikers: Hiker[]; onApply(action: Action): void }) {
  const [hikerId, setHikerId] = useState(hikers[0]?.id ?? '');
  const hiker = hikers.find((h) => h.id === hikerId);
  return hiker ? (
    <StatsForm key={`${hiker.id}-${JSON.stringify(hiker.stats)}-${hiker.injuries}`} hiker={hiker}>
      {(values, setValue) => (
        <>
          <div className={styles.row}>
            <select
              className={styles.button}
              value={hikerId}
              onChange={(e) => setHikerId(e.target.value)}
              aria-label="Hiker"
            >
              {hikers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            {[...STAT_NAMES, 'injuries' as const].map((key) => (
              <label key={key} className={styles.note}>
                {key === 'injuries' ? 'Injuries' : STAT_LABEL[key]}{' '}
                <input
                  className={styles.number}
                  type="number"
                  min={0}
                  max={key === 'injuries' ? 3 : 10}
                  value={values[key]}
                  onChange={(e) => setValue(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                onApply({
                  type: 'debug',
                  op: {
                    kind: 'setStats',
                    hikerId: hiker.id,
                    stats: {
                      energy: values.energy,
                      appetite: values.appetite,
                      morale: values.morale,
                    },
                    injuries: values.injuries,
                  },
                })
              }
            >
              Apply to {hiker.name}
            </button>
          </div>
        </>
      )}
    </StatsForm>
  ) : null;
}

type StatValues = Record<'energy' | 'appetite' | 'morale' | 'injuries', number>;

function StatsForm({
  hiker,
  children,
}: {
  hiker: Hiker;
  children(
    values: StatValues,
    set: (key: keyof StatValues, value: number) => void,
  ): React.ReactNode;
}) {
  const [values, setValues] = useState<StatValues>({ ...hiker.stats, injuries: hiker.injuries });
  return <>{children(values, (key, value) => setValues((v) => ({ ...v, [key]: value })))}</>;
}
