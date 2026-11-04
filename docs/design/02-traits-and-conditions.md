# Traits and Conditions

## How to read this tab

Every trait and condition is written with the same terms, so each one means exactly one thing in code. Numbers are starting values for balancing.

| Term | Meaning |
| --- | --- |
| Energy, Appetite, Morale | The three stats, 0–10; 10 is best for all three (for Appetite, 10 = well fed). "Hunger cost" is always written as an Appetite cost |
| Phase | Morning, Afternoon or Night; a day has 3 |
| Action | What a hiker does in one phase. **Free** = doesn't use the action |
| Move the group | The Move All action. "Moved with the group" = brought along by someone else's Move All |
| Alone | No other active hiker on the same tile |
| Adjacent | Connected to this hiker's tile by a line |
| Luck | Measured in steps. +1 Luck = one step better odds on rare draws; +3 Luck = a lot |
| Chance | A random roll; starting value 25% unless a trait says otherwise |
| Once per day / biome | Resets at the start of each day / each new biome |

**Trait rules**

- Each hiker starts with their own set of trait slots: usually 3, some start with 2 or 4, and 6 is the most a hiker can have. A slot's type decides what fits in it: **T** (Trail only), **U** (Utility only), **M** (Morale only), the dual slots **T/U**, **T/M** and **U/M** (either of the two), or **W** (wild: any Trail, Utility or Morale trait). On screen, slots are colored outlines the traits sit in. Special and unique traits take up a slot like any other trait. A hiker can't have the same trait twice.
- Level N (1–3) offers 3 random Tier N traits drawn from every type the hiker's slots can hold, whether those slots are filled or open, with Morale traits coming up less often than Trail and Utility. A hiker with a filled U slot, a filled M slot and an open T slot can be offered all three types; taking one with no open slot that fits replaces the trait in a fitting slot.
- From level 4 on, each level-up offers one more option (all Tier III), up to 6 options from level 6.
- A level-up option is sometimes a new slot instead of a trait (a slightly rarer option, and never past 6). Specific trinkets can also add a slot. The slot's type depends on its source: T and U are the most common, T/U, T/M and U/M are rarer, and W is the rarest. A new trait goes into an empty slot that fits it, or replaces the trait in one.
- Blueprints a hiker has learned still work even if their crafting trait is replaced.
- Bonus resources a hiker chooses to take (Copier, Copydog, Generous) drain Abundance. Random or refunded ones (Pockets, German Efficiency, Fluffy, Savvy) don't.
- Traits that add resources or items do nothing when that inventory is full.
- **Families:** every character belongs to a Family (see Families) that traits and items can refer to. Pair characters are also marked **Duo**.

**Stacking cap traits:** flat amounts apply first, then percentages, so building both pays off. Buying a 10-cap item with Frugal and Thrifty: 10 − 1 = 9, then halved = 4.5, rounded to 4. Selling a 10-cap item with Charismatic and Non-Non-Profit: 10 + 2 = 12, then +50% = 18. Fractions always round in the player's favor (costs down, earnings up).

**Active traits** need a decision to use, so they appear as buttons in the selected hiker's Abilities panel with their uses left: Stoic, Hardy, Supportive, Lead Stomach, Destroyer, Alchemist, Gambler (during a scavenge), Fetch, Yodeler, Day Napper, Therapist, Liberal and Carrier Pigeon. All other traits apply automatically.

## Trail traits

Trail traits (yellow) cover movement, carrying, food and managing the party's resources.

