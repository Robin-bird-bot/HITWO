# Update: November 21, 2026 (Phase 10.6: Simplify, plus map follow-ups)

**Build this next.** Phase 10.5 (the illustrated map) is done. This update has three parts:
- **A.** Two follow-ups to the illustrated map.
- **B.** A layout fix.
- **C.** **Phase 10.6: Simplify**, the first step of a bigger gameplay overhaul.

The whole overhaul plan is in `08-overhaul-plan.md`. Only its "Phase 10.6" section is built now. The rest (Phase 10.7 Hikers, Phase 10.8 Challenges) is still being designed. **Don't build those parts yet.**

Numbers in [brackets] are first guesses: put them in `balance.ts` (or the new `difficulty.ts`) with `TODO(wyatt)`. Nothing here needs Wyatt's answer before building.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `08-overhaul-plan.md` → `docs/design/08-overhaul-plan.md`.
- **Old docs:** at the top of each of these, add one line: "Phase 10.6 changed parts of this. See `08-overhaul-plan.md`, which wins where they disagree."
  - `docs/design/05-nights-and-weather.md`
  - the Food and Shelters sections of `docs/design/03-items.md`
  - the Wonders and Trials parts of `docs/design/04-challenges.md`
- `mockups/MapEdge.jpg` and `mockups/look/*.jpg` → `docs/mockups/illustrated-map/` (and its `look/` folder).
- `reference/topo_edge.py` → `docs/design/illustrated-map/reference/`. It's the prototype for the table and paper edge. Add a line about it to that folder's README.
- Then delete the leftover `update-2026-11-21-phase-10.6-simplify/` folder.

---

## 1. Plan changes (update `BUILD_PLAN.md` first, and commit)
- **Mark Phase 10.5 done.**
- **Add Phase 10.6: Simplify (now):** parts A, B and C of this update.
- **Add Phase 10.7: Hikers (next, design first):**
  - one starting trait picked from a short list per hiker;
  - skill trees (Movement, Resources, Utility; 3 tiers each);
  - party XP;
  - morale types;
  - new trinkets.

  Wyatt will send the design. Only write the phase's outline from `08-overhaul-plan.md`.
- **Add Phase 10.8: Challenges and opportunities (after 10.7, design first):** the minigame library and the first challenges. Outline only.
- **Phase 11 (Biomes):** Fog and Storm are gone (part C, section 4). Weather schedules per biome stay part of Phase 11.
- **Phase 12 (UI overhaul):** add the UI list from `08-overhaul-plan.md`:
  - small hiker frames;
  - a Catan and Minecraft-style crafting book;
  - a 3×3 crafting deal;
  - poster-style windows;
  - dealt-card animations and rarity glow.

---

# A. Illustrated map follow-ups

## A1. Setting: Show whole map
- **Settings → Map style → "Show whole map"**, a switch shown only when Map style is Illustrated. Default **off**. It's mainly for now, while Wyatt looks at the maps.
- **When it's on:**
  - the land is fully painted, with no pencil sketch and no reveal animation;
  - every place name is shown.
- **What doesn't change:** tiles, nodes, special spaces and challenges still follow the normal reveal rules. Only the land changes.
- Turning it off goes back to the normal reveal mask right away.

## A2. The map edge: a paper map on a table
See `mockups/MapEdge.jpg` and `mockups/look/edge-table.jpg`. The prototype is `reference/topo_edge.py`. Wyatt picked this over clouds (`edge-clouds.jpg` is only there for comparison).
- **The sheet:**
  - The land already ends [300] units past the tree. Around it, add a cream paper margin about [40] units wide, the same color and grain as the pencil sketch.
  - Inside the margin, a printed double border (thin graphite lines, [12] and [18] units in from the paper edge) and a single line where the land starts.
  - The paper edge is slightly torn: a few units of noise in the edge's transparency.
  - Faint fold lines at the vertical thirds and the horizontal middle.
  - A soft shadow on the table (blur [14], offset [10, 14], [55%]).
  - **Keep the sheet straight**, not rotated, so tile positions don't change.
