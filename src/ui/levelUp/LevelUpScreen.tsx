/**
 * The level-up screen (Phase 10b, mockups/LevelUp.png). No window: the game
 * blurs behind a navy veil, and the hiker's level-up plays out on top. Old
 * Photo uses the same screen.
 *
 * - **Opening:** the portrait pops in, the XP bar fills, LEVEL N! pops at its
 *   end, the options deal in, YOUR TRAITS slides up. A click (or a key)
 *   skips to the end; under reduced motion it all just appears.
 * - **Picking:** drag an option onto one of the hiker's slots. While one is
 *   held, the slots it fits glow (REPLACE, or EMPTY · DROP HERE) and the rest
 *   dim. A placed trait can still be moved, or dragged off to take it back.
 *   Click fallback: an option, then a slot.
 * - **CONFIRM** takes it; **KEEP MY TRAITS** (after a confirm) takes nothing.
 *   A new slot goes on the + spot at the end of the row.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { BALANCE } from '../../config/balance';
import { hikerColor } from '../../content/characters';
import { xpForLevel, type Action, type GameState, type Hiker, type TraitPick } from '../../engine';
import { useReducedMotion } from '../app/useReducedMotion';
import { useDrag, useDragState, useDrop } from '../drag/drag';
import { ConfirmDialog } from '../game/ConfirmDialog';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { useFit } from '../hikers/fitText';
import { FitLine } from '../hikers/HikerCard';
import { SLOT_WORD, traitBadges, type BadgeInfo } from '../traits/badges';
import { TraitBadge } from '../traits/TraitBadge';
import { traitIconUrl } from '../traits/traitIcons';
import styles from './LevelUpScreen.module.css';
import {
  canPlace,
  cardScale,
  NEW_SLOT,
  offersSlot,
  optionBadge,
  optionCard,
  pickAction,
  slotColors,
  targetsFor,
  xpBar,
  type Fit,
  type OptionCardView,
  type Placement,
  type SlotTarget,
} from './levelUpView';

const T = BALANCE.ui.levelUp;
/** How long each piece takes to come in (s). */
const IN_S = 0.45;
/** The card under the pointer while dragging. */
const GHOST_SCALE = 0.72;

export function LevelUpScreen({
  state,
  onAction,
}: {
  state: GameState;
  /** CONFIRM or KEEP MY TRAITS: a pickTrait action. */
  onAction(action: Action): void;
}) {
  const open = state.traitPick;
  const hiker = open && state.hikers.find((h) => h.id === open.hikerId);
  if (!open || !hiker) return null;
  return <Screen state={state} open={open} hiker={hiker} onAction={onAction} />;
}

