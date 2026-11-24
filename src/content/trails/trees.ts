/**
 * Skill Trails (docs/design/09-hikers.md; Phase 10.7): the first 6 hikers'
 * trees, from docs/design/skill-trails/skill-trails-data.json. Each hiker
 * has 3 trees, one per class; each tree has 3 steps. A step adds a new trait
 * or upgrades one the hiker has (the upgrade replaces it).
 *
 * Step ids are the data's (`finn-leader-t1`), and each step is also a trait
 * with that id (src/content/trails/effects.ts holds what they do). Text is
 * player-facing, with the [bracketed] numbers read from BALANCE.trails.
 * `changed` names the parts of an upgrade's text that changed from the tier
 * before (shown in yellow).
 */
import { BALANCE } from '../../config/balance';
import type { ClassId, MoraleTypeId } from '../../engine/types';
import { treeName } from '../classes';

const B = BALANCE.trails;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Always on, a button with limited uses, a switch, or a gift when learned. */
export type StepKind = 'passive' | 'usable' | 'toggle' | 'grant';

export interface TrailStep {
  id: string;
  tier: 1 | 2 | 3;
  name: string;
  step: 'new' | 'upgrade';
  kind: StepKind;
  /** An upgrade: the step whose trait it replaces. */
  upgrades?: string;
  /** What it does (every kind but toggles). */
  text?: string;
  /** A toggle: what it does when on, and when off. */
  on?: string;
  off?: string;
  /** Parts of the text that changed from the tier before (exact substrings of text, on or off). */
  changed?: readonly string[];
  /** A gift picked at the start of a run reads like this. */
  startText?: string;
  /** "1 per day", for a usable step. */
  uses?: string;
  /** Its own cost in points, when it isn't the tier's (Wyatt wants per-step costs later). */
  cost?: number;
}

export interface Tree {
  id: string;
  cls: ClassId;
  /** "Leader Trail". */
  name: string;
  steps: readonly [TrailStep, TrailStep, TrailStep];
}

export interface HikerTrees {
  /** The roster id. */
  hikerId: string;
  moraleType: MoraleTypeId;
  trees: readonly [Tree, Tree, Tree];
}

const tree = (
  id: string,
  cls: ClassId,
  steps: readonly [TrailStep, TrailStep, TrailStep],
): Tree => ({ id, cls, name: treeName(cls), steps });

/** A step, its id from the tree's and its tier. */
const step =
  (treeId: string) =>
  (tier: 1 | 2 | 3, name: string, rest: Omit<TrailStep, 'id' | 'tier' | 'name'>): TrailStep => ({
    id: `${treeId}-t${tier}`,
    tier,
    name,
    ...rest,
  });

const LP = B.leashPuller;
const ET = B.experiencedTraveler;

const finnLeader = step('finn-leader');
const finnFollower = step('finn-follower');
const finnScavenger = step('finn-scavenger');
const ellieChef = step('ellie-chef');
const ellieScavenger = step('ellie-scavenger');
const ellieEntertainer = step('ellie-entertainer');
const momSupport = step('mom-support');
const momMerchant = step('mom-merchant');
const momTrekker = step('mom-trekker');
const gdogChef = step('gdog-chef');
const gdogTailor = step('gdog-tailor');
const gdogTrekker = step('gdog-trekker');
const winkLeader = step('wink-leader');
const winkArchitect = step('wink-architect');
const winkPacker = step('wink-packer');
const wyattNaturalist = step('wyatt-naturalist');
const wyattDaredevil = step('wyatt-daredevil');
const wyattSmith = step('wyatt-smith');

const LEASH_ON = `Finn’s Move All costs him ${LP.energy} Energy instead of any Appetite.`;
const copyBase =
  'Finn gets 1 more of the resource he keeps for each hiker who scavenged his tile earlier this phase.';

/** "Learn 3 random food recipes." and its start-of-run wording. */
const recipes = (what: string) => ({
  text: `Learn ${B.recipes} random ${what} recipes.`,
  startText: `Start with ${B.recipes} random ${what} recipes.`,
});

