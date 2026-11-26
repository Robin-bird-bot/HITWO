/**
 * Dodge's animals (docs/design/12-minigames-dodge.md, sections 3 to 12):
 * each one is a name, a box, a portrait and a list of attacks from the
 * library, with any tweaks it makes to a shared attack. The Wild Predator
 * Stampede uses every other animal's attacks (not the Woods Monster's),
 * plus Herd rush.
 *
 * Tiers and levels (section 4, Nov 25): each challenge tier picks which
 * animals show up and at what level (`roster`), and how common each is
 * (`weights`). The Woods Monster always plays Level 3. Easy is only for
 * Bees and the Squirrel Army; the Stampede never plays it.
 *
 * Which attacks can be picked: the ones that play at the level, without
 * Claude's ideas when they're off, and (in the testing tab) only the one
 * chosen attack.
 */
import { BALANCE } from '../../config/balance';
import { weightedPick } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { isTier, TIER_LABELS, type Tier } from '../types';
import type { Box } from './geometry';
import type { Point } from './shapes';
import { ATTACKS, playsAt, ranksOf, type Rank } from './library';
import type { AnimalId, AttackId, Attacker, Tweak } from './types';

export type { Rank } from './library';

const D = BALANCE.minigames.dodge;

export interface AnimalAttack {
  attack: AttackId;
  tweak?: Tweak;
}

export interface Animal {
  id: AnimalId;
  /** The testing tab's name, and the HUD's. */
  name: string;
  hud: string;
  attacks: readonly AnimalAttack[];
}

const plain = (...ids: AttackId[]): AnimalAttack[] => ids.map((attack) => ({ attack }));

/** Bear with a Sword's sword attacks sometimes bring a row of claws. */
const sword = (attack: AttackId): AnimalAttack => ({ attack, tweak: { withClaws: true } });

export const ANIMALS: Readonly<Record<AnimalId, Animal>> = {
  bees: {
    id: 'bees',
    name: 'Bees',
    hud: 'Bees',
    attacks: plain('single', 'pairs', 'lane', 'cross', 'diagonal', 'zigzag', 'aimed'),
  },
  bear: {
    id: 'bear',
    name: 'Bear',
    hud: 'Bear',
    attacks: plain('claws', 'bite', 'shout', 'hug', 'honey'),
  },
  swordBear: {
    id: 'swordBear',
    name: 'Bear with a Sword',
    hud: 'Bear + sword',
    attacks: [
      sword('volley'),
      { attack: 'claws' },
      sword('jab'),
      sword('poke'),
      sword('wave'),
      sword('xSlash'),
      sword('thrown'),
    ],
  },
  bobcat: {
    id: 'bobcat',
    name: 'Bobcat',
    hud: 'Bobcat',
    attacks: [
      { attack: 'pounce' },
      { attack: 'claws', tweak: D.claws.bobcat },
      { attack: 'stalk' },
      { attack: 'dash' },
      { attack: 'landingSwipe', tweak: D.claws.bobcat },
    ],
  },
  squirrels: {
    id: 'squirrels',
    name: 'Squirrel Army',
    hud: 'Squirrels',
    attacks: plain('acorns', 'bombs', 'pinecones', 'scurry'),
  },
  gunBear: {
    id: 'gunBear',
    name: 'Bear with a Gun',
    hud: 'Bear + gun',
    attacks: plain(
      'aimedShot',
      'rapidFire',
      'traps',
      'snipe',
      'ricochet',
      'bulletRing',
      'quickDraw',
    ),
  },
  ants: {
    id: 'ants',
    name: 'Ants',
    hud: 'Ants',
    attacks: plain('marching', 'antMill', 'leafcutter', 'fireAnts', 'antHill', 'crumbRush'),
  },
  stampede: {
    id: 'stampede',
    name: 'Wild Predator Stampede',
    hud: 'Stampede',
    attacks: [],
  },
  monster: {
    id: 'monster',
    name: 'Woods Monster',
    hud: 'Woods monster',
    attacks: plain('fire', 'arms', 'hands', 'wisps', 'runes', 'ritual', 'glare', 'darkness'),
  },
};

