/**
 * What the packing screen shares between its two looks (27-packing-screen.md,
 * section 9): the reels' moving view, the words each look uses, and the
 * effects a look plays when the shared director asks. The rules live in
 * `src/packing/logic.ts`; a look only draws them.
 */
import type { CSSProperties, ReactNode, Ref } from 'react';
import type { Bonus, BonusKind, PackType, PackingState, ReelSymbol } from '../../packing/logic';
import type { BurstOptions, ParticleKind } from './particles';
import type { Sounds } from './synth';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One reel as drawn right now (the rules' reel, plus what's moving). */
export interface ReelView {
  /** The symbol on the payline, and the neighbors above and below it. */
  shown: ReelSymbol | null;
  above: ReelSymbol | null;
  below: ReelSymbol | null;
  lit: boolean;
  locked: boolean;
  takenBy: number | null;
  /** While spinning: the strip streaming past, ending on the result. */
  spin: { list: ReelSymbol[]; prev: ReelSymbol; ms: number; id: number } | null;
  /** The reels before it make a row so far: it spins longer. */
  tease: boolean;
  /** Bumped to replay an effect: a stop, a win, a Tier II flash, lighting up. */
  stopId: number;
  winId: number;
  upId: number;
  onId: number;
  /** Went dark without a transition (a new step's reels). */
  quiet: boolean;
}

export interface StampView {
  text: string;
  sub: string;
  gold: boolean;
  ms: number;
  id: number;
}

/** Everything moving on the screen that isn't the rules' state. */
export interface MachineView {
  reels: ReelView[];
  /** Respins shown in the tray; the newest is still arriving while `arriving`. */
  respins: number;
  arriving: boolean;
  /** Bumped when a respin lands in the tray (the cabinet's plop, TrailMate's charge). */
  gainedId: number;
  stamp: StampView | null;
  /** The paytable row that just paid. */
  hit: { row: number; id: number } | null;
  /** Bumped to flash the paytable's tab when it pays while shut. */
  pingId: number;
  /** A hiker card bounces and a slot pops after packing. */
  bounce: { hiker: number; id: number } | null;
  pop: { hiker: number; slot: number; bundle: boolean; id: number } | null;
  /** Starting the hike: bundles opened so far, per hiker; whose bundles are opening. */
  opened: number[];
  opening: number | null;
  /** The button at the right: on to the resources, or start the hike. */
  next: 'resources' | 'hike' | null;
  busy: boolean;
  /** Packed and leaving: everything is still. */
  leaving: boolean;
}

/** The words one look uses for each moment: [title, the line under it]. */
export type Words = Readonly<
  Record<BonusKind | 'secondWind' | 'allPacked' | 'ready' | 'happy', readonly [string, string]>
>;

/**
 * The effects a look plays when the director asks. Each returns when its
 * part is done; the director moves the shared view in between.
 */
export interface SkinFx {
  readonly sounds: Sounds;
  readonly words: Words;
  /** A spin's tick sound comes this often (ms). */
  readonly tickMs: number;
  /** A teased reel spins this much longer (ms). */
  readonly teaseMs: number;
  /** Reels light up this far apart (ms): one after another on TrailMate, all at once in the cabinet. */
  readonly lightGapMs: number;
  /** Before the first spin (TrailMate boots up). */
  intro(): Promise<void>;
  lever(): void;
  noRespins(): void;
  /** A respin is spent (`left` are left): the acorn to the squirrel, or a battery cell drains. */
  spendRespin(left: number): Promise<void>;
  spinStart(): void;
  teaseStart(reel: number): void;
  /** A reel stopped on `value`, the `order`th to stop of `total`. */
  reelStopped(reel: number, order: number, total: number, value: ReelSymbol): void;
  spinEnd(): void;
  /** A row paid (before its stamp); the jackpot and a big bundle get their extras here. */
  win(bonus: Bonus): void;
  /** A stamp (or pop-up) comes down. */
  stamped(kind: keyof Words, gold: boolean): void;
  /** A reel turned Tier II, or a bundle grew. */
  upgraded(reel: number): void;
  /** A respin is won: the squirrel tosses an acorn, or a cell charges. */
  gainRespin(): Promise<void>;
  /** The dragged symbol flies into a hiker's slot. */
  flyTo(ghost: HTMLElement, from: Rect, to: Rect, color: string): Promise<void>;
  /** Packed: the reel goes dark under the hiker's name. */
  packed(reel: number, hiker: number, to: Rect, color: string, value: ReelSymbol): void;
  reelOn(reel: number): void;
  /** Every reel is dark and items are still owed. */
  secondWind(): void;
  /** Off to the resources (the screens rebuild with 3 reels). */
  stepChange(): Promise<void>;
  /** A hiker's resource turn starts. */
  turn(hiker: number): Promise<void>;
  /** Starting the hike: before, during (each bundle) and after the bundles open. */
  openingStart(): Promise<void>;
  openBundle(hiker: number): Promise<void>;
  happyTrails(): void;
}

/** Screen helpers a look's effects use. */
export interface Kit {
  /** Where an element is, in stage pixels. */
  rectOf(el: Element): Rect;
  /** An element on the packing screen. */
  find(selector: string): HTMLElement | null;
  /** Shakes the whole screen (never under reduced motion). */
  shake(px: number, ms: number): void;
  burst(x: number, y: number, kind: ParticleKind, count: number, o?: BurstOptions): void;
  reduced: boolean;
}

/** What the shared screen gives a look's machine to draw. */
export interface SkinProps {
  fxRef: Ref<SkinFx | null>;
  kit: Kit;
  state: PackingState;
  view: MachineView;
  /** The reel picked by a click, waiting for a hiker. */
  selected: number | null;
  /** Can't spin: no respins left (or nothing owed). */
  leverOff: boolean;
  onPull(): void;
  reel(i: number): ReelHandlers;
}

export interface ReelHandlers {
  onPointerDown(e: React.PointerEvent): void;
  onPointerEnter(): void;
  onPointerLeave(): void;
}

/** How a look draws the small things the shared parts show. */
export interface Paint {
  /** CSS variables for an item type, and for a bundle size (rows, squares, chips). */
  typeVars(type: PackType): CSSProperties;
  sizeVars(size: number): CSSProperties;
  /** The odds drawer's chip for an item type, and for a bundle size. */
  typeChip(type: PackType): ReactNode;
  sizeChip(size: number): ReactNode;
  /** An item in a bag slot. */
  slotArt(itemId: string): ReactNode;
  resourceIcon(id: string, name: string): ReactNode;
}

/** A look's words around the machine. */
export interface SkinText {
  oddsItems: string;
  oddsNote(tier2Pct: string): ReactNode;
  payItems: string;
  payBundles: string;
  pay: Readonly<Record<BonusKind, readonly [string, string]>>;
  rulesItems: string;
  rulesBundles: string;
  help: Readonly<Record<'items' | 'resources' | 'done', ReactNode>>;
}

/** A look: its CSS for the shared parts, its words, its machine and its symbols. */
export interface Skin {
  cx: Readonly<Record<string, string>>;
  paint: Paint;
  text: SkinText;
  Backdrop: () => ReactNode;
  Machine: (props: SkinProps) => ReactNode;
  Symbol: (props: { value: ReelSymbol }) => ReactNode;
}
