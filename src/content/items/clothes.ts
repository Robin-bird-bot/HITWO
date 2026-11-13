/**
 * Clothes (docs/design/03-items.md, "Clothes"): three slots, Gear, Body and
 * Feet (shoes or socks: one or the other). Anyone can wear anything.
 * Durability is in days, from the tier (BALANCE.items.durability) unless the
 * item says otherwise. Effects work while worn: hooks (`hooksAt` knows the
 * item, so it can wear itself out), or flags the engine reads (an Umbrella
 * taking wear, free moves, the Harness).
 */
import { BALANCE } from '../../config/balance';
import type { CostQuery, EffectContext, Hooks, ItemDef } from '../../engine/effects';
import { isHungry } from '../../engine/thresholds';
import type { Hiker, Line, StatName } from '../../engine/types';
import { item, q } from './build';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What crossing a line costs in Appetite before any change: base, extra and night. */
const appetiteBefore = (state: EffectContext['state'], line: Line) =>
  BALANCE.lines.baseAppetite[line.kind] +
  (BALANCE.lines.extra[line.kind].appetite ?? 0) +
  (state.phase === 'night' ? BALANCE.night.moveExtraAppetite : 0);

/** Steep, Muddy and Rough: lines with an extra cost. */
const hasExtra = (line: Line) => Object.values(BALANCE.lines.extra[line.kind]).some((n) => !!n);

const isMoveCost = (q: CostQuery) =>
  q.key === 'move.appetite' || q.key === 'move.energy' || q.key === 'move.morale';

/** A chance (out of 100) to gain 1 Morale. */
const maybeMorale = (ctx: EffectContext, pct: number, cause: string, who = ctx.self) => {
  if (ctx.roll(pct / 100)) ctx.changeStat(who, 'morale', 1, cause);
};

/** Raises a stat by 1 and says whether it went up (the Snack Pack only wears when it works). */
const gained = (ctx: EffectContext, stat: StatName, cause: string) => {
  const before = ctx.self.stats[stat];
  ctx.changeStat(ctx.self, stat, 1, cause);
  return ctx.self.stats[stat] > before;
};

/** Dog Socks and Cat Socks: a chance for each Dog (or Cat) here to gain 1 Morale, at most 1 a phase. */
const familySocks =
  (family: 'dog' | 'cat', name: string) =>
  (v: (key: string) => number): Hooks => ({
    onPhaseStart: (_e, ctx) => {
      for (const h of ctx.hikersOnTile(ctx.self.tileId)) {
        if (h.family !== family || h.status !== 'active') continue;
        if (ctx.tally(h, 'sockMorale', 0, 'phase') > 0) continue;
        if (!ctx.roll(v('pct') / 100)) continue;
        ctx.tally(h, 'sockMorale', 1, 'phase');
        ctx.changeStat(h, 'morale', 1, name);
      }
    },
  });

type Input = Omit<Parameters<typeof item>[0], 'type'>;
const gear = (def: Input): ItemDef => item({ ...def, type: 'clothes', slot: 'gear' });
const body = (def: Input): ItemDef => item({ ...def, type: 'clothes', slot: 'body' });
const shoes = (def: Input): ItemDef =>
  item({ ...def, type: 'clothes', slot: 'feet', footwear: 'shoes' });
const socks = (def: Input): ItemDef =>
  item({ ...def, type: 'clothes', slot: 'feet', footwear: 'socks' });

