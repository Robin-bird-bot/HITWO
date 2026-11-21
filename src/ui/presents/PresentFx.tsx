/**
 * Presents on screen (holiday hikers):
 *
 * - **Opening:** the box shakes, the lid pops, and the item card flips in
 *   (the Mystery Item flip). A click skips to the end. NICE! closes it.
 * - **Choosy:** the Present's 3 items flip in side by side; picking one keeps it.
 * - **Wreck the Halls:** the box bursts into confetti, then it's gone.
 *
 * Under reduced motion the cards just appear, and a smash just removes the
 * Present. It watches the trail log for what happened, so a reload never
 * replays an old opening (only a Choosy pick still waiting comes back).
 */
import { useState, type CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { presentArt, presentName } from '../../content/items/presents';
import type { Action, GameEvent, GameState, ItemInstance } from '../../engine';
import { useReducedMotion } from '../app/useReducedMotion';
import { ItemCard } from '../items/ItemCard';
import counter from '../station/Counter.module.css';
import styles from './PresentFx.module.css';

const FX = BALANCE.ui.presentOpen;
const CONFETTI = ['#E5624A', '#E9B44C', '#7FC29B', '#F1EADB', '#CDA6EE', '#A8233A'];

type Shown = Extract<GameEvent, { kind: 'presentOpened' } | { kind: 'presentGone' }>;

/** The newest opening or smash after `after`, if there is one. */
function latest(state: GameState, after: number): Shown | undefined {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (!e || e.id <= after) return undefined;
    if (e.kind === 'presentOpened') return e;
    if (e.kind === 'presentGone' && e.how === 'smashed') return e;
  }
  return undefined;
}

export function PresentFx({
  state,
  onAction,
}: {
  state: GameState;
  onAction(action: Action): unknown;
}) {
  const reduce = useReducedMotion();
  // Only what happens from here on: a reload doesn't replay old openings.
  const [done, setDone] = useState(state.nextEventId - 1);
  const shown = latest(state, done);
  const pick = state.presentPick;

  if (pick) {
    const opened = shown?.kind === 'presentOpened' ? shown : undefined;
    return (
      <Opening
        key={opened?.id ?? 'pick'}
        state={state}
        reduce={reduce || !opened}
        hikerId={pick.hikerId}
        title={`${state.hikers.find((h) => h.id === pick.hikerId)?.name ?? 'They'} opened a ${presentName(pick.grade)}!`}
        colorway={opened?.colorway}
        cards={pick.options}
        onPick={(index) => {
          onAction({ type: 'presentTake', index });
          setDone(state.nextEventId);
        }}
      />
    );
  }
  if (!shown) return null;
  if (shown.kind === 'presentGone') {
    if (reduce) return null;
    return <Smash key={shown.id} colorway={shown.colorway} onDone={() => setDone(shown.id)} />;
  }
  // A Choosy pick already made: nothing more to show.
  if (!shown.itemId) return null;
  const hiker = state.hikers.find((h) => h.id === shown.hikerId);
  // The item they got: the newest of its kind in their pack.
  const got = [...(hiker?.inventory.bag ?? [])].reverse().find((i) => i.itemId === shown.itemId);
  return (
    <Opening
      key={shown.id}
      state={state}
      reduce={reduce}
      hikerId={shown.hikerId}
      title={`${hiker?.name ?? 'They'} opened a ${presentName(shown.grade)}!`}
      colorway={shown.colorway}
      cards={[got ?? { uid: 'got', itemId: shown.itemId }]}
      onClose={() => setDone(shown.id)}
    />
  );
}

