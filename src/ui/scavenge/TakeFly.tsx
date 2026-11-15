/**
 * After a scavenge (Nov 14 update, in place of the result window): the kept
 * card slides from where it lay into the hiker's pack (the turn panel's pack
 * when they're selected, their party portrait otherwise), then a small label
 * ("+1 Fur", "Trail Mix", "Empty") floats up there and fades. Under reduced
 * motion the label just appears for a moment. Drawn in screen pixels, over
 * everything; it never takes a click.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HikerId, ScavengeCard } from '../../engine';
import { useReducedMotion } from '../app/useReducedMotion';
import { ScavCard } from './ScavCard';
import styles from './TakeFly.module.css';

export interface Fly {
  key: number;
  hikerId: HikerId;
  /** The card as it was taken (a Wild shows what it turned out to be). */
  card: ScavengeCard;
  label: string;
  /** Where the card lay in the window, in screen pixels. */
  from: { x: number; y: number; width: number; height: number } | null;
  /** Which part of the pack: resources and caps, or the bag. */
  into: 'resources' | 'bag';
}

const SLIDE_MS = 600;
const LABEL_MS = 1400;

/** The hiker's pack on screen: the turn panel's, when it's theirs; else their portrait. */
function packOf(fly: Fly): DOMRect | null {
  const pack = document.querySelector(`[data-pack-of="${fly.hikerId}"][data-pack="${fly.into}"]`);
  const portrait = document.querySelector(`[data-drop-id="hiker"][data-drop-arg="${fly.hikerId}"]`);
  const el = pack ?? portrait;
  return el ? el.getBoundingClientRect() : null;
}

export function TakeFly({ fly, onDone }: { fly: Fly; onDone(): void }) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  // Measured once the screen has updated (the next hiker may be selected by now).
  const [target, setTarget] = useState<DOMRect | null | undefined>(undefined);
  const [phase, setPhase] = useState<'wait' | 'slide' | 'label'>('wait');
  const start = useRef({ fly, reduced });
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const { fly: f, reduced: r } = start.current;
      const t = packOf(f);
      setTarget(t);
      setPhase(r || !f.from || !t ? 'label' : 'slide');
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  // The card slides into the pack, shrinking as it goes.
  useEffect(() => {
    if (phase !== 'slide' || !fly.from || !target || !cardRef.current) return;
    const dx = target.x + target.width / 2 - (fly.from.x + fly.from.width / 2);
    const dy = target.y + target.height / 2 - (fly.from.y + fly.from.height / 2);
    const anim = cardRef.current.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.35 },
      ],
      { duration: SLIDE_MS, easing: 'cubic-bezier(0.45, 0, 0.7, 0.2)', fill: 'forwards' },
    );
    anim.onfinish = () => setPhase('label');
    return () => anim.cancel();
  }, [phase, fly.from, target]);

  // The label floats up and fades (or, under reduced motion, just shows a moment).
  useEffect(() => {
    if (phase !== 'label') return;
    const el = labelRef.current;
    const anim = el?.animate(
      reduced
        ? [{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }]
        : [
            { opacity: 0, transform: 'translate(-50%, 0)' },
            { opacity: 1, transform: 'translate(-50%, -14px)', offset: 0.2 },
            { opacity: 1, transform: 'translate(-50%, -26px)', offset: 0.7 },
            { opacity: 0, transform: 'translate(-50%, -44px)' },
          ],
      { duration: LABEL_MS, easing: 'ease-out', fill: 'forwards' },
    );
    const finish = () => done.current();
    if (anim) anim.onfinish = finish;
    else finish();
    return () => anim?.cancel();
  }, [phase, reduced]);

  const at = target ?? fly.from;
  return createPortal(
    <div className={styles.layer} aria-hidden="true">
      {phase === 'slide' && fly.from && (
        <div
          ref={cardRef}
          className={styles.card}
          style={{ left: fly.from.x, top: fly.from.y, width: fly.from.width }}
        >
          <ScavCard
            card={{ ...fly.card, flipped: true }}
            size={fly.from.width}
            faceUp
            reveal
            caption="none"
          />
        </div>
      )}
      {phase === 'label' && at && (
        <div
          ref={labelRef}
          className={styles.label}
          style={{ left: at.x + at.width / 2, top: at.y - 6 }}
        >
          {fly.label}
        </div>
      )}
    </div>,
    document.body,
  );
}
