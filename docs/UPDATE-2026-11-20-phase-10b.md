# Update: November 20, 2026 (Phase 10b: real hikers, hiker cards, hiker selection and level-up)

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `07-characters.md` → `docs/design/07-characters.md`. It **replaces** the 10a copy. New in it: titles, Catie's spelling, Mitchell's Cat Person, role colors, hidden difficulty ratings and sorting.
- `assets/traits/*.png` → `public/assets/traits/` (159 trait icons, white on transparent, 512 × 512).
- `assets/portraits/*.png` and `portraits.json` → `public/assets/portraits/` (31 portraits, already framed).
- `assets/cards/forest.png`, `pixel-pattern.png` and `family/*.svg` → `public/assets/cards/`.
- `mockups/*` → `docs/mockups/`. **The PNGs show what each screen should look like.** The `.dc.html` files are the editable sources. Their images point to Wyatt's online canvas and won't load locally, so use the files in `assets/`.
- Then delete the leftover `update-2026-11-20-phase-10b/` folder.

**Build on 10a.** If any part of Phase 10a isn't done yet, finish it first, then do this. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Nothing here needs Wyatt's answer before building.

---

## 1. Plan and text
- **`BUILD_PLAN.md`:** fill in Phase 10b with sections 2–8 below, and commit.
- **Placeholder text:** search the whole repo for player-facing text that says "Wyatt will write" (and the same idea worded differently, like "Wyatt writes this" or "to be written by Wyatt"), and replace it with exactly **`Placeholder text`**. That covers game data, UI strings and the docs. Leave `TODO(wyatt)` code comments alone: those mark numbers to tune.

## 2. The real roster
Build every character and variant in `07-characters.md`: families, classes (call them **roles** in the UI), slots, starting traits and starting bags. **Every character is unlocked for now.** The test hikers from 10a stay, dev-only.

- **Data per hiker:** `id`, `name`, `title`, `family`, `roles` (main first), `slots`, `traits`, `startingBag`, `portrait` (or none), `starter` (true for the 10 starters), `variantOf` (for variants) and `difficulty` (hidden, section 6).
- **Changes since 10a:**
  - **Catie**, not Katie.
  - **Mitchell** now has slots U, U, M, M, and his second Morale trait is **Cat Person**.
- **Titles** go under the name, in capitals and quotes:

| Hiker | Title | Hiker | Title |
| --- | --- | --- | --- |
| Finn | The Follower | Catie | The Artist |
| Ellie | Fluffy Not Fat | Melissa | The Bossy |
| Pearl | The Pirate | Leah | The Short One |
| Brutus | Doesn't Know Where He Is | Erin | Modern Art |
| Cody | The King Red | Jackson | The Homebody |
| Duke | The Middle Red | Anni | The Traveler |
| Scarlet | The Bossy Red | Mitchell | Cat Lover |
| Hershal | The Wise Old Man | Nathan | The Singer |
| Sinjon | Tough and Fluff | Madeline | The Crazy Therapist |
| Kai | Crazy Like His Dad | Mom | Doesn't Like Photos |
| Boss & Gracie | Danger Duo | Wyatt | Rain Hiker |
| Pepper | The Troublemaker | Gdog | The Tiny |
| Goldie | The Good One | Grandpa Wink | Always Prepared |
| Loki | The Mean | Grandpa Sherman | Probably Trespassing |
| Coco | The Cat | Muffin | The Cat |

  Ben, Mindy and the variants don't have titles yet. Leave the title line empty for them (no empty quotes).
- **Starting bags:** handed out when a run starts. A starting blueprint is already learned and takes no item slot, and starting items roll Quality like any other item. The 4 random starting resources per hiker (Phase 9) stay as they are.
- **No cloning:** a variant can't join if that hiker, or another of their variants, is already in the party.

## 3. Art
- **Trait icons:** `public/assets/traits/<name>.png`, where the name is the trait's name in lowercase with dashes (`dog-mom`, `just-around-the-next-corner`).
  - **Shared icons:**
    - Puller and Leash Puller use `puller`.
    - Glutton and Human Food use `glutton`.
    - Every [Node] Finder uses `node-finder`, every [Node] Hound uses `node-hound`, and every Thumb uses `node-thumb`.
    - Every Location uses `location`, every Action uses `action`, and every Conservationist uses `conservationist`.
  - **Two Thrill-Seekers:** the Trail trait uses `thrill-seeker`, and the Morale trait uses `thrill-seeker-morale`.
  - Boss & Gracie's Tag Team uses `tag-team`.
  - **Still missing:** Forgetful and Snores. Use the placeholder icon from 10a for those, and for any other trait without a file.
  - Show icons white, tintable with a CSS mask (the card back tints them).
- **Portraits:** each PNG is already framed for the card's portrait window (750 × 620, the window's shape):
  - humans share one head size, and pets share another;
  - Gdog and Leah are short on purpose;
  - cut photo edges that would show are faded.

  Draw each one at the full window size from the top-left. **Don't crop, scale or move them one by one.**
