# Update: November 20, 2026 (Phase 10b polish: titles, colored icons, Mitchell, animated background)

The last follow-up to Phase 10b. Apply it after `UPDATE-2026-11-20-phase-10b.md` and `UPDATE-2026-11-20-phase-10b-icons.md`, or together with them if 10b isn't built yet. Where this file disagrees with those two, **this one wins**.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `assets/portraits/mitchell.png` and `portraits.json` → `public/assets/portraits/` (replace both).
- `assets/shaders/hiker-select-bg.frag` → wherever the game keeps shaders (create `src/shaders/` if there's none).
- `mockups/*` → `docs/mockups/`, replacing files with the same names.
- Then delete the leftover `update-2026-11-20-phase-10b-polish/` folder.

## 1. Titles: bigger, right under the name
Like Wyatt's concept art.
- **Card front name band:** the name and title stack with **no gap**.
  - Name line-height 0.9.
  - Title about **18 px on a 300-wide card** (up from 13), line-height 0.95, color `#5E5E5E`.
  - Shrink long titles to fit the width.
- **Party spots on the selection screen:** the title now sits **under** the name, not beside it.
  - The white band is 52 tall: name 26 px, title 16 px.
  - The portrait above it is 204 tall, and the trait badges start at 278. The spot is 360 × 350.

## 2. Trait icons in the trait's color
Every trait icon is drawn in its **type's ring color** instead of white:
- Trail `#F2B950`;
- Utility `#9CC3A8`;
- Morale `#CDA6EE`;
- used up `#6F6A60`.

The middle of the badge stays the darker shade. Use the CSS mask already used for tinting, with the ring color as the fill.
- **Where:** badges everywhere (hiker panel, card fronts, selection spots, level-up cards and slot tiles), and the "?" fallback.
- **The card back** stays as it is: the icon in the type's **middle** color on a ring-colored square.
- This replaces "show white by default" from the 10a update.

## 3. Mitchell
His portrait is re-centered on his face; it was centered between him and his cat. Replace `mitchell.png` and `portraits.json` (only his `faceY` changed).

## 4. Animated background on the hiker selection screen
A slow, swirling, pixelated paint in forest greens, a little like Balatro's background. See `mockups/HikerSelect-background.png` and `mockups/HikerSelect.png`.

- **What it is:** one full-screen WebGL2 fragment shader, `hiker-select-bg.frag`, drawn on a canvas behind everything on the screen.
  - Draw it with a single full-screen triangle.
  - Prepend `#version 300 es`, `precision highp float;` and `out vec4 outColor;` to the file.
- **Uniforms:**

  | Uniform | Value |
  | --- | --- |
  | `uTime` | Seconds since the screen opened |
  | `uResolution` | Canvas size in pixels |
  | `uMouse` | Pointer position from 0 to 1, y up, smoothed. When the pointer isn't over the screen, let it drift slowly in a loop so the bend still shows |
  | `uDeep` | `#141E1A` |
  | `uMoss` | `#2D4A3F` |
  | `uMist` | `#6E8C7E` |
  | `uGlow` | `#E9B44C` |
  | `uSwirl` | [1.2] |
  | `uPixels` | [150], how many pixel rows tall the screen is |
  | `uPull` | [0.5], how much the paint bends toward the pointer |

  Put the bracketed numbers in `balance.ts`, or a UI constants file, with `TODO(wyatt)`.
- **Behavior:**
  - **Performance:** render the canvas at no more than 1.5× device pixels. The shader already pixelates itself, so a lower resolution is fine on slow machines.
  - **Pausing:** stop the animation loop when the screen is hidden or the tab isn't visible.
  - **Reduced motion:** draw one still frame and stop.
  - **No WebGL2:** fall back to a plain `#141E1A` background.
  - **Readability:** keep it behind a solid UI. The spots and cards already have their own backgrounds, so nothing on top needs to change.
- **Only this screen** gets it for now.

## 5. Tests
- Every badge icon uses its type's ring color, and the used-up color when used up.
- The background shader compiles. Under reduced motion it draws once and doesn't animate, and the fallback color shows when WebGL2 isn't available.
