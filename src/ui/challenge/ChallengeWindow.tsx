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
 *   space; tap a filled space to see what's in it and take things back.
 * - The window can be dragged by its banner (2a). Nothing is spent until
 *   Continue.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ITEMS } from '../../content';
import { characterFor } from '../../content/characters';
import { ASSETS, challengeArt } from '../../config/assets';
import {
  bagSlots,
  challengeHikers,
  openCardDef,
  resourceCount,
  STAT_NAMES,
  type Action,
  type ChallengeDef,
  type GameState,
  type Gift,
  type Hiker,
  type HikerId,
  type OpenChallenge,
  type Requirement,
  type StatName,
} from '../../engine';
import { BALANCE } from '../../config/balance';
import { Icon } from '../icons/Icon';
import { NODE_IMAGE } from '../map/looks';
import { STAT_META } from '../panels/hikerInfo';
import { ITEM_TYPE_COLORS, itemName, resourceName } from '../scavenge/cardLook';
import { useDraggable } from '../windows/useDraggable';
import { cardText } from './cardText';
import {
  canGive,
  filledCount,
  give,
  left,
  paidLabel,
  penaltyTag,
  reqIcons,
  reqLabel,
  sectionStatus,
  select,
  skip,
  spaceNeed,
  startDraft,
  takeBack,
  toAction,
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
}

const TIER_WORD = { 1: 'I', 2: 'II', 3: 'III' } as const;
const INNER_WIDTH = 1296;

export function ChallengeWindow({ state, simple, onResolve }: ChallengeWindowProps) {
  const open = state.challenge;
  const card = open && openCardDef(open);
  if (!open || !card) return null;
  return (
    <ChallengeBody
      key={`${open.cardId}@${open.tileId}`}
      state={state}
      open={open}
      card={card}
      simple={simple}
      onResolve={onResolve}
    />
  );
}