- **`portraits.json`:** gives each portrait's `faceY`, how far down the window the face is (0 = top, 1 = bottom). Use it wherever only part of a portrait shows (the card back, the selection spots, the level-up portrait) so the face stays in view.
- **Portrait background:**
  - `forest.png`, scaled to cover the window, centered;
  - then `pixel-pattern.png` at **20% opacity**, also covering;
  - then the portrait.
- **No portrait yet** (Ben, Mindy and the variants other than Wywee): show the hiker's family icon in the middle of the window, about a third of its width, at 30% opacity.
- **Family icons** (`family/human|dog|cat|plush|duo.svg`): they use `currentColor`. Draw them in `#1A1A1A`. Cat, Plush and Duo are stand-ins until Wyatt draws them.

## 4. The hiker card (one shared component)
Follow `mockups/HikerCards.png`. Sizes below are for a 300 × 420 card, so scale everything together. The font is Edit Undo, except the text inside trait windows and on the back.

- **Front:**
  - **Portrait window** (top 250): the background and portrait from section 3. The family icon sits top left (26 px, 11 px in).
  - **Name band** (white, 52 tall):
    - the NAME in capitals, about 28 px;
    - under it, the "TITLE" in grey `#6A6A6A`, about 13 px.
    - Shrink long names to fit (GRANDPA SHERMAN, ELLIE THE DEVOURER).
  - **Role banner** (17 tall): the role in white capitals on the role's color. A hiker with 2 roles gets **split tabs**, equal width, main role on the left.

    | Role | Color |
    | --- | --- |
    | Tank | `#DC3B44` |
    | Hardy | `#E27A2B` |
    | Scavenger | `#93A33A` |
    | Crafter | `#3A7752` |
    | Scout | `#3E8FC9` |
    | Support | `#F0AB35` |
    | Jack | `#5F7487` |
    | Entertainer | `#D675EF` |
    | Moneymaker | `#1FA39A` |

  - **Trait area** (dark `#2C2C2C`): the trait badges from 10a in one row, diamond or circle, each with its name in tiny capitals in the ring color underneath. An open slot is a faint dashed diamond labeled OPEN.
    - **Hovering a badge** (long-press on a phone) opens the same trait window as 10a: name, type, and what it does.
  - **STARTING BAG tab:** bottom center, in the main role's color. Hovering it shows the bag's contents in a small window.
- **Back:**
  - **Portrait strip** (top 96): the portrait window, shifted up so the face (`faceY`) sits in the middle of the strip.
  - **Name band** (38 tall): the name only.
  - **Role banner.**
  - **One row per trait:**
    - a square in the type's ring color holding the icon, tinted the type's middle color (a round square for usable traits);
    - a strip in the ring color with the name in the middle color, plus a small USABLE tag for usable traits;
    - the description in white on the middle color. Use the trait's short player text.
    - An open slot is a grey row: "OPEN SLOT · Filled on a level-up."
  - **Starting bag:** a brown bar (`#895637`) at the bottom with the bag's contents.
- **Flipping:**
  - The **first click flips** the card to its back, and the next click flips it back. It's a quick flip [0.35 s]; under reduced motion, just swap the sides.
  - **Hovering a flipped card lifts it to the middle** of the screen, larger [1.2×, about 360 × 504], so the back can be read. Moving off drops it back.
  - **On a phone,** long-press a flipped card to open it large, and tap anywhere to close it.
  - **Dragging works from either side.** Use a small movement threshold [6 px] so a click never starts a drag.

## 5. Hiker selection screen
This is the screen for starting a new run. Follow `mockups/HikerSelect.png` and `mockups/HikerSort.png`.

- **Top:**
  - CHOOSE YOUR HIKERS, with the line "Drag a card into a spot. Click a card to flip it, and hover a flipped card to lift it to the middle. Start with 1 to 4 hikers."
  - **RANDOM** fills the empty spots with random hikers, following the no-cloning rule.
  - **START HIKE · N HIKERS** works with **1 to 4 hikers**, and is disabled at 0.
- **4 spots** across the top, one per hiker position, in the game's existing hiker colors (1 orange, 2 blue, 3 yellow, 4 purple), with a HIKER N tab. Spot order is the hiker order in the run.
  - **Empty spot:** a dashed outline with a plus and "DRAG A HIKER HERE".
  - **Filled spot:**
    - the portrait (cropped to show the face, from `faceY`), with a BAG chip and an × button to remove;
    - a white name band with the name and title;
    - the role banner;
    - the trait badges with their names, and the trait windows on hover.
  - **While dragging:** every spot glows (the shared drag system from 9.5), and the hovered spot says DROP TO ADD.
    - Dropping on a filled spot swaps: the old hiker goes back to the list.
    - Dragging a hiker from one spot to another swaps them.
    - Dragging a hiker out of a spot and dropping it anywhere else removes it.
  - **Keyboard and fallback:** Enter (or double-click) on a card adds it to the first empty spot.
- **The list below:**
  - **Filter chips:** ALL, HUMANS, DOGS, CATS, PLUSH, VARIANTS.
  - **Cards in the party** are dimmed, with an IN PARTY tag in their spot's color.
  - **Blocked variants** are dimmed too, tagged with who's already in the party (for example "FINN IS IN").
  - The card being dragged leaves a dashed outline where it was.