/** Artisan (Tier 2) and Master (Tier 3) for one item type. */
function craftTiers(
  at: ReturnType<typeof step>,
  who: string,
  pronoun: string,
  title: string,
  master: string,
  what: string,
): [TrailStep, TrailStep] {
  const artisan = at(2, `Artisan ${title}`, {
    step: 'new',
    kind: 'passive',
    text: `${who} can craft Tier 2 ${what}, and sees ${B.artisanCards} more card when crafting ${what}.`,
  });
  return [
    artisan,
    at(3, `Master ${master}`, {
      step: 'upgrade',
      kind: 'passive',
      upgrades: artisan.id,
      text: `${pronoun} can craft Tier 3 ${what}, and sees ${B.masterCards} more cards when crafting ${what}.`,
      changed: ['Tier 3', `${B.masterCards} more cards`],
    }),
  ];
}

const [artisanChef, masterChef] = craftTiers(gdogChef, 'Gdog', 'She', 'Chef', 'Chef', 'food');
const [artisanSeam, masterSeam] = craftTiers(
  gdogTailor,
  'Gdog',
  'She',
  'Seamstress',
  'Seamstress',
  'clothes',
);
const [artisanArch, masterArch] = craftTiers(
  winkArchitect,
  'Wink',
  'He',
  'Architect',
  'Architect',
  'shelters',
);
const [artisanSmith, masterSmith] = craftTiers(
  wyattSmith,
  'Wyatt',
  'He',
  'Smith',
  'Smith',
  'tools',
);

