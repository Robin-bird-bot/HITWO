/**
 * The challenge pop-up (docs/mockups/Challenge.dc.html for each hiker,
 * ChallengeParty.dc.html for the whole party).
 *
 * - A red, blurred overlay with drifting Game Quotes "!" glyphs.
 * - The window: the banner (type and tier, the title between the tile's
 *   nodes, the scope), the art beside the quote, cost and "If not" box, then
 *   a column per section with its spaces, a status line, and ✓ / ✗.
 * - Under it, Continue with a one-line summary, and the packs of the hikers
 *   on the tile. Tap a glowing card or resource to put it in the selected
 *   space, or drag it onto any space (dragGive.tsx); tap a filled space to
 *   see what's in it and take things back.
 * - The window can be dragged by its banner (2a). Nothing is spent until
 *   Continue.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CARDS, CONDITIONS, ITEMS } from '../../content';
import { characterFor } from '../../content/characters';
import { ASSETS, cardArt } from '../../config/assets';
import {
  bagSlots,
  challengeHikers,
  harnessFor,
  openCardDef,
  pressesLeft,
  revealableFrom,
  validateAction,
  immovable,
  resourceCount,
  resourceLimit,
  STAT_NAMES,
  type Action,
  type ChallengeDef,
  type Effect,
  type GameState,
  type Gift,
  type Hiker,
  type HikerId,
  type ItemInstance,
  type OpenChallenge,
  type Requirement,
  type RiskReading,
  type StatName,
} from '../../engine';
import { Icon } from '../icons/Icon';
import { NODE_IMAGE } from '../map/looks';
import { STAT_META } from '../panels/hikerInfo';
import { itemName, resourceName } from '../scavenge/cardLook';
import { ItemCard as CardFace } from '../items/ItemCard';
import { useDraggable } from '../windows/useDraggable';
import { describeLog } from '../log/describeLog';
import { tileName } from '../panels/hikerInfo';
import { cardText } from './cardText';
import { NewTrial } from './TrialWindow';
import { DragGiveProvider } from './dragGive';
import { useDragGive } from './dragGiveContext';
import {
  canGive,
  filledCount,
  give,
  left,
  paidLabel,
  penaltyTag,
  reqIcons,
  isPick,
  reqLabel,
  riskNow,
  spendReadout,
  sectionStatus,
  select,
  skip,
  spaceNeed,
  startDraft,
  takeBack,
  toAction,
  toggleHarness,
  unskip,
  type Draft,
  type SectionStatus,
  type Source,
  type Target,
} from './challengeDraft';
import styles from './ChallengeWindow.module.css';

type ResolveAction = Extract<Action, { type: 'resolveChallenge' }>;

interface ChallengeWindowProps {
  state: GameState;
  simple: boolean;
  onResolve(action: ResolveAction): boolean;
  /** A Choice space: the party picks one of the two. */
  onChoose(cardId: string): void;
  /** A Trial: "Got it". */
  onAccept(): void;
  /** A button opportunity: one press. */
  onPress(action: PressAction): void;
}

type PressAction = Extract<Action, { type: 'pressButton' }>;

const TIER_WORD = { 1: 'I', 2: 'II', 3: 'III' } as const;

/** Who a card asks for, in the banner. */
const SCOPE_WORD = {
  party: 'WHOLE PARTY',
  each: 'EACH HIKER',
  select: 'PICK HIKERS',
  one: 'PICK ONE HIKER',
} as const;
const INNER_WIDTH = 1296;

export function ChallengeWindow({
  state,
  simple,
  onResolve,
  onChoose,
  onAccept,
  onPress,
}: ChallengeWindowProps) {
  const open = state.challenge;
  if (open && CARDS[open.cardId]?.kind === 'trial') {
    return <NewTrial state={state} open={open} onAccept={onAccept} />;
  }
  const card = open && openCardDef(open);
  if (!open || !card) return null;
  if (open.alternative) return <ChoicePicker open={open} onChoose={onChoose} />;
  return (
    <ChallengeBody
      key={`${open.cardId}@${open.tileId}`}
      state={state}
      open={open}
      card={card}
      simple={simple}
      onResolve={onResolve}
      onPress={onPress}
    />
  );
}

