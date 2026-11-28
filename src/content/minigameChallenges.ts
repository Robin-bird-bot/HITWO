/**
 * Challenges played as minigames.
 *
 * - **The 49 minigame challenges** (docs/design/24-challenges-reset.md,
 *   section 4, and the four quick games of 30-quick-minigames.md): one per game, named after it or with a name of its own
 *   ("___ Attack!" for each Dodge animal). When a game has versions, the
 *   tile decides which one plays (Trail Blocked! is a fallen tree on a
 *   Forest tile, a rockslide on a Mountain one). Each plays at the tile's
 *   tier from its "From" tier on. Failing costs its punishment (section 2),
 *   with the backup rule; "passing" challenges send failed hikers back first.
 * - **The pop-up** (`MinigameChallenge`): what the challenge pop-up shows,
 *   for a challenge on a tile or a game in the testing tab.
 *
 * Every node, "From" tier, punishment and name here is the design's first
 * guess. TODO(wyatt): pick them after playtesting.
 */
import { asset } from '../config/assets';
import type { ChallengeDef, Effect, MinigameCard } from '../engine/challenges/types';
import { item, type Option } from '../minigames/prepare';
import type { Tier } from '../minigames/types';
import { F, M, R, W, P, Y, cond, fromTier, listed, upToTier } from './cardBuilders';

export interface MinigameChallenge {
  id: string;
  name: string;
  /** I to V (the minigames' tiers, 15-challenge-tiers.md). */
  tier: Tier;
  /** Who takes part ("WHOLE PARTY", or the hikers on the tile), top right of the banner. */
  who: string;
  /** In italic, under the poster (none for a test challenge). */
  flavor: string;
  /** Its poster (2:3), when Wyatt has painted one; otherwise its art for now, cropped. */
  poster?: string;
  /** The minigame it plays (src/minigames/catalog.ts), and the settings it plays with. */
  minigame: string;
  settings?: Readonly<Record<string, string | number>>;
  /** The game, as the pop-up shows it. */
  game: { name: string; line: string; chip?: string };
  /**
   * Prepare options the challenge adds to its game's (20-challenge-popup.md,
   * section 4.7): Gun Bear Attack!'s SKIP IT. They join the game's cost cards.
   */
  options?: readonly Option[];
  /** What failing costs, as the pop-up shows it (none for a test challenge). */
  ifHit: readonly { who: 'each' | 'everyone'; label: string; value: string }[];
  /**
   * The first Prepare slots filled cost nothing, and whose gift that is
   * (Rule Changer II; 26-fixes-and-wyatt-trees.md, section 5.2).
   */
  free?: { count: number; who: string };
}

/**
 * The pop-up for a minigame in the testing tab when it has no challenge of
 * its own yet (11-minigames-puzzles.md, "Testing tab"): the game's name in
 * the banner, the tier picked, an empty poster frame, no flavor and no stakes.
 */
export function testChallenge(
  game: { id: string; name: string; baseGame: string; description: string },
  tier: Tier,
): MinigameChallenge {
  return {
    id: `test-${game.id}`,
    name: game.name,
    tier,
    who: 'Whole party',
    flavor: '',
    minigame: game.id,
    game: { name: game.name, line: game.description },
    ifHit: [],
  };
}

// ── The 49 minigame challenges ──────────────────────────────────────────────

/** SKIP IT: two cans of Bear Spray get the party past the bear without playing. */
const SKIP_IT: Option = {
  id: 'skip',
  title: 'SKIP IT',
  color: 'red',
  accepts: item('bearSpray'),
  need: 2,
  label: 'SKIP IT',
  short: 'SKIP',
  note: 'get past without playing',
  max: 1,
  param: 'prep.skip',
  step: 1,
  skip: true,
};

/** A minigame challenge in the list: no cost (the game decides), its punishment, its art for now. */
function mg(input: {
  name: string;
  /** Its art for now in assets/challenges/ (none yet: a plain panel). */
  artFile?: string;
  from: 1 | 2 | 3;
  nodes: ChallengeDef['nodes'];
  gates?: ChallengeDef['gates'];
  game: MinigameCard;
  rolls?: ChallengeDef['rolls'];
  penalty: readonly Effect[];
  penaltyText: string;
}): ChallengeDef {
  return listed({
    name: input.name,
    art: !!input.artFile,
    ...(input.artFile ? { artFile: input.artFile } : {}),
    tier: input.from,
    nodes: input.nodes,
    ...(input.gates ? { gates: input.gates } : {}),
    scope: 'each',
    ...(input.rolls ? { rolls: input.rolls } : {}),
    cost: [],
    costText: [],
    penalty: input.penalty,
    penaltyText: [input.penaltyText],
    minigame: input.game,
  });
}

