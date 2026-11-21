/**
 * Utility traits (green): crafting, scavenging and actions. The table in
 * 02-traits-and-conditions.md, in its order. "[Node]" traits (Finder, Hound,
 * the Thumbs and the Pockets) are one trait each, with the node set on the hiker.
 */
import { BALANCE } from '../../config/balance';
import type { Hooks, ItemType, QueryContext, TraitDef } from '../../engine/effects';
import type {
  Hiker,
  NodeType,
  ResourceId,
  ScavengeCardType,
  StatName,
  TraitSetting,
} from '../../engine/types';
import { CONDITIONS } from '../conditions';
import { RESOURCES } from '../resources';
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

/** The resources of one node, or all of them. */
const resourcesOf = (node?: NodeType): ResourceId[] =>
  RESOURCES.filter((r) => !node || r.node === node).map((r) => r.id);
const nodeOfResource = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.node;
const resourceName = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.name ?? id;

/** Other hikers still hiking (or checked in at the station) on this hiker's tile. */
const companions = (ctx: QueryContext): Hiker[] =>
  ctx.state.hikers.filter(
    (h) =>
      h.id !== ctx.self.id &&
      h.tileId === ctx.self.tileId &&
      (h.status === 'active' || h.status === 'checkedIn'),
  );

/** Everyone else still hiking has acted this phase (Closer). */
const lastToAct = (ctx: QueryContext): boolean =>
  ctx.state.hikers.every((h) => h.id === ctx.self.id || h.status !== 'active' || h.acted);

/** How many resources a hiker carries. */
const carried = (h: Hiker) =>
  Object.values(h.inventory.resources).reduce<number>((n, c) => n + (c ?? 0), 0);

/**
 * `n` resources to spend, the ones the hiker has most of first (Lead Stomach,
 * Destroyer). TODO(wyatt): first guess at which go.
 */
function plentiful(h: Hiker, n: number): ResourceId[] {
  const counts = new Map(
    (Object.entries(h.inventory.resources) as [ResourceId, number][]).filter(([, c]) => c > 0),
  );
  const out: ResourceId[] = [];
  while (out.length < n) {
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best) break;
    out.push(best[0]);
    if (best[1] <= 1) counts.delete(best[0]);
    else counts.set(best[0], best[1] - 1);
  }
  return out;
}

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
  ['Cook', 'food', 'food'],
  ['Crafter', 'tools', 'tool'],
  ['Architect', 'shelters', 'shelter'],
  ['Tailor', 'clothes', 'clothes'],
] as const;

/** Crafts one type at a tier (Artisan: 2, Master: 3). */
const craftsAt = (type: ItemType, tier: number): Hooks => ({
  craftTier: (t) => (t === type ? tier : undefined),
});

/** Luck for crafting while something holds. */
const craftLuck =
  (
    source: string,
    label: string,
    luck: number,
    when: (ctx: QueryContext) => boolean,
  ): Hooks['modifyCraft'] =>
  (_q, ctx) =>
    when(ctx) ? { source, label, tone: 'luck', luck } : undefined;

const STATS: readonly StatName[] = ['energy', 'appetite', 'morale'];

