# Phase 11: the core loop

Wyatt (November 27): before the UI overhaul, he wants "a more polished gameplay loop first". This file is the rules side of that:
1. **Work costs Energy, moving costs Appetite** (section 1), and sleep gives more back (section 2).
2. **Drinks restore Energy, food restores Appetite** (section 3).
3. **Crafters get a leveled chance to craft for free** (section 4).
4. **Half the map is challenges, the rest is empty** (section 5).
5. **Every challenge is a minigame** (section 6). Four new quick games are in `30-quick-minigames.md`.
6. **Hikers start with nothing: the packing machine is the whole start** (section 7).
7. **The slots wait for the player to press** (section 8).
8. **A run clock**, to aim for Wyatt's run lengths (section 9).

The new item cards are in `31-trailmate-item-cards.md`.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Ideas marked *(Claude's idea)* are mine; the rest is Wyatt's.

**Build on top of `phase-10.9-packing-screen`** (sections 7 and 8 change it).

---

## 1. Work costs Energy, moving costs Appetite
Wyatt: "working should be energy, and moving should be appetite. Let's make crafting also cost 1 energy for now." Right now Energy only drops when a hiker skips sleep or gets punished, so it barely matters.

| Action | Now | New |
| --- | --- | --- |
| Scavenge | 1 Appetite | **[1] Energy** |
| Scavenge at night | +1 Appetite | **+[1] Energy** |
| A Sack's extra cards | [0] Appetite each | **[0] Energy** each |
| Tend | 1 Appetite | **[1] Energy** |
| Craft | free | **[1] Energy** (Wyatt: "for now") |
| Move, Move All, carrying, a night move | Appetite | Appetite (no change) |
| A steep line's extra | +1 Energy | no change (flag) |
| Sit by the Fire, Keep Watch, setting up or packing a shelter | free | free (no change) |

### In the code
- **Cost keys:**
  - rename `scavenge.appetite` to `scavenge.energy`;
  - rename `tend.appetite` to `tend.energy`;
  - add `craft.energy`, paid when the craft happens (a Workbench visit too).
- **`balance.ts`:**
  - `scavenge.appetite` becomes `scavenge.energy: 1`;
  - `night.scavengeExtraAppetite` becomes `night.scavengeExtraEnergy: 1`;
  - `abundance.tendAppetite` becomes `abundance.tendEnergy: 1`;
  - `items.sackAppetite` becomes `items.sackEnergy: 0`;
  - add `items.craft.energy: 1`.
- **Running out:** no change. Paying a stat down to 0 still gives an injury and raises every stat below 5 back to 5 (Wyatt, November 5).
- **Plush hikers** share one Stuffing bar, so for them nothing changes.

### Things whose words and cost keys change
Everything that made scavenging or tending cheaper in Appetite now works on Energy:

| Thing | New words |
| --- | --- |
| Jeans (clothes) | "Scavenging costs 1 less Energy; each time, it loses 1 durability." |
| Shovel (tool) | "Scavenging this phase costs no Energy." |
| Pirate (trait) | "Scavenging alone costs no Energy." |
| Rabbit Diet (trait) | "Scavenging costs no Energy, but can't eat food cards. Can eat 1 Forest resource for 1 Appetite." |
| Copydog III (Finn) | Its first-scavenge discount is now Energy. |
| Refreshed and Full (conditions) | `OWN_COSTS` in `conditions.ts`: move `scavenge` and `tend` to the Energy list, and add `craft.energy`. Refreshed stops Energy costs and Full stops Appetite costs, as before. |

- **Search for the rest:** grep for `scavenge.appetite`, `tend.appetite`, and "Appetite" near "scaveng" or "tend" in item, trait, card and help text.
- **The UI:** every cost preview, button label, tooltip and help line for these actions.
- **The docs:** update the actions table in `01-design-doc.md` ("Days, phases and actions").

---

## 2. Sleep gives more back
Wyatt wants shelters to matter through sleep Energy. Now that work costs Energy, sleep has to give more of it back.

| | Now | New |
| --- | --- | --- |
| Sleep | +1 Energy | **+[2] Energy** |
| Sleep in a shelter | +2 Energy | **+[4] Energy** |
| A night without sleep | −2 Energy | −2 Energy (no change) |

- The Cabin, RV and Hostel extras still add on top (`items.shelters.sleepEnergy`, `hostel`).
- **The rough budget** *(my math)*: a hiker who works in the Morning and Afternoon spends 2 Energy a day, so plain sleep about breaks even, and a shelter gets them ahead. Drinks (section 3) top up the rest.

---

## 3. Drinks restore Energy, food restores Appetite
Wyatt: "split food items into drinks and food: drinks restore energy, and food restores hunger."

### Drinks
- **A drink is still a food** (type `food`), so eating, crafting, the bag, the scavenge tables and the packing machine all work as now.
- **Add `drink: true`** to its definition.
  - Its card says DRINK, counts SIPS instead of BITES, and has its own look (`31`, section 4).
  - The button and ask say "Drink the Coffee?" instead of "Eat".
- **Switch these six on** (add them to `FOODS_ON`), with their Appetite swapped for Energy:

| Drink | Tier | Now | New |
| --- | --- | --- | --- |
| Coffee | I | +1 Appetite[, Energized for {phases} phase{phases:s}] | **+[2] Energy**[, Energized for {phases} phase{phases:s}] |
| 7-Up | I | +1 Appetite[, and remove {cure} random negative condition] | **+[1] Energy**[, and remove {cure} random negative condition] |
| Citro Drink | II | +1 Appetite[, 2 stacks of Energized for {phases} phase{phases:s}] | **+[2] Energy**[, 2 stacks of Energized for {phases} phase{phases:s}] |
| Wine | II | +{appetite} Appetite, then Lucky or Unlucky for 1 day | **+{energy} Energy**, then Lucky or Unlucky for 1 day (the same values, renamed `energy`) |
| Piña Colada | II | +{appetite} Appetite, then Energized or Buzzed for 1 day | **+{energy} Energy**, then Energized or Buzzed for 1 day (same) |
| Vente Coffee Misto | III | +{low}–{high} Appetite, Energy and Morale | **+{low}–{high} Energy and +{low}–{high} Morale**, each rolled separately (the Appetite part is dropped; flag) |

- **Energy Drink stays off** until it has art.
- **The other foods** keep restoring Appetite, as now.
- **Their recipes** stay as they are. Chefs can now deal drinks among their food cards.

---

## 4. Crafters: a leveled chance to craft for free
Wyatt: crafters "could have a 25% chance to not consume energy when crafting, which could be upgraded to 50%, then 75%, then 100%." Leveled steps also give a level-1 party something to spend points on.

- **Where:** the Tier 1 step of each crafting tree, for that tree's item type:

| Hiker | Tree | Step | Type |
| --- | --- | --- | --- |
| Ellie | Chef | Garbage Connoisseur | food |
| Gdog | Chef | Family Cookbook | food |
| Gdog | Tailor | Clothing Catalogue | clothes |
| Grandpa Wink | Architect | Floor Plans | shelters |

- **Levels:** the same pattern as Game Sight (`26`, section 5.1). The step is learned at level 1, and pressing it again raises it.

| Level | Chance that crafting that type costs no Energy | Cost |
| --- | --- | --- |
| 1 | [25%] | the step's own |
| 2 | [50%] | [1] point (`trails.cost.level`) |
| 3 | [75%] | [1] point |
| 4 | [100%] | [1] point |

- **The words** (added to each step's text; the changed part is yellow at each level):
  - Garbage Connoisseur: "…Crafting food has a 25% chance to cost no Energy."
  - Family Cookbook: "Learn 3 random food recipes. Crafting food has a 25% chance to cost no Energy."
  - At level 4: "Crafting food costs no Energy."
- **Gift steps:** Family Cookbook, Clothing Catalogue and Floor Plans become passive steps that still give their recipes when learned (`onLearn`, like Packed Toolbox). Picked at the start, they read: "Start with 3 random food recipes. Crafting food has a 25% chance to cost no Energy."
- **Upgrades keep the level:** Garbage Connoisseur II and III replace I. Like Game Sight II, they keep the chance at the level reached ("As Garbage Connoisseur…").
- **When it works:** a short note, like other trait procs: "Family Cookbook: no Energy."
- **`balance.ts`:** `trails.freeCraft.chance: [0.25, 0.5, 0.75, 1]`.
- **Later:** Muffin (Crafter) and the other hikers get the same thing when their trees are made.

---

## 5. The map: half challenges, the rest empty
Wyatt: "only about 50% of the spaces are occupied by challenges, with the rest being empty. We'll incorporate opportunities later."
- **`difficulty.ts`:** `challengeShare: [0.5]` and `opportunitiesPerSection: 0` on every difficulty, for now.
- **The empty tiles** are quiet steps, as now: no challenge, just scavenging.
- **Opportunities** stay in the code, switched off.
- **Difficulties** still differ in section rows. They'll get more differences later (flag).

---

## 6. Every challenge is a minigame
Wyatt: "Honestly the minigames are much more fun… every challenge is a minigame."
- **The pool** (`challenges/pool.ts`): the cost-card share ([40%, 30%, 25%] by biome) becomes 0. Every challenge tile gets a minigame challenge.
- **Four cost cards become quick minigames** with the same names (`30-quick-minigames.md`):
  - Incoming Bike!
  - Wrong Turn
  - Fallen Branch
  - Snagged Pack
  - Each keeps its card's art, nodes and punishment (`penaltyText`). Their "pay the cost" option is replaced by Prepare and playing.
- **The other 18 cost cards retire for now.** Keep their code and data, switched off (like the disabled foods), so they can come back as minigames or opportunities.
- **Choice spaces** still offer two different minigames.
- **Game Sight III** says "and it reveals cost cards too". With no cost cards, that part does nothing for now (flag).

---

## 7. Hikers start with nothing: the packing machine is the whole start
Wyatt: "let's get rid of the starting items for hikers, and make it purely based on slots."
- **`roster.ts`:** remove every item from every hiker's `startingBag`.
  - **Blueprints and recipes stay:** Mom (1), Gdog (2 food), Muffin (1 tool), Catie (1), Erin (1 shelter), Lelf (1 tool).
  - **Holiday presents stay** (Grammy Clause, Grinch): they're gifts to hand out, not a starting kit *(Claude's reading; flag)*.
- **Hiker cards** (`cardData.ts`, `bagWords`): show blueprints only, or no bag line when it's empty.
- **Packed Toolbox** (Grandpa Wink's Packer, Tier 1):
  - **picked at the start:** the party gets **+[2] item picks** on the packing machine, instead of 2 random tools. Its start text: "Start with 2 more item picks when packing." *(Claude's idea: it keeps the start purely slots.)*
  - **learned later on the trail:** no change (2 random Tier 1 tools).
- **The packing screen** (branch `phase-10.9-packing-screen`):
  - `seatsFor`'s START items will now always be empty. Remove the START mark from the hiker cards if nothing else uses it.
  - The picks become `2 + party size (+2 with Packed Toolbox)`.
- **Tests and the test-hike picker:** `createGame` without packing now starts with empty bags. Fix any test that relied on a kit item.
- **The docs:** update "Starting bags" in `07-characters.md`, and "Starting traits and kits still apply" in `27-packing-screen.md`, section 1.

---

## 8. The slots wait for the player to press
Wyatt: "don't have the slots automatically start, have the player press them first."
- **On the branch:** `useDirector.ts` ends three places with `await wait(250); this.pull();`:
  - `start()` (the first spin of the items step);
  - the Second Wind / REBOOT branch;
  - `startTurn()` (each hiker's resource turn).
- **Instead:** leave the free spin armed and wait. Nothing spins until the player pulls the pole, presses SCAN, or presses Space.
- **What the player sees while it waits** (see the prototypes):
  - **TrailMate:** the screens are empty and read READY, the top line says PRESS SCAN, the SCAN button glows, and the side tag says "FREE SCAN! PRESS SCAN, PULL THE ANTENNA, OR PRESS SPACE".
  - **Cabinet:** a blinking sign over the empty reels, "PULL THE POLE / FREE SPIN · OR PRESS SPACE", and the side tag says "FREE SPIN!".
- **The reels come back empty** after Second Wind and at each new turn, so nothing old can be taken before the free spin. (The branch's `logic.ts` already does this; the prototypes now match.)
- **The free spin still costs nothing.** Respins after it work as before.
- **Update `27-packing-screen.md`:** section 3 ("The first spin is free and starts by itself") and section 4 ("The next turn starts by itself").
- **"Skip packing"** in the testing tab still picks everything at once.
- **Screenshots:**
  - `mockups/packing/00-press-to-start.png`, `12a-resources-press.png`;
  - `mockups/packing-trailmate/00-press-to-start.png`, `12a-resources-press.png`.
  - The rest of both sets were re-taken with a press before each free spin.

---

## 9. A run clock
Wyatt's targets: **Easy about 30–45 minutes, Medium about an hour.** Right now it's hard to tell how long a run takes.
- **The debug panel** shows:
  - the run's clock (real time played, paused while the game is in the background);
  - each section's time;
  - each minigame's time, with its name and tier.
- **When a run ends,** log a short summary to the console: the total, each section, the 5 longest minigames, and the difficulty.
- **`balance.ts`:** `run.targetMinutes: { easy: [30, 45], medium: [55, 65] }`, shown in the debug panel next to the clock.
- **Tuning comes after playtests:** section rows, how many sections, and the quick games' lengths.

---

## 10. Tests
- **Costs:**
  - scavenging, tending and crafting take Energy, not Appetite;
  - a night scavenge takes the extra Energy;
  - moves still take Appetite;
  - Jeans, Shovel, Pirate, Rabbit Diet, Copydog III, Refreshed and Full work on the new keys.
- **Sleep:** +2, and +4 in a shelter (with the Cabin, RV and Hostel extras on top).
- **Drinks:**
  - the six are on, and Energy Drink is off;
  - each gives Energy and no Appetite;
  - the `drink` flag is set on exactly those seven.
- **Free crafting:**
  - with a seeded RNG, each level's chance lands near 25/50/75/100%;
  - only that step's type is free;
  - Garbage Connoisseur II and III keep the level;
  - Family Cookbook still gives its recipes.
- **The map:**
  - about half the plain tiles hold a challenge, at every difficulty;
  - no cost card and no opportunity is ever placed.
- **Starting bags:** no hiker starts with an item; blueprints still arrive. Packed Toolbox at the start adds 2 picks.
- **The packing machine:** nothing spins until the first pull; each turn and each Second Wind waits too.

---

## 11. Things to flag to Wyatt
- **Steep lines** still add +1 Energy. Keep that (climbing is work), or make it Appetite?
- **Vente Coffee Misto** loses its Appetite roll, so it's Energy and Morale.
- **Signature items are gone with the kits.** Some hiker versions were built around theirs:
  - Prepared Wink (Tent, Binoculars, Scanner), Graduate Mom (Diploma, Wallet), Showqueen Gdog (Fancy Attire), Wywee (Trooper Mask), Ellie the Devourer (2 Dog Food), Follower Finn (Sack);
  - Leash, Postcard, Diploma, Wallet, Jogging Shoes, Fancy Attire and Trooper Mask can't come up on the packing machine (trinkets and Tier III), so for now nobody can start with them.
- **Holiday presents** stay. Is that right?
- **Packed Toolbox** at the start gives +2 picks instead of 2 tools *(my idea)*.
- **Game Sight III** has nothing extra to reveal until opportunities come back.
- **Difficulties** all have the same challenge share for now.
- **Punishments that cost Energy** hurt more now that work costs Energy.
- **Numbers to try:** sleep +2/+4, craft 1 Energy, Coffee +2, 7-Up +1, Citro +2.

---

## 12. Next: Phase 12, the UI and sound (not in this update)
Wyatt wants this soon after. The design comes next, in its own update:
- **The main screen:** the UI takes less room from the background, is more optional, and hides more often.
- **Clicking a hiker's icon on a tile selects them.**
- **Scavenging and crafting** get the packing machine's excitement.
- **Transitions** between the start screen, starting a hike and the Ranger Station, and **loading screens**.
- **The two styles** the game blends: the New Deal park posters and the TrailMate GPS tech (the item cards in `31` are the first piece).
