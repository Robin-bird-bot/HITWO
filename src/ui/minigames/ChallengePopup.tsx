/**
 * The challenge pop-up, version 2 (docs/design/20-challenge-popup.md;
 * mockups/challenge-popup/prototype.html): the cream window with the red
 * banner, and three columns.
 *
 * - **Left:** a small poster with the flavor line and chips; HOW TO PLAY
 *   (the biggest text, its red phrase); CONTROLS as keycaps, mouse and finger.
 * - **Middle:** the slot the upright GPS stands in (MinigameFlow draws it
 *   there, playing the demo), with its caption.
 * - **Right:** IF YOU FAIL, the bars, the per-hiker values with each
 *   hiker's slot, the PREPARE rows, then START (SKIP IT when that's filled).
 *
 * Slots: hover peeks at the pop-up inventory, a click opens it to pick, ×
 * takes the thing back. Nothing is spent until Start (never in test mode).
 * After a game it shows how it went, then Continue, or in test mode Back
 * to testing and Play again.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { MinigameChallenge } from '../../content/minigameChallenges';
import type { GamePopup, Input } from '../../minigames/popups';
import {
  tilesFor,
  whoCanFill,
  type Fills,
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
import { BarRow, Heart, Inventory, PrepSlot } from './PrepareParts';
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
  const mouse = 'mouse' in input;
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
        {mouse ? (
          <>
            <rect x="6" y="2" width="12" height="20" rx="6" />
            <line x1="12" y1="2" x2="12" y2="9" />
          </>
        ) : (
          <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4c0 4-2.5 7-6 7s-4.8-1.6-6.4-4.4L4.3 13.4a1.6 1.6 0 0 1 2.7-1.7L9 14" />
        )}
      </svg>
      {mouse ? input.mouse : input.finger}
    </span>
  );
}

interface Open {
  key: string;
  mode: 'peek' | 'pick';
  at: { x: number; top: number; minX: number; maxX: number };
}

export function ChallengePopup({
  challenge,
  info,
  popup,
  base,
  settings,
  hikers,
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
  slots: readonly Slot[];
  fills: Fills;
  packs: Packs;
  onFill(key: string, tile: Tile): void;
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

  // A click anywhere else, or Esc, closes a picking inventory.
  useEffect(() => {
    if (open?.mode !== 'pick') return;
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open?.mode]);

  /** Where the inventory goes: above the slot, kept inside the window (window px). */
  const anchor = (el: HTMLElement): Open['at'] => {
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

  const slotFor = (s: Slot) => (
    <PrepSlot
      key={s.key}
      slot={s}
      fill={fills[s.key]}
      who={whoCanFill(s, slots, fills, packs, order).map(color)}
      owner={fills[s.key] ? color(fills[s.key]!.hiker) : undefined}
      open={open?.key === s.key}
      onPeek={(el) => {
        if (dimmed || open?.mode === 'pick') return;
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

  const per = popup?.perHiker?.(settings) ?? null;
  const perBase = per ? popup?.perHiker?.(base) : null;
  const perSlots = per ? slots.filter((s) => s.row.id === per.row && s.row.perHiker) : [];
  const rows = [...new Set(slots.filter((s) => !s.row.perHiker).map((s) => s.row))];
  const ifFail = challenge.ifHit.length ? challenge.ifHit : (popup?.ifFail ?? []);
  const bars = popup?.bars(settings) ?? [];
  const how = popup?.howToPlay(settings) ?? [{ text: challenge.game.line }];
  const chips = [
    challenge.game.name.toUpperCase(),
    ...(info ? [CATEGORY[info.category] ?? ''] : []),
    ...(popup?.chips(settings) ?? []),
  ].filter(Boolean);
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

        {/* Left: the poster and chips, how to play, the controls. */}
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

        {/* Middle: the GPS stands here, playing the demo. */}
        <div className={`${styles.col} ${styles.mid}`}>
          <div ref={gpsSlotRef} className={styles.gpsSlot} />
          <p className={styles.democap}>
            A BOT PLAYS A DEMO ROUND.
            <br />
            IT USES WHATEVER YOU’VE PREPARED.
          </p>
        </div>

        {/* Right: what failing costs, the bars, the hikers, Prepare, Start. */}
        <div className={`${styles.col} ${styles.right}`}>
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
                  const mine = perSlots.find((s) => s.hiker === h.id);
                  const extra = mine && fills[mine.key] ? (per?.step ?? 0) : 0;
                  const startValue = perBase?.base ?? per?.base ?? 0;
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
                          Array.from({ length: startValue + extra }, (_, i) => (
                            <Heart key={i} fresh={i >= startValue} />
                          ))}
                        {per?.kind === 'pips' && (
                          <span className={styles.pips}>
                            {Array.from(
                              { length: Math.round((startValue + extra) / per.step) },
                              (_, i) => (
                                <span
                                  key={i}
                                  data-new={i >= Math.round(startValue / per.step) || undefined}
                                />
                              ),
                            )}
                            <span className={styles.pipValue}>
                              {per.format ? per.format(startValue + extra) : startValue + extra}
                            </span>
                          </span>
                        )}
                        {status && (
                          <span className={styles.status} data-hit={status.bad || undefined}>
                            {status.text}
                          </span>
                        )}
                      </span>
                      <span className={styles.hs}>
                        {mine && !result && (
                          <>
                            <span className={styles.plus}>+</span>
                            {slotFor(mine)}
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {rows.length > 0 && !result && (
            <div className={styles.sec}>
              <h3 className={styles.h}>PREPARE</h3>
              {rows.map((r) => (
                <div key={r.id} className={styles.prow}>
                  <div>
                    <div className={styles.prowTitle}>{r.label}</div>
                    <div className={styles.prowLine}>{r.line}</div>
                  </div>
                  <div className={styles.slots}>
                    {slots.filter((s) => s.row === r).map(slotFor)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={styles.footer}>
            {result ? (
              <>
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
              </>
            ) : (
              <>
                <button type="button" className={styles.start} onClick={onStart} autoFocus>
                  {skip ? 'SKIP IT' : 'START'}
                </button>
                {slots.length > 0 && (
                  <p className={styles.note}>
                    Nothing is used until you press Start. Hover a slot to see what fits; click it,
                    then pick whose resource to use. Click × to take it back.
                    {testMode ? ' Test mode: nothing is really spent.' : ''}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {open && openSlot && (
          <Inventory
            key={`${open.key}:${open.mode}`}
            slot={openSlot}
            tiles={tilesFor(openSlot, slots, fills, packs, order)}
            mode={open.mode}
            current={fills[open.key]}
            at={open.at}
            byId={byId}
            onPick={(tile) => {
              onFill(open.key, tile);
              setOpen(null);
            }}
            onClose={() => setOpen(null)}
          />
        )}
      </section>
    </div>
  );
}
