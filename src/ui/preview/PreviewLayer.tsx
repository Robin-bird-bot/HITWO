/**
 * The one card preview (Nov 14 update, section 8): the full card, large,
 * beside whatever opened it, over every window. Hover previews follow the
 * pointer away; pinned ones (a long-press or a click) stay until a tap
 * anywhere or Esc. Put it inside the Stage, around the game.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';
import { useStage } from '../stage/StageContext';
import { ItemCard } from '../items/ItemCard';
import { ScavCard } from '../scavenge/ScavCard';
import { TraitHover } from '../traits/TraitHover';
import { PreviewContext, type PreviewApi, type PreviewContent } from './preview';
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
    const size = SIZE[shown.content.kind];
    // The anchor in stage pixels.
    const a = {
      left: (shown.rect.left - fit.left) / fit.scale,
      right: (shown.rect.right - fit.left) / fit.scale,
      top: (shown.rect.top - fit.top) / fit.scale,
      bottom: (shown.rect.bottom - fit.top) / fit.scale,
    };
    // Beside it, on whichever side has room; level with its middle.
    const right = a.right + GAP;
    const left = right + size.w <= STAGE_WIDTH - GAP ? right : Math.max(GAP, a.left - GAP - size.w);
    const middle = (a.top + a.bottom) / 2 - size.h / 2;
    const top = Math.min(STAGE_HEIGHT - GAP - size.h, Math.max(GAP, middle));
    place = { left, top };
    const c = shown.content;
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
          style={{ left: place.left, top: place.top, width: SIZE[shown.content.kind].w }}
          role="dialog"
          aria-label={shown.content.kind === 'trait' ? 'Trait' : 'Card preview'}
        >
          {card}
          {shown.pinned && <span className={styles.hint}>Tap anywhere to close</span>}
        </div>
      )}
    </PreviewContext.Provider>
  );
}
