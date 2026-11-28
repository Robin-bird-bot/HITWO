# Four quick minigames: Incoming Bike!, Wrong Turn, Fallen Branch, Snagged Pack

Wyatt (November 27) wants every challenge to be a minigame (`29-core-loop.md`, section 6), with some quick ones to keep the hike moving. He picked these four:
- **Incoming Bike!:** "a quicktime event, press the specific key in time"; on a phone, "swipe a direction or draw a pattern like Google's Magic Cat".
- **Wrong Turn:** a compass. A/D or tapping a side turns the needle; "line it up exactly within the time limit".
- **Fallen Branch:** "Saw It", like the Mario Party 8 saw game.
- **Snagged Pack:** "untangle": colored ropes from socket to socket on a grid, with no overlapping.

Each one takes over the cost card with the same name: its art, nodes, scope and punishment. They're meant to be short: about [20–40 s] for the whole party.

**Mockups** (`mockups/quick-games/`, 320 × 240 like the other games):
- `59-incoming-bike-keys.png`
- `60-incoming-bike-swipe.png`
- `61-wrong-turn-compass.png`
- `62-fallen-branch-saw.png`
- `63-snagged-pack-ropes.png`

The mockups use placeholder shapes in the GPS greens. The real art can come later, in the same style as the other games.