const GEAR: ItemDef[] = [
  gear({
    id: 'umbrella',
    name: 'Umbrella',
    tier: 2,
    text: 'Any durability this hiker’s other clothes would lose comes off the Umbrella instead.',
    recipe: 'Metal 2, Seaweed 2, Wood 1, Oil 1, any 1',
    takesWear: true,
  }),
  gear({
    id: 'hikingStick',
    name: 'Hiking Stick',
    tier: 1,
    values: { cost: q(3, 2, 2, 2, 1) },
    text: 'When Hungry, moving alone costs no Appetite; each time, the stick loses {cost} durability.',
    recipe: 'Wood 3, Fur 1, any 2',
    // TODO(wyatt): "moving alone" read as the Move action (not Move All).
    hooksAt: (v, self) => {
      const works = (via: string | undefined, role: string, hiker: Hiker) =>
        via === 'move' && role === 'actor' && isHungry(hiker);
      return {
        modifyCost: (q, ctx) =>
          q.key === 'move.appetite' && works(q.via, q.role, ctx.self)
            ? { source: 'Hiking Stick', percent: -100 }
            : undefined,
        onMove: (e, ctx) => {
          if (works(e.via, e.role, ctx.self) && appetiteBefore(ctx.state, e.line) > 0) {
            ctx.wearItem(ctx.self, self.uid, v('cost'), 'Hiking Stick');
          }
        },
      };
    },
  }),
  gear({
    id: 'glasses',
    name: 'Glasses',
    tier: 1,
    values: { rerolls: q(1, 1, 1, 1, 2) },
    text: 'When scavenging, reroll {rerolls} card{rerolls:s}.',
    recipe: 'Shell 2, Metal 1, any 3',
    hooksAt: (v) => ({
      modifyScavenge: () => ({
        source: 'Glasses',
        label: `Glasses: reroll ${plural(v('rerolls'), 'card')}`,
        tone: 'bonus',
        rerolls: v('rerolls'),
      }),
    }),
  }),
  gear({
    id: 'backpack',
    name: 'Backpack',
    tier: 2,
    values: { items: q(1, 2, 2, 2, 3) },
    text: 'Carry {items} more item{items:s}.',
    recipe: 'Fur 2, Moss 2, Metal 1, any 2',
    hooksAt: (v) => ({
      modifyCapacity: (cap) =>
        cap.key === 'bag.slots' ? { source: 'Backpack', flat: v('items') } : undefined,
    }),
  }),
  gear({
    id: 'snackPack',
    name: 'Snack Pack',
    tier: 2,
    values: { pct: q(10, 15, 15, 15, 20) },
    text: 'Each phase, a {pct}% chance to gain 1 Appetite; each time it does, it loses 1 durability.',
    recipe: 'Moss 2, Fur 1, Meat 1, Salt 1, any 2',
    hooksAt: (v, self) => ({
      onPhaseEnd: (_e, ctx) => {
        if (ctx.roll(v('pct') / 100) && gained(ctx, 'appetite', 'Snack Pack')) {
          ctx.wearItem(ctx.self, self.uid, 1, 'Snack Pack');
        }
      },
    }),
  }),
  gear({
    id: 'trooperMask',
    name: 'Trooper Mask',
    tier: 3,
    text: 'Ignores the extra costs of Steep, Muddy and Rough lines; each time it does, it loses 1 durability.',
    recipe: 'Metal 3, Oil 1, Shell 1, Flint 1, any 2',
    hooksAt: (_v, self) => ({
      modifyCost: (q) =>
        isMoveCost(q) && q.parts?.line
          ? { source: 'Trooper Mask', flat: -q.parts.line }
          : undefined,
      onMove: (e, ctx) => {
        if (hasExtra(e.line)) ctx.wearItem(ctx.self, self.uid, 1, 'Trooper Mask');
      },
    }),
  }),
  gear({
    id: 'thinkingCap',
    name: 'Thinking Cap',
    tier: 2,
    values: { xp: q(1, 1, 1, 1, 2) },
    text: '+{xp} XP from every source.',
    recipe: 'Fur 2, Moss 1, any 4',
    // TODO(phase 10): XP from every source.
  }),
  gear({
    id: 'vrHeadset',
    name: 'VR Headset',
    tier: 2,
    values: { xp: q(1, 1, 1, 1, 2) },
    text: 'Gains {xp} XP whenever another hiker on this tile gains XP.',
    recipe: 'Metal 2, Oil 1, Shell 1, Flint 1, any 2',
    // TODO(phase 10): XP when others here gain it.
  }),
  gear({
    id: 'hardhat',
    name: 'Hardhat',
    tier: 2,
    text: 'Blocks the next injury, then breaks.',
    recipe: 'Metal 2, Oil 1, Stone 1, any 3',
    hooksAt: (_v, self) => ({
      blockInjury: (_cause, ctx) => {
        ctx.breakItem(ctx.self, self.uid, 'it blocked an injury');
        return true;
      },
    }),
  }),
  gear({
    id: 'fannyPack',
    name: 'Fanny Pack',
    tier: 1,
    values: { resources: q(1, 2, 3, 4, 5) },
    text: 'Carry {resources} more resource{resources:s}.',
    recipe: 'Fur 2, Oil 1, any 3',
    hooksAt: (v) => ({
      modifyCapacity: (cap) =>
        cap.key === 'resources' ? { source: 'Fanny Pack', flat: v('resources') } : undefined,
    }),
  }),
];

