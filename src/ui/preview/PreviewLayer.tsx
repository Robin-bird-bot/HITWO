/**
 * The one card preview (Nov 14 update, section 8): the full card, large,
 * beside whatever opened it, over every window. Hover previews follow the
 * pointer away; pinned ones (a long-press or a click) stay until a tap
 * anywhere or Esc. Put it inside the Stage, around the game.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';
import { useStage } from '../stage/StageContext';
import { ItemCard } from '../items/ItemCard';
import { ScavCard } from '../scavenge/ScavCard';
import { BALANCE } from '../../config/balance';
import { CARD_H, CARD_W, HikerCard } from '../hikers/HikerCard';
import { TraitHover } from '../traits/TraitHover';
import { PreviewContext, type PreviewApi, type PreviewContent } from './preview';
import { placePopup } from '../layout/placePopup';
import styles from './PreviewLayer.module.css';

/**
 * The preview's size on the stage: an item card 260 wide (364 tall), a
 * scavenge card 240 square with its caption, plus room for a two-line note
 * and the "tap anywhere" hint under it.
 */
const BELOW = 96;
const SIZE = {
  item: { w: 260, h: 364 + BELOW },
  scavenge: { w: 260, h: 240 + 96 + BELOW },
  // A trait's window: about this tall with a status line.
  trait: { w: 300, h: 190 },
  // A hiker card's back, lifted to the middle.
  hiker: { w: CARD_W * BALANCE.ui.cardLiftScale, h: CARD_H * BALANCE.ui.cardLiftScale },
} as const;
const GAP = 16;

interface Shown {
  content: PreviewContent;
  anchor: Element;
  rect: { left: number; top: number; right: number; bottom: number };
  pinned: boolean;
}

export function PreviewLayer({ children }: { children: ReactNode }) {
  const fit = useStage();
  const [shown, setShown] = useState<Shown | null>(null);
  // Its real size once it's drawn (Phase 10.6): placed from that, never cut off.
  const box = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ for: Shown; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!shown || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setMeasured((m) => (m && m.for === shown && m.w === w && m.h === h ? m : { for: shown, w, h }));
  }, [shown]);

  const api = useMemo<PreviewApi>(
    () => ({
      show(content, anchor, pinned) {
        const r = anchor.getBoundingClientRect();
        setShown({
          content,
          anchor,
          pinned,
          rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        });
      },
      hide(anchor) {
        setShown((s) => (s && s.anchor === anchor && !s.pinned ? null : s));
      },
    }),
    [],
  );

  // A pinned preview closes on Esc (before anything else hears it) or a tap anywhere.
  useEffect(() => {
    if (!shown?.pinned) return;
    const close = () => setShown(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    const later = window.setTimeout(() => window.addEventListener('pointerdown', close, true), 0);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(later);
      window.removeEventListener('pointerdown', close, true);
    };
  }, [shown]);

  // The card it came from went away (bought, taken): so does the preview.
  useEffect(() => {
    if (!shown) return;
    const id = window.setInterval(() => {
      if (!shown.anchor.isConnected) setShown(null);
    }, 300);
    return () => window.clearInterval(id);
  }, [shown]);

  let card: ReactNode = null;
  let place: { left: number; top: number } | null = null;
  if (shown) {
    const guess = SIZE[shown.content.kind];
    const size = measured?.for === shown ? measured : guess;
    // The anchor in stage pixels.
    const a = {
      left: (shown.rect.left - fit.left) / fit.scale,
      right: (shown.rect.right - fit.left) / fit.scale,
      top: (shown.rect.top - fit.top) / fit.scale,
      bottom: (shown.rect.bottom - fit.top) / fit.scale,
    };
    // Beside it, on whichever side has room, level with its middle; then nudged
    // inside the game screen (Phase 10.6: never cut off).
    const p = placePopup(a, size, { w: STAGE_WIDTH, h: STAGE_HEIGHT }, 'right', GAP);
    place = { left: p.left, top: p.top };
    const c = shown.content;
    // A hiker card lifts to the middle of the screen instead.
    if (c.kind === 'hiker') {
      place = { left: (STAGE_WIDTH - size.w) / 2, top: (STAGE_HEIGHT - size.h) / 2 };
    }
    card =
      c.kind === 'item' ? (
        <>
          <ItemCard itemId={c.itemId} item={c.item} unrolled={c.unrolled} width={size.w} />
          {(c.note || c.unrolled) && (
            <span className={styles.note}>
              {c.note ?? 'Quality not rolled yet: the ranges cover Qualities 1 to 5.'}
            </span>
          )}
        </>
      ) : c.kind === 'scavenge' ? (
        <ScavCard card={{ ...c.card, flipped: true }} size={240} faceUp caption="full" />
      ) : c.kind === 'hiker' ? (
        <HikerCard hikerId={c.hikerId} side="back" scale={BALANCE.ui.cardLiftScale} />
      ) : (
        <TraitHover badge={c.badge} />
      );
  }

  return (
    <PreviewContext.Provider value={api}>
      {children}
      {shown && place && (
        <div
          className={styles.preview}
          data-pinned={shown.pinned || undefined}
          ref={box}
          style={{
            left: place.left,
            top: place.top,
            width: SIZE[shown.content.kind].w,
            // Hidden for the one frame before its real size is known.
            visibility: measured?.for === shown ? 'visible' : 'hidden',
          }}
          role="dialog"
          aria-label={
            shown.content.kind === 'trait'
              ? 'Trait'
              : shown.content.kind === 'hiker'
                ? 'Hiker card'
                : 'Card preview'
          }
        >
          {card}
          {shown.pinned && <span className={styles.hint}>Tap anywhere to close</span>}
        </div>
      )}
    </PreviewContext.Provider>
  );
}