function ChallengeBody({
  state,
  open,
  card,
  simple,
  onResolve,
  onPress,
}: {
  state: GameState;
  open: OpenChallenge;
  card: ChallengeDef;
  simple: boolean;
  onResolve(action: ResolveAction): boolean;
  onPress(action: PressAction): void;
}) {
  const [draft, setDraft] = useState<Draft>(() => startDraft(state, open));
  const [peek, setPeek] = useState<Target | null>(null);
  // The whole pop-up moves as one piece, and can be dragged mostly off the
  // stage to see the map (Nov 5 update, 2a). It always opens in the middle.
  const { ref, windowProps, translate } = useDraggable<HTMLDivElement>('challenge', {
    keepOnStage: 120,
    remember: false,
  });
  const here = challengeHikers(state, open);
  const statuses = draft.sections.map((_, i) => sectionStatus(state, open, draft, i));
  const action = toAction(state, open, draft);

  const focusRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);

  const finish = () => {
    if (action) onResolve(action);
  };

  const tile = state.section.tiles[open.tileId];
  const nodes = [
    ...new Set((tile?.nodes ?? []).flatMap((n) => (n.type === 'caps' ? [] : [n.type]))),
  ];
  const kind = card.kind === 'opportunity' ? 'opportunity' : 'challenge';
  const typeLabel =
    card.kind === 'opportunity'
      ? 'OPPORTUNITY'
      : open.special === 'challenge'
        ? 'CHALLENGE SPACE'
        : card.risk
          ? 'RISK'
          : 'CHALLENGE';
  const everyoneOut = statuses.every((st) => st.decision === 'fail');
  const buttonLabel = card.risk
    ? 'ROLL'
    : card.buttons
      ? 'DONE'
      : card.kind === 'opportunity'
        ? everyoneOut
          ? 'SKIP'
          : 'TAKE THE DEAL'
        : 'CONTINUE';

  return (
    <DragGiveProvider state={state} open={open} draft={draft} onDraft={setDraft}>
      <div className={styles.overlay} data-moved={!!translate} data-kind={kind}>
        <Drift />
        <div
          ref={ref}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-label={`${typeLabel.charAt(0)}${typeLabel.slice(1).toLowerCase()}: ${card.name}`}
          tabIndex={-1}
          style={{ translate }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && action && e.target === e.currentTarget) finish();
            if (e.key === 'Escape') setPeek(null);
          }}
          {...windowProps}
          onPointerDown={(e) => {
            setPeek(null);
            windowProps.onPointerDown?.(e);
          }}
        >
          <div className={styles.window}>
            <header className={styles.banner} data-drag-handle>
              <span className={styles.bannerSide}>
                <Icon
                  name={kind === 'opportunity' ? 'star' : 'alert'}
                  size={20}
                  color="#FFF6EC"
                  strokeWidth={2.5}
                />
                {typeLabel} · TIER {TIER_WORD[open.tier]}
              </span>
              <span className={styles.titleRow}>
                {nodes.map((n) => (
                  <img key={`l-${n}`} className={styles.node} src={NODE_IMAGE[n]} alt="" />
                ))}
                <h2 className={styles.title}>{card.name.toUpperCase()}</h2>
                {nodes.map((n) => (
                  <img key={`r-${n}`} className={styles.node} src={NODE_IMAGE[n]} alt="" />
                ))}
              </span>
              <span className={`${styles.bannerSide} ${styles.bannerRight}`}>
                <Icon name="users" size={17} color="#FFF6EC" strokeWidth={2} />
                {SCOPE_WORD[card.scope]}
              </span>
            </header>

            <div className={styles.body}>
              <div className={styles.top}>
                <div className={styles.art}>
                  {card.art ? (
                    <img src={cardArt(card)} alt={card.name} draggable={false} />
                  ) : (
                    <div className={styles.noArt}>
                      <Icon
                        name={kind === 'opportunity' ? 'star' : 'alert'}
                        size={56}
                        color="rgba(255,246,236,0.5)"
                        strokeWidth={2}
                      />
                      <span>{card.name}</span>
                    </div>
                  )}
                </div>
                <div className={styles.words}>
                  {card.quote && <p className={styles.quote}>“{card.quote}”</p>}
                  <p className={styles.cost}>
                    {cardText(card, card.costText, { rolls: open.rolls, scale: open.scale })}
                  </p>
                  {!simple && !card.descriptionPlaceholder && (
                    <p className={styles.description}>{card.description}</p>
                  )}
                  {state.debugRolls && <RollsLine state={state} open={open} />}
                  {open.special === 'challenge' && (
                    <p className={styles.spaceReward}>
                      <Icon name="star" size={16} color="#E9B44C" strokeWidth={2.5} />
                      Challenge space: each hiker who passes also gets an item, Lucky for 1 day, or
                      double XP.
                    </p>
                  )}
                  {card.buttons ? (
                    <Happened state={state} cardId={card.id} />
                  ) : (
                    <p className={styles.hint}>{hintFor(state, open, card, draft)}</p>
                  )}
                  <div className={styles.spacer} />
                  <OutcomeBox card={card} open={open} />
                </div>
              </div>

              {draft.sections.length === 0 ? (
                <p className={styles.nobody}>Nobody here is affected. Nothing happens.</p>
              ) : (
                <div className={styles.sections}>
                  {draft.sections.map((s, i) =>
                    card.buttons ? (
                      <ButtonSection
                        key={s.hikerId ?? 'party'}
                        state={state}
                        card={card}
                        hikerId={s.hikerId}
                        onPress={onPress}
                      />
                    ) : card.spendAny ? (
                      <SpendSection
                        key={s.hikerId ?? 'party'}
                        index={i}
                        state={state}
                        open={open}
                        card={card}
                        draft={draft}
                        here={here}
                        peek={peek}
                        onDraft={setDraft}
                        onPeek={setPeek}
                      />
                    ) : card.risk ? (
                      <RiskSection
                        key={s.hikerId ?? 'party'}
                        index={i}
                        state={state}
                        open={open}
                        card={card}
                        draft={draft}
                        here={here}
                        peek={peek}
                        onDraft={setDraft}
                        onPeek={setPeek}
                      />
                    ) : (
                      <Section
                        key={s.hikerId ?? 'party'}
                        index={i}
                        state={state}
                        open={open}
                        card={card}
                        draft={draft}
                        status={
                          statuses[i] ?? { decision: undefined, impossible: false, missing: 0 }
                        }
                        here={here}
                        peek={peek}
                        columns={draft.sections.length}
                        onDraft={setDraft}
                        onPeek={setPeek}
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            ref={focusRef}
            type="button"
            className={styles.continue}
            disabled={!action}
            onClick={finish}
          >
            <span className={styles.continueLabel}>{buttonLabel}</span>
            <span className={styles.continueSub}>
              {summary(state, open, card, draft, statuses)}
            </span>
          </button>

          <div className={styles.packs}>
            {(card.risk || card.spendAny || card.cost.length > 0 ? here : []).map((h) =>
              card.risk || card.spendAny ? (
                <RiskPack
                  key={h.id}
                  state={state}
                  open={open}
                  card={card}
                  hiker={h}
                  draft={draft}
                  onDraft={setDraft}
                />
              ) : (
                <Pack
                  key={h.id}
                  state={state}
                  open={open}
                  card={card}
                  hiker={h}
                  draft={draft}
                  onDraft={setDraft}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </DragGiveProvider>
  );
}

/** "If not: every hiker…" → ["IF NOT", "Every hiker…"]. A Risk card's text has no prefix. */
function splitPenalty(text: string): [string, string] {
  const m = text.match(/^(If not|If failed):\s*(.*)$/s);
  if (!m) return ['THE RISK', text];
  const body = m[2] ?? '';
  return [(m[1] ?? '').toUpperCase(), body.charAt(0).toUpperCase() + body.slice(1)];
}

function hintFor(state: GameState, open: OpenChallenge, card: ChallengeDef, draft: Draft): string {
  if (card.risk) {
    return 'Use + in the packs below to spend things that lower a hiker’s danger, then Roll.';
  }
  if (card.spendAny) return 'Use + in the packs below to spend, then Take the deal.';
  if (isPick(card)) {
    return card.scope === 'one'
      ? 'Tick the one hiker who takes this, then Take the deal.'
      : 'Tick ✓ for each hiker who takes part. Untick to leave them out.';
  }
  if (card.kind === 'opportunity' && card.cost.length === 0) {
    return 'Take the deal, or ✗ to skip it.';
  }
  const t = draft.target;
  const req = t && card.cost[t.option]?.[t.req];
  const status = t ? sectionStatus(state, open, draft, t.section) : undefined;
  if (!t || !req || status?.decision) {
    return 'Tap a space to choose what to put in it. Nothing is spent until Continue.';
  }
  const who = draft.sections[t.section]?.hikerId;
  const name = who ? state.hikers.find((h) => h.id === who)?.name : undefined;
  const what = reqLabel(req, open).toLowerCase().replaceAll(' · ', ' or ');
  const space = `${what} space${name ? ` for ${name}` : ''}`;
  if (req.kind === 'caps') return `Tap the ${space} to pay from the party purse.`;
  if (req.kind === 'stat') return `Use + and − in the packs below to fill the ${space}.`;
  return `Tap a glowing card or resource below to put it in the ${space}, or drag one onto any space.`;
}

function summary(
  state: GameState,
  open: OpenChallenge,
  card: ChallengeDef,
  draft: Draft,
  statuses: SectionStatus[],
): string {
  if (!draft.sections.length) return 'NOTHING HAPPENS';
  if (card.risk) {
    const atRisk = draft.sections.filter(
      (_, i) => (riskNow(state, open, draft, i)?.value ?? 0) > 0,
    );
    return atRisk.length
      ? `${atRisk.length} ${atRisk.length === 1 ? 'HIKER' : 'HIKERS'} AT RISK`
      : 'EVERYONE IS SAFE';
  }
  if (card.buttons) return 'CLOSE IT';
  if (card.spendAny) {
    const units = draft.sections.reduce(
      (n, s) => n + s.gifts.reduce((m, g) => m + giftCountOf(g), 0),
      0,
    );
    return units ? `SPEND ${units}` : 'NOTHING SPENT';
  }
  if (isPick(card)) {
    const n = statuses.filter((st) => st.decision === 'pay').length;
    const missing = statuses.reduce((m, st) => m + (st.decision ? 0 : st.missing), 0);
    if (statuses.some((st) => !st.decision)) return `NEEDS ${missing} MORE`;
    return n ? `${n} ${n === 1 ? 'TAKES' : 'TAKE'} PART` : 'NOTHING HAPPENS';
  }
  if (card.kind === 'opportunity') {
    const s = statuses[0];
    if (s?.decision === 'fail') return 'NOTHING HAPPENS';
    if (s?.decision === 'pay') {
      const gifts = draft.sections[0]?.gifts ?? [];
      return gifts.length ? `GIVE ${paidLabel(gifts, state, open)}` : 'FREE';
    }
    return `NEEDS ${s?.missing ?? 0} MORE`;
  }
  const passes = statuses.filter((s) => s.decision === 'pay').length;
  const fails = statuses.filter((s) => s.decision === 'fail').length;
  const undecided = statuses.length - passes - fails;
  if (card.scope === 'party') {
    const s = statuses[0];
    if (s?.decision === 'pay')
      return `PAY ${paidLabel(draft.sections[0]?.gifts ?? [], state, open)}`;
    if (s?.decision === 'fail') return 'TAKE THE PENALTY';
    return `NEEDS ${s?.missing ?? 0} MORE`;
  }
  if (undecided) return `${undecided} ${undecided === 1 ? 'HIKER' : 'HIKERS'} STILL TO CHOOSE`;
  const injuryOnly =
    card.penalty.length === 1 && card.penalty[0]?.op === 'injury' && !card.penalty[0].chance;
  const failWord = injuryOnly
    ? fails === 1
      ? 'INJURY'
      : 'INJURIES'
    : fails === 1
      ? 'FAILS'
      : 'FAIL';
  return [passes ? `${passes} PASS` : '', fails ? `${fails} ${failWord}` : '']
    .filter(Boolean)
    .join(' · ');
}

// ── A section: the party, or one hiker ──────────────────────────────────────

interface SectionProps {
  index: number;
  state: GameState;
  open: OpenChallenge;
  card: ChallengeDef;
  draft: Draft;
  status: SectionStatus;
  here: readonly Hiker[];
  peek: Target | null;
  columns: number;
  onDraft(d: Draft): void;
  onPeek(t: Target | null): void;
}

function Section({
  index,
  state,
  open,
  card,
  draft,
  status,
  here,
  peek,
  columns,
  onDraft,
  onPeek,
}: SectionProps) {
  const s = draft.sections[index];
  if (!s) return null;
  const hiker = s.hikerId ? here.find((h) => h.id === s.hikerId) : undefined;
  const faces = hiker ? [hiker] : here;
  const spaces = card.cost.reduce((n, o) => n + o.length, 0);
  const colWidth = (INNER_WIDTH - (columns - 1) * 26) / columns;
  const size = Math.max(
    92,
    Math.min(hiker ? 150 : 160, Math.floor((colWidth - (spaces - 1) * 46) / Math.max(1, spaces))),
  );

  const tag = penaltyTag(card, open.rolls, hiker);
  const deal = card.kind === 'opportunity';
  // A Harness here can turn a fail into a pass; each one saves one section.
  const harness = harnessFor(state, open, s.hikerId);
  const harnessTaken =
    !!harness &&
    !s.harness &&
    draft.sections.some(
      (o, i) =>
        i !== index &&
        o.harness &&
        harnessFor(state, open, o.hikerId)?.item.uid === harness.item.uid,
    );
  const pickCard = isPick(card);
  // A card that moves who it picks can't pick someone who can't be moved.
  const stuck = pickCard && card.moves && hiker ? immovable(hiker) : false;
  const where = card.anyTile && hiker ? state.section.tiles[hiker.tileId] : undefined;
  const pill = pickCard
    ? status.decision === 'pay'
      ? {
          tone: 'pass',
          text: s.gifts.length ? `TAKES PART · ${paidLabel(s.gifts, state, open)}` : 'TAKES PART',
        }
      : status.decision === 'fail'
        ? { tone: 'fail', text: stuck ? 'CAN’T BE MOVED' : 'SITS OUT' }
        : { tone: 'needs', text: `NEEDS ${status.missing} MORE` }
    : deal
      ? status.decision === 'pay'
        ? {
            tone: 'pass',
            text: s.gifts.length
              ? `TAKES THE DEAL · ${paidLabel(s.gifts, state, open)}`
              : 'FREE · TAKE IT',
          }
        : status.decision === 'fail'
          ? { tone: 'fail', text: 'SKIPS IT' }
          : { tone: 'needs', text: `NEEDS ${status.missing} MORE` }
      : s.harness && harness
        ? { tone: 'pass', text: `PASSES · HARNESS −${harness.cost} DURABILITY` }
        : status.decision === 'pay'
          ? { tone: 'pass', text: `PASSES · ${paidLabel(s.gifts, state, open)}` }
          : status.decision === 'fail'
            ? {
                tone: 'fail',
                text: `${status.impossible && !s.skipped ? 'NOTHING FITS' : 'FAILS'} · ${tag}`,
              }
            : { tone: 'needs', text: `NEEDS ${status.missing} MORE` };

  return (
    <div className={styles.section} data-decision={status.decision ?? 'open'}>
      <div className={styles.who}>
        <span className={styles.faces}>
          {faces.map((h) => (
            <Face key={h.id} hikerId={h.id} size={34} />
          ))}
        </span>
        <span className={styles.whoName}>{hiker ? hiker.name.toUpperCase() : 'WHOLE PARTY'}</span>
        {where && <span className={styles.where}>ON {tileName(where).toUpperCase()}</span>}
      </div>

      <div className={styles.spaces}>
        {(pickCard && s.skipped ? [] : card.cost).map((option, o) => (
          <div key={o} className={styles.option}>
            {o > 0 && <span className={styles.or}>OR</span>}
            {option.map((req, r) => {
              const t = { section: index, option: o, req: r };
              return (
                <div key={r} className={styles.spaceWrap}>
                  {r > 0 && <span className={styles.or}>+</span>}
                  <Space
                    state={state}
                    open={open}
                    draft={draft}
                    target={t}
                    req={req}
                    size={size}
                    peeking={!!peek && sameTarget(peek, t)}
                    onDraft={onDraft}
                    onPeek={onPeek}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <span className={styles.pill} data-tone={pill.tone}>
        {pill.text}
      </span>
      <div className={styles.choose}>
        <button
          type="button"
          className={styles.check}
          data-on={status.decision === 'pay' && !s.harness}
          disabled={stuck || (status.decision !== 'pay' && !s.skipped)}
          aria-label={
            pickCard && hiker
              ? `${hiker.name} takes part`
              : hiker
                ? `${hiker.name} pays`
                : 'The party pays'
          }
          title={
            stuck
              ? `${hiker?.name} can’t be moved right now`
              : pickCard
                ? 'Take part'
                : s.skipped
                  ? 'Pay instead'
                  : 'Pays when the spaces are full'
          }
          onClick={() => s.skipped && onDraft(unskip(draft, index, card.scope === 'one'))}
        >
          <Icon name="check" size={22} strokeWidth={2.75} />
        </button>
        <button
          type="button"
          className={styles.cross}
          data-on={status.decision === 'fail'}
          aria-label={
            pickCard && hiker
              ? `${hiker.name} sits out`
              : deal
                ? 'Skip the deal'
                : hiker
                  ? `${hiker.name} takes the penalty`
                  : 'Skip and take the penalty'
          }
          title={deal ? 'Skip the deal' : hiker ? 'Take the penalty' : 'Skip and take the penalty'}
          onClick={() => onDraft(skip(draft, index))}
        >
          <Icon name="x" size={22} strokeWidth={2.75} />
        </button>
        {harness && (
          <button
            type="button"
            className={styles.harness}
            data-on={!!s.harness}
            disabled={harnessTaken}
            aria-label={`${harness.hiker.name}’s Harness passes it, for ${harness.cost} durability`}
            title={
              harnessTaken
                ? 'This Harness is already saving another fail'
                : `Pass with ${harness.hiker.name}’s Harness: −${harness.cost} durability`
            }
            onClick={() => onDraft(toggleHarness(draft, index))}
          >
            <Icon name="shirt" size={18} strokeWidth={2.25} />
            HARNESS
          </button>
        )}
      </div>
    </div>
  );
}

const sameTarget = (a: Target, b: Target) =>
  a.section === b.section && a.option === b.option && a.req === b.req;

// ── One space ───────────────────────────────────────────────────────────────

interface SpaceProps {
  state: GameState;
  open: OpenChallenge;
  draft: Draft;
  target: Target;
  req: Requirement;
  size: number;
  peeking: boolean;
  onDraft(d: Draft): void;
  onPeek(t: Target | null): void;
}

function Space({ state, open, draft, target, req, size, peeking, onDraft, onPeek }: SpaceProps) {
  const dnd = useDragGive();
  const section = draft.sections[target.section];
  const need = spaceNeed(state, open, draft, target);
  const got = filledCount(draft, target.section, target.option, target.req);
  const gifts =
    section?.option === target.option ? section.gifts.filter((g) => g.req === target.req) : [];
  const selected = !!draft.target && sameTarget(draft.target, target);
  const other =
    !!section?.skipped ||
    (section?.option !== undefined && section.option !== target.option && section.gifts.length > 0);
  const look = section?.skipped
    ? 'other'
    : got >= need
      ? 'full'
      : selected
        ? 'target'
        : other
          ? 'other'
          : 'idle';
  const k = size / 150;
  const label = reqLabel(req, open);

  const onClick = () => {
    if (req.kind === 'caps') {
      // Caps: one tap pays the whole amount from the purse, a second takes it back.
      if (got > 0) {
        let d = draft;
        for (const g of gifts) d = takeBack(d, target.section, g);
        onDraft(d);
        return;
      }
      let d = select(draft, target);
      for (let i = 0; i < need; i++) d = give(state, open, { ...d, target }, { kind: 'caps' });
      onDraft(d);
      return;
    }
    onDraft(select(draft, target));
    onPeek(gifts.length && !peeking ? target : null);
  };

  return (
    <div className={styles.spaceBox} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={styles.space}
        data-look={look}
        {...(dnd ? dnd.targetProps(target) : {})}
        style={{ width: size, height: size }}
        onClick={onClick}
        aria-label={`${label} space: ${need === 0 ? 'nothing needed' : `${got} of ${need}`}`}
      >
        {gifts.length === 0 ? (
          <EmptySpace req={req} open={open} label={label} state={state} need={need} k={k} />
        ) : (
          <FilledSpace gifts={gifts} state={state} open={open} k={k} />
        )}
        {need > 0 && (
          <span className={styles.count}>
            {got > 0 ? `${got}/${need}` : need > 1 ? `×${need}` : ''}
          </span>
        )}
        {need === 0 && <span className={styles.count}>✓</span>}
      </button>
      {peeking && gifts.length > 0 && (
        <div className={styles.peek} onPointerDown={(e) => e.stopPropagation()}>
          <span className={styles.peekHead}>
            IN THIS SPACE · {got}/{need}
          </span>
          {gifts.map((g, i) => (
            <div key={i} className={styles.peekRow}>
              <GiftIcon gift={g} state={state} open={open} />
              <span className={styles.peekName}>{giftName(g, state, open)}</span>
              {g.kind !== 'caps' && <Face hikerId={g.from} size={20} />}
              <button
                type="button"
                className={styles.peekReturn}
                aria-label={`Take back ${giftName(g, state, open)}`}
                onClick={() => {
                  const d = takeBack(draft, target.section, g);
                  onDraft({ ...d, target });
                  if (gifts.length === 1 && giftCountOf(g) === 1) onPeek(null);
                }}
              >
                <Icon name="x" size={13} color="#C9C2B2" strokeWidth={2.5} />
              </button>
            </div>
          ))}
          <span className={styles.peekHint}>Tap × to give it back</span>
        </div>
      )}
    </div>
  );
}

const giftCountOf = (g: Gift) => (g.kind === 'item' ? 1 : g.count);

function EmptySpace({
  req,
  open,
  label,
  state,
  need,
  k,
}: {
  req: Requirement;
  open: OpenChallenge;
  label: string;
  state: GameState;
  need: number;
  k: number;
}) {
  const icons = reqIcons(req, open);
  return (
    <span className={styles.empty} style={{ gap: 8 * k }}>
      {req.kind === 'caps' ? (
        <>
          <img src={ASSETS.icons.acornCaps} alt="" style={{ width: 44 * k, height: 44 * k }} />
          <span className={styles.emptyLabel}>
            PAY {need} CAP{need === 1 ? '' : 'S'}
          </span>
          <span className={styles.emptySub}>PURSE {state.caps}</span>
        </>
      ) : req.kind === 'stat' ? (
        <>
          <span className={styles.statIcons}>
            {req.stats.map((stat) => (
              <Icon
                key={stat}
                name={STAT_META[stat].icon}
                size={34 * k}
                color="rgba(241,234,219,0.75)"
                strokeWidth={2.25}
              />
            ))}
          </span>
          <span className={styles.emptyLabel}>{label}</span>
        </>
      ) : req.kind === 'durability' || req.kind === 'toolUse' ? (
        <>
          <Icon
            name={req.kind === 'durability' ? 'shirt' : 'hammer'}
            size={34 * k}
            color="rgba(241,234,219,0.75)"
            strokeWidth={2.25}
          />
          <span className={styles.emptyLabel}>{label}</span>
          <span className={styles.emptySub}>
            {req.kind === 'toolUse'
              ? 'FROM A TOOL IN A BAG'
              : req.slot === 'gear'
                ? 'FROM WORN GEAR'
                : req.oneItem
                  ? 'ALL FROM ONE WORN ITEM'
                  : 'FROM WORN CLOTHES'}
          </span>
        </>
      ) : req.kind === 'carryLimit' ? (
        <>
          <Icon name="backpack" size={34 * k} color="rgba(241,234,219,0.75)" strokeWidth={2.25} />
          <span className={styles.emptyLabel}>{label}</span>
          <span className={styles.emptySub}>NOTHING EXTRA</span>
        </>
      ) : (
        <>
          <Icon name="plus" size={38 * k} color="rgba(241,234,219,0.75)" strokeWidth={2.5} />
          <span className={styles.emptyLabel}>{label}</span>
          {icons.length > 0 && (
            <span className={styles.emptyIcons}>
              {icons.map((id) => (
                <img
                  key={id}
                  src={ASSETS.resources[id]}
                  alt=""
                  style={{ width: 26 * k, height: 26 * k }}
                />
              ))}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** Where up to 6 resource icons sit in a 150px space (the mockup's scatter). */
const SPOTS = [
  [15, 18],
  [75, 21],
  [45, 69],
  [15, 72],
  [80, 74],
  [48, 24],
];

function FilledSpace({
  gifts,
  state,
  open,
  k,
}: {
  gifts: Gift[];
  state: GameState;
  open: OpenChallenge;
  k: number;
}) {
  const items = gifts.filter((g) => g.kind === 'item');
  const units = gifts.flatMap((g) =>
    g.kind === 'resource' ? Array.from({ length: g.count }, () => g.resource) : [],
  );
  const stats = gifts.filter((g) => g.kind === 'stat');
  // Durability and tool uses: one row per item, with how much it gives.
  const points = new Map<string, { gift: ItemGift; n: number }>();
  for (const g of gifts) {
    if (g.kind !== 'durability' && g.kind !== 'toolUse') continue;
    const was = points.get(g.uid);
    points.set(g.uid, { gift: g, n: (was?.n ?? 0) + g.count });
  }
  const caps = gifts.reduce((n, g) => n + (g.kind === 'caps' ? g.count : 0), 0);
  const givers = [...new Set(gifts.flatMap((g) => (g.kind === 'caps' ? [] : [g.from])))];

  return (
    <>
      {items.map((g, i) => (
        <span
          key={g.kind === 'item' ? g.uid : i}
          className={styles.filledItem}
          style={{
            left: `calc(50% - ${46 * k}px + ${(i - (items.length - 1) / 2) * 30 * k}px)`,
            width: 93 * k,
            height: 130 * k,
            rotate: items.length > 1 ? `${(i - (items.length - 1) / 2) * 6}deg` : undefined,
          }}
        >
          {g.kind === 'item' && <MiniItem gift={g} state={state} open={open} width={93 * k} />}
        </span>
      ))}
      {units.slice(0, SPOTS.length).map((id, i) => (
        <img
          key={i}
          className={styles.filledRes}
          src={ASSETS.resources[id]}
          alt={resourceName(id)}
          style={{
            left: (SPOTS[i]?.[0] ?? 0) * k,
            top: (SPOTS[i]?.[1] ?? 0) * k,
            width: 54 * k,
            height: 54 * k,
          }}
        />
      ))}
      {stats.length > 0 && (
        <span className={styles.filledStat}>
          {STAT_NAMES.filter((st) => stats.some((g) => g.kind === 'stat' && g.stat === st)).map(
            (st) => (
              <span key={st} className={styles.filledStatRow}>
                <Icon name={STAT_META[st].icon} size={30 * k} color="#F1EADB" strokeWidth={2.25} />
                {stats.reduce((n, g) => n + (g.kind === 'stat' && g.stat === st ? g.count : 0), 0)}
              </span>
            ),
          )}
        </span>
      )}
      {points.size > 0 && (
        <span className={styles.filledStat}>
          {[...points.values()].map(({ gift, n }) => (
            <span key={gift.uid} className={styles.filledStatRow}>
              <MiniItem gift={gift} state={state} open={open} width={34 * k} />−{n}
            </span>
          ))}
        </span>
      )}
      {caps > 0 && (
        <span className={styles.filledStat}>
          <img src={ASSETS.icons.acornCaps} alt="" style={{ width: 48 * k, height: 48 * k }} />
          <span className={styles.emptyLabel}>
            {caps} CAP{caps === 1 ? '' : 'S'}
          </span>
        </span>
      )}
      {givers.length > 0 && (
        <span className={styles.givers}>
          {givers.slice(0, 4).map((id) => (
            <Face key={id} hikerId={id} size={22} />
          ))}
        </span>
      )}
    </>
  );
}

function giftName(g: Gift, state: GameState, open: OpenChallenge): string {
  switch (g.kind) {
    case 'resource':
      return `${resourceName(g.resource).toUpperCase()} ×${g.count}`;
    case 'item': {
      const item = itemOf(g, state, open);
      return itemName(item?.itemId ?? '').toUpperCase();
    }
    case 'caps':
      return `${g.count} CAP${g.count === 1 ? '' : 'S'}`;
    case 'stat':
      return `${STAT_META[g.stat].label.toUpperCase()} ×${g.count}`;
    case 'durability':
      return `${itemName(itemOf(g, state, open)?.itemId ?? '').toUpperCase()} · ${g.count} DURABILITY`;
    case 'toolUse':
      return `${itemName(itemOf(g, state, open)?.itemId ?? '').toUpperCase()} · ${g.count} USE${g.count === 1 ? '' : 'S'}`;
  }
}

type ItemGift = Extract<Gift, { kind: 'item' | 'durability' | 'toolUse' }>;

/** The item a gift comes from: in the giver's bag, or worn (durability). */
function itemOf(g: ItemGift, state: GameState, open: OpenChallenge) {
  const h = challengeHikers(state, open).find((x) => x.id === g.from);
  return (
    h?.inventory.bag.find((i) => i.uid === g.uid) ??
    Object.values(h?.inventory.equipped ?? {}).find((i) => i?.uid === g.uid)
  );
}

function GiftIcon({ gift, state, open }: { gift: Gift; state: GameState; open: OpenChallenge }) {
  if (gift.kind === 'resource') {
    return <img className={styles.peekIcon} src={ASSETS.resources[gift.resource]} alt="" />;
  }
  if (gift.kind === 'caps')
    return <img className={styles.peekIcon} src={ASSETS.icons.acornCaps} alt="" />;
  if (gift.kind === 'stat') {
    return <Icon name={STAT_META[gift.stat].icon} size={24} color="#F1EADB" strokeWidth={2.25} />;
  }
  return <MiniItem gift={gift} state={state} open={open} width={22} />;
}

function MiniItem({
  gift,
  state,
  open,
  width,
}: {
  gift: ItemGift;
  state: GameState;
  open: OpenChallenge;
  width: number;
}) {
  const item = itemOf(gift, state, open);
  return <ItemFace itemId={item?.itemId ?? ''} width={width} />;
}

/** A small item card (the compact real card): in packs, spaces and handed-in slots. */
export function ItemFace({
  itemId,
  item,
  width,
  style,
}: {
  itemId: string;
  /** The instance, for its Quality and what's left. */
  item?: ItemInstance;
  width: number;
  style?: CSSProperties;
}) {
  return (
    <CardFace
      itemId={itemId}
      width={width}
      compact
      {...(item ? { item } : {})}
      {...(style ? { style } : {})}
    />
  );
}

export function Face({ hikerId, size }: { hikerId: HikerId; size: number }) {
  const { color } = characterFor(hikerId);
  return (
    <img
      className={styles.face}
      src={ASSETS.portraits.placeholder}
      alt=""
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color}` }}
    />
  );
}

// ── The packs along the bottom ──────────────────────────────────────────────

function Pack({
  state,
  open,
  card,
  hiker,
  draft,
  onDraft,
}: {
  state: GameState;
  open: OpenChallenge;
  card: ChallengeDef;
  hiker: Hiker;
  draft: Draft;
  onDraft(d: Draft): void;
}) {
  const slots = bagSlots(state, hiker);
  const t = draft.target;
  const req = t && card.cost[t.option]?.[t.req];
  const statReq = req?.kind === 'stat' ? req : undefined;
  const pointReq = req?.kind === 'durability' || req?.kind === 'toolUse' ? req : undefined;
  const tryGive = (source: Source) => onDraft(give(state, open, draft, source));
  const resources = Object.entries(hiker.inventory.resources).filter(([, n]) => (n ?? 0) > 0);
  const dnd = useDragGive();
  // Could it go in any space? Then it can be dragged there, even if not the selected one.
  const somewhere = (source: Source) =>
    draft.sections.some((_, section) =>
      card.cost.some((reqs, option) =>
        reqs.some((_r, req) =>
          canGive(state, open, { ...draft, target: { section, option, req } }, source),
        ),
      ),
    );
  const drag = (source: Source, preview: ReactNode) =>
    dnd && somewhere(source) ? dnd.sourceProps(source, preview) : {};

  return (
    <div className={styles.pack}>
      <div className={styles.packHead}>
        <Face hikerId={hiker.id} size={30} />
        <span className={styles.packName}>{hiker.name.toUpperCase()}</span>
        <span className={styles.packCount}>
          BAG {hiker.inventory.bag.length}/{slots.total}
        </span>
      </div>

      {pointReq && t ? (
        <PointRows
          state={state}
          open={open}
          hiker={hiker}
          draft={draft}
          kind={pointReq.kind}
          onDraft={onDraft}
        />
      ) : statReq && t ? (
        <div className={styles.statRows}>
          {statReq.stats.map((stat) => (
            <StatRow
              key={stat}
              stat={stat}
              value={left(state, open, draft, { kind: 'stat', from: hiker.id, stat })}
              canAdd={canGive(state, open, draft, { kind: 'stat', from: hiker.id, stat })}
              given={givenStat(draft, t, hiker.id, stat)}
              zeroMorale={stat === 'morale' && hiker.stats.morale <= 0}
              onAdd={() => tryGive({ kind: 'stat', from: hiker.id, stat })}
              onRemove={() => {
                const g = draft.sections[t.section]?.gifts.find(
                  (x) =>
                    x.req === t.req && x.kind === 'stat' && x.from === hiker.id && x.stat === stat,
                );
                if (g) onDraft({ ...takeBack(draft, t.section, g), target: t });
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.bag}>
            {Array.from({ length: slots.total }, (_, i) => {
              const item = hiker.inventory.bag[i];
              if (!item) return <span key={i} className={styles.bagEmpty} />;
              const source: Source = { kind: 'item', from: hiker.id, uid: item.uid };
              const used = left(state, open, draft, source) < 1;
              const fits = canGive(state, open, draft, source);
              return (
                <button
                  key={item.uid}
                  type="button"
                  className={styles.bagItem}
                  data-fits={fits}
                  data-used={used}
                  aria-disabled={!fits}
                  aria-label={`${itemName(item.itemId)}${used ? ' (handed in)' : fits ? ': put it in the selected space' : ''}`}
                  onClick={() => fits && tryGive(source)}
                  {...drag(source, <ItemFace itemId={item.itemId} item={item} width={50} />)}
                >
                  <ItemFace itemId={item.itemId} item={item} width={50} />
                  {used && (
                    <span className={styles.usedMark}>
                      <Icon name="check" size={16} color="#1D2220" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={styles.resRow}>
            <span className={styles.resCount}>
              RES {resourceCount(hiker)}/{resourceLimit(state, hiker)}
            </span>
            {resources.length === 0 && <span className={styles.resNone}>None</span>}
            {resources.map(([id]) => {
              const source: Source = { kind: 'resource', from: hiker.id, resource: id };
              const n = left(state, open, draft, source);
              const fits = canGive(state, open, draft, source);
              return (
                <button
                  key={id}
                  type="button"
                  className={styles.res}
                  data-fits={fits}
                  data-empty={n < 1}
                  aria-disabled={!fits}
                  title={`${resourceName(id)} ×${n}`}
                  aria-label={`${resourceName(id)} ×${n}${fits ? ': put one in the selected space' : ''}`}
                  onClick={() => fits && tryGive(source)}
                  {...drag(
                    source,
                    <span className={styles.res} data-fits="true">
                      <img src={ASSETS.resources[id]} alt="" />
                    </span>,
                  )}
                >
                  <img src={ASSETS.resources[id]} alt="" />
                  <span className={styles.resBadge}>{n}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function givenStat(draft: Draft, t: Target, from: HikerId, stat: StatName): number {
  const s = draft.sections[t.section];
  if (!s || s.option !== t.option) return 0;
  return s.gifts.reduce(
    (n, g) =>
      n +
      (g.req === t.req && g.kind === 'stat' && g.from === from && g.stat === stat ? g.count : 0),
    0,
  );
}

/**
 * Worn clothes (durability) or bag tools (uses) to hand in a point at a time,
 * when the selected space asks for them.
 */
function PointRows({
  state,
  open,
  hiker,
  draft,
  kind,
  onDraft,
}: {
  state: GameState;
  open: OpenChallenge;
  hiker: Hiker;
  draft: Draft;
  kind: 'durability' | 'toolUse';
  onDraft(d: Draft): void;
}) {
  const t = draft.target;
  const items =
    kind === 'durability'
      ? Object.values(hiker.inventory.equipped).filter(
          (i): i is ItemInstance => !!i && ITEMS[i.itemId]?.type === 'clothes',
        )
      : hiker.inventory.bag.filter((i) => ITEMS[i.itemId]?.type === 'tool');
  if (!items.length) {
    return (
      <span className={styles.resNone}>
        {kind === 'durability' ? 'Not wearing any clothes.' : 'No tools in the bag.'}
      </span>
    );
  }
  return (
    <div className={styles.statRows}>
      {items.map((item) => {
        const source: Source = { kind, from: hiker.id, uid: item.uid };
        const given = t
          ? (draft.sections[t.section]?.gifts ?? [])
              .filter((g) => g.req === t.req && g.kind === kind && g.uid === item.uid)
              .reduce((n, g) => n + giftCountOf(g), 0)
          : 0;
        const can = canGive(state, open, draft, source);
        const word = kind === 'durability' ? 'durability' : 'use';
        return (
          <div key={item.uid} className={styles.statRow} data-active={can || given > 0}>
            <ItemFace itemId={item.itemId} item={item} width={26} />
            <span className={styles.statName}>{itemName(item.itemId).toUpperCase()}</span>
            <span className={styles.statValue}>{left(state, open, draft, source)}</span>
            <button
              type="button"
              className={styles.stepper}
              disabled={given < 1 || !t}
              aria-label={`Give 1 less ${word} from the ${itemName(item.itemId)}`}
              onClick={() => {
                const g = t
                  ? draft.sections[t.section]?.gifts.find(
                      (x) => x.req === t.req && x.kind === kind && x.uid === item.uid,
                    )
                  : undefined;
                if (g && t) onDraft({ ...takeBack(draft, t.section, g), target: t });
              }}
            >
              <Icon name="minus" size={16} strokeWidth={2.75} />
            </button>
            <span className={styles.statGiven}>{given}</span>
            <button
              type="button"
              className={styles.stepper}
              disabled={!can}
              aria-label={`Give 1 ${word} from the ${itemName(item.itemId)}`}
              onClick={() => onDraft(give(state, open, draft, source))}
            >
              <Icon name="plus" size={16} strokeWidth={2.75} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StatRow({
  stat,
  value,
  canAdd,
  given,
  zeroMorale,
  onAdd,
  onRemove,
}: {
  stat: StatName;
  value: number;
  canAdd: boolean;
  given: number;
  zeroMorale: boolean;
  onAdd(): void;
  onRemove(): void;
}) {
  const meta = STAT_META[stat];
  return (
    <div className={styles.statRow} data-active={canAdd || given > 0}>
      <Icon name={meta.icon} size={16} strokeWidth={2.25} />
      <span className={styles.statName}>{meta.label.toUpperCase()}</span>
      <span className={styles.statValue}>{value}</span>
      <button
        type="button"
        className={styles.stepper}
        disabled={given < 1}
        aria-label={`Give 1 less ${meta.label}`}
        onClick={onRemove}
      >
        <Icon name="minus" size={16} strokeWidth={2.75} />
      </button>
      <span className={styles.statGiven}>{given}</span>
      <button
        type="button"
        className={styles.stepper}
        disabled={!canAdd}
        aria-label={`Give 1 ${meta.label}`}
        title={zeroMorale ? 'Morale 0: can’t give Morale' : undefined}
        onClick={onAdd}
      >
        <Icon name="plus" size={16} strokeWidth={2.75} />
      </button>
    </div>
  );
}

/** Debug: the rolled numbers. */
function RollsLine({ state, open }: { state: GameState; open: OpenChallenge }) {
  const name = (id: HikerId) => state.hikers.find((h) => h.id === id)?.name ?? id;
  const x = Object.entries(open.rolls.x).map(([k, v]) => `${k} ${v}`);
  const y = Object.entries(open.rolls.y).flatMap(([id, own]) =>
    Object.entries(own).map(([k, v]) => `${name(id)} ${k} ${v}`),
  );
  const inc = Object.entries(open.rolls.includes).map(([k, v]) => `(${k} ${v ? 'in' : 'out'})`);
  return (
    <p className={styles.rolls}>
      ROLLS · LUCK {open.rolls.luck} · ×{open.scale}
      {x.length ? ` · X: ${x.join(', ')}` : ''}
      {y.length ? ` · Y: ${y.join(', ')}` : ''}
      {inc.length ? ` · ${inc.join(' ')}` : ''}
    </p>
  );
}

/** The drifting Game Quotes "!" pattern behind the window. */
export function Drift() {
  const glyphs = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 20; col++) out.push({ x: col * 120 + (row % 2) * 60, y: row * 120 });
    }
    return out;
  }, []);
  return (
    <div className={styles.drift} aria-hidden="true">
      <div className={styles.driftTilt}>
        <div className={styles.driftMove}>
          {glyphs.map((g, i) => (
            <span key={i} style={{ left: g.x, top: g.y }}>
              !
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── The "If not" box, or an opportunity's reward ───────────────────────────

function OutcomeBox({
  card,
  open,
  rolls,
}: {
  card: ChallengeDef;
  open: OpenChallenge;
  rolls?: OpenChallenge['rolls'];
}) {
  const opts = { rolls: rolls ?? open.rolls, scale: open.scale };
  if (card.kind === 'opportunity') {
    return (
      <div className={styles.reward}>
        <span className={styles.rewardIcon}>
          <Icon name="star" size={28} color="#A6DDBC" strokeWidth={2.5} />
        </span>
        <span className={styles.penaltyWords}>
          <span className={styles.rewardLabel}>REWARD</span>
          <span className={styles.penaltyText}>{cardText(card, card.rewardText ?? [], opts)}</span>
        </span>
      </div>
    );
  }
  const [label, body] = splitPenalty(cardText(card, card.penaltyText, opts));
  return (
    <div className={styles.penalty}>
      <span className={styles.penaltyIcon}>
        <Icon name="alert" size={28} color="#F39A86" strokeWidth={2.5} />
      </span>
      <span className={styles.penaltyWords}>
        <span className={styles.penaltyLabel}>{label}</span>
        <span className={styles.penaltyText}>{body}</span>
      </span>
    </div>
  );
}

// ── Risk challenges: each hiker's danger, and what they spend ───────────────

const LOSS_UNIT: Record<StatName, string> = {
  energy: 'ENERGY',
  appetite: 'APPETITE',
  morale: 'MORALE',
};

/** The big number, a line under it, and the status pill for a Risk reading. */
function readingWords(card: ChallengeDef, r: RiskReading | undefined) {
  const m = card.risk?.measure;
  if (!r || !m) return { big: '—', sub: '', pill: 'SAFE', safe: true };
  switch (r.kind) {
    case 'chance':
      return {
        big: `${r.value}%`,
        sub: '',
        pill: r.value ? `${r.value}% CHANCE` : 'SAFE',
        safe: r.value === 0,
      };
    case 'threshold':
      return {
        big: `${r.carried ?? 0} / ${r.at ?? 0}`,
        sub: 'CARRIED / THE LINE',
        pill: r.value ? 'OVER THE LINE' : 'SAFE',
        safe: r.value === 0,
      };
    case 'loss': {
      const unit = m.kind === 'loss' && m.stat ? LOSS_UNIT[m.stat] : 'PER FOOD CARD';
      return {
        big: `−${r.value}`,
        sub: unit,
        pill: r.value ? `LOSES ${r.value}` : 'NO LOSS',
        safe: r.value === 0,
      };
    }
    case 'chain':
      return {
        big: (r.steps ?? []).map((v) => `${v}%`).join(' · '),
        sub: 'EACH TILE BACK',
        pill: r.value ? 'BLOWN BACK' : 'STAYS PUT',
        safe: r.value === 0,
      };
  }
}

interface Readout {
  label: string;
  big: string;
  sub: string;
  pill: string;
  safe: boolean;
}

function RiskSection(props: SpendColumnProps) {
  const r = riskNow(props.state, props.open, props.draft, props.index);
  const words = readingWords(props.card, r);
  return (
    <SpendColumn
      {...props}
      readout={{ ...words, label: props.card.risk?.measure.readout.toUpperCase() ?? '' }}
    />
  );
}

/** What a spend-any section would get (Citro Tub, Abandoned Ranger Station…). */
function spendWords(
  state: GameState,
  open: OpenChallenge,
  card: ChallengeDef,
  draft: Draft,
  index: number,
): Readout {
  const spend = card.spendAny;
  const r = spendReadout(state, open, draft, index);
  if (!spend) return { label: '', big: '', sub: '', pill: '', safe: true };
  const pct = spend.every ? chanceText(spend.every.chance, open) : '';
  switch (spend.readout) {
    case 'statAfter': {
      const after = r.statAfter ?? 0;
      const got = (spend.thresholds ?? []).filter((t) => r.units > 0 && after <= t.atMost);
      const names = got.flatMap((t) => t.effects.map(effectName)).join(' + ');
      return {
        label: `${'stat' in spend.what ? STAT_META[spend.what.stat].label.toUpperCase() : ''} AFTER`,
        big: String(after),
        sub:
          after <= 0
            ? '0: AN INJURY!'
            : names || (r.units ? 'NOT LOW ENOUGH YET' : 'SPEND TO EARN'),
        pill: names ? `GETS ${names}` : 'NOTHING YET',
        safe: !!names,
      };
    }
    case 'tries':
      return {
        label: 'SEARCHES',
        big: String(r.tries ?? 0),
        sub: `${pct} EACH · ${spend.every?.n ?? 1} ${unitWord(spend)} A SEARCH`,
        pill: r.tries ? `${r.tries} ${r.tries === 1 ? 'TRY' : 'TRIES'} AT ${pct}` : 'NO SEARCH YET',
        safe: !!r.tries,
      };
    case 'swaps':
      return {
        label: 'TO SWAP',
        big: String(r.units),
        sub: 'EACH FOR A RANDOM ONE',
        pill: r.units ? `SWAPS ${r.units}` : 'NOTHING YET',
        safe: r.units > 0,
      };
    case 'peeks':
      return {
        label: 'PEEKS',
        big: String(r.units),
        sub: `1 TOOL USE EACH${spend.max ? ` · UP TO ${spend.max}` : ''}`,
        pill: r.units ? `PEEKS AT ${r.units} ${r.units === 1 ? 'TILE' : 'TILES'}` : 'NOTHING YET',
        safe: r.units > 0,
      };
    case 'luck': {
      const each = spend.each?.find((e) => e.op === 'tileLuck');
      const per =
        each && each.op === 'tileLuck' && typeof each.amount === 'number' ? each.amount : 0;
      return {
        label: 'LUCK HERE',
        big: `+${r.units * per}`,
        sub: 'SCAVENGING ON THIS TILE UNTIL MORNING',
        pill: r.units ? `+${r.units * per} LUCK` : 'NOTHING YET',
        safe: r.units > 0,
      };
    }
  }
}

/** What a spend-any section spends, for readouts: "ENERGY", "RESOURCES". */
function unitWord(spend: NonNullable<ChallengeDef['spendAny']>): string {
  const what = spend.what;
  if ('stat' in what) return STAT_META[what.stat].label.toUpperCase();
  if ('resources' in what) return 'RESOURCES';
  if ('items' in what) return 'ITEMS';
  return 'TOOL USES';
}

const chanceText = (c: number | string, open: OpenChallenge) =>
  typeof c === 'number' ? `${Math.round(c * 100)}%` : `${open.rolls.x[c] ?? '?'}%`;

/** A short name for an effect, for readouts: "CITRO DRINK", "ENERGIZED". */
function effectName(e: Effect): string {
  if (e.op === 'gainItem') return e.itemId ? itemName(e.itemId).toUpperCase() : 'AN ITEM';
  if (e.op === 'condition') return (CONDITIONS[e.id]?.name ?? e.id).toUpperCase();
  return 'A REWARD';
}

function SpendSection(props: SpendColumnProps) {
  return (
    <SpendColumn
      {...props}
      readout={spendWords(props.state, props.open, props.card, props.draft, props.index)}
    />
  );
}

interface SpendColumnProps {
  index: number;
  state: GameState;
  open: OpenChallenge;
  card: ChallengeDef;
  draft: Draft;
  here: readonly Hiker[];
  peek: Target | null;
  onDraft(d: Draft): void;
  onPeek(t: Target | null): void;
}

/** A column where a hiker (or the party) spends from the packs, with a live readout. */
function SpendColumn({
  index,
  state,
  open,
  draft,
  here,
  peek,
  onDraft,
  onPeek,
  readout: words,
}: SpendColumnProps & { readout: Readout }) {
  const s = draft.sections[index];
  if (!s) return null;
  const hiker = here.find((h) => h.id === s.hikerId);
  const who = hiker ? hiker.name : 'The party';
  const t = { section: index, option: 0, req: 0 };
  const peeking = !!peek && sameTarget(peek, t);
  const units = s.gifts.reduce((n, g) => n + giftCountOf(g), 0);
  return (
    <div className={styles.section}>
      <div className={styles.who}>
        <span className={styles.faces}>
          {(hiker ? [hiker] : here).map((h) => (
            <Face key={h.id} hikerId={h.id} size={34} />
          ))}
        </span>
        <span className={styles.whoName}>{hiker ? hiker.name.toUpperCase() : 'WHOLE PARTY'}</span>
      </div>
      <div className={styles.riskBox} data-safe={words.safe}>
        <span className={styles.riskLabel}>{words.label}</span>
        <span className={styles.riskValue} data-long={words.big.length > 8}>
          {words.big}
        </span>
        {words.sub && <span className={styles.riskSub}>{words.sub}</span>}
      </div>
      <div className={styles.spaceBox} onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.spent}
          data-empty={units === 0}
          aria-label={
            units ? `${who} spends ${units}: see or take back` : `${who} spends nothing yet`
          }
          onClick={() => onPeek(units && !peeking ? t : null)}
        >
          <span className={styles.spentLabel}>
            {units ? `SPENDS ${units}` : 'SPENDS NOTHING YET'}
          </span>
          <span className={styles.spentIcons}>
            {s.gifts.slice(0, 6).map((g, i) => (
              <GiftIcon key={i} gift={g} state={state} open={open} />
            ))}
          </span>
        </button>
        {peeking && (
          <div className={styles.peek} onPointerDown={(e) => e.stopPropagation()}>
            <span className={styles.peekHead}>SPENT · {units}</span>
            {s.gifts.map((g, i) => (
              <div key={i} className={styles.peekRow}>
                <GiftIcon gift={g} state={state} open={open} />
                <span className={styles.peekName}>{giftName(g, state, open)}</span>
                <button
                  type="button"
                  className={styles.peekReturn}
                  aria-label={`Keep ${giftName(g, state, open)}`}
                  onClick={() => {
                    onDraft(takeBack(draft, index, g));
                    if (s.gifts.length === 1 && giftCountOf(g) === 1) onPeek(null);
                  }}
                >
                  <Icon name="x" size={13} color="#C9C2B2" strokeWidth={2.5} />
                </button>
              </div>
            ))}
            <span className={styles.peekHint}>Tap × to keep it</span>
          </div>
        )}
      </div>
      <span className={styles.pill} data-tone={words.safe ? 'pass' : 'fail'}>
        {words.pill}
      </span>
    </div>
  );
}

/**
 * The pack for a Risk or spend-any card: the things this hiker could spend,
 * with − and +. On a Risk card only what would lower their danger shows.
 */
function RiskPack({
  state,
  open,
  card,
  hiker,
  draft,
  onDraft,
}: {
  state: GameState;
  open: OpenChallenge;
  card: ChallengeDef;
  hiker: Hiker;
  draft: Draft;
  onDraft(d: Draft): void;
}) {
  const own = draft.sections.findIndex((s) => s.hikerId === hiker.id);
  const section = own >= 0 ? own : draft.sections.findIndex((s) => !s.hikerId);
  const gifts = (draft.sections[section]?.gifts ?? []).filter(
    (g) => g.kind !== 'caps' && g.from === hiker.id,
  );
  const chips: { source: Source; spent: number; left: number; can: boolean }[] = [];
  const statSpend =
    card.spendAny && 'stat' in card.spendAny.what ? card.spendAny.what.stat : undefined;
  if (statSpend) {
    const source: Source = { kind: 'stat', from: hiker.id, stat: statSpend };
    const spent = gifts.reduce((k, g) => k + (g.kind === 'stat' ? g.count : 0), 0);
    chips.push({
      source,
      spent,
      left: left(state, open, draft, source),
      can: canGive(state, open, draft, source),
    });
  }
  for (const [id, n] of Object.entries(hiker.inventory.resources)) {
    if (!n || statSpend) continue;
    const source: Source = { kind: 'resource', from: hiker.id, resource: id };
    const spent = gifts.reduce(
      (k, g) => k + (g.kind === 'resource' && g.resource === id ? g.count : 0),
      0,
    );
    const can = canGive(state, open, draft, source);
    if (can || spent) chips.push({ source, spent, left: left(state, open, draft, source), can });
  }
  for (const item of statSpend ? [] : hiker.inventory.bag) {
    const source: Source = { kind: 'item', from: hiker.id, uid: item.uid };
    const spent = gifts.some((g) => g.kind === 'item' && g.uid === item.uid) ? 1 : 0;
    const can = canGive(state, open, draft, source);
    if (can || spent) chips.push({ source, spent, left: 1 - spent, can });
  }
  // Clothing durability (Hypothermia) and tool uses (Old Trail Sign), a point at a time.
  const points: [Source['kind'], ItemInstance][] = [
    ...Object.values(hiker.inventory.equipped).flatMap((i): [Source['kind'], ItemInstance][] =>
      i && ITEMS[i.itemId]?.type === 'clothes' ? [['durability', i]] : [],
    ),
    ...hiker.inventory.bag.flatMap((i): [Source['kind'], ItemInstance][] =>
      ITEMS[i.itemId]?.type === 'tool' ? [['toolUse', i]] : [],
    ),
  ];
  for (const [kind, item] of statSpend ? [] : points) {
    if (kind !== 'durability' && kind !== 'toolUse') continue;
    const source: Source = { kind, from: hiker.id, uid: item.uid };
    const spent = gifts.reduce(
      (k, g) => k + (g.kind === kind && g.uid === item.uid ? g.count : 0),
      0,
    );
    const can = canGive(state, open, draft, source);
    if (can || spent) chips.push({ source, spent, left: left(state, open, draft, source), can });
  }
  const back = (source: Source) => {
    const g = gifts.find(
      (x) =>
        (source.kind === 'resource' && x.kind === 'resource' && x.resource === source.resource) ||
        (source.kind === 'item' && x.kind === 'item' && x.uid === source.uid) ||
        (source.kind === 'stat' && x.kind === 'stat' && x.stat === source.stat) ||
        ((source.kind === 'durability' || source.kind === 'toolUse') &&
          x.kind === source.kind &&
          x.uid === source.uid),
    );
    if (g && section >= 0) onDraft(takeBack(draft, section, g));
  };
  const itemOfUid = (uid: string) =>
    (
      hiker.inventory.bag.find((i) => i.uid === uid) ??
      Object.values(hiker.inventory.equipped).find((i) => i?.uid === uid)
    )?.itemId ?? '';
  return (
    <div className={styles.pack}>
      <div className={styles.packHead}>
        <Face hikerId={hiker.id} size={30} />
        <span className={styles.packName}>{hiker.name.toUpperCase()}</span>
        <span className={styles.packCount}>
          RES {resourceCount(hiker)}/{resourceLimit(state, hiker)} · BAG{' '}
          {hiker.inventory.bag.length}
        </span>
      </div>
      {chips.length === 0 ? (
        <span className={styles.resNone}>
          {card.risk ? 'Nothing to spend that would help.' : 'Nothing that fits.'}
        </span>
      ) : (
        <div className={styles.chips}>
          {chips.map(({ source, spent, left: n, can }) => {
            const label =
              source.kind === 'resource'
                ? resourceName(source.resource)
                : source.kind === 'item'
                  ? itemName(itemOfUid(source.uid))
                  : source.kind === 'durability'
                    ? `durability from the ${itemName(itemOfUid(source.uid))}`
                    : source.kind === 'toolUse'
                      ? `use of the ${itemName(itemOfUid(source.uid))}`
                      : source.kind === 'stat'
                        ? STAT_META[source.stat].label
                        : 'caps';
            const key =
              source.kind === 'resource'
                ? source.resource
                : source.kind === 'item' ||
                    source.kind === 'durability' ||
                    source.kind === 'toolUse'
                  ? `${source.kind}:${source.uid}`
                  : 'stat';
            return (
              <div key={key} className={styles.chip} data-spent={spent > 0}>
                {source.kind === 'resource' ? (
                  <img className={styles.chipIcon} src={ASSETS.resources[source.resource]} alt="" />
                ) : source.kind === 'item' ||
                  source.kind === 'durability' ||
                  source.kind === 'toolUse' ? (
                  <ItemFace itemId={itemOfUid(source.uid)} width={24} />
                ) : source.kind === 'stat' ? (
                  <Icon name={STAT_META[source.stat].icon} size={22} strokeWidth={2.25} />
                ) : null}
                <span className={styles.chipCount}>
                  {source.kind === 'item'
                    ? ''
                    : source.kind === 'stat' ||
                        source.kind === 'durability' ||
                        source.kind === 'toolUse'
                      ? `${n} LEFT`
                      : `×${n}`}
                </span>
                <button
                  type="button"
                  className={styles.stepper}
                  disabled={!spent}
                  aria-label={`Keep 1 ${label}`}
                  onClick={() => back(source)}
                >
                  <Icon name="minus" size={14} strokeWidth={2.75} />
                </button>
                <span className={styles.statGiven}>{spent}</span>
                <button
                  type="button"
                  className={styles.stepper}
                  disabled={!can}
                  aria-label={`Spend 1 ${label}`}
                  onClick={() => onDraft(give(state, open, draft, source))}
                >
                  <Icon name="plus" size={14} strokeWidth={2.75} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── A Choice space: two challenges, the party picks one ─────────────────────

function ChoicePicker({ open, onChoose }: { open: OpenChallenge; onChoose(cardId: string): void }) {
  const options = [
    { cardId: open.cardId, rolls: open.rolls },
    ...(open.alternative ? [open.alternative] : []),
  ].flatMap((o) => {
    const card = openCardDef({ ...open, cardId: o.cardId });
    return card ? [{ card, rolls: o.rolls }] : [];
  });
  return (
    <div className={styles.overlay} data-kind="challenge">
      <Drift />
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Choice: pick a challenge"
      >
        <div className={styles.window}>
          <header className={styles.banner}>
            <span className={styles.bannerSide}>
              <Icon name="split" size={20} color="#FFF6EC" strokeWidth={2.5} />
              CHOICE SPACE · TIER {TIER_WORD[open.tier]}
            </span>
            <span className={styles.titleRow}>
              <h2 className={styles.title}>PICK ONE</h2>
            </span>
            <span className={`${styles.bannerSide} ${styles.bannerRight}`}>
              <Icon name="users" size={17} color="#FFF6EC" strokeWidth={2} />
              THE PARTY DECIDES
            </span>
          </header>
          <div className={styles.choices}>
            {options.map(({ card, rolls }) => (
              <div key={card.id} className={styles.choice}>
                <div className={styles.choiceArt}>
                  {card.art ? (
                    <img src={cardArt(card)} alt={card.name} draggable={false} />
                  ) : (
                    <div className={styles.noArt}>
                      <Icon name="alert" size={48} color="rgba(255,246,236,0.5)" strokeWidth={2} />
                      <span>{card.name}</span>
                    </div>
                  )}
                </div>
                <div className={styles.choiceHead}>
                  <h3 className={styles.choiceName}>{card.name.toUpperCase()}</h3>
                  <span className={styles.choiceScope}>
                    {card.risk ? 'RISK · ' : ''}
                    {SCOPE_WORD[card.scope]}
                  </span>
                </div>
                <p className={styles.cost}>
                  {cardText(card, card.costText, { rolls, scale: open.scale })}
                </p>
                <OutcomeBox card={card} open={open} rolls={rolls} />
                <button type="button" className={styles.choose1} onClick={() => onChoose(card.id)}>
                  TAKE ON {card.name.toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Button opportunities ────────────────────────────────────────────────────

/** A section's buttons: one row for the party, or one per hiker. Each press happens at once. */
function ButtonSection({
  state,
  card,
  hikerId,
  onPress,
}: {
  state: GameState;
  card: ChallengeDef;
  hikerId: HikerId | undefined;
  onPress(action: PressAction): void;
}) {
  const hiker = hikerId ? state.hikers.find((h) => h.id === hikerId) : undefined;
  const presses: { key: string; label: string; action: PressAction }[] = [];
  // A limit shared by several buttons (Snake Slots' 3 ways to pay) shows once, by the name.
  const shared: string[] = [];
  // The odds of a slots button, shown while hovering or focusing its buttons.
  let odds: { label: string; pct: number }[] | undefined;
  for (const b of card.buttons ?? []) {
    if (b.per === 'hiker' && !hiker) continue;
    const base = {
      type: 'pressButton' as const,
      button: b.id,
      ...(hiker ? { hikerId: hiker.id } : {}),
    };
    const leftNow = pressesLeft(state, b, hiker?.id);
    const count = leftNow === undefined ? '' : ` (${leftNow} LEFT)`;
    if (b.kind === 'slots') {
      const total = b.table.reduce((n, o) => n + o.weight, 0);
      odds = b.table.map((o) => ({ label: o.label, pct: Math.round((o.weight / total) * 100) }));
      if (leftNow !== undefined) {
        shared.push(`${leftNow} ${b.label}${leftNow === 1 ? '' : 'S'} LEFT`);
      }
      b.pay.forEach((p, i) =>
        presses.push({
          key: `${b.id}-${i}`,
          label: `${b.label} · ${p.amount} ${STAT_META[p.stat].label.toUpperCase()}`,
          action: { ...base, choice: String(i) },
        }),
      );
    } else if (b.kind === 'revealConnected') {
      for (const t of hiker ? revealableFrom(state, hiker) : []) {
        presses.push({
          key: `${b.id}-${t.id}`,
          label: `${b.label} ${tileName(t).toUpperCase()}`,
          action: { ...base, choice: t.id },
        });
      }
    } else {
      presses.push({ key: b.id, label: `${b.label}${count}`, action: base });
    }
  }
  const reasons = presses.map((p) => validateAction(state, p.action) ?? undefined);
  // When nothing here can be pressed, say why in words (a limit says it on its own).
  const offWhy =
    presses.length > 0 && reasons.every(Boolean) && reasons[0] !== 'No presses left.'
      ? reasons[0]
      : undefined;
  return (
    <div className={styles.section}>
      <div className={styles.who}>
        {hiker && <Face hikerId={hiker.id} size={34} />}
        <span className={styles.whoName}>{hiker ? hiker.name.toUpperCase() : 'WHOLE PARTY'}</span>
        {shared.map((t) => (
          <span key={t} className={styles.pressLeft}>
            {t}
          </span>
        ))}
      </div>
      <div className={styles.pressWrap}>
        <div className={styles.buttons}>
          {presses.length === 0 && (
            <span className={styles.resNone}>
              {card.buttons?.some((b) => b.kind === 'revealConnected')
                ? 'Every connected tile is already known.'
                : 'Nothing to press here.'}
            </span>
          )}
          {presses.map((p, i) => {
            const why = reasons[i];
            return (
              <button
                key={p.key}
                type="button"
                className={styles.pressButton}
                disabled={!!why}
                title={why}
                onClick={() => onPress(p.action)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        {offWhy && <p className={styles.pressOff}>{offWhy}</p>}
        {odds && (
          <div className={styles.odds} role="tooltip">
            <span className={styles.oddsHead}>THE ODDS, EACH PULL</span>
            {odds.map((o) => (
              <span key={o.label} className={styles.oddsRow}>
                <span className={styles.oddsPct}>{o.pct}%</span>
                {o.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** What the presses so far did, from the trail log (the card's last opening on). */
function Happened({ state, cardId }: { state: GameState; cardId: string }) {
  const opened = state.log.findLast((e) => e.kind === 'challengeOpened' && e.cardId === cardId);
  const lines = describeLog(state, 60).filter(
    (l) => opened && l.id > opened.id && l.tone !== 'debug',
  );
  if (!lines.length)
    return (
      <p className={styles.hint}>Each press happens at once. Press Done when you’re finished.</p>
    );
  return (
    <ul className={styles.happened}>
      {lines.slice(-4).map((l) => (
        <li key={l.id}>{l.text}</li>
      ))}
    </ul>
  );
}
