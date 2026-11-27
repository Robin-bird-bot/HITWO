/**
 * The challenge pop-up, version 3 (docs/design/20-challenge-popup.md;
 * mockups/challenge-popup/prototype.html): the cream window with the red
 * banner, and three columns.
 *
 * - **Left:** the poster (156 × 234) with the flavor line and chips; HOW TO
 *   PLAY (the biggest text, its red phrase) and the rule lines that apply to
 *   this run, each with its tier tag; CONTROLS as keycaps, mouse and finger.
 * - **Middle:** the slot the upright GPS stands in (MinigameFlow draws it
 *   there, playing the demo), and START under it (SKIP IT when that's
 *   filled). After a game, how it went and the buttons go there instead.
 * - **Right:** IF YOU FAIL, the solid bars, the per-hiker values, and the
 *   PREPARE cost cards.
 *
 * Filling a slot (section 4.4): pick the thing in the pop-up inventory,
 * then what it does (only with several effects), then who gets it (only
 * for a per-hiker effect). Closing early leaves the slot empty; × empties
 * it. Nothing is spent until Start (never in test mode).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { MinigameChallenge } from '../../content/minigameChallenges';
import type { GamePopup, Input } from '../../minigames/popups';
import {
  costText,
  effectOf,
  effectOpen,
  nextStep,
  freeKeys,
  orderCards,
  prepFor,
  targetOpen,
  thingName,
  tilesFor,
  whoCanFill,
  type Card,
  type Fills,
  type Option,
  type Packs,
  type Slot,
  type Tile,
} from '../../minigames/prepare';
import { hikerStatus, resultLine } from '../../minigames/results';
import {
  TIER_LABELS,
  type MinigameHiker,
  type MinigameInfo,
  type MinigameResult,
  type MinigameSettings,
} from '../../minigames/types';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { MinigameIcon } from './MinigameIcon';
import {
  BarRow,
  Heart,
  Inventory,
  PrepSlot,
  WhatPanel,
  WhoPanel,
  type PanelAt,
} from './PrepareParts';
import styles from './ChallengePopup.module.css';

const CATEGORY: Readonly<Record<string, string>> = {
  move: 'MOVEMENT',
  puzzle: 'PUZZLE',
  memory: 'MEMORY',
  search: 'SEARCH',
  reaction: 'REACTION',
  luck: 'LUCK',
};

/** One Controls input: a keycap, a mouse or a finger with its word, or "or". */
function InputPic({ input }: { input: Input }): ReactNode {
  if (input === 'or') return <span className={styles.or}>or</span>;
  if ('key' in input) return <span className={styles.key}>{input.key}</span>;
  const isMouse = 'mouse' in input;
  return (
    <span className={styles.input}>
      <svg
        className={styles.ico}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2A2420"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        {isMouse ? (
          <>
            <rect x="6" y="2" width="12" height="20" rx="6" />
            <line x1="12" y1="2" x2="12" y2="9" />
          </>
        ) : (
          <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4c0 4-2.5 7-6 7s-4.8-1.6-6.4-4.4L4.3 13.4a1.6 1.6 0 0 1 2.7-1.7L9 14" />
        )}
      </svg>
      {isMouse ? input.mouse : input.finger}
    </span>
  );
}

/** What's open over a slot: peeking, picking, then what it does, then who gets it. */
type Open =
  | { key: string; mode: 'peek' | 'pick'; at: PanelAt }
  | { key: string; mode: 'what'; at: PanelAt; tile: Tile }
  | { key: string; mode: 'who'; at: PanelAt; tile: Tile; effect: Option };

