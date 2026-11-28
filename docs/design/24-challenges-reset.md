# The challenges, reset: categories, punishments, costs and the new list

Wyatt's overhaul of challenges (November 26), after playtesting. It replaces the challenge list in `04-challenges.md`: the old challenges are retired (opportunities and Trials stay as they are). How these run on the trail map is in `25-challenges-on-the-map.md`.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Wyatt: "We can make general guesses to costs and things so far, and then choose them after playtesting." Ideas marked *(Claude's idea)* are mine; the rest is Wyatt's.

Wyatt: "challenges with specific costs, especially early on, were not great." So:
- costs are more general and fit the party you actually have;
- **failing always costs something**, from one short list of punishments;
- resources fall into categories, so hikers can stock up for what's coming.

---

## 1. Resource categories (Wyatt)
Five groups. A resource in two groups can pay for either, but one resource only pays one cost.

| Category | Resources | What it does in minigames |
| --- | --- | --- |
| **Food** | Meat, Fish, Mushroom, Salt | Slows things down: slower attacks, more time (Wyatt: "slow the attack speed in Dodge"). |
| **Building** | Wood, Stone, Metal, Clay | Builds or breaks things: a sturdier bridge or raft, pieces placed for you, fewer right answers needed to pass (Wyatt: trail signs, Traildle, the bridge). |
| **Fiber** | Grass, Moss, Fur, Seaweed | Padding and rope: +hearts, +lives, +tries, softer falls. *(Claude's idea)* |
| **Fire** | Wood, Oil, Flint | Light, smoke and heat: lanterns at night and in fog, smoke for bees and flies, warmth in snow. |
| **Trinkets** | Shell, Bones, Metal | Lures and luck: shiny bait, trail markers, a free mistake. |

- **Wood** is Building and Fire. **Metal** is Building and Trinkets.
- **Nodes** (Forest, River…) still decide where a challenge can appear. Costs stop using node groups like "×2 Forest resources" and use categories instead *(Claude's reading)*.
- **Why categories** (Wyatt): hikers can plan, for example by always keeping some Wood and Mushrooms for the challenges they expect. The Trail Infoboard (`25-challenges-on-the-map.md`) tells them what to expect.

---

## 2. Punishments: one short list, and failing always costs (Wyatt)
Every challenge's punishment comes from this list:

| Punishment | What happens | Tier I | Tier II | Tier III |
| --- | --- | --- | --- | --- |
| **Energy** | lose X Energy | X[1–2] | X[2–3] | X[3–4] |
| **Appetite** | lose X Appetite | X[1–2] | X[2–3] | X[3–4] |
| **Bleeding** | Bleeding for Y phases; when it runs out, it becomes an injury unless it's treated | Y[2] | Y[2–3] | Y[3] |
| **Injury** | gain 1 injury | Tier II and up | | |
| **Go back** | move back to the tile you came from, **plus** one other punishment | | | |
| **Random resources** | lose X random resources | X[1–2] | X[2–3] | X[3–4] |
| **Singles** (Wyatt) | lose every resource you only have 1 of | | | |
| **Big stacks** (Wyatt) | lose 1 of every resource you have 3 or more of | | | |
| **Your most** (Wyatt) | lose half (rounded up) of the resource you have the most of; at Tier III, all of it | | | |
| **A category** | lose X of one category (for example, X Food) | X[1–2] | X[2–3] | X[3–4] |

**The rules:**
- **Always a punishment.** Every card has one from the list. A condition (Sluggish, Brain Fog…) can be added for flavor, but never on its own.
- **The backup rule** (Wyatt: "if it's something specific, make a secondary effect like an injury or losing energy"):
  - when a punishment takes something the hiker (or party) doesn't have enough of, each missing one becomes **1 Energy** instead;
  - a punishment that ends up taking nothing at all (no singles, an empty pack) costs **X Energy** for the tier instead;
  - a hiker who would go below 0 Energy gains **1 injury** instead (once per challenge).
  - So "lose all your Mushrooms" can't be dodged by having none.
- **Who gets it:** on a party card, every hiker on the tile is punished, unless it says "across the party". On an each-hiker card, only the hikers who failed.
- **Tiers IV and V** scale the ranges up, as now.
- **Minigames:** the challenge's punishment replaces the game's default fail cost (the default stays for the testing tab).
  - **Passing challenges:** hikers who fail **go back** and take the challenge's punishment. That's Wyatt's "going back + one of the others".
  - **Other games:** each hiker who fails takes the punishment.

---

## 3. Costs on cards: general first (Wyatt)
A cost card is a challenge with no minigame (the cost cards themselves are in section 4). When it's revealed, the party (or each hiker) either pays the cost or takes the punishment.

**The cost list:**

| Cost | Example |
| --- | --- |
| **Any resources** | "Spend X resources (any mix)." |
| **Your most** (Wyatt) | "Spend X of the resource you have the most of." For a party card, it's the party's most on this tile. |
| **Singles** (Wyatt) | "Spend every resource you only have 1 of (at least 1)." |
| **Big stacks** | "Spend 1 of every resource you have 3 or more of." |
| **A matching set** | "Spend X of the same resource." |
| **Variety** *(Claude's idea)* | "Spend 1 each of X different resources." |
| **Mixed bag** *(Claude's idea)* | "Spend 1 from each of X different categories." |
| **Picked from your packs** (Wyatt) | When it's revealed, the card picks X resources the hikers on this tile actually carry: "Spend 1 of each." |
| **A category** | "Spend X Food (any mix)." |
| **Stats and other** | Energy, Appetite, Morale; caps; food cards; items, tool uses, clothing durability. |

**By tier:**
- **Tier I:** only general costs: any resources, your most, singles, big stacks, a matching set, variety, picked from your packs, stats and caps.
- **Tier II:** adds categories.
- **Tier III:** may name a resource or an item (Salt for Leeches), always with another way to pay beside it.
- **Every card offers [1–2] ways to pay.**

---

## 4. The challenge list (Wyatt: reset)
Wyatt: "I don't want to use all of the old ones." The old list of 71 is retired.

**The new rules:**
- **A minigame challenge is named after its game,** or has a name of its own: Broken Trail Signs (Traildle), False Trail Signs, and **"___ Attack!"** for every Dodge animal (Bear Attack!).
- **One challenge per game.** When a game has versions, the tile decides which one plays (Wyatt). For example, Trail Blocked! is a fallen tree on a Forest tile and a rockslide on a Mountain tile.
- **Repeats are fine now**, so there are fewer challenges: 45 minigames and 22 cost cards (49 and 18 since Nov 27, when four cost cards became quick minigames). Each biome's pool (`25-challenges-on-the-map.md`, section 1) picks 3 to 7 of them.
- **Tiers:** a minigame challenge can show up at any tier from its "From" tier on, and plays at the tile's tier. Dodge animals play at the level the tier gives them.
- **Art for now:** reuse Wyatt's old challenge art where it fits (the file in `assets/challenges/`), until posters are painted.
- **Punishments** come from section 2. "Passing" challenges send failed hikers back first.
- **No risk cards for now** (Wyatt). Risk cards keep working in code, but none are in the list.

### Movement and dodging
| Challenge | Plays | Nodes | From | If failed | Art for now |
| --- | --- | --- | --- | --- | --- |
| Bee Attack! | Dodge: Bees | Forest, Wildlife | I | Lose X Energy | bee-trouble |
| Squirrel Attack! | Dodge: Squirrel Army | Forest | I | Bleeding for Y phases | squirrel-ambush |
| Ant Attack! | Dodge: Ants | Forest, Wildlife | I | Lose X Food (they carry it off) | ants-are-marching |
| Eagle Attack! | Dodge: Eagle at Tier I, Toupeeagle at II, Freeagle at III and up | Mountain, Wildlife | I | Lose X random resources | majestic-eagle, toupee-eagle, freeagle |
| Bobcat Attack! | Dodge: Bobcat | Forest, Wildlife | II | 1 injury | bobcat |
| Bear Attack! | Dodge: Bear (armored at Level 3) | Forest, Wildlife | II | Bleeding for Y phases; at Tier III and up, 1 injury too | bear, armored-bear |
| Sword Bear Attack! | Dodge: Bear with a Sword | Forest, Wildlife | III | 1 injury | bear |
| Gun Bear Attack! | Dodge: Bear with a Gun (the old Bear Country) | Forest, Wildlife | III | 1 injury, and Bleeding for Y phases | bear-with-a-gun (poster: bear-country) |
| Stampede! | Dodge: Wild Predator Stampede | Wildlife | III | 1 injury, and lose X random resources | stampede |
| Snow Leopard Attack! | Dodge: Snow Leopard | Any (snow only) | III | 1 injury | snow-leopard |
| Snowgirl Attack! | Dodge: Abominable Snowgirl | Any (snow only) | III | 1 injury, and lose X Food (she eats your snacks) | abominable-snowgirl |
| Stay on the Trail | Trails: Forest Path (Forest, Wildlife), Riverbank (River), Switchbacks (Mountain, Tiers I and II), Ridgeline (Mountain, Tier III and up). Passing | Any | I | Go back, and lose X Energy | winding-trail, steep-switchbacks, sharp-wind |
| Crossing | Crossings: road (Forest, Mountain), river (River), critters (Wildlife). Passing | Any | I | Go back, and lose X random resources | dangerous-current |
| Sketchy Bridge | Sketchy Bridge. Passing | River | I | Whoever breaks it: Bleeding for Y phases (1 injury from Tier III). Those behind: go back, and lose 1 Energy | cracked-bridge |
| Camp Cleanup | Camp Cleanup | Forest, Wildlife | I | Lose X random resources | none yet |
| Rafting | Rafting. Passing, the whole party | River | II | Everyone goes back, and loses X random resources | flash-flood |
| Train! | Train!. Passing | Forest, Mountain | II | Go back, and lose X Energy | train |
| Rock Climb | Rock Climb. Passing | Mountain | II | Go back (each fall already cost 1 Energy) | group-climb |
| Falling Rocks | Falling Rocks. Passing | Mountain | II | Go back, and Bleeding for Y phases (1 injury from Tier III) | rockfall |

### Puzzle and logic
| Challenge | Plays | Nodes | From | If failed | Art for now |
| --- | --- | --- | --- | --- | --- |
| Broken Trail Signs | Traildle | Any | I | Lose X Energy | none yet |
| False Trail Signs | Fake Trail Signs | Any | I | Lose X Energy, and Brain Fog for 1 day | false-trail-markers |
| Lost Trail | Find the Path (fog from Tier III) | Forest, Mountain | I | Lose X Energy | split-path, foggy-hollow |
| Tangled Trails | Trail Map | Any | I | Lose X Energy | none yet |
| Torn Postcards | Picture Puzzle | Any | I | Lose X random resources | tourist-trap |
| Cracked Pots | **Cracked Pots** (new, section 7) | River | I | Lose X Food | cracked-pots |
| Dog Waste Zone | Minefield (only with a Dog on the tile) | Forest, Wildlife | I | Lose X Appetite, and Nauseous for 1 day | dog-waste-zone |
| Torn Pack | Pack It Up | Forest, Wildlife | II | Lose X random resources | torn-pack |
| Snagged Pack | **Snagged Pack** (was a cost card; `30-quick-minigames.md`, section 4) | Forest, Wildlife | I | Lose X random resources (they fall out) | torn-pack |
| Thin Ice | Thin Ice (crossing). Passing | River (snow only) | III | Soaked for Y[2–3] phases, and lose X Energy | thin-ice |

### Memory
| Challenge | Plays | Nodes | From | If failed | Art for now |
| --- | --- | --- | --- | --- | --- |
| Follow the Ranger | Remember the Path | Any | I | Lose X Energy | rangers-request |
| Snack Match | Memory Puzzle | Any | I | Lose X Food | tummy-rumbling |
| Safari | Safari | Wildlife | I | Lose X random resources | handsome-boy |
| Crossroads | Crossroads (a whiteout in snow) | Forest, Mountain | I | Lose X Energy | split-path, blinding-snow |
| Birdsong | Birdsong | Forest, River | I | Lose X Energy | warning-bird |

### Search
| Challenge | Plays | Nodes | From | If failed | Art for now |
| --- | --- | --- | --- | --- | --- |
| Snack Hunt | Find the Object | Any | I | Lose X Appetite | rocks-that-look-delicious |
| Spooky Ghost! | **Spooky Ghost!** (new, section 6) | Forest, Mountain | I | Lose X Energy, and Nightmares for 1 night | spooky-ghost |

### Reaction and timing
| Challenge | Plays | Nodes | From | If failed | Art for now |
| --- | --- | --- | --- | --- | --- |
| Trail Blocked! | Trail Blocks: Chop Tree (Forest), Mine Rockslide (Mountain), River Flood (River), Clearing Animals (Wildlife). Passing | Any | I | Go back, and lose X Energy | withered-forest, rockslide, beaver-dam, furry-pack |
| Sleeping Bear | Sleeping Bear. Passing | Forest, Wildlife | I | Caught: go back, and Bleeding for Y phases | the-grim-sleeper |
| Fly Block | Fly Block | Forest, Wildlife | I | Lose X Appetite | flies |
| Fly Swatter | Fly Swatter | Forest, River | I | Lose X Energy | mosquito-swarm, gnats |
| Squirrel Theft | Squirrel Theft | Forest | I | What it stole is lost | annoying-squirrel |
| Raccoon Shuffle | Raccoon Shuffle | Forest, Wildlife | I | The raccoon steals what's on its card | shell-game |
| Whackoon | Whackoon | Forest, Wildlife | I | Lose X Energy | none yet |
| Trail Blazes | Trail Blazes | Forest | I | Lose X Energy, and Bored for 1 day | straight-path |
| Firefly Catch | Firefly Catch | Forest, River | I | Lose X Energy, and Sleepy for 1 day | long-night-ahead |
| Size Up | Size Up | Any | I | Lose X random resources | none yet |
| Incoming Bike! | **Incoming Bike!** (was a cost card; `30-quick-minigames.md`, section 1) | Forest, River | I | Go back, and lose X random resources (knocked loose) | incoming-bike |
| Wrong Turn | **Wrong Turn** (was a cost card; `30`, section 2). Passing, the whole party | Forest, Mountain | I | Everyone goes back, and loses X Appetite | split-path |

### Rhythm
| Challenge | Plays | Nodes | From | If failed | Art for now |
| --- | --- | --- | --- | --- | --- |
| Fallen Branch | **Fallen Branch** (was a cost card; `30`, section 3). Passing, the whole party | Forest | II | Everyone goes back, and loses X Energy | withered-forest |

### Cost cards (18)

**Switched off Nov 27 (`29-core-loop.md`, section 6):** every challenge is a minigame for now. Incoming Bike!, Wrong Turn, Fallen Branch and Snagged Pack came back as quick minigames with the same names (`30-quick-minigames.md`), so they're in the tables above now (their old costs are in git history); the other 18 keep their data, switched off.
Wyatt: "Make the cost ones basic problems you might experience. About 20 in total." No risk cards for now: the weather ones (Blazing Sun, Storm, Lightning, Hypothermia) are out.

- **How a cost card works:**
  - when it's revealed, the hikers it judges either pay the cost or take the punishment;
  - **Party** cards are paid once, by anyone on the tile;
  - **Each hiker** cards judge every hiker on the tile on their own, and other hikers there can chip in (as cards work today).
- **By tier:** Tier I cards use only general costs. Categories start at Tier II. Named resources and items only at Tier III, always with another way to pay (section 3).
- **Scaling:** X and Y are written for the card's "From" tier and scale up by `tierScale` for each tier above it (as cards above Tier III do today).

| Challenge | Who | Nodes | From | Cost | If failed | Art for now |
| --- | --- | --- | --- | --- | --- | --- |
| Blisters | Each hiker | Any | I | 1 of the resource you have the most of, or 2 Appetite | Lose X Energy, and Sluggish for 1 phase | none yet |
| Thirsty Trail | Party | Any | I | 1 of the party's most per hiker (traded for water) | Every hiker loses X Appetite | thirsty-trail |
| Heavy Pack | Each hiker | Mountain | I | Carry no more than [6] resources; spend the extras to pass (Rocky Path's old rule) | Lose X Energy, and Sluggish for Y[2] phases | rocky-path |
| Sunburn | Each hiker with no clothing on | Mountain, River | I | 2 of the same resource, or 1 food card | Lose X Energy | blazing-sun |
| Upset Stomach | Each hiker | Any | I | 1 food card, or 2 of the same resource | Lose X Appetite, and Nauseous for 1 day | none yet |
| Splinter | Each hiker | Forest | I | 1 tool use, or 1 of the resource you have the most of | Bleeding for Y[2] phases | none yet |
| Fox with a Specific Taste | Party | Forest, Wildlife | I | **Picked from your packs** (Wyatt): it picks X[3] resources the hikers here carry; spend 1 of each | Lose X[3] random resources across the party | fox-with-a-specific-taste |
| Tummy Rumbling | Party | Any | I | 1 food card for every 2 hikers, or 1 of the party's most per hiker | Every hiker loses Y[2–3] Appetite | tummy-rumbling |
| Tourist Trap | Each hiker | Any | I | X[1–2] caps | Go back, and lose 1 Energy | tourist-trap |
| Black Cat | Each hiker | Forest, Wildlife | I | **Singles** (Wyatt): every resource you only have 1 of | Lose X random resources, and Unlucky for 1 day. If passed: a 50% chance to be Lucky for 1 day | black-cat |
| Rolled Ankle | Each hiker | Mountain, Forest | II | X[2] Fiber (a wrap), or 3 Energy | 1 injury | steep-trail |
| Cold Snap | Each hiker | Mountain, River | II | X[2] Fire, or 2 durability from one clothing item | Lose X Energy, and Frozen for 1 phase | cold-snap |
| Allergy Season | Each hiker | Forest, Wildlife | II | X[2] Fiber, or 1 food card | Lose X Energy, and Allergies (this tile's node) for 1 day | allergy-season |
| Bug Bites | Each hiker | River, Forest | II | X[2] Fire (smoke them off), or 2 of the same resource | Lose X Appetite, and Clumsy for 1 day | mosquito-swarm |
| Crow Collector | Each hiker | Wildlife, Mountain | II | X[2] Trinkets, or X[2–3] of the same resource | Lose 1 random unequipped item (with none: X random resources) | crow-collector |
| Frozen Fingers | Each hiker (snow only) | Any | III | X[2–3] Fire, or 3 clothing durability | Lose every resource you only have 1 of (dropped), and Butterfingers for 1 day | frozen-fingers |
| Lost Map | Party | Any | III | 1 map (Supply Map or Treasure Map), or X[4–6] caps | Everyone goes back, and loses X Energy | rangers-request |
| Leeches | Each hiker | River | III | 1 Salt, or X[2] Fire (burn them off), or 3 Energy | Bleeding for Y phases, and Weak for 1 day | leeches |

---

## 5. Minigame levers: what Prepare changes, and which category pays
These replace the costs on the Prepare cards in `20-challenge-popup.md` section 7, `22-minigame-revisions.md` and `23-minigames-final.md` section 10. The effects mostly stay; the costs move to categories. Spooky Ghost! and Cracked Pots are in sections 6 and 7. Games not listed keep the cards they have.

**The pattern** *(Claude's idea)*:
- **Food:** slower, or more time. Every game has one, so Food always helps.
- **Building:** sturdier things, pieces placed for you, or a lower bar to pass.
- **Fiber:** +1 heart, life or try for a hiker you pick.
- **Fire:** light, smoke or warmth.
- **Trinkets:** lures, markers, luck, a free mistake.
- **Items** keep the strongest effects: maps, Bear Spray, Camera, Binoculars, Hiking Stick, Harness, Sack.

Each entry below reads: **CARD** (cost, slots): effect.

### Movement and dodging
- **Dodge:**
  - **FOOD** (×1 Food, [2]): slower attacks;
  - **BANDAGES** (×2 Fiber, [3]): +1 heart, for a hiker you pick (once each);
  - **SMOKE** (×2 Fire, [1]): every warning lasts [0.15 s] longer; with bees, also −1 bee per wave;
  - for some animals:
    - **BEAR SPRAY** (item; the bears);
    - **SANDBAGS** (×2 Building; Bear with a Gun): traps and holes last half as long;
    - **SALT LINE** (×1 Salt; Ants);
    - **GRIP** (boots; the snow animals and Freeagle).
- **Camp Cleanup:**
  - **FOOD** (×1 Food, [3]): +10 s, or slower;
  - **SACK** (item): −1 bag each;
  - **SHOVEL** (item): fewer obstacles.
- **Crossings:**
  - **FOOD** ([2]): slower traffic;
  - **BANDAGES** (×2 Fiber, [3]): +1 life (pick a hiker);
  - **MORE LOGS** (×2 Building, [1]; river lanes).
- **Train!:**
  - **FOOD** ([2]): slower trains;
  - **BANDAGES** (×2 Fiber, [3]): +1 life (pick a hiker);
  - **LANTERN** (×1 Fire, [1]; fog): a longer warning.
- **Rafting:**
  - **FOOD** ([2]): a slower river;
  - **BANDAGES** (×2 Fiber, [3]): +1 life (pick a hiker);
  - **STURDIER RAFT** (×2 Building, [1]): the first hit doesn't count.
- **Trails:**
  - **FOOD** ([3]): +0.5 s of bar (pick a hiker), or slower;
  - **WINDBREAK** (×2 Fiber, [1]; Ridgeline): gusts push half as hard;
  - **HIKING STICK** (item): a wider trail.
- **Rock Climb:**
  - **CHALK** (×1 Building, [2]): +2 reach;
  - **ROPE** (×2 Fiber, [3]): +1 try (pick a hiker);
  - **FOOD** ([2]): a slower arrow;
  - **HARNESS** (item).
- **Sketchy Bridge:**
  - **PATCH THE PLANKS** (×2 Building, [2]): +20 bridge;
  - **ROPE** (×2 Fiber, [2]): a bigger zone;
  - **FOOD** ([2]): slower sway;
  - **HARNESS** (item).
- **Falling Rocks:**
  - **FOOD** ([2]): slower rocks;
  - **BANDAGES** (×2 Fiber, [3]): +1 life (pick a hiker);
  - **HARDHAT** and **BINOCULARS** (items).

### Puzzle and logic
- **Traildle:**
  - **FOOD** ([2]): +1 guess;
  - **KNOCK ONE DOWN** (×2 Building, [1]): pass with all but one sign right, like 5 of 6 (Wyatt);
  - **THINKING CAP or GLASSES** (item): one digit starts solved.
- **Find the Path:**
  - **FOOD** ([2]): +1 try;
  - **TRAIL MARKER** (×1 Trinkets, [2]): one step of the trail shows;
  - **LANTERN** (×1 Fire, [1]; fog): no fog;
  - **MAPS** (item): show one step.
- **Trail Map:**
  - **FOOD** ([2]): +10 s;
  - **PLACE A PIECE** (×1 Building, [2]): one solution tile is turned right and locked;
  - **MAPS** (item): one route solved.
- **Picture Puzzle:**
  - **FOOD** ([2]): +10 s;
  - **CORNERS** (×1 Building, [1]): the four corners start in place;
  - **CAMERA or OLD PHOTO** (item): a ghost picture.
- **Thin Ice:**
  - **TEST STONES** (×1 Building, [3]): marks one hole before you start;
  - **FOOD** ([3]): +1 ice pick (pick a hiker);
  - **ROPE** (×2 Fiber, [1]): each hiker's first fall only cracks;
  - **HIKING STICK** (item): the same as ROPE.
- **Minefield:**
  - **TREAT** (×1 Food, [3]): the dog sniffs out one pile, bagged before you start;
  - **POO BAG** and **SCANNER** (items).
- **Fake Trail Signs:**
  - **FIX A SIGN** (×2 Building, [1]): one wrong answer is forgiven, like Traildle's lever;
  - **THINKING CAP** (item): −1 rule;
  - **GLASSES** (item): −1 sign a round;
  - **MANUAL** (item): the old rules stay on screen.
- **Pack It Up:**
  - **FOOD** ([2]): +10 s;
  - **MEND A TEAR** (×2 Fiber, [1]): one torn cell can be used;
  - **SACK** (item): the biggest piece goes in the sack;
  - **BACKPACK** (item): +1 spare cell.

### Memory
- **Remember the Path:**
  - **FOOD** ([2]): a slower ranger;
  - **BREADCRUMBS** (×1 Trinkets, [2]): one step stays marked;
  - **SUPPLY MAP** (item): −1 step.
- **Memory Puzzle:**
  - **FOOD** ([2]): +5 s;
  - **LUCKY PAIR** (×1 Trinkets, [2]): one set starts matched;
  - **CAMERA** (item): a peek.
- **Safari:**
  - **FOOD** ([1]): −2 animals (bait draws them off);
  - **LANTERN** (×1 Fire, [2]; night): a wider beam;
  - **BINOCULARS** (item): −1 answer sign.
- **Crossroads:**
  - **TRAIL MARKER** (×1 Trinkets, [2]): one crossing shows its arrow when you get there;
  - **SUPPLY MAP** (item): −1 arrow;
  - **TREASURE MAP or CAMERA** (item): a peek on the way.
- **Birdsong:**
  - **FOOD** ([2]): slower notes;
  - **LUCKY CHARM** (×1 Trinkets, [3]): +1 strike (pick a hiker);
  - **FIELD NOTEBOOK** (item): each song plays twice.

### Search
- **Find the Object:**
  - **FOOD** ([2]): +5 s;
  - **FLASHLIGHT** (×1 Fire, [1]; dark): a bigger light;
  - **BINOCULARS or GLASSES** (item): −1 to find.

### Reaction and timing
- **Trail Blocks:**
  - **SNACK** (×1 Food, [2]): each hiker's energy chunk is [20%] bigger;
  - **BETTER GRIP** (×1 Building, [2]): bigger zones;
  - **tools** (axe, pickaxe, shovel): half the work;
  - **Clearing Animals:** **BAIT** (×1 Food, [2]): −1 animal.
- **Sleeping Bear:**
  - **QUIET STEPS** (×1 Fiber, [2]): −1 light sleeper (fur on your boots);
  - **FOOD** ([2]): +10 s;
  - **SKIP IT** (×2 Bear Spray).
- **Whackoon:**
  - **FOOD** ([2]): slower raccoons;
  - **SMOKE THEM OUT** (×1 Fire, [1]): no skunks;
  - **SHINY BAIT** (×1 Trinkets, [1]): −1 whack each.
- **Trail Blazes:**
  - **FOOD** ([2]): slower trunks;
  - **BRIGHTER PAINT** (×1 Fire, [2]): +1 unit of window;
  - **LUCKY CHARM** (×1 Trinkets, [3]): +1 try (pick a hiker).
- **Firefly Catch:**
  - **BIGGER JAR** (×1 Building, [2]);
  - **FOOD** ([2]): slower fireflies.
- **Size Up:**
  - **MEASURING STICK** (×1 Building, [2]): +1% pass;
  - **FOOD** ([2]): +2 s.
- **Fly Swatter:**
  - **BIGGER SWATTER** (×1 Fiber, [2]);
  - **FOOD** ([2]): slower flies;
  - **SMOKE** (×2 Fire, [1]): no bees.
- **Fly Block:**
  - **FOOD** ([2]): slower flies;
  - **NETTING** (×1 Fiber, [3]): +1 bite allowed (pick a hiker);
  - **SMOKE** (×2 Fire, [1]): −3 flies.
- **Squirrel Theft:**
  - **FOOD** ([3]): +1 nut (pick a hiker; [2] each);
  - **SHINY BAIT** (×2 Trinkets, [1]): squirrels stay up longer;
  - **BEAR SPRAY** (item): no bears.
- **Raccoon Shuffle:**
  - **SHINY LURE** (×1 Trinkets, [2]): +1 empty bin;
  - **FOOD** ([2]): a slower shuffle.

---

## 6. Spooky Ghost! (Wyatt; a haunted Find the Object)
Wyatt: "a Find the Object, but with no decoys. It's always in flashlight mode, and there are ghosts all around the screen." See `docs/mockups/minigames/new-challenges/54-spooky-ghost.png`.
- **The dark:**
  - everything is pitch black except your flashlight, a circle around the pointer ([30] units across at Tier I, [26] from Tier III);
  - touch: drag to move the light.
- **The objects:**
  - each hiker has **one object at a time** (a lost mitten in their color), somewhere in the dark;
  - tap it while it's lit to find it. A new one then appears somewhere else, at least [80] units from the light;
  - everyone plays at once (like Camp Cleanup);
  - each hiker needs [3, 4, 4, 5, 5] finds by tier.
- **No decoys** (Wyatt): there's nothing wrong to tap.
- **Sanity** (Wyatt): one bar for the party.
  - It's the timer: it drains on its own over [45, 45, 40, 40, 35] s.
  - **Ghosts drain it faster:** while the light is within [20] units of a ghost, it drains [4×] as fast.
- **Ghosts** (Wyatt):
  - [4, 5, 6, 7, 8] at a time;
  - **only visible in the light** (Wyatt);
  - each fades in over [0.8 s], stays [3–6 s], fades out, then comes back somewhere else;
  - **a ghost never appears where the pointer is** (within [50] units) **or over a hiker's object** (within [20]) (Wyatt);
  - from Tier III they drift slowly ([10] units/s); from Tier IV some drift toward the light.
- **Feel:**
  - a ghost the light finds does a little "BOO" wobble;
  - while sanity drains fast, the screen's edges pulse red.
- **The end:** when sanity runs out, hikers short of their finds fail (Wyatt: "like the snake game"). If everyone has theirs first, everyone passes.
- **Prepare:**
  - **FOOD** (×1 Food, [2]): sanity drains [15%] slower;
  - **LANTERN** (×1 Fire, [2]): a [+6] bigger light;
  - **LUCKY CHARM** (×2 Trinkets, [1]): ghosts drain half as much.
- **Art:** `assets/minigames/spooky-ghost/ghost-1.png` and `ghost-2.png` (float frames) and `mitten.png` (white: tint it with the hiker's color). The dark ground can reuse Find the Object's.
- **Bot:** sweeps the light toward the nearest object it hasn't found, and turns away from ghosts, a bit late.

---

## 7. Cracked Pots (Wyatt; a shard puzzle)
Wyatt: "like the picture puzzle, but made of fragments instead of squares, so it's like shards of pot." See `docs/mockups/minigames/new-challenges/55-cracked-pots.png`.
- **Like Picture Puzzle:** hikers play in pairs and share one blanket of shards; each has their own pot.
- **The pot:**
  - a painted pot, broken into [6, 8, 10, 12, 14] shards by tier;
  - the shards are cut like a real break: irregular pieces, each one different;
  - its outline shows dotted where the pot goes.
- **The shards** lie scattered on the blanket in the middle, from both pots, mixed. Any shard you can see can be picked up. (Picture Puzzle's piles become a blanket *(Claude's reading)*.)
- **Placing:**
  - drag a shard to its spot. It snaps in when dropped within [6] units, and locks;
  - dropped anywhere else, it goes back to the blanket;
  - **no turning** (Wyatt): the shapes are the puzzle.
- **Help at Tier I:** faint crack lines inside the outline show where the shards go *(Claude's idea; like Picture Puzzle's Tier I locks)*.
- **The clock:** seconds per shard × shards, plus a bonus the first time each shard snaps in (as in Picture Puzzle).
- **Results:** a hiker whose pot is whole in time passes. Unfinished pots fail.
- **Prepare:**
  - **FOOD** (×1 Food, [2]): +10 s;
  - **GLUE** (×1 Clay, [2]): one shard starts in place;
  - **CAMERA or OLD PHOTO** (item): a ghost picture of the whole pot.
- **Art:** `assets/minigames/cracked-pots/pot-1.png` to `pot-3.png` (76 × 96). Each round picks one per hiker and cuts it into shards in code (random points, each pixel goes to the nearest one), seeded.
- **Bot:** picks up the shard that fits the most open edge and drops it, sometimes in the wrong spot first.

---

## 8. Things to flag to Wyatt
- **Names I picked:** Lost Trail, Tangled Trails, Torn Postcards, Follow the Ranger, Snack Match, Snack Hunt, Stay on the Trail, Crossing, Trail Blocked!, Sword Bear Attack!, Gun Bear Attack! and Stampede!.
- **The 16 new cost cards** and every challenge's nodes, "From" tier and punishment are my guesses.
- **Categories:**
  - Clay is in Building;
  - Wood is in Building and Fire, and Metal in Building and Trinkets;
  - Fiber pays for +hearts and +lives.
- **The backup rule:** each missing thing costs 1 Energy, and going below 0 Energy is an injury.
- **Heavy Pack** brings back Rocky Path's carry limit.
