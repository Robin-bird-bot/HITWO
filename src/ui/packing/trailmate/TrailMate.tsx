/**
 * TrailMate, the packing screen's default look (28-packing-screen-trailmate.md):
 * the challenge pop-up's yellow handheld, shaped like a slot machine. A status
 * screen with a radar, satellites and a typed status line; five little LCD
 * reels (three for bundles) with the items' art in LCD greens inside bright
 * type brackets; a battery of scans, the SCAN button and an antenna to pull.
 * Its background is hiker select's paint in the dark preset.
 */
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { BALANCE } from '../../../config/balance';
import { asset, ASSETS } from '../../../config/assets';
import { ITEMS } from '../../../content/items';
import { owed, type ReelSymbol } from '../../../packing/logic';
import { Icon } from '../../icons/Icon';
import { TYPE_ICON } from '../../items/itemLook';
import { portraitArt } from '../../hikers/portraitArt';
import { useGreenArt } from '../greenify';
import type { Kit, ReelView, SkinFx, SkinProps, StampView } from '../machine';
import { ReelStrip } from '../parts';
import { owedWords, TYPE_LABEL } from '../words';
import { GOLD, NEON, TIER2_SPARKS, TYPE_COLOR, sizeColor } from './colors';
import { wait } from '../useDirector';
import { TM, TRAILMATE_SOUNDS } from './sounds';
import styles from './TrailMate.module.css';

const P = BALANCE.packing;

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

const TICKER =
  'TRAILMATE SUPPLY SCAN  ·  SATS 5/5  ·  44.12°N 121.33°W  ·  ELEV 4,210 FT  ·  SUPPLY CACHES NEARBY  ·  PACK LIGHT, PACK RIGHT  ·  ';

/** The reels' places on the face: 5 narrow screens, or 3 wide ones. */
const geom = (n: number) => (n === 5 ? { w: 126, gap: 14, x0: 1 } : { w: 190, gap: 30, x0: 29 });
const MID = 62;
const OVERSHOOT = [18, 6] as const;

/** TV static for the spinning screens, made once. */
let staticUrl: string | null = null;
function noiseUrl(): string {
  if (staticUrl) return staticUrl;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d');
  if (!g) return '';
  const d = g.createImageData(96, 96);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 30 + Math.random() * 60 : 200 + Math.random() * 55;
    d.data[i] = v;
    d.data[i + 1] = v;
    d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  staticUrl = c.toDataURL();
  return staticUrl;
}

const greenResource = (id: string) => asset(`resources-green/${id}.png`);

/** An item's art in LCD greens (blank until it's made); its type's icon when it has no art yet. */
export function GreenItem({ itemId, className }: { itemId: string; className?: string }) {
  const def = ITEMS[itemId];
  const url = useGreenArt(def?.art ? ASSETS.itemArt(def.art) : undefined);
  if (def && !def.art) {
    return <Icon name={TYPE_ICON[def.type]} size={26} color="#2B3A23" strokeWidth={2.4} />;
  }
  return url ? (
    <img className={className} src={url} alt="" draggable={false} />
  ) : (
    <span className={className} />
  );
}

function Brackets() {
  return (
    <>
      <i className={join(styles.br, styles.brA)} />
      <i className={join(styles.br, styles.brB)} />
      <i className={join(styles.br, styles.brC)} />
      <i className={join(styles.br, styles.brD)} />
    </>
  );
}

