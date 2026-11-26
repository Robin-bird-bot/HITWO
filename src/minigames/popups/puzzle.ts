/**
 * The pop-up content for Puzzle and logic, Memory and Search
 * (docs/design/20-challenge-popup.md, version 3, section 7): Traildle,
 * Find the Path, Trail Map, Picture Puzzle, Thin Ice, Fake Trail Signs,
 * Remember the Path, Memory Puzzle, Safari, Crossroads and Find the Object.
 */
import { BALANCE } from '../../config/balance';
import { isDark, isWindy, targetsFor, type Mode } from '../findObject/logic';
import { FOOD, item, prepNumber, res } from '../prepare';
import { newSafari } from '../safari/logic';
import type { MinigameSettings } from '../types';
import {
  countBar,
  finger,
  fromTier,
  hikerCount,
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
  plusSecOpt,
  rulesOf,
  slowerOpt,
  tapRow,
  tierIn,
  timeBar,
} from './common';
import type { GamePopup } from './types';

const MG = BALANCE.minigames;

const MAPS = item('supplyMap', 'treasureMap');
const LANTERN = [...res('oil'), ...item('campingLamp')];
const square = (n: number) => `${n}×${n}`;
const odd = (s: MinigameSettings) => hikerCount(s) % 2 === 1 && hikerCount(s) > 1;

// ── Puzzle and logic ───────────────────────────────────────────────────────

const TD = MG.traildle;
const traildleTimer = (s: MinigameSettings): number | null => {
  const t = TD.tiers[tierIn(s)];
  return s.timer === 'off' ? null : s.timer === 'on' ? (t.timerSec ?? TD.timerOnSec) : t.timerSec;
};

export const TRAILDLE_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Guess the hidden code of digits on the trail signs. After each guess, the signs show which digits are right, which are in the wrong spot, and which aren’t in the code. Hikers play in pairs: each has a code, and every guess goes on both boards. **Run out of guesses and you fail.**',
    ),
  rules: (s) =>
    rulesOf(
      TD.tiers[tierIn(s)].repeats && line('A digit can show up more than once.', fromTier(2)),
      traildleTimer(s) !== null &&
        line('There’s a clock too: run out of time and you fail.', fromTier(2)),
      odd(s) && line('The last hiker plays alone.'),
    ),
  controls: [
    { action: 'SET', inputs: [mouse('Click or scroll'), OR, finger('Tap'), OR, ...key('↑', '↓')] },
    { action: 'MOVE', inputs: [...key('←', '→')] },
    { action: 'GUESS', inputs: [...key('ENTER'), OR, mouse('Click GO'), OR, finger('Tap GO')] },
  ],
  chips: () => ['IN PAIRS'],
  ifFail: [],
  bars(s) {
    const t = TD.tiers[tierIn(s)];
    const signs = typeof s.signs === 'number' ? s.signs : Number(s.signs) || t.signs[1];
    const timer = traildleTimer(s);
    return [
      countBar('signs', 'SIGNS', signs, signs, 8),
      countBar(
        'guesses',
        'GUESSES',
        t.guesses,
        t.guesses + prepNumber(s, P_('guesses')),
        mostOver((x) => TD.tiers[x].guesses) + 2,
      ),
      ...(timer ? [timeBar('time', 'TIME', timer, timer, TD.timerOnSec)] : []),
    ];
  },
  options: () => [
    opt(
      'guesses',
      'green',
      FOOD,
      '+1 GUESS',
      '+1 GUESS',
      'one more guess',
      { param: P_('guesses'), step: 1 },
      { max: 2 },
    ),
    opt(
      'showDigit',
      'blue',
      item('thinkingCap', 'glasses'),
      'SHOW A DIGIT',
      'DIGIT',
      'one sign starts solved',
      { param: P_('showDigit'), step: 1 },
    ),
  ],
};

const FP = MG.findPath;
const findPathFog = (s: MinigameSettings) =>
  s.fog === 'on' ? true : s.fog === 'off' ? false : FP.tiers[tierIn(s)].fog;

