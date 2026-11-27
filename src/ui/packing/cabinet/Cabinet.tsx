/**
 * Lucky Trail Outfitters, the packing screen's cabinet look
 * (27-packing-screen.md, sections 2 and 5): a wooden slot machine with a
 * marquee sign, a squirrel running in a wheel to power the log reels, an
 * acorn-cap tray of respins, a brass plate and a hiking pole for a lever.
 */
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { ASSETS, asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { ITEMS } from '../../../content/items';
import { owed, type ReelSymbol } from '../../../packing/logic';
import { portraitArt } from '../../hikers/portraitArt';
import { Icon } from '../../icons/Icon';
import { TYPE_ICON } from '../../items/itemLook';
import type { Kit, ReelView, SkinFx, SkinProps, StampView } from '../machine';
import { ReelStrip } from '../parts';
import { wait } from '../useDirector';
import { owedWords, TYPE_LABEL } from '../words';
import { CAB_TYPE, LEAVES } from './colors';
import { CABINET_SOUNDS as SND } from './sounds';
import { SquirrelWheel, type SquirrelMood } from './SquirrelWheel';
import styles from './Cabinet.module.css';

const P = BALANCE.packing;
const A = P.anim;

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

const ACORN = asset('icons/acorn-caps.png');
/** The reels' places in the window: 5 narrow logs, or 3 wide ones. */
const geom = (n: number) =>
  n === 5 ? { w: 116, gap: 12, x0: 0 } : { w: 172, gap: 18, x0: (630 - (3 * 172 + 2 * 18)) / 2 };
const MID = 61;
const OVERSHOOT = [26, 9] as const;
/** Where the squirrel catches an acorn, on the stage. */
const MOUTH = { x: 680 + 46 + 100 * 1.35, y: -16 + 115 + 40 * 1.35 };
const SPARKS = ['#fff2b0', '#e8c55a', '#ffffff'];

/** An item's art, or its type's icon when it has no art yet. */
export function ItemArt({ itemId }: { itemId: string }) {
  const def = ITEMS[itemId];
  const src = def?.art ? ASSETS.itemArt(def.art) : undefined;
  if (src) return <img src={src} alt="" />;
  return def ? <Icon name={TYPE_ICON[def.type]} size={26} color="#e4c9a0" /> : null;
}

/** A reel's symbol: the item on a plaque in its type's colors, or a bundle's resource icons. */
export function CabinetSymbol({ value }: { value: ReelSymbol }) {
  if (value.kind === 'bundle') {
    const n = value.resources.length;
    const rows = n <= 3 ? [n] : n === 4 ? [2, 2] : [3, 2];
    let k = 0;
    return (
      <div className={join(styles.bun, styles[`n${Math.min(n, 5)}`], n >= 5 && styles.b5)}>
        {rows.map((count, r) => (
          <div key={r} className={styles.brow}>
            {value.resources.slice(k, (k += count)).map((id, j) => (
              <img key={j} src={ASSETS.resources[id]} alt="" draggable={false} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  const def = ITEMS[value.itemId];
  const [light, mid] = CAB_TYPE[value.type];
  return (
    <div
      className={join(styles.sym, value.tier === 2 && styles.t2)}
      style={{ '--c1': light, '--c2': mid } as CSSProperties}
    >
      {def?.art && <img src={ASSETS.itemArt(def.art)} alt="" draggable={false} />}
    </div>
  );
}

/** The sign's marquee bulbs, chasing slowly, and fast after a win. */
function Bulbs({ fast }: { fast: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((n) => n + 1), 110);
    return () => clearInterval(id);
  }, []);
  const W = 652;
  const H = 82;
  const pts: [number, number][] = [];
  for (let k = 0; k < 22; k++) pts.push([14 + (k * (W - 28)) / 21, 6]);
  for (let k = 1; k < 3; k++) pts.push([W - 8, 6 + (k * (H - 12)) / 3]);
  for (let k = 21; k >= 0; k--) pts.push([14 + (k * (W - 28)) / 21, H - 12]);
  for (let k = 2; k >= 1; k--) pts.push([2, 6 + (k * (H - 12)) / 3]);
  return (
    <>
      {pts.map(([x, y], i) => {
        const on = fast ? (i + t) % 2 === 0 : (i + Math.floor(t / 2)) % 4 === 0;
        return (
          <i
            key={i}
            className={join(styles.bulb, on && styles.bulbOn)}
            style={{ left: x - 5, top: y - 2 }}
          />
        );
      })}
    </>
  );
}

/** A reel: a log section in a brass bezel, with its shutter and the hiker's name. */
function Reel({
  view,
  i,
  left,
  width,
  selected,
  hiker,
  handlers,
}: {
  view: ReelView;
  i: number;
  left: number;
  width: number;
  selected: boolean;
  hiker: { name: string; color: string } | null;
  handlers: ReturnType<SkinProps['reel']>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const kind = view.shown?.kind;
  // Turning Tier II flashes white; a growing bundle swells.
  useLayoutEffect(() => {
    if (!view.upId) return;
    ref.current?.animate(
      kind === 'bundle'
        ? [
            { transform: 'scale(1)' },
            { transform: 'scale(1.12)', offset: 0.4 },
            { transform: 'scale(1)' },
          ]
        : [
            { filter: 'brightness(1)' },
            { filter: 'brightness(3) saturate(0)', offset: 0.4 },
            { filter: 'brightness(1)' },
          ],
      { duration: kind === 'bundle' ? 500 : 600, easing: 'cubic-bezier(.3,1.8,.5,1)' },
    );
  }, [view.upId, kind]);
  // Each stop gives a jolt.
  useLayoutEffect(() => {
    if (!view.stopId) return;
    ref.current?.animate(
      [
        { transform: 'none' },
        { transform: 'translateY(5px)', offset: 0.3 },
        { transform: 'translateY(-2px)', offset: 0.65 },
        { transform: 'none' },
      ],
      { duration: 280, easing: 'ease-out' },
    );
  }, [view.stopId]);
  return (
    <div
      ref={ref}
      data-reel={i}
      className={join(
        styles.reel,
        !view.lit && styles.reelDark,
        view.quiet && styles.reelQuiet,
        view.spin && styles.spinning,
        view.tease && styles.tease,
        selected && styles.sel,
      )}
      style={{ left, width }}
      {...handlers}
    >
      <ReelStrip
        view={view}
        mid={MID}
        blur={5}
        overshoot={OVERSHOOT}
        className={styles.strip}
        cellClass={styles.cell}
        render={(v) => v && <CabinetSymbol value={v} />}
      />
      <div className={styles.payline} />
      <div className={styles.shade} />
      {view.lit && view.locked && (
        <div className={styles.lockx}>
          <span>
            TAKE ONE
            <br />
            ONLY
          </span>
        </div>
      )}
      <div className={styles.shutter}>
        {hiker && (
          <div className={styles.who}>
            <i style={{ background: hiker.color }} />
            {hiker.name}
          </div>
        )}
      </div>
      <div className={styles.edge} />
      {view.winId > 0 && <div key={view.winId} className={styles.winGlow} />}
    </div>
  );
}

/** The big wooden stamp that slams down over the reels. */
function Stamp({ stamp }: { stamp: StampView }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.animate(
      [
        { opacity: 0, transform: 'scale(2.6) rotate(-10deg)' },
        { opacity: 1, transform: 'scale(.92) rotate(-3deg)', offset: 0.22 },
        { opacity: 1, transform: 'scale(1.04) rotate(-4deg)', offset: 0.3 },
        { opacity: 1, transform: 'scale(1) rotate(-4deg)', offset: 0.85 },
        { opacity: 0, transform: 'scale(1.1) rotate(-4deg)' },
      ],
      { duration: stamp.ms + 500, easing: 'ease-out' },
    );
  }, [stamp]);
  return (
    <div ref={ref} className={join(styles.stamp, stamp.gold && styles.stampGold)}>
      <span>
        {stamp.text}
        {stamp.sub && <small>{stamp.sub}</small>}
      </span>
    </div>
  );
}

/** Flies a picture along an arc (an acorn to the squirrel, a resource into a card). */
function flyImg(
  kit: Kit,
  src: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
  ms: number,
  lift = -120,
  spin = 540,
): Promise<void> {
  const layer = kit.find('[data-look]');
  if (!layer) return Promise.resolve();
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.className = styles.flier ?? '';
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  layer.appendChild(img);
  const mid = [(from.x + to.x) / 2, Math.min(from.y, to.y) + lift] as const;
  const keys: Keyframe[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const u = 1 - t;
    const x = u * u * from.x + 2 * u * t * mid[0] + t * t * to.x - size / 2;
    const y = u * u * from.y + 2 * u * t * mid[1] + t * t * to.y - size / 2;
    keys.push({ transform: `translate(${x}px, ${y}px) rotate(${t * spin}deg)` });
  }
  return img.animate(keys, { duration: ms, easing: 'ease-in-out' }).finished.then(
    () => img.remove(),
    () => img.remove(),
  );
}

export function CabinetMachine({
  fxRef,
  kit,
  state,
  view,
  selected,
  leverOff,
  onPull,
  reel,
}: SkinProps) {
  const [mood, setMood] = useState<SquirrelMood>('sit');
  const [frame, setFrame] = useState(false);
  const [peek, setPeek] = useState(false);
  const [blink, setBlink] = useState(false);
  const [fastUntil, setFastUntil] = useState(0);
  const [rays, setRays] = useState(0);
  const [turnTag, setTurnTag] = useState<{ hiker: number; id: number } | null>(null);
  const [now, setNow] = useState(0);
  const lever = useRef<HTMLButtonElement>(null);
  const cab = useRef<HTMLDivElement>(null);
  const wheel = useRef<SVGGElement>(null);
  const body = useRef<SVGGElement>(null);
  const spinAnim = useRef<Animation | null>(null);
  const legs = useRef<number | null>(null);
  const live = useRef({ state, view, mood, tags: 0 });
  useEffect(() => {
    live.current.state = state;
    live.current.view = view;
    live.current.mood = mood;
  });
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
      if (legs.current !== null) clearInterval(legs.current);
    },
    [],
  );

  // The wheel turns as fast as the squirrel runs; it blinks now and then while it sits.
  useEffect(() => {
    const g = wheel.current;
    if (!g) return;
    const an = g.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
      duration: 900,
      iterations: Infinity,
    });
    an.playbackRate = 0;
    spinAnim.current = an;
    const blinks = window.setInterval(() => {
      if (live.current.mood !== 'sit') return;
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 3100);
    return () => {
      an.cancel();
      clearInterval(blinks);
    };
  }, []);
  // The bulbs chase fast for a while after a win.
  useEffect(() => {
    if (!fastUntil) return;
    const id = window.setTimeout(
      () => setNow(fastUntil),
      Math.max(0, fastUntil - performance.now()),
    );
    return () => clearTimeout(id);
  }, [fastUntil]);

  const wheelSpeed = (target: number, ms: number) =>
    new Promise<void>((resolve) => {
      const an = spinAnim.current;
      if (!an) return resolve();
      const from = an.playbackRate;
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        an.playbackRate = from + (target - from) * k;
        if (k < 1) window.setTimeout(step, 16);
        else resolve();
      };
      step();
    });
  const run = (on: boolean) => {
    if (legs.current !== null) clearInterval(legs.current);
    legs.current = null;
    setFrame(false);
    if (on) {
      setMood('run');
      if (!kit.reduced)
        legs.current = window.setInterval(() => setFrame((f) => !f), A.squirrelLegMs);
      void wheelSpeed(2.6, A.wheelUpMs);
      return;
    }
    setPeek(false);
    setMood('sit');
    void wheelSpeed(0, A.wheelDownMs).then(() => {
      setMood('tired');
      later(A.pantMs, () => setMood('sit'));
    });
  };
  const flip = () => {
    if (kit.reduced) return;
    body.current?.animate(
      [
        { transform: 'none' },
        { transform: 'translateY(-34px) rotate(-180deg)', offset: 0.5 },
        { transform: 'translateY(0) rotate(-360deg)' },
      ],
      { duration: 700, easing: 'cubic-bezier(.4,0,.3,1)' },
    );
  };
  const rectOfSel = (sel: string) => {
    const el = kit.find(sel);
    return el ? kit.rectOf(el) : null;
  };
  const fastBulbs = () => setFastUntil(performance.now() + 2500);

  useImperativeHandle(fxRef, (): SkinFx => {
    const n = state.seats.length;
    return {
      sounds: SND,
      words: {
        row3: ['BONUS SPIN!', '3 IN A ROW'],
        row4: ['4 IN A ROW!', 'ONE TURNS TIER II · FREE SPIN'],
        jackpot: ['TRAIL JACKPOT!', 'ALL TIER II · TAKE ONE · FREE SPIN'],
        ones: ['BONUS SPIN!', '×1 ×1 ×1'],
        twos: ['BUNDLE BOOST!', 'ONE GROWS TO ×3 · BONUS SPIN'],
        threes: ['BIG BUNDLE!', 'ONE GROWS TO ×5 · BONUS SPIN'],
        secondWind: ['SECOND WIND!', 'EVERY REEL LIGHTS UP · FREE SPIN'],
        allPacked: [
          'ALL PACKED!',
          `${n} HIKER${n === 1 ? '' : 'S'} · ${state.packs.reduce((a, p) => a + p.items.length, 0)} ITEMS`,
        ],
        ready: ['READY!', `EVERY HIKER HAS ${P.bundlesEach} BUNDLES`],
        happy: ['HAPPY TRAILS!', 'THE HIKE STARTS ON THE TRAILHEAD'],
      },
      tickMs: 70,
      teaseMs: A.teaseMs,
      lightGapMs: 0,
      async intro() {
        await wait(150);
      },
      lever() {
        SND.ratchet();
        lever.current?.animate(
          [
            { transform: 'rotate(-14deg)' },
            { transform: 'rotate(62deg)', offset: 0.35, easing: 'ease-in' },
            { transform: 'rotate(55deg)', offset: 0.5 },
            { transform: 'rotate(-22deg)', offset: 0.8 },
            { transform: 'rotate(-14deg)' },
          ],
          { duration: 700, easing: 'ease-out' },
        );
        cab.current?.animate(
          [
            { transform: 'none' },
            { transform: 'translateY(3px)', offset: 0.3 },
            { transform: 'none' },
          ],
          { duration: 300, delay: 220 },
        );
      },
      noRespins() {
        lever.current?.animate(
          [
            { transform: 'rotate(-14deg)' },
            { transform: 'rotate(-6deg)' },
            { transform: 'rotate(-14deg)' },
          ],
          { duration: 250 },
        );
        SND.sad();
      },
      async spendRespin(left) {
        // An acorn hops out of the tray and arcs up into the wheel; the squirrel catches it.
        const sock = rectOfSel(`[data-sock="${left}"]`);
        const from = sock ? { x: sock.x + 20, y: sock.y + 20 } : { x: 600, y: 700 };
        await flyImg(kit, ACORN, from, MOUTH, 40, 650, -140);
        SND.pop();
        setPeek(true);
        later(250, () => setPeek(false));
      },
      spinStart() {
        run(true);
        SND.whoosh();
      },
      teaseStart() {
        setPeek(true);
        SND.drum();
      },
      reelStopped(i, _order, _total, value) {
        SND.stop();
        setPeek(false);
        const r = rectOfSel(`[data-reel="${i}"]`);
        if (!r) return;
        kit.burst(r.x + r.w / 2, r.y + r.h - 4, 'dust', 5, {
          speed: 2.5,
          gravity: -0.02,
          size: 6,
          decay: 0.04,
        });
        if (
          (value.kind === 'item' && value.tier === 2) ||
          (value.kind === 'bundle' && value.resources.length >= 5)
        ) {
          kit.burst(r.x + r.w / 2, r.y + r.h / 2, 'star', 26, {
            speed: 7,
            gravity: 0.05,
            size: 9,
            colors: SPARKS,
            decay: 0.02,
          });
          SND.chime();
        }
      },
      spinEnd() {
        run(false);
      },
      win(b) {
        SND.win();
        fastBulbs();
        if (b.kind === 'jackpot') {
          setRays((r) => r + 1);
          flip();
          kit.shake(12, 700);
          SND.fanfare();
          kit.burst(800, -20, 'img', 70, { src: ACORN, size: 34, gravity: 0.12, rain: true });
          kit.burst(800, -20, 'leaf', 90, { colors: LEAVES, size: 9, gravity: 0.06, rain: true });
        } else if (b.kind === 'threes') {
          flip();
          kit.shake(10, 500);
          SND.fanfare();
          kit.burst(800, -20, 'img', 50, { src: ACORN, size: 30, gravity: 0.12, rain: true });
        }
      },
      stamped() {
        later(110, () => kit.shake(5, 260));
      },
      upgraded(i) {
        const r = rectOfSel(`[data-reel="${i}"]`);
        if (r) {
          kit.burst(r.x + r.w / 2, r.y + r.h / 2, 'star', 30, {
            speed: 8,
            gravity: 0.05,
            size: 10,
            colors: SPARKS,
            decay: 0.02,
          });
        }
        SND.chime();
      },
      async gainRespin() {
        // The squirrel tosses an acorn into the tray; it lands with a clink.
        const socks = kit.find(`.${styles.acorns}`);
        const last = socks?.lastElementChild;
        if (last) {
          const r = kit.rectOf(last);
          await flyImg(kit, ACORN, MOUTH, { x: r.x + 20, y: r.y + 20 }, 46, 900, -160);
        }
        SND.clink();
      },
      async flyTo(ghost, from, to) {
        const w = ghost.offsetWidth || from.w;
        const h = ghost.offsetHeight || from.h;
        const dx = to.x + to.w / 2 - (from.x + w / 2);
        const dy = to.y + to.h / 2 - (from.y + h / 2);
        const sc = Math.min(to.w / w, to.h / h) * 1.1;
        const cur = ghost.style.transform || 'none';
        await ghost.animate(
          [
            { transform: cur },
            {
              transform: `translate(${dx}px, ${dy - 40}px) scale(${(sc + 1) / 2}) rotate(8deg)`,
              offset: 0.6,
            },
            { transform: `translate(${dx}px, ${dy}px) scale(${sc})` },
          ],
          { duration: 420, easing: 'ease-in-out', fill: 'forwards' },
        ).finished;
      },
      packed(_reel, _hiker, to, color) {
        SND.pop();
        SND.clack();
        kit.burst(to.x + to.w / 2, to.y + to.h / 2, 'star', 14, {
          speed: 5,
          gravity: 0.1,
          size: 6,
          colors: [color, '#fff2b0'],
          decay: 0.03,
        });
      },
      reelOn(i) {
        if (i === 0) SND.whoosh();
      },
      secondWind() {},
      async stepChange() {
        cab.current?.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.02)', offset: 0.4 },
            { transform: 'scale(1)' },
          ],
          { duration: 500 },
        );
        await wait(300);
      },
      async turn(h) {
        setTurnTag({ hiker: h, id: ++live.current.tags });
        SND.whoosh();
        await wait(700);
      },
      async openingStart() {
        setTurnTag(null);
      },
      async openBundle(h) {
        // The bundle chip pops and sprays its resources into the hiker's card.
        const slot = kit.find(`[data-hiker="${h}"] [data-bundle-slot]`);
        const res = kit.find(`[data-hiker="${h}"] .${styles.res}`);
        const bundle = live.current.state.packs[h]?.bundles[live.current.view.opened[h] ?? 0];
        if (!slot || !res || !bundle) return;
        const rc = kit.rectOf(slot);
        const tr = kit.rectOf(res);
        slot.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.5) rotate(-10deg)', offset: 0.5 },
            { transform: 'scale(0)' },
          ],
          { duration: 380, fill: 'forwards' },
        );
        SND.pop();
        kit.burst(rc.x + rc.w / 2, rc.y + rc.h / 2, 'star', 10, {
          speed: 5,
          size: 6,
          colors: ['#e4c9a0', '#fff2b0'],
        });
        const before = res.childElementCount;
        await Promise.all(
          bundle.resources.map((id, j) =>
            wait(j * 70).then(() =>
              flyImg(
                kit,
                ASSETS.resources[id] ?? '',
                { x: rc.x + rc.w / 2, y: rc.y },
                { x: tr.x + 10 + ((before + j) % 9) * 21, y: tr.y + 10 },
                26,
                520,
                -70,
                360,
              ),
            ),
          ),
        );
        SND.tick();
      },
      happyTrails() {
        kit.burst(800, -20, 'leaf', 80, { colors: LEAVES, size: 9, gravity: 0.06, rain: true });
      },
    };
  });

  const G = geom(view.reels.length);
  const words = owedWords(state);
  const need = owed(state) && state.step !== 'done';
  const sockets = Math.max(state.step === 'items' ? P.itemRespins : P.bundleRespins, view.respins);
  const locked = view.reels.some((r) => r.lit && r.locked);
  const tagSeat = turnTag ? state.seats[turnTag.hiker] : null;
  const tagArt = tagSeat ? portraitArt(tagSeat.id) : null;
  return (
    <>
      <div className={styles.bracket} />
      <div className={styles.wheelwrap}>
        <SquirrelWheel
          wheelRef={wheel}
          bodyRef={body}
          mood={mood}
          frame={frame}
          peek={peek}
          blink={blink}
        />
      </div>
      <div ref={cab} className={styles.cab}>
        <div className={styles.sign}>
          <div>
            <span className={styles.signText}>LUCKY TRAIL OUTFITTERS</span>
            <span className={styles.signSub}>
              {state.step === 'items' ? 'EST. AT THE TRAILHEAD' : ''}
            </span>
          </div>
          <Bulbs fast={fastUntil > now} />
        </div>
        {turnTag && tagSeat && (
          <div key={turnTag.id} className={styles.turn}>
            <div className={styles.turnCard} style={{ '--tc': tagSeat.color } as CSSProperties}>
              {tagArt && tagArt.kind !== 'icon' && <img src={tagArt.src} alt="" />}
              <div className={styles.turnText}>
                {tagSeat.name.toUpperCase()}’S PICK
                <small>TAKE {P.bundlesEach} BUNDLES</small>
              </div>
            </div>
          </div>
        )}
        <div className={styles.window}>
          <div className={styles.reels}>
            {view.reels.map((rv, i) => {
              const taker = rv.takenBy !== null ? state.seats[rv.takenBy] : null;
              return (
                <Reel
                  key={`${view.reels.length}-${i}`}
                  view={rv}
                  i={i}
                  left={G.x0 + i * (G.w + G.gap)}
                  width={G.w}
                  selected={selected === i}
                  hiker={taker ? { name: taker.name.toUpperCase(), color: taker.color } : null}
                  handlers={reel(i)}
                />
              );
            })}
          </div>
        </div>
        <div className={styles.labels}>
          {view.reels.map((rv, i) => {
            const v = rv.shown;
            const off = !rv.lit || !v || !!rv.spin;
            const background = off
              ? '#6e4a2a'
              : v.kind === 'bundle'
                ? v.resources.length >= 5
                  ? '#e8c55a'
                  : '#e4c9a0'
                : CAB_TYPE[v.type][0];
            const label = off
              ? rv.lit && rv.spin
                ? '· · ·'
                : '—'
              : v.kind === 'bundle'
                ? `×${v.resources.length} BUNDLE`
                : `${TYPE_LABEL[v.type]}${v.tier === 2 ? ' · II' : ''}`;
            return (
              <span
                key={i}
                className={join(off && styles.labelOff)}
                style={{ left: G.x0 + i * (G.w + G.gap), width: G.w, background }}
              >
                {label}
              </span>
            );
          })}
        </div>
        <div className={styles.tray}>
          <div className={styles.trayLabel}>RESPINS</div>
          <div className={styles.acorns}>
            {Array.from({ length: sockets }, (_, k) => {
              const has = k < view.respins && !(view.arriving && k === view.respins - 1);
              const fresh = view.gainedId > 0 && k === view.respins - 1 && !view.arriving;
              return (
                <div
                  key={`${k}-${fresh ? view.gainedId : 0}`}
                  data-sock={k}
                  className={join(styles.sock, fresh && styles.sockNew)}
                >
                  {has && <img src={ACORN} alt="" />}
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.plate}>
          <div>
            <div className={styles.plateBig}>{words.big}</div>
            <div className={styles.plateSmall}>{words.small}</div>
          </div>
        </div>
      </div>
      <div className={styles.leverbase} />
      <button
        ref={lever}
        type="button"
        className={join(
          styles.lever,
          leverOff && styles.leverOff,
          !leverOff && locked && styles.leverGlow,
        )}
        aria-label="Pull the hiking pole to spin"
        aria-disabled={leverOff}
        onClick={onPull}
      >
        <span className={styles.pole} />
        <span className={styles.strap} />
        <span className={styles.grip} />
        <span className={styles.pivot} />
      </button>
      {need && (
        <p className={styles.lvtag}>
          {leverOff ? (
            <>
              NO RESPINS LEFT:
              <br />
              TAKE ONE
            </>
          ) : (
            <>
              PULL THE POLE
              <br />
              OR PRESS SPACE
            </>
          )}
        </p>
      )}
      {rays > 0 && <div key={rays} className={styles.rays} />}
      {view.stamp && <Stamp key={view.stamp.id} stamp={view.stamp} />}
    </>
  );
}
