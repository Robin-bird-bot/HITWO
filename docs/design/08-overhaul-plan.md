# Overhaul plan

The next big update: fewer systems, each one more fun, and an easier middle of the run. Each part is marked **Decided** (Wyatt has said yes), **Proposed** (a suggestion waiting on Wyatt) or **Open** (still to work out). The other tabs still describe the game before the overhaul. Where Phase 10.6 changes them, this tab wins.

## The overhaul, in phases

1. **Phase 10.6: Simplify** (being built now): the difficulty setup and challenge density, removing Wonders and Trials, the simpler weather, food, portable shelters, and Rednose. The exact rules are in the next section.
2. **Phase 10.7: Hikers**: one starting trait picked from a short list, skill trees, party XP, morale types and the new trinkets. Wyatt and Claude design this first.
3. **Phase 10.8: Challenges and opportunities**: the minigame library and the first set of challenges.
4. **The UI overhaul** (Phase 12): hiker frames, crafting, poster-style windows and animations.

Morale types wait for Phase 10.7 because they change every hiker's data, and so do the skill trees, so both change at once.

## Phase 10.6: Simplify (being built now)

Numbers in \[brackets\] are first guesses.

**Difficulty**

- One difficulty setup holds every number difficulty will change. For now the game always plays on Medium, and there's no difficulty choice for players yet.
- **Share of plain tiles with a challenge:** Easy ¼, Medium ½, Hard ¾, Nightmare all. Plain tiles are every tile except the trailhead, the checkpoint and special spaces, which keep working as they do now.
- **Opportunities per section, on plain tiles without a challenge:** Easy \[3\], Medium \[2\], Hard \[1\], Nightmare none.
- Every other plain tile is a quiet step: no challenge, just scavenging.
- Section length, challenge tier, luck, rarity and the rest are in the setup too, all at today's values until difficulties are built.

**Removed for now**

- **Wonders:** they no longer appear. The code and data stay, switched off.
- **Trials:** out of the challenge pool, including Rocco's. They come back only if they fit the new challenges.
- **Storm and Fog:** gone from the weather. They may come back later as special weather, along with a rare Solar Eclipse.
- **Rednose** (Redolf) has no effect for now. Its text reads "Placeholder text" until the Phase 10.7 trait rework.

**Weather**

- **Kinds:** Clear, Rain, Snow, Wind and Heatwave.
- **The only effect is on scavenging,** with each kind tied to a node:

  | Weather | Node |
  | --- | --- |
  | Rain | River |
  | Snow | Mountain |
  | Wind | Forest |
  | Heatwave | Wildlife |

  - On a tile with that node, its resources are \[1.5×\] as likely.
  - On any tile, each resource card has a \[10%\] chance to be one of that node's resources instead, even if the tile doesn't have the node. These cards show a small weather icon.
- **No other weather effects:** weather no longer gives conditions, changes nodes or picks challenges. The conditions themselves stay, for challenges and items.
- The 3-day forecast stays. Weather lasts \[1–3\] days. Until biomes are built, every section uses the Meadow odds: Clear \[40%\], Rain \[25%\], Wind \[20%\], Heatwave \[15%\].
- **Wind** is new. It needs an icon, and on the illustrated map leaves drift across the land.

**Food**

- **Only these 9 foods for now.** Every other food is switched off: it's out of crafting, scavenging, shops and rewards, but any already in a pack still works.

  | Food | Tier | Bites (Quality 1–5) | Each bite |
  | --- | --- | --- | --- |
  | Trail Mix | 1 | 2/3/3/3/4 | +2 Appetite, and Lucky this phase |
  | Costco Sample | 1 | 2/3/3/3/4 | +2 Appetite. A 35/45/45/45/55% chance not to use up the bite, and a 15% chance of a random positive condition for 1 phase |
  | Dog Food | 1 | 2 | Dogs +3 Appetite, anyone else +2. The first bite also gives Dogs +1 Morale and anyone else −1 |
  | Mystery Meat | 1 | 1 | +2 to 10 Appetite (random), and a 60/50/50/50/40% chance of a random negative condition for 3/2/2/2/1 phases |
  | S'mores | 1 | 2 | +2 Appetite. At night, +1 more Appetite and +1 Morale |
  | Jerky | 2 | 3/3/4/4/5 | +2 Appetite. Never loses Appetite value (flies, night events) |
  | Fish and Chips | 2 | 2 | +2/3/3/3/4 Appetite. The first bite also gives +1 Morale |
  | Rotisserie Chicken | 3 | 3/4/4/4/5 | +3 Appetite. **A camp meal:** any hiker on the same tile can eat a bite of it, without trading for it first |
  | Din Tai Fung | 3 | 4/5/5/5/6 | Appetite equal to the bites left, counting this one |

