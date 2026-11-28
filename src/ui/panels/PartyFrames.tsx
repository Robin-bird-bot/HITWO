/**
 * The party frames (35-ui-overhaul.md, section 3): each hiker is a small
 * paper tag down the left, in both screen modes.
 *
 * - **The tag:** the portrait on the party color with a faint sunburst (grey,
 *   with an ACTED stamp, once they've acted), a ribbon with the name and the
 *   3 injury diamonds, and thin Energy, Appetite and Morale bars (Stuffing
 *   for plush hikers) with their numbers and a notch at each threshold
 *   (Fatigued, Hungry, and where Luck turns). A dot on the portrait's corner
 *   is colored by the worst condition, with how many; pointing at it (or a
 *   long-press) lists them.
 * - **Selected:** the tag slides out with a party-color outline.
 * - **Opened:** clicking a tag selects the hiker and opens the rest of it:
 *   the numbers with thresholds, condition chips with days left, trait
 *   badges, the party's level and XP, and what they're wearing. Several can
 *   be open at once (Wyatt); clicking an open tag's header closes it.
 * - **When a stat changes:** the bar jumps, a pale ghost of the old amount
 *   drains after it, the change floats up, and the tag nudges on a loss.
 *
 * Shift- or Ctrl-click (or Select, on touch) picks hikers for a group
 * instead. Pack things dropped on a tag give, eat or feed, as before.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/engine';
import { BALANCE } from '../../config/balance';
import { hikerColor } from '../../content/characters';
import { ITEMS } from '../../content';
import { moraleForecast, type GameState, type Hiker, type HikerId } from '../../engine';
import { moraleLuck } from '../../engine/scavenge/rarity';
import { ConditionPill } from '../conditions/ConditionBadges';
import { thresholdLooks, timedLooks } from '../conditions/hikerConditions';
import type { ConditionLook } from '../conditions/conditionLook';
import { useDrop, type DropProps } from '../drag/drag';
import { NO_DROP, useItemDrops } from '../drag/itemDrops';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { Icon } from '../icons/Icon';
import { ASSETS } from '../../config/assets';
import { SLOT_NAME } from '../items/itemLook';
import { AtRiskTag } from '../traits/AtRiskTag';
import { TraitBadgeRow } from '../traits/TraitBadge';
import { traitBadges } from '../traits/badges';
import { useTraitView } from '../traits/forecastView';
import { MoraleTypeMark } from '../trails/MoraleTypeMark';
import { TrailsButton } from '../trails/TrailsButton';
import { shownProgress } from '../trails/partyProgress';
import { SelectToggle } from './GroupBits';
import { BAR_LEVELS, STAT_META, carryNote, hikerBars, statNote, type BarStat } from './hikerInfo';
import styles from './PartyFrames.module.css';

const UI = BALANCE.ui.overhaul;

export interface PartyFramesProps {
  state: GameState;
  selectedId: HikerId | null;
  /** `add`: Shift- or Ctrl-click, or the Select toggle: add to (or take out of) the group. */
  onSelect(id: HikerId, add?: boolean): void;
  /** Multi-select: each grouped hiker's turn-order number. */
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
  /** Open this hiker's Skill Trails. */
  onTrails?(id: HikerId): void;
  /** A toggle trait's badge was clicked: switch it (Leash Puller). */
  onToggleTrait?(id: HikerId, traitId: string): void;
  /** Where the column starts (stage pixels): lower in Informative, under the biome card. */
  top: number;
}

