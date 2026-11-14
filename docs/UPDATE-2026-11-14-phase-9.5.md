# Update: November 14, 2026 (Phase 9.5: Smoother play)

**Where this file goes:** Wyatt unzipped this folder into the repo as it is. Move this file to `docs/UPDATE-2026-11-14-phase-9.5.md`, then delete the leftover `update-2026-11-14-phase-9.5/` folder. From now on, every update arrives this way: a dated folder whose files you move to where they belong.

**What this is:** a new phase between Phase 9 (stations) and Phase 10 (traits). It changes two core rules, Appetite and Abundance, and makes playing faster: dragging, multi-select, no pop-up after scavenging, and card previews. Build it **before** Phase 10. Phase 10 and later phases should use the new drag patterns from the start.

Numbers in [brackets] are first guesses. Put them in `balance.ts` with `TODO(wyatt)`. Nothing here needs Wyatt's answer before building.

---

## 1. Plan changes (update `BUILD_PLAN.md` first, and commit)
- **Add Phase 9.5: Smoother play** with sections 2–9 below.
- **Phase 11 (Biomes):** rules only, meaning node weights, challenge pools, weather schedules and Fog. **No biome-specific background or trail art.** Wyatt is redesigning the trail map's look, so biome art waits for the UI overhaul.
- **New Phase 12: UI overhaul**, right after Biomes. Wyatt will send mockups first. It covers:
  - the trail map's look, including the background and trail art, and the biome art;
  - the hiker portrait panel;
  - the crafting window:
    - switching between hikers without closing it;
    - every blueprint shown, with unlearned ones grayed out;
    - favorite recipes and resources that show at the bottom of the scavenge window;
  - scavenging windows for several hikers on screen at once, side by side, so they can plan together.
- **Renumber the later phases:**
  - Objectives 12 → 13;
  - Setup 13 → 14;
  - Content, balancing and polish 14 → 15;
  - Audio 15 → 16;
  - Phone 16 → 17.
- **Content phase (now 15):** add "rewrite all player-facing text to the style guide in `CLAUDE.md`, including Wonder cards; add the challenge descriptions."

## 2. Writing style (add to `CLAUDE.md` now, and follow it from Phase 10 on)
Player-facing text (cards, buttons, tooltips, dialogue) should be short and plain:
- Say what the player does or gets ("Pick an item." "Gain 2 Morale."), not how the rule works inside. Full explanations can go in a rules screen later.
- Use one word for one thing everywhere: Appetite, Energy, Morale, Abundance, tile, node, hiker, caps.
- No code-like wording: no "trigger", "proc", "on use", "X%" placeholders, or square brackets in player text.
- If a line doesn't help the player decide something, cut it.
- Keep numbers on cards; keep explanations off them.

## 3. Appetite: no more overnight loss
- Hikers **no longer lose 1 Appetite each night.** Appetite only goes down from actions: moving (−1), scavenging (−1), Tend (−1), and the extra costs for night moves and Move All.
- **Tend now costs 1 Appetite** instead of 1 Energy.
- Food stays the same for now. Wyatt will rebalance items after playing with this rule.
- Two Phase 10 traits relied on the overnight loss, so leave them for Phase 10. Their rewrites are waiting for Wyatt's OK in the doc:
  - **Never Hungry** (proposed): "Moves and scavenges have a 25% chance to cost no Appetite."
  - **Rabbit Diet** (proposed): "Scavenging costs no Appetite, but can't eat food cards."
- Update `01-design-doc.md`: the stats table (Energy and Appetite rows) and the Actions table (Tend).

## 4. Abundance: one bar for the whole biome
Replace the four node meters with **one Abundance meter for the current biome**. Think of it as a pollution bar in reverse: scavenging any node lowers it, and its level affects every node.
- **Range:** 0 to [20]. It starts at [15] in each new biome and recovers [+1] each night.
- **What lowers it:** the same as before, but all into the one bar:
  - each scavenge −1;
  - ×2, ×3, Pair and Trio cards −2;
  - bonus resources a hiker chooses to take (Copier, Copydog, Generous). Random or refunded ones don't count.
- **What raises it:**
  - **Tend:** [+2], day only, costs 1 Appetite. The Maintenance trait doubles it. A Green/Blue/Gray/Yellow Thumb gets +1 more on a tile with their node.
  - returning a resource to nature (+1);
  - Fertilizer and Industrial Fertilizer;
  - some challenge and Wonder rewards.
- **Its one effect, empty cards:** each **resource** card dealt has a chance to be **Empty**. It flips to show nothing, and keeping it gives nothing.
  - The chance is [5%] at full and rises evenly to [40%] at 0.
  - Caps cards and item cards are never empty.
  - Remove the old low-Abundance effects: fewer cards, rarer good results, harsher events and shop prices.
- **Empty card art:** a placeholder for now. Use the node's backdrop, faded, with "Empty" in Edit Undo. Wyatt may send art.
- **The meter:**
  - one bar at the top of the screen, replacing the four meters, going green → yellow → red as it drops;
  - its tooltip shows the current empty-card chance;
  - Simple mode shows just the bar, and Informative mode adds the number.
