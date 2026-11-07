/**
 * The party panel on the left (docs/mockups/Main.dc.html): a compact card per
 * hiker, with the selected hiker's card expanded.
 */
import { characterFor } from '../../content/characters';
import { TRAITS } from '../../content';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  STAT_NAMES,
  statMax,
  type GameState,
  type Hiker,
  type HikerId,
  type SlotType,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { ConditionPill, ConditionRow } from '../conditions/ConditionBadges';
import { injuryLook, thresholdLooks, timedLooks } from '../conditions/hikerConditions';
import { FAMILY_LOOK, STAT_META, carryNote, statNote, statusTag, xpProgress } from './hikerInfo';
import { Panel } from './Panel';
import { StatBar } from './StatBar';
import styles from './PartyPanel.module.css';

interface PartyPanelProps {
  state: GameState;
  selectedId: HikerId | null;
  onSelect(id: HikerId): void;
  /** Asks to confirm abandoning the hike for this hiker. */
  onAbandon?(id: HikerId): void;
}

export function PartyPanel({ state, selectedId, onSelect, onAbandon }: PartyPanelProps) {
  const active = state.hikers.filter((h) => h.status === 'active');
  const acted = active.filter((h) => h.acted).length;
  return (
    <Panel
      id="party"
      movable
      as="aside"
      label="party"
      style={{ left: 16, top: 120, width: 288, height: 864 }}
      title={<span className={styles.heading}>PARTY</span>}
      aside={
        <span>
          {acted} of {active.length} acted
        </span>
      }
    >
      <div className={styles.list}>
        {state.hikers.map((h) => (
          <HikerCard
            key={h.id}
            state={state}
            hiker={h}
            selected={h.id === selectedId}
            onSelect={onSelect}
            {...(onAbandon ? { onAbandon } : {})}
          />
        ))}
      </div>
    </Panel>
  );
}

const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  READY: { bg: '#7FC29B', fg: '#1D2220' },
  ACTED: { bg: 'rgba(255,255,255,0.1)', fg: '#C9C2B2' },
  'PASSED OUT': { bg: '#E5624A', fg: '#1D2220' },
};

