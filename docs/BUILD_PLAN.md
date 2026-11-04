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
- Simple shows only what's needed to play: compact hiker cards, small pills along the top, only the actions available right now, and one inventory row. Details open in pop-outs that close on click-away.
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
- **Draw weighting:** by the tile's nodes, Abundance and Luck. Luck shifts odds one rarity step per point.
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

**Ask Wyatt first**
- Exact rarity weights, or approval of a first guess.
- What a Mixed card does on a 3-node tile.
- Hi-res art for bones, flint and salt, which is missing (see `docs/ASSETS.md`). Placeholders are OK until then.

---

## Phase 5: Challenges and opportunities

**Goal:** entering a new tile can trigger a challenge or opportunity pop-up.

**Build:** this follows `Challenge.dc.html` and `ChallengeParty.dc.html`.
- **Template system** with placeholders `{amount}`, `{resource}`, `{node}`, `{itemType}`, `{stat}` and `{days}`, filled in by tier, tile and biome. Each template lists the tiers, nodes and biomes it can appear in.
- **The window:**
  - title, art and text;
  - requirement slots you drag or click resources and items into;
  - each-hiker mode with ✓/✗ per hiker, and party mode where the party pays together;
  - the inventories of the hikers on the tile across the bottom.
- **Triggering:** the first entry triggers the card once. Lingering tile conditions are the exception.
- Special spaces: Challenge (one tier higher, plus a reward), Choice (pick 1 of 2), Opportunity.
- About 10 placeholder templates.

**Done when:** a dozen generated challenges all read correctly, and paying, failing and rewards work for both modes.

**Ask Wyatt first:** his first real challenge and opportunity templates, if they're ready.

---

## Phase 6: Night, camp and conditions

**Goal:** nights matter.

**Build**
- **Night actions:** Sleep, Keep Watch, and Move or Scavenge at the night penalty.
- **Camp step:**
  - a night event chance (50%, from a placeholder deck);
  - conditions tick down;
  - clothing durability ticks down;
  - passed-out countdowns drop.
- **Conditions engine:**
  - day-based and phase-based durations;
  - stat changes that apply while a condition lasts and undo when it ends;
  - caps that change the maximum;
  - positive conditions can push a stat above 10.
  - Implement every condition in `02-traits-and-conditions.md`.
- **Weather** affects every tile, with the 3-day forecast shown.

**Done when:** every listed condition has a test.

**Ask Wyatt first:** the night event list, if it's ready.

---

## Phase 7: Injuries, passing out, carrying and abandoning

**Build**
- **Injuries are strikes with no effect of their own.**
  - A hiker gets one when Energy, Appetite or Morale hits 0, or from challenges and events.
  - Gaining an injury raises each of that hiker's stats that is below 5 back up to 5.
  - Show injuries as 3 strike pips on the hiker card.
- **Cures:** Bandages, Splint, Medkit, Medic Tent and station services.
- Passing out at 3 injuries:
  - a 2-night countdown;
  - waking with a medical item;
  - carrying, where the carrier's moves cost +1 Appetite;
  - abandoning when the countdown hits 0, or by choice.

---

## Phase 8: Checkpoints and ranger stations

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

**Ask Wyatt first:** which station themes to build first, and their stock.

---

## Phase 9: Items, crafting and blueprints

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

**Ask Wyatt first:** the generic crafting costs per category, and the full item list by tier.

---

## Phase 10: Traits, slots, XP and leveling

**Build**
- **Trait slots:**
  - types T, U, M, T/U, T/M, U/M and W, drawn as colored outlines;
  - characters start with 2–4 slots, up to 6 maximum;
  - special and unique traits take a slot.
- **Every trait** in `02-traits-and-conditions.md`, as hook effects, including the Nov 3 additions: Never Hungry, Archaeologist, MBA, Lovingly Made, Wise, Dream Alchemist, Trainer, and the Morale "Empath" (it needs a new name; ask Wyatt). Active traits go in the Abilities panel with their uses left.
- **XP:** milestones and actions, with the row rule.
- **Level-ups:**
  - level N offers 3 Tier N traits drawn from every slot type the hiker has, filled or open, with Morale traits less likely;
  - from level 4 there are more options, all Tier III, up to 6;
  - an option is sometimes a new slot: T and U are common, dual slots rarer, W rarest;
  - special and unique traits are offered only to the characters they belong to;
  - picking a trait with no fitting open slot replaces a trait in a slot that fits.
- **Families:** Human, Dog and Cat with their built-ins, family versions of traits, and family items.
- **Trinkets.**

**Ask Wyatt first**
- The full character roster with slots, traits and starting attributes.
- Trait tiers where they're still marked "proposed".

---

## Phase 11: Biomes, tiers and weather

**Build**
- Meadow → Temperate Rainforest → Alpine, at Tier 1 → 3.
- Biome node weights, challenge pools, weather schedules and Fog (hides nodes on tiles with no hiker).
- Challenge spaces draw one tier higher.

---

## Phase 12: Objectives and scoring

**Build**
- **Objectives:** at each biome, draw 3 (one each of Tier 1, 2 and 3) and pick 1. Rerolls: 2 for Tier 1, 1 for Tier 2, none for Tier 3. Track success or failure with point and Morale penalties.
- **Scoring:** X/Y, where Y is the best possible score for this run's settings. Letter grades, P and P+.
- **End screen:** recap, score, and a "New Hike" button.

**Ask Wyatt first:** the objective list, and point values (placeholders until playtesting).

---

## Phase 13: Setup flow

**Build**
- Title → party pick (4 hikers, filter by class label) → starting kit draft → objective draw → hike.
- With several people playing, label who controls each hiker.

---

## Phase 14: Content, balancing and polish

- Bring in Wyatt's full content.
- A balancing pass using the debug panel and seeded replays.
- Sound (optional).
- Animation polish.
- Animated gradients on item cards (see "Cards are built in-game" above), once Wyatt's frame and icon layers arrive.
- Accessibility: text size option, colorblind-safe icons alongside colors.

---

## Phase 15: Phone

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
- specific item finds.

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
