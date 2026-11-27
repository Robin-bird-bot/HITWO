/**
 * The packing screen (docs/design/27-packing-screen.md): between hiker select
 * and the hike, the party packs on a slot machine. The first spin is free;
 * drag a reel's item (or bundle) onto a hiker, or click it and then the
 * hiker; pull the lever, press the button or Space to respin. The look
 * (TrailMate or the cabinet) is a setting; the rules are the same.
 *
 * Shared by both looks: the hiker cards, the drawers, the card preview
 * (the game's own ItemCard, unrolled), and the drag and click controls.
 * Nothing is saved mid-pack: Back (or a reload) starts the packing over.
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { RESOURCE_BY_ID } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import type { HikerSetup } from '../../engine';
import {
  FORCE_BUNDLES,
  FORCE_ITEMS,
  canTake,
  targets,
  type ForceSpin,
  type Packed,
  type ReelSymbol,
} from '../../packing/logic';
import { seatsFor } from '../../packing/seats';
import { useDeviceSetting } from '../app/deviceSetting';
import { useReducedMotion } from '../app/useReducedMotion';
import { debugEnabled } from '../debug/debugEnabled';
import { ConfirmDialog } from '../game/ConfirmDialog';
import { ItemCard } from '../items/ItemCard';
import { MenuButton } from '../panels/TopBar';
import { useStage } from '../stage/StageContext';
import type { Kit, Rect, ReelHandlers, Skin, SkinFx } from './machine';
import { PACKING_SOUND_SETTING, usePackingLook, type PackingLook } from './packingSettings';
import { Particles } from './particles';
import { Drawers, Header, PartyRow } from './parts';
import { CABINET } from './cabinet/skin';
import { TRAILMATE } from './trailmate/skin';
import { useDirector } from './useDirector';
import styles from './PackingScreen.module.css';

const SKINS: Readonly<Record<PackingLook, Skin>> = {
  trailmate: TRAILMATE,
  cabinet: CABINET,
};

/** The look's background, behind the whole window. */
export function PackingBackdrop() {
  const Backdrop = SKINS[usePackingLook()].Backdrop;
  return <Backdrop />;
}

type Preview =
  | { kind: 'item'; itemId: string; at: Rect; hint: boolean }
  | { kind: 'bundle'; resources: string[]; at: Rect };

interface Drag {
  reel: number;
  x0: number;
  y0: number;
  lastX: number;
  from: Rect;
  moved: boolean;
  longPress: number | null;
  previewed: boolean;
}

const CARD_W = 230;
const CARD_H = Math.round(CARD_W * 1.4);