export const FIND_PATH_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'A hidden trail runs from the bottom of the forest to the top. Take turns picking the next step: up, left or right. A right step moves you on for free. **Wrong steps turn into trees and use up a try.**',
    ),
  rules: (s) =>
    rulesOf(
      line('Out of tries: you go to the back of the line, and the party loses an attempt.'),
      line(`The first hiker through gets +${FP.energy} energy. The rest then walk the trail.`),
      findPathFog(s) &&
        prepNumber(s, P_('lantern')) === 0 &&
        line(`Fog: only your last ${FP.fogPicks} picks stay visible.`),
    ),
  controls: [{ action: 'STEP', inputs: [mouse('Click a tile'), OR, finger('Tap a tile')] }],
  chips: (s) => [
    'TAKE TURNS',
    ...(findPathFog(s) && prepNumber(s, P_('lantern')) === 0 ? ['FOG'] : []),
  ],
  ifFail: [],
  bars(s) {
    const n = hikerCount(s);
    const attempts = FP.attempts + FP.attemptsPerExtraHiker * (n - 1);
    return [
      countBar(
        'tries',
        'TRIES',
        FP.triesPerTurn,
        FP.triesPerTurn + prepNumber(s, P_('tries')),
        FP.triesPerTurn + 2,
      ),
      countBar(
        'attempts',
        'ATTEMPTS',
        attempts,
        attempts,
        FP.attempts + FP.attemptsPerExtraHiker * 5,
      ),
    ];
  },
  options: () => [
    opt(
      'tries',
      'green',
      FOOD,
      '+1 TRY',
      '+1 TRY',
      'one more try each turn',
      { param: P_('tries'), step: 1 },
      { max: 2 },
    ),
    opt('showStep', 'blue', MAPS, 'SHOW ONE STEP', 'STEP', 'one step of the trail shows', {
      param: P_('showStep'),
      step: 1,
    }),
    opt(
      'lantern',
      'blue',
      LANTERN,
      'LANTERN',
      'LIGHT',
      'clears the fog',
      { param: P_('lantern'), step: 1 },
      {
        onlyIf: findPathFog,
      },
    ),
  ],
};

const TM = MG.trailMap;
const trailMapSigns = (s: MinigameSettings) => numOr(s, 'signs', TM.tiers[tierIn(s)].signs);

export const TRAIL_MAP_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Turn the trail tiles so every hiker’s trailhead connects to the exit, all at the same time. **Finish before the time runs out,** or everyone fails.',
    ),
  rules: (s) =>
    rulesOf(
      trailMapSigns(s) > 0 && line('The trails must pass through every sign, too.', fromTier(2)),
      TM.tiers[tierIn(s)].locked > 0 &&
        line('Locked tiles are already turned the right way.', fromTier(2)),
    ),
  controls: [
    { action: 'TURN', inputs: [mouse('Click'), OR, finger('Tap')] },
    { action: 'TURN BACK', inputs: [mouse('Right-click')] },
  ],
  chips: () => ['ALL TOGETHER'],
  ifFail: [],
  bars(s) {
    const t = TM.tiers[tierIn(s)];
    const size = numOr(s, 'grid', t.size);
    const time = numOr(s, 'time', t.timeSec);
    return [
      ...(s.time === 'off'
        ? []
        : [
            timeBar(
              'time',
              'TIME',
              time,
              time + prepNumber(s, P_('extraSec')),
              mostOver((x) => TM.tiers[x].timeSec),
            ),
          ]),
      { ...countBar('tiles', 'TILES', size, size, 6), display: square },
    ];
  },
  options: () => [
    plusSecOpt(10),
    opt('route', 'blue', MAPS, 'ONE ROUTE SOLVED', 'ROUTE', 'one trailhead starts connected', {
      param: P_('route'),
      step: 1,
    }),
  ],
};

const PP = MG.picturePuzzle;

