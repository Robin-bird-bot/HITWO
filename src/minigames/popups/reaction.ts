/**
 * The pop-up content for Reaction and timing, and Guess and luck
 * (docs/design/20-challenge-popup.md, version 3, section 7): Trail Blocks,
 * Sleeping Bear, Whackoon, Trail Blazes, Firefly Catch, Size Up, Fly
 * Swatter and Raccoon Shuffle.
 */
import { BALANCE } from '../../config/balance';
import { category, FOOD, item, prepNumber } from '../prepare';
import { newRaccoonShuffle } from '../raccoonShuffle/logic';
import { VERSIONS as BLOCK_VERSIONS } from '../trailBlocks/logic';
import type { MinigameSettings } from '../types';
import {
  countBar,
  FAIL_ENERGY,
  FAIL_PASSING,
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
  seconds,
  slowerOpt,
  slowerShare,
  tapRow,
  tierIn,
  timeBar,
} from './common';
import type { Bar, GamePopup } from './types';

const MG = BALANCE.minigames;
const PR = MG.prepare;

/** A level bar for something bigger being easier: high at Tier I, low at Tier V; Prepare adds. */
function sizeBar(id: string, label: string, s: MinigameSettings, change: number): Bar {
  const base = PR.levels + 1 - Math.min(PR.levels, tierIn(s) + PR.levelFromTier);
  return {
    id,
    label,
    kind: 'level',
    base,
    value: Math.min(PR.levels, base + change),
    max: PR.levels,
  };
}

// ── Raccoon Shuffle ────────────────────────────────────────────────────────

const RS = MG.raccoonShuffle;

export const RACCOON_SHUFFLE_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Raccoons hide in most of the bins, each holding a card with what it would steal from you. Watch the empty bins, follow them through the shuffle, then pick one. **Pick a raccoon and it steals from you.** One hiker at a time, each with their own shuffle.',
    ),
  rules(s) {
    const t = RS.tiers[tierIn(s)];
    const empty = t.empty + prepNumber(s, P_('lure'));
    return rulesOf(
      t.fake > 0 &&
        line('Some swaps are fake-outs: two bins start to cross, then go back.', fromTier(2)),
      t.double > 0 && line('Two pairs of bins can swap at once.', fromTier(2)),
      t.takeAway > 0 &&
        line(
          `There are ${empty} empty bins, but at the end a raccoon takes ${t.takeAway} of them away. Follow them all.`,
          fromTier(3),
        ),
      s.night === 'on' && line('It’s dark: only the circle around your pointer is lit.'),
    );
  },
  controls: [
    {
      action: 'PICK',
      inputs: [mouse('Click a bin'), OR, finger('Tap a bin'), OR, ...key('←', '→', 'SPACE')],
    },
  ],
  chips: (s) => ['ONE AT A TIME', ...(s.night === 'on' ? ['NIGHT'] : [])],
  ifFail: [
    { who: 'each', label: 'Each hiker who picks a raccoon:', value: 'it steals from their pack' },
  ],
  bars(s) {
    const t = RS.tiers[tierIn(s)];
    const empty = Math.min(t.bins - 1, t.empty + prepNumber(s, P_('lure')));
    return [
      countBar(
        'bins',
        'BINS',
        t.bins,
        t.bins,
        mostOver((x) => RS.tiers[x].bins),
      ),
      countBar('empty', 'EMPTY BINS', t.empty, empty, mostOver((x) => RS.tiers[x].empty) + 2),
      countBar(
        'swaps',
        'SWAPS',
        t.swaps,
        t.swaps,
        mostOver((x) => RS.tiers[x].swaps),
      ),
      ...(t.takeAway > 0
        ? [
            countBar(
              'taken',
              'TAKEN AWAY',
              t.takeAway,
              t.takeAway,
              mostOver((x) => RS.tiers[x].takeAway),
            ),
          ]
        : []),
    ];
  },
  options: () => [
    opt(
      'lure',
      'red',
      category('trinkets'),
      'LURE ONE OUT',
      '+1 BIN',
      '+1 empty bin (never taken)',
      { param: P_('lure'), step: 1 },
      {
        max: 2,
        title: 'SHINY LURE',
      },
    ),
    opt(
      'slowShuffle',
      'red',
      FOOD,
      'SLOWER SHUFFLE',
      'SLOW',
      '+0.06 s a swap',
      { param: P_('slowShuffle'), step: 0.06 },
      {
        max: 2,
      },
    ),
  ],
  // Night comes by chance from Tier III: decided by the run's seed, as the game does.
  version(s, seed): MinigameSettings {
    if (s.night === 'on' || s.night === 'off') return {};
    const night = newRaccoonShuffle(
      { tier: tierIn(s), night: 'auto', packs: {} },
      ['a'],
      seed,
    ).night;
    return { night: night ? 'on' : 'off' };
  },
};

