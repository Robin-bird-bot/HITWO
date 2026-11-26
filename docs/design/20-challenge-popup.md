# The challenge pop-up, version 2: how to play, a bot demo, bars and Prepare slots

Wyatt's redesign of the pop-up that comes up before a challenge, in the spirit of the screen Mario Party shows before a minigame. It replaces section 1 of `10-minigames.md` ("The challenge pop-up"). The GPS, the turn and zoom on Start, and the end screen don't change.

**The reference is a working prototype:** `mockups/challenge-popup/prototype.html`. Open it in a browser and play with it: hover and click the slots, fill them, take things back. Screenshots are in the same folder. Match its layout, sizes, colors and behavior.

Numbers in [brackets] are first guesses for `balance.ts`, with `TODO(wyatt)`. The Prepare options in section 7 are all first guesses: Wyatt will tune them after playing.

---

## 1. Layout
Same window as before: the cream window (#F4E8CC) with the red banner. The GPS is in the middle, with a column on each side. See `mockups/challenge-popup/1-start.png`.

- **Banner** (unchanged): "CHALLENGE · TIER II" on the left; the challenge name between two diamond badges with the game's icon in the middle; "WHOLE PARTY" on the right.
- **Left column, top to bottom:**
  1. **A small poster** (112 × 168, cream mat, dark keyline) with, beside it:
     - the flavor line in italic;
     - chips: the game (dark), its category, how long it lasts, and how hikers take part (TAKE TURNS, ONE AT A TIME, ALL TOGETHER, WHOLE PARTY);
     - this run's version when the game has random ones (NIGHT, FOG, SWITCHBACKS…).
     - Where Wyatt hasn't painted a poster yet, show an empty frame.
  2. **HOW TO PLAY:** the biggest, clearest text on the screen. It's 2 to 4 short sentences in the body font, about [22 px], semi-bold, dark ink, with the one thing that matters most (usually what costs you) in red. The text for every game is in section 7.
  3. **CONTROLS:** one row per action, with the action on the left in the pixel font (MOVE, TAP, PICK…) and the inputs on the right, drawn as small pictures:
     - keycaps: cream keys with a dark border and a thicker bottom edge, the letter in the pixel font;
     - a mouse icon, and a finger icon for touch;
     - "or" between choices.
     - Only real inputs: each game's own design file says what they are.
- **Middle:** the upright GPS playing the **demo** (section 2), with a two-line caption under it: "A BOT PLAYS A DEMO ROUND. IT USES WHATEVER YOU'VE PREPARED."
- **Right column, top to bottom:**
  1. **IF YOU FAIL:** the red-outlined box (it was called If hit), from the challenge's own costs.
  2. **THE CHALLENGE:** the bars (section 3).
  3. **Per-hiker values,** when the game has them (LIVES, TRIES, BAR…): one row per hiker, with portrait, name, the value (hearts, pips) and that hiker's Prepare slot at the end.
  4. **PREPARE:** one row per effect (section 4).
  5. **START,** the big red button. Under it: "Nothing is used until you press Start…"
- **Testing tab:** the pop-up now shows Prepare in test mode too, so it can be tried. The testing tab gets a **Packs** setting: Made-up (default: a few random resources and items per hiker), Empty, Lots. Nothing is really spent in test mode.

---

## 2. The demo: a bot plays the real game
- **The real game:** the GPS screen runs the actual minigame in **demo mode**, with a bot giving the inputs instead of a player. It uses the same code as the real game, so what you see is what you'll get.
- **It uses the current Prepare choices.** Fill a SLOWER ATTACKS slot and the demo's attacks slow down; add a heart and that hiker's heart row grows. Changes take effect at once where they can, otherwise at the next demo round.
- **On screen:**
  - the upright screen is 3:4, so the 4:3 game is drawn as wide as the screen and centered;
  - above it, a dark strip with **DEMO** (blinking) and "A BOT IS PLAYING";
  - see the prototype for the look.
- **Looping:** when the demo round ends (passed, failed or out of time), the result shows for [2.4 s], then a new round starts. Long games are cut to a [30 s] demo.
- **No input and no sound.** Clicks on the GPS do nothing. With reduced motion, show one still frame from the middle of a demo round instead.
- **The bot** plays decently but not perfectly. It makes a mistake about [15–25%] of the time, so the demo shows what failing looks like too. Each game exports a small `demoBot` next to its logic. Section 7 says what each bot does.
- **The real hikers:** the demo uses the party's real hikers (colors, names, lives), but nothing that happens in it counts.

---

## 3. Bars: the numbers Prepare can change
Each game lists its **bars** (section 7): the values a Prepare option can change, plus the main value that sets how hard it is, even if nothing changes it.

- **The look** (see the prototype; it matches the pop-up's art):
  - a label on the left in the pixel font;
  - a row of square segments, each with a [2 px] dark border, filled dark for the value;
  - the value on the right in the pixel font (5/10, 3, 0:30).
- **Kinds of bar:**
  - **Level** (speed, how close counts…): [10] segments, and the tier sets the start;
  - **Count** (barrels, bees per wave, bins…): one segment per unit, up to the most it can be;
  - **Time:** one segment per [5 s] (or [10 s] for long games), with the seconds as the value.
- **A change from Prepare:**
  - it's always shown in green (#3F7A3A), because Prepare only makes things easier;
  - **when the value goes down** (slower, fewer), the segments taken away become green hatching;
  - **when it goes up** (more barrels, more time), the added segments are green-filled;
  - the value gets a green "−1" or "+1" after it.
- **Per-hiker values** (lives, tries, bars) aren't bars. They're the per-hiker rows (section 1): hearts or pips. A heart added by Prepare pops in with a gold outline.

---

## 4. Prepare: slots you fill with resources and items
Hikers spend resources and items from their packs to make the challenge easier. Each **row** is one effect, and each **slot** in it is one use of that effect (Wyatt: a row per effect, so one resource can be used in different rows for different effects).

### A row
- **The effect's name** in the pixel font (SLOWER ATTACKS), and under it one short line on what each slot does (−1 speed each).
- **Its slots** on the right, as many as the most it can be used. Per-hiker effects (+1 heart) put one slot in each hiker's row instead (section 1).
- **Only rows that can apply this run.** For example, LANTERN only when this run is the night version. Random versions are picked before the pop-up opens, so it knows.

### A slot (empty)
- **Size:** a [52 × 52] box with rounded corners, a sunken cream-brown fill (#EADBB4) and a dashed border.
- **Ghost icon:** a see-through ([26%]) picture of what it takes. If it takes more than one thing (Meat, Fish or Mushroom), it fades from one to the next every [1.3 s].
- **How many:** if it takes more than one of something, "×2" in the pixel font in the bottom-right corner.
- **Who can fill it (Wyatt):**
  - the box gets a [3 px] outline in the color of every hiker who has enough to fill it;
  - with several hikers, the outline is split into equal arcs, one color each (a conic gradient);
  - with nobody, it stays dashed;
  - this updates as slots fill, because a stack used in one slot can't be used in another.
- **Per-hiker slots** also show "+1♥" (or the effect) small in the top-left corner.

### The pop-up inventory (Wyatt: like Zelda BOTW's)
- **Opening it:**
  - **hovering** a slot shows it, but only to look: nothing can be picked, and the header says "CLICK THE SLOT TO PICK";
  - **clicking** (or tapping) the slot opens it for picking, and the header says "PICK ONE";
  - it closes after a pick, a click anywhere else, or Esc.
- **The look:**
  - a dark green-black panel (rgba(20,26,20,.96)) with a [2 px] #4A5A44 border, rounded corners, and a little pointer down to the slot;
  - it sits above the slot and stays inside the window.
- **The header:** what the slot takes and how many ("MEAT, FISH OR MUSHROOM ×1"), and the mode on the right.
- **Tiles** ([56 × 56], up to 5 in a row):
  - **one tile per hiker stack** (Wyatt: show each hiker's stack). Finn's Meat and Mom's Meat are two tiles;
  - each tile shows the resource or item picture, a corner triangle in the owner's color with their initial, and the count left ("×3") in the pixel font;
  - **only things this slot takes,** and every one of them: if nobody has one, it still gets a single faded tile with no owner;
  - **faded** ([30%], mostly grey) when the stack doesn't have enough for the slot, or it's all being used in other slots. These can't be picked;
  - **sorted:** the ones you can use first (in the slot's order of things, then line order), and the faded ones at the end.
- **The foot line,** when hovering a tile: "MOM'S GRASS · 3 FREE", "FINN'S MEAT · 0 FREE (REST IN OTHER SLOTS) · NEEDS 1" or "FISH · NOBODY HAS ANY".
- **Keys:** with the inventory open, arrow keys move between tiles, Enter picks, and Esc closes.

### A filled slot
- **The look:** the resource or item at full color, with the slot's outline in the owner's color.
- **The ×:** a small round × button on the top-right corner, with the × in the pixel font (EditUndo), cream on dark ink and red on hover. Clicking it empties the slot (Wyatt). The × doesn't open the inventory.
- **Clicking the filled slot itself** opens the inventory to swap what's in it. Its current tile is highlighted.
- **Spending:**
  - nothing leaves anyone's pack until **Start**;
  - on Start, the resources come out of the owners' packs;
  - an item uses one of its uses, by its own rules in `03-items.md`: tools lose a use, and single-use items are used up.

### Skipping
- Some challenges have a **SKIP IT** row (Bear Country: 2 Bear Spray).
- When it's filled:
  - START becomes **SKIP IT**;
  - the GPS demo shows "SKIPPED" over a still frame;
  - pressing it spends the prepare and counts the challenge as passed by everyone, without playing.

### Data
- **Each game exports** its bars and its Prepare rows. A challenge can add rows or change them (Bear Country's Bear Spray).
- **A row:**
  - `{ id, label, line, slots, perHiker?, accepts: [{ kind: 'resource' | 'item', id }], need, effect: { param, step }, onlyIf? }`;
  - `onlyIf` is for things like the night version.
- **The minigame** gets the final `params` (tier numbers plus every effect) when it starts, and so does the demo.
- **The pop-up returns** what was spent and from whom, so the game can take it out of the packs on Start.

---

## 5. Raccoon Shuffle and the GPS screen
Resources drawn **on the GPS screen** (Raccoon Shuffle's cards, and any later game that shows them) use the new pixel icons in the greens: `art/resources-green/<id>.png` (12 × 12, 16 resources plus `energy`). The painted icons are only for the pop-up and the rest of the game's UI. The fixes are in `18-minigames-quick.md`, section 6 (revised).

---

## 6. Things every game needs to provide
- **`howToPlay`** (section 7), **`controls`** (from its design file), **`chips`**.
- **`bars`** and **`prepare`** (section 7).
- **`demoBot`** (section 7).

---

## 7. Every game: how to play, bars, Prepare and the demo bot
**Food** below means Meat, Fish or Mushroom ×1: the general stamina help, as in Wyatt's example. More specific resources and items do the more specific things. Bold words in How to play are the red phrase.

### Guess and luck
(Bearrels is gone: `21-minigames-dodge-camp.md`, section 0. Bear Country is under Dodge below.)

**Raccoon Shuffle**
- **How to play:** "Watch which bins hold raccoons and what they'd steal. Then follow the shuffle and pick an empty bin. **Pick a raccoon and it steals from you.**"
- **Bars:** BINS (count), EMPTY BINS (count), SWAPS (count).
- **Prepare:**
  - LURE ONE OUT (+1 empty bin): Meat or Fish ×1, [2] slots;
  - SLOWER SHUFFLE (+[0.06 s] a swap): Mushroom ×1, [2] slots.
- **Bot:** follows one empty bin, and loses track [25%] of the time.

### Puzzle and logic
**Traildle**
- **How to play:** "Guess the hidden code of digits. After each guess the signs show which digits are right, which are in the wrong spot, and which aren't in it. **Run out of guesses and you fail.**"
- **Bars:** GUESSES, TIME (Tier II and up).
- **Prepare:**
  - +1 GUESS: Food, [2] slots;
  - SHOW A DIGIT (one sign starts solved): Thinking Cap or Glasses ×1, [1] slot.
- **Bot:** makes guesses that fit the marks so far, with a random first guess.

**Find the Path**
- **How to play:** "A hidden trail runs from the bottom to the top. Take turns guessing it one step at a time. **Wrong steps run into the trees** and use up tries."
- **Bars:** TRIES. FOG at Tier III.
- **Prepare:**
  - +1 TRY: Food, [2] slots;
  - SHOW ONE STEP: Supply Map or Treasure Map ×1, [1] slot;
  - LANTERN (fog only, clears the fog): Oil ×1 or Camping Lamp ×1, [1] slot.
- **Bot:** steps at random among the steps left, remembering its wrong ones.

**Trail Map**
- **How to play:** "Turn the trail tiles so every trailhead connects to the exit. **Finish before the time runs out.**"
- **Bars:** TIME, TILES.
- **Prepare:**
  - +10 S: Food, [2] slots;
  - ONE ROUTE SOLVED: Supply Map or Treasure Map ×1, [1] slot.
- **Bot:** turns tiles along the solution with pauses and a few wrong turns.

**Picture Puzzle**
- **How to play:** "Rebuild the picture from the pieces in the tray. **Finish before the time runs out.**"
- **Bars:** TIME, PIECES.
- **Prepare:**
  - +10 S: Food, [2] slots;
  - GHOST PICTURE (faint picture under the frame): Camera or Old Photo ×1, [1] slot.
- **Bot:** places pieces, sometimes in the wrong spot first.

**Thin Ice**
- **How to play:** "Holes hide under the ice. Clear the safe squares; the numbers tell you how many holes are next to each one. **Step on a hole and the hiker at the front falls in.**"
- **Bars:** HOLES (count).
- **Prepare:**
  - TEST THE ICE (marks one hole before you start): Stone ×1, [3] slots;
  - HIKING STICK (each hiker's first hole only cracks): Hiking Stick ×1, [1] slot.
- **Bot:** clears safe squares by simple Minesweeper logic and guesses when stuck.

**Fake Trail Signs**
- **How to play:** "Learn the rule, then say whether each sign is real or fake. Every round adds a rule, and the old ones still count. **One wrong answer and the hiker fails.**"
- **Bars:** RULES (the cap), SIGNS (per round).
- **Prepare:**
  - −1 RULE: Thinking Cap ×1, [1] slot;
  - −1 SIGN A ROUND: Glasses ×1, [1] slot;
  - KEEP OLD RULES ON SCREEN (Tiers IV and V): Instruction Manual or Textbook ×1, [1] slot.
- **Bot:** answers right [85%] of the time.

### Memory
**Remember the Path**
- **How to play:** "Watch the ranger walk a trail across the grid. Then walk it from memory. **One wrong step and that hiker fails.**"
- **Bars:** PATH (steps), RANGER SPEED.
- **Prepare:**
  - SLOWER RANGER: Food, [2] slots;
  - −1 STEP: Supply Map ×1, [1] slot.
- **Bot:** repeats the path and slips on a later step now and then.

**Memory Puzzle**
- **How to play:** "Flip two cards at a time to find the matching snacks. **Find every pair before the time runs out.**"
- **Bars:** TIME, PAIRS.
- **Prepare:**
  - +5 S: Food, [2] slots;
  - PEEK (every card flips up once for [1.5 s]): Camera ×1, [1] slot.
- **Bot:** remembers cards it has seen, and forgets some.

**Safari**
- **How to play:** "Watch the animals come down the hill. Then answer the question together, one guess each. **A wrong guess fails the hiker at the front.**"
- **Bars:** ANIMALS (count), ANSWER SIGNS (count).
- **Prepare:**
  - BINOCULARS (−1 answer sign): Binoculars ×1, [1] slot;
  - LANTERN (night only, [+10°] beam): Oil ×1 or Camping Lamp ×1, [2] slots;
  - FEWER ANIMALS (−2 each): Food, [1] slot.
- **Bot:** the demo plays a short parade, then the bot answers, right [70%] of the time.

**Crossroads**
- **How to play:** "Remember the arrows. Then walk them through the crossings, one turn at a time. **Take a wrong turn and that hiker fails.**"
- **Bars:** ARROWS.
- **Prepare:**
  - −1 ARROW: Supply Map ×1, [2] slots;
  - PEEK ON THE WAY (the arrows show for [2 s] once mid-walk): Treasure Map or Camera ×1, [1] slot.
- **Bot:** walks the arrows and misremembers one now and then.

### Search
**Find the Object**
- **How to play:** "A crowd of snacks pops up. **Find the ones you're asked for before time runs out.**"
- **Bars:** TIME, TO FIND.
- **Prepare:**
  - +5 S: Food, [2] slots;
  - −1 TO FIND: Binoculars or Glasses ×1, [1] slot.
- **Bot:** taps targets after a short look, sometimes a wrong one.

### Reaction and timing
**Trail Blocks** (Chop Tree, Mine Rockslide, River Flood, Clearing Animals)
- **How to play:** "Tap when the marker is in a green zone. The closer to the edge, the more you clear. **Misses and weak hits cost energy.**" Clearing Animals: "Whistle when the circle reaches the ring…"
- **Bars:** WORK (how much is left to clear), ZONES (size).
- **Prepare, by version:**
  - **Chop Tree:** SHARPEN (bigger zones): Flint ×1, [2] slots; BRING AN AXE (half the work): Woodcutting Axe ×1, [1] slot;
  - **Mine Rockslide:** BRING A PICKAXE (half the work): Pickaxe ×1, [1] slot; WEDGES (bigger zones): Metal ×1, [2] slots;
  - **River Flood:** DIG A DITCH (half the water): Shovel ×1, [1] slot; PATCH THE BUCKET (bigger zones): Clay ×1, [2] slots;
  - **Clearing Animals:** BAIT (−1 animal): Meat or Fish ×1, [2] slots; BIGGER RING: Grass ×1, [2] slots.
- **Bot:** taps in the zones, sometimes early or late.

**Sleeping Bear**
- **How to play:** "Sneak past the sleeping bear. Move while he's asleep and freeze when he stirs. **Get caught and you're out.**"
- **Bars:** CLOCK (the party's time), LIGHT SLEEPER (how fast he wakes).
- **Prepare:**
  - QUIET STEPS (−1 light sleeper): Fur ×1, [2] slots;
  - +10 S: Food, [2] slots;
  - SKIP IT: Bear Spray ×2, [1] slot.
- **Bot:** stops on the stir, sometimes a little late.

**Whackoon**
- **How to play:** "Whack the raccoons in your color as they pop out of the cans. **Leave the skunks alone!**"
- **Bars:** TIME, POP-UP SPEED.
- **Prepare:**
  - SLOWER RACCOONS: Food, [2] slots;
  - NO SKUNKS (Tier III and up): Oil ×1, [1] slot.
- **Bot:** whacks the nearest raccoon in its color, with a short reaction delay.

**Trail Blazes**
- **How to play:** "Two trunks scroll past each other. Tap when the two lit blazes are level. **Misses use up your tries.**"
- **Bars:** TRUNK SPEED, LEVEL WINDOW.
- **Prepare:**
  - SLOWER TRUNKS: Food, [2] slots;
  - BRIGHTER PAINT ([+1] unit window): Oil ×1, [2] slots.
- **Bot:** taps near level, off by a little sometimes.

**Firefly Catch**
- **How to play:** "Tap when the firefly is inside your jar ring. **Catch [3] before your time runs out.**"
- **Bars:** RING SIZE, FIREFLY SPEED, TIME.
- **Prepare:**
  - BIGGER JAR ([+3] ring): Clay ×1, [2] slots;
  - SLOWER FIREFLIES: Food, [2] slots.
- **Bot:** taps when the firefly is near the ring's middle.

**Size Up**
- **How to play:** "Grow or shrink the find on the trail until it matches the field guide's drawing. **Get it close enough before time runs out.**"
- **Bars:** PASS WITHIN, TIME.
- **Prepare:**
  - MEASURING STICK ([+1%] pass): Wood ×1, [2] slots;
  - +2 S: Food, [2] slots.
- **Bot:** taps toward the right size and stops a few % off.

**Fly Swatter**
- **How to play:** "Circles pop up where flies are about to land. Tap each one before it shrinks away. **Leave the bees alone.**"
- **Bars:** SHRINK TIME, FLIES.
- **Prepare:**
  - BIGGER SWATTER ([+4] circle size): Grass ×1, [2] slots;
  - SLOWER FLIES ([+0.15 s] shrink): Food, [2] slots.
- **Bot:** taps circles in order, missing one now and then.

### Movement and dodging
**Dodge** (every animal; the prototype's example)
- **How to play:** "Dodge the <animal>! Steer your hiker around the box and stay out of the way. **Each hit costs a heart.** Hikers take turns every <switch> seconds. Survive for <time>." Use the real numbers: [2] lives and a switch every [5 s] by default (`12-minigames-dodge.md`).
- **Bars:** ATTACK SPEED, plus the animal's own count where it has one (BEES PER WAVE, ANTS PER LINE).
- **Per hiker:** LIVES.
- **Prepare:**
  - +1 HEART: Food, one slot per hiker;
  - SLOWER ATTACKS (−1 speed each): Food, [2] slots;
  - **Bees only:** SMOKY FIRE (−1 bee per wave): Grass or Moss ×2, [1] slot;
  - **Bear, Bear with a Sword and Bear with a Gun:** BEAR SPRAY ([25%] shorter): Bear Spray ×1, [1] slot;
  - **Bear with a Gun only:** SANDBAGS (traps and holes last half as long): Clay ×2, [1] slot;
  - **Ants only:** SALT LINE (ant lines move [20%] slower): Salt ×1, [2] slots;
  - **Bear Country** (Bear with a Gun, the old Bearrels challenge): also SKIP IT: Bear Spray ×2, [1] slot.
  - The Woods Monster allows +1 HEART only.
- **Bot:** steers to the spot with the least danger a moment ahead, and hesitates now and then. The prototype has a working version.

**Camp Cleanup**
- **How to play:** "You're all one long line. Steer around the campsite and pick up the trash in your colors. Each piece adds a bag to the end of the line. **Hit a wall, a rock or yourself and you lose bags.** Every hiker needs <quota> bags when time runs out."
- **Bars:** TIME, SPEED, BAGS EACH (the quota).
- **Prepare:**
  - +10 S: Food, [2] slots;
  - SLOWER: Food, [2] slots;
  - −1 BAG EACH: Sack ×1, [1] slot;
  - CLEAR THE OBSTACLES (Tier III and up, [−2] obstacles): Shovel ×1, [1] slot.
- **Bot:** heads for the nearest piece still needed with simple pathfinding, and crashes now and then.

**Crossings** (Road, River, Critter)
- **How to play:** "Get every hiker across, one at a time. **A hit costs a life** and sends the hiker back to the start."
- **Bars:** TRAFFIC SPEED.
- **Per hiker:** LIVES.
- **Prepare:**
  - +1 LIFE: Food, one slot per hiker;
  - SLOWER TRAFFIC: Food, [2] slots;
  - MORE LOGS (river lanes): Wood ×2, [1] slot.
- **Bot:** hops forward when the lane ahead is clear, sometimes too soon.

**Train!**
- **How to play:** "Hop between the tracks as trains come through. Watch for the horn and the headlight. **A hit costs a life.**"
- **Bars:** TRAIN SPEED, SURVIVE (time).
- **Per hiker:** LIVES.
- **Prepare:**
  - +1 LIFE: Food, one slot per hiker;
  - SLOWER TRAINS: Food, [2] slots;
  - BRIGHTER WARNING (fog, [+0.3 s] warning): Oil ×1, [1] slot.
- **Bot:** moves to a track with no warning showing.

**Rafting**
- **How to play:** "Steer the raft upriver to the dock. **Hitting rocks costs lives,** and the rapids speed everything up."
- **Bars:** RIVER SPEED.
- **Per hiker:** LIVES.
- **Prepare:**
  - +1 LIFE: Food, one slot per hiker;
  - SLOWER RIVER: Food, [2] slots;
  - STURDIER RAFT (the first hit doesn't count): Wood ×2, [1] slot.
- **Bot:** steers around rocks, clipping one now and then.

**Trails**
- **How to play:** "Stay on the trail as it comes down the screen. Off the trail, your bar drains. **Empty bar and you fail.** Reach your checkpoint to pass."
- **Bars:** SCROLL SPEED, TRAIL WIDTH.
- **Per hiker:** BAR.
- **Prepare:**
  - +0.5 S BAR: Food, one slot per hiker;
  - SLOWER: Food, [2] slots;
  - HIKING STICK ([+4] width): Hiking Stick ×1, [1] slot.
- **Bot:** follows the trail's middle with a little lag.

**Rock Climb**
- **How to play:** "Aim, hold for power, and let go to jump. Grab a hold of the active hand's color. **A fall fails that hand's hiker.** Reach the top in time."
- **Bars:** HOLDS (to the top), TIME, GRAB REACH.
- **Prepare:**
  - CHALK ([+2] reach): Salt ×1, [2] slots;
  - +10 S: Food, [2] slots;
  - HARNESS (the first fall fails nobody): Harness ×1, [1] slot.
- **Bot:** aims at the nearest hold of its color, and misjudges the power sometimes.

---

## 8. Tests
- **Slot outlines:**
  - each slot's outline shows exactly the hikers who can fill it right now;
  - it updates when other slots fill or empty.
- **The inventory:**
  - it lists only what the slot takes, every one of them, one tile per hiker stack;
  - faded tiles can't be picked, and they come last;
  - hovering never picks;
  - a stack can't fill more slots than it has resources for.
- **Filling and emptying:**
  - × empties a slot without opening anything;
  - nothing leaves a pack before Start;
  - Start takes exactly what's in the slots, from the right hikers;
  - items lose one use.
- **Bars and lives:** they show the tier's value and every change, in green.
- **The demo:**
  - it uses the current params;
  - it never changes the real game's state;
  - it loops;
  - reduced motion shows a still frame.
- **Skip:** filling SKIP IT changes Start to SKIP IT, and it passes everyone without playing.
- **Every game:** each has `howToPlay`, `controls`, `bars`, `prepare` and `demoBot`, and its How to play fits the left column at the window's smallest size.