/** A reel's symbol: green art in bright type brackets, or a bundle's green resource icons. */
export function TrailMateSymbol({ value }: { value: ReelSymbol }) {
  if (value.kind === 'bundle') {
    const n = value.resources.length;
    const rows = n <= 3 ? [n] : n === 4 ? [2, 2] : [3, 2];
    let k = 0;
    return (
      <div
        className={join(styles.gbun, styles[`n${Math.min(n, 5)}`], n >= 5 && styles.b5)}
        style={{ '--tc': sizeColor(n) } as CSSProperties}
      >
        <Brackets />
        {rows.map((count, r) => (
          <div key={r} className={styles.brow}>
            {value.resources.slice(k, (k += count)).map((id, j) => (
              <img key={j} className={styles.px} src={greenResource(id)} alt="" draggable={false} />
            ))}
          </div>
        ))}
        <span className={styles.szc}>×{n}</span>
      </div>
    );
  }
  return (
    <div
      className={join(styles.gsym, value.tier === 2 && styles.t2)}
      style={{ '--tc': TYPE_COLOR[value.type] } as CSSProperties}
    >
      <Brackets />
      <span className={styles.tb}>
        <Icon name={TYPE_ICON[value.type]} size={16} color="#111A10" strokeWidth={2.4} />
      </span>
      <GreenItem itemId={value.itemId} className={styles.px} />
      {value.tier === 2 && <span className={styles.t2c}>II</span>}
    </div>
  );
}

/** A reel: a little LCD screen with its strip, scanlines, reticle and offline cover. */
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
  const scr = useRef<HTMLDivElement>(null);
  const kind = view.shown?.kind;
  // Lighting up: a bright line that opens into the picture (an old CRT).
  useLayoutEffect(() => {
    if (!view.onId) return;
    scr.current?.animate(
      [
        { transform: 'scale(0, .015)', filter: 'brightness(5)' },
        { transform: 'scale(1, .015)', filter: 'brightness(3)', offset: 0.35 },
        { transform: 'scale(1, 1.04)', filter: 'brightness(1.6)', offset: 0.7 },
        { transform: 'scale(1, 1)', filter: 'brightness(1)' },
      ],
      { duration: 500, easing: 'ease-out' },
    );
  }, [view.onId]);
  // A win: the screen flashes in negative.
  useLayoutEffect(() => {
    if (!view.winId) return;
    scr.current?.animate(
      [{ filter: 'none' }, { filter: 'invert(1) hue-rotate(180deg)' }, { filter: 'none' }],
      { duration: 220, iterations: 4, easing: 'steps(1)' },
    );
  }, [view.winId]);
  // Turning Tier II glitches (shift, skew, invert); a growing bundle flashes.
  useLayoutEffect(() => {
    if (!view.upId) return;
    scr.current?.animate(
      kind === 'bundle'
        ? [
            { filter: 'none' },
            { filter: 'invert(1)', offset: 0.3 },
            { filter: 'brightness(2)', offset: 0.6 },
            { filter: 'none' },
          ]
        : [
            { transform: 'none', filter: 'none' },
            {
              transform: 'translateX(-6px) skewX(8deg)',
              filter: 'hue-rotate(90deg) brightness(1.6)',
              offset: 0.25,
            },
            { transform: 'translateX(5px) skewX(-6deg)', filter: 'invert(1)', offset: 0.5 },
            { transform: 'none', filter: 'brightness(2.5)', offset: 0.75 },
            { transform: 'none', filter: 'none' },
          ],
      { duration: kind === 'bundle' ? 480 : 560, easing: 'steps(6)' },
    );
  }, [view.upId, kind]);
  const spinning = !!view.spin;
  return (
    <div
      data-reel={i}
      className={join(
        styles.reel,
        !view.lit && styles.reelDark,
        view.quiet && styles.reelQuiet,
        spinning && styles.spinning,
        view.tease && styles.tease,
        selected && styles.sel,
      )}
      style={{ left, width }}
      {...handlers}
    >
      <div ref={scr} className={styles.scr}>
        <ReelStrip
          view={view}
          mid={MID}
          blur={6}
          overshoot={OVERSHOOT}
          className={styles.strip}
          cellClass={styles.cell}
          render={(v) => v && <TrailMateSymbol value={v} />}
        />
        <div className={styles.shd} />
        <div className={styles.payl} />
        <div className={styles.static} style={{ backgroundImage: `url(${noiseUrl()})` }} />
        {view.stopId > 0 && <div key={`f${view.stopId}`} className={styles.flash} />}
        {view.stopId > 0 && (
          <div key={`r${view.stopId}`} className={styles.ret}>
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        {view.tease && <div className={styles.tret} />}
      </div>
      {view.winId > 0 && <div key={view.winId} className={styles.winRing} />}
      {view.lit && view.locked && (
        <div className={styles.lockx}>
          <span>
            TAKE ONE
            <br />
            ONLY
          </span>
        </div>
      )}
      <div className={styles.offl}>
        <div className={styles.who}>
          OFFLINE
          {hiker && <b style={{ '--tc': hiker.color } as CSSProperties}>→ {hiker.name}</b>}
        </div>
      </div>
    </div>
  );
}

/** The LCD pop-up for wins: neon pixel text with glitch slices, and a typed line under it. */
function Stamp({ stamp, reduced }: { stamp: StampView; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState('');
  useLayoutEffect(() => {
    ref.current?.animate(
      [
        { opacity: 0, transform: 'scaleY(.04) scaleX(1.3)', filter: 'brightness(4)' },
        {
          opacity: 1,
          transform: 'scaleY(1.06) scaleX(1)',
          filter: 'brightness(1.6)',
          offset: 0.12,
        },
        { opacity: 1, transform: 'none', filter: 'brightness(1)', offset: 0.2 },
        { opacity: 1, transform: 'none', offset: 0.86 },
        { opacity: 0, transform: 'scaleY(.04) scaleX(1.2)', filter: 'brightness(3)' },
      ],
      { duration: stamp.ms + 500, easing: 'ease-out' },
    );
  }, [stamp]);
  useEffect(() => {
    let k = 0;
    let timer = 0;
    const step = () => {
      k++;
      setTyped(stamp.sub.slice(0, k));
      if (k < stamp.sub.length) timer = window.setTimeout(step, 22);
    };
    timer = window.setTimeout(step, reduced ? 0 : 160);
    return () => clearTimeout(timer);
  }, [stamp, reduced]);
  return (
    <div ref={ref} className={join(styles.stamp, stamp.gold && styles.stampGold)}>
      <div className={styles.pop}>
        <div className={styles.ttl} data-t={reduced ? '' : stamp.text}>
          {stamp.text}
        </div>
        <div className={styles.tsub}>
          &gt; {typed}
          <span className={styles.cur}>_</span>
        </div>
      </div>
    </div>
  );
}

/** Sparks that run along a line, like a little bolt of electricity. */
function bolt(
  kit: Kit,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
) {
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    setTimeout(() => {
      kit.burst(
        from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 18,
        from.y + (to.y - from.y) * t + (Math.random() - 0.5) * 18,
        'bit',
        3,
        { speed: 1.5, gravity: 0, size: 6, colors: [color, '#ffffff'], decay: 0.06 },
      );
    }, k * 22);
  }
}

const center = (r: { x: number; y: number; w: number; h: number }) => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2,
});

