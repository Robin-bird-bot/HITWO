/**
 * Traits as data. Each one plugs into engine hooks; the engine never checks
 * for a trait by name. Wording is copied exactly from
 * docs/design/02-traits-and-conditions.md.
 *
 * Phase 1 has the three sample traits that prove the hook system works, and
 * Phase 4 the scavenging traits from Phase 4 in docs/BUILD_PLAN.md. Phase 10
 * adds the rest.
 */
import { BALANCE } from '../config/balance';
import type { QueryContext, TraitDef } from '../engine/effects';
import type { NodeType, ScavengeCardType, StatName } from '../engine/types';

const N = BALANCE.traits;

const leader: TraitDef = {
  id: 'leader',
  name: 'Leader',
  type: 'T',
  tier: 1,
  text: 'Moving the group costs 1 less Appetite.',
  hooks: {
    modifyCost(q, ctx) {
      if (q.key !== 'moveAll.appetite' || q.actorId !== ctx.self.id) return undefined;
      return { source: 'Leader', flat: -N.leader.moveAllDiscount };
    },
  },
};

const STOIC_GAINS: readonly StatName[] = ['energy', 'appetite'];

const stoic: TraitDef = {
  id: 'stoic',
  name: 'Stoic',
  type: 'T',
  tier: 2,
  text: 'Once per day, can spend 2 Morale to gain 1 Energy or 1 Appetite.',
  ability: {
    id: 'stoic',
    label: 'Stoic',
    limit: { per: 'day', uses: 1 },
    choices: [
      { id: 'energy', label: `+${N.stoic.gain} Energy` },
      { id: 'appetite', label: `+${N.stoic.gain} Appetite` },
    ],
    validate(ctx) {
      if (ctx.self.stats.morale < N.stoic.moraleCost) return `Needs ${N.stoic.moraleCost} Morale.`;
      return undefined;
    },
    apply(ctx, choice) {
      const stat = STOIC_GAINS.find((s) => s === choice);
      if (!stat) return;
      ctx.changeStat(ctx.self, 'morale', -N.stoic.moraleCost, 'Stoic');
      ctx.changeStat(ctx.self, stat, N.stoic.gain, 'Stoic');
    },
  },
};

const extrinsic: TraitDef = {
  id: 'extrinsic',
  name: 'Extrinsic',
  type: 'M',
  tier: null,
  text: 'Start of day: +1 Morale when sharing a tile with another hiker, −1 Morale when alone.',
  hooks: {
    onStartOfDay(ctx) {
      const delta = ctx.isAlone(ctx.self) ? N.extrinsic.alone : N.extrinsic.together;
      ctx.changeStat(ctx.self, 'morale', delta, 'Extrinsic');
    },
  },
};

/**
 * Thrill Seeker (Nov 6, Tier I, Trail). Not the Morale trait Thrill-Seeker.
 * Every Energy loss in a phase counts, costs included; it triggers once a phase.
 */
const thrillSeeker: TraitDef = {
  id: 'thrillSeeker',
  name: 'Thrill Seeker',
  type: 'T',
  tier: 1,
  text: 'Losing 3 or more Energy in a single phase makes this hiker Energized for 1 day.',
  hooks: {
    onStatChange(e, ctx) {
      if (e.stat !== 'energy' || e.to >= e.from) return;
      const lost = ctx.tally(ctx.self, 'energyLost', e.from - e.to, 'phase');
      if (lost < N.thrillSeeker.energyLost) return;
      if (ctx.tally(ctx.self, 'thrillSeeker', 0, 'phase') > 0) return;
      ctx.tally(ctx.self, 'thrillSeeker', 1, 'phase');
      ctx.addCondition(ctx.self, 'energized', N.thrillSeeker.days, 'days', 'Thrill Seeker');
    },
  },
};

// ── Scavenging (Phase 4) ───────────────────────────────────────────────────

const forager: TraitDef = {
  id: 'forager',
  name: 'Forager',
  type: 'U',
  tier: 1,
  text: '+1 card to choose from when scavenging.',
  hooks: {
    modifyScavenge: () => ({
      source: 'Forager',
      label: 'Forager: 1 extra card to choose from',
      tone: 'bonus',
      cards: N.forager.cards,
    }),
  },
};