| Tier | Trait | Effect |
| --- | --- | --- |
| I | Leader | Moving the group costs 1 less Appetite. |
| I | Follower | Being moved with the group doesn't use this hiker's action. |
| I | Independent | Once per day, moving alone to a tile with no hikers costs 1 less Appetite. |
| I | Scout | The nodes of all adjacent tiles are revealed. |
| I | Glutton | Food gives this hiker 1 extra Appetite. |
| I | Strong | +1 item slot. |
| I | Manager | Can trade items with hikers on adjacent tiles. |
| I | Prepared | At the start of each biome, the nodes and challenge of a random tile are revealed for the rest of the biome. |
| I | Short | Moving costs 1 less Appetite, whether moving alone or being moved with the group (never below 0). −1 item slot. |
| I | Never Hungry | 25% chance not to lose Appetite at the end of the day. Every food restores 1 less Appetite for this hiker. |
| II | Puller | Moving the group costs 1 Energy instead of Appetite. |
| II | Prowler | Moving alone at night costs no extra Appetite. |
| II | Susceptible | While sharing a tile with other hikers, also has their positive conditions. |
| II | Transparent | Hikers sharing this hiker's tile also have this hiker's positive conditions while they stay. |
| II | Supportive | Once per day, as a free action, takes one negative condition from a hiker on the same tile, with its remaining time. |
| II | Trailer | Moving to an adjacent tile with a hiker on it costs no Appetite. |
| II | Fast | The first move each day doesn't use an action, but costs 1 extra Appetite. |
| II | Hardy | Once per phase, can spend 2 Morale to shorten one condition by 1 day (or 1 phase, for a phase-based condition). |
| II | Mule | +2 item slots. |
| II | Stoic | Once per day, can spend 2 Morale to gain 1 Energy or 1 Appetite. |
| II | Tactical | At the start of each biome, the nodes and challenge of a tile the player chooses are revealed for the rest of the biome. |
| II | Shrug Off | Once per biome, the first injury this hiker would receive is prevented. |
| II | Lookout | Keep Watch also protects hikers on adjacent tiles. |
| II | Trespasser | Once per section, passes one challenge for free. |
| III | Stalker | Once per day, moving to an adjacent tile with a hiker on it costs no Appetite and doesn't use an action. |
| III | Sneaker | Moving at night costs no Energy, but the extra Appetite is still paid. |
| III | Photosynthesis | Each move has a chance to restore 1 Energy. |
| III | Splitter | When this hiker eats, every other hiker on the tile gains 1 Appetite. |
| III | Sherpa | Moving the group can also bring along hikers on adjacent tiles. |
| III | Second Wind | Once per biome, on becoming Exhausted, Energy refills to 10. |
| III | Carrier Pigeon | Can send items or resources to any hiker anywhere, but can't receive them from afar. |

Added during design (tiers proposed): Short, Shrug Off, Lookout, Trespasser, Sherpa, Second Wind. Supportive's once-per-day limit is also new.

## Utility traits

Utility traits (green) cover crafting, scavenging and actions. Traits written as "\[Node\]" come in four versions: River, Forest, Creature (Wildlife) and Rock (Mountain).