- **The table:** generated wood planks behind the sheet: warm brown boards with grain, darker seams and a soft vignette. Generate it at screen size once and reuse it. It never moves with the map's content, only with the camera, like the sheet.
- **Camera:**
  - Zooming out stops once the whole sheet fits with about [8%] of table around it.
  - Panning stops when the sheet's edge reaches about [40%] of the way across the screen, so the map never disappears off-screen.
- **Classic map style:** no change.
- **Later, maybe:** a compass, a pencil or a coffee ring on the table, once Wyatt paints them. Not now.

---

# B. Fix: nothing cut off at the edges
Wyatt found cards and tooltips cut off:
- crafting and scavenging with more than 3 cards (Mom, for example): the leftmost and rightmost cards are clipped;
- trait tooltips near the edge of a window.

**Rules from now on**, for every window and pop-up:
- **Card rows:** if the cards don't fit, shrink them evenly (down to [80%]), then wrap onto a second row. Never clip.
- **Tooltips and hover windows:** before showing, check they fit in the game screen, with an [8 px] margin. If not, flip to the other side (above or below, left or right), then nudge them inside. They're never cut off by a parent window: render them in a top layer.
- **Check every card row and tooltip:** scavenging (the most cards possible, with Forager, Dogs and the bonuses), crafting (the most options), shops, challenge windows, hiker cards, trait badges, the level-up screen. Check at desktop size and at phone landscape size.
- Add a dev-only "edge test" button to the debug panel that opens each window with the most cards possible.

---

# C. Phase 10.6: Simplify

## 1. Difficulty setup and challenge density
- **New file `difficulty.ts`:** settings for `easy`, `medium`, `hard` and `nightmare`, with `medium` always active for now. No player-facing difficulty choice yet. The debug panel can switch it, for testing.
- **Settings per level:**