// ── Trail Blocks ───────────────────────────────────────────────────────────

const TB = MG.trailBlocks;
const blockVersion = (s: MinigameSettings) =>
  BLOCK_VERSIONS.find((v) => v.id === s.version) ?? BLOCK_VERSIONS[0]!;

const HOW_BY_VERSION: Readonly<Record<string, string>> = {
  chop: 'Tap when the marker is in a green zone. The closer to the edge, the stronger the swing. **Misses and weak swings cost energy.**',
  rockslide:
    'Hold to fill the power bar, and let go in the green zone. The middle of the zone hits hardest. **Misses and weak swings cost energy.**',
  river: 'Tap when the marker is on a green spot to scoop the water. **Misses cost energy.**',
  animals:
    'Whistle when the shrinking circle’s edge is in the ring. **Too early or too late costs energy.**',
};

/** BRING AN AXE and the like: half the work. */
const halfWork = (id: string, label: string, thing: string, note = 'half the work') =>
  opt(id, 'red', item(thing), label, '½ WORK', note, { param: P_('lessWork'), step: 0.5 });
/** SHARPEN and the like: bigger zones. */
const biggerZones = (id: string, label: string, note = 'bigger zones') =>
  opt(
    id,
    'green',
    category('building'),
    label,
    'BIGGER',
    note,
    { param: P_('zones'), step: 1 },
    { max: 2, title: 'BETTER GRIP' },
  );

export const TRAIL_BLOCKS_POPUP: GamePopup = {
  howToPlay: (s) => phrases(HOW_BY_VERSION[blockVersion(s).id] ?? HOW_BY_VERSION.chop!),
  rules: () =>
    rulesOf(
      line(
        'Each hiker has a share of energy. When yours runs out, the next hiker takes over, and the work done stays.',
      ),
      line('A perfect hit gives a little energy back.'),
      line('If everyone runs out first, nobody gets past.'),
    ),
  controls: [tapRow('TAP', 'SPACE')],
  chips: (s) => ['TAKE TURNS', blockVersion(s).name.toUpperCase()],
  ifFail: FAIL_PASSING,
  bars(s) {
    const w = TB.work[tierIn(s)];
    const total = (w.base + w.perHiker * hikerCount(s)) / TB.chunk;
    const left = total * (1 - Math.min(0.9, prepNumber(s, P_('lessWork'))));
    const most = (TB.work[5].base + TB.work[5].perHiker * 6) / TB.chunk;
    return [
      countBar('work', 'WORK', Math.round(total), Math.max(1, Math.round(left)), Math.round(most)),
      sizeBar(
        'zones',
        blockVersion(s).id === 'animals' ? 'RING' : 'ZONES',
        s,
        prepNumber(s, P_('zones')),
      ),
    ];
  },
  options(s) {
    // SNACK, every version (24-challenges-reset.md, section 5): a bigger energy chunk each.
    const snack = opt(
      'snack',
      'green',
      FOOD,
      'SNACK',
      'SNACK',
      `each energy chunk ${Math.round(TB.snack * 100)}% bigger`,
      { param: P_('snack'), step: 1 },
      { max: 2 },
    );
    switch (blockVersion(s).id) {
      case 'chop':
        return [
          snack,
          biggerZones('sharpen', 'SHARPEN'),
          halfWork('axe', 'BRING AN AXE', 'woodcuttingAxe'),
        ];
      case 'rockslide':
        return [
          snack,
          halfWork('pickaxe', 'BRING A PICKAXE', 'pickaxe'),
          biggerZones('wedges', 'WEDGES'),
        ];
      case 'river':
        return [
          snack,
          halfWork('ditch', 'DIG A DITCH', 'shovel', 'half the water'),
          biggerZones('patch', 'PATCH THE BUCKET'),
        ];
      case 'animals':
        return [
          snack,
          opt(
            'bait',
            'red',
            FOOD,
            'BAIT',
            '−1',
            'one animal fewer',
            { param: P_('bait'), step: 1 },
            { max: 2 },
          ),
          biggerZones('ring', 'BIGGER RING', 'a bigger ring'),
        ];
    }
  },
};