const gambler: TraitDef = {
  id: 'gambler',
  name: 'Gambler',
  type: 'U',
  tier: 2,
  text: 'Once per day, can reroll one card when scavenging.',
  ability: {
    id: 'gambler',
    label: 'Gambler',
    limit: { per: 'day', uses: N.gambler.usesPerDay },
    scavengeReroll: true,
    // The reroll itself happens in the scavenge window (the scavengeReroll action).
    apply: () => undefined,
  },
};

/** "[Node]" traits come in four versions: River, Forest, Creature (Wildlife) and Rock (Mountain). */
const NODE_VERSIONS: { node: NodeType; word: string; name: string }[] = [
  { node: 'forest', word: 'Forest', name: 'Forest' },
  { node: 'river', word: 'River', name: 'River' },
  { node: 'wildlife', word: 'Wildlife', name: 'Creature' },
  { node: 'mountain', word: 'Mountain', name: 'Rock' },
];

const finders: TraitDef[] = NODE_VERSIONS.map(({ node, word, name }) => ({
  id: `${name.toLowerCase()}Finder`,
  name: `${name} Finder`,
  type: 'U',
  tier: 1,
  text: `Higher chance of drawing ${word} resources when scavenging.`,
  hooks: {
    modifyScavenge: () => ({
      source: `${name} Finder`,
      label: `${name} Finder: ${word} cards are likelier`,
      tone: 'bonus',
      nodeWeight: { [node]: N.finder.nodeWeight },
    }),
  },
}));

const DOUBLES: ScavengeCardType[] = ['x2', 'wildX2'];

const hounds: TraitDef[] = NODE_VERSIONS.map(({ node, word, name }) => ({
  id: `${name.toLowerCase()}Hound`,
  name: `${name} Hound`,
  type: 'U',
  tier: 2,
  text: `Much higher chance of drawing ${word} resources, and of ×2 results, when scavenging.`,
  hooks: {
    modifyScavenge: () => ({
      source: `${name} Hound`,
      label: `${name} Hound: ${word} cards and ×2 results are much likelier`,
      tone: 'bonus',
      nodeWeight: { [node]: N.hound.nodeWeight },
      nodeTypeWeight: {
        [node]: Object.fromEntries(DOUBLES.map((t) => [t, N.hound.doubleWeight])),
      },
    }),
  },
}));

const ITEM_FINDS: ScavengeCardType[] = [
  'toolFind',
  'foodFind',
  'clothesFind',
  'shelterFind',
  'trinketFind',
];

const archaeologist: TraitDef = {
  id: 'archaeologist',
  name: 'Archaeologist',
  type: 'U',
  tier: 1,
  text: 'Higher chance of Item find cards when scavenging.',
  hooks: {
    modifyScavenge: () => ({
      source: 'Archaeologist',
      label: 'Archaeologist: Item finds are likelier',
      tone: 'bonus',
      typeWeight: Object.fromEntries(ITEM_FINDS.map((t) => [t, N.archaeologist.itemFindWeight])),
    }),
  },
};

/** Other hikers who scavenged this tile earlier today. */
function earlierHere(ctx: QueryContext, tileId: string) {
  const ids = new Set(
    ctx.state.scavengedToday
      .filter((r) => r.tileId === tileId && r.hikerId !== ctx.self.id)
      .map((r) => r.hikerId),
  );
  return ctx.state.hikers.filter((h) => ids.has(h.id));
}

function copyTrait(
  id: 'copier' | 'copydog',
  name: string,
  appetiteEach: number,
  text: string,
): TraitDef {
  return {
    id,
    name,
    type: 'U',
    tier: id === 'copier' ? 1 : 2,
    text,
    hooks: {
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
    },
  };
}

const copier = copyTrait(
  'copier',
  'Copier',
  N.copier.appetiteEach,
  'When scavenging, can take 1 extra resource for each hiker who scavenged this tile earlier the same day, at 1 Appetite per extra resource.',
);

const copydog = copyTrait(
  'copydog',
  'Copydog',
  0,
  'When scavenging, can take 1 extra resource for each hiker who scavenged this tile earlier the same day, at no extra cost.',
);

export const TRAITS: Readonly<Record<string, TraitDef>> = Object.fromEntries(
  [
    leader,
    stoic,
    extrinsic,
    thrillSeeker,
    forager,
    gambler,
    ...finders,
    ...hounds,
    archaeologist,
    copier,
    copydog,
  ].map((t) => [t.id, t]),
);