export const PICTURE_PUZZLE_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Rebuild your picture from the piles in the tray. Only the top piece of a pile can be taken. Hikers play in pairs and share one tray. **Finish before the time runs out.**',
    ),
  rules: (s) =>
    rulesOf(
      line('Putting a piece in its right spot for the first time adds time.'),
      tierIn(s) === 1 && line('A piece in its right spot locks.', 'TIER I'),
      odd(s) && line('The last hiker plays alone.'),
    ),
  controls: [{ action: 'MOVE', inputs: [mouse('Drag a piece'), OR, finger('Drag a piece')] }],
  chips: () => ['IN PAIRS'],
  ifFail: [],
  bars(s) {
    const t = PP.tiers[tierIn(s)];
    const grid = s.grid === '4' || s.grid === '5' || s.grid === '6' ? Number(s.grid) : t.grid;
    const sec = numOr(s, 'secPerPiece', t.secPerPiece) * grid * grid;
    return [
      timeBar(
        'time',
        'TIME',
        sec,
        sec + prepNumber(s, P_('extraSec')),
        mostOver((x) => PP.tiers[x].secPerPiece * PP.tiers[x].grid ** 2),
      ),
      { ...countBar('pieces', 'PIECES', grid, grid, 6), display: square },
    ];
  },
  options: () => [
    plusSecOpt(10),
    opt(
      'ghost',
      'blue',
      item('camera', 'oldPhoto'),
      'GHOST PICTURE',
      'GHOST',
      'a faint picture under the frame',
      { param: P_('ghost'), step: 1 },
    ),
  ],
};

const TI = MG.thinIce;
const thinIceTimer = (s: MinigameSettings): number | null =>
  s.timer === 'off' ? null : typeof s.timer === 'number' ? s.timer : TI.tiers[tierIn(s)].timerSec;

export const THIN_ICE_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Holes hide under the ice. Check the safe squares: each number tells you how many holes touch it. The first check is always safe. **Step on a hole and the hiker at the front falls in.**',
    ),
  rules: (s) =>
    rulesOf(
      line('Flag a square you think is a hole so it can’t be checked by mistake.'),
      line('Clear every safe square to pass. Hikers who fell in fail.'),
      thinIceTimer(s) !== null &&
        line('There’s a clock: when it runs out, everyone still in fails.', fromTier(2)),
    ),
  controls: [
    { action: 'CHECK', inputs: [mouse('Click'), OR, finger('Tap')] },
    { action: 'FLAG', inputs: [mouse('Right-click'), OR, ...key('F')] },
  ],
  chips: () => ['TAKE TURNS'],
  ifFail: [],
  bars(s) {
    const holes = TI.tiers[tierIn(s)].holes;
    const timer = thinIceTimer(s);
    return [
      countBar(
        'holes',
        'HOLES',
        holes,
        holes,
        mostOver((x) => TI.tiers[x].holes),
      ),
      ...(timer
        ? [
            timeBar(
              'time',
              'TIME',
              timer,
              timer,
              mostOver((x) => TI.tiers[x].timerSec ?? 0),
            ),
          ]
        : []),
    ];
  },
  options: () => [
    opt(
      'testIce',
      'blue',
      res('stone'),
      'TEST THE ICE',
      'TESTED',
      'marks one hole before you start',
      { param: P_('testIce'), step: 1 },
      { max: 3 },
    ),
    opt(
      'stick',
      'green',
      item('hikingStick'),
      'HIKING STICK',
      'STICK',
      'each hiker’s first hole only cracks',
      { param: P_('stick'), step: 1 },
    ),
  ],
};

const FS = MG.fakeSigns;
const hidesOld = (s: MinigameSettings) =>
  s.showOld === 'never' ||
  (s.showOld !== 'always' && FS.tiers[tierIn(s)].hideOld && prepNumber(s, P_('showOld')) === 0);

