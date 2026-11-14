# Update: November 13, 2026 (station themes for Phase 9 step 2, plus starting resources)

Wyatt's final station design. **Read this before step 2.** It replaces the station theme plan you had. There are now **9 themes, not 5**, and the shop rules are the same at every station.

**New files in this commit**
- `docs/design/06-ranger-stations.md`: every station theme, its stock and the shop rules (Quality, prices, market, selling). **This is the source of truth for stations.**
  - Add it to the "Where things are" table in `CLAUDE.md`.
  - In `01-design-doc.md`, the station theme paragraph, the example themes and "the nine existing Ranger Station cards become themes" are out of date. Replace them with one line pointing to `06-ranger-stations.md`.
- `assets/shopkeepers/*.png`: the shopkeeper portraits. Copy them into `public/assets/shopkeepers/`.
  - Each one is 465×800 with a transparent background. They're all drawn at the same scale and anchored at the bottom, so they stand behind the counter as they are. Don't trim or rescale them one by one.
  - `serious-businessman-arm.png` is a second layer, just his resting arm, in the same 465×800 frame. It goes **in front of** the counter, on top of `serious-businessman.png`.
  - `lineup.png` is only a reference. Don't ship it.

---

## 1. What changed from the old plan
- **9 themes:**

  | id | Station name (the hanging sign) | Shopkeeper | Portrait |
  | --- | --- | --- | --- |
  | `finn` | Fancy Finn's Fashion Franchise | Finn | `fancy-finn.png` |
  | `chefBear` | Chef Bear's Garbage Grill | Ellie | `chef-bear-ellie.png` |
  | `wink` | Sleepy Wink's Pillow Fort | Wink | `sleepy-wink.png` |
  | `businessman` | Serious Businessman's Sophisticated Selection | The Businessman | `serious-businessman.png` + `-arm.png` |
  | `roccoBoutique` | Rocco Raccoon's "Borrowed" Boutique | Rocco | `rocco-raccoon.png` |
  | `roccoResale` | Rocco Raccoon's Random Resale | Rocco | `rocco-raccoon.png` |
  | `drSckhunk` | Doctor Sckhunk's Support Service | Dr. Sckhunk | `doctor-sckhunk.png` |
  | `bearEI` | BeaR E I | Hoomhen Bean | `bear-e-i.png` |
  | `bearnes` | Bearnes and Nobles | Bearry | `bearnes-and-nobles.png` |

  Rocco runs two of them, so there are 8 shopkeepers.
- **No repeats in a run.** Each checkpoint gets a random theme not used yet this run. The two Rocco shops are separate themes, so both can show up in the same run.
- **No signature services and no exclusive items** for now. They're parked in the doc. The nine old Ranger Station card services are parked too.
  - Keep the **shared specials**: 1 random per visit (Cement Mixer, Taxi Service, Scout Report and so on), with the animated gold border.
- **Same rules at every station.** A theme only changes *what* is for sale, never Quality, prices or the market.
- **The shopkeeper art** replaces the placeholder behind the counter. The hanging sign shows the station name.
- **Dialogue:** each theme gets placeholder greeting lines (`placeholder: true`) written in its shopkeeper's voice. Use the quote in the doc as the first line. The personalities are in the doc: Wink only talks through snores, Ellie shouts, Bearry whispers, and so on.

## 2. The shop rules (all in `balance.ts`, `TODO(wyatt)` on the bracketed ones)
- **Item count:** 6 at the first station, +1 at each later station, at most 10 (`STATION_ITEMS_BASE = 6`, `STATION_ITEMS_STEP = 1`, `STATION_ITEMS_MAX = 10`).
- **Each item slot:**
  - an [8%] chance to be a trinket, using the theme's trinket weights;
  - otherwise the first [4] slots come from the theme's focus, and the rest from anything;
  - featured items are [3×] as likely;
  - which tiers depend on the biome, as in the doc.