// ── Sleeping Bear, Whackoon ────────────────────────────────────────────────

const SB = MG.sleepingBear;

export const SLEEPING_BEAR_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'One at a time, sneak from the post to the flag while the bear sleeps. Hold to walk, and let go when he stirs. **Move while he’s awake and you’re caught.**',
    ),
  rules: (s) =>
    rulesOf(
      line('Caught: you lose a resource and start Bleeding.'),
      line('The party shares one clock. When it runs out, anyone not across fails.'),
      s.fakeOuts !== 'off' &&
        (s.fakeOuts === 'on' || SB.tiers[tierIn(s)].fakeOut > 0) &&
        line('Sometimes he stirs and goes back to sleep. Don’t fall for it.', fromTier(2)),
    ),
  controls: [
    { action: 'SNEAK', inputs: [mouse('Hold'), OR, finger('Hold'), OR, ...key('SPACE')] },
    { action: 'FREEZE', inputs: [mouse('Let go'), OR, finger('Let go')] },
  ],
  chips: (s) => [
    seconds(SB.tiers[tierIn(s)].secPerHiker * hikerCount(s) + prepNumber(s, P_('extraSec'))),
    'ONE AT A TIME',
  ],
  ifFail: [
    { who: 'each', label: 'Each hiker caught:', value: '−1 resource, Bleeding' },
    { who: 'everyone', label: 'Out of time:', value: '−1 Energy each' },
  ],
  bars(s) {
    const clock = SB.tiers[tierIn(s)].secPerHiker * hikerCount(s);
    return [
      timeBar(
        'clock',
        'CLOCK',
        clock,
        clock + prepNumber(s, P_('extraSec')),
        SB.tiers[1].secPerHiker * 6,
      ),
      levelBar('sleeper', 'LIGHT SLEEPER', s, -prepNumber(s, P_('quiet'))),
    ];
  },
  options: () => [
    plusSecOpt(10),
    opt(
      'quiet',
      'red',
      category('fiber'),
      'QUIET STEPS',
      'QUIET',
      '−1 light sleeper',
      { param: P_('quiet'), step: 1 },
      { max: 2 },
    ),
    opt(
      'skip',
      'red',
      item('bearSpray'),
      'SKIP IT',
      'SKIP',
      'sneak past without playing',
      { param: P_('skip'), step: 1 },
      {
        need: 2,
        skip: true,
      },
    ),
  ],
};

const WH = MG.whackoon;
const whacksEach = (s: MinigameSettings) => WH.tiers[tierIn(s)].target;

