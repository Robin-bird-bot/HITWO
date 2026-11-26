# Minigames, batch 4, step 3 (part 2): Fake Trail Signs, Trails, Crossroads, Rock Climb

Wyatt's new games, plus Rock Climb, which moves up from step 4. Step 4 is now Sketchy Bridge and Falling Rocks.

**Test version:**
- placeholder pixel art in the GPS greens (`art/fake-signs/`, `art/trails/`, `art/crossroads/`, `art/rock-climb/`);
- the 320 × 240 scene;
- the end screen from `16-challenge-end-screen.md`.

Numbers in [brackets] are first guesses for `balance.ts`, with `TODO(wyatt)`. Settings marked **(setting)** are in the testing tab. Every table runs to Tier V.

| Game | Category | Tiles | Passing challenge? |
| --- | --- | --- | --- |
| Fake Trail Signs | Puzzle and logic | any | no |
| Trails | Movement and dodging | Forest, Mountain, River (by type) | yes |
| Crossroads | Memory | any | no |
| Rock Climb | Movement and dodging | Mountain | yes |

**Failing:** in the two that aren't passing challenges, hikers who fail lose [1] energy. The passing challenges follow `14-minigames-trail-blocks.md`, section 1: passers move on, failers go back and lose [1] energy.

**How common:** Trails is a common one, like the Trail Blocks (Wyatt). The other three are normal. All four can show up from Tier [I].

---

## 1. Fake Trail Signs
Learn a rule, then judge trail signs as REAL or FAKE. Every round adds another rule. See `mockups/signs-trails/12-fake-signs-rules.png` to `15b-fake-signs-mixed-ends.png`.

### A round
1. **The rules screen:** the scene dims, and a box titled THE RULES lists the rules in EditUndo, numbered.
   - The newest rule is last, marked "+", on a lighter band.
   - **Tiers I to III** show every rule so far. **Tiers IV and V** show only the new one, with "+ N EARLIER RULES STILL APPLY (NOT SHOWN)" above it. The old rules still count.
   - An **I UNDERSTAND** button at the bottom (or Space or Enter) starts the signs.
2. **The signs**, one at a time:
   - a sign on a post in the middle of the trail scene (`art/trail-blocks/bg-trail.png`), with **REAL** and **FAKE** buttons under it;
   - keys: Left or R for REAL, Right or F for FAKE;
   - the top bar shows "SIGN n/N".