- **Blueprints:** 3 from the theme's blueprint pool.
- **Resource bundles:** [2] (3 resources each).
- **Quality:** every shop item rolls the plain curve, [10 / 20 / 40 / 20 / 10%]. Luck and traits don't touch shop Quality.
- **Buying:**
  - Tier price × Quality multiplier, rounded to the nearest cap: Tier 1 = 4, Tier 2 = 8, Tier 3 = 14; Quality 1–5 = ×0.5 / ×0.75 / ×1 / ×1.25 / ×1.5. The full table is in the doc.
  - Blueprints cost 1.5× the item's Quality 3 price. A bundle costs [4].
- **Market (replaces the old theme-based market):**
  - Rolled fresh every visit, the same way for every theme: [4] random resources sell for ×2, [4] other random resources sell for ×0.5, and the rest sell at the normal price.
  - The "What's selling?" chips show **×2** (green) and **×½** (red) instead of flat +X/−X.
- **Selling an item:** half its new price (tier × Quality), times what's left (uses, bites or durability ÷ full), rounded down, at least 1 cap. Shelters and trinkets sell for the full half. The doc's example (a Tier 2, Quality 4 jacket with 5 of 7 durability left, sold for 3 caps) should be a test.

## 3. The special themes
- **Featured lists:** the item names match `03-items.md`. Skip any item that isn't built yet (Hot Cocoa and Lemonade are "Suggested"). Puked Nuggets are sold only by Chef Bear, never in another shop's "anything" slots.
- **Focus for the mixed themes:** Dr. Sckhunk, BeaR E I and Bearnes don't use one item type. Their focus is an explicit item list (the featured list), and their blueprint pool is the same list.
- **Bearnes trinkets:** when a slot turns into a trinket here, the Diploma, Textbook and Instruction Manual are [3×] as likely.
- **Rocco's "Borrowed" Boutique** needs a **used-or-lost log** for the run:
  - **Counts:** an item is removed because its uses, bites or durability ran out, a shelter's nights end, a Use trinket is used, or it's stolen or lost by any event. Record the item id and add 1 to its count.
  - **Doesn't count:** selling.
  - **Stock:** if the log has as many different items as he has item slots or fewer, he stocks all of them and fills the rest with random items. If it has more, he takes the ones with the lowest counts, breaking ties at random.
  - **The items:** fresh copies with a new Quality roll and full uses, bites or durability. The biome's tier limit doesn't apply to them. The 8% trinket chance only applies to the random fill slots.
  - **Blueprints:** 3 of anything.
- **Rocco's Random Resale:**
  - **Mystery Items:** every item slot is face-down, showing the card back (`ItemCards.dc.html`) with only the tier numeral. The item and its Quality are rolled when the shop is stocked and hidden until bought. Then the card flips over (a simple flip; under reduced motion, just swap the card).
  - **Price:** the tier's Quality 3 price.
  - **Blueprints:** 3 Mystery Blueprints, hidden the same way.
  - **Bundles:** [4] bundles instead of 2. Some are resource packs (Forest, Wildlife, River, Mountain or any).
- **Debug panel:** force the next station's theme, reroll the stock, and add items to the used-or-lost log.

## 4. New now: starting resources (small, separate commit)
- When a **new run** starts, give each hiker **4 random resources**. Pick each one evenly from every resource type; duplicates are fine.
- Add `STARTING_RESOURCES = 4` to `balance.ts`, with a comment that this stands in for the start-of-hike rules coming later.
- If a hiker's resource limit is lower than 4, fill up to the limit. Existing saves don't change.
- Add a test.

## 5. Docs and tests
- In `BUILD_PLAN.md` Phase 9:
  - replace "Ask Wyatt first: which station themes to build first, and their stock" with "Themes and shop rules: `06-ranger-stations.md`";
  - change the market chip line to the ×2 / ×½ rule above.
- **Tests:**
  - item count by station number, capped at 10;
  - no repeated theme in a run, and both Rocco shops can appear together;
  - the market is 4 + 4 different resources;
  - the price table and the sell example;
  - the Rocco log rules: selling doesn't count, the lowest counts are picked, ties are random, and empty slots are filled;
  - Mystery Items stay hidden until bought;
  - starting resources.

Nothing here needs Wyatt's answer before building. The bracketed numbers are first guesses for him to tune later.