export const UTILITY_TRAITS: readonly TraitDef[] = [
  utility(
    1,
    'collaborative',
    'Collaborative',
    '+1 Luck when crafting on a tile with other hikers.',
    {
      hooks: {
        modifyCraft: craftLuck(
          'Collaborative',
          `Collaborative: +${N.collaborative.luck} Luck with others here`,
          N.collaborative.luck,
          (ctx) => companions(ctx).length > 0,
        ),
      },
    },
  ),
  utility(1, 'focused', 'Focused', '+1 Luck when crafting alone.', {
    hooks: {
      modifyCraft: craftLuck(
        'Focused',
        `Focused: +${N.focused.luck} Luck crafting alone`,
        N.focused.luck,
        (ctx) => companions(ctx).length === 0,
      ),
    },
  }),
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
    {
      hooks: {
        modifyCost(q, ctx) {
          if (q.key !== 'scavenge.drain' || q.subjectId !== ctx.self.id) return undefined;
          const first = !ctx.state.scavengedToday.some((r) => r.hikerId === ctx.self.id);
          return first ? { source: 'Eco-conscious', flat: -N.ecoConscious.drain } : undefined;
        },
      },
    },
  ),
  utility(1, 'squirrely', 'Squirrely', 'Higher chance of acorn caps when scavenging.', {
    hooks: {
      modifyScavenge: () => ({
        source: 'Squirrely',
        label: 'Squirrely: acorn caps are likelier',
        tone: 'bonus',
        typeWeight: { caps: N.squirrely.capsWeight },
      }),
    },
  }),
  utility(
    1,
    'nocturnal',
    'Nocturnal',
    'A night without sleep costs 2 Appetite instead of 2 Energy.',
    {
      hooks: { noSleepStat: () => 'appetite' },
    },
  ),
  utility(
    1,
    'leadStomach',
    'Lead Stomach',
    'As a free action, can eat 2 resources to gain 1 Appetite.',
    {
      ability: {
        id: 'leadStomach',
        label: 'Lead Stomach',
        limit: { per: 'phase', uses: Infinity },
        validate: (ctx) =>
          carried(ctx.self) < N.leadStomach.resources
            ? `Needs ${N.leadStomach.resources} resources to eat.`
            : undefined,
        apply(ctx) {
          ctx.spendResources(
            ctx.self,
            plentiful(ctx.self, N.leadStomach.resources),
            'Lead Stomach',
          );
          ctx.changeStat(ctx.self, 'appetite', N.leadStomach.appetite, 'Lead Stomach');
        },
      },
    },
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
  utility(1, 'charismatic', 'Charismatic', '+2 caps for each sale.', {
    hooks: {
      modifyGain: (q, ctx) =>
        q.key === 'sale.caps' && q.subjectId === ctx.self.id
          ? { source: 'Charismatic', flat: N.charismatic.caps }
          : undefined,
    },
  }),
  utility(1, 'frugal', 'Frugal', 'Pays 1 cap less for each purchase.', {
    hooks: {
      modifyCost: (q, ctx) =>
        q.key === 'buy.caps' && q.subjectId === ctx.self.id
          ? { source: 'Frugal', flat: -N.frugal.caps }
          : undefined,
    },
  }),
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
      hooksWith(setting) {
        const node = nodeOf(setting);
        if (!node) return {};
        const name = `${NODE_NAMES.thumb[node]} Thumb`;
        const hasNode = (ctx: QueryContext, tileId: string) =>
          !!ctx.state.section.tiles[tileId]?.nodes.some((n) => n.type === node);
        return {
          modifyScavenge: (q, ctx) =>
            hasNode(ctx, q.tileId)
              ? {
                  source: name,
                  label: `${name}: 1 extra card on a ${NODE_WORD[node]} tile`,
                  tone: 'bonus',
                  cards: N.thumb.cards,
                }
              : undefined,
          modifyGain: (q, ctx) =>
            q.key === 'tend.abundance' &&
            q.subjectId === ctx.self.id &&
            hasNode(ctx, ctx.self.tileId)
              ? { source: name, flat: N.thumb.abundance }
              : undefined,
        };
      },
    },
  ),
  utility(
    1,
    'dayNapper',
    'Day Napper',
    'Can Sleep in the Morning or Afternoon, not just at night.',
    {
      hooks: { sleepsByDay: () => true },
    },
  ),
  utility(
    1,
    'singer',
    'Singer',
    'When this hiker Sits by the Fire, every hiker on the tile gains 1 Morale.',
    {
      waitsOn: 'Sit by the Fire',
      hooks: {
        onSitByFire(ctx) {
          for (const h of ctx.hikersOnTile(ctx.self.tileId)) {
            ctx.changeStat(h, 'morale', N.singer.morale, 'Singer');
          }
        },
      },
    },
  ),
  utility(1, 'chef', 'Chef', 'Food this hiker crafts has a chance of +1 Appetite.', {
    hooks: {
      onCraft(e, ctx) {
        if (e.type !== 'food' || !e.item || !ctx.roll(N.chef.chance)) return;
        e.item.appetiteMod = (e.item.appetiteMod ?? 0) + N.chef.appetite;
        ctx.note(
          ctx.self,
          'Chef',
          `${ctx.self.name}’s food gives ${N.chef.appetite} more Appetite.`,
        );
      },
    },
  }),
  utility(
    1,
    'carefulHands',
    'Careful Hands',
    'Clothes this hiker crafts get 0–3 extra days of durability.',
    {
      hooks: {
        onCraft(e, ctx) {
          if (e.type !== 'clothes' || e.item?.durability === undefined) return;
          const extra = ctx.int(N.carefulHands.min, N.carefulHands.max);
          if (!extra) return;
          e.item.durability += extra;
          e.item.maxDurability = e.item.durability;
          ctx.note(
            ctx.self,
            'Careful Hands',
            `The clothes last ${extra} more day${extra === 1 ? '' : 's'}.`,
          );
        },
      },
    },
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
  utility(1, 'mba', 'MBA', 'On level-up, gain caps based on the new level (3 caps per level).', {
    hooks: {
      onLevelUp: (e, ctx) => ctx.gainCaps(N.mba.capsPerLevel * e.level, 'MBA'),
    },
  }),
  utility(1, 'teacher', 'Teacher', 'Teaching another hiker a blueprint costs half the Morale.', {
    hooks: {
      modifyCost: (q, ctx) =>
        q.key === 'teach.morale' && q.subjectId === ctx.self.id
          ? { source: 'Teacher', percent: N.teacher.percent }
          : undefined,
    },
  }),
  ...CRAFT_TITLES.map(([title, what, type]) =>
    utility(2, `artisan${title}`, `Artisan ${title}`, `Can craft Tier 2 ${what}.`, {
      hooks: craftsAt(type, 2),
    }),
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
      hooksWith(setting) {
        const node = nodeOf(setting);
        if (!node) return {};
        const name = `${NODE_NAMES.pockets[node]} Pockets`;
        return {
          // A random extra: it doesn't drain Abundance (trait rules).
          onScavenged(_e, ctx) {
            if (ctx.roll(N.pockets.chance)) ctx.gain(ctx.self, [ctx.pick(resourcesOf(node))], name);
          },
        };
      },
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
  utility(2, 'savvy', 'Savvy', 'When crafting, a chance to get 1 of the used resources back.', {
    hooks: {
      onCraft(e, ctx) {
        if (!e.paid?.length || !ctx.roll(N.savvy.chance)) return;
        ctx.gain(ctx.self, [ctx.pick(e.paid)], 'Savvy');
      },
    },
  }),
  utility(2, 'handy', 'Handy', '+1 card to choose from when crafting.', {
    hooks: {
      modifyCraft: () => ({
        source: 'Handy',
        label: `Handy: ${N.handy.cards} extra card to choose from`,
        tone: 'bonus',
        cards: N.handy.cards,
      }),
    },
  }),
  utility(2, 'fortunate', 'Fortunate', '+1 Luck when scavenging.', {
    hooks: {
      modifyScavenge: () => ({
        source: 'Fortunate',
        label: `Fortunate: +${N.fortunate.luck} Luck`,
        tone: 'luck',
        luck: N.fortunate.luck,
      }),
    },
  }),
  utility(
    2,
    'eagleEye',
    'Eagle Eye',
    'Scavenging also draws from the revealed nodes of adjacent tiles.',
    {
      hooks: {
        modifyScavenge: () => ({
          source: 'Eagle Eye',
          label: 'Eagle Eye: also draws from the nodes next door',
          tone: 'bonus',
          adjacentNodes: true,
        }),
      },
    },
  ),
  utility(2, 'pirate', 'Pirate', 'Scavenging alone costs no Appetite.', {
    hooks: {
      modifyCost: (q, ctx) =>
        q.key === 'scavenge.appetite' && q.subjectId === ctx.self.id && ctx.isAlone(ctx.self)
          ? { source: 'Pirate', percent: -100 }
          : undefined,
    },
  }),
  utility(
    2,
    'destroyer',
    'Destroyer',
    'As a free action, can spend 3 resources to gain 1 Energy, Appetite or Morale.',
    {
      ability: {
        id: 'destroyer',
        label: 'Destroyer',
        limit: { per: 'phase', uses: Infinity },
        choices: STATS.map((s) => ({
          id: s,
          label: `+${N.destroyer.gain} ${s.charAt(0).toUpperCase()}${s.slice(1)}`,
        })),
        validate: (ctx) =>
          carried(ctx.self) < N.destroyer.resources
            ? `Needs ${N.destroyer.resources} resources to spend.`
            : undefined,
        apply(ctx, choice) {
          const stat = STATS.find((s) => s === choice);
          if (!stat) return;
          ctx.spendResources(ctx.self, plentiful(ctx.self, N.destroyer.resources), 'Destroyer');
          ctx.changeStat(ctx.self, stat, N.destroyer.gain, 'Destroyer');
        },
      },
    },
  ),
  utility(2, 'nonNonProfit', 'Non-Non-Profit', 'Sales earn 50% more caps.', {
    hooks: {
      modifyGain: (q, ctx) =>
        q.key === 'sale.caps' && q.subjectId === ctx.self.id
          ? { source: 'Non-Non-Profit', percent: N.nonNonProfit.percent }
          : undefined,
    },
  }),
  utility(
    2,
    'therapist',
    'Therapist',
    'Once per day, can spend 1 Morale to shorten every negative condition of hikers on this tile by 1 day.',
    {
      ability: {
        id: 'therapist',
        label: 'Therapist',
        limit: { per: 'day', uses: 1 },
        validate(ctx) {
          if (ctx.self.stats.morale < N.therapist.morale) {
            return `Needs ${N.therapist.morale} Morale.`;
          }
          const anyone = ctx
            .hikersOnTile(ctx.self.tileId)
            .some((h) =>
              h.conditions.some(
                (c) => CONDITIONS[c.id]?.kind === 'negative' && c.unit !== 'weather',
              ),
            );
          return anyone ? undefined : 'Nobody here has a negative condition to shorten.';
        },
        apply(ctx) {
          ctx.changeStat(ctx.self, 'morale', -N.therapist.morale, 'Therapist');
          for (const h of ctx.hikersOnTile(ctx.self.tileId)) {
            for (const c of [...h.conditions]) {
              if (CONDITIONS[c.id]?.kind !== 'negative') continue;
              // A day is 3 phases, for a condition counted in phases.
              const by = c.unit === 'phases' ? 3 * N.therapist.days : N.therapist.days;
              ctx.shortenCondition(h, c.id, by, 'Therapist');
            }
          }
        },
      },
    },
  ),
  utility(
    2,
    'liberal',
    'Liberal',
    'Once per phase, can spend 1 Energy to even out the Morale of all hikers on this tile.',
    {
      ability: {
        id: 'liberal',
        label: 'Liberal',
        limit: { per: 'phase', uses: 1 },
        validate(ctx) {
          if (ctx.self.stats.energy < N.liberal.energy) return `Needs ${N.liberal.energy} Energy.`;
          const here = ctx.hikersOnTile(ctx.self.tileId);
          if (here.length < 2) return 'Nobody else is on this tile.';
          return new Set(here.map((h) => h.stats.morale)).size > 1
            ? undefined
            : 'Everyone here already has the same Morale.';
        },
        apply(ctx) {
          ctx.changeStat(ctx.self, 'energy', -N.liberal.energy, 'Liberal');
          ctx.evenOut(ctx.hikersOnTile(ctx.self.tileId), 'morale', 'Liberal');
        },
      },
    },
  ),
  utility(
    2,
    'talented',
    'Talented',
    '+1 to the numbers on items this hiker crafts (for example, +1 Appetite on food).',
    {
      hooks: {
        onCraft(e) {
          const item = e.item;
          if (!item) return;
          const n = N.talented.bonus;
          if (e.type === 'food') item.appetiteMod = (item.appetiteMod ?? 0) + n;
          if (e.type === 'tool' && item.usesLeft !== undefined) item.usesLeft += n;
          if (e.type === 'clothes' && item.durability !== undefined) {
            item.durability += n;
            item.maxDurability = item.durability;
          }
        },
      },
    },
  ),
  utility(2, 'closer', 'Closer', '+1 Luck when this hiker is the last to act in a phase.', {
    hooks: {
      modifyScavenge: (_q, ctx) =>
        lastToAct(ctx)
          ? {
              source: 'Closer',
              label: `Closer: +${N.closer.luck} Luck, last to act`,
              tone: 'luck',
              luck: N.closer.luck,
            }
          : undefined,
      modifyCraft: craftLuck(
        'Closer',
        `Closer: +${N.closer.luck} Luck, last to act`,
        N.closer.luck,
        lastToAct,
      ),
    },
  }),
  utility(
    2,
    'lovinglyMade',
    'Lovingly Made',
    'At high Morale (8 or more), +1 extra Luck when crafting.',
    {
      hooks: {
        modifyCraft: craftLuck(
          'Lovingly Made',
          `Lovingly Made: +${N.lovinglyMade.luck} Luck at high Morale`,
          N.lovinglyMade.luck,
          (ctx) => ctx.self.stats.morale >= N.lovinglyMade.morale,
        ),
      },
    },
  ),
  utility(
    2,
    'wise',
    'Wise',
    'When this hiker gains XP, every other hiker on the tile gains 50% as much.',
    {
      hooks: {
        // Passed on plainly: nothing adds to it, and it isn't passed on again.
        onXpGained(e, ctx) {
          const share = Math.ceil((e.xp * N.wise.percent) / 100);
          // Everyone else here, checked-in hikers too (at a checkpoint they're all together).
          const here = ctx.state.hikers.filter(
            (h) =>
              h.id !== ctx.self.id &&
              h.tileId === ctx.self.tileId &&
              (h.status === 'active' || h.status === 'checkedIn'),
          );
          for (const h of here) ctx.shareXp(h, share, 'Wise');
        },
      },
    },
  ),
  utility(
    2,
    'dreamAlchemist',
    'Dream Alchemist',
    'During the night, each resource this hiker carries has a 10% chance to turn into a random resource. Resources held by other hikers aren’t affected.',
    {
      hooks: {
        onEndOfDay(ctx) {
          const units = (
            Object.entries(ctx.self.inventory.resources) as [ResourceId, number][]
          ).flatMap(([id, n]) => Array.from({ length: n }, () => id));
          const changed = units.filter(() => ctx.roll(N.dreamAlchemist.chance));
          if (!changed.length) return;
          ctx.spendResources(ctx.self, changed, 'Dream Alchemist');
          ctx.gain(
            ctx.self,
            changed.map(() => ctx.pick(resourcesOf())),
            'Dream Alchemist',
          );
        },
      },
    },
  ),
  ...CRAFT_TITLES.map(([title, what, type]) =>
    utility(3, `master${title}`, `Master ${title}`, `Can craft Tier 3 ${what}.`, {
      hooks: craftsAt(type, 3),
    }),
  ),
  utility(
    3,
    'germanEfficiency',
    'German Efficiency',
    'Using a tool also gives a random resource.',
    {
      hooks: {
        onToolUse: (_e, ctx) => ctx.gain(ctx.self, [ctx.pick(resourcesOf())], 'German Efficiency'),
      },
    },
  ),
  utility(3, 'proficient', 'Proficient', '+2 cards to choose from when crafting.', {
    hooks: {
      modifyCraft: () => ({
        source: 'Proficient',
        label: `Proficient: ${N.proficient.cards} extra cards to choose from`,
        tone: 'bonus',
        cards: N.proficient.cards,
      }),
    },
  }),
  utility(
    3,
    'generous',
    'Generous',
    'When scavenging, a random hiker on the tile also gets a random resource from the same node.',
    {
      hooks: {
        onScavenged(e, ctx) {
          const others = ctx.hikersOnTile(e.tileId).filter((h) => h.id !== ctx.self.id);
          if (!e.node || !others.length) return;
          ctx.gain(ctx.pick(others), [ctx.pick(resourcesOf(e.node))], 'Generous');
        },
      },
    },
  ),
  utility(
    3,
    'alchemist',
    'Alchemist',
    'As a free action, can turn 2 of the same resource into 1 resource of the same node.',
    {
      ability: {
        id: 'alchemist',
        label: 'Alchemist',
        limit: { per: 'phase', uses: Infinity },
        choicesFor: (ctx) =>
          (Object.entries(ctx.self.inventory.resources) as [ResourceId, number][])
            .filter(([, n]) => n >= N.alchemist.resources)
            .map(([id]) => {
              const node = nodeOfResource(id);
              return {
                id,
                label: `${N.alchemist.resources} ${resourceName(id)} → 1 ${node ? NODE_WORD[node] : 'other'} resource`,
              };
            }),
        apply(ctx, choice) {
          const id = RESOURCES.find((r) => r.id === choice)?.id;
          if (!id) return;
          ctx.spendResources(
            ctx.self,
            Array.from({ length: N.alchemist.resources }, () => id),
            'Alchemist',
          );
          // Another resource of the same node, where there is one.
          const node = nodeOfResource(id);
          const pool = resourcesOf(node).filter((r) => r !== id);
          ctx.gain(ctx.self, [ctx.pick(pool.length ? pool : [id])], 'Alchemist');
        },
      },
    },
  ),
  utility(3, 'thrifty', 'Thrifty', '1 random item at each shop is free.', {
    hooks: { freeShopItem: () => true },
  }),
];