export function PartyFrames(props: PartyFramesProps) {
  const { state, selectedId, onSelect, order = {}, picking = false, onPicking, top } = props;
  const [opened, setOpened] = useState<ReadonlySet<HikerId>>(() => new Set());
  // Pack things dropped on a tag: give, eat or feed (Nov 14 update).
  const portrait = useDrop('hiker', useItemDrops().portrait ?? NO_DROP);
  const active = state.hikers.filter((h) => h.status === 'active');
  const acted = active.filter((h) => h.acted).length;

  const press = (h: Hiker, add: boolean) => {
    // Picking for a group: just in or out of the group.
    if (add || picking) {
      onSelect(h.id, true);
      return;
    }
    if (h.id !== selectedId) onSelect(h.id);
    const open = opened.has(h.id);
    // A closed tag opens; an open tag's header closes it.
    sfx(open ? 'ui.frameClose' : 'ui.frameOpen');
    setOpened((was) => {
      const next = new Set(was);
      if (open) next.delete(h.id);
      else next.add(h.id);
      return next;
    });
  };

  return (
    <aside className={styles.column} style={{ top, maxHeight: 1000 - top - 12 }} aria-label="Party">
      {onPicking && (
        <div className={styles.strip}>
          <span>
            {acted} of {active.length} acted
          </span>
          <SelectToggle on={picking} onChange={onPicking} />
        </div>
      )}
      {state.hikers.map((h) => (
        <Frame
          key={h.id}
          {...props}
          hiker={h}
          selected={h.id === selectedId}
          open={opened.has(h.id)}
          turn={order[h.id]}
          drop={portrait.props(h.id)}
          onPress={(add) => press(h, add)}
        />
      ))}
    </aside>
  );
}

/** What the tag's label says about a hiker who isn't active. */
const OUT_WORDS: Partial<Record<Hiker['status'], string>> = {
  passedOut: ' (passed out)',
  abandoned: ' (left the hike)',
  checkedIn: ' (checked in)',
};

/** The worst condition's tone: red bad, yellow a threshold, green good. */
function worstTone(looks: readonly ConditionLook[]): 'bad' | 'state' | 'good' | null {
  if (looks.some((l) => l.tone === 'negative' || l.tone === 'injury')) return 'bad';
  if (looks.some((l) => l.tone === 'state')) return 'state';
  return looks.length ? 'good' : null;
}

/** Where the bar's notch goes: Fatigued, Hungry, low Stuffing, or where Luck turns. */
function notchOf(stat: BarStat): number {
  if (stat === 'morale') {
    // The first Morale with no bad Luck.
    let m = 0;
    while (m < BALANCE.stats.max && moraleLuck(m) < 0) m += 1;
    return m;
  }
  return BAR_LEVELS[stat].low;
}

function Frame({
  state,
  hiker: h,
  selected,
  open,
  turn,
  drop,
  onPress,
  onAbandon,
  onInjure,
  onUseTrait,
  onTrails,
  onToggleTrait,
}: PartyFramesProps & {
  hiker: Hiker;
  selected: boolean;
  open: boolean;
  turn: number | undefined;
  drop: DropProps;
  onPress(add: boolean): void;
}) {
  const color = hikerColor(h);
  const traitView = useTraitView();
  const looks = [...thresholdLooks(h), ...timedLooks(h)];
  const tone = worstTone(looks);
  const out = h.status !== 'active';
  const bars = hikerBars(state, h);
  const carry = carryNote(state, h);
  const note =
    h.status === 'passedOut' && carry
      ? `Passed out · ${carry.short}`
      : h.status === 'abandoned'
        ? 'Left the hike'
        : carry?.text;
  // The tag nudges on any loss: a counter that bumps when a bar goes down.
  const nudge = useLossCount(bars.map((b) => b.value));
  const names = looks.map((l) => `${l.name}${l.short ? ` · ${l.short}` : ''}`);
  return (
    <div
      className={styles.frame}
      data-selected={selected || undefined}
      data-open={open || undefined}
      data-acted={(h.acted && !out) || undefined}
      data-out={out || undefined}
      data-nudge={nudge ? nudge % 2 : undefined}
      data-grouped={turn !== undefined || undefined}
      style={{ '--c': color, '--slide': `${UI.selectedSlide}px` } as CSSProperties}
    >
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-pressed={selected}
        aria-label={`${h.name}${OUT_WORDS[h.status] ?? (h.acted ? ' (has acted)' : '')}${
          names.length ? `: ${names.join(', ')}` : ''
        }${note ? `. ${note}` : ''}. ${open ? 'Close' : 'Show details'}`}
        onClick={(e) => onPress(e.shiftKey || e.ctrlKey || e.metaKey)}
        {...drop}
      >
        <span className={styles.portrait}>
          <HikerPortrait hikerId={h.id} className={styles.face} />
          <span className={styles.stamp} aria-hidden="true">
            ACTED
          </span>
          <AtRiskTag hikerId={h.id} name={h.name} />
        </span>
        {tone && (
          <span className={styles.dot} data-tone={tone} title={names.join(', ')}>
            {looks.length}
          </span>
        )}
        {turn !== undefined && (
          <span className={styles.turn} aria-label={`Turn ${turn}`}>
            {turn}
          </span>
        )}
        <span className={styles.banner}>
          <span className={styles.name}>{h.name.toUpperCase()}</span>
          <span
            className={styles.injuries}
            title={`Injuries: ${h.injuries} of ${BALANCE.injuries.passOutAt}`}
          >
            {Array.from({ length: BALANCE.injuries.passOutAt }, (_, i) => (
              <i key={i} data-on={i < h.injuries || undefined} />
            ))}
          </span>
        </span>
        <span className={styles.bars}>
          {bars.map((b) => (
            <FrameBar
              key={b.stat}
              stat={b.stat}
              value={b.value}
              max={b.max}
              forecast={b.stat === 'morale' ? moraleForecast(state, h) : undefined}
            />
          ))}
        </span>
        {note && <span className={styles.note}>{note}</span>}
      </button>
      {open && (
        <More
          state={state}
          hiker={h}
          looks={looks}
          traitView={traitView.view ?? undefined}
          {...{ onAbandon, onInjure, onUseTrait, onTrails, onToggleTrait }}
        />
      )}
    </div>
  );
}