export const WHACKOON_POPUP: GamePopup = {
  howToPlay: (s) =>
    phrases(
      `Everyone plays at once. Whack the raccoons wearing your color’s mask until you have ${whacksEach(s)}. **Leave the skunks alone:** they fog the cans and take time off the clock.`,
    ),
  rules: () =>
    rulesOf(
      line('Done hikers’ raccoons keep popping up. Whacking one wastes a moment.'),
      line('Short of your whacks when time runs out: you fail and lose energy.'),
    ),
  controls: [tapRow('WHACK')],
  chips: (s) => [seconds(WH.secPerHiker * hikerCount(s)), 'ALL TOGETHER'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const time = WH.secPerHiker * hikerCount(s);
    return [
      timeBar('time', 'TIME', time, time, WH.secPerHiker * 6),
      levelBar('speed', 'POP-UP SPEED', s, -prepNumber(s, P_('slower'))),
      countBar(
        'whacks',
        'WHACKS EACH',
        whacksEach(s),
        Math.max(1, whacksEach(s) - prepNumber(s, P_('bait'))),
        mostOver((x) => WH.tiers[x].target),
      ),
    ];
  },
  options: () => [
    slowerOpt('SLOWER RACCOONS'),
    opt(
      'bait',
      'red',
      category('trinkets'),
      '−1 WHACK EACH',
      '−1',
      'one whack fewer each',
      { param: P_('bait'), step: 1 },
      { title: 'SHINY BAIT' },
    ),
    opt(
      'noSkunks',
      'red',
      category('fire'),
      'NO SKUNKS',
      'NO SKUNK',
      'only raccoons pop up',
      { param: P_('noSkunks'), step: 1 },
      {
        title: 'SMOKE THEM OUT',
        onlyIf: (s) => s.skunks === 'on' || (s.skunks !== 'off' && WH.tiers[tierIn(s)].skunks > 0),
      },
    ),
  ],
};

// ── The quick games ────────────────────────────────────────────────────────

const TBZ = MG.trailBlazes;

export const TRAIL_BLAZES_POPUP: GamePopup = {
  howToPlay(s) {
    const tries = numOr(s, 'tries', TBZ.tiers[tierIn(s)].tries);
    return s.mode === 'clock'
      ? phrases(
          'Two trunks slide past each other. Tap when the two lit blazes are level. One hiker at a time. **Run out of time and you fail.**',
        )
      : phrases(
          `Two trunks slide past each other. Tap when the two lit blazes are level. One hiker at a time. **${tries} misses and you fail.**`,
        );
  },
  rules(s) {
    const t = TBZ.tiers[tierIn(s)];
    return rulesOf(
      line('Letting the lit pair pass each other counts as a miss.'),
      t.change > 0 && line('Each pair can change the trunks’ speeds.', fromTier(3)),
      t.wobble > 0 && line('The trunks wobble as they get close.', 'TIER V'),
      s.mode === 'clock' &&
        line(`A miss costs ${TBZ.missCostSec} seconds, and you fail when time runs out.`),
    );
  },
  controls: [tapRow('TAP', 'SPACE')],
  chips: () => ['ONE AT A TIME'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const level = TBZ.tiers[tierIn(s)].level;
    return [
      levelBar('speed', 'TRUNK SPEED', s, -prepNumber(s, P_('slower'))),
      countBar(
        'window',
        'LEVEL WINDOW',
        level,
        level + prepNumber(s, P_('brighter')),
        mostOver((x) => TBZ.tiers[x].level) + 2,
      ),
    ];
  },
  perHiker: (s) =>
    s.mode === 'clock'
      ? null
      : {
          label: 'TRIES',
          kind: 'pips',
          base: numOr(s, 'tries', TBZ.tiers[tierIn(s)].tries),
          param: P_('tries'),
          step: 1,
        },
  options: () => [
    slowerOpt('SLOWER TRUNKS'),
    opt(
      'tries',
      'green',
      category('trinkets'),
      '+1 TRY',
      '+1',
      'pick a hiker',
      { param: P_('tries'), step: 1 },
      { perHiker: true, title: 'LUCKY CHARM', onlyIf: (s) => s.mode !== 'clock' },
    ),
    opt(
      'brighter',
      'green',
      category('fire'),
      'BRIGHTER PAINT',
      'BRIGHT',
      '+1 window',
      { param: P_('brighter'), step: 1 },
      { max: 2 },
    ),
  ],
};

const FC = MG.fireflyCatch;

