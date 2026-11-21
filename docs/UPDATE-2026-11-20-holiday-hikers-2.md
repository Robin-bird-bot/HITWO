# Update: November 20, 2026 (holiday hikers, revised)

This **replaces** the first holiday zip (`update-2026-11-20-holiday-hikers`). It has everything that one had, plus Wyatt's changes. Build it **after Phase 10b** and its follow-ups (icons, polish, family).

- **If the first holiday zip was never applied:** skip the "Changes" section at the end and build sections 1–7.
- **If it was applied (fully or partly):** read the "Changes since the first holiday zip" section at the end first. It lists everything to change. Then check sections 1–7 against what's built.
- **Where this disagrees with the 10b-family update or the first holiday zip, this one wins.**

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Nothing here needs Wyatt's answer before building.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `07-characters.md` → `docs/design/07-characters.md` (replace).
- `03-items-presents.md`:
  - if `docs/design/03-items.md` has no **Presents** section yet, add this file's contents as a new section just before "Older items";
  - if it already has one (from the first holiday zip), replace that section with this file's contents.
  - Then delete this file.
- `assets/portraits/*.png` and `portraits.json` → `public/assets/portraits/` (add the new files, replace `portraits.json`).
  - If `planner-wink.png` is there from the first holiday zip, delete it. It's now `prepared-wink.png` (same picture).
- `assets/items/presents/*.png` → `public/assets/items/presents/`.
  - The 5 wrapping colorways (candy cane, holly, lilac, midnight, berry).
  - They're on the same 1500 × 2100 item-card canvas as Wyatt's other item art, so use them exactly the way the other item art is used.
- `assets/cards/forest.png` and `pixel-pattern.png` → `public/assets/cards/` (replace).
  - Same art at twice the resolution (1600 × 930), so the card backgrounds stay sharp. Nothing else changes.
