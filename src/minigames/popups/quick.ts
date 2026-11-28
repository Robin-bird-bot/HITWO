/**
 * The pop-up content for the four quick games of Nov 27
 * (docs/design/30-quick-minigames.md): Incoming Bike!, Wrong Turn, Fallen
 * Branch and Snagged Pack. Each game's text, rules, bars and Prepare cards
 * are in its section there.
 */
import { BALANCE } from '../../config/balance';
import { category, FOOD, item, prepNumber } from '../prepare';
import { signsFor } from '../incomingBike/logic';
import type { MinigameSettings } from '../types';
import {
  bandages,
  countBar,
  FAIL_ENERGY,
  FAIL_PASSING,
  finger,
  fromTier,
  hikerCount,
  key,
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
  tierIn,
  timeBar,
} from './common';
import type { GamePopup } from './types';

const MG = BALANCE.minigames;
const pct = (share: number) => Math.round(share * 100);
const degrees = (v: number) => `±${v}°`;

// ── Incoming Bike! ─────────────────────────────────────────────────────────

const IB = MG.incomingBike;

export const INCOMING_BIKE_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Bikes are coming! Press the key on each bike before its ring closes to hop out of the way. **A wrong key or a late one costs a heart.**',
    ),
  rules(s) {
    const t = tierIn(s);
    return rulesOf(
      t >= 3 && line('Two bikes can come at once.', fromTier(3)),
      t >= 4 && line('Some bikes need two keys.', fromTier(4)),
      t >= 5 && line('Don’t press a crossed-out key.', 'TIER V'),
    );
  },
  controls: [
    { action: 'HOP ASIDE', inputs: [...key('THE KEY ON THE BIKE'), OR, finger('Draw its shape')] },
  ],
  chips: (s) => [`${IB.tiers[tierIn(s)].bikes} BIKES EACH`, 'ONE AT A TIME'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = IB.tiers[tierIn(s)];
    const ring = t.ringSec * (1 + IB.foodSlower * prepNumber(s, P_('slower')));
    const keys = signsFor(tierIn(s), 'keys').length;
    return [
      countBar(
        'bikes',
        'BIKES',
        t.bikes,
        t.bikes,
        mostOver((x) => IB.tiers[x].bikes),
      ),
      {
        ...timeBar(
          'ring',
          'RING TIME',
          t.ringSec,
          Math.round(ring * 100) / 100,
          mostOver((x) => IB.tiers[x].ringSec) * (1 + 2 * IB.foodSlower),
        ),
        display: (v: number) => `${v.toFixed(1)} S`,
      },
      countBar('keys', 'KEYS', keys, keys, signsFor(5, 'keys').length),
    ];
  },
  perHiker: (s) => ({
    label: 'HEARTS',
    kind: 'hearts',
    base: numOr(s, 'hearts', IB.hearts),
    param: P_('lives'),
    step: 1,
  }),
  options: () => [
    opt(
      'slower',
      'red',
      FOOD,
      'SLOWER RINGS',
      'SLOW',
      `rings close ${pct(IB.foodSlower)}% slower`,
      { param: P_('slower'), step: 1 },
      { max: 2 },
    ),
    bandages('HEART', '♥'),
    opt(
      'bell',
      'green',
      category('trinkets'),
      'BIKE BELL',
      'BELL',
      'each hiker’s first mistake is free',
      { param: P_('bell'), step: 1 },
      { title: 'BIKE BELL' },
    ),
    opt(
      'binoculars',
      'blue',
      item('binoculars'),
      'BINOCULARS',
      'LOOK',
      'see each key sooner',
      { param: P_('warn'), step: IB.binocularsSec },
      { title: 'BINOCULARS' },
    ),
  ],
};

// ── Wrong Turn ─────────────────────────────────────────────────────────────

const WT = MG.wrongTurn;
/** The party's clock: the tier's (or the setting's) for each bearing. */
const wrongTurnClock = (s: MinigameSettings) =>
  numOr(s, 'clock', WT.tiers[tierIn(s)].clockSec) * Math.max(WT.minBearings, hikerCount(s));