export const FIREFLY_CATCH_POPUP: GamePopup = {
  howToPlay: (s) => {
    const n = numOr(s, 'catches', FC.tiers[tierIn(s)].catches);
    return phrases(
      `Tap when the firefly is inside your jar ring. Both of them move. One hiker at a time. **Catch ${n} before your time runs out.**`,
    );
  },
  rules(s) {
    const t = FC.tiers[tierIn(s)];
    return rulesOf(
      t.missSec > 0 &&
        line(`A miss costs ${t.missSec} second${t.missSec === 1 ? '' : 's'}.`, fromTier(2)),
      t.darkSec > 0 &&
        line('The firefly goes dark now and then. You can still catch it.', fromTier(3)),
    );
  },
  controls: [tapRow('TAP', 'SPACE')],
  chips: (s) => [seconds(numOr(s, 'time', FC.tiers[tierIn(s)].timeSec)), 'ONE AT A TIME'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = FC.tiers[tierIn(s)];
    const time = numOr(s, 'time', t.timeSec);
    // The ring in steps of 3 units, so each Bigger Jar is one step.
    return [
      countBar(
        'ring',
        'RING SIZE',
        Math.round(t.ring / 3),
        Math.round((t.ring + prepNumber(s, P_('ring'))) / 3),
        Math.round(mostOver((x) => FC.tiers[x].ring) / 3) + 2,
      ),
      levelBar('speed', 'FIREFLY SPEED', s, -prepNumber(s, P_('slower'))),
      timeBar(
        'time',
        'TIME',
        time,
        time,
        mostOver((x) => FC.tiers[x].timeSec),
      ),
    ];
  },
  options: () => [
    opt(
      'ring',
      'green',
      category('building'),
      'BIGGER JAR',
      'JAR',
      '+3 ring',
      { param: P_('ring'), step: 3 },
      { max: 2 },
    ),
    slowerOpt('SLOWER FIREFLIES'),
  ],
};

const SZ = MG.sizeUp;

export const SIZE_UP_POPUP: GamePopup = {
  howToPlay: (s) =>
    phrases(
      `Grow or shrink the find on the trail until it matches the field guide’s drawing, then lock it in. One try each. **Get within ${SZ.tiers[tierIn(s)].pass + prepNumber(s, P_('pass'))}% before time runs out.**`,
    ),
  rules: (s) =>
    rulesOf(
      SZ.tiers[tierIn(s)].turn !== 'upright' &&
        line('The find is turned around, so judge its size, not its angle.', fromTier(2)),
    ),
  controls: [
    {
      action: 'GROW',
      inputs: [...key('W'), OR, ...key('↑'), OR, mouse('Click +'), OR, finger('Tap +')],
    },
    {
      action: 'SHRINK',
      inputs: [...key('S'), OR, ...key('↓'), OR, mouse('Click −'), OR, finger('Tap −')],
    },
    { action: 'LOCK IN', inputs: [...key('SPACE'), OR, mouse('Click'), OR, finger('Tap')] },
  ],
  chips: (s) => [seconds(numOr(s, 'time', SZ.tiers[tierIn(s)].timeSec)), 'ONE AT A TIME'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = SZ.tiers[tierIn(s)];
    const time = numOr(s, 'time', t.timeSec);
    return [
      countBar(
        'pass',
        'PASS WITHIN',
        t.pass,
        t.pass + prepNumber(s, P_('pass')),
        mostOver((x) => SZ.tiers[x].pass) + 2,
      ),
      timeBar(
        'time',
        'TIME',
        time,
        time + prepNumber(s, P_('extraSec')),
        mostOver((x) => SZ.tiers[x].timeSec) + 4,
      ),
    ];
  },
  options: () => [
    opt(
      'pass',
      'green',
      category('building'),
      'MEASURING STICK',
      '+1%',
      '+1% that passes',
      { param: P_('pass'), step: 1 },
      { max: 2 },
    ),
    plusSecOpt(2),
  ],
};

const FSW = MG.flySwatter;

/** Bee circles in this run (from Tier III, or the Bees setting). */
const swatterBees = (s: MinigameSettings): boolean =>
  s.bees === 'on' || (s.bees !== 'off' && FSW.tiers[tierIn(s)].bees > 0);