- **Old saves:** set the bar to the average of the old four meters, scaled to 0–20.
- **Content that changed** (update the data and the matching files in `docs/design/`):
  - **Items:**
    - Fertilizer: "Gain (X 1/2/2/2/3) Abundance."
    - Industrial Fertilizer: "Gain (X 3/4/4/4/6) Abundance."
  - **Challenges:** the "Forest Abundance" and "River Abundance" penalties become plain "Abundance". The one that dropped River and Forest by X[1–2] each now drops Abundance by X[2–4].
  - **The Abundance cost type:** "spend X Abundance".
  - **The opportunity "River Abundance reaches X[5–6]"** becomes "Within 2 days, Abundance rises by X[3–4] (Tend helps)". Track the gain from when it starts.
  - **Crater Lake (Wonder):**
    - goal: "Abundance is 15 or more";
    - reward: "Raise Abundance by 5".
  - **Traits:**
    - the Thumbs: "+1 card when scavenging their node, and Tend on a tile with that node restores 1 extra Abundance";
    - Conservationist: "each time Tending on a tile with an [X] node".
  - Search the content for any other per-node Abundance and fold it into the one bar.

## 5. The station forest moves
- The forest layers outside the station windows drift slowly to the left and loop without a seam. Far layers move slower than near ones, for a gentle parallax.
- First guess: the far layer takes [180 s] to loop and the nearest takes [70 s].
- The fireplace glow stays as it is. Under reduced motion, the forest holds still.

## 6. Drag to do things
Build **one shared drag system**, using pointer events so it works with a mouse and with touch:
- While dragging, every place the thing can be dropped glows, and everything else dims slightly.
- Dropping anywhere else, or pressing Esc, cancels.
- The current click buttons stay as a fallback.

**Moving a hiker**
- Press a hiker's token on the map and drag. An **arrow line** follows the pointer from the token.
- Tiles the hiker can reach by a line glow, and the line's cost shows on the hovered tile.
- Dropping on a glowing tile opens a small pop-up next to that tile:
  - the hiker's portrait at the top;
  - **Move** (alone);
  - **Move all**: opens a list of the other hikers on the same tile who can come, with checkboxes. All are checked by default. A **Go** button confirms.
- Dropping anywhere else cancels.

**Items and resources**
- **Equip:** drag clothes onto the matching slot (Gear, Body or Feet) of a hiker's portrait panel. Only matching slots glow. Something already in the slot swaps back into the pack.
- **Give or trade:** drag an item or resource onto another hiker's portrait. Only hikers who can receive it glow: on the same tile, or anywhere while a Walkie-Talkie is active.
- **Use:**
  - **Items with a target** (Binoculars, Paver, Camera and so on): drag onto the target tile. Only valid tiles glow.
  - **Items without a target:** drag anywhere onto the map.
  - **Food:** drag onto a hiker's portrait to eat it, which can be the hiker's own portrait.
  - **Shelters:** drag onto the tile to place them.
- **Station:**
  - **Sell:** drag to the sell slot (already there).
  - **Buy:** drag a shop card onto a hiker's pack, and a small confirm pop-up appears: "Buy [item] for [N] caps?" with Buy and Cancel. Cards the party can't afford can't be picked up, and they shake a little.
  - **Workbench:** drag resources and items in.

## 7. Scavenging without the pop-up
- **No result window:** after the hiker keeps a card, it **slides into that hiker's pack** and a small "+1 Fur" (or the item's name) floats up and fades. Under reduced motion, it just appears.
- **Two kinds of item find:**
  - **Random item find:** the current card. Face-down on the item backdrop, it shows only the item type, and you don't know which item it is until you keep it. Its rarity stays the same.
  - **Item card (new):** flips to show the **real item card**, with its Quality already rolled, so you know exactly what you're taking. It's as rare as a random find of the same type [first guess]. Add it to the scavenge odds table in `balance.ts`.

## 8. Card previews
- Anywhere a card or item name appears, clicking it (or long-pressing on a phone) opens the full card, large, with its text:
  - scavenge cards;
  - crafting choices;
  - blueprints;
  - shop cards;
  - items in packs.
  - Hovering on a desktop shows it too, after a short delay.
- When Quality isn't rolled yet (generic craft choices, blueprints, Random Resale aside), show the **range** across Qualities 1–5: "2–4 bites", "+1–3 Appetite", "4–6 days". Use the item's `qualityScale` values.
- Build it as one shared preview, used everywhere.

## 9. Multi-select
- **Selecting:**
  - **Desktop:** Shift-click or Ctrl-click hiker portraits or tokens.
  - **Phone:** a **Select** toggle above the portraits, then tap.
  - The order you select them in is their **turn order**, shown as numbered badges (1–4) on their portraits.
- **Then pick one action, and each selected hiker does it on their own, in turn order:**
  - **Move:** drag any selected hiker's token (or pick a tile) to the destination.
    - Each hiker moves there separately (this isn't Move All) and pays their own cost.
    - The first to arrive faces the tile's challenge alone, then the rest follow.
    - Hikers who can't reach that tile are handled after the others: the game switches to each of them in turn to pick their own destination, or skip.
  - **Scavenge:** each hiker's scavenge window opens one after another, in turn order. (Showing them all at once, side by side, comes in the UI overhaul.)
  - **Tend, Sleep, Keep Watch and other actions:** each hiker does it in turn.
  - A hiker who can't take the action (no action left, not enough Appetite and so on) is skipped, with a short note.
- Esc or tapping empty map clears the selection.

## 10. Tests
- **Appetite:** no Appetite lost overnight; Tend costs 1 Appetite and no Energy.
- **Abundance:**
  - one bar;
  - the drain and recovery amounts;
  - the empty-card chance at 0, 10 and 20;
  - caps and item cards are never empty;
  - old saves load into the one bar.
- **Drag targets:** each drag kind lights up only valid targets (the same tile for giving, the matching slot for equipping, reachable tiles for moving).
- **Move all from the pop-up:** only the checked hikers move.
- **Multi-select:**
  - turn order is followed;
  - the first hiker faces the challenge alone;
  - hikers who can't reach the tile get their own prompt.
- **Item cards from scavenging:** they keep their rolled Quality.
- **Preview ranges:** they match `qualityScale` values.
