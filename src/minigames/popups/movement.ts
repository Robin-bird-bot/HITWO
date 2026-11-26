/**
 * The pop-up content for Movement and dodging (docs/design/20-challenge-popup.md,
 * version 3, section 7): Dodge (every animal), Camp Cleanup, Crossing,
 * Train!, Rafting, Trails and Rock Climb. How to play uses this run's
 * numbers after Prepare; rule lines show only when they apply.
 */
import { BALANCE } from '../../config/balance';
import { VERSIONS as CROSSING_VERSIONS } from '../crossing/logic';
import { ANIMALS, isAnimal, levelFor } from '../dodge/animals';
import { autoLength } from '../dodge/logic';
import type { AnimalId } from '../dodge/types';
import { group, item, prepNumber, res } from '../prepare';
import { TRAIL_TYPES } from '../trails/course';
import { TIERS, type MinigameSettings, type Tier } from '../types';
import {
  ARROWS,
  countBar,
  FAIL_ENERGY,
  finger,
  fromTier,
  key,
  levelBar,
  line,
  mostOver,
  mouse,
  numOr,
  opt,
  OR,
  P_,
  phrases,
  plusFor,
  plusSecOpt,
  rulesOf,
  seconds,
  slowerOpt,
  tierIn,
  timeBar,
  WASD,
} from './common';
import type { GamePopup } from './types';

const MG = BALANCE.minigames;
const D = MG.dodge;

// ── Dodge ──────────────────────────────────────────────────────────────────

const animalOf = (s: MinigameSettings): AnimalId => (isAnimal(s.animal) ? s.animal : 'bees');

const ANIMAL_WORDS: Readonly<Record<AnimalId, string>> = {
  bees: 'the bees',
  bear: 'the bear',
  swordBear: 'the bear with a sword',
  bobcat: 'the bobcat',
  squirrels: 'the squirrel army',
  gunBear: 'the bear with a gun',
  ants: 'the ants',
  stampede: 'the stampede',
  monster: 'the Woods Monster',
};

/** Dodge's length after Prepare's Bear Spray. */
function dodgeLength(s: MinigameSettings): { base: number; value: number } {
  const base = numOr(s, 'length', autoLength(animalOf(s), tierIn(s)));
  return { base, value: Math.round(base * (1 - prepNumber(s, P_('bearSpray')))) };
}

/** The level a Dodge animal plays at (Auto: the tier's; 0 is Easy). */
function dodgeRank(s: MinigameSettings): 0 | 1 | 2 | 3 {
  const pick = s.level;
  if (pick === 'easy') return 0;
  if (pick === '1' || pick === '2' || pick === '3') return Number(pick) as 1 | 2 | 3;
  return levelFor(animalOf(s), tierIn(s));
}

/** The first tier an animal plays at a level or above (for a rule line's tag). */
function firstTier(animal: AnimalId, rank: number): Tier {
  return TIERS.find((t) => (D.roster[t][animal] ?? -1) >= rank) ?? 5;
}

/**
 * An animal's own rule lines (section 7): anything its attacks do besides
 * cost a heart, only at the levels (or tiers) they come.
 */
function animalLines(s: MinigameSettings) {
  const a = animalOf(s);
  const rank = dodgeRank(s);
  const tier = tierIn(s);
  const at = (r: number, text: string) =>
    rank >= r
      ? line(text, r > (D.roster[1][a] ?? 0) ? fromTier(firstTier(a, r)) : undefined)
      : null;
  switch (a) {
    case 'bees':
      return [
        at(2, 'Bees can come in waves from both sides.'),
        at(3, 'A swarm can fly straight at you.'),
      ];
    case 'bear':
      return [
        at(2, 'A bear hug pushes the walls in for a few seconds.'),
        at(3, 'Honey puddles slow you down.'),
      ];
    case 'bobcat':
      return [
        line('The bobcat stalks you, hopping to where you were.'),
        at(3, 'Some pounces are feints: the shadow fades and nothing lands.'),
      ];
    case 'squirrels':
      return [
        line('Acorns bounce off the walls. Bombs blast a circle when the fuse runs out.'),
        at(3, 'Bombs and broken acorns throw shrapnel.'),
      ];
    case 'swordBear':
      return [
        line('Numbered swords fly across the box in order.'),
        tier >= D.sword.shrinkFrom
          ? line('The box can shrink.', fromTier(D.sword.shrinkFrom as Tier))
          : null,
      ];
    case 'gunBear':
      return [
        at(2, 'Snipe hits for 2 hearts and leaves a hole you can’t walk on.'),
        line('Traps land gray. Once they turn red, they bite.'),
        tier >= D.gun.bulletRing.fromTier
          ? line(
              'Bullet rings fly out from the top. Find the gaps.',
              fromTier(D.gun.bulletRing.fromTier as Tier),
            )
          : null,
      ];
    case 'ants':
      return [
        at(2, 'Fire ants blow up, all but one. Stand by the safe ant.'),
        at(2, 'Ant hills are solid, and they fire ants at you.'),
      ];
    case 'monster':
      return [line('At half time the box shrinks, and the lights can go out.')];
    case 'stampede':
      return [line('Animals take turns attacking. The box follows whoever’s attacking.')];
  }
}