export const WRONG_TURN_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Find the trail again. Turn the needle with A and D (or tap a side), and hold it in the notch until it locks. **Each hiker locks one bearing before time runs out.**',
    ),
  rules(s) {
    const t = WT.tiers[tierIn(s)];
    const map = prepNumber(s, P_('map')) > 0;
    return rulesOf(
      !map && t.wobbleDeg > 0 && line('The needle wobbles.', fromTier(3)),
      !map && t.hideSec !== null && line('The notch hides after a moment.', fromTier(4)),
    );
  },
  controls: [
    {
      action: 'TURN',
      inputs: [...key('A', 'D'), OR, ...key('←', '→'), OR, finger('Tap a side')],
    },
  ],
  chips: (s) => [seconds(wrongTurnClock(s)), 'WHOLE PARTY'],
  ifFail: FAIL_PASSING,
  bars(s) {
    const t = WT.tiers[tierIn(s)];
    const map = prepNumber(s, P_('map')) > 0;
    const clock = wrongTurnClock(s);
    return [
      {
        ...countBar(
          'notch',
          'NOTCH SIZE',
          t.notchDeg,
          t.notchDeg + WT.cairnDeg * prepNumber(s, P_('cairn')),
          mostOver((x) => WT.tiers[x].notchDeg) + WT.cairnDeg,
        ),
        display: degrees,
      },
      {
        ...countBar(
          'wobble',
          'WOBBLE',
          t.wobbleDeg,
          map ? 0 : t.wobbleDeg,
          mostOver((x) => WT.tiers[x].wobbleDeg),
        ),
        display: degrees,
      },
      timeBar(
        'time',
        'TIME',
        clock,
        clock + prepNumber(s, P_('extraSec')),
        mostOver((x) => WT.tiers[x].clockSec) * Math.max(WT.minBearings, hikerCount(s)),
      ),
    ];
  },
  options: () => [
    plusSecOpt(WT.foodSec),
    opt(
      'cairn',
      'green',
      category('building'),
      'CAIRN',
      'CAIRN',
      `the notch is ${WT.cairnDeg}° wider`,
      { param: P_('cairn'), step: 1 },
      { need: 2, title: 'CAIRN' },
    ),
    opt(
      'charm',
      'green',
      category('trinkets'),
      'LUCKY CHARM',
      'CHARM',
      'bearings lock in half the time',
      { param: P_('charm'), step: 1 },
      { title: 'LUCKY CHARM' },
    ),
    opt(
      'map',
      'blue',
      item('supplyMap'),
      'SUPPLY MAP',
      'MAP',
      'the notch stays, and the needle holds still',
      { param: P_('map'), step: 1 },
      { title: 'SUPPLY MAP' },
    ),
  ],
};

// ── Fallen Branch ──────────────────────────────────────────────────────────

const FB = MG.fallenBranch;
const strokesFor = (cut: number, start: number) => Math.ceil((1 - start) / cut - 1e-9);