function ChallengeBody({
  state,
  open,
  card,
  simple,
  onResolve,
}: {
  state: GameState;
  open: OpenChallenge;
  card: ChallengeDef;
  simple: boolean;
  onResolve(action: ResolveAction): boolean;
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
  const party = card.scope === 'party';

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
  const penalty = cardText(card, card.penaltyText, { rolls: open.rolls, scale: open.scale });
  const [penaltyLabel, penaltyBody] = splitPenalty(penalty);

  return (
    <div className={styles.overlay} data-moved={!!translate}>
      <Drift />
      <div
        ref={ref}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Challenge: ${card.name}`}
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
              <Icon name="alert" size={20} color="#FFF6EC" strokeWidth={2.5} />
              CHALLENGE · TIER {TIER_WORD[open.tier]}
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
              {party ? 'WHOLE PARTY' : 'EACH HIKER'}
            </span>
          </header>

          <div className={styles.body}>
            <div className={styles.top}>
              <div className={styles.art}>
                {card.art ? (
                  <img src={challengeArt(card.id)} alt={card.name} draggable={false} />
                ) : (
                  <div className={styles.noArt}>
                    <Icon name="alert" size={56} color="rgba(255,246,236,0.5)" strokeWidth={2} />
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
                <p className={styles.hint}>{hintFor(state, open, card, draft)}</p>
                <div className={styles.spacer} />
                <div className={styles.penalty}>
                  <span className={styles.penaltyIcon}>
                    <Icon name="alert" size={28} color="#F39A86" strokeWidth={2.5} />
                  </span>
                  <span className={styles.penaltyWords}>
                    <span className={styles.penaltyLabel}>{penaltyLabel}</span>
                    <span className={styles.penaltyText}>{penaltyBody}</span>
                  </span>
                </div>
              </div>
            </div>

            {draft.sections.length === 0 ? (
              <p className={styles.nobody}>Nobody here is affected. Nothing happens.</p>
            ) : (
              <div className={styles.sections}>
                {draft.sections.map((s, i) => (
                  <Section
                    key={s.hikerId ?? 'party'}
                    index={i}
                    state={state}
                    open={open}
                    card={card}
                    draft={draft}
                    status={statuses[i] ?? { decision: undefined, impossible: false, missing: 0 }}
                    here={here}
                    peek={peek}
                    columns={draft.sections.length}
                    onDraft={setDraft}
                    onPeek={setPeek}
                  />
                ))}
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
          <span className={styles.continueLabel}>CONTINUE</span>
          <span className={styles.continueSub}>{summary(state, open, card, draft, statuses)}</span>
        </button>

        <div className={styles.packs}>
          {here.map((h) => (
            <Pack
              key={h.id}
              state={state}
              open={open}
              card={card}
              hiker={h}
              draft={draft}
              onDraft={setDraft}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** "If not: every hiker…" → ["IF NOT", "Every hiker…"]. */
function splitPenalty(text: string): [string, string] {
  const m = text.match(/^(If not|If failed):\s*(.*)$/s);
  if (!m) return ['IF NOT', text];
  const body = m[2] ?? '';
  return [(m[1] ?? '').toUpperCase(), body.charAt(0).toUpperCase() + body.slice(1)];
}

function hintFor(state: GameState, open: OpenChallenge, card: ChallengeDef, draft: Draft): string {
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
  return `Tap a glowing card or resource below to put it in the ${space}.`;
}

function summary(
  state: GameState,
  open: OpenChallenge,
  card: ChallengeDef,
  draft: Draft,
  statuses: SectionStatus[],
): string {
  if (!draft.sections.length) return 'NOTHING HAPPENS';
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
  const pill =
    status.decision === 'pay'
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
      </div>

      <div className={styles.spaces}>
        {card.cost.map((option, o) => (
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
          data-on={status.decision === 'pay'}
          disabled={status.decision !== 'pay' && !s.skipped}
          aria-label={hiker ? `${hiker.name} pays` : 'The party pays'}
          title={s.skipped ? 'Pay instead' : 'Pays when the spaces are full'}
          onClick={() => s.skipped && onDraft(unskip(draft, index))}
        >
          <Icon name="check" size={22} strokeWidth={2.75} />
        </button>
        <button
          type="button"
          className={styles.cross}
          data-on={status.decision === 'fail'}
          aria-label={hiker ? `${hiker.name} takes the penalty` : 'Skip and take the penalty'}
          title={hiker ? 'Take the penalty' : 'Skip and take the penalty'}
          onClick={() => onDraft(skip(draft, index))}
        >
          <Icon name="x" size={22} strokeWidth={2.75} />
        </button>
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
  const section = draft.sections[target.section];
  const need = spaceNeed(state, open, draft, target);
  const got = filledCount(draft, target.section, target.option, target.req);
  const gifts =
    section?.option === target.option ? section.gifts.filter((g) => g.req === target.req) : [];
  const selected = !!draft.target && sameTarget(draft.target, target);
  const off = req.kind === 'durability' || req.kind === 'toolUse';
  const other =
    !!section?.skipped ||
    (section?.option !== undefined && section.option !== target.option && section.gifts.length > 0);
  const look = off
    ? 'off'
    : section?.skipped
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
    if (off) return;
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
        style={{ width: size, height: size }}
        onClick={onClick}
        disabled={off}
        aria-label={`${label} space: ${need === 0 ? 'nothing needed' : `${got} of ${need}`}${off ? ' (arrives in Phase 9)' : ''}`}
      >
        {gifts.length === 0 ? (
          <EmptySpace
            req={req}
            open={open}
            label={label}
            off={off}
            state={state}
            need={need}
            k={k}
          />
        ) : (
          <FilledSpace gifts={gifts} state={state} open={open} k={k} />
        )}
        {need > 0 && !off && (
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
  off,
  state,
  need,
  k,
}: {
  req: Requirement;
  open: OpenChallenge;
  label: string;
  off: boolean;
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
          <span className={styles.emptyLabel}>PAY {need} CAPS</span>
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
      ) : req.kind === 'carryLimit' ? (
        <>
          <Icon name="backpack" size={34 * k} color="rgba(241,234,219,0.75)" strokeWidth={2.25} />
          <span className={styles.emptyLabel}>{label}</span>
          <span className={styles.emptySub}>NOTHING EXTRA</span>
        </>
      ) : (
        <>
          <Icon name="plus" size={38 * k} color="rgba(241,234,219,0.75)" strokeWidth={2.5} />
          <span className={styles.emptyLabel}>{off ? `${label} · PHASE 9` : label}</span>
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
      {caps > 0 && (
        <span className={styles.filledStat}>
          <img src={ASSETS.icons.acornCaps} alt="" style={{ width: 48 * k, height: 48 * k }} />
          <span className={styles.emptyLabel}>{caps} CAPS</span>
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
      return `${g.count} CAPS`;
    case 'stat':
      return `${STAT_META[g.stat].label.toUpperCase()} ×${g.count}`;
  }
}

function itemOf(g: Extract<Gift, { kind: 'item' }>, state: GameState, open: OpenChallenge) {
  return challengeHikers(state, open)
    .find((h) => h.id === g.from)
    ?.inventory.bag.find((i) => i.uid === g.uid);
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
  gift: Extract<Gift, { kind: 'item' }>;
  state: GameState;
  open: OpenChallenge;
  width: number;
}) {
  const item = itemOf(gift, state, open);
  return <ItemFace itemId={item?.itemId ?? ''} width={width} />;
}

/** A stand-in item card face (Phase 9 builds the real layered cards). */
function ItemFace({
  itemId,
  width,
  style,
}: {
  itemId: string;
  width: number;
  style?: CSSProperties;
}) {
  const def = ITEMS[itemId];
  const type = def?.type ?? 'clothes';
  return (
    <span
      className={styles.itemFace}
      title={def ? `${def.name}: ${def.text}` : itemId}
      style={{
        width,
        height: Math.round((width * 7) / 5),
        background: `linear-gradient(155deg, ${ITEM_TYPE_COLORS[type].join(', ')})`,
        ...style,
      }}
    >
      <img src={ASSETS.itemCards.typeIcons[type]} alt="" />
      {width >= 40 && (
        <span style={{ fontSize: Math.max(7, width / 7) }}>
          {(def?.name ?? itemId).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function Face({ hikerId, size }: { hikerId: HikerId; size: number }) {
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
  const tryGive = (source: Source) => onDraft(give(state, open, draft, source));
  const resources = Object.entries(hiker.inventory.resources).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div className={styles.pack}>
      <div className={styles.packHead}>
        <Face hikerId={hiker.id} size={30} />
        <span className={styles.packName}>{hiker.name.toUpperCase()}</span>
        <span className={styles.packCount}>
          BAG {hiker.inventory.bag.length}/{slots.total}
        </span>
      </div>

      {statReq && t ? (
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
                  disabled={!fits}
                  aria-label={`${itemName(item.itemId)}${used ? ' (handed in)' : fits ? ': put it in the selected space' : ''}`}
                  onClick={() => tryGive(source)}
                >
                  <ItemFace itemId={item.itemId} width={50} />
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
              RES {resourceCount(hiker)}/{BALANCE.inventory.resourceLimit}
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
                  disabled={!fits}
                  title={`${resourceName(id)} ×${n}`}
                  aria-label={`${resourceName(id)} ×${n}${fits ? ': put one in the selected space' : ''}`}
                  onClick={() => tryGive(source)}
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
function Drift() {
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
