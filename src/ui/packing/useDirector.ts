/**
 * The packing screen's director: it runs the rules (`src/packing/logic.ts`)
 * and plays each step in order on whichever look is showing (27, sections 3
 * to 5): the lever, the reels stopping left to right with a tease, the row
 * that pays with its stamp and upgrades, packing, Second Wind, the resource
 * turns and opening the bundles. The rules decide everything up front; the
 * view only catches up.
 *
 * It's a small store the screen subscribes to, so long sequences can await
 * each effect without React state going stale between steps.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import {
  bundlesDone,
  canSpin,
  canTake,
  finish,
  handover,
  itemsDone,
  keyOf,
  newPacking,
  owed,
  rollBundle,
  rollItem,
  secondWindDue,
  spin,
  take,
  targets,
  toResources,
  type BonusKind,
  type ForceSpin,
  type Packed,
  type PackingState,
  type ReelSymbol,
  type Seat,
} from '../../packing/logic';
import type { MachineView, Rect, ReelView, SkinFx, Words } from './machine';

const A = BALANCE.packing.anim;

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The paytable's rows, top to bottom. */
const ROW: Readonly<Record<BonusKind, number>> = {
  row3: 0,
  row4: 1,
  jackpot: 2,
  ones: 0,
  twos: 1,
  threes: 2,
};

const reelView = (lit: boolean, quiet = false): ReelView => ({
  shown: null,
  above: null,
  below: null,
  lit,
  locked: false,
  takenBy: null,
  spin: null,
  tease: false,
  stopId: 0,
  winId: 0,
  upId: 0,
  onId: 0,
  quiet,
});

/** What the director needs from the screen, kept current on every render. */
export interface DirectorEnv {
  fx(): SkinFx | null;
  /** Where on the stage a hiker's slot is. */
  slotRect(hiker: number, slot: number, bundle: boolean): Rect | null;
  onDone(packed: Packed[]): void;
  /** The one-shot Force next spin (testing), used up when the lever's pulled. */
  takeForce(): ForceSpin | null;
}

export class PackingDirector {
  state: PackingState;
  view: MachineView;
  env: DirectorEnv | null = null;
  /** The paytable drawer is open (a pay doesn't flash its tab). */
  private payOpen = false;
  private version = 0;
  private readonly listeners = new Set<() => void>();
  private ids = 0;
  /** Bumped by start and stop: an old boot stops when it sees a newer one. */
  private run = 0;
  private booted = false;
  // Filler symbols streaming past while a reel spins: for show only.
  private readonly fillerRng = seedRng(Math.floor(Math.random() * 2 ** 31));