const BEARS: readonly AnimalId[] = ['bear', 'swordBear', 'gunBear'];

export const DODGE_POPUP: GamePopup = {
  howToPlay(s) {
    const animal = animalOf(s);
    const sw = numOr(s, 'switch', D.switchSec);
    return phrases(
      `Dodge ${ANIMAL_WORDS[animal]}! Steer your hiker around the box and stay out of the way. **${animal === 'bees' ? 'Each sting costs a heart.' : 'Each hit costs a heart.'}** Hikers take turns every ${sw} seconds. Survive for ${dodgeLength(s).value} seconds.`,
    );
  },
  rules: (s) =>
    rulesOf(
      line('A hiker who loses every heart is out. The others keep going.'),
      ...animalLines(s),
    ),
  controls: [
    { action: 'MOVE', inputs: [mouse('Drag'), OR, finger('Drag'), OR, ...WASD, OR, ...ARROWS] },
  ],
  chips: (s) => [
    seconds(dodgeLength(s).value),
    'TAKE TURNS',
    ANIMALS[animalOf(s)].name.toUpperCase(),
  ],
  ifFail: [],
  bars(s) {
    const animal = animalOf(s);
    const rank = dodgeRank(s);
    const out = [levelBar('speed', 'ATTACK SPEED', s, -prepNumber(s, P_('slower')))];
    if (animal === 'bees') {
      const base = rank === 0 ? 2 : D.bees.lane[rank].bees[1];
      out.push(
        countBar('bees', 'BEES PER WAVE', base, Math.max(1, base - prepNumber(s, P_('smoke'))), 6),
      );
    }
    if (animal === 'ants') {
      const n = D.ants.march.ants[rank];
      out.push(countBar('ants', 'ANTS PER LINE', n, n, D.ants.march.ants[3]));
    }
    // How long to survive (as in the prototype); Bear Spray shortens it.
    const len = dodgeLength(s);
    out.push(
      timeBar(
        'survive',
        'SURVIVE',
        len.base,
        len.value,
        mostOver((t) => autoLength(animal, t)),
      ),
    );
    return out;
  },
  perHiker: (s) => ({
    label: 'LIVES',
    kind: 'hearts',
    base: numOr(s, 'lives', D.lives),
    param: P_('lives'),
    step: 1,
  }),
  options(s) {
    const animal = animalOf(s);
    const heart = plusFor('HEART', '♥');
    if (animal === 'monster') return [heart];
    return [
      heart,
      slowerOpt('SLOWER ATTACKS', 'green'),
      opt(
        'smoke',
        'red',
        group('forest'),
        '−1 BEE PER WAVE',
        '−1 BEE',
        'smoke calms them',
        { param: P_('smoke'), step: 1 },
        {
          title: 'SMOKY FIRE',
          need: 2,
          onlyIf: (x) => animalOf(x) === 'bees',
        },
      ),
      opt(
        'bearSpray',
        'red',
        item('bearSpray'),
        '25% SHORTER',
        'SPRAY',
        'the bear backs off sooner',
        { param: P_('bearSpray'), step: 0.25 },
        {
          title: 'BEAR SPRAY',
          onlyIf: (x) => BEARS.includes(animalOf(x)),
        },
      ),
      opt(
        'sandbags',
        'red',
        res('clay'),
        'TRAPS AND HOLES LAST HALF AS LONG',
        'BAGS',
        'sandbags fill them',
        { param: P_('sandbags'), step: 1 },
        {
          title: 'SANDBAGS',
          need: 2,
          onlyIf: (x) => animalOf(x) === 'gunBear',
        },
      ),
      opt(
        'salt',
        'red',
        res('salt'),
        'ANT LINES 20% SLOWER',
        'SALT',
        'each',
        { param: P_('salt'), step: 0.2 },
        {
          title: 'SALT LINE',
          max: 2,
          onlyIf: (x) => animalOf(x) === 'ants',
        },
      ),
    ];
  },
};

// ── Camp Cleanup ───────────────────────────────────────────────────────────

