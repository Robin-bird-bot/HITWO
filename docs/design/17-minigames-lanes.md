# Minigames, batch 4, step 2: Crossings, Train!, Rafting

The lane games: hop across traffic, dodge trains, steer a raft. They're all **passing challenges** (`14-minigames-trail-blocks.md`, section 1), and all three are **Movement and dodging**.

**Test version:**
- placeholder pixel art in the GPS greens (`art/crossing/`, `art/train/`, `art/rafting/`);
- the 320 × 240 scene;
- the end screen from `16-challenge-end-screen.md`.

Numbers in [brackets] are first guesses for `balance.ts`, with `TODO(wyatt)`. Settings marked **(setting)** are in the testing tab.

**Tile types:**
- **Road Crossing** and **Train!:** Forest
- **River Crossing** and **Rafting:** River
- **Critter Crossing:** Wildlife

---

## 1. Crossings (Road, River and Critter: one game)
Frogger, top-down. See `mockups/1-road-crossing.png`, `2-river-crossing-mix.png` and `3-critter-crossing.png`.

### Versions
- **Road:** lanes of traffic: cars, pickup trucks, RVs, and logging trucks from Tier III.
- **River:** lanes of water with logs and turtles to ride. The water itself is a hit.
- **Critter (the easy one):** deer, turkeys, raccoons and rabbits wander across in lanes. It's slower, with bigger gaps.
- **Mixed (Tier III and up, on Forest and River tiles):** road lanes at the bottom, a grass bank in the middle (safe), and river lanes at the top, like the real Frogger. Critter Crossing stays critters.

### The board
- **The grid:** 16-unit rows across the whole width (20 columns).
- **Rows, bottom to top:**
  - the start (grass), where waiting hikers stand;
  - the lanes;
  - the goal (grass) with a TRAIL sign.
- **Centering:** the board is centered between the top HUD and the hint line (y 24 to 200).
- **Lanes:** each one moves one way at one speed, and directions alternate.
- **No dead lanes:** every lane has a gap a hiker can reach.

### Play
- **One hiker at a time,** in line order. Hikers who are across stand at the goal.
- **Moving:** each press hops one tile (16 units) in [0.12 s]. Holding a key doesn't repeat.
  - Arrow keys or WASD.
  - Click or tap above, below, left or right of the hiker.
  - On phones, a swipe in that direction, like Crossy Road.
- **Hits:**
  - touching a vehicle or a critter;
  - landing in the water;
  - riding a log or turtle off the screen edge;
  - being on a turtle when it dives.
