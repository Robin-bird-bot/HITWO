/**
 * The packing screen's parts both looks share, each drawn in the look's own
 * CSS (27-packing-screen.md, section 9): the title and steps, the two
 * pull-out drawers, the party's cards and a reel's strip.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { RESOURCE_BY_ID } from '../../content/resources';
import {
  PACK_TYPES,
  overLimit,
  type BonusKind,
  type PackingState,
  type ReelSymbol,
} from '../../packing/logic';
import { FamilyMark } from '../hikers/HikerPortrait';
import { portraitArt } from '../hikers/portraitArt';
import type { MachineView, ReelView, Skin } from './machine';
import { TYPE_LABEL } from './words';

const P = BALANCE.packing;

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** The title, the three steps and what to do now. */
export function Header({ skin, step }: { skin: Skin; step: PackingState['step'] }) {
  const { cx } = skin;
  const at = step === 'items' ? 0 : step === 'resources' ? 1 : 2;
  return (
    <>
      <h1 className={cx.title}>PACK FOR THE TRAIL</h1>
      <div className={cx.steps}>
        {['1 · ITEMS', '2 · RESOURCES', '3 · HIT THE TRAIL'].map((label, i) => (
          <span key={label} className={join(i === at && cx.stepOn, i < at && cx.stepDone)}>
            {label}
          </span>
        ))}
      </div>
      <p className={cx.help}>{skin.text.help[step]}</p>
    </>
  );
}

const PAY_ITEMS: readonly { kind: BonusKind; pattern: (string | null)[] }[] = [
  { kind: 'row3', pattern: ['food', 'food', 'food', null, null] },
  { kind: 'row4', pattern: ['tool', 'tool', 'tool', 'tool', null] },
  { kind: 'jackpot', pattern: ['clothes', 'clothes', 'clothes', 'clothes', 'clothes'] },
];
const PAY_BUNDLES: readonly { kind: BonusKind; size: number }[] = [
  { kind: 'ones', size: 1 },
  { kind: 'twos', size: 2 },
  { kind: 'threes', size: 3 },
];

/**
 * The odds and the paytable, hidden in pull-out drawers (Wyatt): only their
 * tabs show. Click a tab to slide one out; again to put it away. Both start
 * shut. A pay flashes the shut paytable's tab.
 */
export function Drawers({
  skin,
  state,
  view,
  open,
  onToggle,
}: {
  skin: Skin;
  state: PackingState;
  view: MachineView;
  open: { odds: boolean; pay: boolean };
  onToggle(which: 'odds' | 'pay'): void;
}) {
  const { cx, paint, text } = skin;
  const items = state.step === 'items';
  const typeTotal = Object.values(P.itemTypeOdds).reduce((a, b) => a + b, 0);
  const sizeTotal = Object.values(P.bundleOdds).reduce((a, b) => a + b, 0);
  const pct = (w: number, total: number) => Math.round((w / total) * 100);
  return (
    <>
      <div className={join(cx.drawer, cx.drawerL, open.odds && cx.drawerOpen)}>
        <div className={cx.plaque} aria-hidden={!open.odds}>
          <h3>{items ? text.oddsItems : 'WHAT’S IN A BUNDLE'}</h3>
          {items
            ? PACK_TYPES.map((t) => {
                const p = pct(P.itemTypeOdds[t], typeTotal);
                return (
                  <div key={t} className={cx.orow} style={paint.typeVars(t)}>
                    {paint.typeChip(t)}
                    <div className={cx.oname}>
                      {TYPE_LABEL[t]}
                      <div className={cx.obar}>
                        <i style={{ width: `${p * 2.2}%` }} />
                      </div>
                    </div>
                    <div className={cx.opct}>{p}%</div>
                  </div>
                );
              })
            : Object.entries(P.bundleOdds).map(([size, w]) => {
                const n = Number(size);
                const p = pct(w, sizeTotal);
                return (
                  <div key={size} className={cx.orow} style={paint.sizeVars(n)}>
                    {paint.sizeChip(n)}
                    <div className={cx.oname}>
                      {n} RESOURCE{n > 1 ? 'S' : ''}
                      <div className={cx.obar}>
                        <i style={{ width: `${p * 2.2}%` }} />
                      </div>
                    </div>
                    <div className={cx.opct}>{p}%</div>
                  </div>
                );
              })}
          <div className={cx.note}>
            {items
              ? text.oddsNote(`${Math.round(P.tier2Chance * 1000) / 10}%`)
              : 'Each resource in a bundle is random: any of the 16.'}
          </div>
        </div>
        <button
          type="button"
          className={cx.handle}
          aria-expanded={open.odds}
          onClick={() => onToggle('odds')}
        >
          ODDS <i>{open.odds ? '◂' : '▸'}</i>
        </button>
      </div>
      <div className={join(cx.drawer, cx.drawerR, open.pay && cx.drawerOpen)}>
        <div className={cx.plaque} aria-hidden={!open.pay}>
          <h3>{items ? text.payItems : text.payBundles}</h3>
          {(items ? PAY_ITEMS : PAY_BUNDLES).map((row, i) => (
            <div
              key={`${row.kind}-${view.hit?.row === i ? view.hit.id : 0}`}
              className={join(cx.prow, view.hit?.row === i && cx.prowHit)}
            >
              <div className={cx.pat}>
                {'pattern' in row
                  ? row.pattern.map((t, k) =>
                      t ? (
                        <i key={k} style={paint.typeVars(t as (typeof PACK_TYPES)[number])} />
                      ) : (
                        <i key={k} className={cx.patOff} />
                      ),
                    )
                  : [0, 1, 2].map((k) => (
                      <b key={k} style={paint.sizeVars(row.size)}>
                        ×{row.size}
                      </b>
                    ))}
              </div>
              <div className={cx.pwin}>
                {text.pay[row.kind][0]}
                <br />
                <em>{text.pay[row.kind][1]}</em>
              </div>
            </div>
          ))}
          <div className={cx.note}>{items ? text.rulesItems : text.rulesBundles}</div>
        </div>
        <button
          key={view.pingId}
          type="button"
          className={join(cx.handle, view.pingId > 0 && !open.pay && cx.handlePing)}
          aria-expanded={open.pay}
          onClick={() => onToggle('pay')}
        >
          PAYTABLE <i>{open.pay ? '◂' : '▸'}</i>
        </button>
      </div>
    </>
  );
}