export const FAKE_SIGNS_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Learn the rule, then call each sign REAL or FAKE. Real signs follow every rule; a fake breaks one. Each hiker plays a round, and every pass adds a rule. **One wrong answer and that hiker fails.**',
    ),
  rules: (s) =>
    rulesOf(
      line('The old rules still count.'),
      hidesOld(s) && line('Only the newest rule is shown. Remember the rest!', fromTier(4)),
    ),
  controls: [
    { action: 'REAL', inputs: [mouse('Click REAL'), OR, finger('Tap REAL'), OR, ...key('R')] },
    { action: 'FAKE', inputs: [mouse('Click FAKE'), OR, finger('Tap FAKE'), OR, ...key('F')] },
  ],
  chips: () => ['ONE AT A TIME'],
  ifFail: [],
  bars(s) {
    const t = FS.tiers[tierIn(s)];
    const cap = numOr(s, 'cap', t.cap);
    const signs = numOr(s, 'signs', t.signs);
    return [
      countBar(
        'rules',
        'RULES',
        cap,
        Math.max(1, cap - prepNumber(s, P_('fewerRules'))),
        mostOver((x) => FS.tiers[x].cap),
      ),
      countBar(
        'signs',
        'SIGNS',
        signs,
        Math.max(1, signs - prepNumber(s, P_('fewerSigns'))),
        mostOver((x) => FS.tiers[x].signs),
      ),
    ];
  },
  options: () => [
    opt('fewerRules', 'red', item('thinkingCap'), '−1 RULE', '−1 RULE', 'one rule fewer', {
      param: P_('fewerRules'),
      step: 1,
    }),
    opt(
      'fewerSigns',
      'red',
      item('glasses'),
      '−1 SIGN A ROUND',
      '−1 SIGN',
      'one sign fewer each round',
      { param: P_('fewerSigns'), step: 1 },
    ),
    opt(
      'showOld',
      'blue',
      item('instructionManual', 'textbook'),
      'KEEP OLD RULES ON SCREEN',
      'RULES',
      'the old rules stay up',
      { param: P_('showOld'), step: 1 },
      {
        onlyIf: (s) => s.showOld !== 'always' && FS.tiers[tierIn(s)].hideOld,
      },
    ),
  ],
};

// ── Memory ─────────────────────────────────────────────────────────────────

const RP = MG.rememberPath;

export const REMEMBER_PATH_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Watch the ranger walk a trail across the grid, then walk it from memory. Each hiker gets a new path. **Run out of strikes and that hiker fails.**',
    ),
  rules: () =>
    rulesOf(line('Paths can go up, down, left or right, but never back over themselves.')),
  controls: [{ action: 'STEP', inputs: [mouse('Click a tile'), OR, finger('Tap a tile')] }],
  chips: () => ['ONE AT A TIME'],
  ifFail: [],
  bars(s) {
    const t = RP.tiers[tierIn(s)];
    return [
      countBar(
        'path',
        'PATH',
        t.length[1],
        Math.max(2, t.length[1] - prepNumber(s, P_('fewerSteps'))),
        mostOver((x) => RP.tiers[x].length[1]),
      ),
      levelBar('speed', 'RANGER SPEED', s, -prepNumber(s, P_('slower'))),
      countBar(
        'strikes',
        'STRIKES',
        t.strikes,
        t.strikes,
        mostOver((x) => RP.tiers[x].strikes),
      ),
    ];
  },
  options: () => [
    slowerOpt('SLOWER RANGER', 'red'),
    opt('fewerSteps', 'red', item('supplyMap'), '−1 STEP', '−1 STEP', 'one step shorter', {
      param: P_('fewerSteps'),
      step: 1,
    }),
  ],
};

const ME = MG.memory;
const memoryTier = (s: MinigameSettings) => ME.tiers[tierIn(s)];
const threes = (s: MinigameSettings) =>
  s.match === 'threes' || (s.match !== 'pairs' && memoryTier(s).setSize === 3);

