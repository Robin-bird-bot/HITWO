# Hikers: Skill Trails (Phase 10.7)

Wyatt's design for hiker traits, skill trees, party XP and morale types. This replaces trait slots and per-hiker level-ups. Numbers in [brackets] are first guesses. Where this disagrees with `07-characters.md` or `08-overhaul-plan.md`, this file wins.

## The system

- **Every hiker has 3 trees**, and each tree is one class. A hiker's 3 trees are their 3 class tags.
- **Start of a run:** the player picks 1 of the hiker's 3 Tier 1 traits, for free.
- **Each tree has 3 tiers.** A tier either adds a **new trait** or **upgrades** one the hiker already has (Leash Puller → Leash Puller II). An upgrade replaces the trait it upgrades.
- **Party XP:** every hiker's XP fills one shared bar. Each party level gives [1] point to spend on any hiker.
- **Costs:** a Tier 2 step costs [1] point and a Tier 3 step [2]. Opening another tree (its Tier 1) costs [2]. Later, some steps may get their own cost, so keep an optional per-step cost in the data.
- **Unlocks:** Tier 1 at any party level, Tier 2 at party level [2], Tier 3 at [4]. A step also needs the step below it in the same tree.
- **When to spend:** at night or at a ranger station, so leveling never interrupts a move.
- **Levels within a step** (November 26, evening; `26-fixes-and-wyatt-trees.md`, section 5.1): some steps have levels. Once a step is learned, pressing it again raises it to its next level for [1] point. A level needs the one before it, not a higher party level. The panel shows pips under the badge (●○○), the current level's text, and the next level in the hover. An upgrade keeps the level of the step it upgrades (Rule Changer II uses Rule Changer's level for its picks).
- **No trait slots.** Morale is a morale type, separate from the trees.
- Only **Finn, Ellie, Wyatt, Mom, Gdog and Wink** have trees. Every other hiker is locked for now.

## Kinds of traits

| Kind | Badge | What it is |
| --- | --- | --- |
| Always on | Diamond | Works by itself. |
| Usable | Circle | A button with limited uses, like once per day. |
| Toggle | Rounded square: filled when on, outlined when off | Stays on or off until switched, and does something different in each. Text reads "On: …" and "Off: …". |
| Gives something | Diamond | Gives recipes or items once, when learned. Picked at the start of a run, it reads "Start with …". |

## Names and classes

The panel is **Skill Trails**. Each tree is named after its class plus a word for its area: **Trail** for Movement, **Path** for Resources, **Loop** for Utility (Leader Trail, Merchant Path, Daredevil Loop). **Tank is now Leader and Guardian is now Watcher**, everywhere.

| Area | Class | About | Color |
| --- | --- | --- | --- |
| Movement | Leader | Moves the group and pays for them | #DC3B44 |
| Movement | Follower | Moves with others for free | #E8806A |
| Movement | Scout | Reveals what's ahead | #3E8FC9 |
| Movement | Trekker | Moves alone, far and cheap | #B0473A |
| Resources | Scavenger | Better and more scavenging | #93A33A |
| Resources | Crafter | General crafting: options, Quality, cheaper recipes | #3A7752 |
| Resources | Chef | Food | #6E8F2E |
| Resources | Smith | Tools | #A0703A |
| Resources | Tailor | Clothes | #2C7C86 |
| Resources | Architect | Shelters | #6E7A3E |
| Resources | Packer | Carrying, supplies, producing items | #8A6A3E |
| Resources | Naturalist | Weather, nodes, Abundance | #4E9A7A |
| Resources | Merchant | Caps, buying and selling | #1FA39A |
| Utility | Support | Cares for others | #F0AB35 |
| Utility | Entertainer | Morale and Luck for the party | #D675EF |
| Utility | Hardy | Looks after themselves | #E27A2B |
| Utility | Watcher | Nights, Keep Watch, protection | #4A5FA8 |
| Utility | Daredevil | Challenges | #B23A48 |
| Utility | Jack | Odd, mixed, changing | #5F7487 |

Smith, Tailor and Architect are new (split from Crafter, which stays for general crafting). The new colors are first guesses.

## Morale types

Morale isn't a trait. Each hiker has one morale type, checked at **the end of every phase** for +1, −1 or nothing.