| Tier | Trait | Effect |
| --- | --- | --- |
| I | Collaborative | +1 Luck when crafting on a tile with other hikers. |
| I | Focused | +1 Luck when crafting alone. |
| I | Forager | +1 card to choose from when scavenging. |
| I | Eco-conscious | The first scavenge each day drains 1 less Abundance. |
| I | Squirrely | Higher chance of acorn caps when scavenging. |
| I | Nocturnal | A night without sleep costs 2 Appetite instead of 2 Energy. |
| I | Lead Stomach | As a free action, can eat 2 resources to gain 1 Appetite. |
| I | Copier | When scavenging, can take 1 extra resource for each hiker who scavenged this tile earlier the same day, at 1 Appetite per extra resource. |
| I | \[Node\] Finder | Higher chance of drawing that node's resources when scavenging. |
| I | Charismatic | +2 caps for each sale. |
| I | Frugal | Pays 1 cap less for each purchase. |
| I | Green / Blue / Gray / Yellow Thumb | For one node (Forest / River / Mountain / Wildlife): +1 card to choose from when scavenging it, and Tending it restores 1 extra Abundance. |
| I | Day Napper | Can Sleep in the Morning or Afternoon, not just at night. |
| I | Singer | When this hiker Sits by the Fire, every hiker on the tile gains 1 Morale. |
| I | Chef | Food this hiker crafts has a chance of +1 Appetite. |
| I | Careful Hands | Clothes this hiker crafts get 0–3 extra days of durability. |
| I | Archaeologist | Higher chance of Item find cards when scavenging. |
| I | MBA | On level-up, gain caps based on the new level (starting value: 3 caps per level). |
| II | Artisan Cook / Crafter / Architect / Tailor | Can craft Tier 2 food / tools / shelters / clothes. |
| II | \[Node\] Hound | Much higher chance of drawing that node's resources, and of ×2 results, when scavenging. |
| II | Wet / Sappy / Fuzzy / Rocky Pockets | After scavenging, a chance to also gain a random River / Forest / Wildlife / Mountain resource. |
| II | Copydog | When scavenging, can take 1 extra resource for each hiker who scavenged this tile earlier the same day, at no extra cost. |
| II | Gambler | Once per day, can reroll one card when scavenging. |
| II | Savvy | When crafting, a chance to get 1 of the used resources back. |
| II | Handy | +1 card to choose from when crafting. |
| II | Fortunate | +1 Luck when scavenging. |
| II | Eagle Eye | Scavenging also draws from the revealed nodes of adjacent tiles. |
| II | Pirate | Scavenging alone costs no Appetite. |
| II | Destroyer | As a free action, can spend 3 resources to gain 1 Energy, Appetite or Morale. |
| II | Non-Non-Profit | Sales earn 50% more caps. |
| II | Therapist | Once per day, can spend 1 Morale to shorten every negative condition of hikers on this tile by 1 day. |
| II | Liberal | Once per phase, can spend 1 Energy to even out the Morale of all hikers on this tile. |
| II | Talented | +1 to the numbers on items this hiker crafts (for example, +1 Appetite on food). |
| II | Tank Butt | +1 Luck when this hiker is the last to act in a phase. |
| II | Lovingly Made | At high Morale (8 or more), +1 extra Luck when crafting. |
| II | Wise | When this hiker gains XP, every other hiker on the tile gains 50% as much. |
| II | Dream Alchemist | During the night, each resource this hiker carries has a 10% chance to turn into a random resource. Resources held by other hikers aren't affected. |
| III | Master Cook / Crafter / Architect / Tailor | Can craft Tier 3 food / tools / shelters / clothes. |
| III | German Efficiency | Using a tool also gives a random resource. |
| III | Proficient | +2 cards to choose from when crafting. |
| III | Generous | When scavenging, a random hiker on the tile also gets a random resource from the same node. |
| III | Alchemist | As a free action, can turn 2 resources from one node into 1 resource from another node. |
| III | Thrifty | All cap costs are halved. |

Added during design (tiers proposed unless Wyatt set them): Charismatic, Frugal, the Thumbs, Day Napper, Non-Non-Profit, Alchemist, Thrifty.

Added Nov 3 (tiers proposed): Never Hungry (Trail); Archaeologist, MBA, Lovingly Made, Wise, Dream Alchemist (Utility); Empath (Morale; the old Trail Empath is now Susceptible); Trainer (Human family trait).

## Morale traits

Morale traits (purple) about where a hiker is are checked at the start of each day; traits about what a hiker does trigger immediately, every time. There's no daily limit, so a hiker can gain or lose several Morale in one day. Traits written with \[X\] or \[Y\] are set per character (a node, an action).

| Trait | +1 Morale | −1 Morale | Checked |
| --- | --- | --- | --- |
| Extrinsic | Sharing a tile with another hiker | Alone | Start of day |
| Intrinsic | Alone | Sharing a tile with 2 or more other hikers | Start of day |
| Foody | Appetite is 8 or more | Appetite is 5 or less | Start of day |
| Location | On a tile with an \[X\] node | On a tile with a \[Y\] node | Start of day |
| Fair-Weather | No weather is active | Rain or snow is active | Start of day |
| Dressed | 2 or more clothes equipped | No clothes equipped | Start of day |
| Exhibitionist | No clothes equipped | 2 or more clothes equipped | Start of day |
| Action | Each time doing \[X\] | Each time doing \[Y\] | Immediately |
| Traveler | Each move | Each time doing \[X\] | Immediately |
| Conservationist | Each time Tending an \[X\] node | Each time scavenging an \[X\] node | Immediately |
| Thrill-Seeker | Each challenge passed | Facing no challenge the day before | Immediately / start of day |
| Chatty | Sitting by the fire with others (they each gain 1 too) | Alone | Immediately / start of day |
| Zen | Alone (+2) | Sharing a tile with 2 or more others (−2) | Start of day |
| Empath | Start of day: Morale is set to match the lowest Morale among the other hikers on the tile (it can go up or down) | — | Start of day |

