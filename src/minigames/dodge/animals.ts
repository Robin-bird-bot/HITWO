/**
 * Dodge's animals (docs/design/12-minigames-dodge.md, sections 5 and 7 to
 * 11): each one is a name, a box, a head and a list of attacks from the
 * library, with any tweaks it makes to a shared attack. The Wild Predator
 * Stampede uses every other animal's attacks, plus Herd rush.
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
    attacks: plain('claws', 'bite', 'roar', 'hug', 'honey'),
  },
  swordBear: {
    id: 'swordBear',
    name: 'Bear with a Sword',
    hud: 'Bear + sword',
    attacks: [
      { attack: 'sweep' },
      { attack: 'claws', tweak: { noDouble: true } },
      { attack: 'jab' },
      { attack: 'poke' },
      { attack: 'xSlash' },
      { attack: 'thrown' },
    ],
  },
  bobcat: {
    id: 'bobcat',
    name: 'Bobcat',
    hud: 'Bobcat',
    attacks: [
      { attack: 'pounce' },
      { attack: 'claws', tweak: D.claws.bobcat },
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
};

export const ANIMAL_IDS: readonly AnimalId[] = [
  'bees',
  'bear',
  'swordBear',
  'bobcat',
  'squirrels',
  'stampede',
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

/** The attacks that can be picked: unlocked at the tier, Claude's ideas only if on, and only `only` if set. */
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

/** For the testing tab's Attack picker: each attack the animal uses, once, and whether it's open at the tier. */
export function attackChoices(
  animal: AnimalId,
  tier: Tier,
  ideas: boolean,
): { id: AttackId; name: string; from: Tier; claudesIdea: boolean; unlocked: boolean }[] {
  const seen = new Set<AttackId>();
  const out: ReturnType<typeof attackChoices> = [];
  for (const e of everything(animal)) {
    const def = ATTACKS[e.attack];
    if (seen.has(e.attack) || (!ideas && def.claudesIdea)) continue;
    seen.add(e.attack);
    const from = unlockTier(e.attack);
    out.push({
      id: e.attack,
      name: def.name,
      from,
      claudesIdea: !!def.claudesIdea,
      unlocked: from <= tier,
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