- Then delete the leftover `update-2026-11-20-holiday-hikers-2/` folder (and `update-2026-11-20-holiday-hikers/` if it's still there).

---

## 1. Variant art
These variants now have real portraits, framed for the card window like the others:
- Follower Finn and Agility Finn;
- Ellie the Devourer and Nosework Ellie;
- Prepared Wink and Graduate Mom;
- Showqueen Gdog.

Use them instead of the star placeholder. The variant star next to the family icon stays.
- The costume art is framed to fit the whole costume, so these portraits aren't on the same head scale as the rest. That's on purpose. **Don't rescale them.**
- `portraits.json` has a `faceY` for every one of them.
- Ben and Mindy still use their family icon.

## 2. Renames
- **Showgirl Gdog → Showqueen Gdog**, everywhere: data, id (`showqueen-gdog`), UI text and docs. Her **Show Girl** trait keeps its name.
- **Planner Wink → Prepared Wink**, everywhere: data, id (`prepared-wink`), UI text and docs. His title stays **"The Planner"**.

## 3. Presents (new item)
The full rules are in `03-items-presents.md`. How to build them:

- **Data:** a new item category, `present`.
  - Each Present stores:
    - `colorway`: 1–5, picked at random when it's wrapped;
    - `wrappedBy`: the hiker id;
    - `grade`: `'plain'`, `'tier2plus'` or `'tier3'`, set by the recipe it was wrapped with.
  - No Tier and no Quality. Hide the tier numeral and the Quality pips on its card.
- **Never in a random pool:** keep Presents out of scavenging, shops (including both Rocco shops and the used-or-lost log), bundles, Mystery Items, night events, challenge and Wonder rewards, and starting resources. They only come from Grammy Clause and the starting bags below.
- **Card:**
  - name "Present";
  - its colorway art;
  - text: "Open: your action and 1 Energy. Get a random item.";
  - a `tier2plus` Present adds a small "Tier 2+" tag, and a `tier3` one a "Tier 3" tag, in the spot where the tier numeral usually sits.
- **Opening:**
  - **Cost:** the hiker's action and 1 Energy. Disabled when they have no action or no Energy, and always for Grammy Clause (tooltip: "Grammy can't open her own Presents.").
  - **How:** an **Open** button on the card, or drag the Present onto the hiker's own portrait.
  - **Tier, by grade** (ignoring the biome's tier limit):
    - `plain`: Tier 1 [50%], Tier 2 [35%], Tier 3 [15%];
    - `tier2plus`: Tier 2 [70%], Tier 3 [30%];
    - `tier3`: Tier 3.
  - **Item:** then any item of that tier, all types equally likely per item, Presents excluded. Its Quality rolls on the plain curve.
  - **Animation:** the box shakes, the lid pops, and the item card flips in (reuse the Mystery Item flip). Under reduced motion, just swap.
  - **Where the item goes:** into the opener's pack, using the normal full-pack rule.
- **Selling:** stations won't buy Presents [first guess]. Giving and trading work like any item.

## 4. The holiday hikers
Four new **variants**, all unlocked for now, with the full kits in `07-characters.md` under "Holiday hikers". The no-cloning rule applies: Grammy Clause can't join with Gdog, Lelf with Leah, the Grinch with Ellie, or Redolf with Cody.

**The Grinch is a she** (she's Ellie). Use she/her in every text about her: tooltips, logs, trait text.

| Hiker | Title | Variant of | Family | Roles (main first) | Slots | Traits | Starting bag | Difficulty | Household |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Grammy Clause | The Festive | Gdog | Human | Crafter, Support | U, U, U, M | Gift Wrapper, Down the Chimney, Checking It Twice, Season of Giving | 2 plain Presents | 6 | Holiday |
| Lelf | The Little Helper | Leah | Human | Crafter, Support | T, U, U, M | Short, Toy Maker, Spare Parts, Holiday Spirit | 1 random Tier 1 tool blueprint | 4 | Holiday |
| Grinch | The Grumpy | Ellie | Dog | Scavenger, Jack | U, U, T/U, M | Choosy, Two Sizes Too Small, Wreck the Halls, Bah Humbug | 1 plain Present | 5 | Holiday |
| Redolf | The Rednose Retriever | Cody | Dog | Tank, Scout | T, U, U, M | Rednose, Treat Sniffer, Present Muncher, Holiday Spirit | Camping Lamp | 4 | Holiday |

Their portraits are `grammy-clause.png`, `lelf.png`, `grinch.png` and `redolf.png`.

**New traits.** The usable ones get round badges. None has icon art yet, so use the placeholder icon until Wyatt sends it.

| Trait | Type | Usable | What to build |
| --- | --- | --- | --- |
| Gift Wrapper | Utility, unique | No | Grammy's crafting window shows **only** Present recipes. No blueprints appear, and she can't craft anything else. She can't open Presents. Luck and Quality don't apply. Four recipes, see the box below. |
| Down the Chimney | Utility, unique | Yes, once per day, free | Send a Present from her pack to any hiker on the map who has room. |
| Checking It Twice | Utility, unique | Yes, once per day, free | Reroll both of her wish lists. |
| Season of Giving | Morale, open to all | No | +1 Morale when anyone opens a Present with her `wrappedBy`. −1 at the start of a day if she wrapped none the day before. |
| Toy Maker | Utility, special | No | When she opens a Present, Tools are [3×] as likely. |
| Spare Parts | Utility, unique | Yes, free, no limit | Take apart a Present in her pack for [2] resources of her choice (resource picker). |
| Holiday Spirit | Morale, open to all | No | +1 Morale each time a hiker on their tile opens a Present. −1 at the start of a day after nobody in the party opened one. |
| Choosy | Utility, unique | No | When she opens a Present, roll 3 items (each by the normal rules for that Present's grade) and she keeps 1. Show the 3 cards side by side and let her pick. |
| Two Sizes Too Small | Utility, unique | No | She can't give or trade **items** to other hikers: her items don't light up other portraits as drop targets, and give or trade buttons are disabled (tooltip: "The Grinch doesn't share."). Receiving, using, dropping and selling still work, and so does giving resources. |
| Wreck the Halls | Utility, unique | Yes, free, no limit | Destroy a Present in her pack for a random [3–8] Morale (whole numbers, all equally likely), capped at her maximum. Works on any grade of Present. Short smash animation (the box bursts into confetti); under reduced motion, just remove it. |
| Bah Humbug | Morale, special | No | +1 Morale each time she opens a Present. −1 each time another hiker on her tile Sits by the Fire. |
| Rednose | Trail, unique | No | When he moves the group at night, nobody pays the extra night cost. Fog (Phase 11) never hides the tiles next to him. If Fog isn't built yet, leave a hook and a `TODO(phase-11)`. |
| Treat Sniffer | Utility, special | No | When he opens a Present, Food is [3×] as likely. |
| Present Muncher | Utility, unique | Yes, free, no limit | Eat a Present from his pack for a random [0–5] Appetite (whole numbers, all equally likely), capped at his maximum. |

**Gift Wrapper recipes.** Show all four in Grammy's crafting window:

| Recipe | Cost | Makes |
| --- | --- | --- |
| Same resource | 3 of one exact resource (e.g. 3 Pinecones) | a `plain` Present |
| Same type | 5 resources of one type (Forest, River, Mountain or Wildlife), mixed any way | a `plain` Present |
| Small wish list | the 3 specific resources on her **3-resource wish list** | a `tier2plus` Present |
| Big wish list | the 5 specific resources on her **5-resource wish list** | a `tier3` Present |

- **Wish lists:** each is a random list of specific resources (repeats allowed), drawn from every resource in the game. Roll both at the start of the run, and roll **both** again after **every** Present she wraps (any recipe) and when she uses Checking It Twice. Save them with the run, and show each list's resource icons on its recipe.
- The first two recipes are cheap but plain. The wish lists are where the good Presents come from.

Trait icon files will be named `gift-wrapper.png`, `down-the-chimney.png`, `checking-it-twice.png`, `wreck-the-halls.png` and so on, when Wyatt sends them.

## 5. Sorting and selection
**Family sort: new rule for variants.** This replaces the 10b-family rule that variants follow their base hiker.

- **All variants go in OTHER**, unless a family is set for them. This keeps the family groups to the real family.
  - That includes Wywee, Follower Finn, Agility Finn, Ellie the Devourer, Nosework Ellie, Graduate Mom, Prepared Wink and Showqueen Gdog.
  - **Wywee is a variant** (of Wyatt). Make sure he's flagged as one everywhere: the variant star on his card, the VARIANTS filter, and the no-cloning rule with Wyatt.
- **New ribbon: HOLIDAY** `#A8233A`, between LEICHTY and OTHER. Hikers in this order: Grammy Clause, Lelf, Grinch, Redolf.
- The ribbons are now **ELMERS, BROOKS, SHERMAN, LEICHTY, HOLIDAY, OTHER**.
- In the data, keep the `households` list per hiker. Variants get `['other']` by default, and the four holiday hikers get `['holiday']`.

**Difficulty sort:** use the ratings in the table above.

**VARIANTS filter:** all four holiday hikers and Wywee show up under it.

## 6. Debug panel
- Give any hiker a Present, with a chosen colorway and grade (`plain`, `tier2plus`, `tier3`).
- Reroll Grammy's wish lists, or set them by hand.

## 7. Tests
- **Gift Wrapper:**
  - Grammy can only craft Presents, with each of the 4 recipes, and each makes the right grade;
  - "5 of the same type" accepts any mix of one type and rejects a mix of types;
  - both wish lists reroll after every Present (any recipe), and survive a save and load;
  - she can't open Presents.
- **Checking It Twice:** rerolls both lists, once per day.
- **Never in a random pool:** Presents never come from scavenging, shops, Rocco, bundles, Mystery Items, events or rewards.
- **Opening:**
  - costs the hiker's action and 1 Energy;
  - uses the tier odds for its grade, ignoring the biome limit;
  - a `tier2plus` Present never gives Tier 1, and a `tier3` Present always gives Tier 3.
- **Toy Maker and Treat Sniffer:** tilt the item type the way they describe.
- **Choosy:** shows 3 items of the Present's grade and keeps the chosen one.
- **Two Sizes Too Small:** blocks giving and trading items, but not receiving.
- **Usable traits:**
  - Down the Chimney works once per day;
  - Spare Parts gives 2 chosen resources;
  - Present Muncher gives 0–5 Appetite;
  - Wreck the Halls removes the Present and gives 3–8 Morale, capped at her maximum.
- **Holiday Spirit, Season of Giving and Bah Humbug:** Morale changes at the right moments.
- **Rednose:** no extra night cost for his group moves.
- **Renames:** no "Showgirl Gdog" or "Planner Wink" is left anywhere.
- **Family sort:** 6 groups in the right order; every variant except the holiday hikers lands in Other; the holiday hikers land in Holiday; Mom still shows in both Elmers and Brooks.
- **No cloning:** each holiday hiker is blocked with their base hiker, and Wywee with Wyatt.

---

## Changes since the first holiday zip
Only needed if the first holiday zip was already applied, fully or partly.

1. **Planner Wink → Prepared Wink.** Rename the variant, its id (`planner-wink` → `prepared-wink`), its portrait file and its `portraits.json` entry. His title "The Planner" stays.
2. **Family sort.** Variants no longer follow their base hiker. They all go to OTHER, except the four holiday hikers, who get the new HOLIDAY ribbon (`#A8233A`). Wywee is a variant. See section 5.
3. **Grammy's recipes.** The 2-resource list is gone. Instead, there are two wish lists: 3 specific resources make a Tier 2+ Present, and 5 specific resources make a Tier 3 Present. Both reroll after every Present.
   - The plain recipes (3 of the same resource, or 5 of the same type) now make a **plain** Present. Before, 5 of the same type made a better one.
   - Replace the Present's `stuffed` flag with `grade` (`plain`, `tier2plus`, `tier3`). For old saves, a Present with `stuffed: true` becomes `tier2plus`, and one without becomes `plain`.
4. **Stocking Stuffer is gone.** Grammy's third trait is now **Checking It Twice**: usable once per day, free, it rerolls both wish lists.
5. **The Grinch is a she.** Fix the pronouns in every text about her.
6. **Sticky Fingers is gone.** The Grinch's third trait is now **Wreck the Halls**: usable, free, no limit. It destroys a Present in her pack for a random 3–8 Morale.
7. **Debug panel and tests:** update them to match (sections 6 and 7).
