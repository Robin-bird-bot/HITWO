# Minigames, batch 2: Traildle, Find the Object, Remember the Path, Find the Path

Four more minigames for Phase 10.8. They plug into the same framework as Bearrels (`10-minigames.md`): the challenge pop-up, the party GPS, the testing tab, and per-hiker results.

**Revised November 24, after Wyatt's first test.** What changed:
- **Traildle:** the boards always fit, and scroll if they must.
- **Find the Object:**
  - a found snack checks its own slot;
  - it plays over several rounds, with more to find each round;
  - a new Dark + windy mode;
  - the timer is shorter, with settings for its length.
- **Remember the Path:** the ranger and the hikers start below the grid, not on the start tile.
- **Find the Path:**
  - a fix for trails that couldn't be finished;
  - when a hiker runs out of tries, the trail hides again, and the next hiker starts from the trailhead.

**This is a test version.** Wyatt wants the rules and the feel right before the real art. So:
- everything is drawn in the GPS greens with **simple placeholder art**: the sprites in `art/`, plus flat shapes drawn in code;
- the **Prepare** options (spending to make a game easier) come later, after testing.

Numbers in [brackets] are first guesses. Put them in `balance.ts` with `TODO(wyatt)`, grouped by game and tier.

## 1. Shared parts

**Screen.** Every game draws a **320 × 240** scene (scene units), scaled up with nearest-neighbor like Bearrels' Detailed pixel version. The GPS adds its vertical drifting scanlines as usual.

