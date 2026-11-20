/**
 * Utility traits (green): crafting, scavenging and actions. The table in
 * 02-traits-and-conditions.md, in its order. "[Node]" traits (Finder, Hound,
 * the Thumbs and the Pockets) are one trait each, with the node set on the hiker.
 */
import { BALANCE } from '../../config/balance';
import type { QueryContext, TraitDef } from '../../engine/effects';
import type { NodeType, ScavengeCardType, TraitSetting } from '../../engine/types';
import { NODE_WORD, nodeOf, utility } from './build';

const N = BALANCE.traits;

/** The four node versions of "[Node]" traits: how each is named. */
const NODE_NAMES = {
  finder: { forest: 'Forest', river: 'River', wildlife: 'Creature', mountain: 'Rock' },
  thumb: { forest: 'Green', river: 'Blue', wildlife: 'Yellow', mountain: 'Gray' },
  pockets: { forest: 'Sappy', river: 'Wet', wildlife: 'Fuzzy', mountain: 'Rocky' },
} as const satisfies Record<string, Record<NodeType, string>>;

/** "River Finder", or "[Node] Finder" before a node is set. */
const nodeName =
  (names: Record<NodeType, string>, suffix: string) =>
  (setting: TraitSetting): string => {
    const node = nodeOf(setting);
    return `${node ? names[node] : '[Node]'} ${suffix}`;
  };

/** The trait's text with "that node" made the set node's name. */
const nodeText = (text: (word: string) => string) => (setting: TraitSetting) => {
  const node = nodeOf(setting);
  return text(node ? NODE_WORD[node] : 'that node’s');
};

const DOUBLES: ScavengeCardType[] = ['x2', 'wildX2'];

const ITEM_FINDS: ScavengeCardType[] = [
  'toolFind',
  'foodFind',
  'clothesFind',
  'shelterFind',
  'trinketFind',
];

/** Other hikers who scavenged this tile earlier today. */
function earlierHere(ctx: QueryContext, tileId: string) {
  const ids = new Set(
    ctx.state.scavengedToday
      .filter((r) => r.tileId === tileId && r.hikerId !== ctx.self.id)
      .map((r) => r.hikerId),
  );
  return ctx.state.hikers.filter((h) => ids.has(h.id));
}

/** Copier and its family versions: bonus resources for each earlier scavenger here today. */
export function copyHooks(name: string, appetiteEach: number): TraitDef['hooks'] {
  return {
    modifyScavenge(q, ctx) {
      const before = earlierHere(ctx, q.tileId);
      if (!before.length) return undefined;
      const n = before.length;
      const who = before.map((h) => h.name).join(', ');
      const cost = appetiteEach ? ` for ${appetiteEach} Appetite each` : '';
      return {
        source: name,
        label: `${name}: +${n} bonus resource${n === 1 ? '' : 's'}${cost} (${who} scavenged here today)`,
        tone: 'bonus',
        bonus: { count: n, appetiteEach },
      };
    },
  };
}

export const COPY_TEXT =
  'When scavenging, can take 1 extra resource for each hiker who scavenged this tile earlier the same day, at no extra cost.';

/** The four crafting tiers' types: Cook (food), Crafter (tools), Architect (shelters), Tailor (clothes). */
const CRAFT_TITLES = [
  ['Cook', 'food'],
  ['Crafter', 'tools'],
  ['Architect', 'shelters'],
  ['Tailor', 'clothes'],
] as const;

