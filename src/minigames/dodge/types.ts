/**
 * Dodge's shared types (docs/design/12-minigames-dodge.md, section 6): the
 * moving parts of attacks, the attack library's pieces, and the game state.
 *
 * - **A part** is one moving piece of an attack (a bee, a claw row, an acorn).
 *   Parts are plain data, so the whole game stays one serializable state;
 *   each kind's rules (how it moves, where it can hit, when it's done) live
 *   in a registry keyed by kind (library.ts).
 * - **An attack** is a piece of the library: an id, a name, the level it
 *   starts on (balance `unlocks`), and `start`, which makes its parts.
 * - **An animal** is a box, a portrait and a list of attacks (animals.ts).
 * - **Tiers and levels** (Nov 25): the challenge tier (I to V) picks the
 *   animal's level (Easy, 1, 2 or 3), which sets its attacks and numbers.
 *   `Level` is the numbered level the attack tables use (Easy reads Level
 *   1's tables), and `easy` marks Easy.
 */
import type { RngState } from '../../engine/types';
import type { AntPart } from './attacks/ants';
import type { EaglePart } from './attacks/eagle';
import type { SnowPart } from './attacks/snow';
import type { ClaudePart } from './attacks/claudesIdeas';
import type { GunPart } from './attacks/gunBear';
import type { MonsterPart } from './attacks/monster';
import type { Box, Side } from './geometry';
import type { Tier } from '../types';
import type { Point, Shape } from './shapes';

export type { Tier };

/** A numbered level: what used to be Tiers I to III. Easy is Level 1 with `easy` set. */
export type Level = 1 | 2 | 3;

export type AnimalId =
  | 'bees'
  | 'bear'
  | 'swordBear'
  | 'bobcat'
  | 'squirrels'
  | 'gunBear'
  | 'ants'
  | 'eagle'
  | 'stampede'
  | 'monster'
  | 'snowLeopard'
  | 'snowgirl';

/** The Eagle's versions, by level (23-minigames-final.md, section 9.1). */
export type EagleVersion = 'eagle' | 'toupeeEagle' | 'freeagle';

/**
 * Who's attacking: an animal (never the Stampede itself), the Stampede's
 * own moose herd, or one of the Eagle's later versions.
 */
export type Attacker = Exclude<AnimalId, 'stampede'> | 'herd' | Exclude<EagleVersion, 'eagle'>;

export type AttackId =
  // Bees
  | 'single'
  | 'pairs'
  | 'lane'
  | 'cross'
  | 'diagonal'
  | 'zigzag'
  | 'aimed'
  // Wyatt's list
  | 'volley'
  | 'claws'
  | 'bite'
  | 'jab'
  | 'poke'
  | 'wave'
  | 'pounce'
  | 'stalk'
  | 'acorns'
  | 'bombs'
  | 'fire'
  // Claude's ideas
  | 'shout'
  | 'hug'
  | 'honey'
  | 'xSlash'
  | 'thrown'
  | 'dash'
  | 'landingSwipe'
  | 'pinecones'
  | 'scurry'
  | 'herd'
  | 'hands'
  | 'wisps'
  | 'runes'
  | 'ritual'
  | 'glare'
  | 'arms'
  | 'darkness'
  // Bear with a Gun (docs/design/21-minigames-dodge-camp.md, section 1)
  | 'aimedShot'
  | 'snipe'
  | 'traps'
  | 'rapidFire'
  | 'ricochet'
  | 'bulletRing'
  | 'quickDraw'
  // Ants (section 2)
  | 'marching'
  | 'antMill'
  | 'fireAnts'
  | 'antHill'
  | 'leafcutter'
  | 'crumbRush'
  // The Eagle (Nov 26, third round)
  | 'swoop'
  | 'featherFall'
  | 'talonDrop'
  | 'wingGust'
  | 'hairToss'
  | 'combOver'
  | 'oilBarrels'
  // The snow animals
  | 'leopardPounce'
  | 'prowl'
  | 'tailSweep'
  | 'snowKick'
  | 'snowballs'
  | 'icicles'
  | 'antlerCharge'
  | 'shakeOff'
  | 'avalanche';

/**
 * What an attack does to the box (design section 6, "Pacing and overlaps"):
 * an **area** attack covers a big part of it, a **missile** flies or pokes,
 * and a **changer** changes the box for a while. Only one area and one
 * changer run at a time; missiles stack.
 */
export type AttackKind = 'area' | 'missile' | 'changer';

