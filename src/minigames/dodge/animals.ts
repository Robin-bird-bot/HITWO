/**
 * Dodge's animals (docs/design/12-minigames-dodge.md, sections 5 and 7 to
 * 12): each one is a name, a box, a head and a list of attacks from the
 * library, with any tweaks it makes to a shared attack. The Wild Predator
 * Stampede uses every other animal's attacks (not the Woods Monster's),
 * plus Herd rush. The Woods Monster is a boss: he plays one tier up.
 *
 * Which attacks can be picked: the ones unlocked at the tier, without
 * Claude's ideas when they're off, and (in the testing tab) only the one
 * chosen attack.
 */
import { BALANCE } from '../../config/balance';
import type { Box } from './geometry';
import { ATTACKS, unlockTier } from './library';
import type { AnimalId, AttackId, Attacker, Tier, Tweak } from './types';

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
    attacks: plain('lane', 'cross', 'diagonal', 'zigzag', 'aimed'),
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
      sword('sweep'),
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
    attacks: plain('fire', 'hands', 'wisps', 'runes', 'ritual', 'eye', 'darkness'),
  },
};

export const ANIMAL_IDS: readonly AnimalId[] = [
  'bees',
  'bear',
  'swordBear',
  'bobcat',
  'squirrels',
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

/** The tier an animal's attacks play at: the Woods Monster plays one up. */
export const playTier = (animal: AnimalId, tier: Tier): Tier =>
  animal === 'monster' ? (Math.min(3, tier + 1) as Tier) : tier;

/**
 * The attacks that can be picked: unlocked at the tier (the tier they play
 * at), Claude's ideas only if on, and only `only` if set. Darkness also
 * waits for the Woods Monster's second half (logic.ts checks that).
 */
export function pool(
  animal: AnimalId,
  tier: Tier,
  ideas: boolean,
  only: AttackId | 'all' = 'all',
): PoolEntry[] {
  return everything(animal).filter(
    (e) =>
      unlockTier(e.attack) <= tier &&
      (ideas || !ATTACKS[e.attack].claudesIdea) &&
      (only === 'all' || e.attack === only),
  );
}

/**
 * For the testing tab's Attack picker: each attack the animal uses, once,
 * and whether it's open at the chosen tier (the Woods Monster plays one
 * up; his Darkness needs Tier III's second half).
 */
export function attackChoices(
  animal: AnimalId,
  tier: Tier,
  ideas: boolean,
): { id: AttackId; name: string; from: Tier; claudesIdea: boolean; unlocked: boolean }[] {
  const seen = new Set<AttackId>();
  const out: ReturnType<typeof attackChoices> = [];
  const plays = playTier(animal, tier);
  for (const e of everything(animal)) {
    const def = ATTACKS[e.attack];
    if (seen.has(e.attack) || (!ideas && def.claudesIdea)) continue;
    seen.add(e.attack);
    // The first chosen tier it shows up on.
    const opensAt = def.secondHalf
      ? 3
      : (([1, 2, 3] as const).find((t) => unlockTier(e.attack) <= playTier(animal, t)) ?? 3);
    out.push({
      id: e.attack,
      name: def.name,
      from: opensAt,
      claudesIdea: !!def.claudesIdea,
      unlocked: def.secondHalf ? tier === 3 : unlockTier(e.attack) <= plays,
    });
  }
  return out;
}

/** An attacker's box: its size and its middle on screen. */
export function boxFor(attacker: Attacker): Box {
  const a = D.animals[attacker];
  return { cx: a.at[0], cy: a.at[1], w: a.box[0], h: a.box[1] };
}

export const isAnimal = (v: unknown): v is AnimalId =>
  typeof v === 'string' && (ANIMAL_IDS as readonly string[]).includes(v);