export const HIKER_TREES: readonly HikerTrees[] = [
  {
    hikerId: 'finn',
    moraleType: 'extrovert',
    trees: [
      tree('finn-leader', 'leader', [
        finnLeader(1, 'Leash Puller', {
          step: 'new',
          kind: 'toggle',
          on: LEASH_ON,
          off: 'Nothing.',
        }),
        finnLeader(2, 'Leash Puller II', {
          step: 'upgrade',
          kind: 'toggle',
          upgrades: 'finn-leader-t1',
          on: LEASH_ON,
          off: `Each hiker Finn brings along with Move All has a ${pct(LP.offChance[2])} chance to cost no Appetite and not use their action.`,
          changed: [
            `Each hiker Finn brings along with Move All has a ${pct(LP.offChance[2])} chance to cost no Appetite and not use their action.`,
          ],
        }),
        finnLeader(3, 'Leash Puller III', {
          step: 'upgrade',
          kind: 'toggle',
          upgrades: 'finn-leader-t2',
          on: LEASH_ON,
          off: `Each hiker brought along has a ${pct(LP.offChance[3])} chance to cost no Appetite. Finn can bring hikers who already acted, and nobody loses an action.`,
          changed: [
            pct(LP.offChance[3]),
            'Finn can bring hikers who already acted, and nobody loses an action.',
          ],
        }),
      ]),
      tree('finn-follower', 'follower', [
        finnFollower(1, 'Whatcha Up To?', {
          step: 'new',
          kind: 'passive',
          text: 'Being brought along by a Move All costs Finn no Appetite.',
        }),
        finnFollower(2, 'Whatcha Up To? II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'finn-follower-t1',
          text: 'Being brought along by a Move All costs Finn no Appetite and doesn’t use his action.',
          changed: ['and doesn’t use his action'],
        }),
        finnFollower(3, 'Never Alone', {
          step: 'new',
          kind: 'passive',
          text: 'Moving onto a tile where another hiker already is costs Finn no action and no Appetite.',
        }),
      ]),
      tree('finn-scavenger', 'scavenger', [
        finnScavenger(1, 'Copydog', {
          step: 'new',
          kind: 'passive',
          text: 'When Finn scavenges, he gets 1 more of the resource he keeps for each hiker who scavenged his tile earlier this phase.',
        }),
        finnScavenger(2, 'Copydog II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'finn-scavenger-t1',
          text: `${copyBase} If he’s the first to scavenge it, he sees ${B.copydog.cards} more cards.`,
          changed: [`If he’s the first to scavenge it, he sees ${B.copydog.cards} more cards.`],
        }),
        finnScavenger(3, 'Copydog III', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'finn-scavenger-t2',
          text: `${copyBase} Scavenging first costs him no Appetite, and he sees ${B.copydog.cards} more cards when he scavenges last.`,
          changed: [
            'Scavenging first costs him no Appetite',
            `he sees ${B.copydog.cards} more cards when he scavenges last`,
          ],
        }),
      ]),
    ],
  },
  {
    hikerId: 'ellie',
    moraleType: 'foody',
    trees: [
      tree('ellie-chef', 'chef', [
        ellieChef(1, 'Garbage Connoisseur', {
          step: 'new',
          kind: 'passive',
          text: 'When crafting food, Ellie can use Metal, Stone or Flint in place of Meat, Fish or Mushroom. Each one swapped in makes every bite give 1 less Appetite.',
        }),
        ellieChef(2, 'Garbage Connoisseur II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'ellie-chef-t1',
          text: 'When crafting food, Ellie can use Metal, Stone or Flint in place of Meat, Fish or Mushroom. Swapped-in resources no longer lower the Appetite.',
          changed: ['Swapped-in resources no longer lower the Appetite.'],
        }),
        ellieChef(3, 'Garbage Connoisseur III', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'ellie-chef-t2',
          text: 'When crafting food, Ellie can use Metal, Stone or Flint in place of Meat, Fish or Mushroom. Each one swapped in adds 1 Appetite to every bite.',
          changed: ['Each one swapped in adds 1 Appetite to every bite.'],
        }),
      ]),
      tree('ellie-scavenger', 'scavenger', [
        ellieScavenger(1, 'Furrager', {
          step: 'new',
          kind: 'passive',
          text: 'Fur is much more likely when Ellie scavenges.',
        }),
        ellieScavenger(2, 'Furrager II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'ellie-scavenger-t1',
          text: 'Fur is much more likely when Ellie scavenges. Fur she finds comes as ×2 or ×3, and she has a small chance to find Fur on tiles without a Wildlife node.',
          changed: [
            'Fur she finds comes as ×2 or ×3',
            'a small chance to find Fur on tiles without a Wildlife node',
          ],
        }),
        ellieScavenger(3, 'Fur Trade', {
          step: 'new',
          kind: 'usable',
          uses: 'No limit',
          text: `Ellie learns a recipe: ${B.furTrade.fur} Fur for 1 resource of her choice. It takes her action, like crafting. No limit.`,
        }),
      ]),
      tree('ellie-entertainer', 'entertainer', [
        ellieEntertainer(1, 'Singer', {
          step: 'new',
          kind: 'usable',
          uses: '1 per day',
          text: `For ${B.singer.energy} Energy, every hiker on Ellie’s tile gains ${B.singer.morale} Morale.`,
        }),
        ellieEntertainer(2, 'Loud', {
          step: 'new',
          kind: 'passive',
          text: 'When Ellie Keeps Watch, it also covers the tiles next to her.',
        }),
        ellieEntertainer(3, 'Singer II', {
          step: 'upgrade',
          kind: 'usable',
          upgrades: 'ellie-entertainer-t1',
          uses: '1 per day',
          text: `Every hiker on Ellie’s tile and the tiles next to her gains ${B.singer.moraleII} Morale. No Energy.`,
          changed: ['and the tiles next to her', `${B.singer.moraleII} Morale`, 'No Energy.'],
        }),
      ]),
    ],
  },
  {
    hikerId: 'mom',
    moraleType: 'wanderlust',
    trees: [
      tree('mom-support', 'support', [
        momSupport(1, 'Dog Mom', {
          step: 'new',
          kind: 'passive',
          text: 'When a Dog scavenges on Mom’s tile, she gains a random resource from one of the tile’s nodes.',
        }),
        momSupport(2, 'Agility Class', {
          step: 'new',
          kind: 'usable',
          uses: '1 per day',
          text: `For ${B.agilityClass.energy} Energy, a Dog on Mom’s tile gets another action this phase.`,
        }),
        momSupport(3, 'Agility Class II', {
          step: 'upgrade',
          kind: 'usable',
          upgrades: 'mom-support-t2',
          uses: '1 per day',
          text: 'A Dog on Mom’s tile gets another action this phase. No Energy.',
          changed: ['No Energy.'],
        }),
      ]),
      tree('mom-merchant', 'merchant', [
        momMerchant(1, 'MBA', {
          step: 'new',
          kind: 'passive',
          text: 'Caps are more likely when Mom scavenges.',
        }),
        momMerchant(2, 'MBA II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'mom-merchant-t1',
          text: `Caps are more likely, and Caps cards she finds give ${B.mba.capsBonus} more Caps.`,
          changed: [`and Caps cards she finds give ${B.mba.capsBonus} more Caps`],
        }),
        momMerchant(3, 'MBA III', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'mom-merchant-t2',
          text: `Caps are more likely, and Caps cards she finds give ${B.mba.capsBonus} more Caps. Caps cards in her scavenge are kept automatically, and she still picks another card.`,
          changed: [
            'Caps cards in her scavenge are kept automatically, and she still picks another card.',
          ],
        }),
      ]),
      tree('mom-trekker', 'trekker', [
        momTrekker(1, 'Experienced Traveler', {
          step: 'new',
          kind: 'passive',
          text: `Moving alone has a ${pct(ET.alone[1])} chance to cost Mom no Appetite.`,
        }),
        momTrekker(2, 'Experienced Traveler II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'mom-trekker-t1',
          text: `Moving alone: ${pct(ET.alone[2])}. Being brought along by a Move All: a ${pct(ET.brought[2])} chance to cost no Appetite.`,
          changed: [
            pct(ET.alone[2]),
            `Being brought along by a Move All: a ${pct(ET.brought[2])} chance to cost no Appetite.`,
          ],
        }),
        momTrekker(3, 'Experienced Traveler III', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'mom-trekker-t2',
          text: `Moving alone: ${pct(ET.alone[3])}. Being brought along never costs Mom Appetite, and she gains ${ET.morale} Morale each time she moves.`,
          changed: [
            'Being brought along never costs Mom Appetite',
            `she gains ${ET.morale} Morale each time she moves`,
          ],
        }),
      ]),
    ],
  },
  {
    hikerId: 'gdog',
    moraleType: 'ambivert',
    trees: [
      tree('gdog-chef', 'chef', [
        gdogChef(1, 'Family Cookbook', { step: 'new', kind: 'grant', ...recipes('food') }),
        artisanChef,
        masterChef,
      ]),
      tree('gdog-tailor', 'tailor', [
        gdogTailor(1, 'Clothing Catalogue', { step: 'new', kind: 'grant', ...recipes('clothes') }),
        artisanSeam,
        masterSeam,
      ]),
      tree('gdog-trekker', 'trekker', [
        gdogTrekker(1, 'Short', {
          step: 'new',
          kind: 'passive',
          text: `Moving alone costs Gdog ${B.short.discount} less Appetite. −${-B.short.slots} item slot.`,
        }),
        gdogTrekker(2, 'Short II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'gdog-trekker-t1',
          text: `Moving alone costs Gdog ${B.short.discount} less Appetite. Being brought along by a Move All costs her ${B.short.discount} less Appetite too, and the item slot comes back.`,
          changed: [
            `Being brought along by a Move All costs her ${B.short.discount} less Appetite too, and the item slot comes back.`,
          ],
        }),
        gdogTrekker(3, 'Homemade', {
          step: 'new',
          kind: 'passive',
          text: `When crafting, Gdog sees ${B.homemade.cards} more card and has +${B.homemade.luck} Luck.`,
        }),
      ]),
    ],
  },
  {
    hikerId: 'grandpaWink',
    moraleType: 'ambivert',
    trees: [
      tree('wink-leader', 'leader', [
        winkLeader(1, 'Lead the Way', {
          step: 'new',
          kind: 'passive',
          text: 'Hikers Wink brings along with Move All don’t use their action.',
        }),
        winkLeader(2, 'Lead the Way II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'wink-leader-t1',
          text: `Hikers Wink brings along don’t use their action, and his Move All costs ${B.leadTheWay.discount} less Appetite in total.`,
          changed: [`and his Move All costs ${B.leadTheWay.discount} less Appetite in total`],
        }),
        winkLeader(3, 'Just Around the Next Corner', {
          step: 'new',
          kind: 'passive',
          text: `Within ${B.justAroundTheNextCorner.tiles} tiles of the checkpoint, each hiker in Wink’s Move All has a ${pct(B.justAroundTheNextCorner.chance)} chance to cost no Appetite.`,
        }),
      ]),
      tree('wink-architect', 'architect', [
        winkArchitect(1, 'Floor Plans', { step: 'new', kind: 'grant', ...recipes('shelter') }),
        artisanArch,
        masterArch,
      ]),
      tree('wink-packer', 'packer', [
        winkPacker(1, 'Packed Toolbox', {
          step: 'new',
          kind: 'grant',
          text: `Gain ${B.packedToolbox.tools} random Tier 1 tools.`,
          startText: `Start with ${B.packedToolbox.tools} random Tier 1 tools.`,
        }),
        winkPacker(2, 'The Proper Way', {
          step: 'new',
          kind: 'passive',
          text: `Tools in Wink’s pack have ${B.properWay.uses} more use. The extra use is lost if the tool is traded away.`,
        }),
        winkPacker(3, 'Prepper', {
          step: 'new',
          kind: 'passive',
          text: 'Wink doesn’t set off challenges that are already revealed (by anyone). The challenge stays for the others.',
        }),
      ]),
    ],
  },
  {
    hikerId: 'wyatt',
    moraleType: 'energetic',
    trees: [
      tree('wyatt-naturalist', 'naturalist', [
        wyattNaturalist(1, 'Rain Lover', {
          step: 'new',
          kind: 'passive',
          text: `During any weather (not Clear), Wyatt has +${B.rainLover.luck[1]} Luck and sees ${B.rainLover.cards} more card when scavenging.`,
        }),
        wyattNaturalist(2, 'Rain Lover II', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'wyatt-naturalist-t1',
          text: `During weather, +${B.rainLover.luck[2]} Luck and ${B.rainLover.cards} more card when scavenging.`,
          changed: [`+${B.rainLover.luck[2]} Luck`],
        }),
        wyattNaturalist(3, 'Rain Lover III', {
          step: 'upgrade',
          kind: 'passive',
          upgrades: 'wyatt-naturalist-t2',
          text: `During weather, +${B.rainLover.luck[3]} Luck, ${B.rainLover.cards} more card when scavenging, and all XP Wyatt earns is doubled.`,
          changed: ['all XP Wyatt earns is doubled'],
        }),
      ]),
      tree('wyatt-daredevil', 'daredevil', [
        wyattDaredevil(1, 'Rule Changer', {
          step: 'new',
          kind: 'usable',
          uses: '1 per section',
          text: 'Swap a revealed Tier 1 challenge on a tile next to Wyatt for another random Tier 1 challenge.',
        }),
        wyattDaredevil(2, 'Rule Changer II', {
          step: 'upgrade',
          kind: 'usable',
          upgrades: 'wyatt-daredevil-t1',
          uses: `${B.ruleChanger.uses[2]} per section`,
          text: 'Swap a revealed Tier 1 or 2 challenge on any tile for another random one of the same tier.',
          changed: ['Tier 1 or 2', 'any tile'],
        }),
        wyattDaredevil(3, 'Rule Changer III', {
          step: 'upgrade',
          kind: 'usable',
          upgrades: 'wyatt-daredevil-t2',
          uses: `${B.ruleChanger.uses[3]} per section`,
          text: 'Remove the challenge from any tile, even one nobody has revealed. If there’s no challenge there, the use is wasted.',
          changed: [
            'Remove the challenge from any tile, even one nobody has revealed. If there’s no challenge there, the use is wasted.',
          ],
        }),
      ]),
      tree('wyatt-smith', 'smith', [
        wyattSmith(1, 'Toy Chest', { step: 'new', kind: 'grant', ...recipes('tool') }),
        artisanSmith,
        masterSmith,
      ]),
    ],
  },
];

export const TREES_BY_HIKER: ReadonlyMap<string, HikerTrees> = new Map(
  HIKER_TREES.map((h) => [h.hikerId, h]),
);

/** Every step, with its tree and hiker, by step id. */
export const STEPS: ReadonlyMap<string, { step: TrailStep; tree: Tree; hiker: HikerTrees }> =
  new Map(
    HIKER_TREES.flatMap((hiker) =>
      hiker.trees.flatMap((tree) =>
        tree.steps.map((s) => [s.id, { step: s, tree, hiker }] as const),
      ),
    ),
  );

/** The hikers who have trees (every other hiker is locked for now). */
export const DESIGNED_HIKERS: readonly string[] = HIKER_TREES.map((h) => h.hikerId);
