# Nights and weather

Night events, weather, and the conditions and nodes they add. Numbers in \[brackets\] are first guesses to tune.

## Night events

### How a night works

1. **Pick a tier.** Each night the game picks one of the 3 tiers. Tier 1 is the most common and Tier 3 the rarest, and the later tiers get more common in later biomes.
2. **Pick a creature** from that tier's list. Only one creature and one tier per night.
3. **Roll for each hiker.** Each hiker who is exposed has a chance to be hit. A hiker is **safe** if they're on a tile with a shelter, or on a tile where any hiker chose Keep Watch.
4. **Pick what happens.** For each hiker hit, the game picks one of that tier's outcomes at random, skipping any that can't apply (no caps to steal, no clothes, the hiker doesn't meet an injury outcome's condition).
5. **Show it.** If anyone was hit, a small night event window shows the creature and one line for each hiker. If nobody was hit, nothing shows.

**Tier odds by biome** \[first guess\]:

| Biome | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| 1 | 70% | 25% | 5% |
| 2 | 45% | 40% | 15% |
| 3 | 25% | 45% | 30% |

**Chance for each exposed hiker** \[first guess\]:

- Starts at 30%.
- Alone on their tile: ×1.5 (45%).
- Each other hiker on the tile lowers it: ×0.75 per hiker (2 hikers 22%, 3 hikers 17%, 4 hikers 13%).
- Low Morale raises it: +10 points at Morale 5 or less, +20 at Morale 2 or less.

### The tiers