const CC = MG.campCleanup;

const campQuota = (s: MinigameSettings) => {
  const hikers = Array.isArray(s.hikers) ? s.hikers.length : 3;
  const t = CC.tiers[tierIn(s)];
  return numOr(s, 'bags', t.quota - (hikers >= CC.bigParty ? CC.bigPartyLess : 0));
};

const campObstacles = (s: MinigameSettings) =>
  s.obstacles === 'off' ? false : s.obstacles === 'on' || CC.tiers[tierIn(s)].obstacles > 0;

export const CAMP_CLEANUP_POPUP: GamePopup = {
  howToPlay(s) {
    const quota = Math.max(1, campQuota(s) - prepNumber(s, P_('fewerBags')));
    return phrases(
      `You’re all one long line. Steer around the campsite and pick up trash in your colors; each piece adds a bag to the end of the line. **Hit a wall, a rock or yourself and you lose bags.** Everyone needs ${quota} ${quota === 1 ? 'bag' : 'bags'} when time runs out.`,
    );
  },
  rules: (s) =>
    rulesOf(
      line('You can’t turn straight back, but quick turns queue up.'),
      campObstacles(s) && line('Rocks, stumps, logs and tents are in the way.', fromTier(3)),
    ),
  controls: [
    {
      action: 'STEER',
      inputs: [...WASD, OR, ...ARROWS, OR, finger('Swipe'), OR, mouse('Click a side')],
    },
  ],
  chips: (s) => [
    seconds(numOr(s, 'time', CC.tiers[tierIn(s)].timeSec) + prepNumber(s, P_('extraSec'))),
    'ALL TOGETHER',
  ],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const time = numOr(s, 'time', CC.tiers[tierIn(s)].timeSec);
    const quota = campQuota(s);
    return [
      timeBar(
        'time',
        'TIME',
        time,
        time + prepNumber(s, P_('extraSec')),
        mostOver((t) => CC.tiers[t].timeSec),
      ),
      levelBar('speed', 'SPEED', s, -prepNumber(s, P_('slower'))),
      countBar(
        'bags',
        'BAGS EACH',
        quota,
        Math.max(1, quota - prepNumber(s, P_('fewerBags'))),
        mostOver((t) => CC.tiers[t].quota),
      ),
    ];
  },
  options: () => [
    plusSecOpt(10),
    slowerOpt('SLOWER', 'green'),
    opt('fewerBags', 'red', item('sack'), '−1 BAG EACH', '−1 BAG', 'everyone needs one fewer', {
      param: P_('fewerBags'),
      step: 1,
    }),
    opt(
      'fewerObstacles',
      'red',
      item('shovel'),
      'CLEAR THE OBSTACLES',
      '−2 ROCKS',
      '2 fewer obstacles',
      { param: P_('fewerObstacles'), step: 2 },
      {
        onlyIf: campObstacles,
      },
    ),
  ],
};

// ── Crossing, Train!, Rafting ──────────────────────────────────────────────

const CR = MG.crossing;
const crossingVersion = (s: MinigameSettings) =>
  CROSSING_VERSIONS.find((v) => v.id === s.version) ?? CROSSING_VERSIONS[0]!;
const riverLanes = (s: MinigameSettings) => s.version === 'river' || s.version === 'mixed';

export const CROSSING_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Get every hiker across, one hop at a time. **A hit costs a life,** and sends that hiker back to the start and to the back of the line. Out of lives and you’re out.',
    ),
  rules: (s) =>
    rulesOf(
      riverLanes(s) &&
        line(
          'On the river, ride the logs and turtles. The water is a hit, and so is riding off the edge.',
        ),
      riverLanes(s) && line('Turtles dive. Don’t stand on one when it does.'),
      s.version === 'mixed' &&
        line('Road at the bottom, river at the top, with a safe bank between.'),
      s.version === 'critter' &&
        tierIn(s) >= CR.critter.stopFrom &&
        line('Some critters stop, then go on.', fromTier(CR.critter.stopFrom as Tier)),
    ),
  controls: [
    { action: 'HOP', inputs: [...WASD, OR, ...ARROWS, OR, finger('Swipe'), OR, mouse('Click')] },
  ],
  chips: (s) => ['ONE AT A TIME', crossingVersion(s).name.toUpperCase()],
  ifFail: FAIL_ENERGY,
  bars: (s) => [levelBar('speed', 'TRAFFIC SPEED', s, -prepNumber(s, P_('slower')))],
  perHiker: (s) => {
    const critter = crossingVersion(s).id === 'critter';
    return {
      label: 'LIVES',
      kind: 'hearts',
      base: numOr(s, 'lives', CR.tiers[tierIn(s)].lives + (critter ? CR.critter.extraLives : 0)),
      param: P_('lives'),
      step: 1,
    };
  },
  options: () => [
    plusFor('LIFE', '♥'),
    slowerOpt('SLOWER TRAFFIC', 'green'),
    opt(
      'logs',
      'green',
      res('wood'),
      'MORE LOGS',
      'LOGS',
      'more logs on the river',
      { param: P_('logs'), step: 1 },
      {
        need: 2,
        onlyIf: riverLanes,
      },
    ),
  ],
};