## Families

Every character is a Human, a Dog or a Cat. Traits and items can check a hiker's family, and a Ring can change it for a few days.

**Built-in family traits** (always on, no slot)

| Family | Strength | Drawback |
| --- | --- | --- |
| Human | None | None |
| Dog | +1 card to choose from when scavenging | Crafts lower-quality items |
| Cat | Moving costs no Appetite, alone or with the group | −1 item slot |

**Family versions.** Some traits share an effect but take the family's name, such as Copydog for Dogs and Copycat for Cats. Level-ups offer only the version that matches the hiker's family, plus traits open to everyone.

**Family Trail and Utility traits** (proposed; Who = which hikers can have it)

| Slot | Tier | Trait | Who | Effect |
| --- | --- | --- | --- | --- |
| Trail | I | Lap Pet | Pets | Being moved with the group by a Human costs nothing extra. |
| Trail | I | Pet Sitter | Humans | Pets brought along by this hiker's Move All cost nothing extra. |
| Trail | II | Herder | Dogs | Humans brought along by this hiker's Move All cost nothing extra. |
| Utility | II | Copycat | Cats | Cat version of Copydog. |
| Utility | II | Dog Whisperer | Humans | Dogs on this hiker's tile get +1 card to choose from when scavenging. |
| Utility | II | Fetch | Dogs | Once per day, as a free action, takes 1 resource from a hiker on an adjacent tile. |
| Utility | II | Mouser | Cats | Night events that take food or resources skip hikers on this hiker's tile. |
| Utility | I | Trainer | Humans | Pets on this hiker's tile gain 50% more XP. |

**Family Morale traits** (checked at the start of the day)

| Trait | Who | +1 Morale | −1 Morale |
| --- | --- | --- | --- |
| Dog Lover | Humans | Sharing a tile with a Dog | No Dog on the tile |
| Cat Person | Humans | Sharing a tile with a Cat | No Cat on the tile |
| Loyal | Pets | Sharing a tile with a Human | No Human on the tile |
| Pack Animal | Dogs | Sharing a tile with another Dog | No other Dog on the tile |
| Aloof | Cats | No Dog on the tile | Sharing a tile with a Dog |

**Family items**

| Item | Type | Effect |
| --- | --- | --- |
| Dog Food | Food | Dogs: +4 Appetite and +1 Morale. Anyone else: +2 Appetite and −1 Morale. |
| Leash | Clothes (Gear) | Worn by a Dog: moving the group costs 1 less Appetite when it includes a Human. |
| Harness | Clothes (Body), Dogs | Effect to come |
| Disco Harness | Clothes (Body), Dogs | Effect to come |
| Ring | Trinket | Changes a hiker's family for a set number of days. |

## Special and unique traits

Special traits belong to certain characters (or come through trinkets); unique traits belong to a single character. Both take up a slot like any other trait, and only the characters they belong to can start with them or be offered them on level-up.

| Trait | Kind | Slot | Effect |
| --- | --- | --- | --- |
| Fluffy | Special | Utility | When crafting with Fur, get 1 Fur back. |
| Quirky | Special | Utility | Each day, this trait becomes a random Tier I Utility trait. |
| Zany | Special | Utility | Each day, this trait becomes a random Utility trait of any tier. |
| Niche | Special | Utility | Each morning a random node type is picked and shown on the hiker's card. On a tile with that node: +3 Luck when scavenging and crafting. |
| Just Around the Next Corner | Special | Trail | Sideways moves cost no Appetite. |
| Misophonia | Special | Morale | Right away: −1 Morale when another hiker eats on this tile; +2 Morale when crafting food. |
| Rain Lover | Special | Morale | During rain or snow, every Morale gain is 1 larger. |
| Moody | Special | Morale | Each morning, gains 1 random condition for the day from a set of 3 positive and 3 negative conditions. |
| Yodeler | Unique | Utility | Once per day, as a free daytime action: every hiker within 2 tiles gains 1 Morale, or 2 if they're on a tile with a Mountain node. |
| Dog Mom | Unique | Utility | When a Dog on the same tile scavenges, this hiker also gains a resource from that node. |
| Artist | Unique | Utility | When this hiker crafts an item, every hiker on the tile gains 1 Morale. |
| Stylish | Unique | Utility | With all 3 equipment slots filled: +1 Luck when scavenging and crafting. Clothes last 3 extra days when this hiker equips them (once per item). |
| Alpha | Unique (Cody) | Morale | Start of day: +1 Morale on a tile with more Humans than Dogs, −1 on a tile with more Dogs than Humans. |
| Show Girl | Unique (Gma) | Morale | Humans on this hiker's tile get +1 from every Morale gain. |
| Nugget Puker | Special | Utility | After eating food, gains a Puked Nuggets food card (+1 Appetite, 1 use). |
| Loud | Special | Utility | Can trade and Keep Watch from 1 tile away. At night, gives Ringing Ears to every hiker on its tile. |
| Rabbit Diet | Special | Trail | Loses no Appetite at the end of the day, but can't eat food cards. Can eat 1 Forest resource for 1 Appetite. |
| Soldier's March | Unique (Grandpa W. and Sherman Tank) | Trail | Moving alone costs 1 less Appetite. |

