# Update: November 24, 2026 (Dodge tuning, and a new boss: the Woods Monster)

**Builds on `UPDATE-2026-11-24-dodge-animals`.** Wyatt played the new animals. These are his changes, plus a new boss. Keep everything else as it is.

The revised `12-minigames-dodge.md` replaces the old one. The note at its top lists what changed. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `12-minigames-dodge.md` → `docs/design/12-minigames-dodge.md`, replacing the old one.
- `mockups/*` → `docs/mockups/minigames/dodge/`.
- `art/dodge/*` → the existing `dodge/` asset folder. These are new files only.
- Then delete the leftover `update-2026-11-24-dodge-tuning/` folder.

---

## 1. All animals
1. **More going on at once** (design section 6, "Pacing and overlaps").
   - Shorter gaps between attacks: [0.8 s], [0.6 s] and [0.4 s] by tier.
   - Attacks can overlap: a [30%], [50%] or [70%] chance by tier, up to [2], [2] or [3] at once.
   - Tag each attack as **area**, **missile** or **changer**. Only one area attack and one changer can run at a time. Missiles stack.
2. **Fix: warnings below the box sometimes don't show** (section 3, Warnings). Wyatt saw it with Bees.
   - Draw warnings on their own top layer.
   - Keep a [12]-unit gap between the box and both HUDs.
   - Move a marker inside the box edge if it would be covered.
   - Make sure every group, on every side, gets its marker.

## 2. Per animal
- **Bees** (section 5): bees in a row come in staggered, each with a random [0–0.45 s] delay, so there's room to weave between them. Wyatt found them a bit too hard.
- **Claws everywhere** (section 6, Claws):
  - always curved;
  - [2], [3] or [4] rows per attack by tier, [0.25 s] apart, from different sides.
  - **Fix:** claws sometimes appeared upside down. Turn each claw along its direction of travel every frame, and never flip it vertically.
- **Bear** (sections 6 and 7):
  - **Roar becomes Shout:** a burst of small arc waves aimed at the sprite, like a directional shout. The full rings were far too strong.
  - **Bear hug** holds for [3 s] and is a changer, so other attacks run during it.
- **Bear with a Sword** (sections 6 and 8):
  - extra claw rows on top of its sword attacks;
  - a clearer **Thrown sword**: the path shows first, out and back with arrows; the full sword spins with two fading copies behind it; the bear throws and catches;
  - **new Wave:** the sword slides along the top or bottom wall and dips in and out.
- **Bobcat** (sections 6 and 9):
  - **new Stalk:** it comes in, then hops at the sprite and lands, 3 or 4 times;
  - claws ×[1.5] speed;
  - **Zigzag dash:** sharper turns and short legs, and it bounces off the wall for [2] or [3] passes.
- **Squirrel Army** (section 6, Wall scurry): the running squirrels flick nuts at the sprite.

## 3. New boss: the Woods Monster (section 12)
- **The look:** the night events' monster, with two cultists beside the box. New sprites are in `art/dodge/`: `monster-head`, `cultist`, `flame-1`, `flame-2`, `candle`, `wisp`, `rune`, `eye`, `hand`, `nut`.
- **Hard on purpose:**
  - he always plays one tier up;
  - he lasts [40 s] by default;
  - on Tier III his second half shrinks the box.
- **Attacks:**
  - **Fire tongues** (Wyatt's idea): flames rise from the floor in columns, and you move into the gaps. A second set follows on Tier II, and flames come from the ceiling too on Tier III.
  - *Claude's ideas:* Grasping hands, Candle wisps, Rune beams, Ritual circle, The Eye, and Darkness (Tier III).
- **Not in the Stampede:** he stays his own encounter.
- **Mockups:** `14-woods-monster-fire.png` and `15-woods-monster-ritual.png`.

## 4. Testing tab (section 13)
- **Animal:** add the Woods Monster.
- **Overlaps:** a new setting (Auto, Off, On).
- **Attack picker:** with one attack picked, nothing overlaps.

## 5. Tests
See section 14: pacing and overlap rules, warnings on every side, bee stagger, claw facing, the 3-second hug, Stalk aiming, Zigzag bounces, and the Woods Monster's tier-up and second half.

## When you're done
Send Wyatt a short summary with:
- what changed;
- what caused the missing warnings and the upside-down claws;
- how to try the Woods Monster and the Overlaps setting.