const BODY: ItemDef[] = [
  body({
    id: 'harness',
    name: 'Harness',
    tier: 3,
    values: { cost: q(5, 4, 4, 4, 3) },
    text: 'Turns a failed challenge into a pass, at the cost of {cost} durability.',
    recipe: 'Fur 3, Metal 2, Bones 1, any 3',
    // In the challenge window, when it has that much durability left.
    harness: 'cost',
  }),
  body({
    id: 'discoHarness',
    name: 'Disco Harness',
    tier: 2,
    values: { pct: q(40, 50, 50, 50, 60) },
    text: 'Hikers on this tile are {pct}% less likely to be hit by night events.',
    recipe: 'Fur 2, Shell 2, Oil 1, any 2',
    hooksAt: (v) => ({ nightShield: () => v('pct') }),
  }),
  body({
    id: 'pajamas',
    name: 'Pajamas',
    tier: 1,
    values: { energy: q(1, 1, 1, 1, 2) },
    text: '+{energy} Energy from sleeping. Scavenging costs this 1 durability.',
    recipe: 'Fur 2, Moss 2, any 2',
    hooksAt: (v, self) => ({
      modifyGain: (q) =>
        q.key === 'sleep.energy' ? { source: 'Pajamas', flat: v('energy') } : undefined,
      onScavenge: (_e, ctx) => ctx.wearItem(ctx.self, self.uid, 1, 'Pajamas'),
    }),
  }),
  body({
    id: 'plainShirt',
    name: 'Plain Shirt',
    tier: 1,
    values: { extra: q(1, 2, 2, 2, 3) },
    // Tier 1's durability (4/5/5/5/6) plus its extra days.
    durability: q(5, 7, 7, 7, 9),
    text: 'No ability, but cheap, and it lasts {extra} day{extra:s} longer than other Tier 1 clothes.',
    recipe: 'Moss 2, Fur 1, any 2',
  }),
  body({
    id: 'heavyJacket',
    name: 'Heavy Jacket',
    tier: 2,
    values: { pct: q(20, 25, 25, 25, 35) },
    text: 'A {pct}% chance not to lose durability, from any source.',
    recipe: 'Fur 3, Oil 1, Metal 1, any 2',
    wearSave: { value: 'pct' },
  }),
  body({
    id: 'pufferJacket',
    name: 'Puffer Jacket',
    tier: 3,
    values: { cost: q(3, 2, 2, 2, 1) },
    text: 'Blocks a negative condition, at the cost of {cost} durability.',
    recipe: 'Fur 3, Oil 2, Seaweed 1, Metal 1, any 2',
    // TODO(wyatt): it blocks every negative condition, on its own.
    hooksAt: (v, self) => ({
      blockCondition: (_id, ctx) => {
        ctx.wearItem(ctx.self, self.uid, v('cost'), 'Puffer Jacket');
        return true;
      },
    }),
  }),
  body({
    id: 'jeans',
    name: 'Jeans',
    tier: 1,
    text: 'Scavenging costs 1 less Appetite; each time, it loses 1 durability.',
    recipe: 'Moss 3, Metal 1, any 2',
    hooksAt: (_v, self) => ({
      modifyCost: (q) =>
        q.key === 'scavenge.appetite'
          ? { source: 'Jeans', flat: -BALANCE.items.jeansAppetite }
          : undefined,
      onScavenge: (_e, ctx) => ctx.wearItem(ctx.self, self.uid, 1, 'Jeans'),
    }),
  }),
  body({
    id: 'flannel',
    name: 'Flannel',
    tier: 2,
    values: { cards: q(1, 1, 1, 1, 2) },
    text: 'When scavenging, see {cards} extra card{cards:s}.',
    recipe: 'Fur 2, Moss 2, any 3',
    hooksAt: (v) => ({
      modifyScavenge: () => ({
        source: 'Flannel',
        label: `Flannel: +${plural(v('cards'), 'card')}`,
        tone: 'bonus',
        cards: v('cards'),
      }),
    }),
  }),
  body({
    id: 'engineeringVest',
    name: 'Engineering Vest',
    tier: 2,
    values: { durability: q(1, 1, 1, 2, 2) },
    text: 'Clothes this hiker crafts get +{durability} durability.',
    recipe: 'Fur 2, Metal 1, Oil 1, Moss 1, any 2',
    hooksAt: (v) => ({
      modifyCraft: (q) =>
        q.type === 'clothes'
          ? {
              source: 'Engineering Vest',
              label: `Engineering Vest: +${v('durability')} durability`,
              tone: 'bonus',
              durability: v('durability'),
            }
          : undefined,
    }),
  }),
  body({
    id: 'cozySweater',
    name: 'Cozy Sweater',
    tier: 2,
    values: { morale: q(1, 1, 1, 1, 2) },
    text: '+{morale} to all Morale this hiker gains.',
    recipe: 'Fur 4, Moss 1, any 2',
    hooksAt: (v) => ({
      modifyStatChange: (q) =>
        q.stat === 'morale' && q.delta > 0 ? { add: v('morale') } : undefined,
    }),
  }),
  body({
    id: 'fancyAttire',
    name: 'Fancy Attire',
    tier: 3,
    values: { caps: q(1, 1, 1, 1, 2) },
    text: '+{caps} to all caps the party gains.',
    recipe: 'Fur 2, Shell 2, Metal 1, any 4',
    hooksAt: (v) => ({
      modifyGain: (q) =>
        q.key === 'caps' ? { source: 'Fancy Attire', flat: v('caps') } : undefined,
    }),
  }),
  body({
    id: 'rainJacket',
    name: 'Rain Jacket',
    tier: 1,
    text: 'Can’t become Wet or Soaked.',
    recipe: 'Seaweed 2, Oil 1, Moss 1, any 2',
    hooks: { blockCondition: (id) => id === 'wet' || id === 'soaked' },
  }),
];