const TR = MG.train;
const trainFog = (s: MinigameSettings) =>
  s.fog === 'on' ? true : s.fog === 'off' ? false : TR.tiers[tierIn(s)].fog;

export const TRAIN_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      `Hop up and down between the tracks as trains come through. Watch for the headlight and the "!". **A hit costs a life.** Hikers take turns every ${TR.switchSec} seconds.`,
    ),
  rules: (s) =>
    rulesOf(
      tierIn(s) >= TR.bothSidesFrom &&
        line('Trains come from either side.', fromTier(TR.bothSidesFrom as Tier)),
      trainFog(s) && line('Fog hides the far side. Watch the warnings.'),
    ),
  controls: [
    {
      action: 'HOP',
      inputs: [...key('W', 'S'), OR, ...key('↑', '↓'), OR, finger('Swipe'), OR, mouse('Click')],
    },
  ],
  chips: (s) => [
    seconds(numOr(s, 'survive', TR.tiers[tierIn(s)].surviveSec)),
    'TAKE TURNS',
    ...(trainFog(s) ? ['FOG'] : []),
  ],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const sec = numOr(s, 'survive', TR.tiers[tierIn(s)].surviveSec);
    return [
      levelBar('speed', 'TRAIN SPEED', s, -prepNumber(s, P_('slower'))),
      timeBar(
        'survive',
        'SURVIVE',
        sec,
        sec,
        mostOver((t) => TR.tiers[t].surviveSec),
      ),
    ];
  },
  perHiker: (s) => ({
    label: 'LIVES',
    kind: 'hearts',
    base: numOr(s, 'lives', TR.tiers[tierIn(s)].lives),
    param: P_('lives'),
    step: 1,
  }),
  options: () => [
    plusFor('LIFE', '♥'),
    slowerOpt('SLOWER TRAINS', 'green'),
    opt(
      'brighter',
      'blue',
      res('oil'),
      'BRIGHTER WARNING',
      '+WARN',
      '+0.3 s warning',
      { param: P_('brighter'), step: 0.3 },
      {
        onlyIf: trainFog,
      },
    ),
  ],
};

export const RAFTING_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Steer the raft upriver to the dock. **Hitting a rock costs a life.** Reach the dock with any life left and everyone passes.',
    ),
  rules: (s) =>
    rulesOf(
      line('Rapids don’t hurt, but they speed everything up for the rest of the run.'),
      tierIn(s) >= MG.rafting.twoLaneFrom && line('Big rocks can cover two lanes.', 'TIER V'),
    ),
  controls: [
    {
      action: 'STEER',
      inputs: [...key('A', 'D'), OR, ...key('←', '→'), OR, finger('Swipe'), OR, mouse('Click')],
    },
  ],
  chips: () => ['WHOLE PARTY'],
  ifFail: [{ who: 'everyone', label: 'Nobody reaches the dock:', value: 'everyone fails' }],
  bars: (s) => [levelBar('speed', 'RIVER SPEED', s, -prepNumber(s, P_('slower')))],
  perHiker: () => ({ label: 'LIVES', kind: 'hearts', base: 1, param: P_('lives'), step: 1 }),
  options: () => [
    plusFor('LIFE', '♥'),
    slowerOpt('SLOWER RIVER', 'green'),
    opt(
      'sturdy',
      'green',
      res('wood'),
      'STURDIER RAFT',
      'STURDY',
      'the first hit doesn’t count',
      { param: P_('sturdy'), step: 1 },
      {
        need: 2,
      },
    ),
  ],
};

// ── Trails, Rock Climb ─────────────────────────────────────────────────────

const TL = MG.trails;
const trailType = (s: MinigameSettings) =>
  TRAIL_TYPES.find((t) => t.id === s.type) ?? TRAIL_TYPES[0]!;

