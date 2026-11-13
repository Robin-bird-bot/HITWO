/**
 * Food (docs/design/03-items.md, "Food"): eaten as a free action, one bite at
 * a time. Quality 1 food is worse: plain food gets a chance of a negative
 * condition (usually Food Poisoning for 1 day), and food with a good extra
 * loses it. Both are values here, so the card shows them only at Quality 1:
 * a `poison` of 25 at Quality 1 and 0 above it, an extra of 0 at Quality 1.
 * Each food's `onEat` is what a bite does (src/engine/actions/eat.ts).
 */
import type { EatContext, ItemDef } from '../../engine/effects';
import { item, q } from './build';

const food = (def: Omit<Parameters<typeof item>[0], 'type'>): ItemDef =>
  item({ ...def, type: 'food' });

/** A chance of Food Poisoning at Quality 1 only. */
const poisonAtQ1 = (pct: number) => q(pct, 0, 0, 0, 0);
const POISON = '[ A {poison}% chance of Food Poisoning.]';

/** Quality 1's chance of Food Poisoning for 1 day. */
const poison = (e: EatContext) => {
  if (e.chance(e.v('poison'))) e.condition('foodPoisoning', 1, 'days');
};

/** Wine and Piña Colada: a coin flip for 1 day, or (at Quality 1) always the bad one. */
const coinOr = (e: EatContext, good: string, bad: string) => {
  if (e.v('coin')) e.condition(e.chance(50) ? good : bad, 1, 'days');
  else if (e.v('always')) e.condition(bad, 1, 'days');
};

/**
 * TODO(wyatt): how long food's random positive conditions last when the card
 * doesn't say (Chocolate Rose, Advent Calendar, Smoked Salmon): 1 day for now.
 */
const POSITIVE_DAYS = 1;