export function PackingScreen({
  seed,
  hikers,
  onBack,
  onTitle,
  onDone,
}: {
  seed: number;
  hikers: readonly HikerSetup[];
  onBack(): void;
  onTitle(): void;
  onDone(packed: Packed[]): void;
}) {
  const look = usePackingLook();
  const skin = SKINS[look];
  const [seats] = useState(() => seatsFor(seed, hikers));
  const fit = useStage();
  const reduced = useReducedMotion();
  const sound = useDeviceSetting(PACKING_SOUND_SETTING);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particles | null>(null);
  const fxRef = useRef<SkinFx | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const force = useRef<ForceSpin | null>(null);
  const [forced, setForced] = useState<ForceSpin | null>(null);
  const [ghost, setGhost] = useState<{ value: ReelSymbol; from: Rect } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [drawers, setDrawers] = useState({ odds: false, pay: false });
  const [leaving, setLeaving] = useState<'back' | 'title' | null>(null);

  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    const s = fit.scale || 1;
    return {
      x: (r.left - (box?.left ?? 0)) / s,
      y: (r.top - (box?.top ?? 0)) / s,
      w: r.width / s,
      h: r.height / s,
    };
  };
  const toStage = (e: { clientX: number; clientY: number }) => {
    const box = root.current?.getBoundingClientRect();
    const s = fit.scale || 1;
    return { x: (e.clientX - (box?.left ?? 0)) / s, y: (e.clientY - (box?.top ?? 0)) / s };
  };
  const find = (selector: string) => root.current?.querySelector<HTMLElement>(selector) ?? null;

  const kit: Kit = {
    rectOf,
    find,
    shake(px, ms) {
      if (!reduced && root.current) shake(root.current, px, ms);
    },
    burst: (x, y, kind, count, o) => particles.current?.burst(x, y, kind, count, o),
    reduced,
  };

  const director = useDirector(seed, seats, {
    fx: () => fxRef.current,
    slotRect(hiker, slot, bundle) {
      const el = find(
        `[data-hiker="${hiker}"] ${bundle ? `[data-bundle-slot="${slot}"]` : `[data-slot="${slot}"]`}`,
      );
      return el ? rectOf(el) : null;
    },
    onDone,
    takeForce() {
      const f = force.current;
      force.current = null;
      if (f) setForced(null);
      return f;
    },
  });
  const { state, view } = director;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const p = new Particles(c, reduced);
    particles.current = p;
    return () => {
      p.stop();
      particles.current = null;
    };
  }, [reduced]);

  const takeable = (reel: number) => !view.busy && canTake(state, reel);
  const glowing = dragging || selected !== null ? targets(state) : [];
  const leverOff =
    state.step === 'done' ||
    !state.reels.some((r) => r.lit) ||
    (!state.freeSpin && state.respins <= 0);

  const symbolRect = (reel: number): Rect | null => {
    const el = find(`[data-reel="${reel}"] [data-sym="mid"] > *`);
    return el ? rectOf(el) : null;
  };

  const showPreview = (reel: number, hint = true) => {
    const rv = view.reels[reel];
    const el = find(`[data-reel="${reel}"]`);
    const v = rv?.shown;
    if (!rv || !el || !v || !rv.lit || rv.spin) return;
    const at = rectOf(el);
    setPreview(
      v.kind === 'item'
        ? { kind: 'item', itemId: v.itemId, at, hint }
        : { kind: 'bundle', resources: v.resources, at },
    );
  };

  /** Packs the reel for the hiker, the symbol flying from where it is. */
  const pack = async (reel: number, hiker: number, from: Rect) => {
    setSelected(null);
    setPreview(null);
    const ok = await director.takeTo(reel, hiker, ghostRef.current, from);
    if (!ok) {
      // It can't go there: it slides back.
      const g = ghostRef.current;
      if (g) {
        await g.animate([{ transform: g.style.transform || 'none' }, { transform: 'none' }], {
          duration: 260,
          easing: 'ease-out',
        }).finished;
      }
    }
    setGhost(null);
  };

  // Dragging a symbol: lift it out of its reel, tilt it as it moves, drop it on a hiker.
  useEffect(() => {
    const hikerAt = (e: PointerEvent): number | null => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-hiker]');
      return el instanceof HTMLElement ? Number(el.dataset.hiker) : null;
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = toStage(e);
      if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) > 6) {
        if (d.longPress !== null) clearTimeout(d.longPress);
        d.longPress = null;
        const v = director.view.reels[d.reel]?.shown;
        if (!v || !takeable(d.reel)) {
          drag.current = null;
          return;
        }
        d.moved = true;
        flushSync(() => {
          setGhost({ value: v, from: d.from });
          setDragging(true);
          setPreview(null);
        });
        fxRef.current?.sounds.pop();
      }
      if (!d.moved) return;
      const vx = p.x - d.lastX;
      d.lastX = p.x;
      const tilt = Math.max(-18, Math.min(18, vx * 1.5));
      const g = ghostRef.current;
      if (g) {
        g.style.transform = `translate(${p.x - d.x0}px, ${p.y - d.y0}px) rotate(${tilt}deg) scale(1.12)`;
      }
      setOver(hikerAt(e));
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      if (d.longPress !== null) clearTimeout(d.longPress);
      if (!d.moved) {
        // A tap or click picks it (again to put it back); a long-press only showed its card.
        if (!d.previewed && takeable(d.reel)) {
          setSelected((s) => (s === d.reel ? null : d.reel));
          fxRef.current?.sounds.pop();
        }
        return;
      }
      setDragging(false);
      setOver(null);
      const h = hikerAt(e);
      void pack(d.reel, h ?? -1, d.from);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  });

  // Space spins, like the lever.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || leaving) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [role="dialog"]')) return;
      e.preventDefault();
      director.pull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [director, leaving]);

  const reel = (i: number): ReelHandlers => ({
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const from = symbolRect(i);
      if (!from) return;
      e.preventDefault();
      const p = toStage(e);
      const d: Drag = {
        reel: i,
        x0: p.x,
        y0: p.y,
        lastX: p.x,
        from,
        moved: false,
        longPress: null,
        previewed: false,
      };
      // On touch, a long-press shows the card.
      if (e.pointerType !== 'mouse') {
        d.longPress = window.setTimeout(() => {
          d.previewed = true;
          showPreview(i);
        }, BALANCE.ui.longPressMs);
      }
      drag.current = d;
    },
    onPointerEnter() {
      if (!drag.current) showPreview(i);
    },
    onPointerLeave() {
      setPreview(null);
    },
  });

  const onHiker = (hiker: number) => {
    if (selected === null) return;
    const from = symbolRect(selected);
    const v = view.reels[selected]?.shown;
    if (!from || !v || !targets(state).includes(hiker)) return;
    flushSync(() => setGhost({ value: v, from }));
    void pack(selected, hiker, from);
  };

  const pull = () => {
    setSelected(null);
    setPreview(null);
    director.pull();
  };

  const packedAny = state.packs.some((p) => p.items.length || p.bundles.length);
  const leave = (to: 'back' | 'title') => {
    if (packedAny && !view.leaving) setLeaving(to);
    else (to === 'back' ? onBack : onTitle)();
  };

  const card = preview && previewSpot(preview.at, preview.kind === 'item');
  const Machine = skin.Machine;
  const Symbol = skin.Symbol;
  const forces = state.step === 'items' ? FORCE_ITEMS : FORCE_BUNDLES;
  const cx = skin.cx;

  return (
    <div ref={root} className={`${styles.screen} ${cx.screen ?? ''}`} data-look={look}>
      <Header skin={skin} step={state.step} />
      <Drawers
        skin={skin}
        state={state}
        view={view}
        open={drawers}
        onToggle={(which) => {
          fxRef.current?.sounds.whoosh();
          setDrawers((d) => {
            const next = { ...d, [which]: !d[which] };
            director.setPayOpen(next.pay);
            return next;
          });
        }}
      />
      <Machine
        fxRef={fxRef}
        kit={kit}
        state={state}
        view={view}
        selected={selected}
        leverOff={leverOff}
        onPull={pull}
        reel={reel}
      />
      {view.next && (
        <button type="button" className={cx.next} onClick={() => director.next()}>
          {view.next === 'resources' ? 'NEXT: RESOURCES ▸' : 'START THE HIKE ▸'}
        </button>
      )}
      <PartyRow
        skin={skin}
        state={state}
        view={view}
        glowing={glowing}
        over={over}
        onHiker={onHiker}
        onSlotEnter={(el, itemId) => {
          if (!drag.current) setPreview({ kind: 'item', itemId, at: rectOf(el), hint: false });
        }}
        onSlotLeave={() => setPreview(null)}
      />
      <canvas ref={canvas} className={styles.fx} width={1600} height={1000} />
      {ghost && (
        <div
          ref={ghostRef}
          className={`${styles.ghost} ${cx.ghost ?? ''}`}
          style={{
            left: ghost.from.x,
            top: ghost.from.y,
            width: ghost.from.w,
            height: ghost.from.h,
          }}
        >
          <Symbol value={ghost.value} />
        </div>
      )}
      {preview?.kind === 'item' && card && ITEMS[preview.itemId] && (
        <div className={styles.card} style={{ left: card.x, top: card.y }}>
          <ItemCard itemId={preview.itemId} width={CARD_W} unrolled />
          {preview.hint && (
            <div className={`${styles.hint} ${cx.hint ?? ''}`}>DRAG ONTO A HIKER TO PACK IT</div>
          )}
        </div>
      )}
      {preview?.kind === 'bundle' && card && (
        <div className={cx.tip} style={{ left: card.x, top: card.y }}>
          <div className={cx.tipTitle}>BUNDLE ×{preview.resources.length}</div>
          <div className={cx.tipBody}>
            {preview.resources.map((r, k) => (
              <span key={k}>
                {k > 0 && ', '}
                <img src={ASSETS.resources[r]} alt="" />
                {RESOURCE_BY_ID.get(r)?.name ?? r}
              </span>
            ))}
            <br />
            <span className={cx.tipNote}>Opens into resources when the hike starts.</span>
          </div>
        </div>
      )}
      <div className={styles.corner}>
        <button type="button" className={styles.cornerButton} onClick={() => leave('back')}>
          ◂ BACK
        </button>
        <button
          type="button"
          className={styles.cornerButton}
          aria-pressed={sound === 'on'}
          onClick={() => PACKING_SOUND_SETTING.set(sound === 'on' ? 'off' : 'on')}
        >
          {sound === 'on' ? 'SOUND ON' : 'SOUND OFF'}
        </button>
      </div>
      <MenuButton
        onTitle={() => leave('title')}
        note="Packing isn’t saved: a reload starts it over."
        {...(debugEnabled()
          ? {
              moreTesting: (
                <div className={styles.force}>
                  <span>Force next spin</span>
                  <div className={styles.forceRow}>
                    {forces.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={forced === f.id}
                        onClick={() => {
                          const next = forced === f.id ? null : f.id;
                          force.current = next;
                          setForced(next);
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            }
          : {})}
      />
      {leaving && (
        <ConfirmDialog
          title="Leave packing?"
          message="What the party packed goes back on the shelf."
          confirmLabel={leaving === 'back' ? 'Back to hikers' : 'Title screen'}
          cancelLabel="Keep packing"
          focusCancel
          onCancel={() => setLeaving(null)}
          onConfirm={() => (leaving === 'back' ? onBack : onTitle)()}
        />
      )}
    </div>
  );
}

/** Shakes an element a few pixels this way and that. */
function shake(el: HTMLElement, px: number, ms: number): void {
  const keys: Keyframe[] = [];
  for (let i = 0; i < 8; i++) {
    const x = (Math.random() - 0.5) * px * 2;
    const y = (Math.random() - 0.5) * px * 2;
    keys.push({ transform: `translate(${x}px, ${y}px)` });
  }
  keys.push({ transform: 'none' });
  el.animate(keys, { duration: ms });
}

/**
 * Beside the reel (or slot), kept on the stage and flipped to the left near
 * the right edge: an item card centered on it, a bundle's tip near its top.
 */
function previewSpot(at: Rect, card: boolean): { x: number; y: number } {
  const width = card ? CARD_W : 300;
  let x = at.x + at.w + 14;
  if (x + width + 2 > 1590) x = at.x - width - 14;
  const y = card
    ? Math.max(20, Math.min(at.y + at.h / 2 - CARD_H / 2, 1000 - CARD_H - 40))
    : Math.min(at.y + 30, 1000 - 140);
  return { x, y };
}