export const MEMORY_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Flip cards to find matching snacks. Each hiker’s sets are in their color. A match adds time. **When the time runs out, anyone with a set left fails.**',
    ),
  rules: (s) => {
    const t = memoryTier(s);
    const swaps = s.swaps === 'off' ? false : s.swaps === 'on' || t.swaps > 0;
    return rulesOf(
      t.missSec > 0 && line('A miss takes time away.', fromTier(2)),
      swaps && line('Some cards swap places before you start.', fromTier(2)),
      swaps && t.swapsPerMiss > 0 && line('Another swap comes after every miss.', fromTier(3)),
      threes(s) && line('Some snacks come in threes.'),
    );
  },
  controls: [{ action: 'FLIP', inputs: [mouse('Click a card'), OR, finger('Tap a card')] }],
  chips: () => ['ALL TOGETHER'],
  ifFail: [],
  bars(s) {
    const t = memoryTier(s);
    const time = numOr(s, 'time', t.timeSec);
    const sets = Math.floor((t.cols * t.rows) / (threes(s) ? 3 : 2));
    return [
      timeBar(
        'time',
        'TIME',
        time,
        time + prepNumber(s, P_('extraSec')),
        mostOver((x) => ME.tiers[x].timeSec),
      ),
      countBar(
        'sets',
        'SETS',
        sets,
        sets,
        mostOver((x) => Math.floor((ME.tiers[x].cols * ME.tiers[x].rows) / ME.tiers[x].setSize)),
      ),
    ];
  },
  options: () => [
    plusSecOpt(5),
    opt('peek', 'blue', item('camera'), 'PEEK', 'PEEK', 'every card flips up once for 1.5 s', {
      param: P_('peek'),
      step: 1,
    }),
  ],
};

const SA = MG.safari;
const safariNight = (s: MinigameSettings) => s.version === 'night';

export const SAFARI_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Watch the animals come down the hill. Then the hiker at the front picks the answer to the question. **A wrong guess fails that hiker,** and the next one guesses. A right guess passes them and everyone after them.',
    ),
  rules: (s) =>
    rulesOf(
      (s.questions === '2' || (s.questions !== '1' && hikerCount(s) >= 3)) &&
        line(
          'There are two questions, as a relay: a right answer on the first passes only that hiker, and the rest answer the second.',
        ),
      safariNight(s) && line('It’s night: move the flashlight to see.'),
    ),
  controls: [
    { action: 'LIGHT', inputs: [mouse('Point'), OR, ...key('A', 'D'), OR, ...key('←', '→')] },
    { action: 'ANSWER', inputs: [mouse('Click a sign'), OR, finger('Tap a sign')] },
  ],
  chips: (s) => [
    'ALL TOGETHER',
    ...(s.version === 'night' ? ['NIGHT'] : s.version === 'fog' ? ['FOG'] : []),
  ],
  ifFail: [],
  bars(s) {
    const t = SA.tiers[tierIn(s)];
    return [
      countBar(
        'animals',
        'ANIMALS',
        t.animals,
        Math.max(3, t.animals - prepNumber(s, P_('fewerAnimals'))),
        mostOver((x) => SA.tiers[x].animals),
      ),
      countBar(
        'signs',
        'ANSWER SIGNS',
        t.signs,
        Math.max(2, t.signs - prepNumber(s, P_('binoculars'))),
        mostOver((x) => SA.tiers[x].signs),
      ),
    ];
  },
  options: () => [
    opt('binoculars', 'red', item('binoculars'), 'BINOCULARS', '−1 SIGN', 'one answer sign fewer', {
      param: P_('binoculars'),
      step: 1,
    }),
    opt(
      'beam',
      'blue',
      LANTERN,
      'LANTERN',
      'LIGHT',
      'a wider beam',
      { param: P_('beam'), step: 10 },
      {
        max: 2,
        onlyIf: safariNight,
      },
    ),
    opt('fewerAnimals', 'red', FOOD, '−2 ANIMALS', '−2', 'two fewer animals', {
      param: P_('fewerAnimals'),
      step: 2,
    }),
  ],
  // Night and fog come by chance: decided by the run's seed, as the game does.
  version(s, seed): MinigameSettings {
    if (s.version === 'day' || s.version === 'night' || s.version === 'fog') return {};
    const run = newSafari({ tier: tierIn(s), version: 'auto' }, ['a'], seed).run;
    return { version: run.night ? 'night' : run.fog ? 'fog' : 'day' };
  },
};