export interface PartBase {
  id: number;
  /** The round (one attack) it belongs to. */
  round: number;
  /** When its warning shows, and when it can first hit. */
  warnAt: number;
  activeAt: number;
  /** Made by another part (shrapnel, crumbs, puddles): its parent warned for it. */
  child?: true;
  done?: true;
}

/** A bee on its way. Before `activeAt` it's only a "!" at its entry point. */
export interface BeePart extends PartBase {
  kind: 'bee';
  /** Where it starts (just outside the box), and its velocity. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Zigzag: it weaves across its path. */
  weave?: { amplitude: number; perSec: number; nx: number; ny: number };
  /** Aimed: it aims at the sprite when it launches, at this speed. */
  aimSpeed?: number;
  aimed?: true;
  /** Where its "!" goes, on the box's edge. */
  mark: Point;
}

/**
 * A Sword Volley sword: it appears on the box's edge (`warnAt`) with its
 * tip inside, numbered, then flies straight across (`activeAt`).
 */
export interface VolleyPart extends PartBase {
  kind: 'volley';
  /** Its number: they fly in this order. */
  n: number;
  /** The wall it sits on, its tip while it waits, and the way it flies. */
  side: Side;
  tip: Point;
  dir: Point;
  speed: number;
  /** How far the tip goes before the whole sword is past the far wall. */
  reach: number;
  /** When its path shows, dotted: once it's the next to fly. */
  pathAt: number;
}

/** A sword jab: a lane shows, then the blade thrusts along it to the far wall and back. */
export interface JabPart extends PartBase {
  kind: 'jab';
  /** Where the lane meets the wall it comes from, its direction, and how long it is. */
  from: Point;
  dir: Point;
  reach: number;
  thrustSec: number;
  holdSec: number;
  pullSec: number;
}

/** A poke-up slide: the sword slides outside a wall and stabs in at each spot. */
export interface PokePart extends PartBase {
  kind: 'poke';
  side: 'top' | 'bottom';
  /** The stab spots (x, in the order it reaches them) and when each stab starts. */
  spots: number[];
  stabAt: number[];
  stabSec: number;
  /** How deep a stab goes (units), and the slide's speed. */
  depth: number;
  speed: number;
}

/** A row of claw marks swinging around a pivot, like a paw swiping; each claw on its own radius. */
export interface ClawsPart extends PartBase {
  kind: 'claws';
  count: number;
  spacing: number;
  length: number;
  thickness: number;
  /** Around (cx, cy) at radius r (the middle claw's), from angle a0, turning w radians a second. */
  path: { cx: number; cy: number; r: number; a0: number; w: number };
  /** When the row has crossed. */
  endAt: number;
}

/** A wave: the sword slides along a wall, its blade dipping into the box and out again. */
export interface WavePart extends PartBase {
  kind: 'wave';
  side: 'top' | 'bottom';
  /** Which way it slides (1 is to the right), and how fast. */
  dir: 1 | -1;
  speed: number;
  /** The deepest dip (share of the box's depth), the length of one dip, and where in it it starts. */
  depth: number;
  wavelength: number;
  phase: number;
  /** How far ahead (in seconds) its path shows. */
  aheadSec: number;
}

/** One hop of a stalk: its aim shows, it hops, lands, and crouches. */
export interface StalkHop {
  aimAt: number;
  hopAt: number;
  landAt: number;
  /** Where it lands: where the sprite is when the aim shows. */
  to?: Point;
}

/** The bobcat stalking: it comes in at an edge and hops at the sprite a few times, then leaves. */
export interface StalkPart extends PartBase {
  kind: 'stalk';
  start: Point;
  hops: StalkHop[];
  /** When it leaves, how long that takes, and where it goes (just outside the nearest wall). */
  leaveAt: number;
  leaveSec: number;
  exit?: Point;
}

/** A bite: jaws open around a zone, then snap shut; a hit only at the snap (`activeAt`). */
export interface BitePart extends PartBase {
  kind: 'bite';
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** It aims at the sprite when its warning starts. */
  aimPending?: true;
  snapSec: number;
  closedSec: number;
}

/** A pounce: a shadow grows where it'll land; a hit only at the landing (`activeAt`). */
export interface PouncePart extends PartBase {
  kind: 'pounce';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  aimPending?: true;
  /** A feint: the shadow fades and nothing lands. */
  feint?: true;
  dustSec: number;
}