| Setting | Easy | Medium | Hard | Nightmare |
| --- | --- | --- | --- | --- |
| `challengeShare` (share of plain tiles with a challenge) | 0.25 | 0.5 | 0.75 | 1.0 |
| `opportunitiesPerSection` | [3] | [2] | [1] | 0 |
| `sectionRows` (multiplier on today's rows) | [0.8] | 1.0 | [1.2] | [1.4] |
| `challengeTierOffset` | 0 | 0 | 0 | 0 |
| `luckBonus` | 0 | 0 | 0 | 0 |
| `rarityMultiplier` | 1 | 1 | 1 | 1 |
| `appetiteDrainMultiplier` | 1 | 1 | 1 | 1 |
| `nightEventChanceMultiplier` | 1 | 1 | 1 | 1 |
| `startingKitPicks` | today's | today's | today's | today's |

  Move any of these numbers that are hard-coded elsewhere into this file.
- **Placing challenges when a section is generated:**
  - **Plain tiles** are every tile except the trailhead, the checkpoint and special spaces (Challenge, Opportunity, Choice, Trail Sign, Geo-cache, Campsite, Overlook, Narrow Path, Mystery).
  - **Special spaces work exactly as now.** Mystery still picks among them.
  - `round(challengeShare × plain tiles)` plain tiles get a challenge, picked at random. Spread them out: no path from the trailhead to the checkpoint should have more than [3] challenge tiles in a row if it can be avoided.
  - Then `opportunitiesPerSection` of the remaining plain tiles get an opportunity.
  - Every other plain tile is **quiet**: no challenge or opportunity, only scavenging.
  - The rule "opportunities only happen on tiles that have a challenge" no longer applies.
- **Shown on the map** exactly as today. Quiet tiles look like any unrevealed tile until they're entered or scouted.

## 2. Removed: Wonders and Trials
- **Wonders:** never generated. Hide every Wonder window and log line. Keep the code and data, behind `ENABLE_WONDERS = false`.
- **Trials** (orange, including Rocco Raccoon's three): out of every pool. Keep the data with `enabled: false`.
- Items and traits that mention Trials or Wonders keep working: they simply find none. Their text can stay for now.

## 3. Rednose
Redolf's **Rednose** has no effect for now. Remove its night-move and Fog code, and set its description to **`Placeholder text`**. Keep the badge and icon.

## 4. Weather
- **Kinds:** `clear`, `rain`, `snow`, `wind`, `heatwave`. **Remove Storm and Fog** everywhere: data, forecast, icons, Phase 11 hooks and tests.
- **The only effect is on scavenging:**

  | Weather | Node |
  | --- | --- |
  | Rain | River |
  | Snow | Mountain |
  | Wind | Forest |
  | Heatwave | Wildlife |

  - On a tile **with** that node: that node's resource cards are [1.5×] as likely.
  - On **any** tile: each resource card has a [10%] chance to become a random resource from the weather's node, even if the tile doesn't have that node. Show a small weather icon in the card's corner.
- **Remove every other weather effect:** conditions caused by weather (Wet, Soaked, Shivering, Burning and the rest), changes to nodes, weather-based challenge picks, and any other weather effect on hikers. **The conditions themselves stay,** since challenges and items still use them.
- **Schedule:**
  - The 3-day forecast stays.
  - Each weather lasts [1–3] days.
  - Until Phase 11 adds biomes, every section uses the Meadow odds: Clear [40%], Rain [25%], Wind [20%], Heatwave [15%].
- **Wind is new.**
  - **Icon:** three curved gusts, in the same style as the other animated weather icons. Make a placeholder.
  - **Illustrated map:** leaves drift across the land (a light particle layer, off with reduced motion). No color grade.
  - **Classic map:** the icon only.
- Update the weather-change pop-up and the forecast to match: one line per weather, like "Rain: more River resources."

## 5. Food
- **Only these 9 foods are switched on.** Set `enabled: false` on every other food.
  - Switched-off food is out of crafting (generic crafts and blueprints), scavenging, shops, bundles, Mystery Items, Presents, rewards and starting kits.
  - A switched-off food already in a pack still works.
  - Puked Nuggets stay (only the Nugget Puker trait makes them).
- **New numbers.** "Q" is Quality 1–5; a slash list goes Q1/Q2/Q3/Q4/Q5.

| Food | Tier | Bites | Each bite | At Quality 1 |
| --- | --- | --- | --- | --- |
| Trail Mix | 1 | 2/3/3/3/4 | +2 Appetite, Lucky this phase | No Lucky |
| Costco Sample | 1 | 2/3/3/3/4 | +2 Appetite. 35/45/45/45/55% chance not to use up the bite. 15% chance of a random positive condition for 1 phase | No positive condition; 20% chance of Food Poisoning |
| Dog Food | 1 | 2 | Dogs +3 Appetite, anyone else +2. First bite: Dogs +1 Morale, anyone else −1 Morale | No Morale for Dogs |
| Mystery Meat | 1 | 1 | +2 to 10 Appetite (random). 60/50/50/50/40% chance of a random negative condition for 3/2/2/2/1 phases | Built into the numbers |
| S'mores | 1 | 2 | +2 Appetite. Eaten at night: +1 more Appetite and +1 Morale | No night bonus |
| Jerky | 2 | 3/3/4/4/5 | +2 Appetite. Never loses Appetite value (flies, night events) | 20% chance of Food Poisoning |
| Fish and Chips | 2 | 2 | +2/3/3/3/4 Appetite. First bite: +1 Morale | No Morale; 25% chance of Food Poisoning |
| Rotisserie Chicken | 3 | 3/4/4/4/5 | +3 Appetite. **Camp meal:** any hiker on the same tile can eat a bite from it without trading for it first | 30% chance of Food Poisoning |
| Din Tai Fung | 3 | 4/5/5/5/6 | Appetite equal to the bites left, counting this one | 20% chance of Food Poisoning |

- **Recipes:** unchanged.
- **Card:** shows the bites left as pips.
- **Eating a bite** is a free action, as now.
- **Camp meal:** another hiker on the tile can eat a bite of the Rotisserie Chicken by dragging it onto their own portrait, or with an **Eat** button on the card when that hiker is selected. It stays in the owner's pack.
- **Starting bags:** any switched-off food becomes **Trail Mix** at the same Quality. List which hikers changed in your report.
- **Tune toward:** one scavenge plus one craft feeds about 3 actions. Log the average Appetite per food crafted in the debug panel's stats.

## 6. Portable shelters
Shelters become gear you carry and set up, instead of buildings left behind.
- **Carrying:** a shelter in a pack takes 1 item slot.
- **Set up:**
  - a free action, on your own tile, from a **Set up** button on the card (or drag the shelter onto the tile);
  - uses 1 **deployment**;
  - only 1 shelter can be up on a tile at a time.
- **While it's up:**
  - it takes no pack slot;
  - every hiker on the tile is sheltered: +1 Energy from sleeping, and safe from night events;
  - plus the shelter's own effect (Cabin's extra Energy, Yurt's extra card, Lodge's +1 Quality and so on), which works while it's up.
  - Drop the Drizzle and Sheer Cold parts of the shelter rule, since those came from weather.
- **Pack up:** a free action by any hiker on the tile with room in their pack. It goes into that hiker's pack.
- **Leaving:** when the hiker who set it up leaves the tile (a move or a Move All), it packs itself into their pack if there's room. If there isn't, it stays up until someone packs it.
- **Wearing out:** a shelter with 0 deployments left can't be set up again, and is thrown away when it's packed.
- **Deployments:**

| Shelter | Deployments | Shelter | Deployments |
| --- | --- | --- | --- |
| Hammock | [2] | Hostel | [5] |
| Tent | [4] | Tree-House | [5] |
| Cabin | [5] | RV | [5] |
| Tailgate | [4] | Medic Tent | [4] |
| Yurt | [5] | Lodge | [6] |

- **Recipes** cost 1 less: remove 1 "any" from each shelter's recipe [first guess]. The generic shelter craft drops from 6 to 5.
- **Card:** "Set up: free. **N** left." with deployment pips. A shelter that's up shows on its tile: in Classic, its icon; in Illustrated, a small tent stamp beside the hex.
- **Medic Tent:** keep "the first time each hiker sleeps here", counted per deployment.
- **Campsite spaces** keep their built-in shelter.
- **Old saves:** a shelter already placed on a tile becomes a set-up shelter, with deployments = nights left. Its owner is whoever placed it, or else the first hiker on that tile.

## 7. Debug panel
- difficulty switch (affects the next section generated);
- force a weather, including Wind;
- add any of the 9 foods at a chosen Quality;
- add any shelter with chosen deployments;
- the "edge test" button from part B;
- "Show whole map" mirrors the setting.

## 8. Tests
- **Difficulty:** for each level, generated sections have exactly `round(share × plain tiles)` challenge tiles and the right number of opportunities on non-challenge plain tiles. Special spaces are unchanged. Nightmare has no opportunities on plain tiles.
- **Removed:** no Wonders or Trials are generated over 50 seeded runs. Rednose does nothing.
- **Weather:** no Storm or Fog anywhere. Each weather boosts its node's resources on tiles with the node, and sometimes adds them on tiles without it. No conditions come from weather.
- **Food:**
  - only the 9 foods can come from crafting, scavenging, shops or rewards;
  - bites and Appetite match the table;
  - the camp meal can be eaten by another hiker on the tile without trading;
  - switched-off foods in old saves still work.
- **Shelters:**
  - setting up uses a deployment;
  - it shelters everyone on the tile;
  - it auto-packs when its owner leaves;
  - it's thrown away at 0;
  - only 1 per tile;
  - old saves convert.
- **Map:** "Show whole map" paints everything but leaves tiles hidden as normal. Zooming out stops with the whole sheet on screen. The sheet isn't rotated, and clicks still hit the right tiles.
- **Layout:** in the edge test, no card or tooltip goes outside its window or the game screen, at desktop and phone sizes.
