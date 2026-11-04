/**
 * Simple mode's party panel: one compact card per hiker (portrait, name, a
 * family icon, injury pips and the three bars with their numbers). Clicking a
 * hiker selects them and opens a pop-out with everything else.
 */
import { useRef, useState } from 'react';
import { characterFor } from '../../content/characters';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { STAT_NAMES, type GameState, type Hiker, type HikerId } from '../../engine';
import { Icon } from '../icons/Icon';
import { FAMILY_LOOK } from '../panels/hikerInfo';
import { Panel } from '../panels/Panel';
import { Details } from '../panels/PartyPanel';
import { Popout } from '../panels/Popout';
import { StatBar } from '../panels/StatBar';
import { useStage } from '../stage/StageContext';
import styles from './Simple.module.css';

interface SimplePartyProps {
  state: GameState;
  selectedId: HikerId | null;
  onSelect(id: HikerId): void;
}

const POPOUT_HEIGHT = 470;

export function SimpleParty({ state, selectedId, onSelect }: SimplePartyProps) {
  const fit = useStage();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ id: HikerId; top: number } | null>(null);
  const active = state.hikers.filter((h) => h.status === 'active');
  const acted = active.filter((h) => h.acted).length;
  const openHiker = open && state.hikers.find((h) => h.id === open.id);

  const click = (h: Hiker, card: HTMLElement) => {
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
        as="aside"
        label="party"
        style={{ left: 16, top: 72, width: 288 }}
        title={<span className={styles.heading}>PARTY</span>}
        aside={
          <span>
            {acted} of {active.length} acted
          </span>
        }
      >
        <div ref={listRef} className={styles.cards}>
          {state.hikers.map((h) => (
            <HikerCard
              key={h.id}
              hiker={h}
              selected={h.id === selectedId}
              onClick={(card) => click(h, card)}
            />
          ))}
        </div>
      </Panel>

      {open && openHiker && (
        <Popout
          label={`${openHiker.name} details`}
          className={styles.popout}
          style={{ left: 316, top: open.top, width: 300 }}
          ignore={[listRef]}
          onClose={() => setOpen(null)}
        >
          <div className={styles.popoutHead}>
            <span className={styles.popoutName}>{openHiker.name.toUpperCase()}</span>
            <span className={styles.muted}>
              {FAMILY_LOOK[openHiker.family].label.charAt(0) +
                FAMILY_LOOK[openHiker.family].label.slice(1).toLowerCase()}
            </span>
          </div>
          <Details hiker={openHiker} showConditions />
        </Popout>
      )}
    </>
  );
}

function HikerCard({
  hiker: h,
  selected,
  onClick,
}: {
  hiker: Hiker;
  selected: boolean;
  onClick(card: HTMLElement): void;
}) {
  const color = characterFor(h.id).color;
  const family = FAMILY_LOOK[h.family];
  const out = h.status !== 'active';
  return (
    <button
      type="button"
      className={styles.card}
      data-faded={(h.acted || out) && !selected}
      aria-pressed={selected}
      aria-label={`${h.name}${out ? ' (passed out)' : h.acted ? ' (has acted)' : ''}. Show details`}
      style={
        selected
          ? { boxShadow: `0 0 0 2px ${color}, 0 0 18px ${color}88`, borderColor: color }
          : undefined
      }
      onClick={(e) => onClick(e.currentTarget)}
    >
      <img
        className={styles.portrait}
        src={ASSETS.portraits.placeholder}
        alt=""
        style={{ boxShadow: `0 0 0 3px ${color}` }}
      />
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
        {STAT_NAMES.map((stat) => (
          <StatBar key={stat} stat={stat} value={h.stats[stat]} showNumber size="regular" />
        ))}
      </span>
    </button>
  );
}