export const FOOD: readonly ItemDef[] = [
  food({
    id: 'pelmeni',
    name: 'Pelmeni',
    onEat: (e) => {
      e.appetite(1);
      poison(e);
    },
    tier: 1,
    bites: q(2, 3, 3, 3, 4),
    values: { poison: poisonAtQ1(25) },
    text: `+1 Appetite.${POISON}`,
    recipe: 'Meat 2, Grass 1, Salt 1',
  }),
  food({
    id: 'khachapuri',
    name: 'Khachapuri',
    onEat: (e) => {
      e.appetite(2);
      poison(e);
    },
    tier: 2,
    bites: q(2, 2, 2, 3, 3),
    values: { poison: poisonAtQ1(25) },
    text: `+2 Appetite.${POISON}`,
    recipe: 'Grass 2, Meat 1, Oil 1, Salt 1, any 1',
  }),
  food({
    id: 'dinTaiFung',
    name: 'Din Tai Fung',
    onEat: (e) => {
      e.appetite(e.bitesLeft);
      poison(e);
    },
    tier: 3,
    bites: q(3, 4, 4, 4, 5),
    values: { poison: poisonAtQ1(20) },
    text: `Gain Appetite equal to the bites left, counting this one.${POISON}`,
    recipe: 'Meat 2, Grass 2, Fish 1, Mushroom 1, Salt 1, any 1',
  }),
  food({
    id: 'popcorn',
    name: 'Popcorn',
    onEat: (e) => {
      e.appetite(1);
      e.stat('morale', e.v('morale'));
    },
    tier: 1,
    bites: 1,
    values: { morale: q(0, 1, 1, 1, 2) },
    text: '+1 Appetite[, +{morale} Morale].',
    recipe: 'Grass 2, Oil 1, Salt 1',
  }),
  food({
    id: 'stinkyFeetPopcorn',
    name: 'Stinky Feet Popcorn',
    onEat: (e) => {
      e.appetite(1);
      e.stat('morale', e.v('morale'));
      // TODO(wyatt): how long Nauseous lasts (1 day for now).
      if (e.chance(e.v('nauseous'))) e.condition('nauseous', 1, 'days');
    },
    tier: 2,
    bites: 1,
    values: { morale: q(0, 2, 2, 2, 3), nauseous: q(25, 0, 0, 0, 0) },
    text: '+1 Appetite[, +{morale} Morale].[ A {nauseous}% chance of Nauseous.]',
    recipe: 'Grass 2, Oil 1, Salt 1, Mushroom 1',
  }),
  food({
    id: 'coffee',
    name: 'Coffee',
    onEat: (e) => {
      e.appetite(1);
      e.condition('energized', e.v('phases'), 'phases');
    },
    tier: 1,
    bites: 1,
    values: { phases: q(0, 1, 1, 1, 2) },
    text: '+1 Appetite[, Energized for {phases} phase{phases:s}].',
    recipe: 'Grass 2, Clay 1, any 1',
  }),
  food({
    id: 'butterfinger',
    name: 'Butterfinger',
    onEat: (e) => {
      e.appetite(1);
      e.condition('lucky', e.v('phases'), 'phases');
      e.condition('butterfingers', e.v('butterfingers'), 'phases');
    },
    tier: 1,
    bites: 1,
    values: { phases: q(0, 1, 1, 1, 2), butterfingers: q(1, 1, 0, 0, 0) },
    text: '+1 Appetite[, Lucky for {phases} phase{phases:s}].[ Also Butterfingers for {butterfingers} phase.]',
    recipe: 'Grass 1, Oil 1, Salt 1, any 1',
  }),
  food({
    id: 'hotlipsPizzaStick',
    name: 'Hotlips Pizza Stick',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      poison(e);
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(2, 3, 3, 3, 4), poison: poisonAtQ1(30) },
    text: `+{appetite} Appetite.${POISON}`,
    recipe: 'Grass 2, Meat 1, Salt 1, Oil 1',
  }),
  food({
    id: 'butteredNoodles',
    name: 'Buttered Noodles',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      e.condition('inspired', e.v('inspired'), 'phases');
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(1, 2, 2, 2, 3), inspired: q(0, 1, 1, 1, 1) },
    text: '+{appetite} Appetite[, Inspired for {inspired} phase].',
    recipe: 'Grass 2, Oil 1, Salt 1, any 1',
  }),
  food({
    id: 'sevenUp',
    name: '7-Up',
    onEat: (e) => {
      e.appetite(1);
      e.cureRandomNegative(e.v('cure'));
    },
    tier: 1,
    bites: 1,
    values: { cure: q(0, 1, 1, 1, 1) },
    text: '+1 Appetite[, and remove {cure} random negative condition].',
    recipe: 'Grass 1, Salt 1, Shell 1, any 1',
  }),
  food({
    // Also from the Citro Tub opportunity.
    id: 'citroDrink',
    name: 'Citro Drink',
    onEat: (e) => {
      e.appetite(1);
      e.condition('energized', e.v('phases'), 'phases', { stacks: 2 });
    },
    tier: 2,
    bites: 1,
    values: { phases: q(0, 1, 1, 1, 2) },
    text: '+1 Appetite[, 2 stacks of Energized for {phases} phase{phases:s}].',
    recipe: 'Grass 1, Salt 1, Seaweed 1, any 2',
  }),
  food({
    id: 'costcoSample',
    name: 'Costco Sample',
    onEat: (e) => {
      e.appetite(1);
      if (e.chance(e.v('keep'))) e.keepBite();
      if (e.chance(e.v('positive'))) e.randomPositive(1, 1, 'phases');
      poison(e);
    },
    tier: 1,
    bites: q(2, 3, 3, 3, 4),
    values: {
      keep: q(35, 45, 45, 45, 55),
      positive: q(0, 15, 15, 15, 15),
      poison: poisonAtQ1(20),
    },
    text: `+1 Appetite. A {keep}% chance not to use up the bite[, and a {positive}% chance of a random positive condition for 1 phase].${POISON}`,
    recipe: 'Meat 1, Salt 1, any 2',
  }),
  food({
    id: 'dominosPizza',
    name: 'Domino’s Pizza',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      poison(e);
    },
    tier: 3,
    bites: 1,
    values: { appetite: q(3, 4, 4, 4, 5), poison: poisonAtQ1(30) },
    text: `+{appetite} Appetite.${POISON}`,
    recipe: 'Grass 2, Meat 1, Mushroom 1, Salt 1, Oil 1, any 1',
  }),
  food({
    id: 'rotisserieChicken',
    name: 'Rotisserie Chicken',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      e.condition('sleepy', 1, 'days');
      poison(e);
    },
    tier: 3,
    bites: 1,
    values: { appetite: q(4, 5, 5, 5, 6), poison: poisonAtQ1(30) },
    text: `+{appetite} Appetite, Sleepy for 1 day.${POISON}`,
    recipe: 'Meat 3, Salt 1, Oil 1, Grass 1, any 1',
  }),
  food({
    id: 'wine',
    name: 'Wine',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      coinOr(e, 'lucky', 'unlucky');
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(1, 2, 2, 2, 3), coin: q(0, 1, 1, 1, 1), always: q(1, 0, 0, 0, 0) },
    text: '+{appetite} Appetite, then [coin?Lucky or Unlucky (50/50)][always?Unlucky] for 1 day.',
    recipe: 'Grass 2, Clay 1, any 2',
  }),
  food({
    id: 'pinaColada',
    name: 'Piña Colada',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      coinOr(e, 'energized', 'buzzed');
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(1, 2, 2, 2, 3), coin: q(0, 1, 1, 1, 1), always: q(1, 0, 0, 0, 0) },
    text: '+{appetite} Appetite, then [coin?Energized or Buzzed (50/50)][always?Buzzed] for 1 day.',
    recipe: 'Grass 1, Shell 1, Salt 1, any 2',
  }),
  food({
    id: 'trailMix',
    name: 'Trail Mix',
    onEat: (e) => {
      e.appetite(1);
      if (e.v('lucky')) e.condition('lucky', 1, 'phases', { thisPhase: true });
    },
    tier: 1,
    bites: q(2, 3, 3, 3, 4),
    values: { lucky: q(0, 1, 1, 1, 1) },
    text: '+1 Appetite[lucky? and Lucky for this phase].',
    recipe: 'Grass 1, Salt 1, Mushroom 1, any 1',
  }),
  food({
    id: 'cheeseSouffle',
    name: 'Cheese Soufflé',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      e.condition('full', e.v('full'), 'phases');
    },
    tier: 3,
    bites: 1,
    values: { appetite: q(4, 5, 5, 5, 6), full: q(0, 3, 3, 3, 4) },
    text: '+{appetite} Appetite[, Full for {full} phase{full:s}].',
    recipe: 'Meat 1, Oil 1, Grass 1, Salt 1, Mushroom 1, any 2',
  }),
  food({
    id: 'dillRolls',
    name: 'Dill Rolls',
    onEat: (e) => {
      e.appetite(2);
      e.condition('full', e.v('full'), 'phases');
    },
    tier: 2,
    bites: q(2, 2, 3, 3, 3),
    values: { full: q(0, 1, 1, 2, 2) },
    text: '+2 Appetite[ and Full for {full} phase{full:s}].',
    recipe: 'Grass 3, Oil 1, Salt 1',
  }),
  food({
    id: 'chocolateRose',
    name: 'Chocolate Rose',
    onEat: (e) => {
      e.appetite(1);
      e.randomPositive(e.v('positive'), POSITIVE_DAYS, 'days');
    },
    tier: 3,
    bites: 1,
    values: { positive: q(0, 2, 2, 2, 3) },
    text: '+1 Appetite[ and {positive} random positive conditions].',
    recipe: 'Grass 2, Oil 1, any 4',
  }),
  food({
    id: 'dogFood',
    name: 'Dog Food',
    onEat: (e) => {
      if (e.hiker.family === 'dog') {
        e.appetite(4);
        e.stat('morale', e.v('dogMorale'));
      } else {
        e.appetite(2);
        e.stat('morale', -1);
      }
    },
    tier: 1,
    bites: 1,
    values: { dogMorale: q(0, 1, 1, 1, 1) },
    text: 'Dogs: +4 Appetite[ and +{dogMorale} Morale]. Anyone else: +2 Appetite and −1 Morale.',
    recipe: 'Meat 2, Bones 1, any 1',
  }),
  food({
    id: 'pukedNuggets',
    name: 'Puked Nuggets',
    onEat: (e) => e.appetite(1),
    tier: 1,
    bites: 1,
    fixedQuality: 1,
    text: '+1 Appetite.',
    notCrafted: true,
    // Only from the Nugget Puker.
    notFound: true,
  }),
  food({
    id: 'adventCalendar',
    name: 'Advent Calendar',
    oneBiteADay: true,
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      if (e.chance(e.v('positive'))) e.randomPositive(1, POSITIVE_DAYS, 'days');
    },
    tier: 2,
    bites: q(3, 4, 4, 4, 5),
    values: { appetite: q(1, 1, 2, 2, 2), positive: q(0, 25, 25, 25, 25) },
    text: '+{appetite} Appetite[ and a {positive}% chance of a random positive condition]. Only 1 bite a day.',
    recipe: 'Grass 2, Salt 1, Oil 1, any 2',
  }),
  food({
    id: 'oldSpaghettiFactory',
    name: 'Old Spaghetti Factory',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      e.condition('inspired', e.v('inspired'), 'days');
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(2, 3, 3, 3, 4), inspired: q(0, 1, 1, 1, 1) },
    text: '+{appetite} Appetite[inspired?, Inspired for 1 day].',
    recipe: 'Grass 2, Meat 1, Salt 1, any 1',
  }),
  food({
    id: 'salmon',
    name: 'Salmon',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      poison(e);
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(2, 3, 3, 3, 4), poison: poisonAtQ1(35) },
    text: `+{appetite} Appetite.${POISON}`,
    recipe: 'Fish 3, Salt 1',
  }),
  food({
    id: 'smokedSalmon',
    name: 'Smoked Salmon',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      e.randomPositive(e.v('positive'), POSITIVE_DAYS, 'days');
    },
    tier: 3,
    bites: 1,
    values: { appetite: q(2, 3, 3, 3, 4), positive: q(0, 1, 1, 1, 1) },
    text: '+{appetite} Appetite[positive? and 1 random positive condition].',
    recipe: 'Fish 3, Wood 1, Salt 1, Oil 1',
  }),
  food({
    id: 'talentiIceCream',
    name: 'Talenti Ice Cream',
    onEat: (e) => {
      // TODO(wyatt): how long Sated lasts (1 day for now).
      e.condition('sated', 1, 'days', { stacks: e.v('sated') });
      e.condition('weak', e.v('weak'), 'phases');
    },
    tier: 2,
    bites: 1,
    values: { sated: q(2, 3, 3, 3, 4), weak: q(2, 1, 1, 1, 0) },
    text: '{sated} stacks of Sated[, and Weak for {weak} phase{weak:s}].',
    recipe: 'Salt 2, Grass 1, any 2',
  }),
  food({
    id: 'pumpkinPie',
    name: 'Pumpkin Pie',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      e.condition('motivated', e.v('motivated'), 'days');
    },
    tier: 2,
    bites: 1,
    art: null,
    values: { appetite: q(1, 2, 2, 2, 3), motivated: q(0, 1, 1, 1, 1) },
    text: '+{appetite} Appetite[motivated?, Motivated for 1 day].',
    recipe: 'Grass 2, Mushroom 1, Oil 1, any 1',
  }),
  food({
    id: 'salad',
    name: 'Salad',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      poison(e);
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(2, 3, 3, 3, 4), poison: poisonAtQ1(30) },
    text: `+{appetite} Appetite.${POISON}`,
    recipe: 'Grass 2, Mushroom 1, Seaweed 1, any 1',
  }),
  food({
    id: 'energyDrink',
    name: 'Energy Drink',
    onEat: (e) => {
      const buzzed = e.v('buzzed');
      if (e.v('energized') > 0) {
        e.condition('energized', e.v('energized'), 'days', {
          then: { id: 'buzzed', n: buzzed, unit: 'days' },
        });
      } else {
        e.condition('buzzed', buzzed, 'days');
      }
    },
    tier: 2,
    bites: 1,
    art: null,
    values: { energized: q(0, 2, 2, 2, 2), buzzed: q(2, 2, 2, 2, 1) },
    text: '[energized?Energized for {energized} days, then ]Buzzed for {buzzed} day{buzzed:s}.',
    recipe: 'Grass 1, Salt 1, Metal 1, any 2',
  }),
  food({
    // Full name: Vente Non-Fat Coffee Misto with Sugar-Free Vanilla.
    id: 'venteCoffeeMisto',
    name: 'Vente Coffee Misto',
    onEat: (e) => {
      // Each rolled separately.
      e.appetite(e.rollY(e.v('low'), e.v('high')));
      e.stat('energy', e.rollY(e.v('low'), e.v('high')));
      e.stat('morale', e.rollY(e.v('low'), e.v('high')));
    },
    tier: 3,
    bites: 1,
    values: { low: q(0, 1, 1, 1, 1), high: q(5, 10, 10, 10, 10) },
    text: '+{low}–{high} Appetite, +{low}–{high} Energy and +{low}–{high} Morale, each rolled separately.',
    recipe: 'Grass 2, Clay 2, Salt 1, Oil 1, Mushroom 1, any 2',
  }),
  food({
    id: 'meatballSoup',
    name: 'Meatball Soup',
    onEat: (e) => {
      e.appetite(1);
      for (const other of e.otherFood(e.v('others') ? 'tile' : 'own')) {
        other.appetiteMod = (other.appetiteMod ?? 0) + 1;
      }
    },
    tier: 2,
    bites: 1,
    values: { others: q(0, 1, 1, 1, 1), own: q(1, 0, 0, 0, 0) },
    text: '+1 Appetite. [others?Every other food card carried by hikers on this tile][own?Every other food card this hiker carries] permanently gives +1 Appetite.',
    recipe: 'Meat 2, Mushroom 1, Salt 1, Clay 1',
  }),
  food({
    id: 'mysteryMeat',
    name: 'Mystery Meat',
    onEat: (e) => {
      e.appetite(e.rollY(0, 10));
      if (e.chance(e.v('pct'))) e.randomNegative(e.v('phases'), 'phases');
    },
    tier: 1,
    bites: 1,
    values: { pct: q(60, 50, 50, 50, 40), phases: q(3, 2, 2, 2, 1) },
    text: '+0–10 Appetite, and a {pct}% chance of a random negative condition for {phases} phase{phases:s}.',
    recipe: 'Meat 1, Bones 1, any 2',
  }),
  food({
    id: 'jerky',
    name: 'Jerky',
    keepsValue: true,
    onEat: (e) => {
      e.appetite(2);
      poison(e);
    },
    tier: 2,
    bites: q(2, 2, 3, 3, 3),
    values: { poison: poisonAtQ1(20) },
    text: `+2 Appetite. Never loses Appetite value (Flies, night events).${POISON}`,
    recipe: 'Meat 2, Salt 2, any 1',
  }),
  food({
    id: 'smores',
    name: 'S’mores',
    onEat: (e) => {
      e.appetite(1 + (e.night ? e.v('night') : 0));
      if (e.night) e.stat('morale', e.v('morale'));
    },
    tier: 1,
    bites: 1,
    values: { night: q(0, 1, 1, 1, 1), morale: q(0, 1, 1, 1, 2) },
    text: '+1 Appetite.[ Eaten at night: +{night} more Appetite and +{morale} Morale.]',
    recipe: 'Grass 2, Wood 1, any 1',
  }),
  food({
    id: 'fishAndChips',
    name: 'Fish and Chips',
    onEat: (e) => {
      e.appetite(e.v('appetite'));
      e.stat('morale', e.v('morale'));
      poison(e);
    },
    tier: 2,
    bites: 1,
    values: { appetite: q(2, 3, 3, 3, 4), morale: q(0, 1, 1, 1, 1), poison: poisonAtQ1(25) },
    text: `+{appetite} Appetite[, +{morale} Morale].${POISON}`,
    recipe: 'Fish 2, Grass 1, Oil 1, Salt 1',
  }),
];