const dodge = (animal: string, rest: Partial<MinigameCard> = {}): MinigameCard => ({
  game: 'dodge',
  settings: { animal },
  ...rest,
});

/** "1 injury from Tier III" in place of Bleeding below it. */
const BLEED_THEN_INJURY = [upToTier(P.bleeding, 2), fromTier(P.injury, 3)];

export const MINIGAME_CHALLENGES: readonly ChallengeDef[] = [
  // ── Movement and dodging ──
  mg({
    name: 'Bee Attack!',
    artFile: 'bee-trouble',
    from: 1,
    nodes: [F, W],
    game: dodge('bees'),
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'Squirrel Attack!',
    artFile: 'squirrel-ambush',
    from: 1,
    nodes: [F],
    game: dodge('squirrels'),
    penalty: [P.bleeding],
    penaltyText: 'If failed: Bleeding for {y} phases.',
  }),
  mg({
    name: 'Ant Attack!',
    artFile: 'ants-are-marching',
    from: 1,
    nodes: [F, W],
    game: dodge('ants'),
    penalty: [P.category('food')],
    penaltyText: 'If failed: lose {x} Food (they carry it off).',
  }),
  mg({
    name: 'Eagle Attack!',
    artFile: 'majestic-eagle',
    from: 1,
    nodes: [M, W],
    // The Eagle at Tier I, Toupeeagle at II, Freeagle from III.
    game: dodge('eagle', {
      versions: [
        { upToTier: 1, settings: { eagleVersion: 'eagle' }, artFile: 'majestic-eagle' },
        { upToTier: 2, settings: { eagleVersion: 'toupeeEagle' }, artFile: 'toupee-eagle' },
        { settings: { eagleVersion: 'freeagle' }, artFile: 'freeagle' },
      ],
    }),
    penalty: [P.random],
    penaltyText: 'If failed: lose {x} random resources.',
  }),
  mg({
    name: 'Bobcat Attack!',
    artFile: 'bobcat',
    from: 2,
    nodes: [F, W],
    game: dodge('bobcat'),
    penalty: [P.injury],
    penaltyText: 'If failed: 1 injury.',
  }),
  mg({
    name: 'Bear Attack!',
    artFile: 'bear',
    from: 2,
    nodes: [F, W],
    // Armored at Level 3, which the Bear plays from Tier IV.
    game: dodge('bear', {
      versions: [{ fromTier: 4, settings: {}, artFile: 'armored-bear' }, { settings: {} }],
    }),
    penalty: [P.bleeding, fromTier(P.injury, 3)],
    penaltyText: 'If failed: Bleeding for {y} phases; at Tier III and up, 1 injury too.',
  }),
  mg({
    name: 'Sword Bear Attack!',
    artFile: 'bear',
    from: 3,
    nodes: [F, W],
    game: dodge('swordBear'),
    penalty: [P.injury],
    penaltyText: 'If failed: 1 injury.',
  }),
  mg({
    // The old Bear Country (it keeps the poster and SKIP IT).
    name: 'Gun Bear Attack!',
    artFile: 'bear-with-a-gun',
    from: 3,
    nodes: [F, W],
    game: dodge('gunBear'),
    penalty: [P.injury, P.bleeding],
    penaltyText: 'If failed: 1 injury, and Bleeding for {y} phases.',
  }),
  mg({
    name: 'Stampede!',
    artFile: 'stampede',
    from: 3,
    nodes: [W],
    game: dodge('stampede'),
    penalty: [P.injury, P.random],
    penaltyText: 'If failed: 1 injury, and lose {x} random resources.',
  }),
  mg({
    name: 'Snow Leopard Attack!',
    artFile: 'snow-leopard',
    from: 3,
    nodes: 'any',
    gates: ['snow'],
    game: dodge('snowLeopard'),
    penalty: [P.injury],
    penaltyText: 'If failed: 1 injury.',
  }),
  mg({
    name: 'Snowgirl Attack!',
    artFile: 'abominable-snowgirl',
    from: 3,
    nodes: 'any',
    gates: ['snow'],
    game: dodge('snowgirl'),
    penalty: [P.injury, P.category('food')],
    penaltyText: 'If failed: 1 injury, and lose {x} Food (she eats your snacks).',
  }),
  mg({
    name: 'Stay on the Trail',
    artFile: 'winding-trail',
    from: 1,
    nodes: 'any',
    game: {
      game: 'trails',
      passing: true,
      versions: [
        { nodes: [F, W], settings: { type: 'forest' }, artFile: 'winding-trail' },
        { nodes: [R], settings: { type: 'riverbank' }, artFile: 'winding-trail' },
        {
          nodes: [M],
          upToTier: 2,
          settings: { type: 'switchbacks' },
          artFile: 'steep-switchbacks',
        },
        { nodes: [M], settings: { type: 'ridgeline' }, artFile: 'sharp-wind' },
      ],
    },
    penalty: [P.back, P.energy],
    penaltyText: 'If failed: go back, and lose {x} Energy.',
  }),
  mg({
    name: 'Crossing',
    artFile: 'dangerous-current',
    from: 1,
    nodes: 'any',
    game: {
      game: 'crossing',
      passing: true,
      versions: [
        { nodes: [F, M], settings: { version: 'road' } },
        { nodes: [R], settings: { version: 'river' } },
        { nodes: [W], settings: { version: 'critter' } },
      ],
    },
    penalty: [P.back, P.random],
    penaltyText: 'If failed: go back, and lose {x} random resources.',
  }),
  mg({
    name: 'Sketchy Bridge',
    artFile: 'cracked-bridge',
    from: 1,
    nodes: [R],
    game: { game: 'sketchyBridge', passing: true, hurt: BLEED_THEN_INJURY },
    penalty: [P.back, { op: 'stat', stat: 'energy', delta: 1, lose: true }],
    penaltyText:
      'If failed: whoever breaks it gets Bleeding for {y} phases (1 injury from Tier III). Those behind go back, and lose 1 Energy.',
  }),
  mg({
    name: 'Camp Cleanup',
    from: 1,
    nodes: [F, W],
    game: { game: 'campCleanup' },
    penalty: [P.random],
    penaltyText: 'If failed: lose {x} random resources.',
  }),
  mg({
    name: 'Rafting',
    artFile: 'flash-flood',
    from: 2,
    nodes: [R],
    game: { game: 'rafting', passing: true },
    penalty: [P.back, P.random],
    penaltyText: 'If failed: everyone goes back, and loses {x} random resources.',
  }),
  mg({
    name: 'Train!',
    artFile: 'train',
    from: 2,
    nodes: [F, M],
    game: { game: 'train', passing: true },
    penalty: [P.back, P.energy],
    penaltyText: 'If failed: go back, and lose {x} Energy.',
  }),
  mg({
    name: 'Rock Climb',
    artFile: 'group-climb',
    from: 2,
    nodes: [M],
    game: { game: 'rockClimb', passing: true, keepsPays: true },
    penalty: [P.back],
    penaltyText: 'If failed: go back (each fall already cost 1 Energy).',
  }),
  mg({
    name: 'Falling Rocks',
    artFile: 'rockfall',
    from: 2,
    nodes: [M],
    game: { game: 'fallingRocks', passing: true },
    penalty: [P.back, ...BLEED_THEN_INJURY],
    penaltyText: 'If failed: go back, and Bleeding for {y} phases (1 injury from Tier III).',
  }),

  // ── Puzzle and logic ──
  mg({
    name: 'Broken Trail Signs',
    from: 1,
    nodes: 'any',
    game: { game: 'traildle' },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'False Trail Signs',
    artFile: 'false-trail-markers',
    from: 1,
    nodes: 'any',
    game: { game: 'fakeSigns' },
    penalty: [P.energy, cond('brainFog', 1, 'days')],
    penaltyText: 'If failed: lose {x} Energy, and Brain Fog for 1 day.',
  }),
  mg({
    name: 'Lost Trail',
    artFile: 'split-path',
    from: 1,
    nodes: [F, M],
    game: {
      game: 'findPath',
      versions: [
        { upToTier: 2, settings: { fog: 'off' }, artFile: 'split-path' },
        { settings: { fog: 'on' }, artFile: 'foggy-hollow' },
      ],
    },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'Tangled Trails',
    from: 1,
    nodes: 'any',
    game: { game: 'trailMap' },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'Torn Postcards',
    artFile: 'tourist-trap',
    from: 1,
    nodes: 'any',
    game: { game: 'picturePuzzle' },
    penalty: [P.random],
    penaltyText: 'If failed: lose {x} random resources.',
  }),
  mg({
    name: 'Cracked Pots',
    artFile: 'cracked-pots',
    from: 1,
    nodes: [R],
    game: { game: 'crackedPots' },
    penalty: [P.category('food')],
    penaltyText: 'If failed: lose {x} Food.',
  }),
  mg({
    name: 'Dog Waste Zone',
    artFile: 'dog-waste-zone',
    from: 1,
    nodes: [F, W],
    gates: ['dogOnTile'],
    game: { game: 'minefield', needs: 'dog' },
    penalty: [P.appetite, cond('nauseous', 1, 'days')],
    penaltyText: 'If failed: lose {x} Appetite, and Nauseous for 1 day.',
  }),
  mg({
    name: 'Torn Pack',
    artFile: 'torn-pack',
    from: 2,
    nodes: [F, W],
    game: { game: 'packItUp' },
    penalty: [P.random],
    penaltyText: 'If failed: lose {x} random resources.',
  }),
  mg({
    name: 'Thin Ice',
    artFile: 'thin-ice',
    from: 3,
    nodes: [R],
    gates: ['snow'],
    rolls: { soaked: Y(2, 3) },
    game: { game: 'thinIce', passing: true },
    penalty: [cond('soaked', 'soaked', 'phases'), P.energy],
    penaltyText: 'If failed: Soaked for {soaked} phases, and lose {x} Energy.',
  }),

  // ── Memory ──
  mg({
    name: 'Follow the Ranger',
    artFile: 'rangers-request',
    from: 1,
    nodes: 'any',
    game: { game: 'rememberPath' },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'Snack Match',
    artFile: 'tummy-rumbling',
    from: 1,
    nodes: 'any',
    game: { game: 'memory' },
    penalty: [P.category('food')],
    penaltyText: 'If failed: lose {x} Food.',
  }),
  mg({
    name: 'Safari',
    artFile: 'handsome-boy',
    from: 1,
    nodes: [W],
    game: { game: 'safari' },
    penalty: [P.random],
    penaltyText: 'If failed: lose {x} random resources.',
  }),
  mg({
    name: 'Crossroads',
    artFile: 'split-path',
    from: 1,
    nodes: [F, M],
    // A whiteout in snow: only its art for now. TODO(wyatt): Crossroads has no whiteout version yet.
    game: {
      game: 'crossroads',
      versions: [{ snow: true, settings: {}, artFile: 'blinding-snow' }, { settings: {} }],
    },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'Birdsong',
    artFile: 'warning-bird',
    from: 1,
    nodes: [F, R],
    game: { game: 'birdsong' },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),

  // ── Search ──
  mg({
    name: 'Snack Hunt',
    artFile: 'rocks-that-look-delicious',
    from: 1,
    nodes: 'any',
    game: { game: 'findObject' },
    penalty: [P.appetite],
    penaltyText: 'If failed: lose {x} Appetite.',
  }),
  mg({
    name: 'Spooky Ghost!',
    artFile: 'spooky-ghost',
    from: 1,
    nodes: [F, M],
    game: { game: 'spookyGhost' },
    penalty: [P.energy, cond('nightmares', 1, 'nights')],
    penaltyText: 'If failed: lose {x} Energy, and Nightmares for 1 night.',
  }),

  // ── Reaction and timing ──
  mg({
    name: 'Trail Blocked!',
    artFile: 'withered-forest',
    from: 1,
    nodes: 'any',
    game: {
      game: 'trailBlocks',
      passing: true,
      versions: [
        { nodes: [F], settings: { version: 'chop' }, artFile: 'withered-forest' },
        { nodes: [M], settings: { version: 'rockslide' }, artFile: 'rockslide' },
        { nodes: [R], settings: { version: 'river' }, artFile: 'beaver-dam' },
        { nodes: [W], settings: { version: 'animals' }, artFile: 'furry-pack' },
      ],
    },
    penalty: [P.back, P.energy],
    penaltyText: 'If failed: go back, and lose {x} Energy.',
  }),
  mg({
    name: 'Sleeping Bear',
    artFile: 'the-grim-sleeper',
    from: 1,
    nodes: [F, W],
    game: { game: 'sleepingBear', passing: true },
    penalty: [P.back, P.bleeding],
    penaltyText: 'If caught: go back, and Bleeding for {y} phases.',
  }),
  mg({
    name: 'Fly Block',
    artFile: 'flies',
    from: 1,
    nodes: [F, W],
    game: { game: 'flyBlock' },
    penalty: [P.appetite],
    penaltyText: 'If failed: lose {x} Appetite.',
  }),
  mg({
    name: 'Fly Swatter',
    artFile: 'mosquito-swarm',
    from: 1,
    nodes: [F, R],
    game: {
      game: 'flySwatter',
      versions: [{ nodes: [R], settings: {}, artFile: 'gnats' }, { settings: {} }],
    },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'Squirrel Theft',
    artFile: 'annoying-squirrel',
    from: 1,
    nodes: [F],
    game: { game: 'squirrelTheft', keepsPays: true },
    penalty: [],
    penaltyText: 'If failed: what it stole is lost.',
  }),
  mg({
    name: 'Raccoon Shuffle',
    artFile: 'shell-game',
    from: 1,
    nodes: [F, W],
    game: { game: 'raccoonShuffle', keepsPays: true },
    penalty: [],
    penaltyText: 'If failed: the raccoon steals what’s on its card.',
  }),
  mg({
    name: 'Whackoon',
    from: 1,
    nodes: [F, W],
    game: { game: 'whackoon' },
    penalty: [P.energy],
    penaltyText: 'If failed: lose {x} Energy.',
  }),
  mg({
    name: 'Trail Blazes',
    artFile: 'straight-path',
    from: 1,
    nodes: [F],
    game: { game: 'trailBlazes' },
    penalty: [P.energy, cond('bored', 1, 'days')],
    penaltyText: 'If failed: lose {x} Energy, and Bored for 1 day.',
  }),
  mg({
    name: 'Firefly Catch',
    artFile: 'long-night-ahead',
    from: 1,
    nodes: [F, R],
    game: { game: 'fireflyCatch' },
    penalty: [P.energy, cond('sleepy', 1, 'days')],
    penaltyText: 'If failed: lose {x} Energy, and Sleepy for 1 day.',
  }),
  mg({
    name: 'Size Up',
    from: 1,
    nodes: 'any',
    game: { game: 'sizeUp' },
    penalty: [P.random],
    penaltyText: 'If failed: lose {x} random resources.',
  }),

  // The four quick games of Nov 27 (30-quick-minigames.md): the cost cards
  // with these names became these games, with the cards' art, nodes, "From"
  // tiers and punishments.
  mg({
    name: 'Incoming Bike!',
    artFile: 'incoming-bike',
    from: 1,
    nodes: [F, R],
    game: { game: 'incomingBike' },
    penalty: [P.back, P.random],
    penaltyText: 'If failed: go back, and lose {x} random resources (knocked loose).',
  }),
  mg({
    name: 'Wrong Turn',
    artFile: 'split-path',
    from: 1,
    nodes: [F, M],
    game: { game: 'wrongTurn', passing: true },
    penalty: [P.back, P.appetite],
    penaltyText: 'If failed: everyone goes back, and loses {x} Appetite.',
  }),
  mg({
    name: 'Fallen Branch',
    artFile: 'withered-forest',
    from: 2,
    nodes: [F],
    game: { game: 'fallenBranch', passing: true },
    penalty: [P.back, P.energy],
    penaltyText: 'If failed: everyone goes back, and loses {x} Energy.',
  }),
  mg({
    name: 'Snagged Pack',
    artFile: 'torn-pack',
    from: 1,
    nodes: [F, W],
    game: { game: 'snaggedPack' },
    penalty: [P.random],
    penaltyText: 'If failed: lose {x} random resources (they fall out).',
  }),
];

/** Prepare options a challenge adds to its game's (Gun Bear Attack!'s SKIP IT). */
export const CHALLENGE_OPTIONS: Readonly<Record<string, readonly Option[]>> = {
  'gun-bear-attack': [SKIP_IT],
};

/** Posters Wyatt has painted, by challenge (2:3). */
export const POSTERS: Readonly<Record<string, string>> = {
  'gun-bear-attack': asset('posters/bear-country.png'),
};

/**
 * Gun Bear Attack! in the testing tab (Dodge with Bear with a Gun): its
 * poster, flavor and SKIP IT, at the tier picked.
 */
export const GUN_BEAR_ATTACK: MinigameChallenge = {
  id: 'gun-bear-attack',
  name: 'Gun Bear Attack!',
  tier: 3,
  who: 'Whole party',
  flavor: '“Mama bear doesn’t like visitors.”',
  poster: POSTERS['gun-bear-attack'],
  minigame: 'dodge',
  settings: { animal: 'gunBear' },
  game: {
    name: 'Bear with a Gun',
    line: 'Dodge the bear’s shots and traps. Hikers take turns.',
  },
  options: CHALLENGE_OPTIONS['gun-bear-attack'],
  ifHit: [{ who: 'each', label: 'Each hiker who fails:', value: '1 injury, and Bleeding' }],
};