export const FLY_SWATTER_POPUP: GamePopup = {
  howToPlay: (s) => {
    const strikes = numOr(s, 'strikes', FSW.tiers[tierIn(s)].strikes);
    return phrases(
      `Circles pop up where flies are about to land. Tap each one before it shrinks away. One hiker at a time. **${strikes} strikes and you fail:** a fly that lands is a strike.`,
    );
  },
  rules(s) {
    const bees = swatterBees(s) && prepNumber(s, P_('smoke')) === 0;
    return rulesOf(
      tierIn(s) >= 3 && line('Tapping where there’s no circle is a strike.', fromTier(3)),
      bees && line('Leave the bee circles alone: tapping one is a strike.', fromTier(3)),
    );
  },
  controls: [tapRow('SWAT', 'SPACE')],
  chips: () => ['ONE AT A TIME'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const flies = FSW.tiers[tierIn(s)].flies;
    // Each Slower Flies is one level more shrink time.
    return [
      sizeBar('shrink', 'SHRINK TIME', s, prepNumber(s, P_('slowerShrink')) / 0.15),
      countBar(
        'flies',
        'FLIES',
        flies,
        flies,
        mostOver((x) => FSW.tiers[x].flies),
      ),
    ];
  },
  options: () => [
    opt(
      'bigger',
      'green',
      category('fiber'),
      'BIGGER SWATTER',
      'BIGGER',
      '+4 circle size',
      { param: P_('bigger'), step: 4 },
      { max: 2 },
    ),
    opt(
      'slowerShrink',
      'red',
      FOOD,
      'SLOWER FLIES',
      'SLOW',
      '+0.15 s before a circle goes',
      { param: P_('slowerShrink'), step: 0.15 },
      {
        max: 2,
      },
    ),
    // SMOKE (24-challenges-reset.md, section 5): no bee circles.
    opt(
      'smoke',
      'red',
      category('fire'),
      'NO BEES',
      'NO BEES',
      'smoke keeps the bees away',
      { param: P_('smoke'), step: 1 },
      { need: 2, title: 'SMOKE', onlyIf: swatterBees },
    ),
  ],
};

// ── Fly Block (23-minigames-final.md, section 10) ──────────────────────────

const FLB = MG.flyBlock;
const flyBees = (s: MinigameSettings) =>
  s.bees === 'on' ? true : s.bees === 'off' ? false : tierIn(s) >= FLB.bee.from;

export const FLY_BLOCK_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      `Flies are coming for the pie. Move the swatter around the ring, one panel at a time, and block each fly in its lane. **A fly that gets through takes a bite:** ${FLB.bites} bites and that hiker fails.`,
    ),
  rules: (s) =>
    rulesOf(
      tierIn(s) >= FLB.fast.from && line('Some flies are fast.', fromTier(2)),
      tierIn(s) >= FLB.zig.from && line('Some hop to the next lane on the way in.', fromTier(3)),
      flyBees(s) &&
        line(
          'Let the bees by: blocking one is a sting.',
          tierIn(s) >= FLB.bee.from ? fromTier(3) : undefined,
        ),
      tierIn(s) >= FLB.horse.from && line('Horseflies take two swats.', fromTier(4)),
    ),
  controls: [
    {
      action: 'MOVE',
      inputs: [
        ...key('A', 'D'),
        OR,
        ...key('←', '→'),
        OR,
        finger('Swipe'),
        OR,
        finger('Tap a side'),
      ],
    },
  ],
  chips: () => ['ONE AT A TIME'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = FLB.tiers[tierIn(s)];
    const panels = numOr(s, 'panels', t.panels);
    const slow = 1 - slowerShare(prepNumber(s, P_('slower')));
    return [
      countBar(
        'speed',
        'FLY SPEED',
        t.speed,
        Math.round(t.speed * slow),
        mostOver((x) => FLB.tiers[x].speed),
      ),
      countBar(
        'flies',
        'FLIES',
        t.flies,
        Math.max(1, t.flies - prepNumber(s, P_('smoke'))),
        mostOver((x) => FLB.tiers[x].flies),
      ),
      countBar('panels', 'PANELS', panels, panels, 16),
    ];
  },
  perHiker: () => ({ label: 'BITES', kind: 'pips', base: FLB.bites, param: P_('bites'), step: 1 }),
  options: () => [
    opt(
      'bites',
      'green',
      category('fiber'),
      '+1 BITE ALLOWED',
      '+1',
      'pick a hiker',
      { param: P_('bites'), step: 1 },
      { perHiker: true, title: 'NETTING' },
    ),
    slowerOpt('SLOWER FLIES', 'green', 'the flies slow down'),
    opt(
      'smoke',
      'red',
      category('fire'),
      `−${FLB.smoke} FLIES`,
      `−${FLB.smoke}`,
      'smoke keeps some away',
      { param: P_('smoke'), step: FLB.smoke },
      { title: 'SMOKE', need: 2 },
    ),
  ],
};

