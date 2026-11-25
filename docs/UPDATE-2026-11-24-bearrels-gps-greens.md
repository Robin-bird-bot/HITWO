# Update: November 24, 2026 (Bearrels in the GPS greens, a new bear, moving scanlines)

**A follow-up to `UPDATE-2026-11-24-bearrels-styles`.** If that update is still being built, finish it, then apply this one on top. Keep everything already built: the minigame framework, the pop-up, the vertical GPS with its preview and its turn and zoom, drag-and-drop, the testing tab, and Bearrels' rules and flow.

Wyatt tried the styles. This update changes five things:

1. **The art** is now drawn in the GPS's own greens, in two versions to compare in the game: **Detailed pixel** and **Drawn 2D**. Earthy pixel, Teal pixel and Silhouette are removed.
2. **The bear** now aims his revolver at the screen, and turns it toward the barrel he's aiming at. Before, he held the gun across his body like a pole.
3. **Hikers** crouch in front of their barrel with their backs to us, and a strip of tall grass is drawn in front of everything.
4. **Scanlines** run up and down during play and drift sideways.
5. **The in-game UI** uses the GPS look: dark green boxes with a pixel font.

The full design is the new `10-minigames.md`, which replaces the old one. The note at its top lists what changed. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `10-minigames.md` → `docs/design/10-minigames.md`, replacing the old one.
- `mockups/*` → `docs/mockups/minigames/`. Replace any files with the same names. The older mockups that show the Earthy, Teal and Silhouette styles can be deleted, except `4-vertical-gps-preview-then-turn.jpg`, `7-game-states-reference.jpg` and `8-testing-tab-reference.jpg`, which the design still points to.
- `art/bearrels/gps-pixel/` and `art/bearrels/gps-drawn/` → into the game's `minigames/bearrels/` asset folder, as two subfolders.
- `art/bearrels/layout.json` → replaces `minigames/bearrels/layout.json`. It covers both new versions.
- Delete the old `pixel-earth/` and `pixel-teal/` asset folders and the silhouette SVG parts, once nothing uses them.
- Then delete the leftover `update-2026-11-24-bearrels-gps-greens/` folder.

---

## 1. The GPS greens (design section 3)
- **Replace the three styles with two:** Detailed pixel (default) and Drawn 2D. Keep the "one scene model, many renderers" setup, so switching still just redraws.
- The scene is now **320 × 240** scene units (it was 280 × 210).
  - **Detailed pixel:** 1 px per unit. Scale up with nearest-neighbor, at a whole-number scale where it fits.
  - **Drawn 2D:** 4 px per unit. Draw at a quarter of the file size, with normal smoothing.
- **Draw order changed:** background, bear, log, barrel shadows, barrels, **hikers**, **foreground**, crosshair, muzzle flash, effects. `foreground.png` (tall grass and dirt) goes over the barrels and the hikers.
- Every position comes from `layout.json`. Check your frames against the `_reference-*.png` files in each folder.
- Only the hikers, the crosshair and the hit flash use colors outside the greens.

## 2. The bear (design section 3, "The bear")
- **Sprites:** `bear-hidden.png`, `bear-aim-center.png`, and `bear-aim-side.png` (aims left; mirror it to aim right). All aiming poses share one position.
- **He tracks the crosshair:** while it sweeps, pick his pose from the crosshair's x (under 130 → left, over 190 → right, otherwise middle). When it settles he holds that pose and fires.
- **Muzzle flash:** centered on the muzzle point for the current pose. `layout.json` → `bear.muzzle` has a point for each pose, right included.
- **Pop up:** slide the aiming sprite up from 18 units lower over [450 ms] with a small bounce, clipped above y 160 so nothing shows under the log.

## 3. Hikers in front of the barrels (design section 3, "Hikers")
- Use `hiker-<id>-<100|80|62>.png`. The size depends on how many share the barrel: 1 → 100, 2 → 80, 3 or 4 → 62.
- Place them with `layout.json` → `hikers` (centers spread across the barrel, and a top line). They sit in front of the barrel, and the foreground grass covers their lower half.
- Hit hikers tip over into the grass and fade, as before.
- The drop target for dragging now covers the barrel and the hikers in front of it.

## 4. Scanlines (design section 2, "Screen")
- The lines belong to the GPS glass, so they turn with it: across and still in the upright preview, **up and down** once it has turned sideways.
- **During play** they drift sideways at about [10 px/s]. A soft, slightly brighter band about [15%] of the screen wide sweeps across every [6 s].
- Lines are 1 px, about [8%] dark, every [3 px] of screen.
- **Reduced motion:** the lines stay still and there's no band.

## 5. The in-game UI (design section 3, "In-game UI")
- Restyle the round box, prompt, shots, hiker tokens and Ready to match `mockups/1-playing-gps-pixel.jpg`:
  - dark green boxes (#1D2918) with a light green border (#BAC995) and a darker drop edge;
  - light text (#D3DFAF) in the pixel font, in capitals.
- The layout and behavior stay the same. The prompt still turns red for bad news.

## 6. Testing tab (design section 5)
- **Art style** now has two buttons: Detailed pixel and Drawn 2D. The preview follows it.
- The Style button and the **S** key switch between the two while playing in test mode.
- If a saved setting names an old style, fall back to Detailed pixel.

## 7. Tests
- Both versions draw 3, 4, 5 and 6 barrels in the right places, matching `layout.json` and the `_reference-*.png` frames, and the UI never covers a barrel.
- The bear's pose follows the crosshair (left, middle, right) and the flash appears at that pose's muzzle, including when mirrored.
- 1 to 4 hikers at one barrel are sized and spread as the layout says, and the foreground grass is drawn over them.
- Switching versions mid-round keeps every hiker's barrel, the round, and who is out.
- During play the scanlines run up and down and move; with reduced motion they don't move.

## When you're done
Send Wyatt a short summary with:
- what changed;
- anything you had to interpret;
- how to switch between Detailed pixel and Drawn 2D while playing.
