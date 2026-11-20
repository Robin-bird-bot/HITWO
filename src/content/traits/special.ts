/**
 * Special and unique traits: special ones belong to certain characters (or
 * come through trinkets), unique ones to a single character. Only their
 * owners can start with them or be offered them. The table in
 * 02-traits-and-conditions.md, then every trait marked New in
 * 07-characters.md, by character. Owners are the 07-characters.md ids.
 */
import type { TraitDef } from '../../engine/effects';
import { morale, special, trail, unique, utility } from './build';

const FIRE = 'Sit by the Fire';

export const SPECIAL_TRAITS: readonly TraitDef[] = [
  // ── 02-traits-and-conditions.md ──
  utility(null, 'fluffy', 'Fluffy', 'When crafting with Fur, get 1 Fur back.', special('ellie')),
  utility(null, 'quirky', 'Quirky', 'Each day, this trait becomes a random Tier I Utility trait.', {
    ...special('wyatt'),
    daily: 'trait',
    dailyTiers: [1],
  }),
  utility(
    null,
    'zany',
    'Zany',
    'Each day, this trait becomes a random Utility trait of any tier.',
    { ...special('grandpaSherman'), daily: 'trait' },
  ),
  utility(
    null,
    'nosework',
    'Nosework',
    'Each morning a random node type is picked and shown on the hiker’s card. On a tile with that node: +3 Luck when scavenging and crafting.',
    { ...special('noseworkEllie'), daily: 'node' },
  ),
  morale(
    'misophonia',
    'Misophonia',
    'Right away: −1 Morale when another hiker eats on this tile; +2 Morale when crafting food.',
    special('gdog'),
  ),
  morale(
    'rainLover',
    'Rain Lover',
    'During rain or snow, every Morale gain is 1 larger.',
    special('wyatt', 'wywee'),
  ),
  morale(
    'moody',
    'Moody',
    'Each morning, gains 1 random condition for the day from a set of 3 positive and 3 negative conditions.',
    { ...special(), daily: 'condition' },
  ),
  utility(
    null,
    'yodeler',
    'Yodeler',
    'Once per day, as a free daytime action: every hiker within 2 tiles gains 1 Morale, or 2 if they’re on a tile with a Mountain node.',
    unique(),
  ),
  utility(
    null,
    'dogMom',
    'Dog Mom',
    'When a Dog on the same tile scavenges, this hiker also gains a resource from that node.',
    unique('mom'),
  ),
  utility(
    null,
    'artist',
    'Artist',
    'When this hiker crafts an item, every hiker on the tile gains 1 Morale.',
    unique('katie'),
  ),
  utility(
    null,
    'stylish',
    'Stylish',
    'With all 3 equipment slots filled: +1 Luck when scavenging and crafting. Clothes last 3 extra days when this hiker equips them (once per item).',
    unique('mitchell'),
  ),
  morale(
    'showGirl',
    'Show Girl',
    'Humans on this hiker’s tile get +1 from every Morale gain.',
    unique('showgirlGdog'),
  ),
  utility(
    null,
    'nuggetPuker',
    'Nugget Puker',
    'After eating food, gains a Puked Nuggets food card (+1 Appetite, 1 use).',
    special('katie'),
  ),
  utility(
    null,
    'loud',
    'Loud',
    'Can trade and Keep Watch from 1 tile away. At night, gives Ringing Ears to every hiker on its tile.',
    special('ellie'),
  ),

  // ── New in 07-characters.md ──
  trail(
    null,
    'wanderer',
    'Wanderer',
    'Once per daytime phase, moving alone to an unrevealed tile doesn’t use this hiker’s action.',
    special('pearl'),
  ),
  trail(
    null,
    'forgetful',
    'Forgetful',
    'Each morning, a 50% chance to forget one random negative condition (it’s removed).',
    special('brutus'),
  ),
  utility(
    null,
    'snores',
    'Snores',
    'Night events are 50% less likely to hit hikers on this hiker’s tile. Other hikers sleeping on this tile get 1 less Energy from sleep.',
    special('brutus'),
  ),
  trail(
    null,
    'alphaDog',
    'Alpha Dog',
    'When this hiker moves the group onto a tile with a challenge, any negative conditions or injuries it gives go to this hiker instead of the others.',
    unique('cody'),
  ),
  trail(
    null,
    'lanky',
    'Lanky',
    'Each move has a 25% chance not to use this hiker’s action.',
    special('duke'),
  ),
  utility(
    null,
    'goodBoy',
    'Good Boy',
    'Instead of acting, can give this hiker’s action to a hiker on the same tile, who gets an extra action this phase.',
    special('duke'),
  ),
  utility(
    null,
    'spoiled',
    'Spoiled',
    'When another hiker on this tile eats, this hiker gains 1 Appetite too.',
    special('scarlet'),
  ),
  trail(
    null,
    'fluffArmor',
    'Fluff Armor',
    'Each negative condition this hiker would get has a 50% chance to be blocked, at most once per day.',
    special('sinjon'),
  ),
  utility(
    null,
    'mentor',
    'Mentor',
    'Every other hiker on this tile gains 1 extra XP each time they gain XP.',
    special('hershal'),
  ),
  utility(
    null,
    'storyteller',
    'Storyteller',
    'When this hiker Sits by the Fire, every other hiker on the tile gains 2 XP.',
    { ...special('hershal'), waitsOn: FIRE },
  ),
  utility(
    null,
    'hypeDog',
    'Hype Dog',
    'Once per day, as a free action, makes a hiker on this tile or an adjacent tile Energized for 1 day.',
    special('kai'),
  ),
  utility(
    null,
    'bossGracie',
    'Boss & Gracie',
    'Boss’s days: Fetch can take an item too, and can reach 2 tiles away. Gracie’s days: once per day, as a free action, gives 1 resource or item to a hiker up to 2 tiles away.',
    { ...unique('bossGracie'), tagTeam: true },
  ),
  trail(
    null,
    'shifty',
    'Shifty',
    'Can move alone, but only when no other hiker is on this tile. Once per phase, that move doesn’t use the action. It still costs the normal amount.',
    unique('pepper'),
  ),
  trail(
    null,
    'nightShifty',
    'Night Shifty',
    'Once per night, can move to an adjacent tile for free.',
    unique('pepper'),
  ),
  utility(
    null,
    'luckyCharm',
    'Lucky Charm',
    'Every other hiker on this tile gets +1 Luck when scavenging and crafting.',
    unique('goldie'),
  ),
  utility(
    null,
    'cuddleBuddy',
    'Cuddle Buddy',
    'Hikers who sleep on this tile can’t get Nightmares, and gain 1 Morale.',
    unique('goldie'),
  ),
  utility(
    null,
    'ruleChanger',
    'Rule Changer',
    'Once per biome, reroll the challenge on an adjacent revealed tile.',
    unique('wyatt'),
  ),
  trail(
    null,
    'strongWalker',
    'Strong Walker',
    'Hikers this hiker moves with the group don’t use their action.',
    special('grandpaWink'),
  ),
  trail(
    null,
    'justAroundTheNextCorner',
    'Just Around the Next Corner',
    'Moving to a tile 3 or fewer tiles from the checkpoint: moving alone has a 75% chance to cost no Appetite, and when this hiker moves the group, each hiker has a 25% chance to pay no Appetite.',
    special('grandpaWink'),
  ),
  trail(
    null,
    'tankButt',
    'Tank Butt',
    'When this hiker moves the group, it can bring hikers who’ve already acted this phase.',
    unique('grandpaSherman'),
  ),
  utility(
    null,
    'linguist',
    'Linguist',
    'Each time this hiker gains XP, they gain 1 extra XP for each other hiker on the tile.',
    unique('katie'),
  ),
  trail(
    null,
    'coach',
    'Coach',
    'Once per day, as a free action, gives a hiker on this tile Motivated (their next action is free).',
    special('melissa'),
  ),
  utility(
    null,
    'comedian',
    'Comedian',
    'When this hiker Sits by the Fire, every hiker on the tile gains 1 Morale and loses Bored.',
    { ...special('madeline'), waitsOn: FIRE },
  ),
  trail(
    null,
    'easyMode',
    'Easy Mode',
    'Hikers facing a challenge on this hiker’s tile pay 1 less of its cost (never below 0).',
    unique('wywee'),
  ),
  utility(
    null,
    'garbageGut',
    'Garbage Gut',
    'Quality 1 food never gives this hiker a bad condition.',
    special('ellieDevourer'),
  ),
];