| Tier | Creatures | Outcomes (one is picked for each hiker hit) |
| --- | --- | --- |
| 1 | Raccoons, Opossums, Foxes, Bats, Drunk Hiker | Swap X\[1–5\] of the hiker's resources for random ones. / Steal X\[1–3\] caps. / Steal X\[1–3\] resources. / Lose X\[1–2\] Morale. / 1 equipped clothing item loses 1 durability. / 1 food card permanently gives 1 less Appetite. / Swap 1 item with a random item from a hiker on another tile. / Lose X\[1–3\] XP. / Wet, Unlucky or Clumsy for 1 day. |
| 2 | Wolves, Coyotes, Hyenas, Robbers, Raccoon Gang | Lose X\[1–3\] Energy. / Lose X\[1–3\] Appetite. / Every food card the hiker carries permanently gives Y\[1–2\] less Appetite. / Every equipped clothing item loses 1 durability. / Steal 1 random item. / Gain 1 injury \[only if the hiker is alone and has 4 or less Energy or Appetite\]. / Chased back to a random connected tile in the row behind \[if it's unrevealed, its challenge is revealed in the morning\]. / Bleeding, Brain Fog or Nightmares (Y\[1–2\] days, or Y\[2–3\] phases for Bleeding). |
| 3 | Bears, Leopards, Bobcats, Cultists, Monster | Steal X\[1–2\] random items. / Steal all of the hiker's resources. / Every equipped clothing item loses X\[2–3\] durability. / Lose X\[2–3\] Energy and X\[2–3\] Appetite. / Lose X\[1–2\] each of Energy, Appetite and Morale. / Gain 1 injury \[only if the hiker has 6 or less Energy or Appetite, on a tile with 2 or fewer hikers\]. / Gain 1 injury \[only if the hiker has 5 or less Morale, on a tile with 2 or fewer hikers\]. / Bleeding, Nightmares, Frozen or Soaked. |

**Art:** all 15 creatures have art.

### The lines

Each outcome becomes a short sentence with the creature and the hiker's name, written for that creature where it makes sense:

- "The raccoons stole 2 caps from Cody."
- "A drunk hiker spilled their drink on Finnegan. Finnegan is Wet."
- "The bear attacked Grandpa W. They're Bleeding."
- "The wolves chased Cody back down the trail."

Every outcome needs a generic line ("The {creature} stole {X} resources from {hiker}."), and creatures can have their own versions that replace it. Wyatt can write more of these later.

### The window

- A **small side window**, styled like the side panels, that sits beside the right-hand panel. It doesn't dim or blur the map, and it has a − button to minimize it like the other panels.
- From top to bottom:
  - a midnight-blue ribbon with "NIGHT EVENT";
  - the creature's art as a banner;
  - the creature's name in large Edit Undo;
  - one line for each hiker hit, with their portrait and a small chip for the result (−2 caps, Bleeding, and so on);
  - an OK button.
- It's movable like the other windows.

## Weather

### How it works

- The forecast counter decides when the weather changes. Clear weather has no effects.
- Each weather has **two effects**: one on the **hikers** and one on the **nodes**.
  - **Hiker effects start after the first full day** of that weather, as a grace day.
  - **Node effects start at once.**
- When the weather ends, every changed node goes back to normal and the weather's conditions (Shivering, Burning) end.
- For now, weather has no special tile challenges. Those may come later.

| Weather | Hiker effect | Node effect |
| --- | --- | --- |
| **Rain** | **Drizzle:** at the start of each phase, a hiker who isn't wearing any clothing and isn't on a tile with a shelter becomes Wet. Each phase, every equipped clothing item has a 35% chance to lose 1 durability. | **Floods:** at the start of each phase, each Mountain node has a 15% chance to become a **Flooded node**, which counts as a River node. |
| **Storm** | **Static Air:** at the start of each phase, a hiker with full Energy is struck by lightning: they gain 1 injury and their Energy drops to half. | **Thunder:** Wildlife resources are much rarer when scavenging \[Wildlife draw weight ×0.25\]. |
| **Snow** | **Sheer Cold:** at the start of each phase, each hiker gains 3 Shivering, minus 1 for each clothing item they wear, minus 1 for each other hiker on their tile, and minus 2 on a tile with a shelter. If the total is below 0, they lose that much Shivering instead (never below 0). | **Freezing:** at the start of each phase, each River node has a 15% chance to become a **Frozen node**, which gives no resources. |
| **Heatwave** | **Blistering Heat:** at the start of each phase, each hiker gains 1 Burning for each clothing item they wear and for each other hiker on their tile. | **Forest Fires:** at the start of each phase, each Forest node has a 15% chance to become a **Fire node**. Fires also spread: each tile with a Forest node that's connected to a tile with a Fire node has a 35% chance to catch. A hiker who ends a phase on a tile with a Fire node gains 1 Burning. |

**New nodes** (art: 257 Fire, 258 Frozen, 259 Flooded):

- **Flooded node:** counts as a River node. Turns back into a Mountain node when the rain ends.
- **Frozen node:** gives no resources. Turns back into a River node when the snow ends.
- **Fire node:** doesn't count as a Forest node, and gives +1 Luck to every other node on its tile. Turns back into a Forest node when the heatwave ends.

**New conditions** (both stack, and both are in the Conditions list):

- **Shivering:** at 3 or more, the hiker is Frozen. At 5 or more, they gain 1 injury and Shivering resets to 0. Lasts until the snow ends or it drops to 0.
- **Burning:** −1 maximum Energy for each stack. At 5, the hiker gains 1 injury and Burning resets to 0. Goes down by 1 in any Night phase where the hiker gains none. Lasts until the heatwave ends or the injury.

### The weather change screen

- **Not a pop-up.** The whole screen blurs, and everything sits on top of the blur, centered.
- **The icon:** a large animated icon in the simple style of a phone weather app, at the top.
  - **Rain, Storm, Snow:** it starts as a sun. Then a cloud slides in and covers it (or the sun slides out to the left as the new icon slides in from the right).
  - **Rain:** a cloud with raindrops falling.
  - **Storm:** a cloud with a lightning bolt that flashes.
  - **Snow:** a cloud with snowflakes drifting down.
  - **Heatwave:** a sun with rays around it. The circle grows while the rays shrink and spin faster around it.
- **Under the icon:** the weather's name in large Edit Undo, then a small section with its two effects (name and one line each).
- **At the bottom:** a "Ready" button to move on.

## Balance notes

- **Drizzle and the Wet rule:** Wet + Wet = Soaked. So an unclothed hiker in the rain becomes Wet in one phase and Soaked in the next. That's probably fine (clothes or a shelter fix it), but Drizzle could refresh Wet instead if it's too harsh.
- **Drizzle wear:** a 35% chance per clothing item each phase works out to about 1 durability a day, so clothes last through a normal rain.
- **Sheer Cold stays at 3 Shivering per phase.** With the grace day, hikers almost always reach another hiker or a shelter before taking all 3 at once.
- **Heat and cold pull opposite ways,** which is a nice puzzle. In the snow, hikers bundle up and huddle together. In a heatwave, they strip off and spread out.
- **Burning cools off at night:** it drops by 1 in any Night phase where the hiker gains none, so taking clothes off and splitting up lets hikers recover.
- **Storm only hurts hikers at full Energy,** so a hiker can stay safe by spending a little Energy. Good: it's a clear rule to play around.
- **Night injury outcomes have conditions.** When a hiker doesn't meet them, the game picks another outcome, so injuries stay rare for well-fed groups.
