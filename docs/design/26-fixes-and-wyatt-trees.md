# Fixes after playtesting (bars, Camp Cleanup, Dodge, Sketchy Bridge) and Wyatt's new trees

Wyatt's notes from November 26 (evening). Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Ideas marked *(Claude's idea)* are mine.

---

## 1. An audit of every bar (Wyatt)
Wyatt: "Several of the game's timer bars are not working. Sketchy Bridge is an example: it jumps down to whatever value it's at instead of ticking steadily. Have Claude Code do a general audit of the bars and see what's working and what's not, and why."

- **What a bar should do:**
  - a bar that changes all the time (a timer, Sketchy Bridge's integrity, Spooky Ghost!'s sanity, Survive) moves **every frame, steadily**, with no lag and no jumps;
  - a bar that changes all at once (a hit, a plank falling, a crash) may ease to its new value over [0.25 s].
- **Check every bar** in every minigame, the line-up, the end screen and the pop-up:
  - the top HUD bar (`hud.module.css`, `.bar`);
  - the panel's time bar (`panel.module.css`, `.timeBar`);
  - bars each game draws itself (Sketchy Bridge's integrity and its zone bar, Rock Climb's grip, Spooky Ghost!'s sanity and the rest).
- **Things I'd look at first** (guesses, not findings):
  1. **The CSS transition.** `.bar > span` and `.timeBar > span` have `transition: width 0.25s ease-out`. When the width changes every frame, the browser restarts that transition each time, so the bar lags behind and lurches. Continuous bars probably need `transition: none` (or a class that turns it off).
  2. **Values that only change on events,** such as a bar fed from a number updated only when something happens, or a value rounded too early.
  3. **Timers that count whole seconds** (`Math.ceil(timeLeft)` feeding the width, not just the number).
  4. **A bar that remounts** every frame (a changing `key`), so it never animates and just jumps.
  5. **Two bars for one thing**, one stale.
- **Report back** in the PR, as a table: the bar, the game, works or not, why, and the fix. Then fix them all.
- **A test** *(Claude's idea)*: for the continuous bars, the width after one tick equals the value after one tick (no transition class on them).

---

## 2. Camp Cleanup (Wyatt)
Wyatt: "Higher tiers need smaller boxes and more obstacles. Once all hikers have the proper amount or more, start a countdown for 5 seconds; if they all still have the right amount, then they end, all passing. Longer countdown on higher tiers. Cut down the timer for the game by a lot as well." See `docs/mockups/minigames/fixes-nov-26-evening/58-camp-cleanup-countdown.png`.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Grid (cells) | [25 × 14] | [23 × 13] | [21 × 12] | [19 × 11] | [17 × 10] |
| Obstacles | [0] | [2] | [5] | [8] | [11] |
| Time (was 60, 60, 70, 75, 80) | [30 s] | [30 s] | [35 s] | [40 s] | [45 s] |
| Countdown | [5 s] | [5 s] | [6 s] | [7 s] | [8 s] |

- **The grid** stays centered in the same space; cells stay [12] units.
- **Obstacles** keep their rules: none on the start row or near the start, and nothing closed off. Tier II now has a couple.
- **The countdown:**
  - it starts the moment **every** hiker has their quota or more;
  - a box over the field reads "EVERYONE HAS ENOUGH", the seconds left, and "DON'T CRASH...";
  - if anyone drops below their quota (a crash), it's cancelled. It starts over from the full time when everyone is back at the quota;
  - **at 0,** the game ends right away and everyone passes;
  - the game timer keeps running under it. If time runs out first, the usual end applies.
- **The quota** stays at [3, 4, 4, 5, 5], one less with 5 or 6 hikers.

---

## 3. Dodge (Wyatt)
### 3.1 Arrows on moving attacks
Wyatt: "For moving attacks like the Eagle's Comb-Over and the Snowgirl's Avalanche, add arrows to indicate where they're going and what they are." See `docs/mockups/minigames/fixes-nov-26-evening/56-dodge-combover-arrows.png` and `57-dodge-avalanche-gap.png`.

- **During the warning,** small red arrows show which way the attack will move:
  - **Comb-Over:** [4] arrows in front of the hair wall, pointing the way it sweeps;
  - **Avalanche:** a down arrow under each falling column (none over the gap);
  - **Antler Charge, Swoop, Wing Gust and Tail Sweep** *(Claude's idea: the other attacks that sweep or charge across the box)*: arrows along the path, pointing the way it goes.
- **The arrows** are red with a dark outline (the warning red), blink at [4] per second, and fade when the attack starts moving.
- **A test:** every attack that moves across the box has arrows (a flag on the attack, `movesAcross`).

### 3.2 Avalanche: a bigger gap
Wyatt: "Make the hole in Avalanche a bit bigger, since it's nearly impossible at the moment."

- **The gap is [38] units wide,** not one column (it was one [16]-unit column). The columns on each side split their space evenly.
- **The gap starts within [60] units of the sprite** (left or right), but never right under it *(Claude's idea: with ice physics, a far gap can't be reached in time)*.
- **The warning** goes from [0.8 s] to [1.1 s] *(Claude's idea)*.

---

## 4. Sketchy Bridge (Wyatt)
Wyatt: "The bar is a bit too jumpy, make it move in smaller increments. And on lower tiers it should be a bit bigger."

- **Your zone is bigger on lower tiers:** [52, 46, 36, 28, 24] (was 44, 38, 32, 28, 24).
- **Your zone moves more gently:**
  - it rises at [360] (was 600) and falls at [260] (was 400) units per second²;
  - its speed tops out at [140] units per second *(Claude's idea)*.
- **The icon moves in smaller steps:**
  - a new target is at most [24–40] units from where the icon is, not anywhere on the bar;
  - darts (Tier III and up) jump [16–28] (was 30–50);
  - gusts push at [50] (was 70).
- **The integrity bar** ticks steadily (section 1).

---

## 5. Wyatt's trees (Wyatt)
### 5.1 A new mechanic: levels within a step ("press again")
Some steps now have **levels**. Once a step is learned, pressing it again spends points to raise its level.
- **The cost:** [1] point per level *(Claude's guess; Wyatt didn't say)*.
- **The rules:** a level needs the level before it. It doesn't need a higher party level.
- **On the panel:** small pips under the step's badge (●○○). The text shows the current level, with the next one in the hover.
- **In the data:** a step gets an optional `levels` list. Each level has its text and its `changed` words, and an optional cost.

### 5.2 Tree 2: Daredevil Loop (replaces the Rule Changer steps)

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Rule Changer** | New trait, usable ([1] per biome) | Switch a revealed minigame challenge on a tile next to Wyatt to a random minigame challenge of the same tier. **Level 2:** pick 1 of 2 random minigame challenges. **Level 3:** pick 1 of 4. |
| 2 | Rule Changer II | Upgrade, usable ([1] per biome) | As Rule Changer (at its level). Also, always on: when Wyatt lands on a minigame challenge, the first Prepare cost is free. **Level 2:** the first two are free. |
| 3 | **Minigame Master** | New trait, toggle | **On:** the next minigame challenge Wyatt lands on is completed without playing, for [4] Energy from Wyatt. Then it turns off. Once per biome. **Off:** nothing. **Level 2:** [3] Energy. **Level 3:** [2] Energy, twice per biome. |

- **Rule Changer:**
  - the new challenge is any minigame challenge that fits the tile's nodes and can play at its tier, other than the one there;
  - the swap changes the tile's placed card (`25`, section 1), and the new card shows face up;
  - the Infoboard doesn't change.
- **The free Prepare costs:**
  - the first slot (or two) filled on the Prepare screen costs nothing, whoever fills it;
  - it counts once per challenge;
  - on screen, the slot shows FREE (WYATT) in place of its cost.
- **Minigame Master:**
  - "completed" means it passes like SKIP IT: everyone on the tile passes and gets their XP;
  - if Wyatt doesn't have the Energy, it doesn't fire and stays on;
  - the toggle's uses reset each biome.
- **Remove** the old Rule Changer II and III (any tile, removing challenges) and their tests.

### 5.3 Tree 3: Scout Trail, Game Sight (replaces Smith Path)
Wyatt's new Tree 3 is all about revealing, so it fits **Scout** ("Reveals what's ahead") better than Smith. *(Claude's idea: name it Scout Trail, with the Scout color. Wyatt's classes become Naturalist, Daredevil and Scout.)*

| Tier | Trait | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Game Sight** | New trait, always on | At the start of each phase, each minigame challenge on a tile next to Wyatt has a [25%] chance to be revealed. **Level 2:** [50%]. **Level 3:** [75%]. **Level 4:** all of them. |
| 2 | Game Sight II | Upgrade, always on | As Game Sight, but up to **2** tiles away. **Level 2:** up to **3** tiles away. |
| 3 | Game Sight III | Upgrade, always on | As Game Sight II, and it reveals **cost cards** too. **Level 2:** **opportunities** too. |

- **Revealing** works like an Old Firewatch Tower reveal: the tile's placed card shows face up on the map. It's rolled for each tile, once per phase.
- **"Tiles away"** counts steps along the trail, like other ranges.
- **Remove** Toy Chest, Artisan Smith and Master Smith from Wyatt (keep their code if another hiker uses it).

### 5.4 Files to update
- `09-hikers.md`: Wyatt's section, the levels mechanic in "The system", and "Rules that need care" (Rule Changer, Minigame Master, Game Sight).
- `docs/design/skill-trails/skill-trails-data.json`, `src/content/trails/trees.ts`, `traits.ts`, `effects.ts`, and `balance.ts` (`ruleChanger`, new `minigameMaster` and `gameSight`).
- **Tests:**
  - each level's effect;
  - level costs;
  - Rule Changer's 1, 2 or 4 picks;
  - the free Prepare slots;
  - Minigame Master's Energy, uses and auto-off;
  - Game Sight's chance, range and what it can reveal (seeded).

---

## 6. Things to flag to Wyatt
- **Camp Cleanup numbers** (grid, obstacles, time, countdown) are all guesses.
- **Avalanche:** a gap near the sprite and a longer warning are my ideas.
- **Sketchy Bridge:** I read "the bar is too jumpy" as both your zone and the icon, and slowed both.
- **Levels within steps:** [1] point per level.
- **Rule Changer** keeps 1 use per biome at every level.
- **Minigame Master** gives XP as if passed.
- **Tree 3** becomes Scout Trail, and Wyatt loses Smith.
