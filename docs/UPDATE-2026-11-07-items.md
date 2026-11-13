# Update: November 7, 2026 (items and crafting come next)

**Phase order change:** items and crafting now come **before** ranger stations, because the station shop sells items.
- **Phase 8** is now **Items, crafting and blueprints** (the old Phase 9).
- **Phase 9** is now **Checkpoints and ranger stations** (the old Phase 8).
- Swap them in `docs/BUILD_PLAN.md`, including their headings and any "Phase 8/9" references. Anything in `UPDATE-2026-11-04.md` that says "Phase 8" about the station now means Phase 9.

**New and updated files in this commit**
- `docs/design/03-items.md` (**replaces** the old copy). Every item with its tier, uses, bites or durability, Quality values, effect, recipe and art. **This is the source of truth for items.**
- `assets/items/*.png`: 141 item images, cleaned up. Each is trimmed and evened out on a 1024×1024 transparent square, named after the item (`fishing-rod.png`, `din-tai-fung.png`). Copy what the game uses into `public/assets/items/`.
- `assets/item-card-front-background.png`: the card front background, cropped to square corners. Round them in CSS to match the card (`border-radius` = 7.5% of the card's width, `overflow: hidden`).
- `docs/mockups/ItemCard.dc.html`: the card component, with the final front layout. `ItemCardAnatomy.dc.html` is the labeled reference for tool, clothes and food cards. `ItemCardsArt.dc.html` shows 12 real cards, and `ItemCards.dc.html` the backs.

---

## 1. How to read `03-items.md`
- **(X a/b/c/d/e)** is a value at Quality 1/2/3/4/5. Store it as `qualityScale([a, b, c, d, e])`. Many values only change at Quality 1 and 5. A 0 means the bonus is missing at that Quality.
- **Y[a–b]** is a random roll each time the item is used (the Vente Coffee Misto's three rolls, Mystery Meat).
- **[Brackets]** are rules for the game, not card text. **[first guess]** numbers go in `balance.ts` with `TODO(wyatt)`.
- **Uses** (tools), **bites** (food) and **durability** (clothes, in days) all come from Quality. Clothing durability by tier is in the Crafting section.
- **The "At Quality 1" column** (food): plain food gets a chance of a negative condition, usually Food Poisoning, and food with a bonus loses it.
- **Look at** a challenge = the player sees it, but the tile stays unrevealed. **Reveal** = the tile is revealed.
- The "Suggested" tables and lines are ideas without art. Build them as `placeholder: true` items, or skip them. **Ask Wyatt.**

## 2. What to build (Phase 8)
Everything in the old Phase 9 section of `BUILD_PLAN.md`, plus:

**Crafting**
- **Generic craft:** each type's basic recipe from the Crafting table. One **key** resource (pick from 2) plus a **broad** part (any mix from a wide group). Trinkets: 5 random different resources, re-rolled after every trinket. Tier 2 adds 1 key and 1 broad; Tier 3 adds 2 of each.
- **Blueprint recipes:** each item's own recipe from its table row.
- **Resource packs** craft from 5 resources of their type (or any 5 for the Resource Pack). They're a way to swap unwanted resources.
- "Not crafted" items only come from finds, shops or events.
- **The Tailgate and Lodge shelters** give +1 Quality to food, or to tools and clothes, crafted on their tile.

**Items**
- **Tools:** Uses count down. Removed at 0.
- **Clothes:** three slots, **Gear, Body and Feet**. Feet takes shoes *or* socks. Anyone can wear anything (the Harness is no longer Dogs-only). Durability ticks down at camp, and some effects cost extra.
- **Food:** eating is a free action. Food with several bites is eaten one bite at a time.
- **Shelters:** placed on a tile and gone after their nights. Every shelter is a basic shelter (+1 Energy when sleeping, protection from night events, Drizzle and Sheer Cold), plus its own effect.
- **Trinkets:** marked **Use** (consumed) or **Keep** (works while carried). Trinkets that touch traits, slots or XP (the three Photos, Instruction Manual, Diploma, Postcard, Textbook) need Phase 10. Build them as data now and mark the effects `TODO(phase 10)`.
- Effects run through the shared effect engine and the trait/item hooks, never through name checks.

**Item cards** (follow `ItemCard.dc.html` and `ItemCardAnatomy.dc.html`)
- The item art sits centered in the cloud window of the front background.
- **The title** is in Edit Undo, centered at the top of the text section. Under it: the type (plus slot for clothes), then the effect in DM Sans, written with this card's actual Quality values.
- **The tier** shows as a roman numeral at the top center of the card, colored by tier:
  - Tier I shows nothing;
  - II is silver;
  - III is gold;
  - IV is a rainbow mix (Luck only).
- **The bottom row** has Quality diamonds on the left and a labeled counter on the right:
  - tools: **USES** as squares;
  - clothes: **DURABILITY** as thin bars, one per day;
  - food: **BITES** as circles.
  - Filled pips are what's left; hollow pips are used.

**Hidden challenges** (a setting for Wyatt to try)
- Add `CHALLENGE_SHARE` per biome in `balance.ts`, **defaulting to 1.0**, so nothing changes until Wyatt lowers it. At less than 1.0, only that share of a biome's tiles get a challenge.
- Opportunities and Trials only happen on tiles that have a challenge.
- Wonders are always extra.
- The scouting tools marked \* in `03-items.md` (Scanner, Security Camera, Minesweeper, Linescan, Radar Scanner) read this.
- Scanner animation: a red hexagon line zooms out from the tile's center to its edge, like a radar sweep. A small red ! appears on tiles with a challenge.
- Minesweeper and Linescan show colored numbers that fade away, not a pop-up window.

**Debug panel:** give any item at any tier and Quality, and refill uses, bites and durability.

## 3. Ask Wyatt first
- Whether to build the "Suggested" items as placeholders now, or skip them.
- Anything marked [first guess]: shelter nights, Diploma XP, Postcard XP, and the higher-tier recipe costs.
- The Quality roll odds (the plan says 10/20/40/20/10%) and how much Luck shifts them.
