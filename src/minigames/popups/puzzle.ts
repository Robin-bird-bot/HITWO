/**
 * The pop-up content for Puzzle and logic, Memory and Search
 * (docs/design/20-challenge-popup.md, section 7): Traildle, Find the Path,
 * Trail Map, Picture Puzzle, Thin Ice, Fake Trail Signs, Remember the Path,
 * Memory Puzzle, Safari, Crossroads and Find the Object.
 */
import { BALANCE } from '../../config/balance';
import { targetsFor } from '../findObject/logic';
import { FOOD, item, prepNumber, res } from '../prepare';
import { newSafari } from '../safari/logic';
import type { MinigameSettings } from '../types';
import {
  countBar,
  finger,
  key,
  levelBar,
  mouse,
  numOr,
  OR,
  P_,
  row,
  tapRow,
  tierIn,
  timeBar,
} from './common';
import type { GamePopup } from './types';

const MG = BALANCE.minigames;

const hikerCount = (s: MinigameSettings) => (Array.isArray(s.hikers) ? s.hikers.length : 3);
const plusSec = (sec: number) =>
  row(
    'extraSec',
    `+${sec} S`,
    `+${sec} seconds each`,
    FOOD,
    { param: P_('extraSec'), step: sec },
    { slots: 2 },
  );
const MAPS = item('supplyMap', 'treasureMap');
const LANTERN = [...res('oil'), ...item('campingLamp')];
const square = (n: number) => `${n}×${n}`;

// ── Puzzle and logic ───────────────────────────────────────────────────────

const TD = MG.traildle;

export const TRAILDLE_POPUP: GamePopup = {
  howToPlay: () => [
    {
      text: 'Guess the hidden code of digits. After each guess the signs show which digits are right, which are in the wrong spot, and which aren’t in it. ',
    },
    { text: 'Run out of guesses and you fail.', red: true },
  ],
  controls: [
    { action: 'SET', inputs: [mouse('Click or scroll'), OR, finger('Tap'), OR, ...key('↑', '↓')] },
    { action: 'MOVE', inputs: [...key('←', '→')] },
    { action: 'GUESS', inputs: [...key('ENTER'), OR, mouse('Click GO'), OR, finger('Tap GO')] },
  ],
  chips: () => ['TAKE TURNS'],
  ifFail: [],
  bars(s) {
    const t = TD.tiers[tierIn(s)];
    const timer =
      s.timer === 'off' ? null : s.timer === 'on' ? (t.timerSec ?? TD.timerOnSec) : t.timerSec;
    return [
      countBar('guesses', 'GUESSES', t.guesses, t.guesses + prepNumber(s, P_('guesses')), 10),
      ...(timer ? [timeBar('time', 'TIME', timer, timer)] : []),
    ];
  },
  prepare: () => [
    row(
      'guesses',
      '+1 GUESS',
      '+1 guess each',
      FOOD,
      { param: P_('guesses'), step: 1 },
      { slots: 2 },
    ),
    row('showDigit', 'SHOW A DIGIT', 'One sign starts solved', item('thinkingCap', 'glasses'), {
      param: P_('showDigit'),
      step: 1,
    }),
  ],
};

const FP = MG.findPath;
const findPathFog = (s: MinigameSettings) =>
  s.fog === 'on' ? true : s.fog === 'off' ? false : FP.tiers[tierIn(s)].fog;

export const FIND_PATH_POPUP: GamePopup = {
  howToPlay: () => [
    {
      text: 'A hidden trail runs from the bottom to the top. Take turns guessing it one step at a time. ',
    },
    { text: 'Wrong steps run into the trees', red: true },
    { text: ' and use up tries.' },
  ],
  controls: [{ action: 'STEP', inputs: [mouse('Click a tile'), OR, finger('Tap a tile')] }],
  chips: (s) => [
    'TAKE TURNS',
    ...(findPathFog(s) && prepNumber(s, P_('lantern')) === 0 ? ['FOG'] : []),
  ],
  ifFail: [],
  bars: (s) => [
    countBar('tries', 'TRIES', FP.triesPerTurn, FP.triesPerTurn + prepNumber(s, P_('tries')), 6),
  ],
  prepare: () => [
    row('tries', '+1 TRY', '+1 try each turn', FOOD, { param: P_('tries'), step: 1 }, { slots: 2 }),
    row('showStep', 'SHOW ONE STEP', 'One step of the trail shows', MAPS, {
      param: P_('showStep'),
      step: 1,
    }),
    row(
      'lantern',
      'LANTERN',
      'Clears the fog',
      LANTERN,
      { param: P_('lantern'), step: 1 },
      {
        onlyIf: findPathFog,
      },
    ),
  ],
};

const TM = MG.trailMap;