/** Counts the times any of these values went down. */
function useLossCount(values: readonly number[]): number {
  const [seen, setSeen] = useState({ values, losses: 0 });
  if (seen.values.join() !== values.join()) {
    const lost = values.some((v, i) => v < (seen.values[i] ?? v));
    setSeen({ values, losses: seen.losses + (lost ? 1 : 0) });
  }
  return seen.losses;
}

interface Float {
  id: number;
  text: string;
  up: boolean;
  at: number;
}

let floatIds = 0;

/**
 * A thin bar with its number and a notch at its threshold. When it changes,
 * the bar jumps, a pale ghost of the old amount drains after it, and the
 * change floats up (−1 red, +1 green).
 */
function FrameBar({
  stat,
  value,
  max,
  forecast,
}: {
  stat: BarStat;
  value: number;
  max: number;
  forecast?: 1 | -1 | 0 | 'unknown' | undefined;
}) {
  const [shown, setShown] = useState<{ value: number; ghost: number; floats: Float[] }>({
    value,
    ghost: value,
    floats: [],
  });
  if (shown.value !== value) {
    const diff = value - shown.value;
    setShown({
      value,
      // A loss leaves the old amount behind to drain; a gain fills at once.
      ghost: diff < 0 ? Math.max(shown.ghost, shown.value) : value,
      floats: [
        ...shown.floats,
        {
          id: ++floatIds,
          text: `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`,
          up: diff > 0,
          at: value,
        },
      ],
    });
  }
  const draining = shown.ghost !== shown.value;
  const latest = shown.floats.at(-1)?.id;
  useEffect(() => {
    if (!draining) return;
    // One frame with the ghost where it was, then it drains (its CSS transition).
    const frame = requestAnimationFrame(() => setShown((s) => ({ ...s, ghost: s.value })));
    return () => cancelAnimationFrame(frame);
  }, [draining]);
  useEffect(() => {
    if (latest === undefined) return;
    const t = window.setTimeout(
      () => setShown((s) => ({ ...s, floats: s.floats.filter((f) => f.id > latest) })),
      UI.floatMs,
    );
    return () => window.clearTimeout(t);
  }, [latest]);

  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const meta = STAT_META[stat];
  const coming =
    forecast === 1 ? ' Going up 1 tonight.' : forecast === -1 ? ' Going down 1 tonight.' : '';
  return (
    <span
      className={styles.bar}
      data-stat={stat}
      role="img"
      aria-label={`${meta.label} ${value}/${max}.${coming}`}
      title={`${meta.label} ${value}/${max}`}
    >
      <Icon name={meta.icon} size={13} strokeWidth={2.4} />
      <span className={styles.track}>
        <i className={styles.ghost} style={{ width: pct(shown.ghost) }} />
        <i className={styles.fill} style={{ width: pct(value) }} />
        <i className={styles.notch} style={{ left: pct(notchOf(stat)) }} />
        {forecast === 1 && value < max && (
          <i className={styles.gain} style={{ left: pct(value), width: pct(1) }} />
        )}
      </span>
      <b>{value}</b>
      {shown.floats.map((f) => (
        <span
          key={f.id}
          className={styles.float}
          data-up={f.up || undefined}
          style={{ left: pct(f.at) }}
          aria-hidden="true"
        >
          {f.text}
        </span>
      ))}
    </span>
  );
}