export function ChallengePopup({
  challenge,
  info,
  popup,
  base,
  settings,
  hikers,
  cards,
  slots,
  fills,
  packs,
  onFill,
  onEmpty,
  skip = false,
  testMode = false,
  result,
  dimmed = false,
  gpsSlotRef,
  onStart,
  onContinue,
  onBack,
  onPlayAgain,
}: {
  challenge: MinigameChallenge;
  info?: MinigameInfo | undefined;
  popup?: GamePopup | undefined;
  /** The settings before Prepare (the version pinned), and after. */
  base: MinigameSettings;
  settings: MinigameSettings;
  hikers: readonly MinigameHiker[];
  cards: readonly Card[];
  slots: readonly Slot[];
  fills: Fills;
  packs: Packs;
  onFill(key: string, tile: Tile, effect: string, target?: string): void;
  onEmpty(key: string): void;
  /** SKIP IT is filled: Start becomes SKIP IT. */
  skip?: boolean;
  /** The Minigame testing tab: nothing is spent, and its own buttons after a game. */
  testMode?: boolean;
  result?: MinigameResult | undefined;
  dimmed?: boolean;
  gpsSlotRef?: Ref<HTMLDivElement>;
  onStart(): void;
  onContinue?(): void;
  onBack?(): void;
  onPlayAgain?(): void;
}) {
  const win = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const order = hikers.map((h) => h.id);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const color = (id: string) => byId(id)?.color ?? '#888';

  // A click anywhere else, or Esc, closes an open panel (leaving its slot as it was).
  const pinned = open !== null && open.mode !== 'peek';
  useEffect(() => {
    if (!pinned) return;
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  /** Where a panel goes: above the slot, kept inside the window (window px). */
  const anchor = (el: HTMLElement): PanelAt => {
    const w = win.current!;
    const wr = w.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = wr.width / (w.offsetWidth || 1);
    return {
      x: (r.left + r.width / 2 - wr.left) / k,
      top: (r.top - wr.top) / k,
      minX: 12,
      maxX: w.offsetWidth - 12,
    };
  };

  /** After the tile: what it does, then who gets it, each only when needed. */
  const afterTile = (slot: Slot, at: PanelAt, tile: Tile) => {
    const step = nextStep(slot, null);
    const only = slot.card.effects[0]!;
    if (step === 'done') {
      onFill(slot.key, tile, only.id);
      setOpen(null);
    } else if (step === 'who') setOpen({ key: slot.key, mode: 'who', at, tile, effect: only });
    else setOpen({ key: slot.key, mode: 'what', at, tile });
  };
  const afterEffect = (slot: Slot, at: PanelAt, tile: Tile, e: Option) => {
    if (nextStep(slot, e.id) === 'who')
      setOpen({ key: slot.key, mode: 'who', at, tile, effect: e });
    else {
      onFill(slot.key, tile, e.id);
      setOpen(null);
    }
  };

  /** A filled slot's badge: the hiker who got it ("♥ ELLIE" on her color), or the effect's short name. */
  const badgeOf = (s: Slot) => {
    const f = fills[s.key];
    const e = f && effectOf(s, f);
    if (!f || !e) return undefined;
    if (e.perHiker && f.target) {
      const h = byId(f.target);
      return { text: `${e.short} ${(h?.name ?? f.target).toUpperCase()}`, color: h?.color };
    }
    return { text: e.short };
  };

  // Rule Changer II: the first slots filled cost nothing (FREE (WYATT)).
  const free = new Set(testMode ? [] : freeKeys(fills, challenge.free?.count ?? 0));
  const freeTag = challenge.free ? `FREE (${challenge.free.who.toUpperCase()})` : undefined;
  const slotFor = (s: Slot) => (
    <PrepSlot
      key={s.key}
      slot={s}
      fill={fills[s.key]}
      {...(free.has(s.key) && freeTag ? { free: freeTag } : {})}
      who={whoCanFill(s, slots, fills, packs, order).map(color)}
      owner={fills[s.key] ? color(fills[s.key]!.hiker) : undefined}
      badge={badgeOf(s)}
      open={open?.key === s.key}
      onPeek={(el) => {
        if (dimmed || pinned) return;
        setOpen(el ? { key: s.key, mode: 'peek', at: anchor(el) } : null);
      }}
      onOpen={(el) => {
        if (dimmed || result) return;
        setOpen({ key: s.key, mode: 'pick', at: anchor(el) });
      }}
      onEmpty={() => {
        onEmpty(s.key);
        setOpen(null);
      }}
    />
  );

  const per = popup?.perHiker?.(base) ?? null;
  const ifFail = challenge.ifHit.length ? challenge.ifHit : (popup?.ifFail ?? []);
  const bars = popup?.bars(settings) ?? [];
  const how = popup?.howToPlay(settings) ?? [{ text: challenge.game.line }];
  const rules = popup?.rules(settings) ?? [];
  const chips = [
    challenge.game.name.toUpperCase(),
    ...(info ? [CATEGORY[info.category] ?? ''] : []),
    ...(popup?.chips(settings) ?? []),
  ].filter(Boolean);
  const shownCards = orderCards(cards, slots, fills, packs, order);
  const openSlot = open ? slots.find((s) => s.key === open.key) : undefined;

  return (
    <div className={styles.backdrop}>
      <section
        ref={win}
        className={styles.window}
        data-dimmed={dimmed || undefined}
        aria-label={`${challenge.name} challenge`}
        aria-hidden={dimmed || undefined}
      >
        <header className={styles.banner}>
          <span className={styles.corner}>CHALLENGE · TIER {TIER_LABELS[challenge.tier]}</span>
          <h2 className={styles.name}>
            <span className={styles.diamond} aria-hidden="true">
              <MinigameIcon id={challenge.minigame} size={20} />
            </span>
            {challenge.name.toUpperCase()}
            <span className={styles.diamond} aria-hidden="true">
              <MinigameIcon id={challenge.minigame} size={20} />
            </span>
          </h2>
          <span className={`${styles.corner} ${styles.cornerRight}`}>
            {challenge.who.toUpperCase()}
          </span>
        </header>

        {/* Left: the poster and chips, how to play and its rules, the controls. */}
        <div className={`${styles.col} ${styles.left}`}>
          <div className={styles.intro}>
            <div className={styles.poster}>
              {challenge.poster ? (
                <img src={challenge.poster} alt="" draggable={false} />
              ) : (
                <span className={styles.noPoster} />
              )}
            </div>
            <div>
              {challenge.flavor && <p className={styles.flavor}>{challenge.flavor}</p>}
              <span className={styles.chips}>
                {chips.map((c, i) => (
                  <span key={`${c}${i}`} className={styles.chip} data-dark={i === 0 || undefined}>
                    {c}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <h3 className={styles.h}>HOW TO PLAY</h3>
          <p className={styles.howto}>
            {how.map((p, i) => (p.red ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
          </p>
          {rules.length > 0 && (
            <ul className={styles.also}>
              {rules.map((r, i) => (
                <li key={i}>
                  {r.text.map((p, k) =>
                    p.red ? <b key={k}>{p.text}</b> : <span key={k}>{p.text}</span>,
                  )}
                  {r.when && <span className={styles.when}>{r.when}</span>}
                </li>
              ))}
            </ul>
          )}
          {popup && (
            <>
              <h3 className={styles.h}>CONTROLS</h3>
              <div className={styles.controls}>
                {popup.controls.map((c) => (
                  <div key={c.action} className={styles.ctl}>
                    <span className={styles.what}>{c.action}</span>
                    <span className={styles.how}>
                      {c.inputs.map((input, i) => (
                        <InputPic key={i} input={input} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Middle: the GPS stands here, playing the demo; Start under it. */}
        <div className={`${styles.col} ${styles.mid}`}>
          <div ref={gpsSlotRef} className={styles.gpsSlot} />
          {result ? (
            <div className={styles.afterGame}>
              <p className={styles.resultLine} role="status">
                {resultLine(result)}
              </p>
              {testMode ? (
                <span className={styles.buttons}>
                  <button type="button" className={styles.secondary} onClick={onBack}>
                    BACK TO TESTING
                  </button>
                  <button type="button" className={styles.start} onClick={onPlayAgain}>
                    PLAY AGAIN
                  </button>
                </span>
              ) : (
                <button type="button" className={styles.start} onClick={onContinue}>
                  CONTINUE
                </button>
              )}
            </div>
          ) : (
            <button type="button" className={styles.start} onClick={onStart} autoFocus>
              {skip ? 'SKIP IT' : 'START'}
            </button>
          )}
        </div>

        {/* Right: what failing costs, the bars, the hikers, the cost cards. */}
        {/* Four cards or more (Bear Country): a little tighter, so the column still fits. */}
        <div
          className={`${styles.col} ${styles.right}`}
          data-dense={cards.length >= 4 || undefined}
        >
          {ifFail.length > 0 && (
            <div className={styles.sec}>
              <h3 className={styles.h}>IF YOU FAIL</h3>
              <div className={styles.fail}>
                {ifFail.map((f) => (
                  <span key={f.label} className={styles.failLine}>
                    <b>{f.label}</b> {f.value}
                  </span>
                ))}
              </div>
            </div>
          )}
          {bars.length > 0 && (
            <div className={styles.sec}>
              <h3 className={styles.h}>THE CHALLENGE</h3>
              {bars.map((b) => (
                <BarRow key={b.id} bar={b} />
              ))}
            </div>
          )}
          {(per || result) && (
            <div className={styles.sec}>
              <h3 className={styles.h}>{per?.label ?? 'HIKERS'}</h3>
              <div className={styles.lives}>
                {hikers.map((h) => {
                  const status = result ? hikerStatus(result, h.id) : undefined;
                  const start = per?.base ?? 0;
                  const extra = per ? prepFor(settings, per.param, h.id) * per.step : 0;
                  return (
                    <div key={h.id} className={styles.lrow}>
                      <HikerPortrait
                        hikerId={h.id}
                        className={styles.pfp}
                        style={{ borderColor: h.color } as CSSProperties}
                      />
                      <span className={styles.nm}>{h.name}</span>
                      <span className={styles.hearts}>
                        {per?.kind === 'hearts' &&
                          Array.from({ length: start + extra }, (_, i) => (
                            <Heart key={i} fresh={i >= start} />
                          ))}
                        {per?.kind === 'pips' && (
                          <span className={styles.pips}>
                            {Array.from(
                              { length: Math.round((start + extra) / per.step) },
                              (_, i) => (
                                <span
                                  key={i}
                                  style={{ background: h.color }}
                                  data-new={i >= Math.round(start / per.step) || undefined}
                                />
                              ),
                            )}
                            <span className={styles.pipValue}>
                              {per.format ? per.format(start + extra) : start + extra}
                            </span>
                          </span>
                        )}
                        {status && (
                          <span className={styles.status} data-hit={status.bad || undefined}>
                            {status.text}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {shownCards.length > 0 && !result && (
            <div className={styles.sec}>
              <h3 className={styles.h}>PREPARE</h3>
              <div className={styles.cards}>
                {shownCards.map((c) => (
                  <div key={c.id} className={styles.card} data-color={c.color}>
                    <div>
                      <div className={styles.cardTitle}>{c.title}</div>
                      <div className={styles.cost}>{costText(c)}</div>
                      <div className={styles.does}>
                        {c.effects.map((e, i) => (
                          <span key={e.id}>
                            {i > 0 && <i> or </i>}
                            {e.label.toLowerCase()} <i>({e.perHiker ? 'pick a hiker' : e.note})</i>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={styles.slots}>
                      {slots.filter((s) => s.card.id === c.id).map(slotFor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {open && openSlot && (open.mode === 'peek' || open.mode === 'pick') && (
          <Inventory
            key={`${open.key}:${open.mode}`}
            slot={openSlot}
            tiles={tilesFor(openSlot, slots, fills, packs, order)}
            mode={open.mode}
            current={fills[open.key]}
            at={open.at}
            byId={byId}
            onPick={(tile) => afterTile(openSlot, open.at, tile)}
            onClose={() => setOpen(null)}
          />
        )}
        {open && openSlot && open.mode === 'what' && (
          <WhatPanel
            effects={openSlot.card.effects}
            open={(e) => effectOpen(e, fills, order, open.key)}
            from={`${thingName(open.tile.thing).toUpperCase()} FROM ${(byId(open.tile.hiker ?? '')?.name ?? '').toUpperCase()}`}
            at={open.at}
            onPick={(e) => afterEffect(openSlot, open.at, open.tile, e)}
            onClose={() => setOpen(null)}
          />
        )}
        {open && openSlot && open.mode === 'who' && (
          <WhoPanel
            effect={open.effect}
            hikers={hikers}
            open={(h) => targetOpen(open.effect, h, fills, open.key)}
            at={open.at}
            onPick={(h) => {
              onFill(open.key, open.tile, open.effect.id, h);
              setOpen(null);
            }}
            onClose={() => setOpen(null)}
          />
        )}
      </section>
    </div>
  );
}
