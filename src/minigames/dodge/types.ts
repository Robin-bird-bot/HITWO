/**
 * Dodge's shared types (docs/design/12-minigames-dodge.md, section 6): the
 * moving parts of attacks, the attack library's pieces, and the game state.
 *
 * - **A part** is one moving piece of an attack (a bee, a claw row, an acorn).
 *   Parts are plain data, so the whole game stays one serializable state;
 *   each kind's rules (how it moves, where it can hit, when it's done) live
 *   in a registry keyed by kind (library.ts).
 * - **An attack** is a piece of the library: an id, a name, the tier it
 *   starts on (balance `unlocks`), and `start`, which makes its parts.
 * - **An animal** is a box, a head and a list of attacks (animals.ts).
 */
import type { RngState } from '../../engine/types';
import type { ClaudePart } from './attacks/claudesIdeas';
import type { Box, Side } from './geometry';
import type { Point, Shape } from './shapes';

export type Tier = 1 | 2 | 3;

export type AnimalId = 'bees' | 'bear' | 'swordBear' | 'bobcat' | 'squirrels' | 'stampede';

/** Who's attacking: an animal (never the Stampede itself), or the Stampede's own moose herd. */
export type Attacker = Exclude<AnimalId, 'stampede'> | 'herd';

export type AttackId =
  // Bees
  | 'lane'
  | 'cross'
  | 'diagonal'
  | 'zigzag'
  | 'aimed'
  // Wyatt's list
  | 'sweep'
  | 'claws'
  | 'bite'
  | 'jab'
  | 'poke'
  | 'pounce'
  | 'acorns'
  | 'bombs'
  // Claude's ideas
  | 'roar'
  | 'hug'
  | 'honey'
  | 'xSlash'
  | 'thrown'
  | 'dash'
  | 'landingSwipe'
  | 'pinecones'
  | 'scurry'
  | 'herd';

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

/** A sword sweep: the half of the box it'll sweep is warned, then the blade sweeps it. */
export interface SwingPart extends PartBase {
  kind: 'swing';
  side: 'left' | 'right';
  sweepSec: number;
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

/** A row of claw marks crossing the box, straight or swinging around a pivot. */
export interface ClawsPart extends PartBase {
  kind: 'claws';
  count: number;
  spacing: number;
  length: number;
  thickness: number;
  path:
    | { type: 'line'; x: number; y: number; vx: number; vy: number }
    /** Around (cx, cy) at radius r, from angle a0, turning w radians a second. */
    | { type: 'arc'; cx: number; cy: number; r: number; a0: number; w: number };
  /** When the row has crossed. */
  endAt: number;
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
  | SwingPart
  | JabPart
  | PokePart
  | ClawsPart
  | BitePart
  | PouncePart
  | AcornPart
  | BombPart
  | ShrapnelPart
  | CrumbsPart
  | ClaudePart;

export type PartKind = Part['kind'];

/** What a part's rules see each step. */
export interface World {
  time: number;
  dt: number;
  tier: Tier;
  /** The box as it is now (squeezed by a bear hug, if one is on). */
  box: Box;
  /** The sprite's middle. */
  pos: Point;
  rng: RngState;
  nextId(): number;
}

/** One kind of part's rules. */
export interface PartRules<P extends Part> {
  /** Moves it on by one step (parts that keep state); can add new parts (shrapnel, crumbs, puddles). */
  update?(p: P, w: World): { part: P; spawn?: Part[] };
  /** Where it can hit, for a step from `t0` to the world's time (none while it warns). */
  shapes(p: P, w: World, t0: number): Shape[];
  /** Whether it's finished and can go. */
  done(p: P, w: World): boolean;
}

/** An animal's tweaks to an attack it shares (Bobcat claws are faster with a shorter warning). */
export interface Tweak {
  speed?: number;
  warnSec?: number;
  /** Never a double row (Bear with a Sword's claws). */
  noDouble?: true;
}

/** What an attack sees when it starts. */
export interface AttackCtx {
  tier: Tier;
  time: number;
  /** The box the attack happens in (the attacking animal's, where it's heading). */
  box: Box;
  pos: Point;
  rng: RngState;
  /** The tier's speed (×1.0, ×1.2, ×1.4). */
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
  /** The sword bear's memory: swings so far, the last sides, and attacks left with the box shrunk. */
  patch?: Partial<Pick<DodgeState, 'swings' | 'sides' | 'shrunkFor'>>;
}

/** A piece of the attack library. */
export interface AttackDef {
  id: AttackId;
  /** Shown in the testing tab. */
  name: string;
  /** Marked Claude's idea in the design: Wyatt keeps or cuts it after playing. */
  claudesIdea?: true;
  start(ctx: AttackCtx): AttackStart;
}

/** One attack being played. */
export interface Round {
  no: number;
  attacker: Attacker;
  attack: AttackId;
  endsAt: number | 'parts';
}

export interface DodgeState {
  animal: AnimalId;
  tier: Tier;
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
  /** The box now, and where it's easing to. */
  box: Box;
  boxTarget: Box;
  /** The sprite's middle. */
  pos: Point;
  parts: Part[];
  /** The attack (or two, overlapping in the Stampede) being played. */
  rounds: Round[];
  /** The last few attacks, for "never the same twice in a row". */
  history: { attacker: Attacker; attack: AttackId }[];
  /** When the next round starts (none while one is on). */
  nextAttackAt: number | null;
  /** Stampede, Tier III: a second attack is due to overlap at this time. */
  overlapAt?: number;
  /** Who's attacking now, for the heads above the box. */
  showing: Attacker[];
  nextId: number;
  roundNo: number;
  /** Bear with a Sword: swings so far, the last sides, and attacks left with the box shrunk. */
  swings: number;
  sides: ('left' | 'right')[];
  shrunkFor: number;
  /** The last hit, for the screen ("FINN −1"). */
  lastHit?: { hikerId: string; at: number };
  over: boolean;
  rng: RngState;
}
