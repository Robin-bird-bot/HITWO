# Build plan

This plan builds the base game in phases. Each phase ends with something Wyatt can open in a browser and try. Read `CLAUDE.md` first for the stack and the architecture rules. The rules themselves are in `docs/design/`.

**How each phase is written**
- **Goal:** what's playable at the end.
- **Build:** the work.
- **Done when:** checks that must pass.
- **Ask Wyatt first:** decisions that block the phase. Ask them before starting. For anything else unclear, use a `TODO(wyatt)` placeholder in `balance.ts` or content and keep going.

The order follows the design doc's build order. It gets a walkable map on screen early so everything after it can be tested by playing.

---

## UI patterns (apply everywhere)

**Screen modes (Simple and Informative)**
- One setting for the whole game, in Settings in the ☰ menu, remembered per device. **Simple is the default.**
- Simple shows only what's needed to play: compact hiker cards, small pills along the top, and only the actions available right now. Details open in pop-outs that close on click-away.
- **Simple means fewer words, not fewer visuals.** Slots, icons, bars and the inventory grids all stay; Equipped, Bag and Resources keep their slot grids with short labels and counts ("BAG 3/4").
- Informative shows every number, label and threshold, plus tick marks on the status bars.
- Status bars in both modes: Energy green `#7FC29B`, Appetite brown `#C08A5A`, Morale purple `#B98AE0`; amber `#F0A83A` at a threshold (Fatigued, Hungry, Morale 5 and below); red `#E5624A` with a slow pulse when critical (Exhausted, Famished, Morale 2 and below).
- New UI from Phase 4 on needs both a Simple and an Informative version.

**Collapsible panels**
- Every floating panel has a small − button in its header: party, biome card, day and weather bar, objective, Abundance and caps, the selected hiker's panel, and the trail log.
- Clicking it shrinks the panel to its header row, and the button becomes +.
- Remember each panel's state per device in `localStorage`, wrapped in try/catch.
- `Main.dc.html` shows the buttons, with the trail log drawn minimized.

**Cards are built in-game, not stored as finished images**

This keeps the download small and lets numbers and text change.
- **Scavenge cards:** blank backdrop, then rotating rays, then resource icon(s) or a glyph, with text in the game fonts.
- **Item cards:**
  - Front: an animated type gradient, then the brown front background (its margin makes the gradient border), then masked rays, then the item icon, then the text.
  - Back: the gradient, then rays and texture, then the white type icon.
  - The exact recipe and the type colors are in `docs/ASSETS.md` under "Item card layers". `ItemCard.dc.html` is a working version of it.
  - Item icons are still coming from Wyatt; use the type icon as a stand-in.

