# Hike in the Woods — Online Design Doc

Exported from the Claude Docs design doc on Nov 3, 2026. The doc is the source of truth; re-export when it changes.

## Overview

Hike in the Woods Online is a single-screen, score-based co-op game: the player guides a party of 4 hikers from the trailhead to the summit, and the score is how many reach each checkpoint and the top together.

- **Platform:** one web page that runs in a browser on a computer or phone, with no server. Played in landscape (hold the phone sideways); the trail tree itself runs bottom to top.
- **Autosave:** the game saves after every action, in the browser on that device. A computer and a phone keep separate saves.
- **Players:** single-player by default. With several people, each simply controls some of the hikers.
- **A run:** 3 sections, one per biome, each ending in a checkpoint with a ranger station. About an hour.

**How this doc is organized:** everything from Setup through Objectives and scoring is the **base game**, the version built first. Later additions lists what comes after. Specific content (traits, character abilities, injuries, challenges) comes from Wyatt.

**What changed from the card game**

| Card game | Online |
| --- | --- |
| Each player is one character | One player controls the whole party |
| Secret objectives and night roles | Party-wide objectives; night roles removed |
| Group moves as one caravan | Hikers move separately; moving together has benefits |
| Fixed trail cards with built-in challenges | Simple tiles (just nodes) plus a separate challenge and opportunity deck |
| Fatigue and Hunger rise | Energy, Appetite and Morale all start high and drop |
| Roleplay injuries | Injuries as strikes toward passing out, plus timed conditions |
| Draw the top resource card | Draw 3, pick 1, with luck and rare results |
| Fixed blueprint cards | Blueprints learned by crafting |
| Trinkets for night actions | Trinkets grant or change traits |
| Barter shops | Themed ranger stations using acorn caps |

## Setup

The player picks 4 hikers and drafts a starting kit from a random spread of cards.

1. **Party:** exactly 4 hikers. Characters can be filtered by class label (a summary of their traits and playstyle) to build a balanced or themed team. With more than one person playing, each hiker is labeled with who controls it.
2. **Starting kit draft:** the game deals a spread of cards: Tier 1 items, resource bundles and caps. The player picks a set number for each hiker.
   - The spread guarantees at least 1 shelter and a minimum number of food, tools and clothes (numbers set during balancing).
   - Some characters have a **starting attribute** instead of a trait, because it only matters at the start (for example, extra guaranteed tools).
3. The run is 3 sections, one per biome. The party starts on the Meadow trailhead with a party objective drawn (see Objectives and scoring).

## Days, phases and actions

Each day has three phases — Morning, Afternoon and Night — and every hiker takes one action per phase, in any order the player likes.

| Action | Morning / Afternoon | Night | Notes |
| --- | --- | --- | --- |
| Move | ✓ | ✓ | Costs 1 Appetite. Forward, sideways or back along a connection. Night moves cost 1 extra Appetite (traits and clothing can offset) |
| Move All | ✓ | ✓ | Costs 1 Appetite plus 1 for each hiker brought along (bringing 3 = 4 Appetite); hikers on that tile who haven't acted this phase come along and use their action |
| Scavenge | ✓ | ✓ | Costs 1 Appetite. Draw 3, pick 1 (see Scavenging) |
| Craft | ✓ | ✓ | Generic or from a known blueprint |
| Sit by the Fire | ✓ | ✓ | +1 Morale per other hiker at the fire (max +3), +1 XP |
| Tend | ✓ |  | Restore Abundance for a node on this tile |
| Sleep |  | ✓ | +2 Energy, or +3 in a shelter. A night without sleep costs 2 Energy |
| Keep Watch |  | ✓ | Protects hikers on this tile from night events |

**Free actions** (no phase used): using an item, trading items or resources with hikers on the same tile, and teaching a known blueprint to a hiker on the same tile (costs Morale).

**Camp step** (after Night): a night event may be drawn (50% chance, harsher at higher tiers); timed conditions and clothing durability tick down; passed-out countdowns drop for hikers with no active hiker on their tile.

## Hiker health