export const FALLEN_BRANCH_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Saw through the branch together. Press A and D in turn (or swipe back and forth) and keep the tempo in the zone. **Too fast and the saw binds; too slow and it won’t cut.**',
    ),
  rules(s) {
    const t = FB.tiers[tierIn(s)];
    return rulesOf(
      t.knots[1] > 0 && line('Knots need a slower tempo.', fromTier(2)),
      t.driftSec > 0 && line('The right tempo drifts.', fromTier(3)),
    );
  },
  controls: [
    {
      action: 'SAW',
      inputs: [...key('A', 'D'), OR, ...key('←', '→'), OR, finger('Swipe back and forth')],
    },
  ],
  chips: (s) => [
    seconds(numOr(s, 'clock', FB.tiers[tierIn(s)].clockSec)),
    'WHOLE PARTY, IN SHIFTS',
  ],
  ifFail: FAIL_PASSING,
  bars(s) {
    const t = FB.tiers[tierIn(s)];
    const sharp = t.cut * (1 + FB.sharpen * prepNumber(s, P_('sharpen')));
    const start = prepNumber(s, P_('knife')) > 0 ? FB.knifeStart : 0;
    const zone = (x: typeof t) => Math.round((x.zone[1] - x.zone[0]) * 100);
    const [lo, hi] = t.knots;
    return [
      countBar(
        'cut',
        'CUT NEEDED',
        strokesFor(t.cut, 0),
        strokesFor(sharp, start),
        mostOver((x) => strokesFor(FB.tiers[x].cut, 0)),
      ),
      {
        ...countBar(
          'zone',
          'TEMPO ZONE',
          zone(t),
          zone(t),
          mostOver((x) => zone(FB.tiers[x])),
        ),
        display: (v: number) => `${(v / 100).toFixed(2)} S`,
      },
      {
        ...countBar(
          'knots',
          'KNOTS',
          hi,
          hi,
          mostOver((x) => FB.tiers[x].knots[1]),
        ),
        display: () => (lo === hi ? `${hi}` : `${lo}–${hi}`),
      },
    ];
  },
  options: () => [
    plusSecOpt(FB.foodSec),
    opt(
      'sharpen',
      'green',
      category('building'),
      'SHARPEN THE SAW',
      'SHARP',
      `each good stroke cuts ${pct(FB.sharpen)}% more`,
      { param: P_('sharpen'), step: 1 },
      { need: 2, max: 2, title: 'SHARPEN THE SAW' },
    ),
    opt(
      'wax',
      'green',
      category('fire'),
      'WAX THE BLADE',
      'WAX',
      'binding stops the saw half as long',
      { param: P_('wax'), step: 1 },
      { title: 'WAX THE BLADE' },
    ),
    opt(
      'knife',
      'red',
      item('swissArmyKnife'),
      'SWISS ARMY KNIFE',
      'KNIFE',
      `the cut starts ${pct(FB.knifeStart)}% through`,
      { param: P_('knife'), step: 1 },
      { title: 'SWISS ARMY KNIFE' },
    ),
  ],
};

// ── Snagged Pack ───────────────────────────────────────────────────────────

const SNP = MG.snaggedPack;

export const SNAGGED_PACK_POPUP: GamePopup = {
  howToPlay: () =>
    phrases(
      'Your pack is snagged! Drag each rope to the socket of the same color. **Ropes can’t cross.** Each hiker untangles their own pack.',
    ),
  rules: () => [],
  controls: [
    { action: 'DRAG', inputs: [mouse('Drag'), OR, finger('Drag')] },
    { action: 'CLEAR', inputs: [mouse('Click a rope'), OR, finger('Tap a rope')] },
  ],
  chips: (s) => [seconds(numOr(s, 'clock', SNP.tiers[tierIn(s)].clockSec)), 'ONE AT A TIME'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = SNP.tiers[tierIn(s)];
    const clock = numOr(s, 'clock', t.clockSec);
    return [
      {
        ...countBar(
          'grid',
          'GRID SIZE',
          t.size,
          t.size,
          mostOver((x) => SNP.tiers[x].size),
        ),
        display: (v: number) => `${v}×${v}`,
      },
      countBar(
        'pairs',
        'PAIRS',
        t.pairs,
        Math.max(2, t.pairs - prepNumber(s, P_('fewer'))),
        mostOver((x) => SNP.tiers[x].pairs),
      ),
      timeBar(
        'time',
        'TIME',
        clock,
        clock + prepNumber(s, P_('extraSec')),
        mostOver((x) => SNP.tiers[x].clockSec) + 2 * SNP.foodSec,
      ),
    ];
  },
  options: () => [
    plusSecOpt(SNP.foodSec),
    opt(
      'sorted',
      'red',
      category('fiber'),
      'SORTED',
      'SORTED',
      'one pair starts joined',
      { param: P_('sorted'), step: 1 },
      { need: 2, max: 2, title: 'SORTED' },
    ),
    opt(
      'hint',
      'blue',
      category('trinkets'),
      'LUCKY CHARM',
      'HINT',
      'tap a socket to see its rope',
      { param: P_('hint'), step: 1 },
      { title: 'LUCKY CHARM' },
    ),
    opt(
      'fewer',
      'red',
      item('sack'),
      'SACK',
      '−1 PAIR',
      'one pair fewer each',
      { param: P_('fewer'), step: 1 },
      { title: 'SACK' },
    ),
  ],
};
