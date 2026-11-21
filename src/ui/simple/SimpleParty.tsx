/**
 * Simple mode's party panel: one compact card per hiker (portrait, name, a
 * family icon, injury pips and the three bars with their numbers). Clicking a
 * hiker selects them and opens a pop-out with everything else.
 */
import { useRef, useState } from 'react';
import { hikerColor } from '../../content/characters';
import { BALANCE } from '../../config/balance';
import { type GameState, type Hiker, type HikerId } from '../../engine';
import { Icon } from '../icons/Icon';
import { FAMILY_LOOK, carryNote, hikerBars } from '../panels/hikerInfo';
import { Panel } from '../panels/Panel';
import { Details } from '../panels/PartyPanel';
import { ConditionDot } from '../conditions/ConditionBadges';
import { thresholdLooks, timedLooks } from '../conditions/hikerConditions';
import { Popout } from '../panels/Popout';
import { StatBar } from '../panels/StatBar';
import { useStage } from '../stage/StageContext';
import { useDrop, type DropProps } from '../drag/drag';
import { OrderBadge, SelectToggle } from '../panels/GroupBits';
import { NO_DROP, useItemDrops } from '../drag/itemDrops';
import styles from './Simple.module.css';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { traitBadges } from '../traits/badges';
import { TraitBadgeRow } from '../traits/TraitBadge';
import { AtRiskTag } from '../traits/AtRiskTag';
import { useTraitView } from '../traits/forecastView';

interface SimplePartyProps {
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
}

const POPOUT_HEIGHT = 470;

export function SimpleParty({
  state,
  selectedId,
  onSelect,
  onAbandon,
  onInjure,
  onUseTrait,
  order = {},
  picking = false,
  onPicking,
}: SimplePartyProps) {
  const fit = useStage();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ id: HikerId; top: number } | null>(null);
  const active = state.hikers.filter((h) => h.status === 'active');
  const acted = active.filter((h) => h.acted).length;
  const openHiker = open && state.hikers.find((h) => h.id === open.id);
  // Pack things dropped on a portrait: give, eat or feed (Nov 14 update).
  const portrait = useDrop('hiker', useItemDrops().portrait ?? NO_DROP);

  const click = (h: Hiker, card: HTMLElement, add: boolean) => {
    // Picking for a group: no details, just in or out of the group.
    if (add || picking) {
      setOpen(null);
      onSelect(h.id, true);
      return;
    }
    onSelect(h.id);
    if (open?.id === h.id) {
      setOpen(null);
      return;
    }
    // The card's top, in stage pixels, so the pop-out sits beside it.
    const top = (card.getBoundingClientRect().top - fit.top) / fit.scale;
    setOpen({ id: h.id, top: Math.max(16, Math.min(top, 1000 - POPOUT_HEIGHT - 16)) });
  };

  return (
    <>
      <Panel
        id="party"
        movable
        as="aside"
        label="party"
        style={{ left: 16, top: 72, width: 288 }}
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
        <div ref={listRef} className={styles.cards}>
          {state.hikers.map((h) => (
            <HikerCard
              key={h.id}
              state={state}
              hiker={h}
              selected={h.id === selectedId}
              onClick={(card, add) => click(h, card, add)}
              turn={order[h.id]}
              drop={portrait.props(h.id)}
              {...(onUseTrait
                ? { onUseTrait: (abilityId: string) => onUseTrait(h.id, abilityId) }
                : {})}
            />
          ))}
        </div>
      </Panel>

      {open && openHiker && (
        <Popout
          label={`${openHiker.name} details`}
          dragId="details"
          className={styles.popout}
          style={{ left: 316, top: open.top, width: 300 }}
          ignore={[listRef]}
          onClose={() => setOpen(null)}
        >
          <div className={styles.popoutHead} data-drag-handle>
            <span className={styles.popoutName}>{openHiker.name.toUpperCase()}</span>
            <span className={styles.muted}>
              {FAMILY_LOOK[openHiker.family].label.charAt(0) +
                FAMILY_LOOK[openHiker.family].label.slice(1).toLowerCase()}
            </span>
          </div>
          <Details
            state={state}
            hiker={openHiker}
            {...(onAbandon
              ? {
                  onAbandon: (id: HikerId) => {
                    setOpen(null);
                    onAbandon(id);
                  },
                }
              : {})}
            {...(onInjure
              ? {
                  onInjure: (id: HikerId) => {
                    setOpen(null);
                    onInjure(id);
                  },
                }
              : {})}
            {...(onUseTrait
              ? {
                  onUseTrait: (id: HikerId, abilityId: string) => {
                    setOpen(null);
                    onUseTrait(id, abilityId);
                  },
                }
              : {})}
          />
        </Popout>
      )}
    </>
  );
}