export const TRAIL_MAP_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Turn the trail tiles so every trailhead connects to the exit. ' },
    { text: 'Finish before the time runs out.', red: true },
  ],
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
        : [timeBar('time', 'TIME', time, time + prepNumber(s, P_('extraSec')))]),
      { ...countBar('tiles', 'TILES', size, size, 6), display: square },
    ];
  },
  prepare: () => [
    plusSec(10),
    row('route', 'ONE ROUTE SOLVED', 'One trailhead starts connected', MAPS, {
      param: P_('route'),
      step: 1,
    }),
  ],
};

const PP = MG.picturePuzzle;

export const PICTURE_PUZZLE_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Rebuild the picture from the pieces in the tray. ' },
    { text: 'Finish before the time runs out.', red: true },
  ],
  controls: [{ action: 'MOVE', inputs: [mouse('Drag a piece'), OR, finger('Drag a piece')] }],
  chips: () => ['IN PAIRS'],
  ifFail: [],
  bars(s) {
    const t = PP.tiers[tierIn(s)];
    const grid = s.grid === '4' || s.grid === '5' || s.grid === '6' ? Number(s.grid) : t.grid;
    const sec = numOr(s, 'secPerPiece', t.secPerPiece) * grid * grid;
    return [
      timeBar('time', 'TIME', sec, sec + prepNumber(s, P_('extraSec'))),
      { ...countBar('pieces', 'PIECES', grid, grid, 6), display: square },
    ];
  },
  prepare: () => [
    plusSec(10),
    row('ghost', 'GHOST PICTURE', 'A faint picture under the frame', item('camera', 'oldPhoto'), {
      param: P_('ghost'),
      step: 1,
    }),
  ],
};

const TI = MG.thinIce;

export const THIN_ICE_POPUP: GamePopup = {
  howToPlay: () => [
    {
      text: 'Holes hide under the ice. Clear the safe squares; the numbers tell you how many holes are next to each one. ',
    },
    { text: 'Step on a hole and the hiker at the front falls in.', red: true },
  ],
  controls: [
    { action: 'CLEAR', inputs: [mouse('Click'), OR, finger('Tap')] },
    { action: 'FLAG', inputs: [mouse('Right-click'), OR, ...key('F')] },
  ],
  chips: () => ['TAKE TURNS'],
  ifFail: [],
  bars(s) {
    const holes = TI.tiers[tierIn(s)].holes;
    return [countBar('holes', 'HOLES', holes, holes, Math.max(holes, 10))];
  },
  prepare: () => [
    row(
      'testIce',
      'TEST THE ICE',
      'Marks one hole before you start',
      res('stone'),
      { param: P_('testIce'), step: 1 },
      {
        slots: 3,
      },
    ),
    row('stick', 'HIKING STICK', 'Each hiker’s first hole only cracks', item('hikingStick'), {
      param: P_('stick'),
      step: 1,
    }),
  ],
};

const FS = MG.fakeSigns;

export const FAKE_SIGNS_POPUP: GamePopup = {
  howToPlay: () => [
    {
      text: 'Learn the rule, then say whether each sign is real or fake. Every round adds a rule, and the old ones still count. ',
    },
    { text: 'One wrong answer and the hiker fails.', red: true },
  ],
  controls: [
    { action: 'REAL', inputs: [mouse('Click REAL'), OR, finger('Tap REAL'), OR, ...key('R')] },
    { action: 'FAKE', inputs: [mouse('Click FAKE'), OR, finger('Tap FAKE'), OR, ...key('F')] },
  ],
  chips: () => ['TAKE TURNS'],
  ifFail: [],
  bars(s) {
    const t = FS.tiers[tierIn(s)];
    const cap = numOr(s, 'cap', t.cap);
    const signs = numOr(s, 'signs', t.signs);
    return [
      countBar('rules', 'RULES', cap, Math.max(1, cap - prepNumber(s, P_('fewerRules'))), 6),
      countBar('signs', 'SIGNS', signs, Math.max(1, signs - prepNumber(s, P_('fewerSigns'))), 6),
    ];
  },
  prepare: () => [
    row('fewerRules', '−1 RULE', 'One rule fewer', item('thinkingCap'), {
      param: P_('fewerRules'),
      step: 1,
    }),
    row('fewerSigns', '−1 SIGN A ROUND', 'One sign fewer each round', item('glasses'), {
      param: P_('fewerSigns'),
      step: 1,
    }),
    row(
      'showOld',
      'KEEP OLD RULES ON SCREEN',
      'The old rules stay up',
      item('instructionManual', 'textbook'),
      {
        param: P_('showOld'),
        step: 1,
      },
      { onlyIf: (s) => s.showOld !== 'always' && FS.tiers[tierIn(s)].hideOld },
    ),
  ],
};