const CR = MG.crossroads;

export const CROSSROADS_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Remember the arrows, then walk them through the trail crossings, one turn at a time. Each hiker walks the whole way. **Take a wrong turn and that hiker fails.**',
    ),
  rules: (s) =>
    rulesOf(
      s.newArrows === 'on' && line('Each hiker gets new arrows.'),
      typeof s.turn === 'number' && line(`You have ${s.turn} seconds for each turn.`),
    ),
  controls: [{ action: 'WALK', inputs: [mouse('Click a way'), OR, finger('Tap a way')] }],
  chips: () => ['ONE AT A TIME'],
  ifFail: [],
  bars(s) {
    const arrows = numOr(s, 'arrows', CR.arrows[tierIn(s)]);
    return [
      countBar(
        'arrows',
        'ARROWS',
        arrows,
        Math.max(2, arrows - prepNumber(s, P_('fewerArrows'))),
        mostOver((x) => CR.arrows[x]),
      ),
    ];
  },
  options: () => [
    opt(
      'fewerArrows',
      'red',
      item('supplyMap'),
      '−1 ARROW',
      '−1',
      'one arrow fewer',
      { param: P_('fewerArrows'), step: 1 },
      { max: 2 },
    ),
    opt(
      'peek',
      'blue',
      item('treasureMap', 'camera'),
      'PEEK ON THE WAY',
      'PEEK',
      'the arrows show again for 2 s, once',
      { param: P_('peek'), step: 1 },
    ),
  ],
};

// ── Search ─────────────────────────────────────────────────────────────────

const FO = MG.findObject;
const findMode = (s: MinigameSettings): Mode => {
  const m = s.mode;
  return m === 'still' || m === 'windy' || m === 'dark' || m === 'darkWindy'
    ? m
    : FO.tiers[tierIn(s)].mode;
};

export const FIND_OBJECT_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'A crowd of snacks pops up. Find the ones you’re asked for before time runs out; a wrong click costs time. **Each snack still missing at the end of a round puts a hiker out,** from the back of the line.',
    ),
  rules: (s) =>
    rulesOf(
      line('Each round asks for one more snack.'),
      isWindy(findMode(s)) && line('Wind: everything drifts across the screen.', fromTier(2)),
      isDark(findMode(s)) && line('Dark: only what’s under your flashlight can be seen.'),
    ),
  controls: [tapRow('FIND')],
  chips: () => ['ALL TOGETHER'],
  ifFail: [],
  bars(s) {
    const tier = tierIn(s);
    const targets = targetsFor(hikerCount(s), 1, tier);
    const fewer = prepNumber(s, P_('fewer'));
    const per = numOr(s, 'secPerTarget', FO.tiers[tier].secPerTarget);
    const extra = numOr(s, 'extraSec', FO.tiers[tier].extraSecPerRound);
    const time = extra + per * targets;
    const rounds = numOr(s, 'rounds', FO.rounds);
    return [
      timeBar(
        'time',
        'TIME',
        time,
        time + prepNumber(s, P_('extraSec')) - per * Math.min(fewer, targets - 1),
        40,
      ),
      countBar('find', 'TO FIND', targets, Math.max(1, targets - fewer), 8),
      countBar('rounds', 'ROUNDS', rounds, rounds, 5),
    ];
  },
  options: () => [
    plusSecOpt(5),
    opt(
      'fewer',
      'red',
      item('binoculars', 'glasses'),
      '−1 TO FIND',
      '−1',
      'one snack fewer each round',
      { param: P_('fewer'), step: 1 },
    ),
  ],
};