/** What the card's label says about a hiker who isn't active. */
const OUT_WORDS: Partial<Record<Hiker['status'], string>> = {
  passedOut: ' (passed out)',
  abandoned: ' (left the hike)',
  checkedIn: ' (checked in)',
};

function HikerCard({
  state,
  hiker: h,
  selected,
  onClick,
  onUseTrait,
  drop,
  turn,
}: {
  state: GameState;
  hiker: Hiker;
  selected: boolean;
  onClick(card: HTMLElement, add: boolean): void;
  onUseTrait?(abilityId: string): void;
  drop?: DropProps;
  /** Its place in the group's turn order. */
  turn?: number;
}) {
  const color = hikerColor(h);
  const traitView = useTraitView();
  const family = FAMILY_LOOK[h.family];
  // Passing out and carrying, in one short line under the name.
  const carry = carryNote(state, h);
  const note =
    h.status === 'passedOut' && carry
      ? { ...carry, text: `Passed out · ${carry.short}` }
      : h.status === 'abandoned'
        ? { text: 'Left the hike', tone: 'calm' as const }
        : carry;
  const out = h.status !== 'active';
  // The badges can't be focused inside the button, so the label names them.
  const conditions = [...thresholdLooks(h), ...timedLooks(h)].map(
    (l) => `${l.name}${l.stacks !== undefined ? ` ×${l.stacks}` : ''}`,
  );
  return (
    <button
      type="button"
      className={styles.card}
      data-faded={(h.acted || out) && !selected}
      aria-pressed={selected}
      aria-label={`${h.name}${OUT_WORDS[h.status] ?? (h.acted ? ' (has acted)' : '')}${
        conditions.length ? `: ${conditions.join(', ')}` : ''
      }${carry ? `. ${carry.text}` : ''}. Show details`}
      style={
        selected
          ? { boxShadow: `0 0 0 2px ${color}, 0 0 18px ${color}88`, borderColor: color }
          : undefined
      }
      onClick={(e) => onClick(e.currentTarget, e.shiftKey || e.ctrlKey || e.metaKey)}
      data-grouped={turn !== undefined || undefined}
      {...drop}
    >
      <OrderBadge n={turn}>
        <HikerPortrait
          hikerId={h.id}
          className={styles.portrait}
          style={{ boxShadow: `0 0 0 3px ${color}` }}
        />
        <AtRiskTag hikerId={h.id} name={h.name} />
      </OrderBadge>
      <span className={styles.cardBody}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{h.name.toUpperCase()}</span>
          <span className={styles.family} title={family.label.toLowerCase()}>
            <Icon name={family.icon} size={11} strokeWidth={2.25} />
          </span>
          <span
            className={styles.pips}
            title={`${h.injuries} of ${BALANCE.injuries.passOutAt} injuries`}
          >
            {Array.from({ length: BALANCE.injuries.passOutAt }, (_, i) => (
              <span key={i} data-filled={i < h.injuries} />
            ))}
          </span>
        </span>
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
            showNumber
            ticks={b.stat !== 'morale'}
            size="regular"
          />
        ))}
        <ConditionDots hiker={h} />
        {/* Icons only (Simple view). Spans: the card is already a button. */}
        <span className={styles.badges}>
          <TraitBadgeRow
            badges={traitBadges(state, h, traitView.view ?? undefined)}
            as="span"
            {...(onUseTrait ? { onUse: onUseTrait } : {})}
          />
        </span>
      </span>
    </button>
  );
}

/** Simple mode's condition badges (the approved Phase 6 mockup): icons, time on the corner. */
function ConditionDots({ hiker: h }: { hiker: Hiker }) {
  const looks = [...thresholdLooks(h), ...timedLooks(h)];
  if (!looks.length) return null;
  return (
    <span className={styles.dots}>
      {looks.map((l) => (
        // Inside the card's button, so not a separate stop for the keyboard.
        <ConditionDot key={l.key} look={l} size={32} focusable={false} />
      ))}
    </span>
  );
}