- **After a hit:** the hiker loses a life, goes back to the start, and goes to the **back of the line** (Wyatt's rule). The next hiker goes.
- **The clock:** each attempt has a time limit. Running out costs a life, the same as a hit.
- **Out:** a hiker with no lives left is out.
- **The end:** when every hiker is across or out.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Lanes | [4] | [5] | [6] (3 + bank + 3) | [7] | [8] |
| Lives per hiker **(setting)** | [3] | [2] | [1] | [1] | [1] |
| Time per attempt **(setting)** | [20 s] | [18 s] | [18 s] | [16 s] | [15 s] |
| Lane speed (units/s) | [25–40] | [30–50] | [35–60] | [40–70] | [45–80] |
| Gap between things in a lane | [64–110] | [56–96] | [48–88] | [44–80] | [40–72] |
| Turtles that dive | none | [1] group | [2] groups | [2] groups | [3] groups |

- **Critter Crossing:** speeds ×[0.7], gaps ×[1.3], and +[1] life. From Tier II, some critters stop for [0.5–1.5 s], then go on.
- **River:**
  - logs are [3–5] pieces long;
  - turtles come in groups of [2–3];
  - standing on either one carries the hiker along.
- **Diving turtles:** up for [3 s] → `turtle-half` as a warning for [0.6 s] → `turtle-under` for [1.2 s] → back up.

### Results (passing challenge)
- **Hikers who reach the TRAIL** pass and move on.
- **Hikers who run out of lives** fail, stay back, and lose [1] energy.
- **If anyone crosses,** the challenge is gone.

### Art (`art/crossing/`)
- **Tiles (16 × 16):** `tile-grass`, `tile-road`, `tile-road-line` (a dashed center line along its bottom), `tile-water-1` and `tile-water-2` (swap every [0.5 s]), and `tile-bank`.
- **Vehicles** (top-down, facing right; mirror them for the other direction): `vehicle-car`, `vehicle-truck`, `vehicle-rv`, `vehicle-logger`.
- **Logs:** `log-left`, `log-mid` and `log-right`, put together to any length.
- **Turtles:** `turtle-up`, `turtle-half`, `turtle-under`.
- **Critters** (side view, facing right, two walking frames that swap every [0.2 s]): `critter-deer`, `-turkey`, `-raccoon` and `-rabbit`.
- **Hikers:** the Dodge person icon, tinted with each hiker's color. A hop squashes it for one frame.

---

## 2. Train!
Hop between railroad tracks as trains come through. **One party sprite, like Dodge:** tinted with the active hiker's color, switching every [5 s], with lives per hiker. See `mockups/4-train.png` and `5-train-fog.png`.

### The tracks
- **Layout:** horizontal tracks stacked down the screen, [36] units apart (`art/train/tile-rail.png`, tiled across).
- **The sprite** stands in the middle (x 160) on a track. It only moves up and down: one press hops to the next track in [0.12 s].
- **Controls:** up and down arrows, W and S, tapping above or below the sprite, or a swipe up or down.

### Trains
- **What they are:** `train-engine` followed by [1–4] cars (`train-boxcar`, `train-tanker`). They're drawn facing left, and mirrored when coming from the left.
- **Directions:** from the right on Tiers I and II, from either side from Tier III.
- **Warnings (Wyatt's idea):** before a train comes, its track shows:
  - `headlight.png` flashing at the edge it's coming from;
  - a "!";
  - a horn sound.
- **Fairness:** at least one track always stays clear for the next [1.5 s].

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Tracks | [3] | [4] | [5] | [5] | [5] |
| Survive **(setting)** | [20 s] | [20 s] | [25 s] | [25 s] | [30 s] |
| Warning | [1.0 s] | [0.9 s] | [0.8 s] | [0.7 s] | [0.6 s] |
| Train speed (units/s) | [140–170] | [150–190] | [160–210] | [170–220] | [180–240] |
| A new train every | [1.6 s] | [1.3 s] | [1.1 s] | [1.0 s] | [0.9 s] |
| Fog **(setting)** | off | off | off | on | on |
| Lives per hiker **(setting)** | [2] | [2] | [2] | [2] | [2] |

### Fog (Wyatt's idea; Tiers IV and V)
- **The fog:** it covers the far [40%] of the screen on the side trains come from. It fades from clear to almost solid G8.
- **What you can see:** the headlight flash and "!" still show through the fog, dimmed. The train itself only appears as it comes out of the fog, so there's less time to react.

### Hits and results (passing challenge)
- **A hit:** costs the active hiker 1 life, followed by [1 s] of safety (the sprite blinks).
- **Out:** a hiker at 0 lives is out, and the next one takes over at once.
- **The end:** hikers with lives left when time runs out pass. Hikers who are out fail and lose [1] energy.

---

## 3. Rafting
The whole party in one raft, heading upriver to the dock. See `mockups/6-rafting.png`.

### Play
- **The view:** top-down. The river runs up the middle between grassy banks with trees. The water (`tile-water-1` and `-2`) scrolls down at the current pace.
- **The raft** (`raft.png`, with each hiker's token on it) sits in the bottom third.
  - It moves left and right between lanes: one press slides it one lane in [0.15 s].
  - Controls: left and right arrows, A and D, tapping the left or right half, or a swipe.
- **Rocks** (`rock-s`, `rock-m`, `rock-l`) come down the lanes. A row never blocks every lane. On Tier V, large rocks can cover two lanes.
- **Rapids** (`rapids.png`):
  - hitting them doesn't cost a life;
  - instead, the pace goes up by [12%] **for the rest of the run**;
  - the bottom bar shows the speed ("SPEED ×1.12").
- **The dock:**
  - a progress bar on the right fills as the raft goes;
  - the dock (`dock.png`) slides in at the top at the end;
  - reaching it wins.

### Lives and results (passing challenge)
- **Lives:** one per hiker, shown as hiker tokens. A rock hit costs one, in line order (that token gets crossed out), followed by [1 s] of safety.
- **Results:**
  - if any life is left at the dock, **everyone passes**;
  - if every life is lost, **everyone fails**, and the everyone-fails rule applies.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Lanes | [3] | [4] | [4] | [5] | [5] |
| Distance (units) **(setting)** | [1200] | [1400] | [1600] | [1800] | [2000] |
| Starting pace (units/s) | [60] | [66] | [72] | [78] | [84] |
| Rocks per 100 units | [1.0] | [1.3] | [1.6] | [1.9] | [2.2] |
| Rapids per run | [1] | [2] | [3] | [3] | [4] |

---

## 4. Testing tab
Add the three games under **Movement and dodging**, with these settings:
- **Crossing:**
  - Version (Road, River, Critter, Mixed);
  - Tier and Hikers;
  - Lives (Auto, 1 to 3);
  - Time per attempt (Auto, 10 to 40 s).
- **Train!:**
  - Tier and Hikers;
  - Lives (Auto, 1 to 3);
  - Survive (Auto, 10 to 60 s);
  - Fog (Auto, On, Off).
- **Rafting:** Tier, Hikers, and Distance (Auto, 600 to 3000).

---

## 5. Tests
- **Crossings:**
  - one hop per press;
  - every kind of hit costs a life;
  - a hit hiker goes to the start and to the back of the line;
  - running out of time costs a life;
  - Mixed has a safe bank;
  - riding carries the hiker;
  - diving turtles warn first.
- **Train!:**
  - one track is always clear;
  - every train is warned for the tier's time, including in fog;
  - switching and lives work as in Dodge.
- **Rafting:**
  - no row blocks every lane;
  - rapids raise the pace for the rest of the run and never cost a life;
  - everyone passes with any life left, and everyone fails with none.
- **All three:** they end on the Challenge Passed or Challenge Failed screen, and the passing-challenge result is right.
