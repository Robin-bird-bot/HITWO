/**
 * The party panel on the left (docs/mockups/Main.dc.html): a compact card per
 * hiker, with the selected hiker's card expanded.
 */
import { hikerColor } from '../../content/characters';
import { BALANCE } from '../../config/balance';
import { moraleForecast, type GameState, type Hiker, type HikerId } from '../../engine';
import { Icon } from '../icons/Icon';
import { ConditionPill, ConditionRow } from '../conditions/ConditionBadges';
import { injuryLook, thresholdLooks, timedLooks } from '../conditions/hikerConditions';
import {
  FAMILY_LOOK,
  STAT_META,
  carryNote,
  hikerBars,
  statNote,
  statusTag,
  xpProgress,
} from './hikerInfo';
import { Panel } from './Panel';
import { StatBar } from './StatBar';
import { useDrop, type DropProps } from '../drag/drag';
import { OrderBadge, SelectToggle } from './GroupBits';
import { NO_DROP, useItemDrops } from '../drag/itemDrops';
import styles from './PartyPanel.module.css';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { traitBadges } from '../traits/badges';
import { TraitBadgeRow } from '../traits/TraitBadge';
import { AtRiskTag } from '../traits/AtRiskTag';
import { useTraitView } from '../traits/forecastView';
import { MoraleTypeMark } from '../trails/MoraleTypeMark';
import { TrailsButton } from '../trails/TrailsButton';

interface PartyPanelProps {
  state: GameState;
  selectedId: HikerId | null;
  /** `add`: Shift- or Ctrl-click, or the Select toggle: add to (or take out of) the group. */
  onSelect(id: HikerId, add?: boolean): void;
  /** Multi-select (Nov 14 update): each grouped hiker's turn-order number. */
  order?: Partial<Record<HikerId, number>>;
  /** The Select toggle, for touch: taps pick hikers for the group. */
  picking?: boolean;
  onPicking?(on: boolean): void;
  /** Asks to confirm abandoning the hike for this hiker. */
  onAbandon?(id: HikerId): void;
  /** Asks to confirm taking an injury on purpose (a way out when stuck). */
  onInjure?(id: HikerId): void;
  /** A usable trait's badge was tapped: open the Abilities panel at it. */
  onUseTrait?(id: HikerId, abilityId: string): void;
  /** Open this hiker's Skill Trails (Phase 10.7). */
  onTrails?(id: HikerId): void;
  /** A toggle trait's badge was clicked: switch it (Leash Puller). */
  onToggleTrait?(id: HikerId, traitId: string): void;
}