const SHOES: ItemDef[] = [
  shoes({
    id: 'joggingShoes',
    name: 'Jogging Shoes',
    tier: 3,
    text: 'This hiker’s first move each phase doesn’t use their action.',
    recipe: 'Fur 2, Oil 2, Metal 1, any 4',
    freeMove: 'eachPhase',
  }),
  shoes({
    id: 'lightUpSkechers',
    name: 'Light-Up Skechers',
    tier: 1,
    text: 'Moving at night costs no extra Appetite.',
    recipe: 'Oil 2, Fur 1, Metal 1, any 2',
    hooks: {
      modifyCost: (q) =>
        q.key === 'move.appetite' && q.parts?.night
          ? { source: 'Light-Up Skechers', flat: -q.parts.night }
          : undefined,
    },
  }),
  shoes({
    id: 'trailShoes',
    name: 'Trail Shoes',
    tier: 1,
    text: 'When moving, pay with Energy instead of Appetite if Appetite is lower than Energy.',
    recipe: 'Fur 2, Oil 1, any 3',
    hooks: { moveWithEnergy: () => true },
  }),
  shoes({
    id: 'toeShoes',
    name: 'Toe Shoes',
    tier: 1,
    text: 'Being brought along by another hiker’s Move All costs no extra Appetite.',
    recipe: 'Oil 2, Fur 1, any 3',
    hooks: {
      modifyCost: (q, ctx) =>
        q.key === 'moveAll.perHiker' && q.subjectId === ctx.self.id
          ? { source: 'Toe Shoes', percent: -100 }
          : undefined,
    },
  }),
  shoes({
    id: 'hikingCrocs',
    name: 'Hiking Crocs',
    tier: 2,
    text: 'Once a day, after passing a challenge: one free move that doesn’t use an action and costs 1 less Appetite. It uses 1 extra durability.',
    recipe: 'Oil 3, Clay 1, any 3',
    freeMove: 'afterChallenge',
  }),
  shoes({
    id: 'workBoots',
    name: 'Work Boots',
    tier: 2,
    text: 'After crafting: one free move that doesn’t use an action and costs 1 less Appetite. It uses 1 extra durability.',
    recipe: 'Fur 2, Oil 1, Metal 1, Stone 1, any 2',
    freeMove: 'afterCraft',
  }),
  shoes({
    id: 'rollerSkates',
    name: 'Roller Skates',
    tier: 2,
    text: 'Moving sideways or backward costs no Appetite.',
    recipe: 'Metal 2, Fur 1, Oil 1, any 3',
    hooks: {
      modifyCost: (q, ctx) => {
        if (q.key !== 'move.appetite' || !q.fromTileId || !q.toTileId) return undefined;
        const from = ctx.state.section.tiles[q.fromTileId];
        const to = ctx.state.section.tiles[q.toTileId];
        // Rows count up toward the checkpoint: the same row is sideways, a lower one backward.
        return from && to && to.row <= from.row
          ? { source: 'Roller Skates', percent: -100 }
          : undefined;
      },
    },
  }),
  shoes({
    id: 'birkenstocks',
    name: 'Birkenstocks',
    tier: 1,
    values: { pct: q(60, 75, 75, 75, 90) },
    // {node} is the node they were made with, or "its node (picked when made)" on a blank card.
    text: 'On a tile with {node}, a {pct}% chance not to lose durability.',
    recipe: 'Wood 2, Fur 1, any 3',
    madeWithNode: true,
    wearSave: { value: 'pct', onNode: true },
  }),
  shoes({
    id: 'liftedBoots',
    name: 'Lifted Boots',
    tier: 3,
    text: 'When using Move All with exactly 1 other hiker, that hiker gets another action.',
    recipe: 'Fur 2, Oil 2, Metal 1, any 4',
    // TODO(wyatt): "another action" read as the move not using theirs.
    hooks: { broughtKeepAction: (count) => count === 1 },
  }),
];