3. **Right answer:** a short tick, and the next sign comes up.
4. **Every sign right:** the hiker passes, one new rule is added (up to the tier's cap), and it's the next hiker's turn, starting on the rules screen.
5. **A wrong answer:**
   - the sign gets a red frame, and so does the button they pressed;
   - a box says why, for [2.5 s]: "FAKE! IT BREAKS RULE 2: 3 + 4 IS NOT MORE THAN 7." or "REAL! IT FOLLOWS EVERY RULE.";
   - the hiker fails, and it goes back to the **same** rules screen (no new rule) for the next hiker, with new signs.

### Turns (Wyatt)
- **One round per hiker,** in line order. Round 1 has one rule, and each round someone passes adds the next rule.
- **The tier's cap:** once the rules reach the cap, later rounds keep the same rules with new signs.
- **The tier's minimum:** the game must reach at least the minimum number of rules. If every hiker has played and the rules haven't reached it (a small party, or some failed), hikers who passed play again in line order until it does. A wrong answer in an extra round fails them too.
- **The end:** when every hiker has played and the minimum is reached, or when nobody who could play is left.
- With one hiker, they play every round themselves.

### The signs
- **The text:** NAME TYPE NN, in EditUndo, light (G9) on the dark sign. For example, PACIFIC LOOP 34.
  - **Names** (one word, 3 to 8 letters): ELK, FOX, OAK, BEAR, FERN, PINE, ASPEN, CEDAR, EAGLE, MAPLE, OTTER, RAVEN, BISON, WILLOW, CANYON, SUMMIT, SPRUCE, COYOTE, LUPINE, PACIFIC, JUNIPER, HEMLOCK, and more like them.
  - **Types:** LOOP, TRAIL, RIDGE, FALLS, LAKE, PASS, PEAK, CREEK.
  - **The number:** two digits, 10 to 99. Rules call the digits "the two numbers" (Wyatt's wording): in 34, the first number is 3 and the last number is 4.
- **The ends:** each end is square, pointy or round. At Tiers I and II both ends match. From Tier III, each end can be different.
- **The look (Wyatt):** a dark silhouette (G1) with no outline: the board, its two ends and the post. Build it from `sign-end-<shape>.png` (the left end; mirror it for the right), a G1 middle as wide as the text plus [6], and `sign-post.png`.

### The rules
Every rule reads "IF <condition>, <requirement>." in capitals. A sign follows a rule when the condition is false, or when it's true and the requirement holds.

**Conditions (IF):**
- **From Tier I:**
  - IT'S A <TYPE>;
  - THE TRAIL NAME HAS MORE THAN <4–6> LETTERS, or <4–5> LETTERS OR FEWER;
  - THE SIGN IS <SQUARE / POINTY / ROUND>;
  - THE NUMBER IS OVER <40–60>;
  - THE NUMBER IS EVEN (or ODD).
- **From Tier III:**
  - THE NAME STARTS WITH A VOWEL;
  - THE LEFT (or RIGHT) END IS <SHAPE>, or EITHER END IS <SHAPE>;
  - THE ENDS DON'T MATCH;
  - THE FIRST NUMBER IS BIGGER THAN THE LAST.
- **From Tier IV:**
  - two conditions joined: "<X> AND <Z>" or "<X> OR <Z>";
  - IT'S NOT A <TYPE>;
  - THE NAME AND THE TYPE START WITH THE SAME LETTER.

**Requirements (THEN):**
- **From Tier I:**
  - THE LAST NUMBER MUST BE EVEN (or ODD);
  - THE NUMBER MUST BE UNDER (or OVER) <30–70>;
  - ITS TWO NUMBERS MUST ADD UP TO MORE THAN (or LESS THAN) <6–11>;
  - THE SIGN MUST BE <SHAPE>;
  - IT MUST BE A <TYPE> OR A <TYPE>.
- **From Tier III:**
  - THE FIRST NUMBER MUST BE BIGGER THAN THE LAST;
  - THE LEFT (or RIGHT) END MUST BE <SHAPE>;
  - THE NAME MUST HAVE AN EVEN NUMBER OF LETTERS.
- **From Tier IV:**
  - ITS TWO NUMBERS MUST ADD UP TO AN EVEN NUMBER;
  - THE NUMBER MUST BE A MULTIPLE OF 3;
  - THE ENDS MUST NOT MATCH;
  - THE SIGN MUST NOT BE <SHAPE>.

**Making rules and signs:**
- **A new rule:**
  - its condition and requirement are about different things (never "IF THE NUMBER IS OVER 50, THE NUMBER MUST BE UNDER 50");
  - check that, with the earlier rules, some real signs and some fake signs are still possible when the new condition is true.
- **Real signs** follow every rule. **Fake signs** break exactly one, the new rule at least half the time.
- **Each round's signs:**
  - at least half of them make the new rule's condition true, so the new rule matters;
  - [40–60%] are fake;
  - with 3 or more signs, at least one is real and one is fake.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Signs per round **(setting)** | [2] | [3] | [3] | [4] | [4] |
| Fewest rules (the minimum) | [2] | [2] | [3] | [3] | [4] |
| Most rules (the cap) **(setting)** | [3] | [4] | [4] | [5] | [6] |
| Old rules on screen | all | all | all | only the new one | only the new one |
| Sign ends | match | match | can differ | can differ | can differ |
| Rule pool | from Tier I | from Tier I | + from Tier III | + from Tier IV | + from Tier IV |
| Time per sign **(setting)** | none | none | none | none | none |

---

## 2. Trails
Keep your hiker on a trail as it comes down the screen. One section per hiker, each ending at a checkpoint. See `mockups/signs-trails/16-trails-switchbacks.png` and `17-trails-off.png`.

### Types
| Type | Tiles | What it's like | Ground (off the trail) |
| --- | --- | --- | --- |
| Forest Path | Forest | wide, gentle S-curves | `tile-forest` |
| Switchbacks | Mountain | zigzags from side to side with sharp corners | `tile-rock` |
| Ridgeline | Mountain | narrow, mostly straight, with sudden short jogs to the side | `tile-rock` |
| Riverbank | River | winding, with the river (`tile-water-1` and `-2`) running along one side | `tile-forest` and water |

### The screen
- **Top-down:** the trail scrolls down from the top at the tier's speed, from y 22 to 195.
- **The trail:** `tile-path.png` with a 1-unit G5 edge. Outside it, the type's ground, which is darker. Water counts as off the trail.
- **The hiker:** the Dodge person icon in the active hiker's color, at y [178]. It only moves left and right, inside x [24–296], and it moves freely (not in lanes):
  - Left and Right (or A and D): speeds up to [130] units/s in [0.1 s];
  - mouse or finger: while the pointer is down (or the mouse moves), the icon heads toward the pointer's x at up to [130] units/s.
- **The bottom bar:** each hiker's token, name, state (WAITING, NOW, PASSED, FAILED) and their off-trail bar in their color.

### Play
- **Off the trail:** when the icon's center is outside the trail's edges:
  - the active hiker's bar ticks down in real time;
  - the icon blinks, with a red ring around it, and a soft warning sound plays;
  - getting back on stops the drain. The bar never refills.
- **Sections:** the trail is split into one section per hiker, in line order. Each ends at a **checkpoint**: a line across the trail in the active hiker's color, with `checkpoint-flag.png` (its white cloth tinted the same) at one edge.
- **Reaching a checkpoint:** the hiker passes. "<NAME> MADE IT" shows for [0.8 s] while the scroll pauses, and the next hiker's icon fades in at the same spot.
- **Running out (Wyatt's rule):**
  - the hiker fails;
  - after [1 s], the next hiker takes over **from that spot**, and their checkpoint is the next one ahead, so every later section shifts by one;
  - after the last hiker, if the end of the trail hasn't been reached, the **first hiker who passed comes back**, with the bar they had left when they passed, and goes on to the end;
  - if they run out, they fail too, and the next hiker who passed comes back, and so on;
  - it's over at the end of the trail, or when nobody who passed is left.
- **Fairness:** the trail never moves sideways faster than [75%] of the hiker's top speed.

### Results (passing challenge)
- **Hikers who reach a checkpoint** (and don't fail later on a comeback) pass and move on.
- **Hikers who fail** go back and lose [1] energy.
- **If nobody passes,** the everyone-fails rule applies.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Scroll speed (units/s) | [40] | [46] | [52] | [58] | [64] |
| Trail width (units) | [56] | [48] | [40] | [34] | [30] |
| Section length (units) **(setting)** | [500] | [600] | [700] | [800] | [900] |
| Off-trail bar per hiker **(setting)** | [3 s] | [2.5 s] | [2 s] | [1.75 s] | [1.5 s] |
| Switchbacks: a corner every (units) | [150] | [130] | [120] | [110] | [100] |
| Ridgeline: jog size (units) | [16–24] | [20–28] | [24–32] | [28–36] | [32–40] |

- **By type:** Forest Path is [1.15×] as wide, and Ridgeline is [0.75×] as wide.

---

## 3. Crossroads (Wyatt called it "Trailmap"; renamed so it isn't mixed up with Trail Map)
Remember a row of arrows, then walk them through 4-way trail crossings. See `mockups/signs-trails/18-crossroads-arrows.png`, `18b-crossroads-wrong.png` and `19-crossroads-walk.png`.

### The arrow screen
- **The look:** the scene dims, and a box says REMEMBER THE WAY. The arrows are in a row, each on a dark tile with its step number under it.
- **The arrows:** `arrow.png`, turned in 90° steps, drawn 2× (24 × 24), in G9, so they match the EditUndo letters.
- **READY:** a button at the bottom (or Space or Enter), like Fake Trail Signs. There's no time limit unless **Study time (setting)** sets one.
- **The sequence:**
  - it never asks you to go back: an arrow is never followed by its opposite (no left right after right);
  - every hiker gets the same arrows unless **New arrows per hiker (setting)** is on.

### Walking
- **The scene:** `crossroads.png` from above, four trails meeting in the woods. The hiker's icon stands in the middle, and the trail they came in on (behind them) has faint footprints.
- **Choosing:** an arrow key or WASD, a tap or click on the trail on that side, or a swipe that way.
  - The icon walks out that way ([0.35 s]), the view slides, and it walks into the next crossing from the opposite side ([0.35 s]).
  - The way you came in doesn't count. That press is ignored, with a small bump.
- **The last step** leads into `clearing.png`: "MADE IT", and the hiker passes. Then the next hiker sees the arrow screen again and walks it from step 1.
- **A wrong turn:**
  - the hiker fails;
  - it goes back to the arrow screen, with every step they got right drawn in their color, and a line saying where they went wrong;
  - then the next hiker gets READY and starts from step 1.
- **The top bar** shows "STEP n/N" while walking.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Arrows **(setting)** | [4] | [5] | [6] | [7] | [8] |
| Study time **(setting)** | no limit | no limit | no limit | no limit | no limit |
| Time per turn **(setting)** | none | none | none | none | none |

---

## 4. Rock Climb (from the decisions in the design doc)
Climb a wall by jumping between holds in the right hikers' colors. See `mockups/signs-trails/20-rock-climb-aim.png` and `21-rock-climb-leap.png`.

### The screen
- **The wall:** facing it, `wall.png` repeats up and scrolls down as the climber goes up. A ledge marks the top.
- **The holds:** `hold.png`, with its light top tinted in one hiker's color.
- **The climber:** seen from behind. `climber-hang` while holding on, and `climber-leap` mid-jump. The two hands are drawn in their colors.
- **The bottom bar:**
  - HANDS: the color sequence as circles, the next one ringed and used ones crossed out;
  - the time left;
  - who has fallen.

### The color sequence (Wyatt)
- **Hands take turns:** each move uses the next hand, left then right, and the next color in the sequence. That hand can only grab holds of its color.
- **Even shares:** the sequence is shuffled so every hiker gets the same number of turns: [8] long with an even number of hikers, [9] with an odd number. When it runs out, a new shuffle starts.
- **⚠ 5 or 6 hikers:** the sequence can't split evenly. Wyatt doesn't expect parties that big, so this isn't handled. Leave a `TODO(wyatt)` comment in the code and a note on the testing tab when Hikers is 5 or 6.

### A move
1. **Aim:** an arrow above the climber swings back and forth over [180°], left to right over the top.
2. **Hold** (click, tap or Space): the arrow stops, and a power meter on the right fills and empties over and over.
3. **Let go:** the climber jumps in the arrow's direction with that much power, [30–110] units.
4. **Grab:** during the jump, tap or click a hold of the active hand's color:
   - if the hand is within the tier's reach of it at that moment, it grabs on and the climber hangs there;
   - holds of other colors can't be grabbed, and the click does nothing;
   - Tiers I and II allow any number of tries during a jump. From Tier III, one try per jump.
5. **Fall:** if the jump ends with no grab, the climber slides back to the last hold:
   - the hiker whose color that hand had **fails**, once. Later falls on their color only cost time;
   - the same hand and color go again.

### The wall
- **Planning:** plan a path of holds in the sequence's order, each one above the last and [40–90] units away, so the climb is always possible.
- **Decoys:** add holds of other colors on every screen.

### Results (passing challenge)
- **The top in time:** hikers who never fell pass. Hikers who fell fail and lose [1] energy.
- **Time runs out:** nobody passes, and the everyone-fails rule applies.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Holds to the top **(setting)** | [8] | [10] | [12] | [14] | [16] |
| Time **(setting)** | [50 s] | [50 s] | [55 s] | [60 s] | [60 s] |
| Arrow swing, side to side | [1.6 s] | [1.4 s] | [1.2 s] | [1.0 s] | [0.9 s] |
| Power meter, empty to full | [1.2 s] | [1.1 s] | [1.0 s] | [0.9 s] | [0.8 s] |
| Grab reach (units) | [16] | [14] | [12] | [11] | [10] |
| Grab tries per jump **(setting)** | any | any | one | one | one |
| Decoy holds per screen | [3] | [4] | [5] | [6] | [7] |

---

## 5. Art
All placeholder art is in the GPS greens.

**`art/fake-signs/`**
- `sign-end-square.png`, `sign-end-pointy.png` and `sign-end-round.png` (12 × 24): left ends; mirror them for the right.
- `sign-post.png` (8 × 34).
- The board's middle, the rules box and the buttons are drawn in code. The background is `art/trail-blocks/bg-trail.png`.

**`art/trails/`**
- `tile-forest`, `tile-rock`, `tile-path`, `tile-water-1` and `tile-water-2` (32 × 32): they repeat.
- `checkpoint-flag.png` (18 × 26): the white cloth is tinted with the hiker's color.
- The hiker is the Dodge person icon.

**`art/crossroads/`**
- `arrow.png` (12 × 12): points up. Draw it 2× (24 × 24).
- `crossroads.png` and `clearing.png` (320 × 200).

**`art/rock-climb/`**
- `wall.png` (320 × 240): repeats top to bottom.
- `hold.png` (16 × 12): the light top is tinted.
- `climber-hang.png` and `climber-leap.png` (26 × 34): the light hand dots are drawn over in the hand colors.
- `aim-arrow.png` (9 × 26): points up. Turn it in code.

---

## 6. Testing tab
- **Puzzle and logic: Fake Trail Signs.**
  - Tier and Hikers;
  - Signs per round (Auto, 1 to 6) and Most rules (Auto, 2 to 8);
  - Show old rules (Auto, Always, Never) and Time per sign (Off, 5 to 20 s);
  - **Show answers** (marks each sign REAL or FAKE in a corner, for tuning).
- **Movement and dodging:**
  - **Trails:** Type, Tier, Hikers, Bar (Auto, 1 to 5 s), Section length (Auto, 200 to 1500);
  - **Rock Climb:** Tier, Hikers, Holds to the top (Auto, 4 to 24), Time (Auto, 20 to 120 s), Grab tries (Auto, One, Any).
- **Memory: Crossroads.** Tier, Hikers, Arrows (Auto, 3 to 12), Study time (No limit, 5 to 20 s), New arrows per hiker (Off, On), Time per turn (Off, 2 to 6 s).

---

## 7. Tests
- **Fake Trail Signs:**
  - every real sign follows every rule, and every fake breaks exactly one;
  - at least half of each round's signs make the new rule's condition true;
  - a new rule never makes real or fake signs impossible;
  - a pass adds a rule up to the cap, and a fail repeats the same rules for the next hiker;
  - the minimum is always reached when someone can still play, and passed hikers replay in order;
  - Tiers IV and V hide old rules but still check them.
- **Trails:**
  - off the trail is judged by the icon's center, and only drains the bar while off;
  - a fail hands over from that spot, and comebacks use leftover bars in line order;
  - the trail never needs more than [75%] of top speed sideways;
  - the passing-challenge result is right.
- **Crossroads:**
  - no arrow is followed by its opposite;
  - pressing the way you came is ignored;
  - a fail shows the right steps in that hiker's color, and the next hiker starts at step 1.
- **Rock Climb:**
  - for 1 to 4 hikers, the sequence gives everyone equal turns;
  - only same-color holds grab, within reach;
  - a fall fails that hiker only once;
  - the planned path is always reachable.
- **All four:** they end on the Challenge Passed or Challenge Failed screen with the right result for each hiker.