export const ANIMAL_IDS: readonly AnimalId[] = [
  'bees',
  'bear',
  'swordBear',
  'bobcat',
  'squirrels',
  'gunBear',
  'ants',
  'stampede',
  'monster',
];

/** The animals whose attacks the Stampede uses, in the order of its row of heads. */
export const STAMPEDE_ANIMALS: readonly Exclude<Attacker, 'herd'>[] = [
  'bees',
  'bear',
  'swordBear',
  'bobcat',
  'squirrels',
  'gunBear',
  'ants',
];

/** One attack that can be picked: who makes it, which, and any tweak. */
export interface PoolEntry {
  attacker: Attacker;
  attack: AttackId;
  tweak: Tweak;
}

/** Every attack an animal can make, ignoring tiers and switches. */
function everything(animal: AnimalId): PoolEntry[] {
  if (animal === 'stampede') {
    return [
      ...STAMPEDE_ANIMALS.flatMap((a) =>
        ANIMALS[a].attacks.map((x) => ({ attacker: a, attack: x.attack, tweak: x.tweak ?? {} })),
      ),
      { attacker: 'herd', attack: 'herd', tweak: {} },
    ];
  }
  return ANIMALS[animal].attacks.map((x) => ({
    attacker: animal,
    attack: x.attack,
    tweak: x.tweak ?? {},
  }));
}

/** The animals with an Easy level of their own (Ants from Nov 26, 22-minigame-revisions.md section 4). */
export const HAS_EASY: readonly AnimalId[] = ['bees', 'squirrels', 'ants'];

/** The testing tab's Level setting: Auto (the tier's), Easy, or a numbered level. */
export type LevelPick = 'auto' | 'easy' | 1 | 2 | 3;

/**
 * The level an animal plays at a tier: the roster's. An animal that doesn't
 * show up at the tier (a Bear at Tier I) plays its lowest level, so the
 * testing tab can still try it. The Woods Monster is always Level 3.
 */
export function levelFor(animal: AnimalId, tier: Tier): Rank {
  if (animal === 'monster') return 3;
  const here = D.roster[tier][animal];
  if (here !== undefined) return here;
  const tiers = ([1, 2, 3, 4, 5] as const).filter((t) => D.roster[t][animal] !== undefined);
  return D.roster[tiers[0] ?? 1][animal] ?? 1;
}

/**
 * The level a game plays at: Auto uses the tier's; a picked level
 * overrides it. Easy is only for Bees, the Squirrel Army and Ants (the
 * others play Level 1), and the Stampede never plays Easy.
 */
export function rankFor(animal: AnimalId, tier: Tier, pick: LevelPick = 'auto'): Rank {
  const rank: Rank = pick === 'auto' ? levelFor(animal, tier) : pick === 'easy' ? 0 : pick;
  return rank === 0 && !HAS_EASY.includes(animal) ? 1 : rank;
}

/** The animals that show up at a tier (the Woods Monster only from the night monster event). */
export const animalsAt = (tier: Tier): AnimalId[] =>
  ANIMAL_IDS.filter((a) => D.roster[tier][a] !== undefined);

/** A Dodge animal for a tier, by the tier's weights (never the Woods Monster). */
export function pickAnimal(rng: RngState, tier: Tier): AnimalId {
  const t = isTier(tier) ? tier : 1;
  const items = ANIMAL_IDS.flatMap((a) => {
    const weight = D.weights[t][a] ?? 0;
    return weight > 0 ? [{ item: a, weight }] : [];
  });
  return items.length ? weightedPick(rng, items) : 'bees';
}

/**
 * The attacks that can be picked: playing at the level, Claude's ideas
 * only if on, and only `only` if set. Darkness also waits for the Woods
 * Monster's second half (logic.ts checks that).
 */
export function pool(
  animal: AnimalId,
  rank: Rank,
  ideas: boolean,
  only: AttackId | 'all' = 'all',
  tier: Tier = 5,
): PoolEntry[] {
  return everything(animal).filter(
    (e) =>
      playsAt(e.attack, rank) &&
      atTier(e.attack, tier) &&
      (ideas || !ATTACKS[e.attack].claudesIdea) &&
      (only === 'all' || e.attack === only),
  );
}

/** Whether an attack plays at a tier (Bullet Ring only from Tier IV; the rest at any). */
export const atTier = (id: AttackId, tier: Tier): boolean => (ATTACKS[id].fromTier ?? 1) <= tier;