Every hiker has three stats on a 0–10 scale that start full and drop, plus up to 3 injuries; the third injury makes them pass out.

| Stat | Drains from | Restored by | Threshold states | At 0 |
| --- | --- | --- | --- | --- |
| Energy | A night without sleep (−2), challenges, some trait costs | Sleeping (+2, or +3 in a shelter), some food | Fatigued at 6 or less; Exhausted at 3 or less | Take an injury |
| Appetite | Each move (−1), each scavenge (−1), each night (−1); extra for night moves and moving the group | Food | Hungry at 5 or less; Famished at 2 or less | Take an injury |

Energy works as a sleep meter and Appetite as the fuel for actions. What each threshold state does, and every condition, is in Traits and Conditions.

**Morale** (0–10) drains and refills through morale traits, events, the fire and food. It sets the hiker's luck (see Characters), and at 0 the hiker takes an injury.

**Effect types**

| Type | Lasts | Examples |
| --- | --- | --- |
| Stat hit | Instant | −2 Appetite, −1 Morale |
| Condition | Days (a few count phases), on a hiker | Sleepy, Sluggish, Brain Fog, Inspired, Motivated |
| Tile condition | Set number of days, on a tile | No shelters here for 2 days; Muddy Path |
| Weather | Set number of days, everywhere | Rain, Heat Wave, Fog |
| Injury | Until cured | A strike toward passing out; raises stats below 5 to 5 |

Lower-tier challenges mostly cause stat hits and short conditions; injuries become common in later sections.

**Injuries** have no effect of their own. They work like strikes, showing how close a hiker is to passing out. Gaining an injury raises each of the hiker's stats that is below 5 back up to 5. Cures: Bandages, the Splint (−1 injury for 3 days, then it returns), ranger station services, and some opportunities.

**Passing out, abandoning, rejoining**

