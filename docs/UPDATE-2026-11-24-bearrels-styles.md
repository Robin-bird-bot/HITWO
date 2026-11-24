# Update: November 24, 2026 (Bearrels: vertical GPS, three art styles, drag-and-drop)

**A follow-up to `UPDATE-2026-11-24-bearrels-test`.** If that update is still being built, finish it, then apply this one on top. Keep everything already built: the minigame framework, the pop-up, the testing tab, and Bearrels' rules and flow. This changes four things:

1. **The GPS** is vertical again. In the pop-up it plays a looping preview of the game. On Start it **turns sideways and zooms in** until it fills most of the window, and the game plays wide (4:3).
2. **Three art styles** that Wyatt can switch between in the testing tab, even mid-game, to compare them in the actual game: **Earthy pixel**, **Teal pixel** and **Silhouette**.
3. **Drag-and-drop:** drag a hiker's portrait onto a barrel to hide them there. Tap, then tap still works.
4. **Hikers** are plain color-coded silhouettes in every style for now.

The full design is the new `10-minigames.md`, which replaces the old one. A short "Revised November 24" note at its top lists what changed. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `10-minigames.md` → `docs/design/10-minigames.md`, replacing the old one.
- `mockups/*` → `docs/mockups/minigames/`. Replace any files with the same names.
- `art/bearrels/pixel-earth/` and `art/bearrels/pixel-teal/` → into the game's existing `minigames/bearrels/` asset folder, as two subfolders.
- `art/bearrels/layout.json` → replaces `minigames/bearrels/layout.json`. This is the silhouette layout; its barrel width line was out of date.
- Then delete the leftover `update-2026-11-24-bearrels-styles/` folder.

---

## 1. The vertical GPS with preview, then turn and zoom (design section 2)
- Rebuild the GPS body as **vertical**, with a 3:4 screen (see mockup 4).
- **Before Start:** the upright GPS in the pop-up loops a non-playable demo of Bearrels: a ghost finger drags a hiker to a barrel, then the bear pops up and fires. It shows a "▶ PREVIEW" pill and "Watch, then press Start".
- **Start:** the GPS turns 90° clockwise and zooms in over [700 ms] until the device fills most of the window. Mockups 1 to 3 show the size to aim for. The game then plays on the now-landscape 4:3 screen.
- **Continue:** it turns back upright and shrinks.
- **Reduced motion:** a crossfade instead.
- The game area is now **4:3** for every minigame.

## 2. Three art styles (design section 3)
- **Earthy pixel** (default) and **Teal pixel:**
  - draw at 280 × 210 from the sprites in `pixel-earth/` and `pixel-teal/`, placed exactly as each `layout.json` says;
  - scale up with nearest-neighbor;
  - the `_reference-*.png` files show the expected result.
- **Silhouette:** the existing SVG parts at 4:3 (viewBox `0 -120 1280 960`, plus the sky and ground strips in `layout.json`).
- **Effects** are drawn in code on top of any style: red flash, shake, hikers tipping over, splinters, smoke.
- **One scene model, three renderers.** Game state (barrels, hikers, bear, crosshair) must not depend on the style, so switching styles mid-round just redraws the scene.

## 3. Drag-and-drop (design section 4, Controls)
- Pointer events for mouse and touch.
- **Start:** press a token, or a hiker already behind a barrel, and move more than [6 px].
- **While dragging:** the portrait follows the pointer, lifted and tilted. The barrel under the pointer lights up, with a generous hit area.
- **Release:** over a barrel, the hiker hides there; anywhere else, the portrait flies back to its token.
- Tap, then tap and the keyboard controls stay as they are.
- Change the placing prompt to "Drag a hiker to a barrel".
- Note in the framework that every future minigame supports dragging anything the player places or moves.

## 4. Testing tab (design section 5)
- Add an **Art style** setting: Earthy pixel, Teal pixel, Silhouette. The preview thumbnail follows it.
- While playing in test mode, a small **Style** button outside the GPS screen, and the **S** key, cycle the style live.
- Remember the chosen style with the other settings.

## 5. Tests
- Each style draws 3, 4, 5 and 6 barrels in the right places, matching `layout.json`, and the UI never covers a barrel.
- Switching styles mid-round keeps every hiker's barrel, the round, and who is out.
- Dragging: dropping on a barrel places the hiker; dropping elsewhere returns them; no drag while the bear is up; tap, then tap still works.
- The GPS ends up landscape and filling most of the window at desktop size and on a phone in landscape. Reduced motion uses the crossfade.

## When you're done
Send Wyatt a short summary with:
- what changed;
- anything you had to interpret;
- how to switch styles while playing.

Wyatt will compare the three styles in the game and pick one.