**Inventory and other slots that grow**
- Always show every slot the hiker has.
- Slots added by an item (a Backpack's +2 bag slots) get a gold dashed outline and a small badge with that item's icon. This makes it obvious where the extra room came from and what is lost if the item comes off.
- Slots stay a fixed size within a row:
  - **Bag:** up to 4 slots at 64×90; 5–6 slots step down to 46×64 so they still fit one row; more than 6 wrap to a second row.
  - **Resources:** one tile per resource type with a count badge, 5 per row, wrapping, with the total ("7/10") in the header.
  - **Trait slots:** a fixed 3×2 grid, since 6 is the maximum.
- Only lists with no fixed limit scroll: the trail log, blueprints and shop stock.
- Never shrink a slot below about 44 px, so it stays tappable on a phone.
- Hover (desktop) or long-press (phone) shows any card full size.

**Motion**
- Keep animations slow and quiet, and turn them off under `prefers-reduced-motion`.
- **Scavenge card rays:**
  - The rays sit as a separate layer over the blank backdrop, at about 35% opacity for node cards and caps, and about 20% for any-node and items.
  - They rotate very slowly (one turn per 60–90 s).
  - The rays layer is drawn at about 145% of the card size and centered, so the corners never show while it turns.
- **Backdrop:** see `Backdrop.dc.html`, `Backdrops.dc.html` and `NightLandscape.dc.html`.
  - Each biome has 2–3 land layers (see `docs/ASSETS.md`). There are no cloud images.
  - The sky is a CSS gradient that changes with the phase, crossfading over about 2 s:
    - **Morning:** bright blue (`#3F8FD6` → `#8EC3EA` → `#CFE9F5`), with the sun high.
    - **Afternoon:** blue that turns a little orange low in the sky (`#4C8FCF` → `#8FBBE0` → `#E7C6A4` → `#F2B07A`). The sun sits lower, and the land gets a slight warm filter.
    - **Night:** dark navy (`#0B1229` → `#1A2547` → `#2E3A63`), with the moon. The land gets `brightness(0.44) saturate(0.6)` and a faint blue tint.
  - **Stars:** at night, scatter about 90 `*` characters in Edit Undo across the top half of the sky. Give them random sizes (10–22 px), random opacity (0.2–0.95) and a slow twinkle, seeded so they don't jump around between renders.
  - **Parallax:** when the map scrolls, far layers move slower than near ones (for example sky and stars 0.05×, mountains 0.15×, ridge 0.3×, foreground 0.5×).
- **Texture:** the pixel halftone texture (`assets/textures/pixel-halftone.png`) goes on card backs at about 55% and on large backgrounds at about 10%.

---

## Phase 0: Project setup

**Goal:** an empty game page, deployed, with the fonts and colors loaded.

**Build**
- Scaffold Vite + React + TypeScript (strict). Add ESLint, Prettier and Vitest.
- Folder layout:
  ```
  src/
    engine/      pure game logic (no React, no DOM)
    content/     traits, items, cards, challenges, characters… as typed data
    config/      balance.ts (every tunable number), assets.ts (asset paths)
    ui/          React components, one folder per screen/panel
    styles/      tokens.css (colors, fonts), global.css
  public/assets/ art and fonts the game loads (copied from /assets)
  ```
- `tokens.css`: the palette and the `@font-face` rules from `CLAUDE.md`.
- A `Stage` component that lays out a 1600×1000 box and scales it to fit the window, letterboxed and centered.
- A GitHub Actions workflow that builds and deploys to GitHub Pages on every push to `main`. Set Vite's `base` to the repo name.
- A placeholder title screen ("Hike in the Woods", a "New Hike" button) on a misty background, so the deploy shows something real.

**Done when:** `npm run dev`, `npm test` and `npm run build` all work, and the Pages URL shows the title screen with the right fonts.

**Ask Wyatt first**
- The GitHub repo URL, and whether it's public or private. GitHub Pages on a private repo needs a paid plan; otherwise use Netlify or Vercel.
- Is it OK for the game to be at a public URL?

---

## Phase 1: Engine core (no UI)

**Goal:** a tested rules engine that can run days, phases and stats in code.

**Build**
- **Types:** `GameState`, `Hiker`, `Section`, `Tile`, `Line`, `Node`, `Phase`, `Action`, `Condition`, `Inventory`, plus `saveVersion`.
- **Seeded RNG** stored in state (for example mulberry32 or sfc32). Helpers: `roll(chance)`, `pick`, `weightedPick`, `shuffle`.
- **`balance.ts`:** every number from the design doc, starting with:
  - stats 0–10;
  - thresholds: Hungry ≤5, Famished ≤2, Fatigued ≤6, Exhausted ≤3;
  - move 1, Move All 1 + 1 per hiker brought along, night move +1;
  - scavenge 1, end-of-day Appetite −1;
  - sleep +2, or +3 in a shelter; no sleep −2 Energy;
  - line costs.
- **`applyAction(state, action)`**, with actions validated before they apply (return a reason when an action isn't allowed, for the UI to show).
- **Day loop:** Morning → Afternoon → Night → camp step. One action per hiker per phase. Free actions don't use the phase.
- **Stats:** threshold states are computed, not stored. Hitting 0 gives an injury and resets the stat to 1. At 3 injuries the hiker passes out.
- **Hook system** for traits, items and conditions:
  - a registry of hook points, such as `modifyCost`, `canAct`, `onMove`, `onStartOfDay`, `onScavengeDraw`, `onCraft`, `onEat`, `onSleep`, `onMoraleChange`;
  - effects register against those hooks;
  - stacking order: flat amounts first, then percentages, rounding in the player's favor.
  - Add 2–3 sample traits (Leader, Stoic, Extrinsic) to prove it works.
- **Save/load:** serialize state to `localStorage` after every action. Keep one autosave slot. Load it on start.

**Done when:** tests cover move and Move All costs, line costs, thresholds, the injury reset, the day/phase advance, the end-of-day drain, sleep, the sample traits, and save/load round-trips. The same seed and the same actions give an identical state.

**Ask Wyatt first:** nothing; the doc covers this. Flag anything that reads as ambiguous.

---

## Phase 2: Trail generation

**Goal:** generate a random section tree and view it on a debug page.

**Build**
- **Generator** for one section:
  - starts at one Trailhead, branches out and rejoins at the checkpoint;
  - rows and branching come from `balance.ts`, tuned so a section takes about 20 minutes;
  - every tile is reachable, and there are no dead ends unless they are deliberate.
- **Lines** go between tiles in adjacent rows, plus some sideways lines within a row. Line types are normal, paved, steep, muddy and rough, weighted in `balance.ts`.
- **Tiles** get 1–3 nodes weighted by biome. There are also double nodes, Cap nodes and Bounty nodes.
- **Special spaces:** Opportunity, Challenge, Choice, Trail Sign, Geo-cache, Campsite, Overlook, Narrow Path, Mystery. Side features: Merchant, Traveling Trader.
- **Visibility:** how many nodes a tile has is always shown. Some nodes are revealed in advance; the rest are revealed on entry or by scouting.
- **Debug route** `/#debug-map?seed=123` that draws the tree as plain SVG.

**Done when:** 1,000 generated seeds all pass tests (connected, one start, one end, within size limits), and the debug view looks like a believable trail.

**Ask Wyatt first**
- Target rows per section and the maximum width.
- How often special spaces appear, and how many are revealed in advance.
- Which node combinations get labels (Creek = River + Forest, and so on). Placeholders are fine to start.

---

## Phase 3: Game screen, first playable

**Goal:** pick 4 placeholder hikers, walk them around the Meadow section, and watch their stats drain. Reload and the game is still there.

**Build:** this follows `docs/mockups/Main.dc.html`.
- **Map:**
  - the layered biome backdrop with parallax (see "UI patterns"), starting with the Meadow scene;
  - 112×128 hex tiles: the special icon sits in the center until a hiker has landed on the tile, then moves to the corner; nodes sit along the bottom;
  - lines with a cost badge at the middle of each special line;
  - hiker portrait tokens;
  - vertical scroll and zoom, "jump to hiker", and the side rail showing where every hiker is.
- **Top bar:** Day, phase, weather, the 3-day forecast, the objective card, and Abundance and caps.
- **Party panel (left):**
  - a compact card per hiker: portrait, name, family tag, slim Energy/Appetite/Morale bars, condition icons, and acted or ready;
  - the selected hiker's card expands to show exact stats with their thresholds, conditions, trait slots, and the XP bar.
- **Right panel:**
  - an action grid with disabled actions explaining why;
  - Abilities (active traits);
  - the current tile and any side feature;
  - equipped items, bag and resources;
  - the trail log.
- **Interaction:** select a hiker, then click an adjacent tile to see the cost preview and confirm. Move All picks who comes along. An "End phase" button warns when some hikers haven't acted.
- **Hiker tokens:** 4 placeholder hikers using `assets/portraits/placeholder.png`, with placeholder stats and traits.
- **Panels:** collapsible, following "UI patterns".
- **Saves:** New / Continue on the title screen.

**Done when:** you can play several days of moving around, stats and thresholds behave as the doc says, the layout matches the mockup at 1600×1000, and it still works at a phone-landscape size.

**Ask Wyatt first**
- Confirm the placeholder starting four, or give the real first four characters: family, starting slots (T/U/M/T/U/T/M/U/M/W), starting traits and any starting attribute.

---

## Phase 4: Scavenging and Abundance

**Goal:** the full draw-3, pick-1 scavenge flow.

**Build:** this follows `Scavenge.dc.html` and `ScavTypes.dc.html`.
- **Card types:** Resource, ×2, ×3, Pair, Trio, Mixed, Wild ?, Wild ×2, Variety Wild / Pair / Bundle, Choice !, Choice ×2, Pick / Pair / Bundle of the Wild, Acorn caps, Item find, and Choice item (pick 1 of 5).
  - Each type has a rarity: Common, Uncommon, Rare, Very rare, Legendary or Mythic.
  - The weights live in `balance.ts`.
- **Draw weighting:**
  - Each card comes from one of the tile's nodes, picked by how many of that node the tile has and its Abundance. A node at 0 gives nothing.
  - Its rarity comes from Luck: the Luck 0 and Luck +5 rows in `balance.ts`, with each point in between moving a fifth of the way. Negative Luck pushes Common toward 85%.
  - Morale sets a base Luck: −2 at Morale 0, 0 at 5, +2 at 10, in even steps (Wyatt, Nov 5). Traits and items add to it.
- **Window:** keep it light, because scavenging happens constantly. It should feel like a quick overlay, not a page change.
  - A translucent panel (about 50% opacity) with `backdrop-filter: blur(18px)` over a barely dimmed map.
  - A short fade and scale in and out (about 150 ms).
  - No "how it plays" strip. The player learns it by doing it.
  - Luck, family, trait and Abundance effects hide behind a "N bonuses" pill in the header that opens a small pop-over (`ScavengeMods.dc.html`).
- **Flow:**
  - cards are dealt face down showing their back (node, caps or item);
  - the player clicks each card to flip it, a quick 3D flip of about 300 ms (offer a "flip all" option for players who want speed);
  - the player picks 1;
  - pickers open for Choice cards and the Wild picks, as a compact row of chips under the cards.
- **Card art:** a blank backdrop, plus the slowly rotating rays layer, plus resource icons or the Game Quotes `?` / `!` glyph. Card backs add the node, caps or item hex icon and the pixel texture.
- **Abundance:**
  - one meter per node type;
  - a normal scavenge drains 1; ×2, ×3, Pair and Trio cards drain 2;
  - chosen bonus resources drain, random or refunded ones don't;
  - +1 per night a node wasn't scavenged;
  - resets to about 75% at each new biome.
- **Inventory limits:** items 4 bag + 3 equipped, resources 10, caps in one party purse. Free trades with hikers on the same tile.
- **Hooks:** Forager (+1 card), Dogs (+1 card), Gambler (reroll), node Finder/Hound, Archaeologist (more item finds), and Copier/Copydog.

**Done when:** tests check that draw odds match the configured weights over many seeded draws, and the flow animates nicely.

**Answered (Nov 4)**
- Rarity odds: at Luck 0, 75 / 15 / 6 / 2.5 / 1 / 0.5%; at Luck +5, 50 / 25 / 14 / 7 / 3 / 1%.
- A Mixed card on a 3-node tile: 1 resource from each of 2 random nodes on that tile.
- Dogs get 1 extra card to choose from (this replaces "more Choice cards").
- Until Phase 8, Item finds give the items named in `03-items.md`, which do nothing yet.
- The art for bones, flint and salt has arrived.

---

## Phase 5: Challenges, opportunities and Trials

**Goal:** entering an unrevealed tile can trigger a challenge, an opportunity or a Trial pop-up.

**Build:** `docs/design/04-challenges.md` is the source of truth for the content; read "How to read a challenge" first. The pop-up follows `Challenge.dc.html` (each hiker), `ChallengeParty.dc.html` (whole party) and `ChallengeOpportunity.dc.html`.

- **Three kinds of pop-up:**

  | Kind | Color | What it is |
  | --- | --- | --- |
  | Challenge | Red `#C8403A` | Pay a cost or take a penalty. Party challenges ("If not:") are paid together; each-hiker challenges ("If failed:") are judged per hiker. |
  | Opportunity | Blue `#2F6FAE` | An optional reward; skipping one never costs anything. The 17 in `04-challenges.md` (Nov 6 update). |
  | Trial | Orange, about `#E0812F` | Do something before a deadline instead of paying. |

  **Risk challenges** are a red variant marked "Risk:" in the Cost column. They have no pass or fail: each hiker may spend resources or items to lower a chance or a loss, then the game rolls.
- **Content as data** in `src/content/challenges.ts`: id, name, kind, tier, nodes, gates, scope, art, description, cost options, penalty effects and X/Y ranges.
  - Descriptions are placeholders (`placeholder: true`) until Wyatt writes them.
  - **Gates:** `[snow only]` (until Phase 11, a debug toggle counts the section as snowy), `[stormy weather only]` and `[sunny weather only]` (weather is Phase 6), `[afternoon only]`, `[only if a Dog is on the tile]`. A gate that isn't built yet makes the challenge unavailable, never broken.
  - **Effects** are small typed operations run by one effect engine: lose or spend resources, items, caps, stats, durability, XP or tool uses; gain a condition or an injury; change Abundance; move hikers (back, swept, blown); change lines (Muddy, Rough); hide nodes; raise an unrevealed tile's tier. No checks for a particular challenge by name.
  - Effects that need a later phase still apply in data form (a condition is added with its duration and icon) and are marked `TODO(phase N)`. **Frozen** blocks moving now.
- **Rolling X and Y:**
  - X is rolled once per challenge when it's revealed. The [bracket] range is the Tier I range; one tier higher (a Challenge special space), the range scales by `TIER_SCALE` in `balance.ts`. Some ranges run backwards (Dangerous Current: lower is harder).
  - Luck shifts X in the party's favor, using the average Luck of the hikers entering the tile.
  - Y is rolled separately for each hiker, with that hiker's Luck.
  - "(25%)" before a penalty: included only with that chance, rolled when revealed, and shown only if included.
  - [Brackets] are game logic and never shown; (parentheses) are shown. Short effects count phases; longer conditions count days or nights.
- **Picking:** on entering an unrevealed tile, pick from the challenges whose nodes match a node on the tile, whose tier matches the section's tier, and whose gates pass. Weights in `balance.ts`; avoid repeats within a section. Trials and opportunities mix in with odds in `balance.ts`. A tile triggers once, however a hiker arrives (moving back, swept, blown). Only the hikers on that tile are affected unless the text says otherwise.
- **Special spaces:** Challenge (one tier higher, plus a reward), Choice (pick 1 of 2), Opportunity.
- **The pop-up** (movable, like every window):
  - a red or blue blurred background with the drifting Game Quotes `!` pattern;
  - the tall banner: title centered, type and tier on the left, scope on the right;
  - art at 16:9 (`object-fit: cover`) from `public/assets/challenges/<id>.jpg`, or a placeholder;
  - the quote and description, then the "If not" / "If failed" box ("Reward" for opportunities);
  - per-hiker sections with requirement squares, "OR" between alternatives, a status line and ✓/✗;
  - the inventories of the hikers on the tile along the bottom, items and resources on separate rows.
  - **Risk challenges:** a +/− for each resource or item a hiker can spend, a live readout of their chance or loss ("Chance to fall in: 24%"), and a Roll button instead of ✓/✗.
  - **Trials:** the same window in orange. The banner shows the deadline ("2 phases left") where the scope would go; the goal and penalty replace the cost; a "Got it" button.
- **Trials:**
  - After the pop-up closes, an orange countdown chip stays near the day bar with the Trial's name and time left; clicking it reopens the details.
  - Target tiles, rows or lines are highlighted on the map (Rocco's tile in red).
  - The goal is checked at the end of every phase. Meeting it early ends the Trial; missing the deadline applies the penalty.
  - Rocco Raccoon's Trials give stacking rewards (within 1 day all three; within 2 days the resources and caps; within 3 days the caps). Finishing on day 4, or reaching a checkpoint first, gives nothing either way. Not done after 4 days: a random negative condition.
  - At most 2 active at once (`balance.ts`).
  - Build every Trial whose goal is about position or time. Trials that check sleeping, eating, crafting or Sitting by the Fire use the same framework but stay off until their system exists (`TODO(phase N)`).
- **Debug panel:** force a specific challenge or Trial on a tile, set the tier, show the X and Y rolls, and toggle "snowy section" and the weather.

### Nov 6 additions (`docs/UPDATE-2026-11-06.md`)
- **Content changes:** Bone Collector is now Crow Collector (each hiker: spend X[2–3] resources of the same type, or lose 1 random unequipped item). The Firewatch and Lost Pup Trials are gone. Every challenge and Trial has art.
- **Art:** `assets/challenges/` (96), `assets/opportunities/` (17), `assets/wonders/` (7) and `assets/night-events/` (15, for Phase 6). The game loads shrunk copies from `public/assets/`.
- **Opportunities (real content):** the 17 in `04-challenges.md` replace the placeholders. X ranges scale with the section's tier like challenges.
  - **Select** (✓/✗ per hiker; only ticked hikers take part): Mysterious Berries, Secret Tunnel, Nap Time, Airlift (hikers on any tile), Mysterious Pill; Raccoon Friend picks exactly one hiker.
  - **Spend any amount** (the Risk +/− chips with a live readout): Citro Tub, Abandoned Ranger Station, Hikers Exchange, Hungry Animals.
  - **Buttons** (each press applies at once): Snake Salesman (Buy ×5, price rolled per press), Snake Slots (Pull, paid with Energy, Appetite or Morale, odds on hover, at most 5 pulls per hiker), Predator Bait (×3; random, with a brief blue highlight on the tile that got easier), Predator's Den, Old Firewatch Tower.
  - **Waiting on later phases** (`TODO(phase N)`): Old Trail Sign (tool uses), blueprints from the Abandoned Ranger Station, real Tier III items and traits.
- **Early reveals** (Old Firewatch Tower, Multnomah Falls' reward): the card is fixed on the tile and a small icon appears there; clicking it opens a small pop-up with the banner and the card's text. It opens as usual when someone lands there. An early reveal that reaches a Wonder reveals the Wonder.
- **Run counters** in `GameState`: challenges passed and failed per hiker, items crafted per hiker and type, days since each hiker last slept, shelters placed per biome.
- **Wonders** (purple; `Wonder.dc.html`, `WonderRewards.dc.html`):
  - **The tile:** exactly 1 per biome, at a random spot, with no nodes. It looks like any unrevealed tile until revealed.
  - **Revealing** (landing on it, or an early reveal): pick 3 of its 5 goals and roll their X (scaled by `WONDER_BIOME_SCALE` per biome; ranges marked − go down), and pick the 3 Tier III items or traits for "pick 1 of 3" (placeholders for now). A Wonder icon stays on the tile; clicking it, or landing there again, reopens the pop-up.
  - **Goals** are checked live against only the hikers on the tile. Goals that need a system that isn't built yet (crafting, equipping clothes, clothing durability, real weather) are left out of the pick; every Wonder still has 4–5 to pick from.
  - **Accomplish** lights up when all 3 goals are met at once. Each hiker on the tile picks 1 reward (no two hikers take the same Tier III pick; Fort Rock's shelters: at most 2). A reward that can't be given yet shows greyed with its phase. "Claim rewards" applies them, and the Wonder turns grey for good.
  - **The pop-up:** 1400×956, movable, not blocking. The ribbon uses the trinket card back's gradient with a slow shift (still under reduced motion); the art is a full-width banner; goals on the left, rewards on the right, then Accomplish.
- **Wyatt's answers (Nov 6):** `WONDER_BIOME_SCALE` ×1.5; "a lot of XP" 100; "a lot of caps" 15; Pittock Mansion's caps goal X[10+] (all `TODO(wyatt)` first guesses); Airlift cures every condition, as written.

**Done when:** every challenge, Trial, opportunity and Wonder in `04-challenges.md` exists as data, and the ones whose systems exist can be triggered and resolved. Tests cover X and Y rolls with a fixed seed, Luck shifting X, (%) penalties, picking by node, tier and gates, party vs. each-hiker paying and failing, Risk challenge odds, Trial deadlines and rewards, opportunity selection, buttons and limits, early reveals, the run counters, and Wonder goals and rewards.

**Ask Wyatt first** (answered Nov 5 and Nov 6)
- `TIER_SCALE` ×1.5; the mix 70% challenge, 20% Trial, 10% opportunity.
- Wonder numbers: see "Wyatt's answers (Nov 6)" above.

**Phase 5 notes (built Nov 6)**
- **Where things are:** content in `src/content/challenges.ts` and `src/content/wonders.ts`; rules in `src/engine/challenges/` and `src/engine/wonders/`; pop-ups in `src/ui/challenge/` and `src/ui/wonder/`. The backtick debug panel can open any card, reveal a card or the Wonder, and gather everyone on a tile. `#debug-challenges` lists every challenge, Trial, opportunity and Wonder with sample rolls.
- **Handing things in:** tap a space, then a glowing card or resource; or drag a card or resource from a pack straight onto any space. Nothing is spent until Continue.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - Luck skews X and Y as u^(2^(Luck × 0.5)); every card is equally likely; every tile except the trailhead and the checkpoint gets a card.
  - A Challenge space's reward is a random item, Lucky for 1 day, or the XP again.
  - Trials due "by night" or "before the next morning" are checked at the end of the night.
  - Opportunities scale ×1.5 per tier above I. Snake Slots pays 15 caps ("a lot"), 2 caps ("a few") or 3 resources ("several"). Conditions from opportunities last 1 day.
  - Citro Tub only rewards a hiker who spends at least 1 Energy.
  - Predator Bait is off until some unknown tile is above Tier I, so a press can't only make things harder (every biome 1 tile starts at Tier I).
  - Wonder goals: the doc's X[6+] is read as "at least 6", ×1.5 per later biome (an "at most" shrinks). "3 hikers on this tile" doesn't scale. Sleeping Giant's Energized lasts 1 day.
- **Waiting on later phases** (`TODO(phase N)`):
  - Phase 6: condition effects (only Frozen works now), weather for gates and Crater Lake's goal.
  - Phase 7: Bleeding's injury when it runs out; giving the next biome a Wonder not used yet.
  - Phase 8: durability, tool uses, food Appetite and spoiling, losing clothes (Fashion Critic), shelter cards placed by hikers, blueprints, the real Tier III items and traits, crafting (Multnomah Falls' goal), equipping clothes (Pittock Mansion's goal) and Old Trail Sign.
- **Conditions now:** every condition in `02-traits-and-conditions.md` can be given, counts down by days or phases, and shows on the hiker cards. Only Frozen has its effect (can't move or be moved). Two placeholders exist for opportunities: Napping (Nap Time: can't move, be moved, scavenge or tend next phase) and Raccoon Friend (a random resource most nights). Everything else arrives in Phase 6.
- **Saves:** version 5. Version 4 added the run counters and version 5 a Wonder per section; older saves are upgraded.

---

## Phase 6: Night, camp and conditions

**Goal:** nights matter.

**Build**
- **Night actions:** Sleep, Keep Watch, and Move or Scavenge at the night penalty.
- **Camp step:**
  - a night event (see "Night events" below). The art for all 15 creatures is in `assets/night-events/`;
  - conditions tick down;
  - clothing durability ticks down;
  - passed-out countdowns drop.
- **Conditions engine:**
  - day-based and phase-based durations;
  - stat changes that apply while a condition lasts and undo when it ends;
  - caps that change the maximum;
  - positive conditions can push a stat above 10.
  - Implement every condition in `02-traits-and-conditions.md`.
- **Weather** affects every tile, with the 3-day forecast shown (see "Weather" below).

- **Conditions must be easy to see and understand in both modes.** Design how they show on the hiker cards and the map so a glance tells you who has what, how long it lasts and what it does (for example, bigger condition icons with a time-left count, positive and negative clearly colored, and a one-line description on hover or tap). Make a mockup for Wyatt to approve before building it.
- Turn on the challenge and Trial effects that were waiting on Phase 6 (the `TODO(phase 6)` list from Phase 5).

### Night events (`docs/UPDATE-2026-11-06-nights-weather.md`, 2)
Follow `docs/design/05-nights-and-weather.md`.
- **Each night:**
  1. Pick a tier using the odds for the current biome.
  2. Pick a creature from that tier.
  3. Roll for each exposed hiker. A hiker is safe on a tile with a shelter, or on a tile where any hiker chose Keep Watch.
  4. Pick a random outcome from the tier's list for each hiker hit, skipping outcomes that can't apply.
- **Data:** creatures, tiers, outcomes, odds and the per-hiker chance formula all go in `src/content/nightEvents.ts` and `balance.ts`. Outcomes run through the same effect engine as challenges.
- **Lines:** each outcome has a generic sentence template with `{creature}`, `{hiker}` and `{X}`. Creatures can override any template with their own version. Write a placeholder set (`placeholder: true`) so Wyatt can replace them.
- **The window** (follow `NightEvent.dc.html`):
  - a small side window styled like the side panels, sitting beside the right-hand panel. It doesn't dim or blur the map. It has a − button to minimize it and is movable like the other windows;
  - a midnight-blue ribbon, the creature art as a banner, and the creature name;
  - one line per hiker hit, with a result chip;
  - an optional "safe" note;
  - an OK button.
  - It only appears if someone was hit.
- **Debug panel:** force a tier and creature, and force a hit on a chosen hiker.

### Weather (`docs/UPDATE-2026-11-06-nights-weather.md`, 3: Phase 6 engine, Phase 11 schedules)
- **Four weathers:** Rain, Storm, Snow and Heatwave. Each has a hiker effect and a node effect, as in the doc's table. Clear has no effects.
- **Timing:** hiker effects start after the first full day of the weather. Node effects start at once, and roll at the start of each phase.
- **Drizzle:** each phase, every equipped clothing item has a 35% chance to lose 1 durability.
- **Burning** goes down by 1 in any Night phase where the hiker gains none.
- **Sheer Cold** stays at 3 Shivering per phase (Wyatt's call).
- **New node states:** Flooded (counts as River), Frozen (gives no resources) and Fire (not Forest; +1 Luck to the other nodes on the tile; spreads to connected Forest tiles at 35%).
  - Use the new node icons.
  - Store the original node type, so everything changed reverts when the weather ends.
  - Shivering and Burning end then too.
- **Shivering and Burning** are stacking conditions. Show the stack count on the condition icon.
- **The weather change screen** (follow `Weather.dc.html` and `WeatherIcons.dc.html`):
  - not a pop-up: the whole screen blurs;
  - the animated icon, the weather's name, its two effects, and a Ready button.
  - In the game the icon animation plays **once** and holds its last frame. It doesn't loop like the mockup.
  - Show it when the weather changes, including back to Clear (the sun icon, "CLEAR SKIES", no effects).
  - Under reduced motion, show the final frame.
- **Scheduling:** until Phase 11, use a simple placeholder schedule plus the debug panel to set the weather. Phase 11 gives each biome its own weather odds (Snow mostly in the high, snowy part; Heatwave in the Meadow).
- No special weather challenges for now.

**Done when:** every listed condition has a test.

**Ask Wyatt first** (answered Nov 6)
- The first-guess numbers in `05-nights-and-weather.md`: tier odds by biome, the per-hiker night chance, and the X ranges.
- The balance notes at the end of `05-nights-and-weather.md`. Drizzle, Burning and Sheer Cold are settled.

**Phase 6 notes (built Nov 6)**
- **Wyatt's answers (Nov 6):**
  - The doc's first-guess night numbers as written.
  - Drizzle keeps Wet, then Soaked.
  - Conditions give back what they took when they end, and take back what they gave. Energized can pass 10, and taking it back never goes below 0. Caps just lift.
  - Thrill Seeker is a Trail trait.
  - A Fire node gives nothing when scavenged.
  - Refreshed and Full block every loss of their stat, chosen costs too.
  - A simple random weather schedule until Phase 11.
- **Where things are:**
  - Conditions: `src/content/conditions.ts` (every condition as data) and `src/engine/conditions.ts`. The new hook points (`modifyStatChange`, `modifyStatMax`, `onStatChange`, `onPhaseEnd`, `suppressTraits`) are in `src/engine/effects.ts`. Badges and tooltips are in `src/ui/conditions/`; the approved mockup is `#mockup-conditions`.
  - Weather: `src/content/weather.ts`, `src/engine/weather.ts`, and the change screen in `src/ui/weather/`.
  - Night events: `src/content/nightEvents.ts` (creatures, outcomes and placeholder lines), `src/engine/night/`, Keep Watch in `src/engine/actions/watch.ts`, and the window in `src/ui/night/`.
  - The backtick debug panel sets the weather (and holds it), skips the grace day, floods, freezes or burns a node, puts clothes on a hiker, and forces tonight's night event (tier, creature, a hit) or runs it now.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - Night numbers are rolled evenly; challenges let Luck tilt theirs. Tier 1's conditions last 1 day. Tier 3's Frozen lasts 1 phase and Soaked 1 day (the doc gives no time).
  - Only one hiker per tile can keep watch. Passed-out hikers can be hit. Stealing takes bag items, not worn ones. An outcome that would take only stats already at 0 is skipped.
  - Drizzle's Wet lasts 1 day.
  - Ringing Ears: a 75% chance of −1 Morale in each day phase, and 25% of −1 Energy at night.
  - Blind stops the Move action; Move All can still bring the hiker.
  - A condition's loss follows the normal rules, so Sleepy taking Energy to 0 gives an injury. While Burning's cap holds Energy, Energized can't push past it.
  - Phase 5's gates: "stormy" means Storm and "sunny" means Heatwave.
  - Sit by the Fire isn't in any phase yet, so its button says "Soon".
- **Waiting on later phases** (`TODO(phase N)`):
  - Phase 7: Bleeding's injury when it runs out; passed-out countdowns at camp.
  - Phase 8: clothing durability (Drizzle and night events record wear on the item until then); equipping clothes (night outcomes that need clothes are skipped); food giving less Appetite (recorded on the item); Food Poisoning, Inept and Clumsy; Lucky and Unlucky for crafting.
  - Phase 11: each biome's own weather odds.
- **Saves:** version 6. Version 6 adds real weather with a forecast; an older save's Storm or Heatwave carries over.

---

## Phase 7: Injuries, passing out, carrying and abandoning

**Build**
- **Injuries are strikes with no effect of their own.**
  - A hiker gets one when Energy or Appetite hits 0 (not Morale, which stops at 0), or from challenges and events.
  - Gaining an injury raises each of that hiker's stats that is below 5 back up to 5.
  - Show injuries as 3 strike pips on the hiker card.
- **Cures:** Bandages, Splint, Medkit, Medic Tent and station services.
- **Bleeding:** when it runs out the hiker gains 1 injury; add its cures (specific tools, traits and clothes, named by Wyatt).
- Passing out at 3 injuries:
  - a 2-night countdown;
  - waking with a medical item;
  - carrying, where the carrier's moves cost +1 Appetite;
  - abandoning when the countdown hits 0, or by choice.

**Phase 7 notes (built Nov 7)**
- **Wyatt's answers (Nov 7):**
  - Build the medical items now, with a small "Use" free action that Phase 8 extends.
  - Carrying: pick up, then carry. Picking up and putting down are free; each of the carrier's moves costs +1 Appetite; one carried hiker each.
  - Passed-out hikers skip the camp drains.
  - Hikers on the same tile can take a passed-out hiker's things; whatever is left leaves with them.
  - The hike ends when no hiker is active.
  - Bandages and Medkit cure Bleeding for now.
- **Where things are:**
  - Passing out, waking, the countdown, abandoning and the hike ending: `src/engine/health.ts`.
  - The actions: `src/engine/actions/useItem.ts`, `carry.ts` and `abandon.ts`; taking from a passed-out hiker is `give` (`give.ts`).
  - Item uses: `ItemDef.use` (`src/engine/effects.ts`), filled in for Medkit, Medicine, Bandages and the Splint in `src/content/items.ts`. Numbers in `BALANCE.medical`, `BALANCE.carry` and `BALANCE.passOut`.
  - On screen: the stash menu's "Use on…" (`src/ui/game/StashMenu.tsx`), the Carry and passed-out cards in the turn panel (`src/ui/panels/TurnPanel.tsx`), tokens (`src/ui/map/HikerTokens.tsx`) and the end screen (`src/ui/hike/`).
  - The backtick debug panel can pass out or wake a hiker, set their nights left, and give any item.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - Injuries stop at 3.
  - The countdown starts full (2 nights) every time a hiker passes out, and drops the night they pass out too.
  - A woken hiker can still act this phase if they hadn't already.
  - Bandages (1 injury, and Bleeding) and the Splint (1 injury for 3 days, shown as a Splinted condition) are placeholder tools: only Medkit and Medicine are in `03-items.md`. Every medical item is used up after one use. The player picks which condition Medkit or Medicine cures.
  - Anyone can carry anyone, and Cats pay the +1 too. A Frozen hiker can't be carried. A card that moves the carrier (or the carried hiker) drops them.
  - Passed-out hikers can still be hit by challenges, night events and weather on their tile.
- **Fixed from Phase 6:** a condition a night event gave lasted no time at all when counted in days; it now lasts through the next day.
- **Waiting on later phases** (`TODO(phase N)`):
  - Phase 8: item uses and Quality; the Carrier Pack, Medic Tent, Safety Vest and Helmet; taking a passed-out hiker's worn clothes.
  - Phase 9: station healing and rejoining; a carried hiker arriving at a checkpoint; giving the next biome a Wonder not used yet.
- **Saves:** version 7. Version 7 adds the countdown and carrying; an older save's passed-out hiker gets a full countdown.

---

## Phase 8: Items, crafting and blueprints

**Build**
- Item types: tools (uses), clothes (equipment slots Body, Feet and Gear, durability in days or charges), food (a free action), shelters (placed on a tile), and trinkets.
- Tiers 1–4. Tier 4 only comes from luck and never teaches a blueprint.
- **Generic craft:** pay the category cost, see 2+ random items of that type at your tier with a small chance of a higher tier, and pick 1.
- **Blueprints and recipes:**
  - crafting an item learns it;
  - a known blueprint gives the exact item for a higher cost;
  - teaching costs 4/6/8 Morale;
  - bundles.
- **Quality:**
  - Tools, food and clothes have Quality 1–5. Shelters and trinkets have none.
  - The roll is a bell curve. Starting odds in `balance.ts`: 10 / 20 / 40 / 20 / 10%.
  - The crafter's Luck (mostly from Morale) shifts the curve up or down. Lovingly Made adds Luck at Morale 8+. Talented, Chef and Careful Hands push it up; Dogs push it down.
  - Found and bought items roll the plain curve.
  - Item data marks Quality-scaled values as `(X)`, for example `{ appetite: qualityScale([2,3,4,5,6]) }`.
  - Item cards show Quality as pips.
- Implement every item in `03-items.md`. Use placeholders for the rest.
- Turn on what Phase 5 left waiting on items (the `TODO(phase 8)` list; it was `TODO(phase 9)` before the Nov 7 swap): tool uses (Old Trail Sign, Sticky Sap, Dull Blades), clothing durability (Freeagle, Fashion Critic, Fort Rock's goal and reward), crafting (Multnomah Falls' goal, Rocco Raccoon's Rebuilding Trial), equipping clothes (Pittock Mansion's goal), hikers placing shelters, blueprints from the Abandoned Ranger Station, and real Tier III items and traits in place of the Wonder and Snake Slots placeholders.

### Nov 7 update (`docs/UPDATE-2026-11-07-items.md`, 2)
Follow `docs/design/03-items.md` (the source of truth for items) and the item card mockups.
- **Crafting:**
  - **Generic craft:** each type's basic recipe from the Crafting table: one key resource (pick from 2) plus a broad part (any mix from a wide group). Trinkets take 5 random different resources, re-rolled after every trinket. Tier 2 adds 1 key and 1 broad; Tier 3 adds 2 of each.
  - **Blueprint recipes:** each item's own recipe from its table row.
  - **Resource packs** craft from 5 resources of their type (any 5 for the Resource Pack): a way to swap unwanted resources.
  - "Not crafted" items only come from finds, shops or events.
  - The Tailgate and Lodge shelters give +1 Quality to food, or to tools and clothes, crafted on their tile.
- **Items:**
  - **Tools:** uses count down, and the tool is removed at 0.
  - **Clothes:** three slots, Gear, Body and Feet (Feet takes shoes or socks). Anyone can wear anything. Durability ticks down at camp, and some effects cost extra.
  - **Food:** eating is a free action, one bite at a time.
  - **Shelters:** placed on a tile and gone after their nights. Every shelter is a basic shelter (+1 Energy when sleeping, safe from night events, Drizzle and Sheer Cold), plus its own effect.
  - **Trinkets:** Use (consumed) or Keep (works while carried). Trinkets that touch traits, slots or XP are data now, with their effects `TODO(phase 10)`.
  - Effects run through the shared effect engine and the trait/item hooks, never through name checks.
- **Item cards** (`ItemCard.dc.html`, `ItemCardAnatomy.dc.html`):
  - the item art centered in the cloud window of the front background;
  - the title in Edit Undo, then the type (and slot for clothes), then the effect in DM Sans with this card's actual Quality values;
  - the tier as a roman numeral at the top center: Tier I shows nothing, II silver, III gold, IV a rainbow mix;
  - the bottom row: Quality diamonds on the left, a labeled counter on the right (USES as squares, DURABILITY as thin bars, BITES as circles; filled pips are what's left).
- **Hidden challenges** (a setting for Wyatt to try):
  - `CHALLENGE_SHARE` per biome in `balance.ts`, defaulting to 1.0, so nothing changes until Wyatt lowers it. Below 1.0, only that share of a biome's tiles get a challenge.
  - Opportunities and Trials only happen on tiles with a challenge. Wonders are always extra.
  - The scouting tools marked \* in `03-items.md` (Scanner, Security Camera, Minesweeper, Linescan, Radar Scanner) read it. The Scanner sweeps a red hexagon out from the tile's center and puts a small red ! on tiles with a challenge. Minesweeper and Linescan show colored numbers that fade away, not a pop-up.
- **Debug panel:** give any item at any tier and Quality, and refill uses, bites and durability.

**Ask Wyatt first** (Nov 7 update, 3)
- Whether to build the "Suggested" items as placeholders now, or skip them.
- Anything marked [first guess]: shelter nights, Diploma XP, Postcard XP, and the higher-tier recipe costs.
- The Quality roll odds (10/20/40/20/10%) and how much Luck shifts them.

**Phase 8 notes (built Nov 7–13)**
- **Wyatt's answers:**
  - Nov 7: skip the Suggested items. Use the first-guess numbers as written. Quality odds 10/20/40/20/10%, and each point of the crafter's Luck moves 5 points from Quality 1–2 to 4–5. Generic craft shows 3 choices, each with a 10% chance of one tier higher. Everyone crafts Tier 1 and has a craft tier per item type. Finds are the biome's tier with a 10% chance of one higher. No Tier 4 items until they're named.
  - Nov 13: the crafting mockup (`#mockup-crafting`) is approved as shown. A basic recipe's key part takes 2 of the same resource. Resource packs need their blueprint. Teaching costs the teacher the Morale (4/6/8 by tier).
- **Where things are:**
  - Items as data: `src/content/items/` (one file per type, plus `basicRecipes.ts`). `others.ts` keeps the old stand-ins so old saves load.
  - Item instances, Quality and text: `src/engine/items/` (`make.ts`, `quality.ts`, `text.ts`). Wear and durability: `wear.ts`. Short-lived effects ("this phase", "for N nights"): `boosts.ts`. Free moves: `freeMoves.ts`. Shelters: `shelters.ts`. Crafting: `craft.ts`. Map tools: `scout.ts`.
  - Actions: `src/engine/actions/` `dress.ts` (put on, take off), `eat.ts`, `useItem.ts`, `shelter.ts` (place) and `craft.ts` (craft, take, teach).
  - Item effects plug into the hooks in `src/engine/effects.ts`: equipped clothes through `hooksAt`, boosts through `boostHooks`, placed shelters through `placedHooks`.
  - Numbers: `BALANCE.items` (Quality, finds, shelter nights, crafting, free moves) and `BALANCE.challenges.share` (hidden challenges).
  - On screen: the item card (`src/ui/items/ItemCard.tsx`), the stash menu's Put on, Eat, Use and Place (`src/ui/game/StashMenu.tsx`), the Craft window (`src/ui/craft/`), map-tool picks and effects (`GameScreen`, `MapView`), and item payments in the challenge window.
  - Debug: `#debug-items` shows every card at any tier and Quality. The backtick panel gives any item at any tier and Quality, refills items, sets craft tiers and teaches blueprints.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - **Free actions:** using a tool, eating, putting clothes on or taking them off, and placing a shelter (on any tile). Equipped clothes take no bag slot, so taking them off needs room in the bag.
  - **Timing:** "this phase" lasts the rest of the current phase. Nauseous, Sated, and the random positive conditions some foods give, last 1 day.
  - **Numbers:** shelter nights for the Tailgate, Yurt, Hostel, Tree-House, RV, Medic Tent and Lodge; Diploma and Postcard XP; the higher-tier recipe extras (and a trinket's extra resources); Dogs craft at −1 Luck; the Abandoned Ranger Station finds a blueprint 1 time in 3; a Sack's extra cards cost no Appetite.
  - **Readings of the item text:**
    - The Bandaid cures the negative condition the player picks.
    - Crutches remove 1 injury for N days, shown as an "On Crutches" condition, then it comes back.
    - The Star blocks negative conditions only; good ones still land.
    - The Clothing Patch can't raise clothes past their full durability.
    - The Hiking Stick's "moving alone" and the free moves (Jogging Shoes, Hiking Crocs, Work Boots) are the Move action, not Move All. An earned free move lasts the rest of the day.
    - The Puffer Jacket blocks every negative condition by itself, without asking.
    - Lifted Boots: the one hiker brought along doesn't use their action.
    - Soup Socks: the wearer gains the Morale.
    - Medic Tent: a hiker with no injury to remove keeps their turn for a later night.
    - "Around you" (Minesweeper, Radar Scanner) and the Trampoline's "next to you" mean every tile touching the hiker's on the grid.
    - Fort Rock's reward doubles the most durable item the hiker wears; they don't pick.
    - Bear Country's challenge starts the moment someone crafts on its tile.
  - **Waiting on Wyatt:** the Ring (which family, and for how many days); whether the Carrier Pack makes carrying free; trying a lower `CHALLENGE_SHARE`.
- **Waiting on later phases:**
  - Phase 9 (`TODO(phase 9)`): dropping unused Supply Map boosts when a new section starts; the workbench (higher craft tiers), the shop and blueprint bundles.
  - Phase 10 (`TODO(phase 10)`): the Diploma, the three Photos, Instruction Manual, Postcard, Textbook, Thinking Cap and VR Headset (traits, slots and XP), and the traits that change crafting Quality.
  - Sit by the Fire is still held, so Frozen Fingers stays off and Bear Country only watches crafting.
- **Saves:** version 10. Version 8 adds item Quality, uses, bites and durability, and turns old items into their replacements (Medicine → Bandaid, Splint → Crutches, Safety Vest and Helmet → Hardhat, the clothing Camera → VR Headset, Bundle → Resource Pack). Version 9 gives placed shelters their own nights. Version 10 adds crafting (optional fields, so nothing to migrate).

---

## Phase 9: Checkpoints and ranger stations

(Phase 9 since the Nov 7 update: items and crafting come first, because the station shop sells items.)

**Goal:** finish the Meadow section and move on to the next.

**Build**
- **Check-in:** all active hikers must check in. Checked-in hikers are frozen. Warn when someone will be left behind.
- **Station visit:**
  - inventories are shared;
  - shop stock comes from the station theme;
  - a buy table that pays more or less by category or node;
  - caps;
  - a workbench for higher-tier crafting;
  - temporary theme blueprints;
  - one rejoin service;
  - a free sheltered night.
- **Next biome:** start from a free Trailhead.

**The station screen:** a full screen in a cozy wood-and-parchment style. It follows `Station.png`, `StationAhead.png` and `Station.dc.html`.
- **The room:**
  - The back wall is a full-width window wall looking into a darkened forest: layers 241, 271, 266 and 265 at roughly brightness 0.42–0.6, with wooden frames and a faint glass glare.
  - On the left is a stone fireplace with a mantel. The flames flicker in layers, and warm firelight pulses gently across the room (off under reduced motion).
  - A hanging wooden sign shows the station theme.
  - The shopkeeper stands behind the counter (placeholder art until Wyatt's arrives).
- **Style:**
  - Wooden pieces: the sign, counter, tabs, price tags and buttons.
  - Dark translucent panels from the main game UI: the shopkeeper dialogue, the sell slot and the hiker packs.
- **Top-right buttons:**
  - **Rest & Go:** the free night, then the next biome.
  - **Preview Next Trail** (binoculars icon): opens the next section's map, showing only what's visible from here. Specials that make choices about the next trail are used from this preview, for example Cement Mixer (choose a line to pave) or scouting services (choose tiles to reveal).
- **Shopkeeper dialogue:** a dark speech bubble in Edit Undo, with three options.
  - **"What's selling?"** shows this visit's market as chips with resource icons: **×2** (green) and **×½** (red). Each visit, the same way at every station, 4 random resources sell for ×2 and 4 others for ×½; the rest sell at the normal price (numbers in `balance.ts`). Selling uses these prices.
  - **"What's ahead?"** describes the next biome (tier, weather odds, common nodes, likely conditions and line types) with icon chips. Placeholder text until the biomes are finalized.
  - **"Just looking"** closes the conversation.
- **Tabs:** Shop and Workbench. Blueprints are sold in the Shop tab.
- **The counter (Shop tab):**
  - **Row 1:**
    - a "Drag here to sell" slot (a dark panel that shows the price before confirming);
    - item cards, built from the item card layers;
    - station specials mixed in with the items, as cards with a unique animated gold border.
    - Every card has a parchment price tag that dims when the party can't afford it.
  - **Row 2:** blueprints as larger blueprint-paper squares with a border in their item type's color, then resource bundles.
  - **Scrolling:** rows 1 and 2 scroll sideways together, with one scroll bar along the bottom of the counter in dark wood rather than gold. Drag, mouse wheel or swipe. The last visible card fades at the edge.
  - **Party caps:** a brass plaque fixed at the right end of row 2. It doesn't scroll. Caps stay one shared purse.
- **Below the counter:**
  - Every hiker's pack (bag and resources), shared while at the station, with room for bigger slots.
  - Drag from a pack to the sell slot to sell, or to the Workbench to craft.
  - **Hovering** a card in a hiker's pack (long-press on a phone) shows a larger version of the card with its sell price at this station.

**Themes and shop rules:** `docs/design/06-ranger-stations.md` (Nov 13 update, `docs/UPDATE-2026-11-13-stations.md`).

**Phase 9 notes (built Nov 13–14)**
- **Wyatt's answers:**
  - Nov 13: at the Workbench everyone crafts one tier above their own. The free night is a sheltered sleep that loses nothing. Blueprints come in two kinds: free temporary ones at the Workbench (kept only by crafting there) and ones for sale, kept for good.
  - Nov 13 update: 9 themes from `06-ranger-stations.md`, never repeated in a run, with the shared shop rules (no signature services). Each hiker starts a new run with 4 random resources.
  - Nov 14: the station extras mockup (`#mockup-station-extras`) is approved; BeaR E I is now Bea-R-E-I. A Merchant's 3 cards can each be bought once. A Traveling Trader's item is one tier above the biome, and the type they want is random and not their item's.
- **Where things are:**
  - Themes as data: `src/content/stations.ts`.
  - The engine: `src/engine/station/` (`checkIn.ts` checking in, left behind and the summit; `stock.ts` rolling a visit and the next section; `prices.ts`; `trail.ts` the Merchant and Traveling Trader) and `src/engine/actions/station.ts` (buy, sell, give, the Taxi Service, Rest & Go). Rocco's used-or-lost log: `src/engine/items/gone.ts`. The Workbench's tier and pooled resources: `src/engine/items/craft.ts`.
  - Numbers: `BALANCE.station` (stock, tiers, Quality, prices, the market, specials, the rejoin, the Workbench, the Merchant and Trader) and `BALANCE.inventory.startingResources`.
  - On screen: the station screen (`src/ui/station/`: the room, the talk, the counter, the packs, the buy dialog, the Workbench tab, Preview Next Trail), the trail's Merchant and Trader window (`src/ui/trail/`), and the summit end screen.
  - Windows that open take the keyboard focus and give it back when they close (`src/ui/app/useFocusOnOpen.ts`).
  - Debug: the backtick panel brings everyone near the checkpoint, picks the section, picks a theme, opens a station, rerolls its stock, gives caps, adds to Rocco's log, and puts a Merchant or Trader on Hiker 1's tile. `#mockup-station-extras` shows the approved mockup.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - **Checking in:** it's always the hiker's own move (Move, Move All or the Trampoline). Cards never move a hiker onto the checkpoint. Checked-in hikers lose nothing while they wait. +10 XP each.
  - **Stock numbers** (`BALANCE.station`): 4 focus slots; an 8% trinket chance; featured items 3× as likely; the item tiers by biome (75/25, then 15/75/10, then 50/50); the plain Quality curve; 2 bundles of 3 for 4 caps; Rocco's Random Resale bundles are resource packs half the time.
  - **Prices:** the Quality multipliers (×0.5 to ×1.5); a resource sells for 1 cap (two at ×½ make 1 cap); the Cement Mixer and Scout Report cost 6 each; the Taxi Service is always there, so the random special comes from the others.
  - **The Taxi Service:** 15 caps, at most 2 per run; the hiker comes back with 2 injuries, 3 in each stat and an empty pack.
  - **Rocco's Boutique:** an item paid to a challenge counts as lost. Selling, dropping, giving and trading don't.
  - **Selling:** Fancy Attire and the Wallet don't add to sales, because selling one at a time would multiply them.
  - **The Merchant and Trader:** a Merchant card is an item, a bundle or a blueprint at 2 : 1 : 1. A Trader wants a tool, clothes or food, and offers a tool, clothes, food or shelter. Both roll their wares the first time a hiker stands there. The Merchant's line is placeholder text.
  - **Placeholders:** the shopkeepers' lines and the "What's ahead?" biome chips.
- **Waiting on later phases:**
  - Phase 10 (`TODO(phase 10)`): the trinkets that touch traits, slots and XP (unchanged from Phase 8).
  - Phase 11 (`TODO(phase 11)`): each biome's own weather odds.
  - Phase 13: scoring. `state.arrivals` records each hiker's arrival (section, injuries, carried) for it.
  - Still held: Sit by the Fire, so Frozen Fingers stays off and Bear Country only watches crafting.
- **Saves:** version 13. Version 11 adds checking in and the station (optional fields, so nothing to migrate). Version 12 stocks a station opened by a version 11 save. Version 13 rolls the wares of a Merchant or Trader the party already reached.

---

## Phase 9.5: Smoother play

(New in the Nov 14 update, `docs/UPDATE-2026-11-14-phase-9.5.md`, which has the details.) Build it before Phase 10, and use its drag patterns in every later phase.

**Goal:** the same game, faster and lighter to play, with simpler Appetite and Abundance rules.

**Build**
- **Writing style:** the player-facing text rules are in `CLAUDE.md`. Follow them from Phase 10 on.
- **Appetite:** hikers no longer lose Appetite overnight. It only goes down from actions: moving, scavenging, Tend, and the extra costs of night moves and Move All. Tend costs 1 Appetite instead of 1 Energy. Food stays as it is for now. Never Hungry and Rabbit Diet wait for Phase 10.
- **Abundance: one bar for the whole biome**, in place of the four node meters:
  - 0 to 20, starting at 15 in each biome and recovering +1 each night;
  - every scavenge lowers it, and ×2, ×3, Pair and Trio cards and bonus resources a hiker chooses to take lower it more;
  - Tend (day only, +2), returning a resource, Fertilizer and some rewards raise it;
  - its one effect: each resource card dealt may come up **Empty** (5% at full, rising evenly to 40% at 0). Caps and item cards are never empty. The old low-Abundance effects go;
  - one meter at the top, green → yellow → red, with the empty-card chance in its tooltip;
  - old saves average their four meters into the bar;
  - the content that named a node's Abundance (Fertilizer, challenges, the opportunity, Crater Lake, the Thumbs, Conservationist) uses the one bar.
- **The station forest drifts:** the layers outside the windows slide slowly left and loop, far ones slower than near ones. They hold still under reduced motion.
- **Drag to do things:** one shared drag system (pointer events, so mouse and touch). Valid drop places glow and the rest dims; dropping anywhere else or Esc cancels; the click buttons stay.
  - **Moving:** drag a hiker's token. An arrow follows, reachable tiles glow with the line's cost, and dropping opens a pop-up with **Move** and **Move all** (a checklist of the hikers on the tile who can come, then **Go**).
  - **Items:** drag clothes onto a slot to equip; drag an item or resource onto another hiker's portrait to give it; drag a tool onto its target tile (or onto the map); drag food onto a portrait to eat it; drag a shelter onto its tile.
  - **Station:** drag to the sell slot to sell; drag a shop card onto a pack to buy it (with a confirm); drag resources and items into the Workbench.
- **Scavenging without the pop-up:** the kept card slides into the hiker's pack with a small "+1 Fur" that floats up. A new **item card** result shows the real item, Quality rolled, as rare as a random item find of the same type.
- **Card previews:** click (long-press on a phone, or hover a moment on a desktop) any card or item name to see the full card. Unrolled Quality shows as ranges ("2–4 bites"). One shared preview, used everywhere.
- **Multi-select:** Shift- or Ctrl-click hikers (a Select toggle on a phone). The order picked is the turn order, shown as numbered badges. Then one action, and each selected hiker does it on their own in turn: moving separately (the first faces the tile's challenge alone), scavenging one window after another, Tend, Sleep, Keep Watch. A hiker who can't is skipped with a short note; hikers who can't reach the tile pick their own. Esc or tapping empty map clears it.

**Done when:** the update's tests pass: Appetite, the Abundance bar and empty cards, drag targets, Move all from the pop-up, multi-select order, item cards keeping their Quality, and preview ranges.

**Phase 9.5 notes (built Nov 14)**
- **Wyatt's answers:**
  - Nothing blocked the build, so most readings below are first guesses, marked `TODO(wyatt)`.
  - Nov 14, after playtesting:
    - Move All can bring any hiker who hasn't acted, even one too hungry or tired to move themselves.
    - Each point of the scavenger's Luck lowers the Empty chance by a tenth of itself, and low Luck raises it the same way.
    - A failed challenge whose penalty is left to chance (Freeagle) shows what was lost, or that nothing was.
    - **Submit to injury**, next to Abandon the hike, gives a stuck hiker an injury, which raises their low stats as any injury does. First guesses: it's a free action; it waits while a challenge or scavenge is open; a Star or Hardhat doesn't stop it (`src/engine/actions/injure.ts`).
- **Where things are:**
  - **Abundance:** `src/engine/abundance.ts` (the bar, its changes, the empty chance and the overnight recovery). Numbers in `BALANCE.abundance`. Drains in `src/engine/actions/scavenge.ts`; Empty cards rolled in `src/engine/scavenge/deal.ts`. On screen: `src/ui/panels/AbundanceBar.tsx`.
  - **Item cards:** `toolCard`, `foodCard`, `clothesCard`, `shelterCard` and `trinketCard` in `src/content/scavengeCards.ts`. The item and its Quality are rolled when the card is dealt.
  - **Previews:** `src/ui/preview/`. `usePreview` gives any element the handlers; `PreviewLayer` draws the card; `ItemText` turns item names in text into previews. Ranges for unrolled Quality: `itemRangeText` in `src/engine/items/text.ts`.
  - **Dragging:** `src/ui/drag/`. `drag.ts` has `useDrag` and `useDrop`; `DragLayer` runs drags and draws the ghost; `dropRules.ts` decides which drops are valid (pure, tested); `itemDrops.ts` wires pack things to their targets.
  - **Scavenging without the pop-up:** `src/ui/scavenge/TakeFly.tsx` (the slide and the floating label); `tookWords.ts` (the label's words).
  - **Multi-select:** `src/ui/game/groupTurn.ts` (pure, tested) plans the group's turn; `GameScreen` runs it a step at a time. The badges and the Select toggle are in `src/ui/panels/GroupBits.tsx`.
  - **The station forest:** the `.drift` layers in `src/ui/station/StationScreen.module.css`.
  - **Debug:** the backtick panel sets the Abundance bar and can add any card type, item cards included, to the next deal.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - **Abundance numbers:** 0 to 20, starting at 15, +1 a night, Tend +2, and Empty cards from 5% at full to 40% at 0.
  - **Rules:**
    - Tend still needs a resource node on the tile.
    - A Mixed card drains once.
    - Keeping an Empty card still drains and still costs the scavenge.
  - **Item cards:** each type has weight 1 in the scavenge odds, as rare as a random find of that type.
  - **Timings:** previews open after a 400 ms hover; the forest's far layer takes 180 s per loop and the near one 70 s; a group's hikers act 350 ms apart.
  - **Dragging:**
    - Food on someone else's portrait asks **Give** or **Eat it**.
    - A tool with no tile to pick, dropped on the map, opens its menu.
    - Items dragged onto the Workbench do nothing yet.
  - **Previews:** where a click already acts (flipping or picking a card, a pack item's menu, buying), only hover and long-press open the preview.
  - **Multi-select:**
    - A shared action can be pressed when any of the group can take it; the others are skipped with a note.
    - Move All and Craft stay one hiker's.
  - **Placeholders:** the Empty card face and the Merchant's line.
- **Waiting on later phases:** Never Hungry and Rabbit Diet (Phase 10).
- **Saves:** version 14. Older saves average their four node meters into the one bar (scaled from 0–10 to 0–20).

---

## Phase 10a: Every trait, with test hikers

(New in the Nov 20 update, `docs/UPDATE-2026-11-20-phase-10a.md`, which has the details.) Phase 10 is split in two. 10a builds the whole trait system and tests it with placeholder hikers that have no art. 10b adds the real characters and the screens around them.

**Goal:** every trait works, hikers level up and pick new traits, and the player can see at a glance which traits are about to help or hurt.

**Build**
- **Every trait** in `02-traits-and-conditions.md` and every trait marked New in `07-characters.md`:
  - the Trail, Utility, Morale, family, special and unique tables;
  - the new traits from the character doc (Wanderer, Forgetful, Snores, Alpha Dog, Lanky, Good Boy, Spoiled, Fluff Armor, Mentor, Storyteller, Hype Dog, Shifty, Night Shifty, Lucky Charm, Cuddle Buddy, Rule Changer, Strong Walker, Just Around the Next Corner, Tank Butt, Linguist, Coach, Comedian, Easy Mode, Garbage Gut, the Boss & Gracie Tag Team, and the new Morale traits);
  - Wyatt's Nov 20 changes: Caring (once Empath), Closer (the old Tank Butt), Nosework (once Niche Hunter), Soccer Mom (once Team Player), Backtracker and Teacher as Tier I, usable Trespasser, Alchemist and Thrifty;
  - family names: Leash Puller (Puller), Human Food (Glutton), Copydog (Copier);
  - trait data in `src/content/traits.ts`: id, name, type, tier, kind and owner, classes, `active`, `uses` and their reset, and an effect through the shared hooks, never through name checks;
  - traits with a setting ([Node] Finder, Hound, the Thumbs and Pockets, Location, Action, Traveler, Conservationist, Allergies) store it on the hiker;
  - Quirky, Zany, Nosework and Moody re-roll each morning.
- **Classes:** Tank, Hardy, Scavenger, Crafter, Scout, Support, Jack, Entertainer and Moneymaker. Trail and Utility traits are tagged with theirs; Strong and Backtracker are general; Morale traits are open to all but Misophonia, Rain Lover, Moody and Show Girl.
- **Slots:** T, U, M, T/U, T/M, U/M and W; 2 to 6 per hiker; no trait twice; special and unique traits take a slot.
- **XP and levels:** every source in the design doc, with the row rule. Level-ups wait for the camp step (Wyatt, Nov 20).
- **Level-up offers:**
  - level N (1–3) offers 3 Tier N traits, from the hiker's classes, Jack and general traits, with [1] from any class;
  - only types the hiker's slots can hold; Morale traits rarer;
  - from level 4, one more option per level, all Tier III, up to 6;
  - sometimes a new slot instead (T and U common, mixed rarer, W rarest), never past 6;
  - only the family version that matches; special and unique traits only to their owners;
  - a trait with no open slot that fits replaces one the player picks.
  - The level-up screen is a bare-bones placeholder.
- **Trinkets** left from Phase 8: the three Photos, Instruction Manual, Diploma, Postcard and Textbook.
- **Families:** Human, Dog and Cat built-ins, family traits and items, and the new **Plush** family (Stuffing in place of Energy and Appetite; Carried; not counted as Dogs). **Duos:** one card for two characters, with a Tag Team trait that switches on odd and even days.
- **Trait badges** (`docs/mockups/TraitBadges.dc.html`): a diamond for always-on traits, a circle for usable ones; ring in the type's color, a darker middle, a white icon from `public/assets/traits/<trait-id>.png` (placeholder until Wyatt's icons arrive). Usable states: ready (slow glow, uses as dots), used up (grey), only during something (a tab naming when). A row of badges in the hiker panel with a hover window (name, type, what it does, its status now); names under the icons in Informative mode; empty slots as faint outlines. The Abilities panel lists usable traits with **USE**.
- **Trait warnings** (☰ menu: Off, Simple, Informative; default Simple):
  - forecasts for start-of-day Morale traits (if everyone stays put), for Morale traits that react to the action being hovered or dragged, and "working now or not" for other traits with a condition;
  - Simple: on the badge (green or red middle with a +N or −N bubble; dimmed when not working);
  - Informative: also a "! −N" tag on the portrait, a check before an action that would cost a hiker Morale (with "Don't ask again this run"), and one check before ending the day;
  - one engine dry run of the trait hooks feeds them all.
- **Test hikers** (dev only, no art: a colored circle with initials): Test Tank, Hardy, Scavenger, Crafter, Scout, Support, Moneymaker, Cat, Plush, Duo and Wild, each exercising a group of traits. They never appear in the real roster.
- **Debug panel:** add or remove any trait (with its setting), add slots, set level and XP, trigger a level-up at a chosen tier, refill uses, set the day odd or even, force a daily trait's pick, and switch Trait warnings.

**Done when:** every trait has a test of its effect; uses reset on schedule; level-up offers respect slot types, classes, the any-class option, family versions and owners, keep Morale rarer and never offer a 7th slot; Plush's Stuffing and Carried, and the Tag Team switch, are tested; forecasts match what happens at the next start of day.

**Asked and answered (Nov 20)**
- The level-up screen opens at the next camp step, not mid-phase.
- Levels need 20, 50, 90, 140, 200 and 270 XP in total (each level 10 more than the last); hikers start at level 0.

**Phase 10a notes (built Nov 20)**
- **Wyatt's answers (Nov 20):**
  - Level-ups wait for the next camp step; hikers start at level 0, and levels need 20, 50, 90, 140, 200 and 270 XP.
  - Everything else he left open is a first guess, marked `TODO(wyatt)` and listed below.
- **Where things are:**
  - **Traits as data:** `src/content/traits/` (`trail.ts`, `utility.ts`, `morale.ts`, `family.ts`, `special.ts`; helpers in `build.ts` and `moraleKit.ts`; daily picks in `daily.ts`). Classes: `src/content/classes.ts`. Test hikers: `src/content/testHikers.ts`.
  - **The hooks:** `src/engine/effects.ts` (`TraitDef`, `Hooks`, `workingTrait`, `abilitiesFor`). Every trait's effect is a hook; the engine never checks a trait by name.
  - **Slots, level-ups and trinket picks:** `src/engine/traits/slots.ts` and `levelUp.ts`. Daily traits: `src/engine/traits/daily.ts`. Prepared, Tactical and Scout: `reveal.ts`.
  - **XP:** `src/engine/xp.ts` (`gainXp`, the row rule, the level lines).
  - **Trait warnings:** the forecast is `src/engine/traits/forecast.ts`; the setting is `src/ui/app/traitWarnings.ts`; the screen's view is `src/ui/traits/forecastView.ts`.
  - **On screen:** badges, their hover window and the portrait tag in `src/ui/traits/`; the level-up window was a placeholder until 10b replaced it with `src/ui/levelUp/`; the Abilities panel is in `src/ui/panels/TurnPanel.tsx`.
  - **Plush:** `src/content/families.ts`, `src/engine/stats.ts` (Stuffing kept in both stats) and `src/engine/thresholds.ts` (its limits).
  - **Debug (backtick):** test hikers on the title screen; add or remove any trait with its setting; add slots; refill uses; odd or even day; force a daily pick; set XP and level; level up now at a chosen tier; switch Trait warnings.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - **Classes and picks:**
    - Follower is a Jack trait.
    - Quirky and Zany skip traits that need a setting or change daily.
    - The four Phase 3 hikers got placeholder classes.
  - **Trail:**
    - Puller pays a flat 1 Energy in place of all its Appetite for a Move All.
    - A tile a Trespasser lands on alone never triggers its card.
    - Shared conditions (Susceptible, Transparent) bring their effects, not their stat changes.
    - A condition shortened to 0 counts as running out.
  - **Utility:**
    - Squirrely makes caps cards twice as likely.
    - Lead Stomach and Destroyer spend the resources the hiker has most of.
    - Therapist takes 3 phases off a phase-based condition.
    - Talented adds 1 to the item's main number.
  - **Morale:**
    - Center of Attention does nothing alone, and a tie counts as the highest.
    - Show Girl counts her own gains.
    - Soccer Mom counts a party challenge once.
    - Fair-Weather treats a storm as rain.
  - **Special and new traits:**
    - Boss's days are odd, Gracie's even.
    - Loud gives Ringing Ears to the others on its tile for a phase.
    - Good Boy gives Motivated for the phase; Coach's Motivated lasts a day.
    - Alpha Dog takes a challenge's harm once.
    - Easy Mode takes 1 off each thing a cost asks for.
    - Nugget Puker doesn't trigger on Puked Nuggets.
    - Rule Changer only works on a tile whose card is shown.
  - **Numbers:**
    - the brackets in `07-characters.md`: Plush 12, 7 and 3; Forgetful, Snores and Fluff Armor 50%; Lanky 25%; Mentor 1; Storyteller 2; Just Around the Next Corner 75% and 25%; Easy Mode 1;
    - MBA: 3 caps × the new level.
  - **XP and levels:**
    - Past level 6, each level keeps needing 10 more than the last.
    - XP passed on by Wise or a VR Headset gets no bonuses and isn't passed on again.
    - The Textbook's +1 follows the row rule.
    - Two of the same Keep trinket count once.
    - Party objectives will give 10 × their tier (Phase 13).
  - **Level-up offers:**
    - 1 option can come from any class.
    - Each option picks its type first (Trail and Utility 1 each, Morale ½), then a trait of that type.
    - A new slot is 1 option in 8 (T and U 4 each, mixed 2 each, W 1).
  - **Trinkets:**
    - Diploma: 60–100% of a level's XP.
    - Postcard: +5 XP at a checkpoint, +1 per challenge passed.
    - Cherished Photo: any tier, any class.
    - Family Photo: copied from any hiker still on the hike.
    - Old Photo: from any class, and never a special or unique trait.
    - Instruction Manual: its mixed slots are T/U, T/M and U/M.
  - **Trait warnings:**
    - "Don't ask again this run" lasts for this hike's seed, on this device.
    - Group turns run through without stopping for checks.
    - The badges follow a drag, the move pop-up and a waiting Sleep, Keep Watch or Tend, but not just pointing at an action button.
- **Waiting on later phases:**
  - **Sit by the Fire is still held:** its XP, Singer, Chatty's fire part, Storyteller and Comedian are built and tested but nothing calls them yet.
  - **Party objectives' XP:** Phase 13.
  - **The Ring:** still waits on which family, and for how long.
  - **10b:** the trait icons (see `docs/ASSETS.md`), the real characters, and the real level-up and hiker selection screens.
  - **Phone:** at phone size the whole stage shrinks to about a third, so a badge is about 11 screen pixels; worth making badges bigger when Phase 17 (or 12) looks at touch sizes.
- **Saves:** version 16. A v14 save gets classes and its Finder and Hound node settings (v15); then levels start at 0 and XP already earned becomes level-ups waiting for the next camp (v16).

---

## Phase 10b: The real characters, and their screens

(New in the Nov 20 updates: `docs/UPDATE-2026-11-20-phase-10b.md`, then `-icons`, `-polish` and `-family`. Each later one wins where they disagree, so the family update has the last word.)

**Goal:** the real roster plays. Every hiker has a card, the player picks a party of 1 to 4 on the selection screen, and level-ups get their real screen.

**Build**
- **Placeholder text:** player-facing text that says "Wyatt will write" (or the same idea worded differently) becomes exactly `Placeholder text`, in game data, UI strings and the docs. `TODO(wyatt)` code comments stay.
- **The real roster** (`07-characters.md`): every character and variant, all unlocked. The 10a test hikers stay, dev-only.
  - **Data per hiker:** `id`, `name`, `title`, `family`, roles (classes in code, **roles** on screen, main first), slots, traits, starting bag, portrait (or none), `starter` (the 10 starters), `variantOf`, a hidden `difficulty`, and `households` (the Family sort).
  - **Since 10a:** **Catie**, not Katie. **Mitchell** has slots U, U, M, M, and his second Morale trait is **Cat Person**.
  - **Titles** go under the name, in capitals and quotes (the table in `07-characters.md`). Ben, Mindy and the variants have none yet: no title line, no empty quotes.
  - **Starting bags** are handed out when a run starts. A starting blueprint is learned and takes no item slot; starting items roll Quality as usual. The 4 random starting resources stay.
  - **No cloning:** a variant can't join if that hiker, or another of their variants, is already in the party.
- **Art:**
  - **Trait icons:** `public/assets/traits/<name>.png`, the trait's name in lowercase with dashes (`dog-mom`, `just-around-the-next-corner`). Every trait has one now; the placeholder stays only for traits added later without a file.
    - Shared files: Puller and Leash Puller use `puller`, Glutton and Human Food `glutton`; every [Node] Finder `node-finder`, Hound `node-hound` and Thumb `node-thumb`; every Location `location`, Action `action` and Conservationist `conservationist`.
    - The Trail Thrill-Seeker uses `thrill-seeker`, the Morale one `thrill-seeker-morale`; Boss & Gracie's Tag Team uses `tag-team`.
  - **Icon color:** drawn through a CSS mask in the type's **ring color** (Trail `#F2B950`, Utility `#9CC3A8`, Morale `#CDA6EE`, used up `#6F6A60`) on the badge's darker middle, everywhere a badge appears. The card back is the exception: the icon in the type's **middle** color on a ring-colored square.
  - **Icon size:** the icon fills the shape and is clipped to it: a diamond holds it at its full side, a circle at 85% of its width. On a 300-wide card: diamond 35 px with a 34 px icon, circle 42 px with a 36 px icon, in a 50 px box per badge. The 10a hiker panel badges follow the same rule.
  - **Portraits:** each PNG is already framed for the card's 750 × 620 portrait window. Draw it at the full window size from the top-left; never crop, scale or move one by one. `portraits.json` gives each one's `faceY` (0 top, 1 bottom) for wherever only part shows. Behind it: `forest.png` covering the window, then `pixel-pattern.png` at 20%.
  - **No portrait yet:** Ben and Mindy show their family icon, and variants without art the star, a third of the window wide, at 30% opacity, in `#1A1A1A`.
  - **Family icons:** `public/assets/cards/family/<human|dog|cat|plush|duo|variant>.png`, white, drawn in `#1A1A1A` through a mask. Variant cards show the star (22 px) just right of their family icon.
- **The hiker card** (one shared component; `mockups/HikerCards.png`; sizes for a 300 × 420 card, everything scales together; Edit Undo except trait-window and back text):
  - **Front:**
    - the portrait window (top 250), with the family icon top left (26 px, 11 px in);
    - the white name band (52): the NAME about 28 px (line-height 0.9) with the "TITLE" right under it, no gap, about 18 px in `#5E5E5E` (line-height 0.95); long names and titles shrink to fit;
    - the role banner (17): the role in white capitals on its color; two roles get equal split tabs, main on the left;
    - the trait area (`#2C2C2C`): the badges in one row, each named in tiny capitals in its ring color; an open slot is a faint dashed diamond labeled OPEN; hover (or long-press) opens the 10a trait window;
    - a STARTING BAG tab, bottom center, in the main role's color, whose hover shows the bag.
  - **Role colors:** Tank `#DC3B44`, Hardy `#E27A2B`, Scavenger `#93A33A`, Crafter `#3A7752`, Scout `#3E8FC9`, Support `#F0AB35`, Jack `#5F7487`, Entertainer `#D675EF`, Moneymaker `#1FA39A`.
  - **Back:**
    - the portrait strip (84), shifted so the face (`faceY`) sits in its middle;
    - the name band (34), name only, and the role banner;
    - one row per trait from 142: the icon square (icon at 90%, round square for usable traits), a ring-colored strip with the name (and a USABLE tag), and the short description in white on the middle color; an open slot is a grey row, "OPEN SLOT · Filled on a level-up.";
    - the starting bag in a brown bar (`#895637`) at the bottom.
  - **Flipping:** a click flips it [0.35 s] (under reduced motion the sides just swap). Hovering a flipped card lifts it to the middle, larger [1.2×]. On a phone, long-press a flipped card to open it large and tap anywhere to close. Drags work from either side, after a [6 px] movement so a click never starts one.
- **The hiker selection screen** (the screen for a new run; `mockups/HikerSelect.png`, `HikerSort.png` and `SortRibbons.png`):
  - **Top:** CHOOSE YOUR HIKERS and the line "Drag a card into a spot. Click a card to flip it, and hover a flipped card to lift it to the middle. Start with 1 to 4 hikers."; **RANDOM** fills the empty spots (no cloning); **START HIKE · N HIKERS** works with 1 to 4 and is disabled at 0.
  - **4 spots** in the hiker colors (1 orange, 2 blue, 3 yellow, 4 purple) with a HIKER N tab; spot order is the run's hiker order.
    - Empty: a dashed outline, a plus and "DRAG A HIKER HERE".
    - Filled (360 × 350): the portrait, 204 tall, cropped by `faceY`, with a BAG chip and an × to remove; the white band (52) with the name (26 px) and the title under it (16 px); the role banner; the badges with names from 278, with their windows on hover.
  - **Dragging** (the shared 9.5 drag system): every spot glows and the hovered one says DROP TO ADD. Dropping on a filled spot swaps (the old hiker goes back to the list); spot to spot swaps; out of a spot and anywhere else removes. Enter or a double-click adds a card to the first empty spot.
  - **The list:**
    - filter chips ALL, HUMANS, DOGS, CATS, PLUSH, VARIANTS;
    - cards in the party dim, with an IN PARTY tag in their spot's color; blocked variants dim too, tagged with who's in ("FINN IS IN");
    - the card being dragged leaves a dashed outline.
  - **Sorting:** a SORT control on the right of the filter row: **DEFAULT, FAMILY, CLASS, TRAITS, DIFFICULTY**, remembered in settings. Filters and sorts combine.
    - **Default:** the 10 starters in roster order, then everyone else by name. No ribbons.
    - **The others** split the list into groups, each under a full-width ribbon: a colored bar with notched ends, the group name in white capitals on the left and a small count ("13 HIKERS").
    - **Family** (called `household` in the data, a `households` list per hiker, since "family" already means Human, Dog, Cat or Plush):

      | Ribbon | Color | Hikers, in this order |
      | --- | --- | --- |
      | ELMERS | `#B5543A` | Wyatt, Mom, Ellie, Finn, Cody, Duke, Scarlet, Hershal, Sinjon, Brutus |
      | BROOKS | `#3D7EA6` | Mom, Gdog, Grandpa Wink, Pepper, Melissa, Muffin, Coco |
      | SHERMAN | `#D08A2E` | Grandpa Sherman, Pearl, Kai, Catie, Mitchell, Nathan, Madeline |
      | LEICHTY | `#4E8F5A` | Erin, Jackson, Anni, Boss & Gracie |
      | OTHER | `#6B6F78` | Everyone else, by name (Ben, Mindy, Leah, Loki, Goldie) |

      - A hiker in two families shows in both (Mom, in Elmers and Brooks). Both copies are the same hiker: either can be dragged, both dim when she's in the party.
      - ~~Variants go right after their base hiker.~~ Replaced by the holiday update (below): every variant goes in OTHER unless it's given a family, and the holiday hikers get their own HOLIDAY ribbon.
    - **Class:** by main role only, in the role order above, ribbon in the role's color.
    - **Traits:** by how many traits a hiker starts with (open slots don't count): 3 TRAITS `#5C7FA3`, 4 TRAITS `#3F5C82`, any other count `#2E4766`.
    - **Difficulty:** EASY 1–3 `#4E9A5F`, MEDIUM 4–5 `#C9A227`, HARD 6–7 `#D9642E`, EXPERT 8–10 `#B23A48`.
    - **Inside a group:** by name; by rating then name for Difficulty; the table's order for Family.
  - **Animated background** (only this screen): `src/shaders/hiker-select-bg.frag`, a WebGL2 fragment shader on a full-screen canvas behind everything, drawn with one full-screen triangle, with `#version 300 es`, `precision highp float;` and `out vec4 outColor;` prepended.
    - Uniforms: `uTime` (seconds since the screen opened), `uResolution`, `uMouse` (0–1, y up, smoothed; drifting in a slow loop when the pointer is away), `uDeep` `#0C1411`, `uMoss` `#1D3129`, `uMist` `#476055`, `uGlow` `#E9B44C`, `uSwirl` [1.2], `uPixels` [150], `uPull` [0.5].
    - At most 1.5× device pixels; paused when the screen or tab is hidden; one still frame under reduced motion; a plain `#0C1411` without WebGL2.
- **Hidden difficulty:** each hiker's 1–10 rating from the "Difficulty (hidden)" table. Never shown in the game; players only see the Difficulty sort's ribbons. A dev-only debug toggle shows the number in each card's corner.
- **The level-up screen** (`mockups/LevelUp.png`; replaces the 10a placeholder, at the moment 10a decided):
  - No window: a backdrop blur [10 px] and a navy overlay `rgba(12, 20, 46, 0.82)`, with the content on top.
  - **Opening:** 0.0 s the blur and overlay fade in; 0.1 s the portrait pops in at the top middle (a circle ringed in the hiker's color, a soft glow, the name under it); 0.6 s the XP bar fills to full [1.2 s], "LEVEL N" left and "XP a / b" right; 1.8 s a "LEVEL N+1!" badge pops at its end; 2.0 s the options deal in [0.15 s apart] under "PICK A NEW TRAIT"; 2.5 s "YOUR TRAITS" slides up. A click skips to the end; under reduced motion it all just appears.
  - **Option cards** (240 × 280): a top strip in the ring color with the name; a big badge (diamond 58 px with a 58 px icon, circle 72 px with a 62 px icon) on the type's middle color; the type ("TRAIL · USABLE"); the description; and a tag naming where it came from, the **role** in its color or **WILD CARD · ANY CLASS**. From level 4 they shrink to fit up to 6 in a row. A new slot is a card too ("NEW SLOT · TRAIL"), dropped on a "+" spot at the end of the trait row.
  - **Your traits:** one tile per slot: the slot type on top (TRAIL, UTILITY, TRAIL OR UTILITY, MORALE…), the badge at 1.4×, the name and a status chip.
  - **Picking:** drag an option onto a slot. While dragging, tiles it fits glow gold (a filled one says REPLACE, an open one EMPTY · DROP HERE) and the rest dim (CAN'T GO HERE). A dropped trait can still be moved. Replacing removes the old trait for good. **CONFIRM** lights up once something is placed; **KEEP MY TRAITS** takes nothing and closes. Click fallback: an option, then a slot. Several hikers leveling at once get their screens one after another.

**Tests**
- **Roster:** every hiker in `07-characters.md` exists with the right slots, traits, roles, title, starting bag and households; Mitchell has Cat Person; starting bags are handed out at the start of a run.
- **No cloning:** a variant can't join with its base hiker or another of their variants; RANDOM follows the rule.
- **Selection:** start works with 1, 2, 3 and 4 hikers, not 0; dropping on a filled spot swaps; the × removes a hiker.
- **Sorting:** each sort makes the right groups in the right order; Family's 5 groups, with Mom in both Elmers and Brooks and the variants after their base hiker; DEFAULT has no ribbons; the difficulty number never shows (debug toggle off).
- **Level-up:** only fitting slots accept a trait; replacing removes the old trait; KEEP MY TRAITS changes nothing; a new-slot option adds a slot; queued level-ups come one after another.
- **Placeholder text:** none still says "Wyatt will write".
- **Assets:** every trait has an icon file, every family has an icon file, and every portrait has a `portraits.json` entry.
- **Icon color:** every badge icon uses its type's ring color, and the used-up color when used up.
- **Background:** the shader compiles; under reduced motion it draws once; the fallback color shows without WebGL2.

**Done when:** a run starts from the selection screen with 1 to 4 real hikers and their starting bags, every hiker card and sort matches the mockups, level-ups use the new screen, and the tests above pass.

**Phase 10b notes (built Nov 20)**
- **Where things are:**
  - **The roster:** `src/content/roster.ts` (every hiker and variant, `HOUSEHOLDS`, no cloning); role colors in `src/content/classes.ts`; party colors by spot in `src/content/partyColors.ts`. Starting bags are handed out in `src/engine/newGame.ts`.
  - **Art:** trait icons through `src/ui/traits/traitIcons.ts`; portraits, the forest background and family icons through `src/ui/hikers/portraitArt.ts` and `HikerPortrait.tsx`.
  - **The hiker card:** `src/ui/hikers/HikerCard.tsx` (its data in `cardData.ts`; shrink-to-fit text in `fitText.ts`). A dev gallery at `#mockup-hiker-cards`.
  - **The selection screen:** `src/ui/select/` (`HikerSelect.tsx`; the party rules in `selection.ts`; filters and sorts in `sorting.ts`; the background in `background/`). The shader is `src/shaders/hiker-select-bg.frag`.
  - **The level-up screen:** `src/ui/levelUp/` (`LevelUpScreen.tsx`; what it shows in `levelUpView.ts`). Old Photo uses it too.
  - **Remembered on the device:** the sort (`src/ui/app/deviceSetting.ts` makes any such setting).
  - **Debug (backtick):** on the selection screen, a small panel shows each card's hidden difficulty. In a hike, "Level up now" (Traits) opens the level-up screen.
- **Choices made while building (not in the mockups):**
  - The selection screen has a **BACK** button to the title, so a misclick on New Hike doesn't strand anyone.
  - A filled spot says **DROP TO SWAP** while a card is over it; dragging a hiker out of the spots shows **DROP TO REMOVE**.
  - The FAMILY sort button sits second (DEFAULT, FAMILY, CLASS, TRAITS, DIFFICULTY); `HikerSort.png` was drawn before it existed.
  - The swirling background fills the whole window, letterbox included.
  - **Level-up:** KEEP MY TRAITS asks first (it can't be undone). A trait placed on a filled slot says "Replaces …" in red before CONFIRM. A placed card can be taken back from its spot in the row ("PLACED · TAKE BACK"). The + spot only shows when a NEW SLOT is offered.
  - **Option tags** are worked out from the trait and the hiker's roles, not stored: a role the hiker has, JACK, or WILD CARD · ANY CLASS. Morale, general, special and unique traits have no tag.
  - **Old Photo** keeps its old rule: one of its 3 traits must be taken (no KEEP MY TRAITS).
  - **Phones:** in the hiker list a vertical swipe scrolls; a card is picked up by moving sideways first, or added with a double-tap. Spots and the level-up cards drag in any direction.
- **First guesses while building** (`TODO(wyatt)` in the code):
  - **Roster:** Ellie the Devourer's Glutton is the Dog version, Human Food. Prepared Wink's Traveler is set to Tend (the doc gives no action). The debug panel's "new game" starts with the first four starters.
  - **Party colors follow the spot** (1 orange, 2 blue, 3 yellow, 4 purple). RANDOM uses the browser's random (it's the screen, not the run).
  - **KEEP MY TRAITS** still counts the level, so MBA and Proud Mentor still fire.
  - **The bracketed numbers:** a card flips in 0.35 s and lifts to 1.2×; the background's swirl 1.2, pixels 150 and pull 0.5, with a 40 s drift loop a quarter of the screen out; the level-up's blur 10 px, bar fill 1.2 s and cards dealt 0.15 s apart. All in `src/config/balance.ts` (`ui`).
- **Not done yet:**
  - **Art:** portraits for Ben and Mindy (they show their family icon). The holiday update sent the variants' portraits.
  - **Phones:** at phone size the stage shrinks to about a third, so card text is very small; worth a look when Phase 12 or 17 sizes things for touch. The drag gestures were tested with simulated touches, not on a real phone.
  - **Old Photo's screen** was checked by its tests, not in the browser (the debug panel can't open one).
- **Saves:** version 17. A v16 save's hikers get their party colors. Wyatt's v14 save still loads.

---

## Holiday hikers (Nov 20 update)

(New: `docs/UPDATE-2026-11-20-holiday-hikers-2.md`, built after Phase 10b. It replaced a first holiday zip that was never applied, so its "Changes since the first holiday zip" section didn't apply. Where it disagrees with the 10b family update, it wins.)

**Goal:** four Christmas variants who play together around a new item, the Present, plus real portraits for the variants and two renames.

**Build**
- **Variant art:** real portraits for Follower Finn, Agility Finn, Ellie the Devourer, Nosework Ellie, Prepared Wink, Graduate Mom and Showqueen Gdog, each with a `faceY`. The costume art fits the whole costume, so it isn't on the others' head scale: drawn as it is, never rescaled. The variant star next to the family icon stays. Ben and Mindy still show their family icon.
- **Renames:** Prepared Wink (`preparedWink`; his title is still "The Planner") and Showqueen Gdog (`showqueenGdog`; her Show Girl trait keeps its name), everywhere.
- **Presents** (`03-items.md`, "Presents"): a new item type, `present`.
  - Each one stores a `colorway` (1–5, at random when wrapped), `wrappedBy` (the hiker) and a `grade` (`plain`, `tier2plus` or `tier3`, from the recipe). No Tier and no Quality on the card; a Tier 2+ or Tier 3 one has a small tag where the tier numeral usually sits.
  - **Never in a random pool:** not from scavenging, shops (both Rocco shops and the used-or-lost log included), bundles, Mystery Items, night events, challenge and Wonder rewards, or starting resources. Only Grammy Clause and the starting bags make them.
  - **Opening:** the hiker's action and 1 Energy, from an **Open** button on the card or by dragging it onto their own portrait. Grammy can't. The tier comes from the grade, ignoring the biome's limit: plain Tier 1 [50%], 2 [35%], 3 [15%]; Tier 2+ Tier 2 [70%], 3 [30%]; Tier 3 always Tier 3. Then any item of that tier, each equally likely, never a Present, with Quality on the plain curve. It goes in the opener's pack. The box shakes, the lid pops and the item flips in (just a swap under reduced motion).
  - Stations won't buy them [first guess]; giving and trading work like any item.
- **The holiday hikers** (all unlocked; full kits in `07-characters.md`, "Holiday hikers"); no cloning with their base hiker:

  | Hiker | Title | Variant of | Roles | Slots | Traits | Starting bag | Difficulty |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Grammy Clause | The Festive | Gdog | Crafter, Support | U, U, U, M | Gift Wrapper, Down the Chimney, Checking It Twice, Season of Giving | 2 plain Presents | 6 |
  | Lelf | The Little Helper | Leah | Crafter, Support | T, U, U, M | Short, Toy Maker, Spare Parts, Holiday Spirit | 1 random Tier 1 tool blueprint | 4 |
  | Grinch | The Grumpy | Ellie | Scavenger, Jack | U, U, T/U, M | Choosy, Two Sizes Too Small, Wreck the Halls, Bah Humbug | 1 plain Present | 5 |
  | Redolf | The Rednose Retriever | Cody | Tank, Scout | T, U, U, M | Rednose, Treat Sniffer, Present Muncher, Holiday Spirit | Camping Lamp | 4 |

  - **The Grinch is a she:** she/her in every text about her.
  - **New traits** (no icon art yet: their badges show initials until Wyatt sends `gift-wrapper.png` and the rest):
    - **Gift Wrapper:** her crafting window shows only the four Present recipes, no blueprints, and she can't craft anything else or open Presents. 3 of one resource or 5 of one type (any mix) make a plain Present; her 3-resource wish list a Tier 2+ one; her 5-resource wish list a Tier 3 one. Both lists are rolled at the start of the run and again after every Present, saved with the run, with their icons on the recipes.
    - **Down the Chimney** (once a day, free): a Present from her pack to any hiker on the map with room. **Checking It Twice** (once a day, free): both wish lists again.
    - **Season of Giving** (Morale, open to all): +1 when anyone opens a Present she wrapped; −1 at the start of a day after she wrapped none.
    - **Toy Maker:** Tools [3×] as likely in Presents she opens. **Treat Sniffer:** Food [3×]. **Choosy:** 3 items, keep 1, shown side by side.
    - **Spare Parts** (free, any time): a Present for [2] resources of her choice. **Present Muncher** (free, any time): a Present for [0–5] Appetite. **Wreck the Halls** (free, any time): a Present for [3–8] Morale, with a burst of confetti. All capped at the maximum.
    - **Holiday Spirit** (Morale, open to all): +1 each time a hiker on their tile opens a Present; −1 at the start of a day after nobody in the party opened one. **Bah Humbug:** +1 each time she opens one; −1 each time another hiker on her tile Sits by the Fire.
    - **Two Sizes Too Small:** she can't give or trade items to other hikers (their portraits don't light up, and the give buttons say "The Grinch doesn't share."); receiving, using, dropping, selling and giving resources still work.
    - **Rednose:** when he moves the group at night, nobody pays the night's extra cost. Fog never hides the tiles next to him (a hook for Phase 11).
- **Family sort:** every variant goes in OTHER unless it's given a family; the holiday hikers get a **HOLIDAY** ribbon `#A8233A` between LEICHTY and OTHER (Grammy Clause, Lelf, Grinch, Redolf). The ribbons are ELMERS, BROOKS, SHERMAN, LEICHTY, HOLIDAY, OTHER. Wywee is a variant everywhere (the star, the VARIANTS filter, no cloning with Wyatt).
- **Debug panel:** give any hiker a Present with a chosen colorway and grade; roll Grammy's wish lists again, or set them by hand.

**Tests**
- Gift Wrapper: only Presents, each recipe's grade; 5 of one type takes any mix of that type and refuses a mix of types; both lists change after every Present and survive a save and load; she can't open Presents. Checking It Twice: both lists, once a day.
- Presents never come from a random pool. Opening costs the action and 1 Energy, uses the grade's odds whatever the biome; a Tier 2+ never holds Tier 1, a Tier 3 always Tier 3.
- Toy Maker and Treat Sniffer tilt the type; Choosy shows 3 and keeps the one picked; Two Sizes Too Small blocks giving and trading items, not receiving.
- Down the Chimney once a day; Spare Parts 2 chosen resources; Present Muncher 0–5 Appetite; Wreck the Halls 3–8 Morale, capped.
- Holiday Spirit, Season of Giving and Bah Humbug at the right moments; Rednose's group moves at night.
- No old name left; the Family sort's 6 groups; no cloning for each holiday hiker and for Wywee.

**Done when:** the four holiday hikers can be picked and played, Presents can be wrapped, sent, opened, taken apart, eaten and smashed, and the tests above pass.

**Holiday hikers notes (built Nov 20)**
- **Where things are:**
  - **Presents:** the item in `src/content/items/presents.ts` (kept out of `TABLE_ITEMS`, so out of every pool); the rules in `src/engine/items/presents.ts` (recipes, wish lists, what's inside) and `src/engine/actions/presents.ts` (`wrapPresent`, `openPresent`, `presentTake`). Rocco's log skips them in `noteGone`.
  - **Traits:** `src/content/traits/holiday.ts`, through new hooks (`wrapsPresents`, `presentWeights`, `presentChoices`, `onPresentOpened`, `keepsItems`, `leadsAtNight`, `clearsFog`, `onTileSitByFire`, `onRunStart`). Usable traits with no limit use `uses: Infinity`; Spare Parts' resources ride on the choice (`uid|wood,fish`).
  - **Screens:** Grammy's crafting window and the Workbench's Present recipes in `src/ui/presents/WrapWindow.tsx`; the opening, Choosy's pick and the smash in `src/ui/presents/PresentFx.tsx`; Open in the item menu (`StashMenu.tsx`); the resource picker in the Abilities panel (`TurnPanel.tsx`).
  - **Debug (backtick):** "Give Present" with a wrapping and grade; "Roll wish lists again", or the two lists set by hand.
- **Choices made while building:**
  - **Wrapping is crafting:** it uses the action (free at a station's Workbench), pays like a craft (her own resources first, then the others on the tile), and everything that hears of a craft does (Artist, Fluffy, Work Boots, Rocco's counts).
  - **Opening asks first** (from the menu or the portrait), since the Present is gone once it's open. Choosy's cards can be picked once they've flipped in.
  - **What's inside** is any item from the tables at that tier, never an event-only one (Puked Nuggets).
  - **Ids:** `preparedWink` and `showqueenGdog`, camelCase like every other roster id (the update wrote them with dashes; the portrait files use dashes).
  - **Pronouns:** the Grinch's traits and "The Grinch doesn't share." say she and her. Shared screens say "their" for every hiker (the gender-neutral rule).
  - **The −1 at the start of a day** (Season of Giving, Holiday Spirit) looks at the day before, so the first one can come at the start of Day 2.
  - A hiker given Gift Wrapper by the debug panel has no wish lists until "Roll wish lists again".
- **First guesses** (`TODO(wyatt)` in the code; numbers in `src/config/balance.ts`):
  - **The bracketed numbers:** plain Presents Tier 1/2/3 at 50/35/15%, Tier 2+ at 70/30%; Toy Maker and Treat Sniffer 3×; Spare Parts 2 resources; Wreck the Halls 3–8 Morale; Present Muncher 0–5 Appetite (`presents` and `traits`).
  - **Stations won't buy Presents** (`presents.sellable`).
  - **Crafting XP for a Present:** 1, as for a Tier 1 item.
  - **Starting Presents:** Grammy's own count as hers (Season of Giving); the Grinch's were wrapped by nobody in the party.
  - **The opening:** the box shakes 0.7 s, the lid pops in 0.35 s, the card flips like a Mystery Item (0.52 s), Choosy's cards 0.15 s apart; the smash lasts 0.9 s (`ui.presentOpen`).
- **Questions for Wyatt:**
  - **Prepared Wink's title:** the update says it stays "The Planner", but variants have no title line yet (10b), so his card shows none. Should it show "The Planner"?
  - **Two Sizes Too Small and the Traveling Trader:** she can't give or trade items to other hikers; trading with a Trader (not a hiker) still works. Right?
- **Not done yet:**
  - **Trait icons:** none of the 14 holiday traits has art yet; their badges show initials.
  - **Bah Humbug's −1** waits on Sit by the Fire, which is still held. **Rednose's Fog** waits on Phase 11 (`clearsFog`).
  - The opening was checked with real clicks; dragging a Present onto a portrait was checked by its tests, not by hand.
- **Saves:** version 18. In a v17 save, the two renamed hikers come back with their new ids and names (everywhere the id appears). Wyatt's v14 save still loads.

---

## Phase 10.5: Illustrated map (done)

(New in the Nov 21 update: `docs/UPDATE-2026-11-21-phase-10.5-illustrated-map.md`. **Build this next**, before Phase 11. The look is in `docs/mockups/illustrated-map/` (`MapTopDown.jpg` is the target; tile look **A, dark glass** in `MapTileLooks.jpg`; the land on its own in `look/`). The Python prototype in `docs/design/illustrated-map/reference/` has every number: read its README first, and port the ideas and numbers, not the code.)

**Goal:** a second look for the trail map, **Map style: Classic or Illustrated**. The land is painted around each section's trail tree like a colorful illustrated trail map; unexplored land is a pencil sketch that fills in with paint as tiles are revealed. Tiles become dark see-through hexes, paths wind and show who walked them, and places get Oregon names. **It changes only how the map looks**: tiles, connections, costs, triggers and every rule stay the same, and Classic keeps working as it does now.

Numbers in [brackets] are first guesses: in `balance.ts` (or `mapStyle.ts` beside it) with `TODO(wyatt)`. All numbers are in prototype units (rows 134 apart, hex radius 54): multiply by our row spacing ÷ 134.

**Build**
- **The setting** (section 2): Settings → **Map style**, Classic or Illustrated, saved per device. Default Illustrated [first guess]. It can be switched any time, mid-run included, keeping the camera; switching regenerates the land if needed. Everything below is Illustrated only unless it says otherwise.
- **Layout** (section 3):
  - **Jitter:** each tile moves up to ±[24] in x and ±[16] in y, and its size scales by [0.90–1.07]; the trailhead and checkpoint never move. Seeded, so a run always looks the same. Clicks, drags and hover use the moved positions.
  - **Spacing:** the land has to show between tiles (in the prototype, tiles take about 40% of a row). Spread rows and columns out rather than shrinking hexes below a comfortable click size.
  - **Winding paths:** `wind()` in `topo_layout.py`: a sideways push of `(a1·sin(π·t·bends + phase) + a2·sin(π·t·(2·bends + 1))) · sin(π·t)`, with `a1` [0.5–1]·amp and `a2` [0.2–0.6]·amp, amp [24] between rows and [16] within one, `bends` alternating 1 and 2. Only for looks.
- **Generating the land** (section 4; follow `topo.py`), from the section's tiles, nodes, connections and biome, all seeded:
  - **Fields** on a grid (1 cell per unit, half on phones): fbm noise at [260], [90] and [30]; mountain influence and sharper peaks (off to one side of the tile) from Mountain nodes; forest from Forest nodes; meadow from Wildlife nodes and the trailhead; extra ranges and woods off the tree so the edges aren't empty.
  - **Water:** the main river from the top edge to the bottom through every River tile in order, smoothed and wandering; a creek from the nearest side edge for a River tile far from it; a pond (offset to peek out) for each River ×2 tile.
  - **Height** rising toward the checkpoint, with mountains, peaks and noise, dipping along rivers. **Light:** hillshade from the top left, cut into 4 flat tones at the [12%, 42%, 84%] quantiles, smoothed to look painted.
  - **Land types:** rock where peaks are strong; forest where its field wins (never on rock, near water, or in a clearing under each tile); bank by water; meadow everywhere else, two meadow palettes in large patches. Tones from `palettes.json`; higher land tinted [10%] toward the haze.
  - **Contours** (about [26] levels, every 5th heavier, at [30%]); **details** (flowers and grass ticks, rock cracks, a sand edge, shallows, water and a deep center with a few short ripples); **tree crowns** on a jittered grid, lowest drawn last ([42%] conifers, the rest round, [16%] autumn in patches; shadow, base, highlight); **paper** grain, brush streaks, a warm wash top left and a cool shade bottom right.
  - **The pencil sketch**, a second image of the same land: paper and grain, graphite contours, rivers as two ink lines, about [28%] of the trees as little tree symbols, hatching in shadows and on rock.
  - **Size:** [300] units past the tree's bounding box on every side; plain paper beyond.
- **Stamps** (section 5): the placeholder PNGs in `public/assets/map/stamps/` (Wyatt's painted ones will replace them with the same names; skip a missing one), side-on with the base at the bottom center, each with a soft oval shadow, scattered into the painted land only: trees and bushes along forest edges [1 per 40 units]; a rock or peak on the strongest peaks; a cabin near the trailhead; a fire lookout beside each Overlook; a tent beside each Campsite; [1–2] deer in the largest meadow; a waterfall at the river's steepest drop if it's big enough [over 0.12 per 40 units]. Trees and peaks about [26] tall, small things [14]. Never in tile hexes or on paths.
- **Painted as you explore** (section 6): unrevealed land is the sketch, revealed land is painted. Revealed means any tile whose nodes are revealed by the existing rules, plus the trailhead area. Each revealed tile adds a soft disc of radius [150] fading over [70], its edge broken by noise; where the mask is about half, the paint darkens up to [16%] in a thin band (pigment pooling). A new reveal grows from 0 over [1.2 s] (ease-out), redrawing only what changed; several animate together; under reduced motion it just appears. On load the mask is rebuilt with no animation. Fog (Phase 11) hides nodes but doesn't un-paint.
- **Drawing the map** (section 7), three layers in the existing viewport with the same pan and zoom: the sketch canvas, the painted canvas through the reveal mask, and the overlay (paths, bridges, badges, tiles, tokens, labels).
  - **Paths** (`gen11.py` → `path_svg`): a cream track under each (`#F4EDDA` [42%], [8] wide). Unwalked are gray `#77736A`: normal dashed [10 on, 7 off] [3.6] wide; steep, muddy and rough dotted (round dots [8.5] apart) [5.6] wide with the cost badge; paved solid with a wider track and the FREE badge. Walked paths take the walker's party color, [15%] wider, with a thin outline (`#1D2220` [50%]): normal turns solid, dotted stays dotted, paved stays solid. **Bridges** where a path crosses water, rotated to it (not inside a hex; one for close crossings).
  - **Tiles, dark glass** (`gen11.py` → `tile_svg`): revealed, fill `#0F1A16` at [50%] ([36%] once visited), a cream edge `#F7F1E4` [2.2] wide and a faint inner line at 90%, the land showing through with no blur. Unrevealed, pencil: paper fill `#EEE5CB` at [45%], a dashed graphite edge `#5E5648`, pencil node chips with "?", the special icon in pencil colors. Node chips as small hexes along the bottom; the special icon in the middle until someone lands, then top right; hiker tokens as round portraits ringed in their party color.
  - **Labels:** Fraunces italic 600, about [14–17] px, with a cream halo (font added locally); water `#1F5E6E`, lookouts and peaks `#5A3F66`, woods and meadows `#2A4A3A`.
  - **Map furniture**, fixed to the screen and clear of the HUD: a small compass rose; a title box ("MEADOW", "SECTION I · TIER I · DAY 3") with a scale bar; a **Legend** button opening the line legend from `MapTopDown.jpg`.
- **Performance** (section 8): the land depends only on the seed, section index, biome and tiles; no images are saved, they're regenerated on load. In a Web Worker with `OffscreenCanvas` where available, else on the main thread behind a short "Drawing the map…" overlay. Canvas scale `min(devicePixelRatio, 2)`, 1 on phones. Budget under [1.5 s] on a laptop, shown in the debug panel. Keep the current section's canvases; drop the previous ones. If it fails or takes over [6 s]: Classic for that section, logged, with a toast "Using the classic map for this section."
- **Biomes and time of day** (section 9): palettes for `meadow`, `rainforest` and `alpine` (`meadow` until Phase 11 assigns biomes; Alpine has no autumn trees and turns rock white above `snowAbove`). **Night**, on the land only: `lum·[0.36, 0.44, 0.72]·0.8 + rgb·[0.22, 0.30, 0.42] + [0.03, 0.04, 0.11]`, with a warm glow (`[0.55, 0.32, 0.12]`, radius [60]) where hikers sleep in a shelter or Sit by the Fire and at Campsites with hikers. **Rain:** 78% color + 22% gray, cooler and darker, slanted streaks (off under reduced motion). **Snow:** open ground above [45%] brightness fades to white over a [0.2] ramp; trees stay dark. **Heatwave:** a warm wash. **Storm:** rain, darker. Grades, not regeneration.
- **Oregon place names** (section 10): the main river, creeks, ponds, Overlook tiles (lookouts), forest patches over [6 tiles' area] (woods), meadow patches over [4 tiles' area] (meadows), peak-stamp peaks and waterfalls, named from `oregon-names.json`. Each list is shuffled once per run with the run seed and used in order section after section, so nothing repeats in a run and a reload gives the same names (nothing to save). Rivers and creeks along a calm stretch, rotated; ponds beside the water; lookouts beside the tile; the rest at the patch's center; never under a tile or another label. A label appears once the paint covers it, fading in with it, and the trail log says "Found Tumalo Pond." the first time.
- **Walked paths and the route view** (section 11; **both map styles**): each connection gets `walkedBy`, set the first time any hiker crosses it (either way; a Move All's mover), never changed, saved with the run; old saves start unwalked. Classic colors walked lines in the walker's party color too, keeping its own line styles. **Routes**, a map toolbar button (also while `Tab` is held; a toggle on phones): the land fades (`saturate(0.35) brightness(0.72) contrast(0.9)`), tiles shrink to faint outlines (fill `#0F1A16` [25%], edge [35%]), tokens and labels hide, unwalked paths drop to [25%], walked paths stay bright with a small legend of hiker colors. Classic dims everything but walked lines. It never blocks input.
- **Debug panel** (section 12): switch the map style; regenerate with a new seed; reveal all or hide all; replay the reveal animation on a tile; show the land-type mask, the height map and the reveal mask; the generation time; force night, rain or snow; toggle the route view; show the stamp placement boxes.

**Not in this phase:** the tilted view (`MapTilted.jpg`, `reference/topo_tilt.py`), kept for a possible intro shot later.

**Tests**
- **Deterministic:** the same seed, section and tiles give identical fields (a hash) and names; another seed gives different ones.
- **Built from the nodes:** the river passes within a tile radius of every River tile's center; every River ×2 tile has a pond; peaks sit near Mountain tiles; no forest or stamps inside any tile hex; no stamps on paths.
- **Jitter:** within the limits; the trailhead and checkpoint don't move; clicks land on the moved hexes.
- **Paths:** `walkedBy` is set by the first crosser only; a Move All uses the mover; a walked normal path is solid and walked dotted paths stay dotted; old saves load with nothing walked.
- **Reveal:** revealing a tile adds paint around it; a reload rebuilds the same mask; reduced motion skips the animation.
- **Names:** no repeats across a 3-section run; a label stays hidden until its spot is painted; the "Found …" line appears once.
- **Setting:** switching styles mid-run keeps the game state and camera; Classic is unchanged apart from colored walked lines and the route view.
- **Fallback:** a forced generation error falls back to Classic with the toast.
- **Performance:** generation under the budget on the test machine (logged, not a CI failure).

**Done when:** a run can be played in either style; the Illustrated map matches `MapTopDown.jpg` closely, paints in as tiles are revealed, names its places, grades for night and weather, and stays within its time budget; and the tests above pass.

**Phase 10.5 notes (built Nov 21)**
- **What's playable:** either map style, switched any time in Settings (or the debug panel). Illustrated paints the land in a Web Worker, shows unexplored land as a pencil sketch that paints in as tiles are revealed, draws tiles as dark glass and unrevealed ones in pencil, winds and jitters the paths, colors walked paths, adds bridges, stamps and Oregon place names ("Found …" in the trail log), grades the land for night, rain, storm, snow and heat, and has the compass, title box with scale bar, and Legend. The Routes button (or holding Tab) works in both styles. The debug panel has a **Map look** section.
- **Decisions:**
  - **Scale:** Classic's grid stays (rows 152 apart, hex radius 64), and every prototype number is multiplied by 152 ÷ 134 (`u()` in `src/config/mapStyle.ts`). Tiles already take about 42% of a row, so nothing had to be spread out, and switching styles keeps the camera.
  - **Field grid:** 2 prototype units a cell (3 on phones), not 1. At 1 it took about 2.2 s on this laptop, over the 1.5 s budget. Contours, water and tree crowns are still drawn sharp; only the color fields are coarser.
  - **Rivers:** one main river runs top to bottom through the longest top-to-bottom chain of River tiles; any other River tile gets a creek from the nearest side.
  - **Names:** at most 6 per kind in a section (`NAMES_PER_SECTION`), so the lists last the whole run.
  - **The land is fixed per section:** it's made from the section's tiles when you enter it, so revealing nodes later changes only the paint, not the land.
  - **Palettes:** Meadow everywhere until Phase 11 passes the biome in (`BIOME_PALETTES` in `land/palette.ts`).
  - **Scale bar:** "one move" (one row of the trail at the current zoom). The mockup's "about half a day" didn't match anything the game measures.
  - Names that show only because of the debug panel's "Reveal all" aren't logged as found.
  - The worker imports the RNG module directly, not the engine index (38 kB instead of 223 kB).
- **Generation time on this laptop:** about 1.1–1.2 s for a section in the worker (land about 0.9 s, features 0.12 s, paint 0.05 s). With the window in the background the browser slows it to 1.4–1.5 s, so the 6 s give-up only counts time on screen.
- **Questions for Wyatt:**
  - **Scale bar:** is "one move" right, or should it say something else?
  - **Default style:** Illustrated (the update's first guess). Keep it?
- **Not done yet:**
  - Biome palettes, Alpine snow on rock, and Fog wait on Phase 11. The Sit by the Fire glow waits on that trait (still held).
  - The tilted view isn't in this phase.
  - Rain streaks and reduced motion were checked in code and tests, not by eye at full size.
- **Saves:** version 19. A v18 save loads with nothing walked and no places found. Wyatt's v14 save still loads.

---

## Phase 10.6: Simplify (now)

(New in the Nov 21 updates: `docs/UPDATE-2026-11-21-phase-10.6-simplify.md` and its add-on `docs/UPDATE-2026-11-21-map-corners.md`. The first step of the overhaul in `docs/design/08-overhaul-plan.md`, which wins over the older design docs where they disagree. Only its "Phase 10.6" section is built here.)

**Goal:** fewer systems, each easier to follow. A difficulty setup (always Medium for now) decides how many plain tiles have a challenge; Wonders and Trials are gone; weather only changes what scavenging finds; nine foods; shelters you carry and set up. Plus two illustrated-map follow-ups and a fix so no card or tooltip is ever cut off.

Numbers in [brackets] are first guesses: in `balance.ts` or the new `difficulty.ts`, with `TODO(wyatt)`.

**Build**
- **A. Illustrated map follow-ups:**
  - **Show whole map:** Settings → Map style → a switch, shown only for Illustrated, default off. On: the land is fully painted with no sketch or reveal animation, and every place name shows. Tiles, nodes, special spaces and challenges still follow the normal reveal rules.
  - **A paper map on a table** (`MapEdge.jpg`, `look/edge-table.jpg`, `reference/topo_edge.py`): a cream paper margin about [40] units around the land, a printed double border ([12] and [18] in from the edge) and a line where the land starts, a slightly torn edge, faint fold lines, a soft shadow (blur [14], offset [10, 14], [55%]). The sheet stays straight. Behind it, generated wood planks, made at screen size once. Zooming out stops with the whole sheet on screen and about [8%] of table around it; panning stops when the sheet's edge is about [40%] across the screen. Classic doesn't change.
  - **Map corners** (map-corners add-on): the section box (biome name, `SECTION I · TIER I`, the 3-block scale bar) in the land's bottom-left corner and the compass rose in its top-right, about [20] units in, drawn in map coordinates on top of paint and sketch alike. Section box about [170 × 74] units, compass about [80]. The screen-fixed compass and title box from 10.5 go; the Legend button stays.
- **B. Nothing cut off at the edges**, for every window and pop-up:
  - card rows that don't fit shrink evenly (down to [80%]), then wrap to a second row;
  - tooltips and hover windows check they fit in the game screen with an [8 px] margin, flip sides, then nudge inside, and render in a top layer;
  - check scavenging (the most cards possible), crafting, shops, challenge windows, hiker cards, trait badges and the level-up screen, at desktop and phone landscape sizes;
  - a dev-only **edge test** button in the debug panel opens each window with the most cards possible.
- **C. Simplify:**
  - **Difficulty** (`difficulty.ts`): `easy`, `medium`, `hard`, `nightmare`, always Medium for now (the debug panel can switch it). `challengeShare` ¼ / ½ / ¾ / 1, `opportunitiesPerSection` [3] / [2] / [1] / 0, `sectionRows` [0.8] / 1 / [1.2] / [1.4], and the rest at today's values. When a section is made, `round(challengeShare × plain tiles)` plain tiles get a challenge (no more than [3] in a row along a path, if avoidable), then `opportunitiesPerSection` of the rest get an opportunity; every other plain tile is quiet. Special spaces work as now.
  - **Removed:** Wonders (behind `ENABLE_WONDERS = false`) and Trials (`enabled: false`, Rocco's included). Redolf's **Rednose** does nothing and reads "Placeholder text".
  - **Weather:** Clear, Rain, Snow, **Wind** (new) and Heatwave; Storm and Fog are gone. The only effect: on a tile with the weather's node (Rain River, Snow Mountain, Wind Forest, Heatwave Wildlife) its resources are [1.5×] as likely, and on any tile each resource card has a [10%] chance to become one of that node's, with a small weather icon. No weather conditions or node changes. Each weather lasts [1–3] days, Meadow odds everywhere until Phase 11: Clear [40%], Rain [25%], Wind [20%], Heatwave [15%]. Wind gets a placeholder icon and drifting leaves on the illustrated map. The pop-up and forecast say one line each ("Rain: more River resources.").
  - **Food:** only Trail Mix, Costco Sample, Dog Food, Mystery Meat, S'mores, Jerky, Fish and Chips, Rotisserie Chicken (a camp meal anyone on the tile can eat from) and Din Tai Fung, with the update's numbers. Every other food is switched off everywhere it could come from, but still works if already in a pack. Starting bags swap switched-off food for Trail Mix at the same Quality. The debug panel logs the average Appetite per food crafted.
  - **Portable shelters:** 1 pack slot; **Set up** is a free action on your tile using 1 deployment (only 1 up per tile); while up, everyone on the tile is sheltered (+1 Energy from sleeping, safe from night events, plus its own effect); **Pack up** is free; it packs itself when its owner leaves, if there's room; at 0 deployments it can't be set up and is thrown away when packed. Deployments per the update's table; recipes lose 1 "any" (the generic shelter craft 6 → 5). Old saves: a placed shelter becomes a set-up one.
  - **Debug panel:** the difficulty switch, force any weather (Wind too), add any of the 9 foods at a Quality, add any shelter with chosen deployments, the edge test, and Show whole map.

**Tests**
- **Difficulty:** each level gives exactly `round(share × plain tiles)` challenge tiles and the right number of opportunities on the rest; special spaces unchanged; Nightmare has no opportunities on plain tiles.
- **Removed:** no Wonders or Trials over 50 seeded runs; Rednose does nothing.
- **Weather:** no Storm or Fog anywhere; each weather boosts its node's resources on tiles with the node and sometimes adds them elsewhere; no conditions from weather.
- **Food:** only the 9 foods from crafting, scavenging, shops or rewards; bites and Appetite match the table; the camp meal works without trading; switched-off foods in old saves still work.
- **Shelters:** set up uses a deployment, shelters everyone on the tile, auto-packs when its owner leaves, is thrown away at 0, only 1 per tile; old saves convert.
- **Map:** Show whole map paints everything but leaves tiles hidden as normal; zooming out stops with the whole sheet on screen; the sheet isn't rotated and clicks hit the right tiles. No compass or title box is fixed to the screen in Illustrated; both corner pieces sit in the land's corners, move with the camera and overlap no tile, path or label.
- **Layout:** in the edge test, no card or tooltip goes outside its window or the game screen, at desktop and phone sizes.

**Done when:** a run plays on Medium with the new challenge density, weather, food and shelters; the illustrated map sits on its table with its corner pieces; nothing is cut off anywhere; and the tests above pass.

**Phase 10.6 notes (built Nov 21)**
- **What's playable:** a run on Medium (half the plain tiles hold a challenge, 2 opportunities, the rest quiet), no Wonders or Trials, weather that only changes scavenging (Wind is new), 9 foods with Rotisserie Chicken as a camp meal, shelters you carry, set up and pack up. On the illustrated map: Show whole map, the paper sheet on a wood table, and the section box and compass printed in the land's corners. Card rows and tooltips are never cut off.
- **Starting bags that changed:** Cody (Dill Rolls), Kai (Citro Drink) and Madeline (Wine) start with Trail Mix (Quality rolls as before). Citro Tub's reward is Trail Mix too.
- **Decisions:**
  - **Challenge spread:** challenges are placed one at a time in a seeded order, skipping any that would make more than 3 in a row along a path up; skipped ones fill in only if the count can't be reached otherwise.
  - **Weather and challenges:** Storm, Lightning and Blazing Sun were gated on Storm or sunny weather. Weather no longer picks challenges, so they can come up in any weather.
  - **Weather and traits:** traits that react to rain or snow keep doing so (Storm is removed from their lists); Phase 10.7 reworks traits.
  - **Shivering and Burning:** they still end when the weather changes, as their own rule says; nothing else gives them from the weather now.
  - **A hike starts Clear**, for one spell (1–3 days).
  - **Shelters:** setting one up asks first (it uses a deployment); packing up doesn't (it can be undone); throwing a worn-out one away asks. Ruins sets a shelter up with nobody as its owner, only on a tile with none up. An old save's tile with several shelters keeps the one with the most left.
  - **Old saves:** v20. Storm days become Rain, weather-changed nodes go back, a leftover Wonder tile becomes quiet, placed shelters become set-up ones.
  - **Difficulty:** only the share, opportunities, rows and challenge tier offset do anything yet (the night event odds use theirs too). Luck, rarity and Appetite drain are stored at their "as now" values and plug in when difficulties are built.
  - **Map edge:** zoomed out, once the whole sheet fits, all of it stays in view; the 40% edge rule applies while the sheet is bigger than the view. The scale bar in the section box has no words (the mockup's).
  - **Edge fix:** the shop counter stays a scroller (every card can be reached by scrolling; nothing is cut away). The level-up row already shrank to fit.
- **Questions for Wyatt:**
  - Should Storm, Lightning and Blazing Sun leave the pool instead of coming up in any weather?
  - Citro Tub gives Trail Mix now. Another food?
- **Not done yet:**
  - Luck, rarity and Appetite drain difficulty settings aren't wired (no level changes them yet).
  - The edge test checks the scavenge, craft, challenge and level-up windows and every tooltip on screen; hiker cards and the shop counter were checked by eye.
- **Saves:** version 20.

---

## Phase 10.7: Hikers (next, design first)

(Outline only, from `docs/design/08-overhaul-plan.md`. Wyatt will send the design; don't build before it arrives.)

- **One starting trait** per hiker, picked from a short list for that hiker, plus their morale type. Fewer traits, but much stronger.
- **Skill trees** instead of swapping traits: three routes per hiker (**Movement, Resources, Utility**), each 3 tiers deep, fairly unique per hiker.
- **Party XP:** one shared bar; each party level-up gives points for any hiker's tree. Tiers unlock by party level.
- **Morale types:** Extrovert, Introvert, Ambivert, Foody, Energetic, Wanderlust, Homebody.
- **New trinkets** that work from the pack and wear out, instead of giving or swapping traits.
- Rednose gets its rework here.

---

## Phase 10.8: Challenges and opportunities (after 10.7, design first)

(Outline only, from `docs/design/08-overhaul-plan.md`.)

- **The minigame library:** a few base games (Barrels, Snake, Minefield, Memory, Puzzle, Reaction, Timing, Trivia, Jumping, Dodging), each with several skins, all playable with taps on a phone.
- **The first challenges and opportunities** built from them: prepare by spending resources or items, stakes that fit the challenge, party size that matters, penalties that reach past the tile.
- Trials come back only if they fit the new challenges.

---

## Phase 11: Biomes, tiers and weather

Rules only (Nov 14 update): no biome-specific background or trail art. Wyatt is redesigning the trail map's look, so the biome art waits for the UI overhaul (Phase 12).

**Build**
- Meadow → Temperate Rainforest → Alpine, at Tier 1 → 3.
- Biome node weights, challenge pools and weather schedules per biome. **Fog and Storm are gone** (Phase 10.6); they may come back later as special weather.
- **The illustrated map (Phase 10.5):** pass each section's biome in, so it uses that biome's palette (`meadow`, `rainforest` or `alpine`).
- Challenge spaces draw one tier higher.
- The snowy, high part of the trail turns on the `[snow only]` challenges, mostly Tier III.

---

## Phase 12: UI overhaul

(New in the Nov 14 update.) Wyatt sends mockups first.

**Build**
- The trail map's look: Classic look stays; the Illustrated look is done in 10.5. Left for later: Wyatt's painted stamps, tuning the Rainforest and Alpine palettes, and maybe a tilted intro shot when a section starts.
- The hiker portrait panel.
- **The crafting window:**
  - switch between hikers without closing it;
  - every blueprint shown, with the unlearned ones grayed out;
  - favorite recipes, and their resources shown at the bottom of the scavenge window.
- Scavenging windows for several hikers on screen at once, side by side, so they can plan together.
- **From the overhaul plan** (`docs/design/08-overhaul-plan.md`, "UI"):
  - **small hiker frames:** a banner with the name, the portrait beside it, stat bars below and a marker for conditions; click to expand with traits and conditions;
  - **a crafting book** in the style of Catan's recipe cards and Minecraft's crafting grid: every cost up front, slots at the top that fill when you click a recipe, favorites first, missing resources shown;
  - **a 3×3 crafting deal:** face-down cards, reveal 3 and pick one (crafter traits can change it);
  - **poster-style windows** like the new map (WPA-era National Park posters, Olly Moss);
  - **dealt-card animations** (challenge cards slide in and flip, scavenge cards with small offsets and tilts) and a **rarity glow** on rare face-down cards.

**Ask Wyatt first:** the mockups.

---

## Phase 13: Objectives and scoring

**Build**
- **Objectives:** at each biome, draw 3 (one each of Tier 1, 2 and 3) and pick 1. Rerolls: 2 for Tier 1, 1 for Tier 2, none for Tier 3. Track success or failure with point and Morale penalties.
- **Scoring:** X/Y, where Y is the best possible score for this run's settings. Letter grades, P and P+.
- **End screen:** recap, score, and a "New Hike" button.

**Ask Wyatt first:** the objective list, and point values (placeholders until playtesting).

---

## Phase 14: Setup flow

**Build**
- Title → party pick (4 hikers, filter by class label) → starting kit draft → objective draw → hike.
- With several people playing, label who controls each hiker.
- The title screen gets real title art from Wyatt later. Keep a placeholder until then.

---

## Phase 15: Content, balancing and polish

- Bring in Wyatt's full content.
- Rewrite all player-facing text to the writing style in `CLAUDE.md`, including the Wonder cards, and add the challenge descriptions.
- A balancing pass using the debug panel and seeded replays.
- Sound is its own phase now (Phase 16).
- Animation polish.
- Animated gradients on item cards (see "Cards are built in-game" above), once Wyatt's frame and icon layers arrive.
- Accessibility: text size option, colorblind-safe icons alongside colors.

---

## Phase 16: Audio

Start this once the game is fully playable.

- **Music:** Wyatt makes a day track and a matching night track for each biome. They loop, with a slow crossfade at nightfall and in the morning.
- **Ambience:** weather and setting loops (rain, wind, birds, crickets at night) that fade in and out with the weather and the phase.
- **Sound effects:**
  - First, list every moment that could have a sound: hikers moving, flipping or drawing a card, picking a card, using or eating an item, buying, selling, crafting, a challenge pop-up, passing or failing, a level-up, button clicks, a phase change, checking in, and so on.
  - Save the list as `docs/audio-list.md` so Wyatt can make or choose a sound for each.
- **Settings:** separate volume sliders for music, ambience and effects, plus mute. Start quiet.
- **Formats:** compressed loops (OGG with an MP3 fallback), loaded per biome so the download stays small.

---

## Phase 17: Phone

- Make it a PWA: installable, works offline, and asks to rotate to landscape.
- Touch: tap to select, long-press for details, pinch to zoom the map.
- Test on Mom's actual phone.

---

## Later additions (not in the base game)

These are in the design doc's "Later additions" section. Don't build them yet, but keep the settings they depend on adjustable:

- party size 3–6;
- longer runs;
- more biomes;
- modifiers;
- endless mode;
- unique rangers;
- specific item finds;
- splitting caps between hikers in a multiplayer version.

## Known open questions (from the design doc)

Placeholders are fine until Wyatt decides:

- generic crafting costs;
- objective failure penalties per tier;
- point values, partial points and the caps limit;
- Duo characters;
- tiers for traits added during design;
- Puller's exact cost;
- effects for Harness, Disco Harness and Chocolate Rose;
- the rest of Fog.