// ── Memory ─────────────────────────────────────────────────────────────────

const RP = MG.rememberPath;

export const REMEMBER_PATH_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Watch the ranger walk a trail across the grid. Then walk it from memory. ' },
    { text: 'One wrong step and that hiker fails.', red: true },
  ],
  controls: [{ action: 'STEP', inputs: [mouse('Click a tile'), OR, finger('Tap a tile')] }],
  chips: () => ['ONE AT A TIME'],
  ifFail: [],
  bars(s) {
    const steps = RP.tiers[tierIn(s)].length[1];
    return [
      countBar('path', 'PATH', steps, Math.max(2, steps - prepNumber(s, P_('fewerSteps'))), 12),
      levelBar('speed', 'RANGER SPEED', s, -prepNumber(s, P_('slower'))),
    ];
  },
  prepare: () => [
    row(
      'slower',
      'SLOWER RANGER',
      '−1 speed each',
      FOOD,
      { param: P_('slower'), step: 1 },
      { slots: 2 },
    ),
    row('fewerSteps', '−1 STEP', 'One step shorter', item('supplyMap'), {
      param: P_('fewerSteps'),
      step: 1,
    }),
  ],
};

const ME = MG.memory;

export const MEMORY_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Flip two cards at a time to find the matching snacks. ' },
    { text: 'Find every pair before the time runs out.', red: true },
  ],
  controls: [{ action: 'FLIP', inputs: [mouse('Click a card'), OR, finger('Tap a card')] }],
  chips: () => ['TAKE TURNS'],
  ifFail: [],
  bars(s) {
    const t = ME.tiers[tierIn(s)];
    const time = numOr(s, 'time', t.timeSec);
    const pairs = Math.floor((t.cols * t.rows) / t.setSize);
    return [
      timeBar('time', 'TIME', time, time + prepNumber(s, P_('extraSec'))),
      countBar('pairs', t.setSize === 3 ? 'SETS' : 'PAIRS', pairs, pairs, Math.max(pairs, 12)),
    ];
  },
  prepare: () => [
    plusSec(5),
    row('peek', 'PEEK', 'Every card flips up once for 1.5 s', item('camera'), {
      param: P_('peek'),
      step: 1,
    }),
  ],
};

const SA = MG.safari;

export const SAFARI_POPUP: GamePopup = {
  howToPlay: () => [
    {
      text: 'Watch the animals come down the hill. Then answer the question together, one guess each. ',
    },
    { text: 'A wrong guess fails the hiker at the front.', red: true },
  ],
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
        16,
      ),
      countBar(
        'signs',
        'ANSWER SIGNS',
        t.signs,
        Math.max(2, t.signs - prepNumber(s, P_('binoculars'))),
        6,
      ),
    ];
  },
  prepare: () => [
    row('binoculars', 'BINOCULARS', '−1 answer sign', item('binoculars'), {
      param: P_('binoculars'),
      step: 1,
    }),
    row(
      'beam',
      'LANTERN',
      'A wider beam each',
      LANTERN,
      { param: P_('beam'), step: 10 },
      {
        slots: 2,
        onlyIf: (s) => s.version === 'night',
      },
    ),
    row('fewerAnimals', 'FEWER ANIMALS', '2 fewer animals', FOOD, {
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
  howToPlay: () => [
    { text: 'Remember the arrows. Then walk them through the crossings, one turn at a time. ' },
    { text: 'Take a wrong turn and that hiker fails.', red: true },
  ],
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
        10,
      ),
    ];
  },
  prepare: () => [
    row(
      'fewerArrows',
      '−1 ARROW',
      'One arrow fewer each',
      item('supplyMap'),
      { param: P_('fewerArrows'), step: 1 },
      {
        slots: 2,
      },
    ),
    row('peek', 'PEEK ON THE WAY', 'The arrows show for 2 s once', item('treasureMap', 'camera'), {
      param: P_('peek'),
      step: 1,
    }),
  ],
};

// ── Search ─────────────────────────────────────────────────────────────────

const FO = MG.findObject;

export const FIND_OBJECT_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'A crowd of snacks pops up. ' },
    { text: 'Find the ones you’re asked for before time runs out.', red: true },
  ],
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
    return [
      timeBar(
        'time',
        'TIME',
        time,
        time + prepNumber(s, P_('extraSec')) - per * Math.min(fewer, targets - 1),
      ),
      countBar('find', 'TO FIND', targets, Math.max(1, targets - fewer), Math.max(targets, 8)),
    ];
  },
  prepare: () => [
    plusSec(5),
    row('fewer', '−1 TO FIND', 'One snack fewer each round', item('binoculars', 'glasses'), {
      param: P_('fewer'),
      step: 1,
    }),
  ],
};
