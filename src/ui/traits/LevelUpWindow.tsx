/**
 * The level-up window (a bare-bones placeholder; Phase 10b designs the real
 * one with the hiker selection screen). It also shows an Old Photo's 3
 * traits. Pick an option, choose which trait it replaces if there's no empty
 * slot for it, then Take it: a trait can't be taken back, so it's two steps.
 */
import { useEffect, useRef, useState } from 'react';
import { TRAITS } from '../../content/traits';
import {
  emptySlotsFor,
  replaceableSlots,
  validateAction,
  workingTrait,
  type GameState,
  type TraitDef,
  type TraitOption,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { SLOT_WORDS } from '../items/whatItDoes';
import styles from './LevelUpWindow.module.css';

const TYPE_WORD = { T: 'Trail', U: 'Utility', M: 'Morale' } as const;
const TYPE_COLOR = { T: '#F2B950', U: '#9CC3A8', M: '#CDA6EE' } as const;
const NUMERAL = { 1: 'I', 2: 'II', 3: 'III' } as const;

/** "Trail · Tier II", "Morale", "Utility · Special". */
function kindLine(def: TraitDef): string {
  const type = TYPE_WORD[def.type];
  if (def.kind === 'special' || def.kind === 'unique') {
    return `${type} · ${def.kind === 'special' ? 'Special' : 'Unique'}`;
  }
  return def.tier ? `${type} · Tier ${NUMERAL[def.tier]}` : type;
}

function OptionCard({ option }: { option: TraitOption }) {
  if (option.kind === 'slot') {
    return (
      <>
        <span className={styles.kind}>NEW SLOT</span>
        <span className={styles.name}>{SLOT_WORDS[option.slot]}</span>
        <span className={styles.text}>An empty slot for a trait you pick later.</span>
      </>
    );
  }
  const def = TRAITS[option.traitId];
  if (!def) return <span className={styles.name}>{option.traitId}</span>;
  const setting = option.setting ?? {};
  return (
    <>
      <span className={styles.kind} style={{ color: TYPE_COLOR[def.type] }}>
        {kindLine(def).toUpperCase()}
      </span>
      <span className={styles.name}>{def.nameWith?.(setting) ?? def.name}</span>
      <span className={styles.text}>{def.textWith?.(setting) ?? def.text}</span>
    </>
  );
}

export function LevelUpWindow({
  state,
  onPick,
}: {
  state: GameState;
  onPick(option: number, replaceSlot?: number): void;
}) {
  const open = state.traitPick;
  const hiker = open && state.hikers.find((h) => h.id === open.hikerId);
  const [chosen, setChosen] = useState<number | null>(null);
  const [replace, setReplace] = useState<number | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [open?.level, open?.hikerId]);
  if (!open || !hiker) return null;

  const photo = open.source === 'oldPhoto';
  const option = chosen !== null ? open.options[chosen] : undefined;
  const def = option?.kind === 'trait' ? TRAITS[option.traitId] : undefined;
  const empty = def ? emptySlotsFor(hiker, def) : [];
  // With no empty slot that fits, the new trait replaces one the player picks.
  const mustReplace = !photo && !!def && empty.length === 0;
  const replaceable = def && mustReplace ? replaceableSlots(hiker, def) : [];
  const replaced = photo ? open.slot : (replace ?? undefined);
  const action = {
    type: 'pickTrait' as const,
    option: chosen ?? -1,
    ...(mustReplace && replace !== null ? { replaceSlot: replace } : {}),
  };
  const reason = chosen === null ? 'Pick one first.' : validateAction(state, action);
  const traitIn = (slot: number | undefined) =>
    slot === undefined ? undefined : workingTrait(state, hiker.slots[slot]!)?.name;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={photo ? 'Old Photo' : `${hiker.name} levels up`}
      >
        <header className={styles.head}>
          <Icon name="star" size={22} color="#1D2220" strokeWidth={2.5} />
          <h2 className={styles.title}>{photo ? 'OLD PHOTO' : 'LEVEL UP'}</h2>
        </header>
        <p className={styles.lead}>
          {photo
            ? `Pick a trait for ${hiker.name} in place of ${traitIn(open.slot) ?? 'their trait'}.`
            : `${hiker.name} reached level ${open.level}. Pick one:`}
        </p>
        <div className={styles.options}>
          {open.options.map((o, i) => (
            <button
              key={i}
              ref={i === 0 ? first : undefined}
              type="button"
              className={styles.option}
              data-chosen={chosen === i || undefined}
              aria-pressed={chosen === i}
              onClick={() => {
                setChosen(i);
                setReplace(null);
              }}
            >
              <OptionCard option={o} />
            </button>
          ))}
        </div>

        {mustReplace && (
          <div className={styles.replace}>
            <span className={styles.lead}>
              {hiker.name} has no empty slot for {def?.name}. Which trait does it replace?
            </span>
            <div className={styles.replaceRow}>
              {replaceable.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={styles.replaceButton}
                  data-chosen={replace === slot || undefined}
                  aria-pressed={replace === slot}
                  onClick={() => setReplace(slot)}
                >
                  {traitIn(slot)}
                </button>
              ))}
            </div>
          </div>
        )}
        {option && !reason && (
          <p className={styles.note}>
            {option.kind === 'slot'
              ? `${hiker.name} gets an empty ${SLOT_WORDS[option.slot]}.`
              : replaced !== undefined
                ? `${def?.name} replaces ${traitIn(replaced)}. This can’t be undone.`
                : `${def?.name} goes in an empty slot.`}
          </p>
        )}

        <button
          type="button"
          className={styles.take}
          disabled={!!reason}
          title={reason ?? undefined}
          onClick={() => onPick(action.option, action.replaceSlot)}
        >
          TAKE IT
        </button>
      </div>
    </div>
  );
}