export function TrailMateMachine({
  fxRef,
  kit,
  state,
  view,
  selected,
  leverOff,
  onPull,
  reel,
}: SkinProps) {
  const [statusOn, setStatusOn] = useState(false);
  const [stat, setStat] = useState({ text: '', cursor: false });
  const [ticker, setTicker] = useState(TICKER);
  const [sats, setSats] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [led, setLed] = useState<'off' | 'on' | 'fast'>('off');
  const [mascot, setMascot] = useState<'ok' | 'happy' | null>(null);
  const [turnPic, setTurnPic] = useState<number | null>(null);
  const [pressed, setPressed] = useState(false);
  const [drain, setDrain] = useState<{ index: number; id: number } | null>(null);
  const [empty, setEmpty] = useState(0);
  const lever = useRef<HTMLButtonElement>(null);
  const dev = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const live = useRef({ state, typing: 0, drains: 0 });
  useEffect(() => {
    live.current.state = state;
  });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** Types the status line out, a character at a time, with a tick. */
  const typeStat = async (line: string, ms = 32) => {
    const mine = ++live.current.typing;
    for (let k = 1; k <= line.length; k++) {
      if (mine !== live.current.typing) return;
      setStat({ text: line.slice(0, k), cursor: true });
      if (k % 2) TRAILMATE_SOUNDS.tick();
      await wait(kit.reduced ? 0 : ms);
    }
    setStat({ text: line, cursor: false });
  };
  const say = (line: string, sub?: string) => {
    live.current.typing++;
    setStat({ text: line, cursor: false });
    if (sub) {
      setTicker(`${sub}  ·  `.repeat(8));
      later(4000, () => setTicker(TICKER));
    }
  };
  const showMascot = (mood: 'ok' | 'happy') => {
    setMascot(mood);
    later(2600, () => setMascot(null));
  };
  /** What the status line says when the machine is waiting. */
  const idle = () => {
    const s = live.current.state;
    if (s.step === 'items') say(s.picksLeft > 0 ? `TAKE ${s.picksLeft}` : 'ALL PACKED');
    else if (s.step === 'resources') say(`${s.seats[s.turn]?.name.toUpperCase() ?? ''}'S PICK`);
  };
  const reelsRect = () => {
    const el = kit.find(`.${styles.reels}`);
    return el ? kit.rectOf(el) : { x: 456, y: 214, w: 688, h: 254 };
  };
  /** The device strobes on a big win. */
  const strobe = () => {
    if (kit.reduced) return;
    dev.current?.animate(
      [{ filter: 'none' }, { filter: 'brightness(1.35) saturate(1.3)' }, { filter: 'none' }],
      { duration: 120, iterations: 12, easing: 'steps(2)' },
    );
  };
  const rectOfSel = (sel: string) => {
    const el = kit.find(sel);
    return el ? kit.rectOf(el) : null;
  };

  useImperativeHandle(fxRef, (): SkinFx => {
    const n = state.seats.length;
    return {
      sounds: TRAILMATE_SOUNDS,
      words: {
        row3: ['BONUS SCAN!', '3 IN A ROW · +1 SCAN'],
        row4: ['4 IN A ROW!', 'ONE GOES TIER II · FREE SCAN'],
        jackpot: ['CACHE JACKPOT!', 'ALL TIER II · TAKE ONE · FREE SCAN'],
        ones: ['BONUS SCAN!', '×1 ×1 ×1 · +1 SCAN'],
        twos: ['BUNDLE BOOST!', 'ONE GROWS TO ×3 · +1 SCAN'],
        threes: ['BIG BUNDLE!', 'ONE GROWS TO ×5 · +1 SCAN'],
        secondWind: ['REBOOT!', 'EVERY SCREEN BACK ONLINE · FREE SCAN'],
        allPacked: [
          'ALL PACKED!',
          `${n} HIKER${n === 1 ? '' : 'S'} · ${state.packs.reduce((a, p) => a + p.items.length, 0)} ITEMS`,
        ],
        ready: ['READY!', `EVERY HIKER HAS ${P.bundlesEach} BUNDLES`],
        happy: ['HAPPY TRAILS!', 'ROUTE LOADED · THE HIKE STARTS ON THE TRAILHEAD'],
      },
      tickMs: 55,
      teaseMs: P.anim.teaseTrailMateMs,
      lightGapMs: 130,
      async intro() {
        await wait(kit.reduced ? 0 : 200);
        setLed('on');
        TM.boot();
        setStatusOn(true);
        statusRef.current?.animate(
          [
            { filter: 'brightness(4)', transform: 'scaleY(.05)' },
            { filter: 'brightness(1)', transform: 'none' },
          ],
          { duration: 420, easing: 'ease-out' },
        );
        await typeStat('TRAILMATE OS 2.6', 28);
        await wait(150);
        for (let k = 1; k <= 5; k++) {
          setSats(k);
          TRAILMATE_SOUNDS.tick();
          await wait(kit.reduced ? 0 : 110);
        }
        await typeStat('SUPPLY SCAN', 26);
      },
      lever() {
        TRAILMATE_SOUNDS.ratchet();
        lever.current?.animate(
          [
            { transform: 'rotate(-12deg)' },
            { transform: 'rotate(64deg)', offset: 0.35, easing: 'ease-in' },
            { transform: 'rotate(56deg)', offset: 0.5 },
            { transform: 'rotate(-20deg)', offset: 0.8 },
            { transform: 'rotate(-12deg)' },
          ],
          { duration: 650, easing: 'ease-out' },
        );
        setPressed(true);
        later(180, () => setPressed(false));
        dev.current?.animate(
          [
            { transform: 'none' },
            { transform: 'translateY(3px)', offset: 0.3 },
            { transform: 'none' },
          ],
          { duration: 260, delay: 150 },
        );
      },
      noRespins() {
        lever.current?.animate(
          [
            { transform: 'rotate(-12deg)' },
            { transform: 'rotate(-4deg)' },
            { transform: 'rotate(-12deg)' },
          ],
          { duration: 250 },
        );
        TRAILMATE_SOUNDS.sad();
        say('NO SCANS LEFT');
        setEmpty((e) => e + 1);
      },
      async spendRespin(left) {
        setDrain({ index: left, id: ++live.current.drains });
        const cell = rectOfSel(`[data-cell="${left}"]`);
        const btn = rectOfSel(`.${styles.scan}`);
        if (cell && btn) bolt(kit, { x: cell.x + 15, y: cell.y + 20 }, center(btn), '#6BFF8A');
        TM.zap();
        await wait(420);
      },
      spinStart() {
        setScanning(true);
        setLed('fast');
        TM.sweep();
        live.current.typing++;
        setStat({ text: 'SCANNING...', cursor: true });
        setTicker(`${'ACQUIRING SIGNAL'}  ·  `.repeat(8));
        later(4000, () => setTicker(TICKER));
      },
      teaseStart() {
        TRAILMATE_SOUNDS.drum();
        void (async () => {
          for (let p = 12; p <= 99; p += 7) {
            setStat({ text: `LOCKING ${p}%`, cursor: false });
            await wait(70);
          }
        })();
      },
      reelStopped(i, order, total, value) {
        TRAILMATE_SOUNDS.stop(order);
        setStat({ text: `LOCK ${order + 1}/${total}`, cursor: false });
        const r = rectOfSel(`[data-reel="${i}"]`);
        if (!r) return;
        kit.burst(r.x + r.w / 2, r.y + r.h - 8, 'pix', 6, {
          speed: 3,
          gravity: 0.15,
          size: 4,
          colors: ['#BAC995', '#D3DFAF'],
          decay: 0.04,
        });
        if (
          (value.kind === 'item' && value.tier === 2) ||
          (value.kind === 'bundle' && value.resources.length >= 5)
        ) {
          kit.burst(r.x + r.w / 2, r.y + r.h / 2, 'pix', 34, {
            speed: 8,
            gravity: 0.08,
            size: 6,
            colors: TIER2_SPARKS,
            decay: 0.02,
          });
          TRAILMATE_SOUNDS.chime();
        }
      },
      spinEnd() {
        setScanning(false);
        setLed('on');
        idle();
      },
      win(b) {
        const c = center(reelsRect());
        TRAILMATE_SOUNDS.win();
        showMascot(b.kind === 'jackpot' || b.kind === 'threes' ? 'happy' : 'ok');
        kit.burst(c.x, c.y, 'ring', 1, { colors: ['#6BFF8A'], max: 520, decay: 0.02 });
        say(b.kind === 'jackpot' ? '!! JACKPOT !!' : b.kind === 'row4' ? 'UPGRADE!' : 'BONUS!');
        if (b.kind === 'jackpot') {
          setLed('fast');
          TRAILMATE_SOUNDS.fanfare();
          kit.shake(14, 800);
          strobe();
          for (let k = 0; k < 4; k++) {
            later(k * 220, () =>
              kit.burst(c.x, c.y, 'ring', 1, { colors: [NEON[k] ?? GOLD], max: 900, decay: 0.014 }),
            );
          }
          kit.burst(800, -20, 'glyph', 160, {
            colors: ['#6BFF8A', '#BAC995', '#D3DFAF'],
            size: 18,
            gravity: 0,
            rain: true,
          });
          kit.burst(c.x, c.y, 'pix', 140, {
            speed: 16,
            gravity: 0.25,
            size: 9,
            colors: NEON,
            decay: 0.01,
          });
          kit.burst(800, -20, 'img', 40, {
            src: asset('minigames/dodge/acorn-0.png'),
            size: 30,
            gravity: 0.1,
            rain: true,
            pixelated: true,
          });
        } else if (b.kind === 'threes') {
          TRAILMATE_SOUNDS.fanfare();
          kit.shake(10, 500);
          strobe();
          kit.burst(800, -20, 'glyph', 90, {
            colors: ['#6BFF8A', '#BAC995'],
            size: 16,
            gravity: 0,
            rain: true,
          });
          kit.burst(800, 330, 'pix', 70, {
            speed: 12,
            gravity: 0.2,
            size: 8,
            colors: NEON,
            decay: 0.012,
          });
        }
      },
      stamped(kind) {
        TM.modem();
        later(80, () => kit.shake(5, 260));
        if (kind === 'allPacked') say('ALL PACKED');
        else if (kind === 'ready') say('ALL SET');
      },
      upgraded(i) {
        const r = rectOfSel(`[data-reel="${i}"]`);
        if (r) {
          kit.burst(r.x + r.w / 2, r.y + r.h / 2, 'pix', 34, {
            speed: 8,
            gravity: 0.08,
            size: 7,
            colors: TIER2_SPARKS,
            decay: 0.02,
          });
        }
        TRAILMATE_SOUNDS.chime();
      },
      async gainRespin() {
        const radar = rectOfSel(`.${styles.radar}`);
        const cells = kit.find(`.${styles.cells}`);
        const last = cells?.lastElementChild;
        if (radar && last) {
          const c = kit.rectOf(last);
          bolt(kit, center(radar), { x: c.x + 15, y: c.y + 20 }, GOLD);
        }
        TM.zap();
        await wait(360);
        TRAILMATE_SOUNDS.clink();
        later(300, idle);
      },
      async flyTo(ghost, from, to, color) {
        TM.modem();
        const w = ghost.offsetWidth || from.w;
        const h = ghost.offsetHeight || from.h;
        const dx = to.x + to.w / 2 - (from.x + w / 2);
        const dy = to.y + to.h / 2 - (from.y + h / 2);
        const sc = Math.min(to.w / w, to.h / h) * 1.1;
        bolt(kit, { x: from.x + w / 2, y: from.y + h / 2 }, center(to), color);
        const cur = ghost.style.transform || 'none';
        await ghost.animate(
          [
            { transform: cur, filter: 'brightness(1)' },
            {
              transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${(sc + 1) / 2}, ${((sc + 1) / 2) * 0.3})`,
              filter: 'brightness(3)',
              offset: 0.5,
            },
            { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, filter: 'brightness(1)' },
          ],
          { duration: 400, easing: 'ease-in-out', fill: 'forwards' },
        ).finished;
      },
      packed(_reel, hiker, to, color, value) {
        TRAILMATE_SOUNDS.pop();
        TRAILMATE_SOUNDS.clack();
        kit.burst(to.x + to.w / 2, to.y + to.h / 2, 'pix', 16, {
          speed: 5,
          gravity: 0.1,
          size: 5,
          colors: [color, '#ffffff', '#6BFF8A'],
          decay: 0.03,
        });
        const s = live.current.state;
        const who = s.seats[hiker]?.name.toUpperCase() ?? '';
        if (value.kind === 'item') {
          const left = s.picksLeft - 1;
          say(
            left > 0 ? `TAKE ${left}` : 'ALL PACKED',
            `${ITEMS[value.itemId]?.name.toUpperCase()} → ${who}`,
          );
        }
      },
      reelOn() {
        TM.crtOn();
      },
      secondWind() {
        say('REBOOT...');
      },
      async stepChange() {
        setTurnPic(null);
        await typeStat('BUNDLE SCAN', 26);
        await wait(200);
      },
      async turn(h) {
        setTurnPic(h);
        await typeStat(`${live.current.state.seats[h]?.name.toUpperCase() ?? ''}'S PICK`, 30);
      },
      async openingStart() {
        setTurnPic(null);
        await typeStat('DOWNLOADING', 30);
      },
      async openBundle(h) {
        await wait(40);
        TM.modem();
        await wait(520);
        const sacks = rectOfSel(`[data-hiker="${h}"] .${styles.sacks}`);
        if (sacks) {
          kit.burst(sacks.x + 20, sacks.y + 10, 'pix', 14, {
            speed: 5,
            size: 5,
            colors: ['#6BFF8A', '#ffffff'],
          });
        }
        TRAILMATE_SOUNDS.stop(h);
      },
      happyTrails() {
        say('ROUTE LOADED', 'HAPPY TRAILS');
        showMascot('happy');
        later(400, () =>
          kit.burst(800, -20, 'glyph', 80, {
            colors: ['#6BFF8A', '#BAC995'],
            size: 16,
            gravity: 0,
            rain: true,
          }),
        );
      },
    };
  });

  const G = geom(view.reels.length);
  const words = owedWords(state);
  const need = owed(state) && state.step !== 'done';
  const cellsShown = Math.max(
    state.step === 'items' ? P.itemRespins : P.bundleRespins,
    view.respins,
  );
  const ready = !leverOff && !view.busy;
  const turnSeat = turnPic !== null ? state.seats[turnPic] : null;
  const turnArt = turnSeat ? portraitArt(turnSeat.id) : null;
  return (
    <>
      <div
        className={join(
          styles.antenna,
          led === 'on' && styles.ledOn,
          led === 'fast' && styles.ledOn,
          led === 'fast' && styles.ledFast,
        )}
      />
      <div ref={dev} className={styles.dev}>
        <span className={styles.grip} style={{ top: 180 }} />
        <span className={styles.grip} style={{ top: 252 }} />
        <span className={styles.screw} style={{ left: 30, top: 30 }} />
        <span className={styles.screw} style={{ right: 30, top: 30 }} />
        <span className={styles.screw} style={{ left: 30, bottom: 30 }} />
        <span className={styles.screw} style={{ right: 30, bottom: 30 }} />
        <div className={styles.face}>
          <div
            ref={statusRef}
            className={join(
              styles.lcd,
              styles.status,
              !statusOn && styles.statusOff,
              scanning && styles.scanning,
            )}
          >
            <svg className={styles.radar} viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="46" fill="#A0B37D" stroke="#1D2918" strokeWidth="2.5" />
              <circle cx="50" cy="50" r="31" fill="none" stroke="#52653F" strokeWidth="1.5" />
              <circle cx="50" cy="50" r="16" fill="none" stroke="#52653F" strokeWidth="1.5" />
              <path d="M50 4 V96 M4 50 H96" stroke="#52653F" strokeWidth="1.2" />
              <g className={styles.sweep}>
                <path d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z" fill="#3C4E2F" opacity=".55" />
                <path d="M50 50 L50 4" stroke="#1D2918" strokeWidth="2.5" />
              </g>
              <g>
                {Array.from({ length: sats }, (_, k) => {
                  const a = k * 1.3 + 0.4;
                  const r = 14 + ((k * 7) % 30);
                  return (
                    <circle
                      key={k}
                      className={styles.blip}
                      cx={50 + r * Math.cos(a)}
                      cy={50 + r * Math.sin(a)}
                      r="3.2"
                      fill="#1D2918"
                      style={{ animationDelay: `${k * 0.45}s` }}
                    />
                  );
                })}
              </g>
              <circle cx="50" cy="50" r="3.5" fill="#1D2918" />
            </svg>
            <div className={styles.stbox}>
              <div className={styles.stat} role="status">
                {stat.text}
                {stat.cursor && <span className={styles.cur}>_</span>}
              </div>
              <div className={styles.sub}>
                <div className={styles.ticker}>{ticker.repeat(4)}</div>
              </div>
            </div>
            <div className={styles.sig}>
              {[6, 10, 14, 19, 24].map((h, k) => (
                <i key={h} className={join(k < sats && styles.sigOn)} style={{ height: h }} />
              ))}
              <span>SAT {sats}/5</span>
            </div>
            {turnSeat && turnArt && (
              <div className={styles.turnbox} style={{ '--tc': turnSeat.color } as CSSProperties}>
                {turnArt.kind !== 'icon' && <img src={turnArt.src} alt="" />}
              </div>
            )}
            <img
              className={join(styles.mascot, mascot && styles.mascotUp)}
              src={asset(
                mascot === 'happy'
                  ? 'minigames/squirrel-theft/squirrel-happy.png'
                  : 'minigames/squirrel-theft/squirrel.png',
              )}
              alt=""
            />
          </div>
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
          <div className={styles.labels}>
            {view.reels.map((rv, i) => {
              const v = rv.shown;
              const off = !rv.lit || !v || !!rv.spin;
              const color = off
                ? '#5e7a52'
                : v.kind === 'bundle'
                  ? sizeColor(v.resources.length)
                  : v.tier === 2
                    ? GOLD
                    : TYPE_COLOR[v.type];
              const label = off
                ? rv.lit && rv.spin
                  ? 'SCANNING'
                  : 'OFFLINE'
                : v.kind === 'bundle'
                  ? `×${v.resources.length} BUNDLE`
                  : `${TYPE_LABEL[v.type]}${v.tier === 2 ? ' · II' : ''}`;
              return (
                <span
                  key={i}
                  className={join(off && styles.labelOff)}
                  style={
                    { left: G.x0 + i * (G.w + G.gap), width: G.w, '--tc': color } as CSSProperties
                  }
                >
                  <i />
                  {label}
                </span>
              );
            })}
          </div>
          <div key={`bat-${empty}`} className={join(styles.bat, empty > 0 && styles.batEmpty)}>
            <div className={styles.batLabel}>
              <span>SCANS</span>
              <b>{view.respins}</b>
            </div>
            <div className={styles.cells}>
              {Array.from({ length: cellsShown }, (_, k) => {
                const on = k < view.respins && !(view.arriving && k === view.respins - 1);
                const drained = drain && drain.index === k && !on;
                const fresh = view.gainedId > 0 && k === view.respins - 1 && !view.arriving;
                return (
                  <div
                    key={`${k}-${drained ? drain.id : 0}-${fresh ? view.gainedId : 0}`}
                    data-cell={k}
                    className={join(
                      on ? styles.cellOn : styles.cellOff,
                      drained && styles.cellDrain,
                      fresh && on && styles.cellNew,
                    )}
                  />
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className={join(
              styles.scan,
              leverOff && styles.scanOff,
              ready && styles.scanReady,
              pressed && styles.scanDown,
            )}
            aria-label="Scan"
            aria-disabled={leverOff}
            onClick={onPull}
          >
            <span>SCAN</span>
          </button>
          <div className={join(styles.lcd, styles.picks)}>
            <div>
              <div className={styles.pbig}>{words.big}</div>
              <div className={styles.psm}>{words.small}</div>
            </div>
          </div>
          <div className={styles.brand}>
            TRAILMATE<small>SUPPLY SCANNER</small>
          </div>
          <div className={styles.grille} />
        </div>
      </div>
      <div className={styles.leverbase} />
      <button
        ref={lever}
        type="button"
        className={join(styles.lever, leverOff && styles.leverOff)}
        aria-label="Pull the antenna to scan"
        aria-disabled={leverOff}
        onClick={onPull}
      >
        <span className={styles.pole} />
        <span className={styles.coil} />
        <span className={styles.ball} />
        <span className={styles.pivot} />
      </button>
      {need && (
        <p className={styles.lvtag}>
          {leverOff ? (
            <>
              NO SCANS LEFT:
              <br />
              TAKE ONE
            </>
          ) : (
            <>
              PULL THE ANTENNA,
              <br />
              PRESS SCAN,
              <br />
              OR PRESS SPACE
            </>
          )}
        </p>
      )}
      {view.stamp && <Stamp key={view.stamp.id} stamp={view.stamp} reduced={kit.reduced} />}
    </>
  );
}