const LEVEL_WORD: Readonly<Record<Rank, string>> = {
  0: 'Easy',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
};

/** Where an attack plays, in words: "from Level 2", "Easy and Level 1 only", "Level 3 only". */
export function levelsWord(id: AttackId): string {
  const ranks = ranksOf(id);
  const last = ranks.at(-1);
  if (!ranks.length || last === undefined) return '';
  if (ranks.length === 4) return 'every level';
  if (last === 3 && ranks.length > 1) return `from ${LEVEL_WORD[ranks[0]!]}`;
  if (ranks.length === 1) return `${LEVEL_WORD[ranks[0]!]} only`;
  return `${ranks.map((r) => LEVEL_WORD[r]).join(' and ')} only`;
}

/**
 * For the testing tab's Attack picker: each attack the animal uses, once,
 * where it plays, and whether it plays at the chosen level.
 */
export function attackChoices(
  animal: AnimalId,
  rank: Rank,
  ideas: boolean,
  tier: Tier = 5,
): { id: AttackId; name: string; where: string; claudesIdea: boolean; unlocked: boolean }[] {
  const seen = new Set<AttackId>();
  const out: ReturnType<typeof attackChoices> = [];
  for (const e of everything(animal)) {
    const def = ATTACKS[e.attack];
    if (seen.has(e.attack) || (!ideas && def.claudesIdea)) continue;
    seen.add(e.attack);
    out.push({
      id: e.attack,
      name: def.name,
      where: atTier(e.attack, tier)
        ? levelsWord(e.attack)
        : `from Tier ${TIER_LABELS[def.fromTier ?? 1]}`,
      claudesIdea: !!def.claudesIdea,
      unlocked: playsAt(e.attack, rank) && atTier(e.attack, tier),
    });
  }
  return out;
}

/**
 * The portraits above the box (section 3, round 3): the file name in
 * `portraits/<style>/` and its size, 1 px per unit (the art's; a test
 * checks them against the files).
 */
export const PORTRAITS: Readonly<
  Record<Attacker | 'cultist', { file: string; w: number; h: number }>
> = {
  bees: { file: 'bee', w: 51, h: 42 },
  bear: { file: 'bear', w: 48, h: 44 },
  swordBear: { file: 'bear-sword', w: 72, h: 44 },
  bobcat: { file: 'bobcat', w: 49, h: 42 },
  squirrels: { file: 'squirrel', w: 73, h: 48 },
  herd: { file: 'moose', w: 71, h: 54 },
  monster: { file: 'woods-monster', w: 65, h: 56 },
  gunBear: { file: 'bear-gun', w: 76, h: 50 },
  ants: { file: 'ant', w: 50, h: 46 },
  cultist: { file: 'cultist', w: 33, h: 38 },
};

/** The Woods Monster's eyes in his portrait (the red pupils of woods-monster.png), where Glare fires from. */
export const MONSTER_EYES: readonly { x: number; y: number }[] = [
  { x: 25.5, y: 27.5 },
  { x: 38.5, y: 27.5 },
];

/** Where a portrait sits at rest: its top-left on screen (centered at x 160, a gap above its box). */
export function portraitAt(who: Attacker | 'cultist', over: Attacker = 'monster'): Point {
  const p = PORTRAITS[who];
  const box = boxFor(who === 'cultist' ? over : who);
  return { x: 160 - p.w / 2, y: box.cy - box.h / 2 - D.portraits.gap - p.h };
}

/**
 * An attacker's box: its size and its middle on screen. Its portrait sits
 * a gap above it; if the portrait's top would go above the line, the box
 * moves down instead.
 */
export function boxFor(attacker: Attacker): Box {
  const a = D.animals[attacker];
  const P = D.portraits;
  const top = a.at[1] - a.box[1] / 2 - P.gap - PORTRAITS[attacker].h;
  const down = Math.max(0, P.minTop - top);
  return { cx: a.at[0], cy: a.at[1] + down, w: a.box[0], h: a.box[1] };
}

export const isAnimal = (v: unknown): v is AnimalId =>
  typeof v === 'string' && (ANIMAL_IDS as readonly string[]).includes(v);