**Colors.** The ten LCD greens from `art/bearrels/layout.json` → `colors.lcdGreens`:
- G0 is the darkest and G9 the lightest;
- G8 (#BAC995) is the screen background;
- hiker tokens use the hikers' own colors;
- red (#C8423A) is only for mistakes.

**HUD.** The same boxes as Bearrels: dark green (G1) with a light border (G8), light text (G9) in the pixel font, in capitals.

**Hiker tokens.** A circle in the hiker's color with their initial, until portraits are drawn into the games. States:
- waiting;
- current: lifted, with a light ring;
- safe: a small check badge;
- out: grey with a red slash.

**Line up (new, reusable).** See `mockups/1-line-up.png`.
- Before a game with 2 or more hikers, the player sets the order: cards numbered 1 to 4, which can be dragged to reorder (tap two cards to swap them also works), then **Go**.
- The front of the line goes first and takes the most risk.
- Skip it with only 1 hiker.
- All four games use it:
  - in **Find the Object** and **Find the Path** it decides who fails;
  - in **Traildle** and **Remember the Path** it sets the turn order.

**Results.** Each game reports every hiker as **Passed** or **Failed**, in the same results card as Bearrels ("2 passed, 1 failed"). Stakes aren't applied yet.

**Controls everywhere.**
- Mouse and touch with pointer events.
- Anything the player moves can be dragged, and tap-then-tap always works too.
- Keyboard where noted.

**Testing tab.** Add the four games to the game list. Each has:
- **Tier** (I, II, III);
- **Hikers** (pick 1 to 4);
- the overrides listed under each game. "Auto" means "use the tier's value".

The pop-up in test mode uses the game's name in the banner and an empty poster frame. The GPS preview can be a still frame for now.

**Reduced motion.** Softer flashes, no shakes or pops. Movement that is part of the game (wind, the ranger walking) stays.

---

## 2. Traildle

Guess a hidden code of digits (0 to 9) on a row of blank trail signs. See `mockups/2-traildle.png`.

### Rules
- **Two codes at once at most.** Hikers play in pairs, in line-up order: hikers 1 and 2 together, then 3 and 4 (with 3 hikers: 1 and 2, then 3 alone).
  - Each hiker in a pair has their own code.
  - Every guess goes into **both** boards at once, Quordle style.
  - A board that's solved locks and shows **FOUND**. Later guesses only go to the other board.
- **Pass or fail:** a hiker passes if their code is found before the pair runs out of guesses (or time). Otherwise they fail. Then the next pair starts with new codes.
- **Marks after each guess** (no colors: the screen is green), one per sign:
  - **right digit, right spot:** a solid dark sign with a light digit;
  - **right digit, wrong spot:** a light sign with a dashed border;
  - **not in the code:** a grey sign, crossed out.
- **Repeated digits:** none on Tier I. From Tier [II] a code can repeat digits. Marks then follow Wordle's rule: a digit gets "right" or "wrong spot" only as many times as it appears in the code. "Right" counts first.
- A guess must fill every sign. It can repeat digits even when the code can't.

### Numbers by tier
| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Signs | [3–4] | [5–6] | [7–8] |
| Guesses (one code) | [6] | [7] | [8] |
| Guesses (two codes) | +[1] | +[1] | +[1] |
| Repeated digits | no | yes | yes |
| Timer per pair | none | [3:00] | [2:00] |

When the timer runs out, every unsolved board in that pair fails.

### Screen
- **Top:** a pair box ("PAIR 1/2"), the guess count ("GUESS 4 OF 7"), and the timer on Tiers II and III.
- **Boards:** one per hiker in the pair, side by side, labeled "FINN'S CODE". Each lists the past guesses as rows of small signs with their marks, with empty rows for the guesses left. With one hiker, one board, centered.
- **Current guess:** big wooden signs (`art/traildle/sign.png`) along the bottom, an up arrow above each and a down arrow below. The selected sign has a light outline.
- **Digit strip:** keys 0 to 9 under the signs, plus **Enter** and **Back**.
  - Each key shows what's known about that digit. With two boards, the key is split: left half for the left board, right half for the right board.
  - Key fills: unknown (plain), not in the code (grey), wrong spot (light), right somewhere (dark).
- **Legend line** at the bottom, as in the mockup.

### Fitting everything on screen (fix)
Nothing may draw outside its board or the screen: not the small signs, the rows, the big signs or the digit strip. See `mockups/10-traildle-fit.png`, which shows the worst case: 8 signs, two codes, 9 guesses.
- **Small signs:** their width comes from the board: (board width − padding − gaps) ÷ number of signs, up to [16] units.
- **Rows:** their height comes from the space left: (board height − header) ÷ guesses, up to [13] units. The digit inside shrinks with the sign.
- **Scroll if needed:** if a row would be shorter than [9] units, keep it at 9 and let the board scroll.
  - The newest guess and the empty row below it always show.
  - Scroll with the mouse wheel, by dragging, or with small ▲ ▼ buttons at the board's edge.
  - A label such as "▲ 3 MORE" shows when rows are hidden above.
- **Big signs:** they shrink the same way so 7 or 8 of them, with their arrows, fit across the screen. They're [0.85×] in the mockup.
- **One board:** with only one hiker in the round, it uses the full width.

### Input (all of these work together)
- **Arrows:** up and down change that sign's digit, wrapping 9 → 0. A blank sign starts at 0.
- **Typing or tapping a key:** puts the digit in the selected sign and moves to the next one.
- **Hover:** while the pointer is over a sign, a typed digit goes into that sign.
- **Click or tap a sign** to select it.
- ← and → move the selection. **Backspace** clears the selected sign, or the one before it if it's empty. **Enter** checks the guess once every sign is filled.

### Testing tab overrides
- **Signs:** Auto, or 3 to 8.
- **Timer:** Auto, On, Off.

---

## 3. Find the Object

A crowd of trail snacks pops up. Find the ones you're asked for before time runs out. See `mockups/3-find-object-still.png` to `5-find-object-dark.png`.

### Art
- **12 trail snacks** in `art/find-object/snacks/` (16 × 16, drawn at 1 px per scene unit): orange, apple, pear, grapes, banana, strawberry, cherries, lemon, peanut, sandwich, cookie and carrot.
- **They all use the same greens.** Only the shape tells them apart. That's on purpose: colors would make it too easy.

### Rules
- **Rounds:** the game plays over **[3] rounds** (setting: 1 to 5), and each round asks for more.
  - Round 1: one target per hiker still in.
  - Each later round: [+1] more target than that. With 3 hikers that's 3, then 4, then 5.
- **What the targets are:**
  - Tier I starts with all targets the same snack, and allows up to [2] kinds from round 2.
  - Tiers II and III allow up to [2] kinds, and [3] from round 3.
- **Before each round:** a short card shows "ROUND 2 OF 3", "FIND 4" and the target sprites, for [1.5 s] (`mockups/12-find-object-round-card.png`). Then the field appears and the clock starts.
- **Distractors:** any of the other snacks, never a target snack.
- **Clicking a target (fix):**
  - it pops, and the check goes on **a slot showing that same snack** (the first unchecked one of that kind);
  - it never goes on a slot showing a different snack.
  - Example: targets grapes, grapes, apple. Finding the apple first checks the apple slot.
- **Wrong click:** it costs [2 s]. The clicked snack flashes red and the clock shakes.
- **End of a round:** when every target is found, or time runs out.
  - Each target still unfound puts **one hiker out, from the back of the line**. Out hikers stay out for the rest of the game.
  - While playing, the line shows how many hikers are at risk right now ("3 LEFT TO FIND: ALL 3 HIKERS AT RISK"). The ones at risk get a small warning mark.
- **End of the game:** after the last round, or when everyone is out. Hikers still in pass; hikers who went out fail.
- Targets never belong to particular hikers and never change color. Only the order of the line matters.

### Numbers by tier
| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Mode | Still | Windy | Dark + windy |
| Distractors | [16] | [22] | [26] |
| Extra distractors per hiker after the first | +[3] | +[3] | +[3] |
| Extra distractors each round after the first | +[4] | +[4] | +[4] |
| Time per round | [3 s] + [3 s] per target | same | same |
| Overlap | none | up to [25%] | up to [25%] |

The timer is shorter than before ([10 s] + [4 s] per extra target felt too easy). Both parts of the time are settings.

### Modes
- **Still:** everything stays put.
- **Windy:** everything drifts sideways at about [12] units/s, with a small bob ([2] units every [1.5 s]). Snacks that leave one edge come back in on the other. The wind direction is random each round. A few faint wind streaks drift by.
- **Dark:**
  - the screen is almost black (G1);
  - a soft flashlight circle about [42] units across, with an [8] unit soft edge, follows the pointer;
  - on touch, the light follows the finger, and a tap (a press that moves less than [6 px]) picks what's under it;
  - nothing moves.
- **Dark + windy (new):** both at once: the flashlight, and everything drifting and wrapping. See `mockups/11-find-object-dark-windy.png`.
- The HUD stays visible in every mode.

### Screen
- **Top left:** FIND, with a slot for each target showing its sprite. A slot is checked when that snack is found.
- **Top right:** the round ("R 2/3") and the clock.
- **Bottom left:** the line of hikers in order, with the ones currently at risk marked.
- **The field:** below the HUD. Keep snacks at least [4] units from the screen edges, except in the windy modes.

### Testing tab overrides
- **Mode:** Auto, Still, Windy, Dark, Dark + windy.
- **Rounds:** Auto ([3]), or 1 to 5.
- **Seconds per target:** Auto ([3]), or 1 to 8.
- **Extra seconds per round:** Auto ([3]), or 0 to 20.

---

## 4. Remember the Path

A ranger walks a trail across a grid. Then each hiker walks it from memory. See `mockups/6-remember-path-watch.png` and `7-remember-path-repeat.png`.

### The path
- It starts on a random tile in the **bottom row** and must end on the **top row**. Its last tile is the only one on the top row.
- It moves up, down, left or right, and never goes back onto a tile it's used.
- **Making one:** a random walk from the start. Throw it away and try again if it reaches the top row too early, runs too long, or gets stuck.

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Grid (columns × rows) | [5 × 4] | [6 × 5] | [7 × 5] |
| Path length (tiles) | [5–6] | [7–8] | [9–10] |
| Strikes per hiker | [3] | [2] | [1] |
| Ranger speed | [0.5 s] a step | [0.45 s] | [0.4 s] |

### Watch
See `mockups/13-remember-path-ranger-enters.png`.
- **No start tile is marked.** The ranger (`art/remember-path/`) appears **below the grid, in the middle**.
- He walks along under the grid to the column of the start tile, steps up into it, and walks the path one tile at a time. He faces the way he walks: down, up, or the side sprite, mirrored for left. He swaps between his two frames as he steps (for down and up, the second frame is the first one mirrored).
- **Footprints:** only his last [2] tiles show footprints, the older one fainter. Older ones fade away.
- At the top he walks off the edge and disappears.
- The panel says "WATCH" and who's next.

### Repeat
See `mockups/14-remember-path-start-below.png`.
- The current hiker's token appears **below the grid, in the middle**, not on the start tile.
- **The first step** is into the bottom row. Any bottom-row tile can be picked: the right one is where the ranger came in, and any other bottom-row tile is a wrong step (a strike).
  - Tap a bottom-row tile, or drag the token up into it.
  - With the keyboard, ← and → slide the token along under the grid, and ↑ steps in.
- **Walk the trail:**
  - drag the token along the tiles;
  - or tap the next tile, one at a time;
  - or use the arrow keys.
- **Right step:** the tile lights up (`tile-lit.png`) with footprints, and the token moves there.
- **Wrong step** (any neighboring tile that isn't next on the path):
  - the tile flashes red with an X for [0.4 s];
  - the hiker loses a strike and stays put;
  - the last strike fails the hiker.
- Taps on tiles that aren't next to the token are ignored. No strike. (While the token is below the grid, every bottom-row tile counts as next to it.)
- **Pass:** the hiker reaches the end tile.

### More hikers
Each hiker gets a **new path**, in line-up order. The ranger walks each new path before that hiker's turn.

### Testing tab overrides
None for now.

---

## 5. Find the Path

A hidden trail runs through a forest, from the bottom row to the top. Hikers take turns guessing it one step at a time. Wrong steps run into thick trees. See `mockups/8-find-the-path.png` and `9-find-the-path-fog.png`.

### The trail
- It starts at a **trailhead** on the bottom row. The trailhead is shown, with a little post (`tile-start.png`).
- It moves **up, left or right only**, never down, and never back onto a tile it's used. It ends when it reaches the top row.
- **Making one:** each step goes up about [45%] of the time, otherwise left or right, without turning straight back.

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Grid (columns × rows) | [5 × 5] | [6 × 6] | [7 × 7] |
| Tries per hiker, each turn | [3] | [3] | [3] |
| Group attempts | [2] + [1] per hiker after the first | same | same |
| Fog | off | off | on |
| Chance a wrong pick reveals another tile | [35%] | [35%] | [35%] |

### Which tile is right (bug fix)
Wyatt hit a trail that couldn't be finished: the hiker stood at the end of the trail, and every way forward was already trees. The game had marked a right tile as wrong. Store it like this so it can't happen:
- The trail is a list of tiles. Keep a lookup from each trail tile to **the trail tile after it**.
- **A pick is right only if it's the tile after the hiker's current tile.** Look it up from where the hiker stands. Never use a separate step counter: one goes wrong after resets, lucky reveals and walking the known trail.
- Lucky reveals, fog and hiding the trail all read the same trail list. A trail tile must never be shown as trees.
- Reaching the top row always ends that hiker's crossing as a pass, even if the top tile was already revealed.
- **Self-check:** after every pick, if the tile after the hiker's tile is marked trees, log an error in test mode and fix the mark.
- **Generator check:** every trail starts on the bottom row, reaches the top row, never goes down, and never repeats a tile.

### A turn
- The hiker at the front of the line walks out along the trail, one step at a time.
- **Choices:** the tiles up, left and right of the hiker that are inside the grid, aren't known trees, and aren't already on the trail. They get a light outline. Down is never offered.
- **Pick** a choice by tapping it, dragging the token onto it, or with the ← ↑ → keys.
- **Right tile:**
  - it becomes trail;
  - a trail line draws from the last tile's center to this one over [250 ms], so the trail is built up step by step;
  - the hiker moves onto it.
- **Wrong tile:**
  - it becomes thick trees, which stay for the rest of the game and can't be crossed;
  - the hiker loses 1 try and stays put;
  - with a [35%] chance, a random tile somewhere in the grid that nobody has picked is also revealed, as trail or trees, with a small "!" for [1 s].
    - A revealed trail tile sits alone, unconnected, until the trail reaches it.
    - Picking it later is free.
- **Reaching the top row:** the hiker is through and passes. The **first** hiker through gets +[1] Energy. In test mode, just show "+1 Energy".

### Running out of tries
- **While the group has attempts left:** the hiker walks back to the trailhead and goes to the **back of the line**. The group loses 1 attempt, and that hiker's tries refill for their next turn.
- **With no attempts left:** hikers still go, but a hiker who runs out of tries now is **out** (fails) and leaves the line.
- **The trail hides again (change):** whenever a hiker runs out of tries, fog or no fog, every trail tile goes back to looking unknown, and the trail line is removed. See `mockups/15-find-path-hidden-after-run-out.png`.
  - Trail tiles found by lucky reveals hide too.
  - The trees stay visible. A setting can hide them too (**Hide after a run-out:** Trail only, or Everything).
  - The game still knows the hidden tiles. Picking one is a right pick as usual (no try lost), and it shows again as the trail is rebuilt.
- The next hiker in line then starts **at the trailhead**.

### What carries over
- **Trees** stay for everyone (unless the setting hides them).
- **The trail** stays only while hikers keep making progress. A run-out hides it (above), so the next hiker has to find it again.
- **When a hiker reaches the top:** the trail stays visible, and every hiker after them walks it on their own (a quick animation) and passes.

### Fog (Tier III, or the testing override)
- Only the tiles uncovered in the last [2] picks stay visible. Older ones fade back to look hidden, and the trail line fades with them. "Picks" counts every hiker's picks.
- The game still knows them:
  - picking a faded trail tile is free and moves you on;
  - picking a faded tree tile costs a try again ("you forgot it was there").
- There's no automatic walk in fog. Every hiker retraces the trail from memory, and right picks along it cost nothing. (With the run-out change, this is now true without fog too, until someone reaches the top.)
- A thin mist over the grid gets lighter near the hiker.

### Screen
- **Grid:** 32-unit tiles from `art/forest-tiles/` (16 × 16, drawn at 2×), on the right of the screen, centered vertically:
  - `tile-hidden` for unknown;
  - `tile-trees` for wrong;
  - `tile-trail` for right;
  - `tile-start` for the trailhead.
- **The trail line:** G3, about 2.5 units thick, with rounded joins.
- **Left panel:**
  - the current hiker's name and tries (dots);
  - group attempts (squares);
  - "THE LINE" with the hikers in order, the current one marked;
  - short notes such as "FINN RAN OUT: BACK OF THE LINE".
- Show the top row's exit with a small gap or arrow at the top edge.

### Testing tab overrides
- **Fog:** Auto, On, Off.
- **Hide after a run-out:** Trail only (default), or Everything.

---

## 6. Tests
- **Line up:** reordering works by drag and by tap-to-swap. The order reaches each game. It's skipped with 1 hiker.
- **Traildle:**
  - with 8 signs, two codes and 9 guesses, nothing draws outside a board or the screen;
  - when rows would get too small, the board scrolls and the newest guess shows;
  - marks match Wordle's rules on codes with repeats (for example, code 4-4-7 with guess 4-7-4 → right, wrong spot, wrong spot);
  - no repeats on Tier I;
  - pairs split 4 hikers into 2 + 2 and 3 hikers into 2 + 1;
  - a solved board locks;
  - the timer fails every unsolved board in that pair.
- **Find the Object:**
  - finding a snack checks a slot of that snack, never another kind (grapes, grapes, apple; find the apple first → the apple slot);
  - each unfound target at the end of a round puts out one hiker from the back, and they stay out;
  - each round asks for 1 more target than the last;
  - Dark + windy combines the flashlight and the drifting;
  - the time settings change the clock;
  - targets are never used as distractors;
  - in Windy, snacks wrap around the edges;
  - in Dark, only things inside the light can be seen and picked;
  - a wrong click takes 2 s.
- **Remember the Path:**
  - the ranger and each hiker start below the grid's middle, and no start tile is marked;
  - a wrong bottom-row tile on the first step is a strike;
  - every path starts on the bottom row, ends on the top row, touches the top row only at its end, and never repeats a tile;
  - strikes by tier;
  - a tap that isn't next to the token costs nothing.
- **Find the Path:**
  - **simulate 1,000 games** on each grid size with random picks (lucky reveals, run-outs and fog included): every game can be finished, and a trail tile is never shown as trees;
  - a run-out hides the trail (and, with the setting, the trees), and the next hiker starts at the trailhead;
  - trails never go down or repeat a tile;
  - down is never offered;
  - known trees can't be picked;
  - running out of tries sends the hiker to the back of the line and costs 1 attempt;
  - with no attempts left, running out means out;
  - in fog, faded trail tiles are free and faded trees cost a try;
  - the first hiker through is the one who gets the Energy.
- Every game reports Passed or Failed for every hiker. Test mode never touches the save.
