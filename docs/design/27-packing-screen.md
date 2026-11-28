# The packing screen: Lucky Trail Outfitters (slots for starting items and resources)

Wyatt (November 26): after the hikers are picked, the player packs for the hike. Instead of a table of choices, it's a **slot machine**. Wyatt: "if there's an item in the slots that's decent but you think you could do better, it's a risk to respin or a safe bet to take." He also asked for it to be trail themed, with **big animations** to make it fun.

**Revised (Wyatt, after playing it):** "The slots machine is absolutely incredible." His three changes are in:
- the odds and paytable are hidden in pull-out drawers;
- bundles are just the resource icons;
- hovering an item shows its card.

He also asked for a second look, **TrailMate** (GPS-themed), with the same rules: see `28-packing-screen-trailmate.md` and section 9.

**The reference is the prototype:** `mockups/packing/prototype.html` (open it in a browser). Screenshots `01` to `20` are in the same folder. Match its look, its rules and its animations. The test buttons in its top right force every bonus.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Ideas marked *(Claude's idea)* are mine; the rest is Wyatt's.

---

## 1. Where it goes
- **A new screen between hiker select and the hike** (`App.tsx`: `'title' | 'select' | 'pack' | 'game' | 'minigames'`).
  - Hiker select's Start now opens the packing screen with the chosen `HikerSetup`s.
  - The packing screen's last button starts the hike.
- **What it hands over:** for each hiker, the items they packed (item ids, Tier I or II) and the resources their bundles opened into. `createGame` puts them in that hiker's bag and resources, for example through a new `packed` option.
- **It replaces the placeholder starting resources:**
  - drop `giveStartingResources` for real runs (`inventory.startingResources: 4`);
  - keep it for tests and the test-hike picker.
- **Changed Nov 27 (`29-core-loop.md`, section 7): no starting kits.** Hikers start with nothing; the packing machine is the whole start. Starting blueprints still apply.
  - The holiday hikers' Presents still start in their bags: they show on this screen first, marked START, and take up room *(Claude's idea: so nothing overflows later)*.
  - Packed Toolbox picked at the start gives the party +[2] item picks here, instead of 2 tools *(Claude's idea)*.
  - A dry run of `createGame` without packing tells what those are.
- **Back:** a Back button returns to hiker select and throws the packing away.
- **Saving:** nothing is saved mid-pack. A reload starts the packing over.
- **Seeded** from the run's seed (its own stream), so tests can predict every spin.
- **Testing tab** (Settings → Testing): "Skip packing" (random picks, straight to the hike), and "Force next spin" with the same choices as the prototype's buttons.

---

## 2. The machine (Wyatt: trail themed)
**Lucky Trail Outfitters:** a wooden cabinet in the ranger station's wood and brass (`StationScreen.module.css`, `.wood` and `.brass`, as on the Trail Infoboard).

- **The sign:** "LUCKY TRAIL OUTFITTERS" in gold, ringed with marquee bulbs that chase slowly, and fast after a win.
- **The squirrel wheel** on top, on a brass stand (Wyatt picked this):
  - a squirrel runs in a wooden wheel to power the reels;
  - the art is an inline SVG in the prototype (`#wheelsvg`): body, tail, head and two leg frames, so it animates in code. Lift it, or redraw it in the game's style.
- **The lever is a hiking pole:** aluminum, a cork grip and a wrist strap, on a brass base at the cabinet's right. Click it, drag it down, or press Space.
- **The reels are log sections:** light wood with grain, shaded like a cylinder, in a brass bezel, with a red payline.
  - Each symbol is on a plaque in its item type's colors (`ITEM_TYPE_COLORS`).
  - A Tier II symbol has a gold frame, a glow and a "II" badge.
- **A label under each reel:** the type (TOOL, FOOD, CLOTHES, SHELTER, with "· II" for Tier II), or "×2 BUNDLE".
- **The respin tray:** a sunken tray of acorn caps (`icons/acorn-caps.png`), one per respin left.
- **A brass plate:** "TAKE 4 MORE", and under it "2 + 1 PER HIKER = 5 ITEMS".
- **The odds and the paytable are hidden** (Wyatt: "maybe it could be pulled out if the player wants to see those, but keep them hidden for now"):
  - **Two pull-out drawers,** each a wooden plaque that sits off screen with only its tab showing at the edge. The left tab is "ODDS ▸"; the right one is "PAYTABLE", lower down, clear of the lever.
  - **Click a tab** to slide its drawer out with a little overshoot. Click again to put it away.
  - **What's on them:** the odds drawer is "WHAT'S ON THE REELS" (or "WHAT'S IN A BUNDLE"), with bars. The paytable lists the bonuses with little colored squares, and the row that just paid lights up.
  - **When something pays** and the paytable is shut, its tab flashes *(Claude's idea)*.
  - **Both start shut** every time. See `20-drawers-open.png`.
- **The party along the bottom:**
  - a card per hiker: portrait, name, party color, 4 bag slots;
  - in the resource step, also 2 bundle slots;
  - after the hike starts, their resources.

---

## 3. Step 1: items (5 reels)
- **How many:** the party takes **2 items, plus 1 per hiker** (Wyatt), from 3 items for 1 hiker to 8 for 6 (+2 with Packed Toolbox picked at the start).
- **The first spin is free**, and **waits for the player to press** (changed Nov 27, `29-core-loop.md`, section 8: "don't have the slots automatically start, have the player press them first"). The reels show empty until then.
- **What lands on a reel:**
  - **the type:** Tools [40%], Food [30%], Clothes [20%] and Shelter [10%] (Wyatt);
  - **the item:** a random Tier I item of that type, from the item tables (`TABLE_ITEMS`) that are switched on (`isOffered`). Items only a trait makes (Puked Nuggets) are left out;
  - **a rare Tier II** (Wyatt): each reel has a [2%] chance to land on a random Tier II item of its type instead.
- **Hovering an item shows its card** (Wyatt: "so a player knows what they're getting"):
  - the game's own `ItemCard`, unrolled like a Choice pick: values and counters as ranges across Qualities 1–5, with "QUALITY ?";
  - it appears beside the reel, with "DRAG ONTO A HIKER TO PACK IT" under it;
  - it works the same over an item already in a hiker's bag;
  - on touch, a long-press shows it. See `19-card-hover.png`.
- **Taking an item:**
  - drag it onto a hiker with room in their bag, or click it and then click a hiker;
  - it goes in the bag (clothes too: hikers can equip them later);
  - **that reel goes dark** for the rest of the step (Wyatt, from Claude's idea).
- **Respins:**
  - the party has [3];
  - a respin spins **every lit reel**, so anything not taken is gone (Wyatt's "risk to respin");
  - dark reels stay dark.
- **No respins left:** the lever greys out, and "NO RESPINS LEFT: TAKE ONE" shows. The player must take from the lit reels.
- **Second Wind:** if every reel is dark and items are still owed, all 5 light up, empty, with a free spin that waits for the player's press *(Claude's idea: with 5 reels and up to 8 picks, the reels have to come back; the press is from Nov 27, `29`, section 8)*.
- **The step ends** when every item is taken: "ALL PACKED!", then a "NEXT: RESOURCES" button.

### 3.1 Bonuses (Wyatt)
Bonuses count only **side by side** (Wyatt): the same type on lit reels next to each other. A dark reel breaks a row. After each spin, only the longest row pays.

| Row | What you get |
| --- | --- |
| 3 in a row | A bonus spin: +1 respin. |
| 4 in a row | One of the four, at random, turns into a Tier II item of that type. Plus a free spin (+1 respin). |
| All 5 (the jackpot) | All five turn Tier II, but **only one can be taken this round**: once one is taken, the other four lock (TAKE ONE ONLY). Plus a free spin (+1 respin). The next spin unlocks them and spins them as usual. |

- A Tier II turns into another Tier II of the same type: a reel that was already Tier II stays as it is.
- I read Wyatt's "bonus spin" and "free respin" as the same thing: +1 respin in the tray (flag).

---

## 4. Step 2: resources (3 reels, a turn per hiker)
Wyatt: "a quick turn per hiker, but this machine only has 3 reels instead of 5."

- **Bundles:**
  - each reel shows a **bundle**: just its resources' icons, with no sack behind them (Wyatt), centered and evenly spaced:
    - ×1 is one big icon, ×2 two side by side, and ×3 three in a row;
    - ×5 is two rows, 3 over 2;
    - a ×5 glows gold;
    - the label under the reel gives the size ("×2 BUNDLE");
  - size: ×1 [35%], ×2 [40%], ×3 [22%], or **×5 rarely** [3%] (Wyatt);
  - each resource in it is random, any of the 16, repeats allowed. A ×2 might be Seaweed and Wood (Wyatt);
  - **hover (or long-press)** to read it: "BUNDLE ×2: Seaweed, Wood" (Wyatt).
- **Turns:** in party order, each hiker takes **2 bundles** (Wyatt).
  - **On screen:** a tag swings down from the sign ("FINN'S PICK · TAKE 2 BUNDLES"). Their card lifts, and the others dim.
  - **Respins:** each turn starts with a free spin and [2] respins of the hiker's own. Leftover respins don't carry over.
  - **Taking:** same as items: drag or click, and the reel goes dark. Bundles only go to the hiker whose turn it is.
  - **The next turn** starts by itself after the second bundle: all 3 reels light up, empty, and wait for the hiker's free spin (changed Nov 27, `29`, section 8).
- **Bonuses:** only while all 3 reels are lit, so taking a bundle breaks the row *(Claude's reading of "a certain amount of ×1, ×2 or ×3 in a row")*.

| Row | What you get |
| --- | --- |
| ×1 ×1 ×1 | A bonus spin: +1 respin. |
| ×2 ×2 ×2 | One of them grows to ×3 (one more random resource). Plus a bonus spin. |
| ×3 ×3 ×3 | One of them grows to ×5. Plus a bonus spin. |

- **After the last hiker:** "READY!", then a "START THE HIKE" button.
- **Starting the hike:**
  - each hiker's bundle chips burst open, and their resources fly into the hiker's card;
  - bundles are never in the inventory (Wyatt);
  - "HAPPY TRAILS!", then the hike starts on the trailhead.
- **The limit:** 2 bundles can hold at most 10, which is the resource limit. If a trait has already given a hiker resources, anything over the limit is dropped, with a note.

---

## 5. Animations (Wyatt: "big animations to make it feel fun")
All of these are in the prototype. Keep the timing close to it.

- **Pulling the lever:**
  - the pole swings down and springs back up past where it started;
  - the cabinet dips;
  - a ratchet sound plays.
- **Feeding the squirrel:**
  - each respin, an acorn hops out of the tray and arcs up into the wheel;
  - the squirrel catches it, then runs.
- **The squirrel:**
  - **Running:** two leg frames swap about every [75 ms], the body bobs, and the tail flicks. The wheel speeds up to full in [0.35 s].
  - **Stopping:** when the reels stop, the wheel slows over [0.7 s]. The squirrel pants (tongue out, a sweat drop) for [1.3 s], then sits and blinks now and then.
- **The reels:**
  - symbols stream down with motion blur;
  - they stop left to right, about [0.3 s] apart ([0.42 s] for bundles), each overshooting a little and bouncing back;
  - each stop gives a thunk, a jolt and a small puff of dust.
- **The tease:** if the stopped reels just before a reel match (2 or more side by side), that reel spins about [1 s] longer. It glows orange, the squirrel leans in, and a drumroll plays.
- **A win:**
  - the matching reels glow gold, and the bulbs chase fast;
  - the paytable row lights up;
  - a big wooden stamp slams down over the reels ("BONUS SPIN!", "4 IN A ROW!", "TRAIL JACKPOT!", "BIG BUNDLE!") with a small screen shake;
  - then the squirrel tosses an acorn into the tray, and it lands with a clink.
- **Turning Tier II (or growing a bundle):** the reel flashes white, a burst of gold sparkles, and a chime.
- **The jackpot:**
  - gold rays turn behind the reels;
  - the squirrel does a backflip;
  - acorns and autumn leaves rain down the screen;
  - a bigger shake, a fanfare, and a gold stamp;
  - then the five upgrades go off one after another.
- **Dragging:** the item lifts and tilts as it moves, and the hikers with room glow. Dropped elsewhere, it slides back.
- **Packing:**
  - the item arcs into the hiker's next slot and pops in;
  - the card bounces, and sparks in the hiker's color fly;
  - the reel's wooden shutter drops with a clack, showing the hiker's name and color.
- **Second Wind:** the stamp, then every shutter rolls up over empty reels, waiting for a press.
- **Changing steps:** the shutters drop, the window rebuilds with 3 reels, and the turn tag swings in.
- **Starting the hike:** the bundle chips pop and spray resources into the cards, then leaves rain.
- **Sound:** the prototype makes its sounds in code (Web Audio): tick, thunk, ratchet, clink, pop, clack, chime, win, fanfare, drumroll, whoosh. Use those or real sounds, with a mute button.
- **Reduced motion** (the game's `useReducedMotion`): no screen shake, about a quarter of the particles, and no bobbing.

---

## 6. Data and code
- **`balance.ts`, a new `packing` block:**
  - `itemTypeOdds`, `tier2Chance`, `itemRespins`;
  - `picks: { base: 2, perHiker: 1 }`;
  - `bundleOdds`, `bundlesEach`, `bundleRespins`;
  - the bonus table.
- **The logic is plain functions with tests** (like the minigames' `logic.ts`): spin, take, bonuses, Second Wind, turns. The UI is just the screen.
- **Art:**
  - item art and resource icons from `public/assets/`;
  - the squirrel and wheel from the prototype's SVG;
  - the acorn cap from `icons/acorn-caps.png`.

## 7. Tests
- **The picks:** 2 + party size, for 1 to 6 hikers.
- **Odds:** over many seeded spins, types come up near 40/30/20/10, Tier II near 2%, and bundle sizes near 35/40/22/3.
- **Respins:**
  - a respin spins only lit reels and costs 1;
  - with 0 left, the lever does nothing;
  - the free first spin and Second Wind cost nothing.
- **Bonuses:**
  - only side by side;
  - a dark reel breaks a row;
  - only the longest row pays;
  - 4 in a row upgrades exactly one;
  - the jackpot upgrades all five and locks the rest after one is taken, and the next spin unlocks them;
  - the resource rows need all 3 reels lit.
- **Second Wind:** fires only when every reel is dark and picks are left.
- **Turns:** each hiker ends with exactly 2 bundles. Bundles never go to the wrong hiker. The turns run in party order.
- **Handing over:**
  - items end up in the right bags;
  - bundles open into exactly their resources;
  - nobody goes over 4 bag slots or 10 resources;
  - starting kits and gift traits still arrive.
- **Seeding:** the same seed with the same choices gives the same spins.
- **The card preview:** every item that can land has a card. Its unrolled text and counter match `itemRangeText` and `counterRange`.

---

## 8. Things to flag to Wyatt
- **"Bonus spin" and "free respin"** both mean +1 respin.
- **Odds:** the [2%] Tier II chance and the bundle odds (35/40/22/3) are guesses.
- **How often bonuses come** (with these odds; my math):
  - with all 5 reels lit, about 1 spin in 4 pays: 3 in a row [17%], 4 in a row [5%], the jackpot [1.3%];
  - fewer lit reels pay less often;
  - for bundles: ×1 ×1 ×1 [4%], ×2 ×2 ×2 [6%], ×3 ×3 ×3 [1%].
- **Respins:** [3] for items and [2] per hiker for resources.
- **Second Wind** and "only while all 3 are lit" for resource bonuses are my readings.
- **Clothes go in the bag,** not straight onto the hiker.
- **The squirrel and the machine** are drawn in code for now. They can be redrawn later.

---

## 9. Two looks over one set of rules
Wyatt wanted a TrailMate (GPS) version "exactly the same as everything else with only a difference in theme". So:
- **Build the rules once** (section 6's logic) and draw them with a **skin**: `cabinet` (this file) or `trailmate` (`28-packing-screen-trailmate.md`).
- **A setting** (Settings → Look → "Packing machine": TrailMate / Cabinet). **Both stay, and TrailMate is the default** (Wyatt).
- **Shared by both skins:**
  - the hiker cards' layout;
  - the card preview;
  - the drawers' behavior;
  - the drag and click controls;
  - every rule and number.
- **What a skin owns:** how the machine, the reels and the effects look and sound.
- **Build order:** build TrailMate first, since it's the default. Then add the cabinet as the second skin. Splitting it into two PRs is fine.
