# Update: November 24, 2026 (Dodge minigame, test version)

**Builds on the earlier minigame updates**, including `UPDATE-2026-11-24-four-minigames`, because it uses that update's **Line up** step. Finish those first if they aren't done. Keep everything already built.

This adds **Dodge**, an Undertale-style dodging game for animal encounters:
- one sprite for the whole party, in the active hiker's color;
- the active hiker switches to the next in line every few seconds;
- whoever is active when the sprite is hit loses a life, and out of lives means out;
- survive until the clock runs out.

The first two animals are **Bees** and **Bear with a Sword**.

**This is a test version:** placeholder art in the GPS greens, no Prepare options, no menus. The full design is in `12-minigames-dodge.md`. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `12-minigames-dodge.md` → `docs/design/12-minigames-dodge.md`.
- `mockups/*` → `docs/mockups/minigames/dodge/`.
- `art/dodge/` → the game's minigame asset folder, next to the others.
- Then delete the leftover `update-2026-11-24-dodge/` folder.

---

## 1. The game (design sections 1 to 4)
- **The sprite:** `person.png`, with its white pixels tinted in the active hiker's color.
- **Switching hikers:**
  - every [5 s] the next hiker in line who is still in takes over;
  - a 1 s color blink warns first;
  - the HUD counts down to the switch.
- **Hits:** each hiker has [2] lives. A hit costs the active hiker 1 life and gives [1 s] of safety. A hiker at 0 is out and never switches back in.
- **Length:** the tier's length, [20 s], [25 s] or [30 s]. It ends early if everyone is out.
- **Results:** Passed or Failed per hiker, with hit counts.
- **Controls:**
  - WASD or the arrow keys;
  - a floating touch joystick that appears where the finger lands;
  - mouse drag works like touch.
- **Warnings:** every attack is warned [0.6 s] before.

## 2. Bees (design section 5)
- **Box:** square.
- **Patterns:**
  - Lane, with one gap;
  - Cross;
  - Diagonal (Tier II and up);
  - Zigzag (Tier II and up);
  - Aimed (Tier III).
- "!" markers show where the bees will come in.

## 3. Bear with a Sword (design section 6)
- **Box:** wide.
- **Swing:** the half about to be swept is hatched; then the sword sweeps it around a pivot above the box.
- **Faster each time:** every swing shortens the warning, down to a minimum.
- **Tier II and up:** double swings.
- **Tier III:** the box sometimes shrinks.

## 4. Testing tab (design section 7)
- Add **Dodge**, with these settings:
  - Animal;
  - Tier;
  - Hikers;
  - Lives per hiker (1 to 3);
  - Length (10 to 60 s);
  - Switch every (3 to 10 s).

## 5. Tests
See design section 8.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret;
- how to open Dodge from the testing tab and change the lives, length and switch time.
