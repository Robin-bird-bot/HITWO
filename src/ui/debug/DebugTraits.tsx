/**
 * Debug tools for traits (Nov 20 update, section 8): put any trait in any
 * slot with its setting, add or take away slots, refill uses, make the day
 * odd or even (Tag Team), and force what a daily trait is today. Plus the
 * test hikers (section 7): start a hike with any of them.
 */
import { useState } from 'react';
import { CONDITIONS } from '../../content/conditions';
import { TEST_HIKERS } from '../../content/testHikers';
import { ACTION_WORD, NODE_WORD, TRAIT_ACTIONS, TRAITS } from '../../content/traits';
import { dailyPicks } from '../../content/traits/daily';
import {
  canAddSlot,
  fitsSlot,
  NODE_TYPES,
  SLOT_TYPES,
  workingTrait,
  type Action,
  type GameState,
  type SlotType,
  type TraitSetting,
} from '../../engine';
import styles from './DebugPanel.module.css';

const TYPE_ORDER = { T: 0, U: 1, M: 2 } as const;
const ALL = Object.values(TRAITS).sort(
  (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name),
);
const TIER = ['', 'I', 'II', 'III'];

/** "Leader (T I)", "Extrinsic (M)", "Fluffy (U special)". */
function label(id: string): string {
  const t = TRAITS[id];
  if (!t) return id;
  const extra = t.kind && t.kind !== 'normal' ? ` ${t.kind}` : '';
  return `${t.name} (${t.type}${t.tier ? ` ${TIER[t.tier]}` : ''}${extra})`;
}

const NODES = NODE_TYPES.map((n) => [n, NODE_WORD[n]] as const);
const ACTIONS = TRAIT_ACTIONS.map((a) => [a, ACTION_WORD[a]] as const);