function HikerCard({
  state,
  hiker: h,
  selected,
  onSelect,
  onAbandon,
}: {
  state: GameState;
  hiker: Hiker;
  selected: boolean;
  onSelect(id: HikerId): void;
  onAbandon?(id: HikerId): void;
}) {
  const color = characterFor(h.id).color;
  const tag = statusTag(h, selected);
  const tagColors =
    tag === 'ACTING' ? { bg: color, fg: '#1D2220' } : (TAG_COLORS[tag] ?? TAG_COLORS.ACTED!);
  const dim = h.acted || h.status !== 'active';
  const family = FAMILY_LOOK[h.family];
  const note = carryNote(state, h);

  return (
    <div
      className={styles.card}
      data-selected={selected}
      data-dim={dim && !selected}
      style={selected ? { borderColor: color } : undefined}
      onClick={() => onSelect(h.id)}
    >
      <div className={styles.top}>
        <img
          className={styles.portrait}
          src={ASSETS.portraits.placeholder}
          alt=""
          style={{
            boxShadow: `0 0 0 3px ${color}`,
            filter: dim && !selected ? 'grayscale(1)' : 'none',
          }}
        />
        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{h.name.toUpperCase()}</span>
            {h.injuries > 0 && (
              <span
                className={styles.cardPips}
                title={`${h.injuries} of ${BALANCE.injuries.passOutAt} injuries`}
                aria-label={`${h.injuries} of ${BALANCE.injuries.passOutAt} injuries`}
              >
                {Array.from({ length: BALANCE.injuries.passOutAt }, (_, i) => (
                  <span key={i} data-filled={i < h.injuries} />
                ))}
              </span>
            )}
            <span className={styles.tag} style={{ background: tagColors.bg, color: tagColors.fg }}>
              {tag}
            </span>
            <button
              type="button"
              className={styles.chevron}
              aria-expanded={selected}
              aria-label={selected ? `${h.name} is selected` : `Select ${h.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(h.id);
              }}
            >
              <Icon name={selected ? 'chevronUp' : 'chevronDown'} size={16} />
            </button>
          </div>
          <div className={styles.family}>
            <Icon name={family.icon} size={11} strokeWidth={2.25} />
            <span>{family.label}</span>
          </div>
          {note && (
            <span className={styles.carryNote} data-tone={note.tone}>
              {note.text}
            </span>
          )}
          {STAT_NAMES.map((stat) => (
            <StatBar
              key={stat}
              stat={stat}
              value={h.stats[stat]}
              max={statMax(state, h, stat)}
              ticks
            />
          ))}
          <ConditionPills hiker={h} />
        </div>
      </div>

      {selected && <Details state={state} hiker={h} {...(onAbandon ? { onAbandon } : {})} />}
    </div>
  );
}

/** The card's condition pills (the approved Phase 6 mockup): states, then timed and stacking ones. */
export function ConditionPills({ hiker: h }: { hiker: Hiker }) {
  const looks = [...thresholdLooks(h), ...timedLooks(h)];
  if (!looks.length) return null;
  return (
    <div className={styles.pills}>
      {looks.map((l) => (
        <ConditionPill key={l.key} look={l} />
      ))}
    </div>
  );
}

const SLOT_COLOR = { T: '#F2B950', U: '#9CC3A8', M: '#CDA6EE' };
const SLOT_RING: Record<SlotType, string> = {
  T: SLOT_COLOR.T,
  U: SLOT_COLOR.U,
  M: SLOT_COLOR.M,
  'T/U': `linear-gradient(90deg, ${SLOT_COLOR.T} 0 50%, ${SLOT_COLOR.U} 50% 100%)`,
  'T/M': `linear-gradient(90deg, ${SLOT_COLOR.T} 0 50%, ${SLOT_COLOR.M} 50% 100%)`,
  'U/M': `linear-gradient(90deg, ${SLOT_COLOR.U} 0 50%, ${SLOT_COLOR.M} 50% 100%)`,
  W: `linear-gradient(90deg, ${SLOT_COLOR.T} 0 33%, ${SLOT_COLOR.U} 33% 66%, ${SLOT_COLOR.M} 66% 100%)`,
};
const SLOT_NAME: Record<SlotType, string> = {
  T: 'Trail',
  U: 'Utility',
  M: 'Morale',
  'T/U': 'Trail or Utility',
  'T/M': 'Trail or Morale',
  'U/M': 'Utility or Morale',
  W: 'Wild: any trait',
};
const MAX_SLOTS = 6;

/** Exact stats with thresholds, every condition with what it does, trait slots and XP. */
export function Details({
  state,
  hiker: h,
  onAbandon,
}: {
  state: GameState;
  hiker: Hiker;
  /** Asks to confirm abandoning the hike for this hiker (kept away from the action grid). */
  onAbandon?(id: HikerId): void;
}) {
  const filled = h.slots.filter((s) => s.traitId).length;
  const xp = xpProgress(h);
  // The full list (the approved Phase 6 mockup): injuries, states, then the rest.
  const injury = injuryLook(h);
  const rows = [...(injury ? [injury] : []), ...thresholdLooks(h), ...timedLooks(h)];
  return (
    <div className={styles.details}>
      {rows.length > 0 && (
        <div className={styles.conditionList} aria-label="Conditions">
          {rows.map((l) => (
            <ConditionRow key={l.key} look={l} />
          ))}
        </div>
      )}
      <div className={styles.stats}>
        {STAT_NAMES.map((stat) => (
          <div key={stat} className={styles.statRow}>
            <Icon name={STAT_META[stat].icon} size={14} />
            <span className={styles.statName}>{STAT_META[stat].label}</span>
            <span className={styles.statValue}>
              {h.stats[stat]}/{statMax(state, h, stat)}
            </span>
            <span className={styles.statNote}>{statNote(stat, h.stats[stat])}</span>
          </div>
        ))}
        <div className={styles.statRow}>
          <Icon name="medical" size={14} solid />
          <span className={styles.statName}>Injuries</span>
          <span
            className={styles.pips}
            aria-label={`${h.injuries} of ${BALANCE.injuries.passOutAt}`}
          >
            {Array.from({ length: BALANCE.injuries.passOutAt }, (_, i) => (
              <span key={i} data-filled={i < h.injuries} />
            ))}
          </span>
          <span className={styles.statNote}>Passes out at {BALANCE.injuries.passOutAt}</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.label}>TRAIT SLOTS</span>
          <span className={styles.statNote}>
            {filled} filled · {h.slots.length} of {MAX_SLOTS} max
          </span>
        </div>
        <div className={styles.slots}>
          {h.slots.map((slot, i) => {
            const trait = slot.traitId ? TRAITS[slot.traitId] : undefined;
            const desc = `${SLOT_NAME[slot.type]} slot · ${trait ? `${trait.name}: ${trait.text}` : 'empty'}`;
            return (
              <div
                key={i}
                className={styles.slot}
                title={desc}
                aria-label={desc}
                style={{
                  background: `${trait ? '#262C29' : '#1F2422'} padding-box, ${SLOT_RING[slot.type]} border-box`,
                }}
              >
                <span style={{ color: trait ? SLOT_COLOR[trait.type] : '#6F6A60' }}>
                  {trait ? trait.name.toUpperCase() : 'EMPTY'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.xp}>
        <span className={styles.level}>LV {xp.level}</span>
        <div className={styles.track}>
          <div
            style={{
              width: xp.next ? `${Math.min(100, (xp.xp / xp.next) * 100)}%` : '100%',
              background: '#CDA6EE',
            }}
          />
        </div>
        <span className={styles.statNote}>
          {xp.xp}/{xp.next ?? '—'} XP
        </span>
      </div>

      {onAbandon && (h.status === 'active' || h.status === 'passedOut') && (
        <button type="button" className={styles.abandon} onClick={() => onAbandon(h.id)}>
          Abandon the hike…
        </button>
      )}
    </div>
  );
}
