# Item cards in the TrailMate style

Wyatt asked to "transition the Item cards into that style": the packing machine's GPS look. The game blends two styles: **the New Deal park posters** (the map, windows and backgrounds) and **the TrailMate GPS tech** (items, minigames and the packing machine).

He liked the first mock ("Looks great!") and asked for three changes, which are in:
1. **The back:** no white square. The type icon is bigger and part of the back, like a device's logo.
2. **The back looks like a walkie-talkie's,** not a phone's: ridges and a speaker grille, and no camera.
3. **The dots along the bottom count the item's uses:** bites for food, durability for clothes, uses for tools and set-ups for shelters. One dot for each point it can have, and the lit ones are what it has left. On the big card and in the bag.

**The reference:** `mockups/item-cards/cards.html` (open it in a browser) and `mockups/item-cards/board.png`. Match its sizes, colors and fonts. Ideas marked *(Claude's idea)* are mine.

---

## 1. The front
Each card is a little device. Sizes are for a card 220 × 308 (scale everything from the width, as `ItemCard` does now).
- **The shell:** rounded (radius 26), a gradient in the type's colors (section 4), from light at the top left to dark at the bottom right. A light edge on top, a dark one at the bottom, and a drop shadow.
- **Hardware:** two short buttons on the left side and a long one on the right, and a speaker slot at the top. All dark (#1C201E).
- **The face:** a dark bezel inset 10 px (19 px at the top, 28 at the bottom, for the LEDs).
- **The screen:** LCD green (#BAC995), with:
  - a faint 16 px grid;
  - scanlines;
  - a soft dark vignette at the edges;
  - a light glare from the top left.
- **The top strip:** a dark bar (#1D2918) across the top of the screen with:
  - the type's icon and name, in the type's bright color (TOOL, FOOD, CLOTHES, SHELTER, DRINK, TRINKET);
  - the slot for clothes ("· BODY"), in a dim green;
  - the tier chip at the right, from Tier II (section 5).
- **The art:** the item's art in LCD greens, made by `greenify` (on the packing branch, `src/ui/packing/greenify.ts`) at **[58] px, drawn at 2×** with crisp pixels. Four corner brackets around it in the type's bright color.
- **The name:** Edit Undo, 15 px, dark green (#1D2918), centered under the art.
- **The text:** **Pixelify Sans**, 12.5 px, #2B3A23, centered. Long text shrinks (to 10 px at the least) so it never covers the bottom row.
  - Add the font: `@fontsource/pixelify-sans`.
- **The bottom row** (on the screen):
  - left: "QUALITY 3" and five diamonds, filled up to the Quality. Shelters say "NO QUALITY";
  - right: the counter word over "3/4" (section 2).
- **The LEDs** sit on the shell, under the screen (section 2).

---

## 2. The LEDs: what's left
Wyatt: "the dots being its total, and the lit up dots being how much it currently has."
- **One LED per point** of the item's full counter at its Quality (`fullCounters`), 8 px, 4 px apart, centered under the screen.
- **Lit** (#B8FFC8 with a green glow) for each point left; **dark** for each one used.
- **The counter word** on the screen matches:

| Type | Word |
| --- | --- |
| Tools | USES |
| Food | BITES |
| Drinks | SIPS |
| Clothes | DURABILITY |
| Shelters | SET UPS |

- **No counter, no LEDs** (some trinkets).
- **Unrolled items** (a packing preview, a blueprint, a Choice pick): the counter is a range across Qualities (`counterRange`), so:
  - the lit LEDs are the least it can have;
  - the rest, up to the most, are **rings** (not lit, just outlined);
  - the screen says "QUALITY ?" with five empty diamonds, and the counter as "2–4".
  - See NOT ROLLED YET on the board.
- **The most is 9** (Work Boots, Heavy Jacket and others), which fits easily on the big card.
- **Using one** *(Claude's idea)*: the LED flickers twice and goes dark.

---

## 3. The back: a walkie-talkie
- **The shell** in the type's gradient, the same shape as the front.
- **A rubber rim:** a dark band 6 px wide all the way around the inside of the edge.
- **Grip ridges** down both sides: a column of short dark ridges, 10 px wide, from 46 px below the top to 46 px above the bottom.
- **Four screws** near the corners.
- **The logo:** the type's icon, big (74 × 96), **embossed into the shell**, not on a sticker. It's three layers of the same icon shape:
  - a light highlight, shifted 1.5 px down and right;
  - a dark shadow, shifted 1 px up and left;
  - the shell's dark color on top.
- **The words,** embossed the same way: "TRAILMATE" (Edit Undo, 12 px, wide letter spacing), and under it "TOOL · SUPPLY" (or FOOD, and so on) in a small dim line.
- **The speaker grille:** a recessed panel in the lower half, with 5 dark horizontal slots.
- **No camera, no sticker.**
- **Where backs show:** wherever a card is face down today (scavenge deals before they flip, crafting choices, rewards).

---

## 4. The types and their colors

| Type | Shell light | Shell dark | Bright (strip, brackets) | Logo |
| --- | --- | --- | --- | --- |
| Tool | #F6BA55 | #E0642E | #FF9F1C | the tool icon |
| Food | #86D594 | #3A8A5A | #8BE04E | the food icon |
| Drink | #8BE6DD | #2C9A93 | #3FE0D0 | a cup (in `cards.html`) |
| Clothes | #DDA470 | #8A5636 | #FFB37A | the clothes icon |
| Shelter | #A3D3F3 | #5468A0 | #4FC3F7 | the shelter icon |
| Trinket | #E2A9F1 | #9A3F64 | #D675EF | the trinket icon *(Claude's pick; not on the board)* |

- **The icons** are the type icons the game already uses (`cardLook.ts`), except the drink's cup.
- **Drinks** (`29-core-loop.md`, section 3) are food with `drink: true`: they get the drink colors, DRINK, the cup and SIPS.
- **Presents** keep their own wrapping, as now.

---

## 5. Tiers
- **Tier I:** nothing extra.
- **Tier II:** a **silver trim** around the shell (a light ring, a darker ring outside it and a soft silver glow), silver corner brackets, and a silver **II** chip in the top strip. See the Camera on the board.
- **Tier III:** the same in **gold**, with a **III** chip *(Claude's idea, to match today's gold numeral)*.
- **Tier IV:** the same with a slowly shifting rainbow trim, like today's prismatic numeral.

---

## 6. In the bag
- **Small screens,** 48 × 58: the shell in the type's colors, a dark bezel, the LCD screen with the green art (34 px) and scanlines.
- **The LEDs** under the screen, 5 px and 2 px apart. With more than 6, they shrink to 3.5 px and 1.5 px apart so 9 still fit (the Flannel on the board).
- **The bag box:** "FINN'S BAG" and "4/4", dark, with the slots in a row. An empty slot is a dark recess.
- **Hovering** a small screen shows the big card, as now.

---

## 7. Where it goes
- **Replace the look of `ItemCard`** (`src/ui/items/ItemCard.tsx`) for every item, big and compact. Today it's used in the scavenge deal, crafting, the challenge window, the turn panel, the stash, the station's counter, packs and shop, the trail shop, presents, previews and the debug items.
- **The packing machine's card preview** (`27`, section 3) uses the same card.
- **What stays the same:** the data the card reads (the rolled values, `itemRangeText`, `counterRange`, `fullCounters`, the boost chips).

---

## 8. Tests
- **LEDs:** as many as the full counter, and lit for what's left. Unrolled: lit for the least, rings up to the most.
- **Words:** each type shows its counter word; drinks show SIPS and DRINK; shelters show NO QUALITY.
- **Fit:** every item's text fits its card at the smallest size (the longest texts shrink, never overlap the bottom row). A test can measure this with the existing `FIT_CHARS` rule.
- **Every item has its green art** (or a fallback icon).

---

## 9. Things to flag to Wyatt
- **The old look goes away.** I'd replace it outright rather than add a setting, since the game uses one card everywhere.
- **The Tier III gold and Tier IV rainbow trims,** and the trinket colors, aren't on the board yet.
- **The LED flicker** when a use is spent is my idea.