const sock = (
  id: string,
  name: string,
  text: string,
  hooksAt: (v: (key: string) => number) => Hooks,
): ItemDef =>
  socks({
    id,
    name,
    tier: 1,
    values: { pct: q(15, 20, 20, 20, 30) },
    text,
    recipe: 'Fur 2, Moss 1, any 3',
    hooksAt,
  });

const SOCKS: ItemDef[] = [
  sock(
    'dogSocks',
    'Dog Socks',
    'At the start of each phase, a {pct}% chance for each Dog on this tile to gain 1 Morale (at most 1).',
    familySocks('dog', 'Dog Socks'),
  ),
  sock(
    'catSocks',
    'Cat Socks',
    'At the start of each phase, a {pct}% chance for each Cat on this tile to gain 1 Morale (at most 1).',
    familySocks('cat', 'Cat Socks'),
  ),
  sock(
    'soupSocks',
    'Soup Socks',
    'Each time a hiker on this tile eats or crafts food, a {pct}% chance to gain 1 Morale.',
    // TODO(wyatt): the wearer gains the Morale.
    (v) => ({
      onTileEat: (_e, ctx) => maybeMorale(ctx, v('pct'), 'Soup Socks'),
      onTileCraft: (e, ctx) => {
        if (e.type === 'food') maybeMorale(ctx, v('pct'), 'Soup Socks');
      },
    }),
  ),
  sock(
    'sleepySocks',
    'Sleepy Socks',
    'A {pct}% chance to gain 1 Morale when sleeping, or at the start of a phase with 7 or more Energy.',
    (v) => ({
      onSleep: (ctx) => maybeMorale(ctx, v('pct'), 'Sleepy Socks'),
      onPhaseStart: (_e, ctx) => {
        if (ctx.self.stats.energy >= BALANCE.items.sleepySocksEnergy) {
          maybeMorale(ctx, v('pct'), 'Sleepy Socks');
        }
      },
    }),
  ),
  sock('speedySocks', 'Speedy Socks', 'Each move, a {pct}% chance to gain 1 Morale.', (v) => ({
    onMove: (_e, ctx) => maybeMorale(ctx, v('pct'), 'Speedy Socks'),
  })),
];

export const CLOTHES: readonly ItemDef[] = [...GEAR, ...BODY, ...SHOES, ...SOCKS];