// ── Squirrel Theft (23-minigames-final.md, section 10) ─────────────────────

const SQT = MG.squirrelTheft;
const squirrelBears = (s: MinigameSettings) =>
  s.bears === 'on' ? true : s.bears === 'off' ? false : tierIn(s) >= SQT.bear.from;

export const SQUIRREL_THEFT_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'A squirrel stole from your packs! Tap the squirrels to throw them nuts. Nuts take a moment to land, so aim where they’ll be. **Fill the HAPPY bar past the line,** or what they took is gone.',
    ),
  rules: (s) =>
    rulesOf(
      line('Each hiker throws their own nuts, in turn.'),
      tierIn(s) >= SQT.runner.from && line('Some squirrels run along the branches.', fromTier(2)),
      squirrelBears(s) &&
        prepNumber(s, P_('bearSpray')) === 0 &&
        line(
          `Don’t feed the bears: it takes ${SQT.bear.cost} off the bar.`,
          tierIn(s) >= SQT.bear.from ? fromTier(3) : undefined,
        ),
    ),
  controls: [{ action: 'THROW', inputs: [mouse('Click'), OR, finger('Tap')] }],
  chips: () => ['TAKE TURNS'],
  ifFail: [{ who: 'everyone', label: 'Below the line:', value: 'what they took is lost' }],
  bars(s) {
    const t = SQT.tiers[tierIn(s)];
    const bait = prepNumber(s, P_('bait')) > 0 ? SQT.baitSec : 0;
    const pct = (v: number) => Math.round(v * 100);
    return [
      countBar('nuts', 'NUTS EACH', t.nuts, t.nuts, mostOver((x) => SQT.tiers[x].nuts) + 2),
      {
        ...countBar(
          'line',
          'HAPPY LINE',
          pct(t.line),
          pct(t.line),
          mostOver((x) => pct(SQT.tiers[x].line)),
        ),
        display: (v: number) => `${v}%`,
      },
      {
        ...countBar(
          'up',
          'POP-UP TIME',
          t.upSec,
          Math.round((t.upSec + bait) * 10) / 10,
          SQT.tiers[1].upSec + SQT.baitSec,
        ),
        display: (v: number) => `${v.toFixed(1)} S`,
      },
    ];
  },
  options: () => [
    opt(
      'nuts',
      'green',
      FOOD,
      '+1 NUT',
      '+1',
      'pick a hiker',
      { param: P_('nuts'), step: 1 },
      { perHiker: true, max: 2 },
    ),
    opt(
      'bait',
      'red',
      category('trinkets'),
      'SQUIRRELS STAY UP LONGER',
      'BAIT',
      `+${SQT.baitSec} s up`,
      { param: P_('bait'), step: 1 },
      { title: 'SHINY BAIT', need: 2 },
    ),
    opt(
      'bearSpray',
      'red',
      item('bearSpray'),
      'NO BEARS',
      'SPRAY',
      'the bears stay away',
      { param: P_('bearSpray'), step: 1 },
      { title: 'BEAR SPRAY', onlyIf: (x) => squirrelBears(x) },
    ),
  ],
};