function Screen({
  state,
  open,
  hiker,
  onAction,
}: {
  state: GameState;
  open: TraitPick;
  hiker: Hiker;
  onAction(action: Action): void;
}) {
  const reduced = useReducedMotion();
  const levelUp = open.source === 'levelUp';
  const level = open.level ?? hiker.level + 1;
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  // The opening: skipped by a click or a key, and over on its own.
  const [skipped, setSkipped] = useState(false);
  const [done, setDone] = useState(reduced);
  const swallowClick = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = open.options.length;
  const openingS = Math.max(
    T.traitsAt + 0.1 + IN_S,
    T.cardsAt + (count - 1) * T.dealGapSeconds + IN_S,
    T.badgeAt + IN_S,
  );
  useEffect(() => {
    rootRef.current?.focus();
    if (reduced) return;
    const timer = setTimeout(() => setDone(true), openingS * 1000);
    return () => clearTimeout(timer);
  }, [reduced, openingS]);
  const finish = () => {
    setSkipped(true);
    setDone(true);
  };

  // While an option is held (dragged, or picked by a click): where it can go.
  const drag = useDragState();
  const dragged = drag?.payload.kind === 'levelOption' ? drag.payload : null;
  const held = dragged?.option ?? selected;
  const targets = held !== null ? targetsFor(state, open, hiker, held) : null;
  const hoverArg = drag?.hover?.id === 'levelSlot' ? drag.hover.arg : undefined;

  const place = (slot: SlotTarget, option = held) => {
    if (option === null) return;
    const next = { option, slot };
    if (!canPlace(state, open, hiker, next)) return;
    setPlacement(next);
    setSelected(null);
  };
  const slots = useDrop('levelSlot', {
    accepts: (p, arg) =>
      p.kind === 'levelOption' &&
      canPlace(state, open, hiker, { option: p.option, slot: toTarget(arg) }),
    onDrop: (p, arg) => {
      if (p.kind === 'levelOption') place(toTarget(arg), p.option);
    },
  });
  // A placed trait dragged anywhere else goes back to its card.
  const away = useDrop('levelAway', {
    accepts: (p) => p.kind === 'levelOption' && !!p.placed,
    onDrop: () => setPlacement(null),
  });

  const badges = traitBadges(state, hiker);
  const color = hikerColor(hiker);
  const scale = cardScale(count);
  const gap = count <= 3 ? 40 : 24;
  const plus = offersSlot(open, hiker);
  const photoTrait = open.slot !== undefined ? badges[open.slot]?.name : undefined;
  const bar = xpBar(hiker.xp, level, xpForLevel);
  const placedOption = placement ? open.options[placement.option] : undefined;
  const placedGhost = placedOption && <Ghost view={optionCard(hiker, placedOption)} />;
  const vars = {
    '--blur': `${T.blurPx}px`,
    '--portrait-at': `${T.portraitAt}s`,
    '--bar-at': `${T.barAt}s`,
    '--bar-s': `${T.barSeconds}s`,
    '--badge-at': `${T.badgeAt}s`,
    '--cards-at': `${T.cardsAt}s`,
    '--traits-at': `${T.traitsAt}s`,
    '--hiker': color,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={styles.screen}
      style={vars}
      data-skip={skipped || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={levelUp ? `${hiker.name} levels up` : 'Old Photo'}
      tabIndex={-1}
      // During the opening, the first press only skips to the end.
      onPointerDownCapture={(e) => {
        if (done) return;
        e.stopPropagation();
        swallowClick.current = true;
        finish();
      }}
      onClickCapture={(e) => {
        if (!swallowClick.current && done) return;
        swallowClick.current = false;
        e.stopPropagation();
        e.preventDefault();
        finish();
      }}
      onKeyDownCapture={(e) => {
        if (done) return;
        finish();
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...away.props()}
    >
      <div className={styles.veil} />

      <div className={styles.portrait}>
        <HikerPortrait hikerId={hiker.id} className={styles.portraitPicture} />
      </div>
      <h2 className={styles.name}>{hiker.name.toUpperCase()}</h2>

      {levelUp ? (
        <>
          <div className={styles.barLabels}>
            <span className={styles.barLevel}>LEVEL {level - 1}</span>
            <span>
              XP {bar.have} / {bar.need}
            </span>
          </div>
          <div
            className={styles.bar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={bar.need}
            aria-valuenow={bar.have}
            aria-label="XP"
          >
            <div className={styles.barFill} style={{ width: `${(100 * bar.have) / bar.need}%` }} />
          </div>
          <div className={styles.levelBadge}>LEVEL {level}!</div>
        </>
      ) : (
        <div className={styles.photoBadge}>OLD PHOTO</div>
      )}

      <div className={styles.pickHead}>
        <span className={styles.pickTitle}>PICK A NEW TRAIT</span>
        <span className={styles.pickHelp}>
          {levelUp
            ? 'Drag one onto a slot below. Dropping it on a trait replaces that trait.'
            : `Drag one onto ${photoTrait ?? 'the trait'}. It takes that trait’s place.`}
        </span>
      </div>

      <div className={styles.options} style={{ gap }}>
        {open.options.map((option, i) => (
          <OptionSpot
            key={i}
            index={i}
            view={optionCard(hiker, option)}
            scale={scale}
            delay={T.cardsAt + i * T.dealGapSeconds}
            selected={selected === i}
            held={dragged?.option === i && !dragged.placed}
            placed={placement?.option === i}
            onSelect={() => setSelected((s) => (s === i ? null : i))}
            onTakeBack={() => {
              setPlacement(null);
              setSelected(i);
            }}
          />
        ))}
      </div>

      <h3 className={styles.traitsHead}>YOUR TRAITS</h3>
      <div className={styles.tiles}>
        {hiker.slots.map((slot, i) => {
          const mine = placement?.slot === i ? placement : null;
          const option = mine ? open.options[mine.option] : undefined;
          return (
            <Tile
              key={i}
              slotType={slot.type}
              current={badges[i]}
              placed={option ? optionBadge(option, i, slot.type) : undefined}
              placedOption={mine?.option}
              ghost={mine ? placedGhost : null}
              fit={targets?.slots[i]}
              hovered={hoverArg === String(i)}
              dropProps={slots.props(String(i))}
              onPlace={() => place(i)}
            />
          );
        })}
        {plus && (
          <PlusTile
            placed={placement?.slot === NEW_SLOT ? open.options[placement.option] : undefined}
            placedOption={placement?.slot === NEW_SLOT ? placement.option : undefined}
            ghost={placement?.slot === NEW_SLOT ? placedGhost : null}
            fit={targets ? (targets.plus ? 'empty' : 'no') : undefined}
            hovered={hoverArg === NEW_SLOT}
            dropProps={slots.props(NEW_SLOT)}
            onPlace={() => place(NEW_SLOT)}
          />
        )}
      </div>

      <div className={styles.buttons}>
        {levelUp && (
          <button type="button" className={styles.keep} onClick={() => setAsking(true)}>
            KEEP MY TRAITS
          </button>
        )}
        <button
          type="button"
          className={styles.confirm}
          disabled={!placement}
          onClick={() => placement && onAction(pickAction(placement))}
        >
          CONFIRM
        </button>
      </div>

      {asking && (
        <ConfirmDialog
          title={`Keep ${hiker.name}’s traits?`}
          message={`${hiker.name} gets no new trait for level ${level}. This can’t be undone.`}
          confirmLabel="Keep my traits"
          cancelLabel="Go back"
          focusCancel
          onCancel={() => setAsking(false)}
          onConfirm={() => onAction({ type: 'pickTrait', option: -1, keep: true })}
        />
      )}
    </div>
  );
}

const toTarget = (arg: string | undefined): SlotTarget =>
  arg === NEW_SLOT ? NEW_SLOT : Number(arg ?? -1);

/** Enter or Space on something that acts like a button. */
const pressKeys = (act: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    act();
  }
};

/** An option's place in the row: the card, or a dashed outline while it's held or placed. */
function OptionSpot({
  index,
  view,
  scale,
  delay,
  selected,
  held,
  placed,
  onSelect,
  onTakeBack,
}: {
  index: number;
  view: OptionCardView;
  scale: number;
  delay: number;
  selected: boolean;
  held: boolean;
  placed: boolean;
  onSelect(): void;
  onTakeBack(): void;
}) {
  const drag = useDrag({ kind: 'levelOption', option: index }, <Ghost view={view} />, {
    disabled: placed,
  });
  const size = { width: 240 * scale, height: 280 * scale, animationDelay: `${delay}s` };
  const name = view.badge.name;
  return (
    <div className={styles.optionSpot} style={size}>
      {held || placed ? (
        <button
          type="button"
          className={styles.placeholder}
          disabled={!placed}
          aria-label={placed ? `Take back ${name}` : undefined}
          onClick={onTakeBack}
        >
          {placed ? 'PLACED · TAKE BACK' : 'PICKED UP'}
        </button>
      ) : (
        <button
          type="button"
          className={styles.optionButton}
          aria-pressed={selected}
          aria-label={`${name}: ${view.typeLine}. ${view.text}${view.source ? ` ${view.source.label}.` : ''}`}
          style={{ transform: `scale(${scale})` }}
          onClick={onSelect}
          {...drag}
        >
          <OptionCard view={view} />
        </button>
      )}
    </div>
  );
}

/** The card under the pointer, smaller and tilted. */
function Ghost({ view }: { view: OptionCardView }) {
  return (
    <div className={styles.ghost} style={{ width: 240 * GHOST_SCALE, height: 280 * GHOST_SCALE }}>
      <div className={styles.ghostCard} style={{ transform: `scale(${GHOST_SCALE})` }}>
        <OptionCard view={view} />
      </div>
    </div>
  );
}

/** A 240 × 280 option card: name strip, big badge, type, what it does, where it's from. */
function OptionCard({ view }: { view: OptionCardView }) {
  const textRef = useRef<HTMLSpanElement>(null);
  useFit(textRef, view.text, { mode: 'height', min: 10 });
  return (
    <div
      className={styles.card}
      style={{ '--ring': view.ring, '--fill': view.fill } as CSSProperties}
    >
      <div className={styles.cardName}>
        <FitLine text={view.name} size={15} className={styles.cardNameText} />
      </div>
      <div className={styles.cardArt}>
        <BigBadge badge={view.badge} />
      </div>
      <span className={styles.cardType}>{view.typeLine}</span>
      <span ref={textRef} className={styles.cardText}>
        {view.text}
      </span>
      {view.source && (
        <span className={styles.cardSource} style={{ background: view.source.color }}>
          {view.source.label}
        </span>
      )}
    </div>
  );
}

/** The option card's badge: a 58 px diamond, a 72 px circle, or a dashed + for a new slot. */
function BigBadge({ badge }: { badge: BadgeInfo }) {
  if (badge.shape === 'empty') {
    return (
      <span className={styles.bigDiamond} data-open>
        <span className={styles.bigPlus}>+</span>
      </span>
    );
  }
  const src = badge.traitId ? traitIconUrl(badge.traitId) : undefined;
  const icon = src ? (
    <span
      className={styles.bigIcon}
      style={{ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }}
    />
  ) : (
    <span className={styles.bigInitials}>{badge.initials}</span>
  );
  return badge.shape === 'circle' ? (
    <span className={styles.bigCircle}>{icon}</span>
  ) : (
    <span className={styles.bigDiamond}>
      <span className={styles.bigUnturn}>{icon}</span>
    </span>
  );
}

const CHIP: Record<Fit, string> = {
  replace: 'REPLACE',
  empty: 'EMPTY · DROP HERE',
  no: 'CAN’T GO HERE',
};

/** One of the hiker's slots: its type, badge (1.4×), name and a status chip. */
function Tile({
  slotType,
  current,
  placed,
  placedOption,
  ghost,
  fit,
  hovered,
  dropProps,
  onPlace,
}: {
  slotType: Hiker['slots'][number]['type'];
  current: BadgeInfo | undefined;
  /** The option put here, before CONFIRM. */
  placed: BadgeInfo | undefined;
  placedOption: number | undefined;
  /** The placed option's card, under the pointer when it's moved. */
  ghost: ReactNode;
  /** While an option is held: whether it goes here. */
  fit: Fit | undefined;
  hovered: boolean;
  dropProps: ReturnType<ReturnType<typeof useDrop>['props']>;
  onPlace(): void;
}) {
  const drag = useDrag(
    placedOption !== undefined ? { kind: 'levelOption', option: placedOption, placed: true } : null,
    ghost,
  );
  const shown = placed ?? current;
  const empty = !current?.traitId;
  const replaces = placed && !empty ? current?.name : undefined;
  const chip = fit ? CHIP[fit] : placed ? 'NEW' : empty ? 'EMPTY' : undefined;
  const clickable = !!fit && fit !== 'no';
  const name = shown?.traitId ? shown.name : 'Open slot';
  return (
    <div
      className={styles.tile}
      data-fit={fit}
      data-hovered={(hovered && fit !== 'no') || undefined}
      data-placed={!!placed || undefined}
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-disabled={!clickable}
      aria-label={`${SLOT_WORD[slotType]} slot: ${name}${replaces ? `, replacing ${replaces}` : ''}${chip ? `. ${chip}` : ''}`}
      onClick={clickable ? onPlace : undefined}
      onKeyDown={clickable ? pressKeys(onPlace) : undefined}
      {...dropProps}
      {...drag}
    >
      <span className={styles.tileType} style={{ color: slotColors(slotType).ring }}>
        {SLOT_WORD[slotType].toUpperCase()}
      </span>
      <span className={styles.tileBadge}>
        {shown && <TraitBadge badge={shown} size="card" as="span" passClick />}
      </span>
      <span className={styles.tileName}>{name.toUpperCase()}</span>
      {replaces && <span className={styles.tileWas}>Replaces {replaces}</span>}
      {chip && (
        <span className={styles.chip} data-tone={fit ?? (placed ? 'new' : 'idle')}>
          {chip}
        </span>
      )}
    </div>
  );
}

/** The + spot at the end of the row: where a NEW SLOT card goes. */
function PlusTile({
  placed,
  placedOption,
  ghost,
  fit,
  hovered,
  dropProps,
  onPlace,
}: {
  placed: TraitPick['options'][number] | undefined;
  placedOption: number | undefined;
  ghost: ReactNode;
  fit: Fit | undefined;
  hovered: boolean;
  dropProps: ReturnType<ReturnType<typeof useDrop>['props']>;
  onPlace(): void;
}) {
  const drag = useDrag(
    placedOption !== undefined ? { kind: 'levelOption', option: placedOption, placed: true } : null,
    ghost,
  );
  const slot = placed?.kind === 'slot' ? placed.slot : undefined;
  const clickable = !!fit && fit !== 'no';
  const chip =
    fit === 'empty' ? 'NEW SLOT · DROP HERE' : fit === 'no' ? CHIP.no : slot ? 'NEW' : undefined;
  return (
    <div
      className={styles.tile}
      data-plus
      data-fit={fit}
      data-hovered={(hovered && fit !== 'no') || undefined}
      data-placed={!!slot || undefined}
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-disabled={!clickable}
      aria-label={slot ? `New ${SLOT_WORD[slot]} slot` : 'Room for a new slot'}
      onClick={clickable ? onPlace : undefined}
      onKeyDown={clickable ? pressKeys(onPlace) : undefined}
      {...dropProps}
      {...drag}
    >
      {slot ? (
        <>
          <span className={styles.tileType} style={{ color: slotColors(slot).ring }}>
            {SLOT_WORD[slot].toUpperCase()}
          </span>
          <span className={styles.tileBadge}>
            <TraitBadge badge={optionBadge(placed!, -1, slot)} size="card" as="span" passClick />
          </span>
          <span className={styles.tileName}>NEW SLOT</span>
        </>
      ) : (
        <span className={styles.plus}>+</span>
      )}
      {chip && (
        <span className={styles.chip} data-tone={fit ?? 'new'}>
          {chip}
        </span>
      )}
    </div>
  );
}