| Type | +1 Morale | −1 Morale |
| --- | --- | --- |
| Extrovert | [3] or more hikers on the tile | Alone |
| Introvert | Alone | [3] or more hikers on the tile |
| Ambivert | 2 or 3 hikers on the tile | Alone, or [4] or more |
| Foody | Appetite [7] or more | Appetite [3] or less |
| Energetic | Energy [7] or more | Energy [3] or less |
| Wanderlust | Moved this phase | Didn't move |
| Homebody | Didn't move this phase | Moved |

"Moved" includes being brought along. Counts include the hiker.

**The first 6:** Finn Extrovert, Ellie Foody, Wyatt Energetic, Mom Wanderlust, Gdog Ambivert, Wink Ambivert.

**On the hiker frame:** the type's symbol sits on the name banner (hover shows its rule). The Morale bar shows what will happen at the end of this phase:
- **Going up:** the next empty pip glows green.
- **Going down:** the last full pip empties to a red outline.
- **Can't tell yet:** a small "?" at the end of the bar. Use it for Wanderlust and Homebody while the hiker hasn't moved and can still act. The other types show what the current state would give, updated live.

## The first 6 hikers

**Bold** is the Tier 1 trait a player can start with. "First" and "last" in Copydog mean on Finn's tile this phase.


### Finn: Leader, Follower, Scavenger

Morale type: Extrovert.

**Leader Trail**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Leash Puller** | New trait, toggle | On: Finn's Move All costs him 2 Energy instead of any Appetite. Off: Nothing. |
| 2 | Leash Puller II | Upgrade, toggle | On: Finn's Move All costs him 2 Energy instead of any Appetite. Off: Each hiker Finn brings along with Move All has a [25%] chance to cost no Appetite and not use their action. |
| 3 | Leash Puller III | Upgrade, toggle | On: Finn's Move All costs him 2 Energy instead of any Appetite. Off: Each hiker brought along has a [50%] chance to cost no Appetite. Finn can bring hikers who already acted, and nobody loses an action. |

**Follower Trail**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Whatcha Up To?** | New trait, always on | Being brought along by a Move All costs Finn no Appetite. |
| 2 | Whatcha Up To? II | Upgrade, always on | Being brought along by a Move All costs Finn no Appetite and doesn't use his action. |
| 3 | Never Alone | New trait, always on | Moving onto a tile where another hiker already is costs Finn no action and no Appetite. |

**Scavenger Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Copydog** | New trait, always on | When Finn scavenges, he gets 1 more of the resource he keeps for each hiker who scavenged his tile earlier this phase. |
| 2 | Copydog II | Upgrade, always on | Finn gets 1 more of the resource he keeps for each hiker who scavenged his tile earlier this phase. If he's the first to scavenge it, he sees 2 more cards. |
| 3 | Copydog III | Upgrade, always on | Finn gets 1 more of the resource he keeps for each hiker who scavenged his tile earlier this phase. Scavenging first costs him no Appetite, and he sees 2 more cards when he scavenges last. First and last are on Finn's tile this phase. Alone, he is both first and last. |

### Ellie: Chef, Scavenger, Entertainer

Morale type: Foody.

**Chef Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Garbage Connoisseur** | New trait, always on | When crafting food, Ellie can use Metal, Stone or Flint in place of Meat, Fish or Mushroom. Each one swapped in makes every bite give 1 less Appetite. |
| 2 | Garbage Connoisseur II | Upgrade, always on | Swapped-in resources no longer lower the Appetite. |
| 3 | Garbage Connoisseur III | Upgrade, always on | Each swapped-in resource adds 1 Appetite to every bite instead. |

**Scavenger Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Furrager** | New trait, always on | Fur is much more likely when Ellie scavenges. (furWeight: [x3]) |
| 2 | Furrager II | Upgrade, always on | Fur she finds comes as x2 or x3, and she has a small chance to find Fur on tiles without a Wildlife node. (x2: [50%], x3: [50%], offNodeFurChance: [10%] per card) |
| 3 | Fur Trade | New trait, gives something | Ellie learns a recipe: 3 Fur for 1 resource of her choice. It takes her action, like crafting. No limit. |

**Entertainer Loop**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Singer** | New trait, usable (1 per day) | For 1 Energy, every hiker on Ellie's tile gains 1 Morale. |
| 2 | Loud | New trait, always on | When Ellie Keeps Watch, it also covers the tiles next to her. |
| 3 | Singer II | Upgrade, usable (1 per day) | Every hiker on Ellie's tile and the tiles next to her gains 2 Morale. No Energy. |

### Mom: Support, Merchant, Trekker

Morale type: Wanderlust.

