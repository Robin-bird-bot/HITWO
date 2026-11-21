# Update: November 20, 2026 (Phase 10b follow-up: final icons, bigger icons)

A small follow-up to `UPDATE-2026-11-20-phase-10b.md`. If you haven't started 10b yet, apply this at the same time; if you have, apply it on top.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `assets/traits/*.png` → `public/assets/traits/`. **Replace every file there.**
  - Forgetful (`forgetful.png`) and Snores (`snores.png`) are new, so every trait now has art. Drop the placeholder-icon fallback for real traits; keep it only for traits added later without a file.
  - The other icons were re-cut with almost no empty margin, so they fill whatever size you draw them at.
- `assets/cards/family/*.png` → `public/assets/cards/family/`, then **delete the old `.svg` files** there.
  - Wyatt's final family icons: `human`, `dog`, `cat`, `plush`, `duo` and `variant` (a star). They're white on transparent, so draw them in `#1A1A1A` with a CSS mask, the same way as the trait icons.
- `mockups/*` → `docs/mockups/`, replacing the files with the same names.
- Then delete the leftover `update-2026-11-20-phase-10b-icons/` folder.

## 1. Bigger trait icons (everywhere a trait badge or row appears)
Wyatt wants the icons large and easy to tell apart. **Cropping at the edges is fine.**

- **Badges** (cards, hiker panel, selection spots, level-up):
  - The diamond holds the icon at about **the diamond's full side length**, clipped to the diamond (`overflow: hidden` on the rotated square, with the icon counter-rotated inside).
  - The circle holds the icon at about **85% of its width**, clipped to the circle.
  - **On a 300-wide card:** diamond 35 px with a 34 px icon, circle 42 px with a 36 px icon. Badges grow a little to fit: a 50 px box per badge.
- **Card back:** each trait row's icon square holds the icon at **90% of the square**, tinted the type's middle color and clipped to the square.
  - Rows are taller now. Shrink the portrait strip to 84 and the name band to 34, so the rows start at 142 and get about 228 px between them and the bag bar.
- **Level-up screen:**
  - option cards: diamond 58 px with a 58 px icon, circle 72 px with a 62 px icon;
  - the "your traits" tiles show their badges at 1.4×.
- **The 10a hiker panel badges** follow the same rule (icon fills the shape, clipped).
- Update the badge component once and every place that uses it follows. Check the new mockup PNGs.

## 2. Variants and placeholders
- **Variant cards** (Follower Finn, Agility Finn, Ellie the Devourer, Nosework Ellie, Planner Wink, Graduate Mom, Showgirl Gdog, Wywee) show the **star** next to their family icon in the top left (22 px, just right of it).
- **Placeholder portraits:**
  - variants without art show the **star** in the middle of the window;
  - Ben and Mindy show their family icon.
  - Both at about a third of the window's width, 30% opacity, in `#1A1A1A`.

## 3. Tests
- Every trait in the data has an icon file.
- Every family has an icon file.