export const TRAILS_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Keep your hiker on the trail as it comes down the screen. Off the trail, your bar drains, and it never refills. **Empty bar and you fail.** Reach your checkpoint to pass; the next hiker takes over there.',
    ),
  rules: (s) =>
    rulesOf(
      line('If you run out, the next hiker takes over where you stopped.'),
      line('If the end isn’t reached, hikers who passed come back to finish it.'),
      trailType(s).id === 'ridgeline' &&
        line(
          'Ridgeline: the drops on both sides drain twice as fast. Scree slides you, and wind gusts push you.',
        ),
    ),
  controls: [
    {
      action: 'STEER',
      inputs: [...key('A', 'D'), OR, ...key('←', '→'), OR, mouse('Point'), OR, finger('Drag')],
    },
  ],
  chips: (s) => ['TAKE TURNS', trailType(s).name.toUpperCase()],
  ifFail: FAIL_ENERGY,
  bars(s) {
    // Trail width in steps of 4 units, so the Hiking Stick's +4 is one step.
    const width =
      TL.tiers[tierIn(s)].width * (trailType(s).id === 'ridgeline' ? TL.ridgeNarrow : 1);
    const seg = (w: number) => Math.round(w / 4);
    return [
      levelBar('speed', 'SCROLL SPEED', s, -prepNumber(s, P_('slower'))),
      countBar(
        'width',
        'TRAIL WIDTH',
        seg(width),
        seg(width + prepNumber(s, P_('width'))),
        seg(mostOver((t) => TL.tiers[t].width)) + 1,
      ),
    ];
  },
  perHiker: (s) => ({
    label: 'BAR',
    kind: 'pips',
    base: numOr(s, 'bar', TL.tiers[tierIn(s)].barSec),
    param: P_('bar'),
    step: 0.5,
    format: (v) => `${v} S`,
  }),
  options: () => [
    plusFor('0.5 S BAR', '+BAR', 'bar'),
    slowerOpt('SLOWER', 'green'),
    opt('width', 'green', item('hikingStick'), 'HIKING STICK', 'STICK', '+4 trail width', {
      param: P_('width'),
      step: 4,
    }),
  ],
};

const RC = MG.rockClimb;

export const ROCK_CLIMB_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Aim, hold for power, and let go to jump. Grab a hold in the active hand’s color. **A fall costs that hiker a try and 1 energy.** Jump up past the top line to finish.',
    ),
  rules: (s) => {
    const tries = numOr(s, 'triesEach', RC.tries);
    return rulesOf(
      line(
        `Each hiker has ${tries} tries. Out of tries, you’re out, and your holds change to other hikers’ colors.`,
      ),
      line('If everyone is out, everyone fails.'),
      RC.tiers[tierIn(s)].oneTry && line('One grab try per jump.', fromTier(3)),
    );
  },
  controls: [
    { action: 'AIM', inputs: [mouse('Point'), OR, finger('Drag')] },
    {
      action: 'JUMP',
      inputs: [mouse('Hold, let go'), OR, finger('Hold, let go'), OR, ...key('SPACE')],
    },
    { action: 'GRAB', inputs: [mouse('Click a hold'), OR, finger('Tap'), OR, ...key('SPACE')] },
  ],
  chips: () => ['TAKE TURNS'],
  ifFail: [
    { who: 'each', label: 'Each fall:', value: 'that hiker −1 try, −1 Energy' },
    { who: 'everyone', label: 'Everyone out:', value: 'everyone fails' },
  ],
  bars(s) {
    const t = RC.tiers[tierIn(s)];
    const holds = numOr(s, 'holds', t.holds);
    // Reach in steps of 2 units, so each Chalk is one step; the arrow's speed as a level.
    return [
      countBar(
        'holds',
        'HOLDS',
        holds,
        holds,
        mostOver((x) => RC.tiers[x].holds),
      ),
      countBar(
        'reach',
        'GRAB REACH',
        t.reach / 2,
        (t.reach + prepNumber(s, P_('chalk'))) / 2,
        mostOver((x) => RC.tiers[x].reach) / 2 + 2,
      ),
      levelBar('arrow', 'ARROW SPEED', s, 0),
    ];
  },
  perHiker: (s) => ({
    label: 'TRIES',
    kind: 'pips',
    base: numOr(s, 'triesEach', RC.tries),
    param: P_('tries'),
    step: 1,
  }),
  options: () => [
    opt(
      'chalk',
      'green',
      res('salt'),
      'CHALK',
      'CHALK',
      '+2 reach',
      { param: P_('chalk'), step: 2 },
      { max: 2 },
    ),
    plusFor('TRY', '+1', 'tries'),
    opt('harness', 'green', item('harness'), 'HARNESS', 'HARNESS', 'the first fall costs nothing', {
      param: P_('harness'),
      step: 1,
    }),
  ],
};