- **Sorting:** a SORT control (DEFAULT, CLASS, TRAITS, DIFFICULTY) on the right of the filter row. Remember the last choice in settings.
  - **Default:** the 10 starters first (in the roster order), then everyone else by name. **No ribbons.**
  - **The other sorts** split the list into groups. Each group starts with a **ribbon across the full width of the list**: a colored bar with notched ends, the group name in white capitals on the left, and a small count ("13 HIKERS"). See `mockups/SortRibbons.png`.
    - **Class:** by **main role** only, in the role order above. The ribbon uses the role's color.
    - **Traits:** by how many traits a hiker starts with (open slots don't count): 3 TRAITS `#5C7FA3`, 4 TRAITS `#3F5C82`. If a count turns up with no color yet, use `#2E4766`.
    - **Difficulty:** EASY 1–3 `#4E9A5F`, MEDIUM 4–5 `#C9A227`, HARD 6–7 `#D9642E`, EXPERT 8–10 `#B23A48`.
  - **Order within a group:** by name, or by rating and then name for Difficulty.
  - Filters and sorting combine.

## 6. Hidden difficulty
- Every hiker has a `difficulty` from 1 to 10. The values are in the "Difficulty (hidden)" table in `07-characters.md`; put them in the hiker data.
- **Never show the number** in the game. Players only see the band ribbons when sorting by difficulty.
- **Debug panel:** a dev-only toggle that shows each card's number in a corner, for tuning.

## 7. Level-up screen (replaces the 10a placeholder)
Follow `mockups/LevelUp.png`. The screen appears at the moment 10a decided.

- **No window:**
  - blur everything behind it [10 px] (a backdrop blur);
  - lay a navy overlay over it, `rgba(12, 20, 46, 0.82)`;
  - put the content on top.
- **The opening animation:**

  | Time | What happens |
  | --- | --- |
  | 0.0 s | The blur and the overlay fade in |
  | 0.1 s | The hiker's portrait pops in at the top middle: a circle with a ring in the hiker's color and a soft glow, with the name under it |
  | 0.6 s | The XP bar fills from where it was to full [1.2 s]. "LEVEL N" is on its left, "XP a / b" on its right |
  | 1.8 s | A "LEVEL N+1!" badge pops at the end of the bar |
  | 2.0 s | The new trait cards deal in one by one [0.15 s apart] under "PICK A NEW TRAIT" |
  | 2.5 s | "YOUR TRAITS" slides up from the bottom |

  - **Clicking anywhere during it** skips to the end.
  - **Under reduced motion,** everything just appears.
- **Trait option cards** (240 × 280):
  - a top strip in the ring color with the name;
  - a big badge (diamond or circle) on the type's middle color;
  - the type ("TRAIL · USABLE");
  - the description;
  - a tag at the bottom naming where the option came from: the **role**, in its color, or **WILD CARD · ANY CLASS** for the any-class option.
  - **More than 3 options** (from level 4): shrink the cards to fit up to 6 in one row.
  - A **new slot** option is a card too ("NEW SLOT · TRAIL"). It's dropped onto a "+" spot at the end of the trait row.
- **Your traits:** one tile per slot, each with:
  - the slot type on top (TRAIL, UTILITY, TRAIL OR UTILITY, MORALE…);
  - the badge;
  - the name;
  - a status chip at the bottom.
- **Picking:** drag an option card onto a slot.
  - **While dragging:** tiles the trait fits glow gold. A filled one says **REPLACE**, and an open one says **EMPTY · DROP HERE**. The rest dim and say **CAN'T GO HERE**.
  - **After dropping:** the trait sits in that slot, so the player can still drag it elsewhere or back.
  - **Replacing** removes the old trait for good.
  - **Buttons:**
    - **CONFIRM** lights up once a trait or slot is placed;
    - **KEEP MY TRAITS** takes nothing and closes.
  - Click fallback: click an option, then click a slot.
- **If several hikers level up at once,** show their screens one after another.

## 8. Tests
- **Roster:**
  - every hiker in `07-characters.md` exists with the right slots, traits, roles, title and starting bag;
  - Mitchell has Cat Person;
  - the starting bags are given out at the start of a run.
- **No cloning:** a variant can't join with its base hiker or another of their variants. RANDOM follows the same rule.
- **Selection:**
  - start works with 1, 2, 3 and 4 hikers, and not with 0;
  - dropping on a filled spot swaps the hikers;
  - the × button removes a hiker.
- **Sorting:**
  - each sort makes the right groups in the right order;
  - DEFAULT has no ribbons;
  - the difficulty number never appears in the UI (debug toggle off).
- **Level-up:**
  - only slots the trait fits accept it;
  - replacing removes the old trait;
  - KEEP MY TRAITS changes nothing;
  - a new-slot option adds a slot;
  - queued level-ups come one after another.
- **Placeholder text:** no player-facing text still says "Wyatt will write".
- **Assets:**
  - every trait in the data has an icon file or uses the placeholder;
  - every hiker with a portrait has a `portraits.json` entry.