- At 3 injuries a hiker passes out and can't act. A countdown starts (2 nights). It drops each camp step that no active hiker shares their tile.
- Another hiker can wake them with a medical item, or carry them (carrier's moves cost +1 Appetite). A carried hiker counts as arrived at a checkpoint, for reduced points.
- At 0 the hiker **abandons the hike** and leaves the party. The player can also abandon a hiker at any time.
- Ranger stations offer one rejoin each, at a high price, with at most 2 per run. A rejoined hiker returns with 2 injuries and low stats.

## Characters, traits and leveling

One trait library covers everything: a character's starting traits, level-up choices and trinket rewards all come from it.

**Trait slots.** Each character starts with their own slots, usually 3 (some 2 or 4), and can have at most 6. A slot's type decides what fits: T (Trail, yellow), U (Utility, green), M (Morale, purple), the dual slots T/U, T/M and U/M, or W (wild: any of the three). Slots show as colored outlines the traits sit in. New slots come from level-ups (a slightly rarer option than a trait) and from specific trinkets; the type depends on the source, with T and U most common, dual slots rarer and W rarest. Special and unique traits take up a slot like any other, and characters still have an optional starting attribute. Every trait and condition, with exact wording, is in Traits and Conditions.

**Leveling.** Level N (1–3) offers 3 random Tier N traits drawn from every type the hiker's slots can hold, filled or open; Morale traits come up less often than Trail and Utility. From level 4 on, each level-up adds one more option, all Tier III, up to 6 options. An option is sometimes a new slot instead of a trait (never past 6). Special and unique traits are only offered to the characters they belong to. A new trait goes into an empty slot that fits it or replaces the trait in one, and learned blueprints keep working.

**Families.** Every character is a Human, a Dog or a Cat. Dogs see 1 extra card when scavenging but craft lower-Quality items; Cats pay no Appetite to move but carry one less item; Humans have no built-in trait. Some traits and items only work for certain families (Dog Food, Leash, Dog Lover). Pair characters are also marked Duo.

**Class labels** (Tank, Support, Resourceful, Traveller, Survivalist) only summarize a character's traits and playstyle. They're used to filter characters when picking a party.

**Luck.** Each hiker has a luck value that multiplies the odds of rare draws when scavenging and crafting. High Morale gives more Luck and low Morale gives less, for both scavenging and crafting. When crafting, Luck shifts the item's Quality roll and the small chance of a higher tier. Traits and items can change it, including luck for one node type only.

**XP**

| Source | XP | Cap |
| --- | --- | --- |
| Reaching a checkpoint | 10 | Milestone, uncapped |
| Completing the party objective | Scales with its tier | Milestone, uncapped |
| Passing a challenge | 2 × trail tier | Milestone, uncapped |
| Crafting (Tier 1 / 2 / 3 / 4) | 1 / 2 / 4 / 8 | Row rule |
| Lucky scavenge draw | 2 (common draws 0) | Row rule |
| Sitting by the fire | 1 | Row rule |

**Row rule:** action XP only counts on a hiker's first day on a given row. Moving forward mid-day starts the new row immediately; revisiting a row or moving sideways earns nothing.

**Trinkets** are rare items that act on traits: grant a specific trait, swap a trait for 1 of 3 others, add a random trait, or add a trait slot. Which trinket does what comes from Wyatt.

**Abilities panel.** Active traits, like Stoic, which spends Morale, show as buttons in the selected hiker's panel with their uses left. Passive traits work automatically.

## The trail map

Each section is a randomly generated tree of hex tiles: it starts at one Trailhead, branches out, and rejoins at the checkpoint, with lines between tiles showing where hikers can go.

*(Diagram in the original doc: an example random tree. One trailhead at the bottom, branching up to 3 tiles wide, rejoining at the checkpoint at the top. Lines connect tiles in adjacent rows and sometimes neighbours in the same row.)*

The tree runs bottom to top on a landscape screen. Its size (rows and branching) is tuned so a section takes about 20 minutes.

**Movement.** Hikers move along any line: forward, sideways or back. The first hiker to enter a tile triggers its challenge or opportunity. The map scrolls up and down the tree and can zoom to any hiker, and a rail at the side shows where every hiker is.

**Tiles are just nodes.** A normal tile has 1–3 nodes (Forest, River, Wildlife, Mountain). Tiles aren't named; at most they get a simple label from their nodes (for example, Creek = River + Forest; River = 2 River + 1 other). The map shows how many nodes a tile has; some are revealed in advance, the rest when a hiker enters or scouts it.

- **Double nodes** (River ×2): that resource is more likely, with more bonus draws.
- **Cap node:** acorn caps are more likely.
- **Bounty node:** extra resources are more likely, at an extra Abundance cost.

**Tile look.** Tiles are large hexes. A special space's icon sits in the center until a hiker has landed on it, then moves to the top-right corner. Nodes sit small along the bottom edge, and hikers stand in the middle.

**Trail lines**

| Line | Cost to cross |
| --- | --- |
| Normal | 1 Appetite |
| Paved | No Appetite |
| Steep | +1 Energy on top of the normal cost |
| Muddy | +1 Appetite on top of the normal cost |
| Rough | 1 Morale on top of the normal cost |

Each special line shows a small cost badge at its middle. The Trespasser trait ignores the extra costs.

**Special spaces** show their icon in advance:

| Space | What it does |
| --- | --- |
| Opportunity | Always an opportunity, never a challenge |
| Challenge | A higher-tier challenge; passing hikers get a reward (XP, an item or a good condition) |
| Choice | Two challenges; the party picks one |
| Trail Sign | Reveals the challenges on certain tiles, visible only while a hiker stands on it |
| Geo-cache | Draw several items, keep 1 |
| Campsite | A built-in shelter that only works on that tile and can't be moved |
| Overlook | Reveals every tile connected to it |
| Narrow Path | Holds 1–3 hikers at once (random), shown as a number on the tile |
| Mystery | Could be any space |

**Side features** attach to normal tiles and add an extra option there:

- **Merchant:** sells 3 random cards (items, resources or blueprints) for caps.
- **Traveling Trader:** trades one item type for a specific item, e.g. any 1 clothing for their Tier 2 food.

Shortcuts, Wellspring, Fire Ring and Lost Hiker live in the opportunity and challenge deck, not as spaces.

**Checkpoints.** Every active hiker must check in to finish a section.

- Checked-in hikers can't act, use or trade items, or step back out, but lose no stats or durability.
- A hiker who passes out behind the group with no one nearby will be abandoned. Keeping a hiker on the tile before the checkpoint is the safety net.
- After the station visit, the party starts the next biome on a free Trailhead with no challenge or nodes. Hikers can't move back onto a checkpoint.

## Biomes, tiers and weather

The base game has 3 sections, one per biome, and the difficulty tier rises with each section (Tier 1, 2, 3).

**Tiers.** Challenge numbers scale with tier. Challenge spaces draw from one tier higher, which is how harder challenges appear in earlier sections.

**Biomes** decide which nodes are common, which challenges and weather appear, and any unique tiles.

| Biome | Section | Favors | Typical weather |
| --- | --- | --- | --- |
| Meadow | 1 | Balanced nodes, mild events | Clear skies, light rain |
| Temperate Rainforest | 2 | Forest, River | Rain, mud |
| Alpine | 3 (summit) | Mountain; the old Tier III snow cards | Snow, whiteout |

More biomes and a random biome order are in Later additions.

**Weather** affects every tile and hiker for a set number of days. Example: Rain gives −1 Morale to hikers without body clothing and makes River draws more likely. It comes from the biome's schedule or from events, and a **3-day forecast** shows what's coming. The old Effect cards (Heavy Rain, Snow Storm, Thin Air, Foggy Valley) become weather or biome rules. Fog hides the nodes on every tile without a hiker on it.

## Challenges and opportunities

Challenges and opportunities are a separate deck of templates that the game fills in for the tile, biome and tier.

**Templates.** Wyatt writes the cards with blanks the game fills in:

| Placeholder | Filled with |
| --- | --- |
| `{amount}` | A number that scales with tier |
| `{resource}`, `{node}` | Picked from the tile's nodes or the biome |
| `{itemType}` | Tool, clothes, food or shelter |
| `{stat}` | Energy, Appetite or Morale |
| `{days}` | A condition's length |

Example: "Sacrifice {amount} {resource}." Each card lists the tiers, nodes and biomes it can appear in. Events say "hikers on this tile" instead of "all players" or "lead player."

**Triggering.** The first hiker to enter a tile triggers its card once. Lingering tile conditions are the exception and affect every hiker who enters while they last.

**Challenge window.** Entering a tile opens a pop-up:

- It shows the inventory of every hiker on the tile, with empty card slots to drop in what the challenge asks for.
- For group challenges, the party pays together.
- For per-hiker challenges, each hiker has a ✓ (pass and pay) and an ✗ (fail and take the penalty).
- Opportunities use the same window with their reward.

**Night events** come from their own deck (raccoons raid a bag, shooting star). Keep Watch protects hikers on the watcher's tile.

## Scavenging, Abundance and inventory

Scavenging draws 3 random cards weighted by the tile's nodes, Abundance and the hiker's luck; the hiker keeps 1.

**Scavenge cards.** Cards are square, drawn on the node's backdrop art. They're dealt face down to build suspense, each back showing where the card came from (its node, or the caps back or item back). The hiker clicks each card to flip it, then keeps 1.

| Card | What you get | Rarity |
| --- | --- | --- |
| Resource | 1 resource | Common |
| ×2 / ×3 | 2 or 3 of the same resource; both drain 2 Abundance | Uncommon / Rare |
| Pair / Trio | 2 or 3 different resources from the same node; both drain 2 Abundance | Uncommon / Rare |
| Mixed | 1 resource from each node on a two-node tile | Rare |
| Wild (?) | A random resource from that node, revealed when taken; can come as ×2 | Uncommon / Rare |
| Variety Wild (?) | A random resource from all 16, on its own backdrop | Uncommon |
| Variety Pair (??) | 2 random resources from all 16 | Rare |
| Variety Bundle (???) | 3 random resources from all 16 | Very rare |
| Choice (!) | Pick the exact resource from that node; can come as ×2 | Rare / Very rare |
| Pick of the Wild (!) | Pick 1 resource from all 16, on its own backdrop | Rare |
| Pair of the Wild (!!) | Pick 2 resources from all 16, the same or different | Very rare |
| Bundle of the Wild (!!!) | Pick 3 resources from all 16, the same or different | Legendary |
| Acorn caps | 1–3 caps | Uncommon |
| Item find | A random item of one type, on the item backdrop | Tools and food: Rare. Clothes: Very rare. Shelters and trinkets: Legendary |
| Choice item (!) | Pick 1 of 5 random cards of one item type (Choice Tool, Choice Shelter and so on) | One step rarer than that type's find: tools and food Very rare, clothes Legendary, shelters and trinkets Mythic |

Rarity runs Common, Uncommon, Rare, Very rare, Legendary, Mythic. Exact odds are set in balancing; luck shifts them toward rarer cards. Acorn caps also get their own backdrop.

Modifiers: luck (from Morale and traits) shifts the odds toward rarer cards; Dogs see 1 extra card; Forager sees 4 cards; Gambler and Glasses reroll; the Metal Detector raises item finds; a choice-finding tool (name to come) raises Choice cards; low Abundance means fewer cards from that node.

The 16 resources stay: Forest (wood, moss, mushroom, grass), River (fish, clay, shell, seaweed), Wildlife (meat, fur, oil, bones), Mountain (stone, metal, flint, salt).

**Abundance** is a meter for each node type, shown at the top of the screen.

- Every scavenge lowers that node's meter by 1 (×2, ×3, Pair and Trio cards lower it by 2), and so do bonus resources a hiker chooses to take (Copier, Copydog, Generous); random or refunded ones (Pockets, German Efficiency, Fluffy) don't. A low meter means fewer cards to choose from, rarer good results, harsher related events, and higher shop prices for that node.
- It resets to about 75% at each new biome and recovers +1 per node per night it wasn't scavenged.
- Restored by Tend (day only; the Maintenance trait doubles it), returning a resource to nature (+1 to its node), items (Seed Pouch, Fish Ladder, Salt Lick) and station services.

**Inventory**

| Holds | Limit | Sharing |
| --- | --- | --- |
| Items | 4 bag slots + 3 equipped; a Backpack adds 2 | Traded freely with hikers on the same tile |
| Resources | 10 per hiker | Pooled with every hiker on the same tile for crafting |
| Caps | One party purse | Shared |

Shelters placed on a tile take no slot.

## Items, crafting and blueprints

Items come in four tiers; crafting draws options to choose from, and crafting an item is the only way to learn its blueprint.

**Tiers**

| Tier | How you get it |
| --- | --- |
| 1 | Anyone can craft it from the start |
| 2 | Unlocked by a trait, a level-up or a station workbench; some characters start with it in one category |
| 3 | A higher-level trait, or a workbench plus a blueprint |
| 4 (Legendary) | Only a lucky upgrade when crafting at Tier 3, or rare shop stock. Never teaches a blueprint |

Core items get upgrade lines (Tarp → Tent → Cabin); one-off items get a tier tag. Whether higher tiers are better versions or unique items is decided per item.

**Item types:** tools (consumed on use, or after a set number of uses), clothes (equipped), food (eaten as a free action) and shelters (stay on the tile where they're placed).

**Quality.** Tools, food and clothes have a Quality from 1 to 5, rolled when the item is crafted, found or bought; shelters and trinkets have none. Quality sets the item's numbers: how much Appetite a food gives, how many days clothes last, how many uses a tool has, and every value marked (X) on the card, such as the Snack Pack's (X)15% chance. The roll follows a bell curve: Quality 3 is most common, 2 and 4 less so, and 1 and 5 rare. When crafting, the crafter's Luck shifts the curve, so high Morale makes better items and low Morale worse ones. Traits shift it too: Talented, Chef, Careful Hands and Lovingly Made push it up, and Dogs push it down. Found and bought items roll the plain curve. The card shows Quality as pips, and a hiker's panel can say "crafts lower Quality." Item cards stay rectangles, with their text added in-game so it can change.

Every item named so far is listed in Items.

**Equipment slots:** Body, Feet, Gear.

**Example items:** Carrier Pack (Gear; carrying a passed-out hiker costs no extra Appetite), a cozy clothing item (sleeping restores 1 extra Energy; name to come), Energy Drink (food; Energized for 2 days, then Buzzed for 2). Family items such as Dog Food, the Leash and the Ring are in the Traits and Conditions tab.

**Clothing durability** is counted in days: Tier 1 lasts 5, Tier 2 lasts 7, Tier 3 lasts 10, shown as pips that tick down at camp. One-time clothes (Rain Jacket, Headlamp) use charges instead. Repairs: the Patch Kit item, a durability trait, and the Outfitter station.

**Crafting**

- **Generic craft:** pay the category's cost (based on the old Crafting card) and see 2+ random items of that type at your tier, with a small chance of a higher tier. Pick 1.
- **Learning:** crafting an item adds its blueprint (tools, clothes, shelters) or recipe (food) to that hiker's book, filed under the item type. Buying or trading for an item teaches nothing.
- **Known blueprint:** guarantees the exact item but always costs more than a generic craft. The old Blueprint and Recipe Book cards supply the first specific costs.
- **Teaching:** spend Morale to teach a known blueprint to a hiker on the same tile. It costs 4 Morale for a Tier 1 blueprint, 6 for Tier 2 and 8 for Tier 3. A hiker's blueprints leave with them if they abandon the hike.
- **Bundles:** ranger stations sell sets of blueprints.

## Ranger stations and acorn caps

Each checkpoint has a randomly themed ranger station where the party shops, sells, crafts and rests for free, paying in acorn caps.

**Acorn caps** ("caps") are the currency. They come from scavenging (any node, rarely; Cap nodes more often), selling, and rewards. Possible traits: Squirrely (finds more caps) and Haggler (+1 cap per sale).

**The station visit** costs no actions. While there:

- All inventories are shared.
- The workbench allows higher-tier crafting.
- The station offers a few temporary blueprints from its theme (for example 3 random clothing or rain items). They're kept only by crafting the item.
- Each station offers one rejoin service for an abandoned hiker.
- The party gets one free night of sheltered rest before the next biome.

**Each station theme has:** a stock rolled from its own item pool each visit (themes can repeat in one run), a buy table that pays more or less by category or node, and one signature service. Unique rangers with personalities are a later addition. The themes below are examples.

| Station | Sells | Buys high / low |
| --- | --- | --- |
| Bait & Tackle | River resources, Net, Rain Jacket, Crocs | River high, Wildlife low |
| Quarry Outpost | Mountain resources, tools | Mountain high, Forest low |
| Outfitter | Random clothes; repairs | Fur and moss high |
| Camp Kitchen | Food, recipe bundles | Wildlife and Forest high |
| Field Hospital | Bandages, Splints; cheaper rejoin | Most things low |

The nine existing Ranger Station cards (Rain Shop, Cold Outpost, Field Workshop, Altitude Cache, Watch Tower, Farm Outpost, Charter Shop, Souvenir Shop, Wildlife Refuge) become themes too; their specials (Rain Removal, Hotel, Paved Trail, Easier Route, Telescope, Trail Rations, Map, Train Station, Doctor's Office) become signature services.

## Objectives and scoring

The final screen shows your score as X out of Y, where Y is the best possible score for your settings; matching it earns a P (perfect).

**Party objectives**

- At the start of each biome the game draws 3 objectives, one each of Tier 1, 2 and 3, and the party picks 1 to attempt by the next checkpoint.
- Rerolls: 2 for the Tier 1 card and 1 for the Tier 2 card, reset at every checkpoint. The Tier 3 card can't be rerolled, so it only comes from objectives that are possible in that biome.
- Higher-tier objectives are worth more points and XP. Failing loses points and Morale based on the objective's tier; harsher penalties may be added after playtesting. The old objective cards (Entertainer, Sightseer, Traveling Chef, Hoarder, Daredevil, Doctor, Glamper, Spender, Scaredy Cat, Taxonomist) are rewritten as party goals.

**What Y adds up**

- Every hiker reaching every checkpoint healthy (no injuries, not carried). Injured or carried arrivals earn partial points.
- The Tier 3 objective completed in every section.
- The whole party reaching the summit together.
- Leftover caps converted to points, up to a cap.

Exact point values, partial points and the caps limit are set after playtesting. Once party size and run length become options (Later additions), Y changes with them, so a perfect 500/500 is visibly harder than 100/100.

**Grades:** letter grades below Y, **P** at exactly Y, and **P+** when modifiers or riskier choices push the score past Y (for example 510/500).

## Later additions

None of this is in the base game, but the values these would change are adjustable settings in the code from the start, so adding them later is straightforward.

- **Party size:** 3–6 hikers, with challenges scaling per hiker.
- **Longer runs:** 4 or 5 sections, adding Tiers 4 and 5.
- **More biomes:** Desert Canyon, Taiga, Savanna, Wetlands, Badlands, and a random order for the middle sections.
- **Modifiers** (whole-game settings picked before a run):
  - Storm Chase: a storm advances from behind, forcing the party forward.
  - Individual Objectives: each hiker has their own objective again.
  - No Rerolls: no objective or draw rerolls of any kind.
  - True Random: challenge amounts and types vary far more.
  - Easier modifiers, such as extra rerolls or slower drain.
- **Endless mode:** after the final checkpoint the trail keeps going until the player gives up or every hiker abandons.
- **Unique rangers** with personalities at stations.
- Specific item finds: the card shows the exact item, so the hiker can decide whether to take it.

**Adjustable settings from day one:** party size; number of sections; tree size and branching; stat maximums, thresholds and drain rates; move, Move All, carry and night-move costs; scavenge draw count and result odds; luck formula; Abundance drain, reset and recovery; rerolls for each objective tier; XP values; teaching cost; clothing durability; passed-out countdown; rejoin limits; night event chance; score values and the caps limit.

## Content, open questions and build order

The base game's systems are settled; what's left is content Wyatt is writing, numbers to set while balancing, and building in layers so a playable version exists early.

**Content Wyatt is writing**

- [ ] Traits: first pass is in the Traits and Conditions tab; tiers and numbers still to finalize
- [ ] Character roster with traits, abilities and starting attributes (the cards plus Mom, Katie, Melissa, Leah, Red Pack, Hershal, Sinjon, Muffin & Coco, Pepper, Mitchell & Nathan, Ben & Mindy)
- [ ] Challenge and opportunity templates, tagged by tier, node and biome
- [ ] Night events
- [ ] Party objectives
- [ ] Item list by tier, including upgrade lines
- [ ] Trinkets
- [ ] Station themes and their stock pools
- [ ] Tile labels for node combinations

**Open questions (mostly for balancing)**

- Generic crafting costs
- Objective failure penalties for each tier
- Point values, partial points and the caps limit (after playtesting)
- Duo characters: 2 Trail or Utility traits, or a Tag Team trait that swaps daily
- Tiers for the traits added during design, and the starting chance values
- Puller: does it pay the full scaled Move All cost in Energy, or a flat 1?
- Effects for Harness, Disco Harness and Chocolate Rose; the rest of Fog

**Build order**

1. Core loop: one Meadow section with random tree generation, 4 hikers, movement along connections, the three stats, scavenging, generic crafting, the challenge window, the checkpoint gate, autosave, landscape layout.
2. Placeholder content to playtest with: a few characters, injuries and templated challenges.
3. Injuries, conditions, passing out, carrying and abandoning.
4. Ranger stations, caps and selling.
5. Item tiers, blueprints, recipes and durability.
6. All 3 biomes, tiers, weather and the forecast.
7. XP, levels, traits and trinkets.
8. Objectives, scoring and grades.
9. Wyatt's full content, then balancing and phone polish.