/** The box, its lid, and the card (or cards) flipping in. */
function Opening({
  reduce,
  title,
  colorway,
  cards,
  onPick,
  onClose,
}: {
  state: GameState;
  reduce: boolean;
  hikerId: string;
  title: string;
  colorway: number | undefined;
  cards: ItemInstance[];
  onPick?(index: number): void;
  onClose?(): void;
}) {
  const [skipped, setSkipped] = useState(false);
  const still = reduce || skipped;
  const art = ASSETS.itemArt(presentArt(colorway ? { colorway } : undefined));
  const reveal = FX.shakeMs + FX.popMs;
  const times = {
    '--shake': `${FX.shakeMs}ms`,
    '--pop': `${FX.popMs}ms`,
    '--reveal': `${reveal}ms`,
    '--after': `${reveal + FX.flipMs + FX.dealGapMs * (cards.length - 1)}ms`,
  } as CSSProperties;
  const one = cards[0];
  const name = one && cards.length === 1 ? ITEMS[one.itemId]?.name : undefined;

  return (
    <div
      className={styles.screen}
      style={times}
      data-still={still || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // A click while it plays skips to the end (and does nothing else).
      onClickCapture={(e) => {
        if (still) return;
        e.stopPropagation();
        setSkipped(true);
      }}
    >
      <div className={styles.veil} />
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.stack}>
        {!still && (
          <div className={styles.box} aria-hidden="true">
            <img className={styles.base} src={art} alt="" draggable={false} />
            <img className={styles.lid} src={art} alt="" draggable={false} />
            <span className={styles.glow} />
          </div>
        )}
        <div className={styles.cards}>
          {cards.map((item, i) => {
            const card = (
              <ItemCard itemId={item.itemId} item={item} width={cards.length > 1 ? 230 : 260} />
            );
            const flip: CSSProperties = still
              ? {}
              : {
                  animationDelay: `${reveal + FX.dealGapMs * i}ms`,
                  animationDuration: `${FX.flipMs}ms`,
                  animationFillMode: 'both',
                };
            return onPick ? (
              <button
                key={item.uid}
                type="button"
                className={`${styles.pick} ${still ? '' : counter.flipIn}`}
                style={flip}
                aria-label={`Keep the ${ITEMS[item.itemId]?.name ?? 'item'}`}
                onClick={() => onPick(i)}
              >
                {card}
              </button>
            ) : (
              <div key={item.uid} className={still ? '' : counter.flipIn} style={flip}>
                {card}
              </div>
            );
          })}
        </div>
      </div>
      {/* Its fade-in is the last thing to play: from then on, a click is a click. */}
      <div
        className={styles.footer}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setSkipped(true);
        }}
      >
        {onPick ? (
          <span className={styles.hint}>Pick one to keep.</span>
        ) : (
          <>
            {name && <span className={styles.hint}>{name} goes in the pack.</span>}
            <button type="button" className={styles.nice} onClick={onClose} autoFocus>
              NICE!
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Wreck the Halls: the box shakes, then bursts into confetti. */
function Smash({ colorway, onDone }: { colorway: number | undefined; onDone(): void }) {
  const art = ASSETS.itemArt(presentArt(colorway ? { colorway } : undefined));
  const pieces = Array.from({ length: 28 }, (_, i) => {
    // Spread evenly round the circle, with a little variety in distance and spin.
    const angle = (i / 28) * Math.PI * 2;
    const reach = 180 + ((i * 37) % 120);
    return {
      '--dx': `${Math.round(Math.cos(angle) * reach)}px`,
      '--dy': `${Math.round(Math.sin(angle) * reach - 60)}px`,
      '--spin': `${((i * 73) % 720) - 360}deg`,
      background: CONFETTI[i % CONFETTI.length],
    } as CSSProperties;
  });
  return (
    <div
      className={styles.smash}
      style={{ '--smash': `${FX.smashMs}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <img
        className={styles.smashBox}
        src={art}
        alt=""
        draggable={false}
        onAnimationEnd={(e) => {
          if (e.animationName.includes('burst')) onDone();
        }}
      />
      {pieces.map((style, i) => (
        <span key={i} className={styles.confetti} style={style} />
      ))}
    </div>
  );
}