**Support Loop**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Dog Mom** | New trait, always on | When a Dog scavenges on Mom's tile, she gains a random resource from one of the tile's nodes. |
| 2 | Agility Class | New trait, usable (1 per day) | For 1 Energy, a Dog on Mom's tile gets another action this phase. |
| 3 | Agility Class II | Upgrade, usable (1 per day) | A Dog on Mom's tile gets another action this phase. No Energy. |

**Merchant Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **MBA** | New trait, always on | Caps are more likely when Mom scavenges. (capsWeight: [x2]) |
| 2 | MBA II | Upgrade, always on | Caps are more likely, and Caps cards she finds give 2 more Caps. |
| 3 | MBA III | Upgrade, always on | Caps cards in her scavenge are kept automatically, and she still picks another card. |

**Trekker Trail**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Experienced Traveler** | New trait, always on | Moving alone has a [25%] chance to cost Mom no Appetite. |
| 2 | Experienced Traveler II | Upgrade, always on | Moving alone: [50%]. Being brought along by a Move All: a [25%] chance to cost no Appetite. |
| 3 | Experienced Traveler III | Upgrade, always on | Moving alone: [50%]. Being brought along never costs Mom Appetite, and she gains 1 Morale each time she moves. |

### Gdog: Chef, Tailor, Trekker

Morale type: Ambivert.

**Chef Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Family Cookbook** | New trait, gives something | Learn 3 random food recipes. At the start of a run: "Start with 3 random food recipes." |
| 2 | Artisan Chef | New trait, always on | Gdog can craft Tier 2 food, and sees 1 more card when crafting food. |
| 3 | Master Chef | Upgrade, always on | She can craft Tier 3 food, and sees 2 more cards when crafting food. |

**Tailor Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Clothing Catalogue** | New trait, gives something | Learn 3 random clothes recipes. At the start of a run: "Start with 3 random clothes recipes." |
| 2 | Artisan Seamstress | New trait, always on | Gdog can craft Tier 2 clothes, and sees 1 more card when crafting clothes. |
| 3 | Master Seamstress | Upgrade, always on | She can craft Tier 3 clothes, and sees 2 more cards when crafting clothes. |

**Trekker Trail**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Short** | New trait, always on | Moving alone costs Gdog 1 less Appetite. -1 item slot. |
| 2 | Short II | Upgrade, always on | Moving alone costs Gdog 1 less Appetite. Being brought along by a Move All costs her 1 less Appetite too, and the item slot comes back. |
| 3 | Homemade | New trait, always on | When crafting, Gdog sees 1 more card and has +1 Luck. |

### Wink: Leader, Architect, Packer

Morale type: Ambivert.

**Leader Trail**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Lead the Way** | New trait, always on | Hikers Wink brings along with Move All don't use their action. |
| 2 | Lead the Way II | Upgrade, always on | Hikers Wink brings along don't use their action, and his Move All costs 1 less Appetite in total. |
| 3 | Just Around the Next Corner | New trait, always on | Within 3 tiles of the checkpoint, each hiker in Wink's Move All has a [50%] chance to cost no Appetite. |

**Architect Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Floor Plans** | New trait, gives something | Learn 3 random shelter recipes. At the start of a run: "Start with 3 random shelter recipes." |
| 2 | Artisan Architect | New trait, always on | Wink can craft Tier 2 shelters, and sees 1 more card when crafting shelters. |
| 3 | Master Architect | Upgrade, always on | He can craft Tier 3 shelters, and sees 2 more cards when crafting shelters. |

**Packer Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Packed Toolbox** | New trait, gives something | Gain 2 random Tier 1 tools. At the start of a run: "Start with 2 random Tier 1 tools." |
| 2 | The Proper Way | New trait, always on | Tools in Wink's pack have 1 more use. The extra use is lost if the tool is traded away. |
| 3 | Prepper | New trait, always on | Wink doesn't set off challenges that are already revealed (by anyone). The challenge stays for the others. Moving onto that tile with other hikers: they do the challenge, Wink sits it out (no reward, no penalty). Moving there alone: nothing happens and the challenge stays. |

### Wyatt: Naturalist, Daredevil, Scout

**Updated November 26 (evening):** the Daredevil Loop is Rule Changer, Rule Changer II and Minigame Master, and his third tree is the Scout Trail (Game Sight), replacing Smith Path. Steps with levels list each level. See `26-fixes-and-wyatt-trees.md`, sections 5.2 and 5.3.

Morale type: Energetic.