/** A hiker's portrait, cut out, standing at the bottom of the card's top. */
function CardPortrait({ hikerId, className }: { hikerId: string; className: string | undefined }) {
  const art = portraitArt(hikerId);
  if (art.kind === 'icon') return <FamilyMark icon={art.icon} className={className} />;
  return <img className={className} src={art.src} alt="" draggable={false} />;
}

/**
 * The party along the bottom: a card per hiker with their portrait, name,
 * color and bag slots (START items first), their 2 bundle slots in the
 * resource step, and their resources once the bundles open.
 */
export function PartyRow({
  skin,
  state,
  view,
  glowing,
  over,
  onHiker,
  onSlotEnter,
  onSlotLeave,
}: {
  skin: Skin;
  state: PackingState;
  view: MachineView;
  /** Hikers who can take what's dragged or picked. */
  glowing: readonly number[];
  over: number | null;
  onHiker(hiker: number): void;
  onSlotEnter(el: HTMLElement, itemId: string): void;
  onSlotLeave(): void;
}) {
  const { cx, paint } = skin;
  const width = state.seats.length > 4 ? 200 : 238;
  const resourceStep = state.step === 'resources';
  return (
    <div className={cx.party}>
      {state.seats.map((seat, i) => {
        const pack = state.packs[i];
        const bag = [
          ...seat.start.map((itemId) => ({ itemId, start: true, tier: ITEMS[itemId]?.tier ?? 1 })),
          ...(pack?.items ?? []).map((v) => ({ itemId: v.itemId, start: false, tier: v.tier })),
        ];
        const opened = view.opened[i] ?? 0;
        const bundles = pack?.bundles ?? [];
        const resources = bundles.slice(0, opened).flatMap((b) => b.resources);
        const showBundles = resourceStep || (state.step === 'done' && opened < bundles.length);
        const dropped = state.step === 'done' && opened >= bundles.length ? overLimit(state, i) : 0;
        const bounce = view.bounce?.hiker === i ? view.bounce.id : 0;
        return (
          <div
            key={`${seat.id}-${bounce}`}
            data-hiker={i}
            className={join(
              cx.hk,
              glowing.includes(i) && cx.hkCan,
              over === i && cx.hkOver,
              resourceStep && (i === state.turn ? cx.hkTurn : cx.hkDim),
              bounce > 0 && cx.hkBounce,
            )}
            style={{ '--c': seat.color, width } as CSSProperties}
            onClick={() => onHiker(i)}
          >
            <div className={cx.pic}>
              <CardPortrait hikerId={seat.id} className={cx.picImg} />
            </div>
            <div className={cx.hkName}>
              <i />
              {seat.name.toUpperCase()}
              <span className={cx.cnt}>
                {bag.length}/{seat.bagSlots} BAG
              </span>
            </div>
            <div className={cx.slots}>
              {Array.from({ length: Math.max(4, seat.bagSlots) }, (_, k) => {
                const it = bag[k];
                const popped =
                  view.pop && !view.pop.bundle && view.pop.hiker === i && view.pop.slot === k;
                return (
                  <div
                    key={`${k}-${popped ? view.pop?.id : 0}`}
                    data-slot={k}
                    className={join(
                      cx.slot,
                      it && cx.slotFull,
                      it?.tier === 2 && cx.slotT2,
                      k >= seat.bagSlots && cx.slotNone,
                      popped && cx.slotPop,
                    )}
                    onPointerEnter={(e) => it && onSlotEnter(e.currentTarget, it.itemId)}
                    onPointerLeave={onSlotLeave}
                  >
                    {it && paint.slotArt(it.itemId)}
                    {it?.start && <span className={cx.startTag}>START</span>}
                  </div>
                );
              })}
            </div>
            <div className={cx.sacks}>
              {showBundles &&
                Array.from({ length: P.bundlesEach }, (_, k) => {
                  const b = bundles[k];
                  if (b && k < opened) return null;
                  const popped =
                    view.pop && view.pop.bundle && view.pop.hiker === i && view.pop.slot === k;
                  return (
                    <div
                      key={`${k}-${popped ? view.pop?.id : 0}`}
                      data-bundle-slot={k}
                      className={join(cx.sackslot, popped && cx.slotPop)}
                      title={
                        b
                          ? b.resources.map((r) => RESOURCE_BY_ID.get(r)?.name ?? r).join(', ')
                          : undefined
                      }
                    >
                      {b && (
                        <span className={cx.sk} style={paint.sizeVars(b.resources.length)}>
                          ×{b.resources.length}
                        </span>
                      )}
                    </div>
                  );
                })}
              {/* TrailMate fills a download bar here while the bundles open. */}
              {view.opening === i && opened < bundles.length && (
                <div className={cx.dl}>
                  <i key={opened} />
                </div>
              )}
              <div className={cx.res}>
                {resources.map((r, k) => (
                  <span key={k}>{paint.resourceIcon(r, RESOURCE_BY_ID.get(r)?.name ?? r)}</span>
                ))}
              </div>
              {dropped > 0 && <span className={cx.left}>+{dropped} LEFT BEHIND</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CELL = 130;

/**
 * A reel's strip: the symbol on the payline with its neighbors above and
 * below, or, while spinning, the symbols streaming down with motion blur to
 * stop on the result with a little overshoot.
 */
export function ReelStrip({
  view,
  mid,
  blur,
  overshoot,
  className,
  cellClass,
  render,
}: {
  view: ReelView;
  /** Where the payline cell's top sits in the window. */
  mid: number;
  /** The motion blur, and how far it overshoots and bounces back (px). */
  blur: number;
  overshoot: readonly [number, number];
  className: string | undefined;
  cellClass: string | undefined;
  render(value: ReelSymbol | null): ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spin = view.spin;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !spin) return;
    const y0 = mid - spin.list.length * CELL + CELL;
    const y1 = mid;
    const an = el.animate(
      [
        { transform: `translateY(${y0}px)`, filter: 'blur(0px)', easing: 'cubic-bezier(.5,0,1,1)' },
        { transform: `translateY(${y0 + CELL * 1.2}px)`, filter: `blur(${blur}px)`, offset: 0.1 },
        {
          transform: `translateY(${y1 + overshoot[0]}px)`,
          filter: `blur(${blur / 2}px)`,
          offset: 0.89,
          easing: 'ease-out',
        },
        { transform: `translateY(${y1 - overshoot[1]}px)`, filter: 'blur(0px)', offset: 0.96 },
        { transform: `translateY(${y1}px)`, filter: 'blur(0px)' },
      ],
      { duration: spin.ms, fill: 'forwards' },
    );
    return () => an.cancel();
  }, [spin, mid, blur, overshoot]);
  const cells = spin
    ? [spin.prev, ...spin.list].map((v, k) => ({ v, top: (k - 1) * CELL }))
    : [
        { v: view.above, top: -CELL },
        { v: view.shown, top: 0 },
        { v: view.below, top: CELL },
      ];
  return (
    <div
      ref={ref}
      className={className}
      style={spin ? undefined : { transform: `translateY(${mid}px)` }}
    >
      {cells.map(({ v, top }, k) => (
        <div
          key={k}
          className={cellClass}
          style={{ top }}
          data-sym={!spin && top === 0 ? 'mid' : undefined}
        >
          {render(v)}
        </div>
      ))}
    </div>
  );
}