/** A rolling acorn: thrown by a squirrel at the edge, cracking on each bounce. */
export interface AcornPart extends PartBase {
  kind: 'acorn';
  /** Where the squirrel pops up (just outside the wall), and the wall. */
  squirrel: Point;
  side: Side;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  /** It breaks on this wall hit (Easy: sooner); otherwise the usual. */
  breakOn?: number;
}

/** An acorn bomb: lobbed to a spot, a fuse, then a blast (`activeAt`) that reaches `radius`. */
export interface BombPart extends PartBase {
  kind: 'bomb';
  /** Where it's lobbed from, where it lands and when. */
  from: Point;
  x: number;
  y: number;
  vx: number;
  vy: number;
  landAt: number;
  blastSec: number;
  radius: number;
  blasted?: true;
}

/** A piece of shrapnel, flying straight until it leaves the box. */
export interface ShrapnelPart extends PartBase {
  kind: 'shrapnel';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** What's left of an acorn: harmless, fading. */
export interface CrumbsPart extends PartBase {
  kind: 'crumbs';
  x: number;
  y: number;
}

export type Part =
  | BeePart
  | VolleyPart
  | JabPart
  | PokePart
  | ClawsPart
  | BitePart
  | PouncePart
  | AcornPart
  | BombPart
  | ShrapnelPart
  | CrumbsPart
  | WavePart
  | StalkPart
  | ClaudePart
  | MonsterPart
  | GunPart
  | AntPart
  | EaglePart
  | SnowPart;

export type PartKind = Part['kind'];

/** What a part's rules see each step. */
export interface World {
  time: number;
  dt: number;
  level: Level;
  easy: boolean;
  /** The box as it is now (squeezed by a bear hug, if one is on). */
  box: Box;
  /** The sprite's middle. */
  pos: Point;
  rng: RngState;
  nextId(): number;
  /** Every part now (a new hole checks the ones already there). */
  parts: readonly Part[];
}

/** A circle the sprite can't enter. */
export interface Block {
  x: number;
  y: number;
  r: number;
}

/** One kind of part's rules. */
export interface PartRules<P extends Part> {
  /** Moves it on by one step (parts that keep state); can add new parts (shrapnel, crumbs, puddles). */
  update?(p: P, w: World): { part: P; spawn?: Part[] };
  /** Where it can hit, for a step from `t0` to the world's time (none while it warns). */
  shapes(p: P, w: World, t0: number): Shape[];
  /**
   * What "Show hitboxes" outlines, when that's more than what hits this
   * step (the Eye's gaze only hits after a while, but it's dangerous all along).
   */
  outline?(p: P, w: World, t0: number): Shape[];
  /** Whether it's finished and can go. */
  done(p: P, w: World): boolean;
  /** Circles the sprite can't enter, like a wall (a snipe's hole, the Ant Hill): it's pushed out to their edge. */
  blocks?(p: P, w: World): Block[];
  /** Hearts a hit from it costs (1 unless it says: a snipe costs 2). */
  damage?(p: P): number;
  /** What a hit does to it (a trap snaps shut), and how long the sprite is slowed. */
  onHit?(p: P, w: World): { part: P; slowSec?: number };
  /** Where the floor is slippery (Freeagle's oil puddles): the sprite slides on ice there. */
  slippery?(p: P, w: World): Shape[];
  /** A push on the sprite now (units/s; Wing Gust), or none. */
  push?(p: P, w: World): Point | null;
}

/** An animal's tweaks to an attack it shares (Bobcat claws are faster with a shorter warning). */
export interface Tweak {
  speed?: number;
  warnSec?: number;
  /** Sometimes a row of Claws comes in on top (Bear with a Sword's sword attacks). */
  withClaws?: true;
}

/** What an attack sees when it starts. */
export interface AttackCtx {
  level: Level;
  /** Easy (Bees and Squirrel Army only): their own gentler patterns. */
  easy: boolean;
  time: number;
  /** The box the attack happens in (the attacking animal's, where it's heading). */
  box: Box;
  pos: Point;
  rng: RngState;
  /** The level's speed (×0.85 Easy, ×1.0, ×1.2, ×1.4; more for the Woods Monster at Tier V). */
  speed: number;
  round: number;
  nextId(): number;
  tweak: Tweak;
  state: DodgeState;
}

export interface AttackStart {
  parts: Part[];
  /** When the round is over: a time, or once all its parts are done. */
  endsAt: number | 'parts';
  /** The sword bear's memory: attacks left with the box shrunk. */
  patch?: Partial<Pick<DodgeState, 'shrunkFor'>>;
}

/** A piece of the attack library. */
export interface AttackDef {
  id: AttackId;
  /** Shown in the testing tab. */
  name: string;
  kind: AttackKind;
  /** Marked Claude's idea in the design: Wyatt keeps or cuts it after playing. */
  claudesIdea?: true;
  /** Only in the Woods Monster's second half (Darkness). */
  secondHalf?: true;
  /** Only from this tier (Bullet Ring: Tier IV), whatever the level. */
  fromTier?: Tier;
  /**
   * It sweeps or charges across the box, so red arrows show which way during
   * its warning (26-fixes-and-wyatt-trees.md, section 3.1).
   */
  movesAcross?: true;
  start(ctx: AttackCtx): AttackStart;
}

/** One attack being played. */
export interface Round {
  no: number;
  attacker: Attacker;
  attack: AttackId;
  kind: AttackKind;
  endsAt: number | 'parts';
  /** A changer stops holding up the next attack once its warning is over. */
  calmAt: number;
}

/** The box moving or changing size: from one box to another, starting at a time, over this long. */
export interface BoxMove {
  from: Box;
  to: Box;
  at: number;
  sec: number;
}

export interface DodgeState {
  animal: AnimalId;
  /** The level the attacks play at (and whether it's Easy), and the challenge tier the HUD shows. */
  level: Level;
  easy: boolean;
  hudTier: Tier;
  /** The Woods Monster at Tier V: faster, more overlaps, one more at once. */
  boost: boolean;
  /** The attacks' speed, the chance the next attack overlaps, and the most at once. */
  speed: number;
  overlapChance: number;
  maxAtOnce: number;
  /** The testing tab's Attack picker: all, or only this one. */
  only: AttackId | 'all';
  /** Whether Claude's ideas are in. */
  ideas: boolean;
  order: string[];
  lives: Record<string, number>;
  hits: Record<string, number>;
  maxLives: number;
  active: string;
  switchSec: number;
  /** Seconds until the next hiker takes over. */
  switchIn: number;
  /** Seconds of safety left after a hit. */
  safeFor: number;
  lengthSec: number;
  /** Seconds played. */
  time: number;
  /** The box now, and how it's moving (where it's heading: `boxMove.to`). */
  box: Box;
  boxMove: BoxMove;
  /** The sword bear's shrunk box is on (a changer: no bear hug meanwhile). */
  shrunk: boolean;
  /** The Woods Monster: the second half has started (the box shrinks, Darkness can come). */
  secondHalf: boolean;
  /** The sprite's middle. */
  pos: Point;
  parts: Part[];
  /** The attacks being played (more than one when they overlap). */
  rounds: Round[];
  /** The last few attacks, for "never the same twice in a row". */
  history: { attacker: Attacker; attack: AttackId }[];
  /**
   * When the next attack starts: during the current one (an overlap), or
   * none while waiting for the running attacks to end (then the level's gap).
   */
  nextAttackAt: number | null;
  /** When attacks started, and whether each overlapped another (for tests and tuning). */
  starts: { at: number; attack: AttackId; overlapped: boolean }[];
  /** Who's attacking now, for the portrait above the box. */
  showing: Attacker[];
  nextId: number;
  roundNo: number;
  /** Bear with a Sword: attacks left with the box shrunk. */
  shrunkFor: number;
  /** The sprite moves slower until this time (a bear trap). */
  slowUntil: number;
  /**
   * Prepare (20-challenge-popup.md, section 7): the share the attacks' pace
   * is kept to (SLOWER ATTACKS), bees off every wave (SMOKY FIRE), ant lines'
   * slowdown (SALT LINE), and traps and holes lasting half as long (SANDBAGS).
   */
  pace: number;
  fewerBees: number;
  /** Prepare SMOKE: every warning lasts this much longer (seconds). */
  warnExtra: number;
  antSlow: number;
  sandbags: boolean;
  /**
   * Ice physics (23-minigames-final.md, section 9.4): the sprite's speed,
   * whether the whole box is ice (the snow animals), and the friction there
   * (GRIP doubles it). The Eagle's version, which sets his attacks.
   */
  vel: Point;
  ice: boolean;
  friction: number;
  eagle: EagleVersion;
  /** Each hiker's hearts at the start (Prepare's +1 HEART adds to one hiker's). */
  startLives: Record<string, number>;
  /** The last hit, for the screen ("FINN −1"), and the hearts it cost. */
  lastHit?: { hikerId: string; at: number; damage: number };
  over: boolean;
  rng: RngState;
}
