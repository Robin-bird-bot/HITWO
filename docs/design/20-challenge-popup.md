# The challenge pop-up, version 3: full rules, cost cards, solid bars

Wyatt's redesign of the pop-up that comes up before a challenge, in the spirit of the screen Mario Party shows before a minigame. It replaces section 1 of `10-minigames.md` ("The challenge pop-up"). The GPS, the turn and zoom on Start, and the end screen don't change.

**Version 3 (November 26, second round).** Wyatt: "it's looking amazing." His changes from version 2:
1. **Every game explains all of its important rules.** Rules that only apply sometimes show only when they do (section 1.1).
2. **Bars** are solid tan-brown bars instead of segments (section 3).
3. **Prepare takes less space** (section 4):
   - one **cost card** per cost, instead of a row per effect;
   - when the same cost can do several things, you pick what it does after filling the slot;
   - a per-hiker effect (+1 heart) takes one slot, and you pick the hiker after filling it;
   - the cards are rounded boxes, color-coded in faded green, blue and red.
4. **Slots:** an animated outline when they can be filled, darker brown frames, stronger ghost icons, and the cost written out ("×1 MEAT, FISH OR MUSHROOM", "×2 FOREST RESOURCES").
5. **Start** sits under the GPS. The note under it is gone.
6. **The demo's scanlines** are fixed (section 2.1).
7. **A bigger poster.**

**The reference is a working prototype:** `mockups/challenge-popup/prototype.html` (version 3). Open it in a browser: hover and click the slots, fill them, pick what they do and who gets it, and take things back. Screenshots are the `v3-*.png` files in the same folder. Match its layout, sizes, colors and behavior.

Numbers in [brackets] are first guesses for `balance.ts`, with `TODO(wyatt)`. The Prepare cards in section 7 are all first guesses: Wyatt will tune them after playing.

---