  constructor(seed: number, seats: readonly Seat[]) {
    this.state = newPacking({ seed, seats });
    this.view = {
      // Dark until the machine lights them up.
      reels: this.state.reels.map(() => reelView(false, true)),
      respins: this.state.respins,
      arriving: false,
      gainedId: 0,
      stamp: null,
      hit: null,
      pingId: 0,
      bounce: null,
      pop: null,
      opened: this.state.seats.map(() => 0),
      opening: null,
      next: null,
      busy: true,
      leaving: false,
    };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly snapshot = (): number => this.version;

  private render(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  private id(): number {
    return ++this.ids;
  }

  private fx(): SkinFx | null {
    return this.env?.fx() ?? null;
  }

  private filler(): ReelSymbol {
    return this.state.step === 'items' ? rollItem(this.fillerRng) : rollBundle(this.fillerRng);
  }

  /**
   * Boot up and light the (empty) reels, once. The free first spin waits for
   * the player's press (Wyatt: "have the player press them first").
   */
  start(): void {
    const run = ++this.run;
    if (this.booted) return;
    void (async () => {
      await wait(300);
      const f = this.fx();
      // Stopped (or started again) in the meantime: that run boots instead.
      if (!f || run !== this.run || this.booted) return;
      this.booted = true;
      await f.intro();
      await this.lightUp();
      if (run !== this.run) return;
      this.arm();
    })();
  }

  setPayOpen(open: boolean): void {
    this.payOpen = open;
  }

  /** The screen's latest callbacks (every render). */
  connect(env: DirectorEnv): void {
    this.env = env;
  }

  /** The screen closed: every sequence still running stops at its next step. */
  stop(): void {
    this.run++;
    this.env = null;
  }

  private async stamp(kind: keyof Words, gold: boolean, ms = 1200): Promise<void> {
    const f = this.fx();
    if (!f) return;
    const [text, sub] = f.words[kind];
    const st = { text, sub, gold, ms, id: this.id() };
    this.view.stamp = st;
    f.stamped(kind, gold);
    this.render();
    await wait(ms + 300);
    setTimeout(() => {
      if (this.view.stamp?.id === st.id) {
        this.view.stamp = null;
        this.render();
      }
    }, 300);
  }

  /** The free spin is armed: the machine waits for the lever, SCAN or Space. */
  private arm(): void {
    this.view.busy = false;
    this.fx()?.armed();
    this.render();
  }

  /** Lights every reel, one after another (or all at once), empty. */
  private async lightUp(): Promise<void> {
    const f = this.fx();
    if (!f) return;
    for (const [i, r] of this.view.reels.entries()) {
      r.lit = true;
      r.locked = false;
      r.takenBy = null;
      r.quiet = false;
      r.shown = null;
      r.above = null;
      r.below = null;
      r.onId = this.id();
      f.reelOn(i);
      this.render();
      if (f.lightGapMs) await wait(f.lightGapMs);
    }
  }

  /** Pays the row a spin made: the glow, the stamp, the upgrades, the respin. */
  private async pay(s: PackingState): Promise<void> {
    const b = s.last?.bonus;
    const f = this.fx();
    if (!b || !f) return;
    const v = this.view;
    for (const i of b.reels) {
      const rv = v.reels[i];
      if (rv) rv.winId = this.id();
    }
    v.hit = { row: ROW[b.kind], id: this.id() };
    if (!this.payOpen) v.pingId = this.id();
    f.win(b);
    this.render();
    const big = b.kind === 'jackpot' || b.kind === 'threes';
    await this.stamp(b.kind, big, b.kind === 'jackpot' ? 1700 : b.kind === 'threes' ? 1500 : 1200);
    const quick = b.kind === 'jackpot';
    for (const i of b.changed) {
      const rv = v.reels[i];
      if (!rv) continue;
      rv.upId = this.id();
      this.render();
      await wait(quick ? 170 : 260);
      rv.shown = s.reels[i]?.value ?? rv.shown;
      f.upgraded(i);
      this.render();
      await wait(quick ? 220 : 500);
    }
    // The respin it pays lands in the tray.
    v.respins += BALANCE.packing.bonuses.respins;
    v.arriving = true;
    this.render();
    await f.gainRespin();
    v.arriving = false;
    v.gainedId = this.id();
    this.render();
  }

  /** Pulls the lever (or SCAN, or Space). */
  pull(force?: ForceSpin): void {
    void this.spinNow(force);
  }

  private async spinNow(force?: ForceSpin): Promise<void> {
    const s = this.state;
    const v = this.view;
    const f = this.fx();
    if (!f || v.busy || s.step === 'done') return;
    if (!canSpin(s)) {
      if (owed(s) && s.reels.some((r) => r.lit)) f.noRespins();
      return;
    }
    v.busy = true;
    this.render();
    const next = spin(s, force ?? this.env?.takeForce() ?? undefined);
    f.lever();
    if (s.freeSpin) await wait(220);
    else {
      v.respins = s.respins - 1;
      this.render();
      await f.spendRespin(v.respins);
    }
    for (const r of v.reels) r.locked = false;
    f.spinStart();
    const ticks = setInterval(() => f.sounds.tick(), f.tickMs);
    const landed = next.last?.landed ?? [];
    const total = landed.filter(Boolean).length;
    const gap = s.step === 'items' ? A.itemStopGapMs : A.bundleStopGapMs;
    let t = A.firstStopMs;
    let keys: string[] = [];
    let order = 0;
    const stops: Promise<void>[] = [];
    v.reels.forEach((rv, i) => {
      const value = landed[i];
      if (!value) {
        keys = [];
        return;
      }
      // Two side by side so far: this reel could make a row, so it spins longer.
      const last = keys[keys.length - 1];
      let trail = 0;
      for (let k = keys.length - 1; k >= 0 && keys[k] === last; k--) trail++;
      if (trail >= 2) {
        setTimeout(() => {
          rv.tease = true;
          this.fx()?.teaseStart(i);
          this.render();
        }, t - 300);
        t += f.teaseMs;
      }
      const ms = t;
      const cells = Math.max(4, Math.round(ms / 72));
      const list = [
        value,
        ...Array.from({ length: cells - 1 }, () => this.filler()),
        rv.shown ?? this.filler(),
      ];
      rv.spin = { list, prev: this.filler(), ms, id: this.id() };
      rv.tease = false;
      const o = order++;
      stops.push(
        wait(ms).then(() => {
          const prev = rv.spin?.prev ?? null;
          rv.spin = null;
          rv.shown = value;
          rv.above = prev;
          rv.below = list[1] ?? null;
          rv.tease = false;
          rv.stopId = this.id();
          this.fx()?.reelStopped(i, o, total, value);
          this.render();
        }),
      );
      keys.push(keyOf(value));
      t += gap;
    });
    this.render();
    await Promise.all(stops);
    clearInterval(ticks);
    f.spinEnd();
    await this.pay(next);
    this.state = next;
    next.reels.forEach((r, i) => {
      const rv = v.reels[i];
      if (!rv) return;
      rv.locked = r.locked;
      if (r.value) rv.shown = r.value;
    });
    v.respins = next.respins;
    v.busy = false;
    this.render();
  }

  /**
   * Packs a reel's symbol for a hiker. The dragged ghost (if any) flies into
   * the hiker's slot first. False when it can't be taken (the ghost slides back).
   */
  async takeTo(
    reel: number,
    hiker: number,
    ghost: HTMLElement | null,
    from: Rect | null,
  ): Promise<boolean> {
    const s = this.state;
    const v = this.view;
    const f = this.fx();
    if (!f || v.busy || !canTake(s, reel) || !targets(s).includes(hiker)) return false;
    v.busy = true;
    this.render();
    const bundle = s.step === 'resources';
    const pack = s.packs[hiker];
    const seat = s.seats[hiker];
    const slot = bundle
      ? (pack?.bundles.length ?? 0)
      : (seat?.start.length ?? 0) + (pack?.items.length ?? 0);
    const to = this.env?.slotRect(hiker, slot, bundle) ?? null;
    const color = seat?.color ?? '#6BFF8A';
    if (ghost && from && to) await f.flyTo(ghost, from, to, color);
    const value = s.reels[reel]?.value;
    const next = take(s, reel, hiker);
    this.state = next;
    // The reel goes dark under the hiker's name; after a jackpot the rest lock.
    const rv = v.reels[reel];
    if (rv) {
      rv.lit = false;
      rv.takenBy = hiker;
    }
    if (s.jackpotOpen) for (const r of v.reels) if (r.lit) r.locked = true;
    v.bounce = { hiker, id: this.id() };
    v.pop = { hiker, slot, bundle, id: this.id() };
    if (value && to) f.packed(reel, hiker, to, color, value);
    this.render();
    await this.after(s, next);
    return true;
  }

  /** After packing: all packed, Second Wind, the next hiker's turn, or ready. */
  private async after(prev: PackingState, s: PackingState): Promise<void> {
    const v = this.view;
    const f = this.fx();
    if (!f) return;
    if (s.step === 'items') {
      if (itemsDone(s)) {
        await this.stamp('allPacked', true);
        v.next = 'resources';
      } else if (secondWindDue(s)) {
        await wait(350);
        f.secondWind();
        await this.stamp('secondWind', false);
        await this.lightUp();
        this.arm();
        return;
      }
    } else if (s.turn !== prev.turn) {
      await wait(400);
      await this.startTurn(s);
      return;
    } else if (bundlesDone(s)) {
      await wait(400);
      await this.stamp('ready', true);
      v.next = 'hike';
    }
    v.busy = false;
    this.render();
  }

  /** A hiker's resource turn: fresh empty reels, their tag or portrait, and a free spin armed. */
  private async startTurn(s: PackingState): Promise<void> {
    const f = this.fx();
    if (!f) return;
    const v = this.view;
    v.reels = s.reels.map(() => reelView(false, true));
    v.respins = s.respins;
    this.render();
    await f.turn(s.turn);
    await this.lightUp();
    this.arm();
  }

  /** The button at the right: NEXT: RESOURCES, or START THE HIKE. */
  next(): void {
    void this.nextNow();
  }

  private async nextNow(): Promise<void> {
    const v = this.view;
    const f = this.fx();
    if (!f || v.busy || !v.next) return;
    const which = v.next;
    v.next = null;
    v.busy = true;
    for (const r of v.reels) r.lit = false;
    f.sounds.clack();
    this.render();
    if (which === 'resources') {
      await wait(500);
      const s = toResources(this.state);
      this.state = s;
      v.reels = s.reels.map(() => reelView(false, true));
      this.render();
      await f.stepChange();
      await this.startTurn(s);
      return;
    }
    // Starting the hike: the bundles open into resources, then off we go.
    const s = finish(this.state);
    this.state = s;
    this.render();
    await f.openingStart();
    for (const [h, pack] of s.packs.entries()) {
      v.opening = h;
      this.render();
      for (let k = 0; k < pack.bundles.length; k++) {
        await f.openBundle(h);
        v.opened[h] = k + 1;
        this.render();
      }
    }
    v.opening = null;
    v.leaving = true;
    f.happyTrails();
    await this.stamp('happy', true, 1600);
    this.env?.onDone(handover(s));
  }
}

/** The director for one packing, started when the screen opens. */
export function useDirector(seed: number, seats: readonly Seat[], env: DirectorEnv) {
  const [director] = useState(() => new PackingDirector(seed, seats));
  useSyncExternalStore(director.subscribe, director.snapshot, director.snapshot);
  useEffect(() => {
    director.connect(env);
  });
  useEffect(() => {
    director.start();
    return () => director.stop();
  }, [director]);
  return director;
}