**Naturalist Path**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Rain Lover** | New trait, always on | During any weather (not Clear), Wyatt has +1 Luck and sees 1 more card when scavenging. |
| 2 | Rain Lover II | Upgrade, always on | During weather, +2 Luck and 1 more card when scavenging. |
| 3 | Rain Lover III | Upgrade, always on | During weather, +2 Luck, 1 more card when scavenging, and all XP Wyatt earns is doubled. |

**Daredevil Loop**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Rule Changer** | New trait, usable ([1] per section) | Switch a revealed minigame challenge on a tile next to Wyatt to a random minigame challenge of the same tier. **Level 2:** pick 1 of 2. **Level 3:** pick 1 of 4. |
| 2 | Rule Changer II | Upgrade, usable ([1] per section) | As Rule Changer (at its level). Also, always on: when Wyatt lands on a minigame challenge, the first Prepare slot is free. **Level 2:** the first two. |
| 3 | **Minigame Master** | New trait, toggle (starts off) | **On:** the next minigame challenge Wyatt lands on is passed without playing, for [4] Energy from Wyatt. Then it turns off. Once per section. **Off:** nothing. **Level 2:** [3] Energy. **Level 3:** [2] Energy, twice per section. |

**Scout Trail**

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Game Sight** | New trait, always on | At the start of each phase, each minigame challenge on a tile next to Wyatt has a [25%] chance to be revealed. **Level 2:** [50%]. **Level 3:** [75%]. **Level 4:** all of them. |
| 2 | Game Sight II | Upgrade, always on | As Game Sight, but up to **2** tiles away. **Level 2:** up to **3**. |
| 3 | Game Sight III | Upgrade, always on | As Game Sight II, and it reveals **cost cards** too. **Level 2:** **opportunities** too. |

## Rules that need care

- **Upgrades show the full text** of the trait, with what changed from the tier before in yellow (`changed` in the data).
- **Move All** traits: "brought along" means moved by someone else's Move All. Leash Puller, Lead the Way, Short II, Whatcha Up To? and Experienced Traveler can stack when both hikers have them. Apply cost cuts before chances, and never go below 0 Appetite.
- **Leash Puller I–III:** on, Finn pays 2 Energy and nobody pays Appetite. Off (II and III), each hiker brought rolls the chance on its own. III's "bring hikers who already acted" and "nobody loses an action" are part of Off.
- **Lead the Way II:** −1 Appetite for the whole Move All, not per hiker.
- **Short II:** the −1 applies when Gdog is brought along, not when she leads the Move All.
- **Garbage Connoisseur:** the −1 (and III's +1) is per bite, for each swapped resource.
- **Fur Trade:** a recipe that uses Ellie's action like crafting. No limit.
- **Prepper:** "revealed" means revealed by anyone (Scout, Overlook, Rule Changer, being entered before). The challenge stays: with others, Wink sits it out; alone, nothing happens.
- **Rule Changer** (November 26, evening): uses reset each section, and II shares them.
  - The new challenge is any minigame challenge that fits the tile's nodes and can play at its tier, other than the one there.
  - The swap changes the tile's placed card, which shows face up. The Trail Infoboard doesn't change.
  - At levels 2 and 3, the options come from the run's seed, the moment and the tile, so the same ones show until something changes.
- **Rule Changer II's free Prepare slots:** the first slot (or two) filled on the Prepare screen costs nothing, whoever fills it. It counts once per challenge, and the slot shows FREE (WYATT).
- **Minigame Master:**
  - "Passed" means everyone on the tile passes and gets their XP, as if they won.
  - If Wyatt hasn't the Energy (or its uses this section are spent), it doesn't fire and stays on.
  - Its uses reset each section.
  - A Choice space fires it only once the minigame is the card chosen.
- **Game Sight:**
  - Each tile is rolled once a phase, at the start of the phase.
  - "Tiles away" counts steps along the trail.
  - A reveal works like an Old Firewatch Tower's: the tile's card shows face up on the map.
- **Recipe and tier traits** (Family Cookbook, Artisan Chef and the rest): "recipes" are blueprints of that item type, from enabled items only, picked from Tier 1 for the starting step. "Can craft Tier 2" gives access to that tier for this hiker. If today's crafting already lets anyone craft that tier, keep the extra-card part and flag it to Wyatt.
- **Packed Toolbox:** tools come from enabled Tier 1 tools. If the pack is full, use the usual overflow choice.
- **The Proper Way:** the extra use is marked on the tool and removed when it leaves Wink's pack.
- **Rain Lover III:** doubled XP goes into the party bar as normal.