export const UTILITY_TRAITS: readonly TraitDef[] = [
  utility(
    1,
    'collaborative',
    'Collaborative',
    '+1 Luck when crafting on a tile with other hikers.',
  ),
  utility(1, 'focused', 'Focused', '+1 Luck when crafting alone.'),
  utility(1, 'forager', 'Forager', '+1 card to choose from when scavenging.', {
    hooks: {
      modifyScavenge: () => ({
        source: 'Forager',
        label: 'Forager: 1 extra card to choose from',
        tone: 'bonus',
        cards: N.forager.cards,
      }),
    },
  }),
  utility(
    1,
    'ecoConscious',
    'Eco-conscious',
    'The first scavenge each day drains 1 less Abundance.',
  ),
  utility(1, 'squirrely', 'Squirrely', 'Higher chance of acorn caps when scavenging.'),
  utility(
    1,
    'nocturnal',
    'Nocturnal',
    'A night without sleep costs 2 Appetite instead of 2 Energy.',
  ),
  utility(
    1,
    'leadStomach',
    'Lead Stomach',
    'As a free action, can eat 2 resources to gain 1 Appetite.',
  ),
  utility(
    1,
    'copier',
    'Copier',
    'When scavenging, can take 1 extra resource for each hiker who scavenged this tile earlier the same day, at 1 Appetite per extra resource.',
    { group: 'copier', hooks: copyHooks('Copier', N.copier.appetiteEach) },
  ),
  utility(
    1,
    'finder',
    '[Node] Finder',
    'Higher chance of drawing that node’s resources when scavenging.',
    {
      setting: 'node',
      nameWith: nodeName(NODE_NAMES.finder, 'Finder'),
      textWith: nodeText((w) => `Higher chance of drawing ${w} resources when scavenging.`),
      hooksWith(setting) {
        const node = nodeOf(setting);
        if (!node) return {};
        const name = `${NODE_NAMES.finder[node]} Finder`;
        return {
          modifyScavenge: () => ({
            source: name,
            label: `${name}: ${NODE_WORD[node]} cards are likelier`,
            tone: 'bonus',
            nodeWeight: { [node]: N.finder.nodeWeight },
          }),
        };
      },
    },
  ),
  utility(1, 'charismatic', 'Charismatic', '+2 caps for each sale.'),
  utility(1, 'frugal', 'Frugal', 'Pays 1 cap less for each purchase.'),
  utility(
    1,
    'thumb',
    '[Color] Thumb',
    'For one node: +1 card to choose from when scavenging it, and Tend on a tile with that node restores 1 extra Abundance.',
    {
      setting: 'node',
      nameWith: nodeName(NODE_NAMES.thumb, 'Thumb'),
      textWith: nodeText(
        (w) =>
          `+1 card to choose from when scavenging a ${w} node, and Tend on a tile with a ${w} node restores 1 extra Abundance.`,
      ),
    },
  ),
  utility(
    1,
    'dayNapper',
    'Day Napper',
    'Can Sleep in the Morning or Afternoon, not just at night.',
  ),
  utility(
    1,
    'singer',
    'Singer',
    'When this hiker Sits by the Fire, every hiker on the tile gains 1 Morale.',
    {
      waitsOn: 'Sit by the Fire',
    },
  ),
  utility(1, 'chef', 'Chef', 'Food this hiker crafts has a chance of +1 Appetite.'),
  utility(
    1,
    'carefulHands',
    'Careful Hands',
    'Clothes this hiker crafts get 0–3 extra days of durability.',
  ),
  utility(
    1,
    'archaeologist',
    'Archaeologist',
    'Higher chance of Item find cards when scavenging.',
    {
      hooks: {
        modifyScavenge: () => ({
          source: 'Archaeologist',
          label: 'Archaeologist: Item finds are likelier',
          tone: 'bonus',
          typeWeight: Object.fromEntries(
            ITEM_FINDS.map((t) => [t, N.archaeologist.itemFindWeight]),
          ),
        }),
      },
    },
  ),
  utility(1, 'mba', 'MBA', 'On level-up, gain caps based on the new level (3 caps per level).'),
  utility(1, 'teacher', 'Teacher', 'Teaching another hiker a blueprint costs half the Morale.'),
  ...CRAFT_TITLES.map(([title, what]) =>
    utility(2, `artisan${title}`, `Artisan ${title}`, `Can craft Tier 2 ${what}.`),
  ),
  utility(
    2,
    'hound',
    '[Node] Hound',
    'Much higher chance of drawing that node’s resources, and of ×2 results, when scavenging.',
    {
      setting: 'node',
      nameWith: nodeName(NODE_NAMES.finder, 'Hound'),
      textWith: nodeText(
        (w) => `Much higher chance of drawing ${w} resources, and of ×2 results, when scavenging.`,
      ),
      hooksWith(setting) {
        const node = nodeOf(setting);
        if (!node) return {};
        const name = `${NODE_NAMES.finder[node]} Hound`;
        return {
          modifyScavenge: () => ({
            source: name,
            label: `${name}: ${NODE_WORD[node]} cards and ×2 results are much likelier`,
            tone: 'bonus',
            nodeWeight: { [node]: N.hound.nodeWeight },
            nodeTypeWeight: {
              [node]: Object.fromEntries(DOUBLES.map((t) => [t, N.hound.doubleWeight])),
            },
          }),
        };
      },
    },
  ),
  utility(
    2,
    'pockets',
    '[Node] Pockets',
    'After scavenging, a chance to also gain a random resource of that node.',
    {
      setting: 'node',
      nameWith: nodeName(NODE_NAMES.pockets, 'Pockets'),
      textWith: nodeText((w) => `After scavenging, a chance to also gain a random ${w} resource.`),
    },
  ),
  utility(2, 'copydog', 'Copydog', COPY_TEXT, {
    group: 'copier',
    who: ['dog'],
    hooks: copyHooks('Copydog', 0),
  }),
  utility(2, 'gambler', 'Gambler', 'Once per day, can reroll one card when scavenging.', {
    ability: {
      id: 'gambler',
      label: 'Gambler',
      limit: { per: 'day', uses: N.gambler.usesPerDay },
      scavengeReroll: true,
      // The reroll itself happens in the scavenge window (the scavengeReroll action).
      apply: () => undefined,
    },
  }),
  utility(2, 'savvy', 'Savvy', 'When crafting, a chance to get 1 of the used resources back.'),
  utility(2, 'handy', 'Handy', '+1 card to choose from when crafting.'),
  utility(2, 'fortunate', 'Fortunate', '+1 Luck when scavenging.'),
  utility(
    2,
    'eagleEye',
    'Eagle Eye',
    'Scavenging also draws from the revealed nodes of adjacent tiles.',
  ),
  utility(2, 'pirate', 'Pirate', 'Scavenging alone costs no Appetite.'),
  utility(
    2,
    'destroyer',
    'Destroyer',
    'As a free action, can spend 3 resources to gain 1 Energy, Appetite or Morale.',
  ),
  utility(2, 'nonNonProfit', 'Non-Non-Profit', 'Sales earn 50% more caps.'),
  utility(
    2,
    'therapist',
    'Therapist',
    'Once per day, can spend 1 Morale to shorten every negative condition of hikers on this tile by 1 day.',
  ),
  utility(
    2,
    'liberal',
    'Liberal',
    'Once per phase, can spend 1 Energy to even out the Morale of all hikers on this tile.',
  ),
  utility(
    2,
    'talented',
    'Talented',
    '+1 to the numbers on items this hiker crafts (for example, +1 Appetite on food).',
  ),
  utility(2, 'closer', 'Closer', '+1 Luck when this hiker is the last to act in a phase.'),
  utility(
    2,
    'lovinglyMade',
    'Lovingly Made',
    'At high Morale (8 or more), +1 extra Luck when crafting.',
  ),
  utility(
    2,
    'wise',
    'Wise',
    'When this hiker gains XP, every other hiker on the tile gains 50% as much.',
  ),
  utility(
    2,
    'dreamAlchemist',
    'Dream Alchemist',
    'During the night, each resource this hiker carries has a 10% chance to turn into a random resource. Resources held by other hikers aren’t affected.',
  ),
  ...CRAFT_TITLES.map(([title, what]) =>
    utility(3, `master${title}`, `Master ${title}`, `Can craft Tier 3 ${what}.`),
  ),
  utility(3, 'germanEfficiency', 'German Efficiency', 'Using a tool also gives a random resource.'),
  utility(3, 'proficient', 'Proficient', '+2 cards to choose from when crafting.'),
  utility(
    3,
    'generous',
    'Generous',
    'When scavenging, a random hiker on the tile also gets a random resource from the same node.',
  ),
  utility(
    3,
    'alchemist',
    'Alchemist',
    'As a free action, can turn 2 of the same resource into 1 resource of the same node.',
  ),
  utility(3, 'thrifty', 'Thrifty', '1 random item at each shop is free.'),
];