- **At Quality 1:** extras are lost as before (no Lucky, no positive condition, no Morale), and plain food has a \[20%\] chance of Food Poisoning.
- **Starting bags** with a food that's switched off get Trail Mix instead.
- **The target:** one scavenge and one craft feed about 3 actions. Tune from playtests.

**Portable shelters**

- **A shelter rides in a pack** and takes 1 item slot.
- **Set up** is a free action on your tile, and uses 1 **deployment**. While it's up, it takes no slot, and every hiker on the tile is sheltered:
  - sleeping gives +1 Energy;
  - they're safe from night events;
  - plus the shelter's own effect.
- **Pack up** is a free action. Any hiker on the tile with room can do it.
- **When the hiker who set it up leaves the tile,** it packs itself into their pack if there's room. If there isn't, it stays up until someone packs it.
- **Only 1 shelter can be up on a tile.** A shelter with no deployments left is thrown away when it's packed.
- **Recipes cost 1 less** \[first guess\]: each loses 1 "any" resource.
- **Deployments** (the old number of nights + 1):

  | Shelter | Deployments | Shelter | Deployments |
  | --- | --- | --- | --- |
  | Hammock | 2 | Hostel | 5 |
  | Tent | 4 | Tree-House | 5 |
  | Cabin | 5 | RV | 5 |
  | Tailgate | 4 | Medic Tent | 4 |
  | Yurt | 5 | Lodge | 6 |

- Campsite spaces still have their built-in shelter.

**Also in this update:** the map edge and the "Show whole map" setting for the illustrated map, and a fix for cards and tooltips cut off at window edges.

## Difficulty (later)

**Decided**

- Difficulty settings (Easy, Medium, Hard, Nightmare) come once the core loop is done. They change section length, the share of tiles with a challenge, how many opportunities there are, how hard challenges are, luck and rarity, and more as we find them.
- Longer sections on harder settings keep the opportunity counts balanced.

## Challenges and opportunities (Phase 10.8)

**Decided**

- **Fewer challenges, each one fun.** Most challenges become short minigames, built from a small library of base games. Each base game gets several "skins": the same game, set up differently for different challenges.
- **Prepare:** hikers can spend resources or items before a minigame to make it easier, and the right spend can skip it completely.
- **Stakes:** failing costs something that fits the challenge. Flies: each fly that reaches you takes 1 bite of each food.
- **Party size matters,** so one hiker can't tank every challenge alone:
  - some games get easier with more hikers (Memory: more turns);
  - some get harder (Snake: a longer snake);
  - some are both (Minefield: more things to find, but more chances; each hiker who hits a mine is punished, and the whole group gets a worse penalty if everyone fails).
- **Penalties that reach past the tile,** so tanking a challenge alone isn't free: add challenges to tiles behind or next to it, lower the whole party's luck, or give a condition that spreads to hikers who share a tile.
- **No Auto button for now.** Maybe later, once we know how hard the games are.
- **Opportunities** use the same games with rewards (fishing, catching acorns, the spinning line).
- **Trials are removed** until the new challenges exist. Then we decide whether they fit.

**The minigame library** (first list; every game must work with taps alone on a phone)

| Base game | How it plays | Skins |
| --- | --- | --- |
| Barrels | Hide hikers behind barrels or rocks, or guess which one hides something, over a few rounds | Bear with Gun: hide behind 3 barrels for 3 rounds; the bear hits everyone behind the barrel it shoots (Bear with a Sword hits only the hiker in front). Spend resources to add barrels (up to 6) or cut rounds (down to 0, skipping it). Squirrel Theft: guess which barrel the squirrel is behind to get your caps back; spending removes barrels or adds guesses. |
| Snake | Steer a snake around a small field | Collect a number of things; survive for a set time. Longer with more hikers. |
| Minefield | Uncover a grid, Minesweeper style | Find a set number of things while avoiding hazards. More hikers: more to find, more chances. |
| Memory | Match pairs within a number of turns | More hikers give more turns. |
| Puzzle | A short timed puzzle | |
| Reaction | Tap things quickly | Shrinking circles (flies, bees), the right one of two prompts, tap as fast as you can. A key to press on a computer, a button on a phone. |
| Timing | Stop a moving marker in the right spot | A Stardew-style fishing bar; a line spinning around a circle, tap when it's in the green. Challenges and opportunities. |
| Trivia | Answer a question | |
| Jumping | Flappy Bird style, or a tiny platformer | |
| Dodging | Things fall from the top | Dodge boulders; catch acorns. |

**Proposed**

- Each challenge card shows a small icon for whether it favors **solo, groups, or both**, so players can plan who goes in.
- Start with the games that are quickest to build and easiest on a phone: Barrels, Reaction, Timing, Memory and Minefield. Snake, Jumping and Trivia come after (Trivia needs a lot of writing).

