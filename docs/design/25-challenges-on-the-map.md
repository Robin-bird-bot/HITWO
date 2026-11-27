# Challenges on the trail map: the pool, the Trail Infoboard, and minigames on tiles

Wyatt (November 26): "If we have enough to start implementing the minigames into the game, then let's do that. We can make general guesses to costs and things so far, and then choose them after playtesting."

This hooks the reset challenge list (`24-challenges-reset.md`) into the real game:
- each biome picks a **pool** of challenges and places them on its tiles when it's made;
- the **Trail Infoboard** shows the pool on the trailhead tile;
- **minigame challenges** run from tiles, with real packs, and their results change the save;
- **cost cards** use the existing card system, with the new costs and punishments.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Ideas marked *(Claude's idea)* are mine.

---

## 1. The biome's challenge pool, placed when the biome is made (Wyatt)
Today a tile's card is picked when someone lands on it (`pickForTile`), and a section never repeats a card (`usedCards`). Both change: the Infoboard and Wyatt's Game Sight (`26`, section 5) need to know what each tile holds ahead of time.

- **When a section is made:** right after `placeCards` picks the challenge tiles (`src/engine/trail/generate.ts`):
  1. **Roll each challenge tile's tier** as today (`rolledTier`: seeded by run, section and tile, so it never changes).
  2. **Pick the pool:** [challenge tiles ÷ 2.5, rounded up] challenges, at least [3] and at most [7].
     - Only cards whose nodes fit at least one of the section's challenge tiles, and whose "From" tier is at most the highest tier rolled there.
     - Snow-only cards only when the section is snowy (`state.snowy`).
     - **The mix:** cost cards make up [40%, 30%, 25%] of the pool in the 1st, 2nd and 3rd biome; the rest are minigames *(Claude's idea: Wyatt wanted general costs especially early)*.
  3. **Place them:** give every challenge tile one pool card that fits its nodes and tier.
     - Spread them so every pool card gets at least one tile when the tiles allow, then favor cards with fewer tiles.
     - A tile that no pool card fits gets a fitting card from outside, and that card joins the pool (and the Infoboard).
     - **Choice spaces** get two different pool cards. **Challenge spaces** play their card one tier higher, as now.
  4. **Store it on the tile,** hidden (for example `tile.card = { cardId }`), and save it.
- **Landing on the tile** opens its placed card (like `revealedCard` does today).
  - Its numbers are rolled then, as now.
  - **Gates you can't know ahead** (a Dog on the tile, "each hiker with no clothing on"): if the placed card's gate fails when the hikers land, play another pool card that fits the tile, and move the placement.
- **Scouting** (Scout traits, Old Firewatch Tower, Rule Changer) shows or swaps the placed card.
- **Repeats are fine** (Wyatt): drop the `usedCards` rule for challenges. Opportunities keep theirs.
- **Opportunities and Trials** don't change.

### 1.1 Retiring the old challenges
- **Remove every `kind: 'challenge'` card in `src/content/challenges.ts`** that isn't in `24-challenges-reset.md`, section 4.
  - Keep the 6 old cards that stay: Fox with a Specific Taste, Tummy Rumbling, Tourist Trap, Black Cat, Crow Collector and Leeches. The new Heavy Pack reuses Rocky Path's carry-limit code (`carryLimit`).
  - Keep their art files; the new list reuses them as "art for now".
  - Keep opportunities and Trials.
- **Risk cards:** keep the code (`risk.ts`), but no risk card is in the list for now (Wyatt).
- **The 45 minigame challenges** go in `src/content/minigameChallenges.ts`, one each.
  - Each gets: the game, how its version follows the tile (24, section 4), its nodes, its "From" tier, its punishment, its art for now, and its Prepare extras.
  - `BEAR_COUNTRY` becomes **Gun Bear Attack!** (it keeps the poster and SKIP IT).
- **Update `04-challenges.md`:** a note at the top saying the challenge list moved to `24-challenges-reset.md` (Opportunities and Trials still live there).

---

## 2. The Trail Infoboard (Wyatt)
A trailhead kiosk on the first tile of every biome, like the boards at the start of real hikes (Wyatt's photos). **The reference is the prototype:** `docs/mockups/infoboard/prototype.html`, plus screenshots in the same folder. Match its look and its animations.

- **On the map:**
  - a small kiosk sits on the trailhead tile (a placeholder icon is fine until there's art);
  - **it only opens from there** (Wyatt): click it while a hiker stands on the trailhead tile.
- **The window** (as in the prototype):
  - a shingled roof with moss along the rows;
  - a header board with the biome's name routed in gold ("MEADOW TRAILHEAD · TRAIL INFORMATION");
  - the ranger station's wood and brass (`StationScreen.module.css`, `.wood` and `.brass`) for the frame and the posts;
  - a cork back panel;
  - a printed map of this biome in the middle;
  - a couple of small notices ("PACK IT IN, PACK IT OUT").
- **Posters,** one per pool card, pinned around the map:
  - **[2] are pinned face up at the start** (or a third of the pool, rounded down, whichever is more);
  - the rest are pinned **face down**, as blank notes with a "?" and "1 CAP TO PIN", so players know how many there are *(Claude's idea)*;
  - a poster shows the challenge's art (cropped to fit; its poster once Wyatt paints one), its name, MINIGAME or COST CARD, and the tier.
- **Hover** (or tap) a face-up poster for a dark tooltip with:
  - the name and tier;
  - the description;
  - for a minigame: "MINIGAME: <game> · PREPARE: <its categories>" *(Claude's idea: what to stock up on)*;
  - for a cost card: "COST CARD · PAYS WITH: <what it takes>".
- **The tip boxes:** two wooden boxes stand on the shelf, each with a slot on top and a brass plate (acorn-cap icon, price, label).
  - **[1] cap, "PIN ONE MORE":** a random face-down poster flips over and its pin pops in. When all are up, the box shows "ALL POSTED" and stops working.
  - **[3] caps, "WHERE IS IT?":**
    - the posters glow, and "WHICH ONE? PICK A POSTER" shows;
    - picking one reveals the **nearest unrevealed tile** holding that card: its card shows on the map, as an Old Firewatch Tower reveal does;
    - the window shows where (the prototype's map card), then closes, the map pans to the tile, and a pin drops on it;
    - a poster with no unrevealed tiles left is stamped "ALL FOUND" and can't be picked.
  - **Paying:** caps come from the party purse.
  - **The acorn animation:** an acorn cap arcs from the purse to the slot, spinning, drops in with a little bounce and a clink, and the box jiggles.
  - **Not enough caps:** the box shakes and its price turns red.
- **Saved per biome:** which posters are face up and which tiles were found. A new biome starts with a fresh board.

---

## 3. A minigame challenge on a tile
### 3.1 The flow
1. **Hikers land on a tile** whose placed card is a minigame challenge. It opens as today (`state.challenge`, queued if another one is open), marked as a minigame.
2. **GameScreen shows the challenge pop-up** (`MinigameFlow`, not in test mode) instead of the cost-card panel:
   - **Banner:** the challenge's name and tier (I to V); on the right, the names of the hikers on the tile instead of "WHOLE PARTY".
   - **Poster:** its art for now (the challenge picture, cropped to 2:3), or its painted poster.
   - **Flavor:** the challenge's description.
   - **IF YOU FAIL:** the challenge's punishment, with its numbers rolled.
   - **Prepare:** the real packs of the hikers on the tile (resources, and items with their uses). Costs use the categories (24, section 5).
   - **The line-up and the game** are as in the testing tab, with these hikers' colors and portraits.
3. **After Continue** on the end screen, the UI sends one action (for example `resolveMinigameChallenge { tileId, result, fills }`). The engine then:
   - checks and spends the Prepare fills, all or nothing (like `resolveChallenge`);
   - applies the game's own costs from the result (`pays`: energy per fall in Rock Climb, what Raccoon Shuffle or Squirrel Theft stole);
   - gives each hiker who **passed** XP: `passXpPerTier` × the tier, as cards do now;
   - gives each hiker who **failed** the challenge's punishment (24, section 2), with the backup rule.
   - **Passing challenges:** failed hikers first go back to the tile they came from (`cameFrom`). If nobody passed, the challenge stays face up on the tile, as `passing.ts` says.
   - **Other games:** once played, the tile is clear.
   - It logs what happened, like cards do.
4. **SKIP IT** (Gun Bear Attack!): passes everyone without playing, as in the testing tab.
5. **Saving:** while the pop-up is up, the challenge stays open in the save. A reload opens the pop-up again, and the game starts over: nothing is saved mid-game.
6. **Choice spaces:** the choice panel shows both cards, with MINIGAME or COST CARD on each. Picking a minigame opens its pop-up.
7. **Who plays:** the hikers on the tile who take part in challenges. The existing rules still apply: Trespasser and Prepper hikers sit it out.
8. **The tier:** minigames play at the tile's tier, I to V, with no card-tier mapping.

### 3.2 Testing tools (Settings → Testing) *(Claude's idea)*
- **Minigames only:** pools have no cost cards.
- **Auto-pass minigames:** a minigame challenge passes everyone without playing.
- **Show placed cards:** every tile shows its placed card on the map.

---

## 4. Cost cards: the new costs and punishments
Cost cards keep using today's card system (`resolve.ts` and the challenge panel). Add these:
- **Resource categories** (24, section 1) in `src/content/resources.ts`: Food, Building, Fiber, Fire, Trinkets. Wood and Metal are in two.
- **Tiers:** a cost card's numbers are written for its "From" tier and scale up by `tierScale` for each tier above it.
- **New costs** (`Requirement`):
  - `ResourceFilter.categories`;
  - **your most:** X of the resource that hiker has the most of (for a party card, the party's most among hikers on the tile; ties: the player picks);
  - **singles:** every resource the hiker has exactly 1 of (at least 1, or it can't be paid this way);
  - **big stacks:** 1 of each resource the hiker has 3 or more of;
  - **variety:** 1 each of X different resources;
  - **mixed bag:** 1 from each of X different categories;
  - **picked from your packs:** Fox's `randomOf` now picks from resources the hikers on the tile carry, not from all 16 (Wyatt).
- **New punishments** (`EffectOp`): lose singles, lose big stacks, lose your most (half, rounded up; all of it at Tier III and up), and lose X of a category.
- **The backup rule,** in `applyEffects`, for every loss:
  - each thing that can't be taken becomes 1 Energy;
  - a loss that takes nothing at all costs X Energy for the tier;
  - a hiker who would go below 0 Energy gains 1 injury instead (once per challenge).
- **On the card,** these costs name what they mean for each hiker: "1 of your most (Fish)", "your singles: Wood, Clay, Shell".

## 5. Prepare in the real game
- **Category costs** in `src/minigames/prepare.ts`: add `{ kind: 'category', id }` next to `'group'`, and show it as "×1 FOOD" and so on.
- **The Prepare inventory** shows every stack from the hikers on the tile that fits.
- **Items** lose a use, as in the testing tab.
- **Wyatt's free first slot** (`26`, section 5) hooks in here.

---

## 6. Tests
- **Placement:**
  - every challenge tile has a placed card that fits its nodes and tier;
  - every pool card is on at least one tile when there are enough tiles;
  - the same seed places the same cards;
  - snow-only cards only appear in snowy sections.
- **A failed gate** moves the placement to another fitting pool card.
- **Infoboard:**
  - it only opens on the trailhead tile;
  - PIN ONE MORE flips one face-down poster and costs [1] cap;
  - WHERE IS IT? reveals the nearest unrevealed tile with that card and costs [3];
  - ALL FOUND and ALL POSTED stop the boxes;
  - not enough caps changes nothing.
- **Minigame challenges:**
  - Prepare spends exactly the fills, from the right hikers;
  - passers get XP, and failers get the punishment;
  - failed hikers on a passing challenge go back first;
  - nobody passing leaves the challenge face up;
  - a reload reopens the pop-up.
- **The backup rule:**
  - a hiker with none of a category pays Energy instead;
  - going below 0 Energy is an injury, once per challenge.
- **New costs:** your most, singles, big stacks, variety, mixed bag and picked-from-your-packs each pay and refuse correctly.