/** The opened part: numbers with thresholds, conditions, traits, the party's level, and what they wear. */
function More({
  state,
  hiker: h,
  looks,
  traitView,
  onAbandon,
  onInjure,
  onUseTrait,
  onTrails,
  onToggleTrait,
}: Pick<
  PartyFramesProps,
  'state' | 'onAbandon' | 'onInjure' | 'onUseTrait' | 'onTrails' | 'onToggleTrait'
> & {
  hiker: Hiker;
  looks: readonly ConditionLook[];
  traitView: Parameters<typeof traitBadges>[2];
}) {
  const party = shownProgress(state);
  return (
    <div className={styles.more}>
      <div className={styles.stats}>
        {hikerBars(state, h).map((b) => (
          <span key={b.stat} className={styles.statRow}>
            <Icon name={STAT_META[b.stat].icon} size={14} />
            <span>{STAT_META[b.stat].label}</span>
            <b>
              {b.value}/{b.max}
            </b>
            <span className={styles.statNote}>{statNote(b.stat, b.value)}</span>
          </span>
        ))}
      </div>

      <span className={styles.label}>CONDITIONS</span>
      <div className={`${styles.row} ${styles.chips}`}>
        {looks.length ? (
          looks.map((l) => <ConditionPill key={l.key} look={l} />)
        ) : (
          <span className={styles.hint}>None right now</span>
        )}
      </div>

      <span className={styles.labelRow}>
        <span className={styles.label}>TRAITS · PARTY LV {party.level}</span>
        <span className={styles.xp} aria-label={`Party XP ${Math.round(party.fill * 100)}%`}>
          <i style={{ width: `${party.fill * 100}%` }} />
        </span>
        {h.moraleType && <MoraleTypeMark type={h.moraleType} />}
        {onTrails && h.trails && <TrailsButton onClick={() => onTrails(h.id)} />}
      </span>
      <div className={styles.row}>
        <TraitBadgeRow
          badges={traitBadges(state, h, traitView)}
          {...(onUseTrait ? { onUse: (abilityId: string) => onUseTrait(h.id, abilityId) } : {})}
          {...(onToggleTrait
            ? { onToggle: (traitId: string) => onToggleTrait(h.id, traitId) }
            : {})}
        />
      </div>

      <span className={styles.label}>WEARING</span>
      <div className={styles.row}>
        {(['body', 'feet', 'gear'] as const).map((slot) => {
          const item = h.inventory.equipped[slot];
          const def = item && ITEMS[item.itemId];
          return def ? (
            <span key={slot} className={styles.gear} data-full title={def.name}>
              <img src={ASSETS.itemArt(def.art ?? def.id)} alt={def.name} />
            </span>
          ) : (
            <span key={slot} className={styles.gear} title={`${SLOT_NAME[slot]}: empty`}>
              <Icon
                name={slot === 'body' ? 'shirt' : slot === 'feet' ? 'boot' : 'backpack'}
                size={16}
              />
            </span>
          );
        })}
      </div>

      {((onInjure && h.status === 'active') ||
        (onAbandon && (h.status === 'active' || h.status === 'passedOut'))) && (
        <div className={styles.lastResorts}>
          {onInjure && h.status === 'active' && (
            <button
              type="button"
              className={styles.lastResort}
              onClick={() => onInjure(h.id)}
              title="Take an injury: every stat below 5 rises to 5."
            >
              Submit to injury…
            </button>
          )}
          {onAbandon && (h.status === 'active' || h.status === 'passedOut') && (
            <button type="button" className={styles.lastResort} onClick={() => onAbandon(h.id)}>
              Abandon the hike…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