## Hikers (Phase 10.7)

> Phase 10.7 replaced traits, classes and leveling for the first 6 hikers. See `09-hikers.md`, which wins where they disagree.

**Decided**

- Each hiker starts with **1 trait, picked from a short list** for that hiker (Grandpa Sherman: Trespasser or Tank Butt), plus their **morale type**. Traits are fewer but much stronger.
- **Skill trees instead of swapping traits:** every hiker has 3 routes (**Movement, Resources, Utility**), each 3 tiers deep. You can build a hiker into one archetype or spread them out to be versatile.
- **Each tree is fairly unique,** even within the same route. Grandpa Sherman's Movement route is about being a tank and moving other hikers with him; Agility Finn's is about scouting, moving alone or ahead. A few basic upgrades (like Thumbs) can appear in several trees.
- **Example, Boomerang** (a high-tier trait): the hiker moves onto the next tile, sets off its challenge alone, and once it's done, moves straight back to the tile they came from at no extra Appetite. Good for an extroverted scout like Finn who wants to charge ahead but stay with the group.
- **Party XP:** XP from every hiker fills one shared bar. Each party level-up gives points to spend on any hikers' trees.
- **Tiers unlock by party level,** so no single hiker can be maxed early. Some trees peak early, others are late-game powerhouses with a later final tier.
- **Rednose** has no effect until the rework.

**Proposed**

- Spend points at night or at a ranger station, so leveling never interrupts a move.
- Tier unlocks: Tier 1 at any level, Tier 2 at party level \[3\], Tier 3 at \[5\]; late-game trees' Tier 3 at \[7\].

## Trinkets (Phase 10.7)

> Phase 10.7 replaced traits, classes and leveling for the first 6 hikers. See `09-hikers.md`, which wins where they disagree.

**Decided:** trinkets no longer give or swap traits. They just sit in a pack and work on their own. They don't need to be equipped, and they wear out like clothes: their durability ticks down every phase, or each time they take effect, depending on the trinket.

- Example: double XP from every scavenge while it's in your pack.
- Example: extra XP each time you pass a challenge.

## Morale types (Phase 10.7)

> Phase 10.7 replaced traits, classes and leveling for the first 6 hikers. See `09-hikers.md`, which wins where they disagree.

**Decided:** morale becomes simple and consistent. Each hiker gets one morale type:

| Type | Gains Morale | Loses Morale |
| --- | --- | --- |
| Extrovert | With other hikers | Alone |
| Introvert | Alone | In a crowd |
| Ambivert | With 2–3 hikers, no more, no fewer | Alone or in a big group |
| Foody | When Appetite is high | When Appetite is low |
| Energetic | When Energy is high | When Energy is low |
| Wanderlust | Moving | Staying put |
| Homebody | Staying put | Moving |

**Proposed:** every type is checked once per night, for +1 or −1. The hiker's frame shows a small preview of tonight's change, so it's easy to plan.

## Wonders and destinations

**Decided:** Wonders are removed for now: they don't add much and you can't scavenge on them.

**Open:** bring the destinations back another way. Either special challenge runs later on, or destinations instead of biomes: Fort Rock as desert, Crater Lake mostly water and River tiles, the Swiss Alps mostly mountains.

**Proposed:** with the illustrated map, a destination is cheap to make: a node mix, a color palette, a set of stamps, and one hand-painted scene at the final checkpoint. No unique full maps needed.

## UI (Phase 12)

- **Less is more.** Fewer windows, with more information you can open when you want it.
- **Hiker frames:** small by default (a banner with the name, the portrait beside it, the stat bars below, a marker for conditions). Click the banner or the hiker on the map to expand it with traits and conditions.
- **Crafting:** Catan-style recipe lists that show every cost up front, with crafting slots at the top that you fill with resources, Minecraft style. Clicking a recipe fills the slots if you have the resources. Favorite recipes go to the top, and missing resources are shown. The scavenge screen can open the recipe book to read (not to craft).
- **Crafting deal:** a 3×3 grid of face-down cards; reveal 3 and pick one. Crafter traits can change it: a chance for cards to start revealed, more flips, a whole row, or a better middle row.
- **Art direction:** windows styled like the new map, inspired by New Deal / WPA-era National Park Service posters and Olly Moss. Crafting could look like a field book or hiking list.
- **Animations:** challenge cards slide in from the top like a dealer passing a card, then flip and zoom in. Scavenge cards slide in with small offsets and tilts. Rare face-down cards glow (faint for bundles and choices, bright or rarity-colored for special items). Each item type gets its own crafting animation.

## Open questions

- How many hikers each shelter covers, if a limit is needed after playtesting.
- The full food list beyond the first 9.
- Each hiker's starting-trait choices, morale type and skill tree (Phase 10.7 design).