## 1. Layout
Same window as before: the cream window (#F4E8CC) with the red banner. The GPS is in the middle, with a column on each side. See `v3-1-start.png`.

- **Banner** (unchanged): "CHALLENGE · TIER II" on the left; the challenge name between two diamond badges with the game's icon in the middle; "WHOLE PARTY" on the right.
- **Left column, top to bottom:**
  1. **The poster** (now **156 × 234**, was 112 × 168: cream mat, dark keyline) with, beside it:
     - the flavor line in italic;
     - chips: the game (dark), its category, how long it lasts, and how hikers take part (TAKE TURNS, ONE AT A TIME, ALL TOGETHER, WHOLE PARTY);
     - this run's version when the game has random ones (NIGHT, FOG, SWITCHBACKS…).
     - Where Wyatt hasn't painted a poster yet, show an empty frame.
  2. **HOW TO PLAY** (section 1.1).
  3. **CONTROLS:** unchanged. One row per action, with keycaps, a mouse icon and a finger icon.
- **Middle:**
  - the upright GPS playing the **demo** (section 2);
  - **START** right under it, as wide as the GPS ([352 × 60], rounded [14 px], red with a darker bottom edge, the pixel font at [22 px]);
  - **no caption and no note.** The demo strip on the screen already says "A BOT IS PLAYING".
- **Right column, top to bottom:**
  1. **IF YOU FAIL:** the red-outlined box (unchanged).
  2. **THE CHALLENGE:** the bars (section 3).
  3. **Per-hiker values,** when the game has them (LIVES, TRIES, BAR…): one row per hiker, with portrait, name and the value (hearts, pips). **No slots in these rows any more:** per-hiker effects are on the cost cards (section 4).
  4. **PREPARE:** the cost cards (section 4).
- **Testing tab** (unchanged): Prepare shows in test mode too, with the Packs setting (Made-up, Empty, Lots). Nothing is really spent.

### 1.1 How to play: every rule that matters (Wyatt)
Wyatt: "make sure every game explains all the important rules. Rules that only apply sometimes should only show when they're there." His example: Trail Map's signs only when there are signs.

- **The main text:**
  - 2 to 4 short sentences in the body font, about [22 px], semi-bold, dark ink;
  - it covers how you play, how you pass, and how turns work;
  - the one thing that costs you is in red (bold in section 7).
- **Rule lines** under it, for anything else that matters:
  - up to [4] lines, each a short sentence at about [16 px], semi-bold, with a small red diamond in front;
  - a line can be **always on**, or it can have a **condition**. A line with a condition shows only when this run has it: the tier, the version (night, fog, Mixed), the animal, or the party size;
  - a line that shows because of the tier gets a small red tag after it in the pixel font: "FROM TIER II", "TIER III AND UP". Lines that show for other reasons (night, fog) don't need a tag: the chip already says so.
- **Real numbers:** the text uses this run's real numbers (lives, seconds, bins…), after Prepare. For example, "Survive for 25 seconds." or "There are 2 empty bins…".
- **Data:** `howToPlay(s)` stays (the main text, as phrases with `red`). Add `rules(s): { text: Phrase[]; when?: string }[]`, which returns only the lines that apply to this run. `when` is the tag text, if any.
- **It has to fit:** the main text plus the lines must fit the left column at the window's smallest size. Section 7 has every game's text.

---

## 2. The demo: a bot plays the real game
Unchanged from version 2:
- The GPS runs the real minigame in demo mode, with a bot giving the inputs.
- The demo uses the current Prepare choices.
- It loops, with no input and no sound.
- Reduced motion shows a still frame.

The demo bots don't change, except Raccoon Shuffle's and Rock Climb's (`22-minigame-revisions.md`).

### 2.1 The scanlines (fixed)
Wyatt: "the scanlines are a bit messed up on the preview window." The 1 px CSS lines (`PartyGps.module.css`, `.scanlines`, one dark line every 3 px) get scaled with the pop-up, so they blur into uneven bands. See `v3-6-small-hidpi.png` for the fix at a small window on a high-DPI screen.
- **Draw them on a canvas** laid over the screen, sized in **device pixels**: the screen's on-screen size × `devicePixelRatio`, with CSS size 100%.
- **The lines:** one row of [10%] black, 1 device pixel tall, every `round(3 × scale × devicePixelRatio)` device pixels (at least 2). `scale` is the pop-up's current scale.
- **Redraw** on resize, and when `devicePixelRatio` changes (browser zoom, or moving to another screen).
- **Use the same fix** wherever `.scanlines` is used.

---

## 3. Bars: solid and tan-brown (Wyatt)
Wyatt: "a bit more artistic: a deeper tan brown, to match the parchment. Solid bars rather than sections." See `v3-1-start.png`.
- **The track:**
  - a rounded bar [14 px] tall (radius [8 px]), tan (#D8C092);
  - a [2 px] darker tan edge (#A98A5C);
  - a soft inner shadow at the top.
- **The fill:** deep brown, a light gradient from #7D5835 to #6B4A2B, rounded on the left. Its width is the value's share of the bar's most.
- **Changes from Prepare** (still green, because Prepare only makes things easier):
  - **down** (slower, fewer): the part taken away becomes green hatching (#4F7F3E, diagonal);
  - **up** (more time, more bins): the part added is solid green;
  - the value on the right gets a green "−1" or "+1".
  - Changes slide in over [0.35 s].
- **The most** for each bar:
  - a Level bar goes to [10];
  - a Count bar goes to the most it can be at any tier;
  - a Time bar goes to the longest time at any tier.
- **The label** (pixel font, left) and **the value** (pixel font, right: 5/10, 3, 0:30) are unchanged.
- **Per-hiker values** (lives, tries, bars) aren't bars: they're the per-hiker rows. A heart added by Prepare pops in with a gold outline.

---

## 4. Prepare: cost cards
Hikers spend resources and items from their packs to make the challenge easier. Version 3 groups everything by **cost**.

### 4.1 A cost card (Wyatt)
Wyatt: "With a cost that benefits a hiker of your choice, make it take up only one spot, and when the cost is met, you then pick which hiker to give the benefit to. If the same cost can do multiple things, make it take up only one section, and then pick what to do. Put them in rounded boxes or wide rectangles, and color-code them in faded blues, greens and reds." See `v3-1-start.png` and `v3-5-filled.png`.
- **One card per cost:**
  - every Prepare option with the same cost (the same things accepted, the same number needed) goes on one card;
  - for example, Dodge's +1 HEART and SLOWER ATTACKS both cost Food, so they share the FOOD card.
- **The look:**
  - a rounded box ([14 px] radius, [2 px] border), as wide as the column;
  - **on the left:**
    - the card's title in the pixel font ([12 px]: FOOD, SMOKY FIRE);
    - the cost under it in the pixel font ([10 px], softer ink): "×1 MEAT, FISH OR MUSHROOM", "×2 FOREST RESOURCES";
    - then what it does, in the body font ([13.5 px]): each effect with a short note in softer ink, joined by "or";
  - **on the right:** its slots.
- **Colors** (Claude's idea for which is which; the card takes the color of its first effect):
  - **green** (#E3E6C6, border #B4BE8C): more for you: hearts, lives, tries, guesses, time, bigger zones, rings or reach;
  - **blue** (#DDE3DF, border #A9B8B4): see or know more: show a step, peek, lantern, ghost picture, keep the rules on screen;
  - **red** (#EDD8CB, border #CDA28E): a weaker challenge: slower, fewer, less damage, no skunks, skip it.
- **How many slots:** the card's effects' limits added up, but at most [3]. For example, +1 HEART (one per hiker) plus SLOWER ATTACKS ([2]) is still [3] slots.
- **Order:** the cards go in section 7's order, but cards nobody can fill go last.
- **Only cards that can apply this run.** For example, LANTERN only on the night version.

### 4.2 Costs
- **One resource:** "×2 CLAY".
- **A list:** "×1 MEAT, FISH OR MUSHROOM". **Food** in section 7 means this.
- **A group:** any resource of one node, written "×2 FOREST RESOURCES", "×2 WILDLIFE RESOURCES". The groups come from `resources.ts`:
  - Forest: wood, moss, mushroom, grass;
  - River: fish, clay, shell, seaweed;
  - Wildlife: meat, fur, oil, bones;
  - Mountain: stone, metal, flint, salt.
- **Items:** "×1 BINOCULARS", "×1 SUPPLY MAP OR TREASURE MAP".
- **One stack fills a slot:** a ×2 slot takes 2 of the same thing from one hiker (as in version 2). Mixing, such as 1 wood and 1 moss from two hikers, isn't allowed (my reading: it keeps the pop-up inventory simple).

### 4.3 A slot
- **Size:** [54 × 54], radius [11 px].
- **The frame** is darker than in version 2: #C9AE7E, with a [2 px] #8C6B43 border and an inner shadow.
- **Ghost icons:**
  - [50%] opacity (was 26%), so you can tell what they are;
  - when a slot takes several things, they fade from one to the next every [1.3 s].
- **"×2"** in the bottom-right corner when it needs more than one.
- **Who can fill it (Wyatt: animated):**
  - when hikers can fill it, the outline is split into equal arcs in their colors, as before;
  - now it **turns slowly** (one turn every [2.4 s]) and **breathes** (its opacity dips to [55%] and back every [1.6 s]);
  - with reduced motion, it's still;
  - with nobody, or when none of the card's effects has a use left, there's no outline;
  - it updates as slots fill, as before.

### 4.4 Filling a slot: pick, then what it does, then who
See `v3-2-pick.png`, `v3-3-what.png` and `v3-4-who.png`.
1. **Pick the thing.** The pop-up inventory is unchanged from version 2:
   - hover a slot to look, click it to pick;
   - one tile per hiker stack, only things that fit, and all of them;
   - faded stacks are sorted last;
   - the header shows the card's cost.
2. **Pick what it does,** if the card has more than one effect:
   - the same panel now asks **"WHAT SHOULD IT DO?"**, with "MEAT FROM FINN" on the right;
   - one button per effect: its name in the pixel font, and its note under it;
   - an effect with no uses left is faded, says "used up", and can't be picked.
3. **Pick the hiker,** if the effect is per-hiker:
   - the panel asks **"WHO GETS +1 HEART?"**;
   - one button per hiker: portrait (outlined in their color) and name;
   - a hiker who already has the most of it is faded and can't be picked.
- **Skipping steps:** with one effect, step 2 is skipped. With an effect that isn't per-hiker, step 3 is skipped.
- **Keys:** arrow keys move between buttons, Enter picks, Esc closes. Closing in step 2 or 3 leaves the slot empty.
- **The panel** stays above the slot and inside the window, as before.

### 4.5 A filled slot
- **The look:** the resource or item at full color, and the outline in the owner's color.
- **A badge** under the slot says what it does:
  - a per-hiker effect: "♥ ELLIE" on that hiker's color;
  - any other effect: its short name ("SLOW", "−1 BEE") in cream on dark ink.
- **The ×** (unchanged) empties it.
- **Clicking the filled slot** starts again from step 1, with its tile highlighted.
- **Spending** (unchanged): nothing leaves a pack until Start. Items lose one use by their own rules.

### 4.6 Skipping
Unchanged, but SKIP IT is now a **red card**. When it's filled:
- START becomes **SKIP IT**;
- the demo shows "SKIPPED";
- pressing it spends the prepare and passes everyone without playing.

### 4.7 Data
- **Each game exports cards** instead of rows:
  - `{ id, title, color, accepts: [{ kind: 'resource' | 'item' | 'group', id }], need, slots, effects: Effect[], onlyIf? }`;
  - `Effect = { id, label, short, note, perHiker?, max, param, step }`. `max` is per hiker when `perHiker` is set.
- **A filled slot** stores `{ hiker, thing, effect, target? }`. `target` is the hiker who gets a per-hiker effect.
- **Cards are made from options:** build them by grouping the options by cost, so a challenge that adds an option (Bear Country's Bear Spray) can join a card or make a new one.
- **The minigame and the demo** get the final `params`, as before.

---

## 5. Raccoon Shuffle and the GPS screen
Unchanged: resources on the GPS screen use the green pixel icons (`art/resources-green/`). The Raccoon Shuffle card is wider now (`22-minigame-revisions.md`, section 1).

---

## 6. Things every game needs to provide
- **`howToPlay`** and **`rules`** (section 1.1; the text for each game is in section 7).
- **`controls`** and **`chips`** (unchanged).
- **`bars`** and **`prepare`** (cards, section 4).
- **`demoBot`** (unchanged).

---

## 7. Every game: how to play, rules, bars and cards

**November 26 (evening): the Prepare cards' costs move to resource categories (Food, Building, Fiber, Fire, Trinkets). See `24-challenges-reset.md`, section 5, which wins where they differ.**

**How to read this:**
- **Food** means ×1 Meat, Fish or Mushroom.
- Bold words in How to play are the red phrase. <angle brackets> are this run's numbers.
- Rules marked *(TIER II AND UP)* and so on show only then, with that tag. Rules marked *(night)* and so on show only on that version, with no tag.
- Cards: **TITLE** (color), the cost, slots: the effects. "/" between effects means you pick one after filling. *(pick a hiker)* marks a per-hiker effect.
- Bots are unchanged unless they're mentioned.

### Guess and luck
**Raccoon Shuffle**
- **How to play:** "Raccoons hide in most of the bins, each holding a card with what it would steal from you. Watch the empty bins, follow them through the shuffle, then pick one. **Pick a raccoon and it steals from you.** One hiker at a time, each with their own shuffle."
- **Rules:**
  - "Some swaps are fake-outs: two bins start to cross, then go back." *(TIER II AND UP)*
  - "Two pairs of bins can swap at once." *(TIER II AND UP)*
  - "There are <2> empty bins, but at the end a raccoon takes <1> of them away. Follow them all." *(TIER III AND UP)*
  - "It's dark: only the circle around your pointer is lit." *(night)*
- **Bars:** BINS, EMPTY BINS, SWAPS, and TAKEN AWAY *(Tier III and up)*.
- **Cards:**
  - **LURE ONE OUT** (red), ×1 Meat or Fish, [2] slots: +1 empty bin (never taken);
  - **SLOWER SHUFFLE** (red), ×1 Mushroom, [2] slots: +[0.06 s] a swap.

### Puzzle and logic
**Traildle**
- **How to play:** "Guess the hidden code of digits on the trail signs. After each guess, the signs show which digits are right, which are in the wrong spot, and which aren't in the code. Hikers play in pairs: each has a code, and every guess goes on both boards. **Run out of guesses and you fail.**"
- **Rules:**
  - "A digit can show up more than once." *(TIER II AND UP)*
  - "There's a clock too: run out of time and you fail." *(TIER II AND UP)*
  - "The last hiker plays alone." *(odd number of hikers)*
- **Bars:** SIGNS, GUESSES, TIME *(Tier II and up)*.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +1 guess;
  - **SHOW A DIGIT** (blue), ×1 Thinking Cap or Glasses, [1] slot: one sign starts solved.

**Find the Path**
- **How to play:** "A hidden trail runs from the bottom of the forest to the top. Take turns picking the next step: up, left or right. A right step moves you on for free. **Wrong steps turn into trees and use up a try.**"
- **Rules:**
  - "Out of tries: you go to the back of the line, and the party loses an attempt."
  - "The first hiker through gets +1 energy. The rest then walk the trail."
  - "Fog: only your last 2 picks stay visible." *(fog)*
- **Bars:** TRIES, ATTEMPTS.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +1 try;
  - **SHOW ONE STEP** (blue), ×1 Supply Map or Treasure Map, [1] slot;
  - **LANTERN** (blue, fog only), ×1 Oil or Camping Lamp, [1] slot: clears the fog.

**Trail Map**
- **How to play:** "Turn the trail tiles so every hiker's trailhead connects to the exit, all at the same time. **Finish before the time runs out,** or everyone fails."
- **Rules:**
  - "The trails must pass through every sign, too." *(TIER II AND UP, only when there are signs)*
  - "Locked tiles are already turned the right way." *(TIER II AND UP)*
- **Bars:** TIME, TILES.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +10 s;
  - **ONE ROUTE SOLVED** (blue), ×1 Supply Map or Treasure Map, [1] slot.

**Picture Puzzle**
- **How to play:** "Rebuild your picture from the piles in the tray. Only the top piece of a pile can be taken. Hikers play in pairs and share one tray. **Finish before the time runs out.**"
- **Rules:**
  - "Putting a piece in its right spot for the first time adds time."
  - "A piece in its right spot locks." *(TIER I)*
  - "The last hiker plays alone." *(odd number of hikers)*
- **Bars:** TIME, PIECES.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +10 s;
  - **GHOST PICTURE** (blue), ×1 Camera or Old Photo, [1] slot: a faint picture under the frame.

**Thin Ice**
- **How to play:** "Holes hide under the ice. Check the safe squares: each number tells you how many holes touch it. The first check is always safe. **Step on a hole and the hiker at the front falls in.**"
- **Rules:**
  - "Flag a square you think is a hole so it can't be checked by mistake."
  - "Clear every safe square to pass. Hikers who fell in fail."
  - "There's a clock: when it runs out, everyone still in fails." *(TIER II AND UP; only on tiers with a clock)*
- **Bars:** HOLES, TIME *(when there is one)*.
- **Cards:**
  - **TEST THE ICE** (blue), ×1 Stone, [3] slots: marks one hole before you start;
  - **HIKING STICK** (green), ×1 Hiking Stick, [1] slot: each hiker's first hole only cracks.

**Fake Trail Signs**
- **How to play:** "Learn the rule, then call each sign REAL or FAKE. Real signs follow every rule; a fake breaks one. Each hiker plays a round, and every pass adds a rule. **One wrong answer and that hiker fails.**"
- **Rules:**
  - "The old rules still count."
  - "Only the newest rule is shown. Remember the rest!" *(TIER IV AND UP)*
- **Bars:** RULES (the cap), SIGNS (a round).
- **Cards:**
  - **−1 RULE** (red), ×1 Thinking Cap, [1] slot;
  - **−1 SIGN A ROUND** (red), ×1 Glasses, [1] slot;
  - **KEEP OLD RULES ON SCREEN** (blue, Tiers IV and V), ×1 Instruction Manual or Textbook, [1] slot.

### Memory
**Remember the Path**
- **How to play:** "Watch the ranger walk a trail across the grid, then walk it from memory. Each hiker gets a new path. **Run out of strikes and that hiker fails.**"
- **Rules:** "Paths can go up, down, left or right, but never back over themselves."
- **Bars:** PATH (steps), RANGER SPEED, STRIKES.
- **Cards:**
  - **FOOD** (red), Food, [2] slots: slower ranger;
  - **−1 STEP** (red), ×1 Supply Map, [1] slot.

**Memory Puzzle**
- **How to play:** "Flip cards to find matching snacks. Each hiker's sets are in their color. A match adds time. **When the time runs out, anyone with a set left fails.**"
- **Rules:**
  - "A miss takes time away." *(TIER II AND UP)*
  - "Some cards swap places before you start." *(TIER II AND UP)*
  - "Another swap comes after every miss." *(TIER III AND UP)*
  - "Some snacks come in threes." *(only when there are threes)*
- **Bars:** TIME, SETS.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +5 s;
  - **PEEK** (blue), ×1 Camera, [1] slot: every card flips up once for [1.5 s].

**Safari**
- **How to play:** "Watch the animals come down the hill. Then the hiker at the front picks the answer to the question. **A wrong guess fails that hiker,** and the next one guesses. A right guess passes them and everyone after them."
- **Rules:**
  - "There are two questions, as a relay: a right answer on the first passes only that hiker, and the rest answer the second." *(3 or more hikers)*
  - "It's night: move the flashlight to see." *(night)*
- **Bars:** ANIMALS, ANSWER SIGNS.
- **Cards:**
  - **BINOCULARS** (red), ×1 Binoculars, [1] slot: −1 answer sign;
  - **LANTERN** (blue, night only), ×1 Oil or Camping Lamp, [2] slots: [+10°] beam;
  - **FOOD** (red), Food, [1] slot: −2 animals.

**Crossroads**
- **How to play:** "Remember the arrows, then walk them through the trail crossings, one turn at a time. Each hiker walks the whole way. **Take a wrong turn and that hiker fails.**"
- **Rules:**
  - "Each hiker gets new arrows." *(only with that setting)*
  - "You have <3> seconds for each turn." *(only with Time per turn set)*
- **Bars:** ARROWS.
- **Cards:**
  - **−1 ARROW** (red), ×1 Supply Map, [2] slots;
  - **PEEK ON THE WAY** (blue), ×1 Treasure Map or Camera, [1] slot: the arrows show again for [2 s], once.

### Search
**Find the Object**
- **How to play:** "A crowd of snacks pops up. Find the ones you're asked for before time runs out; a wrong click costs time. **Each snack still missing at the end of a round puts a hiker out,** from the back of the line."
- **Rules:**
  - "Each round asks for one more snack."
  - "Wind: everything drifts across the screen." *(TIER II AND UP; windy versions)*
  - "Dark: only what's under your flashlight can be seen." *(dark versions)*
- **Bars:** TIME, TO FIND, ROUNDS.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +5 s;
  - **−1 TO FIND** (red), ×1 Binoculars or Glasses, [1] slot.

### Reaction and timing
**Trail Blocks** (Chop Tree, Mine Rockslide, River Flood, Clearing Animals)
- **How to play,** by version:
  - **Chop Tree:** "Tap when the marker is in a green zone. The closer to the edge, the stronger the swing. **Misses and weak swings cost energy.**"
  - **Mine Rockslide:** "Hold to fill the power bar, and let go in the green zone. The middle of the zone hits hardest. **Misses and weak swings cost energy.**"
  - **River Flood:** "Tap when the marker is on a green spot to scoop the water. **Misses cost energy.**"
  - **Clearing Animals:** "Whistle when the shrinking circle's edge is in the ring. **Too early or too late costs energy.**"
- **Rules:**
  - "Each hiker has a share of energy. When yours runs out, the next hiker takes over, and the work done stays."
  - "A perfect hit gives a little energy back."
  - "If everyone runs out first, nobody gets past."
- **Bars:** WORK, ZONES.
- **Cards,** by version:
  - **Chop Tree:** **SHARPEN** (green), ×1 Flint, [2] slots: bigger zones; **BRING AN AXE** (red), ×1 Woodcutting Axe, [1] slot: half the work;
  - **Mine Rockslide:** **BRING A PICKAXE** (red), ×1 Pickaxe, [1] slot: half the work; **WEDGES** (green), ×1 Metal, [2] slots: bigger zones;
  - **River Flood:** **DIG A DITCH** (red), ×1 Shovel, [1] slot: half the water; **PATCH THE BUCKET** (green), ×1 Clay, [2] slots: bigger zones;
  - **Clearing Animals:** **BAIT** (red), ×1 Meat or Fish, [2] slots: −1 animal; **BIGGER RING** (green), ×1 Grass, [2] slots.

**Sleeping Bear**
- **How to play:** "One at a time, sneak from the post to the flag while the bear sleeps. Hold to walk, and let go when he stirs. **Move while he's awake and you're caught.**"
- **Rules:**
  - "Caught: you lose a resource and start Bleeding."
  - "The party shares one clock. When it runs out, anyone not across fails."
  - "Sometimes he stirs and goes back to sleep. Don't fall for it." *(TIER II AND UP)*
- **Bars:** CLOCK, LIGHT SLEEPER.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +10 s;
  - **QUIET STEPS** (red), ×1 Fur, [2] slots: −1 light sleeper;
  - **SKIP IT** (red), ×2 Bear Spray, [1] slot.

**Whackoon**
- **How to play:** "Everyone plays at once. Whack the raccoons wearing your color's mask until you have <6>. **Leave the skunks alone:** they fog the cans and take time off the clock."
- **Rules:**
  - "Done hikers' raccoons keep popping up. Whacking one wastes a moment."
  - "Short of your whacks when time runs out: you fail and lose energy."
- **Bars:** TIME, POP-UP SPEED, WHACKS EACH.
- **Cards:**
  - **FOOD** (red), Food, [2] slots: slower raccoons;
  - **NO SKUNKS** (red, Tier III and up), ×1 Oil, [1] slot.

**Trail Blazes**
- **How to play:** "Two trunks slide past each other. Tap when the two lit blazes are level. One hiker at a time. **<3> misses and you fail.**"
- **Rules:**
  - "Letting the lit pair pass each other counts as a miss."
  - "Each pair can change the trunks' speeds." *(TIER III AND UP)*
  - "The trunks wobble as they get close." *(TIER V)*
  - "A miss costs 2 seconds, and you fail when time runs out." *(with the Clock setting, instead of misses)*
- **Bars:** TRUNK SPEED, LEVEL WINDOW.
- **Cards:**
  - **FOOD** (red), Food, [2] slots: slower trunks;
  - **BRIGHTER PAINT** (green), ×1 Oil, [2] slots: [+1] unit window.

**Firefly Catch**
- **How to play:** "Tap when the firefly is inside your jar ring. Both of them move. One hiker at a time. **Catch <3> before your time runs out.**"
- **Rules:**
  - "A miss costs 1 second." *(TIER II AND UP)*
  - "The firefly goes dark now and then. You can still catch it." *(TIER III AND UP)*
- **Bars:** RING SIZE, FIREFLY SPEED, TIME.
- **Cards:**
  - **BIGGER JAR** (green), ×1 Clay, [2] slots: [+3] ring;
  - **FOOD** (red), Food, [2] slots: slower fireflies.

**Size Up**
- **How to play:** "Grow or shrink the find on the trail until it matches the field guide's drawing, then lock it in. One try each. **Get within <8%> before time runs out.**"
- **Rules:** "The find is turned around, so judge its size, not its angle."
- **Bars:** PASS WITHIN, TIME.
- **Cards:**
  - **MEASURING STICK** (green), ×1 Wood, [2] slots: [+1%] pass;
  - **FOOD** (green), Food, [2] slots: +2 s.

**Fly Swatter**
- **How to play:** "Circles pop up where flies are about to land. Tap each one before it shrinks away. One hiker at a time. **<3> strikes and you fail:** a fly that lands is a strike."
- **Rules:**
  - "Tapping where there's no circle is a strike." *(TIER III AND UP)*
  - "Leave the bee circles alone: tapping one is a strike." *(TIER III AND UP)*
- **Bars:** SHRINK TIME, FLIES.
- **Cards:**
  - **BIGGER SWATTER** (green), ×1 Grass, [2] slots: [+4] circle size;
  - **FOOD** (red), Food, [2] slots: [+0.15 s] shrink.

### Movement and dodging
**Dodge** (every animal; the prototype's example)
- **How to play:** "Dodge the <animal>! Steer your hiker around the box and stay out of the way. **Each hit costs a heart.** Hikers take turns every <5> seconds. Survive for <25> seconds."
- **Rules:**
  - "A hiker who loses every heart is out. The others keep going." (always)
  - Then the animal's own lines, up to [3], only when they apply:
    - **Bear with a Gun:**
      - "Snipe hits for 2 hearts and leaves a hole you can't walk on." *(TIER III AND UP)*
      - "Traps land gray. Once they turn red, they bite."
      - "Bullet rings fly out from the top. Find the gaps." *(TIER IV AND UP)*
    - **Ants:**
      - "Fire ants blow up, all but one. Stand by the safe ant." *(TIER III AND UP)*
      - "Ant hills are solid, and they fire ants at you." *(TIER III AND UP)*
    - **Bear with a Sword:**
      - "Numbered swords fly across the box in order."
      - "The box can shrink." *(TIER III AND UP)*
    - **Woods Monster:** "At half time the box shrinks, and the lights can go out."
    - **Stampede:** "Animals take turns attacking. The box follows whoever's attacking."
    - Other animals: Claude Code adds a line for anything an attack does besides "a hit costs a heart" (a bear hug holds you, and so on), checking each attack's file.
- **Bars:** ATTACK SPEED, plus the animal's own count where it has one (BEES PER WAVE, ANTS PER LINE).
- **Per hiker:** LIVES.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 heart *(pick a hiker; once each)* / slower attacks ([2] at most);
  - **SMOKY FIRE** (red, bees only), ×2 Forest resources, [1] slot: −1 bee per wave;
  - **BEAR SPRAY** (red, Bear, Bear with a Sword and Bear with a Gun), ×1 Bear Spray, [1] slot: [25%] shorter;
  - **SANDBAGS** (red, Bear with a Gun only), ×2 Clay, [1] slot: traps and holes last half as long;
  - **SALT LINE** (red, ants only), ×1 Salt, [2] slots: ant lines [20%] slower;
  - **SKIP IT** (red, Bear Country only), ×2 Bear Spray, [1] slot.
  - The Woods Monster allows the FOOD card's +1 heart only.

**Camp Cleanup**
- **How to play:** "You're all one long line. Steer around the campsite and pick up trash in your colors; each piece adds a bag to the end of the line. **Hit a wall, a rock or yourself and you lose bags.** Everyone needs <5> bags when time runs out."
- **Rules:**
  - "You can't turn straight back, but quick turns queue up."
  - "Rocks, stumps, logs and tents are in the way." *(TIER III AND UP)*
- **Bars:** TIME, SPEED, BAGS EACH.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +10 s / slower ([2] at most each);
  - **−1 BAG EACH** (red), ×1 Sack, [1] slot;
  - **CLEAR THE OBSTACLES** (red, Tier III and up), ×1 Shovel, [1] slot: [−2] obstacles.

**Crossings** (Road, River, Critter)
- **How to play:** "Get every hiker across, one hop at a time. **A hit costs a life,** and sends that hiker back to the start and to the back of the line. Out of lives and you're out."
- **Rules:**
  - "On the river, ride the logs and turtles. The water is a hit, and so is riding off the edge." *(river lanes)*
  - "Turtles dive. Don't stand on one when it does." *(river lanes)*
  - "Road at the bottom, river at the top, with a safe bank between." *(Mixed)*
  - "Some critters stop, then go on." *(Critter Crossing, TIER II AND UP)*
- **Bars:** TRAFFIC SPEED.
- **Per hiker:** LIVES.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 life *(pick a hiker; once each)* / slower traffic ([2] at most);
  - **MORE LOGS** (green, river lanes), ×2 Wood, [1] slot.

**Train!**
- **How to play:** "Hop up and down between the tracks as trains come through. Watch for the headlight and the "!". **A hit costs a life.** Hikers take turns every <5> seconds."
- **Rules:**
  - "Trains come from either side." *(TIER III AND UP)*
  - "Fog hides the far side. Watch the warnings." *(fog)*
- **Bars:** TRAIN SPEED, SURVIVE.
- **Per hiker:** LIVES.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 life *(pick a hiker; once each)* / slower trains ([2] at most);
  - **BRIGHTER WARNING** (blue, fog only), ×1 Oil, [1] slot: [+0.3 s] warning.

**Rafting**
- **How to play:** "Steer the raft upriver to the dock. **Hitting a rock costs a life.** Reach the dock with any life left and everyone passes."
- **Rules:**
  - "Rapids don't hurt, but they speed everything up for the rest of the run."
  - "Big rocks can cover two lanes." *(TIER V)*
- **Bars:** RIVER SPEED.
- **Per hiker:** LIVES (lost in line order).
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 life *(pick a hiker; once each)* / slower river ([2] at most);
  - **STURDIER RAFT** (green), ×2 Wood, [1] slot: the first hit doesn't count.

**Trails**
- **How to play:** "Keep your hiker on the trail as it comes down the screen. Off the trail, your bar drains, and it never refills. **Empty bar and you fail.** Reach your checkpoint to pass; the next hiker takes over there."
- **Rules:**
  - "If you run out, the next hiker takes over where you stopped."
  - "If the end isn't reached, hikers who passed come back to finish it."
  - "Ridgeline: the drops on both sides drain twice as fast. Scree slides you, and wind gusts push you." *(Ridgeline)*
- **Bars:** SCROLL SPEED, TRAIL WIDTH.
- **Per hiker:** BAR.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +0.5 s bar *(pick a hiker; once each)* / slower ([2] at most);
  - **HIKING STICK** (green), ×1 Hiking Stick, [1] slot: [+4] width.

**Rock Climb** (new rules: `22-minigame-revisions.md`, section 2)
- **How to play:** "Aim, hold for power, and let go to jump. Grab a hold in the active hand's color. **A fall costs that hiker a try and 1 energy.** Jump up past the top line to finish."
- **Rules:**
  - "Each hiker has <3> tries. Out of tries, you're out, and your holds change to other hikers' colors."
  - "If everyone is out, everyone fails."
  - "One grab try per jump." *(TIER III AND UP)*
- **Bars:** HOLDS (to the top), GRAB REACH, ARROW SPEED.
- **Per hiker:** TRIES.
- **Cards:**
  - **CHALK** (green), ×1 Salt, [2] slots: [+2] reach;
  - **FOOD** (green), Food, [3] slots: +1 try *(pick a hiker; once each)*;
  - **HARNESS** (green), ×1 Harness, [1] slot: the first fall costs nothing.
- **Bot:** as before. With tries now, the demo ends when it reaches the top or everyone is out.

---

## 8. Tests
- **How to play:**
  - `rules` returns only lines that apply to this run (for example, Trail Map's sign line only when there are signs);
  - the text uses this run's numbers after Prepare;
  - every game's text fits the left column at the smallest window.
- **Cards:**
  - options with the same cost share one card;
  - a card never has more than [3] slots;
  - the outline shows exactly the hikers who can fill the slot right now, and none when the card's effects are used up.
- **Filling:**
  - step 2 shows only with several effects, and step 3 only for per-hiker effects;
  - used-up effects and maxed hikers can't be picked;
  - closing early leaves the slot empty;
  - × empties a slot and frees its effect.
- **Spending:** nothing leaves a pack before Start, and Start takes exactly what's in the slots, from the right hikers.
- **Bars:** they show the tier's value as a share of the most, with every change in green.
- **Scanlines:** after a resize or a zoom, the canvas matches the screen's device pixels.
- **Skip** and **the demo:** unchanged from version 2.