Numbers in [brackets] are first guesses for `balance.ts`, with `TODO(wyatt)`. Settings marked **(setting)** go in the testing tab. Every table runs to Tier V. Ideas marked *(Claude's idea)* are mine.

**Summary:**

| Game | Category | Who plays | Passing challenge? | Tiles | From |
| --- | --- | --- | --- | --- | --- |
| Incoming Bike! | Reaction and timing | each hiker in turn | no: each passes or fails | Forest, River | Tier I |
| Wrong Turn | Reaction and timing | the party, a bearing each | yes | Forest, Mountain | Tier I |
| Fallen Branch | Rhythm | the party, in shifts | yes | Forest | Tier II |
| Snagged Pack | Puzzle and logic | each hiker in turn | no: each passes or fails | Forest, Wildlife | Tier I |

- **Passing challenges** follow `14-minigames-trail-blocks.md`, section 1: the party passes or fails together.
- **Failing** costs the old card's punishment (below), from the punishment table at the tile's tier, as cost cards did.
- **Each game needs** its pop-up content, a demo bot and a testing-tab entry, like the others (`23-minigames-final.md`, sections 10 and 12).

---

## 1. Incoming Bike! (press the key in time)
Bikes fly down the trail at the hiker. Each one shows a key in a ring that closes in. Press that key before the ring closes, and the hiker hops aside. See `59-incoming-bike-keys.png` and, for phones, `60-incoming-bike-swipe.png`.

### The screen
- **The trail** runs from the top of the scene to the bottom, wide at the bottom (a simple perspective). Trees on both sides.
- **The hiker** stands near the bottom, as their token.
- **Bikes** come in small at the top and grow as they come down the trail. A riding bike is drawn in code or as a sprite.
- **The key:** a keycap on the bike, with a ring in the active hiker's color around it. The ring shrinks to the keycap over the tier's time.
- **Hearts:** the active hiker's, top right (3 dots).
- **The bottom bar:** each hiker's token, name and a square per bike (lit when dodged), as in other turn games.

### Play
- **The right key** before the ring closes: the hiker hops to the side (a short jump, with a little dust), and the bike whooshes past.
- **The wrong key, or too late:** the bike clips the hiker. They lose 1 heart, and they stumble for [0.3 s].
- **A hiker passes** when every bike has gone by and they still have a heart. **They fail** when their hearts run out.
- **The keys by tier:**
  - **Tier I:** the 4 arrow keys;
  - **Tier II:** plus A, S, D and F;
  - **Tier III:** plus J, K and L. Two bikes can be on the trail at once;
  - **Tier IV:** some bikes show two keys, to press in order;
  - **Tier V:** some bikes show a crossed-out key: **don't press it**. Let it pass, and the hiker ducks on their own.

### On a phone (swipe)
- **The bike shows a shape** instead of a key. Draw it with a finger anywhere on the scene, like Google's Magic Cat Academy.
- **The shapes by tier:**
  - **Tier I:** the 4 straight swipes (up, down, left, right);
  - **Tier II:** plus V and Λ;
  - **Tier III:** plus Z and a loop;
  - **Tier IV:** two shapes in a row;
  - **Tier V:** crossed-out shapes, as with keys.
- **Matching** *(Claude's idea)*: turn the stroke into a list of 8 directions (dropping tiny wiggles), and compare it with the shape's list. It's simple and forgiving. The trail of the stroke shows in the hiker's color.
- **Which way:** swipes on touch screens, keys everywhere else. **(setting)**: Keys / Swipe / Auto.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Bikes per hiker | [6] | [7] | [8] | [9] | [10] |
| Ring closes in | [1.6 s] | [1.4 s] | [1.2 s] | [1.1 s] | [1.0 s] |
| Gap between bikes | [1.2–1.8 s] | [1.0–1.6 s] | [0.8–1.4 s] | [0.7–1.2 s] | [0.6–1.0 s] |
| Two bikes at once | no | no | [25%] | [35%] | [45%] |
| Two-key bikes | no | no | no | [30%] | [35%] |
| Don't-press bikes | no | no | no | no | [20%] |
| Hearts **(setting)** | [3] | [3] | [3] | [3] | [3] |

- **If failed** (the card's punishment): go back, and lose {x} random resources (knocked loose).
- **The pop-up:**
  - **How to play:** "Bikes are coming! Press the key on each bike before its ring closes to hop out of the way. **A wrong key or a late one costs a heart.**"
  - **Rules:** "Two bikes can come at once." *(TIER III AND UP)*; "Some bikes need two keys." *(TIER IV AND UP)*; "Don't press a crossed-out key." *(TIER V)*
  - **Bars:** BIKES, RING TIME, KEYS.
  - **Cards:**
    - **FOOD** (×1 Food, [2] slots): rings close [15%] slower;
    - **BANDAGES** (×2 Fiber, [3] slots): +1 heart *(pick a hiker)*;
    - **BIKE BELL** (×1 Trinkets, [1] slot): each hiker's first mistake is free;
    - **BINOCULARS** (item, [1] slot): each key shows [0.3 s] before its ring starts.
  - **Controls:** the key on the bike (keyboard), or draw the shape (touch).
- **Bot:** presses the right key [0.25–0.6 s] after it shows, and the wrong one [8%] of the time.

---

## 2. Wrong Turn (line up the compass)
The party took a wrong turn. Each hiker in turn swings a compass needle onto a bearing and holds it there. See `61-wrong-turn-compass.png`.

### The screen
- **The compass** fills the middle: a dial with N, E, S and W, tick marks every [10°], and a needle (red tip).
- **The notch:** a wedge on the dial's edge, at the bearing to find, with a light band showing how close counts.
- **BEARINGS** (top right): the list for the party, one per hiker. Done ones say OK; the current one has a marker.
- **HOLD TO LOCK** (under it): a bar that fills while the needle is in the notch.
- **The keys:** A on the left and D on the right, with "OR TAP LEFT" and "OR TAP RIGHT".
- **The top bar:** the party's clock.

### Play
- **Turning:** hold A (or the left half of the screen) to turn the needle left; D (or the right half) to turn it right.
- **The needle swings:** it speeds up while you hold, keeps going a little when you let go, overshoots, and settles. Getting it to stop in the notch is the game.
- **Locking:** keep the needle in the notch until HOLD TO LOCK fills. Leaving the notch drains the bar ([2×] as fast as it fills).
- **A bearing is locked:** the notch flashes, the bearing says OK, and the next hiker gets a new bearing at least [60°] away.
- **Bearings:** one per hiker, and at least [3]. With fewer than 3 hikers, they take turns until 3 are locked.
- **The party passes** when every bearing is locked before the clock runs out. **It fails** if the clock runs out.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Notch (± from the bearing) | [8°] | [6°] | [5°] | [4°] | [3°] |
| Hold to lock | [0.5 s] | [0.6 s] | [0.7 s] | [0.8 s] | [0.9 s] |
| Overshoot (springiness) | low | low | medium | medium | high |
| The needle wobbles on its own | no | no | ±[6°], slowly | ±[8°] | ±[10°], faster |
| The notch hides after | never | never | never | [1.5 s] | [1.0 s] |
| Clock per bearing **(setting)** | [8 s] | [8 s] | [8 s] | [9 s] | [9 s] |

- When the notch hides, the bearing's number stays in the list, so a hiker can still find it by the dial's marks.
- **If failed** (the card's punishment): everyone goes back, and loses {x} Appetite.
- **The pop-up:**
  - **How to play:** "Find the trail again. Turn the needle with A and D (or tap a side), and hold it in the notch until it locks. **Each hiker locks one bearing before time runs out.**"
  - **Rules:** "The needle wobbles." *(TIER III AND UP)*; "The notch hides after a moment." *(TIER IV AND UP)*
  - **Bars:** NOTCH SIZE, WOBBLE, TIME.
  - **Cards:**
    - **FOOD** (×1 Food, [2] slots): +[3 s] on the clock;
    - **CAIRN** (×2 Building, [1] slot): the notch is [2°] wider;
    - **LUCKY CHARM** (×1 Trinkets, [1] slot): bearings lock in half the time;
    - **SUPPLY MAP** (item, [1] slot): the notch never hides, and the needle doesn't wobble.
  - **Controls:** TURN: A and D, the arrow keys, or tap a side.
- **Bot:** turns toward the notch, lets go a little early, and corrects. It overshoots and tries again about [30%] of the time.

---

## 3. Fallen Branch (saw it in rhythm)
A branch fell across the trail. The party saws through it in shifts, keeping a steady rhythm. Like Saw It in Mario Party 8: too fast and the saw binds; too slow and it doesn't cut. See `62-fallen-branch-saw.png`.

### The screen
- **The branch,** seen end-on: a big round log with rings, bark and a knot or two.
- **The saw** across it, with a handle at each end. The cut (a light slot) grows down from the top as the party saws, and sawdust falls from it.
- **TEMPO** (top middle): a bar from TOO SLOW to TOO FAST, a lit zone (the right tempo), and a marker showing the current rhythm.
- **The keys:** A on the left and D on the right. The one to press next is lit.
- **The top bar:** CUT, how far through the branch the party is.

### Play
- **Sawing:** press A, then D, then A… (or swipe back and forth anywhere on a phone). Each press is a stroke.
- **The tempo** is the time between strokes, smoothed over the last [3]. The marker shows it on the bar.
- **In the zone:** each stroke cuts [3%] at Tier I (the table), and the saw moves smoothly.
- **Too fast:** the saw **binds**. It stops for [0.6 s] with a clunk, and cuts nothing.
- **Too slow:** the saw moves but cuts nothing.
- **The same key twice** (A, A) is a slip: no cut.
- **Knots** (from Tier II): when the cut reaches one, a note says "A KNOT AHEAD: SLOW DOWN", and the zone moves toward slow until the cut is past it.
- **Shifts:** hikers saw in turn for [5 s] each, in line order, round and round. "SWAP!" flashes in the next hiker's color. A hiker alone saws the whole time.
- **The party passes** when the cut reaches the bottom before the clock runs out. **It fails** if the clock runs out.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Right tempo (time between strokes) | [0.30–0.45 s] | [0.30–0.42 s] | [0.30–0.40 s] | [0.31–0.39 s] | [0.32–0.38 s] |
| Cut per good stroke | [3%] | [2.5%] | [2.2%] | [2%] | [1.8%] |
| Knots | none | [1] | [1–2] | [2] | [2–3] |
| The zone drifts | no | no | slowly | yes | yes, faster |
| Clock **(setting)** | [25 s] | [25 s] | [26 s] | [27 s] | [28 s] |
| Shift length **(setting)** | [5 s] | [5 s] | [5 s] | [5 s] | [5 s] |

- **If failed** (the card's punishment): everyone goes back, and loses {x} Energy.
- **The pop-up:**
  - **How to play:** "Saw through the branch together. Press A and D in turn (or swipe back and forth) and keep the tempo in the zone. **Too fast and the saw binds; too slow and it won't cut.**"
  - **Rules:** "Knots need a slower tempo." *(TIER II AND UP)*; "The right tempo drifts." *(TIER III AND UP)*
  - **Bars:** CUT NEEDED, TEMPO ZONE, KNOTS.
  - **Cards:**
    - **FOOD** (×1 Food, [2] slots): +[4 s] on the clock;
    - **SHARPEN THE SAW** (×2 Building, [2] slots): each good stroke cuts [25%] more;
    - **WAX THE BLADE** (×1 Fire, [1] slot): binding stops the saw for half as long;
    - **SWISS ARMY KNIFE** (item, [1] slot): the cut starts [20%] of the way through.
  - **Controls:** SAW: A and D in turn, the arrow keys, or swipe back and forth.
- **Bot:** strokes at the zone's middle tempo, ±[15%], and slows for a knot [0.5 s] late.

---

## 4. Snagged Pack (untangle the ropes)
Each hiker's pack is snagged: colored ropes run from socket to socket. Drag each rope to its matching socket without crossing another. Like the puzzle game Flow. See `63-snagged-pack-ropes.png`.

### The screen
- **The board** in the middle: a grid of square cells on a dark panel.
- **Sockets:** pairs of colored rings, one pair per color. The colors are the party colors plus a few more, all easy to tell apart.
- **PAIRS** (top right): how many are joined, "PAIRS 2/5".
- **The top bar:** the active hiker's clock.

### Play
- **Drag** from a socket. The rope follows from cell to cell (up, down, left, right), drawn thick in its color.
- **No crossing:** the rope won't go into a cell another rope (or another color's socket) is in. It stops at the edge of it.
- **Backing up:** drag back along the rope to shorten it.
- **Joining:** reach the matching socket, and the rope locks with a click. Dragging from a joined rope's socket clears it and starts again.
- **Tap a rope** to clear it.
- **The cells don't all have to be filled** (Wyatt: just no overlapping).
- **A hiker passes** when every pair is joined before their clock runs out. Each hiker gets a new board.

### Making boards *(Claude's idea)*
- Take a random path that visits every cell once (a Hamiltonian path: a snake that's been randomly reshaped), and cut it into pieces, one per color. Each piece's two ends become a pair of sockets.
- That guarantees an answer. Throw away boards where a pair is right next to each other, or where a piece is shorter than [3] cells.
- Seed it from the run, so tests can repeat a board.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Grid | [5 × 5] | [6 × 6] | [7 × 7] | [7 × 7] | [8 × 8] |
| Pairs | [4] | [5] | [6] | [7] | [8] |
| Clock per hiker **(setting)** | [35 s] | [40 s] | [45 s] | [50 s] | [55 s] |

- **If failed** (the card's punishment): lose {x} random resources (they fall out).
- **The pop-up:**
  - **How to play:** "Your pack is snagged! Drag each rope to the socket of the same color. **Ropes can't cross.** Each hiker untangles their own pack."
  - **Rules:** none past Tier I; the boards just get bigger.
  - **Bars:** GRID SIZE, PAIRS, TIME.
  - **Cards:**
    - **FOOD** (×1 Food, [2] slots): +[8 s] each;
    - **SORTED** (×2 Fiber, [2] slots): one pair starts joined, for every hiker;
    - **LUCKY CHARM** (×1 Trinkets, [1] slot): a hint: tap a socket to see its rope's path for [1.5 s] (once each);
    - **SACK** (item, [1] slot): one less pair each.
  - **Controls:** DRAG: the mouse or a finger. TAP: clear a rope.
- **Bot:** joins pairs with a simple solver (the shortest free path, pairs with the fewest options first), slowly, with a wrong drag now and then.

---

## 5. Data and code
- **Each game** gets a folder in `src/minigames/` (`incomingBike`, `wrongTurn`, `fallenBranch`, `snaggedPack`), like the others, with its tiers in `balance.ts`.
- **The challenge entries:** the four cost cards in `costCards.ts` become minigame challenges in `minigameChallenges.ts`, with the same names, art, nodes and punishments. Their cost options go away.
- **The catalog** (`catalog.ts`) lists them with their category, so the testing tab and the Minigames screen pick them up.
- **Phone input:** Incoming Bike!'s shape matcher is its own small file with tests.

---

## 6. Tests
- **Incoming Bike!:** the right key dodges; a wrong or late key costs a heart; a crossed-out key passed by is a dodge, and pressed is a hit; the shape matcher knows each shape drawn a few different ways.
- **Wrong Turn:** a bearing locks only after the hold time in the notch; leaving drains the bar; each new bearing is at least 60° from the last; the clock running out fails the party.
- **Fallen Branch:** strokes in the zone cut; too fast binds; too slow and the same key twice don't cut; knots move the zone; shifts rotate in line order.
- **Snagged Pack:** every generated board (over many seeds, every tier) has an answer; ropes never share a cell; joining every pair passes.
- **Every game:** the bot passes about [70–85%] at Tier I and fewer at Tier V; the punishments match the old cards'.

---

## 7. Things to flag to Wyatt
- **The four "From" tiers and tiles** are the old cards'.
- **Wrong Turn and Fallen Branch** are passing challenges (the old cards were party cards), and the other two are each-hiker games, like the old cards.
- **The Tier V twists** (don't-press bikes, the hiding notch) are my ideas.
- **Prepare cards** follow the pattern in `24-challenges-reset.md`, section 5. The names (BIKE BELL, CAIRN, SHARPEN THE SAW, WAX THE BLADE, SORTED) are mine.
- **Lengths:** each game should take about [20–40 s] for the party. The run clock (`29`, section 9) will show if they do.