export function TraitTools({ state, onApply }: { state: GameState; onApply(a: Action): void }) {
  const [hikerId, setHikerId] = useState(state.hikers[0]?.id ?? '');
  const [slot, setSlot] = useState(0);
  const [traitId, setTraitId] = useState('forager');
  const [setting, setSetting] = useState<TraitSetting>({});
  const [slotType, setSlotType] = useState<SlotType>('T');
  const [pick, setPick] = useState('');
  const [xp, setXp] = useState('');
  const [level, setLevel] = useState('');
  const [tier, setTier] = useState<1 | 2 | 3>(1);
  const hiker = state.hikers.find((h) => h.id === hikerId);
  if (!hiker) return null;
  const def = TRAITS[traitId];
  const current = hiker.slots[slot];
  const working = current ? workingTrait(state, current) : undefined;
  const picks = working?.def.daily ? dailyPicks(working.def) : [];
  const debug = (op: Extract<Action, { type: 'debug' }>['op']) => onApply({ type: 'debug', op });

  /** A select for one part of the setting (X or Y): a node or an action. */
  const settingSelect = (key: 'x' | 'y', what: 'node' | 'action', name: string) => (
    <select
      className={styles.button}
      value={setting[key] ?? ''}
      onChange={(e) => setSetting((s) => ({ ...s, [key]: e.target.value }))}
      aria-label={name}
    >
      <option value="">{name}…</option>
      {(what === 'node' ? NODES : ACTIONS).map(([id, word]) => (
        <option key={id} value={id}>
          {word}
        </option>
      ))}
    </select>
  );

  return (
    <>
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
          {state.hikers.map((h) => (
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
              Slot {i + 1} ({s.type}):{' '}
              {s.traitId ? (workingTrait(state, s)?.name ?? s.traitId) : 'empty'}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={traitId}
          onChange={(e) => {
            setTraitId(e.target.value);
            setSetting({});
          }}
          aria-label="Trait"
        >
          {ALL.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t.id)}
              {current && !fitsSlot(current.type, t) ? ' · doesn’t fit' : ''}
            </option>
          ))}
        </select>
        {def?.setting === 'node' && settingSelect('x', 'node', 'Node')}
        {def?.setting === 'nodes' && (
          <>
            {settingSelect('x', 'node', '+1 node')}
            {settingSelect('y', 'node', '−1 node')}
          </>
        )}
        {def?.setting === 'action' && settingSelect('x', 'action', '−1 action')}
        {def?.setting === 'actions' && (
          <>
            {settingSelect('x', 'action', '+1 action')}
            {settingSelect('y', 'action', '−1 action')}
          </>
        )}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          disabled={!current}
          onClick={() =>
            debug({ kind: 'setTrait', hikerId, slot, traitId: traitId || null, setting })
          }
        >
          Put it in slot {slot + 1}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={!current?.traitId}
          onClick={() => debug({ kind: 'setTrait', hikerId, slot, traitId: null })}
        >
          Empty slot {slot + 1}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={!current}
          onClick={() => {
            debug({ kind: 'removeSlot', hikerId, slot });
            setSlot(0);
          }}
        >
          Remove slot {slot + 1}
        </button>
      </div>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={slotType}
          onChange={(e) => setSlotType(e.target.value as SlotType)}
          aria-label="Slot type"
        >
          {SLOT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'tag' ? 'Tag Team' : t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.button}
          disabled={!canAddSlot(hiker)}
          onClick={() => debug({ kind: 'addSlot', hikerId, slotType })}
        >
          Add a slot
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => debug({ kind: 'refillUses', hikerId })}
        >
          Refill uses
        </button>
      </div>
      {picks.length > 0 && working && (
        <div className={styles.row}>
          <span className={styles.note}>{working.def.name} today:</span>
          <select
            className={styles.button}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label={`${working.def.name} today`}
          >
            <option value="">Pick…</option>
            {picks.map((p) => (
              <option key={p} value={p}>
                {TRAITS[p]?.name ?? CONDITIONS[p]?.name ?? NODE_WORD[p as never] ?? p}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.button}
            disabled={!pick}
            onClick={() => debug({ kind: 'setDaily', hikerId, slot, pick })}
          >
            Set today
          </button>
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.note}>
          LV {hiker.level}
          {hiker.pendingLevels ? ` (+${hiker.pendingLevels} at camp)` : ''} · {hiker.xp} XP
        </span>
        <input
          className={styles.button}
          type="number"
          min={0}
          placeholder="XP"
          value={xp}
          onChange={(e) => setXp(e.target.value)}
          aria-label="XP"
          style={{ width: 64 }}
        />
        <input
          className={styles.button}
          type="number"
          min={0}
          placeholder="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          aria-label="Level"
          style={{ width: 64 }}
        />
        <button
          type="button"
          className={styles.button}
          disabled={xp === '' && level === ''}
          onClick={() =>
            debug({
              kind: 'setXp',
              hikerId,
              xp: xp === '' ? hiker.xp : Number(xp),
              ...(level === '' ? {} : { level: Number(level) }),
            })
          }
        >
          Set
        </button>
      </div>
      <div className={styles.row}>
        <select
          className={styles.button}
          value={tier}
          onChange={(e) => setTier(Number(e.target.value) as 1 | 2 | 3)}
          aria-label="Level-up tier"
        >
          <option value={1}>Tier I</option>
          <option value={2}>Tier II</option>
          <option value={3}>Tier III</option>
        </select>
        <button
          type="button"
          className={styles.button}
          onClick={() => debug({ kind: 'levelUpNow', hikerId, tier })}
        >
          Level up now
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.note}>
          Day {state.day} is {state.day % 2 ? 'odd' : 'even'}:
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={() => debug({ kind: 'setDayParity', odd: true })}
        >
          Odd day
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => debug({ kind: 'setDayParity', odd: false })}
        >
          Even day
        </button>
      </div>
    </>
  );
}

/** Pick up to 4 test hikers and start a hike with them (dev only). */
export function TestHikerPicker({
  onStart,
  buttonClass = styles.button,
}: {
  onStart(ids: string[]): void;
  buttonClass?: string;
}) {
  const [picked, setPicked] = useState<string[]>([
    'test-tank',
    'test-support',
    'test-scavenger',
    'test-plush',
  ]);
  // At most 4: once 4 are ticked, the rest wait until one is unticked.
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p));
  return (
    <>
      <div className={styles.row}>
        {TEST_HIKERS.map((h) => (
          <label key={h.id} className={styles.note}>
            <input
              type="checkbox"
              checked={picked.includes(h.id)}
              disabled={!picked.includes(h.id) && picked.length >= 4}
              onChange={() => toggle(h.id)}
            />{' '}
            {h.name.replace('Test ', '')}
          </label>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={buttonClass}
          disabled={!picked.length}
          onClick={() => onStart(picked)}
        >
          New hike with {picked.length} test hiker{picked.length === 1 ? '' : 's'}
        </button>
      </div>
    </>
  );
}