Moody's set: Inspired, Lucky, Energized / Bored, Unlucky, Dejected.

**Duo characters** (two options to choose between):

- They start with 2 Trail or 2 Utility traits.
- They have a **Tag Team** trait that swaps each day. Example: on odd days +1 Luck when crafting and −1 Luck when scavenging; on even days the reverse.

## Conditions

Conditions last a number of days set by whatever caused them; the few marked **(phase)** count phases and repeat their effect each phase.

- A stat change from a condition applies while it lasts and is undone when it ends. Sleepy at 8 Energy shows 6 until it ends.
- Positive conditions can push a stat above 10. The extra stays until it's spent or the condition ends.

**Threshold states** (automatic, no timer)

| State | When | Effect |
| --- | --- | --- |
| Hungry | Appetite 5 or less | Can't scavenge or move the group. |
| Famished | Appetite 2 or less | Can't move or scavenge. |
| Fatigued | Energy 6 or less | At night, can only sleep. |
| Exhausted | Energy 3 or less | Can only sleep; no daytime actions. |

**Negative conditions**

| Condition | Effect |
| --- | --- |
| Sleepy | −2 Energy while it lasts. |
| Nauseous | −2 Appetite while it lasts. |
| Bored | −2 Morale while it lasts. |
| Dejected | Morale can't go above 5. |
| Inappetent | Appetite can't go above 7. |
| Buzzed | Energy can't go above 7. |
| Hangry | Maximum Morale drops by 1 for each point of Appetite below 10. |
| Food Poisoning | Food gives 2 less Appetite. |
| Blind | Can't move alone; can still be moved with the group. |
| Sluggish | Moving costs 1 extra Appetite. |
| Nightmares | Can't sleep. |
| Strained | Loses 1 extra Energy whenever Energy is lost. |
| Brain Fog | Utility traits don't work. |
| Allergies (phase) | −1 Morale each phase on a tile with an \[X\] node. |
| Unlucky | −1 Luck when scavenging and crafting. |
| Wet | −1 Morale each day without clothes equipped or a shelter. |
| Soaked (phase) | −1 Morale each phase without clothes equipped or a shelter. |
| Inept | Can't craft. |
| Clumsy | Can't use tools. |
| Weak | −1 item slot; an item that no longer fits must be given away or dropped. |
| Butterfingers | When scavenging, a chance to get nothing. |
| Tunnel Vision | 1 fewer card to choose from when scavenging or crafting. |
| Ringing Ears | Each phase, a chance to lose 1 Morale (75%), or 1 Energy at night (25%). |

**Positive conditions**

| Condition | Effect |
| --- | --- |
| Refreshed | Doesn't lose Energy. |
| Full | Doesn't lose Appetite. |
| Sated | +1 Appetite while it lasts. |
| Energized | +1 Energy while it lasts. |
| Lucky | +1 Luck when scavenging and crafting. |
| Inspired | Every Morale gain is 1 larger. |
| Motivated | The hiker's next action is free. |

New this round: Nauseous (replaces Gorged), Soaked, Inspired, Motivated.