export function PartyPanel({
  state,
  selectedId,
  onSelect,
  onAbandon,
  onInjure,
  onUseTrait,
  onTrails,
  onToggleTrait,
  order = {},
  picking = false,
  onPicking,
}: PartyPanelProps) {
  const active = state.hikers.filter((h) => h.status === 'active');
  const acted = active.filter((h) => h.acted).length;
  // Pack things dropped on a portrait: give, eat or feed (Nov 14 update).
  const portrait = useDrop('hiker', useItemDrops().portrait ?? NO_DROP);
  return (
    <Panel
      id="party"
      movable
      as="aside"
      label="party"
      style={{ left: 16, top: 120, width: 288, height: 864 }}
      title={<span className={styles.heading}>PARTY</span>}
      aside={
        <span className={styles.asideRow}>
          {onPicking && <SelectToggle on={picking} onChange={onPicking} />}
          <span>
            {acted} of {active.length} acted
          </span>
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
            onSelect={(id, add) => onSelect(id, add || picking)}
            turn={order[h.id]}
            drop={portrait.props(h.id)}
            {...(onAbandon ? { onAbandon } : {})}
            {...(onInjure ? { onInjure } : {})}
            {...(onUseTrait ? { onUseTrait } : {})}
            {...(onTrails ? { onTrails } : {})}
            {...(onToggleTrait ? { onToggleTrait } : {})}
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
  onInjure,
  onUseTrait,
  onTrails,
  onToggleTrait,
  drop,
  turn,
}: {
  state: GameState;
  hiker: Hiker;
  selected: boolean;
  onUseTrait?(id: HikerId, abilityId: string): void;
  onTrails?(id: HikerId): void;
  onToggleTrait?(id: HikerId, traitId: string): void;
  onSelect(id: HikerId, add?: boolean): void;
  onAbandon?(id: HikerId): void;
  onInjure?(id: HikerId): void;
  drop?: DropProps;
  /** Its place in the group's turn order. */
  turn?: number;
}) {
  const color = hikerColor(h);
  const traitView = useTraitView();
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
      onClick={(e) => onSelect(h.id, e.shiftKey || e.ctrlKey || e.metaKey)}
      data-grouped={turn !== undefined || undefined}
      {...drop}
    >
      <div className={styles.top}>
        <OrderBadge n={turn}>
          <HikerPortrait
            hikerId={h.id}
            className={styles.portrait}
            style={{
              boxShadow: `0 0 0 3px ${color}`,
              filter: dim && !selected ? 'grayscale(1)' : 'none',
            }}
          />
          <AtRiskTag hikerId={h.id} name={h.name} />
        </OrderBadge>
        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{h.name.toUpperCase()}</span>
            {h.moraleType && <MoraleTypeMark type={h.moraleType} />}
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
            {onTrails && h.trails && <TrailsButton onClick={() => onTrails(h.id)} />}
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
          {hikerBars(state, h).map((b) => (
            <StatBar
              key={b.stat}
              stat={b.stat}
              value={b.value}
              max={b.max}
              ticks
              forecast={b.stat === 'morale' ? moraleForecast(state, h) : undefined}
            />
          ))}
          <ConditionPills hiker={h} />
          {/* Icons only here; the details show them with their names. */}
          {!selected && (
            <span className={styles.badges} onClick={(e) => e.stopPropagation()}>
              <TraitBadgeRow
                badges={traitBadges(state, h, traitView.view ?? undefined)}
                {...(onUseTrait
                  ? { onUse: (abilityId: string) => onUseTrait(h.id, abilityId) }
                  : {})}
                {...(onToggleTrait
                  ? { onToggle: (traitId: string) => onToggleTrait(h.id, traitId) }
                  : {})}
              />
            </span>
          )}
        </div>
      </div>

      {selected && (
        <Details
          state={state}
          hiker={h}
          {...(onAbandon ? { onAbandon } : {})}
          {...(onInjure ? { onInjure } : {})}
          {...(onUseTrait ? { onUseTrait } : {})}
          {...(onTrails ? { onTrails } : {})}
          {...(onToggleTrait ? { onToggleTrait } : {})}
        />
      )}
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

const MAX_SLOTS = 6;

/** Exact stats with thresholds, every condition with what it does, trait slots and XP. */
export function Details({
  state,
  hiker: h,
  onAbandon,
  onInjure,
  onUseTrait,
  onTrails,
  onToggleTrait,
}: {
  state: GameState;
  hiker: Hiker;
  onUseTrait?(id: HikerId, abilityId: string): void;
  onTrails?(id: HikerId): void;
  onToggleTrait?(id: HikerId, traitId: string): void;
  /** Asks to confirm abandoning the hike for this hiker (kept away from the action grid). */
  onAbandon?(id: HikerId): void;
  /** Asks to confirm taking an injury on purpose, for a hiker who's stuck (Wyatt, Nov 14). */
  onInjure?(id: HikerId): void;
}) {
  const filled = h.slots.filter((s) => s.traitId).length;
  const traitView = useTraitView();
  const xp = xpProgress(state, h);
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
        {hikerBars(state, h).map((b) => (
          <div key={b.stat} className={styles.statRow}>
            <Icon name={STAT_META[b.stat].icon} size={14} />
            <span className={styles.statName}>{STAT_META[b.stat].label}</span>
            <span className={styles.statValue}>
              {b.value}/{b.max}
            </span>
            <span className={styles.statNote}>{statNote(b.stat, b.value)}</span>
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
          {h.trails ? (
            <>
              <span className={styles.label}>TRAITS</span>
              {onTrails && <TrailsButton onClick={() => onTrails(h.id)} wide />}
            </>
          ) : (
            <>
              <span className={styles.label}>TRAIT SLOTS</span>
              <span className={styles.statNote}>
                {filled} filled · {h.slots.length} of {MAX_SLOTS} max
              </span>
            </>
          )}
        </div>
        {/* Informative view: each badge with its name under it. */}
        <span className={styles.badges} onClick={(e) => e.stopPropagation()}>
          <TraitBadgeRow
            badges={traitBadges(state, h, traitView.view ?? undefined)}
            showNames
            {...(onUseTrait ? { onUse: (abilityId: string) => onUseTrait(h.id, abilityId) } : {})}
            {...(onToggleTrait
              ? { onToggle: (traitId: string) => onToggleTrait(h.id, traitId) }
              : {})}
          />
        </span>
      </div>

      {h.trails ? (
        <span className={styles.statNote}>
          {h.xp} XP earned for the party.{' '}
          {xp.rowXp
            ? 'Crafting and lucky finds give XP here today.'
            : 'No XP for crafting or finds on this row.'}
        </span>
      ) : (
        <>
          <div className={styles.xp}>
            <span className={styles.level}>LV {xp.level}</span>
            <div className={styles.track}>
              <div
                style={{
                  width: `${Math.min(100, ((xp.xp - xp.from) / Math.max(1, xp.next - xp.from)) * 100)}%`,
                  background: '#CDA6EE',
                }}
              />
            </div>
            <span className={styles.statNote}>
              {xp.xp}/{xp.next} XP
            </span>
          </div>
          {xp.waiting > 0 && (
            <span className={styles.levelWaiting}>
              Level {xp.level + xp.waiting} reached: pick a trait at the next camp.
            </span>
          )}
          <span className={styles.statNote}>
            {xp.rowXp
              ? 'Crafting and lucky finds give XP here today.'
              : 'No XP for crafting or finds on this row.'}
          </span>
        </>
      )}

      <div className={styles.lastResorts}>
        {onInjure && h.status === 'active' && (
          <button
            type="button"
            className={styles.abandon}
            onClick={() => onInjure(h.id)}
            title="Take an injury: every stat below 5 rises to 5."
          >
            Submit to injury…
          </button>
        )}
        {onAbandon && (h.status === 'active' || h.status === 'passedOut') && (
          <button type="button" className={styles.abandon} onClick={() => onAbandon(h.id)}>
            Abandon the hike…
          </button>
        )}
      </div>
    </div>
  );
}
